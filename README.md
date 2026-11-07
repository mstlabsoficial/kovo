# KOVO

Gestión para consultas de psicología. Prototipo funcional (datos ficticios, todo en el navegador).

## Estructura

```
KOVO/
├── original/KOVO.html        Copia que ya existía (versión publicada en claude.ai, v6). No se toca.
├── source/
│   ├── dist/
│   │   ├── Sesiona.html      Versión final funcional (la más reciente). Archivo único, se abre en el navegador.
│   │   └── KOVO-app.zip      App instalable (PWA) lista para subir a un alojamiento con https.
│   ├── pwa/                  Contenido descomprimido de la app instalable (index, manifest, sw.js, iconos).
│   └── build/                Piezas originales con las que se construye Sesiona.html (copia exacta de la carpeta temporal).
└── backups/                  Copias de seguridad comprimidas (fuera de Git).
```

## Piezas de `source/build/`

**Base y montaje**
- `Sesiona.original.html` — prototipo de partida.
- `patch.py` — primera transformación (búsqueda por nombre, ajustes editables) → produjo `Sesiona.v2.html`.
- `Sesiona.v2.html` — base sobre la que se aplica el montaje actual.
- `patch2.py` — inserta estilos y pantallas en la base.
- `build.py` — montaje completo: ajusta estilos, ejecuta `patch2.py` y `build_extra.py`, datos de ejemplo, logo.
- `build_extra.py` — mapa semanal, carrusel, facturación por secciones, menú de perfil, descargas.
- `pwa.py` — genera la app instalable a partir de la versión final.

**Estilos**: `cssA.css` (base y componentes), `cssB.css` (calendario, ficha, modales, móvil), `cssC.css` (mapa semanal, carrusel, facturación, menú). `css2.css` se genera al montar. `css.css` es de una versión anterior.

**Pantallas y lógica (en uso)**: `markup2.html`, `icons2.js`, `navrender2.js`, `inicio2.js`, `cal3.js`, `ficha2.js`, `informes2.js`, `fact3.js`, `ingresos3.js`, `extras.js`, `actions2.js`.

**Versiones anteriores (histórico)**: `markup.html`, `nav_render.js`, `inicio.js`, `cal.js`, `pacientes.js`, `ficha_datos.js`, `ficha_head.js`, `modal.js`, `apptform.js`, `config.js` (ya incluidas en `Sesiona.v2.html`).

**Recursos**: `serve/logo.webp` (logo original), `logo_full.png`, `logo132.png`, `logo.b64` (logo embebido), `icon*.svg` / `icon*.svg.png` (iconos de la app). `kovo-web.html` es la variante preparada para alojar en web. `serve/index.html` es una copia de prueba.

## Reconstruir

Los scripts tienen rutas fijas a la carpeta temporal original (`/private/tmp/claude-501/sesiona/`) y escriben en `~/Downloads/Sesiona.html`. Antes de usarlos aquí hay que cambiar esas rutas. Verificado el 7-11-2026: el montaje reproduce `dist/Sesiona.html` byte a byte (SHA-256 `dede0565…b1ec21`).
