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

- `PROPOSAL_ONLY_20261108.sql`: additive DDL and RPC updates. Not run.
- `ISOLATED_TEST_PLAN.md`: role, tenant, idempotency, billing and immutability test matrix. Not run.
- `BACKEND_GAPS_AND_NEXT_MIGRATIONS.md`: current evidence and delivery sequence.

## Remaining decisions before adoption

- The clinic must confirm that each billed session is represented by one invoice line and define how void/corrective invoices affect the session allocation.
- The clinic's gestor/a must confirm the issuer/recipient fields, invoice-series format and whether the profile model needs multiple bill-to parties per patient. This draft is a technical data structure, not a legal compliance certification.
- The clinic must confirm whether `expenses.amount_cents` represents gross or net. No VAT totals should be published until this and historic data classification are resolved.
- Confirm consent types, versions, whether physical/non-digital evidence is allowed, retention rules and which operational statuses reception needs.
- Update TypeScript database types and client repositories only after the schema is reviewed and locally validated.

## Validation status

Static review only. No PostgreSQL/Supabase execution has been performed for this proposal. No production schema, data, policies, functions, users or Storage settings have been changed.


## Additional security finding — direct invoice status escalation

The recovered catalog shows authenticated users have INSERT/UPDATE privileges on `public.invoices`, and the live RLS policies permit those operations for `psychologa` and `gestoria`. The existing `private.prevent_issued_invoice_mutation()` trigger protects invoices whose **old** status is already non-draft, but it does not reject an authenticated client inserting a row directly as `issued` or changing a draft's status directly.

The SQL proposal therefore adds `private.guard_invoice_status_transition()`: authenticated clients may create drafts, but any status transition must occur under the existing SECURITY DEFINER workflow owner (currently `postgres`) through the guarded issuance path. Add explicit negative PostgREST tests for direct INSERT/UPDATE attempts.

This is a catalog-based code finding, not evidence that anyone exploited the path. It is proposed for local verification only; production remains unchanged.
