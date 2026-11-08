// Cliente REST mínimo para Supabase. No contiene claves secretas: la publishable key
// es pública y la seguridad real depende de Auth + RLS en PostgreSQL.
const URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const SESSION_KEY = 'kovo.auth.session.v1';

export function isSupabaseConfigured() { return Boolean(URL && KEY); }
export function readSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
}
export function writeSession(session) {
  if (!session) sessionStorage.removeItem(SESSION_KEY);
  else sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}
export function supabaseRequest(path, { method='GET', body, headers={}, token } = {}) {
  if (!isSupabaseConfigured()) throw new Error('Falta configurar Supabase. Revisa las variables VITE_SUPABASE_*.');
  const session = token ? null : readSession();
  const accessToken = token || session?.access_token;
  return fetch(`${URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${accessToken || KEY}`,
      'Content-Type': 'application/json',
      ...headers
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  }).then(async response => {
    const text = await response.text();
    const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
    if (!response.ok) {
      const error = new Error(data?.message || data?.msg || `Supabase respondió HTTP ${response.status}`);
      error.status = response.status; error.details = data;
      throw error;
    }
    return data;
  });
}
export async function authRequest(path, { method='POST', body, token } = {}) {
  if (!isSupabaseConfigured()) throw new Error('Falta configurar Supabase. Revisa las variables VITE_SUPABASE_*.');
  const response = await fetch(`${URL}/auth/v1/${path}`, {
    method,
    headers: {
      apikey: KEY,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const text = await response.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!response.ok) {
    const error = new Error(data?.msg || data?.message || `Autenticación: HTTP ${response.status}`);
    error.status = response.status; error.details = data;
    throw error;
  }
  return data;
}
