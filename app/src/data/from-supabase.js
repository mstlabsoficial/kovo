// Adaptador de LECTURA: filas de Supabase (esquema de app/src/types/database.types.ts)
// → modelo de datos que usa la interfaz legacy (app/src/legacy.js).
//
// Reglas:
// - Funciones puras: sin red, sin escrituras, sin console, sin estado global.
// - No se inventan datos: si un campo no existe en la base de datos, queda null
//   (o [] cuando es una lista que la base de datos no registra) y se anota en el informe.
// - Los estados solo se traducen cuando hay evidencia del valor; si no, quedan null y se anotan.
// - El informe contiene ids, nombres de campo y valores técnicos, NUNCA nombres, emails,
//   teléfonos ni contenido clínico.
// Correspondencias e incompatibilidades: ver from-supabase.md.

export const TIME_ZONE = 'Europe/Madrid';

// Estados: valores permitidos por las restricciones CHECK de la BD
// (supabase/recovered-schema/catalog-tables.json, rama chore/recover-supabase-migrations).
// patients.status: active | inactive | archived. 'archived' no existe en la interfaz:
// se muestra como alta terapéutica y se anota como correspondencia aproximada.
export const PATIENT_STATUS = Object.freeze({ active: 'activo', inactive: 'alta terapéutica', archived: 'alta terapéutica' });
const APPROX_PATIENT_STATUS = new Set(['archived']);
// appointments.status: scheduled | confirmed | completed | cancelled | no_show.
export const APPOINTMENT_STATUS = Object.freeze({
  scheduled: 'pendiente', confirmed: 'confirmada', completed: 'realizada', cancelled: 'cancelada', no_show: 'ausencia'
});
// note_type no tiene CHECK: valores que escribe mapping.js ('session' es el valor por defecto de la RPC).
export const NOTE_TYPE = Object.freeze({ session: 'sesion', initial: 'inicial', progress: 'evolucion', discharge: 'cierre' });
// clinical_notes.status: draft | signed | rectified. Una nota rectificada sigue firmada; las
// rectificaciones van en `versions`.
export const NOTE_STATUS = Object.freeze({ draft: 'borrador', signed: 'firmada', rectified: 'firmada' });
// invoices.status: draft | issued | paid | partially_paid | void. La interfaz guarda
// borrador | emitida | rectificada y calcula cobrada/parcial/vencida a partir de los cobros.
// emit_invoice pasa de 'draft' a 'issued'. 'void' (anulada) se muestra como rectificada.
export const INVOICE_STATUS = Object.freeze({ draft: 'borrador', issued: 'emitida', paid: 'emitida', partially_paid: 'emitida', void: 'rectificada' });
const APPROX_INVOICE_STATUS = new Set(['void']);
// Roles de memberships.role → S.role de la interfaz.
export const ROLE = Object.freeze({ psychologa: 'psicologa', recepcion: 'recepcion', gestoria: 'gestoria' });
// Tipos de documento que se interpretan como consentimiento informado (vocabulario sin verificar).
export const CONSENT_DOCUMENT_TYPES = Object.freeze(['consent', 'consentimiento', 'informed_consent']);
// Categorías de gasto que entiende la interfaz (copia de CATS en legacy.js; un test vigila que coincidan).
export const LEGACY_EXPENSE_CATEGORIES = Object.freeze(['Alquiler', 'Suministros', 'Seguros', 'Material', 'Gestoría y asesoría', 'Tecnología y software', 'Cuotas e impuestos', 'Personal', 'Formación', 'Otros']);
// Apartados de cada tipo de informe (copia de las claves de FIELDS en legacy.js; un test vigila que coincidan).
export const NOTE_FIELD_KEYS = Object.freeze({
  sesion: ['objetivos', 'resumen', 'intervenciones', 'observaciones', 'acuerdos', 'plan'],
  inicial: ['motivo', 'antecedentes', 'evaluacion', 'formulacion', 'objetivos', 'plan'],
  evolucion: ['objetivos', 'cambios', 'valoracion', 'plan'],
  cierre: ['motivo', 'trabajo', 'logros', 'recomendaciones']
});

