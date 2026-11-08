// Borradores de notas clínicas desde la interfaz real (legacy.js) en modo Supabase, contra el servidor
// simulado con estado (RPC save_clinical_note_draft incluida). Datos 100 % sintéticos.
import { test, expect } from '@playwright/test';
import { ORG, ORG2, uuid } from '../fixtures/supabase-fake.mjs';
import { USER, mockSupabase, open, waitView, click, act, fill } from './helpers.js';
import { parseNoteContent } from '../../src/data/from-supabase.js';

const P1 = uuid(1), P2 = uuid(2), A_PAST = uuid(32), N_SIGNED = uuid(70), N_DRAFT = uuid(71);
const network = () => { throw new TypeError('Failed to fetch'); };
const once = fn => { let done = false; return (...a) => { if (!done) { done = true; fn(...a); } }; };
const toast = page => page.locator('#toast');
const rpc = log => log.requests.filter(r => r.path.startsWith('/rest/v1/rpc/'));
const directNoteWrites = log => log.requests.filter(r => r.method !== 'GET' && r.path.startsWith('/rest/v1/clinical_notes'));
const newDrafts = log => log.server.db.clinical_notes.filter(n => n.org_id === ORG && ![N_SIGNED, N_DRAFT].includes(n.id));
const fieldsOf = row => parseNoteContent(row.content, 'sesion').fields;
const value = (page, id) => page.locator('#' + id).inputValue();

// Abre el editor de la nota de la cita pasada (la marca como realizada) con un texto escrito.
async function draftFromAppointment(page, text = { 'nf-objetivos': 'Objetivo ficticio', 'nf-resumen': 'Primer párrafo\n\nSegundo párrafo' }) {
  await act(page, 'fillNote', { id: A_PAST });
  await expect(page.locator('[data-act="saveNote"]')).toBeVisible();
  await fill(page, text);
}

test('psicóloga: crea el borrador de una cita, lo edita y al recargar sigue igual', async ({ page }) => {
  const log = await mockSupabase(page, 'psychologa');
  const errors = await open(page);
  await draftFromAppointment(page);
  await click(page, '[data-act="saveNote"]');
  await expect(toast(page)).toContainText('Borrador guardado');
  const [row] = newDrafts(log);
  expect(row).toMatchObject({ org_id: ORG, patient_id: P2, appointment_id: A_PAST, author_id: USER, note_type: 'session', status: 'draft' });
  expect(fieldsOf(row)).toMatchObject({ objetivos: 'Objetivo ficticio', resumen: 'Primer párrafo\n\nSegundo párrafo', plan: '' });

  // Sigue en el editor; se edita y se vuelve a guardar: misma nota
  await fill(page, { 'nf-plan': 'Plan ficticio' });
  await click(page, '[data-act="saveNote"]');
  await expect(toast(page)).toContainText('Borrador guardado');
  expect(newDrafts(log)).toHaveLength(1);
  expect(fieldsOf(newDrafts(log)[0]).plan).toBe('Plan ficticio');
  expect(rpc(log).map(r => r.path)).toEqual(['/rest/v1/rpc/save_clinical_note_draft', '/rest/v1/rpc/save_clinical_note_draft']);
  expect(directNoteWrites(log)).toEqual([]);

  // Recargar
  await page.reload();
  await waitView(page);
  await act(page, 'openNote', { id: row.id });
  await expect(page.locator('#nf-plan')).toHaveValue('Plan ficticio');
  await expect(page.locator('#nf-resumen')).toHaveValue('Primer párrafo\n\nSegundo párrafo');
  await act(page, 'closeEditor');
  await act(page, 'goNotes', { f: 'todas' });
  await expect(page.locator('#view tr.click', { hasText: 'Nota de sesión' }).first()).toBeVisible();
  expect(errors, errors.join('\n')).toEqual([]);
  expect(log.blocked.filter(o => o !== 'https://cdnjs.cloudflare.com')).toEqual([]);
});

