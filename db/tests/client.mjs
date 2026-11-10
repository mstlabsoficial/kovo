// Minimal HTTP client for the tests: the same endpoints the app uses (/auth/v1, /rest/v1,
// /storage/v1) through the local gateway, with REAL Supabase Auth tokens.
import { signJwt } from '../../clinical-db/local/env.mjs';

export function suite(name) {
  const results = [];
  const check = (label, ok, detail) => { results.push({ label, ok: !!ok, detail: ok ? undefined : detail }); return !!ok; };
  return { name, results, check };
}

export function client(stack) {
  const { url, anonKey, serviceKey, secret } = stack;
  async function call(path, { method = 'GET', token, body, headers = {}, raw } = {}) {
    const h = { apikey: anonKey, ...headers };
    if (token) h.authorization = `Bearer ${token}`;
    let payload = body;
    if (body !== undefined && !raw && !(body instanceof Uint8Array) && typeof body !== 'string') { h['content-type'] = 'application/json'; payload = JSON.stringify(body); }
    const r = await fetch(url + path, { method, headers: h, body: payload });
    const text = await r.text();
    let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return { status: r.status, ok: r.ok, json, text, headers: r.headers };
  }
  const api = {
    call,
    signUp: (email, password, meta = {}) => call('/auth/v1/signup', { method: 'POST', body: { email, password, data: meta } }),
    signIn: (email, password) => call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } }),
    refresh: refresh_token => call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token } }),
    logout: (token, scope = 'local') => call(`/auth/v1/logout?scope=${scope}`, { method: 'POST', token }),
    user: token => call('/auth/v1/user', { token }),
    get: (token, path) => call(`/rest/v1/${path}`, { token }),
    insert: (token, table, row) => call(`/rest/v1/${table}`, { method: 'POST', token, body: row, headers: { prefer: 'return=representation' } }),
    patch: (token, path, body) => call(`/rest/v1/${path}`, { method: 'PATCH', token, body, headers: { prefer: 'return=representation' } }),
    del: (token, path) => call(`/rest/v1/${path}`, { method: 'DELETE', token, headers: { prefer: 'return=representation' } }),
    rpc: (token, fn, args = {}) => call(`/rest/v1/rpc/${fn}`, { method: 'POST', token, body: args }),
    upload: (token, path, bytes, contentType, upsert = false) => call(`/storage/v1/object/kovo-patient-documents/${path}`, {
      method: 'POST', token, body: bytes, raw: true, headers: { 'content-type': contentType, 'x-upsert': String(upsert) } }),
    download: (token, path) => fetch(`${url}/storage/v1/object/authenticated/kovo-patient-documents/${path}`, { headers: { apikey: anonKey, authorization: `Bearer ${token}` } }),
    removeObject: (token, path) => call(`/storage/v1/object/kovo-patient-documents/${path}`, { method: 'DELETE', token }),
    service: serviceKey,
    anon: anonKey,
    forge: claims => signJwt(secret, { role: 'authenticated', ...claims }),
    forgeWrongSecret: claims => signJwt('otro-secreto-que-no-es-el-del-proyecto-0000', { role: 'authenticated', ...claims })
  };
  return api;
}

// Signs up a synthetic user through the public endpoint (auto-confirm is on in the local stack)
// and returns { id, token, refresh, email, password }.
export async function newUser(api, email, password = 'Prueba-sintetica-2026', meta = {}) {
  const r = await api.signUp(email, password, meta);
  if (!r.ok) throw new Error(`signUp ${email}: ${r.status} ${r.text}`);
  return { id: r.json.user.id, token: r.json.access_token, refresh: r.json.refresh_token, email, password };
}

export const minimalPdf = label => new TextEncoder().encode(`%PDF-1.4\n% KOVO prueba sintética ${label}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n`);
