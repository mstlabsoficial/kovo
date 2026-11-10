// KOVO — full DISPOSABLE local Supabase stack, without Docker:
//   PostgreSQL 17 (embedded) + Supabase Auth/GoTrue v2.197.0 + Supabase Storage v1.30.0 (file
//   backend) + PostgREST 16.5, all sharing one random HS256 JWT secret, plus a tiny gateway that
//   exposes them under one origin like Supabase does (/auth/v1, /rest/v1, /storage/v1).
//
// Everything runs on 127.0.0.1 in a temp directory deleted on stop(). Never connects to a hosted
// project (env.mjs refuses to start if hosted Supabase variables are present). The binaries live in
// app/.tools (outside Git); see db/README.md.
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import { randomBytes } from 'node:crypto';
import { startDb, applySql, freePort, signJwt, local, TOOLS } from '../../clinical-db/local/env.mjs';

const GOTRUE = join(TOOLS, 'gotrue/auth');
const STORAGE = join(TOOLS, 'storage130');
const POSTGREST = join(TOOLS, 'postgrest/postgrest');
const PG_LIB = join(TOOLS, 'pg/node_modules/@embedded-postgres/darwin-arm64/native/lib');
const NODE = join(TOOLS, 'node/bin/node');

function proc(name, cmd, args, opts) {
  const p = spawn(cmd, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  const keep = d => { out = (out + d).slice(-20000); };
  p.stdout.on('data', keep); p.stderr.on('data', keep);
  // SIGKILL fallback: Storage does not always exit on SIGTERM once its database is gone.
  const stop = () => { try { p.kill('SIGTERM'); } catch {} setTimeout(() => { if (p.exitCode === null) try { p.kill('SIGKILL'); } catch {} }, 1500).unref(); };
  return { p, name, output: () => out, stop };
}

function run(cmd, args, opts) {
  return new Promise((ok, ko) => {
    const p = spawn(cmd, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { out += d; });
    p.on('close', code => code === 0 ? ok(out) : ko(new Error(`${cmd} ${args.join(' ')} → ${code}\n${out.slice(-3000)}`)));
  });
}

async function waitHttp(url, svc, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(url); if (r.status < 500) return; } catch {}
    if (svc && svc.p.exitCode !== null) break;
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error(`${svc?.name || url} no arrancó:\n${svc?.output().slice(-3000) || ''}`);
}

// Single-origin gateway (what Kong does in Supabase): /auth/v1 → GoTrue, /rest/v1 → PostgREST,
// /storage/v1 → Storage. Adds CORS so the Vite app on another port can call it.
function gateway(port, routes) {
  const server = createServer((req, res) => {
    const cors = {
      'access-control-allow-origin': req.headers.origin || '*',
      'access-control-allow-headers': req.headers['access-control-request-headers'] || '*',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD',
      'access-control-expose-headers': 'content-range,content-type,content-length,x-kovo-request',
      'access-control-max-age': '600'
    };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    const hit = Object.entries(routes).find(([prefix]) => req.url.startsWith(prefix));
    if (!hit) { res.writeHead(404, cors); return res.end('{"message":"no route"}'); }
    const [prefix, target] = hit;
    const headers = { ...req.headers };
    delete headers.host;
    const up = httpRequest({ host: '127.0.0.1', port: target, path: req.url.slice(prefix.length) || '/', method: req.method, headers }, r => {
      res.writeHead(r.statusCode, { ...r.headers, ...cors });
      r.pipe(res);
    });
    up.on('error', e => { res.writeHead(502, cors); res.end(JSON.stringify({ message: e.message })); });
    req.pipe(up);
  });
  return new Promise(ok => server.listen(port, '127.0.0.1', () => ok(server)));
}

/**
 * Starts the whole stack and applies `schema(env)` between the services' own migrations and
 * PostgREST start. Returns URLs, keys and helpers. Call stop() to delete everything.
 */
