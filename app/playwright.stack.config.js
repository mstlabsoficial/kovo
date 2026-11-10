import { defineConfig } from '@playwright/test';

// La interfaz real en modo conectado contra la pila Supabase LOCAL completa y desechable
// (PostgreSQL 17 + Supabase Auth + Supabase Storage + PostgREST), arrancada por `node db/run.mjs --e2e`.
// Nada se simula: registro, sesión, renovación, RLS, Storage y RPC son los de verdad. Sin
// KOVO_STACK_URL las pruebas se saltan. Nunca apunta a un proyecto alojado.
const PORT = 5176;
const URL = process.env.KOVO_STACK_URL || 'http://127.0.0.1:1';
export default defineConfig({
  testDir: 'tests/stack',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: { browserName: 'chromium', locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 1360, height: 860 }, baseURL: `http://localhost:${PORT}/` },
  webServer: {
    command: `node node_modules/vite/bin/vite.js --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { ...process.env, VITE_DATA_MODE: 'supabase', VITE_SUPABASE_URL: URL, VITE_SUPABASE_PUBLISHABLE_KEY: process.env.KOVO_STACK_ANON || 'sin-clave' }
  }
});
