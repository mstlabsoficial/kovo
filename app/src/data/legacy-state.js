// Construye el estado completo `S` que espera legacy.js a partir de las colecciones que
// devuelve buildLegacyCollections() (from-supabase.js). Función pura: sin red ni escrituras.
//
// from-supabase.js deja en null lo que la BD no tiene. Algunos de esos null rompen la interfaz
// (por ejemplo chip(null) o SV(null).name). Aquí, y solo aquí, se sustituyen por valores de
// presentación explícitos y documentados, y cada sustitución se anota en el informe como
// `ui_default` o `excluded_from_ui`. Ninguno de estos valores se escribe en la BD.
// Lista completa en from-supabase.md.
import { ROLE, NOTE_FIELD_KEYS, toLocalDate } from './from-supabase.js';

// Preferencias de la interfaz, no datos de la consulta: la BD no tiene tabla de ajustes.
// Mismos valores por defecto que seed() en legacy.js.
export const DEFAULT_SETTINGS = Object.freeze({
  confirmEmail: true, reminder: true, reminderH: 24, noteTask: true, invoiceMode: 'auto', sendInvoice: true,
  overdue: true, dueDays: 15, aiScan: true, accent: 'azul', h0: 9, h1: 21,
  ded: {}   // % deducible por categoría de gasto (interfaz v3); preferencia de la clínica, no criterio fiscal
});
// Horario de disponibilidad por defecto (DEF_AVAIL en legacy.js). La BD no lo guarda.
const DEFAULT_AVAIL = { 0: [[600, 840], [960, 1200]], 1: [[600, 840], [960, 1200]], 2: [[600, 840], [960, 1200]], 3: [[600, 840], [960, 1200]], 4: [[600, 840], [960, 1200]] };

// Servicio de presentación para citas o pacientes sin servicio (o con un servicio que no se ha
// cargado). Evita que la interfaz falle al leer SV(id).name. No existe en la BD.
export const MISSING_SERVICE_ID = 'kovo:sin-servicio';
const missingService = () => ({ id: MISSING_SERVICE_ID, name: 'Servicio sin asignar', dur: null, price: 0, exempt: false, active: false, placeholder: true });
// Añade el servicio de presentación a la lista si alguna cita o paciente lo usa y aún no está.
export function ensureMissingService(services) {
  if (!services.some(s => s.id === MISSING_SERVICE_ID)) services.push(missingService());
  return services;
}

// Valores de presentación de un paciente (también para el registro confirmado tras guardarlo).
// note(entity, id, field, issue, value) anota cada sustitución; sIds = ids de servicios cargados.
export function uiPatient(src, sIds, note = () => {}) {
  const p = { ...src, docs: (src.docs || []).slice() };
  if (p.name == null) { p.name = ''; note('patient', p.id, 'name', 'ui_default'); }
  if (p.code == null) { p.code = ''; note('patient', p.id, 'code', 'ui_default'); }
  if (p.status == null) { p.status = 'activo'; note('patient', p.id, 'status', 'ui_default', 'activo'); }
  if (p.billing == null) {
    // Igual que un paciente nuevo en la interfaz: particular a su propio nombre, sin NIF ni dirección.
    p.billing = { type: 'particular', name: p.name, nif: '', addr: '' };
    p.billingFromDb = false;
    note('patient', p.id, 'billing', 'ui_default');
  } else p.billingFromDb = true;
  if (!(p.service && sIds.has(p.service))) { p.service = MISSING_SERVICE_ID; note('patient', p.id, 'service', 'ui_default', MISSING_SERVICE_ID); }
  return p;
}
// Valores de presentación de una cita. Devuelve null si la interfaz no puede mostrarla.
export function uiNote(src, note = () => {}) {
  if (src.type == null || src.status == null) { note('clinical_note', src.id, 'type', 'excluded_from_ui'); return null; }
  const n = { ...src, fields: { ...src.fields }, versions: (src.versions || []).map(v => ({ ...v, author: v.author ?? '' })), log: (src.log || []).slice() };
  if (src.versions == null) note('clinical_note', n.id, 'versions', 'ui_default', 'empty');
  if (!n.structured && n.content) {
    // Texto sin apartados: se muestra completo en el primer apartado para que no parezca vacío.
    n.fields = { [NOTE_FIELD_KEYS[n.type][0]]: n.content };
    note('clinical_note', n.id, 'fields', 'ui_default', 'content_in_first_field');
  }
  if (n.author == null) n.author = '';
  return n;
}
export function uiAppointment(src, sIds, note = () => {}) {
  if (src.status == null || src.date == null || src.start == null || src.dur == null) { note('appointment', src.id, 'status', 'excluded_from_ui'); return null; }
  const a = { ...src, log: (src.log || []).slice() };
  if (!(a.service && sIds.has(a.service))) { a.service = MISSING_SERVICE_ID; note('appointment', a.id, 'service', 'ui_default', MISSING_SERVICE_ID); }
  if (a.cancelReason == null) a.cancelReason = '';
  return a;
}

