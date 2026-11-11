// Escrituras desde la interfaz real (legacy.js) en modo Supabase, contra el servidor simulado con estado.
// Pacientes y citas: alta, edición, cambios de estado, recarga, cortes de red, respuestas perdidas,
// sesión caducada, conflictos y roles. Datos 100 % sintéticos; ninguna petición sale del navegador.
import { test, expect } from '@playwright/test';
import { ORG, uuid } from '../fixtures/supabase-fake.mjs';
import { USER, mockSupabase, open, waitView, click, act, fill } from './helpers.js';

const S1 = uuid(10), P1 = uuid(1), A_SCHED = uuid(31);
const network = () => { throw new TypeError('Failed to fetch'); };
const once = fn => { let done = false; return (...a) => { if (!done) { done = true; fn(...a); } }; };
const newPatientForm = { 'np-n': 'Nueva Paciente Ficticia', 'np-e': 'nueva@correo-ejemplo.test', 'np-t': '600000099', 'np-s': S1, 'np-m': 'online' };
const errorBox = page => page.locator('#np-err');
const writes = log => log.requests.filter(r => r.method !== 'GET');
const newRows = (log, table, org = ORG) => log.server.db[table].filter(r => r.org_id === org && Date.parse(r.created_at) > Date.parse('2026-11-06T00:00:00Z'));

async function createPatient(page, values = newPatientForm) {
  await act(page, 'newPatient');
  await fill(page, values);
  await click(page, '.mod [data-act="savePatient"]');
}

test('psicóloga: alta y edición de paciente, alta y estados de cita, y todo sigue igual al recargar', async ({ page }) => {
  const log = await mockSupabase(page, 'psychologa');
  const errors = await open(page);

  // Alta de paciente: el código lo pone PostgreSQL
  await createPatient(page);
  await expect(page.locator('#toast')).toContainText('Paciente P-00001 creado');
  const [row] = newRows(log, 'patients');
  expect(row).toMatchObject({ first_name: 'Nueva', last_name: 'Paciente Ficticia', email: 'nueva@correo-ejemplo.test', patient_code: 'P-00001', status: 'active', org_id: ORG });
  expect(row.profile_data).toMatchObject({ service: S1, modal: 'online', reminders: true, alta: '2026-11-06' });
  await expect(page.locator('#view')).toContainText('Nueva Paciente Ficticia');

  // Edición
  await act(page, 'editPatient', { id: row.id });
  await fill(page, { 'np-t': '611111111' });
  await click(page, '.mod [data-act="savePatient"]');
  await expect(page.locator('#toast')).toContainText('Datos guardados');
  expect(log.server.db.patients.find(p => p.id === row.id).phone).toBe('611111111');

  // Alta de cita para ese paciente
  await act(page, 'newAppt');
  await fill(page, { 'f-p': row.id, 'f-d': '2026-11-12', 'f-t': '10:00', 'f-s': S1, 'f-dur': '50', 'f-l': 'Despacho' });
  await click(page, '.mod [data-act="saveAppt"]');
  await expect(page.locator('#toast')).toContainText('Cita creada');
  const [appt] = newRows(log, 'appointments');
  expect(appt).toMatchObject({ patient_id: row.id, service_id: S1, professional_id: uuid(20), created_by: USER, starts_at: '2026-11-12T09:00:00.000Z', ends_at: '2026-11-12T09:50:00.000Z', status: 'scheduled' });

  // Confirmar esa cita y cancelar otra
  await act(page, 'openAppt', { id: appt.id });
  await click(page, '.mod [data-act="confirm"]');
  await expect(page.locator('#toast')).toContainText('Cita confirmada');
  await act(page, 'openAppt', { id: A_SCHED });
  await click(page, '.mod [data-act="cancelAppt"]');
  await expect(page.locator('#toast')).toContainText('Cita cancelada');
  expect(log.server.db.appointments.find(a => a.id === appt.id).status).toBe('confirmed');
  expect(log.server.db.appointments.find(a => a.id === A_SCHED).status).toBe('cancelled');

  // Solo POST y PATCH, uno por acción y siempre filtrados por la consulta
  const w = writes(log);
  expect(w.map(r => r.method + ' ' + r.path.split('?')[0])).toEqual([
    'POST /rest/v1/patients', 'PATCH /rest/v1/patients', 'POST /rest/v1/appointments', 'PATCH /rest/v1/appointments', 'PATCH /rest/v1/appointments'
  ]);
  for (const r of w.filter(r => r.method === 'PATCH')) expect(r.path).toContain(`org_id=eq.${ORG}`);

  // Recargar: lo guardado se lee igual
  await page.reload();
  await waitView(page);
  await click(page, '[data-act="go"][data-v="pacientes"]');
  await expect(page.locator('#view')).toContainText('Nueva Paciente Ficticia');
  await expect(page.locator('#view')).toContainText('P-00001');
  await act(page, 'openAppt', { id: appt.id });
  await expect(page.locator('.mod')).toContainText('Confirmada');
  await act(page, 'close');
  await act(page, 'openAppt', { id: A_SCHED });
  await expect(page.locator('.mod')).toContainText('Cancelada');
  expect(newRows(log, 'patients')).toHaveLength(1);
  expect(newRows(log, 'appointments')).toHaveLength(1);
  expect(errors, errors.join('\n')).toEqual([]);
  expect(log.blocked.filter(o => o !== 'https://cdnjs.cloudflare.com')).toEqual([]);
});

