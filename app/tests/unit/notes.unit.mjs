// Borradores de notas clínicas en modo Supabase (note-writes.js) con la RPC v1 (la de producción hoy)
// contra el servidor simulado con estado, que reproduce save_clinical_note_draft, la RLS de lectura y
// las claves foráneas reales. La v2 y la elección automática están en notes-v2.unit.mjs.
// Datos 100 % sintéticos; nunca hay red.
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createKovoRepository } from '../../src/data/repository.js';
import { createSupabaseSource } from '../../src/data/supabase.js';
import { WriteError } from '../../src/data/writes.js';
import { serializeNoteFields, createNoteWriter, NOTE_ROLES, SAVE_DRAFT_RPC } from '../../src/data/note-writes.js';
import { clinicalNoteToRow } from '../../src/data/mapping.js';
import { parseNoteContent, NOTE_FIELD_KEYS } from '../../src/data/from-supabase.js';
import { ORG, ORG2, uuid, createFakeServer } from '../fixtures/supabase-fake.mjs';

const TODAY = '2026-11-06';
const USER = uuid(999);
const P1 = uuid(1), P2 = uuid(2), A_DONE = uuid(30), A_P1 = uuid(31), A_P2 = uuid(32);
const N_SIGNED = uuid(70), N_DRAFT = uuid(71);
const SECRET = 'Contenido clínico ficticio XYZ';   // nunca debe aparecer en mensajes ni en consola
const network = () => { throw new TypeError('Failed to fetch'); };
const once = fn => { let done = false; return (...a) => { if (!done) { done = true; fn(...a); } }; };
const ctxOf = (role, extra = {}) => ({ id: ORG, name: 'Consulta Ficticia', is_demo: true, role, membershipId: uuid(9000), userId: USER, ...extra });
const rejectsCode = (p, code) => assert.rejects(p, e => e instanceof WriteError && e.code === code && !e.message.includes(SECRET), `esperaba ${code}`);

async function setup(role = 'psychologa', { server = createFakeServer({ role }), refresh = server.refresh, ctx = ctxOf(role) } = {}) {
  const source = createSupabaseSource({
    repository: createKovoRepository({ request: server.request, getContext: async () => ctx }),
    isConfigured: () => true, restore: async () => ({ id: USER }), getContext: async () => ctx,
    request: server.request, refresh, noteRpc: 'v1'
  });
  const S = await source.load({ today: TODAY });
  S.sel = S.sel || {};
  return { server, source, S, N: source.writes.notes };
}
const reload = async server => (await setup('psychologa', { server })).S;
const newNote = (extra = {}) => ({ id: 'n900', unsaved: true, patientId: P1, apptId: A_P1, type: 'sesion', fields: {}, status: 'borrador', author: '', created: TODAY, signedAt: null, versions: [], log: [], ...extra });
const rpcCalls = server => server.calls.filter(c => c.path.startsWith('rpc/'));
const directWrites = server => server.calls.filter(c => c.method !== 'GET' && !c.path.startsWith('rpc/'));
const myNewDrafts = server => server.db.clinical_notes.filter(n => n.org_id === ORG && ![N_SIGNED, N_DRAFT].includes(n.id));
const save = (S, N, note, fields) => N.saveNote({ note, fields, knownIds: S.notes.map(x => x.id) });

// Nada de contenido clínico (ni nada en general) en consola durante estas pruebas.
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

describe('formato del contenido (el que ya usa la consulta)', () => {
  test('todos los apartados, en orden, "clave: valor" con línea en blanco; se vuelve a leer igual', () => {
    for (const [type, keys] of Object.entries(NOTE_FIELD_KEYS)) {
      const fields = Object.fromEntries(keys.map((k, i) => [k, i % 2 ? '' : `Texto ${k}\n\ncon párrafos\n- y lista`]));
      const { content } = serializeNoteFields(type, fields);
      assert.equal(content.split('\n\n')[0].split(':')[0], keys[0]);
      assert.deepEqual(parseNoteContent(content, type), { fields, structured: true });
      // Es exactamente el formato de mapping.clinicalNoteToRow con todos los apartados.
      assert.equal(content, clinicalNoteToRow({ type, fields }, P1, null, ORG, USER).content);
    }
  });
  test('apartados ausentes se guardan vacíos; claves desconocidas o valores no texto se rechazan', () => {
    assert.deepEqual(serializeNoteFields('cierre', { motivo: 'x' }).fields, { motivo: 'x', trabajo: '', logros: '', recomendaciones: '' });
    assert.throws(() => serializeNoteFields('sesion', { inventado: 'x' }), e => e.code === 'validation');
    assert.throws(() => serializeNoteFields('sesion', { resumen: 3 }), e => e.code === 'validation');
    assert.throws(() => serializeNoteFields('desconocido', {}), e => e.code === 'validation');
  });
  test('un texto que mezclaría apartados al leerlo se rechaza sin incluir el contenido en el mensaje', () => {
    assert.throws(() => serializeNoteFields('sesion', { resumen: `${SECRET}\n\nplan: otra cosa` }),
      e => e.code === 'validation' && e.field === 'resumen' && !e.message.includes(SECRET));
    assert.doesNotThrow(() => serializeNoteFields('sesion', { resumen: 'plan: al principio no mezcla nada\nplan: ni tras un salto simple' }));
  });
});

