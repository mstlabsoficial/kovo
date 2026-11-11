// Pruebas visuales: cada pantalla de la versión Vite debe ser idéntica, píxel a píxel,
// a la misma pantalla del original (source/dist/KOVO-v3.html, el prototipo v3 de la interfaz).
//   1) npm run test:baseline  → genera las capturas de referencia desde el ORIGINAL
//   2) npm run test:visual    → compara la versión VITE contra esas capturas
import { test } from '@playwright/test';
import { openApp, go, act, setRole, openSection, typeIn, snap } from '../helpers.js';

test.describe('Psicóloga', () => {
  test('inicio', async ({ page }, ti) => {
    await openApp(page, ti);
    await snap(page, ti, 'inicio');
  });

  test('calendario', async ({ page }, ti) => {
    await openApp(page, ti);
    await go(page, 'calendario');
    await snap(page, ti, 'calendario-semana');
    await act(page, '[data-act="calMode"][data-m="dia"]');
    await snap(page, ti, 'calendario-dia');
    await act(page, '[data-act="calMode"][data-m="mes"]');
    await snap(page, ti, 'calendario-mes');
  });

  test('pacientes y ficha', async ({ page }, ti) => {
    await openApp(page, ti);
    await go(page, 'pacientes');
    await snap(page, ti, 'pacientes');
    await typeIn(page, '#pq', 'lucia');
    await snap(page, ti, 'pacientes-busqueda');
    await act(page, '.prow');
    await snap(page, ti, 'ficha-resumen');
    await act(page, '[data-act="ptab"][data-t="clinico"]');
    await snap(page, ti, 'ficha-clinico');
  });

  test('informes y editor', async ({ page }, ti) => {
    await openApp(page, ti);
    await go(page, 'informes');
    await snap(page, ti, 'informes');
    await act(page, '.nt-list .nt-row .btn');
    await snap(page, ti, 'informe-editor');
  });

  test('seguimiento', async ({ page }, ti) => {
    await openApp(page, ti);
    await go(page, 'seguimiento');
    await snap(page, ti, 'seguimiento');
  });

  test('facturación', async ({ page }, ti) => {
    await openApp(page, ti);
    await go(page, 'contabilidad');
    await snap(page, ti, 'facturacion');
    await openSection(page, 'sec-ingresos');
    await openSection(page, 'sec-gestoria');
    await snap(page, ti, 'facturacion-desplegables');
  });

  test('ajustes y ayuda', async ({ page }, ti) => {
    await openApp(page, ti);
    await act(page, '[data-act="pmenu"]');
    await act(page, '[data-act="goSettings"]');
    await snap(page, ti, 'ajustes');
    await act(page, '[data-act="ctab"][data-t="horario"]');
    await snap(page, ti, 'ajustes-horario');
    await act(page, '[data-act="ctab"][data-t="usuarios"]');
    await snap(page, ti, 'ajustes-usuarios');
    await act(page, '[data-act="ctab"][data-t="ayuda"]');
    await snap(page, ti, 'ajustes-ayuda');
  });

  test('nueva cita', async ({ page }, ti) => {
    await openApp(page, ti);
    await act(page, '[data-act="newAppt"]');
    await snap(page, ti, 'modal-nueva-cita');
  });
});

test.describe('Otros roles', () => {
  test('recepción', async ({ page }, ti) => {
    await openApp(page, ti);
    await setRole(page, 'recepcion');
    await snap(page, ti, 'recepcion-inicio');
    await go(page, 'contabilidad');
    await snap(page, ti, 'recepcion-facturacion');
  });

  test('gestoría', async ({ page }, ti) => {
    await openApp(page, ti);
    await setRole(page, 'gestoria');
    await snap(page, ti, 'gestoria-facturacion');
  });

  test('solo calendario', async ({ page }, ti) => {
    await openApp(page, ti);
    await setRole(page, 'agenda');
    await snap(page, ti, 'agenda-calendario');
  });
});