/* ===== informe de diferencias ===== */
// Colector opcional. Cada entrada: { entity, id, field, issue, value? } — sin datos personales.
export function createReport() {
  const entries = [];
  return {
    entries,
    add(entity, id, field, issue, value) {
      const e = { entity, id: id ?? null, field, issue };
      if (value !== undefined) e.value = value;
      entries.push(e);
    }
  };
}
const NOOP = { add() {} };
const rep = opts => (opts && opts.report) || NOOP;

/* ===== fechas ===== */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
function parts(ts) {
  const d = new Date(ts);
  if (ts == null || Number.isNaN(d.getTime())) return null;
  const o = {};
  for (const p of fmt.formatToParts(d)) o[p.type] = p.value;
  return o;
}
// Marca de tiempo (timestamptz) → 'AAAA-MM-DD' en hora de Madrid.
export function toLocalDate(ts) {
  const p = parts(ts);
  return p ? `${p.year}-${p.month}-${p.day}` : null;
}
// Marca de tiempo → minutos desde medianoche en hora de Madrid (como `start` en legacy).
export function toLocalMinutes(ts) {
  const p = parts(ts);
  return p ? Number(p.hour) * 60 + Number(p.minute) : null;
}
// Columna DATE ('AAAA-MM-DD'): se conserva tal cual si es válida.
export function dateOnly(v) {
  return typeof v === 'string' && DATE_RE.test(v) ? v : null;
}

/* ===== utilidades ===== */
const str = v => (v == null || v === '' ? null : String(v));
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const meta = row => ({ orgId: row.org_id ?? null, legacyId: row.legacy_id ?? null });

// Une nombre y apellidos. mapping.splitName guarda '-' cuando no hay apellidos: se omite.
export function fullName(first, last) {
  return [first, last].map(x => (x == null ? '' : String(x).trim())).filter(x => x && x !== '-').join(' ') || null;
}

/* ===== pacientes ===== */
// Datos de agenda y facturación que la BD no tiene como columnas: solo se leen de profile_data
// si existen y tienen el tipo correcto.
function profileField(profile, key, valid, r, id) {
  if (!isObj(profile) || !(key in profile)) { r.add('patient', id, key, 'missing_in_db'); return null; }
  const v = profile[key];
  if (!valid(v)) { r.add('patient', id, key, 'invalid_profile_data'); return null; }
  return v;
}
const validBilling = b => isObj(b) && (b.type === 'particular' || b.type === 'empresa');
const validSlot = s => Array.isArray(s) && s.length === 2 && s.every(Number.isInteger);

export function patientFromRow(row, opts) {
  const r = rep(opts);
  const id = row.id;
  const status = PATIENT_STATUS[row.status] ?? null;
  if (!status) r.add('patient', id, 'status', 'unknown_value', row.status ?? null);
  else if (APPROX_PATIENT_STATUS.has(row.status)) r.add('patient', id, 'status', 'approximate_mapping', row.status);
  const profile = row.profile_data;
  const profileAlta = isObj(profile) ? dateOnly(profile.alta) : null;
  if (!profileAlta) r.add('patient', id, 'alta', 'derived_from_created_at');
  return {
    id, ...meta(row),
    code: str(row.patient_code),
    name: fullName(row.first_name, row.last_name),
    firstName: str(row.first_name), lastName: str(row.last_name),
    email: str(row.email), phone: str(row.phone),
    birthDate: dateOnly(row.birth_date), address: str(row.address),
    emergencyContact: str(row.emergency_contact), administrativeNotes: str(row.administrative_notes),
    alta: profileAlta || toLocalDate(row.created_at),
    status,
    slot: profileField(profile, 'slot', validSlot, r, id),
    service: profileField(profile, 'service', v => typeof v === 'string' && v.length > 0, r, id),
    modal: profileField(profile, 'modal', v => v === 'presencial' || v === 'online', r, id),
    bi: profileField(profile, 'bi', v => typeof v === 'boolean', r, id),
    billing: profileField(profile, 'billing', validBilling, r, id),
    reminders: profileField(profile, 'reminders', v => typeof v === 'boolean', r, id),
    consent: null,
    docs: [],
    createdAt: row.created_at ?? null, updatedAt: row.updated_at ?? null
  };
}

