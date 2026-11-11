// Pruebas de escritura de pacientes y citas (writes.js + legacy-writes.js) contra un servidor simulado
// con estado (tests/fixtures/supabase-fake.mjs). Datos 100 % sintéticos. Sin red ni Supabase.
process.env.TZ = 'Europe/Madrid';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createKovoRepository } from '../../src/data/repository.js';
import { createSupabaseSource } from '../../src/data/supabase.js';
import { createEntityWriter, WriteError, WRITE_ROLES, classify } from '../../src/data/writes.js';
import { madridToUtc } from '../../src/data/legacy-writes.js';
import { MISSING_SERVICE_ID } from '../../src/data/legacy-state.js';
import { ORG, ORG2, uuid, createFakeServer, RLS_WRITE } from '../fixtures/supabase-fake.mjs';

const TODAY = '2026-11-06';
const USER = uuid(999);
const S1 = uuid(10), PRO = uuid(20), P1 = uuid(1), A_SCHED = uuid(31);
const ctxOf = role => ({ id: ORG, name: 'Consulta Ficticia', is_demo: true, role, membershipId: uuid(9000), userId: USER });
const network = () => { throw new TypeError('Failed to fetch'); };
const once = fn => { let done = false; return (...a) => { if (!done) { done = true; fn(...a); } }; };

async function setup(role = 'psychologa', { server = createFakeServer({ role }), ids = null } = {}) {
  const ctx = ctxOf(role);
  let n = 0;
  const source = createSupabaseSource({
    repository: createKovoRepository({ request: server.request, getContext: async () => ctx }),
    isConfigured: () => true, restore: async () => ({ id: USER }), getContext: async () => ctx,
    request: server.request, refresh: server.refresh,
    newId: ids ? () => ids[n++] : undefined
  });
  const S = await source.load({ today: TODAY });
  return { server, source, S, W: source.writes };
}
const reload = async (server, role = 'psychologa') => (await setup(role, { server })).S;
const patientInput = (extra = {}) => ({
  name: 'Nueva Paciente Ficticia', email: 'nueva@correo-ejemplo.test', phone: '600000099', service: S1, modal: 'online',
  billing: { type: 'particular', name: 'Nueva Paciente Ficticia', nif: '', addr: '' }, reminders: true, ...extra
});
const apptInput = (patientId, extra = {}) => ({ patientId, date: '2026-11-12', start: 600, dur: 50, service: S1, price: 5500, modal: 'presencial', loc: 'Despacho', notes: '', status: 'pendiente', ...extra });
const rejectsCode = (p, code) => assert.rejects(p, e => e instanceof WriteError && e.code === code, `esperaba ${code}`);
const snapshotOf = S => JSON.stringify({ patients: S.patients, appts: S.appts });

describe('pacientes: altas', () => {
  test('el código lo asigna PostgreSQL; se devuelve el registro confirmado y se aplica', async () => {
    const { server, S, W } = await setup();
    const before = server.db.patients.length;
    const { patient, replacedId, outcome } = await W.savePatient({ input: patientInput(), today: TODAY, services: S.services });
    assert.equal(outcome, 'created'); assert.equal(replacedId, null);
    assert.match(patient.id, /^[0-9a-f-]{36}$/);
    assert.equal(patient.code, 'P-00001');               // del trigger, no del navegador
    assert.equal(patient.status, 'activo'); assert.equal(patient.orgId, ORG);
    assert.equal(patient.service, S1); assert.equal(patient.modal, 'online'); assert.equal(patient.reminders, true);
    assert.equal(patient.alta, TODAY);
    const row = server.db.patients.find(p => p.id === patient.id);
    assert.equal(server.db.patients.length, before + 1);
    assert.deepEqual([row.first_name, row.last_name, row.org_id, row.status, row.legacy_id], ['Nueva', 'Paciente Ficticia', ORG, 'active', null]);
    assert.ok(!('patient_code' in server.writes()[0].body), 'el navegador no envía código');
    // el estado no se toca hasta aplicar
    assert.ok(!S.patients.some(p => p.id === patient.id));
    W.applyPatient(S, patient);
    assert.equal(S.patients.filter(p => p.id === patient.id).length, 1);
  });
  test('validación antes de enviar nada', async () => {
    const { server, S, W } = await setup();
    for (const bad of [{ name: '  ' }, { email: '' }, { email: 'no-es-email' }, { billing: { type: 'otro' } }, { modal: 'telefono' }]) {
      await rejectsCode(W.savePatient({ input: patientInput(bad), today: TODAY, services: S.services }), 'validation');
    }
    assert.equal(server.writes().length, 0);
  });
});

