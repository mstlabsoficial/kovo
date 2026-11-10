#!/usr/bin/env node
// KOVO — disposable local validation of the clinical module on REAL PostgreSQL 17 + PostgREST 16.5.
//
//   node clinical-db/run-local.mjs            # all suites, both scenarios
//   node clinical-db/run-local.mjs --e2e      # also the browser E2E (app/tests/real) against this PostgREST
//   node clinical-db/run-local.mjs --serve    # keep PostgREST up at the end (prints URL) for manual checks
//
// Nothing here touches a hosted Supabase project: the database is created in a temp directory,
// the schema is read with `git show` from the recovery branches (read-only) and everything is
// deleted at the end. Tools (embedded PostgreSQL, PostgREST, pgTAP) are expected in app/.tools
// (see clinical-db/README.md, section 10).
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { startDb, applySql, fromRef, local, runPgTap, startPostgrest, ROOT, TOOLS } from './local/env.mjs';
import { seed } from './tests/fixtures.mjs';
import { runHttp } from './tests/http.mjs';
import { runConcurrency } from './tests/concurrency.mjs';

const BASELINE = ['origin/chore/recover-supabase-migrations', 'supabase/recovered-schema/BASELINE_CANDIDATE_NOT_TESTED.sql'];
const BACKEND = ['origin/docs/backend-gap-design', 'docs/backend/proposed-migrations/PROPOSAL_ONLY_20261108.sql'];
const BACKEND_TAP = ['origin/docs/backend-gap-design', 'supabase/tests/database/kovo_backend_security_test.sql'];
const CLINICAL = 'clinical-db/proposals/20261110_clinical_notes_v2.PROPOSAL.sql';
const CLINICAL_TAP = 'clinical-db/tests/clinical_notes_test.sql';

const serve = process.argv.includes('--serve');
const e2e = process.argv.includes('--e2e');

