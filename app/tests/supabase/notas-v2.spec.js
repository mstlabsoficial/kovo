// B · Notas clínicas desde la interfaz real (legacy.js) en modo Supabase con la propuesta clínica v2
// (RPC save_clinical_note_draft_v2: UUID estable + versión). Servidor simulado con estado
// (createFakeServer({ v2: true })), copia de la función SQL validada en PostgreSQL real por
// clinical-db/run-local.mjs. Datos 100 % sintéticos.
import { test, expect } from '@playwright/test';
import { ORG, uuid, createFakeServer } from '../fixtures/supabase-fake.mjs';
import { USER, mockSupabase, open, waitView, click, act, fill } from './helpers.js';

const P1 = uuid(1), A_PAST = uuid(32), A_DONE = uuid(30), N_SIGNED = uuid(70), N_LEGACY = uuid(71);
const V1 = '/rest/v1/rpc/save_clinical_note_draft', V2 = '/rest/v1/rpc/save_clinical_note_draft_v2';
const network = () => { throw new TypeError('Failed to fetch'); };
const once = fn => { let done = false; return (...a) => { if (!done) { done = true; fn(...a); } }; };
const toast = page => page.locator('#toast');
const state = page => page.locator('#nb-state');
const rpc = log => log.requests.filter(r => r.path.startsWith('/rest/v1/rpc/'));
const v2Server = role => createFakeServer({ role, v2: true });
const drafts = (server, patientId) => server.db.clinical_notes.filter(n => n.org_id === ORG && n.patient_id === patientId && n.status === 'draft');
const value = (page, id) => page.locator('#' + id).inputValue();

async function draftFromAppointment(page, text = { 'nf-objetivos': 'Objetivo ficticio', 'nf-resumen': 'Primer párrafo\n\nSegundo párrafo' }) {
  await act(page, 'fillNote', { id: A_PAST });
  await expect(page.locator('[data-act="saveNote"]')).toBeVisible();
  await fill(page, text);
  await page.locator('#nf-objetivos').dispatchEvent('input');
}

