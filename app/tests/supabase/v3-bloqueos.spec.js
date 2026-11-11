// Interfaz v3 en modo conectado: lo que el prototipo añade y el servidor aún no guarda
// (usuarios de ejemplo, dictado/IA, recordatorio «próxima sesión», correos) no debe parecer que
// funciona: avisa y no envía ni guarda nada. Lo ya conectado (vacaciones, mover, series,
// diagnósticos y pruebas, gastos fijos, rol «solo calendario») se prueba contra la pila real
// (tests/stack/journeys.spec.js).
import { test, expect } from '@playwright/test';
import { BLOCKED } from '../../src/saas/connected.js';
import { mockSupabase, open, click, act } from './helpers.js';

const toast = page => page.locator('#toast');
const NUEVAS = ['dictMic', 'dictAI', 'dictUndo', 'userForm', 'userSave', 'userDel', 'userAs',
  'patientYes', 'patientNo', 'dailyNow'];

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

test('no aparecen controles de la demo: usuarios de ejemplo, dictado ni «próxima sesión»; sí los ya conectados', async ({ page }) => {
  const log = await mockSupabase(page, 'psychologa');
  const errors = await open(page);
  // Sin selector de usuario de ejemplo
  await expect(page.locator('#role3')).toHaveCount(0);
  await expect(page.locator('#role')).toBeHidden();
  // Ajustes: sin pestaña de usuarios de ejemplo; en Horario, el formulario de días cerrados (conectado)
  await click(page, '[data-act="pmenu"]');
  await click(page, '#pmenu [data-act="goSettings"]');
  await expect(page.locator('[data-act="ctab"][data-t="usuarios"]')).toHaveCount(0);
  await click(page, '[data-act="ctab"][data-t="horario"]');
  await expect(page.locator('[data-act="blockAdd"]')).toHaveCount(1);
  // Nueva cita: con «repetir» (series conectadas)
  await act(page, 'newAppt');
  await expect(page.locator('.mod')).toBeVisible();
  await expect(page.locator('#f-rep')).toHaveCount(1);
  await click(page, '[data-act="close"]');
  // Editor de informe: sin dictado, sin IA y sin el apartado que el servidor no conoce
  await click(page, '[data-act="go"][data-v="informes"]');
  await click(page, '#view .nt-row [data-act="openNote"]');
  await expect(page.locator('.doc')).toBeVisible();
  await expect(page.locator('#nf-proxima')).toHaveCount(0);
  await expect(page.locator('[data-act="dictMic"], [data-act="dictAI"]')).toHaveCount(0);
  expect(errors, errors.join('\n')).toEqual([]);
  expect(log.requests.filter(r => r.method !== 'GET' && !r.path.includes('/auth/')).length).toBe(0);
});
