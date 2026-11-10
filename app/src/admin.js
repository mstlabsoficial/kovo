// Panel central de KOVO (personal de la plataforma), separado de los paneles de las clínicas.
// Solo usa las RPC platform_* (la BD comprueba private.is_platform_admin en cada llamada): estado de
// las cuentas, suscripciones y soporte. No muestra ni puede leer datos de pacientes ni clínicos: las
// cifras son recuentos agregados. Cada cambio exige un motivo y queda en platform_audit_log.
import { signIn, signOut, restoreSession } from './data/auth.js';
import { supabaseRequest, isSupabaseConfigured } from './data/supabase-client.js';

const app = document.getElementById('app');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rpc = (fn, body = {}) => supabaseRequest(`rpc/${fn}`, { method: 'POST', body });
const fmt = x => x ? new Date(x).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const STATUS = { active: ['Activa', 'ok'], suspended: ['Suspendida', 'bad'], closed: ['Cerrada', ''] };
const SUB = { trialing: 'Prueba', active: 'Activa', past_due: 'Pago pendiente', unpaid: 'Impagada', cancelled: 'Cancelada', incomplete: 'Incompleta' };
const TICKET = { open: 'Abierta', in_progress: 'En curso', closed: 'Cerrada' };
const toastEl = document.getElementById('toast');
function toast(m) { toastEl.textContent = m; toastEl.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { toastEl.hidden = true; }, 3500); }
const errText = e => e instanceof TypeError ? 'No hay conexión con el servidor.' : e?.status === 401 ? 'La sesión ha caducado. Vuelve a entrar.' : (e?.details?.message || e?.message || 'No se ha podido completar.');

function loginView(note = '') {
  app.innerHTML = `<div class="card"><h1>Administración de KOVO</h1><p class="muted small">Acceso solo para el personal de la plataforma. Las clínicas entran por la aplicación.</p>
    <form id="lf" novalidate>${note ? `<div class="msg">${esc(note)}</div>` : ''}<div class="msg" id="lm" hidden></div>
    <label>Correo<input type="email" name="email" autocomplete="username" required></label>
    <label>Contraseña<input type="password" name="password" autocomplete="current-password" required></label>
    <button class="btn primary" type="submit">Entrar</button></form></div>`;
  const f = document.getElementById('lf');
  f.onsubmit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    const m = document.getElementById('lm');
    try { await signIn(String(d.email).trim(), d.password); start(); }
    catch (x) { m.hidden = false; m.textContent = /invalid/i.test(x?.details?.error_code || x?.message || '') ? 'Correo o contraseña incorrectos.' : errText(x); }
  };
}

// Pide un motivo (obligatorio, mínimo 5 caracteres) y confirma.
function ask(title, body, fields = '') {
  return new Promise(ok => {
    const d = document.createElement('dialog');
    d.innerHTML = `<form method="dialog" id="df"><h2>${esc(title)}</h2><p class="small muted" style="margin:0">${body}</p>${fields}
      <label>Motivo (queda registrado)<textarea name="reason" rows="3" required minlength="5" maxlength="500"></textarea></label>
      <div class="row"><button class="btn" value="cancel" formnovalidate>Cancelar</button><button class="btn primary" value="ok">Confirmar</button></div></form>`;
    document.body.appendChild(d);
    d.addEventListener('close', () => { const v = d.returnValue === 'ok' ? Object.fromEntries(new FormData(d.querySelector('form'))) : null; d.remove(); ok(v); });
    d.querySelector('form').addEventListener('submit', e => { if (e.submitter?.value === 'ok' && String(new FormData(e.target).get('reason') || '').trim().length < 5) { e.preventDefault(); toast('Escribe un motivo (mínimo 5 caracteres).'); } });
    d.showModal();
  });
}

