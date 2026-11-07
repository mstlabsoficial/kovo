# KOVO · app (Vite)

Fase 0 de la migración: KOVO original reproducido dentro de Vite **sin cambios** de diseño ni de funciones.
Sin Supabase. Con los datos de demostración de siempre (se guardan en el navegador).

## Cómo está hecho

- `index.html` y `src/legacy.js` se generan desde `../source/dist/Sesiona.html` con `npm run extract`
  (el script solo lee el original y comprueba su huella SHA-256 antes de hacer nada).
- `index.html` conserva los estilos y la estructura originales; el único cambio es que el código
  se carga como módulo: `<script type="module" src="/src/legacy.js">`.
- `src/legacy.js` es el código original, sin tocar.

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
npm run pw:install     # una vez: descarga Chromium dentro de .playwright-browsers/
npm run test:baseline  # capturas de referencia tomadas del ORIGINAL (escritorio y móvil)
npm run test:visual    # compara la versión Vite con esas capturas, píxel a píxel
npm run test:smoke     # recorre secciones, roles y acciones; falla si hay errores
```

Las pruebas fijan la fecha (viernes 6-11-2026, 11:30) para que los datos de demostración sean
siempre iguales. Las capturas de referencia quedan en `tests/__screenshots__/`.

## Estructura

```
app/
├── index.html                 Estructura y estilos originales (generado)
├── src/legacy.js              Código original (generado)
├── scripts/extract-legacy.py  Genera los dos anteriores desde source/
├── vite.config.js
├── playwright.config.js       Proyectos: original, original-movil, vite, vite-movil
└── tests/
    ├── helpers.js             Fecha fija, navegación, capturas
    ├── visual/pantallas.spec.js
    └── smoke/secciones.spec.js
```
