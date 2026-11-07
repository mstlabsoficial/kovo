"""Genera app/index.html y app/src/legacy.js a partir de source/dist/Sesiona.html.

Solo LEE el original. Separa el único <script> con código propio y lo carga como
módulo desde Vite; el resto del HTML (estilos y estructura) queda igual.

Uso (desde app/):  python3 scripts/extract-legacy.py
"""
import hashlib, pathlib, sys

APP = pathlib.Path(__file__).resolve().parent.parent
SRC = APP.parent / 'source' / 'dist' / 'Sesiona.html'
EXPECTED_SHA256 = 'dede0565eac4aeb6d35c188b6fa839578d3b52bd39655c704bd6e69b75b1ec21'

raw = SRC.read_bytes()
sha = hashlib.sha256(raw).hexdigest()
if sha != EXPECTED_SHA256:
    sys.exit(f'El original ha cambiado (sha256 {sha}). Revisa antes de regenerar.')
html = raw.decode('utf-8')

OPEN = '<script>\n'
start = html.index(OPEN)
end = html.index('</script>', start)
assert html.count(OPEN) == 1, 'Se esperaba un único <script> en línea'

code = html[start + len(OPEN):end]
index = html[:start] + '<script type="module" src="/src/legacy.js"></script>' + html[end + len('</script>'):]

(APP / 'src').mkdir(exist_ok=True)
(APP / 'src' / 'legacy.js').write_text(
    '// Código original de KOVO extraído sin cambios de source/dist/Sesiona.html.\n'
    '// Fase 0: se carga tal cual como módulo. En la Fase 1 se separará en módulos.\n'
    + code, encoding='utf-8')
(APP / 'index.html').write_text(index, encoding='utf-8')
print('index.html y src/legacy.js generados desde', SRC)
