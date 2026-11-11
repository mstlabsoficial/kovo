// Prueba de funcionamiento: recorre las secciones y acciones principales de la versión Vite
// y falla si aparece cualquier error de JavaScript.
import { test, expect } from '@playwright/test';
import { openApp, go, act, setRole, openSection, typeIn } from '../helpers.js';

test('las secciones principales funcionan sin errores', async ({ page }, ti) => {
  const errors = await openApp(page, ti);
  const viewText = () => page.locator('#view').innerText();

  await expect(page.locator('#nav [data-act="go"]')).toHaveCount(6);
  await expect(page.locator('#car .next').first()).toBeVisible();

  for (const v of ['calendario', 'pacientes', 'informes', 'seguimiento', 'contabilidad', 'inicio']) {
    await go(page, v);
    expect((await viewText()).length, `vista ${v}`).toBeGreaterThan(300);
  }

  // Calendario: tres vistas
  await go(page, 'calendario');
  for (const m of ['dia', 'mes', 'semana']) await act(page, `[data-act="calMode"][data-m="${m}"]`);
  await expect(page.locator('.wmap .wm-c.busy').first()).toBeVisible();

  // Pacientes: búsqueda por nombre y ficha con todas sus pestañas
  await go(page, 'pacientes');
  await typeIn(page, '#pq', 'lucia');
  await expect(page.locator('.prow .pm b')).toHaveText(['Lucía Romero Vega']);
  await act(page, '.prow');
  const ptabs = await page.locator('.ptabs [data-act="ptab"]').evaluateAll(b => b.map(x => x.dataset.t));
  expect(ptabs).toContain('clinico');
  for (const t of [...ptabs, 'resumen']) await act(page, `.ptabs [data-act="ptab"][data-t="${t}"]`);
  await expect(page.locator('.fhead h1')).toHaveText('Lucía Romero Vega');

  // Informes: abrir el editor y volver
  await go(page, 'informes');
  await act(page, '[data-act="nfilter"][data-f="firmada"]');
  await act(page, '[data-act="nfilter"][data-f="pendientes"]');
  await act(page, '.nt-list .nt-row .btn');
  await expect(page.locator('.doc')).toBeVisible();
  await act(page, '[data-act="closeEditor"]');

  // Facturación: desplegables y nueva factura
  await go(page, 'contabilidad');
  await openSection(page, 'sec-ingresos');
  await openSection(page, 'sec-gestoria');
  await expect(page.locator('.acc-bd')).toHaveCount(2);   // en v3 ningún desplegable viene abierto
  await act(page, '[data-act="newInvoice"]');
  await expect(page.locator('.mod')).toBeVisible();
  await act(page, '[data-act="close"]');

  // Nueva cita con buscador de paciente
  await go(page, 'inicio');
  await act(page, '[data-act="newAppt"]');
  await typeIn(page, '#f-pq', 'marta');
  await expect(page.locator('#f-plist .combo-it')).toHaveCount(1);
  await act(page, '[data-act="close"]');

  // Menú de perfil y ajustes
  await act(page, '[data-act="pmenu"]');
  await act(page, '[data-act="goSettings"]');
  await expect(page.locator('.tabs button')).toHaveCount(8);
  for (const t of ['usuarios', 'horario', 'comms', 'auto']) await act(page, `[data-act="ctab"][data-t="${t}"]`);
  // Vacaciones y festivos: añadir y quitar un día cerrado (demo)
  await act(page, '[data-act="ctab"][data-t="horario"]');
  const blocks = await page.locator('#sec-blocks .blk').count();
  await act(page, '[data-act="blockAdd"]');
  await expect(page.locator('#sec-blocks .blk')).toHaveCount(blocks + 1);

  // Roles: lo que ve cada uno en el menú
  await setRole(page, 'recepcion');
  await expect(page.locator('#nav [data-act="go"]')).toHaveCount(4);
  await setRole(page, 'gestoria');
  await expect(page.locator('#nav [data-act="go"]')).toHaveCount(1);
  await setRole(page, 'agenda');
  await expect(page.locator('#nav [data-act="go"]')).toHaveCount(1);
  await expect(page.locator('.wmap, .dl-row, .cal').first()).toBeVisible();
  await setRole(page, 'psicologa');

  expect(errors, 'errores de JavaScript').toEqual([]);
});
