// Interfaz v3 en modo conectado: lo que el prototipo añade y el servidor aún no guarda
// (vacaciones, mover citas arrastrando, series, diagnósticos y pruebas, gastos fijos, usuarios de
// ejemplo, dictado/IA, recordatorio «próxima sesión») no debe parecer que funciona:
// avisa y no envía ni guarda nada.
import { test, expect } from '@playwright/test';
import { BLOCKED } from '../../src/saas/connected.js';
import { mockSupabase, open, click, act } from './helpers.js';

const toast = page => page.locator('#toast');
const NUEVAS = ['blockAdd', 'blockDel', 'moveDo', 'cancelSeries', 'dictMic', 'dictAI', 'dictUndo', 'dxForm', 'dxSave', 'dxDel',
  'testForm', 'testSave', 'testDel', 'fxForm', 'fxSave', 'fxDel', 'userForm', 'userSave', 'userDel', 'userAs',
  'patientYes', 'patientNo', 'dailyNow', 'billNow'];

test('las acciones nuevas sin servidor avisan y no escriben nada', async ({ page }) => {
  const log = await mockSupabase(page, 'psychologa');
  const errors = await open(page);
  const before = log.requests.filter(r => r.method !== 'GET').length;
  for (const a of NUEVAS) {
    expect(BLOCKED[a], a).toBeTruthy();
    await act(page, a, { id: 'x' });
    await expect(toast(page), a).toContainText(BLOCKED[a]);
    await expect(page.locator('.mod'), a).toHaveCount(0);
  }
  expect(log.requests.filter(r => r.method !== 'GET').length).toBe(before);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('no aparecen controles de la demo: usuarios de ejemplo, días cerrados, repetición, dictado ni «próxima sesión»', async ({ page }) => {
  const log = await mockSupabase(page, 'psychologa');
  const errors = await open(page);
  // Sin selector de usuario de ejemplo
  await expect(page.locator('#role3')).toHaveCount(0);
  await expect(page.locator('#role')).toBeHidden();
  // Ajustes: sin pestaña de usuarios de ejemplo; en Horario, aviso en lugar del formulario de días cerrados
  await click(page, '[data-act="pmenu"]');
  await click(page, '#pmenu [data-act="goSettings"]');
  await expect(page.locator('[data-act="ctab"][data-t="usuarios"]')).toHaveCount(0);
  await click(page, '[data-act="ctab"][data-t="horario"]');
  await expect(page.locator('#view')).toContainText('Los días cerrados todavía no se guardan en el servidor');
  await expect(page.locator('[data-act="blockAdd"]')).toHaveCount(0);
  // Nueva cita: sin «repetir»
  await act(page, 'newAppt');
  await expect(page.locator('.mod')).toBeVisible();
  await expect(page.locator('#f-rep')).toHaveCount(0);
  await click(page, '[data-act="close"]');
  // Editor de informe: sin dictado, sin IA y sin el apartado que el servidor no conoce
  await click(page, '[data-act="go"][data-v="informes"]');
  await click(page, '#view .nt-row [data-act="openNote"]');
  await expect(page.locator('.doc')).toBeVisible();
  await expect(page.locator('#nf-proxima')).toHaveCount(0);
  await expect(page.locator('[data-act="dictMic"], [data-act="dictAI"]')).toHaveCount(0);
  // Calendario: las citas no se pueden arrastrar
  await click(page, '[data-act="go"][data-v="calendario"]');
  await expect(page.locator('#view [draggable="true"]')).toHaveCount(0);
  expect(errors, errors.join('\n')).toEqual([]);
  expect(log.requests.filter(r => r.method !== 'GET' && !r.path.includes('/auth/')).length).toBe(0);
});
