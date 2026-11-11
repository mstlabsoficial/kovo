// Operaciones del modo conectado que no son pacientes, citas ni notas: configuración de la
// clínica, equipo, horario, servicios, documentos (Storage privado), facturación a pacientes,
// gastos, suscripción a KOVO y soporte. Cada operación es UNA petición confirmada por el servidor;
// la base de datos (RLS + RPC) decide los permisos. Nada se da por guardado sin respuesta.
import { supabaseRequest, readSession, SUPABASE_URL, SUPABASE_KEY } from './supabase-client.js';
import { isUuid } from './mapping.js';
import { madridToUtc } from './legacy-writes.js';

export class ClinicError extends Error {
  constructor(code, message, { status = null, pg = null } = {}) { super(message); this.name = 'ClinicError'; this.code = code; this.status = status; this.pg = pg; }
}

// Mensajes de los códigos propios de la base de datos (db/migrations) y de PostgreSQL.
const PG_MESSAGES = {
  KS001: 'La cuenta de la clínica está suspendida: puedes consultar y exportar, pero no guardar cambios. Contacta con soporte.',
  KP001: null, KP002: null,   // el mensaje del servidor ya explica el límite del plan
  KP003: 'El cambio de un plan de pago se hará desde la pasarela de pago, que todavía no está configurada.',
  KP004: 'No hay una suscripción activa.',
  KT001: 'Esa persona ya forma parte del equipo.', KT002: 'La invitación ya no está pendiente.',
  KT003: 'La invitación no es válida o ha caducado.', KT004: 'La invitación es para otra dirección de correo.',
  KT005: 'No puedes quitarte a ti misma la administración ni desactivarte. Pídeselo a otra persona administradora.',
  KT006: 'La clínica debe conservar al menos una persona administradora.',
  KB001: 'Solo se registran cobros de facturas emitidas pendientes de cobro.', KB002: 'El cobro supera el importe pendiente.',
  KB003: 'Solo se pueden descartar borradores.', KD001: 'Ruta de documento no válida.', KD002: 'Ese dato del documento no se puede cambiar.',
  KD003: 'El documento ya está retirado.',
  KC001: 'La clínica y el paciente de un registro clínico no se pueden cambiar.', KC002: 'Este registro ya está retirado y no se puede modificar.',
  KC003: 'Las pruebas o el documento deben ser del mismo paciente.',
  '23P01': 'Ese horario se solapa con otro de la misma profesional.',
  '23505': 'Ya existe un registro con esos datos.', '42501': 'Tu perfil no tiene permiso para esta acción.'
};

export function clinicError(e) {
  if (e instanceof ClinicError) return e;
  const status = Number.isInteger(e?.status) ? e.status : null;
  const pg = e?.details?.code || null;
  if (status === 401) return new ClinicError('auth', 'Tu sesión ha caducado. Vuelve a iniciar sesión; no se ha guardado nada.', { status, pg });
  if (pg && pg in PG_MESSAGES) return new ClinicError(pg, PG_MESSAGES[pg] || e?.details?.message || e.message, { status, pg });
  if (status === 403) return new ClinicError('forbidden', PG_MESSAGES['42501'], { status, pg });
  if (pg === 'P0001' && e?.details?.message) return new ClinicError('rule', e.details.message, { status, pg });
  if (status) return new ClinicError('http', e?.details?.message ? `No se ha podido guardar: ${e.details.message}` : `No se ha podido guardar (HTTP ${status}).`, { status, pg });
  return new ClinicError('network', 'No hay conexión con el servidor: no se ha guardado nada. Inténtalo de nuevo.');
}

export const DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
export const DOC_MAX_BYTES = 20 * 1024 * 1024;
export const BUCKET = 'kovo-patient-documents';
const METHOD = { Efectivo: 'efectivo', Tarjeta: 'tarjeta', Transferencia: 'transferencia', Bizum: 'bizum', Domiciliación: 'domiciliacion' };

const validDate = d => { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d || ''))) throw new ClinicError('validation', 'La fecha no es válida.'); return d; };

export function safeFileName(name) {
  const base = String(name || 'documento').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^[-.]+/, '');
  return (base || 'documento').slice(-120);
}