test('corte de red: no se da por guardado, el estado no cambia y el reintento guarda una sola vez', async ({ page }) => {
  const log = await mockSupabase(page, 'psychologa');
  const errors = await open(page);
  log.server.faults.beforeWrite = once(network);
  await createPatient(page);
  await expect(errorBox(page)).toBeVisible();
  await expect(errorBox(page)).toContainText('NO se ha guardado');
  await expect(page.locator('.mod')).toBeVisible();                     // el formulario sigue abierto con los datos
  expect(newRows(log, 'patients')).toHaveLength(0);
  await click(page, '[data-act="close"]');
  await click(page, '[data-act="go"][data-v="pacientes"]');
  await expect(page.locator('#view')).not.toContainText('Nueva Paciente Ficticia');
  // Nuevo intento
  await createPatient(page);
  await expect(page.locator('#toast')).toContainText('creado');
  expect(newRows(log, 'patients')).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('respuesta perdida: la BD guardó pero el navegador no lo supo; el reintento no duplica', async ({ page }) => {
  const log = await mockSupabase(page, 'psychologa');
  await open(page);
  log.server.faults.afterWrite = once(network);
  await createPatient(page);
  await expect(errorBox(page)).toContainText('NO se ha guardado');
  expect(newRows(log, 'patients')).toHaveLength(1);                     // sí llegó
  await click(page, '.mod [data-act="savePatient"]');                   // el usuario reintenta
  await expect(page.locator('#toast')).toContainText('Paciente P-00001 creado');
  expect(newRows(log, 'patients')).toHaveLength(1);                     // sin duplicado
  const posts = writes(log).filter(r => r.method === 'POST');
  expect(posts).toHaveLength(2);
  await click(page, '[data-act="go"][data-v="pacientes"]');
  await expect(page.locator('#view .prow', { hasText: 'Nueva Paciente Ficticia' })).toHaveCount(1);
});

test('sesión caducada: se renueva y se guarda; si no se puede renovar, avisa y no guarda', async ({ page }) => {
  const log = await mockSupabase(page, 'psychologa');
  await open(page);
  log.server.faults.expired = true;
  await act(page, 'openAppt', { id: A_SCHED });
  await click(page, '.mod [data-act="confirm"]');
  await expect(page.locator('#toast')).toContainText('Cita confirmada');
  expect(log.server.db.appointments.find(a => a.id === A_SCHED).status).toBe('confirmed');
  expect(log.requests.some(r => r.path.startsWith('/auth/v1/token'))).toBe(true);

  log.server.faults.expired = true; log.refreshOk = false;
  await act(page, 'openAppt', { id: A_SCHED });
  await click(page, '.mod [data-act="cancelAppt"]');
  await expect(page.locator('#toast')).toContainText('sesión ha caducado');
  expect(log.server.db.appointments.find(a => a.id === A_SCHED).status).toBe('confirmed');
});

test('conflicto: si otra persona cambió la ficha, no se pisa su cambio', async ({ page }) => {
  const log = await mockSupabase(page, 'psychologa');
  await open(page);
  await act(page, 'editPatient', { id: P1 });
  Object.assign(log.server.db.patients.find(p => p.id === P1), { phone: '699999999', updated_at: '2026-11-06T12:00:00.000Z' });
  await fill(page, { 'np-t': '611111111' });
  await click(page, '.mod [data-act="savePatient"]');
  await expect(errorBox(page)).toContainText('Otra persona ha modificado');
  expect(log.server.db.patients.find(p => p.id === P1).phone).toBe('699999999');
});

test('recepción guarda pacientes y citas; gestoría no puede', async ({ page, browser }) => {
  const log = await mockSupabase(page, 'recepcion');
  const errors = await open(page);
  await createPatient(page);
  await expect(page.locator('#toast')).toContainText('creado');
  const [row] = newRows(log, 'patients');
  await act(page, 'newAppt');
  await fill(page, { 'f-p': row.id, 'f-d': '2026-11-12', 'f-t': '11:00', 'f-s': S1, 'f-dur': '50' });
  await click(page, '.mod [data-act="saveAppt"]');
  await expect(page.locator('#toast')).toContainText('Cita creada');
  expect(newRows(log, 'appointments')).toHaveLength(1);
  expect(errors).toEqual([]);

  const page2 = await browser.newPage();
  const log2 = await mockSupabase(page2, 'gestoria');
  await open(page2);
  await act(page2, 'newPatient');
  await act(page2, 'newAppt');
  await expect(page2.locator('.mod')).toHaveCount(0);
  expect(writes(log2)).toHaveLength(0);
  await page2.close();
});