test('E2E (14 pasos): paciente → cita → realizada → borrador → recargar → ficha → continuar → roles sin acceso', async ({ page, browser }) => {
  const server = v2Server('psychologa');
  const log = await mockSupabase(page, 'psychologa', { server });
  const errors = await open(page);
  // 1. Crear paciente
  await act(page, 'newPatient');
  await fill(page, { 'np-n': 'Paciente Flujo Ficticio', 'np-e': 'flujo@correo-ejemplo.test', 'np-t': '600000077', 'np-s': uuid(10), 'np-m': 'presencial' });
  await click(page, '.mod [data-act="savePatient"]');
  await expect(toast(page)).toContainText('creado');
  const patient = server.db.patients.find(p => p.last_name === 'Flujo Ficticio');
  // 2-3. Crear la cita y vincularla al paciente (ayer, para poder cerrarla)
  await act(page, 'newAppt');
  await fill(page, { 'f-p': patient.id, 'f-d': '2026-11-05', 'f-t': '10:00', 'f-s': uuid(10), 'f-dur': '50' });
  await click(page, '.mod [data-act="saveAppt"]');
  await expect(toast(page)).toContainText('Cita creada');
  const appt = server.db.appointments.find(a => a.patient_id === patient.id);
  // 4-5. Completar la sesión y abrir el borrador
  await act(page, 'fillNote', { id: appt.id });
  await expect(page.locator('[data-act="saveNote"]')).toBeVisible();
  expect(server.db.appointments.find(a => a.id === appt.id).status).toBe('completed');
  await expect(state(page)).toHaveText('Sin guardar');
  // 6-7. Escribir y guardar: la interfaz confirma solo tras la respuesta del servidor
  await fill(page, { 'nf-objetivos': 'Objetivo del flujo', 'nf-plan': 'Plan del flujo' });
  await click(page, '[data-act="saveNote"]');
  await expect(toast(page)).toContainText('Borrador guardado');
  await expect(state(page)).toHaveText('Guardado · versión 1');
  const [note] = drafts(server, patient.id);
  expect(note).toMatchObject({ appointment_id: appt.id, author_id: USER, version: 1, content_format: 'sections_v1' });
  expect(note.sections).toMatchObject({ objetivos: 'Objetivo del flujo', plan: 'Plan del flujo' });
  // 8. Recargar
  await page.reload();
  await waitView(page);
  // 9-10. Volver a la ficha del paciente y recuperar la nota desde «Sesiones»
  await act(page, 'openPatient', { id: patient.id, tab: 'sesiones' });
  await expect(page.locator('#view tr.click', { hasText: 'Nota de sesión' })).toHaveCount(1);
  await page.locator('#view tr.click', { hasText: 'Nota de sesión' }).click();
  await expect(page.locator('#nf-objetivos')).toHaveValue('Objetivo del flujo');
  await expect(state(page)).toHaveText('Guardado · versión 1');
  // La cita realizada aparece en el historial de la ficha
  await act(page, 'openPatient', { id: patient.id, tab: 'resumen' });
  await expect(page.locator('#view .timeline')).toContainText('Cita · ');
  await expect(page.locator('#view .timeline')).toContainText('realizada');
  // 11-12. Modificar y guardar
  await act(page, 'openNote', { id: note.id });
  await fill(page, { 'nf-plan': 'Plan revisado' });
  await page.locator('#nf-plan').dispatchEvent('input');
  await expect(state(page)).toHaveText('Sin guardar');
  await click(page, '[data-act="saveNote"]');
  await expect(state(page)).toHaveText('Guardado · versión 2');
  // 13. Verificar en la BD: una sola nota, versión 2, apartados correctos; ninguna escritura directa
  expect(drafts(server, patient.id)).toHaveLength(1);
  expect(server.db.clinical_notes.find(n => n.id === note.id)).toMatchObject({ version: 2, sections: { objetivos: 'Objetivo del flujo', plan: 'Plan revisado' } });
  expect(rpc(log).map(r => r.path)).toEqual([V2, V2]);
  expect(log.requests.filter(r => r.method !== 'GET' && r.path.startsWith('/rest/v1/clinical_notes'))).toEqual([]);
  expect(errors, errors.join('\n')).toEqual([]);

  // 14. Recepción y gestoría, con la misma BD: sin acceso al contenido clínico
  for (const role of ['recepcion', 'gestoria']) {
    const ctx = await browser.newContext();
    const other = await ctx.newPage();
    const roleLog = await mockSupabase(other, role, { server: createFakeServer({ role, db: server.db, v2: true }) });
    await open(other);
    expect(roleLog.requests.some(r => r.path.startsWith('/rest/v1/clinical_notes'))).toBe(false);
    await act(other, 'openNote', { id: note.id });
    await expect(other.locator('#nf-objetivos')).toHaveCount(0);
    expect(await other.locator('body').innerText()).not.toContain('Plan revisado');
    await ctx.close();
  }
});

test('cortes de red y respuestas perdidas: nada se da por guardado sin confirmación y nunca se duplica', async ({ page }) => {
  const server = v2Server('psychologa');
  const log = await mockSupabase(page, 'psychologa', { server });
  await open(page);
  await draftFromAppointment(page);
  // La petición no llega
  server.faults.beforeWrite = once(network);
  await click(page, '[data-act="saveNote"]');
  await expect(toast(page)).toContainText('NO se ha guardado');
  await expect(state(page)).toHaveText('Sin guardar');
  expect(await value(page, 'nf-objetivos')).toBe('Objetivo ficticio');
  expect(drafts(server, uuid(2)).filter(n => n.appointment_id === A_PAST)).toHaveLength(0);
  // Llega, se guarda, y la respuesta se pierde
  server.faults.afterWrite = once(network);
  await click(page, '[data-act="saveNote"]');
  await expect(toast(page)).toContainText('NO se ha guardado');
  await expect(state(page)).toHaveText('Sin guardar');
  // Reintento: misma nota (mismo UUID), versión 1, sin duplicado
  await click(page, '[data-act="saveNote"]');
  await expect(state(page)).toHaveText('Guardado · versión 1');
  const rows = drafts(server, uuid(2)).filter(n => n.appointment_id === A_PAST);
  expect(rows).toHaveLength(1);
  const ids = server.calls.filter(c => c.path === 'rpc/save_clinical_note_draft_v2').map(c => c.body.p_note_id);
  expect(new Set(ids).size, 'todos los intentos con el mismo UUID').toBe(1);
  // Edición con respuesta perdida y más texto antes del reintento: sin falso conflicto
  server.faults.afterWrite = once(network);
  await fill(page, { 'nf-plan': 'Plan A' });
  await click(page, '[data-act="saveNote"]');
  await expect(toast(page)).toContainText('NO se ha guardado');
  await fill(page, { 'nf-plan': 'Plan A y B' });
  await click(page, '[data-act="saveNote"]');
  await expect(toast(page)).toContainText('Borrador guardado');
  await expect(state(page)).toHaveText('Guardado · versión 3');
  expect(rows[0].sections.plan).toBe('Plan A y B');
  expect(rpc(log).every(r => r.path === V2)).toBe(true);
});