describe('pacientes: modificaciones', () => {
  test('cambia los campos del formulario, fusiona profile_data y no toca estado ni código', async () => {
    const { server, S, W } = await setup();
    const row = server.db.patients.find(p => p.id === P1);
    row.profile_data.extra = 'se-conserva'; row.status = 'archived';
    const S2 = await reload(server);
    const p = S2.patients.find(x => x.id === P1);
    const { patient, outcome } = await W.savePatient({ existing: p, input: patientInput({ name: 'Paciente Uno Cambiado', email: 'uno.nuevo@correo-ejemplo.test' }), today: TODAY, services: S2.services });
    assert.equal(outcome, 'updated');
    assert.equal(patient.id, P1); assert.equal(patient.code, '1001'); assert.equal(patient.name, 'Paciente Uno Cambiado');
    const saved = server.db.patients.find(x => x.id === P1);
    assert.equal(saved.status, 'archived');
    assert.equal(saved.profile_data.extra, 'se-conserva');
    assert.equal(saved.profile_data.modal, 'online');
    const patch = server.writes().at(-1);
    assert.equal(patch.method, 'PATCH');
    assert.match(patch.path, new RegExp(`id=eq\\.${P1}&org_id=eq\\.${ORG}&updated_at=eq\\.`));
    assert.ok(!('status' in patch.body) && !('patient_code' in patch.body) && !('org_id' in patch.body));
    assert.notEqual(saved.updated_at, p.updatedAt);
    assert.equal(patient.updatedAt, saved.updated_at, 'la nueva versión queda en el estado');
  });
  test('dos ediciones seguidas: la segunda usa la versión confirmada por la primera', async () => {
    const { S, W } = await setup();
    let p = S.patients.find(x => x.id === P1);
    ({ patient: p } = await W.savePatient({ existing: p, input: patientInput({ phone: '611111111' }), today: TODAY, services: S.services }));
    W.applyPatient(S, p);
    ({ patient: p } = await W.savePatient({ existing: S.patients.find(x => x.id === P1), input: patientInput({ phone: '622222222' }), today: TODAY, services: S.services }));
    assert.equal(p.phone, '622222222');
  });
  test('otra persona cambió la ficha: conflicto, no se pisa su cambio', async () => {
    const { server, S, W } = await setup();
    const p = S.patients.find(x => x.id === P1);
    Object.assign(server.db.patients.find(x => x.id === P1), { phone: '699999999', updated_at: '2026-11-06T12:00:00.000Z' });
    await rejectsCode(W.savePatient({ existing: p, input: patientInput(), today: TODAY, services: S.services }), 'conflict');
    assert.equal(server.db.patients.find(x => x.id === P1).phone, '699999999');
  });
});

