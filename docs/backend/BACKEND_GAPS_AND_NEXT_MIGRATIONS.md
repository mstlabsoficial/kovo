# KOVO backend — gaps outside T2B

Design work prepared in parallel with Claude's T2B implementation (patient and appointment writes). This is a design proposal based on the live Supabase catalog snapshot and current TypeScript/legacy model. It does not modify a database and does not contain executable migrations.

## Scope split

- Claude T2B: persist patients and appointments safely.
- This track: specify the next schema/application gaps that affect invoicing, fiscal reporting and consent visibility, so they can be implemented after T2B without redesigning its work.

## 1. Appointment ↔ invoice traceability

### Current evidence

- `appointments` contains patient, professional, service, start/end timestamps, status, location, modality and price.
- `invoices` contains patient, dates, status, totals and retention.
- `invoice_lines` contains invoice, description, quantity, unit price, VAT rate and line total.
- There is no `appointment_id` on `invoices` or `invoice_lines`, and no junction table linking a billed line to the appointment(s) that it covers.
- Therefore the application cannot authoritatively determine whether an appointment has already been invoiced from the relational schema.

### Recommendation to decide

For the first clinic release, support an explicit billable-session link at invoice-line level, not at invoice header level. An invoice can contain several lines and potentially several sessions, so linking only the invoice header to one appointment is too restrictive.

Two possible models:

**MVP option A — one appointment per invoice line**
- Add nullable `appointment_id` to `invoice_lines`.
- Add a composite FK `(org_id, appointment_id)` to `appointments(org_id, id)`.
- Add a partial unique index on `(org_id, appointment_id)` for non-null values to prevent billing the same session twice.
- Require the appointment and invoice to belong to the same organization; the composite FK plus existing invoice composite FK enforces both sides.
- UI must allow an appointment to be selected when creating a line and show its billing state.

Advantages: simple, easy to query and clear double-billing guard. Limitation: one appointment cannot be represented by multiple invoice lines or split across invoices.

**Option B — junction table for future flexibility**
- Create `invoice_line_appointments(org_id, invoice_line_id, appointment_id)`.
- Composite FKs ensure the line and appointment belong to the same organization.
- Add unique constraints to express the desired rule (for example, one active billing allocation per appointment), with a deliberate policy for void/corrective invoices.

Advantages: supports grouping several appointments into one line or splitting an appointment into multiple lines. More complex to validate and report.

Do not implement either model until the business rule is confirmed. For the pilot, option A is likely enough if the clinic bills one session per line.

### Acceptance criteria

- A session can be invoiced only once under the chosen business rule.
- Draft invoice lines can be edited/removed; issued invoices remain immutable under existing triggers.
- The application can query billed/unbilled appointments without inferring from display text.
- Voided/corrective invoices have explicit rules; voiding must not accidentally make an already-issued session billable again.
- Patient and appointment organization IDs are validated at the database layer.

## 2. Organization fiscal profile

### Current evidence

The live `professionals` table contains display name, email, phone and professional number. There is no authoritative fiscal identity/profile table for the invoice issuer (legal name, tax identifier and registered address). `invoices` stores the recipient patient and amounts, but not a snapshot of the issuer's fiscal data.

### Recommendation

Create a separate one-per-organization table such as `organization_billing_profiles`, rather than putting issuer tax data into `professionals` or hardcoding it in the frontend.

Suggested fields (confirm which are required for Spanish invoicing before migration):
- `org_id` (PK/FK to organizations)
- `legal_name`
- `tax_id`
- `billing_address`, `postal_code`, `city`, `region`, `country_code`
- `billing_email`, `billing_phone`
- optional invoice series/default payment terms
- `created_at`, `updated_at`

Keep this separate from patient billing details. When an invoice is issued, snapshot the issuer and recipient identity/address on the invoice so later profile edits do not rewrite historical invoices.

### Acceptance criteria

- Drafts may use the current organization profile.
- Issuing an invoice requires all issuer fields required by the selected jurisdiction/workflow.
- Issued invoices retain immutable issuer/recipient snapshots.
- Only authorized finance roles can read/update the billing profile; exact write access must follow the practice's chosen role matrix.

## 3. Expense tax detail and reliable fiscal summaries

### Current evidence

`expenses` currently stores a single `amount_cents` total, description, category, date, supplier and optional document path. It has no tax base, VAT rate, VAT amount or deductible VAT amount.

That means the current model cannot calculate input VAT or produce a trustworthy VAT summary. A total amount alone is insufficient to know the supplier's taxable base or deductible VAT.

### Recommendation

