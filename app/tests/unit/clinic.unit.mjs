// clinic.js: operaciones del modo conectado (ajustes, equipo, horario, documentos, facturas, gastos).
// Sin red: la petición se sustituye por una función que registra lo enviado.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClinicApi, clinicError, safeFileName, ClinicError, DOC_MAX_BYTES } from '../../src/data/clinic.js';
import { BLOCKED } from '../../src/saas/connected.js';
import { settingsFromDb, availFromRows, DEFAULT_SETTINGS } from '../../src/data/legacy-state.js';

const ORG = '0a000000-0000-4000-8000-00000000000a';
const P = '0b000000-0000-4000-8000-00000000000b';
const PRO = '0c000000-0000-4000-8000-00000000000c';
const err = (status, code, message = 'x') => Object.assign(new Error(message), { status, details: { code, message } });
function api({ respond = () => [], refresh = async () => ({ id: 'u' }) } = {}) {
  const calls = [];
  const request = async (path, opts = {}) => { calls.push({ path, ...opts }); return respond(path, opts, calls.length); };
  const c = createClinicApi({ request, refresh, getContext: async () => ({ id: ORG, role: 'psychologa' }), newId: () => '11111111-1111-4111-8111-111111111111', fetchImpl: async () => { throw new Error('sin red en la prueba'); } });
  return { c, calls };
}

describe('clinic.js: errores', () => {
  test('códigos propios de la BD → mensajes en castellano', () => {
    assert.match(clinicError(err(400, 'KS001')).message, /suspendida/);
    assert.match(clinicError(err(400, 'KT005')).message, /administración/);
    assert.match(clinicError(err(409, '23P01')).message, /solapa/);
    assert.equal(clinicError(err(400, 'KP001', 'Límite del plan: 1 profesionales')).message, 'Límite del plan: 1 profesionales');
    assert.equal(clinicError(new TypeError('Failed to fetch')).code, 'network');
    assert.equal(clinicError(err(401, 'PGRST301')).code, 'auth');
  });
  test('401: renueva la sesión y reintenta una sola vez', async () => {
    const { c, calls } = api({ respond: (p, o, n) => { if (n === 1) throw err(401, 'PGRST301'); return [{ id: 's' }]; } });
    await c.createService({ name: 'Sesión', dur: 50, price: 6000, exempt: true });
    assert.equal(calls.length, 2);
  });
  test('403 con sesión revocada (no se puede renovar): error de sesión, no de permisos', async () => {
    const { c, calls } = api({ respond: () => { throw err(403, '42501'); }, refresh: async () => null });
    await assert.rejects(c.createService({ name: 'X', dur: 50, price: 1, exempt: true }), e => e.code === 'auth' && /sesión/.test(e.message));
    assert.equal(calls.length, 1);
  });
  test('403 con sesión válida: falta de permiso tras un único reintento', async () => {
    const { c, calls } = api({ respond: () => { throw err(403, '42501'); } });
    await assert.rejects(c.createService({ name: 'X', dur: 50, price: 1, exempt: true }), e => e.code === '42501' && /permiso/.test(e.message));
    assert.equal(calls.length, 2);
  });
  test('UPDATE sin filas (RLS): no se da por guardado', async () => {
    const { c } = api({ respond: () => [] });
    await assert.rejects(c.updateClinic({ name: 'Nombre nuevo' }), e => e.code === 'forbidden');
    await assert.rejects(c.updateService('s', { name: 'x' }), e => e.code === 'forbidden');
  });
});

describe('clinic.js: datos enviados', () => {
  test('horario: lunes = 0 en la interfaz → weekday 1 (ISO) en la BD, semana completa en una llamada', async () => {
    const { c, calls } = api({ respond: () => 3 });
    await c.saveAvailability(PRO, { 0: [[540, 840], [960, 1200]], 5: [[600, 720]] });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, 'rpc/set_professional_availability');
    assert.deepEqual(calls[0].body, { p_org_id: ORG, p_professional_id: PRO, p_ranges: [
      { weekday: 1, start_minute: 540, end_minute: 840 }, { weekday: 1, start_minute: 960, end_minute: 1200 }, { weekday: 6, start_minute: 600, end_minute: 720 }] });
  });
  test('cobro: método de la interfaz → vocabulario de la BD', async () => {
    const { c, calls } = api({ respond: () => ({ status: 'paid' }) });
    for (const m of ['Bizum', 'Tarjeta', 'Transferencia', 'Efectivo', 'Otro']) await c.recordPayment('i', 100, m);
    assert.deepEqual(calls.map(x => x.body.p_method), ['bizum', 'tarjeta', 'transferencia', 'efectivo', 'otro']);
  });
  test('borrador de factura: IVA 0/21 por línea y retención en céntimos sobre la base', async () => {
    const { c, calls } = api({ respond: () => 'id' });
    await c.saveInvoiceDraft({ patientId: P, date: '2026-11-10', due: '2026-11-25', lines: [{ desc: 'Sesión', qty: 1, price: 6000, exempt: true }, { desc: 'Taller', qty: 2, price: 1000, exempt: false }], retPct: 15 });
    assert.deepEqual(calls[0].body.p_lines.map(l => l.tax_rate), [0, 21]);
    assert.equal(calls[0].body.p_retention_cents, 1200);
    await assert.rejects(c.saveInvoiceDraft({ patientId: P, date: '2026-11-10', lines: [] }), /al menos una línea/);
  });
  test('emitir: exige nombre y dirección de facturación del paciente', async () => {
    const { c } = api();
    await assert.rejects(c.savePatientBillingProfile(P, { name: 'X', addr: '' }), /dirección/);
  });
  test('invitación: correo validado antes de llamar al servidor', async () => {
    const { c, calls } = api();
    await assert.rejects(c.invite('no-es-correo', 'recepcion'), /correo válido/);
    assert.equal(calls.length, 0);
  });
});