export function createClinicApi({ request = supabaseRequest, refresh = async () => null, getContext, fetchImpl = (...a) => fetch(...a), newId = () => crypto.randomUUID() } = {}) {
  const call = async (path, options) => {
    let again = true;
    for (;;) {
      try { return await request(path, options); }
      catch (e) {
        if (e?.status === 401 && again) { again = false; if (await refresh().catch(() => null)) continue; }
        // 403 de RLS: o falta permiso o la sesión se ha revocado en el servidor (cierre de sesión en
        // otro dispositivo). Se distingue renovando una vez: si no se puede, la sesión ya no vale.
        if ((e?.status === 403 || e?.details?.code === '42501') && again) {
          again = false;
          if (await refresh().catch(() => null)) continue;
          throw new ClinicError('auth', 'Tu sesión ha caducado o se ha cerrado en otro dispositivo. Vuelve a iniciar sesión; no se ha guardado nada.', { status: e.status, pg: e?.details?.code || null });
        }
        throw clinicError(e);
      }
    }
  };
  const rpc = (fn, args = {}) => call(`rpc/${fn}`, { method: 'POST', body: args });
  const ctx = async () => { const c = await getContext(); if (!c || !isUuid(c.id)) throw new ClinicError('forbidden', 'No se ha podido identificar tu clínica.'); return c; };
  const rep = { Prefer: 'return=representation' };
  const one = rows => { if (!Array.isArray(rows) || rows.length !== 1) throw new ClinicError('unexpected_response', 'El servidor no ha confirmado el cambio. Recarga para comprobarlo.'); return rows[0]; };

  const storage = async (path, { method = 'GET', body, contentType } = {}) => {
    let again = true;
    for (;;) {
      const token = readSession()?.access_token;
      let r;
      try {
        r = await fetchImpl(`${SUPABASE_URL}/storage/v1/${path}`, { method, body, headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${token || SUPABASE_KEY}`, ...(contentType ? { 'content-type': contentType, 'x-upsert': 'false' } : {}) } });
      } catch { throw new ClinicError('network', 'No hay conexión con el servidor: el documento NO se ha subido.'); }
      if (r.status === 401 && again) { again = false; if (await refresh().catch(() => null)) continue; }
      if (!r.ok) {
        let j = null; try { j = await r.json(); } catch {}
        const t = `${j?.error || ''} ${j?.message || ''}`.toLowerCase();
        if (r.status === 413 || /too large|exceeded the maximum/.test(t)) throw new ClinicError('too_large', 'El archivo supera el tamaño máximo (20 MB).');
        if (r.status === 415 || /mime|invalid.*type/.test(t)) throw new ClinicError('type', 'Solo se admiten PDF, JPEG o PNG.');
        if (r.status === 403 || /row-level security|unauthorized/.test(t)) throw new ClinicError('forbidden', 'Tu perfil no puede subir o abrir documentos clínicos de esta clínica.');
        if (r.status === 400 && /not.?found/.test(t) || r.status === 404) throw new ClinicError('not_found', 'El documento no existe o no tienes acceso.');
        throw new ClinicError('http', `Storage ha rechazado la operación (HTTP ${r.status}).`, { status: r.status });
      }
      return r;
    }
  };

  return {
    rpc,
    /* clínica */
    async updateClinic({ name, timezone, settings }) {
      const c = await ctx();
      const body = {};
      if (name !== undefined) { if (!name || name.trim().length < 2 || name.length > 120) throw new ClinicError('validation', 'El nombre debe tener entre 2 y 120 caracteres.'); body.name = name.trim(); }
      if (timezone !== undefined) body.timezone = timezone;
      if (settings !== undefined) body.settings = settings;
      const rows = await call(`organizations?id=eq.${c.id}`, { method: 'PATCH', body, headers: rep });
      if (Array.isArray(rows) && !rows.length) throw new ClinicError('forbidden', 'Solo la administración de la clínica puede cambiar estos datos.');
      return one(rows);
    },
    async getClinic() { const c = await ctx(); return one(await call(`organizations?select=id,name,timezone,settings,account_status,status_reason&id=eq.${c.id}`)); },
    async getBillingProfile() { const c = await ctx(); const r = await call(`organization_billing_profiles?select=*&org_id=eq.${c.id}`); return r[0] || null; },
    async saveBillingProfile(p) {
      const c = await ctx();
      for (const k of ['legal_name', 'tax_id', 'address_line', 'postal_code', 'city']) if (!p[k] || !String(p[k]).trim()) throw new ClinicError('validation', 'Completa razón social, NIF, dirección, código postal y ciudad.');
      const row = { org_id: c.id, legal_name: p.legal_name.trim(), tax_id: p.tax_id.trim().toUpperCase(), address_line: p.address_line.trim(), postal_code: p.postal_code.trim(), city: p.city.trim(),
        region: p.region?.trim() || null, billing_email: p.billing_email?.trim() || null, billing_phone: p.billing_phone?.trim() || null, invoice_series: (p.invoice_series || 'KOVO').trim().toUpperCase(), updated_at: new Date().toISOString() };
      return one(await call('organization_billing_profiles?on_conflict=org_id', { method: 'POST', body: row, headers: { Prefer: 'return=representation,resolution=merge-duplicates' } }));
    },
    /* servicios */
    async createService({ name, dur, price, exempt }) {
      const c = await ctx();
      return one(await call('services', { method: 'POST', body: { id: newId(), org_id: c.id, name: name.trim(), duration_minutes: dur, price_cents: price, tax_exempt: !!exempt }, headers: rep }));
    },
    async updateService(id, changes) {
      const c = await ctx();
      const body = {};
      if ('name' in changes) body.name = changes.name;
      if ('dur' in changes) body.duration_minutes = changes.dur;
      if ('price' in changes) body.price_cents = changes.price;
      if ('exempt' in changes) body.tax_exempt = changes.exempt;
      if ('active' in changes) body.active = changes.active;
      const rows = await call(`services?id=eq.${id}&org_id=eq.${c.id}`, { method: 'PATCH', body, headers: rep });
      if (Array.isArray(rows) && !rows.length) throw new ClinicError('forbidden', 'Tu perfil no puede modificar servicios.');
      return one(rows);
    },
    /* profesionales y horario */
    async listProfessionals() { const c = await ctx(); return call(`professionals?select=id,display_name,email,phone,professional_number,specialty,color,active,user_id&org_id=eq.${c.id}&order=display_name.asc`); },
    async ensureMyProfessional() { const c = await ctx(); return rpc('ensure_my_professional', { p_org_id: c.id }); },
    async updateProfessional(id, changes) {
      const c = await ctx();
      const map = { name: 'display_name', col: 'professional_number', email: 'email', phone: 'phone', specialty: 'specialty', active: 'active' };
      const body = {};
      for (const [k, v] of Object.entries(changes)) if (map[k]) body[map[k]] = typeof v === 'string' ? v.trim() || null : v;
      if ('display_name' in body && !body.display_name) throw new ClinicError('validation', 'El nombre no puede quedar vacío.');
      const rows = await call(`professionals?id=eq.${id}&org_id=eq.${c.id}`, { method: 'PATCH', body, headers: rep });
      if (Array.isArray(rows) && !rows.length) throw new ClinicError('forbidden', 'Solo puedes editar tu propio perfil (o administrar la clínica).');
      return one(rows);
    },
    async createProfessional({ name, email, col }) {
      const c = await ctx();
      if (!name || !name.trim()) throw new ClinicError('validation', 'Escribe el nombre de la profesional.');
      return one(await call('professionals', { method: 'POST', body: { org_id: c.id, display_name: name.trim(), email: email?.trim() || null, professional_number: col?.trim() || null }, headers: rep }));
    },
    async availability(professionalId) {
      const c = await ctx();
      return call(`professional_availability?select=weekday,start_minute,end_minute&org_id=eq.${c.id}&professional_id=eq.${professionalId}&order=weekday.asc,start_minute.asc`);
    },
    // avail: formato de legacy.js { 0..6 (lunes = 0): [[inicio, fin], …] } en minutos.
    async saveAvailability(professionalId, avail) {
      const c = await ctx();
      const ranges = [];
      for (const [d, rs] of Object.entries(avail || {})) for (const [a, b] of rs || []) ranges.push({ weekday: Number(d) + 1, start_minute: a, end_minute: b });
      return rpc('set_professional_availability', { p_org_id: c.id, p_professional_id: professionalId, p_ranges: ranges });
    },
    /* vacaciones y días cerrados (professional_time_off) */
    // from / to: 'AAAA-MM-DD' (hora de Madrid, ambos incluidos). Se guarda [from 00:00, to+1 00:00).
    async addTimeOff(professionalId, { from, to, label }) {
      const c = await ctx();
      if (!isUuid(professionalId)) throw new ClinicError('validation', 'Primero crea tu ficha profesional (Ajustes › Mi perfil profesional).');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(to || '')) throw new ClinicError('validation', 'Elige las fechas.');
      if (to < from) [from, to] = [to, from];
      const next = new Date(Date.parse(to + 'T12:00:00Z') + 864e5).toISOString().slice(0, 10);
      const reason = String(label || '').trim().slice(0, 200) || null;
      return one(await call('professional_time_off', { method: 'POST', headers: rep,
        body: { org_id: c.id, professional_id: professionalId, starts_at: madridToUtc(from, 0), ends_at: madridToUtc(next, 0), reason } }));
    },
    async deleteTimeOff(id) {
      const c = await ctx();
      if (!isUuid(id)) throw new ClinicError('validation', 'Registro no válido.');
      const rows = await call(`professional_time_off?id=eq.${id}&org_id=eq.${c.id}`, { method: 'DELETE', headers: rep });
      if (Array.isArray(rows) && !rows.length) throw new ClinicError('forbidden', 'No existe o tu perfil no puede quitarlo.');
      return one(rows);
    },
    /* diagnósticos y pruebas (datos clínicos: solo psicóloga; se retiran, no se borran) */
    async saveTest({ id = null, patientId, name, date, result }) {
      const c = await ctx();
      if (!isUuid(patientId)) throw new ClinicError('validation', 'Paciente no válido.');
      if (!String(name || '').trim()) throw new ClinicError('validation', 'Indica el nombre de la prueba.');
      const body = { name: String(name).trim().slice(0, 200), test_date: validDate(date), result: String(result || '').slice(0, 4000) };
      if (id) return one(await call(`patient_tests?id=eq.${id}&org_id=eq.${c.id}&retired_at=is.null`, { method: 'PATCH', body, headers: rep }));
      return one(await call('patient_tests', { method: 'POST', body: { ...body, id: newId(), org_id: c.id, patient_id: patientId }, headers: rep }));
    },
    async saveDiagnosis({ id = null, patientId, title, date, text, tests = [], author = null }) {
      const c = await ctx();
      if (!isUuid(patientId)) throw new ClinicError('validation', 'Paciente no válido.');
      if (!String(title || '').trim()) throw new ClinicError('validation', 'Escribe el diagnóstico.');
      const body = { title: String(title).trim().slice(0, 300), diagnosis_date: validDate(date), rationale: String(text || '').slice(0, 4000), test_ids: tests.filter(isUuid).slice(0, 50) };
      if (id) return one(await call(`patient_diagnoses?id=eq.${id}&org_id=eq.${c.id}&retired_at=is.null`, { method: 'PATCH', body, headers: rep }));
      return one(await call('patient_diagnoses', { method: 'POST', body: { ...body, id: newId(), org_id: c.id, patient_id: patientId, author_name: author ? String(author).slice(0, 200) : null }, headers: rep }));
    },
    async retireClinical(kind, id) {
      const c = await ctx();
      const table = { test: 'patient_tests', dx: 'patient_diagnoses' }[kind];
      if (!table || !isUuid(id)) throw new ClinicError('validation', 'Registro no válido.');
      return one(await call(`${table}?id=eq.${id}&org_id=eq.${c.id}&retired_at=is.null`, { method: 'PATCH', body: { retired_at: new Date().toISOString() }, headers: rep }));
    },
    /* gastos fijos */
    async saveFixed({ id = null, name, cat, supplier, day, base, ivaPct, retPct, ded, active, since }) {
      const c = await ctx();
      if (!String(name || '').trim() || !(Number.isInteger(base) && base > 0)) throw new ClinicError('validation', 'Indica el concepto y un importe mayor que cero.');
      const pct = v => Math.min(100, Math.max(0, Number(v) || 0));
      const body = { name: String(name).trim().slice(0, 200), category: cat || 'Otros', supplier: supplier ? String(supplier).slice(0, 200) : null,
        day_of_month: Math.min(31, Math.max(1, Number(day) || 1)), base_cents: base, vat_pct: pct(ivaPct), retention_pct: pct(retPct),
        deductible_pct: ded == null ? null : pct(ded), active: !!active };
      if (since) { if (!/^\d{4}-\d{2}$/.test(since)) throw new ClinicError('validation', 'Mes no válido.'); body.since_month = `${since}-01`; }
      if (id) return one(await call(`recurring_expenses?id=eq.${id}&org_id=eq.${c.id}`, { method: 'PATCH', body, headers: rep }));
      return one(await call('recurring_expenses', { method: 'POST', body: { ...body, id: newId(), org_id: c.id }, headers: rep }));
    },
    async deleteFixed(id) {
      const c = await ctx();
      const rows = await call(`recurring_expenses?id=eq.${id}&org_id=eq.${c.id}`, { method: 'DELETE', headers: rep });
      if (Array.isArray(rows) && !rows.length) throw new ClinicError('forbidden', 'No existe o tu perfil no puede eliminarlo.');
      return rows;
    },
    // Apunta los meses debidos de los gastos fijos activos (idempotente en el servidor). Nº creados.
    async applyRecurring() { const c = await ctx(); return rpc('apply_recurring_expenses', { p_org_id: c.id }); },
    // Deja constancia en audit_log de quién exportó los datos de un paciente (solo nombres de
    // apartado y recuentos, ningún dato). null si el servidor aún no tiene la función.
    async logExport(patientId, counts = {}) {
      if (!isUuid(patientId)) throw new ClinicError('validation', 'Paciente no válido.');
      try { return await rpc('log_patient_export', { p_patient_id: patientId, p_counts: counts }); }
      catch (e) { if (e?.pg === 'PGRST202') return null; throw e; }
    },
    /* equipo */
    async team() { const c = await ctx(); return rpc('list_team', { p_org_id: c.id }); },
    async invitations() { const c = await ctx(); return call(`org_invitations?select=id,email,role,is_admin,created_at,expires_at,accepted_at,revoked_at&org_id=eq.${c.id}&accepted_at=is.null&revoked_at=is.null&order=created_at.desc`); },
    async invite(email, role, isAdmin = false) {
      const c = await ctx();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email || '').trim())) throw new ClinicError('validation', 'Escribe un correo válido.');
      return rpc('invite_member', { p_org_id: c.id, p_email: email.trim(), p_role: role, p_is_admin: !!isAdmin });
    },
    revokeInvitation: id => rpc('revoke_invitation', { p_invitation_id: id }),
    updateMember: (membershipId, { role = null, active = null, isAdmin = null }) => rpc('update_membership', { p_membership_id: membershipId, p_role: role, p_active: active, p_is_admin: isAdmin }),
    /* suscripción y soporte */
    async subscription() { const c = await ctx(); const r = await call(`subscriptions?select=*&org_id=eq.${c.id}`); return r[0] || null; },
    plans: () => call('plans?select=code,name,position,max_professionals,max_members,max_storage_mb,trial_days,monthly_price_cents,provisional&active=eq.true&order=position.asc'),
    async changePlan(code) { const c = await ctx(); return rpc('change_plan', { p_org_id: c.id, p_plan_code: code }); },
    async setCancellation(cancel) { const c = await ctx(); return rpc('set_subscription_cancellation', { p_org_id: c.id, p_cancel: !!cancel }); },
    async tickets() { const c = await ctx(); return call(`support_tickets?select=id,subject,body,status,platform_reply,created_at,updated_at&org_id=eq.${c.id}&order=created_at.desc`); },
    async openTicket(subject, body) {
      const c = await ctx();
      if (!subject || subject.trim().length < 3 || !body || body.trim().length < 3) throw new ClinicError('validation', 'Escribe un asunto y un mensaje.');
      return one(await call('support_tickets', { method: 'POST', body: { org_id: c.id, subject: subject.trim(), body: body.trim() }, headers: rep }));
    },
    async auditLog(limit = 200) { const c = await ctx(); return call(`audit_log?select=id,actor_id,action,entity_type,entity_id,metadata,created_at&org_id=eq.${c.id}&order=created_at.desc&limit=${limit}`); },
    /* documentos */
    async uploadDocument({ patientId, file, type = 'otro', description = null }) {
      const c = await ctx();
      if (!isUuid(patientId)) throw new ClinicError('validation', 'Paciente no válido.');
      if (!file || !DOC_TYPES.includes(file.type)) throw new ClinicError('type', 'Solo se admiten PDF, JPEG o PNG.');
      if (file.size > DOC_MAX_BYTES) throw new ClinicError('too_large', 'El archivo supera el tamaño máximo (20 MB).');
      if (!file.size) throw new ClinicError('validation', 'El archivo está vacío.');
      const name = safeFileName(file.name);
      const path = `${c.id}/${patientId}/${newId()}-${name}`;
      await storage(`object/${BUCKET}/${path}`, { method: 'POST', body: file, contentType: file.type });
      try {
        return one(await call('patient_documents', { method: 'POST', body: { org_id: c.id, patient_id: patientId, storage_path: path, document_type: type, file_name: file.name.slice(0, 200), mime_type: file.type, size_bytes: file.size, description }, headers: rep }));
      } catch (e) {
        // El objeto ya está en Storage pero no registrado: se informa (no se puede borrar desde la app).
        throw new ClinicError(e.code || 'http', `${e.message} El archivo se subió pero no quedó registrado en la ficha; vuelve a intentarlo o avisa a soporte.`);
      }
    },
    async downloadDocument(storagePath) {
      const r = await storage(`object/authenticated/${BUCKET}/${storagePath.split('/').map(encodeURIComponent).join('/')}`);
      return r.blob();
    },
    async withdrawDocument(id) {
      const c = await ctx();
      return one(await call(`patient_documents?id=eq.${id}&org_id=eq.${c.id}`, { method: 'PATCH', body: { deleted_at: new Date().toISOString() }, headers: rep }));
    },
    /* facturación a pacientes */
    async savePatientBillingProfile(patientId, billing) {
      const c = await ctx();
      if (!billing?.name || !billing?.addr) throw new ClinicError('validation', 'Completa el nombre y la dirección de facturación del paciente (ficha › datos de facturación) antes de emitir.');
      return one(await call('patient_billing_profiles?on_conflict=org_id,patient_id', { method: 'POST', headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
        body: { org_id: c.id, patient_id: patientId, legal_name: billing.name.trim(), tax_id: billing.nif?.trim() || null, address_line: billing.addr.trim(), updated_at: new Date().toISOString() } }));
    },
    // lines: [{ desc, qty, price (céntimos), exempt }]; retPct: % de retención sobre la base.
    async saveInvoiceDraft({ patientId, date, due, lines, retPct = 0 }) {
      const c = await ctx();
      if (!lines?.length) throw new ClinicError('validation', 'La factura necesita al menos una línea.');
      const base = lines.reduce((a, l) => a + Math.round(l.qty * l.price), 0);
      if (lines.some(l => !(l.price > 0) || !(l.qty > 0))) throw new ClinicError('validation', 'Cada línea necesita cantidad e importe mayores que cero.');
      return rpc('save_invoice_draft', { p_org_id: c.id, p_patient_id: patientId, p_issue_date: date, p_due_date: due || null,
        p_lines: lines.map(l => ({ description: (l.desc || 'Servicio').slice(0, 300), quantity: l.qty, unit_price_cents: l.price, tax_rate: l.exempt ? 0 : 21, ...(l.apptId ? { appointment_id: l.apptId } : {}) })),
        p_retention_cents: Math.round(base * (retPct || 0) / 100) });
    },
    async updateInvoiceDraft(id, { due, lines, retPct = 0 }) {
      if (!lines?.length || lines.some(l => !(l.price > 0) || !(l.qty > 0))) throw new ClinicError('validation', 'Cada línea necesita cantidad e importe mayores que cero.');
      const base = lines.reduce((a, l) => a + Math.round(l.qty * l.price), 0);
      return rpc('update_invoice_draft', { p_invoice_id: id, p_due_date: due || null, p_retention_cents: Math.round(base * (retPct || 0) / 100),
        p_lines: lines.map(l => ({ description: (l.desc || 'Servicio').slice(0, 300), quantity: l.qty, unit_price_cents: l.price, tax_rate: l.exempt ? 0 : 21 })) });
    },
    emitInvoice: id => rpc('emit_invoice', { p_invoice: id }),
    discardInvoice: id => rpc('delete_invoice_draft', { p_invoice_id: id }),
    recordPayment: (id, amount, method, ref) => rpc('record_invoice_payment', { p_invoice_id: id, p_amount_cents: amount, p_method: METHOD[method] || 'otro', p_reference: ref || null }),
    /* gastos */
    async saveExpense({ id = null, description, category, amount, date, supplier }) {
      const c = await ctx();
      if (!description || !(Number.isInteger(amount) && amount >= 0)) throw new ClinicError('validation', 'Indica el concepto y un importe válido.');
      const body = { description: description.slice(0, 300), category: category || null, amount_cents: amount, expense_date: date, supplier: supplier || null };
      if (id) return one(await call(`expenses?id=eq.${id}&org_id=eq.${c.id}`, { method: 'PATCH', body, headers: rep }));
      return one(await call('expenses', { method: 'POST', body: { ...body, id: newId(), org_id: c.id }, headers: rep }));
    },
    async deleteExpense(id) {
      const c = await ctx();
      const rows = await call(`expenses?id=eq.${id}&org_id=eq.${c.id}`, { method: 'DELETE', headers: rep });
      if (Array.isArray(rows) && !rows.length) throw new ClinicError('forbidden', 'Tu perfil no puede eliminar este gasto.');
      return rows;
    }
  };
}
