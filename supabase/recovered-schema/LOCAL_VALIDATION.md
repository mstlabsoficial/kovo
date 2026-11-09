# Local validation instructions for the baseline candidate

## Purpose

Validate `BASELINE_CANDIDATE_NOT_TESTED.sql` against a fresh, disposable Supabase local stack, then apply the backend-gap proposal on top. The baseline is a catalog-derived final schema snapshot, not a replay of historical migrations.

## Mandatory safety rules

- Never use the production project ref `otlwmrbioawjvgrrznoq` for these steps.
- Do not run `supabase db push`, `supabase migration repair`, or `supabase link`.
- Do not copy either SQL file into your normal working tree's active `supabase/migrations/` directory.
- Do not run either file against the hosted project, including through the Supabase SQL Editor.
- Keep the archived historical 001–008 migrations out of this candidate test. The baseline already contains the final captured catalog state.
- No production data is needed or should be copied.

## Automated disposable validation

The repository includes `scripts/validate-backend-proposal.sh` and `.github/workflows/validate-backend-proposal.yml`.

The script:
1. Creates a fresh temporary directory.
2. Runs `supabase init` there.
3. Copies the recovered baseline and proposal into that temporary workspace's migrations directory.
4. Copies the pgTAP and HTTP integration test files into the temporary workspace.
5. Starts a local stack with optional services excluded.
6. Runs `supabase db reset`.
7. Generates TypeScript database types against the local database.
8. Runs `supabase test db --local` using pgTAP.
9. Exports only the disposable local API keys/URL and runs Auth-issued session and PostgREST HTTP tests. The Node harness refuses any non-local URL.

It refuses to run if any of the explicitly checked hosted Supabase credential/URL environment variables are present. The GitHub Actions workflow supplies no Supabase secrets and runs on an ephemeral GitHub-hosted runner. The workflow does not link to the production project.

Run manually from the repository root:

```bash
bash scripts/validate-backend-proposal.sh
```

### Latest result

[GitHub Actions run #30 passed on 2026-11-09](https://github.com/mstlabsoficial/kovo/actions/runs/42723026089).

The log confirms:
- Recovered baseline and proposal migrations applied in a fresh disposable local stack.
- Local TypeScript database types generated.
- pgTAP suite passed: **43 assertions**.
- Auth/PostgREST suite passed: **113 HTTP assertions**, using six users created by local Supabase Auth and their issued sessions.
- Both concurrent booking and concurrent invoice-allocation tests produced exactly one winner.

The HTTP suite covers tenant and role isolation, inactive/no-membership users, anonymous and invalid JWT requests, patient writes, clinical draft create/edit/retry with stable client UUID, appointment/patient mismatch denial, signed-note immutability, consent RPC/idempotency, authorized invoice issuance and snapshots, direct REST escalation denial, and scheduling/billing integrity checks.

The pgTAP tests use Postgres role/JWT subject context; the HTTP suite goes further by making real requests through local Auth and PostgREST with Auth-issued access tokens. Neither test suite accesses the hosted production project.

## What the automated suites cover (43 pgTAP + 113 HTTP assertions)

- Role access for psychologist, reception and gestoría.
- Tenant isolation across two synthetic organizations.
- Clinical-note and consent-event privacy; reception's limited consent-status projection.
- Psychologist-only consent RPC and retry idempotency.
- Blocking direct invoice insertion/update that attempts to issue an invoice.
- Database-level appointment overlap prevention and back-to-back sessions, including concurrent booking.
- Same-patient appointment billing links, duplicate-billing race prevention and protection against changing a billed appointment or invoice patient.
- Auth-issued PostgREST sessions, no-membership and inactive-membership denial, patient create/update, clinical draft create/edit/retry, note immutability, consent RPC/idempotency and invoice issue/snapshot flow.

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

- Exercise the integrated UI with Claude's T2C branch, including reload and lost-response recovery.
- Expand tests for expense tax breakdown, consent evidence and private Storage upload/download authorization.
- Add multi-row RPC rollback tests and a simultaneous consent idempotency race.
- Capture local catalog output for tables, columns, constraints, indexes, RLS policies, functions, grants, triggers and Storage bucket configuration.
- Compare it with `catalog-tables.json` and `catalog-security.json`; investigate differences.
- Reconcile hosted migration history (001–008) with local filenames before any deployment.

## What passing means

Passing means the recovered baseline can be reconstructed, the proposal applies cleanly, and the selected database-role/tenant/write-boundary tests pass in a fresh local Supabase stack. It is not a production deployment approval, legal/tax compliance certification, or proof of end-to-end application authorization.