export async function startStack({ log = () => {}, schema = async () => {}, gatewayPort } = {}) {
  for (const f of [GOTRUE, POSTGREST, join(STORAGE, 'dist/start/server.js')]) {
    if (!existsSync(f)) throw new Error(`Falta ${f}. Ver db/README.md (herramientas locales).`);
  }
  const env = await startDb({ log });
  const services = [];
  let gw;
  const stopServices = async () => {
    gw?.close(); gw = null;
    for (const s of services.splice(0).reverse()) s.stop();
    await new Promise(r => setTimeout(r, 200));
  };
  const stop = async () => {
    await stopServices();
    await env.stop();
  };
  try {
    const secret = randomBytes(32).toString('hex');
    const anonKey = signJwt(secret, { role: 'anon', iss: 'supabase-local', exp: Math.floor(Date.now() / 1000) + 86400, aud: undefined });
    const serviceKey = signJwt(secret, { role: 'service_role', iss: 'supabase-local', exp: Math.floor(Date.now() / 1000) + 86400, aud: undefined });
    await applySql(env.admin, local('db/local/roles.sql'), 'roles locales');

    // 1 · Supabase Auth: its own migrations create auth.* (users, sessions, refresh_tokens, …).
    const authPort = await freePort();
    const authEnv = {
      PATH: process.env.PATH,
      GOTRUE_DB_DRIVER: 'postgres',
      DATABASE_URL: `postgres://supabase_auth_admin:local-only-auth-admin@127.0.0.1:${env.port}/kovo?sslmode=disable`,
      GOTRUE_DB_NAMESPACE: 'auth',
      GOTRUE_JWT_SECRET: secret,
      GOTRUE_JWT_EXP: process.env.KOVO_LOCAL_JWT_EXP || '3600',
      GOTRUE_JWT_AUD: 'authenticated',
      GOTRUE_JWT_DEFAULT_GROUP_NAME: 'authenticated',
      GOTRUE_JWT_ADMIN_ROLES: 'service_role',
      GOTRUE_SITE_URL: 'http://localhost:5173',
      GOTRUE_URI_ALLOW_LIST: 'http://localhost:*',
      API_EXTERNAL_URL: 'http://127.0.0.1',
      GOTRUE_API_HOST: '127.0.0.1',
      PORT: String(authPort),
      GOTRUE_DISABLE_SIGNUP: 'false',
      GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true',
      GOTRUE_MAILER_AUTOCONFIRM: 'true',
      GOTRUE_SMTP_HOST: '', GOTRUE_SMTP_PORT: '0',
      GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED: 'true',
      GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL: '0',
      GOTRUE_PASSWORD_MIN_LENGTH: '10',
      GOTRUE_RATE_LIMIT_TOKEN_REFRESH: '10000',
      GOTRUE_RATE_LIMIT_VERIFY: '10000',
      GOTRUE_RATE_LIMIT_EMAIL_SENT: '10000',
      GOTRUE_LOG_LEVEL: 'error'
    };
    await run(GOTRUE, ['migrate'], { cwd: join(TOOLS, 'gotrue'), env: authEnv });
    const auth = proc('Supabase Auth (GoTrue)', GOTRUE, ['serve'], { cwd: join(TOOLS, 'gotrue'), env: authEnv });
    services.push(auth);
    await waitHttp(`http://127.0.0.1:${authPort}/health`, auth);
    log(`Supabase Auth v2.197.0 en 127.0.0.1:${authPort}`);

    // 2 · Supabase Storage (file backend): its own migrations create storage.* and its functions.
    const storagePort = await freePort();
    const files = join(env.dir, 'storage-files');
    mkdirSync(files, { recursive: true });
    const storage = proc('Supabase Storage', NODE, ['dist/start/server.js'], {
      cwd: STORAGE,
      env: {
        PATH: process.env.PATH, NODE_ENV: 'production',
        SERVER_PORT: String(storagePort), SERVER_HOST: '127.0.0.1', SERVER_ADMIN_PORT: String(await freePort()),
        DATABASE_URL: `postgres://supabase_storage_admin:local-only-storage-admin@127.0.0.1:${env.port}/kovo`,
        DB_INSTALL_ROLES: 'false', DB_SUPER_USER: 'supabase_storage_admin',
        AUTH_JWT_SECRET: secret, AUTH_JWT_ALGORITHM: 'HS256', ANON_KEY: anonKey, SERVICE_KEY: serviceKey,
        STORAGE_BACKEND: 'file', STORAGE_FILE_BACKEND_PATH: files, GLOBAL_S3_BUCKET: 'kovo-local', TENANT_ID: 'kovo-local', REGION: 'local',
        FILE_SIZE_LIMIT: String(50 * 1024 * 1024), UPLOAD_FILE_SIZE_LIMIT: String(50 * 1024 * 1024),
        IMAGE_TRANSFORMATION_ENABLED: 'false', PG_QUEUE_ENABLE: 'false', RATE_LIMITER_ENABLED: 'false', LOG_LEVEL: 'error',
        PGRST_JWT_SECRET: secret
      }
    });
    services.push(storage);
    await waitHttp(`http://127.0.0.1:${storagePort}/status`, storage, 60000);
    log(`Supabase Storage v1.30.0 en 127.0.0.1:${storagePort} (ficheros en ${files})`);

    // 3 · KOVO schema (baseline + proposals + db/migrations), applied by the caller.
    await schema(env);

    // 4 · PostgREST over the final schema.
    const restPort = await freePort();
    const conf = join(env.dir, 'postgrest.conf');
    writeFileSync(conf, [
      `db-uri = "postgres://authenticator:local-only-authenticator@127.0.0.1:${env.port}/kovo"`,
      'db-schemas = "public"', 'db-anon-role = "anon"', `jwt-secret = "${secret}"`,
      'server-host = "127.0.0.1"', `server-port = ${restPort}`, 'db-pool = 10', 'log-level = "crit"'
    ].join('\n'));
    const rest = proc('PostgREST', POSTGREST, [conf], { env: { ...process.env, DYLD_LIBRARY_PATH: PG_LIB } });
    services.push(rest);
    await waitHttp(`http://127.0.0.1:${restPort}/`, rest);
    log(`PostgREST 16.5 en 127.0.0.1:${restPort}`);

    const port = gatewayPort || await freePort();
    gw = await gateway(port, { '/auth/v1': authPort, '/rest/v1': restPort, '/storage/v1': storagePort });
    const url = `http://127.0.0.1:${port}`;
    log(`Pasarela local (como Supabase) en ${url}`);
    return {
      env, url, secret, anonKey, serviceKey, stop, stopServices,
      rest: { base: `http://127.0.0.1:${restPort}`, secret },
      ports: { auth: authPort, storage: storagePort, rest: restPort, gateway: port },
      // Supabase Auth admin API with the service key (server-side only: tests and seeding).
      async createUser(email, password, meta = {}) {
        const r = await fetch(`${url}/auth/v1/admin/users`, {
          method: 'POST', headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({ email, password, email_confirm: true, user_metadata: meta })
        });
        const body = await r.json();
        if (!r.ok) throw new Error(`createUser ${email}: ${r.status} ${JSON.stringify(body)}`);
        return body;
      },
      async signIn(email, password) {
        const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
          method: 'POST', headers: { apikey: anonKey, 'content-type': 'application/json' }, body: JSON.stringify({ email, password })
        });
        const body = await r.json();
        if (!r.ok) throw new Error(`signIn ${email}: ${r.status} ${JSON.stringify(body)}`);
        return body;
      }
    };
  } catch (e) {
    await stop();
    throw e;
  }
}
