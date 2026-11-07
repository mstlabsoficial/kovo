// Capa de datos de KOVO. legacy.js solo habla con este objeto.
// Modo por defecto: 'demo' (datos de demostración en este navegador, como siempre).
// Modo 'supabase': DESACTIVADO en esta fase (ver supabase.js).
import { createDemoSource } from './demo.js';
import { createSupabaseSource } from './supabase.js';

const MODE = import.meta.env.VITE_DATA_MODE || 'demo';

export const data = MODE === 'supabase' ? createSupabaseSource() : createDemoSource();