test('dos pestañas editan el mismo borrador: la segunda recibe conflicto, compara y decide', async ({ browser }) => {
  const server = v2Server('psychologa');
  const ctxA = await browser.newContext(), ctxB = await browser.newContext();
  const a = await ctxA.newPage(), b = await ctxB.newPage();
  await mockSupabase(a, 'psychologa', { server });
  await mockSupabase(b, 'psychologa', { server });
  await open(a);
  await draftFromAppointment(a, { 'nf-objetivos': 'Versión inicial' });
  await click(a, '[data-act="saveNote"]');
  await expect(state(a)).toHaveText('Guardado · versión 1');
  const id = drafts(server, uuid(2)).find(n => n.appointment_id === A_PAST).id;

  const errorsB = await open(b);
  await act(b, 'openNote', { id });
  await expect(b.locator('#nf-objetivos')).toHaveValue('Versión inicial');
  // A guarda primero
  await fill(a, { 'nf-objetivos': 'Texto de la pestaña A' });
  await click(a, '[data-act="saveNote"]');
  await expect(state(a)).toHaveText('Guardado · versión 2');
  // B guarda sobre la versión 1: conflicto, no se pisa, el texto de B sigue en el editor
  await fill(b, { 'nf-objetivos': 'Texto de la pestaña B' });
  await click(b, '[data-act="saveNote"]');
  await expect(toast(b)).toContainText('otra sesión');
  await expect(state(b)).toHaveText('Conflicto: hay una versión guardada más reciente');
  await expect(b.locator('.box.warn', { hasText: 'Otra sesión ha guardado este borrador (versión 2)' })).toBeVisible();
  expect(await value(b, 'nf-objetivos')).toBe('Texto de la pestaña B');
  expect(server.db.clinical_notes.find(n => n.id === id).sections.objetivos).toBe('Texto de la pestaña A');
  // Comparar: se ven las dos versiones del apartado distinto
  await click(b, '[data-act="noteCompare"]');
  await expect(b.locator('.mod')).toContainText('Un apartado distinto');
  await expect(b.locator('.mod')).toContainText('Texto de la pestaña A');
  await expect(b.locator('.mod')).toContainText('Texto de la pestaña B');
  // Decide guardar la suya, sobre la versión que ha visto
  await click(b, '.mod [data-act="noteForce"]');
  await expect(state(b)).toHaveText('Guardado · versión 3');
  await expect(b.locator('.box.warn', { hasText: 'Otra sesión' })).toHaveCount(0);
  expect(server.db.clinical_notes.find(n => n.id === id)).toMatchObject({ version: 3, sections: { objetivos: 'Texto de la pestaña B' } });
  // A, que sigue en la versión 2, ahora es la que recibe el conflicto y elige la guardada
  await fill(a, { 'nf-objetivos': 'A otra vez' });
  await click(a, '[data-act="saveNote"]');
  await expect(state(a)).toHaveText('Conflicto: hay una versión guardada más reciente');
  await click(a, '[data-act="noteCompare"]');
  await click(a, '.mod [data-act="noteUseServer"]');
  await expect(a.locator('#nf-objetivos')).toHaveValue('Texto de la pestaña B');
  await expect(state(a)).toHaveText('Guardado · versión 3');
  expect(server.db.clinical_notes.find(n => n.id === id).version).toBe(3);
  expect(errorsB).toEqual([]);
  await ctxA.close(); await ctxB.close();
});

