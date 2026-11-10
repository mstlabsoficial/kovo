// Escrituras explícitas por entidad en Supabase (pacientes y citas).
//
// Cada operación:
//   1. valida la fila (lista cerrada de columnas, tipos y valores permitidos por la BD);
//   2. comprueba el contexto de organización (UUID) y fuerza org_id;
//   3. comprueba el rol (copia de las políticas RLS de INSERT/UPDATE; la BD vuelve a comprobarlo);
//   4. hace UNA petición (POST o PATCH) filtrada por org_id;
//   5. devuelve la fila que confirma Supabase (Prefer: return=representation), validada.
// Un error de red, HTTP o una respuesta inesperada SIEMPRE lanza WriteError: nunca se da por guardado.
//
// Reintentos sin duplicados:
// - Altas: el id (UUID) lo genera el cliente y se reutiliza en cada reintento. Si la primera petición
//   llegó a la BD pero se perdió la respuesta, el reintento recibe "duplicado" y se recupera la fila.
//   Con legacy_id, un registro ya importado se recupera por (org_id, legacy_id) en lugar de duplicarse.
// - Cambios: llevan la versión cargada (updated_at). Si nadie más ha cambiado la fila, se aplica; si la
//   fila ya tiene exactamente esos valores (reintento), se da por confirmada; si otra persona la cambió,
//   se rechaza como conflicto para no pisar su cambio.
// - Un 401 (token caducado) renueva la sesión una vez y repite la misma petición, que es idempotente.
import { supabaseRequest } from './supabase-client.js';
import { isUuid } from './mapping.js';

export class WriteError extends Error {
  constructor(code, message, { table = null, status = null, field = null } = {}) {
    super(message);
    this.name = 'WriteError'; this.code = code; this.table = table; this.status = status; this.field = field;
  }
}

// Roles con permiso de alta y modificación (políticas *_insert / *_update de la BD).
export const WRITE_ROLES = Object.freeze({
  patients: Object.freeze(['psychologa', 'recepcion']),
  appointments: Object.freeze(['psychologa', 'recepcion'])
});
const PATIENT_STATUS = ['active', 'inactive', 'archived'];
const APPOINTMENT_STATUS = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LEGACY_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_APPOINTMENT_MINUTES = 12 * 60;

/* ===== validación ===== */
const bad = (field, message) => new WriteError('validation', message, { field });
const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (row, k, { required = false, max = 200 } = {}) => {
  const v = row[k];
  if (v == null || v === '') { if (required) throw bad(k, 'Falta un dato obligatorio.'); return; }
  if (typeof v !== 'string' || v.length > max) throw bad(k, 'Hay un dato con formato no válido.');
  if (required && !v.trim()) throw bad(k, 'Falta un dato obligatorio.');
};
const uuidOrNull = (row, k, required = false) => {
  if (row[k] == null) { if (required) throw bad(k, 'Falta una referencia obligatoria.'); return; }
  if (!isUuid(row[k])) throw bad(k, 'Referencia no válida.');
};
const onlyKeys = (row, allowed) => {
  for (const k of Object.keys(row)) if (!allowed.includes(k)) throw bad(k, 'Campo no permitido.');
};
const PATIENT_COLUMNS = ['id', 'first_name', 'last_name', 'email', 'phone', 'status', 'profile_data', 'legacy_id'];
const APPOINTMENT_COLUMNS = ['id', 'patient_id', 'professional_id', 'service_id', 'starts_at', 'ends_at', 'status', 'location', 'modality', 'price_cents', 'administrative_note', 'created_by', 'legacy_id'];

export function validatePatientRow(row, { partial = false } = {}) {
  if (!isPlainObject(row)) throw bad(null, 'Datos no válidos.');
  onlyKeys(row, partial ? PATIENT_COLUMNS.filter(k => k !== 'id' && k !== 'legacy_id') : PATIENT_COLUMNS);
  const need = k => !partial || k in row;
  if (!partial) uuidOrNull(row, 'id', true);
  if (need('first_name')) text(row, 'first_name', { required: true, max: 100 });
  if (need('last_name')) text(row, 'last_name', { required: true, max: 150 });
  if ('email' in row) { text(row, 'email', { max: 254 }); if (row.email && !EMAIL_RE.test(row.email)) throw bad('email', 'El email no es válido.'); }
  if ('phone' in row) text(row, 'phone', { max: 40 });
  if (need('status') && !PATIENT_STATUS.includes(row.status)) throw bad('status', 'Estado de paciente no válido.');
  if (need('profile_data') && !isPlainObject(row.profile_data)) throw bad('profile_data', 'Datos de ficha no válidos.');
  if (row.legacy_id != null && !LEGACY_ID_RE.test(row.legacy_id)) throw bad('legacy_id', 'Identificador anterior no válido.');
  return row;
}

