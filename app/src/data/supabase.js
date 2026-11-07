// Modo Supabase: DESACTIVADO en esta fase.
// No importa ninguna librería, no abre conexiones y NUNCA ejecuta seed() ni carga datos de demostración.
// Se completará en una fase posterior usando los cambios que calcula sync.js.
const OFF = 'El modo Supabase está desactivado en esta fase.';

export function createSupabaseSource() {
  return {
    mode: 'supabase',
    async load() { throw new Error(OFF); },
    persist() { throw new Error(OFF); },
    async reset() { throw new Error(OFF); },
    newId() { return crypto.randomUUID(); },
    async uploadFile() { throw new Error(OFF); }
  };
}
