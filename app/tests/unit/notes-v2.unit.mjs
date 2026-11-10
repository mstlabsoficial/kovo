// A · Borradores clínicos con la RPC v2 (UUID estable + versión) contra el servidor simulado con la
// propuesta clínica v2 (createFakeServer({ v2: true }), copia de la función SQL validada en
// PostgreSQL real por clinical-db/run-local.mjs). También la elección automática v2 → v1.
// Datos 100 % sintéticos; nunca hay red.
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createKovoRepository } from '../../src/data/repository.js';
import { createSupabaseSource } from '../../src/data/supabase.js';
import { WriteError, classify } from '../../src/data/writes.js';
import { createNoteWriter, SAVE_DRAFT_RPC, SAVE_DRAFT_RPC_V2 } from '../../src/data/note-writes.js';
import { ORG, ORG2, uuid, createFakeServer } from '../fixtures/supabase-fake.mjs';

const TODAY = '2026-11-06';
const USER = uuid(999);
const P1 = uuid(1), P2 = uuid(2), A_DONE = uuid(30), A_SCHEDULED = uuid(31);
const N_SIGNED = uuid(70), N_LEGACY = uuid(71);
const P_ORG2 = uuid(5200);
const SECRET = 'Contenido clínico ficticio XYZ';
const network = () => { throw new TypeError('Failed to fetch'); };
const once = fn => { let done = false; return (...a) => { if (!done) { done = true; fn(...a); } }; };
const ctxOf = (role, extra = {}) => ({ id: ORG, name: 'Consulta Ficticia', is_demo: true, role, membershipId: uuid(9000), userId: USER, ...extra });
const rejectsCode = (p, code) => assert.rejects(p, e => e instanceof WriteError && e.code === code && !e.message.includes(SECRET), `esperaba ${code}`);

async function setup(role = 'psychologa', { server = createFakeServer({ role, v2: true }), ctx = ctxOf(role), noteRpc = 'auto' } = {}) {
  const source = createSupabaseSource({
    repository: createKovoRepository({ request: server.request, getContext: async () => ctx }),
    isConfigured: () => true, restore: async () => ({ id: USER }), getContext: async () => ctx,
    request: server.request, refresh: server.refresh, noteRpc
  });
  const S = await source.load({ today: TODAY });
  S.sel = S.sel || {};
  return { server, source, S, N: source.writes.notes };
}
const fresh = (extra = {}) => ({ id: crypto.randomUUID(), unsaved: true, patientId: P1, apptId: A_DONE, type: 'sesion', fields: {}, status: 'borrador', author: '', created: TODAY, signedAt: null, versions: [], log: [], ...extra });
const rpcCalls = server => server.calls.filter(c => c.path.startsWith('rpc/'));
const row = (server, id) => server.db.clinical_notes.find(n => n.id === id);
const save = (N, note, fields, extra = {}) => N.saveNote({ note, fields, ...extra });

let consoleCalls;
const original = {};
beforeEach(() => {
  consoleCalls = [];
  for (const k of ['log', 'info', 'warn', 'error', 'debug']) { original[k] = console[k]; console[k] = (...a) => consoleCalls.push([k, ...a]); }
});
afterEach(() => {
  for (const k of Object.keys(original)) console[k] = original[k];
  assert.deepEqual(consoleCalls, [], 'no se escribe nada en consola');
});