At minimum, model expense amounts explicitly:
- `total_cents` (or retain `amount_cents` with a documented gross/net meaning)
- `tax_base_cents`
- `tax_rate`
- `tax_cents`
- `deductible_tax_cents`
- optional supplier tax identifier and supplier invoice reference

Decide how to represent expenses with multiple VAT rates: either an `expense_lines` child table or a separate tax-breakdown table. Do not assume one tax rate per supplier invoice if the clinic receives mixed-rate expenses.

Do not add retention fields to expenses without validating the actual accounting workflow; withholding normally depends on invoice type and supplier relationship, not simply any expense.

### Acceptance criteria

- Amount semantics are explicit (gross/net) and calculations use integer cents.
- Mixed VAT rates can be represented, or explicitly rejected by validation in the MVP.
- Fiscal reports reconcile to stored tax-base/tax amounts and never infer VAT from the gross total.
- Existing historic expenses remain distinguishable from new records without tax detail.

## 4. Consent records vs document access

### Current evidence

`patient_documents` stores file metadata and a Storage path. The live policy for `patient_documents` and the private document bucket currently allows only the `psychologa` role. The current catalog has no dedicated, structured patient-consent table or versioned consent status.

The UI report from T2A says reception therefore displays 'Sin consentimiento' where it cannot read consent document metadata. Granting reception broad access to clinical documents would be the wrong fix.

### Recommendation

Represent consent status separately from the private clinical file store. Consider a `patient_consents` table with:
- `org_id`, `patient_id`
- `consent_type` and `document_version`
- `status` (for example, pending/granted/withdrawn)
- `signed_at`, `withdrawn_at`
- `evidence_document_id` or a controlled reference to private storage
- `recorded_by`, `created_at`, optional audit metadata

Suggested access model:
- Psychologist: view/manage consent record and associated evidence.
- Reception: read only the minimum operational status needed to arrange appointments (not the underlying clinical document or unrelated patient files).
- Gestoría: no access unless a narrowly justified business workflow requires it.

Prefer a narrow RLS policy over broadening `patient_documents` or the Storage bucket. If the UI only needs a boolean/status, expose only that minimum structured record.

### Acceptance criteria

- Reception can see the operational consent status without being able to download private clinical documents.
- Consent is versioned and withdrawal is recorded; do not overwrite history.
- Cross-organization reads are denied.
- Evidence is available only to authorized clinical users.

## 5. Cross-cutting data integrity

Before any write workflow is opened to the clinic:

- All tenant-owned relations use composite `(org_id, id)` foreign keys where cross-tenant linking would be unsafe.
- Database constraints, not only frontend checks, prevent invalid status values and negative money amounts.
- Monetary values are integer cents; percentage rates use numeric precision and explicit rounding.
- Issued invoices and signed notes remain immutable through direct REST attempts as well as UI operations.
- RPCs are idempotent or use client-generated operation keys where retries could duplicate a financial/clinical action.
- Audit events are written for meaningful create/update/issue/sign/rectify operations; avoid logging clinical note content or sensitive personal data.
- Role tests include both allowed and denied operations for each role, plus cross-organization attempts.

## Suggested delivery order after T2B

1. Finish T2B patient and appointment writes and prove read-after-write persistence.
2. Decide appointment-to-invoice business rule (Option A vs Option B) with the clinic before adding schema.
3. Add fiscal profile and immutable invoice snapshots before enabling invoice issuance.
4. Add expense tax breakdown before claiming reliable tax summaries.
5. Add structured consent records and the least-privilege reception read path.
6. Run migrations and authorization tests only in a disposable local Supabase environment first; do not apply to production as part of this design phase.

## Explicit non-actions

- No migration has been applied or added to active `supabase/migrations/`.
- No production table, policy, function, user, record or Storage object has been changed.
- This proposal does not give legal/tax advice; fiscal fields and invoice behavior must be confirmed against the clinic's actual Spanish invoicing and accounting requirements.

## Source snapshots

- `supabase/recovered-schema/catalog-tables.json`
- `supabase/recovered-schema/catalog-security.json`
- `supabase/recovered-schema/AUTHORIZATION_MODEL.md`
- `supabase/recovered-schema/MIGRATION_RECONCILIATION_PLAN.md`
- Local Claude T2A report supplied in the conversation (commit `9e67c7b`, not yet published).

## Concrete implementation draft

A first additive implementation draft and its isolated test matrix are now maintained separately:

- `docs/backend/IMPLEMENTATION_BLUEPRINT.md`
- `docs/backend/proposed-migrations/PROPOSAL_ONLY_20261108.sql`
- `docs/backend/proposed-migrations/ISOLATED_TEST_PLAN.md`

The draft is intentionally not an active migration and has not been executed. Its choices and remaining clinic decisions are documented in the blueprint.
