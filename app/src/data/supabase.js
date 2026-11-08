// Backend Supabase DEV. No se conecta automáticamente al modo demo ni sincroniza
// los datos ficticios locales. El repositorio ofrece operaciones explícitas por rol.
//
// load(): lee las tablas que permite el rol (solo GET), las convierte al modelo de legacy.js con
// from-supabase.js y construye el estado con legacy-state.js. Es de SOLO LECTURA: los cambios
// que se hagan en la interfaz se quedan en memoria y se pierden al recargar (ver persist()).
import { getOrganizationContext, restoreSession } from './auth.js';
import { isSupabaseConfigured } from './supabase-client.js';
import { createKovoRepository } from './repository.js';
import { buildLegacyCollections } from './from-supabase.js';
import { toLegacyState } from './legacy-state.js';

export function createSupabaseSource({
  repository = createKovoRepository(),
  isConfigured = isSupabaseConfigured,
  restore = restoreSession,
  getContext = getOrganizationContext
} = {}) {
  let context = null;
  let lastReport = [];
  return {
    mode:'supabase',
    readOnly:true,
    repository,
    async authenticate() {
      if (!isConfigured()) throw new Error('Configura VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.');
      const user=await restore();
      if(!user) throw new Error('Inicia sesión para acceder a KOVO. La pantalla de acceso se integrará antes de habilitar este modo.');
      context = await getContext();
      return context;
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
    // legacy.js llama a save() en cada render. En este modo no se escribe nada: las escrituras
    // irán por las operaciones explícitas del repositorio (RPC), nunca sincronizando el estado completo.
    persist() {},
    async reset() {
      throw new Error('No se permite reiniciar ni borrar datos en el modo Supabase.');
    },
    newId() { return crypto.randomUUID(); },
    async uploadFile() {
      throw new Error('La subida remota se habilitará después de validar Storage y los permisos por rol.');
    }
  };
}