describe('v2: crear, editar, recargar', () => {
  test('crear: una sola llamada a la v2 con el UUID del editor; la fila confirmada vuelve en la respuesta', async () => {
    const { server, N } = await setup();
    const note = fresh();
    const before = server.calls.length;
    const res = await save(N, note, { objetivos: 'Objetivo ficticio', resumen: 'Uno\n\nDos' });
    const calls = server.calls.slice(before);
    assert.deepEqual(calls.map(c => c.path), [SAVE_DRAFT_RPC_V2], 'sin lecturas previas ni posteriores');
    assert.equal(calls[0].body.p_note_id, note.id);
    assert.equal(calls[0].body.p_expected_version, null);
    assert.deepEqual(calls[0].body.p_sections, { objetivos: 'Objetivo ficticio', resumen: 'Uno\n\nDos', intervenciones: '', observaciones: '', acuerdos: '', plan: '' });
    assert.equal(res.note.id, note.id);
    assert.equal(res.note.version, 1);
    assert.equal(res.note.contentFormat, 'sections_v1');
    assert.equal(res.note.fields.resumen, 'Uno\n\nDos');
    assert.equal(res.replacedId, null);
    assert.equal(N.rpcVersion, 2);
    assert.match(row(server, note.id).content, /^objetivos: Objetivo ficticio\n\nresumen: Uno\n\nDos/);
  });

  test('editar con la versión cargada: versión 2; guardar sin cambios no crea versión', async () => {
    const { server, N } = await setup();
    const { note } = await save(N, fresh(), { objetivos: 'A' });
    const r2 = await save(N, note, { objetivos: 'B' });
    assert.equal(r2.note.version, 2);
    assert.equal(rpcCalls(server).at(-1).body.p_expected_version, 1);
    const r3 = await save(N, r2.note, { objetivos: 'B' });
    assert.equal(r3.note.version, 2);
    assert.equal(row(server, note.id).version, 2);
  });

  test('un texto con una línea que empieza como otro apartado ya no se rechaza: los apartados van separados', async () => {
    const { server, N } = await setup();
    const { note } = await save(N, fresh(), { resumen: 'Texto\n\nplan: no es el apartado plan' });
    assert.equal(row(server, note.id).sections.resumen, 'Texto\n\nplan: no es el apartado plan');
    const { S } = await setup('psychologa', { server });
    assert.equal(S.notes.find(n => n.id === note.id).fields.resumen, 'Texto\n\nplan: no es el apartado plan');
  });

  test('al recargar se leen los apartados y la versión; las notas históricas no se convierten al cargar', async () => {
    const { server, N } = await setup();
    const { note } = await save(N, fresh(), { objetivos: 'Persistente' });
    const { S } = await setup('psychologa', { server });
    const n = S.notes.find(x => x.id === note.id);
    assert.equal(n.fields.objetivos, 'Persistente');
    assert.equal(n.version, 1);
    assert.equal(row(server, N_LEGACY).content_format, 'legacy_text', 'cargar no convierte');
    assert.equal(row(server, N_LEGACY).sections, null);
    assert.equal(S.notes.find(x => x.id === N_LEGACY).fields.objetivos, 'Texto libre ficticio', 'el texto libre se ve en el primer apartado');
  });

  test('nota histórica: solo al guardarla explícitamente pasa a apartados (con su versión)', async () => {
    const { server, S, N } = await setup();
    const legacy = S.notes.find(x => x.id === N_LEGACY);
    assert.equal(legacy.version, 1);
    const { note } = await save(N, legacy, { ...legacy.fields, plan: 'Plan añadido' });
    assert.equal(note.id, N_LEGACY);
    assert.equal(row(server, N_LEGACY).content_format, 'sections_v1');
    assert.equal(row(server, N_LEGACY).sections.objetivos, 'Texto libre ficticio');
    assert.equal(note.version, 2);
  });

  test('informe sin cita (evaluación inicial)', async () => {
    const { server, N } = await setup();
    const { note } = await save(N, fresh({ apptId: null, type: 'inicial' }), { motivo: 'Motivo ficticio' });
    assert.equal(row(server, note.id).note_type, 'initial');
    assert.equal(row(server, note.id).appointment_id, null);
  });
});

