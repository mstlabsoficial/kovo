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

The repository includes `scripts/validate-backend-proposal.sh` and `.github/workflows/validate-backend-proposal.yml`.

The script:
1. Creates a fresh temporary directory.
2. Runs `supabase init` there.
3. Copies the recovered baseline and proposal into that temporary workspace's migrations directory.
4. Starts a local stack with optional services excluded.
5. Runs `supabase db reset`.
6. Generates TypeScript database types against the local database.

It refuses to run if any of the explicitly checked hosted Supabase credential/URL environment variables are present. The GitHub Actions workflow supplies no Supabase secrets and runs on an ephemeral GitHub-hosted runner. The workflow does not link to the production project.

Run manually from the repository root:

```bash
bash scripts/validate-backend-proposal.sh
```

### Latest result

GitHub Actions run #12 passed on 2026-11-08:

https://github.com/mstlabsoficial/kovo/actions/runs/42533658189

The log confirms the order:
- `20261108000000_kovo_recovered_schema.sql` applied.
- `20261108000100_kovo_backend_gap_proposal.sql` applied.
- Local TypeScript database types generated.

The CLI printed a non-fatal notice that the generated TypeScript output was unformatted. It also noted that no `supabase/seed.sql` matched; the test intentionally uses no production data or seed data.

A successful run proves the SQL can be applied to the reconstructed local schema and that the local Supabase type generator can introspect it. It does **not** prove application-level authorization or that the full role/RLS/PostgREST test plan passes.

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

## Remaining manual follow-up

- Capture local catalog output for tables, columns, constraints, indexes, RLS policies, functions, grants, triggers and Storage bucket configuration.
- Compare it with `catalog-tables.json` and `catalog-security.json`; investigate differences.
- Create test users and memberships for psychologist, reception, finance and cross-tenant actors.
- Run positive and negative PostgREST/RLS tests for every new table and RPC.
- Test invoice immutability, consent idempotency, concurrent appointment billing and transaction rollback.
- Reconcile remote migration history (hosted history 001–008 vs local filenames) before any deployment.

## What passing means

Passing means the recovered baseline can be reconstructed and the proposal applies on top of it in a clean local Supabase stack. It is not a production deployment approval, legal/tax compliance certification, or proof of application-level authorization.