// Ajustes guardados en organizations.settings: solo claves conocidas y del mismo tipo que el valor
// por defecto (lo demás se ignora).
export function settingsFromDb(raw) {
  const out = { ...DEFAULT_SETTINGS };
  if (raw && typeof raw === 'object') for (const [k, v] of Object.entries(raw)) if (k in DEFAULT_SETTINGS && typeof v === typeof DEFAULT_SETTINGS[k]) out[k] = v;
  out.ded = dedFromDb(out.ded);
  return out;
}
// Solo porcentajes 0–100 por categoría (texto corto); lo demás se descarta.
export function dedFromDb(raw) {
  const out = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) for (const [k, v] of Object.entries(raw)) if (k.length <= 100 && Number.isFinite(v) && v >= 0 && v <= 100) out[k] = v;
  return out;
}
// Citas de una misma serie: posición (1…n), total y cada cuántos días (lo que muestra legacy.js).
export function annotateSeries(appts) {
  const by = new Map();
  for (const a of appts) if (a.seriesId) (by.get(a.seriesId) || by.set(a.seriesId, []).get(a.seriesId)).push(a);
  for (const list of by.values()) {
    list.sort((x, y) => x.date.localeCompare(y.date) || x.start - y.start);
    const every = list.length > 1 ? Math.round((Date.parse(list[1].date) - Date.parse(list[0].date)) / 864e5) : null;
    list.forEach((a, i) => { a.seriesIdx = i + 1; a.seriesTotal = list.length; a.seriesEvery = every; });
  }
  return appts;
}
// Filas de professional_time_off → días cerrados de legacy.js ({ id, from, to, label }, fechas de
// Madrid; `to` incluido). Un día cerrado se guarda de 00:00 de `from` a 00:00 del día siguiente a `to`.
export function blocksFromRows(rows) {
  return (rows || []).filter(r => r && r.id && r.starts_at && r.ends_at).map(r => ({
    id: r.id, from: toLocalDate(r.starts_at), to: toLocalDate(Date.parse(r.ends_at) - 1),
    label: r.reason || 'Cerrado', professionalId: r.professional_id ?? null
  })).sort((a, b) => a.from.localeCompare(b.from));
}
// Pruebas y diagnósticos (no retirados) → p.tests / p.dx de legacy.js.
export function clinicalFromRows(tests, diagnoses) {
  const byPatient = new Map();
  const slot = id => byPatient.get(id) || byPatient.set(id, { tests: [], dx: [] }).get(id);
  const live = new Set();
  for (const t of tests || []) if (t && !t.retired_at) { live.add(t.id); slot(t.patient_id).tests.push({ id: t.id, name: t.name, date: t.test_date, result: t.result || '', documentId: t.document_id ?? null, file: null, url: null, isImg: false }); }
  for (const d of diagnoses || []) if (d && !d.retired_at) slot(d.patient_id).dx.push({ id: d.id, title: d.title, date: d.diagnosis_date, text: d.rationale || '', tests: (d.test_ids || []).filter(i => live.has(i)), author: d.author_name || '' });
  return byPatient;
}
// recurring_expenses → S.fixed de legacy.js (importes en céntimos, mes de inicio 'AAAA-MM').
export function fixedFromRows(rows) {
  return (rows || []).map(r => ({ id: r.id, name: r.name, cat: r.category, supplier: r.supplier || '', day: r.day_of_month, base: r.base_cents,
    ivaPct: Number(r.vat_pct), retPct: Number(r.retention_pct), ded: r.deductible_pct == null ? null : Number(r.deductible_pct),
    active: !!r.active, since: String(r.since_month || '').slice(0, 7), updatedAt: r.updated_at ?? null }));
}
// Filas de professional_availability (weekday ISO 1-7) → formato de legacy.js (0 = lunes).
export function availFromRows(rows) {
  const out = {};
  for (const r of rows || []) (out[r.weekday - 1] ||= []).push([r.start_minute, r.end_minute]);
  for (const d of Object.keys(out)) out[d].sort((a, b) => a[0] - b[0]);
  return out;
}

