import { defineConfig } from '@playwright/test';

// Prueba de la interfaz en modo Supabase contra una API simulada (tests/fixtures/supabase-fake.mjs).
// La URL de Supabase apunta a un dominio .test inexistente y la prueba intercepta TODAS las peticiones:
// no se conecta a ningún proyecto real. Se lanza con: sh scripts/pw.sh supabase
const PORT = 5174;
export const MOCK_SUPABASE_URL = 'https://kovo-mock.supabase.test';

export default defineConfig({
  testDir: 'tests/supabase',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { browserName: 'chromium', locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 1360, height: 860 }, baseURL: `http://localhost:${PORT}/` },
  webServer: {
    command: `node node_modules/vite/bin/vite.js --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      ...process.env,
      VITE_DATA_MODE: 'supabase',
      VITE_SUPABASE_URL: MOCK_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_mock_solo_pruebas'
    }
  }
});
