import { authRequest, readSession, writeSession, supabaseRequest } from './supabase-client.js';

let currentUser = null;
let refreshPromise = null;

export async function signIn(email, password) {
  if (!email || !password) throw new Error('Introduce correo y contraseña.');
  const session = await authRequest('token?grant_type=password', { body: { email, password } });
  if (!session?.access_token || !session?.user?.id) throw new Error('Supabase no devolvió una sesión válida.');
  writeSession(session);
  currentUser = session.user;
  return currentUser;
}

async function refreshSession(session) {
  if (!session?.refresh_token) return null;
  if (!refreshPromise) {
    refreshPromise = authRequest('token?grant_type=refresh_token', {
      body: { refresh_token: session.refresh_token }
    }).then(next => {
      if (!next?.access_token || !next?.user?.id) throw new Error('Supabase no devolvió una sesión renovada válida.');
      writeSession(next);
      currentUser = next.user;
      return next.user;
    }).catch(() => {
      writeSession(null);
      currentUser = null;
      return null;
    }).finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export async function restoreSession() {
  const session = readSession();
  if (!session?.access_token) return null;
  try {
    const user = await authRequest('user', { method: 'GET', token: session.access_token });
    currentUser = user;
    return user;
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) return refreshSession(session);
    throw error;
  }
}

export async function signOut() {
  const session = readSession();
  try { if (session?.access_token) await authRequest('logout', { token: session.access_token }); }
  finally { writeSession(null); currentUser = null; }
}

export function getCurrentUser() { return currentUser; }

// Renueva el token de acceso con el refresh token guardado. Devuelve el usuario o null si la
// sesión ya no es válida (en ese caso se borra). Lo usan las escrituras tras un 401.
export async function refreshAccessToken() {
  return refreshSession(readSession());
}

export async function getMemberships() {
  const user = currentUser || await restoreSession();
  if (!user) throw new Error('Inicia sesión para continuar.');
  if (!UUID_RE.test(String(user.id || ''))) throw new Error('Supabase no devolvió un usuario válido.');
  // Filtro por usuario obligatorio: la política RLS de memberships deja ver a todos los miembros
  // de la consulta, así que sin él se tomaría el rol de otra persona.
  const rows = await supabaseRequest(`memberships?select=id,org_id,role,active,user_id&user_id=eq.${user.id}&active=eq.true&order=created_at.asc`);
  if (!Array.isArray(rows)) throw new Error('Respuesta inesperada al leer tu perfil.');
  return rows.filter(m => m && m.user_id === user.id);
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getOrganizationContext() {
  const memberships = await getMemberships();
  if (!memberships.length) throw new Error('Tu usuario todavía no pertenece a ninguna consulta.');
  if (memberships.length > 1) throw new Error('Tu usuario pertenece a varias consultas. Selecciona una organización antes de continuar.');
  const membership = memberships[0];
  const orgs = await supabaseRequest(`organizations?select=id,name,is_demo&id=eq.${membership.org_id}&limit=1`);
  if (!orgs.length) throw new Error('No se ha encontrado la organización asignada.');
  return { ...orgs[0], role: membership.role, membershipId: membership.id, userId: membership.user_id };
}
