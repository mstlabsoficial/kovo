# KOVO · app (Vite)

Fase 0 de la migración: KOVO original reproducido dentro de Vite **sin cambios** de diseño ni de funciones.
Sin Supabase. Con los datos de demostración de siempre (se guardan en el navegador).

## Cómo está hecho

- `index.html` y `src/legacy.js` se generan desde `../source/dist/Sesiona.html` con `npm run extract`
  (el script solo lee el original y comprueba su huella SHA-256 antes de hacer nada).
- `index.html` conserva los estilos y la estructura originales; el único cambio es que el código
  se carga como módulo: `<script type="module" src="/src/legacy.js">`.
- `src/legacy.js` es el código original, sin tocar.

## Capa de datos

`src/legacy.js` ya no lee ni escribe el navegador directamente: carga, guarda, crea ids,
restablece y sube archivos a través de `src/data/` (`data.load`, `persist`, `newId`, `reset`, `uploadFile`).
Desde este paso `legacy.js` es el código fuente (no se regenera con `extract-legacy.py`).

- `src/data/demo.js`: modo **demo**, el comportamiento original (misma clave de localStorage,
  así que los datos que ya había se siguen cargando).
- `src/data/supabase.js`: modo **supabase**, **desactivado**: no conecta y nunca ejecuta `seed()`.
- `src/data/sync.js`: calcula altas, modificaciones y bajas entre dos estados. No envía nada.
- Modo con `VITE_DATA_MODE` (ver `.env.example`). Por defecto, `demo`.

## Requisitos

Node.js 20.19 o superior (`node -v`).
Si usas el Node portátil de esta carpeta, antes de cada sesión en la terminal, desde `app/`:

```
export PATH="$PWD/.tools/node/bin:$PATH"
```

## Uso

```
npm install            # una vez
npm run dev            # abre http://localhost:5173
npm run build          # versión de producción en dist/
npm run preview        # sirve dist/ en http://localhost:4173
```

## Pruebas

```
npm run pw:install         # una vez: descarga Chromium dentro de .playwright-browsers/
sh scripts/pw.sh baseline  # capturas de referencia tomadas del ORIGINAL (escritorio y móvil)
sh scripts/pw.sh visual    # compara la versión Vite con esas capturas, píxel a píxel
sh scripts/pw.sh smoke     # recorre secciones, roles y acciones; falla si hay errores
sh scripts/pw.sh all       # smoke + visual
```

**Importante:** las pruebas se lanzan con `scripts/pw.sh`, no con `npm run` ni `npx`. En este Mac,
Chromium se cierra al abrir cualquier página si su proceso padre es npm; lanzado con `node`
directamente funciona. Si el servidor de Vite no está arrancado, las pruebas lo arrancan solas.

Las pruebas fijan la fecha (viernes 6-11-2026, 11:30) para que los datos de demostración sean
siempre iguales. Las capturas de referencia quedan en `tests/__screenshots__/`.

## Estructura

```
app/
├── index.html                 Estructura y estilos originales (generado)
├── src/legacy.js              Código original (generado)
├── scripts/extract-legacy.py  Genera los dos anteriores desde source/
├── scripts/pw.sh              Lanza las pruebas de Playwright sin npm
├── vite.config.js
├── playwright.config.js       Proyectos: original, original-movil, vite, vite-movil
└── tests/
    ├── helpers.js             Fecha fija, navegación, capturas
    ├── visual/pantallas.spec.js
    ├── smoke/secciones.spec.js
    └── __screenshots__/       38 capturas de referencia del original (19 escritorio + 19 móvil)
```

## Fuente e iconos

- `src/fonts.css` + `src/assets/fonts/`: Geist y Geist Mono alojadas en el proyecto (licencia OFL en
  `src/assets/fonts/OFL.txt`). Son los mismos archivos y rangos que servía Google Fonts, por eso las
  capturas de referencia coinciden. No se carga nada de Google.
- `public/`: favicon (`icon-192.png`), Apple Touch Icon (`apple-touch-icon.png`, 180×180), icono de
  512 y `manifest.webmanifest`. Vite les antepone la ruta base al compilar (`/` o `/kovo/`).
  Los iconos de 180 y 192 se generan reduciendo `icon-512.png`.

## Variables de entorno

Copia `.env.example` a `.env.local` para tus valores locales. Git ignora `.env`, `.env.*` y `*.local`;
solo se versionan los archivos `*.example`, que nunca deben contener claves.

Herramientas locales (fuera de Git): `.tools/node` (Node 22.23.4 portátil), `node_modules/`,
`.playwright-browsers/` (Chromium de pruebas).
