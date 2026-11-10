// B + D · Flujo clínico completo en el navegador contra PostgreSQL + PostgREST REALES (locales y
// desechables, ver clinical-db/run-local.mjs --e2e). Lo que decide la BD aquí es la BD de verdad:
// RLS, triggers, la RPC save_clinical_note_draft_v2, versiones y auditoría.
// Simulado: solo Supabase Auth (el usuario de la sesión), porque GoTrue necesita Docker.
// Datos 100 % sintéticos (clinical-db/tests/fixtures.mjs).
import { test, expect } from '@playwright/test';
import { createHmac, randomUUID } from 'node:crypto';
import { MOCK_SUPABASE_URL } from '../../playwright.supabase.config.js';

const REST = process.env.KOVO_REAL_REST;
const SECRET = process.env.KOVO_REAL_JWT_SECRET;
test.skip(!REST || !SECRET, 'Solo con clinical-db/run-local.mjs --e2e (PostgREST local)');

const ORG_A = '0a000000-0000-4000-8000-00000000000a';
const U = { psico: 'a0000000-0000-4000-8000-000000000001', recepcion: 'a0000000-0000-4000-8000-000000000003', gestoria: 'a0000000-0000-4000-8000-000000000004' };
const SERVICE = 'e1000000-0000-4000-8000-000000000001';
const FIXED_NOW = new Date('2026-11-06T11:30:00+01:00');

const jwt = sub => {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ aud: 'authenticated', role: 'authenticated', sub, iat: now, exp: now + 3600 })}`;
  return `${body}.${createHmac('sha256', SECRET).update(body).digest('base64url')}`;
};
// Acceso directo a PostgREST como una usuaria (otra pestaña / verificación). Mismo JWT que el navegador.
const rest = async (user, path, { method = 'GET', body } = {}) => {
  const r = await fetch(`${REST}/${path}`, { method, headers: { Authorization: `Bearer ${jwt(user)}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: body && JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => null) };
};

// El navegador habla con el dominio simulado; /rest/v1 se reenvía al PostgREST real con el JWT de la
// usuaria; /auth/v1 se responde aquí. Cualquier otra salida externa se bloquea.
async function connect(page, user, { cut = null } = {}) {
  const log = { requests: [], blocked: [] };
  await page.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.hostname === 'localhost') return route.continue();
    if (url.origin !== MOCK_SUPABASE_URL) { log.blocked.push(url.origin); return route.abort(); }
    log.requests.push({ method: req.method(), path: url.pathname + url.search });
    if (url.pathname === '/auth/v1/user') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: user, email: 'sintetica@kovo.test' }) });
    if (url.pathname === '/auth/v1/token') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'local', refresh_token: 'local', user: { id: user } }) });
    if (!url.pathname.startsWith('/rest/v1/')) return route.abort();
    if (cut && cut(req.method(), url.pathname)) return route.abort('internetdisconnected');
    const headers = { ...req.headers(), authorization: `Bearer ${jwt(user)}` };
    delete headers.apikey; delete headers.host;
    const response = await route.fetch({ url: `${REST}${url.pathname.replace('/rest/v1', '')}${url.search}`, headers });
    return route.fulfill({ response });
  });
  await page.addInitScript(u => sessionStorage.setItem('kovo.auth.session.v1', JSON.stringify({ access_token: 'local', refresh_token: 'local', user: { id: u } })), user);
  return log;
}
async function open(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto('/');
  await waitView(page);
  return errors;
}
const waitView = page => page.waitForFunction(() => { const v = document.getElementById('view'); return v && v.children.length > 0 && !v.querySelector('.sk'); });
const act = (page, name, data = {}) => page.evaluate(([n, d]) => { const b = document.createElement('button'); b.dataset.act = n; Object.assign(b.dataset, d); b.hidden = true; document.body.appendChild(b); b.click(); b.remove(); }, [name, data]).then(() => page.waitForTimeout(150));
const click = (page, sel) => page.evaluate(s => { const el = document.querySelector(s); if (!el) throw new Error('No existe ' + s); el.click(); }, sel).then(() => page.waitForTimeout(150));
const fill = (page, v) => page.evaluate(x => { for (const [id, val] of Object.entries(x)) { const el = document.getElementById(id); if (!el) throw new Error('No existe #' + id); el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); } }, v);
const toast = page => page.locator('#toast');
const state = page => page.locator('#nb-state');