async function render() {
  app.innerHTML = '<p class="muted">Cargando…</p>';
  let orgs, tickets, plans;
  try { [orgs, tickets, plans] = await Promise.all([rpc('platform_list_organizations'), rpc('platform_list_tickets', { p_status: null }), supabaseRequest('plans?select=code,name&order=position.asc')]); }
  catch (e) { app.innerHTML = `<div class="panel"><p role="alert">${esc(errText(e))}</p><button class="btn" id="retry">Reintentar</button></div>`; document.getElementById('retry').onclick = render; return; }
  const totals = { orgs: orgs.length, active: orgs.filter(o => o.account_status === 'active').length, trial: orgs.filter(o => o.subscription_status === 'trialing').length, tickets: tickets.filter(t => t.status !== 'closed').length };
  app.innerHTML = `<h1>Clínicas</h1><p class="muted small">${totals.orgs} clínicas · ${totals.active} activas · ${totals.trial} en prueba · ${totals.tickets} consultas de soporte abiertas. Solo recuentos: este panel no da acceso a datos de pacientes.</p>
    <section class="panel"><div class="tbl"><table><thead><tr><th>Clínica</th><th>Alta</th><th>Cuenta</th><th>Plan</th><th>Suscripción</th><th class="r">Equipo</th><th class="r">Profesionales</th><th class="r">Pacientes</th><th class="r">Soporte</th><th></th></tr></thead><tbody>
    ${orgs.map(o => `<tr><td><b>${esc(o.name)}</b><div class="small muted" style="font-family:var(--f-mono)">${esc(o.org_id)}</div>${o.status_reason ? `<div class="small muted">${esc(o.status_reason)}</div>` : ''}</td>
      <td>${fmt(o.created_at)}</td><td><span class="chip ${STATUS[o.account_status]?.[1] || ''}">${esc(STATUS[o.account_status]?.[0] || o.account_status)}</span></td>
      <td>${esc(o.plan_code || 'Sin plan')}</td><td>${esc(SUB[o.subscription_status] || o.subscription_status || '—')}${o.trial_ends_at && o.subscription_status === 'trialing' ? `<div class="small muted">hasta ${fmt(o.trial_ends_at)}</div>` : ''}${o.cancel_at_period_end ? '<div class="small muted">cancela al final del periodo</div>' : ''}</td>
      <td class="r">${o.members}</td><td class="r">${o.professionals}</td><td class="r">${o.patients}</td><td class="r">${o.open_tickets}</td>
      <td class="r" style="white-space:nowrap">${o.account_status === 'active' ? `<button class="btn danger" data-a="status" data-id="${o.org_id}" data-v="suspended" data-n="${esc(o.name)}">Suspender</button>` : `<button class="btn" data-a="status" data-id="${o.org_id}" data-v="active" data-n="${esc(o.name)}">Reactivar</button>`}
        <button class="btn" data-a="sub" data-id="${o.org_id}" data-n="${esc(o.name)}" data-plan="${esc(o.plan_code || '')}" data-st="${esc(o.subscription_status || '')}">Plan</button></td></tr>`).join('') || '<tr><td colspan="10" class="muted">Todavía no hay clínicas.</td></tr>'}
    </tbody></table></div></section>
    <h1 style="margin-top:28px">Soporte</h1>
    <section class="panel"><div class="tbl"><table><thead><tr><th>Fecha</th><th>Clínica</th><th>Asunto</th><th>Estado</th><th></th></tr></thead><tbody>
    ${tickets.map(t => `<tr><td>${fmt(t.created_at)}</td><td>${esc(t.org_name)}</td><td><b>${esc(t.subject)}</b><div class="small">${esc(t.body)}</div>${t.platform_reply ? `<div class="small muted"><b>Respuesta:</b> ${esc(t.platform_reply)}</div>` : ''}</td>
      <td>${esc(TICKET[t.status] || t.status)}</td><td class="r"><button class="btn" data-a="ticket" data-id="${t.id}" data-st="${t.status}">Responder</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted">No hay consultas.</td></tr>'}
    </tbody></table></div></section>
    <p class="small muted">Los cobros a las clínicas los gestionará la pasarela de pago (no configurada). Desde aquí solo se corrige el estado manualmente, con motivo y registro.</p>`;
  app.onclick = async e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'status') {
      const verb = b.dataset.v === 'suspended' ? 'Suspender' : 'Reactivar';
      const r = await ask(`${verb} «${b.dataset.n}»`, b.dataset.v === 'suspended' ? 'La clínica podrá consultar y exportar sus datos, pero no guardar cambios. Puede seguir escribiendo a soporte.' : 'La clínica podrá volver a trabajar con normalidad.');
      if (!r) return;
      b.disabled = true;
      try { await rpc('platform_set_account_status', { p_org_id: b.dataset.id, p_status: b.dataset.v, p_reason: r.reason }); toast('Estado actualizado'); render(); }
      catch (x) { b.disabled = false; toast(errText(x)); }
    }
    if (b.dataset.a === 'sub') {
      const r = await ask(`Plan de «${b.dataset.n}»`, 'Corrección manual. Los cambios habituales llegarán desde la pasarela de pago.',
        `<label>Plan<select name="plan">${plans.map(p => `<option value="${esc(p.code)}" ${p.code === b.dataset.plan ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
         <label>Estado<select name="status">${Object.entries(SUB).map(([k, l]) => `<option value="${k}" ${k === b.dataset.st ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`);
      if (!r) return;
      try { await rpc('platform_set_subscription', { p_org_id: b.dataset.id, p_plan_code: r.plan, p_status: r.status, p_reason: r.reason }); toast('Suscripción actualizada'); render(); }
      catch (x) { toast(errText(x)); }
    }
    if (b.dataset.a === 'ticket') {
      const d = document.createElement('dialog');
      d.innerHTML = `<form method="dialog"><h2>Responder</h2><label>Estado<select name="status">${Object.entries(TICKET).map(([k, l]) => `<option value="${k}" ${k === b.dataset.st ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label>Respuesta (la verá la clínica)<textarea name="reply" rows="4" maxlength="5000"></textarea></label><div class="row"><button class="btn" value="cancel" formnovalidate>Cancelar</button><button class="btn primary" value="ok">Guardar</button></div></form>`;
      document.body.appendChild(d);
      d.addEventListener('close', async () => {
        const ok = d.returnValue === 'ok'; const v = Object.fromEntries(new FormData(d.querySelector('form'))); d.remove();
        if (!ok) return;
        try { await rpc('platform_update_ticket', { p_ticket_id: b.dataset.id, p_status: v.status, p_reply: v.reply || null }); toast('Consulta actualizada'); render(); }
        catch (x) { toast(errText(x)); }
      });
      d.showModal();
    }
  };
}

async function start() {
  if (!isSupabaseConfigured()) { app.innerHTML = '<div class="card"><h1>Administración de KOVO</h1><p class="muted">Este panel necesita un servidor configurado (VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY). En la demo no está disponible.</p></div>'; return; }
  let user = null;
  try { user = await restoreSession(); } catch { /* sin red: se pide entrar de nuevo */ }
  if (!user) return loginView();
  const out = document.getElementById('out');
  out.hidden = false; out.onclick = async () => { await signOut(); out.hidden = true; document.getElementById('who').textContent = ''; loginView(); };
  document.getElementById('who').textContent = user.email || '';
  let staff = false;
  try { staff = await rpc('am_platform_admin'); } catch (e) { app.innerHTML = `<div class="card"><p role="alert">${esc(errText(e))}</p></div>`; return; }
  if (staff !== true) { app.innerHTML = '<div class="card"><h1>Sin acceso</h1><p class="muted">Esta cuenta no pertenece al personal de KOVO. Si eres una clínica, entra por la aplicación.</p></div>'; return; }
  render();
}
start();
