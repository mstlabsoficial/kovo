// Pruebas de la carga en modo Supabase: repository.loadSnapshot(), legacy-state.js y load().
// Node nativo (node:test). La "API" es un doble en memoria con datos 100 % sintéticos que aplica
// las mismas reglas de lectura que las políticas RLS reales. Sin red ni Supabase.
process.env.TZ = 'Europe/Madrid';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createKovoRepository, SNAPSHOT_TABLES, PAGE_SIZE, SnapshotError } from '../../src/data/repository.js';
import { createSupabaseSource } from '../../src/data/supabase.js';
import { toLegacyState, DEFAULT_SETTINGS, MISSING_SERVICE_ID } from '../../src/data/legacy-state.js';
import { buildLegacyCollections } from '../../src/data/from-supabase.js';
import { ORG, ORG2, uuid, RLS, syntheticDb, fakeApi } from '../fixtures/supabase-fake.mjs';

const TODAY = '2026-11-06';
const ctx = (role, id = ORG) => ({ id, name: 'Consulta Ficticia', is_demo: true, role, membershipId: uuid(9000) });

const repoFor = (role, db = syntheticDb(), opts) => {
  const api = fakeApi(db, role, opts);
  return { api, repo: createKovoRepository({ request: api.request, getContext: async () => ctx(role) }) };
};

describe('repository.loadSnapshot: permisos por rol', () => {
  const expected = {
    psychologa: SNAPSHOT_TABLES.map(s => s.key),
    recepcion: ['services', 'professionals', 'patients', 'appointments'],
    gestoria: ['services', 'professionals', 'invoices', 'invoiceLines', 'payments', 'expenses']
  };
  for (const [role, keys] of Object.entries(expected)) {
    test(`${role}: solo pide y devuelve sus tablas`, async () => {
      const { api, repo } = repoFor(role);
      const snap = await repo.loadSnapshot();
      assert.deepEqual(Object.keys(snap).filter(k => k !== 'context').sort(), keys.slice().sort());
      const asked = new Set(api.calls.map(c => c.path.split('?')[0]));
      const allowedTables = SNAPSHOT_TABLES.filter(s => keys.includes(s.key)).map(s => s.table);
      assert.deepEqual([...asked].sort(), allowedTables.slice().sort());
      assert.ok(api.calls.every(c => c.method === 'GET'), 'solo lecturas');
      assert.ok(api.calls.every(c => c.path.includes(`org_id=eq.${ORG}`)), 'siempre filtrado por organización');
    });
  }
  test('recepción y gestoría no reciben datos clínicos ni de personal', async () => {
    for (const role of ['recepcion', 'gestoria']) {
      const { repo } = repoFor(role);
      const snap = await repo.loadSnapshot();
      for (const k of ['clinicalNotes', 'rectifications', 'patientDocuments', 'employees']) assert.equal(snap[k], undefined, `${role}.${k}`);
    }
    const { repo } = repoFor('gestoria');
    const snap = await repo.loadSnapshot();
    assert.equal(snap.patients, undefined); assert.equal(snap.appointments, undefined);
  });
  test('la matriz de roles coincide con las políticas RLS de SELECT', () => {
    for (const s of SNAPSHOT_TABLES) assert.deepEqual(s.roles.slice().sort(), RLS[s.table].slice().sort(), s.table);
  });
  test('rol desconocido o contexto sin UUID: no se pide nada', async () => {
    for (const bad of [ctx('admin'), ctx(null), { ...ctx('psychologa'), id: "x' or 1=1" }]) {
      const api = fakeApi(syntheticDb(), 'psychologa');
      const repo = createKovoRepository({ request: api.request, getContext: async () => bad });
      await assert.rejects(repo.loadSnapshot(), SnapshotError);
      assert.equal(api.calls.length, 0);
    }
  });
  test('se cargan también los servicios inactivos (los usan citas antiguas)', async () => {
    const { repo } = repoFor('psychologa');
    const snap = await repo.loadSnapshot();
    assert.equal(snap.services.length, 2);
  });
});

