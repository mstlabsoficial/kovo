// KOVO — pila local SIN el esquema de KOVO (como un `supabase start` recién creado), para ensayar sin
// Docker el modo que usa el CI: `node db/run.mjs --external --e2e`.
//
//   node db/local/empty-stack.mjs /ruta/fuera-del-repo/ext.env   # escribe KOVO_EXT_* (permisos 600)
//   set -a; . /ruta/fuera-del-repo/ext.env; set +a; node db/run.mjs --external --e2e
//
// Todo es local y temporal (claves aleatorias de un solo uso). Se para con Ctrl+C o SIGTERM.
// No escribas el fichero dentro del repositorio.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { startStack } from './stack.mjs';
import { ROOT } from '../../clinical-db/local/env.mjs';

const out = process.argv[2];
if (!out) { console.error('Uso: node db/local/empty-stack.mjs <fichero .env fuera del repositorio>'); process.exit(2); }
if (resolve(out).startsWith(resolve(ROOT) + '/')) { console.error('El fichero de variables no puede estar dentro del repositorio.'); process.exit(2); }
const s = await startStack({ log: m => console.log(`  · ${m}`) });
writeFileSync(out, [`KOVO_EXT_URL=${s.url}`, `KOVO_EXT_ANON=${s.anonKey}`, `KOVO_EXT_SERVICE=${s.serviceKey}`,
  `KOVO_EXT_DB_URL=postgres://postgres:${s.env.password}@127.0.0.1:${s.env.port}/kovo`, `KOVO_EXT_JWT_SECRET=${s.secret}`].join('\n') + '\n', { mode: 0o600 });
console.log(`Pila lista. Variables en ${out}. Ctrl+C para parar y borrar todo.`);
const stop = async () => { await s.stop(); process.exit(0); };
process.once('SIGINT', stop); process.once('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
