// Modo demo: el comportamiento original de KOVO, sin cambios.
// Todo el estado se guarda en localStorage con la misma clave de siempre, así que los
// datos que ya hubiera en el navegador se siguen cargando.
const KEY = 'sesiona-prototipo-v7';

export function createDemoSource() {
  return {
    mode: 'demo',

    // Carga lo guardado; si no hay nada o es de otro mes, genera los datos de demostración.
    async load({ seed, today }) {
      let s;
      try {
        const raw = localStorage.getItem(KEY);
        s = raw ? JSON.parse(raw) : null;
        if (s && s.builtFor !== today.slice(0, 7)) s = null;
      } catch (e) { s = null; }
      if (!s) { s = seed(); s.builtFor = today.slice(0, 7); }
      return s;
    },

    // Guarda el estado completo. Si el navegador no tiene espacio, lanza el error (legacy.js avisa).
    persist(s) {
      localStorage.setItem(KEY, JSON.stringify(s));
    },

    async reset({ seed, today }) {
      try { localStorage.removeItem(KEY); } catch (e) { /* sin acceso al almacenamiento */ }
      const s = seed();
      s.builtFor = today.slice(0, 7);
      return s;
    },

    newId(prefix, s) {
      return prefix + (s.seq++);
    },

    // Fotos y documentos: almacén del visor de Claude si existe; si no, dentro del propio estado.
    async uploadFile(blob, { assets, toDataURL }) {
      if (assets) { try { const a = await assets.upload(blob); return a.url; } catch (e) { /* sigue */ } }
      if (blob.size > 900000) return null;
      return await toDataURL(blob);
    }
  };
}