describe('identificadores legacy y UUID', () => {
  test('paciente con id de la demo: se crea con legacy_id y se actualizan las referencias locales', async () => {
    const { server, S, W } = await setup();
    const legacy = { id: 'p77', code: '7777', name: 'Demo Ficticia', email: 'demo@correo-ejemplo.test', alta: '2026-01-15', profileData: {}, consent: null, docs: [] };
    S.patients.push(legacy);
    S.appts.push({ id: 'a900', patientId: 'p77', date: '2026-11-20', start: 600, dur: 60, status: 'pendiente', log: [] });
    const { patient, replacedId } = await W.savePatient({ existing: legacy, input: patientInput({ name: 'Demo Ficticia', email: 'demo@correo-ejemplo.test' }), today: TODAY, services: S.services });
    assert.equal(replacedId, 'p77');
    assert.equal(server.db.patients.find(x => x.id === patient.id).legacy_id, 'p77');
    assert.equal(patient.legacyId, 'p77'); assert.equal(patient.alta, '2026-01-15');
    W.applyPatient(S, patient, replacedId);
    assert.ok(!S.patients.some(p => p.id === 'p77'));
    assert.equal(S.appts.find(a => a.id === 'a900').patientId, patient.id);
  });
  test('si ese legacy_id ya está en la BD no se duplica: se usa el existente', async () => {
    const { server, S, W } = await setup();
    server.db.patients.find(x => x.id === P1).legacy_id = 'p77';
    const before = server.db.patients.length;
    const { patient, outcome } = await W.savePatient({ existing: { id: 'p77', name: 'x', profileData: {} }, input: patientInput(), today: TODAY, services: S.services });
    assert.equal(outcome, 'existing_legacy'); assert.equal(patient.id, P1);
    assert.equal(server.db.patients.length, before);
  });
  test('un legacy_id con caracteres raros se rechaza antes de enviar', async () => {
    const { server, S, W } = await setup();
    await rejectsCode(W.savePatient({ existing: { id: "p1' or 1=1", profileData: {} }, input: patientInput(), today: TODAY, services: S.services }), 'validation');
    assert.equal(server.writes().length, 0);
  });
});

describe('reintentos y duplicados', () => {
  test('alta de paciente: la primera respuesta se pierde; el reintento no duplica', async () => {
    const { server, S, W } = await setup();
    const before = server.db.patients.length, snap = snapshotOf(S);
    server.faults.afterWrite = once(network);
    await rejectsCode(W.savePatient({ input: patientInput(), today: TODAY, services: S.services }), 'network');
    assert.equal(snapshotOf(S), snap, 'sin confirmación no cambia el estado');
    assert.equal(server.db.patients.length, before + 1, 'la BD sí la guardó');
    const { patient, outcome } = await W.savePatient({ input: patientInput(), today: TODAY, services: S.services });
    assert.equal(outcome, 'already_created');
    assert.equal(server.db.patients.length, before + 1, 'sin duplicado');
    assert.equal(server.writes()[0].body.id, server.writes()[1].body.id, 'mismo id en el reintento');
    assert.equal(patient.code, 'P-00001');
  });
  test('reintento con el formulario cambiado: una sola fila, con los valores nuevos', async () => {
    const { server, S, W } = await setup();
    const before = server.db.patients.length;
    server.faults.afterWrite = once(network);
    await rejectsCode(W.savePatient({ input: patientInput(), today: TODAY, services: S.services }), 'network');
    const { patient } = await W.savePatient({ input: patientInput({ phone: '633333333' }), today: TODAY, services: S.services });
    assert.equal(server.db.patients.length, before + 1);
    assert.equal(patient.phone, '633333333');
  });
  test('formulario nuevo después de un alta: id nuevo (no reutiliza el anterior)', async () => {
    const { server, S, W } = await setup();
    await W.savePatient({ input: patientInput(), today: TODAY, services: S.services });
    W.resetPending('patient');
    await W.savePatient({ input: patientInput({ email: 'otra@correo-ejemplo.test' }), today: TODAY, services: S.services });
    const [a, b] = server.writes().map(w => w.body.id);
    assert.notEqual(a, b);
  });
  test('edición: la respuesta se pierde; el reintento se confirma sin conflicto', async () => {
    const { server, S, W } = await setup();
    const p = S.patients.find(x => x.id === P1);
    server.faults.afterWrite = once(network);
    await rejectsCode(W.savePatient({ existing: p, input: patientInput({ phone: '644444444' }), today: TODAY, services: S.services }), 'network');
    const { patient, outcome } = await W.savePatient({ existing: p, input: patientInput({ phone: '644444444' }), today: TODAY, services: S.services });
    assert.equal(outcome, 'already_applied'); assert.equal(patient.phone, '644444444');
  });
  test('alta de cita: la primera respuesta se pierde; el reintento no duplica', async () => {
    const { server, S, W } = await setup();
    const p = S.patients.find(x => x.id === P1);
    const before = server.db.appointments.length;
    server.faults.afterWrite = once(network);
    const save = () => W.saveAppointment({ input: apptInput(P1), patient: p, professionalId: PRO, userId: USER, services: S.services });
    await rejectsCode(save(), 'network');
    const { outcome } = await save();
    assert.equal(outcome, 'already_created');
    assert.equal(server.db.appointments.length, before + 1);
  });
});

