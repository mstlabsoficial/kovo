import { defineConfig } from '@playwright/test';
import { MOCK_SUPABASE_URL } from './playwright.supabase.config.js';

// B + D · La interfaz real (modo Supabase) contra PostgreSQL 17 + PostgREST 16.5 REALES y locales,
// arrancados y sembrados por clinical-db/run-local.mjs --e2e (nunca un proyecto alojado). Las
// peticiones REST del navegador se reenvían a ese PostgREST con un JWT firmado con su secreto
// local; Supabase Auth (GoTrue) se simula (no hay Docker para levantarlo). Sin KOVO_REAL_REST,
// las pruebas se saltan.
const PORT = 5175;
export default defineConfig({
  testDir: 'tests/real',
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