test('doble clic en «Guardar borrador»: una sola petición y una sola nota', async ({ page }) => {
  const server = v2Server('psychologa');
  const log = await mockSupabase(page, 'psychologa', { server });
  await open(page);
  await draftFromAppointment(page);
  await page.evaluate(() => { const b = document.querySelector('[data-act="saveNote"]'); b.click(); b.click(); });
  await expect(toast(page)).toContainText('Borrador guardado');
  expect(rpc(log)).toHaveLength(1);
  expect(drafts(server, uuid(2)).filter(n => n.appointment_id === A_PAST)).toHaveLength(1);
});

test('la BD rechaza: cita que deja de estar realizada (KN008) y nota firmada; la interfaz no queda en un estado falso', async ({ page }) => {
  const server = v2Server('psychologa');
  await mockSupabase(page, 'psychologa', { server });
  const errors = await open(page);
  await draftFromAppointment(page);
  server.db.appointments.find(a => a.id === A_PAST).status = 'scheduled';   // otra sesión la reabrió (aún sin nota)
  await click(page, '[data-act="saveNote"]');
  await expect(toast(page)).toContainText('todavía no está marcada como realizada');
  await expect(state(page)).toHaveText('Sin guardar');
  expect(await value(page, 'nf-objetivos')).toBe('Objetivo ficticio');
  expect(drafts(server, uuid(2)).filter(n => n.appointment_id === A_PAST)).toHaveLength(0);
  // Nota firmada: solo lectura, sin indicador de borrador y sin petición
  await act(page, 'openNote', { id: N_SIGNED });
  await expect(state(page)).toHaveCount(0);
  await act(page, 'saveNote', { id: N_SIGNED });
  await expect(toast(page)).toContainText('firmada');
  expect(errors).toEqual([]);
});

test('nota histórica (texto libre): se abre sin convertirla; solo pasa a apartados al guardarla', async ({ page }) => {
  const server = v2Server('psychologa');
  await mockSupabase(page, 'psychologa', { server });
  await open(page);
  await act(page, 'openNote', { id: N_LEGACY });
  await expect(page.locator('#nf-objetivos')).toHaveValue('Texto libre ficticio');
  await expect(state(page)).toHaveText('Guardado · versión 1');
  expect(server.db.clinical_notes.find(n => n.id === N_LEGACY)).toMatchObject({ content_format: 'legacy_text', sections: null });
  await act(page, 'closeEditor');
  await act(page, 'openNote', { id: N_LEGACY });
  await fill(page, { 'nf-plan': 'Plan añadido' });
  await click(page, '[data-act="saveNote"]');
  await expect(state(page)).toHaveText('Guardado · versión 2');
  expect(server.db.clinical_notes.find(n => n.id === N_LEGACY)).toMatchObject({ content_format: 'sections_v1', sections: { objetivos: 'Texto libre ficticio', plan: 'Plan añadido' } });
});

test('recepción no puede dejar como ausencia una cita realizada con nota (KN011): mensaje claro y estado intacto', async ({ page }) => {
  const server = createFakeServer({ role: 'recepcion', v2: true });
  await mockSupabase(page, 'recepcion', { server });
  const errors = await open(page);
  await act(page, 'openAppt', { id: A_DONE });
  await expect(page.locator('.mod')).toContainText('Realizada');
  await act(page, 'noshow', { id: A_DONE });                    // acción forzada: el botón no se ofrece
  await expect(toast(page)).toContainText('tiene una nota clínica y debe seguir como realizada');
  expect(server.db.appointments.find(a => a.id === A_DONE && a.org_id === ORG).status).toBe('completed');
  await act(page, 'close');
  await act(page, 'openAppt', { id: A_DONE });
  await expect(page.locator('.mod')).toContainText('Realizada');
  expect(errors).toEqual([]);
});

test('salir con cambios sin guardar avisa (beforeunload); sin cambios, no', async ({ page }) => {
  const server = v2Server('psychologa');
  await mockSupabase(page, 'psychologa', { server });
  await open(page);
  const unload = () => page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  expect(await unload()).toBe(false);
  await draftFromAppointment(page);
  expect(await unload()).toBe(true);
  await click(page, '[data-act="saveNote"]');
  await expect(state(page)).toHaveText('Guardado · versión 1');
  expect(await unload()).toBe(false);
  await fill(page, { 'nf-plan': 'Sin guardar' });
  expect(await unload()).toBe(true);
});