describe('errores de red y sesión', () => {
  test('bloqueo mutuo o serialización (40P01/40001): mensaje claro, no un error genérico', () => {
    for (const code of ['40P01', '40001']) {
      const e = classify(Object.assign(new Error('x'), { status: 400, details: { code } }), 'appointments');
      assert.equal(e.code, 'busy'); assert.match(e.message, /a la vez/);
    }
  });
  test('sin conexión: error, nada guardado y estado intacto', async () => {
    const { server, S, W } = await setup();
    const before = JSON.stringify(server.db.patients), snap = snapshotOf(S);
    server.faults.beforeWrite = network;
    await rejectsCode(W.savePatient({ input: patientInput(), today: TODAY, services: S.services }), 'network');
    const a = S.appts.find(x => x.id === A_SCHED);
    await rejectsCode(W.setAppointmentStatus({ appt: a, status: 'confirmada', services: S.services }), 'network');
    assert.equal(JSON.stringify(server.db.patients), before);
    assert.equal(snapshotOf(S), snap);
  });
  test('el mensaje deja claro que NO se ha guardado', async () => {
    const { server, S, W } = await setup();
    server.faults.beforeWrite = network;
    await assert.rejects(W.savePatient({ input: patientInput(), today: TODAY, services: S.services }), /NO se ha guardado/);
  });
  test('500 del servidor y respuesta vacía no cuentan como guardado', async () => {
    const { server, S, W } = await setup();
    server.faults.beforeWrite = () => { throw Object.assign(new Error('x'), { status: 500 }); };
    await rejectsCode(W.savePatient({ input: patientInput(), today: TODAY, services: S.services }), 'http');
    const writer = createEntityWriter({ request: async () => [], getContext: async () => ctxOf('psychologa') });
    await rejectsCode(writer.createPatient({ id: uuid(7000), first_name: 'A', last_name: 'B', status: 'active', profile_data: {} }), 'unexpected_response');
    const other = createEntityWriter({ request: async (p, o) => [{ ...o.body, id: uuid(7000), org_id: ORG2 }], getContext: async () => ctxOf('psychologa') });
    await rejectsCode(other.createPatient({ id: uuid(7000), first_name: 'A', last_name: 'B', status: 'active', profile_data: {} }), 'unexpected_response');
  });
  test('token caducado: se renueva una vez y se repite la misma petición', async () => {
    const { server, S, W } = await setup();
    server.faults.expired = true;
    const { patient } = await W.savePatient({ input: patientInput(), today: TODAY, services: S.services });
    assert.ok(patient.id);
    const posts = server.calls.filter(c => c.method === 'POST');
    assert.equal(posts.length, 2); assert.equal(posts[0].body.id, posts[1].body.id);
    assert.equal(server.db.patients.filter(p => p.id === patient.id).length, 1);
  });
  test('sesión caducada sin renovación posible: error de sesión y nada guardado', async () => {
    const server = createFakeServer({ role: 'psychologa' });
    const writer = createEntityWriter({ request: server.request, getContext: async () => ctxOf('psychologa'), refresh: async () => null });
    const before = server.db.patients.length;
    server.faults.expired = true;
    await assert.rejects(writer.createPatient({ id: uuid(7001), first_name: 'A', last_name: 'B', status: 'active', profile_data: {} }), e => e.code === 'auth' && /sesión ha caducado/.test(e.message));
    assert.equal(server.db.patients.length, before);
  });
});