test('E2E real: paciente → cita → realizada → borrador v2 → recarga → ficha → edición → conflicto → corte de red → roles', async ({ page, browser }) => {
  let cutNext = false;
  const log = await connect(page, U.psico, { cut: (m, p) => { if (cutNext && m === 'POST' && p.endsWith('save_clinical_note_draft_v2')) { cutNext = false; return true; } return false; } });
  const errors = await open(page);
  const name = `Real ${randomUUID().slice(0, 8)}`;
  // 1. Paciente (INSERT real con RLS y trigger del código)
  await act(page, 'newPatient');
  await fill(page, { 'np-n': `Paciente ${name}`, 'np-e': 'real@kovo.test', 'np-t': '600000099', 'np-s': SERVICE, 'np-m': 'presencial' });
  await click(page, '.mod [data-act="savePatient"]');
  await expect(toast(page)).toContainText('creado');
  const { data: [patient] } = await rest(U.psico, `patients?select=id,patient_code&last_name=eq.${encodeURIComponent(name)}`);
  expect(patient.patient_code).toMatch(/^P-\d{5}$/);
  // 2-3. Cita de ayer, del paciente
  await act(page, 'newAppt');
  await fill(page, { 'f-p': patient.id, 'f-d': '2026-11-05', 'f-t': '16:00', 'f-s': SERVICE, 'f-dur': '50' });
  await click(page, '.mod [data-act="saveAppt"]');
  await expect(toast(page)).toContainText('Cita creada');
  const { data: [appt] } = await rest(U.psico, `appointments?select=id,status,patient_id&patient_id=eq.${patient.id}`);
  // 4-5. Completar la sesión y abrir el borrador
  await act(page, 'fillNote', { id: appt.id });
  await expect(page.locator('[data-act="saveNote"]')).toBeVisible();
  expect((await rest(U.psico, `appointments?select=status&id=eq.${appt.id}`)).data[0].status).toBe('completed');
  // 6-7. Contenido y guardado
  await fill(page, { 'nf-objetivos': 'Objetivo SINTETICO', 'nf-resumen': 'Párrafo uno\n\nPárrafo dos' });
  await expect(state(page)).toHaveText('Sin guardar');
  await click(page, '[data-act="saveNote"]');
  await expect(state(page)).toHaveText('Guardado · versión 1');
  let notes = (await rest(U.psico, `clinical_notes?select=id,version,status,author_id,appointment_id,content_format,sections&patient_id=eq.${patient.id}`)).data;
  expect(notes).toHaveLength(1);
  expect(notes[0]).toMatchObject({ version: 1, status: 'draft', author_id: U.psico, appointment_id: appt.id, content_format: 'sections_v1' });
  expect(notes[0].sections.resumen).toBe('Párrafo uno\n\nPárrafo dos');
  const id = notes[0].id;
  // 8. Recargar
  await page.reload();
  await waitView(page);
  // 9-10. Ficha del paciente → Sesiones → la nota
  await act(page, 'openPatient', { id: patient.id, tab: 'sesiones' });
  await page.locator('#view tr.click', { hasText: 'Nota de sesión' }).click();
  await expect(page.locator('#nf-resumen')).toHaveValue('Párrafo uno\n\nPárrafo dos');
  await expect(state(page)).toHaveText('Guardado · versión 1');
  // 11-13. Modificar, guardar y verificar
  await fill(page, { 'nf-plan': 'Plan SINTETICO' });
  await click(page, '[data-act="saveNote"]');
  await expect(state(page)).toHaveText('Guardado · versión 2');
  expect((await rest(U.psico, `clinical_notes?select=version,sections&id=eq.${id}`)).data[0]).toMatchObject({ version: 2, sections: { plan: 'Plan SINTETICO' } });

  // Conflicto real: «otra pestaña» guarda la versión 3 directamente en PostgREST
  const other = await rest(U.psico, 'rpc/save_clinical_note_draft_v2', { method: 'POST', body: { p_note_id: id, p_org_id: ORG_A, p_patient_id: patient.id, p_appointment_id: appt.id, p_note_type: 'session', p_sections: { objetivos: 'Desde otra pestaña', resumen: 'Párrafo uno\n\nPárrafo dos', plan: 'Plan SINTETICO' }, p_expected_version: 2 } });
  expect(other.data.version).toBe(3);
  await fill(page, { 'nf-plan': 'Plan desde el navegador' });
  await click(page, '[data-act="saveNote"]');
  await expect(state(page)).toHaveText('Conflicto: hay una versión guardada más reciente');
  await expect(page.locator('#nf-plan')).toHaveValue('Plan desde el navegador');
  expect((await rest(U.psico, `clinical_notes?select=version&id=eq.${id}`)).data[0].version).toBe(3);
  await click(page, '[data-act="noteCompare"]');
  await expect(page.locator('.mod')).toContainText('Desde otra pestaña');
  await click(page, '.mod [data-act="noteForce"]');
  await expect(state(page)).toHaveText('Guardado · versión 4');

  // Corte de red al guardar: nada confirmado en falso; el reintento guarda una vez
  cutNext = true;
  await fill(page, { 'nf-acuerdos': 'Acuerdo SINTETICO' });
  await click(page, '[data-act="saveNote"]');
  await expect(toast(page)).toContainText('NO se ha guardado');
  await expect(state(page)).toHaveText('Sin guardar');
  await click(page, '[data-act="saveNote"]');
  await expect(state(page)).toHaveText('Guardado · versión 5');
  notes = (await rest(U.psico, `clinical_notes?select=id&patient_id=eq.${patient.id}`)).data;
  expect(notes).toHaveLength(1);

  // Auditoría real: alta + 4 modificaciones (la de la «otra pestaña» incluida), sin contenido clínico
  const audit = (await rest(U.psico, `audit_log?select=action,actor_id,metadata&entity_id=eq.${id}&order=id`)).data;
  expect(audit.map(a => a.action)).toEqual(['clinical_note.draft_created', ...Array(4).fill('clinical_note.draft_updated')]);
  expect(JSON.stringify(audit)).not.toContain('SINTETICO');
  expect(audit.every(a => a.actor_id === U.psico)).toBe(true);
  // La cita queda bloqueada en «realizada» y con su paciente
  expect((await rest(U.recepcion, `appointments?id=eq.${appt.id}`, { method: 'PATCH', body: { status: 'cancelled' } })).data.code).toBe('KN011');
  expect(errors, errors.join('\n')).toEqual([]);
  expect(log.blocked.filter(o => o !== 'https://cdnjs.cloudflare.com')).toEqual([]);   // librería PDF opcional, bloqueada a propósito

  // 14. Recepción y gestoría: nada clínico, ni en la interfaz ni pidiéndolo directamente
  for (const role of ['recepcion', 'gestoria']) {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await connect(p, U[role]);
    const errs = await open(p);
    await act(p, 'openNote', { id });
    await expect(p.locator('#nf-objetivos')).toHaveCount(0);
    expect(await p.locator('body').innerText()).not.toContain('Desde otra pestaña');
    expect((await rest(U[role], `clinical_notes?select=id,sections&id=eq.${id}`)).data).toEqual([]);
    expect((await rest(U[role], 'rpc/save_clinical_note_draft_v2', { method: 'POST', body: { p_note_id: id, p_org_id: ORG_A, p_patient_id: patient.id, p_appointment_id: appt.id, p_note_type: 'session', p_sections: {}, p_expected_version: 5 } })).status).toBe(403);
    expect(errs).toEqual([]);
    await ctx.close();
  }
});
