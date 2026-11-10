// KOVO — data migration test: a database that already holds data in the CURRENT schema (recovered
// baseline + backend + clinical proposals, i.e. what an existing clinic would have) is upgraded with
// db/migrations. Every pre-existing row must keep its id, its relations and its values; history
// (audit log, signed notes, issued invoices) must stay immutable; documents must remain
// downloadable; logins must keep working. Synthetic data only.
import { randomUUID } from 'node:crypto';
import { startStack } from '../local/stack.mjs';
import { applyKovoSchema, applyMigrations } from '../schema.mjs';
import { client, suite, minimalPdf } from './client.mjs';

const TABLES = ['organizations', 'memberships', 'professionals', 'services', 'patients', 'appointments', 'clinical_notes',
  'invoices', 'invoice_lines', 'payments', 'patient_documents', 'audit_log', 'organization_billing_profiles', 'patient_billing_profiles'];

async function snapshot(db) {
  const snap = {};
  for (const t of TABLES) {
    const r = await db.query(`SELECT id::text AS id, to_jsonb(x) AS row FROM public.${t} x`).catch(() => db.query(`SELECT org_id::text || coalesce('/' || (to_jsonb(x) ->> 'patient_id'), '') AS id, to_jsonb(x) AS row FROM public.${t} x`));
    snap[t] = new Map(r.rows.map(x => [x.id, x.row]));
  }
  snap.storage = (await db.query(`SELECT name, metadata ->> 'size' AS size FROM storage.objects ORDER BY name`)).rows;
  snap.users = (await db.query(`SELECT id::text, email, encrypted_password FROM auth.users ORDER BY id`)).rows;
  return snap;
}

async function asUser(db, uid, sql, params = []) {
  await db.query('BEGIN');
  try {
    await db.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role: 'authenticated' })]);
    await db.query('SET LOCAL ROLE authenticated');
    const r = await db.query(sql, params);
    await db.query('COMMIT');
    return r;
  } catch (e) { await db.query('ROLLBACK'); throw e; }
}

