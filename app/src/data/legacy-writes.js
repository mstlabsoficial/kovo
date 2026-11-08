// Puente entre los formularios de legacy.js y las escrituras de writes.js (pacientes y citas).
//
// - Traduce los datos del formulario (modelo legacy) a filas de la BD.
// - Llama a una sola operación de writes.js y espera su confirmación.
// - Devuelve el objeto legacy construido A PARTIR DE LA FILA CONFIRMADA (from-supabase.js +
//   legacy-state.js), igual que si se hubiera recargado. legacy.js solo toca su estado después.
// - Si algo falla, lanza el error y no devuelve nada: el estado local no cambia.
import { isUuid, splitName } from './mapping.js';
import { patientFromRow, appointmentFromRow, APPOINTMENT_STATUS, toLocalDate, toLocalMinutes } from './from-supabase.js';
import { uiPatient, uiAppointment, ensureMissingService, MISSING_SERVICE_ID } from './legacy-state.js';
import { WriteError } from './writes.js';

const DB_APPOINTMENT_STATUS = Object.fromEntries(Object.entries(APPOINTMENT_STATUS).map(([db, ui]) => [ui, db]));
const bad = (field, message) => new WriteError('validation', message, { field });
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Fecha 'AAAA-MM-DD' + minutos en hora de Madrid → instante UTC (ISO). Independiente de la zona
// horaria del navegador. Una hora que no existe (adelanto de marzo) se rechaza; una hora repetida
// (retraso de octubre) se interpreta como la segunda (hora de invierno), igual que la lectura.
export function madridToUtc(date, minutes) {
  if (!DATE_RE.test(String(date)) || !Number.isInteger(minutes) || minutes < 0 || minutes >= 1440) throw bad('date', 'La fecha u hora no es válida.');
  const [y, m, d] = date.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  if (new Date(wall).getUTCDate() !== d) throw bad('date', 'La fecha no es válida.');
  let t = wall;
  for (let i = 0; i < 4; i++) {
    const offset = Date.UTC(...localParts(t)) - t;
    const next = wall - offset;
    if (next === t) break;
    t = next;
  }
  if (toLocalDate(t) !== date || toLocalMinutes(t) !== minutes) throw bad('start', 'Esa hora no existe ese día por el cambio de hora.');
  return new Date(t).toISOString();
}
function localParts(t) {
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(t)).reduce((o, p) => (o[p.type] = p.value, o), {});
  return [Number(iso.year), Number(iso.month) - 1, Number(iso.day), Number(iso.hour), Number(iso.minute), Number(iso.second)];
}

const trimOrNull = v => (v == null ? null : String(v).trim() || null);
const realService = (id, services) => (id && id !== MISSING_SERVICE_ID && isUuid(id) && services.some(s => s.id === id) ? id : null);