describe('crear y editar borradores', () => {
  test('borrador de una cita: una llamada a la RPC, fila confirmada, sin escrituras directas en la tabla', async () => {
    const { server, S, N } = await setup();
    const before = JSON.stringify(S.notes);
    S.sel.editing = 'n900';
    const res = await save(S, N, newNote(), { objetivos: SECRET, resumen: 'Línea 1\n\nLínea 2' });
    assert.equal(JSON.stringify(S.notes), before, 'el estado no cambia hasta aplicar la nota confirmada');
    assert.equal(res.outcome, 'created');
    assert.equal(res.replacedId, 'n900');
    const [row] = myNewDrafts(server);
    assert.deepEqual([row.id, row.org_id, row.patient_id, row.appointment_id, row.author_id, row.note_type, row.status], [res.note.id, ORG, P1, A_P1, USER, 'session', 'draft']);
    assert.deepEqual(res.note.fields, { objetivos: SECRET, resumen: 'Línea 1\n\nLínea 2', intervenciones: '', observaciones: '', acuerdos: '', plan: '' });
    assert.equal(res.note.status, 'borrador');
    assert.equal(res.note.apptId, A_P1);
    assert.equal(rpcCalls(server).length, 1);
    assert.deepEqual(Object.keys(rpcCalls(server)[0].body).sort(), ['p_appointment_id', 'p_content', 'p_note_id', 'p_note_type', 'p_org_id', 'p_patient_id']);
    assert.equal(rpcCalls(server)[0].body.p_note_id, null);
    assert.equal(rpcCalls(server)[0].body.p_org_id, ORG);
    assert.deepEqual(directWrites(server), []);
    N.applyNote(S, res.note, res.replacedId);
    assert.equal(S.notes.filter(n => n.id === res.note.id).length, 1);
    assert.equal(S.sel.editing, res.note.id, 'el editor pasa al UUID confirmado');
  });

  test('un borrador sin guardar con id local en formato UUID (newId del modo Supabase) se crea, no se edita', async () => {
    const { server, S, N } = await setup();
    const local = uuid(4242);
    const res = await save(S, N, newNote({ id: local }), { objetivos: 'x' });
    assert.equal(res.outcome, 'created');
    assert.notEqual(res.note.id, local);
    assert.equal(res.replacedId, local);
    assert.equal(rpcCalls(server)[0].body.p_note_id, null);
  });

  test('informe sin cita (evaluación inicial): appointment_id null y tipo initial', async () => {
    const { server, S, N } = await setup();
    const res = await save(S, N, newNote({ apptId: null, type: 'inicial' }), { motivo: 'Motivo ficticio' });
    const [row] = myNewDrafts(server);
    assert.deepEqual([row.appointment_id, row.note_type], [null, 'initial']);
    assert.equal(res.note.type, 'inicial');
  });

  test('editar un borrador existente: mismo UUID, sin filas nuevas; sin cambios no se llama a la RPC', async () => {
    const { server, S, N } = await setup();
    const note = S.notes.find(n => n.id === N_DRAFT);
    assert.equal(note.fields.objetivos, 'Texto libre ficticio', 'el texto sin apartados se muestra en el primero');
    const res = await save(S, N, note, { ...note.fields, plan: 'Plan ficticio' });
    assert.equal(res.outcome, 'updated');
    assert.equal(res.note.id, N_DRAFT);
    assert.equal(res.replacedId, null);
    assert.equal(server.db.clinical_notes.find(n => n.id === N_DRAFT).content.startsWith('objetivos: Texto libre ficticio'), true);
    assert.equal(rpcCalls(server)[0].body.p_note_id, N_DRAFT);
    assert.equal(myNewDrafts(server).length, 0);
    N.applyNote(S, res.note);
    const again = await save(S, N, S.notes.find(n => n.id === N_DRAFT), res.note.fields);
    assert.equal(again.outcome, 'already_applied');
    assert.equal(rpcCalls(server).length, 1);
  });

  test('persistencia: tras crear y editar, al recargar se lee lo mismo', async () => {
    const { server, S, N } = await setup();
    const a = await save(S, N, newNote(), { objetivos: 'Uno', plan: 'Dos' });
    N.applyNote(S, a.note, a.replacedId);
    const b = await save(S, N, S.notes.find(n => n.id === a.note.id), { ...a.note.fields, resumen: 'Tres' });
    N.applyNote(S, b.note);
    const S2 = await reload(server);
    const r = S2.notes.find(n => n.id === a.note.id);
    assert.deepEqual([r.fields, r.status, r.patientId, r.apptId, r.type], [b.note.fields, 'borrador', P1, A_P1, 'sesion']);
    assert.equal(S2.notes.length, S.notes.length);
  });
});

