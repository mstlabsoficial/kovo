// La interfaz real (legacy.js) en modo Supabase con una API simulada y datos sintéticos.
// Comprueba que cada rol carga sus datos, recorre todas sus secciones sin errores de JavaScript
// y que solo se hacen lecturas. Cualquier petición fuera de localhost y del dominio simulado se bloquea.
import { test, expect } from '@playwright/test';
import { ORG, ORG2, uuid, syntheticDb, fakeApi } from '../fixtures/supabase-fake.mjs';
import { MOCK_SUPABASE_URL } from '../../playwright.supabase.config.js';

const USER = uuid(999);
const FIXED_NOW = new Date('2026-11-06T11:30:00+01:00');

// Simula Supabase: Auth (/auth/v1/user), memberships y organizations (con la RLS real: se ven todos
// los miembros de la consulta) y las tablas de negocio mediante fakeApi.
async function mockSupabase(page, role, { failTable = null } = {}) {
  const log = { requests: [], blocked: [] };
  const api = fakeApi(syntheticDb(), role);
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
    log.requests.push({ method: req.method(), path: url.pathname + url.search });
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/auth/v1/user') return json({ id: USER, email: 'usuaria@correo-ejemplo.test' });
    const path = url.pathname.replace('/rest/v1/', '') + url.search;
    const [table] = path.split('?');
    const q = url.searchParams;
    if (req.method() !== 'GET') return json({ message: 'escritura no permitida en la prueba' }, 405);
    if (table === 'memberships') {
      const uid = (q.get('user_id') || '').replace(/^eq\./, '');
      return json(members.filter(m => !uid || m.user_id === uid).map(({ user_id, ...m }) => (q.get('select') || '').includes('user_id') ? { ...m, user_id } : m));
    }
    if (table === 'organizations') return json([{ id: ORG, name: 'Consulta Ficticia', is_demo: true }]);
    if (table === failTable) return route.abort('internetdisconnected');
    return json(await api.request(path));
  });
  await page.addInitScript(() => {
    sessionStorage.setItem('kovo.auth.session.v1', JSON.stringify({ access_token: 'token-simulado', refresh_token: 'refresco-simulado', user: { id: '00000000-0000-4000-8000-000000000999' } }));
  });
  return log;
}

async function open(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto('/');
  await page.waitForFunction(() => { const v = document.getElementById('view'); return v && v.children.length > 0 && !v.querySelector('.sk'); });
  return errors;
}
const click = (page, sel) => page.evaluate(s => { const el = document.querySelector(s); if (!el) throw new Error('No existe ' + s); el.click(); }, sel).then(() => page.waitForTimeout(100));

