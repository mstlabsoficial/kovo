import { defineConfig } from 'vite';

// GitHub Pages publica el proyecto bajo /kovo/.
// La build usa explícitamente el modo demo; no conecta datos remotos.
export default defineConfig({
  root: '.',
  base: '/kovo/',
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true }
});
