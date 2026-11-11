// Acceso a KOVO en modo conectado: iniciar sesión, crear cuenta, crear la clínica (alta), aceptar
// una invitación y elegir clínica. Solo se carga en modo Supabase. No guarda contraseñas: las
// envía a Supabase Auth y conserva únicamente la sesión que devuelve (sessionStorage).
import { signIn, signUp, signOut, restoreSession, requestPasswordReset, getOrganizationContext, OrgSelectionError, selectOrg } from '../data/auth.js';
import { supabaseRequest } from '../data/supabase-client.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CSS = `
.gate{position:fixed;inset:0;z-index:50;background:var(--bg);display:grid;place-items:center;padding:24px 16px;overflow:auto}
.gate-card{width:min(440px,100%);background:var(--surface);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--shadow);padding:28px}
.gate-brand{display:flex;align-items:center;gap:10px;margin-bottom:22px}.gate-brand b{letter-spacing:.2em;font-weight:600}
.gate h1{font-size:1.4rem;margin:0 0 6px}.gate p{margin:0 0 16px;color:var(--muted)}
.gate form{display:grid;gap:14px}.gate .field input,.gate .field select{height:40px;border:1px solid var(--line-2);border-radius:10px;padding:0 12px;background:var(--surface);width:100%}
.gate .row{display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between;align-items:center}
.gate .linkbtn{border:0;background:none;color:var(--accent-ink);cursor:pointer;padding:0;font-weight:500;text-decoration:underline;text-underline-offset:3px}
.gate .msg{border-radius:10px;padding:10px 12px;font-size:.8125rem}.gate .msg.bad{background:var(--bad-soft);color:var(--bad-ink)}.gate .msg.ok{background:var(--ok-soft);color:var(--ok-ink)}
.gate .plans{display:grid;gap:8px}.gate .plan{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--line-2);border-radius:12px;padding:10px 12px;cursor:pointer}
.gate .plan input{margin-top:4px}.gate .plan small{display:block;color:var(--muted)}
.gate .orgs{display:grid;gap:8px}.gate .orgs button{text-align:left;border:1px solid var(--line-2);background:var(--surface);border-radius:12px;padding:12px 14px;cursor:pointer}
.gate .orgs button:hover{border-color:var(--accent)}.gate .btn{width:100%;height:40px}
.gate .fine{font-size:.75rem;color:var(--muted);margin-top:14px}`;

let root;
function mount() {
  if (root) return root;
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  root = document.createElement('div'); root.className = 'gate'; root.setAttribute('role', 'main');
  document.body.appendChild(root);
  return root;
}
function unmount() { root?.remove(); root = null; }
const card = (title, sub, body) => `<div class="gate-card"><div class="gate-brand"><span class="kmark"></span><b>KOVO</b></div>
  <h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}${body}</div>`;
const msg = (el, text, kind = 'bad') => { const m = el.querySelector('[data-msg]'); if (m) { m.className = `msg ${kind}`; m.textContent = text; m.hidden = !text; m.setAttribute('role', kind === 'bad' ? 'alert' : 'status'); } };
const busy = (form, on) => form.querySelectorAll('button,input,select').forEach(x => { x.disabled = on; });

// Mensajes en castellano para los errores habituales de Supabase Auth y de las RPC.
export function friendly(e) {
  const t = `${e?.details?.error_code || ''} ${e?.details?.code || ''} ${e?.message || ''}`.toLowerCase();
  if (e instanceof TypeError || /failed to fetch|network/.test(t)) return 'No hay conexión con el servidor. Comprueba tu red e inténtalo de nuevo.';
  if (/invalid_credentials|invalid login/.test(t)) return 'Correo o contraseña incorrectos.';
  if (/email_not_confirmed|not confirmed/.test(t)) return 'Confirma tu correo antes de entrar (revisa tu bandeja de entrada).';
  if (/weak_password|password should be/.test(t)) return 'La contraseña debe tener al menos 10 caracteres.';
  if (/user_already_exists|already registered/.test(t)) return 'Ya existe una cuenta con ese correo. Inicia sesión.';
  if (/over_request_rate_limit|rate limit/.test(t)) return 'Demasiados intentos. Espera unos minutos.';
  return e?.details?.message || e?.message || 'No se ha podido completar la operación.';
}

function loginScreen(el, { notice } = {}) {
  return new Promise(done => {
    let mode = 'login';
    const draw = () => {
      const forms = {
        login: card('Entrar en KOVO', 'Accede con el correo y la contraseña de tu cuenta.', `
          <form data-f="login" novalidate><div class="msg" data-msg hidden></div>
            <label class="field"><span>Correo</span><input type="email" name="email" autocomplete="username" required></label>
            <label class="field"><span>Contraseña</span><input type="password" name="password" autocomplete="current-password" required></label>
            <button class="btn primary" type="submit">Entrar</button>
            <div class="row"><button type="button" class="linkbtn" data-mode="signup">Crear una cuenta</button><button type="button" class="linkbtn" data-mode="reset">He olvidado la contraseña</button></div>
          </form>`),
        signup: card('Crear una cuenta', 'Después podrás crear tu clínica o unirte a la de tu equipo con una invitación.', `
          <form data-f="signup" novalidate><div class="msg" data-msg hidden></div>
            <label class="field"><span>Nombre y apellidos</span><input type="text" name="name" autocomplete="name" required maxlength="120"></label>
            <label class="field"><span>Correo</span><input type="email" name="email" autocomplete="email" required></label>
            <label class="field"><span>Contraseña (mínimo 10 caracteres)</span><input type="password" name="password" autocomplete="new-password" minlength="10" required></label>
            <button class="btn primary" type="submit">Crear cuenta</button>
            <div class="row"><button type="button" class="linkbtn" data-mode="login">Ya tengo cuenta</button></div>
            <p class="fine">Al crear la cuenta aceptas las condiciones del servicio y la política de privacidad de KOVO (pendientes de redacción final por asesoría legal).</p>
          </form>`),
        reset: card('Recuperar la contraseña', 'Te enviaremos un enlace a tu correo.', `
          <form data-f="reset" novalidate><div class="msg" data-msg hidden></div>
            <label class="field"><span>Correo</span><input type="email" name="email" autocomplete="email" required></label>
            <button class="btn primary" type="submit">Enviar enlace</button>
            <div class="row"><button type="button" class="linkbtn" data-mode="login">Volver</button></div>
          </form>`)
      };
      el.innerHTML = forms[mode];
      if (notice) { msg(el, notice, 'ok'); notice = null; }
      el.querySelector('input')?.focus();
      el.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { mode = b.dataset.mode; draw(); });
      const form = el.querySelector('form');
      form.onsubmit = async ev => {
        ev.preventDefault();
        const f = Object.fromEntries(new FormData(form));
        if (!f.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) return msg(el, 'Introduce un correo válido.');
        if (mode !== 'reset' && !f.password) return msg(el, 'Introduce la contraseña.');
        if (mode === 'signup' && f.password.length < 10) return msg(el, 'La contraseña debe tener al menos 10 caracteres.');
        busy(form, true); msg(el, '');
        try {
          if (mode === 'login') { await signIn(f.email.trim(), f.password); return done(); }
          if (mode === 'signup') {
            const r = await signUp(f.email.trim(), f.password, (f.name || '').trim());
            if (!r.needsConfirmation) return done();
            mode = 'login'; notice = 'Cuenta creada. Te hemos enviado un correo para confirmarla; después, inicia sesión.'; return draw();
          }
          await requestPasswordReset(f.email.trim(), location.origin + location.pathname);
          mode = 'login'; notice = 'Si el correo existe, recibirás un enlace para cambiar la contraseña.'; draw();
        } catch (e) { busy(form, false); msg(el, friendly(e)); }
      };
    };
    draw();
  });
}

async function loadPlans() {
  try { return await supabaseRequest('plans?select=code,name,max_professionals,max_members,trial_days,monthly_price_cents&active=eq.true&order=position.asc'); }
  catch { return []; }
}
const planText = p => [
  p.max_professionals ? `${p.max_professionals} profesional${p.max_professionals > 1 ? 'es' : ''}` : 'profesionales sin límite',
  p.max_members ? `${p.max_members} personas en el equipo` : 'equipo sin límite',
  `${p.trial_days} días de prueba`,
  p.monthly_price_cents == null ? 'precio pendiente de publicar' : `${(p.monthly_price_cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}/mes`
].join(' · ');

function onboardingScreen(el, user) {
  return new Promise(async done => {
    const plans = await loadPlans();
    el.innerHTML = card('Crea tu clínica', 'Es el espacio privado de tu consulta: pacientes, agenda, informes y facturación. Podrás invitar a tu equipo después.', `
      <form data-f="org" novalidate><div class="msg" data-msg hidden></div>
        <label class="field"><span>Nombre de la clínica o consulta</span><input type="text" name="name" required minlength="2" maxlength="120"></label>
        <label class="field"><span>Tu nombre profesional</span><input type="text" name="display" maxlength="120" value="${esc(user?.user_metadata?.full_name || '')}"></label>
        <fieldset class="plans" style="border:0;padding:0;margin:0"><legend class="small muted" style="margin-bottom:6px">Plan</legend>
          ${plans.map((p, i) => `<label class="plan"><input type="radio" name="plan" value="${esc(p.code)}" ${i === 0 ? 'checked' : ''}><span><b>${esc(p.name)}</b><small>${esc(planText(p))}</small></span></label>`).join('') || '<p class="small muted">No se han podido cargar los planes; se usará el plan inicial.</p>'}
        </fieldset>
        <button class="btn primary" type="submit">Crear clínica</button>
        <div class="row"><button type="button" class="linkbtn" data-out>Salir</button></div>
        <p class="fine">Durante la prueba no se cobra nada. ¿Te han invitado a una clínica? Abre el enlace de la invitación con esta misma cuenta.</p>
      </form>`);
    el.querySelector('[data-out]').onclick = async () => { await signOut(); done('signed_out'); };
    const form = el.querySelector('form');
    el.querySelector('input').focus();
    form.onsubmit = async ev => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(form));
      if (!f.name || f.name.trim().length < 2) return msg(el, 'Escribe el nombre de la clínica.');
      busy(form, true); msg(el, '');
      try {
        const id = await supabaseRequest('rpc/create_organization', { method: 'POST', body: { p_name: f.name.trim(), p_plan_code: f.plan || 'starter', p_display_name: (f.display || '').trim() || null } });
        selectOrg(id); done('created');
      } catch (e) { busy(form, false); msg(el, friendly(e)); }
    };
  });
}

function chooseScreen(el, orgs) {
  return new Promise(done => {
    const role = { psychologa: 'Psicóloga', recepcion: 'Recepción', gestoria: 'Gestoría', agenda: 'Solo calendario' };
    el.innerHTML = card('Elige la clínica', 'Tu cuenta pertenece a varias clínicas. Los datos de cada una están separados.', `
      <div class="orgs">${orgs.map(o => `<button type="button" data-org="${esc(o.org_id)}"><b>${esc(o.name)}</b><br><span class="small muted">${role[o.role] || esc(o.role)}${o.is_admin ? ' · administración' : ''}${o.account_status === 'suspended' ? ' · cuenta suspendida (solo lectura)' : ''}</span></button>`).join('')}</div>
      <div class="row" style="margin-top:14px"><button type="button" class="linkbtn" data-out>Salir</button></div>`);
    el.querySelectorAll('[data-org]').forEach(b => b.onclick = () => { selectOrg(b.dataset.org); done(); });
    el.querySelector('[data-out]').onclick = async () => { await signOut(); done('signed_out'); };
  });
}

async function acceptInvitationFromUrl(el) {
  const m = /[#&]invitacion=([0-9a-f]{48})/.exec(location.hash);
  if (!m) return null;
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const r = await supabaseRequest('rpc/accept_invitation', { method: 'POST', body: { p_token: m[1] } });
    selectOrg(r.org_id);
    return { ok: true };
  } catch (e) {
    const code = e?.details?.code;
    const text = code === 'KT004' ? 'Esta invitación es para otra dirección de correo. Entra con la cuenta del correo invitado.'
      : code === 'KT003' ? 'La invitación no es válida o ha caducado. Pide una nueva a la administración de la clínica.' : friendly(e);
    el.innerHTML = card('Invitación', '', `<div class="msg bad" role="alert">${esc(text)}</div><div class="row" style="margin-top:14px"><button class="btn" data-go>Continuar</button></div>`);
    await new Promise(ok => { el.querySelector('[data-go]').onclick = ok; });
    return { ok: false };
  }
}

/**
 * Devuelve el contexto de la clínica cuando hay sesión y clínica elegida. Pinta las pantallas de
 * acceso hasta conseguirlo.
 */
export async function runGate() {
  const hasInvite = /[#&]invitacion=/.test(location.hash);
  for (let i = 0; i < 20; i++) {
    let user = null;
    try { user = await restoreSession(); } catch { user = null; }
    if (!user) {
      await loginScreen(mount(), { notice: hasInvite ? 'Inicia sesión (o crea tu cuenta con el correo invitado) para aceptar la invitación.' : null });
      continue;
    }
    if (/[#&]invitacion=/.test(location.hash)) { await acceptInvitationFromUrl(mount()); }
    try {
      const ctx = await getOrganizationContext();
      unmount();
      return ctx;
    } catch (e) {
      if (e instanceof OrgSelectionError && e.code === 'none') { await onboardingScreen(mount(), user); continue; }
      if (e instanceof OrgSelectionError && e.code === 'choose') { await chooseScreen(mount(), e.organizations); continue; }
      const el = mount();
      el.innerHTML = card('No se ha podido entrar', '', `<div class="msg bad" role="alert">${esc(friendly(e))}</div><div class="row" style="margin-top:14px"><button class="btn" data-retry>Reintentar</button><button class="btn ghost" data-out>Salir</button></div>`);
      await new Promise(ok => { el.querySelector('[data-retry]').onclick = ok; el.querySelector('[data-out]').onclick = async () => { await signOut(); ok(); }; });
    }
  }
  throw new Error('No se ha podido iniciar la sesión.');
}
