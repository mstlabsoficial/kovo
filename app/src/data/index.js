// Capa de datos de KOVO.
// En demo no se carga ningún módulo de Supabase ni se necesitan variables de entorno.
// El cliente remoto solo se importa bajo demanda si VITE_DATA_MODE=supabase.
import { createDemoSource } from './demo.js';

const MODE = import.meta.env?.VITE_DATA_MODE || 'demo';

export const data = MODE === 'supabase'
  ? (await import('./supabase.js')).createSupabaseSource({
      gate: async () => (await import('../saas/gate.js')).runGate(),
      onSessionExpired: () => { location.reload(); }
    })
  : createDemoSource();
