// Borradores de notas clínicas en Supabase: crear y editar. Solo el rol psychologa.
//
// La tabla clinical_notes es de solo lectura para `authenticated` (solo SELECT). Toda escritura pasa
// por la RPC autorizada public.save_clinical_note_draft(p_org_id, p_patient_id, p_appointment_id,
// p_note_type, p_content, p_note_id), que:
//   - exige el rol psychologa en p_org_id (si no, 42501);
//   - rechaza un contenido vacío;
//   - sin p_note_id, INSERTA un borrador con un id que elige el SERVIDOR y author_id = auth.uid();
//   - con p_note_id, ACTUALIZA solo si el borrador es de esa consulta, de la misma autora y sigue
//     en 'draft' ("Draft not found or not editable");
//   - devuelve solo el uuid. La fila confirmada se lee después con SELECT.
// Firma (sign_clinical_note), rectificación (rectify_clinical_note) y borrado
// (delete_clinical_note_draft) quedan fuera de esta fase y no se llaman.
//
// Lo que la BD NO comprueba y se comprueba aquí antes de llamar a la RPC (leyendo la BD):
//   - que la cita pertenece al paciente (la clave foránea solo exige la misma consulta);
//   - que la nota es de ese paciente y esa cita al editar (la RPC no cambia patient_id ni appointment_id).
//
// Reintentos: la RPC no acepta un id propuesto por el cliente al crear, así que un reintento ciego
// tras perder la respuesta duplicaría la nota. Antes de reintentar un alta se busca en la BD un
// borrador de esta autora, paciente, cita y tipo que esta sesión no conozca y cuyo contenido sea el
// de un intento anterior: si hay uno, es el nuestro y se reutiliza. Ver note-writes.md (límites).
//
// Ningún mensaje de error incluye contenido clínico; nada se escribe en consola.
import { supabaseRequest } from './supabase-client.js';
import { isUuid } from './mapping.js';
import { WriteError, classify } from './writes.js';
import { NOTE_FIELD_KEYS, NOTE_TYPE, parseNoteContent, clinicalNoteFromRow } from './from-supabase.js';
import { uiNote } from './legacy-state.js';

export const NOTE_ROLES = Object.freeze(['psychologa']);
export const SAVE_DRAFT_RPC = 'rpc/save_clinical_note_draft';
const TABLE = 'clinical_notes';
const DB_NOTE_TYPE = Object.freeze(Object.fromEntries(Object.entries(NOTE_TYPE).map(([db, ui]) => [ui, db])));
const MAX_CONTENT = 200000;

const bad = (field, message) => new WriteError('validation', message, { table: TABLE, field });
const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const sameTs = (a, b) => a === b || (typeof a === 'string' && typeof b === 'string' && Date.parse(a) === Date.parse(b) && Number.isFinite(Date.parse(a)));

/* ===== contenido: el formato que ya usa la consulta ===== */
// "clave: valor" por apartado, separados por una línea en blanco (mapping.clinicalNoteToRow y su
// inverso from-supabase.parseNoteContent). Se escriben TODOS los apartados del tipo, en su orden.
// Si el texto no se puede volver a leer exactamente igual (un apartado contiene, tras una línea en
// blanco, una línea que empieza como el título de otro: "plan: …"), se rechaza: guardar mezclaría
// apartados.
export function serializeNoteFields(type, fields) {
  const keys = NOTE_FIELD_KEYS[type];
  if (!keys) throw bad('type', 'Tipo de nota no válido.');
  if (!isPlainObject(fields)) throw bad('fields', 'Contenido de la nota no válido.');
  for (const k of Object.keys(fields)) if (!keys.includes(k)) throw bad(k, 'Apartado no válido para este tipo de nota.');
  const norm = {};
  for (const k of keys) {
    const v = fields[k] ?? '';
    if (typeof v !== 'string') throw bad(k, 'Contenido de la nota no válido.');
    norm[k] = v;
  }
  const content = keys.map(k => `${k}: ${norm[k]}`).join('\n\n');
  if (content.length > MAX_CONTENT) throw bad('fields', 'La nota es demasiado larga para guardarla.');
  const back = parseNoteContent(content, type);
  const header = new RegExp(`\\n\\n(${keys.join('|')}): ?`);
  const broken = keys.find(k => header.test(norm[k])) || keys.find(k => !back.structured || back.fields[k] !== norm[k]);
  if (broken) throw bad(broken, 'Un apartado tiene, tras una línea en blanco, una línea que empieza como el título de otro apartado (por ejemplo «plan:»). Cámbiala para poder guardar sin mezclar apartados; no se ha guardado nada.');
  return { content, fields: norm };
}