describe('repository.loadSnapshot: paginación y duplicados', () => {
  test('lee todas las páginas aunque el servidor limite filas por respuesta', async () => {
    const db = syntheticDb();
    const many = Array.from({ length: PAGE_SIZE * 2 + 7 }, (_, k) => ({ ...db.expenses[0], id: uuid(20000 + k) }));
    db.expenses = many;
    for (const maxRows of [Infinity, 100]) {
      const { repo, api } = repoFor('gestoria', db, { maxRows });
      const snap = await repo.loadSnapshot();
      assert.equal(snap.expenses.length, many.length, `maxRows=${maxRows}`);
      assert.equal(new Set(snap.expenses.map(e => e.id)).size, many.length);
      assert.ok(api.calls.filter(c => c.path.startsWith('expenses?')).length >= 2);
    }
  });
  test('el orden incluye id para que la paginación sea estable', () => {
    for (const s of SNAPSHOT_TABLES) assert.match(s.order, /(^|,)id\.asc$/, s.table);
  });
});

describe('organización sin datos', () => {
  for (const role of ['psychologa', 'recepcion', 'gestoria']) {
    test(`${role}: carga un estado vacío y válido`, async () => {
      const db = Object.fromEntries(Object.keys(RLS).map(t => [t, []]));
      const api = fakeApi(db, role);
      const source = createSupabaseSource({ repository: createKovoRepository({ request: api.request, getContext: async () => ctx(role) }), isConfigured: () => true, restore: async () => ({ id: uuid(999) }), getContext: async () => ctx(role) });
      const S = await source.load({ today: TODAY });
      for (const k of ['patients', 'appts', 'notes', 'invoices', 'expenses', 'employees', 'services', 'bank', 'payrolls', 'audit', 'outbox']) assert.deepEqual(S[k], [], k);
      assert.equal(S.role, { psychologa: 'psicologa', recepcion: 'recepcion', gestoria: 'gestoria' }[role]);
      assert.equal(S.pro.name, '');
      assert.ok(source.report().some(e => e.issue === 'missing_in_db' && e.field === 'pro'));
    });
  }
});