export function validateAppointmentRow(row, { partial = false } = {}) {
  if (!isPlainObject(row)) throw bad(null, 'Datos no válidos.');
  onlyKeys(row, partial ? APPOINTMENT_COLUMNS.filter(k => !['id', 'created_by', 'legacy_id'].includes(k)) : APPOINTMENT_COLUMNS);
  const need = k => !partial || k in row;
  if (!partial) uuidOrNull(row, 'id', true);
  if (need('patient_id')) uuidOrNull(row, 'patient_id', true);
  if ('professional_id' in row) uuidOrNull(row, 'professional_id');
  if ('service_id' in row) uuidOrNull(row, 'service_id');
  if ('created_by' in row) uuidOrNull(row, 'created_by');
  if (need('starts_at') || need('ends_at') || 'starts_at' in row || 'ends_at' in row) {
    if (!('starts_at' in row) || !('ends_at' in row)) throw bad('starts_at', 'Indica el inicio y el final de la cita.');
    const a = Date.parse(row.starts_at), b = Date.parse(row.ends_at);
    if (!Number.isFinite(a) || !Number.isFinite(b)) throw bad('starts_at', 'La fecha u hora no es válida.');
    if (!(b > a)) throw bad('ends_at', 'La cita debe terminar después de empezar.');
    if ((b - a) / 60000 > MAX_APPOINTMENT_MINUTES) throw bad('ends_at', 'La cita no puede durar más de 12 horas.');
  }
  if (need('status') && !APPOINTMENT_STATUS.includes(row.status)) throw bad('status', 'Estado de cita no válido.');
  if ('location' in row) text(row, 'location', { max: 200 });
  if ('administrative_note' in row) text(row, 'administrative_note', { max: 2000 });
  if ('modality' in row && row.modality != null && !['presencial', 'online'].includes(row.modality)) throw bad('modality', 'Modalidad no válida.');
  if (need('price_cents') && !(Number.isInteger(row.price_cents) && row.price_cents >= 0)) throw bad('price_cents', 'Precio no válido.');
  if (row.legacy_id != null && !LEGACY_ID_RE.test(row.legacy_id)) throw bad('legacy_id', 'Identificador anterior no válido.');
  return row;
}

/* ===== errores ===== */
export function classify(error, table) {
  if (error instanceof WriteError) return error;
  const status = Number.isInteger(error?.status) ? error.status : null;
  const pg = error?.details?.code || null;
  if (status === 401) return new WriteError('auth', 'Tu sesión ha caducado. Vuelve a iniciar sesión; no se ha guardado nada.', { table, status });
  if (status === 403 || pg === '42501') return new WriteError('forbidden', 'Tu perfil no tiene permiso para guardar estos datos.', { table, status });
  if (pg === '23505') return new WriteError('duplicate', 'Ya existe un registro con esos datos.', { table, status });
  // Citas con documentación clínica (trigger appointments_clinical_link de la propuesta clínica v2).
  if (pg === 'KN010') return new WriteError('clinical_link', 'Esta cita tiene una nota clínica: no se puede cambiar de paciente. No se ha guardado nada.', { table, status });
  if (pg === 'KN011') return new WriteError('clinical_link', 'Esta cita tiene una nota clínica y debe seguir como realizada. No se ha guardado nada.', { table, status });
  if (pg === '23503') return new WriteError('invalid_reference', 'El paciente, profesional o servicio no pertenece a tu consulta.', { table, status });
  if (pg === '23514' || pg === '23502' || pg === '22P02' || pg === '22007' || pg === '22008') return new WriteError('validation', 'La base de datos ha rechazado algún dato.', { table, status });
  if (status) return new WriteError('http', `No se ha podido guardar (HTTP ${status}). Inténtalo de nuevo.`, { table, status });
  return new WriteError('network', 'No hay conexión con el servidor: el cambio NO se ha guardado. Inténtalo de nuevo.', { table });
}

/* ===== comparación para reintentos ===== */
function sameValue(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (typeof a === 'string' && typeof b === 'string') {
    const ta = Date.parse(a), tb = Date.parse(b);
    return /\d{4}-\d{2}-\d{2}T/.test(a) && /\d{4}-\d{2}-\d{2}T/.test(b) && ta === tb;
  }
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => sameValue(x, b[i]));
  if (typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a).filter(k => a[k] !== undefined), kb = Object.keys(b).filter(k => b[k] !== undefined);
    return ka.length === kb.length && ka.every(k => sameValue(a[k], b[k]));
  }
  return false;
}
const matches = (row, changes) => Object.keys(changes).every(k => sameValue(row[k], changes[k]));

