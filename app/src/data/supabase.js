// Backend Supabase DEV. No se conecta automáticamente al modo demo ni sincroniza
// los datos ficticios locales. El repositorio ofrece operaciones explícitas por rol.
import { getOrganizationContext, restoreSession } from './auth.js';
import { isSupabaseConfigured } from './supabase-client.js';
import { createKovoRepository } from './repository.js';

export function createSupabaseSource() {
  let context = null;
  const repository=createKovoRepository();
  return {
    mode:'supabase',
    repository,
    async authenticate() {
      if (!isSupabaseConfigured()) throw new Error('Configura VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.');
      const user=await restoreSession();
      if(!user) throw new Error('Inicia sesión para acceder a KOVO.');
      context = await getOrganizationContext();
      return context;
    },
    async load() {
      if (!context) await this.authenticate();
      return repository.loadSnapshot();
    },
    // La UI legacy guarda de forma síncrona. No se conecta a esta función hasta
    // sustituir save() por operaciones explícitas y comprobadas del repositorio.
    persist() {
      throw new Error('Usa las operaciones explícitas del repositorio; no se permite sincronizar el estado completo.');
    },
    async reset() {
      throw new Error('No se permite reiniciar ni borrar datos en el modo Supabase.');
    },
    newId() { return crypto.randomUUID(); },
    async uploadFile() {
      throw new Error('La subida remota se habilitará después de validar Storage y los permisos por rol.');
    }
  };
}
