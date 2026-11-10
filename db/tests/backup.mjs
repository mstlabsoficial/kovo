// KOVO — backup and restore drill on real PostgreSQL 17 + real Storage files.
//
// Local machine: there is no pg_dump in app/.tools, so the drill is a COLD PHYSICAL backup (clean
// shutdown, copy of the data directory and of the Storage file backend, restore into a new
// directory/port), which is a valid PostgreSQL backup method. The LOGICAL drill (pg_dump/pg_restore,
// the method `supabase db dump` uses) runs in CI against the official Supabase stack:
// scripts/ci-stack.sh. Hosted projects: see docs/ops/backups.md (Supabase backups/PITR do NOT
// include Storage objects).
import { execFileSync } from 'node:child_process';
import { cpSync, rmSync, mkdtempSync, readdirSync, readFileSync, statSync, chmodSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startStack } from '../local/stack.mjs';
import { applyKovoSchema } from '../schema.mjs';
import { pg, freePort, TOOLS } from '../../clinical-db/local/env.mjs';
import { client, suite, newUser, minimalPdf } from './client.mjs';

const BIN = join(TOOLS, 'pg/node_modules/@embedded-postgres/darwin-arm64/native/bin');
const LIB = join(TOOLS, 'pg/node_modules/@embedded-postgres/darwin-arm64/native/lib');
const pgCtl = (...a) => execFileSync(join(BIN, 'pg_ctl'), a, { env: { ...process.env, DYLD_LIBRARY_PATH: LIB }, stdio: 'pipe' });

const CHECK_SQL = `
  SELECT t.table_schema || '.' || t.table_name AS name,
         (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', t.table_schema, t.table_name), false, true, '')))[1]::text AS rows,
         (xpath('/row/h/text()', query_to_xml(format('SELECT md5(coalesce(string_agg(x::text, ''|'' ORDER BY x::text), '''')) AS h FROM %I.%I x', t.table_schema, t.table_name), false, true, '')))[1]::text AS hash
  FROM information_schema.tables t
  WHERE t.table_type = 'BASE TABLE' AND t.table_schema IN ('public', 'private', 'auth', 'storage')
  ORDER BY 1`;

function filesHash(dir) {
  const h = createHash('sha256');
  const walk = d => readdirSync(d).sort().forEach(f => { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else h.update(f).update(readFileSync(p)); });
  walk(dir);
  return h.digest('hex');
}

export async function runBackupRestore({ log = () => {} } = {}) {
  const s = suite('backup');
  const { check } = s;
  const backupDir = mkdtempSync(join(tmpdir(), 'kovo-backup-'));
  let stack, restored, restoredStarted = false;
  try {
    stack = await startStack({ log, schema: env => applyKovoSchema(env, { log }) });
    const api = client(stack);
    const owner = await newUser(api, 'copia@kovo.test');
    const org = (await api.rpc(owner.token, 'create_organization', { p_name: 'Clínica Copia', p_plan_code: 'professional' })).json;
    const p = (await api.insert(owner.token, 'patients', { org_id: org, patient_code: 'AUTO', first_name: 'Paciente', last_name: 'Copia' })).json[0];
    const docPath = `${org}/${p.id}/${randomUUID()}-informe.pdf`;
    const pdf = minimalPdf('copia');
    await api.upload(owner.token, docPath, pdf, 'application/pdf');
    await api.insert(owner.token, 'patient_documents', { org_id: org, patient_id: p.id, storage_path: docPath, document_type: 'informe_externo', file_name: 'informe.pdf', mime_type: 'application/pdf', size_bytes: pdf.length });
    await api.rpc(owner.token, 'save_clinical_note_draft_v2', { p_note_id: randomUUID(), p_org_id: org, p_patient_id: p.id, p_appointment_id: null, p_note_type: 'inicial', p_sections: { motivo: 'Motivo SINTÉTICO' } });

    const original = (await stack.env.admin.query(CHECK_SQL)).rows;
    const storageDir = join(stack.env.dir, 'storage-files');
    const originalFiles = filesHash(storageDir);
    check('Copia: hay datos en todos los esquemas (public, private, auth, storage)', ['public.patients', 'auth.users', 'storage.objects', 'private.org_counters']
      .every(n => Number(original.find(r => r.name === n)?.rows) > 0), JSON.stringify(original.filter(r => r.rows === '0').map(r => r.name)));

    // Consistent cold backup: checkpoint, clean shutdown, copy data + Storage files.
    const superPassword = stack.env.password;   // the restored cluster keeps its roles and passwords
    await stack.stopServices();                     // no more writes from Auth / Storage / API
    await stack.env.admin.query('CHECKPOINT');
    const dataDir = join(stack.env.dir, 'data');
    await stack.env.admin.end().catch(() => {});
    pgCtl('stop', '-D', dataDir, '-m', 'fast', '-w');
    cpSync(dataDir, join(backupDir, 'data'), { recursive: true });
    cpSync(storageDir, join(backupDir, 'storage-files'), { recursive: true });
    log(`copia en frío creada en ${backupDir}`);
    rmSync(stack.env.dir, { recursive: true, force: true });   // simulated loss of the original server
    stack = null;

    // Restore into a new location and port.
    const port = await freePort();
    restored = join(backupDir, 'data');
    chmodSync(restored, 0o700);   // PostgreSQL refuses a data directory readable by others
    try { pgCtl('start', '-D', restored, '-o', `-p ${port} -c listen_addresses=127.0.0.1`, '-w', '-l', join(backupDir, 'restore.log')); }
    catch (e) { throw new Error(`pg_ctl start: ${(() => { try { return readFileSync(join(backupDir, 'restore.log'), 'utf8').slice(-1500); } catch { return e.message; } })()}`); }
    restoredStarted = true;
    const su = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database: 'kovo', password: superPassword });
    await su.connect();
    const restoredRows = (await su.query(CHECK_SQL)).rows;
    const diff = original.filter(o => { const r = restoredRows.find(x => x.name === o.name); return !r || r.rows !== o.rows || r.hash !== o.hash; }).map(o => o.name);
    check(`Restauración: ${original.length} tablas idénticas (recuento y huella de cada fila)`, diff.length === 0 && restoredRows.length === original.length, diff.join(','));
    const login = (await su.query(`SELECT extensions.crypt($2, encrypted_password) = encrypted_password AS ok FROM auth.users WHERE email = $1`, [owner.email, owner.password])).rows[0]?.ok;
    check('Restauración: las credenciales restauradas siguen validando la contraseña', login === true, String(login));
    const fk = (await su.query(`SELECT count(*)::int AS n FROM public.patient_documents d JOIN public.patients p ON p.org_id = d.org_id AND p.id = d.patient_id JOIN storage.objects o ON o.name = d.storage_path`)).rows[0].n;
    check('Restauración: documento ↔ paciente ↔ objeto de Storage siguen enlazados', fk === 1, String(fk));
    check('Restauración: los ficheros de Storage restaurados son idénticos byte a byte', filesHash(join(backupDir, 'storage-files')) === originalFiles, '');
    await su.end();
    return s;
  } finally {
    if (restoredStarted) { try { pgCtl('stop', '-D', restored, '-m', 'fast', '-w'); } catch {} }
    await stack?.stop();
    rmSync(backupDir, { recursive: true, force: true });
  }
}
