// Ayudas de las pruebas de navegador en modo Supabase. Todas las peticiones al dominio simulado las
// responde el servidor en memoria de tests/fixtures/supabase-fake.mjs; cualquier otra salida externa
// se bloquea. Datos 100 % sintéticos.
import { ORG, uuid, createFakeServer } from '../fixtures/supabase-fake.mjs';
import { MOCK_SUPABASE_URL } from '../../playwright.supabase.config.js';

export const USER = uuid(999);
export const FIXED_NOW = new Date('2026-11-06T11:30:00+01:00');

// Simula Supabase: Auth (/auth/v1/user), memberships y organizations (con la RLS real: se ven todos
// los miembros de la consulta) y las tablas de negocio con createFakeServer (lecturas y escrituras).
export async function mockSupabase(page, role, { failTable = null, server = createFakeServer({ role }) } = {}) {
  const log = { requests: [], blocked: [], server, refreshOk: true };
  const members = [
    { id: uuid(9000), org_id: ORG, user_id: USER, role, active: true },
    { id: uuid(9001), org_id: ORG, user_id: uuid(998), role: role === 'psychologa' ? 'recepcion' : 'psychologa', active: true },
    { id: uuid(9002), org_id: ORG, user_id: uuid(997), role: 'gestoria', active: true }
  ];
  await page.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.hostname === 'localhost') return route.continue();
    if (url.origin !== MOCK_SUPABASE_URL) { log.blocked.push(url.origin); return route.abort(); }
    const method = req.method();
    log.requests.push({ method, path: url.pathname + url.search });
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/auth/v1/user') return json({ id: USER, email: 'usuaria@correo-ejemplo.test' });
    if (url.pathname === '/auth/v1/token') {   // renovación de sesión (auth.js → refreshAccessToken)
      if (!log.refreshOk) return json({ msg: 'Invalid Refresh Token' }, 400);
      server.faults.expired = false;
      return json({ access_token: 'token-renovado', refresh_token: 'refresco-renovado', user: { id: USER } });
    }
    const path = url.pathname.replace('/rest/v1/', '') + url.search;
    const [table] = path.split('?');
    const q = url.searchParams;
    if (method === 'GET' && table === 'memberships') {
      const uid = (q.get('user_id') || '').replace(/^eq\./, '');
      return json(members.filter(m => !uid || m.user_id === uid).map(({ user_id, ...m }) => (q.get('select') || '').includes('user_id') ? { ...m, user_id } : m));
    }
    if (method === 'GET' && table === 'organizations') return json([{ id: ORG, name: 'Consulta Ficticia', is_demo: true }]);
    if (table === failTable) return route.abort('internetdisconnected');
    try {
      const body = method === 'GET' ? undefined : req.postDataJSON();
      return json(await server.request(path, { method, body }), method === 'POST' ? 201 : 200);
    } catch (e) {
      if (e instanceof TypeError) return route.abort('internetdisconnected');   // corte de red simulado
      return json({ code: e.details?.code ?? null, message: e.details?.message ?? e.message }, e.status || 500);
    }
  });
  await page.addInitScript(() => {
    sessionStorage.setItem('kovo.auth.session.v1', JSON.stringify({ access_token: 'token-simulado', refresh_token: 'refresco-simulado', user: { id: '00000000-0000-4000-8000-000000000999' } }));
  });
  return log;
}

export async function open(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto('/');
  await waitView(page);
  return errors;
}
export const waitView = page => page.waitForFunction(() => { const v = document.getElementById('view'); return v && v.children.length > 0 && !v.querySelector('.sk'); });
export const click = (page, sel) => page.evaluate(s => { const el = document.querySelector(s); if (!el) throw new Error('No existe ' + s); el.click(); }, sel).then(() => page.waitForTimeout(100));
// Lanza una acción de la interfaz (data-act) aunque su botón no esté en pantalla.
export const act = (page, name, data = {}) => page.evaluate(([n, d]) => {
  const b = document.createElement('button'); b.dataset.act = n; Object.assign(b.dataset, d); b.hidden = true;
  document.body.appendChild(b); b.click(); b.remove();
}, [name, data]).then(() => page.waitForTimeout(100));
export const fill = (page, values) => page.evaluate(v => { for (const [id, x] of Object.entries(v)) { const el = document.getElementById(id); if (!el) throw new Error('No existe #' + id); if (el.type === 'checkbox') el.checked = x; else el.value = x; } }, values);
