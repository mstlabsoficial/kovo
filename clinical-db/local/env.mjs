// Disposable local PostgreSQL 17 (+ optional PostgREST) for KOVO validation.
// Everything lives in a fresh temp directory and is deleted on stop(). Never connects to a
// hosted project: it refuses to run if hosted Supabase credentials are present in the env.
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes, createHmac } from 'node:crypto';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const TOOLS = process.env.KOVO_TOOLS_DIR || join(ROOT, 'app/.tools');
const req = createRequire(join(TOOLS, 'pg/package.json'));
export const pg = req('pg');
const PG_NATIVE = join(TOOLS, 'pg/node_modules/@embedded-postgres/darwin-arm64/native');
const POSTGREST = join(TOOLS, 'postgrest/postgrest');

for (const v of ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_DB_PASSWORD', 'SUPABASE_PROJECT_ID', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_URL', 'SUPABASE_URL']) {
  if (process.env[v]) throw new Error(`Refusing to run with hosted Supabase variable ${v} set.`);
}

export const freePort = () => new Promise((ok, ko) => {
  const s = createServer(); s.unref();
  s.on('error', ko);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); });
});

// File from another branch, read-only (git show). Nothing is copied into this branch.
export function fromRef(ref, path) {
  return execFileSync('git', ['-C', ROOT, 'show', `${ref}:${path}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}
export const local = path => readFileSync(join(ROOT, path), 'utf8');

export async function startDb({ log = () => {} } = {}) {
  const { default: EmbeddedPostgres } = await import(join(TOOLS, 'pg/node_modules/embedded-postgres/dist/index.js'));
  const dir = mkdtempSync(join(tmpdir(), 'kovo-pg-'));
  const port = await freePort();
  const password = randomBytes(12).toString('hex');
  const server = new EmbeddedPostgres({ databaseDir: join(dir, 'data'), user: 'postgres', password, port, persistent: false, onLog: () => {}, onError: () => {} });
  await server.initialise();
  await server.start();
  await server.createDatabase('kovo');
  log(`PostgreSQL 17 local en 127.0.0.1:${port} (${dir})`);
  const url = user => `postgres://${user}@127.0.0.1:${port}/kovo`;
  const admin = new pg.Client({ connectionString: `postgres://postgres:${password}@127.0.0.1:${port}/kovo` });
  await admin.connect();
  const env = {
    dir, port, password, admin, url,
    client: async () => { const c = new pg.Client({ connectionString: `postgres://postgres:${password}@127.0.0.1:${port}/kovo` }); await c.connect(); return c; },
    async stop() {
      try { await admin.end(); } catch {}
      try { await server.stop(); } catch {}
      rmSync(dir, { recursive: true, force: true });
    }
  };
  return env;
}

// Applies one SQL script in a single transaction; reports the failing statement position.
export async function applySql(client, sql, name) {
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    let where = '';
    if (e.position) { const upto = sql.slice(0, Number(e.position)); where = ` (línea ${upto.split('\n').length})`; }
    throw new Error(`${name}${where}: ${e.message}`);
  }
}

// HS256 JWT as Supabase Auth issues them (role, sub, aud, exp). Signed with the local secret only.
export function signJwt(secret, claims) {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ aud: 'authenticated', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, ...claims })}`;
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}

export async function startPostgrest(env, { log = () => {} } = {}) {
  if (!existsSync(POSTGREST)) throw new Error(`PostgREST no encontrado en ${POSTGREST}`);
  const port = await freePort();
  const secret = randomBytes(32).toString('hex');
  const conf = join(env.dir, 'postgrest.conf');
  writeFileSync(conf, [
    `db-uri = "postgres://authenticator:local-only-authenticator@127.0.0.1:${env.port}/kovo"`,
    'db-schemas = "public"', 'db-anon-role = "anon"', `jwt-secret = "${secret}"`,
    `server-host = "127.0.0.1"`, `server-port = ${port}`, 'db-pool = 10', 'log-level = "crit"'
  ].join('\n'));
  const proc = spawn(POSTGREST, [conf], { env: { ...process.env, DYLD_LIBRARY_PATH: join(PG_NATIVE, 'lib') }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  proc.stdout.on('data', d => { output += d; }); proc.stderr.on('data', d => { output += d; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(`${base}/`); if (r.status < 500) { log(`PostgREST 16.5 en ${base}`); return { base, secret, proc, stop: () => proc.kill('SIGTERM') }; } } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  proc.kill('SIGTERM');
  throw new Error(`PostgREST no arrancó: ${output.slice(-2000)}`);
}

// Runs a pgTAP script (it must BEGIN … ROLLBACK itself) and returns the TAP lines.
export async function runPgTap(client, sql) {
  let results;
  try { results = await client.query(sql); } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; }
  const lines = [];
  for (const r of Array.isArray(results) ? results : [results]) {
    for (const row of r.rows || []) for (const v of Object.values(row)) if (typeof v === 'string') lines.push(...v.split('\n'));
  }
  const ok = lines.filter(l => /^ok \d+/.test(l)).length;
  const notOk = lines.filter(l => /^not ok \d+/.test(l));
  const plan = lines.find(l => /^1\.\.\d+/.test(l));
  return { lines, ok, notOk, plan, planned: plan ? Number(plan.split('..')[1]) : null };
}
