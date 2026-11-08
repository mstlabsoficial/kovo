# KOVO — isolated backend-gap test plan

Status: test specification for the SQL proposal in `PROPOSAL_ONLY_20261108.sql`.
These tests have **not** been executed. Run only on a disposable local Supabase stack.

## Test prerequisites

- Reconstruct the current schema from `supabase/recovered-schema/BASELINE_CANDIDATE_NOT_TESTED.sql`.
- Apply the proposal file only after a successful baseline reset.
- Create at least two organizations and test users for `psychologa`, `recepcion`, and `gestoria` in each organization.
- Use a fresh database for each run; do not point the local CLI at the hosted project.
- Set JWT claims and database role as the Supabase test harness normally does. Verify results through authenticated PostgREST requests as well as SQL assertions.

## 0. Database-enforced appointment scheduling

| Scenario | Expected result |
|---|---|
| New scheduled appointment overlaps another scheduled appointment for same professional and organization | Database exclusion constraint rejects |
| Two concurrent requests try to book the same professional/time range | Exactly one transaction succeeds |
| Same time range for two different professionals | Allowed |
| Same professional, intervals meet exactly at the endpoint (e.g. 10:00–10:50 and 10:50–11:40) | Allowed; intervals are half-open `[start,end)` |
| Existing cancelled/no-show appointment overlaps a new active appointment | Allowed |
| Appointment has no assigned professional | Not covered by this constraint; application must display that scheduling conflict cannot be resolved without an assignee |
| Existing overlapping active appointments exist before migration | Preflight raises an exception and migration stops; data must be reconciled first |

The constraint only applies to `scheduled` and `confirmed` appointments with a non-null professional. Confirm whether the clinic also needs room/resource-level conflict rules before extending it.

## 1. Appointment ↔ invoice line

| Scenario | Expected result |
|---|---|
| Psychologist creates a draft invoice with a completed appointment belonging to the same patient and organization | Success; line stores appointment UUID |
| One invoice contains two different completed appointments | Success; each session has its own line |
| Appointment belongs to another patient | RPC rejects; no invoice or line is committed |
| Appointment belongs to another organization | FK/RPC rejects; no cross-tenant reference |
| Authenticated client inserts/updates `invoice_lines` directly with a non-completed appointment | Table trigger rejects, even when bypassing the RPC |
| Authenticated client links an appointment to an invoice for a different patient | Table trigger rejects |
| Client changes appointment patient/status after it has an invoice line | Table trigger rejects |
| Client changes invoice patient after appointment-linked lines exist | Table trigger rejects |
| Appointment is scheduled, confirmed, cancelled or no-show | RPC rejects; only `completed` is billable in this draft |
| Two draft invoices try to link the same appointment | Second insert fails on unique index |
| A line has no appointment_id | Existing non-session invoice use remains compatible |
| Direct REST attempt changes a line after invoice issuance | Rejected by existing issued-line immutability trigger |
| Void/corrective invoice workflow is attempted | Must not silently free the appointment for rebilling; follow the separately approved correction rule |

Also test concurrent duplicate billing attempts. Exactly one transaction may win the unique appointment allocation.

## 2. Fiscal profiles and invoice snapshots

| Scenario | Expected result |
|---|---|
| Gestoría reads/updates organization billing profile | Allowed |
| Reception reads or updates organization billing profile | Denied by RLS |
| Gestoría reads/updates patient billing profile | Allowed |
| Reception reads patient billing profile | Denied by RLS |
| Invoice issuance with no organization profile | Rejected; invoice remains draft |
| Invoice issuance with no patient billing profile | Rejected; invoice remains draft |
| Direct REST INSERT of an invoice with status `issued`, `paid`, `partially_paid` or `void` | Rejected; only draft invoices can be inserted by authenticated clients |
| Direct REST UPDATE that changes a draft invoice status | Rejected; status transitions must use the guarded RPC |
| Valid issuance through `public.emit_invoice` | Number, series, issuer snapshot, recipient snapshot and status are written atomically |
| Profile changes after issuance | Existing invoice snapshots remain unchanged |
| Direct REST update/delete of issued invoice | Rejected by existing invoice immutability trigger |
| Caller from another organization tries to issue invoice | Denied |
| Retried issue request for an already-issued invoice | Rejected as non-draft; no second invoice number allocated |

Test both an individual patient payer and a different legal payer before deciding whether one billing profile per patient is enough for the clinic.

## 3. Expense tax breakdown

| Scenario | Expected result |
|---|---|
| Psychologist or gestoría adds one tax line | Allowed |
| Finance user adds multiple tax lines with different VAT rates | Allowed |
| Reception reads or writes expense tax lines | Denied |
| Negative tax base, tax amount or deductible amount | Constraint rejects |
| Deductible VAT exceeds VAT charged | Constraint rejects |
| Expense and tax line use different organizations | Composite FK rejects |
| Existing expense without tax lines | Remains valid and is not silently assigned a VAT rate |

Do not assert that `amount_cents = tax_base_cents + tax_cents` until the meaning of the existing amount column has been confirmed and the clinic has approved rounding and adjustment rules.

## 4. Consent events and reception status

| Scenario | Expected result |
|---|---|
| Psychologist records pending/granted/withdrawn consent | One append-only event is created; current status projection updates in same transaction |
| Granted consent without signed_at | Rejected |
| Withdrawn consent without withdrawn_at | Rejected |
| Evidence document belongs to another patient or organization | Composite FK rejects |
| Reception reads `patient_consent_status` | Allowed; only type/version/status/timestamp are exposed |
| Reception reads `patient_consents` or patient document metadata/storage | Denied |
| Gestoría reads consent records/status | Denied |
| Reception tries to change consent status | Denied; only psychologist RPC can record events |
| Same request_key and identical payload is retried | Same event UUID returned; no duplicate event |
| Same request_key is reused with a different payload | Rejected |
| User from another organization attempts to record/read consent | Denied |

## 5. Global security/integrity matrix

Run the complete test set for each role and for a user with no membership. For every table and RPC, test both an allowed operation and a denied operation.

- Cross-organization SELECT, INSERT, UPDATE and RPC invocation.
- Missing/expired JWT and inactive membership.
- Direct REST writes that bypass the UI, including appointment/invoice-line consistency checks and invoice status escalation.
- Concurrent retries and unique-key races.
- Transaction rollback when any part of a multi-row RPC fails.
- Issued invoice and signed clinical-note immutability remains intact.
- Reception can manage patient/appointment operations from T2B without acquiring finance or clinical-document permissions.
- Gestoría can manage billing without acquiring patient clinical-note or document permissions.

## Acceptance gate

The proposal is ready for a reviewed migration only when:
1. Baseline reset succeeds.
2. The proposal applies cleanly to that local baseline.
3. Catalog diff is understood and the new policies/grants match the role matrix.
4. The tests above pass against local PostgREST and database access.
5. The clinic confirms the billing, recipient and expense semantics.
6. Migration-history reconciliation is completed separately.

Passing local tests does not authorize production deployment.