describe('permisos por rol', () => {
  test('la matriz de escritura coincide con las políticas RLS', () => {
    assert.deepEqual(WRITE_ROLES, RLS_WRITE);
  });
  test('recepción puede dar de alta y modificar pacientes y citas', async () => {
    const { S, W } = await setup('recepcion');
    const { patient } = await W.savePatient({ input: patientInput(), today: TODAY, services: S.services });
    const { appt } = await W.saveAppointment({ input: apptInput(patient.id), patient, services: S.services });
    const { appt: done } = await W.setAppointmentStatus({ appt, status: 'confirmada', services: S.services });
    assert.equal(done.status, 'confirmada');
  });
  test('gestoría: rechazado antes de enviar nada', async () => {
    const server = createFakeServer({ role: 'gestoria' });
    const writer = createEntityWriter({ request: server.request, getContext: async () => ctxOf('gestoria') });
    await rejectsCode(writer.createPatient({ id: uuid(7002), first_name: 'A', last_name: 'B', status: 'active', profile_data: {} }), 'forbidden');
    await rejectsCode(writer.updateAppointment(A_SCHED, { status: 'confirmed' }, '2026-10-20T09:00:00Z'), 'forbidden');
    assert.equal(server.calls.length, 0);
  });
  test('si la BD niega el permiso (RLS), es un error de permiso, no un guardado', async () => {
    const server = createFakeServer({ role: 'gestoria' });
    const writer = createEntityWriter({ request: server.request, getContext: async () => ctxOf('psychologa') });   // el cliente cree que es psicóloga
    await rejectsCode(writer.createPatient({ id: uuid(7003), first_name: 'A', last_name: 'B', status: 'active', profile_data: {} }), 'forbidden');
    await rejectsCode(writer.updatePatient(P1, { phone: '1' }, '2026-10-01T09:00:00Z'), 'not_found');
  });
  test('contexto sin consulta válida o rol desconocido', async () => {
    for (const ctx of [{ ...ctxOf('psychologa'), id: 'x' }, ctxOf('admin'), null]) {
      const writer = createEntityWriter({ request: async () => assert.fail('no debe pedir'), getContext: async () => ctx });
      await rejectsCode(writer.createPatient({ id: uuid(7004), first_name: 'A', last_name: 'B', status: 'active', profile_data: {} }), 'forbidden');
    }
  });
});

describe('otra organización', () => {
  test('no se puede modificar un paciente de otra consulta', async () => {
    const { server, S, W } = await setup();
    const foreign = server.db.patients.find(p => p.org_id === ORG2);
    const before = JSON.stringify(foreign);
    await rejectsCode(W.savePatient({ existing: { id: foreign.id, updatedAt: foreign.updated_at, profileData: {} }, input: patientInput(), today: TODAY, services: S.services }), 'not_found');
    assert.equal(JSON.stringify(foreign), before);
    assert.match(server.writes()[0].path, new RegExp(`org_id=eq\\.${ORG}`));
  });
  test('no se puede citar a un paciente de otra consulta (clave foránea compuesta)', async () => {
    const { server, S, W } = await setup();
    const foreign = server.db.patients.find(p => p.org_id === ORG2);
    await rejectsCode(W.saveAppointment({ input: apptInput(foreign.id), patient: { id: foreign.id }, services: S.services }), 'invalid_reference');
    assert.ok(!server.db.appointments.some(a => a.patient_id === foreign.id && a.org_id === ORG));
  });
  test('org_id no se puede elegir desde el cliente', async () => {
    const writer = createEntityWriter({ request: async () => assert.fail('no debe pedir'), getContext: async () => ctxOf('psychologa') });
    await rejectsCode(writer.createPatient({ id: uuid(7005), org_id: ORG2, first_name: 'A', last_name: 'B', status: 'active', profile_data: {} }), 'validation');
    await rejectsCode(writer.updatePatient(P1, { org_id: ORG2 }, 'v'), 'validation');
    const server = createFakeServer({ role: 'psychologa' });
    const w2 = createEntityWriter({ request: server.request, getContext: async () => ctxOf('psychologa') });
    const { row } = await w2.createPatient({ id: uuid(7006), first_name: 'A', last_name: 'B', status: 'active', profile_data: {} });
    assert.equal(row.org_id, ORG);
  });
});