describe('reintentos y respuestas perdidas', () => {
  test('corte de red antes de llegar: error, nada guardado; el reintento crea una sola nota', async () => {
    const { server, S, N } = await setup();
    server.faults.beforeWrite = once(network);
    const note = newNote();
    await assert.rejects(save(S, N, note, { objetivos: SECRET }), e => e.code === 'network' && /NO se ha guardado/.test(e.message) && !e.message.includes(SECRET));
    assert.equal(myNewDrafts(server).length, 0);
    const res = await save(S, N, note, { objetivos: SECRET });
    assert.equal(res.outcome, 'created');
    assert.equal(myNewDrafts(server).length, 1);
  });

  test('respuesta perdida al crear: el reintento encuentra la nota y no la duplica', async () => {
    const { server, S, N } = await setup();
    server.faults.afterWrite = once(network);
    const note = newNote();
    await rejectsCode(save(S, N, note, { objetivos: SECRET }), 'network');
    assert.equal(myNewDrafts(server).length, 1, 'la BD sí la guardó');
    const res = await save(S, N, note, { objetivos: SECRET });
    assert.equal(res.outcome, 'already_created');
    assert.equal(myNewDrafts(server).length, 1);
    assert.equal(res.note.id, myNewDrafts(server)[0].id);
    assert.equal(rpcCalls(server).length, 1, 'el reintento no vuelve a llamar a la RPC');
  });

  test('respuesta perdida y formulario cambiado antes de reintentar: se actualiza esa misma nota', async () => {
    const { server, S, N } = await setup();
    server.faults.afterWrite = once(network);
    const note = newNote();
    await rejectsCode(save(S, N, note, { objetivos: 'Primera versión' }), 'network');
    const res = await save(S, N, note, { objetivos: 'Segunda versión' });
    assert.equal(res.outcome, 'already_created');
    assert.equal(myNewDrafts(server).length, 1);
    assert.equal(parseNoteContent(myNewDrafts(server)[0].content, 'sesion').fields.objetivos, 'Segunda versión');
  });

  test('un borrador de otra sesión (desconocido) con otro contenido no se adopta', async () => {
    const { server, S, N } = await setup();
    server.faults.beforeWrite = once(network);
    const note = newNote();
    await rejectsCode(save(S, N, note, { objetivos: 'Mío' }), 'network');
    server.db.clinical_notes.push({ id: uuid(777), org_id: ORG, patient_id: P1, appointment_id: A_P1, author_id: USER, note_type: 'session', content: 'objetivos: De otra pestaña', status: 'draft', signed_at: null, created_at: '2026-11-06T10:00:00Z', updated_at: '2026-11-06T10:00:00Z' });
    const res = await save(S, N, note, { objetivos: 'Mío' });
    assert.equal(res.outcome, 'created');
    assert.equal(server.db.clinical_notes.find(n => n.id === uuid(777)).content, 'objetivos: De otra pestaña');
  });

  test('respuesta perdida al editar: el reintento (igual o con más cambios) no da falso conflicto', async () => {
    const { server, S, N } = await setup();
    const note = S.notes.find(n => n.id === N_DRAFT);
    server.faults.afterWrite = once(network);
    await rejectsCode(save(S, N, note, { objetivos: 'A' }), 'network');
    const first = await save(S, N, note, { objetivos: 'A' });
    assert.equal(first.outcome, 'already_applied');
    N.applyNote(S, first.note);
    server.faults.afterWrite = once(network);
    await rejectsCode(save(S, N, first.note, { objetivos: 'B' }), 'network');
    const res = await save(S, N, first.note, { objetivos: 'C' });
    assert.equal(res.outcome, 'updated');
    assert.equal(parseNoteContent(server.db.clinical_notes.find(n => n.id === N_DRAFT).content, 'sesion').fields.objetivos, 'C');
  });

  test('conflicto: si el borrador cambió en otra sesión, no se pisa', async () => {
    const { server, S, N } = await setup();
    const note = S.notes.find(n => n.id === N_DRAFT);
    Object.assign(server.db.clinical_notes.find(n => n.id === N_DRAFT), { content: 'objetivos: Cambio de otra sesión', updated_at: '2026-11-06T12:00:00Z' });
    await rejectsCode(save(S, N, note, { objetivos: 'Mío' }), 'conflict');
    assert.equal(server.db.clinical_notes.find(n => n.id === N_DRAFT).content, 'objetivos: Cambio de otra sesión');
    assert.equal(rpcCalls(server).length, 0);
  });
});

