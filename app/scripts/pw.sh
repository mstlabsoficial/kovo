#!/bin/sh
# Ejecuta las pruebas de Playwright SIN pasar por npm/npx.
# Motivo: en este Mac, Chromium se cierra al abrir cualquier página cuando su proceso
# padre es npm (npm run / npm exec / npx). Lanzado con node directamente funciona bien.
#
# Uso (desde app/):
#   sh scripts/pw.sh baseline   capturas de referencia desde el ORIGINAL (escritorio y móvil)
#   sh scripts/pw.sh visual     compara la versión Vite contra esas capturas
#   sh scripts/pw.sh smoke      recorre secciones, roles y acciones de la versión Vite
#   sh scripts/pw.sh all        smoke + visual
#   sh scripts/pw.sh supabase   interfaz en modo Supabase contra una API simulada (sin red)
set -e
cd "$(dirname "$0")/.."
export PATH="$PWD/.tools/node/bin:$PATH"
export PLAYWRIGHT_BROWSERS_PATH="$PWD/.playwright-browsers"
PW="node node_modules/@playwright/test/cli.js test"
case "$1" in
  baseline) $PW tests/visual --project=original --project=original-movil --update-snapshots ;;
  visual)   $PW tests/visual --project=vite --project=vite-movil ;;
  smoke)    $PW tests/smoke --project=vite ;;
  all)      $PW tests/smoke --project=vite && $PW tests/visual --project=vite --project=vite-movil ;;
  supabase) $PW --config=playwright.supabase.config.js ;;
  *) echo "Uso: sh scripts/pw.sh baseline|visual|smoke|all|supabase"; exit 1 ;;
esac