/* ===== errores de la RPC ===== */
function classifyNote(e) {
  if (e instanceof WriteError) return e;
  const pg = e?.details?.code || null;
  const msg = typeof e?.details?.message === 'string' ? e.details.message : '';
  if (pg === 'P0001' && /content cannot be empty/i.test(msg)) return bad('fields', 'La nota no puede estar vacía.');
  if (pg === 'P0001' && /not found or not editable/i.test(msg)) return new WriteError('not_editable', 'Este borrador ya no se puede editar.', { table: TABLE, status: e.status ?? null });
  if (pg === '23503') return new WriteError('invalid_reference', 'El paciente o la cita no pertenecen a tu consulta.', { table: TABLE, status: e.status ?? null });
  if (e?.status === 403 || pg === '42501') return new WriteError('forbidden', 'Tu perfil no tiene permiso para gestionar notas clínicas.', { table: TABLE, status: e.status ?? null });
  return classify(e, TABLE);   // red, sesión, HTTP… mensajes genéricos sin datos
}

/* ===== escritor ===== */
export function createNoteWriter({ request = supabaseRequest, getContext, refresh = async () => null } = {}) {
  if (typeof getContext !== 'function') throw new Error('createNoteWriter necesita getContext().');

  // Una petición; tras un 401 (el servidor no la ha ejecutado) renueva la sesión una vez y la repite.
  const call = async (path, options) => {
    let refreshed = false;
    for (;;) {
      try { return await request(path, options); }
      catch (e) {
        const err = classifyNote(e);
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
  const context = async () => {
    let ctx;
    try { ctx = await getContext(); } catch (e) { throw classify(e, 'memberships'); }
    if (!ctx || !isUuid(ctx.id)) throw new WriteError('forbidden', 'No se ha podido identificar tu consulta.', { table: TABLE });
    if (!NOTE_ROLES.includes(ctx.role)) throw new WriteError('forbidden', 'Tu perfil no tiene permiso para gestionar notas clínicas.', { table: TABLE });
    if (!isUuid(ctx.userId)) throw new WriteError('auth', 'No se ha podido identificar tu usuaria. Vuelve a iniciar sesión; no se ha guardado nada.', { table: TABLE });
    return ctx;
  };
  const list = async (path, table) => {
    const data = await call(path);
    if (!Array.isArray(data)) throw new WriteError('unexpected_response', 'Respuesta inesperada del servidor.', { table });
    return data;
  };
  const one = async (table, ctx, id, select = '*') => {
    const data = await list(`${table}?select=${select}&id=eq.${id}&org_id=eq.${ctx.id}&limit=2`, table);
    if (data.length > 1 || (data[0] && (data[0].org_id !== ctx.id || data[0].id !== id)))
      throw new WriteError('unexpected_response', 'Respuesta inesperada del servidor.', { table });
    return data[0] || null;
  };

  // Paciente y cita de esta consulta, y cita de ese paciente.
  async function checkReferences(ctx, patientId, appointmentId) {
    const p = await one('patients', ctx, patientId, 'id,org_id');
    if (!p) throw new WriteError('invalid_reference', 'El paciente no pertenece a tu consulta.', { table: TABLE, field: 'patient_id' });
    if (appointmentId == null) return;
    const a = await one('appointments', ctx, appointmentId, 'id,org_id,patient_id');
    if (!a) throw new WriteError('invalid_reference', 'La cita no pertenece a tu consulta.', { table: TABLE, field: 'appointment_id' });
    if (a.patient_id !== patientId) throw new WriteError('invalid_reference', 'La cita no corresponde a este paciente.', { table: TABLE, field: 'appointment_id' });
  }
  function assertEditable(row, ctx, patientId, appointmentId) {
    if (row.status !== 'draft' || row.signed_at) throw new WriteError('locked', 'Esta nota está firmada y no se puede modificar. Las correcciones se añaden como rectificación.', { table: TABLE });
    if (row.author_id !== ctx.userId) throw new WriteError('forbidden', 'Solo quien creó este borrador puede editarlo.', { table: TABLE });
    if (row.patient_id !== patientId || (row.appointment_id ?? null) !== (appointmentId ?? null))
      throw new WriteError('invalid_reference', 'El borrador no corresponde a este paciente o cita.', { table: TABLE });
  }
  function assertConfirmed(row, ctx, expect) {
    const ok = row && row.org_id === ctx.id && row.id === expect.id && row.patient_id === expect.patientId &&
      (row.appointment_id ?? null) === expect.appointmentId && row.author_id === ctx.userId &&
      row.status === 'draft' && !row.signed_at && row.note_type === expect.noteType && row.content === expect.content;
    if (!ok) throw new WriteError('unexpected_response', 'El servidor no ha confirmado el guardado. Recarga para comprobarlo.', { table: TABLE });
    return row;
  }
  async function rpc(ctx, args) {
    const id = await call(SAVE_DRAFT_RPC, { method: 'POST', body: { p_org_id: ctx.id, ...args } });
    if (!isUuid(id)) throw new WriteError('unexpected_response', 'El servidor no ha confirmado el guardado. Recarga para comprobarlo.', { table: TABLE });
    return id;
  }
  // Tras "not editable": ¿se firmó entretanto o ya no existe?
  async function explainNotEditable(ctx, id) {
    const cur = await one(TABLE, ctx, id).catch(() => null);
    if (cur && (cur.status !== 'draft' || cur.signed_at)) return new WriteError('locked', 'Esta nota está firmada y no se puede modificar. Las correcciones se añaden como rectificación.', { table: TABLE });
    return new WriteError('not_found', 'El borrador no existe o tu perfil no puede editarlo.', { table: TABLE });
  }

  async function edit(ctx, id, expect, version, attempts) {
    const cur = await one(TABLE, ctx, id);
    if (!cur) throw new WriteError('not_found', 'El borrador no existe o tu perfil no puede editarlo.', { table: TABLE });
    assertEditable(cur, ctx, expect.patientId, expect.appointmentId);
    if (cur.content === expect.content && cur.note_type === expect.noteType) return { row: cur, outcome: 'already_applied' };
    // Versión: si cambió y no fue por un intento nuestro cuya respuesta se perdió, es otra sesión.
    if (version && !sameTs(cur.updated_at, version) && !attempts.includes(cur.content))
      throw new WriteError('conflict', 'Este borrador se ha modificado en otra sesión. Recarga para ver la última versión; no se ha guardado nada.', { table: TABLE });
    attempts.push(expect.content);
    let got;
    try { got = await rpc(ctx, { p_patient_id: expect.patientId, p_appointment_id: expect.appointmentId, p_note_type: expect.noteType, p_content: expect.content, p_note_id: id }); }
    catch (e) { if (e.code === 'not_editable') throw await explainNotEditable(ctx, id); throw e; }
    if (got !== id) throw new WriteError('unexpected_response', 'El servidor ha devuelto una nota que no corresponde. Recarga para comprobarlo.', { table: TABLE });
    return { row: assertConfirmed(await one(TABLE, ctx, id), ctx, { ...expect, id }), outcome: 'updated' };
  }

  // Un borrador nuestro de un intento anterior cuya respuesta se perdió.
  async function findLostDraft(ctx, expect, attempts, knownIds) {
    const appt = expect.appointmentId ? `eq.${expect.appointmentId}` : 'is.null';
    const rows = await list(`${TABLE}?select=*&org_id=eq.${ctx.id}&patient_id=eq.${expect.patientId}&appointment_id=${appt}` +
      `&author_id=eq.${ctx.userId}&status=eq.draft&note_type=eq.${expect.noteType}&order=created_at.desc&limit=50`, TABLE);
    const known = new Set(knownIds || []);
    const mine = rows.filter(r => r && r.org_id === ctx.id && !known.has(r.id) && attempts.includes(r.content));
    if (mine.length > 1) throw new WriteError('conflict', 'Hay más de un borrador sin confirmar de esta nota. Recarga para revisarlos; no se ha guardado nada.', { table: TABLE });
    return mine[0] || null;
  }

  // input: { id (uuid o null para crear), patientId, appointmentId, type ('sesion'…), fields,
  //          version (updated_at cargado), attempts (array que conserva el llamador entre
  //          reintentos de la misma nota; aquí se añade cada contenido enviado), knownIds }
  async function saveDraft({ id = null, patientId, appointmentId = null, type, fields, version = null, attempts = [], knownIds = [] } = {}) {
    if (id != null && !isUuid(id)) throw bad('id', 'Nota no válida.');
    if (!isUuid(patientId)) throw bad('patient_id', 'Paciente no válido.');
    if (appointmentId != null && !isUuid(appointmentId)) throw bad('appointment_id', 'Cita no válida.');
    if (!Array.isArray(attempts)) throw bad(null, 'Datos no válidos.');
    const { content } = serializeNoteFields(type, fields);
    const expect = { patientId, appointmentId: appointmentId ?? null, noteType: DB_NOTE_TYPE[type], content };
    const ctx = await context();
    await checkReferences(ctx, patientId, expect.appointmentId);
    if (id) return edit(ctx, id, expect, version, attempts);

    if (attempts.length) {
      const lost = await findLostDraft(ctx, expect, attempts, knownIds);
      if (lost) {
        if (lost.content === content) return { row: lost, outcome: 'already_created' };
        return { ...(await edit(ctx, lost.id, expect, null, attempts)), outcome: 'already_created' };
      }
    }
    attempts.push(content);
    const newId = await rpc(ctx, { p_patient_id: patientId, p_appointment_id: expect.appointmentId, p_note_type: expect.noteType, p_content: content, p_note_id: null });
    return { row: assertConfirmed(await one(TABLE, ctx, newId), ctx, { ...expect, id: newId }), outcome: 'created' };
  }

  return { saveDraft };
}

/* ===== adaptador para legacy.js ===== */
// saveNote({ note, fields, knownIds }): `note` es la nota del editor. Un borrador todavía no guardado
// lleva `unsaved: true` (su id local puede tener formato UUID, pero no existe en la BD). Devuelve la nota legacy construida desde la fila confirmada; el llamador la aplica con
// applyNote. Los intentos fallidos de una misma nota se recuerdan para no duplicarla al reintentar.
export function createLegacyNoteWrites({ writer }) {
  const pending = new Map();
  return {
    async saveNote({ note, fields, knownIds = [] }) {
      if (!note || typeof note !== 'object') throw bad(null, 'Nota no válida.');
      const isNew = note.unsaved === true || !isUuid(note.id);
      if (!pending.has(note.id)) pending.set(note.id, []);
      const res = await writer.saveDraft({
        id: isNew ? null : note.id, patientId: note.patientId, appointmentId: note.apptId || null,
        type: note.type, fields, version: isNew ? null : (note.updatedAt ?? null),
        attempts: pending.get(note.id), knownIds
      });
      pending.delete(note.id);
      const n = uiNote(clinicalNoteFromRow(res.row, (note.versions || []).slice()));
      if (!n) throw new WriteError('unexpected_response', 'El servidor no ha confirmado el guardado. Recarga para comprobarlo.', { table: TABLE });
      n.log = (note.log || []).slice();
      return { note: n, outcome: res.outcome, replacedId: n.id !== note.id ? note.id : null };
    },
    forget(localId) { pending.delete(localId); }
  };
}

// Sustituye (o añade) la nota confirmada en el estado. Solo se llama tras la confirmación.
export function applyNote(S, note, replacedId = null) {
  const key = replacedId || note.id;
  const i = S.notes.findIndex(x => x.id === key || x.id === note.id);
  if (i >= 0) S.notes[i] = note; else S.notes.push(note);
  if (S.sel && S.sel.editing === key) S.sel.editing = note.id;
  return note;
}
