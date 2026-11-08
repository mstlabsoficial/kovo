// Adaptador Supabase en construcción: autenticación y contexto de organización operativos.
// La carga completa del estado legacy permanece bloqueada hasta terminar el importador
// relacional y las pruebas de integridad. Nunca mezcla demo local con datos remotos.
import { getOrganizationContext, restoreSession } from './auth.js';
import { isSupabaseConfigured } from './supabase-client.js';

export function createSupabaseSource() {
  let context = null;
  return {
    mode:'supabase',
    async authenticate() {
      if (!isSupabaseConfigured()) throw new Error('Configura VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.');
      await restoreSession();
      context = await getOrganizationContext();
      return context;
    },
    async load() {
      if (!context) await this.authenticate();
      throw new Error('La conexión y los permisos están preparados, pero la migración relacional de pacientes, citas, notas y facturas aún no está habilitada. Usa DEMO hasta completar las pruebas.');
    },
    persist() {
      throw new Error('La sincronización remota está bloqueada hasta completar las pruebas de integridad.');
    },
    async reset() {
      throw new Error('No se permite reiniciar ni borrar datos en el modo Supabase.');
    },
    newId() { return crypto.randomUUID(); },
    async uploadFile() {
      throw new Error('La subida remota de documentos se habilitará junto con las pruebas de Storage y permisos.');
    }
  };
}