// Documentos del paciente. storage_path es una ruta de Storage, no una URL: url queda null
// hasta que se genere un enlace firmado.
export function documentFromRow(row) {
  return {
    id: row.id, orgId: row.org_id ?? null, patientId: row.patient_id,
    name: str(row.file_name), at: toLocalDate(row.created_at), url: null,
    storagePath: str(row.storage_path), type: str(row.document_type), uploadedBy: row.uploaded_by ?? null
  };
}
// Reparte documentos en consentimiento (el más reciente) y resto de documentos.
export function attachDocuments(patient, docs) {
  const sorted = docs.slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const consents = sorted.filter(d => CONSENT_DOCUMENT_TYPES.includes(d.type));
  const c = consents[0];
  patient.consent = c ? { at: c.at, file: c.name, url: null, storagePath: c.storagePath, documentId: c.id } : null;
  patient.docs = sorted.filter(d => d !== c).map(d => ({ id: d.id, name: d.name, at: d.at, url: null, storagePath: d.storagePath, type: d.type }));
  return patient;
}

/* ===== citas ===== */
export function appointmentFromRow(row, opts) {
  const r = rep(opts);
  const id = row.id;
  const status = APPOINTMENT_STATUS[row.status] ?? null;
  if (!status) r.add('appointment', id, 'status', 'unknown_value', row.status ?? null);
  const start = toLocalMinutes(row.starts_at);
  const ms = new Date(row.ends_at) - new Date(row.starts_at);
  let dur = Number.isFinite(ms) && ms > 0 ? ms / 60000 : null;
  if (dur === null) r.add('appointment', id, 'dur', 'invalid_time_range');
  else if (!Number.isInteger(dur)) { r.add('appointment', id, 'dur', 'non_integer_minutes'); dur = Math.round(dur); }
  if (row.starts_at && toLocalDate(row.starts_at) !== toLocalDate(row.ends_at)) r.add('appointment', id, 'date', 'crosses_midnight');
  const modal = row.modality === 'presencial' || row.modality === 'online' ? row.modality : null;
  if (!modal) r.add('appointment', id, 'modal', row.modality == null ? 'missing_in_db' : 'unknown_value', row.modality ?? null);
  if (!row.service_id) r.add('appointment', id, 'service', 'missing_in_db');
  return {
    id, ...meta(row),
    patientId: row.patient_id, professionalId: row.professional_id ?? null,
    date: toLocalDate(row.starts_at), start, dur,
    service: row.service_id ?? null, modal, loc: str(row.location),
    status, price: Number.isInteger(row.price_cents) ? row.price_cents : null,
    notes: str(row.administrative_note),
    log: [],             // la BD no guarda historial por cita
    cancelReason: null,  // la BD no guarda el motivo de cancelación
    invoiceId: null,     // la BD no relaciona citas con facturas
    startsAt: row.starts_at ?? null, endsAt: row.ends_at ?? null, createdAt: row.created_at ?? null
  };
}

