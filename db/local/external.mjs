// KOVO — adaptador para una pila Supabase LOCAL ya arrancada por otro medio (en CI: `supabase start`
// en Docker, en un directorio temporal, nunca enlazado a un proyecto). Ofrece la misma interfaz que
// startStack() para que pgTAP, HTTP, concurrencia y E2E se ejecuten igual.
//
// Variables (las imprime `supabase status -o env`; se copian con nombres KOVO_EXT_* para no activar
// la protección de clinical-db/local/env.mjs contra variables de proyectos alojados):
//   KOVO_EXT_URL        p. ej. http://127.0.0.1:54321
//   KOVO_EXT_ANON       clave anon local
//   KOVO_EXT_SERVICE    clave service_role local
//   KOVO_EXT_DB_URL     postgresql://postgres:postgres@127.0.0.1:54322/postgres
//   KOVO_EXT_JWT_SECRET secreto JWT local (para las pruebas de tokens falsificados o caducados)
// Se niega a funcionar si la URL o la base de datos no son locales.
import { pg } from '../../clinical-db/local/env.mjs';

const LOCAL = /^(127\.0\.0\.1|localhost|\[::1\])$/;

export async function connectExternalStack({ log = () => {}, schema = async () => {} } = {}) {
  const url = (process.env.KOVO_EXT_URL || '').replace(/\/$/, '');
  const anonKey = process.env.KOVO_EXT_ANON, serviceKey = process.env.KOVO_EXT_SERVICE, dbUrl = process.env.KOVO_EXT_DB_URL;
  if (!url || !anonKey || !serviceKey || !dbUrl) throw new Error('Faltan KOVO_EXT_URL, KOVO_EXT_ANON, KOVO_EXT_SERVICE o KOVO_EXT_DB_URL.');
  if (!LOCAL.test(new URL(url).hostname)) throw new Error(`KOVO_EXT_URL no es local (${new URL(url).hostname}). Solo pilas locales.`);
  if (!LOCAL.test(new URL(dbUrl).hostname)) throw new Error('KOVO_EXT_DB_URL no es local. Solo pilas locales.');
  const connect = async () => { const c = new pg.Client({ connectionString: dbUrl }); await c.connect(); return c; };
  const admin = await connect();
  const env = { dir: null, port: Number(new URL(dbUrl).port), password: null, admin, url: null, client: connect, external: true,
    async stop() { try { await admin.end(); } catch {} } };
  log(`pila Supabase local externa: ${url}`);
  await schema(env);
  // Recargar la caché de esquema de la API (también lo hace el disparador de eventos de Supabase).
  await admin.query(`NOTIFY pgrst, 'reload schema'`);
  await new Promise(r => setTimeout(r, 1500));
  const authFetch = async (path, key, body) => {
    const r = await fetch(`${url}/auth/v1/${path}`, { method: 'POST', headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const json = await r.json();
    if (!r.ok) throw new Error(`${path}: ${r.status} ${JSON.stringify(json)}`);
    return json;
  };
  return {
    env, url, anonKey, serviceKey, secret: process.env.KOVO_EXT_JWT_SECRET || null, external: true,
    rest: { base: `${url}/rest/v1`, secret: process.env.KOVO_EXT_JWT_SECRET || null },
    ports: {},
    async stopServices() { throw new Error('La pila externa no se detiene desde las pruebas.'); },
    async stop() { await env.stop(); },
    createUser: (email, password, meta = {}) => authFetch('admin/users', serviceKey, { email, password, email_confirm: true, user_metadata: meta }),
    signIn: (email, password) => fetch(`${url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: anonKey, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(`signIn ${email}: ${r.status}`); return j; })
  };
}