describe('clinic.js: documentos', () => {
  const file = (type, size, name = 'informe.pdf') => ({ type, size, name });
  test('tipo y tamaño se comprueban antes de subir', async () => {
    const { c, calls } = api();
    await assert.rejects(c.uploadDocument({ patientId: P, file: file('text/plain', 10) }), e => e.code === 'type');
    await assert.rejects(c.uploadDocument({ patientId: P, file: file('application/pdf', DOC_MAX_BYTES + 1) }), e => e.code === 'too_large');
    await assert.rejects(c.uploadDocument({ patientId: P, file: file('application/pdf', 0) }), e => e.code === 'validation');
    await assert.rejects(c.uploadDocument({ patientId: 'no-uuid', file: file('application/pdf', 10) }), e => e.code === 'validation');
    assert.equal(calls.length, 0);
  });
  test('nombre de archivo seguro para la ruta de Storage (sin barras, acentos ni ..)', () => {
    assert.equal(safeFileName('../../Informe clínico Ñ.pdf'), 'Informe-clinico-N.pdf');
    assert.equal(safeFileName('a/b\\c.png'), 'a-b-c.png');
    assert.equal(safeFileName(''), 'documento');
    assert.ok(safeFileName('x'.repeat(500) + '.pdf').length <= 120);
  });
});

describe('modo conectado: estado y acciones sin servidor', () => {
  test('ajustes de la BD: solo claves conocidas y del mismo tipo', () => {
    const s = settingsFromDb({ dueDays: 30, reminder: false, accent: 7, desconocida: 'x' });
    assert.equal(s.dueDays, 30); assert.equal(s.reminder, false);
    assert.equal(s.accent, DEFAULT_SETTINGS.accent);
    assert.equal('desconocida' in s, false);
  });
  test('horario de la BD → formato de la interfaz, ordenado', () => {
    assert.deepEqual(availFromRows([{ weekday: 1, start_minute: 960, end_minute: 1200 }, { weekday: 1, start_minute: 540, end_minute: 840 }, { weekday: 7, start_minute: 600, end_minute: 660 }]),
      { 0: [[540, 840], [960, 1200]], 6: [[600, 660]] });
  });
  test('las acciones de la demo sin servidor tienen una explicación (no se simulan)', () => {
    for (const a of ['sendInv', 'remind', 'rectInv', 'saveScan', 'autoMatch', 'payObl', 'genPayroll', 'payPayroll', 'reset', 'doReset']) assert.ok(BLOCKED[a]?.length > 20, a);
    assert.ok(ClinicError);
  });
});

describe('clinic.js: registro de exportaciones', () => {
  test('llama a log_patient_export con el paciente y los recuentos', async () => {
    const { c, calls } = api({ respond: () => '2026-11-11T10:00:00Z' });
    assert.equal(await c.logExport(P, { citas: 2 }), '2026-11-11T10:00:00Z');
    assert.equal(calls[0].path, 'rpc/log_patient_export');
    assert.deepEqual(calls[0].body, { p_patient_id: P, p_counts: { citas: 2 } });
  });
  test('servidor sin la función (PGRST202): null, para exportar igualmente', async () => {
    const { c } = api({ respond: () => { throw err(404, 'PGRST202'); } });
    assert.equal(await c.logExport(P), null);
  });
  test('sin permiso o sin red: error (no se exporta)', async () => {
    await assert.rejects(api({ respond: () => { throw err(403, '42501'); } }).c.logExport(P), e => e.code === 'forbidden' || e.code === '42501');
    await assert.rejects(api({ respond: () => { throw new TypeError('Failed to fetch'); } }).c.logExport(P), e => e.code === 'network');
    await assert.rejects(api().c.logExport('no-uuid'), e => e.code === 'validation');
  });
});

describe('clinic.js: facturar sesiones', () => {
  test('cada línea con cita lleva appointment_id; sin cita, no se envía la clave', async () => {
    const { c, calls } = api({ respond: () => 'inv' });
    await c.saveInvoiceDraft({ patientId: P, date: '2026-11-11', lines: [{ desc: 'Sesión', qty: 1, price: 6000, exempt: true, apptId: PRO }, { desc: 'Informe', qty: 1, price: 2000, exempt: false }] });
    const [l1, l2] = calls[0].body.p_lines;
    assert.deepEqual(l1, { description: 'Sesión', quantity: 1, unit_price_cents: 6000, tax_rate: 0, appointment_id: PRO });
    assert.ok(!('appointment_id' in l2));
  });
});