/* ===== servicios y profesionales ===== */
export function serviceFromRow(row) {
  return {
    id: row.id, ...meta(row), name: str(row.name),
    dur: Number.isInteger(row.duration_minutes) ? row.duration_minutes : null,
    price: Number.isInteger(row.price_cents) ? row.price_cents : null,
    exempt: typeof row.tax_exempt === 'boolean' ? row.tax_exempt : null,
    active: typeof row.active === 'boolean' ? row.active : null
  };
}
export function professionalFromRow(row) {
  return {
    id: row.id, orgId: row.org_id ?? null, name: str(row.display_name),
    col: str(row.professional_number), email: str(row.email), phone: str(row.phone)
  };
}
// Forma de S.pro (datos de la profesional que firma y factura). La BD no guarda NIF,
// dirección fiscal, ubicación habitual ni habilitación sanitaria.
export function legacyProFromProfessional(p, opts) {
  const r = rep(opts);
  for (const f of ['nif', 'addr', 'loc', 'sanitaria']) r.add('professional', p?.id, f, 'missing_in_db');
  return { name: p?.name ?? null, col: p?.col ?? null, email: p?.email ?? null, nif: null, addr: null, loc: null, sanitaria: null };
}

/* ===== facturas, líneas y cobros ===== */
export function invoiceLineFromRow(row, opts) {
  const r = rep(opts);
  const rate = Number(row.tax_rate);
  if (rate !== 0 && rate !== 21) r.add('invoice_line', row.id, 'tax_rate', 'unsupported_rate', rate);
  if (!Number.isInteger(Number(row.quantity))) r.add('invoice_line', row.id, 'qty', 'fractional_quantity');
  return {
    id: row.id, invoiceId: row.invoice_id, desc: str(row.description),
    qty: Number(row.quantity), price: row.unit_price_cents,
    exempt: rate === 0, taxRate: rate, lineTotal: row.line_total_cents
  };
}
export function paymentFromRow(row) {
  return {
    id: row.id, invoiceId: row.invoice_id, date: toLocalDate(row.paid_at),
    amount: row.amount_cents, method: str(row.method), ref: str(row.reference)
  };
}
// Mismo cálculo que tot() en legacy.js (IVA 21 % por línea no exenta, retención sobre la base).
export function legacyTotals(lines, retPct) {
  let base = 0, iva = 0;
  for (const l of lines) { const b = Math.round(l.qty * l.price); base += b; if (!l.exempt) iva += Math.round(b * 0.21); }
  const ret = Math.round(base * (retPct || 0) / 100);
  return { base, iva, ret, total: base + iva - ret };
}
// legacy guarda la retención como porcentaje; la BD, en céntimos. Solo se acepta un
// porcentaje entero que reproduzca exactamente los céntimos guardados.
export function retentionPercent(retentionCents, subtotalCents) {
  if (!retentionCents) return 0;
  if (!(subtotalCents > 0)) return null;
  const pct = Math.round(retentionCents * 100 / subtotalCents);
  return Math.round(subtotalCents * pct / 100) === retentionCents ? pct : null;
}
function invoiceStatus(row, payments, total, r) {
  const status = INVOICE_STATUS[row.status] ?? null;
  if (!status) { r.add('invoice', row.id, 'status', 'unknown_value', row.status ?? null); return null; }
  if (APPROX_INVOICE_STATUS.has(row.status)) r.add('invoice', row.id, 'status', 'approximate_mapping', row.status);
  // La interfaz deduce "cobrada" o "parcial" de los cobros: se avisa si no cuadra con el estado de la BD.
  if (payments && Number.isInteger(total) && (row.status === 'paid' || row.status === 'partially_paid' || row.status === 'issued')) {
    const paid = payments.reduce((a, p) => a + (Number.isInteger(p.amount) ? p.amount : 0), 0);
    const derived = paid >= total ? 'paid' : paid > 0 ? 'partially_paid' : 'issued';
    if (derived !== row.status) r.add('invoice', row.id, 'status', 'payments_disagree_with_status', row.status);
  }
  return status;
}
// lines/payments: arrays ya convertidos de esa factura, o null si no se han cargado.
export function invoiceFromRow(row, lines, payments, opts) {
  const r = rep(opts);
  const id = row.id;
  const ret = retentionPercent(row.retention_cents, row.subtotal_cents);
  if (ret === null) r.add('invoice', id, 'ret', 'retention_not_a_whole_percent');
  if (lines === null) r.add('invoice', id, 'lines', 'not_loaded');
  if (payments === null) r.add('invoice', id, 'payments', 'not_loaded');
  r.add('invoice', id, 'to', 'missing_in_db');
  if (lines && ret !== null && lines.every(l => l.taxRate === 0 || l.taxRate === 21)) {
    const t = legacyTotals(lines, ret);
    if (t.base !== row.subtotal_cents || t.iva !== row.tax_cents || t.total !== row.total_cents) r.add('invoice', id, 'totals', 'mismatch_with_db');
  }
  return {
    id, ...meta(row),
    serie: str(row.series), num: str(row.invoice_number), patientId: row.patient_id ?? null,
    to: null,                       // la BD no guarda destinatario (nombre, NIF, dirección)
    date: dateOnly(row.issue_date), due: dateOnly(row.due_date),
    lines, ret, retentionCents: row.retention_cents ?? 0,
    appts: [],                      // la BD no relaciona facturas con citas
    payments, sent: null, hash: null, prevHash: null,
    status: invoiceStatus(row, payments, row.total_cents, r), dbStatus: str(row.status), legacyStatus: str(row.legacy_status),
    kind: row.series === 'R' ? 'R' : 'F',
    currency: str(row.currency), notes: str(row.notes),
    dbTotals: { subtotal: row.subtotal_cents, tax: row.tax_cents, retention: row.retention_cents, total: row.total_cents }
  };
}

