const mode=import.meta.env.VITE_DATA_MODE||'demo';
if(mode==='supabase') await import('./remote.js');
else await import('./legacy.js');
