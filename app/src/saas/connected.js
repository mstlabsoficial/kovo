// Modo conectado (Supabase): conecta con el servidor los botones de la interfaz que no son pacientes,
// citas ni notas, y bloquea con una explicación los que no tienen servidor todavía. Nada se da por
// guardado sin la respuesta del servidor: el estado local cambia después de confirmar.
//
// Se instala desde legacy.js solo si hay escrituras remotas (data.writes) y API de clínica. Escucha
// clics y cambios en fase de captura (antes que los manejadores de la demo) y solo se queda con los
// que le corresponden; el resto sigue su camino normal. En la demo no se carga.
import { DEFAULT_SETTINGS } from '../data/legacy-state.js';

// Acciones de la demo sin servidor: en modo conectado se explican en vez de simularlas.
const NO_MAIL = 'KOVO todavía no tiene un proveedor de correo configurado: no se envía nada. Descarga el PDF y envíalo tú.';
const NO_DICT = 'El dictado y la redacción con IA están desactivados con datos reales: el contenido clínico no se envía a servicios de voz ni de IA.';
const NO_DX = 'Este servidor todavía no guarda diagnósticos ni pruebas (falta una actualización de la base de datos). No se ha guardado nada.';
const NO_FIXED = 'Este servidor todavía no guarda gastos fijos (falta una actualización de la base de datos). Añade cada gasto con «Nuevo gasto».';
const NO_USERS = 'El equipo se gestiona en Ajustes › Equipo.';
export const BLOCKED = Object.freeze({
  sendInv: NO_MAIL,
  remind: NO_MAIL,
  rectInv: 'Las facturas rectificativas aún no están disponibles en el servidor (pendientes de validación fiscal). No se ha cambiado nada.',
  saveScan: 'La lectura de facturas con IA está desactivada en modo conectado. Añade el gasto con «Nuevo gasto».',
  autoMatch: 'La conciliación bancaria aún no está conectada al servidor.',
  matchOne: 'La conciliación bancaria aún no está conectada al servidor.',
  pickMatch: 'La conciliación bancaria aún no está conectada al servidor.',
  expFromBank: 'La conciliación bancaria aún no está conectada al servidor.',
  ignoreMove: 'La conciliación bancaria aún no está conectada al servidor.',
  payObl: 'Las obligaciones fiscales son orientativas y no se registran en el servidor.',
  genPayroll: 'Las nóminas aún no están conectadas al servidor.',
  payPayroll: 'Las nóminas aún no están conectadas al servidor.',
  // Interfaz v3: funciones que todavía solo existen en la demo.
  dictMic: NO_DICT, dictAI: NO_DICT, dictUndo: NO_DICT,
  userForm: NO_USERS, userSave: NO_USERS, userDel: NO_USERS, userAs: NO_USERS,
  patientYes: NO_MAIL, patientNo: NO_MAIL, dailyNow: NO_MAIL,
  reset: 'En modo conectado no se pueden restablecer ni borrar los datos.',
  doReset: 'En modo conectado no se pueden restablecer ni borrar los datos.'
});
const BLOCKED_UPLOADS = Object.freeze({
  scan: BLOCKED.saveScan,
  bank: 'La importación de extractos bancarios aún no está conectada al servidor.',
  empdoc: 'Los documentos laborales aún no se guardan en el servidor.'
});
const PRO_FIELDS = { name: 'name', col: 'col', email: 'email', phone: 'phone' };
const ROLE_LABEL = { psychologa: 'Psicóloga', recepcion: 'Recepción', gestoria: 'Gestoría', agenda: 'Solo calendario' };
// Acciones de la interfaz v3 que dependen de tablas nuevas: si el servidor no las tiene, se explican.
const NEEDS = { dxForm: 'clinicalAvailable', dxSave: 'clinicalAvailable', dxDel: 'clinicalAvailable', testForm: 'clinicalAvailable', testSave: 'clinicalAvailable', testDel: 'clinicalAvailable',
  fxForm: 'fixedAvailable', fxSave: 'fixedAvailable', fxDel: 'fixedAvailable' };
const PLAN_LABEL = { starter: 'Starter', professional: 'Professional', clinic: 'Clinic' };
const SUB_LABEL = { trialing: 'periodo de prueba', active: 'activa', past_due: 'pago pendiente', unpaid: 'impagada', cancelled: 'cancelada', incomplete: 'incompleta' };
const TZ = ['Europe/Madrid', 'Atlantic/Canary'];
const EXP_CATS = ['Alquiler', 'Suministros', 'Seguros', 'Material', 'Gestoría y asesoría', 'Tecnología y software', 'Cuotas e impuestos', 'Personal', 'Formación', 'Otros'];
const THEME_KEY = 'kovo.theme.v1';

// Pestañas de Ajustes en modo conectado (en la demo se mantienen las originales).
export const CONNECTED_TABS = [['clinica', 'Clínica'], ['equipo', 'Equipo'], ['servicios', 'Servicios y tarifas'], ['perfil', 'Mi perfil profesional'],
  ['horario', 'Horario y agenda'], ['auto', 'Preferencias'], ['suscripcion', 'Suscripción'], ['soporte', 'Soporte'], ['audit', 'Auditoría'], ['ayuda', 'Ayuda']];
export const PANEL_TABS = new Set(['clinica', 'equipo', 'suscripcion', 'soporte', 'audit']);
// Administración que no es psicóloga: lo de la clínica, no lo de una profesional (servicios, perfil y
// horario los escriben solo las psicólogas, también en la base de datos).
const PSI_ONLY_TABS = new Set(['servicios', 'perfil', 'horario']);
export const tabsFor = role => role === 'psicologa' ? CONNECTED_TABS : CONNECTED_TABS.filter(([k]) => !PSI_ONLY_TABS.has(k));

