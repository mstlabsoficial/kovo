# Validation findings — backend proposal

## Run 1 — 2026-11-08

**Result:** failed while applying the recovered baseline, before the proposed backend migration ran.

The disposable Supabase stack started and the CLI reached the first recovered migration. PostgreSQL rejected the first foreign key on `private.org_counters.org_id`:

```
ERROR: there is no unique constraint matching given keys for referenced table "organizations"
At statement: 20
ALTER TABLE private.org_counters
  ADD CONSTRAINT org_counters_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES organizations(id)
```

### Root cause

The catalog-export baseline added constraints in alphabetical/table order. It tried to create a foreign key to `organizations(id)` before the `organizations_pkey` had been created. PostgreSQL requires the referenced primary/unique key to exist when the foreign key is created.

### Fix

The recovered candidate baseline was reordered so every primary key, unique constraint and check constraint is created before any foreign key. The table/column definitions and business schema were not changed.

## Run 2 — 2026-11-08, GitHub Actions run #12

**Result: passed.**

- Workflow run: https://github.com/mstlabsoficial/kovo/actions/runs/42533658189
- PR: https://github.com/mstlabsoficial/kovo/pull/1
- Head commit: `61f4b26875dfe54708bcb2593894bbe173a029c8`
- Reconstructed baseline: `20261108000000_kovo_recovered_schema.sql`
- Proposal applied second: `20261108000100_kovo_backend_gap_proposal.sql`

The job started a fresh disposable Supabase local stack, ran `supabase db reset`, applied both SQL files successfully, and generated TypeScript database types from the local database. The job completed successfully.

The log also contains two non-fatal CLI notices: no `supabase/seed.sql` matched (no seed data is required for this schema-only test), and the generated TypeScript output was reported as unformatted. Neither notice caused the job to fail.

### What this run proves

The recovered baseline and the proposed SQL are syntactically/application-order compatible with a fresh local Supabase/PostgreSQL stack, and Supabase's type generator can introspect the resulting schema.

### What this run does not prove

The workflow did **not** execute the authenticated PostgREST/RLS role matrix or the acceptance scenarios in `proposed-migrations/ISOLATED_TEST_PLAN.md`. It does not prove cross-tenant denial, role-specific authorization, application integration, concurrency behavior under real actors, fiscal/legal correctness, or production migration safety.

## Remaining validation gates

1. Run local authenticated PostgREST/RLS tests for psychologist, reception, gestoría, no-membership and cross-organization users.
2. Test direct REST writes that bypass the UI, especially invoice status escalation, appointment-to-invoice-line consistency, consent writes and tenant boundaries.
3. Test concurrent appointment booking, duplicate billing and idempotent consent retries.
4. Compare the reconstructed local catalog with the captured catalog and investigate every difference.
5. Resolve clinic decisions for payer identity, invoice series/corrections, expense amount semantics, consent evidence and any appointment/resource scheduling rules.
6. Reconcile hosted migration history 001–008 with active local migration filenames before preparing any deployment migration.

No production database, data, policies, functions, users or Storage configuration was changed during these validations.