describe('errores de red y respuestas inesperadas', () => {
  const failing = (fail, role = 'psychologa') => createKovoRepository({ request: fakeApi(syntheticDb(), role, { fail }).request, getContext: async () => ctx(role) });
  const rejectsWith = (p, code) => assert.rejects(p, e => e instanceof SnapshotError && e.code === code);
  test('sin conexión (fetch lanza TypeError)', async () => {
    await rejectsWith(failing(t => { if (t === 'appointments') throw new TypeError('Failed to fetch'); }).loadSnapshot(), 'network');
  });
  test('sesión caducada o sin permiso (401/403)', async () => {
    for (const status of [401, 403]) await rejectsWith(failing(t => { if (t === 'patients') throw Object.assign(new Error('x'), { status }); }).loadSnapshot(), 'auth');
  });
  test('error del servidor (500)', async () => {
    const p = failing(t => { if (t === 'invoices') throw Object.assign(new Error('x'), { status: 500 }); }).loadSnapshot();
    await assert.rejects(p, e => e.code === 'http' && e.status === 500 && e.table === 'invoices');
  });
  test('respuesta que no es una lista (HTML, objeto, null)', async () => {
    for (const bad of ['<html>error</html>', { message: 'x' }, null]) await rejectsWith(failing(t => (t === 'services' ? bad : undefined)).loadSnapshot(), 'unexpected_response');
  });
  test('filas de otra organización o sin id', async () => {
    // Solo en la primera página, para que el error sea por el registro y no por el límite de páginas.
    const firstPage = rows => (t, q) => (t === 'patients' ? (q.get('offset') === '0' ? rows : []) : undefined);
    const foreign = /no corresponden a tu consulta/;
    await assert.rejects(failing(firstPage([{ id: uuid(1), org_id: ORG2 }])).loadSnapshot(), e => e.code === 'unexpected_response' && foreign.test(e.message));
    await assert.rejects(failing(firstPage([{ org_id: ORG }])).loadSnapshot(), e => e.code === 'unexpected_response' && foreign.test(e.message));
    await assert.rejects(failing(firstPage([null])).loadSnapshot(), e => e.code === 'unexpected_response' && foreign.test(e.message));
  });
  test('una página infinita se corta', async () => {
    await rejectsWith(failing((t, q) => (t === 'expenses' ? [{ id: uuid(Number(q.get('offset')) + 1), org_id: ORG }] : undefined), 'gestoria').loadSnapshot(), 'unexpected_response');
  });
  test('el mensaje de error no contiene datos personales y está en español', async () => {
    try { await failing(t => { if (t === 'patients') throw Object.assign(new Error('uno@correo-ejemplo.test'), { status: 500 }); }).loadSnapshot(); assert.fail(); }
    catch (e) { assert.ok(!e.message.includes('@')); assert.match(e.message, /No se han podido cargar/); }
  });
  test('load() propaga el error y no devuelve un estado parcial', async () => {
    const api = fakeApi(syntheticDb(), 'psychologa', { fail: t => { if (t === 'clinical_notes') throw new TypeError('Failed to fetch'); } });
    const source = createSupabaseSource({ repository: createKovoRepository({ request: api.request, getContext: async () => ctx('psychologa') }), isConfigured: () => true, restore: async () => ({ id: uuid(999) }), getContext: async () => ctx('psychologa') });
    await assert.rejects(source.load({ today: TODAY }), e => e.code === 'network');
  });
  test('sin configuración o sin sesión: error claro antes de pedir datos', async () => {
    const api = fakeApi(syntheticDb(), 'psychologa');
    const repository = createKovoRepository({ request: api.request, getContext: async () => ctx('psychologa') });
    await assert.rejects(createSupabaseSource({ repository, isConfigured: () => false }).load({ today: TODAY }), /VITE_SUPABASE_URL/);
    await assert.rejects(createSupabaseSource({ repository, isConfigured: () => true, restore: async () => null }).load({ today: TODAY }), /Inicia sesión/);
    assert.equal(api.calls.length, 0);
  });
});