/* ===== escritor ===== */
export function createEntityWriter({
  request = supabaseRequest,
  getContext,
  refresh = async () => null,
  now = () => new Date().toISOString()
} = {}) {
  if (typeof getContext !== 'function') throw new Error('createEntityWriter necesita getContext().');

  // Una petición; tras un 401 renueva la sesión una vez y la repite.
  const call = async (table, path, options) => {
    let refreshed = false;
    for (;;) {
      try { return await request(path, options); }
      catch (e) {
        const err = classify(e, table);
        if (err.code === 'auth' && !refreshed) {
          refreshed = true;
          let user = null;
          try { user = await refresh(); } catch { user = null; }
          if (user) continue;
        }
        throw err;
      }
    }
  };
  const contextFor = async table => {
    let ctx;
    try { ctx = await getContext(); } catch (e) { throw classify(e, 'memberships'); }
    if (!ctx || !isUuid(ctx.id)) throw new WriteError('forbidden', 'No se ha podido identificar tu consulta.', { table });
    if (!WRITE_ROLES[table].includes(ctx.role)) throw new WriteError('forbidden', 'Tu perfil no tiene permiso para guardar estos datos.', { table });
    return ctx;
  };
  const confirmed = (data, table, ctx, id) => {
    if (!Array.isArray(data) || data.length !== 1) throw new WriteError('unexpected_response', 'El servidor no ha confirmado el guardado. Recarga para comprobarlo.', { table });
    const row = data[0];
    if (!row || typeof row !== 'object' || row.org_id !== ctx.id || (id && row.id !== id) || !isUuid(row.id))
      throw new WriteError('unexpected_response', 'El servidor ha devuelto un registro que no corresponde. Recarga para comprobarlo.', { table });
    return row;
  };
  const readOne = async (table, ctx, filter) => {
    const data = await call(table, `${table}?select=*&${filter}&org_id=eq.${ctx.id}&limit=2`);
    if (!Array.isArray(data) || data.length > 1) throw new WriteError('unexpected_response', 'Respuesta inesperada del servidor.', { table });
    if (data[0] && data[0].org_id !== ctx.id) throw new WriteError('unexpected_response', 'Respuesta inesperada del servidor.', { table });
    return data[0] || null;
  };

  async function update(table, id, changes, version, validate) {
    if (!isUuid(id)) throw bad('id', 'Registro no válido.');
    if (typeof version !== 'string' || !version) throw bad('updated_at', 'Falta la versión del registro: recarga antes de editar.');
    validate(changes, { partial: true });
    const ctx = await contextFor(table);
    const body = { ...changes, updated_at: now() };
    const path = `${table}?id=eq.${id}&org_id=eq.${ctx.id}&updated_at=eq.${encodeURIComponent(version)}`;
    const data = await call(table, path, { method: 'PATCH', body, headers: { Prefer: 'return=representation' } });
    if (Array.isArray(data) && data.length === 1) return { row: confirmed(data, table, ctx, id), outcome: 'updated' };
    if (!Array.isArray(data) || data.length > 1) throw new WriteError('unexpected_response', 'El servidor no ha confirmado el guardado. Recarga para comprobarlo.', { table });
    // Ninguna fila con esa versión: ¿no existe, ya se aplicó (reintento) o la cambió otra persona?
    const current = await readOne(table, ctx, `id=eq.${id}`);
    if (!current) throw new WriteError('not_found', 'El registro no existe o tu perfil no puede modificarlo.', { table });
    if (matches(current, changes)) return { row: current, outcome: 'already_applied' };
    throw new WriteError('conflict', 'Otra persona ha modificado este registro. Recarga para ver los cambios; no se ha guardado nada.', { table });
  }

  async function insert(table, row, validate) {
    validate(row);
    const ctx = await contextFor(table);
    const body = { ...row, org_id: ctx.id };
    try {
      const data = await call(table, table, { method: 'POST', body, headers: { Prefer: 'return=representation' } });
      return { row: confirmed(data, table, ctx, row.id), outcome: 'created' };
    } catch (e) {
      if (!(e instanceof WriteError) || e.code !== 'duplicate') throw e;
      // ¿Es el reintento de un alta que ya llegó (mismo id)?
      const sameId = await readOne(table, ctx, `id=eq.${row.id}`);
      const { id, legacy_id, ...rest } = body; delete rest.org_id;
      if (sameId) {
        if (matches(sameId, rest)) return { row: sameId, outcome: 'already_created' };
        // Llegó con otros valores (se cambió el formulario entre intentos): se aplican ahora.
        return { ...(await update(table, row.id, stripCreateOnly(table, rest), sameId.updated_at, validate)), outcome: 'already_created' };
      }
      // ¿Ya se importó ese registro de la demo (mismo legacy_id)? Se usa el existente, sin duplicar.
      if (legacy_id) {
        const byLegacy = await readOne(table, ctx, `legacy_id=eq.${encodeURIComponent(legacy_id)}`);
        if (byLegacy) return { row: byLegacy, outcome: 'existing_legacy' };
      }
      throw e;
    }
  }
  const stripCreateOnly = (table, row) => {
    const out = { ...row };
    delete out.created_by;
    if (table === 'patients') delete out.status;   // el estado del paciente no se cambia al reintentar un alta
    return out;
  };

  return {
    createPatient: row => insert('patients', row, validatePatientRow),
    updatePatient: (id, changes, version) => update('patients', id, changes, version, validatePatientRow),
    createAppointment: row => insert('appointments', row, validateAppointmentRow),
    updateAppointment: (id, changes, version) => update('appointments', id, changes, version, validateAppointmentRow)
  };
}