describe('sesión caducada', () => {
  test('401: se renueva la sesión y se guarda una vez', async () => {
    const { server, S, N } = await setup();
    server.faults.expired = true;
    const res = await save(S, N, newNote(), { objetivos: 'x' });
    assert.equal(res.outcome, 'created');
    assert.equal(myNewDrafts(server).length, 1);
  });
  test('si no se puede renovar: error de sesión, nada guardado, estado intacto', async () => {
    const server = createFakeServer({ role: 'psychologa' });
    const { S, N } = await setup('psychologa', { server, refresh: async () => null });
    const before = JSON.stringify(S.notes);
    server.faults.expired = true;
    await assert.rejects(save(S, N, newNote(), { objetivos: SECRET }), e => e.code === 'auth' && /no se ha guardado/.test(e.message) && !e.message.includes(SECRET));
    assert.equal(myNewDrafts(server).length, 0);
    assert.equal(JSON.stringify(S.notes), before);
  });
});

describe('permisos por rol', () => {
  test('solo psychologa gestiona notas', () => assert.deepEqual(NOTE_ROLES, ['psychologa']));
  for (const role of ['recepcion', 'gestoria']) {
    test(`${role}: no ve notas y no puede guardar; no llega ninguna petición de escritura`, async () => {
      const { server, S, N } = await setup(role);
      assert.equal(S.notes.length, 0);
      await rejectsCode(save(S, N, newNote(), { objetivos: SECRET }), 'forbidden');
      assert.deepEqual(server.writes(), []);
    });
    test(`${role}: aunque el cliente creyera ser psicóloga, la BD lo rechaza (42501)`, async () => {
      const server = createFakeServer({ role });
      // Lecturas de comprobación simuladas como si fueran válidas, para que la petición llegue a la RPC.
      const request = (path, o) => /^(patients|appointments)\?/.test(path) ? Promise.resolve([{ id: P1, org_id: ORG }]) : server.request(path, o);
      const w = createNoteWriter({ request, getContext: async () => ctxOf('psychologa'), rpc: 'v1' });
      await rejectsCode(w.saveDraft({ patientId: P1, appointmentId: null, type: 'sesion', fields: { objetivos: 'x' } }), 'forbidden');
      assert.equal(myNewDrafts(server).length, 0);
    });
  }
  test('psychologa no puede editar el borrador de otra profesional', async () => {
    const { server, S, N } = await setup();
    server.db.clinical_notes.find(n => n.id === N_DRAFT).author_id = uuid(998);
    await rejectsCode(save(S, N, S.notes.find(n => n.id === N_DRAFT), { objetivos: 'x' }), 'forbidden');
    assert.equal(rpcCalls(server).length, 0);
  });
});

