// Construye el estado completo `S` que espera legacy.js a partir de las colecciones que
// devuelve buildLegacyCollections() (from-supabase.js). Función pura: sin red ni escrituras.
//
// from-supabase.js deja en null lo que la BD no tiene. Algunos de esos null rompen la interfaz
// (por ejemplo chip(null) o SV(null).name). Aquí, y solo aquí, se sustituyen por valores de
// presentación explícitos y documentados, y cada sustitución se anota en el informe como
// `ui_default` o `excluded_from_ui`. Ninguno de estos valores se escribe en la BD.
// Lista completa en from-supabase.md.
import { ROLE, NOTE_FIELD_KEYS } from './from-supabase.js';

// Preferencias de la interfaz, no datos de la consulta: la BD no tiene tabla de ajustes.
// Mismos valores por defecto que seed() en legacy.js.
export const DEFAULT_SETTINGS = Object.freeze({
  confirmEmail: true, reminder: true, reminderH: 24, noteTask: true, invoiceMode: 'auto', sendInvoice: true,
  overdue: true, dueDays: 15, aiScan: true, accent: 'azul', h0: 9, h1: 21
});
// Horario de disponibilidad por defecto (DEF_AVAIL en legacy.js). La BD no lo guarda.
const DEFAULT_AVAIL = { 0: [[600, 840], [960, 1200]], 1: [[600, 840], [960, 1200]], 2: [[600, 840], [960, 1200]], 3: [[600, 840], [960, 1200]], 4: [[600, 840], [960, 1200]] };

// Servicio de presentación para citas o pacientes sin servicio (o con un servicio que no se ha
// cargado). Evita que la interfaz falle al leer SV(id).name. No existe en la BD.
export const MISSING_SERVICE_ID = 'kovo:sin-servicio';
const missingService = () => ({ id: MISSING_SERVICE_ID, name: 'Servicio sin asignar', dur: null, price: 0, exempt: false, active: false, placeholder: true });

export function toLegacyState({ collections, loaded = {}, report = [], context, today }) {
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
  let usedMissing = false;
  const serviceOrMissing = (entity, id, sid) => {
    if (sid && sIds.has(sid)) return sid;
    usedMissing = true;
    note(entity, id, 'service', 'ui_default', MISSING_SERVICE_ID);
    return MISSING_SERVICE_ID;
  };

  /* pacientes */
  const patients = (c.patients || []).map(src => {
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
    if (p.service != null || loaded.services) p.service = serviceOrMissing('patient', p.id, p.service);
    return p;
  });
  const pById = new Map(patients.map(p => [p.id, p]));

  /* citas */
  const appts = [];
  for (const src of c.appts || []) {
    if (src.status == null || src.date == null || src.start == null || src.dur == null) {
      note('appointment', src.id, 'status', 'excluded_from_ui'); continue;
    }
    const a = { ...src, log: (src.log || []).slice() };
    a.service = serviceOrMissing('appointment', a.id, a.service);
    if (a.cancelReason == null) a.cancelReason = '';
    appts.push(a);
  }

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
  const notes = [];
  for (const src of c.notes || []) {
    if (src.type == null || src.status == null) { note('clinical_note', src.id, 'type', 'excluded_from_ui'); continue; }
    const n = { ...src, fields: { ...src.fields }, versions: (src.versions || []).map(v => ({ ...v, author: v.author ?? '' })), log: (src.log || []).slice() };
    if (src.versions == null) note('clinical_note', n.id, 'versions', 'ui_default', 'empty');
    if (!n.structured && n.content) {
      // Texto sin apartados: se muestra completo en el primer apartado para que no parezca vacío.
      n.fields = { [NOTE_FIELD_KEYS[n.type][0]]: n.content };
      note('clinical_note', n.id, 'fields', 'ui_default', 'content_in_first_field');
    }
    if (n.author == null) n.author = '';
    notes.push(n);
  }

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
  if (pros.length !== 1) note('professional', null, 'pro', pros.length ? 'ambiguous_professional' : 'missing_in_db', pros.length);
  const p0 = pros.length === 1 ? pros[0] : null;
  for (const f of ['nif', 'addr', 'loc', 'sanitaria']) note('professional', p0?.id, f, 'missing_in_db');
  // loc queda null: legacy.js ya pone su ubicación por defecto al cargar el estado.
  const pro = { id: p0?.id ?? null, name: p0?.name ?? '', col: p0?.col ?? '', email: p0?.email ?? '', nif: '', addr: '', loc: null, sanitaria: null };

  if (usedMissing) services.push(missingService());

  const state = {
    seq: 1, role, view: 'inicio', cal: { mode: 'semana', date: today }, sel: { homeDay: today },
    pro, settings: { ...DEFAULT_SETTINGS }, services, patients, appts, notes, invoices, expenses,
    bank: [], employees, payrolls: [], oblPaid: {}, audit: [], outbox: [],
    avail: JSON.parse(JSON.stringify(DEFAULT_AVAIL)),
    source: 'supabase',
    org: { id: context.id ?? null, name: context.name ?? null, isDemo: context.is_demo ?? null }
  };
  return { state, report: entries };
}