const pickSettings = s => Object.fromEntries(Object.keys(DEFAULT_SETTINGS).filter(k => k in s).map(k => [k, s[k]]));
const fmtDate = x => x ? new Date(x).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = x => x ? new Date(x).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const CSS = `
.cn-banner{margin:0 0 16px;padding:12px 16px;border-radius:12px;border:1px solid var(--line);background:var(--panel,var(--bg));font-size:.875rem;line-height:1.45}
.cn-banner.bad{border-color:var(--bad-ink,#b42318);color:var(--bad-ink,#b42318)}
.cn-banner.warn{border-color:var(--warn-ink,#a15c07)}
.cn-org{font-size:.78rem;line-height:1.4;color:var(--muted)}
.cn-org b{display:block;color:var(--ink);font-size:.82rem}
.pmenu .cn-sep{border-top:1px solid var(--line);margin:6px 0}
.cn-link{display:flex;gap:8px;align-items:center;margin-top:10px}
.cn-link input{flex:1;font-family:var(--mono,monospace);font-size:.75rem}
.cn-note{font-size:.8125rem;color:var(--muted);margin:10px 0 0}
.cn-plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.cn-plan{border:1px solid var(--line);border-radius:12px;padding:14px}
.cn-plan[aria-current="true"]{border-color:var(--acc,var(--ink))}
.cn-plan h3{margin:0 0 6px;font-size:1rem}
.cn-plan ul{margin:0;padding-left:18px;font-size:.8125rem;color:var(--muted)}
`;