describe('organización, paciente y cita', () => {
  const ORG2_PATIENT = uuid(5200), ORG2_APPT = uuid(5300);   // ids que syntheticDb da a las copias de ORG2
  test('las filas de otra consulta existen en la BD simulada', async () => {
    const server = createFakeServer({ role: 'psychologa' });
    assert.equal(server.db.patients.find(p => p.id === ORG2_PATIENT)?.org_id, ORG2);
    assert.equal(server.db.appointments.find(a => a.id === ORG2_APPT)?.org_id, ORG2);
  });
  test('la organización sale de la membresía de la sesión, nunca de los datos del navegador', async () => {
    const { server, S, N } = await setup();
    await save(S, N, newNote({ orgId: ORG2, org_id: ORG2 }), { objetivos: 'x' });
    assert.equal(rpcCalls(server)[0].body.p_org_id, ORG);
    assert.equal(myNewDrafts(server)[0].org_id, ORG);
  });
  test('una organización manipulada en el navegador no autoriza nada: la BD exige el rol en esa consulta', async () => {
    const server = createFakeServer({ role: 'psychologa' });   // psicóloga de ORG
    const w = createNoteWriter({ request: server.request, getContext: async () => ctxOf('psychologa', { id: ORG2 }), rpc: 'v1' });
    await rejectsCode(w.saveDraft({ patientId: ORG2_PATIENT, type: 'sesion', fields: { objetivos: 'x' } }), 'forbidden');
    assert.equal(server.db.clinical_notes.filter(n => n.org_id === ORG2 && n.content === 'objetivos: x').length, 0);
  });
  test('paciente de otra consulta: rechazado antes de llamar a la RPC', async () => {
    const { server, S, N } = await setup();
    await rejectsCode(save(S, N, newNote({ patientId: ORG2_PATIENT, apptId: null }), { objetivos: 'x' }), 'invalid_reference');
    assert.equal(rpcCalls(server).length, 0);
  });
  test('cita de otra consulta: rechazada', async () => {
    const { server, S, N } = await setup();
    await rejectsCode(save(S, N, newNote({ apptId: ORG2_APPT }), { objetivos: 'x' }), 'invalid_reference');
    assert.equal(rpcCalls(server).length, 0);
  });
  test('nota de otra consulta: no se encuentra y no se toca', async () => {
    const { server, S, N } = await setup();
    const foreign = server.db.clinical_notes.find(n => n.org_id === ORG2 && n.status === 'draft');
    await rejectsCode(save(S, N, newNote({ id: foreign.id, unsaved: false, patientId: P2, apptId: null, updatedAt: foreign.updated_at }), { objetivos: 'x' }), 'not_found');
    assert.equal(rpcCalls(server).length, 0);
  });
  test('si la comprobación del cliente fallara, la clave foránea de la BD lo impide', async () => {
    const server = createFakeServer({ role: 'psychologa' });
    // El cliente "cree" que el paciente es suyo (lecturas manipuladas); la RPC devuelve 23503.
    const request = (path, o) => path.startsWith('patients?') ? Promise.resolve([{ id: ORG2_PATIENT, org_id: ORG }]) : server.request(path, o);
    const w = createNoteWriter({ request, getContext: async () => ctxOf('psychologa'), rpc: 'v1' });
    await rejectsCode(w.saveDraft({ patientId: ORG2_PATIENT, type: 'sesion', fields: { objetivos: 'x' } }), 'invalid_reference');
    assert.equal(myNewDrafts(server).length, 0);
  });
  test('cita de otro paciente de la misma consulta: rechazada (la BD no lo comprueba)', async () => {
    const { server, S, N } = await setup();
    await assert.rejects(save(S, N, newNote({ patientId: P2, apptId: A_P1 }), { objetivos: 'x' }), e => e.code === 'invalid_reference' && /no corresponde a este paciente/.test(e.message));
    assert.equal(rpcCalls(server).length, 0);
    await rejectsCode(save(S, N, newNote({ patientId: P1, apptId: A_P2 }), { objetivos: 'x' }), 'invalid_reference');
  });
  test('editar un borrador indicando otro paciente o cita: rechazado', async () => {
    const { server, S, N } = await setup();
    const note = S.notes.find(n => n.id === N_DRAFT);
    await rejectsCode(save(S, N, { ...note, patientId: P1 }, { objetivos: 'x' }), 'invalid_reference');
    await rejectsCode(save(S, N, { ...note, apptId: A_P2 }, { objetivos: 'x' }), 'invalid_reference');
    assert.equal(rpcCalls(server).length, 0);
  });
});