export async function runUpgrade({ log = () => {} } = {}) {
  const s = suite('upgrade');
  const { check } = s;
  const stack = await startStack({ log, schema: env => applyKovoSchema(env, { log, until: 'clinical' }) });
  try {
    const db = stack.env.admin;
    const api = client(stack);
    // ------------------------------------------------------------ data in the current schema
    const u1 = await stack.createUser('psico-existente@kovo.test', 'Prueba-sintetica-2026');
    const u2 = await stack.createUser('recepcion-existente@kovo.test', 'Prueba-sintetica-2026');
    const org = randomUUID(), pro = randomUUID(), svc = randomUUID();
    const pts = [randomUUID(), randomUUID(), randomUUID()];
    const apDone = randomUUID(), apNext = randomUUID();
    await db.query(`INSERT INTO public.organizations(id, name) VALUES ($1, 'Clínica Existente')`, [org]);
    await db.query(`INSERT INTO public.memberships(org_id, user_id, role) VALUES ($1, $2, 'psychologa'), ($1, $3, 'recepcion')`, [org, u1.id, u2.id]);
    await db.query(`INSERT INTO public.professionals(id, org_id, display_name) VALUES ($1, $2, 'Profesional Existente')`, [pro, org]);
    await db.query(`INSERT INTO public.services(id, org_id, name, duration_minutes, price_cents, tax_exempt, legacy_id) VALUES ($1, $2, 'Sesión', 50, 6000, true, 's1')`, [svc, org]);
    // Imported patients with explicit codes: exactly the situation that caused the collision bug.
    for (let i = 0; i < 3; i++) {
      await db.query(`INSERT INTO public.patients(id, org_id, patient_code, first_name, last_name, legacy_id, profile_data) VALUES ($1, $2, $3, 'Paciente', $4, $5, '{"modal":"presencial"}')`,
        [pts[i], org, `P-0000${i + 1}`, `Importado ${i + 1}`, `p${i + 1}`]);
    }
    await db.query(`INSERT INTO public.appointments(id, org_id, patient_id, professional_id, service_id, starts_at, ends_at, status, legacy_id) VALUES
      ($1, $3, $4, $5, $6, '2026-11-02 10:00+01', '2026-11-02 10:50+01', 'completed', 'a1'),
      ($2, $3, $4, $5, $6, '2026-12-15 10:00+01', '2026-12-15 10:50+01', 'scheduled', 'a2')`, [apDone, apNext, org, pts[0], pro, svc]);
    const counterBefore = (await db.query(`SELECT coalesce(max(last_value), 0) AS v FROM private.org_counters WHERE org_id = $1 AND counter_type = 'patient'`, [org])).rows[0].v;
    const note = randomUUID();
    await asUser(db, u1.id, `SELECT public.save_clinical_note_draft_v2($1, $2, $3, $4, 'session', '{"resumen": "Resumen SINTÉTICO de la sesión"}'::jsonb, NULL)`, [note, org, pts[0], apDone]);
    await asUser(db, u1.id, `SELECT public.sign_clinical_note($1)`, [note]);
    await db.query(`INSERT INTO public.organization_billing_profiles(org_id, legal_name, tax_id, address_line, postal_code, city) VALUES ($1, 'Clínica Existente SL', 'B22222222', 'Calle 1', '29001', 'Málaga')`, [org]);
    await db.query(`INSERT INTO public.patient_billing_profiles(org_id, patient_id, legal_name, address_line) VALUES ($1, $2, 'Paciente Importado 1', 'Calle 2')`, [org, pts[0]]);
    const inv = (await asUser(db, u1.id, `SELECT public.save_invoice_draft($1, $2, '2026-11-02', NULL, '[{"description":"Sesión","quantity":1,"unit_price_cents":6000,"tax_rate":0}]'::jsonb) AS id`, [org, pts[0]])).rows[0].id;
    await asUser(db, u1.id, `SELECT public.emit_invoice($1)`, [inv]);
    await asUser(db, u1.id, `INSERT INTO public.payments(org_id, invoice_id, amount_cents, method) VALUES ($1, $2, 6000, 'Bizum')`, [org, inv]);
    const docPath = `${org}/${pts[0]}/${randomUUID()}-informe.pdf`;
    const pdf = minimalPdf('existente');
    const up = await api.call(`/storage/v1/object/kovo-patient-documents/${docPath}`, { method: 'POST', token: api.service, body: pdf, raw: true, headers: { apikey: api.service, 'content-type': 'application/pdf' } });
    if (!up.ok) throw new Error(`subida previa: ${up.status} ${up.text}`);
    await db.query(`INSERT INTO public.patient_documents(org_id, patient_id, storage_path, document_type, file_name, uploaded_by) VALUES ($1, $2, $3, 'informe_externo', 'informe.pdf', $4)`, [org, pts[0], docPath, u1.id]);

    const before = await snapshot(db);
    log(`datos previos: ${TABLES.map(t => `${t}=${before[t].size}`).join(' ')}`);

    // ------------------------------------------------------------ upgrade
    await applyMigrations(stack.env, { log });
    // Hosted Supabase reloads the API schema cache automatically after DDL (event trigger); the
    // local PostgREST needs the explicit notification. Part of the deployment runbook too.
    await db.query(`NOTIFY pgrst, 'reload schema'`);
    await new Promise(r => setTimeout(r, 1500));

    const after = await snapshot(db);
    for (const t of TABLES) {
      let missing = 0, changed = [];
      for (const [id, row] of before[t]) {
        const now = after[t].get(id);
        if (!now) { missing++; continue; }
        for (const [k, v] of Object.entries(row)) if (JSON.stringify(now[k]) !== JSON.stringify(v)) changed.push(`${id.slice(0, 8)}.${k}`);
      }
      check(`Migración: ${t} conserva ids, relaciones y valores (${before[t].size} filas)`, missing === 0 && changed.length === 0, `faltan ${missing}; cambian ${changed.slice(0, 5).join(',')}`);
    }
    check('Migración: el historial de auditoría se conserva completo', after.audit_log.size >= before.audit_log.size, `${before.audit_log.size} → ${after.audit_log.size}`);
    check('Migración: objetos de Storage intactos', JSON.stringify(after.storage) === JSON.stringify(before.storage), JSON.stringify(after.storage));
    check('Migración: cuentas de acceso intactas (incluido el hash de la contraseña)', JSON.stringify(after.users) === JSON.stringify(before.users), '');

    const counterAfter = (await db.query(`SELECT last_value AS v FROM private.org_counters WHERE org_id = $1 AND counter_type = 'patient'`, [org])).rows[0]?.v;
    check('Migración: el contador de códigos se sincroniza con los importados', Number(counterBefore) === 0 && Number(counterAfter) === 3, `${counterBefore} → ${counterAfter}`);
    const admin = (await db.query(`SELECT is_admin FROM public.memberships WHERE org_id = $1 AND user_id = $2`, [org, u1.id])).rows[0].is_admin;
    check('Migración: la psicóloga más antigua pasa a administrar la clínica', admin === true, String(admin));

    // ------------------------------------------------------------ behaviour after the upgrade (real tokens)
    const t1 = (await stack.signIn('psico-existente@kovo.test', 'Prueba-sintetica-2026')).access_token;
    check('Tras migrar: las personas usuarias inician sesión igual que antes', !!t1, '');
    const p4 = await api.insert(t1, 'patients', { org_id: org, patient_code: 'AUTO', first_name: 'Paciente', last_name: 'Nuevo' });
    check('Tras migrar: la siguiente alta recibe P-00004 (sin colisión con los importados)', p4.status === 201 && p4.json[0].patient_code === 'P-00004', p4.text);
    const noteEdit = await api.patch(t1, `clinical_notes?id=eq.${note}`, { content: 'cambio' });
    check('Tras migrar: la nota firmada sigue siendo inmutable', !noteEdit.ok || noteEdit.json.length === 0, noteEdit.text);
    const noteRead = await api.get(t1, `clinical_notes?id=eq.${note}&select=status,appointment_id,patient_id`);
    check('Tras migrar: la nota firmada mantiene su cita y paciente', noteRead.ok && noteRead.json[0]?.status === 'signed' && noteRead.json[0].appointment_id === apDone, noteRead.text);
    const invEdit = await api.patch(t1, `invoices?id=eq.${inv}`, { total_cents: 1 });
    check('Tras migrar: la factura emitida sigue siendo inmutable', !invEdit.ok, invEdit.text);
    const dl = await api.download(t1, docPath);
    check('Tras migrar: el documento existente se descarga con los permisos nuevos', dl.ok && (await dl.arrayBuffer()).byteLength === pdf.length, `${dl.status}`);
    const t2 = (await stack.signIn('recepcion-existente@kovo.test', 'Prueba-sintetica-2026')).access_token;
    const recAppts = await api.get(t2, `appointments?org_id=eq.${org}&select=id,patient_id`);
    check('Tras migrar: recepción sigue viendo la agenda con sus relaciones', recAppts.ok && recAppts.json.length === 2 && recAppts.json.every(a => a.patient_id === pts[0]), recAppts.text);
    const orgs = await api.rpc(t1, 'my_organizations');
    check('Tras migrar: la clínica existente aparece sin plan asignado (decisión pendiente: asignar plan a clínicas actuales)', orgs.ok && orgs.json[0]?.plan_code === null, orgs.text);
    return s;
  } finally {
    await stack.stop();
  }
}