describe('pacientes: finalizar y reanudar terapia', () => {
  test('cambia solo patients.status, con control de versión, y conserva lo cargado aparte', async () => {
    const { server, S, W } = await setup();
    const p = S.patients.find(x => x.id === P1);
    p.tests = [{ id: 't1' }]; p.dx = [];
    const n0 = server.writes().length;
    const { patient } = await W.setPatientStatus({ patient: p, status: 'alta terapéutica', services: S.services });
    const w = server.writes().slice(n0);
    assert.equal(w.length, 1); assert.equal(w[0].method, 'PATCH');
    assert.deepEqual(Object.keys(w[0].body).filter(k => k !== 'updated_at'), ['status']); assert.equal(w[0].body.status, 'inactive');
    assert.equal(server.db.patients.find(x => x.id === P1).status, 'inactive');
    assert.equal(patient.status, 'alta terapéutica'); assert.deepEqual(patient.tests, [{ id: 't1' }]);
    W.applyPatient(S, patient);
    const back = await W.setPatientStatus({ patient: S.patients.find(x => x.id === P1), status: 'activo', services: S.services });
    assert.equal(back.patient.status, 'activo');
    assert.equal((await reload(server)).patients.find(x => x.id === P1).status, 'activo');
  });
  test('versión antigua o estado desconocido: no escribe', async () => {
    const { server, S, W } = await setup();
    const p = S.patients.find(x => x.id === P1);
    const n0 = server.writes().length;
    await rejectsCode(W.setPatientStatus({ patient: p, status: 'archivado' }), 'validation');
    assert.equal(server.writes().length, n0);
    await rejectsCode(W.setPatientStatus({ patient: { ...p, updatedAt: '2020-01-01T00:00:00Z' }, status: 'alta terapéutica' }), 'conflict');
    assert.equal(server.db.patients.find(x => x.id === P1).status, 'active');
  });
  test('recepción puede; contabilidad no', async () => {
    const r = await setup('recepcion');
    await r.W.setPatientStatus({ patient: r.S.patients.find(x => x.id === P1), status: 'alta terapéutica' });
    const g = await setup('gestoria');
    await assert.rejects(g.W.setPatientStatus({ patient: { id: P1, updatedAt: 'x' }, status: 'alta terapéutica' }));
  });
});

describe('facturar sesiones: solo si el esquema enlaza citas y facturas', () => {
  test('con invoice_lines.appointment_id: disponible para la psicóloga', async () => {
    assert.equal((await setup()).S.billingLinkAvailable, true);
  });
  test('esquema sin la columna (42703): no disponible, sin romper la carga', async () => {
    const server = createFakeServer({ role: 'psychologa' });
    const inner = server.request;
    server.request = async (path, o) => {
      if (/^invoice_lines\?select=appointment_id/.test(path)) { const e = new Error('column does not exist'); e.status = 400; e.details = { code: '42703' }; throw e; }
      return inner(path, o);
    };
    const { S } = await setup('psychologa', { server });
    assert.equal(S.billingLinkAvailable, false);
    assert.ok(Array.isArray(S.invoices));
  });
  test('recepción no tiene facturación de sesiones', async () => {
    assert.equal((await setup('recepcion')).S.billingLinkAvailable, false);
  });
});

