import { defineConfig } from 'vite';

// Fase 0: Vite sirve index.html (estilos y estructura originales) y carga
// src/legacy.js (código original sin cambios) como módulo.
export default defineConfig({
  root: '.',
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true }
});
