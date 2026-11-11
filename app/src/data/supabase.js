// Backend Supabase DEV. No se conecta automáticamente al modo demo ni sincroniza
// los datos ficticios locales. El repositorio ofrece operaciones explícitas por rol.
//
// load(): lee las tablas que permite el rol (solo GET), las convierte al modelo de legacy.js con
// from-supabase.js y construye el estado con legacy-state.js.
// writes: altas y cambios de pacientes y citas, uno a uno y confirmados por Supabase
// (writes.js + legacy-writes.js), y borradores de notas clínicas mediante la RPC autorizada
// (writes.notes, note-writes.js). El resto de cambios de la interfaz se quedan en memoria:
// persist() no sincroniza el estado completo.
import { getOrganizationContext, restoreSession, refreshAccessToken, signOut, selectOrg, scheduleRefresh } from './auth.js';
import { createClinicApi } from './clinic.js';
import { isSupabaseConfigured, supabaseRequest } from './supabase-client.js';
import { createEntityWriter } from './writes.js';
import { createLegacyWrites, applyPatient, applyAppointment, applyAppointments } from './legacy-writes.js';
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
  noteRpc = 'auto',
  // Pantallas de acceso (login, alta, onboarding, elegir clínica, invitación). Solo en el navegador
  // (index.js); sin ella, authenticate() exige una sesión ya iniciada.
  gate = null,
  onSessionExpired = () => {}
} = {}) {
  let context = null;
  let lastReport = [];
  const ctxNow = async () => context || source.authenticate();
  const writer = createEntityWriter({ request, refresh, getContext: ctxNow });
  const noteWriter = createNoteWriter({ request, refresh, getContext: ctxNow, rpc: noteRpc });
  const clinic = createClinicApi({ request, refresh, getContext: ctxNow, newId });

  const source = {
    mode:'supabase',
    repository,
    async authenticate() {
      if (!isConfigured()) throw new Error('Configura VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.');
      if (gate) context = await gate();
      else {
        const user=await restore();
        if(!user) throw new Error('Inicia sesión para acceder a KOVO.');
        context = await getContext();
      }
      if (gate) scheduleRefresh(onSessionExpired);
      return context;
    },
    writes: {
      ...createLegacyWrites({ writer, newId }),
      applyPatient, applyAppointment, applyAppointments,
      notes: Object.assign(createLegacyNoteWrites({ writer: noteWriter }), { applyNote }),
      userId: () => context?.userId ?? null
    },
    clinic,
    context: () => context,
    async signOut() { await signOut(); context = null; },
    switchOrg() { selectOrg(null); context = null; },
    async load({ today }) {
      if (!context) await this.authenticate();
      const snapshot = await repository.loadSnapshot();
      const built = buildLegacyCollections(snapshot);
      const ctx = { ...snapshot.context, ...(context || {}) };
      const pros = built.collections.professionals || [];
      const me = pros.find(p => p.userId && p.userId === ctx.userId) || (pros.length === 1 ? pros[0] : null);
      const extras = repository.loadExtras ? await repository.loadExtras(ctx, me?.id ?? null) : {};
      if (extras.name) ctx.name = extras.name;
      const { state, report } = toLegacyState({ ...built, context: ctx, today, extras });
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
    // Las fotos y adjuntos genéricos de la interfaz demo no se suben: los documentos clínicos van
    // por clinic.uploadDocument (Storage privado con RLS).
    async uploadFile() {
      throw new Error('Este adjunto no se guarda en modo conectado. Usa «Documentos» en la ficha del paciente.');
    }
  };
  return source;
}
