// KOVO — the consolidated schema chain for NEW environments (local, CI, a future staging).
//
//   1. recovered baseline        origin/chore/recover-supabase-migrations (read-only branch)
//   2. backend proposal 20261108 origin/docs/backend-gap-design          (read-only branch)
//   3. clinical notes v2         clinical-db/proposals/
//   4. this chain                db/migrations/*.sql (in file-name order)
//
// The first two are read with `git show` so the protected branches stay the single source and are
// never copied or modified. supabase/migrations (the production-facing history 006–008) is NOT
// touched: reconciling it with the hosted project is a separate, approved step (db/README.md).
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { applySql, fromRef, local, ROOT } from '../clinical-db/local/env.mjs';

export const SOURCES = {
  baseline: ['origin/chore/recover-supabase-migrations', 'supabase/recovered-schema/BASELINE_CANDIDATE_NOT_TESTED.sql'],
  backend: ['origin/docs/backend-gap-design', 'docs/backend/proposed-migrations/PROPOSAL_ONLY_20261108.sql'],
  clinical: 'clinical-db/proposals/20261110_clinical_notes_v2.PROPOSAL.sql'
};

export const migrations = () => readdirSync(join(ROOT, 'db/migrations')).filter(f => /^\d{14}_.+\.sql$/.test(f)).sort();

// Up to (and including) `until`: 'baseline' | 'backend' | 'clinical' | a migration file name | undefined (all).
export async function applyKovoSchema(env, { log = () => {}, until } = {}) {
  await applySql(env.admin, 'CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions; CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions; CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;', 'extensiones');
  await applySql(env.admin, fromRef(...SOURCES.baseline), 'baseline recuperado');
  log('baseline recuperado aplicado');
  if (until === 'baseline') return;
  await applySql(env.admin, fromRef(...SOURCES.backend), 'propuesta backend 20261108');
  log('propuesta backend aplicada');
  if (until === 'backend') return;
  await applySql(env.admin, local(SOURCES.clinical), 'propuesta clínica v2');
  log('propuesta clínica v2 aplicada');
  if (until === 'clinical') return;
  await applyMigrations(env, { log, until });
}

export async function applyMigrations(env, { log = () => {}, until, from } = {}) {
  for (const f of migrations()) {
    if (from && f < from) continue;
    await applySql(env.admin, local(`db/migrations/${f}`), f);
    log(`migración ${f}`);
    if (until === f) return;
  }
}