for (const role of ['psychologa', 'recepcion', 'gestoria']) {
  test(`${role}: carga sus datos y recorre todas sus secciones sin errores`, async ({ page }) => {
    const log = await mockSupabase(page, role);
    const errors = await open(page);
    const views = await page.$$eval('#nav [data-act="go"]', els => els.map(e => e.dataset.v));
    expect(views.length).toBeGreaterThan(0);
    const texts = {};
    for (const v of views) {
      await click(page, `[data-act="go"][data-v="${v}"]`);
      texts[v] = await page.locator('#view').innerText();
      // Capturas opcionales para revisión manual: KOVO_SHOTS=/ruta sh scripts/pw.sh supabase
      if (process.env.KOVO_SHOTS) await page.screenshot({ path: `${process.env.KOVO_SHOTS}/${role}-${v}.png`, fullPage: true });
    }
    const all = Object.values(texts).join('\n');
    if (role !== 'gestoria') {
      // Pacientes y su ficha completa
      await click(page, '[data-act="go"][data-v="pacientes"]');
      await expect(page.locator('#view')).toContainText('Paciente Uno Ficticio');
      await click(page, '.prow');
      for (const t of await page.$$eval('[data-act="ptab"]', els => els.map(e => e.dataset.t))) {
        await click(page, `[data-act="ptab"][data-t="${t}"]`);
        texts[`ficha-${t}`] = await page.locator('#view').innerText();
      }
      await click(page, '[data-act="go"][data-v="calendario"]');
      for (const m of ['dia', 'mes', 'semana']) await click(page, `[data-act="calMode"][data-m="${m}"]`);
    }
    if (role === 'psychologa') {
      await click(page, '[data-act="go"][data-v="informes"]');
      await click(page, '[data-act="nfilter"][data-f="todas"]');
      await expect(page.locator('#view tr.click')).toHaveCount(2);
      // Nota firmada con su rectificación, y nota de texto libre mostrada entera
      for (const k of [0, 1]) {
        await page.evaluate(i => document.querySelectorAll('#view tr.click')[i].click(), k);
        await page.waitForTimeout(100);
        await expect(page.locator('.doc')).toBeVisible();
        texts[`nota${k}`] = await page.evaluate(() => {
          const doc = document.querySelector('.doc');
          return doc.innerText + '\n' + [...doc.querySelectorAll('textarea,input')].map(x => x.value).join('\n');
        });
        await click(page, '[data-act="closeEditor"]');
        await click(page, '[data-act="nfilter"][data-f="todas"]');
      }
      const notesText = texts.nota0 + texts.nota1;
      expect(notesText).toContain('Texto libre ficticio');
      expect(notesText).toContain('Resumen ficticio');
      expect(notesText).toContain('Texto corregido ficticio');
      expect(notesText).not.toContain('null');
    }
    if (role !== 'recepcion') {
      await click(page, '[data-act="go"][data-v="contabilidad"]');
      await page.evaluate(() => document.querySelectorAll('#view details').forEach(d => { d.open = true; }));
      await page.waitForTimeout(250);
      texts.contabilidadAbierta = await page.locator('#view').innerText();
      expect(texts.contabilidadAbierta).toContain('KOVO-2026-000001');
    }
    // Nada de la otra consulta, ningún error, solo lecturas y ninguna otra conexión
    expect(all).not.toContain(ORG2);
    // Ningún campo ausente se muestra como texto técnico
    for (const [v, t] of Object.entries(texts)) expect(t, v).not.toMatch(/\bnull\b|\bundefined\b|\bNaN\b|Invalid Date/);
    expect(errors, errors.join('\n')).toEqual([]);
    // Única salida externa conocida: la librería opcional de PDF (cdnjs), sin datos. Se bloquea igualmente.
    expect(log.blocked.filter(o => o !== 'https://cdnjs.cloudflare.com')).toEqual([]);
    expect(log.blocked.some(o => o.includes('supabase.co'))).toBe(false);
    expect(log.requests.every(r => r.method === 'GET')).toBe(true);
    const tables = new Set(log.requests.map(r => r.path.split('?')[0].replace('/rest/v1/', '')));
    if (role !== 'psychologa') for (const t of ['clinical_notes', 'clinical_note_rectifications', 'patient_documents', 'employees']) expect(tables.has(t), t).toBe(false);
    if (role === 'gestoria') for (const t of ['patients', 'appointments']) expect(tables.has(t), t).toBe(false);
    if (role === 'recepcion') for (const t of ['invoices', 'invoice_lines', 'payments', 'expenses']) expect(tables.has(t), t).toBe(false);
    // El rol de la interfaz es el de la usuaria, no el de otro miembro de la consulta
    expect(views.includes('informes'), 'solo la psicóloga ve informes clínicos').toBe(role === 'psychologa');
    expect(views.includes('pacientes'), 'gestoría no ve pacientes').toBe(role !== 'gestoria');
    const banner = { psychologa: null, recepcion: 'Vista de recepción', gestoria: 'Vista de gestoría' }[role];
    if (banner) expect(all).toContain(banner); else expect(all).not.toContain('Vista de ');
    expect(log.requests.some(r => r.path.startsWith('/rest/v1/memberships') && r.path.includes(`user_id=eq.${USER}`))).toBe(true);
  });
}

test('sin conexión durante la carga: mensaje claro y ningún dato a medias', async ({ page }) => {
  await mockSupabase(page, 'psychologa', { failTable: 'appointments' });
  page.on('pageerror', () => {});
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto('/');
  await expect(page.locator('#view')).toHaveText(/No hay conexión con el servidor/);
  await expect(page.locator('#view')).not.toContainText('Paciente');
});
