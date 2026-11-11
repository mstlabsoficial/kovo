// Interfaz v3 conectada: series de citas (todo o nada, reintento sin duplicar), cancelación de
// «esta y las siguientes» y días cerrados (professional_time_off ↔ fechas de Madrid). Sin red.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createEntityWriter } from '../../src/data/writes.js';
import { createLegacyWrites, madridToUtc } from '../../src/data/legacy-writes.js';
import { blocksFromRows, annotateSeries } from '../../src/data/legacy-state.js';
import { ORG, uuid } from '../fixtures/supabase-fake.mjs';

const ctx = { id: ORG, role: 'recepcion' };
const patient = { id: uuid(1) };
const input = { patientId: uuid(1), start: 600, dur: 50, service: null, price: 5500, modal: 'presencial', loc: 'Despacho', notes: '', status: 'confirmada' };
const dates = ['2026-11-16', '2026-11-23', '2026-11-30'];
let n = 0; const newId = () => uuid(9000 + ++n);
const echo = rows => rows.map(r => ({ ...r, created_at: 'x', updated_at: '2026-11-11T10:00:00Z' }));

describe('series de citas', () => {
  test('una sola petición con todas las filas y el mismo series_id; horas de Madrid', async () => {
    const calls = [];
    const writer = createEntityWriter({ getContext: async () => ctx, request: async (p, o) => { calls.push({ p, o }); return echo(o.body); } });
    const W = createLegacyWrites({ writer, newId });
    const { appts, seriesId } = await W.saveAppointmentSeries({ input, dates, patient });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].o.method, 'POST');
    assert.equal(calls[0].o.body.length, 3);
    assert.ok(calls[0].o.body.every(r => r.series_id === seriesId && r.org_id === ORG && r.status === 'confirmed'));
    assert.equal(calls[0].o.body[0].starts_at, madridToUtc('2026-11-16', 600));
    assert.deepEqual(appts.map(a => [a.date, a.start, a.seriesId]), dates.map(d => [d, 600, seriesId]));
  });
  test('respuesta perdida: el reintento usa los mismos ids y reconoce la serie ya creada', async () => {
    const stored = []; let lose = true; const bodies = [];
    const request = async (p, o = {}) => {
      if (o.method === 'POST') {
        bodies.push(o.body);
        if (stored.length) { const e = new Error('dup'); e.status = 409; e.details = { code: '23505' }; throw e; }
        stored.push(...echo(o.body));
        if (lose) { lose = false; throw new TypeError('Failed to fetch'); }
        return stored;
      }
      return stored.slice();
    };
    const W = createLegacyWrites({ writer: createEntityWriter({ getContext: async () => ctx, request }), newId });
    await assert.rejects(W.saveAppointmentSeries({ input, dates, patient }), e => e.code === 'network');
    const r = await W.saveAppointmentSeries({ input, dates, patient });
    assert.equal(r.outcome, 'already_created');
    assert.deepEqual(bodies[0].map(x => x.id), bodies[1].map(x => x.id));
    assert.equal(stored.length, 3);
  });
  test('solape en cualquier fecha: error claro y nada aplicado', async () => {
    const request = async () => { const e = new Error('x'); e.status = 400; e.details = { code: '23P01' }; throw e; };
    const W = createLegacyWrites({ writer: createEntityWriter({ getContext: async () => ctx, request }), newId });
    await assert.rejects(W.saveAppointmentSeries({ input, dates, patient }), e => e.code === 'overlap' && /solapa/.test(e.message));
  });
  test('menos de 2 fechas o fila de otra clínica: se rechaza', async () => {
    const W = createLegacyWrites({ writer: createEntityWriter({ getContext: async () => ctx, request: async (p, o) => echo(o.body).map(r => ({ ...r, org_id: uuid(5) })) }), newId });
    await assert.rejects(W.saveAppointmentSeries({ input, dates: dates.slice(0, 1), patient }), e => e.code === 'validation');
    await assert.rejects(W.saveAppointmentSeries({ input, dates, patient }), e => e.code === 'unexpected_response');
  });
  test('cancelar «esta y las siguientes»: un PATCH filtrado por serie, fecha y estado abierto', async () => {
    let call;
    const S = uuid(77);
    const request = async (p, o) => { call = { p, o }; return [{ id: uuid(3), org_id: ORG, series_id: S, patient_id: uuid(1), status: 'cancelled', starts_at: '2026-11-23T09:00:00Z', ends_at: '2026-11-23T09:50:00Z', updated_at: 'v' }]; };
    const W = createLegacyWrites({ writer: createEntityWriter({ getContext: async () => ctx, request }), newId });
    const { appts } = await W.cancelSeries({ appt: { seriesId: S, startsAt: '2026-11-23T09:00:00Z' } });
    assert.equal(call.o.method, 'PATCH');
    assert.match(call.p, new RegExp(`org_id=eq\\.${ORG}&series_id=eq\\.${S}&starts_at=gte\\.2026-11-23T09%3A00%3A00\\.000Z&status=in\\.\\(scheduled,confirmed\\)`));
    assert.deepEqual(Object.keys(call.o.body).sort(), ['status', 'updated_at']);
    assert.equal(appts[0].status, 'cancelada');
    await assert.rejects(W.cancelSeries({ appt: { seriesId: null } }), e => e.code === 'validation');
  });
  test('numeración de la serie: posición, total y cada cuántos días', () => {
    const a = annotateSeries([{ seriesId: 's', date: '2026-11-30', start: 600 }, { seriesId: 's', date: '2026-11-16', start: 600 }, { seriesId: null, date: '2026-11-17', start: 0 }]);
    assert.deepEqual(a.map(x => [x.seriesIdx, x.seriesTotal, x.seriesEvery]), [[2, 2, 14], [1, 2, 14], [undefined, undefined, undefined]]);
  });
});

describe('días cerrados', () => {
  test('filas de professional_time_off → fechas de Madrid, último día incluido (también con cambio de hora)', () => {
    const rows = [
      { id: 'b', professional_id: 'p', starts_at: madridToUtc('2026-12-24', 0), ends_at: madridToUtc('2027-01-07', 0), reason: 'Navidad' },
      { id: 'a', professional_id: 'p', starts_at: madridToUtc('2026-10-24', 0), ends_at: madridToUtc('2026-10-26', 0), reason: null }
    ];
    assert.deepEqual(blocksFromRows(rows).map(b => [b.from, b.to, b.label]), [['2026-10-24', '2026-10-25', 'Cerrado'], ['2026-12-24', '2027-01-06', 'Navidad']]);
  });
});