/* ===== gastos y empleados ===== */
export function expenseFromRow(row, opts) {
  const r = rep(opts);
  const id = row.id;
  if (row.category != null && !LEGACY_EXPENSE_CATEGORIES.includes(row.category)) r.add('expense', id, 'cat', 'unknown_category', row.category);
  r.add('expense', id, 'total', 'amount_semantics_unverified');
  for (const f of ['base', 'iva', 'ret', 'nif', 'method', 'num', 'status', 'source']) r.add('expense', id, f, 'missing_in_db');
  return {
    id, ...meta(row),
    date: dateOnly(row.expense_date), supplier: str(row.supplier), cat: str(row.category), concept: str(row.description),
    total: Number.isInteger(row.amount_cents) ? row.amount_cents : null,
    base: null, iva: null, ret: null, nif: null, method: null, num: null, status: null, source: null,
    photo: null, documentPath: str(row.document_path), createdAt: row.created_at ?? null
  };
}
export function employeeFromRow(row, opts) {
  const r = rep(opts);
  for (const f of ['contract', 'start', 'bruto']) r.add('employee', row.id, f, 'missing_in_db');
  return {
    id: row.id, orgId: row.org_id ?? null, name: str(row.full_name), role: str(row.role_title),
    email: str(row.email), active: typeof row.active === 'boolean' ? row.active : null,
    contract: null, start: null, bruto: null,
    docs: []                        // la BD no tiene documentos de empleados
  };
}

