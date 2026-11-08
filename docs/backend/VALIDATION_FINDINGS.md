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