export function toLegacyState({ collections, loaded = {}, report = [], context, today, extras = null }) {
  const role = ROLE[context?.role];
  if (!role) throw new Error('El rol de tu usuario no es válido para KOVO.');
  if (typeof today !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error('Fecha de hoy no válida.');
  const c = collections || {};
  const entries = report.slice();
  const note = (entity, id, field, issue, value) => {
    const e = { entity, id: id ?? null, field, issue };
    if (value !== undefined) e.value = value;
    entries.push(e);
  };

  /* servicios */
  const services = (c.services || []).map(s => ({ ...s }));
  const sIds = new Set(services.map(s => s.id));

  /* pacientes */
  const patients = (c.patients || []).map(src => uiPatient(src, sIds, note));
  const pById = new Map(patients.map(p => [p.id, p]));

  /* citas */
  const appts = annotateSeries((c.appts || []).map(src => uiAppointment(src, sIds, note)).filter(Boolean));
  const usedMissing = patients.some(p => p.service === MISSING_SERVICE_ID) || appts.some(a => a.service === MISSING_SERVICE_ID);

  /* facturas */
  const invoices = [];
  for (const src of c.invoices || []) {
    if (src.status == null) { note('invoice', src.id, 'status', 'excluded_from_ui'); continue; }
    const i = { ...src };
    i.lines = (src.lines || []).map(l => ({ ...l }));
    if (src.lines == null) note('invoice', i.id, 'lines', 'ui_default', 'empty');
    i.payments = (src.payments || []).map(p => ({ ...p }));
    if (src.payments == null) note('invoice', i.id, 'payments', 'ui_default', 'empty');
    if (i.ret == null) {
      // Porcentaje no entero: se usa el porcentaje exacto para que la interfaz reproduzca los céntimos de la BD.
      const sub = i.dbTotals?.subtotal, rc = i.dbTotals?.retention;
      i.ret = sub > 0 && Number.isInteger(rc) ? rc * 100 / sub : 0;
      note('invoice', i.id, 'ret', 'ui_default', 'exact_fraction');
    }
    if (i.to == null) {
      const p = pById.get(i.patientId);
      if (p && p.billingFromDb) {
        // Mismo criterio que mkInv() en legacy.js: el destinatario son los datos de facturación del paciente.
        i.to = { ...p.billing };
        note('invoice', i.id, 'to', 'derived_from_patient_billing');
      } else {
        i.to = { type: 'particular', name: p ? p.name : '', nif: '', addr: '' };
        note('invoice', i.id, 'to', 'ui_default');
      }
    }
    invoices.push(i);
  }

  /* notas clínicas */
  const notes = (c.notes || []).map(src => uiNote(src, note)).filter(Boolean);

  /* gastos y empleados */
  const expenses = (c.expenses || []).map(src => {
    const e = { ...src };
    if (e.status == null) { e.status = 'por revisar'; note('expense', e.id, 'status', 'ui_default', 'por revisar'); }
    if (e.supplier == null) e.supplier = '';
    if (e.concept == null) e.concept = '';
    if (e.cat == null) { e.cat = 'Otros'; note('expense', e.id, 'cat', 'ui_default', 'Otros'); }
    return e;
  });
  const employees = (c.employees || []).map(src => ({ ...src, docs: (src.docs || []).slice(), name: src.name ?? '', role: src.role ?? '' }));

  /* profesional (S.pro) */
  const pros = c.professionals || [];
  // La profesional de la sesión (professionals.user_id) o, si solo hay una, esa.
  const mine = context?.userId ? pros.find(p => p.userId && p.userId === context.userId) : null;
  if (!mine && pros.length !== 1) note('professional', null, 'pro', pros.length ? 'ambiguous_professional' : 'missing_in_db', pros.length);
  const p0 = mine || (pros.length === 1 ? pros[0] : null);
  for (const f of ['nif', 'addr', 'loc', 'sanitaria']) note('professional', p0?.id, f, 'missing_in_db');
  // loc queda null: legacy.js ya pone su ubicación por defecto al cargar el estado.
  const pro = { id: p0?.id ?? null, name: p0?.name ?? '', col: p0?.col ?? '', email: p0?.email ?? '', phone: p0?.phone ?? '', nif: '', addr: '', loc: null, sanitaria: null, mine: !!mine };

  if (usedMissing) ensureMissingService(services);
  if (extras?.tests || extras?.diagnoses) {
    const clin = clinicalFromRows(extras.tests, extras.diagnoses);
    for (const p of patients) { const c = clin.get(p.id); p.tests = c ? c.tests : []; p.dx = c ? c.dx : []; }
  }

  const state = {
    seq: 1, role, view: 'inicio', cal: { mode: 'semana', date: today }, sel: { homeDay: today },
    pro, settings: settingsFromDb(extras?.settings ?? null), services, patients, appts, notes, invoices, expenses,
    bank: [], employees, payrolls: [], oblPaid: {}, audit: [], outbox: [],
    // Horario guardado de la profesional; si no hay ninguno, el de por defecto marcado como no guardado.
    avail: extras?.availability?.length ? availFromRows(extras.availability) : JSON.parse(JSON.stringify(DEFAULT_AVAIL)),
    availSaved: !!extras?.availability?.length,
    // Vacaciones y días cerrados (professional_time_off). null = la tabla no existe en este esquema.
    blocks: Array.isArray(extras?.timeOff) ? blocksFromRows(extras.timeOff) : [],
    blocksAvailable: Array.isArray(extras?.timeOff),
    // Diagnósticos y pruebas (solo psicóloga) y gastos fijos: false si el servidor no tiene esas tablas.
    clinicalAvailable: Array.isArray(extras?.tests) && Array.isArray(extras?.diagnoses),
    fixed: Array.isArray(extras?.recurring) ? fixedFromRows(extras.recurring) : [],
    fixedAvailable: Array.isArray(extras?.recurring),
    // Facturar sesiones (enlace cita ↔ factura en invoice_lines.appointment_id).
    billingLinkAvailable: extras?.billingLink === true,
    professionals: pros.map(p => ({ ...p })),
    // Emisor de las facturas en modo conectado: el perfil fiscal de la clínica (organization_billing_profiles).
    issuer: extras?.billingProfile ? { name: extras.billingProfile.legal_name, nif: extras.billingProfile.tax_id,
      addr: [extras.billingProfile.address_line, extras.billingProfile.postal_code, extras.billingProfile.city].filter(Boolean).join(', '), profile: extras.billingProfile } : null,
    source: 'supabase',
    org: { id: context.id ?? null, name: context.name ?? null, isDemo: context.is_demo ?? null, isAdmin: !!context.isAdmin,
      accountStatus: context.accountStatus ?? 'active', plan: context.plan ?? null, subscriptionStatus: context.subscriptionStatus ?? null,
      trialEndsAt: context.trialEndsAt ?? null, cancelAtPeriodEnd: !!context.cancelAtPeriodEnd, multi: (context.organizations?.length || 0) > 1,
      userEmail: context.email ?? null }
  };
  return { state, report: entries };
}
