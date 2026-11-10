import { defineConfig } from 'vite';

// GitHub Pages publica el proyecto bajo /kovo/.
// La build pública usa el modo demo y no conecta datos remotos. El panel de administración de la
// plataforma (admin.html) solo se incluye en una build conectada (VITE_DATA_MODE=supabase).
const connected = process.env.VITE_DATA_MODE === 'supabase';
export default defineConfig({
  root: '.',
  base: process.env.GITHUB_ACTIONS ? '/kovo/' : '/',
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: {
    outDir: 'dist', emptyOutDir: true,
    rollupOptions: { input: connected ? { main: 'index.html', admin: 'admin.html' } : { main: 'index.html' } }
  }
});
