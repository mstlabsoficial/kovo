#!/usr/bin/env bash
set -Eeuo pipefail

# Reconstruct the recovered schema and apply the proposed backend changes in a
# disposable local Supabase stack. This script never links to a hosted project.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASELINE="${ROOT_DIR}/supabase/recovered-schema/BASELINE_CANDIDATE_NOT_TESTED.sql"
PROPOSAL="${ROOT_DIR}/docs/backend/proposed-migrations/PROPOSAL_ONLY_20261108.sql"

for file in "$BASELINE" "$PROPOSAL"; do
  if [[ ! -s "$file" ]]; then
    echo "Required SQL file missing or empty: $file" >&2
    exit 2
  fi
done

# Fail closed if a hosted Supabase credential or URL was injected into this
# process. The CI workflow intentionally provides none.
for variable in SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD SUPABASE_PROJECT_ID SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY; do
  if [[ -n "${!variable:-}" ]]; then
    echo "Refusing to run with hosted Supabase environment variable: $variable" >&2
    exit 2
  fi
done

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/kovo-supabase-proposal.XXXXXX")"
cleanup() {
  if [[ -f "$WORK_DIR/supabase/config.toml" ]]; then
    (cd "$WORK_DIR" && supabase stop --no-backup >/dev/null 2>&1) || true
  fi
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

cd "$WORK_DIR"
supabase init
mkdir -p supabase/migrations
cp "$BASELINE" supabase/migrations/20261108000000_kovo_recovered_schema.sql
cp "$PROPOSAL" supabase/migrations/20261108000100_kovo_backend_gap_proposal.sql

echo "Starting isolated local Supabase stack..."
supabase start -x realtime,imgproxy,mailpit,studio,edge-runtime,logflare,vector,supavisor

echo "Applying recovered baseline and backend proposal to LOCAL Postgres only..."
supabase db reset --local

echo "Checking generated TypeScript schema types..."
supabase gen types typescript --local >/dev/null

echo "PASS: baseline + proposal applied to a disposable local Supabase database."
