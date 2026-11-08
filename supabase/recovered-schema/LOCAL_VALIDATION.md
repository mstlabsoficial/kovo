# Local validation instructions for the baseline candidate

## Purpose

Validate `BASELINE_CANDIDATE_NOT_TESTED.sql` against a fresh, disposable Supabase local stack, then apply the backend-gap proposal on top. The baseline is a catalog-derived final schema snapshot, not a replay of historical migrations.

## Mandatory safety rules

- Never use the production project ref `otlwmrbioawjvgrrznoq` for these steps.
- Do not run `supabase db push`, `supabase migration repair`, or `supabase link`.
- Do not copy either file into your normal working tree's active `supabase/migrations/` directory.
- Do not run either file against the hosted project, including through the Supabase SQL Editor.
- Keep the archived historical 001–008 migrations out of this candidate test. The baseline already contains the final captured catalog state.
- No production data is needed or should be copied.

## Automated disposable validation

The repository now includes `scripts/validate-backend-proposal.sh` and `.github/workflows/validate-backend-proposal.yml`.

The script:
1. Creates a fresh temporary directory.
2. Runs `supabase init` there.
3. Copies the recovered baseline and proposal into that temporary workspace's migrations directory.
4. Starts a local stack with optional services excluded.
5. runs `supabase db reset --local`.
6. Generates TypeScript database types against the local database.

It fails closed when hosted Supabase credentials or URLs are present in its environment. The GitHub Actions workflow supplies no Supabase secrets and only uses a GitHub-hosted ephemeral runner. It does not link to or contact the production project.

Run manually from the repository root:

```bash
bash scripts/validate-backend-proposal.sh
```

A successful run proves the SQL can be applied to the reconstructed local schema and that the local Supabase type generator can introspect it. It does not prove that application-level authorization, data semantics, legal invoice requirements or rollout safety are complete.

## Expected captured schema counts

The current hosted catalog snapshot contains:
- 15 public tables and 1 private table (`private.org_counters`)
- 79 table constraints
- 30 non-constraint indexes
- 25 RLS policies (21 public business-table policies and 4 KOVO Storage policies)
- 17 functions across `public` and `private`
- 9 non-internal triggers
- 1 KOVO private Storage bucket

Counts may vary for Supabase-managed objects or if the project changes after capture.

## Manual follow-up after CI passes

- Capture local catalog output for tables, columns, constraints, indexes, RLS policies, functions, grants, triggers and Storage bucket configuration.
- Compare it with `catalog-tables.json` and `catalog-security.json`; investigate differences.
- Create test users and memberships for psychologist, reception, finance and cross-tenant actors.
- Run positive and negative PostgREST/RLS tests for every new table and RPC.
- Test invoice immutability, consent idempotency, concurrent appointment billing and transaction rollback.
- Reconcile remote migration history (hosted history 001–008 vs local filenames) before any deployment.

## What passing means

Passing means the recovered baseline can be reconstructed and the proposal applies on top of it in a clean local Supabase stack. It is not a production deployment approval, legal/tax compliance certification, or proof of application-level authorization.