/* ===== notas clínicas ===== */
// Inverso de mapping.clinicalNoteToRow: "clave: valor" separados por una línea en blanco.
// Solo se aceptan claves conocidas del tipo de nota. Si el texto no sigue ese formato,
// no se reparte en apartados (structured=false) y el texto completo queda en `content`.
export function parseNoteContent(content, type) {
  const keys = NOTE_FIELD_KEYS[type];
  if (!keys || typeof content !== 'string' || !content) return { fields: {}, structured: false };
  const re = new RegExp(`(?:^|\\n\\n)(${keys.join('|')}): ?`, 'g');
  const marks = [...content.matchAll(re)];
  if (!marks.length || marks[0].index !== 0) return { fields: {}, structured: false };
  const fields = {};
  for (let i = 0; i < marks.length; i++) {
    const m = marks[i];
    const from = m.index + m[0].length, to = i + 1 < marks.length ? marks[i + 1].index : content.length;
    if (m[1] in fields) return { fields: {}, structured: false };   // clave repetida: ambiguo
    fields[m[1]] = content.slice(from, to);
  }
  return { fields, structured: true };
}
export function rectificationFromRow(row) {
  return { id: row.id, noteId: row.note_id, at: row.created_at ?? null, author: null, authorId: row.author_id ?? null, text: str(row.replacement_text), reason: str(row.reason) };
}
export function clinicalNoteFromRow(row, rectifications, opts) {
  const r = rep(opts);
  const id = row.id;
  const type = NOTE_TYPE[row.note_type] ?? null;
  if (!type) r.add('clinical_note', id, 'type', 'unknown_value', row.note_type ?? null);
  // El estado manda. Una nota con signed_at pero en 'draft' se trata como firmada (no editable),
  // que es la opción segura; una nota firmada sin signed_at se anota.
  let status = NOTE_STATUS[row.status] ?? null;
  if (!status) {
    if (row.signed_at) status = 'firmada';
    r.add('clinical_note', id, 'status', 'unknown_value', row.status ?? null);
  } else if (row.status === 'draft' && row.signed_at) {
    status = 'firmada';
    r.add('clinical_note', id, 'status', 'draft_with_signed_at');
  } else if (status === 'firmada' && !row.signed_at) r.add('clinical_note', id, 'signedAt', 'missing_in_db');
  const parsed = parseNoteContent(row.content, type);
  if (!parsed.structured) r.add('clinical_note', id, 'fields', 'content_unstructured');
  if (rectifications === null) r.add('clinical_note', id, 'versions', 'not_loaded');
  r.add('clinical_note', id, 'author', 'name_not_in_db');
  return {
    id, orgId: row.org_id ?? null, patientId: row.patient_id, apptId: row.appointment_id ?? null,
    type, fields: parsed.fields, structured: parsed.structured, content: row.content ?? null,
    status, author: null, authorId: row.author_id ?? null,
    created: toLocalDate(row.created_at), signedAt: row.signed_at ? toLocalDate(row.signed_at) : null,
    versions: rectifications, log: [], createdAt: row.created_at ?? null, updatedAt: row.updated_at ?? null
  };
}

