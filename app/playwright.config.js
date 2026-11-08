import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// La versión original se abre directamente desde source/dist (solo lectura).
const ORIGINAL_URL = pathToFileURL(path.resolve('..', 'source', 'dist', 'Sesiona.html')).href;
const VITE_URL = 'http://localhost:5173/';

const desktop = { viewport: { width: 1360, height: 860 } };
const movil = { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

export default defineConfig({
  testDir: 'tests',
  // tests/supabase usa su propia configuración (playwright.supabase.config.js).
  testIgnore: ['supabase/**'],
  // Sin el nombre del proyecto en la ruta: original y Vite comparan contra las MISMAS capturas.
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  expect: { toHaveScreenshot: { maxDiffPixels: 0, animations: 'disabled' } },
  use: {
    browserName: 'chromium',
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    reducedMotion: 'reduce',
    colorScheme: 'light',
    deviceScaleFactor: 1
  },
  projects: [
    { name: 'original', metadata: { url: ORIGINAL_URL }, use: { ...desktop } },
    { name: 'original-movil', metadata: { url: ORIGINAL_URL }, use: { ...movil } },
    { name: 'vite', metadata: { url: VITE_URL }, use: { ...desktop } },
    { name: 'vite-movil', metadata: { url: VITE_URL }, use: { ...movil } }
  ],
  webServer: {
    command: 'npm run dev',
    url: VITE_URL,
    reuseExistingServer: true,
    timeout: 60_000
  }
});
