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
  catch { /* sin red: la sesión local se borra igualmente */ }
  finally { writeSession(null); currentUser = null; selectOrg(null); cancelRefresh(); }
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

// Clínica elegida en esta pestaña (una persona puede pertenecer a varias).
const ORG_KEY = 'kovo.org.v1';
export function selectedOrgId() { try { return sessionStorage.getItem(ORG_KEY); } catch { return null; } }
export function selectOrg(id) { try { if (id) sessionStorage.setItem(ORG_KEY, id); else sessionStorage.removeItem(ORG_KEY); } catch {} }

// Mis clínicas con rol, administración, estado de la cuenta y plan (RPC my_organizations, cadena
// consolidada). Devuelve null si el servidor todavía no tiene esa función (esquema anterior).
export async function listMyOrganizations() {
  try {
    const rows = await supabaseRequest('rpc/my_organizations', { method: 'POST', body: {} });
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    if (error?.status === 404 || error?.details?.code === 'PGRST202') return null;
    throw error;
  }
}

export class OrgSelectionError extends Error {
  constructor(code, message, organizations = []) { super(message); this.name = 'OrgSelectionError'; this.code = code; this.organizations = organizations; }
}

export async function getOrganizationContext() {
  const user = currentUser || await restoreSession();
  if (!user) throw new Error('Inicia sesión para continuar.');
  const orgs = await listMyOrganizations();
  if (orgs) {
    if (!orgs.length) throw new OrgSelectionError('none', 'Tu usuario todavía no pertenece a ninguna clínica.');
    const wanted = selectedOrgId();
    const org = orgs.length === 1 ? orgs[0] : orgs.find(o => o.org_id === wanted);
    if (!org) throw new OrgSelectionError('choose', 'Elige la clínica con la que quieres trabajar.', orgs);
    selectOrg(org.org_id);
    return {
      id: org.org_id, name: org.name, is_demo: false, role: org.role, userId: user.id, email: user.email ?? null,
      isAdmin: !!org.is_admin, accountStatus: org.account_status, plan: org.plan_code ?? null,
      subscriptionStatus: org.subscription_status ?? null, trialEndsAt: org.trial_ends_at ?? null,
      cancelAtPeriodEnd: !!org.cancel_at_period_end, organizations: orgs
    };
  }
  // Esquema anterior (sin la cadena consolidada): una sola consulta por usuario.
  const memberships = await getMemberships();
  if (!memberships.length) throw new Error('Tu usuario todavía no pertenece a ninguna consulta.');
  if (memberships.length > 1) throw new Error('Tu usuario pertenece a varias consultas. Selecciona una organización antes de continuar.');
  const membership = memberships[0];
  const rows = await supabaseRequest(`organizations?select=id,name,is_demo&id=eq.${membership.org_id}&limit=1`);
  if (!rows.length) throw new Error('No se ha encontrado la organización asignada.');
  return { ...rows[0], role: membership.role, membershipId: membership.id, userId: membership.user_id, isAdmin: false, accountStatus: 'active', organizations: null };
}

// Alta pública en Supabase Auth. Si el proyecto exige confirmar el correo, no hay sesión todavía.
export async function signUp(email, password, fullName) {
  if (!email || !password) throw new Error('Introduce correo y contraseña.');
  const r = await authRequest('signup', { body: { email, password, data: fullName ? { full_name: fullName } : {} } });
  if (r?.access_token && r?.user?.id) { writeSession(r); currentUser = r.user; return { user: r.user, needsConfirmation: false }; }
  return { user: r?.user ?? r ?? null, needsConfirmation: true };
}

// Correo de recuperación de contraseña (lo envía Supabase Auth con su proveedor de correo).
export async function requestPasswordReset(email, redirectTo) {
  if (!email) throw new Error('Introduce tu correo.');
  await authRequest('recover', { body: { email, ...(redirectTo ? { redirect_to: redirectTo } : {}) } });
}

// Renovación anticipada: un minuto antes de que caduque el token de acceso.
let refreshTimer = null;
export function scheduleRefresh(onExpired = () => {}) {
  clearTimeout(refreshTimer);
  const session = readSession();
  if (!session?.expires_at) return;
  const ms = Math.max(5_000, session.expires_at * 1000 - Date.now() - 60_000);
  refreshTimer = setTimeout(async () => {
    const user = await refreshAccessToken();
    if (user) scheduleRefresh(onExpired); else onExpired();
  }, ms);
}
export function cancelRefresh() { clearTimeout(refreshTimer); refreshTimer = null; }
