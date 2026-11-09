# Validation findings — backend proposal

## Run 1 — 2026-11-08

**Result:** failed while applying the recovered baseline, before the proposed backend migration ran.

PostgreSQL rejected the first foreign key on `private.org_counters.org_id` because the referenced `organizations(id)` primary key had not yet been created.

### Fix

The recovered candidate baseline was reordered so all primary keys, unique constraints and checks are created before foreign keys. No table/column definitions or business-schema semantics were changed.

## Run 2 — 2026-11-08, GitHub Actions run #12

**Result: passed.**

- [Workflow run #12](https://github.com/mstlabsoficial/kovo/actions/runs/42533658189)
- [PR #1](https://github.com/mstlabsoficial/kovo/pull/1)
- Head commit: `61f4b26875dfe54708bcb2593894bbe173a029c8`

A fresh disposable local Supabase stack applied the recovered baseline and proposal SQL, then generated TypeScript database types. This established that both SQL files applied to the reconstructed schema.

## Run 3 — 2026-11-08, GitHub Actions run #16

**Result: passed — 38/38 pgTAP assertions.**

- [Workflow run #16](https://github.com/mstlabsoficial/kovo/actions/runs/42535033875)
- PR head commit: `012402f2d8820c2867e86127323671c699482f18`
- Test file: `supabase/tests/database/kovo_backend_security_test.sql`
- Test runner: `supabase test db --local`

The workflow rebuilt a disposable Supabase local stack, applied the recovered baseline and proposal, generated local TypeScript types, then ran pgTAP. The log reports:

```
kovo_backend_security_test.sql .. ok
All tests successful.
Files=1, Tests=38
Result: PASS
```

The assertions cover:
- Psychologist, reception and gestoría access boundaries.
- Isolation between two organizations.
- Reception's limited consent-status projection and denial of private clinical/consent records.
- Consent RPC role enforcement and idempotent retries.
- Direct invoice status escalation rejection.
- Database rejection of overlapping active appointments, while allowing back-to-back visits.
- Appointment-to-invoice-line patient matching and protection against changing billed appointment/invoice relationships.

The tests use PostgreSQL's `authenticated` role and `request.jwt.claim.sub` context through pgTAP. This exercises database grants, RLS and triggers under simulated authenticated actors, but it is **not** a full HTTP/PostgREST client integration test.

## Remaining validation gates

1. Add HTTP/PostgREST integration tests with real local Auth-issued sessions, including no-membership, inactive-membership, missing/expired JWT and cross-tenant writes.
2. Test concurrency races for appointment booking, duplicate billing and consent retries with simultaneous transactions/requests.
3. Exercise successful invoice issuance end-to-end through `public.emit_invoice`, including invoice numbering and issuer/recipient snapshots.
4. Expand coverage to expense tax rows, consent evidence documents, signed-note immutability, storage paths and transaction rollback.
5. Compare the reconstructed local catalog with the captured catalog and investigate every difference.
6. Confirm payer identity, invoice series/corrections, expense amount semantics, consent evidence and room/resource scheduling with the clinic and its gestor/a.
7. Reconcile hosted migration history 001–008 with active local migration filenames before preparing any deployment migration.

No production database, data, policies, functions, users or Storage configuration was changed during these validations. Passing these local tests does not authorize a production deployment.


## Run 4 — 2026-11-09, GitHub Actions run #30

**Result: passed — 43/43 pgTAP assertions and 113/113 HTTP/Auth/PostgREST assertions.**

- [Workflow run #30](https://github.com/mstlabsoficial/kovo/actions/runs/42723026089)
- Head commit tested: `7c3281d3127186032ecefbf5c33ecb2652c5eb3a`
- Test files:
  - `supabase/tests/database/kovo_backend_security_test.sql`
  - `scripts/test-backend-postgrest.mjs`

The workflow created a fresh, disposable local Supabase project, applied the recovered baseline and proposal SQL, generated database types, ran pgTAP, then created six synthetic users through local Supabase Auth and obtained password-grant sessions. It made real HTTP requests to local Auth and PostgREST using those Auth-issued JWTs.

The final log reports:

```
Files=1, Tests=43
Result: PASS
PASS: 113 HTTP/Auth/PostgREST integration assertions passed against local Supabase.
PASS: schema reconstruction, proposal application, type generation, pgTAP and Auth/PostgREST integration tests.
```

### What the 113 HTTP assertions cover

- Auth user provisioning and password-session issuance.
- Psychologist, reception and gestoría permissions across two organizations.
- Inactive membership, a signed-in user with no membership, anonymous requests and malformed/expired JWT rejection.
- Patient creation/update by reception and denial of finance, cross-tenant, inactive and no-membership writes.
- Clinical draft create/edit with a stable client-generated UUID; a retry returns the same note ID and does not duplicate the draft.
- Clinical draft rejection when the supplied appointment belongs to another patient or organization; role restrictions and signed-note immutability.
- Consent RPC, idempotent retry, no duplicate event and role restrictions.
- Invoice draft and issue through authorized RPC, invoice number/snapshot persistence, direct REST status-escalation denial and issued-invoice immutability.
- Appointment/invoice-line patient matching, protection of billed appointment and invoice patient.
- Concurrent appointment booking and concurrent invoice-line allocation: exactly one request wins each contested slot/session.

The 43 pgTAP assertions independently exercise database grants, RLS and trigger behavior under synthetic authenticated actor context.

### Interpretation and limitations

This is stronger than static SQL review and database-role-only tests: it exercises local Auth-issued sessions and actual HTTP requests through PostgREST. It still does **not** prove production migration safety, legal/tax correctness, frontend integration with Claude's local T2C branch, Storage upload/download flows, every expense-tax scenario, transaction rollback across all workflows, or the behavior of a hosted production deployment. Concurrency races are covered for appointment booking and invoice-line allocation; consent retry is covered sequentially, not as a simultaneous race.

## Remaining validation gates

1. Exercise the UI end-to-end with Claude's T2C branch integrated, including page reload and recovery after a lost response.
2. Add HTTP tests for private Storage and evidence-document authorization, plus the expense tax-line CRUD/tenant matrix.
3. Add rollback tests for multi-row RPC failure and concurrent consent idempotency if that workflow is used by the clinic.
4. Compare reconstructed local catalog output against the captured catalog and investigate every difference.
5. Confirm payer identity, invoice series/corrections, expense amount semantics, consent evidence and room/resource scheduling with the clinic and its gestor/a.
6. Reconcile hosted migration history 001–008 with active local migration filenames before preparing any deployment migration.

No production database, data, policies, functions, users or Storage configuration was changed. Passing local CI tests does not authorize a production deployment.