/* ===== conjunto: snapshot relacional → colecciones legacy ===== */
// input: { patients, appointments, services, professionals, invoices, invoiceLines, payments,
//          expenses, employees, clinicalNotes, rectifications, patientDocuments }
// Una colección ausente (undefined) significa "no cargada" (por ejemplo, por el rol); vacía ([]) significa "sin filas".
export function buildLegacyCollections(input = {}) {
  const report = createReport();
  const opts = { report };
  const has = k => Array.isArray(input[k]);
  // Sin duplicados: si una fila llega dos veces (por ejemplo, entre páginas), se queda la primera.
  const deduped = {};
  const rows = k => {
    if (!has(k)) return [];
    if (!deduped[k]) {
      const seen = new Set();
      deduped[k] = input[k].filter(x => {
        if (!x || typeof x !== 'object') return false;
        if (seen.has(x.id)) { report.add(k, x.id ?? null, 'id', 'duplicate_row'); return false; }
        seen.add(x.id); return true;
      });
    }
    return deduped[k];
  };
  const group = (list, key) => { const m = new Map(); for (const x of list) { const k = x[key]; if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };

  const orgIds = new Set();
  for (const k of Object.keys(input)) if (Array.isArray(input[k])) for (const x of input[k]) if (x && x.org_id) orgIds.add(x.org_id);
  if (orgIds.size > 1) report.add('snapshot', null, 'org_id', 'multiple_organizations', orgIds.size);

  const patients = rows('patients').map(x => patientFromRow(x, opts));
  const pById = new Map(patients.map(p => [p.id, p]));
  const docsBy = group(rows('patientDocuments').map(documentFromRow), 'patientId');
  for (const [pid, docs] of docsBy) {
    const p = pById.get(pid);
    if (p) attachDocuments(p, docs); else for (const d of docs) report.add('patient_document', d.id, 'patientId', 'orphan_reference');
  }
  if (!has('patientDocuments')) for (const p of patients) report.add('patient', p.id, 'consent', 'not_loaded');

  const services = rows('services').map(serviceFromRow);
  const sIds = new Set(services.map(s => s.id));
  const professionals = rows('professionals').map(professionalFromRow);
  const proIds = new Set(professionals.map(p => p.id));

  const appts = rows('appointments').map(x => appointmentFromRow(x, opts));
  const aIds = new Set(appts.map(a => a.id));
  for (const a of appts) {
    if (has('patients') && !pById.has(a.patientId)) report.add('appointment', a.id, 'patientId', 'orphan_reference');
    if (a.service && has('services') && !sIds.has(a.service)) report.add('appointment', a.id, 'service', 'orphan_reference');
    if (a.professionalId && has('professionals') && !proIds.has(a.professionalId)) report.add('appointment', a.id, 'professionalId', 'orphan_reference');
  }

  const invRows = rows('invoices');
  const invIds = new Set(invRows.map(x => x.id));
  const lineList = rows('invoiceLines').map(x => invoiceLineFromRow(x, opts));
  const payList = rows('payments').map(paymentFromRow);
  for (const l of lineList) if (!invIds.has(l.invoiceId)) report.add('invoice_line', l.id, 'invoiceId', 'orphan_reference');
  for (const p of payList) if (!invIds.has(p.invoiceId)) report.add('payment', p.id, 'invoiceId', 'orphan_reference');
  const linesBy = group(lineList, 'invoiceId'), paysBy = group(payList, 'invoiceId');
  const invoices = invRows.map(x => {
    const inv = invoiceFromRow(x, has('invoiceLines') ? (linesBy.get(x.id) || []) : null, has('payments') ? (paysBy.get(x.id) || []) : null, opts);
    if (inv.patientId && has('patients') && !pById.has(inv.patientId)) report.add('invoice', inv.id, 'patientId', 'orphan_reference');
    return inv;
  });

  const rectList = rows('rectifications').map(rectificationFromRow);
  const rectBy = group(rectList, 'noteId');
  const noteRows = rows('clinicalNotes');
  const noteIds = new Set(noteRows.map(x => x.id));
  for (const x of rectList) if (!noteIds.has(x.noteId)) report.add('rectification', x.id, 'noteId', 'orphan_reference');
  const notes = noteRows.map(x => {
    const versions = has('rectifications') ? (rectBy.get(x.id) || []).sort((a, b) => String(a.at).localeCompare(String(b.at))) : null;
    const n = clinicalNoteFromRow(x, versions, opts);
    if (has('patients') && !pById.has(n.patientId)) report.add('clinical_note', n.id, 'patientId', 'orphan_reference');
    if (n.apptId && has('appointments') && !aIds.has(n.apptId)) report.add('clinical_note', n.id, 'apptId', 'orphan_reference');
    return n;
  });

  const expenses = rows('expenses').map(x => expenseFromRow(x, opts));
  const employees = rows('employees').map(x => employeeFromRow(x, opts));
  report.add('snapshot', null, 'appts.invoiceId', 'relation_missing_in_db');

  return {
    collections: { patients, appts, services, professionals, invoices, expenses, employees, notes },
    loaded: Object.fromEntries(['patients', 'appointments', 'services', 'professionals', 'invoices', 'invoiceLines', 'payments', 'expenses', 'employees', 'clinicalNotes', 'rectifications', 'patientDocuments'].map(k => [k, has(k)])),
    report: report.entries
  };
}