export function createLegacyWrites({ writer, newId = () => crypto.randomUUID() }) {
  // Altas en curso: el mismo id en cada reintento del mismo formulario (evita duplicados).
  const pending = {};
  const pendingId = kind => (pending[kind] ||= newId());

  return {
    // Llamar al abrir un formulario de alta nuevo.
    resetPending(kind) { delete pending[kind]; },

    // input: { name, email, phone, service, modal, billing, reminders }. existing: paciente legacy o null.
    async savePatient({ existing = null, input, today, services = [] }) {
      const name = String(input?.name ?? '').trim();
      const email = String(input?.email ?? '').trim();
      if (!name) throw bad('name', 'El nombre es obligatorio.');
      if (!email) throw bad('email', 'El email es obligatorio.');
      if (!input.billing || !['particular', 'empresa'].includes(input.billing.type)) throw bad('billing', 'Indica a quién se factura.');
      if (input.modal != null && !['presencial', 'online'].includes(input.modal)) throw bad('modal', 'Modalidad no válida.');
      const { first_name, last_name } = splitName(name);
      // Datos de ficha sin columna propia: se fusionan con lo que ya hubiera en profile_data.
      const profile = { ...(existing?.profileData || {}) };
      const svc = realService(input.service, services);
      if (svc) profile.service = svc; else delete profile.service;
      profile.modal = input.modal || 'presencial';
      profile.billing = { ...input.billing };
      profile.reminders = Boolean(input.reminders);
      const base = { first_name, last_name, email, phone: trimOrNull(input.phone), profile_data: profile };

      let result;
      if (existing && isUuid(existing.id)) {
        result = await writer.updatePatient(existing.id, base, existing.updatedAt);
      } else {
        // Alta. El código lo asigna PostgreSQL (trigger patients_assign_code). Un paciente con id de la
        // demo se guarda con ese id en legacy_id para mantener la correspondencia y no duplicarlo.
        const legacyId = existing && !isUuid(existing.id) ? String(existing.id) : null;
        profile.alta = existing?.alta || today;
        result = await writer.createPatient({ id: pendingId('patient'), ...base, status: 'active', legacy_id: legacyId });
        delete pending.patient;
      }
      const sIds = new Set(services.map(s => s.id));
      const patient = uiPatient(patientFromRow(result.row), sIds);
      // Consentimiento y documentos vienen de patient_documents, no de esta fila.
      patient.consent = existing?.consent ?? null;
      patient.docs = existing?.docs ? existing.docs.slice() : [];
      return { patient, replacedId: existing && existing.id !== patient.id ? existing.id : null, outcome: result.outcome };
    },

    // input: { patientId, date, start, dur, service, price, modal, loc, notes, status }. existing: cita legacy o null.
    // patient: paciente legacy de la cita. professionalId: UUID del profesional (S.pro.id) o null.
    async saveAppointment({ existing = null, input, patient, professionalId = null, userId = null, services = [] }) {
      if (!patient || !isUuid(patient.id)) throw bad('patient_id', 'Elige un paciente guardado en la consulta.');
      if (input.patientId !== patient.id) throw bad('patient_id', 'El paciente no coincide.');
      const dur = Number(input.dur);
      if (!Number.isInteger(dur) || dur < 5 || dur > 720) throw bad('dur', 'La duración debe estar entre 5 y 720 minutos.');
      const starts = madridToUtc(input.date, input.start);
      const ends = new Date(Date.parse(starts) + dur * 60000).toISOString();
      const price = Number(input.price ?? 0);
      if (!Number.isInteger(price) || price < 0) throw bad('price', 'Precio no válido.');
      const fields = {
        patient_id: patient.id,
        service_id: realService(input.service, services),
        starts_at: starts, ends_at: ends,
        location: trimOrNull(input.loc), modality: input.modal || null,
        price_cents: price, administrative_note: trimOrNull(input.notes)
      };
      let result;
      if (existing && isUuid(existing.id)) {
        result = await writer.updateAppointment(existing.id, fields, existing.updatedAt);
      } else {
        const status = DB_APPOINTMENT_STATUS[input.status];
        if (!status) throw bad('status', 'Estado de cita no válido.');
        result = await writer.createAppointment({
          id: pendingId('appointment'), ...fields, status,
          professional_id: isUuid(professionalId) ? professionalId : null,
          created_by: isUuid(userId) ? userId : null,
          legacy_id: existing && !isUuid(existing.id) ? String(existing.id) : null
        });
        delete pending.appointment;
      }
      return this._appointmentFrom(result, existing, services);
    },

    // Cambio de estado (confirmar, realizada, ausencia, cancelar). status: estado legacy.
    async setAppointmentStatus({ appt, status, services = [] }) {
      if (!appt || !isUuid(appt.id)) throw bad('id', 'Cita no válida.');
      const db = DB_APPOINTMENT_STATUS[status];
      if (!db) throw bad('status', 'Estado de cita no válido.');
      const result = await writer.updateAppointment(appt.id, { status: db }, appt.updatedAt);
      return this._appointmentFrom(result, appt, services);
    },

    _appointmentFrom(result, existing, services) {
      const sIds = new Set(services.map(s => s.id));
      const appt = uiAppointment(appointmentFromRow(result.row), sIds);
      if (!appt) throw new WriteError('unexpected_response', 'El servidor ha devuelto una cita incompleta. Recarga para comprobarlo.', { table: 'appointments' });
      // El historial y el motivo de cancelación no tienen columna: se conservan solo en memoria.
      appt.log = existing?.log ? existing.log.slice() : [];
      appt.cancelReason = existing?.cancelReason ?? '';
      if (existing?.invoiceId) appt.invoiceId = existing.invoiceId;
      return { appt, replacedId: existing && existing.id !== appt.id ? existing.id : null, outcome: result.outcome };
    }
  };
}

// Aplica un paciente confirmado al estado S. Si cambió de id (demo → UUID), actualiza las referencias.
export function applyPatient(S, patient, replacedId = null) {
  const oldId = replacedId || patient.id;
  const i = S.patients.findIndex(p => p.id === oldId || p.id === patient.id);
  if (i >= 0) S.patients[i] = patient; else S.patients.push(patient);
  if (replacedId) {
    for (const col of ['appts', 'notes', 'invoices']) for (const x of S[col] || []) if (x.patientId === replacedId) x.patientId = patient.id;
    if (S.sel && S.sel.patient === replacedId) S.sel.patient = patient.id;
  }
  if (patient.service === MISSING_SERVICE_ID) ensureMissingService(S.services);
  return patient;
}
// Aplica una cita confirmada al estado S.
export function applyAppointment(S, appt, replacedId = null) {
  const oldId = replacedId || appt.id;
  const i = S.appts.findIndex(a => a.id === oldId || a.id === appt.id);
  if (i >= 0) S.appts[i] = appt; else S.appts.push(appt);
  if (replacedId) for (const n of S.notes || []) if (n.apptId === replacedId) n.apptId = appt.id;
  if (appt.service === MISSING_SERVICE_ID) ensureMissingService(S.services);
  return appt;
}