describe('load(): conjunto completo para la psicóloga', () => {
  const loadAs = async role => {
    const api = fakeApi(syntheticDb(), role);
    const source = createSupabaseSource({ repository: createKovoRepository({ request: api.request, getContext: async () => ctx(role) }), isConfigured: () => true, restore: async () => ({ id: uuid(999) }), getContext: async () => ctx(role) });
    return { S: await source.load({ today: TODAY }), source, api };
  };
  test('relaciones: paciente ↔ citas, factura ↔ líneas y cobros, nota ↔ rectificaciones, consentimiento', async () => {
    const { S } = await loadAs('psychologa');
    assert.equal(S.patients.length, 2); assert.equal(S.appts.length, 3);
    assert.ok(S.patients.every(p => p.orgId === ORG) && S.appts.every(a => a.orgId === ORG), 'nada de la otra consulta');
    assert.deepEqual(S.appts.filter(a => a.patientId === uuid(1)).map(a => a.id).sort(), [uuid(30), uuid(31)]);
    const inv = S.invoices[0];
    assert.equal(inv.lines.length, 1); assert.equal(inv.payments.length, 1); assert.equal(inv.payments[0].amount, 2000);
    assert.equal(inv.status, 'emitida'); assert.equal(inv.ret, 15); assert.equal(inv.num, 'KOVO-2026-000001');
    assert.equal(S.notes.find(n => n.id === uuid(70)).versions.length, 1);
    assert.equal(S.patients[0].consent.file, 'consentimiento.pdf'); assert.equal(S.patients[0].consent.url, null);
  });
  test('fechas en hora de Madrid: una cita a las 23:30 UTC es del día siguiente a las 00:30', async () => {
    const { S } = await loadAs('psychologa');
    const a = S.appts.find(x => x.id === uuid(32));
    assert.equal(a.date, '2026-11-06'); assert.equal(a.start, 30); assert.equal(a.dur, 50);
  });
  test('la factura reproduce los céntimos de la BD con el cálculo de la interfaz', async () => {
    const { S } = await loadAs('psychologa');
    const i = S.invoices[0];
    let base = 0, iva = 0; i.lines.forEach(l => { const b = Math.round(l.qty * l.price); base += b; if (!l.exempt) iva += Math.round(b * 0.21); });
    const ret = Math.round(base * i.ret / 100);
    assert.deepEqual([base, iva, ret, base + iva - ret], [5500, 0, 825, 4675]);
  });
  test('destinatario de la factura: datos de facturación del paciente', async () => {
    const { S, source } = await loadAs('psychologa');
    assert.deepEqual(S.invoices[0].to, { type: 'empresa', name: 'Empresa Ficticia SL', nif: 'B00000000', addr: 'Calle Ficticia 2', ret: 15 });
    assert.ok(source.report().some(e => e.entity === 'invoice' && e.issue === 'derived_from_patient_billing'));
  });
  test('gestoría: facturas sin pacientes cargados; destinatario vacío, sin fallar', async () => {
    const { S } = await loadAs('gestoria');
    assert.deepEqual(S.patients, []); assert.deepEqual(S.notes, []);
    assert.equal(S.invoices.length, 1); assert.equal(S.invoices[0].to.name, '');
  });
  test('recepción: pacientes y citas; sin facturas, notas ni personal', async () => {
    const { S } = await loadAs('recepcion');
    assert.equal(S.patients.length, 2); assert.equal(S.appts.length, 3);
    for (const k of ['invoices', 'notes', 'employees', 'expenses']) assert.deepEqual(S[k], [], k);
  });
  test('valores de presentación donde la interfaz fallaría con null', async () => {
    const { S, source } = await loadAs('psychologa');
    const r = source.report();
    const noSvc = S.appts.find(a => a.id === uuid(32));
    assert.equal(noSvc.service, MISSING_SERVICE_ID);
    assert.ok(S.services.some(s => s.id === MISSING_SERVICE_ID && s.placeholder));
    assert.equal(S.appts.find(a => a.id === uuid(31)).service, uuid(11));   // servicio inactivo, no el de presentación
    const p2 = S.patients.find(p => p.id === uuid(2));
    assert.deepEqual(p2.billing, { type: 'particular', name: 'Paciente Dos Ficticio', nif: '', addr: '' });
    assert.equal(S.expenses[0].status, 'por revisar');
    const free = S.notes.find(n => n.id === uuid(71));
    assert.deepEqual(free.fields, { objetivos: 'Texto libre ficticio' });
    for (const f of ['service', 'billing', 'status', 'fields']) assert.ok(r.some(e => e.issue === 'ui_default' && e.field === f), f);
  });
  test('el informe de carga no contiene datos personales ni clínicos', async () => {
    const { source } = await loadAs('psychologa');
    const text = JSON.stringify(source.report());
    for (const pii of ['Paciente', 'Ficticio', '@correo', '600000011', '1001', 'Objetivo', 'Texto libre', 'Empresa Ficticia', 'B00000000', 'Calle', 'consentimiento.pdf']) assert.ok(!text.includes(pii), pii);
  });
  test('persist() no escribe y newId() da UUID', async () => {
    const { S, source, api } = await loadAs('psychologa');
    const before = api.calls.length;
    source.persist(S);
    assert.equal(api.calls.length, before);
    assert.match(source.newId('p', S), /^[0-9a-f-]{36}$/);
    await assert.rejects(source.reset(), /No se permite/);
  });
});