test('editar un borrador existente y un informe nuevo sin cita', async ({ page }) => {
  const log = await mockSupabase(page, 'psychologa');
  await open(page);
  await act(page, 'openNote', { id: N_DRAFT });
  await expect(page.locator('#nf-objetivos')).toHaveValue('Texto libre ficticio');
  await fill(page, { 'nf-acuerdos': 'Acuerdo ficticio' });
  await click(page, '[data-act="saveNote"]');
  await expect(toast(page)).toContainText('Borrador guardado');
  const draft = log.server.db.clinical_notes.find(n => n.id === N_DRAFT);
  expect(fieldsOf(draft)).toMatchObject({ objetivos: 'Texto libre ficticio', acuerdos: 'Acuerdo ficticio' });
  expect(newDrafts(log)).toHaveLength(0);

  await act(page, 'newDoc', { t: 'inicial', p: P1 });
  await fill(page, { 'nf-motivo': 'Motivo ficticio' });
  await click(page, '[data-act="saveNote"]');
  await expect(toast(page)).toContainText('Borrador guardado');
  expect(newDrafts(log)).toHaveLength(1);
  expect(newDrafts(log)[0]).toMatchObject({ patient_id: P1, appointment_id: null, note_type: 'initial' });
});

test('corte de red: avisa, no guarda, el texto sigue en el formulario y el reintento guarda una vez', async ({ page }) => {
  const log = await mockSupabase(page, 'psychologa');
  await open(page);
  await draftFromAppointment(page);
  log.server.faults.beforeWrite = once(network);
  await click(page, '[data-act="saveNote"]');
  await expect(toast(page)).toContainText('NO se ha guardado');
  expect(newDrafts(log)).toHaveLength(0);
  expect(await value(page, 'nf-resumen')).toBe('Primer párrafo\n\nSegundo párrafo');
  await expect(page.locator('[data-act="saveNote"]')).toBeEnabled();
  await click(page, '[data-act="saveNote"]');
  await expect(toast(page)).toContainText('Borrador guardado');
  expect(newDrafts(log)).toHaveLength(1);
});

test('respuesta perdida: la BD guardó, el navegador no lo supo; el reintento no duplica', async ({ page }) => {
  const log = await mockSupabase(page, 'psychologa');
  await open(page);
  await draftFromAppointment(page);
  log.server.faults.afterWrite = once(network);
  await click(page, '[data-act="saveNote"]');
  await expect(toast(page)).toContainText('NO se ha guardado');
  expect(newDrafts(log)).toHaveLength(1);
  await click(page, '[data-act="saveNote"]');
  await expect(toast(page)).toContainText('Borrador guardado');
  expect(newDrafts(log)).toHaveLength(1);
  expect(rpc(log)).toHaveLength(1);
  // Al cerrar, la lista muestra un solo borrador para esa cita
  await act(page, 'closeEditor');
  await act(page, 'goNotes', { f: 'todas' });
  await expect(page.locator('#view tr.click', { hasText: 'Nota de sesión' })).toHaveCount(3);   // firmada, borrador previo y la nueva
});

test('sesión caducada: se renueva y guarda; si no se puede, avisa y conserva el texto', async ({ page }) => {
  const log = await mockSupabase(page, 'psychologa');
  await open(page);
  await draftFromAppointment(page);
  log.server.faults.expired = true;
  await click(page, '[data-act="saveNote"]');
  await expect(toast(page)).toContainText('Borrador guardado');
  expect(log.requests.some(r => r.path.startsWith('/auth/v1/token'))).toBe(true);
  expect(newDrafts(log)).toHaveLength(1);

  await fill(page, { 'nf-plan': 'Cambio sin guardar' });
  log.server.faults.expired = true; log.refreshOk = false;
  await click(page, '[data-act="saveNote"]');
  await expect(toast(page)).toContainText('sesión ha caducado');
  expect(fieldsOf(newDrafts(log)[0]).plan).toBe('');
  expect(await value(page, 'nf-plan')).toBe('Cambio sin guardar');
});

test('nota firmada: no se puede editar, firmar ni rectificar desde este modo', async ({ page }) => {
  const log = await mockSupabase(page, 'psychologa');
  await open(page);
  const before = JSON.stringify(log.server.db.clinical_notes);
  await act(page, 'openNote', { id: N_SIGNED });
  await expect(page.locator('[data-act="saveNote"]')).toHaveCount(0);   // la vista es de solo lectura
  await act(page, 'saveNote', { id: N_SIGNED });                          // forzar la acción
  await expect(toast(page)).toContainText('firmada');
  await act(page, 'rectNote', { id: N_SIGNED });
  await expect(toast(page)).toContainText('todavía no están disponibles');
  // Firmar un borrador tampoco cambia nada: la firma queda fuera de esta fase
  await act(page, 'openNote', { id: N_DRAFT });
  await click(page, '[data-act="signNote"]');
  await expect(toast(page)).toContainText('todavía no está disponible');
  expect(JSON.stringify(log.server.db.clinical_notes)).toBe(before);
  expect(rpc(log)).toHaveLength(0);
});

