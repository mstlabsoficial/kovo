import { authRequest, readSession, writeSession, supabaseRequest } from './supabase-client.js';

let currentUser = null;
export async function signIn(email, password) {
  if (!email || !password) throw new Error('Introduce correo y contraseña.');
  const session = await authRequest('token?grant_type=password', { body: { email, password } });
  if (!session?.access_token || !session?.user?.id) throw new Error('Supabase no devolvió una sesión válida.');
  writeSession(session);
  currentUser = session.user;
  return currentUser;
}
export async function restoreSession() {
  const session = readSession();
  if (!session?.access_token) return null;
  try {
    const user = await authRequest('user', { method: 'GET', token: session.access_token });
    currentUser = user;
    return user;
  } catch {
    writeSession(null); currentUser = null; return null;
  }
}
export async function signOut() {
  const session = readSession();
  try { if (session?.access_token) await authRequest('logout', { token: session.access_token }); }
  finally { writeSession(null); currentUser = null; }
}
export function getCurrentUser() { return currentUser; }
export async function getMemberships() {
  const user = currentUser || await restoreSession();
  if (!user) throw new Error('Inicia sesión para continuar.');
  return supabaseRequest('memberships?select=id,org_id,role,active&active=eq.true&order=created_at.asc');
}
export async function getOrganizationContext() {
  const memberships = await getMemberships();
  if (!memberships.length) throw new Error('Tu usuario todavía no pertenece a ninguna consulta.');
  if (memberships.length > 1) throw new Error('Tu usuario pertenece a varias consultas. Selecciona una organización antes de continuar.');
  const membership = memberships[0];
  const orgs = await supabaseRequest(`organizations?select=id,name,is_demo&id=eq.${membership.org_id}&limit=1`);
  if (!orgs.length) throw new Error('No se ha encontrado la organización asignada.');
  return { ...orgs[0], role: membership.role, membershipId: membership.id };
}
