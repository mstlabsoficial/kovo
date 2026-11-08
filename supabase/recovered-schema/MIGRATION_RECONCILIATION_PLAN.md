# Migration reconciliation plan

## Confirmed drift from the live catalog

1. **The recorded migration history is 8 versions**, recovered verbatim under `recovered-migrations/`.
2. **The repository's active folder contains only 006–008**, with version prefixes 20261108001500, 20261108001600 and 20261108001700.
3. The SQL bodies of those three files match the corresponding live statements after comments/formatting whitespace are normalized, but the version numbers differ:
   - remote 006: `20261108001145`; repository: `20261108001500`
   - remote 007: `20261108001250`; repository: `20261108001600`
   - remote 008: `20261108001255`; repository: `20261108001700`
   Do not push these as new versions: the remote database already recorded the logical migrations under different version strings.
4. The live schema has 15 public tables plus `private.org_counters`; the 8 recorded migrations do not create that full set of tables and private helper objects.
5. The live `private` functions and base schema are dependencies of the recovered migration chain. For example, migration 002 references `private.has_role`, which is not created by migration 001.
6. **Migration 001 does not describe the current authorization helper layout.** It creates `public.my_orgs()` and `public.has_role(uuid,text[])`, and its organization/membership policies call the public helpers. The live catalog instead has private `private.my_orgs()` / `private.has_role(uuid,text[])`, and the live policies call the private helpers. The live public schema contains the six workflow RPCs, not those two legacy public helpers. This means some unrecorded later change or manual cleanup happened after migration 001.

## Proposed clean reconstruction sequence

1. Treat `LIVE_SCHEMA_CATALOG_EXPORT_NOT_MIGRATION.sql` as a reference snapshot only. It has not been tested on a clean local Supabase instance and is deliberately outside `supabase/migrations/`.
2. Reconstruct a reviewed **pre-history baseline** that creates the missing core tables, `private` schema, counters, helper functions, indexes, base RLS, audit/immutability triggers and storage prerequisites needed by migration 002.
3. Restore the exact historical migrations with their original version strings in a clean-install migration chain, including missing logical migrations 004 and 005.
4. Decide how fresh installs should handle the legacy public helper functions/policies introduced by 001. The likely reconciliation is a later migration that removes the obsolete public helper functions and recreates the organization/membership policies against the private helpers, matching the live catalog. Review function dependencies before dropping anything.
5. Reconcile the existing 006–008 filenames/version strings with the live history. Do not retain both the old and corrected versions as executable migration files.
6. Run the full chain against a **disposable local Supabase stack** and compare its catalog with the captured live snapshot. Docker/local Supabase is required for a reliable clean-reset test.
7. Only after the clean reset is verified, prepare a production migration-history reconciliation plan. Do not use `migration repair`, `db push`, or apply DDL to production as part of this recovery.

## Verification boundaries

- All catalog reads were read-only.
- No patient records, auth users, membership records, or storage object contents were exported.
- No SQL in this branch has been applied to any database.
- No production DDL, migration history, or data was changed.