export function installConnected(h) {
  const data = h.data;
  const clinic = data.clinic;
  let busy = false;
  const S = () => h.S;
  const org = () => S().org || {};
  const isAdmin = () => !!org().isAdmin;
  const role = () => data.context?.()?.role;

  // Una operación cada vez; el botón queda desactivado mientras tanto.
  async function run(btn, op, ok, fail) {
    if (busy) return;
    busy = true; if (btn) btn.disabled = true;
    try { const r = await op(); busy = false; if (btn) btn.disabled = false; await ok?.(r); }
    catch (e) {
      busy = false; if (btn) btn.disabled = false;
      if (e?.code === 'auth') { h.toast(e.message); setTimeout(() => location.reload(), 1600); return; }
      if (fail) fail(e); else h.toast(e?.message || 'No se ha podido guardar');
    }
  }
  const reload = async (msg) => { await h.reload(); if (msg) h.toast(msg); };

  /* ---------------------------------------------------------------- arranque visual */
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  try { const th = localStorage.getItem(THEME_KEY); if (th) S().settings.theme = th; } catch {}
  function sidebar() {
    const r = document.querySelector('.sidefoot .role'); if (r) r.hidden = true;
    const p = document.querySelector('.sidefoot .proto');
    if (p) {
      const o = org();
      const plan = o.plan ? `Plan ${PLAN_LABEL[o.plan] || o.plan}${o.subscriptionStatus ? ` · ${SUB_LABEL[o.subscriptionStatus] || o.subscriptionStatus}` : ''}` : 'Sin plan asignado';
      p.className = 'cn-org';
      p.innerHTML = `<b>${h.esc(o.name || 'Clínica')}</b>${h.esc(ROLE_LABEL[role()] || '')}${o.isAdmin ? ' · administración' : ''}<br>${h.esc(plan)}`;
    }
  }
  function banner() {
    const o = org();
    let el = document.getElementById('cn-banner');
    let html = '', cls = 'warn';
    if (o.accountStatus === 'suspended') { cls = 'bad'; html = '<b>Cuenta suspendida.</b> Puedes consultar y exportar tus datos, pero no guardar cambios. Escribe a soporte desde Ajustes › Soporte.'; }
    else if (o.subscriptionStatus === 'trialing' && o.trialEndsAt) html = `Periodo de prueba hasta el ${fmtDate(o.trialEndsAt)}. La contratación de pago todavía no está disponible: KOVO no realiza cobros.`;
    else if (o.cancelAtPeriodEnd) html = 'La suscripción se cancelará al final del periodo. Puedes revertirlo en Ajustes › Suscripción.';
    if (!html) { el?.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'cn-banner'; el.setAttribute('role', 'status'); document.querySelector('.mainc main')?.prepend(el); }
    el.className = `cn-banner ${cls}`; el.innerHTML = html;
  }
  sidebar(); banner();
  // Gastos fijos: al abrir, el servidor apunta los meses que ya tocan (idempotente). Si falla
  // (cuenta suspendida, servidor sin la tabla) no se insiste: la lista sigue siendo la del servidor.
  if (['psychologa', 'gestoria'].includes(role()) && (S().fixed || []).some(f => f.active))
    clinic.applyRecurring().then(n => { if (n > 0) reload(`${n} ${n === 1 ? 'gasto fijo apuntado' : 'gastos fijos apuntados'} este mes`); }, () => {});

  /* ---------------------------------------------------------------- ajustes */
  async function saveSettings(mutate, okMsg) {
    const s = S().settings; const prev = { ...s };
    const next = { ...s }; mutate(next);
    await run(null, () => clinic.updateClinic({ settings: pickSettings(next) }),
      () => { Object.assign(S().settings, next); h.render(); h.toast(okMsg); },
      e => { Object.assign(S().settings, prev); h.render(); h.toast(e.message); });
  }
  async function saveAvail(next, okMsg, btn) {
    const pro = S().pro;
    if (!pro?.id) { h.toast('Primero crea tu ficha profesional (Ajustes › Mi perfil profesional).'); h.render(); return; }
    await run(btn, () => clinic.saveAvailability(pro.id, next),
      () => { h.AVAIL = next; S().avail = next; S().availSaved = true; h.render(); h.toast(okMsg); },
      e => { h.render(); h.toast(e.message); });
  }
  const copyAvail = () => JSON.parse(JSON.stringify(h.AVAIL || {}));
  const toMin = v => { const [a, b] = String(v).split(':').map(Number); return a * 60 + b; };

  /* ---------------------------------------------------------------- facturas */
  const invById = id => S().invoices.find(x => x.id === id);

  // Facturar sesiones realizadas: siempre en BORRADOR (la emisión la revisa la psicóloga; el criterio
  // fiscal está pendiente de validar, docs/fiscal). Cada línea lleva su cita: la BD impide facturar
  // dos veces la misma sesión (índice único) y solo admite citas realizadas del mismo paciente.
  // El IVA sale del servicio («exento» en Servicios y tarifas); si no está indicado, no se adivina.
  const sessionLine = a => {
    const sv = S().services.find(s => s.id === a.service);
    if (!sv || typeof sv.exempt !== 'boolean') throw Object.assign(new Error(`Indica en Ajustes › Servicios y tarifas si «${sv?.name || 'el servicio'}» está exento de IVA antes de facturarlo.`), { code: 'validation' });
    if (!(a.price > 0)) throw Object.assign(new Error('La sesión no tiene precio: edítala antes de facturarla.'), { code: 'validation' });
    return { desc: `${sv.name} · ${a.date.split('-').reverse().join('/')}`, qty: 1, price: a.price, exempt: sv.exempt, apptId: a.id };
  };
  const draftFor = (p, appts) => clinic.saveInvoiceDraft({ patientId: p.id, date: h.today, due: h.addDays(h.today, S().settings.dueDays), lines: appts.map(sessionLine), retPct: retPctFor(p) });
  const alreadyBilled = e => e?.pg === '23505' || e?.code === '23505';
  const readLinesFromModal = i => {
    const lines = i.lines.map(l => ({ ...l }));
    document.querySelectorAll('[data-ld]').forEach(t => { lines[t.dataset.ld].desc = t.value; });
    document.querySelectorAll('[data-lp]').forEach(t => { lines[t.dataset.lp].price = Math.round(Number(t.value) * 100); });
    return lines;
  };
  const retPctFor = p => p?.billing?.type === 'empresa' ? (p.billing.ret || 15) : 0;

  /* ---------------------------------------------------------------- documentos */
  async function openDocument(path, name, btn) {
    await run(btn, () => clinic.downloadDocument(path), blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener';
      if (!/^image\/|application\/pdf/.test(blob.type)) a.download = name || 'documento';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    });
  }

  /* ---------------------------------------------------------------- gastos */
  function expenseModal(e) {
    const x = e || { supplier: '', cat: 'Otros', date: h.today, concept: '', total: 0 };
    const ro = role() === 'recepcion';
    h.modal(e ? h.esc(x.supplier || 'Gasto') : 'Nuevo gasto', `<div class="form">
      <label class="field full"><span>Concepto</span><input type="text" id="cx-d" maxlength="300" value="${h.esc(x.concept || '')}" ${ro ? 'disabled' : ''}></label>
      <label class="field full"><span>Proveedor</span><input type="text" id="cx-s" value="${h.esc(x.supplier || '')}" ${ro ? 'disabled' : ''}></label>
      <label class="field"><span>Categoría</span><select id="cx-c" ${ro ? 'disabled' : ''}>${EXP_CATS.map(c => `<option ${c === x.cat ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      <label class="field"><span>Fecha</span><input type="date" id="cx-f" value="${h.esc(x.date || h.today)}" ${ro ? 'disabled' : ''}></label>
      <label class="field"><span>Importe total (€)</span><input type="number" step="0.01" min="0" id="cx-a" value="${((x.total || 0) / 100).toFixed(2)}" ${ro ? 'disabled' : ''}></label>
      <p class="full cn-note">El servidor guarda el importe total del gasto. El desglose de base, IVA y retención todavía no se guarda.</p></div>`,
      ro ? '<button class="btn" data-act="close">Cerrar</button>'
        : `${e ? `<button class="btn danger" data-act="cnDelExp" data-id="${x.id}">Eliminar</button>` : '<button class="btn" data-act="close">Cancelar</button>'}<button class="btn primary" data-act="cnSaveExp" data-id="${e ? x.id : ''}">Guardar</button>`);
  }

  /* ---------------------------------------------------------------- paneles de Ajustes */
  const field = (id, label, value = '', attrs = '') => `<label class="field"><span>${label}</span><input type="text" id="${id}" value="${h.esc(value ?? '')}" ${attrs}></label>`;
  const PANELS = {
    async clinica() {
      const [c, bp] = await Promise.all([clinic.getClinic(), clinic.getBillingProfile().catch(() => null)]);
      const ad = isAdmin() && c.account_status === 'active';
      const finance = ['psychologa', 'gestoria'].includes(role());
      return `<div class="grid2"><section class="panel"><header><h2>Datos de la clínica</h2></header><div class="form">
        ${field('cn-name', 'Nombre de la clínica', c.name, ad ? '' : 'disabled')}
        <label class="field"><span>Zona horaria</span><select id="cn-tz" ${ad ? '' : 'disabled'}>${TZ.map(z => `<option ${z === c.timezone ? 'selected' : ''}>${z}</option>`).join('')}</select></label></div>
        ${ad ? '<div class="actions" style="margin-top:12px"><button class="btn primary" data-act="cnSaveClinic">Guardar</button></div>' : '<p class="cn-note">Solo la administración de la clínica puede cambiar estos datos.</p>'}
        <p class="cn-note">Estado de la cuenta: <b>${h.esc({ active: 'activa', suspended: 'suspendida', closed: 'cerrada' }[c.account_status] || c.account_status)}</b>${c.status_reason ? ` · ${h.esc(c.status_reason)}` : ''}</p></section>
        <section class="panel"><header><h2>Datos fiscales (emisor de las facturas)</h2></header>${finance ? `<div class="form">
        ${field('bp-legal', 'Razón social o nombre completo', bp?.legal_name)}${field('bp-tax', 'NIF', bp?.tax_id)}
        <label class="field full"><span>Dirección</span><input type="text" id="bp-addr" value="${h.esc(bp?.address_line || '')}"></label>
        ${field('bp-cp', 'Código postal', bp?.postal_code)}${field('bp-city', 'Ciudad', bp?.city)}${field('bp-region', 'Provincia', bp?.region)}
        ${field('bp-email', 'Email de facturación', bp?.billing_email)}${field('bp-phone', 'Teléfono', bp?.billing_phone)}${field('bp-series', 'Serie de facturación', bp?.invoice_series || 'KOVO')}</div>
        <div class="actions" style="margin-top:12px"><button class="btn primary" data-act="cnSaveBilling">Guardar datos fiscales</button></div>
        <p class="cn-note">Se copian en cada factura al emitirla y ya no cambian en las facturas emitidas. La numeración es correlativa por clínica (pendiente de validación fiscal: series por año y facturas rectificativas).</p>`
        : '<p class="cn-note">Solo psicólogas y gestoría ven y editan los datos fiscales.</p>'}</section></div>`;
    },
    async equipo() {
      const [team, invs] = await Promise.all([clinic.team(), isAdmin() ? clinic.invitations().catch(() => []) : Promise.resolve([])]);
      const ad = isAdmin();
      const me = data.context?.()?.userId;
      const rows = team.map(m => `<tr><td><b>${h.esc(m.display_name || '')}</b>${m.email ? `<div class="muted small">${h.esc(m.email)}</div>` : ''}</td>
        <td>${ad && m.user_id !== me ? `<select data-cn-role="${m.membership_id}" aria-label="Rol">${Object.entries(ROLE_LABEL).map(([v, l]) => `<option value="${v}" ${v === m.role ? 'selected' : ''}>${l}</option>`).join('')}</select>` : h.esc(ROLE_LABEL[m.role] || m.role)}</td>
        <td>${m.is_admin ? '<span class="chip acc">Administración</span>' : ''} ${m.active ? '<span class="chip ok">Activa</span>' : '<span class="chip">Desactivada</span>'}</td>
        <td class="r">${ad && m.user_id !== me ? `<button class="btn sm" data-act="cnMember" data-id="${m.membership_id}" data-k="admin" data-v="${!m.is_admin}">${m.is_admin ? 'Quitar administración' : 'Hacer administradora'}</button> <button class="btn sm ${m.active ? 'danger' : ''}" data-act="cnMember" data-id="${m.membership_id}" data-k="active" data-v="${!m.active}">${m.active ? 'Desactivar' : 'Reactivar'}</button>` : ''}</td></tr>`).join('');
      const pend = invs.map(i => `<div class="row"><div class="m"><b>${h.esc(i.email)}</b><span>${h.esc(ROLE_LABEL[i.role] || i.role)}${i.is_admin ? ' · administración' : ''} · caduca el ${fmtDate(i.expires_at)}</span></div><button class="btn sm ghost" data-act="cnRevoke" data-id="${i.id}">Revocar</button></div>`).join('');
      return `<section class="panel flush"><header><h2>Equipo</h2></header><div class="tbl-wrap"><table><thead><tr><th>Persona</th><th>Rol</th><th>Estado</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="empty">Sin miembros.</td></tr>'}</tbody></table></div></section>
        ${ad ? `<div class="grid2"><section class="panel"><header><h2>Invitar a una persona</h2></header><div class="form">
          <label class="field full"><span>Correo</span><input type="email" id="cn-inv-email" autocomplete="off"></label>
          <label class="field"><span>Rol</span><select id="cn-inv-role">${Object.entries(ROLE_LABEL).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
          <label class="toggle"><div><b>Administración</b><small>Puede gestionar equipo, datos de la clínica y suscripción.</small></div><input type="checkbox" class="sw" id="cn-inv-admin"></label></div>
          <div class="actions" style="margin-top:12px"><button class="btn primary" data-act="cnInvite">Crear invitación</button></div><div id="cn-inv-out"></div>
          <p class="cn-note">KOVO todavía no envía correos: copia el enlace y envíaselo tú. Caduca en 7 días y solo sirve para ese correo.</p></section>
          <section class="panel"><header><h2>Invitaciones pendientes</h2></header><div class="list">${pend || '<div class="empty">No hay invitaciones pendientes.</div>'}</div></section></div>`
          : '<p class="cn-note">Solo la administración de la clínica puede invitar o cambiar roles.</p>'}`;
    },
    async suscripcion() {
      const [sub, plans] = await Promise.all([clinic.subscription(), clinic.plans()]);
      const ad = isAdmin();
      const trial = sub?.status === 'trialing';
      const lim = v => v == null ? 'Sin límite' : v;
      const cards = plans.map(p => `<div class="cn-plan" aria-current="${sub?.plan_code === p.code}"><h3>${h.esc(p.name)}</h3><ul>
        <li>Profesionales: ${lim(p.max_professionals)}</li><li>Personas en el equipo: ${lim(p.max_members)}</li><li>Almacenamiento: ${p.max_storage_mb == null ? 'Sin límite' : `${Math.round(p.max_storage_mb / 1024)} GB`}</li>
        <li>Precio: ${p.monthly_price_cents == null ? 'pendiente de definir' : `${(p.monthly_price_cents / 100).toFixed(2)} €/mes`}</li></ul>
        ${sub?.plan_code === p.code ? '<p class="cn-note"><b>Plan actual</b></p>' : ad && trial ? `<button class="btn sm" style="margin-top:10px" data-act="cnPlan" data-code="${p.code}">Cambiar a ${h.esc(p.name)}</button>` : ''}</div>`).join('');
      return `<section class="panel"><header><h2>Suscripción a KOVO</h2></header>
        ${sub ? `<p style="margin:0">Plan <b>${h.esc(PLAN_LABEL[sub.plan_code] || sub.plan_code)}</b> · ${h.esc(SUB_LABEL[sub.status] || sub.status)}${sub.trial_ends_at && trial ? ` hasta el ${fmtDate(sub.trial_ends_at)}` : ''}${sub.current_period_end && !trial ? ` · periodo hasta el ${fmtDate(sub.current_period_end)}` : ''}</p>
        ${sub.cancel_at_period_end ? '<p class="cn-note">Se cancelará al final del periodo.</p>' : ''}`
        : '<p style="margin:0">Esta clínica no tiene plan asignado. Escribe a soporte para asignarlo.</p>'}
        <p class="cn-note">Los límites y precios son provisionales. KOVO todavía no cobra: la pasarela de pago no está configurada. Durante la prueba puedes cambiar de plan libremente; después, el cambio se hará desde la pasarela.</p></section>
        <div class="cn-plans">${cards}</div>
        ${ad && sub ? `<section class="panel"><header><h2>Cancelación</h2></header><p style="margin:0 0 12px">${sub.cancel_at_period_end ? 'La suscripción está programada para cancelarse.' : 'Puedes programar la cancelación al final del periodo actual. Tus datos se conservan y puedes exportarlos.'}</p>
          <button class="btn ${sub.cancel_at_period_end ? '' : 'danger'}" data-act="cnCancel" data-v="${!sub.cancel_at_period_end}">${sub.cancel_at_period_end ? 'Mantener la suscripción' : 'Cancelar al final del periodo'}</button></section>` : ''}`;
    },
    async soporte() {
      const tickets = await clinic.tickets();
      return `<div class="grid2"><section class="panel"><header><h2>Escribir a soporte de KOVO</h2></header><div class="form">
        <label class="field full"><span>Asunto</span><input type="text" id="cn-t-subject" maxlength="160"></label>
        <label class="field full"><span>Mensaje</span><textarea id="cn-t-body" rows="6" maxlength="5000"></textarea></label></div>
        <p class="cn-note">No incluyas datos de pacientes ni información clínica: soporte no los necesita para ayudarte.</p>
        <div class="actions" style="margin-top:12px"><button class="btn primary" data-act="cnTicket">Enviar a soporte</button></div></section>
        <section class="panel"><header><h2>Tus consultas</h2></header><div class="list">${tickets.map(t => `<div class="row"><div class="m"><b>${h.esc(t.subject)}</b><span>${fmtDateTime(t.created_at)} · ${h.esc({ open: 'abierta', in_progress: 'en curso', closed: 'cerrada' }[t.status] || t.status)}</span>${t.platform_reply ? `<span><b>Respuesta:</b> ${h.esc(t.platform_reply)}</span>` : ''}</div></div>`).join('') || '<div class="empty">Todavía no has escrito a soporte.</div>'}</div></section></div>`;
    },
    async audit() {
      if (!isAdmin()) return '<section class="panel"><p style="margin:0">El registro de auditoría de la clínica lo ve la administración.</p></section>';
      const rows = await clinic.auditLog(200);
      const fields = m => Array.isArray(m?.changed) && m.changed.length ? ` · ${m.changed.map(h.esc).join(', ')}` : '';
      return `<section class="panel flush"><div class="tbl-wrap"><table><thead><tr><th>Fecha</th><th>Acción</th><th>Elemento</th></tr></thead><tbody>${rows.map(a => `<tr><td class="num">${fmtDateTime(a.created_at)}</td><td>${h.esc(a.action)}</td><td>${h.esc(a.entity_type || '')}${fields(a.metadata)}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">Sin registros.</td></tr>'}</tbody></table></div></section>
        <p class="cn-note">Se registra quién hizo qué y cuándo, y qué campos cambiaron (nunca su contenido). Últimos 200 registros.</p>`;
    }
  };
  // Pinta el panel de una pestaña conectada (lo llama VIEWS.config tras dibujar el contenedor).
  async function mountPanel(tab) {
    const el = document.getElementById('cn-panel');
    if (!el || !PANELS[tab]) return;
    el.innerHTML = '<section class="panel"><p class="muted" style="margin:0">Cargando…</p></section>';
    try { const html = await PANELS[tab](); if (el.isConnected && el.dataset.tab === tab) el.innerHTML = html; }
    catch (e) { if (el.isConnected) el.innerHTML = `<section class="panel"><p style="margin:0" role="alert">${h.esc(e?.message || 'No se ha podido cargar.')}</p><div class="actions" style="margin-top:12px"><button class="btn" data-act="ctab" data-t="${tab}">Reintentar</button></div></section>`; }
  }
  const val = id => document.getElementById(id)?.value ?? '';

  /* ---------------------------------------------------------------- acciones propias */
  const ACT = {
    billNow: (d, b) => {
      const a = S().appts.find(x => x.id === d.id); const p = a && h.P(a.patientId);
      if (!a || !p) return;
      if (a.invoiceId) { h.toast('Esta sesión ya está facturada'); return; }
      if (p.billing?.type === 'empresa') { h.toast('Irá en la factura mensual de la empresa («Facturar ahora» en Facturación)'); return; }
      run(b, () => draftFor(p, [a]), async id => { h.closeModal(); await reload('Borrador de factura creado · revísalo y emítelo'); if (invById(id)) h.openInv(id); },
        e => { if (alreadyBilled(e)) { h.closeModal(); reload('Esta sesión ya estaba facturada'); } else h.toast(e?.message || 'No se ha podido crear la factura'); });
    },
    // Sesiones realizadas sin facturar: una factura por sesión; las de empresa, una por empresa/paciente.
    // Una a una: si una falla, las demás siguen y se informa de cuántas quedan.
    billAll: (d, b) => {
      const pend = S().appts.filter(a => a.status === 'realizada' && !a.invoiceId);
      if (!pend.length) { h.toast('No hay sesiones sin facturar'); return; }
      const groups = []; const emp = new Map();
      for (const a of pend) { const p = h.P(a.patientId); if (!p) continue; if (p.billing?.type === 'empresa') { if (!emp.has(p.id)) emp.set(p.id, []); emp.get(p.id).push(a); } else groups.push([p, [a]]); }
      for (const [pid, list] of emp) groups.push([h.P(pid), list]);
      run(b, async () => {
        let ok = 0, skip = 0; const fails = [];
        for (const [p, list] of groups) {
          try { await draftFor(p, list); ok++; }
          catch (e) { if (e?.code === 'auth' || e?.code === 'network') throw Object.assign(e, { partial: ok }); if (alreadyBilled(e)) skip++; else fails.push(e?.message || 'error'); }
        }
        return { ok, skip, fails };
      }, async ({ ok, skip, fails }) => {
        const parts = [`${ok} ${ok === 1 ? 'borrador de factura creado' : 'borradores de factura creados'}`];
        if (skip) parts.push(`${skip} ya estaban facturadas`);
        if (fails.length) parts.push(`${fails.length} sin crear: ${[...new Set(fails)][0]}`);
        await reload(parts.join(' · '));
      }, e => { h.toast(`${e?.message || 'No se ha podido facturar'}${e?.partial ? ` · se crearon ${e.partial} antes del error` : ''}`); if (e?.partial) reload(); });
    },
    addSvc: (d, b) => run(b, () => clinic.createService({ name: 'Nuevo servicio', dur: 60, price: 5000, exempt: true }), () => reload('Servicio añadido · edítalo en la tabla')),
    delSvc: (d, b) => {
      if (S().appts.some(a => a.service === d.id && a.status !== 'cancelada' && a.date >= h.today)) { h.toast('Hay citas futuras con este servicio; cámbialas antes de archivarlo.'); return; }
      run(b, () => clinic.updateService(d.id, { active: false }), () => reload('Servicio archivado: las citas antiguas lo conservan'));
    },
    addRange: (d, b) => { const n = copyAvail(); const a = (n[d.d] = n[d.d] || []); const last = a[a.length - 1]; const st = last ? Math.min(last[1] + 60, 1260) : 600; a.push([st, Math.min(st + 240, 1380)]); saveAvail(n, 'Franja añadida', b); },
    delRange: (d, b) => { const n = copyAvail(); n[d.d].splice(Number(d.i), 1); saveAvail(n, 'Franja quitada', b); },
    setTheme: d => { S().settings.theme = d.k; try { localStorage.setItem(THEME_KEY, d.k); } catch {} h.render(); h.toast('Tema aplicado en este dispositivo'); },
    toggleTheme: () => ACT.setTheme({ k: h.effTheme() === 'dark' ? 'light' : 'dark' }),
    // diagnósticos y pruebas (se retiran, no se borran: quedan en el historial del servidor)
    dxSave: (d, b) => {
      const tests = [...document.querySelectorAll('[data-dxt]')].filter(c => c.checked).map(c => c.dataset.dxt);
      run(b, () => clinic.saveDiagnosis({ id: d.id || null, patientId: d.p, title: val('dx-t'), date: val('dx-d') || h.today, text: val('dx-x'), tests, author: S().pro?.name || null }),
        async () => { h.closeModal(); await reload('Diagnóstico guardado'); });
    },
    dxDel: (d, b) => run(b, () => clinic.retireClinical('dx', d.id), async () => { h.closeModal(); await reload('Diagnóstico retirado · se conserva en el historial'); }),
    testSave: (d, b) => run(b, () => clinic.saveTest({ id: d.id || null, patientId: d.p, name: val('tf-n'), date: val('tf-d') || h.today, result: val('tf-r') }),
      async () => { h.closeModal(); await reload('Prueba guardada'); }),
    testDel: (d, b) => run(b, () => clinic.retireClinical('test', d.id), async () => { h.closeModal(); await reload('Prueba retirada · se conserva en el historial'); }),
    // gastos fijos: se guardan y el servidor apunta los meses debidos
    fxSave: (d, b) => {
      const f = d.id ? S().fixed.find(x => x.id === d.id) : null;
      const pct = id => { const v = val(id); return v === '' ? null : Math.min(100, Math.max(0, Number(v) || 0)); };
      const active = !!document.getElementById('fx-a')?.checked;
      const data = { id: f?.id || null, name: val('fx-n'), cat: val('fx-c'), day: val('fx-d'), base: Math.round(Number(val('fx-b')) * 100), ivaPct: val('fx-i'), retPct: val('fx-r'), ded: pct('fx-ded'), active,
        since: !f || (active && !f.active) ? h.today.slice(0, 7) : null };
      run(b, async () => { await clinic.saveFixed(data); return clinic.applyRecurring(); }, async n => { h.closeModal(); await reload(n > 0 ? `Gasto fijo guardado · ${n} ${n === 1 ? 'mes apuntado' : 'meses apuntados'}` : 'Gasto fijo guardado'); });
    },
    fxDel: (d, b) => run(b, () => clinic.deleteFixed(d.id), async () => { h.closeModal(); await reload('Gasto fijo eliminado · lo ya registrado se conserva'); }),
    // vacaciones y días cerrados (professional_time_off de la profesional de la sesión)
    blockAdd: (d, b) => run(b, () => clinic.addTimeOff(S().pro?.id, { from: val('bk-f'), to: val('bk-t'), label: val('bk-l') || 'Cerrado' }), () => reload('Días cerrados añadidos')),
    blockDel: (d, b) => run(b, () => clinic.deleteTimeOff(d.id), () => reload('Días cerrados quitados')),
    cnEnsurePro: (d, b) => run(b, () => clinic.ensureMyProfessional(), () => reload('Ficha profesional creada')),
    // facturas
    saveNewInv: (d, b) => {
      const p = h.P(val('ni-p')); const amt = Math.round(Number(val('ni-a')) * 100);
      if (!p || !(amt > 0)) { h.toast('Indica el paciente y un importe mayor que cero'); return; }
      run(b, () => clinic.saveInvoiceDraft({ patientId: p.id, date: h.today, due: h.addDays(h.today, S().settings.dueDays), lines: [{ desc: val('ni-d') || 'Servicio', qty: 1, price: amt, exempt: val('ni-x') === '1' }], retPct: retPctFor(p) }),
        async id => { h.closeModal(); await reload('Borrador de factura creado'); if (invById(id)) h.openInv(id); });
    },
    saveDraft: (d, b) => {
      const i = invById(d.id); const lines = readLinesFromModal(i);
      run(b, () => clinic.updateInvoiceDraft(i.id, { due: i.due, lines, retPct: i.ret }), async () => { h.closeModal(); await reload('Borrador guardado'); });
    },
    emitInv: (d, b) => {
      const i = invById(d.id); const lines = readLinesFromModal(i); const p = h.P(i.patientId);
      if (!S().issuer) { h.toast('Completa los datos fiscales de la clínica (Ajustes › Clínica) antes de emitir.'); return; }
      if (!p) { h.toast('La factura necesita un paciente.'); return; }
      run(b, async () => {
        await clinic.savePatientBillingProfile(p.id, p.billing);
        await clinic.updateInvoiceDraft(i.id, { due: i.due, lines, retPct: i.ret });
        return clinic.emitInvoice(i.id);
      }, async r => { h.closeModal(); await reload(`Factura ${r?.invoice_number || ''} emitida`); }, async e => { h.toast(e.message); await h.reload().catch(() => {}); });
    },
    delInv: (d, b) => run(b, () => clinic.discardInvoice(d.id), async () => { h.closeModal(); await reload('Borrador descartado'); }),
    payInv: (d, b) => {
      const i = invById(d.id); const amt = Math.round(Number(val('pay-a')) * 100); const t = h.tot(i);
      if (!(amt > 0)) { h.toast('Indica un importe válido'); return; }
      if (amt > t.pending) { h.toast('El importe supera lo pendiente'); return; }
      run(b, () => clinic.recordPayment(i.id, amt, val('pay-m')), async r => { h.closeModal(); await reload(r?.status === 'paid' ? 'Factura cobrada' : 'Cobro parcial registrado'); });
    },
    // gastos
    cnNewExp: () => expenseModal(null),
    openExp: d => expenseModal(S().expenses.find(x => x.id === d.id)),
    saveExp: d => expenseModal(S().expenses.find(x => x.id === d.id)),
    delExp: (d, b) => ACT.cnDelExp(d, b),
    cnSaveExp: (d, b) => {
      const amount = Math.round(Number(val('cx-a')) * 100);
      run(b, () => clinic.saveExpense({ id: d.id || null, description: val('cx-d').trim() || val('cx-s').trim(), category: val('cx-c'), amount, date: val('cx-f') || h.today, supplier: val('cx-s').trim() || null }),
        async () => { h.closeModal(); await reload('Gasto guardado'); });
    },
    cnDelExp: (d, b) => run(b, () => clinic.deleteExpense(d.id), async () => { h.closeModal(); await reload('Gasto eliminado'); }),
    // documentos
    cnOpenDoc: (d, b) => openDocument(d.path, d.name, b),
    cnWithdrawDoc: (d, b) => {
      if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = '¿Retirar? Pulsa otra vez'; setTimeout(() => { if (b.isConnected) { b.dataset.confirm = ''; b.textContent = 'Retirar'; } }, 4000); return; }
      run(b, () => clinic.withdrawDocument(d.id), () => reload('Documento retirado de la ficha (se conserva en el registro)'));
    },
    // sesión y clínica
    cnLogout: async () => { await data.signOut(); location.hash = ''; location.reload(); },
    cnSwitch: () => { data.switchOrg(); location.reload(); },
    // paneles
    cnSaveClinic: (d, b) => run(b, () => clinic.updateClinic({ name: val('cn-name'), timezone: val('cn-tz') }), async r => { S().org.name = r.name; sidebar(); h.toast('Datos de la clínica guardados'); }),
    cnSaveBilling: (d, b) => run(b, () => clinic.saveBillingProfile({ legal_name: val('bp-legal'), tax_id: val('bp-tax'), address_line: val('bp-addr'), postal_code: val('bp-cp'), city: val('bp-city'), region: val('bp-region'), billing_email: val('bp-email'), billing_phone: val('bp-phone'), invoice_series: val('bp-series') }),
      () => reload('Datos fiscales guardados')),
    cnInvite: (d, b) => run(b, () => clinic.invite(val('cn-inv-email'), val('cn-inv-role'), document.getElementById('cn-inv-admin')?.checked), r => {
      const link = `${location.origin}${location.pathname}#invitacion=${r.token}`;
      const out = document.getElementById('cn-inv-out');
      if (out) out.innerHTML = `<div class="cn-link"><input type="text" readonly id="cn-inv-link" value="${h.esc(link)}" aria-label="Enlace de invitación"><button class="btn sm" data-act="cnCopy" data-id="cn-inv-link">Copiar</button></div><p class="cn-note">Este enlace solo se muestra ahora. Si lo pierdes, revoca la invitación y crea otra.</p>`;
      const e = document.getElementById('cn-inv-email'); if (e) e.value = '';
      h.toast('Invitación creada');
    }),
    cnCopy: d => { const el = document.getElementById(d.id); if (!el) return; navigator.clipboard?.writeText(el.value).then(() => h.toast('Copiado'), () => { el.select(); h.toast('Selecciona y copia con Ctrl+C'); }); },
    cnRevoke: (d, b) => run(b, () => clinic.revokeInvitation(d.id), () => { h.toast('Invitación revocada'); mountPanel('equipo'); }),
    cnMember: (d, b) => run(b, () => clinic.updateMember(d.id, d.k === 'admin' ? { isAdmin: d.v === 'true' } : { active: d.v === 'true' }), () => { h.toast('Equipo actualizado'); mountPanel('equipo'); }),
    cnPlan: (d, b) => run(b, () => clinic.changePlan(d.code), () => { h.toast('Plan cambiado'); location.reload(); }),
    cnCancel: (d, b) => run(b, () => clinic.setCancellation(d.v === 'true'), () => { h.toast(d.v === 'true' ? 'Cancelación programada' : 'Suscripción mantenida'); location.reload(); }),
    cnTicket: (d, b) => run(b, () => clinic.openTicket(val('cn-t-subject'), val('cn-t-body')), () => { h.toast('Mensaje enviado a soporte'); mountPanel('soporte'); })
  };

  window.addEventListener('click', e => {
    const t = e.target.closest?.('[data-act]'); if (!t) return;
    const a = t.dataset.act;
    if (BLOCKED[a]) { e.stopPropagation(); e.preventDefault(); h.toast(BLOCKED[a]); return; }
    if (NEEDS[a] && !S()[NEEDS[a]]) { e.stopPropagation(); e.preventDefault(); h.toast(NEEDS[a] === 'clinicalAvailable' ? NO_DX : NO_FIXED); return; }
    const f = ACT[a]; if (!f) return;
    e.stopPropagation(); e.preventDefault();
    f(t.dataset, t, e);
  }, true);

  window.addEventListener('change', e => {
    const t = e.target; if (!t?.dataset) return;
    const stop = () => { e.stopPropagation(); };
    if (t.id === 'role' || t.id === 'role2' || t.id === 'role3') { stop(); h.render(); return; }
    if (t.dataset.up) {
      stop();
      const file = t.files?.[0]; const kind = t.dataset.up; t.value = '';
      if (!file) return;
      if (BLOCKED_UPLOADS[kind]) { h.toast(BLOCKED_UPLOADS[kind]); return; }
      if (role() !== 'psychologa') { h.toast('Solo la psicóloga puede subir documentación clínica.'); return; }
      run(null, () => clinic.uploadDocument({ patientId: t.dataset.p, file, type: kind === 'consent' ? 'consentimiento' : 'otro' }),
        () => reload(kind === 'consent' ? 'Consentimiento guardado en el almacenamiento privado' : 'Documento guardado en el almacenamiento privado'));
      return;
    }
    if (t.dataset.cnRole) { stop(); run(t, () => clinic.updateMember(t.dataset.cnRole, { role: t.value }), () => { h.toast('Rol cambiado'); mountPanel('equipo'); }, err => { h.toast(err.message); mountPanel('equipo'); }); return; }
    if (t.dataset.ded) { stop(); const k = t.dataset.ded, v = Math.min(100, Math.max(0, Number(t.value) || 0)); saveSettings(s => { s.ded = { ...(s.ded || {}), [k]: v }; }, 'Porcentaje actualizado'); return; }
    if (t.dataset.set) { stop(); const k = t.dataset.set, v = t.checked; saveSettings(s => { s[k] = v; }, v ? 'Activado' : 'Desactivado'); return; }
    if (t.name === 'invmode') { stop(); const v = t.value; saveSettings(s => { s.invoiceMode = v; }, 'Modo de facturación actualizado'); return; }
    if (t.id === 'dueDays') { stop(); const v = Math.max(0, Math.min(90, Number(t.value) || 0)); saveSettings(s => { s.dueDays = v; }, 'Vencimiento actualizado'); return; }
    if (t.id === 'reminderH') { stop(); const v = Math.min(168, Math.max(1, Number(t.value) || 24)); saveSettings(s => { s.reminderH = v; }, 'Recordatorio actualizado'); return; }
    if (t.id === 'h0' || t.id === 'h1') {
      stop(); const s = S().settings; const v = Number(t.value);
      const n0 = t.id === 'h0' ? v : (s.h0 ?? 9), n1 = t.id === 'h1' ? v : (s.h1 ?? 21);
      if (!(n0 >= 0 && n1 <= 24 && n1 > n0)) { h.toast('Revisa las horas: la última debe ser posterior a la primera'); h.render(); return; }
      saveSettings(x => { x.h0 = n0; x.h1 = n1; }, 'Calendario actualizado'); return;
    }
    if (t.dataset.sv) {
      stop(); const sv = S().services.find(x => x.id === t.dataset.sv); if (!sv) return; const f = t.dataset.f; const ch = {};
      if (f === 'name') { const v = t.value.trim(); if (!v) { t.value = sv.name; return; } ch.name = v; }
      else if (f === 'dur') ch.dur = Math.max(5, Number(t.value) || sv.dur);
      else if (f === 'price') ch.price = Math.max(0, Math.round(Number(t.value) * 100));
      else if (f === 'exempt') ch.exempt = t.value === '1';
      run(t, () => clinic.updateService(sv.id, ch), () => { Object.assign(sv, ch); h.render(); h.toast('Servicio actualizado'); }, err => { h.render(); h.toast(err.message); });
      return;
    }
    if (t.dataset.av) {
      stop(); const [dd, i, k] = t.dataset.av.split(':').map(Number); const n = copyAvail(); const r = n[dd][i];
      if (!t.value) { h.render(); return; }
      r[k] = toMin(t.value);
      if (r[1] <= r[0]) { h.toast('La hora de fin debe ser posterior a la de inicio'); h.render(); return; }
      n[dd].sort((x, y) => x[0] - y[0]);
      saveAvail(n, 'Horario guardado'); return;
    }
    if (t.dataset.pro) {
      stop(); const k = PRO_FIELDS[t.dataset.pro];
      if (!k) { h.toast('Este dato todavía no se guarda en el servidor.'); h.render(); return; }
      if (!S().pro?.id) { h.toast('Primero crea tu ficha profesional.'); h.render(); return; }
      const v = t.value;
      run(t, () => clinic.updateProfessional(S().pro.id, { [k]: v }), () => { S().pro[k] = v; h.render(); h.toast('Guardado'); }, err => { h.render(); h.toast(err.message); });
    }
  }, true);

  return {
    tabs: CONNECTED_TABS,
    tabsFor,
    isPanel: tab => PANEL_TABS.has(tab),
    panel: tab => { queueMicrotask(() => mountPanel(tab)); return `<div id="cn-panel" data-tab="${tab}"></div>`; },
    refresh: () => { sidebar(); banner(); },
    isAdmin,
    role,
    // El registro va antes de la descarga: si no se puede registrar, no se exporta.
    logExport: (patientId, counts) => clinic.logExport(patientId, counts)
  };
}