describe('legacy-state: forma del estado', () => {
  const legacySrc = readFileSync(new URL('../../src/legacy.js', import.meta.url), 'utf8');
  test('mismas claves de primer nivel que seed() de legacy.js', () => {
    const { state } = toLegacyState({ collections: {}, context: ctx('psychologa'), today: TODAY });
    const seedKeys = ['seq', 'role', 'view', 'cal', 'sel', 'pro', 'settings', 'services', 'patients', 'appts', 'notes', 'invoices', 'expenses', 'bank', 'employees', 'payrolls', 'oblPaid', 'audit', 'outbox', 'avail'];
    const body = legacySrc.match(/const S=\{([\s\S]*?)\};\n  const id=/)[1];
    for (const k of seedKeys) assert.ok(new RegExp(`(^|[,{\\s])${k}:`).test(body), `seed() tiene ${k}`);
    for (const k of seedKeys) assert.ok(k in state, k);
  });
  test('ajustes y disponibilidad por defecto iguales a los de legacy.js', () => {
    const settings = new Function(`return ${legacySrc.match(/settings:(\{[^}]*\})/)[1]}`)();
    assert.deepEqual({ ...DEFAULT_SETTINGS }, settings);
    const avail = new Function(`return ${legacySrc.match(/const DEF_AVAIL=(\{[^;]*\});/)[1]}`)();
    assert.deepEqual(toLegacyState({ collections: {}, context: ctx('gestoria'), today: TODAY }).state.avail, avail);
  });
  test('rol o fecha no válidos', () => {
    assert.throws(() => toLegacyState({ collections: {}, context: ctx('admin'), today: TODAY }), /rol/);
    assert.throws(() => toLegacyState({ collections: {}, context: ctx('psychologa'), today: '06/11/2026' }), /Fecha/);
  });
  test('registros que la interfaz no puede mostrar se excluyen y se anotan (no se borran)', () => {
    const built = buildLegacyCollections({
      invoices: [{ id: uuid(40), org_id: ORG, patient_id: null, status: 'unknown', subtotal_cents: 0, tax_cents: 0, retention_cents: 0, total_cents: 0 }],
      clinicalNotes: [{ id: uuid(70), org_id: ORG, patient_id: uuid(1), note_type: 'phone_call', content: 'x', status: 'draft' }],
      invoiceLines: [], payments: [], rectifications: []
    });
    const { state, report } = toLegacyState({ ...built, context: ctx('psychologa'), today: TODAY });
    assert.deepEqual(state.invoices, []); assert.deepEqual(state.notes, []);
    assert.equal(report.filter(e => e.issue === 'excluded_from_ui').length, 2);
  });
  test('no modifica las colecciones de entrada', () => {
    const built = buildLegacyCollections({ patients: [syntheticDb().patients[1]], services: [], appointments: [] });
    const copy = JSON.stringify(built.collections);
    toLegacyState({ ...built, context: ctx('psychologa'), today: TODAY });
    assert.equal(JSON.stringify(built.collections), copy);
  });
  test('retención no entera: porcentaje exacto que reproduce los céntimos', () => {
    const built = buildLegacyCollections({ invoices: [{ id: uuid(40), org_id: ORG, patient_id: null, status: 'draft', subtotal_cents: 3333, tax_cents: 0, retention_cents: 500, total_cents: 2833 }], invoiceLines: [{ id: uuid(50), org_id: ORG, invoice_id: uuid(40), description: 'x', quantity: 1, unit_price_cents: 3333, tax_rate: 0, line_total_cents: 3333 }], payments: [] });
    const i = toLegacyState({ ...built, context: ctx('psychologa'), today: TODAY }).state.invoices[0];
    assert.equal(Math.round(3333 * i.ret / 100), 500);
  });
});