// B + D: Playwright (app/playwright.real.config.js) with the browser's REST traffic forwarded to
// this PostgREST. Separate process; result read from its summary line.
function runBrowserE2E(rest) {
  return new Promise(ok => {
    const app = join(ROOT, 'app');
    const child = spawn(join(TOOLS, 'node/bin/node'), ['node_modules/@playwright/test/cli.js', 'test', '--config=playwright.real.config.js'], {
      cwd: app, env: { ...process.env, PATH: `${join(TOOLS, 'node/bin')}:${process.env.PATH}`, PLAYWRIGHT_BROWSERS_PATH: join(app, '.playwright-browsers'), KOVO_REAL_REST: rest.base, KOVO_REAL_JWT_SECRET: rest.secret },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '';
    child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { out += d; });
    child.on('close', code => {
      const n = re => Number((out.match(re) || [])[1] || 0);
      const passed = n(/(\d+) passed/), failed = n(/(\d+) failed/), skipped = n(/(\d+) skipped/);
      const lines = out.split('\n').filter(l => /✓|✘|Error:|Expected|Received/.test(l)).slice(0, 30).map(l => l.trim());
      ok({ total: passed + failed + skipped, failed: failed + skipped + (code && !failed ? 1 : 0), lines });
    });
  });
}
const log = m => console.log(`  · ${m}`);
const summary = [];

function report(name, total, failed, lines = []) {
  summary.push({ name, total, failed });
  console.log(`\n${failed ? '✗' : '✓'} ${name}: ${total - failed}/${total}`);
  for (const l of lines) console.log(`    ${l}`);
}
const tap = (name, t) => report(name, t.planned ?? t.ok + t.notOk.length, t.notOk.length + (t.planned && t.ok + t.notOk.length !== t.planned ? 1 : 0),
  t.lines.filter(l => /^not ok|^#\s+(Failed|got|expected|have|want|\s)/.test(l)).slice(0, 40));
const js = s => report(s.name, s.results.length, s.results.filter(r => !r.ok).length,
  s.results.map(r => `${r.ok ? 'ok  ' : 'FALLO'} ${r.label}`));

// Each pgTAP script on its own connection, so role/claims left by one suite cannot leak into the next.
async function tapFresh(env, sql) {
  const c = await env.client();
  try { await c.query('SET search_path TO public, extensions'); return await runPgTap(c, sql); } finally { await c.end(); }
}

// A suite that aborts (uncaught SQL error) is reported as one failure; the next suites still run.
async function safe(name, fn, show) {
  try { show(name, await fn()); } catch (e) { report(name, 1, 1, [`abortada: ${e.message}`]); }
}

async function schema(env, { backend }) {
  await applySql(env.admin, local('clinical-db/local/supabase-shim.sql'), 'shim Supabase local');
  await applySql(env.admin, 'CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions; CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;', 'extensiones');
  await applySql(env.admin, fromRef(...BASELINE), 'baseline recuperado');
  if (backend) await applySql(env.admin, fromRef(...BACKEND), 'propuesta backend 20261108');
}

async function scenario(title, { backend }) {
  console.log(`\n=== ${title} ===`);
  const env = await startDb({ log });
  let rest;
  try {
    await schema(env, { backend });
    if (backend) await safe('C · pgTAP backend (propuesta 20261108, antes de la propuesta clínica)', () => tapFresh(env, fromRef(...BACKEND_TAP)), tap);
    await applySql(env.admin, local(CLINICAL), 'propuesta clínica v2');
    log('propuesta clínica v2 aplicada');
    if (backend) {
      // The backend suite's fixture attaches a note to a *scheduled* appointment (ff…f1), which the
      // clinical proposal forbids on purpose (KN008). Copy adapted in memory only (the protected
      // branch is not modified): ff…f1 is created as completed so it can carry the note, and an
      // equivalent scheduled appointment ff…f5 keeps the professional's slot busy for the
      // overlap tests (completed appointments are outside the exclusion constraint).
      const original = fromRef(...BACKEND_TAP);
      const adapted = original.replace("'2026-11-10 10:00:00+01', '2026-11-10 10:50:00+01', 'scheduled'),\n  ('ffffffff-ffff-ffff-ffff-fffffffffff2'",
        "'2026-11-10 10:00:00+01', '2026-11-10 10:50:00+01', 'completed'),\n" +
        "  ('ffffffff-ffff-ffff-ffff-fffffffffff5', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-ccccccccccc1',\n" +
        "   'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', '2026-11-10 10:00:00+01', '2026-11-10 10:50:00+01', 'scheduled'),\n" +
        "  ('ffffffff-ffff-ffff-ffff-fffffffffff2'");
      if (adapted === original) throw new Error('No se pudo adaptar el fixture de la suite backend');
      // Expected incompatibility, asserted (not hidden): the original fixture must stop exactly at KN008.
      const why = await tapFresh(env, original).then(() => null, e => e);
      report('C · pgTAP backend original + propuesta clínica: se detiene solo por la regla KN008 (incompatibilidad documentada)', 1,
        why?.code === 'KN008' ? 0 : 1, [why ? `${why.code}: ${why.message}` : 'no se detuvo: revisar la regla KN008']);
      await safe('C · pgTAP backend + propuesta clínica (fixture adaptado: nota en cita realizada)', () => tapFresh(env, adapted), tap);
    }
    await safe('C/E · pgTAP clínico (integridad, roles, firma, auditoría)', () => tapFresh(env, local(CLINICAL_TAP)), tap);
    if (!backend) return;
    await seed(env.admin);
    rest = await startPostgrest(env, { log });
    await safe('D/E · PostgREST + JWT (HTTP)', () => runHttp(rest), (_, s) => js(s));
    await safe('F · Concurrencia (PostgreSQL real)', () => runConcurrency(env, rest), (_, s) => js(s));
    if (e2e) { const r = await runBrowserE2E(rest); report('B/D · Navegador (interfaz real) contra PostgREST + PostgreSQL reales', r.total || 1, r.total ? r.failed : 1, r.lines); }
    if (serve) {
      console.log(`\nPostgREST local: ${rest.base}  (secreto JWT local: ${rest.secret})`);
      console.log('Ctrl+C para parar y borrar la base de datos.');
      await new Promise(ok => process.once('SIGINT', ok));
    }
  } catch (e) {
    report(`${title}: error de preparación`, 1, 1, [e.message]);
  } finally {
    rest?.stop();
    await env.stop();
  }
}

await scenario('Escenario 1 · baseline recuperado + propuesta backend + propuesta clínica', { backend: true });
await scenario('Escenario 2 · baseline recuperado + propuesta clínica (sin propuesta backend)', { backend: false });

console.log('\n=== Resumen ===');
for (const s of summary) console.log(`${s.failed ? '✗' : '✓'} ${s.name}: ${s.total - s.failed}/${s.total}`);
process.exitCode = summary.some(s => s.failed) ? 1 : 0;
