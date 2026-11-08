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
4. Copies `supabase/tests/database/kovo_backend_security_test.sql` into the temporary Supabase tests directory.
5. Starts a local stack with optional services excluded.
6. Runs `supabase db reset`.
7. Generates TypeScript database types against the local database.
8. Runs `supabase test db --local` using pgTAP.

It refuses to run if any of the explicitly checked hosted Supabase credential/URL environment variables are present. The GitHub Actions workflow supplies no Supabase secrets and runs on an ephemeral GitHub-hosted runner. The workflow does not link to the production project.

Run manually from the repository root:

```bash
bash scripts/validate-backend-proposal.sh
```

### Latest result

[GitHub Actions run #16 passed on 2026-11-08](https://github.com/mstlabsoficial/kovo/actions/runs/42535033875).

The log confirms:
- Recovered baseline migration applied.
- Proposed backend SQL applied.
- Local TypeScript database types generated.
- pgTAP security suite passed: **38 tests, 1 file, Result: PASS**.

The tests use the Postgres `authenticated` role with simulated JWT subject claims. They verify database grants, RLS and trigger behavior for synthetic actors; they do not yet make HTTP requests through PostgREST using Auth-issued sessions. They also do not test concurrent requests/races.

Non-fatal CLI notices reported no `supabase/seed.sql` file and unformatted generated TypeScript output. They did not affect the result.

## What the 38 automated assertions cover

- Role access for psychologist, reception and gestoría.
- Tenant isolation across two synthetic organizations.
- Clinical-note and consent-event privacy; reception's limited consent-status projection.
- Psychologist-only consent RPC and retry idempotency.
- Blocking direct invoice insertion/update that attempts to issue an invoice.
- Database-level appointment overlap prevention and back-to-back sessions.
- Same-patient appointment billing links and protection against changing a billed appointment or invoice patient.

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

- Add authenticated PostgREST/HTTP tests using local Auth-issued sessions; include users with no membership and inactive membership.
- Test simultaneous booking/billing/consent requests and verify transaction rollback.
- Test successful invoice issuance, invoice numbering and fiscal snapshots through the real RPC wrapper.
- Expand tests for expense tax breakdown, consent evidence, Storage access and signed-note immutability.
- Capture local catalog output for tables, columns, constraints, indexes, RLS policies, functions, grants, triggers and Storage bucket configuration.
- Compare it with `catalog-tables.json` and `catalog-security.json`; investigate differences.
- Reconcile hosted migration history (001–008) with local filenames before any deployment.

## What passing means

Passing means the recovered baseline can be reconstructed, the proposal applies cleanly, and the selected database-role/tenant/write-boundary tests pass in a fresh local Supabase stack. It is not a production deployment approval, legal/tax compliance certification, or proof of end-to-end application authorization.
