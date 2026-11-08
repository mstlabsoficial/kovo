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

The recovered candidate baseline has been reordered in the recovery branch so every primary key, unique constraint and check constraint is created before any foreign key. The order of the table/column definitions and the business schema itself have not been changed.

### Next validation

The CI workflow is retriggered on this PR after the corrected recovery baseline is used as its base. The expected next result is to progress through:

1. Fresh local schema reconstruction.
2. Application of the backend proposal on top of the reconstructed schema.
3. Local Supabase TypeScript type generation.

A successful SQL application still does not replace the role/RLS/PostgREST acceptance tests in `proposed-migrations/ISOLATED_TEST_PLAN.md`.

No production database was accessed or changed during this run or the fix.