describe('notas firmadas o rectificadas', () => {
  test('una nota firmada no se puede editar: ni petición ni cambio', async () => {
    const { server, S, N } = await setup();
    const note = S.notes.find(n => n.id === N_SIGNED);
    assert.equal(note.status, 'firmada');
    const before = server.db.clinical_notes.find(n => n.id === N_SIGNED).content;
    await rejectsCode(save(S, N, note, { objetivos: 'x' }), 'locked');
    assert.equal(rpcCalls(server).length, 0);
    assert.equal(server.db.clinical_notes.find(n => n.id === N_SIGNED).content, before);
  });
  test('una nota rectificada tampoco', async () => {
    const server = createFakeServer({ role: 'psychologa' });
    Object.assign(server.db.clinical_notes.find(n => n.id === N_SIGNED), { status: 'rectified', author_id: USER });
    const { S, N } = await setup('psychologa', { server });
    await rejectsCode(save(S, N, S.notes.find(n => n.id === N_SIGNED), { objetivos: 'x' }), 'locked');
    assert.equal(rpcCalls(server).length, 0);
  });
  test('si se firma entre la lectura y el guardado, la RPC lo rechaza y se explica como firmada', async () => {
    const server = createFakeServer({ role: 'psychologa' });
    let reads = 0;
    const request = async (path, o) => {
      const r = await server.request(path, o);
      if (path.startsWith('clinical_notes?') && path.includes(`id=eq.${N_DRAFT}`) && ++reads === 1)
        Object.assign(server.db.clinical_notes.find(n => n.id === N_DRAFT), { status: 'signed', signed_at: '2026-11-06T10:00:00Z' });
      return r;
    };
    const w = createNoteWriter({ request, getContext: async () => ctxOf('psychologa'), rpc: 'v1' });
    const cur = server.db.clinical_notes.find(n => n.id === N_DRAFT);
    await rejectsCode(w.saveDraft({ id: N_DRAFT, patientId: P2, type: 'sesion', fields: { objetivos: 'x' }, version: cur.updated_at }), 'locked');
    assert.equal(server.db.clinical_notes.find(n => n.id === N_DRAFT).content, 'Texto libre ficticio');
  });
});

describe('respuestas inesperadas', () => {
  test('la RPC devuelve algo que no es un UUID: no se da por guardado', async () => {
    const server = createFakeServer({ role: 'psychologa' });
    const request = (path, o) => path === SAVE_DRAFT_RPC ? Promise.resolve(null) : server.request(path, o);
    const w = createNoteWriter({ request, getContext: async () => ctxOf('psychologa'), rpc: 'v1' });
    await rejectsCode(w.saveDraft({ patientId: P1, type: 'sesion', fields: { objetivos: 'x' } }), 'unexpected_response');
  });
  test('la fila leída tras guardar no coincide con lo enviado: no se da por guardado', async () => {
    const server = createFakeServer({ role: 'psychologa' });
    const request = async (path, o) => {
      const r = await server.request(path, o);
      return path.startsWith('clinical_notes?') && Array.isArray(r) && r[0] ? r.map(x => ({ ...x, content: 'otro' })) : r;
    };
    const w = createNoteWriter({ request, getContext: async () => ctxOf('psychologa'), rpc: 'v1' });
    await rejectsCode(w.saveDraft({ patientId: P1, type: 'sesion', fields: { objetivos: 'x' } }), 'unexpected_response');
  });
  test('contenido vacío según la RPC: error de validación', async () => {
    const server = createFakeServer({ role: 'psychologa' });
    const request = (path, o) => path === SAVE_DRAFT_RPC ? server.request(path, { ...o, body: { ...o.body, p_content: '  ' } }) : server.request(path, o);
    const w = createNoteWriter({ request, getContext: async () => ctxOf('psychologa'), rpc: 'v1' });
    await rejectsCode(w.saveDraft({ patientId: P1, type: 'sesion', fields: { objetivos: 'x' } }), 'validation');
  });
  test('sin usuaria identificada no se intenta guardar', async () => {
    const server = createFakeServer({ role: 'psychologa' });
    const w = createNoteWriter({ request: server.request, getContext: async () => ctxOf('psychologa', { userId: null }), rpc: 'v1' });
    await rejectsCode(w.saveDraft({ patientId: P1, type: 'sesion', fields: { objetivos: 'x' } }), 'auth');
    assert.deepEqual(server.calls, []);
  });
});