describe('citas', () => {
  test('alta: relación con paciente, profesional y servicio; hora de Madrid en UTC; creada por la usuaria', async () => {
    const { server, S, W } = await setup();
    const p = S.patients.find(x => x.id === P1);
    const { appt } = await W.saveAppointment({ input: apptInput(P1), patient: p, professionalId: S.pro.id, userId: W.userId(), services: S.services });
    const row = server.db.appointments.find(a => a.id === appt.id);
    assert.deepEqual([row.patient_id, row.professional_id, row.service_id, row.created_by, row.org_id], [P1, PRO, S1, USER, ORG]);
    assert.equal(row.starts_at, '2026-11-12T09:00:00.000Z');   // 10:00 en invierno (UTC+1)
    assert.equal(row.ends_at, '2026-11-12T09:50:00.000Z');
    assert.equal(row.status, 'scheduled');
    assert.deepEqual([appt.date, appt.start, appt.dur, appt.status, appt.patientId, appt.service], ['2026-11-12', 600, 50, 'pendiente', P1, S1]);
  });
  test('reprogramar: cambia fecha y hora; conserva historial local y versión nueva', async () => {
    const { server, S, W } = await setup();
    const a = { ...S.appts.find(x => x.id === A_SCHED), log: [{ at: 'x', who: 'y', what: 'Cita creada' }] };
    const { appt } = await W.saveAppointment({ existing: a, input: apptInput(P1, { date: '2026-07-15', start: 17 * 60 + 30, dur: 60 }), patient: S.patients.find(x => x.id === P1), services: S.services });
    const row = server.db.appointments.find(x => x.id === A_SCHED);
    assert.equal(row.starts_at, '2026-07-15T15:30:00.000Z');   // verano (UTC+2)
    assert.equal(appt.log.length, 1); assert.equal(appt.updatedAt, row.updated_at);
    assert.equal(server.writes().at(-1).method, 'PATCH');
    assert.ok(!('status' in server.writes().at(-1).body), 'reprogramar no cambia el estado');
  });
  test('cambios de estado encadenados con su versión', async () => {
    const { server, S, W } = await setup();
    let a = S.appts.find(x => x.id === A_SCHED);
    for (const [ui, db] of [['confirmada', 'confirmed'], ['realizada', 'completed'], ['ausencia', 'no_show'], ['cancelada', 'cancelled']]) {
      ({ appt: a } = await W.setAppointmentStatus({ appt: a, status: ui, services: S.services }));
      assert.equal(a.status, ui);
      assert.equal(server.db.appointments.find(x => x.id === A_SCHED).status, db);
    }
    await rejectsCode(W.setAppointmentStatus({ appt: a, status: 'borrada', services: S.services }), 'validation');
  });
  test('servicio de presentación → service_id null; paciente sin guardar → rechazada', async () => {
    const { server, S, W } = await setup();
    const p = S.patients.find(x => x.id === P1);
    const { appt } = await W.saveAppointment({ input: apptInput(P1, { service: MISSING_SERVICE_ID }), patient: p, services: S.services });
    assert.equal(server.db.appointments.find(x => x.id === appt.id).service_id, null);
    assert.equal(appt.service, MISSING_SERVICE_ID);
    await rejectsCode(W.saveAppointment({ input: apptInput('p77'), patient: { id: 'p77' }, services: S.services }), 'validation');
  });
  test('validación: duración, hora inexistente por el cambio de hora, fecha imposible', async () => {
    const { server, S, W } = await setup();
    const p = S.patients.find(x => x.id === P1);
    for (const bad of [{ dur: 0 }, { dur: 2000 }, { date: '2026-03-29', start: 150 }, { date: '2026-02-30' }, { start: 1440 }, { price: -1 }, { status: 'otra' }])
      await rejectsCode(W.saveAppointment({ input: apptInput(P1, bad), patient: p, services: S.services }), 'validation');
    assert.equal(server.writes().length, 0);
  });
});