for (const role of ['recepcion', 'gestoria']) {
  test(`${role}: no ve notas y, aunque cambie la vista a «psicóloga», no puede guardarlas`, async ({ page }) => {
    const log = await mockSupabase(page, role);
    const errors = await open(page);
    expect(log.requests.some(r => r.path.startsWith('/rest/v1/clinical_notes'))).toBe(false);
    await page.evaluate(() => { const s = document.getElementById('role3'); s.value = 'psicologa'; s.dispatchEvent(new Event('change', { bubbles: true })); });
    await act(page, 'newDoc', { t: 'inicial', p: P1 });
    if (role === 'recepcion') {
      // Recepción ve pacientes, así que el editor se abre; el guardado lo rechaza el rol real de la sesión.
      await expect(page.locator('[data-act="saveNote"]')).toBeVisible();
      await fill(page, { 'nf-motivo': 'Texto ficticio' });
      await click(page, '[data-act="saveNote"]');
      await expect(toast(page)).toContainText('no tiene permiso');
      expect(errors).toEqual([]);
    } else {
      // Gestoría no puede leer pacientes: el editor ni siquiera llega a abrirse.
      await expect(page.locator('[data-act="saveNote"]')).toHaveCount(0);
    }
    expect(log.requests.filter(r => r.method !== 'GET')).toEqual([]);
    expect(log.server.db.clinical_notes.filter(n => n.content.includes('Texto ficticio'))).toEqual([]);
  });
}

test('paciente de otra consulta o cita de otro paciente: se rechaza sin llamar a la RPC', async ({ page }) => {
  const log = await mockSupabase(page, 'psychologa');
  const errors = await open(page);
  // La cita pasa a otro paciente (otra sesión la reasignó) mientras el editor estaba abierto
  await draftFromAppointment(page);
  log.server.db.appointments.find(a => a.id === A_PAST).patient_id = P1;
  await click(page, '[data-act="saveNote"]');
  await expect(toast(page)).toContainText('no corresponde a este paciente');
  expect(await value(page, 'nf-objetivos')).toBe('Objetivo ficticio');
  // El paciente deja de ser de esta consulta (su fila es ahora de otra): tampoco se guarda
  const p2 = log.server.db.patients.find(p => p.id === P2);
  log.server.db.appointments.find(a => a.id === A_PAST).patient_id = P2;
  p2.org_id = ORG2;
  await click(page, '[data-act="saveNote"]');
  await expect(toast(page)).toContainText('no pertenece a tu consulta');
  expect(await value(page, 'nf-objetivos')).toBe('Objetivo ficticio');
  expect(rpc(log)).toHaveLength(0);
  expect(newDrafts(log)).toHaveLength(0);
  expect(errors).toEqual([]);
});

test('lo que se escribe mientras se guarda no se pierde: queda en el editor como cambio pendiente', async ({ page }) => {
  const log = await mockSupabase(page, 'psychologa');
  await open(page);
  await draftFromAppointment(page);
  // La RPC tarda: mientras, la psicóloga sigue escribiendo
  let release;
  const gate = new Promise(r => { release = r; });
  const original = log.server.request;
  log.server.request = async (path, o) => { if (path.startsWith('rpc/')) await gate; return original(path, o); };
  await click(page, '[data-act="saveNote"]');
  await fill(page, { 'nf-plan': 'Escrito durante el guardado' });
  release();
  await expect(toast(page)).toContainText('Borrador guardado');
  expect(fieldsOf(newDrafts(log)[0]).plan).toBe('');                    // lo guardado es lo que se envió
  await expect(page.locator('#nf-plan')).toHaveValue('Escrito durante el guardado');
  await click(page, '[data-act="saveNote"]');
  await expect(toast(page)).toContainText('Borrador guardado');
  expect(fieldsOf(newDrafts(log)[0]).plan).toBe('Escrito durante el guardado');
  expect(newDrafts(log)).toHaveLength(1);
});
