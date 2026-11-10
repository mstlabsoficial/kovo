#!/usr/bin/env node
// KOVO — validation of the consolidated chain on a full DISPOSABLE local Supabase stack
// (PostgreSQL 17 + Supabase Auth + Supabase Storage + PostgREST; db/local/stack.mjs).
//
//   node db/run.mjs              # pgTAP + HTTP (real Auth tokens, real Storage) + concurrency + upgrade + backup/restore
//   node db/run.mjs --e2e        # also the browser journeys (app/tests/stack) against this stack
//   node db/run.mjs --serve      # keep the stack up (prints URL and keys) for manual use of the app
//   node db/run.mjs --only=tap,http   # subset: tap | http | concurrency | upgrade | backup | e2e
//
// Never touches a hosted project. Everything lives in a temp directory deleted at the end.
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { startStack } from './local/stack.mjs';
import { applyKovoSchema } from './schema.mjs';
import { runPgTap, local, ROOT, TOOLS } from '../clinical-db/local/env.mjs';
import { runHttp } from './tests/http.mjs';
import { runConcurrency } from './tests/concurrency.mjs';
import { runUpgrade } from './tests/upgrade.mjs';
import { runBackupRestore } from './tests/backup.mjs';

const args = process.argv.slice(2);
const only = (args.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = k => !only.length || only.includes(k);
const e2e = args.includes('--e2e') || only.includes('e2e');
const serve = args.includes('--serve');
const log = m => console.log(`  · ${m}`);
const summary = [];

function report(name, total, failed, lines = []) {
  summary.push({ name, total, failed });
  console.log(`\n${failed ? '✗' : '✓'} ${name}: ${total - failed}/${total}`);
  for (const l of lines) console.log(`    ${l}`);
}
const tap = (name, t) => report(name, t.planned ?? t.ok + t.notOk.length, t.notOk.length + (t.planned && t.ok + t.notOk.length !== t.planned ? 1 : 0),
  t.lines.filter(l => /^not ok|^#\s+(Failed|got|expected|have|want|\s)/.test(l)).slice(0, 60));
const js = (name, s) => report(name, s.results.length, s.results.filter(r => !r.ok).length,
  s.results.map(r => `${r.ok ? 'ok  ' : 'FALLO'} ${r.label}${r.ok || !r.detail ? '' : ` — ${r.detail}`}`));
async function safe(name, fn, show) {
  try { show(name, await fn()); } catch (e) { report(name, 1, 1, [`abortada: ${e.message}`]); }
}

function runBrowser(stack) {
  return new Promise(ok => {
    const app = join(ROOT, 'app');
    const child = spawn(join(TOOLS, 'node/bin/node'), ['node_modules/@playwright/test/cli.js', 'test', '--config=playwright.stack.config.js'], {
      cwd: app,
      env: { ...process.env, PATH: `${join(TOOLS, 'node/bin')}:${process.env.PATH}`, PLAYWRIGHT_BROWSERS_PATH: join(app, '.playwright-browsers'),
             KOVO_STACK_URL: stack.url, KOVO_STACK_ANON: stack.anonKey, KOVO_STACK_SERVICE: stack.serviceKey },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '';
    child.stdout.on('data', d => { out += d; process.stdout.write(d); }); child.stderr.on('data', d => { out += d; });
    child.on('close', code => {
      const n = re => Number((out.match(re) || [])[1] || 0);
      const passed = n(/(\d+) passed/), failed = n(/(\d+) failed/), skipped = n(/(\d+) skipped/);
      const lines = out.split('\n').filter(l => /✘|Error:|Expected|Received/.test(l)).slice(0, 40).map(l => l.trim());
      ok({ total: passed + failed + skipped, failed: failed + skipped + (code && !failed ? 1 : 0), lines });
    });
  });
}

console.log('\n=== KOVO · cadena consolidada sobre Supabase local completo (Auth + Storage + PostgREST reales) ===');
let stack;
try {
  stack = await startStack({ log, schema: env => applyKovoSchema(env, { log }), gatewayPort: Number(process.env.KOVO_STACK_PORT) || undefined });
  if (want('tap')) {
    await safe('pgTAP · cadena consolidada (códigos, alta, aislamiento, roles, equipo, planes, plataforma, sesiones, cobros, documentos, avisos, pasarela)', async () => {
      const c = await stack.env.client();
      try { await c.query('SET search_path TO public, extensions'); return await runPgTap(c, local('db/tests/saas_test.sql')); } finally { await c.end(); }
    }, tap);
    await safe('pgTAP · módulo clínico v2 sobre la cadena completa', async () => {
      const c = await stack.env.client();
      try { await c.query('SET search_path TO public, extensions'); return await runPgTap(c, local('clinical-db/tests/clinical_notes_test.sql')); } finally { await c.end(); }
    }, tap);
  }
  if (want('http')) await safe('HTTP · Auth + PostgREST + Storage reales (tokens de Supabase Auth)', () => runHttp(stack), js);
  if (want('concurrency')) await safe('Concurrencia · PostgreSQL real', () => runConcurrency(stack), js);
  if (e2e) { const r = await runBrowser(stack); report('E2E · navegador (interfaz real) contra la pila completa', r.total || 1, r.total ? r.failed : 1, r.lines); }
  if (serve) {
    console.log(`\nSupabase local: ${stack.url}\nVITE_SUPABASE_URL=${stack.url}\nVITE_SUPABASE_PUBLISHABLE_KEY=${stack.anonKey}`);
    console.log('Ctrl+C para parar y borrar todo.');
    await new Promise(ok => process.once('SIGINT', ok));
  }
} catch (e) {
  report('Preparación de la pila', 1, 1, [e.message]);
} finally {
  await stack?.stop();
}
if (want('upgrade')) await safe('Migración de datos · base con datos (esquema actual) → cadena consolidada', () => runUpgrade({ log }), js);
if (want('backup')) await safe('Copia de seguridad y restauración (copia física en frío de PostgreSQL + ficheros de Storage)', () => runBackupRestore({ log }), js);

console.log('\n=== Resumen ===');
for (const s of summary) console.log(`${s.failed ? '✗' : '✓'} ${s.name}: ${s.total - s.failed}/${s.total}`);
process.exitCode = summary.some(s => s.failed) ? 1 : 0;
