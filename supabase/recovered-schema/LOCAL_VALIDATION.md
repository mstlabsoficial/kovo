# Local validation instructions for the baseline candidate

## Purpose

Validate `BASELINE_CANDIDATE_NOT_TESTED.sql` against a fresh, disposable Supabase local stack. This is the final live schema snapshot, not a replay of historical migrations.

## Mandatory safety rules

- Never use the production project ref `otlwmrbioawjvgrrznoq` for these steps.
- Do not run `supabase db push`, `supabase migration repair`, `supabase link`, or any remote migration command.
- Do not copy this candidate into the main working tree's active `supabase/migrations/` directory.
- Do not run it against the hosted project, including through the Supabase SQL Editor.
- Keep the archived historical 001–008 migrations outside the local candidate test. The baseline already contains the final catalog state.
- No production data is needed or should be copied.

## Test procedure

Use an isolated temporary directory or disposable worktree.

1. Ensure Docker Desktop is installed and running, then install/check the Supabase CLI.
2. Initialize a temporary local Supabase workspace with `supabase init`.
3. Copy only `BASELINE_CANDIDATE_NOT_TESTED.sql` into that workspace's `supabase/migrations/` directory under a timestamped filename, for example `20261109000000_kovo_catalog_baseline.sql`.
4. Start local Supabase with `supabase start`.
5. Apply the single baseline to the fresh local database with `supabase db reset`.
6. Confirm the migration completes without SQL errors.
7. Capture local catalog output for tables, columns, constraints, indexes, RLS policies, functions, grants, triggers, and Storage bucket configuration.
8. Compare it to `catalog-tables.json` and `catalog-security.json`. Investigate each difference; account for Supabase-managed defaults/roles and environment-specific objects rather than blindly copying them.
9. Check the local Storage bucket exists and is private with the expected MIME types and 20 MiB limit.
10. Run generated TypeScript type generation against the local project and compare business table/function definitions.

## Expected schema counts

The captured hosted catalog snapshot currently contains:
- 15 public tables and 1 private table (`private.org_counters`)
- 79 table constraints
- 30 non-constraint indexes
- 25 RLS policies (21 public business-table policies and 4 KOVO Storage policies)
- 17 functions across `public` and `private`
- 9 non-internal triggers
- 1 KOVO private Storage bucket

Counts may vary for Supabase-managed objects or if the project changes after the capture time.

## What passing means

Passing means the candidate can reconstruct the captured business schema on a clean local Supabase stack and the catalog differences are understood. It does not authorize a production deployment.

A separate production rollout plan is still required because the hosted database already records eight migrations with version IDs that differ from the three migration filenames currently in Git, and because the full current schema historically includes unrecorded/manual setup.