describe('v2: reintentos, respuestas perdidas y conflictos', () => {
  test('corte de red antes de llegar: error de red, nada guardado; el reintento crea una sola nota con el mismo UUID', async () => {
    const { server, N } = await setup();
    const note = fresh();
    server.faults.beforeWrite = once(network);
    await rejectsCode(save(N, note, { objetivos: SECRET }), 'network');
    assert.equal(row(server, note.id), undefined);
    await save(N, note, { objetivos: SECRET });
    assert.equal(server.db.clinical_notes.filter(n => n.id === note.id).length, 1);
  });

  test('respuesta perdida al crear: el reintento devuelve la misma nota, sin duplicado', async () => {
    const { server, N } = await setup();
    const note = fresh();
    server.faults.afterWrite = once(network);
    await rejectsCode(save(N, note, { objetivos: 'A' }), 'network');
    assert.ok(row(server, note.id), 'se guardó aunque la respuesta se perdiera');
    const res = await save(N, note, { objetivos: 'A' });
    assert.equal(res.note.id, note.id);
    assert.equal(res.note.version, 1);
    assert.equal(server.db.clinical_notes.filter(n => n.patient_id === P1 && n.appointment_id === A_DONE && n.status === 'draft').length, 1);
  });

  test('respuesta perdida al editar y más texto antes de reintentar: no hay falso conflicto', async () => {
    const { server, N } = await setup();
    const { note } = await save(N, fresh(), { objetivos: 'A' });
    server.faults.afterWrite = once(network);
    await rejectsCode(save(N, note, { objetivos: 'A+B' }), 'network');
    assert.equal(row(server, note.id).version, 2);
    const res = await save(N, note, { objetivos: 'A+B+C' });   // el editor sigue en la versión 1
    assert.equal(res.note.version, 3);
    assert.equal(row(server, note.id).sections.objetivos, 'A+B+C');
  });

  test('dos guardados simultáneos de la misma nota nueva: una sola fila', async () => {
    const { server, N } = await setup();
    const note = fresh();
    const [a, b] = await Promise.all([save(N, note, { objetivos: 'X' }), save(N, note, { objetivos: 'X' })]);
    assert.equal(a.note.id, b.note.id);
    assert.equal(server.db.clinical_notes.filter(n => n.id === note.id).length, 1);
  });

  test('conflicto real: otra sesión guardó antes; no se pisa, el error trae la versión guardada para comparar', async () => {
    const { server, N } = await setup();
    const { note } = await save(N, fresh(), { objetivos: 'Mío' });
    Object.assign(row(server, note.id), { sections: { ...row(server, note.id).sections, objetivos: 'De la otra pestaña' }, version: 2 });
    const err = await save(N, note, { objetivos: SECRET }).catch(e => e);
    assert.equal(err.code, 'conflict');
    assert.equal(err.currentVersion, 2);
    assert.equal(err.serverNote.fields.objetivos, 'De la otra pestaña');
    assert.ok(!err.message.includes(SECRET) && !err.message.includes('De la otra pestaña'));
    assert.equal(row(server, note.id).sections.objetivos, 'De la otra pestaña', 'nada sobrescrito');
    // La usuaria compara y decide guardar la suya sobre la versión que ha visto.
    const res = await save(N, { ...note, serverVersion: err.currentVersion }, { objetivos: 'Mío definitivo' }, { force: true });
    assert.equal(res.note.version, 3);
    assert.equal(row(server, note.id).sections.objetivos, 'Mío definitivo');
  });

  test('forzar sobre una versión ya superada vuelve a dar conflicto (no se pisa a ciegas)', async () => {
    const { server, N } = await setup();
    const { note } = await save(N, fresh(), { objetivos: 'Mío' });
    row(server, note.id).version = 5;
    await rejectsCode(save(N, { ...note, serverVersion: 4 }, { objetivos: 'x' }, { force: true }), 'conflict');
  });

  test('401: se renueva la sesión y se guarda una vez', async () => {
    const { server, N } = await setup();
    server.faults.expired = true;
    const note = fresh();
    await save(N, note, { objetivos: 'tras renovar' });
    assert.equal(server.db.clinical_notes.filter(n => n.id === note.id).length, 1);
  });
});

