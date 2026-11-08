# Recovered Supabase migration history

These eight SQL files were retrieved read-only from the live KOVO project's
`supabase_migrations.schema_migrations` table on 2026-11-08.

They preserve the exact SQL statements recorded by Supabase, including the
original applied version and migration name.

## Important: archival, not a clean-install migration chain

Do not move these files into `supabase/migrations/` or replay them yet.

The live database contains core tables and private-schema helpers that are not
fully created by these eight recorded migrations. In particular, the recorded
migration `002_private_patient_document_storage` references
`private.has_role`, while the recorded history does not create the complete
`private` schema, helper functions, counter table, base clinical/finance tables,
triggers, or all RLS policies.

The active Git branch also contains 006–008 migration files under
`supabase/migrations/` with timestamps 20261108001500, 20261108001600 and
20261108001700. The live migration history reports those logical migrations
as versions 20261108001145, 20261108001250 and 20261108001255 respectively.
Do not run `supabase db push` until this version mismatch and the missing
pre-history schema have been reconciled.

## Recovered history

| Applied version | Name |
|---|---|
| `20261107233134` | `001_organizations_memberships` |
| `20261107233451` | `002_private_patient_document_storage` |
| `20261107233907` | `003_demo_environment` |
| `20261108000732` | `restrict_employee_access_and_lock_issued_invoices` |
| `20261108000745` | `fix_invoice_line_move_guard` |
| `20261108001145` | `006_legacy_mapping_and_clinical_draft_workflow` |
| `20261108001250` | `007_public_guarded_workflow_rpcs` |
| `20261108001255` | `008_atomic_invoice_draft_rpc` |

## Next step

Build a reviewed, reproducible baseline for the schema that predates or sits
outside this history, then reconcile the active migration files against the
live history. Verify with a fresh disposable local database before any
production migration workflow.

No production schema, data, users, storage objects, or migrations were changed
during this recovery.
