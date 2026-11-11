// KOVO — HTTP tests against the full local stack with REAL Supabase Auth tokens, REAL PostgREST and
// REAL Supabase Storage. Two clinics, one user per role, KOVO staff. Synthetic data only.
import { randomUUID } from 'node:crypto';
import { client, suite, newUser, minimalPdf } from './client.mjs';
import { handleWebhook, hmacHex } from '../../supabase/functions/billing-webhook/core.js';

export async function runHttp(stack) {
  const api = client(stack);
  const s = suite('http');
  const { check } = s;
  const err = r => `${r.status} ${typeof r.json === 'object' ? JSON.stringify(r.json) : r.text}`.slice(0, 300);

  // ---------------------------------------------------------------- Auth: sign-up, policy, sessions
  const weak = await api.signUp('debil@kovo.test', 'corta');
  check('Auth: contraseñas de menos de 10 caracteres rechazadas', weak.status === 422 || weak.status === 400, err(weak));
  const titA = await newUser(api, 'titular-a@kovo.test', undefined, { full_name: 'Titular Ficticia A' });
  const titB = await newUser(api, 'titular-b@kovo.test');
  const dup = await api.signUp('titular-a@kovo.test', 'Prueba-sintetica-2026');
  check('Auth: no se crea una segunda cuenta con el mismo correo', !dup.json?.access_token || dup.json?.user?.id !== titA.id, err(dup));
  const me = await api.user(titA.token);
  check('Auth: el token emitido por Supabase Auth identifica al usuario', me.ok && me.json.id === titA.id, err(me));

  // ---------------------------------------------------------------- Sign-up of two clinics
  const orgA = await api.rpc(titA.token, 'create_organization', { p_name: 'Clínica Ficticia A', p_plan_code: 'professional', p_display_name: 'Titular A' });
  const orgB = await api.rpc(titB.token, 'create_organization', { p_name: 'Clínica Ficticia B', p_plan_code: 'starter' });
  check('Alta: una persona registrada crea su clínica (RPC)', orgA.ok && typeof orgA.json === 'string', err(orgA));
  check('Alta: una segunda clínica independiente', orgB.ok && orgB.json !== orgA.json, err(orgB));
  const A = orgA.json, B = orgB.json;
  const myA = await api.rpc(titA.token, 'my_organizations');
  check('Alta: la titular es psicóloga y administradora, plan en prueba', myA.ok && myA.json.length === 1 && myA.json[0].is_admin && myA.json[0].role === 'psychologa' && myA.json[0].subscription_status === 'trialing', err(myA));
  const anonOrg = await api.rpc(undefined, 'create_organization', { p_name: 'Sin sesión' });
  check('Alta: sin sesión no se puede crear una clínica', !anonOrg.ok, err(anonOrg));

  // ---------------------------------------------------------------- Patients and codes
  const p1 = await api.insert(titA.token, 'patients', { org_id: A, patient_code: 'AUTO', first_name: 'Paciente', last_name: 'Sintético Uno' });
  check('Pacientes: alta con código automático P-00001', p1.status === 201 && p1.json[0].patient_code === 'P-00001', err(p1));
  const p7 = await api.insert(titA.token, 'patients', { org_id: A, patient_code: 'P-00007', first_name: 'Paciente', last_name: 'Importado' });
  const p8 = await api.insert(titA.token, 'patients', { org_id: A, patient_code: 'AUTO', first_name: 'Paciente', last_name: 'Siguiente' });
  check('Pacientes: tras un código explícito P-00007 el siguiente es P-00008 (sin colisión)', p7.status === 201 && p8.json?.[0]?.patient_code === 'P-00008', err(p8));
  const P1 = p1.json[0].id;
  const pB = await api.insert(titB.token, 'patients', { org_id: B, patient_code: 'AUTO', first_name: 'Paciente', last_name: 'De B' });
  check('Pacientes: cada clínica numera por separado (B empieza en P-00001)', pB.json?.[0]?.patient_code === 'P-00001', err(pB));
  const PB = pB.json[0].id;

  // ---------------------------------------------------------------- Isolation between clinics
  const leak = await api.get(titB.token, `patients?org_id=eq.${A}&select=id`);
  check('Aislamiento: B no ve pacientes de A por REST', leak.ok && leak.json.length === 0, err(leak));
  const byId = await api.get(titB.token, `patients?id=eq.${P1}&select=id`);
  check('Aislamiento: B no lee un paciente de A aunque conozca su id', byId.ok && byId.json.length === 0, err(byId));
  const forged = await api.insert(titB.token, 'patients', { org_id: A, patient_code: 'AUTO', first_name: 'X', last_name: 'Y' });
  check('Aislamiento: B no puede escribir en A cambiando org_id', forged.status === 403, err(forged));
  const moveAway = await api.patch(titB.token, `patients?id=eq.${PB}`, { org_id: A });
  check('Aislamiento: B no puede mover su paciente a la clínica A', !moveAway.ok, err(moveAway));
  const teamLeak = await api.rpc(titB.token, 'list_team', { p_org_id: A });
  check('Aislamiento: B no lista el equipo de A', !teamLeak.ok, err(teamLeak));
  const apptCross = await api.insert(titB.token, 'appointments', { org_id: B, patient_id: P1, starts_at: '2026-12-01T10:00:00+01:00', ends_at: '2026-12-01T10:50:00+01:00' });
  check('Aislamiento: una cita de B no puede apuntar a un paciente de A (FK compuesta)', !apptCross.ok, err(apptCross));

  // ---------------------------------------------------------------- Invitations and roles
  const inv = await api.rpc(titA.token, 'invite_member', { p_org_id: A, p_email: 'recepcion-a@kovo.test', p_role: 'recepcion' });
  check('Equipo: la administradora invita a recepción', inv.ok && inv.json.token?.length === 48, err(inv));
  const invG = await api.rpc(titA.token, 'invite_member', { p_org_id: A, p_email: 'gestoria-a@kovo.test', p_role: 'gestoria' });
  const invP = await api.rpc(titA.token, 'invite_member', { p_org_id: A, p_email: 'psico-a2@kovo.test', p_role: 'psychologa' });
  const rec = await newUser(api, 'recepcion-a@kovo.test');
  const ges = await newUser(api, 'gestoria-a@kovo.test');
  const ps2 = await newUser(api, 'psico-a2@kovo.test');
  const intruso = await newUser(api, 'intruso@kovo.test');
  const wrong = await api.rpc(intruso.token, 'accept_invitation', { p_token: inv.json.token });
  check('Equipo: otra cuenta no puede usar la invitación', !wrong.ok && wrong.json?.code === 'KT004', err(wrong));
  const acc = await api.rpc(rec.token, 'accept_invitation', { p_token: inv.json.token });
  check('Equipo: la persona invitada acepta con su cuenta', acc.ok && acc.json.role === 'recepcion', err(acc));
  await api.rpc(ges.token, 'accept_invitation', { p_token: invG.json.token });
  await api.rpc(ps2.token, 'accept_invitation', { p_token: invP.json.token });
  const again = await api.rpc(rec.token, 'accept_invitation', { p_token: inv.json.token });
  check('Equipo: la invitación es de un solo uso', !again.ok && again.json?.code === 'KT003', err(again));
  const team = await api.rpc(titA.token, 'list_team', { p_org_id: A });
  check('Equipo: la administradora ve 4 personas con su correo', team.ok && team.json.length === 4 && team.json.every(m => m.email), err(team));

  const recPatients = await api.get(rec.token, 'patients?select=id');
  check('Roles: recepción ve pacientes', recPatients.ok && recPatients.json.length === 3, err(recPatients));
  const recNotes = await api.get(rec.token, 'clinical_notes?select=id');
  check('Roles: recepción no ve notas clínicas', recNotes.ok && recNotes.json.length === 0, err(recNotes));
  const recInv = await api.get(rec.token, 'invoices?select=id');
  check('Roles: recepción no ve facturas', recInv.ok && recInv.json.length === 0, err(recInv));
  const recSvc = await api.insert(rec.token, 'services', { org_id: A, name: 'Servicio de recepción', duration_minutes: 30 });
  check('Roles: recepción no crea servicios', recSvc.status === 403, err(recSvc));
  const recAdmin = await api.rpc(rec.token, 'invite_member', { p_org_id: A, p_email: 'x@kovo.test', p_role: 'psychologa' });
  check('Roles: recepción no puede invitar (escalada de privilegios)', !recAdmin.ok, err(recAdmin));
  const selfPromote = await api.patch(rec.token, `memberships?user_id=eq.${rec.id}`, { role: 'psychologa', is_admin: true });
  check('Roles: nadie se cambia el rol a sí mismo por REST', !selfPromote.ok || selfPromote.json.length === 0, err(selfPromote));
  const gesPatients = await api.get(ges.token, 'patients?select=id');
  check('Roles: gestoría no ve pacientes', gesPatients.ok && gesPatients.json.length === 0, err(gesPatients));
  const svc = await api.insert(ps2.token, 'services', { org_id: A, name: 'Terapia de pareja', duration_minutes: 80, price_cents: 9000 });
  check('Configuración: una psicóloga crea un servicio', svc.status === 201, err(svc));
  const rename = await api.patch(ps2.token, `organizations?id=eq.${A}`, { name: 'Cambio no autorizado' });
  check('Configuración: una psicóloga no administradora no cambia los datos de la clínica', rename.ok && rename.json.length === 0, err(rename));
  const rename2 = await api.patch(titA.token, `organizations?id=eq.${A}`, { name: 'Clínica Ficticia A (centro)', settings: { dueDays: 15 } });
  check('Configuración: la administradora cambia nombre y preferencias', rename2.ok && rename2.json[0]?.name === 'Clínica Ficticia A (centro)', err(rename2));
  const statusHack = await api.patch(titA.token, `organizations?id=eq.${A}`, { account_status: 'active', is_demo: true });
  check('Configuración: el estado de la cuenta no es editable por la clínica', !statusHack.ok, err(statusHack));
  const subHack = await api.patch(titA.token, `subscriptions?org_id=eq.${A}`, { plan_code: 'clinic', status: 'active' });
  check('Suscripción: la clínica no puede cambiarse el plan/estado por REST', !subHack.ok, err(subHack));

  // ---------------------------------------------------------------- RPC de la aplicación (horario, perfil propio)
  const myPro = await api.rpc(ps2.token, 'ensure_my_professional', { p_org_id: A, p_display_name: 'Psicóloga A2' });
  const myPro2 = await api.rpc(ps2.token, 'ensure_my_professional', { p_org_id: A });
  check('Perfil: una psicóloga crea su ficha profesional vinculada (idempotente)', myPro.ok && myPro2.ok && myPro.json === myPro2.json, err(myPro2));
  const recPro = await api.rpc(rec.token, 'ensure_my_professional', { p_org_id: A });
  check('Perfil: recepción no crea fichas profesionales', !recPro.ok, err(recPro));
  const week = [{ weekday: 1, start_minute: 540, end_minute: 840 }, { weekday: 1, start_minute: 960, end_minute: 1200 }, { weekday: 3, start_minute: 600, end_minute: 900 }];
  const setAv = await api.rpc(ps2.token, 'set_professional_availability', { p_org_id: A, p_professional_id: myPro.json, p_ranges: week });
  const avRows = await api.get(ps2.token, `professional_availability?select=weekday&professional_id=eq.${myPro.json}`);
  check('Horario: la profesional guarda su semana completa de una vez', setAv.ok && setAv.json === 3 && avRows.json.length === 3, err(setAv));
  const overlapAv = await api.rpc(ps2.token, 'set_professional_availability', { p_org_id: A, p_professional_id: myPro.json, p_ranges: [...week, { weekday: 1, start_minute: 800, end_minute: 900 }] });
  const avAfter = await api.get(ps2.token, `professional_availability?select=weekday&professional_id=eq.${myPro.json}`);
  check('Horario: franjas solapadas se rechazan y no se pierde lo guardado (atómico)', !overlapAv.ok && overlapAv.json?.code === '23P01' && avAfter.json.length === 3, err(overlapAv));
  const titPro = (await api.get(titA.token, `professionals?select=id&user_id=eq.${titA.id}`)).json[0]?.id;
  const otherAv = await api.rpc(ps2.token, 'set_professional_availability', { p_org_id: A, p_professional_id: titPro, p_ranges: [] });
  check('Horario: una psicóloga no administradora no cambia el horario de otra', !otherAv.ok, err(otherAv));
  const recAv = await api.rpc(rec.token, 'set_professional_availability', { p_org_id: A, p_professional_id: myPro.json, p_ranges: [] });
  check('Horario: recepción no cambia horarios', !recAv.ok, err(recAv));

  // ---------------------------------------------------------------- Interfaz v3: días cerrados, series
  const off = { org_id: A, professional_id: myPro.json, starts_at: '2026-12-24T00:00:00+01:00', ends_at: '2027-01-07T00:00:00+01:00', reason: 'Vacaciones sintéticas' };
  const offOk = await api.insert(ps2.token, 'professional_time_off', off);
  check('Días cerrados: la profesional añade sus vacaciones', offOk.status === 201 && offOk.json[0].reason === 'Vacaciones sintéticas', err(offOk));
  const offRec = await api.insert(rec.token, 'professional_time_off', { ...off, reason: 'x' });
  check('Días cerrados: recepción no los añade (RLS)', offRec.status === 403, err(offRec));
  const offOther = await api.insert(ps2.token, 'professional_time_off', { ...off, professional_id: titPro });
  check('Días cerrados: una psicóloga no administradora no cierra días de otra', offOther.status === 403, err(offOther));
  const offRead = await api.get(rec.token, `professional_time_off?select=id&org_id=eq.${A}`);
  const offLeak = await api.get(titB.token, `professional_time_off?select=id&org_id=eq.${A}`);
  check('Días cerrados: el equipo los ve; otra clínica no', offRead.json?.length === 1 && offLeak.ok && offLeak.json.length === 0, err(offLeak));
  const offDelRec = await api.del(rec.token, `professional_time_off?id=eq.${offOk.json[0].id}`);
  const offDel = await api.del(ps2.token, `professional_time_off?id=eq.${offOk.json[0].id}`);
  check('Días cerrados: recepción no los quita; la profesional sí', offDelRec.ok && offDelRec.json.length === 0 && offDel.ok && offDel.json.length === 1, err(offDel));

  const series = randomUUID();
  const weekly = k => ({ id: randomUUID(), org_id: A, patient_id: P1, professional_id: myPro.json, series_id: series, status: 'scheduled',
    starts_at: new Date(Date.parse('2027-02-01T10:00:00+01:00') + k * 7 * 864e5).toISOString(), ends_at: new Date(Date.parse('2027-02-01T10:50:00+01:00') + k * 7 * 864e5).toISOString() });
  const blocker = await api.insert(titA.token, 'appointments', { org_id: A, patient_id: P1, professional_id: myPro.json, status: 'scheduled', starts_at: '2027-02-15T10:30:00+01:00', ends_at: '2027-02-15T11:00:00+01:00' });
  const clash = await api.insert(rec.token, 'appointments', [0, 1, 2, 3].map(weekly));
  const none = await api.get(titA.token, `appointments?select=id&series_id=eq.${series}`);
  check('Series: si una fecha se solapa no se crea ninguna (inserción única, 23P01)', blocker.ok && !clash.ok && clash.json?.code === '23P01' && none.json.length === 0, err(clash));
  await api.del(titA.token, `appointments?id=eq.${blocker.json[0].id}`).then(r => r.ok || api.patch(titA.token, `appointments?id=eq.${blocker.json[0].id}`, { status: 'cancelled' }));
  const rows = [0, 1, 2, 3].map(weekly);
  const made = await api.insert(rec.token, 'appointments', rows);
  check('Series: recepción crea 4 citas semanales de una vez con su series_id', made.status === 201 && made.json.length === 4 && made.json.every(r => r.series_id === series), err(made));
  const retry = await api.insert(rec.token, 'appointments', rows);
  check('Series: repetir el alta (respuesta perdida) no duplica: clave primaria', retry.status === 409 && retry.json?.code === '23505', err(retry));
  const seriesB = await api.patch(titB.token, `appointments?series_id=eq.${series}`, { status: 'cancelled' });
  check('Series: otra clínica no cancela una serie ajena', seriesB.ok && seriesB.json.length === 0, err(seriesB));
  const cut = await api.patch(rec.token, `appointments?org_id=eq.${A}&series_id=eq.${series}&starts_at=gte.${encodeURIComponent(rows[2].starts_at)}&status=in.(scheduled,confirmed)`, { status: 'cancelled' });
  const left = await api.get(titA.token, `appointments?select=status&series_id=eq.${series}&order=starts_at.asc`);
  check('Series: «esta y las siguientes» cancela solo desde esa fecha', cut.ok && cut.json.length === 2 && left.json.map(r => r.status).join() === 'scheduled,scheduled,cancelled,cancelled', err(cut));

  // ---------------------------------------------------------------- Interfaz v3: diagnósticos y pruebas (datos clínicos)
  const P8 = p8.json[0].id;
  const tst = await api.insert(titA.token, 'patient_tests', { org_id: A, patient_id: P1, name: 'Inventario sintético', test_date: '2026-10-01', result: '24 puntos (ficticio)' });
  check('Clínico: la psicóloga registra una prueba', tst.status === 201 && tst.json[0].created_by === titA.id, err(tst));
  const TST = tst.json[0].id;
  const tstRec = await api.insert(rec.token, 'patient_tests', { org_id: A, patient_id: P1, name: 'x', test_date: '2026-10-01' });
  const seeRec = await api.get(rec.token, `patient_tests?select=id&org_id=eq.${A}`);
  const seeGes = await api.get(ges.token, `patient_diagnoses?select=id&org_id=eq.${A}`);
  const seeB = await api.get(titB.token, `patient_tests?select=id&id=eq.${TST}`);
  check('Clínico: recepción no registra pruebas; recepción, gestoría y otra clínica no ven nada', tstRec.status === 403 && seeRec.json.length === 0 && seeGes.json.length === 0 && seeB.json.length === 0, err(tstRec));
  const dx = await api.insert(titA.token, 'patient_diagnoses', { org_id: A, patient_id: P1, title: 'Diagnóstico sintético', diagnosis_date: '2026-10-02', rationale: 'Texto ficticio', test_ids: [TST], author_name: 'Titular A' });
  check('Clínico: diagnóstico con la prueba en la que se basa', dx.status === 201 && dx.json[0].test_ids[0] === TST, err(dx));
  const dxWrong = await api.insert(titA.token, 'patient_diagnoses', { org_id: A, patient_id: P8, title: 'X', diagnosis_date: '2026-10-02', test_ids: [TST] });
  check('Clínico: no se puede citar la prueba de otro paciente (KC003)', !dxWrong.ok && dxWrong.json?.code === 'KC003', err(dxWrong));
  const dxDel = await api.del(titA.token, `patient_diagnoses?id=eq.${dx.json[0].id}`);
  const dxStill = await api.get(titA.token, `patient_diagnoses?select=id&id=eq.${dx.json[0].id}`);
  check('Clínico: un diagnóstico no se borra físicamente', !(dxDel.ok && dxDel.json?.length) && dxStill.json.length === 1, err(dxDel));
  const dxRet = await api.patch(titA.token, `patient_diagnoses?id=eq.${dx.json[0].id}`, { retired_at: new Date().toISOString() });
  const dxAfter = await api.patch(titA.token, `patient_diagnoses?id=eq.${dx.json[0].id}`, { title: 'Cambio' });
  check('Clínico: se retira y, retirado, ya no se modifica (KC002)', dxRet.ok && dxRet.json.length === 1 && !dxAfter.ok && dxAfter.json?.code === 'KC002', err(dxAfter));
  const dxAudit = await api.get(titA.token, `audit_log?select=action,metadata&entity_type=eq.patient_diagnoses&entity_id=eq.${dx.json[0].id}&order=created_at.asc`);
  check('Clínico: auditado con nombres de campo, sin contenido', dxAudit.json?.length === 2 && JSON.stringify(dxAudit.json[1].metadata.changed) === '["retired_at"]' && !JSON.stringify(dxAudit.json).includes('sintético'), err(dxAudit));

  // ---------------------------------------------------------------- Interfaz v3: gastos fijos
  const madridToday = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const monthBack = k => { const [y, m] = madridToday.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 - k, 1)); return d.toISOString().slice(0, 10); };
  const fx = await api.insert(titA.token, 'recurring_expenses', { org_id: A, name: 'Alquiler sintético', category: 'Alquiler', day_of_month: 1, base_cents: 10000, vat_pct: 21, retention_pct: 0, since_month: monthBack(2) });
  check('Gastos fijos: la psicóloga configura uno', fx.status === 201, err(fx));
  const fxGes = await api.insert(ges.token, 'recurring_expenses', { org_id: A, name: 'x', category: 'Otros', day_of_month: 1, base_cents: 1 });
  const fxGesRead = await api.get(ges.token, `recurring_expenses?select=id&org_id=eq.${A}`);
  const fxRec = await api.get(rec.token, `recurring_expenses?select=id&org_id=eq.${A}`);
  check('Gastos fijos: gestoría los ve pero no los cambia; recepción no los ve', fxGes.status === 403 && fxGesRead.json.length === 1 && fxRec.json.length === 0, err(fxGes));
  const ap1 = await api.rpc(titA.token, 'apply_recurring_expenses', { p_org_id: A });
  const ap2 = await api.rpc(ges.token, 'apply_recurring_expenses', { p_org_id: A });
  const gen = await api.get(titA.token, `expenses?select=id,amount_cents,recurring_month&recurring_id=eq.${fx.json[0].id}&order=recurring_month.asc`);
  check('Gastos fijos: se apuntan los 3 meses debidos (base + IVA) y repetirlo no duplica', ap1.json === 3 && ap2.json === 0 && gen.json.length === 3 && gen.json.every(e => e.amount_cents === 12100), err(gen));
  const [both1, both2] = await Promise.all([api.rpc(titA.token, 'apply_recurring_expenses', { p_org_id: A }), api.rpc(ges.token, 'apply_recurring_expenses', { p_org_id: A })]);
  // La clínica no puede borrar gastos (sin GRANT DELETE en el baseline); se borra con la clave de
  // servicio para comprobar que, si un mes generado desaparece, no se vuelve a crear.
  const delOwn = await api.del(titA.token, `expenses?id=eq.${gen.json[1].id}`);
  check('Gastos: la clínica no borra gastos (sin permiso de borrado en la BD)', !delOwn.ok, err(delOwn));
  const delGen = await api.call(`/rest/v1/expenses?id=eq.${gen.json[1].id}`, { method: 'DELETE', token: api.service, headers: { apikey: api.service, prefer: 'return=representation' } });
  const ap3 = await api.rpc(titA.token, 'apply_recurring_expenses', { p_org_id: A });
  const gen2 = await api.get(titA.token, `expenses?select=id&recurring_id=eq.${fx.json[0].id}`);
  check('Gastos fijos: un mes borrado no vuelve a crearse; llamadas simultáneas no duplican', both1.json === 0 && both2.json === 0 && ap3.json === 0 && gen2.json.length === 2, [err(delGen), err(gen2), err(both1), err(both2)].join(' | '));
  const apRec = await api.rpc(rec.token, 'apply_recurring_expenses', { p_org_id: A });
  const apB = await api.rpc(titB.token, 'apply_recurring_expenses', { p_org_id: A });
  check('Gastos fijos: recepción y otra clínica no pueden apuntarlos', !apRec.ok && !apB.ok, err(apB));

  // ---------------------------------------------------------------- Interfaz v3: rol «solo calendario»
  const invAg = await api.rpc(titA.token, 'invite_member', { p_org_id: A, p_email: 'agenda-a@kovo.test', p_role: 'agenda' });
  const ag = await newUser(api, 'agenda-a@kovo.test');
  const accAg = await api.rpc(ag.token, 'accept_invitation', { p_token: invAg.json?.token });
  check('Agenda: se invita y se acepta el rol «solo calendario»', invAg.ok && accAg.ok && accAg.json.role === 'agenda', err(accAg));
  const cal = await api.rpc(ag.token, 'agenda_calendar', { p_org_id: A, p_from: '2027-02-01', p_to: '2027-03-01' });
  check('Agenda: ve las citas con el código del paciente', cal.ok && cal.json.length >= 4 && cal.json.every(r => /^P-\d{5}$/.test(r.patient_code)), err(cal));
  check('Agenda: sin nombres, contacto ni notas en la respuesta', cal.ok && !JSON.stringify(cal.json).includes('Sintético') && cal.json.every(r => !('first_name' in r) && !('administrative_note' in r)), JSON.stringify(cal.json?.[0]));
  const agReads = await Promise.all(['patients', 'appointments', 'clinical_notes', 'patient_tests', 'invoices', 'expenses', 'patient_documents'].map(t => api.get(ag.token, `${t}?select=id&org_id=eq.${A}`)));
  check('Agenda: no lee pacientes, citas, notas, pruebas, facturas, gastos ni documentos', agReads.every(r => r.ok ? r.json.length === 0 : true), agReads.map(err).join(' | '));
  const agWrite = await api.insert(ag.token, 'appointments', { org_id: A, patient_id: P1, starts_at: '2027-05-01T10:00:00+02:00', ends_at: '2027-05-01T10:50:00+02:00' });
  check('Agenda: no crea citas', agWrite.status === 403, err(agWrite));
  const calGes = await api.rpc(ges.token, 'agenda_calendar', { p_org_id: A, p_from: '2027-02-01', p_to: '2027-03-01' });
  const calB = await api.rpc(titB.token, 'agenda_calendar', { p_org_id: A, p_from: '2027-02-01', p_to: '2027-03-01' });
  check('Agenda: gestoría y otra clínica no consultan el calendario', !calGes.ok && !calB.ok, err(calB));
  await api.rpc(titA.token, 'update_membership', { p_membership_id: accAg.json.membership_id ?? accAg.json.id, p_active: false });

  // ---------------------------------------------------------------- Storage (real Supabase Storage)
  const docName = `${randomUUID()}-consentimiento.pdf`;
  const docPath = `${A}/${P1}/${docName}`;
  const pdf = minimalPdf('A1');
  const up = await api.upload(titA.token, docPath, pdf, 'application/pdf');
  check('Documentos: la psicóloga sube un PDF al bucket privado', up.ok, err(up));
  const row = await api.insert(titA.token, 'patient_documents', { org_id: A, patient_id: P1, storage_path: docPath, document_type: 'consentimiento', file_name: 'consentimiento.pdf', mime_type: 'application/pdf', size_bytes: pdf.length });
  check('Documentos: se registra el documento del paciente', row.status === 201 && row.json[0].uploaded_by === titA.id, err(row));
  const dl = await api.download(titA.token, docPath);
  const bytes = dl.ok ? new Uint8Array(await dl.arrayBuffer()) : null;
  check('Documentos: la psicóloga lo descarga íntegro', dl.ok && bytes.length === pdf.length && bytes.every((b, i) => b === pdf[i]), `${dl.status}`);
  const dlRec = await api.download(rec.token, docPath);
  check('Documentos: recepción no puede descargarlo', !dlRec.ok, `${dlRec.status}`);
  const dlB = await api.download(titB.token, docPath);
  check('Documentos: otra clínica no puede descargarlo', !dlB.ok, `${dlB.status}`);
  const dlAnon = await fetch(`${stack.url}/storage/v1/object/public/kovo-patient-documents/${docPath}`);
  check('Documentos: el bucket no es público', !dlAnon.ok, `${dlAnon.status}`);
  const upCross = await api.upload(titA.token, `${B}/${PB}/${randomUUID()}-x.pdf`, pdf, 'application/pdf');
  check('Documentos: no se sube a la carpeta de otra clínica', !upCross.ok, err(upCross));
  const upFake = await api.upload(titA.token, `${A}/${randomUUID()}/${randomUUID()}-x.pdf`, pdf, 'application/pdf');
  check('Documentos: no se sube a un paciente inexistente (ruta manipulada)', !upFake.ok, err(upFake));
  const upExe = await api.upload(titA.token, `${A}/${P1}/${randomUUID()}-x.exe`, pdf, 'application/x-msdownload');
  check('Documentos: tipos no permitidos rechazados por Storage', !upExe.ok, err(upExe));
  const big = new Uint8Array(21 * 1024 * 1024); big.set(pdf);
  const upBig = await api.upload(titA.token, `${A}/${P1}/${randomUUID()}-grande.pdf`, big, 'application/pdf');
  check('Documentos: más de 20 MB rechazado por Storage', !upBig.ok, err(upBig));
  const overwrite = await api.upload(titA.token, docPath, minimalPdf('otro'), 'application/pdf', true);
  check('Documentos: un documento no se sobrescribe', !overwrite.ok, err(overwrite));
  await api.removeObject(titA.token, docPath);
  const still = await api.download(titA.token, docPath);
  check('Documentos: la app no puede borrar el objeto (conservación)', still.ok, `${still.status}`);
  const upRec = await api.upload(rec.token, `${A}/${P1}/${randomUUID()}-r.pdf`, pdf, 'application/pdf');
  check('Documentos: recepción no sube documentos clínicos', !upRec.ok, err(upRec));

  // ---------------------------------------------------------------- Sessions and tokens
  const second = await api.signIn(titA.email, titA.password);
  check('Sesiones: inicio de sesión con contraseña', second.ok && second.json.access_token, err(second));
  const out = await api.logout(titA.token);
  check('Sesiones: cierre de sesión', out.status === 204, err(out));
  const afterOut = await api.get(titA.token, 'patients?select=id');
  check('Sesiones: tras cerrar sesión el token anterior deja de dar acceso a datos al instante', afterOut.ok ? afterOut.json.length === 0 : true, err(afterOut));
  const afterOutRpc = await api.rpc(titA.token, 'list_team', { p_org_id: A });
  check('Sesiones: …y tampoco a las RPC', !afterOutRpc.ok, err(afterOutRpc));
  const oldRefresh = await api.refresh(titA.refresh);
  check('Sesiones: el refresh token de la sesión cerrada no sirve', !oldRefresh.ok, err(oldRefresh));
  titA.token = second.json.access_token; titA.refresh = second.json.refresh_token;
  const stillIn = await api.get(titA.token, 'patients?select=id');
  check('Sesiones: la otra sesión sigue activa', stillIn.ok && stillIn.json.length === 3, err(stillIn));
  const rot = await api.refresh(titA.refresh);
  check('Sesiones: renovación del token (rotación)', rot.ok && rot.json.refresh_token !== titA.refresh, err(rot));
  const rot2 = await api.refresh(rot.json.refresh_token);
  // Reuse detection: once the next token in the chain has been used, presenting an older one is
  // treated as theft and the whole session is revoked (Supabase Auth behaviour).
  const reuse = await api.refresh(titA.refresh);
  check('Sesiones: reutilizar un refresh token antiguo se rechaza', !reuse.ok, err(reuse));
  const afterTheft = await api.refresh(rot2.json.refresh_token);
  check('Sesiones: …y revoca la sesión entera (detección de robo)', !afterTheft.ok, err(afterTheft));
  const fresh = await api.signIn(titA.email, titA.password);
  titA.token = fresh.json.access_token; titA.refresh = fresh.json.refresh_token;
  const expired = api.forge({ sub: titA.id, exp: Math.floor(Date.now() / 1000) - 60 });
  const exp = await api.get(expired, 'patients?select=id');
  check('Tokens: un JWT caducado se rechaza (401)', exp.status === 401, err(exp));
  const wrongSig = await api.get(api.forgeWrongSecret({ sub: titA.id }), 'patients?select=id');
  check('Tokens: un JWT firmado con otro secreto se rechaza (401)', wrongSig.status === 401, err(wrongSig));
  const anonRead = await api.get(undefined, 'patients?select=id');
  check('Tokens: la clave pública sin sesión no lee datos', !anonRead.ok || anonRead.json.length === 0, err(anonRead));
  const roleHack = await api.get(api.forge({ sub: titA.id, role: 'service_role', session_id: randomUUID() }).replace(/\..*$/, '') + '.x', 'patients');
  check('Tokens: un JWT manipulado se rechaza', roleHack.status === 401, err(roleHack));

  // ---------------------------------------------------------------- Billing to patients (gestoría)
  await api.insert(titA.token, 'organization_billing_profiles', { org_id: A, legal_name: 'Clínica Ficticia A SL', tax_id: 'B00000000', address_line: 'Calle Ficticia 1', postal_code: '29001', city: 'Málaga' });
  await api.insert(ges.token, 'patient_billing_profiles', { org_id: A, patient_id: P1, legal_name: 'Paciente Sintético Uno', address_line: 'Calle Inventada 2' });
  const draft = await api.rpc(ges.token, 'save_invoice_draft', { p_org_id: A, p_patient_id: P1, p_issue_date: '2026-11-10', p_due_date: null,
    p_lines: [{ description: 'Sesión individual', quantity: 1, unit_price_cents: 6000, tax_rate: 0 }] });
  check('Facturación: gestoría crea un borrador', draft.ok, err(draft));
  const upd = await api.rpc(ges.token, 'update_invoice_draft', { p_invoice_id: draft.json, p_lines: [{ description: 'Sesión individual', quantity: 1, unit_price_cents: 6000, tax_rate: 0 }, { description: 'Informe', quantity: 1, unit_price_cents: 1000, tax_rate: 21 }] });
  const updRow = await api.get(ges.token, `invoices?select=subtotal_cents,tax_cents,total_cents&id=eq.${draft.json}`);
  check('Facturación: editar el borrador recalcula los totales en el servidor', upd.ok && updRow.json[0]?.subtotal_cents === 7000 && updRow.json[0]?.tax_cents === 210 && updRow.json[0]?.total_cents === 7210, err(updRow));
  const back = await api.rpc(ges.token, 'update_invoice_draft', { p_invoice_id: draft.json, p_lines: [{ description: 'Sesión individual', quantity: 1, unit_price_cents: 6000, tax_rate: 0 }] });
  check('Facturación: el borrador vuelve a una línea', back.ok, err(back));
  const direct = await api.insert(ges.token, 'invoices', { org_id: A, patient_id: P1, status: 'issued', invoice_number: 'FALSA-1' });
  check('Facturación: no se puede crear una factura ya emitida por REST', !direct.ok, err(direct));
  const emitted = await api.rpc(ges.token, 'emit_invoice', { p_invoice: draft.json });
  check('Facturación: emisión con número y datos fiscales congelados', emitted.ok && /^KOVO-2026-\d{6}$/.test(emitted.json.invoice_number) && emitted.json.recipient_snapshot, err(emitted));
  const edit = await api.patch(ges.token, `invoices?id=eq.${draft.json}`, { total_cents: 1 });
  check('Facturación: una factura emitida es inmutable', !edit.ok, err(edit));
  const pay = await api.rpc(ges.token, 'record_invoice_payment', { p_invoice_id: draft.json, p_amount_cents: 6000, p_method: 'bizum' });
  check('Facturación: cobro registrado y factura cobrada', pay.ok && pay.json.status === 'paid', err(pay));
  const recPay = await api.rpc(rec.token, 'record_invoice_payment', { p_invoice_id: draft.json, p_amount_cents: 1, p_method: 'bizum' });
  check('Facturación: recepción no registra cobros', !recPay.ok, err(recPay));
  const updIssued = await api.rpc(ges.token, 'update_invoice_draft', { p_invoice_id: draft.json, p_lines: [{ description: 'x', quantity: 1, unit_price_cents: 1, tax_rate: 0 }] });
  check('Facturación: una factura emitida no se edita como borrador (KB003)', !updIssued.ok && updIssued.json?.code === 'KB003', err(updIssued));

  // ---------------------------------------------------------------- KOVO staff (platform)
  const staffUser = await stack.createUser('staff@kovo.test', 'Prueba-sintetica-2026');
  const addStaff = await api.call('/rest/v1/platform_admins', { method: 'POST', token: api.service, body: { user_id: staffUser.id, note: 'pruebas' }, headers: { apikey: api.service } });
  check('Plataforma: el operador da de alta personal de KOVO (servidor, service role)', addStaff.status === 201, err(addStaff));
  const selfStaff = await api.insert(titB.token, 'platform_admins', { user_id: titB.id });
  check('Plataforma: una clínica no puede hacerse personal de KOVO', !selfStaff.ok, err(selfStaff));
  const staff = (await api.signIn('staff@kovo.test', 'Prueba-sintetica-2026')).json.access_token;
  const orgs = await api.rpc(staff, 'platform_list_organizations');
  check('Plataforma: el personal ve todas las clínicas (solo datos de cuenta)', orgs.ok && orgs.json.length === 2 && orgs.json.every(o => !('first_name' in o)), err(orgs));
  const staffPatients = await api.get(staff, 'patients?select=id');
  check('Plataforma: el personal de KOVO no ve pacientes', staffPatients.ok && staffPatients.json.length === 0, err(staffPatients));
  const clinicStaff = await api.rpc(titA.token, 'platform_list_organizations');
  check('Plataforma: una administradora de clínica no accede al panel de KOVO', !clinicStaff.ok, err(clinicStaff));
  const susp = await api.rpc(staff, 'platform_set_account_status', { p_org_id: B, p_status: 'suspended', p_reason: 'Prueba HTTP de suspensión' });
  check('Plataforma: suspensión de una clínica', susp.ok, err(susp));
  const bWrite = await api.insert(titB.token, 'patients', { org_id: B, patient_code: 'AUTO', first_name: 'X', last_name: 'Y' });
  check('Cuenta suspendida: la base de datos rechaza escrituras (KS001)', !bWrite.ok && bWrite.json?.code === 'KS001', err(bWrite));
  const bRead = await api.get(titB.token, 'patients?select=id');
  check('Cuenta suspendida: los datos siguen legibles para exportarlos', bRead.ok && bRead.json.length === 1, err(bRead));
  const bUpload = await api.upload(titB.token, `${B}/${PB}/${randomUUID()}-x.pdf`, pdf, 'application/pdf');
  check('Cuenta suspendida: tampoco se suben documentos', !bUpload.ok, err(bUpload));
  const ticket = await api.insert(titB.token, 'support_tickets', { org_id: B, subject: 'Cuenta suspendida', body: 'Mensaje sintético de prueba' });
  check('Soporte: una clínica suspendida puede abrir un ticket', ticket.status === 201, err(ticket));
  const react = await api.rpc(staff, 'platform_set_account_status', { p_org_id: B, p_status: 'active', p_reason: 'Fin de la prueba HTTP' });
  check('Plataforma: reactivación', react.ok, err(react));

  // ---------------------------------------------------------------- Payment provider webhook (server only)
  const evt = { org_id: B, plan_code: 'professional', status: 'active', provider_subscription_id: 'sub_sintetico_1' };
  const fromBrowser = await api.rpc(titB.token, 'apply_billing_event', { p_provider: 'stripe', p_event_id: 'evt_x', p_event_type: 'x', p_payload: evt });
  check('Pasarela: el navegador no puede inyectar eventos de pago', !fromBrowser.ok, err(fromBrowser));
  const fromServer = await api.call('/rest/v1/rpc/apply_billing_event', { method: 'POST', token: api.service, headers: { apikey: api.service },
    body: { p_provider: 'stripe', p_event_id: 'evt_sintetico_1', p_event_type: 'customer.subscription.updated', p_payload: evt } });
  check('Pasarela: el servidor (service role) registra el evento', fromServer.ok && fromServer.json === 'processed', err(fromServer));
  const redelivery = await api.call('/rest/v1/rpc/apply_billing_event', { method: 'POST', token: api.service, headers: { apikey: api.service },
    body: { p_provider: 'stripe', p_event_id: 'evt_sintetico_1', p_event_type: 'customer.subscription.updated', p_payload: evt } });
  check('Pasarela: los reenvíos del proveedor son idempotentes', redelivery.json === 'duplicate', err(redelivery));
  const subB = await api.get(titB.token, 'subscriptions?select=plan_code,status');
  check('Pasarela: la suscripción de la clínica refleja el evento', subB.ok && subB.json[0]?.plan_code === 'professional' && subB.json[0]?.status === 'active', err(subB));

  // Manejador del webhook (supabase/functions/billing-webhook/core.js) contra la RPC real con la clave de servicio.
  {
  const SECRET = 'secreto-sintetico-de-pruebas';
  const rpcSvc = async (fn, args) => (await api.call(`/rest/v1/rpc/${fn}`, { method: 'POST', token: api.service, headers: { apikey: api.service }, body: args })).json;
  const deliver = async (event, { secret = SECRET, t = Math.floor(Date.now() / 1000) } = {}) => {
    const body = JSON.stringify(event);
    const sig = `t=${t},v1=${await hmacHex(secret, `${t}.${body}`)}`;
    const req = new Request('http://local/billing-webhook', { method: 'POST', body, headers: { 'x-kovo-signature': sig } });
    return handleWebhook(req, { secret: SECRET, provider: 'pruebas', rpc: rpcSvc });
  };
  const unpaid = { id: 'evt_sintetico_2', type: 'customer.subscription.updated', data: { object: { id: 'sub_sintetico_1', customer: 'cus_sintetico', status: 'unpaid', metadata: { org_id: B, plan_code: 'professional' } } } };
  const whForged = await deliver(unpaid, { secret: 'otro-secreto' });
  check('Webhook: firma falsa rechazada (400) sin tocar la suscripción', whForged.status === 400, JSON.stringify(whForged));
  const stale = await deliver(unpaid, { t: Math.floor(Date.now() / 1000) - 3600 });
  check('Webhook: evento firmado hace una hora rechazado (repetición)', stale.status === 400, JSON.stringify(stale));
  const ok1 = await deliver(unpaid);
  const accB = (await api.call(`/rest/v1/organizations?select=account_status,status_reason&id=eq.${B}`, { token: api.service, headers: { apikey: api.service } })).json[0];
  check('Webhook: impago → suscripción impagada y cuenta suspendida por facturación', ok1.status === 200 && ok1.body.result === 'processed' && accB.account_status === 'suspended' && accB.status_reason === 'billing:unpaid', JSON.stringify([ok1, accB]));
  const dup = await deliver(unpaid);
  check('Webhook: reenvío del mismo evento → duplicado, sin efectos', dup.body.result === 'duplicate', JSON.stringify(dup));
  const paid = await deliver({ ...unpaid, id: 'evt_sintetico_3', data: { object: { ...unpaid.data.object, status: 'active' } } });
  const accB2 = (await api.call(`/rest/v1/organizations?select=account_status&id=eq.${B}`, { token: api.service, headers: { apikey: api.service } })).json[0];
  check('Webhook: pago al día → cuenta reactivada', paid.body.result === 'processed' && accB2.account_status === 'active', JSON.stringify([paid, accB2]));
  const ignored = await deliver({ id: 'evt_sintetico_4', type: 'invoice.created', data: { object: {} } });
  check('Webhook: eventos que no son de suscripción se ignoran', ignored.status === 200 && ignored.body.result === 'ignored', JSON.stringify(ignored));
  }

  return s;
}
