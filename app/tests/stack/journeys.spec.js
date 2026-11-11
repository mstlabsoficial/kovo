// Recorridos completos en el navegador contra la pila Supabase LOCAL real (db/run.mjs --e2e):
// alta de cuenta y clínica, operación diaria sin modo demo, equipo e invitaciones, roles, varias
// clínicas a la vez, cuenta suspendida, sesión caducada o revocada, cortes de red, documentos en
// Storage privado, facturación y panel de KOVO. Datos 100 % sintéticos (@kovo.test).
import { test, expect } from '@playwright/test';
import { act, click, fill } from '../supabase/helpers.js';

const BASE = process.env.KOVO_STACK_URL, ANON = process.env.KOVO_STACK_ANON, SERVICE = process.env.KOVO_STACK_SERVICE;
test.skip(!BASE || !ANON || !SERVICE, 'Solo con node db/run.mjs --e2e (pila Supabase local)');
test.describe.configure({ mode: 'serial' });

const PW = 'Prueba-sintetica-2026';
const run = Date.now().toString(36);
const mail = tag => `${tag}-${run}@kovo.test`;

async function api(path, { method = 'GET', token = SERVICE, body, headers = {} } = {}) {
  const r = await fetch(`${BASE}${path}`, { method, headers: { apikey: token === SERVICE ? SERVICE : ANON, authorization: `Bearer ${token}`, 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: r.status, ok: r.ok, json };
}
const svc = (path, o) => api(`/rest/v1/${path}`, o);
async function createUser(email, name = 'Persona Sintética') {
  const r = await api('/auth/v1/admin/users', { method: 'POST', body: { email, password: PW, email_confirm: true, user_metadata: { full_name: name } } });
  if (!r.ok) throw new Error(`usuario ${email}: ${r.status} ${JSON.stringify(r.json)}`);
  return r.json;
}
async function tokenFor(email) {
  const r = await api('/auth/v1/token?grant_type=password', { method: 'POST', token: ANON, body: { email, password: PW } });
  if (!r.ok) throw new Error(`login ${email}: ${r.status}`);
  return r.json.access_token;
}
async function clinicFor(email, name, plan = 'professional') {
  await createUser(email, `Titular ${name}`);
  const t = await tokenFor(email);
  const r = await api('/rest/v1/rpc/create_organization', { method: 'POST', token: t, body: { p_name: name, p_plan_code: plan } });
  if (!r.ok) throw new Error(`clínica ${name}: ${r.status} ${JSON.stringify(r.json)}`);
  return { id: r.json, token: t };
}
const waitApp = page => page.waitForFunction(() => { const v = document.getElementById('view'); return !document.querySelector('.gate') && v && v.children.length > 0 && !v.querySelector('.sk'); }, null, { timeout: 30_000 });
async function login(page, email, { expectApp = true } = {}) {
  await page.goto('/');
  await page.locator('.gate form[data-f="login"]').waitFor();
  await page.fill('.gate input[name="email"]', email);
  await page.fill('.gate input[name="password"]', PW);
  await page.click('.gate button[type="submit"]');
  if (expectApp) await waitApp(page);
}
const toast = page => page.locator('#toast');
const tab = async (page, t) => { await act(page, 'go', { v: 'config' }); await act(page, 'ctab', { t }); };
function nextWeekday(dow) {   // 1 = lunes … 5 = viernes, al menos 7 días en el futuro (hora de Madrid)
  const d = new Date(Date.now() + 7 * 864e5);
  while (((d.getDay() + 6) % 7) + 1 !== dow) d.setDate(d.getDate() + 1);
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
}
const pdf = label => Buffer.from(`%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n% ${label}\ntrailer<</Root 1 0 R>>\n%%EOF\n`);

test('alta: cuenta nueva → clínica → paciente, cita, ajustes, horario, documento, factura, cobro y gasto (sin modo demo)', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const email = mail('alta');
  await page.goto('/');
  await page.click('.gate [data-mode="signup"]');
  await page.fill('.gate input[name="name"]', 'Titular Sintética Alta');
  await page.fill('.gate input[name="email"]', email);
  await page.fill('.gate input[name="password"]', 'corta');
  await page.click('.gate button[type="submit"]');
  await expect(page.locator('.gate [data-msg]')).toContainText('al menos 10 caracteres');
  await page.fill('.gate input[name="password"]', PW);
  await page.click('.gate button[type="submit"]');
  // Alta de la clínica (onboarding) con plan y prueba gratuita
  await page.locator('.gate form[data-f="org"]').waitFor();
  await expect(page.locator('.gate .plan')).toHaveCount(3);
  await page.fill('.gate input[name="name"]', 'Clínica Sintética Alta');
  await page.check('.gate input[name="plan"][value="professional"]');
  await page.click('.gate button[type="submit"]');
  await waitApp(page);
  await expect(page.locator('.sidefoot .cn-org')).toContainText('Clínica Sintética Alta');
  await expect(page.locator('.sidefoot .cn-org')).toContainText('Plan Professional');
  await expect(page.locator('#cn-banner')).toContainText('Periodo de prueba');
  await expect(page.locator('#role3')).toHaveCount(0);
  await expect(page.locator('.sidefoot .role')).toBeHidden();
  const t = await tokenFor(email);
  const org = (await api('/rest/v1/rpc/my_organizations', { method: 'POST', token: t, body: {} })).json[0];
  expect(org).toMatchObject({ role: 'psychologa', is_admin: true, plan_code: 'professional', subscription_status: 'trialing' });

  // Paciente: el código lo asigna el servidor
  await act(page, 'newPatient');
  await fill(page, { 'np-n': 'Paciente Sintética Uno', 'np-e': 'paciente1@correo-ejemplo.test', 'np-t': '600000001', 'np-addr': 'Calle Inventada 1, 29001 Málaga' });
  await click(page, '.mod [data-act="savePatient"]');
  await expect(toast(page)).toContainText('Paciente P-00001 creado');
  const patient = (await svc(`patients?select=id,patient_code&org_id=eq.${org.org_id}`)).json[0];
  expect(patient.patient_code).toBe('P-00001');

  // Cita
  const day = nextWeekday(2);
  await act(page, 'newAppt');
  await fill(page, { 'f-p': patient.id, 'f-d': day, 'f-t': '10:00', 'f-dur': '50', 'f-l': 'Despacho' });
  await click(page, '.mod [data-act="saveAppt"]');
  await expect(toast(page)).toContainText('Cita creada');
  expect((await svc(`appointments?select=id&org_id=eq.${org.org_id}`)).json).toHaveLength(1);

  // Ajustes › Clínica: datos fiscales (emisor de las facturas)
  await tab(page, 'clinica');
  await page.locator('#bp-legal').waitFor();
  await fill(page, { 'bp-legal': 'Clínica Sintética Alta SL', 'bp-tax': 'B00000001', 'bp-addr': 'Calle Ficticia 2', 'bp-cp': '29001', 'bp-city': 'Málaga' });
  await click(page, '[data-act="cnSaveBilling"]');
  await expect(toast(page)).toContainText('Datos fiscales guardados');

  // Servicios, preferencias y horario se guardan en el servidor
  await tab(page, 'servicios');
  await click(page, '[data-act="addSvc"]');
  await expect(toast(page)).toContainText('Servicio añadido');
  expect((await svc(`services?select=id&org_id=eq.${org.org_id}`)).json).toHaveLength(2);
  await tab(page, 'auto');
  await page.fill('#dueDays', '30'); await page.dispatchEvent('#dueDays', 'change');
  await expect(toast(page)).toContainText('Vencimiento actualizado');
  expect((await svc(`organizations?select=settings&id=eq.${org.org_id}`)).json[0].settings.dueDays).toBe(30);
  await tab(page, 'horario');
  await expect(page.locator('#view')).toContainText('todavía no está guardado');
  await click(page, '[data-act="addRange"][data-d="5"]');
  await expect(toast(page)).toContainText('Franja añadida');
  const av = (await svc(`professional_availability?select=weekday&org_id=eq.${org.org_id}`)).json;
  expect(av.filter(r => r.weekday === 6)).toHaveLength(1);
  expect(av.length).toBeGreaterThan(5);

  // Documento en Storage privado: subir, abrir y retirar
  await act(page, 'openPatient', { id: patient.id });
  await act(page, 'ptab', { t: 'docs' });
  await page.setInputFiles('input[data-up="doc"]', { name: 'informe-sintetico.pdf', mimeType: 'application/pdf', buffer: pdf('alta') });
  await expect(toast(page)).toContainText('almacenamiento privado');
  await expect(page.locator('#view')).toContainText('informe-sintetico.pdf');
  // Abrir: el navegador descarga el objeto de Storage con la sesión de la usuaria (RLS de storage.objects)
  // y lo muestra desde memoria. (Chromium sin interfaz no tiene visor de PDF: se comprueba la descarga.)
  const [got] = await Promise.all([page.waitForResponse(r => r.url().includes('/storage/v1/object/authenticated/kovo-patient-documents/')), click(page, '[data-act="cnOpenDoc"]')]);
  expect(got.status()).toBe(200);
  expect((await got.body()).toString()).toContain('% alta');
  for (const pg of page.context().pages()) if (pg !== page) await pg.close();
  await page.setInputFiles('input[data-up="doc"]', { name: 'texto.txt', mimeType: 'text/plain', buffer: Buffer.from('no') });
  await expect(toast(page)).toContainText('Solo se admiten PDF, JPEG o PNG');
  await click(page, '[data-act="cnWithdrawDoc"]');
  await click(page, '[data-act="cnWithdrawDoc"]');
  await expect(toast(page)).toContainText('Documento retirado');
  const docs = (await svc(`patient_documents?select=deleted_at&org_id=eq.${org.org_id}`)).json;
  expect(docs).toHaveLength(1); expect(docs[0].deleted_at).not.toBeNull();

  // Factura: borrador → emitir (número del servidor) → cobro
  await act(page, 'go', { v: 'contabilidad' });
  await click(page, '[data-act="newInvoice"]');
  await fill(page, { 'ni-p': patient.id, 'ni-d': 'Sesión individual', 'ni-a': '60', 'ni-x': '1' });
  await click(page, '.mod [data-act="saveNewInv"]');
  await expect(toast(page)).toContainText('Borrador de factura creado');
  await click(page, '.mod [data-act="emitInv"]');
  await expect(toast(page)).toContainText(/Factura KOVO-\d{4}-000001 emitida/);
  const inv = (await svc(`invoices?select=id,status,invoice_number,total_cents,recipient_snapshot&org_id=eq.${org.org_id}`)).json[0];
  expect(inv).toMatchObject({ status: 'issued', total_cents: 6000 });
  expect(inv.recipient_snapshot.legal_name).toBe('Paciente Sintética Uno');
  await act(page, 'openInv', { id: inv.id });
  await expect(page.locator('.mod')).toContainText('Clínica Sintética Alta SL');
  await fill(page, { 'pay-a': '60', 'pay-m': 'Bizum' });
  await click(page, '.mod [data-act="payInv"]');
  await expect(toast(page)).toContainText('Factura cobrada');
  expect((await svc(`invoices?select=status&id=eq.${inv.id}`)).json[0].status).toBe('paid');
  // Lo que no tiene servidor se explica, no se simula
  await act(page, 'sendInv', { id: inv.id });
  await expect(toast(page)).toContainText('proveedor de correo');
  await act(page, 'rectInv', { id: inv.id });
  await expect(toast(page)).toContainText('rectificativas');

  // Gasto
  await act(page, 'cnNewExp');
  await fill(page, { 'cx-d': 'Material de oficina', 'cx-s': 'Proveedor Ficticio', 'cx-a': '42.50' });
  await click(page, '.mod [data-act="cnSaveExp"]');
  await expect(toast(page)).toContainText('Gasto guardado');
  expect((await svc(`expenses?select=amount_cents&org_id=eq.${org.org_id}`)).json[0].amount_cents).toBe(4250);

  // Recargar: todo sigue (sesión en esta pestaña) y viene del servidor
  await page.reload(); await waitApp(page);
  await act(page, 'go', { v: 'pacientes' });
  await expect(page.locator('#view')).toContainText('Paciente Sintética Uno');
  // Cerrar sesión
  await act(page, 'pmenu');
  await click(page, '[data-act="cnLogout"]');
  await page.locator('.gate form[data-f="login"]').waitFor();
  expect(errors, errors.join('\n')).toEqual([]);
});

test('equipo: invitación por enlace, alta de recepción con el correo invitado y permisos por rol', async ({ browser }) => {
  const adminEmail = mail('admin-eq');
  const { id: orgId } = await clinicFor(adminEmail, 'Clínica Sintética Equipo');
  const a = await (await browser.newContext()).newPage();
  await login(a, adminEmail);
  await tab(a, 'equipo');
  await a.locator('#cn-inv-email').waitFor();
  const recEmail = mail('recepcion');
  await fill(a, { 'cn-inv-email': recEmail, 'cn-inv-role': 'recepcion' });
  await click(a, '[data-act="cnInvite"]');
  await expect(toast(a)).toContainText('Invitación creada');
  const link = await a.inputValue('#cn-inv-link');
  expect(link).toMatch(/#invitacion=[0-9a-f]{48}$/);
  // La invitación queda pendiente y el token no se puede leer desde la API
  const pend = await svc(`org_invitations?select=email,role&org_id=eq.${orgId}`);
  expect(pend.json).toEqual([{ email: recEmail, role: 'recepcion' }]);

  // Otra persona con otro correo no puede usar el enlace
  const intruder = mail('intrusa');
  await createUser(intruder);
  const x = await (await browser.newContext()).newPage();
  await x.goto(link.replace(/^https?:\/\/[^/]+\//, '/'));
  await x.locator('.gate form[data-f="login"]').waitFor();
  await x.fill('.gate input[name="email"]', intruder); await x.fill('.gate input[name="password"]', PW);
  await x.click('.gate button[type="submit"]');
  await expect(x.locator('.gate')).toContainText('otra dirección de correo');

  // La persona invitada crea su cuenta desde el enlace y entra como recepción
  const b = await (await browser.newContext()).newPage();
  const errors = []; b.on('pageerror', e => errors.push(e.message));
  await b.goto(link.replace(/^https?:\/\/[^/]+\//, '/'));
  await expect(b.locator('.gate')).toContainText('aceptar la invitación');
  await b.click('.gate [data-mode="signup"]');
  await b.fill('.gate input[name="name"]', 'Recepción Sintética');
  await b.fill('.gate input[name="email"]', recEmail);
  await b.fill('.gate input[name="password"]', PW);
  await b.click('.gate button[type="submit"]');
  await waitApp(b);
  await expect(b.locator('.sidefoot .cn-org')).toContainText('Clínica Sintética Equipo');
  await expect(b.locator('.sidefoot .cn-org')).toContainText('Recepción');
  const views = await b.$$eval('#nav [data-act="go"]', els => els.map(e => e.dataset.v));
  expect(views).not.toContain('informes');
  expect(views).not.toContain('config');
  // Recepción no puede crear servicios aunque lo fuerce desde la consola: lo decide el servidor
  await act(b, 'addSvc');
  await expect(toast(b)).toContainText(/permiso/);
  expect((await svc(`services?select=id&org_id=eq.${orgId}`)).json).toHaveLength(1);
  // …ni documentos clínicos
  await act(b, 'newPatient');
  await fill(b, { 'np-n': 'Paciente Sintética Recepción', 'np-e': 'recep-paciente@correo-ejemplo.test' });
  await click(b, '.mod [data-act="savePatient"]');
  await expect(toast(b)).toContainText('creado');
  const pid = (await svc(`patients?select=id&org_id=eq.${orgId}`)).json[0].id;
  await act(b, 'openPatient', { id: pid });
  await act(b, 'ptab', { t: 'docs' });
  await expect(b.locator('#view')).toContainText('solo la ve la psicóloga');

  // La administradora ve a la nueva persona y le cambia el rol a gestoría
  await tab(a, 'equipo');
  await expect(a.locator('#cn-panel')).toContainText(recEmail);
  const sel = a.locator('select[data-cn-role]');
  await sel.selectOption('gestoria');
  await expect(toast(a)).toContainText('Rol cambiado');
  // Al recargar, la otra persona ya entra como gestoría (sin pacientes)
  await b.reload(); await waitApp(b);
  await expect(b.locator('.sidefoot .cn-org')).toContainText('Gestoría');
  const v2 = await b.$$eval('#nav [data-act="go"]', els => els.map(e => e.dataset.v));
  expect(v2).not.toContain('pacientes');
  // La administradora no puede quitarse a sí misma la administración (no aparece el botón; el servidor lo impide)
  const me = (await api('/rest/v1/rpc/list_team', { method: 'POST', token: await tokenFor(adminEmail), body: { p_org_id: orgId } })).json.find(m => m.email === adminEmail);
  const self = await api('/rest/v1/rpc/update_membership', { method: 'POST', token: await tokenFor(adminEmail), body: { p_membership_id: me.membership_id, p_is_admin: false } });
  expect(self.json?.code).toBe('KT005');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('varias clínicas a la vez: datos separados, selector de clínica y cambio de clínica', async ({ browser }) => {
  const e1 = mail('multi-a'), e2 = mail('multi-b');
  const A = await clinicFor(e1, 'Clínica Sintética Norte');
  const B = await clinicFor(e2, 'Clínica Sintética Sur', 'starter');
  await api('/rest/v1/patients', { method: 'POST', token: A.token, body: { org_id: A.id, patient_code: 'AUTO', first_name: 'Paciente', last_name: 'Solo Norte' } });
  await api('/rest/v1/patients', { method: 'POST', token: B.token, body: { org_id: B.id, patient_code: 'AUTO', first_name: 'Paciente', last_name: 'Solo Sur' } });
  // Las dos clínicas trabajan a la vez en pestañas distintas sin verse
  const pa = await (await browser.newContext()).newPage(); const pb = await (await browser.newContext()).newPage();
  await Promise.all([login(pa, e1), login(pb, e2)]);
  await Promise.all([act(pa, 'go', { v: 'pacientes' }), act(pb, 'go', { v: 'pacientes' })]);
  await expect(pa.locator('#view')).toContainText('Solo Norte'); await expect(pa.locator('#view')).not.toContainText('Solo Sur');
  await expect(pb.locator('#view')).toContainText('Solo Sur'); await expect(pb.locator('#view')).not.toContainText('Solo Norte');
  // Ambas dan de alta a la vez: cada una recibe su propio P-00002
  await Promise.all([pa, pb].map(async (p, i) => { await act(p, 'newPatient'); await fill(p, { 'np-n': `Paciente Simultánea ${i}`, 'np-e': `simultanea${i}@correo-ejemplo.test` }); await click(p, '.mod [data-act="savePatient"]'); }));
  await expect(toast(pa)).toContainText('P-00002'); await expect(toast(pb)).toContainText('P-00002');

  // Una persona en las dos clínicas elige con cuál trabajar y puede cambiar
  const both = mail('dos-clinicas');
  const u = await createUser(both, 'Gestoría Sintética Compartida');
  for (const o of [A, B]) {
    const inv = await api('/rest/v1/rpc/invite_member', { method: 'POST', token: o.token, body: { p_org_id: o.id, p_email: both, p_role: 'gestoria' } });
    const acc = await api('/rest/v1/rpc/accept_invitation', { method: 'POST', token: await tokenFor(both), body: { p_token: inv.json.token } });
    expect(acc.ok).toBe(true);
  }
  expect(u.id).toBeTruthy();
  const pc = await (await browser.newContext()).newPage();
  await login(pc, both, { expectApp: false });
  await expect(pc.locator('.gate .orgs button')).toHaveCount(2);
  await pc.click('.gate .orgs button:has-text("Clínica Sintética Sur")');
  await waitApp(pc);
  await expect(pc.locator('.sidefoot .cn-org')).toContainText('Clínica Sintética Sur');
  await act(pc, 'pmenu');
  await click(pc, '[data-act="cnSwitch"]');
  await pc.locator('.gate .orgs').waitFor();
  await pc.click('.gate .orgs button:has-text("Clínica Sintética Norte")');
  await waitApp(pc);
  await expect(pc.locator('.sidefoot .cn-org')).toContainText('Clínica Sintética Norte');
});

test('panel de KOVO y cuenta suspendida: solo lectura en la clínica, soporte disponible, reactivación', async ({ browser }) => {
  const clinicEmail = mail('suspendida');
  const C = await clinicFor(clinicEmail, 'Clínica Sintética Suspendida');
  const staffEmail = mail('staff');
  const staff = await createUser(staffEmail, 'Personal KOVO');
  // Alta de personal de KOVO: solo el operador con la clave de servicio (nunca desde el navegador)
  expect((await svc('platform_admins', { method: 'POST', body: { user_id: staff.id, note: 'e2e' } })).status).toBe(201);

  // Una clínica no entra al panel
  const p0 = await (await browser.newContext()).newPage();
  await p0.goto('/admin.html');
  await p0.fill('input[name="email"]', clinicEmail); await p0.fill('input[name="password"]', PW); await p0.click('button[type="submit"]');
  await expect(p0.locator('#app')).toContainText('Sin acceso');

  // Personal de KOVO: ve recuentos (no datos de pacientes) y suspende con motivo
  const s = await (await browser.newContext()).newPage();
  await s.goto('/admin.html');
  await s.fill('input[name="email"]', staffEmail); await s.fill('input[name="password"]', PW); await s.click('button[type="submit"]');
  const row = s.locator('tr:has([data-a="status"])', { hasText: 'Clínica Sintética Suspendida' });
  await row.waitFor();
  await row.locator('[data-a="status"]').click();
  await s.fill('dialog textarea[name="reason"]', 'Prueba E2E de suspensión');
  await s.click('dialog button[value="ok"]');
  await expect(s.locator('tr:has([data-a="status"])', { hasText: 'Clínica Sintética Suspendida' })).toContainText('Suspendida');

  // La clínica entra, ve el aviso y no puede guardar; sí puede escribir a soporte
  const c = await (await browser.newContext()).newPage();
  await login(c, clinicEmail);
  await expect(c.locator('#cn-banner')).toContainText('Cuenta suspendida');
  await act(c, 'newPatient');
  await fill(c, { 'np-n': 'Paciente Que No Se Guarda', 'np-e': 'no-se-guarda@correo-ejemplo.test' });
  await click(c, '.mod [data-act="savePatient"]');
  await expect(c.locator('#np-err, #toast').filter({ hasText: /suspendida/ }).first()).toBeVisible();
  expect((await svc(`patients?select=id&org_id=eq.${C.id}`)).json).toHaveLength(0);
  await tab(c, 'soporte');
  await c.locator('#cn-t-subject').waitFor();
  await fill(c, { 'cn-t-subject': 'Cuenta suspendida', 'cn-t-body': 'Mensaje sintético de prueba.' });
  await click(c, '[data-act="cnTicket"]');
  await expect(toast(c)).toContainText('Mensaje enviado a soporte');

  // KOVO responde y reactiva
  await s.reload();
  const t = s.locator('tr', { hasText: 'Mensaje sintético de prueba.' });
  await t.locator('[data-a="ticket"]').click();
  await s.selectOption('dialog select[name="status"]', 'closed');
  await s.fill('dialog textarea[name="reply"]', 'Respuesta sintética.');
  await s.click('dialog button[value="ok"]');
  await expect(s.locator('#toast')).toContainText('Consulta actualizada');
  await s.locator('tr:has([data-a="status"])', { hasText: 'Clínica Sintética Suspendida' }).locator('[data-a="status"]').click();
  await s.fill('dialog textarea[name="reason"]', 'Fin de la prueba E2E');
  await s.click('dialog button[value="ok"]');
  await expect(s.locator('tr:has([data-a="status"])', { hasText: 'Clínica Sintética Suspendida' })).toContainText('Activa');
  const audit = (await svc(`platform_audit_log?select=action,metadata&org_id=eq.${C.id}&order=created_at.asc`)).json.filter(x => x.action === 'set_account_status');
  expect(audit.map(x => x.metadata.status)).toEqual(['suspended', 'active']);
  await c.reload(); await waitApp(c);
  await expect(c.locator('#cn-banner')).not.toContainText('suspendida');   // queda solo el aviso del periodo de prueba
  await tab(c, 'soporte');
  await expect(c.locator('#cn-panel')).toContainText('Respuesta sintética.');
});

test('sesión y red: renovación automática, sesión caducada, sesión revocada y corte de red sin datos a medias', async ({ browser }) => {
  const email = mail('sesion');
  const C = await clinicFor(email, 'Clínica Sintética Sesión');
  const p = await (await browser.newContext()).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await login(p, email);
  await tab(p, 'servicios');
  // Token de acceso inválido: el 401 se renueva con el refresh token y la operación se completa una sola vez
  await p.evaluate(() => { const k = 'kovo.auth.session.v1'; const s = JSON.parse(sessionStorage.getItem(k)); s.access_token = 'caducado.' + s.access_token.split('.')[1] + '.x'; sessionStorage.setItem(k, JSON.stringify(s)); });
  await click(p, '[data-act="addSvc"]');
  await expect(toast(p)).toContainText('Servicio añadido');
  expect((await svc(`services?select=id&org_id=eq.${C.id}`)).json).toHaveLength(2);
  // Corte de red: no se guarda nada y se dice
  await p.route('**/rest/v1/services**', r => r.abort('internetdisconnected'));
  await click(p, '[data-act="addSvc"]');
  await expect(toast(p)).toContainText('No hay conexión con el servidor');
  await p.unroute('**/rest/v1/services**');
  expect((await svc(`services?select=id&org_id=eq.${C.id}`)).json).toHaveLength(2);
  // Sesión revocada en el servidor (cierre de sesión en otro dispositivo): se corta de inmediato
  const session = await p.evaluate(() => JSON.parse(sessionStorage.getItem('kovo.auth.session.v1')));
  expect((await api('/auth/v1/logout?scope=global', { method: 'POST', token: session.access_token })).status).toBe(204);
  await click(p, '[data-act="addSvc"]');
  await expect(toast(p)).toContainText(/sesión|permiso/);
  expect((await svc(`services?select=id&org_id=eq.${C.id}`)).json).toHaveLength(2);
  // Sin sesión válida, al recargar se pide entrar de nuevo
  await p.reload();
  await p.locator('.gate form[data-f="login"]').waitFor();
  expect(errors, errors.join('\n')).toEqual([]);
});

test('móvil (390 px): acceso, alta y paneles conectados sin desbordamiento horizontal', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const email = mail('movil');
  await p.goto('/');
  await p.click('.gate [data-mode="signup"]');
  await p.fill('.gate input[name="name"]', 'Titular Sintética Móvil');
  await p.fill('.gate input[name="email"]', email);
  await p.fill('.gate input[name="password"]', PW);
  await p.click('.gate button[type="submit"]');
  await p.locator('.gate form[data-f="org"]').waitFor();
  const gateOverflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(gateOverflow).toBeLessThanOrEqual(0);
  await p.fill('.gate input[name="name"]', 'Clínica Sintética Móvil');
  await p.click('.gate button[type="submit"]');
  await waitApp(p);
  for (const t of ['clinica', 'equipo', 'suscripcion', 'soporte', 'audit', 'horario', 'servicios']) {
    await tab(p, t);
    if (['clinica', 'equipo', 'suscripcion', 'soporte', 'audit'].includes(t)) await expect(p.locator('#cn-panel')).not.toContainText('Cargando');
    const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over, `desbordamiento en ${t}`).toBeLessThanOrEqual(0);
  }
  await expect(p.locator('#cn-panel')).toHaveCount(0);   // servicios: pestaña de la interfaz original
  expect(errors, errors.join('\n')).toEqual([]);
});
