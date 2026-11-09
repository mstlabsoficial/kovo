# KOVO backend — implementation blueprint (proposal)

This supplements `BACKEND_GAPS_AND_NEXT_MIGRATIONS.md` with a concrete additive SQL draft and an isolated test plan. It is intentionally outside `supabase/migrations/`.

## Decisions encoded in this draft

1. **Appointment billing:** one completed appointment maps to at most one invoice line. An invoice can contain multiple session lines. This is a deliberate MVP assumption, not a universal billing model. Packages or split billing require a junction/allocation model instead.
2. **Invoice identity:** issuer and recipient fiscal data are stored in separate tenant-scoped billing profiles. At issuance the private RPC copies both into JSONB snapshots on the invoice in the same transaction as invoice number/status. Later profile edits must not rewrite historical invoices.
3. **Expenses:** a child table supports one or more tax-rate breakdowns per expense. Existing `expenses.amount_cents` is preserved exactly because its gross/net meaning is not established by the schema.
4. **Consent:** a private-to-clinical append-only event table holds evidence linkage and history. A separate, minimal projection exposes only consent type, version, status and updated timestamp to reception. Reception never gets access to patient documents or the event/evidence table.
5. **Authorization:** all new tenant relations have organization-scoped FKs and RLS using the existing `private.has_role` helper. Finance tables are limited to `psychologa` and `gestoria`; reception only sees the consent status projection.

## Why the SQL is not in active migrations

The remote project has migration-history drift and a recovered candidate baseline which has not yet been executed on a clean local Supabase stack. Adding this proposal to `supabase/migrations/` now would imply it is deployable when it is not. The SQL therefore lives under `docs/backend/proposed-migrations/` only.

## Files

- `PROPOSAL_ONLY_20261108.sql`: additive DDL and RPC updates. Applied only to a disposable local Supabase stack by CI; not an active/deployable migration.
- `ISOLATED_TEST_PLAN.md`: role, tenant, idempotency, billing and immutability test matrix, with executed and pending coverage distinguished.
- `BACKEND_GAPS_AND_NEXT_MIGRATIONS.md`: current evidence and delivery sequence.

## Remaining decisions before adoption

- The clinic must confirm that each billed session is represented by one invoice line and define how void/corrective invoices affect the session allocation.
- The clinic's gestor/a must confirm the issuer/recipient fields, invoice-series format and whether the profile model needs multiple bill-to parties per patient. This draft is a technical data structure, not a legal compliance certification.
- The clinic must confirm whether `expenses.amount_cents` represents gross or net. No VAT totals should be published until this and historic data classification are resolved.
- Confirm consent types, versions, whether physical/non-digital evidence is allowed, retention rules and which operational statuses reception needs.
- Update TypeScript database types and client repositories only after the schema is reviewed and locally validated.

## Validation status

[GitHub Actions run #36](https://github.com/mstlabsoficial/kovo/actions/runs/42724127524) passed in a fresh disposable local Supabase stack:
- 43/43 pgTAP assertions.
- 129/129 Auth/PostgREST HTTP assertions.
- Private Storage PDF upload/download and patient-document metadata role/tenant restrictions.
- Concurrent appointment booking and duplicate invoice-line allocation each produce one winner.

This confirms application of the baseline and proposal to the reconstructed local schema and the selected local integration tests. It does not validate production migration safety, legal/tax correctness, the complete UI integration or every scenario in the test plan. No production schema, data, policies, functions, users or Storage settings have been changed.


## Additional security finding — direct invoice status escalation

The recovered catalog shows authenticated users have INSERT/UPDATE privileges on `public.invoices`, and the live RLS policies permit those operations for `psychologa` and `gestoria`. The existing `private.prevent_issued_invoice_mutation()` trigger protects invoices whose **old** status is already non-draft, but it does not reject an authenticated client inserting a row directly as `issued` or changing a draft's status directly.

The SQL proposal therefore adds `private.guard_invoice_status_transition()`: authenticated clients may create drafts, but any status transition must occur under the existing SECURITY DEFINER workflow owner (currently `postgres`) through the guarded issuance path. Add explicit negative PostgREST tests for direct INSERT/UPDATE attempts.

This is a catalog-based code finding, not evidence that anyone exploited the path. It is proposed for local verification only; production remains unchanged.


## Additional scheduling control — database-level overlap prevention

Claude's T2B report confirms that overlapping appointments are currently checked in the UI only. The proposal adds a PostgreSQL GiST exclusion constraint over organization, professional and the appointment time range for active `scheduled`/`confirmed` records. It uses half-open time ranges so one appointment may start exactly when another ends, and it remains safe under concurrent requests. A preflight check aborts the migration when historical overlapping active bookings need reconciliation. Appointments without an assigned professional are not covered; the interface must make that limitation explicit until a professional is selected.


## Clinical-note draft RPC integration contract

The proposal replaces `public.save_clinical_note_draft` while preserving its six-argument RPC signature. In addition to the existing psychologist-only authorization and draft-only edit guard, it validates that:
- The patient belongs to `p_org_id`.
- A non-null appointment belongs to that same organization and patient.
- An update targets the same author, patient and appointment, and only a row still in `draft` status.

For network-retry safety, the RPC also supports a caller-generated stable UUID in `p_note_id` on the **first create**. The client should generate that UUID once, persist it with the pending editor state, and send the same value for the initial request and every retry. On retry, the RPC updates/returns that same draft rather than creating a second row. Passing `NULL` remains backward-compatible for older clients but does not provide client-controlled idempotency after a lost response.

Claude's T2C implementation should use this stable-ID contract and test: first save, retry with identical ID, edit with identical ID, appointment/patient mismatch, cross-organization denial, role denial and signed/rectified note immutability.


## Private patient-document Storage validation

The local HTTP integration harness uploads and downloads a synthetic PDF through the private `kovo-patient-documents` bucket using an Auth-issued psychologist session. It verifies that reception, gestoría and a psychologist from another organization cannot download that file, and that reception cannot create or read patient-document metadata. The workflow uses only a temporary local bucket/object; no hosted Storage objects are touched.

Expense tax-line CRUD/tenant isolation, consent evidence-document linkage and broad transactional rollback tests remain outstanding.
