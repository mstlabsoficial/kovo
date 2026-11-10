// Backend Supabase DEV. No se conecta automáticamente al modo demo ni sincroniza
// los datos ficticios locales. El repositorio ofrece operaciones explícitas por rol.
//
// load(): lee las tablas que permite el rol (solo GET), las convierte al modelo de legacy.js con
// from-supabase.js y construye el estado con legacy-state.js.
// writes: altas y cambios de pacientes y citas, uno a uno y confirmados por Supabase
// (writes.js + legacy-writes.js), y borradores de notas clínicas mediante la RPC autorizada
// (writes.notes, note-writes.js). El resto de cambios de la interfaz se quedan en memoria:
// persist() no sincroniza el estado completo.
import { getOrganizationContext, restoreSession, refreshAccessToken } from './auth.js';
import { isSupabaseConfigured, supabaseRequest } from './supabase-client.js';
import { createEntityWriter } from './writes.js';
import { createLegacyWrites, applyPatient, applyAppointment } from './legacy-writes.js';
import { createNoteWriter, createLegacyNoteWrites, applyNote } from './note-writes.js';
import { createKovoRepository } from './repository.js';
import { buildLegacyCollections } from './from-supabase.js';
import { toLegacyState } from './legacy-state.js';

export function createSupabaseSource({
  repository = createKovoRepository(),
  isConfigured = isSupabaseConfigured,
  restore = restoreSession,
  getContext = getOrganizationContext,
  request = supabaseRequest,
  refresh = refreshAccessToken,
  newId = () => crypto.randomUUID(),
  noteRpc = 'auto'
} = {}) {
  let context = null;
  let lastReport = [];
  const ctxNow = async () => context || source.authenticate();
  const writer = createEntityWriter({ request, refresh, getContext: ctxNow });
  const noteWriter = createNoteWriter({ request, refresh, getContext: ctxNow, rpc: noteRpc });
  const source = {
    mode:'supabase',
    repository,
    async authenticate() {
      if (!isConfigured()) throw new Error('Configura VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.');
      const user=await restore();
      if(!user) throw new Error('Inicia sesión para acceder a KOVO. La pantalla de acceso se integrará antes de habilitar este modo.');
      context = await getContext();
      return context;
    },
    writes: {
      ...createLegacyWrites({ writer, newId }),
      applyPatient, applyAppointment,
      notes: Object.assign(createLegacyNoteWrites({ writer: noteWriter }), { applyNote }),
      userId: () => context?.userId ?? null
    },
    async load({ today }) {
      if (!context) await this.authenticate();
      const snapshot = await repository.loadSnapshot();
      const built = buildLegacyCollections(snapshot);
      const { state, report } = toLegacyState({ ...built, context: snapshot.context, today });
      lastReport = report;
      return state;
    },
    // Diferencias de la última carga (ids, campos y códigos; sin datos personales ni clínicos).
    report() { return lastReport.slice(); },
    // legacy.js llama a save() en cada render. Aquí no se escribe nada: las escrituras van por
    // `writes`, una entidad cada vez, nunca sincronizando el estado completo.
    persist() {},
    async reset() {
      throw new Error('No se permite reiniciar ni borrar datos en el modo Supabase.');
    },
    newId() { return newId(); },
    async uploadFile() {
      throw new Error('La subida remota se habilitará después de validar Storage y los permisos por rol.');
    }
  };
  return source;
}