describe('v2: la base de datos decide (códigos KN)', () => {
  test('cita aún no realizada: KN008, mensaje claro, nada guardado', async () => {
    const { server, N } = await setup();
    const note = fresh({ apptId: A_SCHEDULED });
    await rejectsCode(save(N, note, { objetivos: SECRET }), 'appointment_not_completed');
    assert.equal(row(server, note.id), undefined);
  });
  test('cita de otro paciente: KN002', async () => {
    const { N } = await setup();
    await rejectsCode(save(N, fresh({ patientId: P2, apptId: A_DONE }), { objetivos: 'x' }), 'invalid_reference');
  });
  test('paciente de otra consulta: KN001', async () => {
    const { N } = await setup();
    await rejectsCode(save(N, fresh({ patientId: P_ORG2, apptId: null }), { objetivos: 'x' }), 'invalid_reference');
  });
  test('nota firmada: KN003 (locked)', async () => {
    const { S, N } = await setup();
    const signed = S.notes.find(x => x.id === N_SIGNED);
    await rejectsCode(save(N, signed, { objetivos: 'x' }), 'locked');
  });
  test('borrador de otra profesional: KN004', async () => {
    const { server, S, N } = await setup();
    row(server, N_LEGACY).author_id = uuid(998);
    await rejectsCode(save(N, S.notes.find(x => x.id === N_LEGACY), { objetivos: 'x' }), 'forbidden');
  });
  test('el mismo UUID con otro paciente o cita: KN009', async () => {
    const { N } = await setup();
    const { note } = await save(N, fresh(), { objetivos: 'A' });
    await rejectsCode(save(N, { ...note, apptId: null }, { objetivos: 'B' }), 'invalid_reference');
  });
  test('organización manipulada: la BD exige el rol en esa consulta (42501)', async () => {
    const server = createFakeServer({ role: 'psychologa', v2: true });
    const w = createNoteWriter({ request: server.request, getContext: async () => ctxOf('psychologa', { id: ORG2 }) });
    await rejectsCode(w.saveDraft({ patientId: P1, type: 'sesion', fields: {} }), 'forbidden');
  });
  test('recepción y gestoría: rechazado antes de cualquier petición', async () => {
    for (const role of ['recepcion', 'gestoria']) {
      const server = createFakeServer({ role, v2: true });
      const w = createNoteWriter({ request: server.request, getContext: async () => ctxOf(role) });
      await rejectsCode(w.saveDraft({ patientId: P1, type: 'sesion', fields: {} }), 'forbidden');
      assert.equal(server.writes().length, 0);
    }
  });
  test('respuesta que no corresponde a lo enviado: no se da por guardado', async () => {
    const server = createFakeServer({ role: 'psychologa', v2: true });
    const request = async (path, o) => { const r = await server.request(path, o); if (path === SAVE_DRAFT_RPC_V2) r.sections.objetivos = 'otro'; return r; };
    const w = createNoteWriter({ request, getContext: async () => ctxOf('psychologa') });
    await rejectsCode(w.saveDraft({ patientId: P1, type: 'sesion', fields: { objetivos: 'A' } }), 'unexpected_response');
  });
  test('citas con nota: cambiar de paciente (KN010) o dejar de estar realizada (KN011) se explica sin datos', async () => {
    const server = createFakeServer({ role: 'psychologa', v2: true });
    const e1 = await server.request(`appointments?id=eq.${A_DONE}`, { method: 'PATCH', body: { patient_id: P2 } }).catch(e => e);
    const e2 = await server.request(`appointments?id=eq.${A_DONE}`, { method: 'PATCH', body: { status: 'cancelled' } }).catch(e => e);
    assert.equal(classify(e1, 'appointments').code, 'clinical_link');
    assert.match(classify(e1, 'appointments').message, /no se puede cambiar de paciente/);
    assert.match(classify(e2, 'appointments').message, /debe seguir como realizada/);
    assert.equal(server.db.appointments.find(a => a.id === A_DONE && a.org_id === ORG).status, 'completed');
  });
});

describe('elección automática de la RPC', () => {
  test('si la BD no tiene la v2 (PGRST202) se usa la v1, y solo se pregunta una vez', async () => {
    const { server, N } = await setup('psychologa', { server: createFakeServer({ role: 'psychologa' }) });
    const r1 = await save(N, fresh(), { objetivos: 'A' });
    await save(N, r1.note, { objetivos: 'B' });
    await save(N, fresh(), { objetivos: 'C' });
    const paths = rpcCalls(server).map(c => c.path);
    assert.deepEqual(paths, [SAVE_DRAFT_RPC_V2, SAVE_DRAFT_RPC, SAVE_DRAFT_RPC, SAVE_DRAFT_RPC]);
    assert.equal(N.rpcVersion, 1);
  });
  test('con v2 disponible nunca se llama a la v1', async () => {
    const { server, N } = await setup();
    const r1 = await save(N, fresh(), { objetivos: 'A' });
    await save(N, r1.note, { objetivos: 'B' });
    assert.ok(rpcCalls(server).every(c => c.path === SAVE_DRAFT_RPC_V2));
  });
  test('un error de la v2 que no es «función inexistente» no cae a la v1', async () => {
    const { server, N } = await setup();
    await rejectsCode(save(N, fresh({ apptId: A_SCHEDULED }), { objetivos: 'x' }), 'appointment_not_completed');
    assert.ok(rpcCalls(server).every(c => c.path === SAVE_DRAFT_RPC_V2));
  });
  test('con la v2 ya usada, si deja de existir no se cambia en silencio a la v1', async () => {
    const server = createFakeServer({ role: 'psychologa', v2: true });
    let gone = false;
    const request = async (path, o) => { if (gone && path === SAVE_DRAFT_RPC_V2) throw Object.assign(new Error('x'), { status: 404, details: { code: 'PGRST202', message: 'Could not find the function' } }); return server.request(path, o); };
    const w = createNoteWriter({ request, getContext: async () => ctxOf('psychologa') });
    await w.saveDraft({ patientId: P1, type: 'sesion', fields: { objetivos: 'A' } });
    gone = true;
    await rejectsCode(w.saveDraft({ patientId: P1, type: 'sesion', fields: { objetivos: 'B' } }), 'rpc_missing');
  });
});
