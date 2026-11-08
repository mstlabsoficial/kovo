# KOVO Supabase recovery — schema snapshot

Captured read-only from Supabase project `otlwmrbioawjvgrrznoq` on 2026-11-08.

## What was recovered

- 8 migration records and their original SQL statements, archived under `../recovered-migrations/`.
- Catalog snapshot of 16 tables: 15 in `public` and `private.org_counters`.
- Exact column types, nullability, defaults, identity properties, constraints, indexes, RLS flags.
- 25 RLS policies: 21 public-table policies and 4 policies on `storage.objects`.
- 9 non-internal triggers.
- Function definitions, signatures, security-definer flags, configuration and ACL metadata.
- Table grants, installed extensions and the KOVO storage bucket configuration.

Files:
- `catalog-tables.json`: table/column/constraint/index snapshot.
- `catalog-security.json`: policies, triggers, grants, functions, extensions and KOVO bucket settings.

## Important migration finding

The remote history contains these applied versions:

| Remote version | Migration name |
|---|---|
| 20261107233134 | 001_organizations_memberships |
| 20261107233451 | 002_private_patient_document_storage |
| 20261107233907 | 003_demo_environment |
| 20261108000732 | restrict_employee_access_and_lock_issued_invoices |
| 20261108000745 | fix_invoice_line_move_guard |
| 20261108001145 | 006_legacy_mapping_and_clinical_draft_workflow |
| 20261108001250 | 007_public_guarded_workflow_rpcs |
| 20261108001255 | 008_atomic_invoice_draft_rpc |

The current Git branch `migracion-vite` has only three files in `supabase/migrations/`, named with versions `20261108001500`, `20261108001600`, and `20261108001700`. Their SQL matches the corresponding remote 006–008 statements after removing comments and insignificant whitespace (including 008); their version identifiers do not match the remote history.

Do not run `supabase db push` until this is reconciled. Supabase tracks migration versions, not just descriptive filenames, so those filenames could be interpreted as three new migrations.

## Schema drift / missing baseline

The eight migration records do not create the whole live schema.

Examples:
- The live database has all 15 public business tables, not only `organizations` and `memberships`.
- `002_private_patient_document_storage` calls `private.has_role`, but the recorded history does not create the private helper function first.
- The live database includes `private.org_counters` and private functions for patient numbering, invoice numbering/issuance, clinical-note signing/rectification, audit logging and immutable-record guards. Their creation is not represented by the eight recorded migration entries.
- The live database has additional base tables, constraints, indexes, RLS policies and triggers not fully accounted for by the recorded history.

Therefore the next task is to reconstruct and review the pre-history schema baseline, then verify a clean disposable database can replay the resulting chain. The JSON files are a catalog snapshot, not a ready-to-run migration.

## Current security shape (live catalog)

- RLS is enabled on all 15 public tables; it is not forced.
- `private.org_counters` has RLS disabled and no authenticated/anon table grants; only the postgres role has table privileges in the inspected grants.
- RLS for business data is tenant-scoped through `private.has_role` or `private.my_orgs`.
- Storage bucket `kovo-patient-documents` is private, has a 20 MiB file limit, and allows PDF/JPEG/PNG.
- The four KOVO Storage policies restrict access to the psychologist role and require the first folder segment to be an organization UUID.
- Do not blindly remove SECURITY DEFINER warnings: review each function's body, grants, search_path and authorization guard before changing it.

## Safety

This recovery branch contains schema metadata and SQL history only. It does not contain patient records, credentials, API keys, auth users, or storage file contents. No production DDL, migrations, auth users, or data were changed.


## Validation assets

- `BASELINE_CANDIDATE_NOT_TESTED.sql`: full one-file candidate assembled from the live catalog. It is intentionally not under `supabase/migrations/`.
- `LOCAL_VALIDATION.md`: procedure for validating the candidate on a disposable local Supabase stack.
- `STATIC_VALIDATION_REPORT.md`: token-aware structural scan results. This is not a PostgreSQL execution test.
- `AUTHORIZATION_MODEL.md`: live role/policy matrix and security review checklist.

The candidate's static scan found 284 statements, balanced SQL quoting/dollar-quoting, 16 table declarations, 79 constraints, 30 additional indexes, 17 function definitions, 25 policies, 9 triggers and RLS enabled on 15 public tables. All trigger-function references and public policy table references resolve against the captured catalog. A real clean reset remains pending because Docker and Supabase CLI are not available in the current execution environment.