describe('hora de Madrid → UTC', () => {
  test('invierno, verano, medianoche y cambios de hora', () => {
    assert.equal(madridToUtc('2026-11-06', 0), '2026-11-05T23:00:00.000Z');
    assert.equal(madridToUtc('2026-07-01', 600), '2026-07-01T08:00:00.000Z');
    assert.equal(madridToUtc('2026-03-29', 120 + 60), '2026-03-29T01:00:00.000Z');    // 03:00 CEST, primera hora tras el adelanto
    assert.throws(() => madridToUtc('2026-03-29', 150), /cambio de hora/);            // 02:30 no existe
    assert.equal(madridToUtc('2026-10-25', 150), '2026-10-25T01:30:00.000Z');         // 02:30 repetida: hora de invierno
  });
  test('no depende de la zona horaria del proceso', async () => {
    const { execFileSync } = await import('node:child_process');
    const code = `import('${new URL('../../src/data/legacy-writes.js', import.meta.url).href}').then(m=>process.stdout.write(m.madridToUtc('2026-11-12',600)))`;
    for (const TZ of ['UTC', 'America/New_York', 'Asia/Tokyo'])
      assert.equal(execFileSync(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, TZ } }).toString(), '2026-11-12T09:00:00.000Z', TZ);
  });
});

describe('consistencia después de guardar y volver a cargar', () => {
  const persisted = p => ({ id: p.id, code: p.code, name: p.name, email: p.email, phone: p.phone, status: p.status, service: p.service, modal: p.modal, billing: p.billing, reminders: p.reminders, alta: p.alta, updatedAt: p.updatedAt });
  const persistedA = a => ({ id: a.id, patientId: a.patientId, date: a.date, start: a.start, dur: a.dur, service: a.service, modal: a.modal, loc: a.loc, status: a.status, price: a.price, notes: a.notes, updatedAt: a.updatedAt });
  test('lo confirmado al guardar es lo mismo que se lee al recargar', async () => {
    const { server, S, W } = await setup();
    const { patient } = await W.savePatient({ input: patientInput({ billing: { type: 'empresa', name: 'Empresa Ficticia SL', nif: 'B00000000', addr: 'Calle Ficticia 3', ret: 15 } }), today: TODAY, services: S.services });
    W.applyPatient(S, patient);
    const { appt } = await W.saveAppointment({ input: apptInput(patient.id, { notes: 'Nota administrativa ficticia' }), patient, professionalId: S.pro.id, services: S.services });
    W.applyAppointment(S, appt);
    const { appt: a2 } = await W.setAppointmentStatus({ appt, status: 'confirmada', services: S.services });
    W.applyAppointment(S, a2);
    const { patient: p2 } = await W.savePatient({ existing: patient, input: patientInput({ phone: '655555555' }), today: TODAY, services: S.services });
    W.applyPatient(S, p2);
    const R = await reload(server);
    assert.deepEqual(persisted(R.patients.find(p => p.id === patient.id)), persisted(S.patients.find(p => p.id === patient.id)));
    assert.deepEqual(persistedA(R.appts.find(a => a.id === appt.id)), persistedA(S.appts.find(a => a.id === appt.id)));
    assert.equal(R.patients.length, S.patients.length); assert.equal(R.appts.length, S.appts.length);
  });
  test('recepción: lo que guarda lo ve igual al recargar', async () => {
    const { server, S, W } = await setup('recepcion');
    const { patient } = await W.savePatient({ input: patientInput(), today: TODAY, services: S.services });
    const R = await reload(server, 'recepcion');
    assert.deepEqual(persisted(R.patients.find(p => p.id === patient.id)), persisted(patient));
  });
});
