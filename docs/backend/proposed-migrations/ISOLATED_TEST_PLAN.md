# KOVO — isolated backend-gap test plan

Status: the current automated subset has passed in a disposable Supabase local stack: **43/43 pgTAP assertions and 113/113 HTTP/Auth/PostgREST assertions**. See [validation run #30](https://github.com/mstlabsoficial/kovo/actions/runs/42723026089), `supabase/tests/database/kovo_backend_security_test.sql` and `scripts/test-backend-postgrest.mjs`. Remaining cases are still pending.

## Test prerequisites

- Reconstruct the current schema from `supabase/recovered-schema/BASELINE_CANDIDATE_NOT_TESTED.sql`.
- Apply the proposal file only after a successful baseline reset.
- Create at least two organizations and test users for `psychologa`, `recepcion`, and `gestoria` in each organization.
- Use a fresh database for each run; do not point the local CLI at the hosted project.
- The current pgTAP suite sets the Postgres `authenticated` role and `request.jwt.claim.sub` to simulate actor context for RLS/grant/trigger assertions.
- The separate Node integration harness creates users through local Supabase Auth, obtains password-grant sessions and runs HTTP requests against local PostgREST. It refuses non-local API URLs.

## Automated coverage already executed

The current successful run reports:
- **43/43 pgTAP assertions** in `supabase/tests/database/kovo_backend_security_test.sql`.
- **113/113 HTTP/Auth/PostgREST assertions** in `scripts/test-backend-postgrest.mjs`.
- Run: [GitHub Actions #30](https://github.com/mstlabsoficial/kovo/actions/runs/42723026089).

The HTTP suite covers six local Auth users (psychologist, reception, gestoría, second-organization psychologist, inactive membership and no membership), two organizations, tenant and role checks, anonymous/invalid sessions, patient create/update, clinical draft create/edit with stable client UUID retry, mismatched appointment denial, signed-note immutability, consent RPC/idempotency, direct invoice status escalation denial, authorized invoice issuance and fiscal snapshots, billing relation guards, duplicate billing race, appointment overlap and concurrent booking.

The tests do not use production identities or secrets. The test runner uses only a disposable local Supabase URL and API keys.

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
4. The current 43 pgTAP + 113 HTTP integration assertions remain green.
5. Storage/evidence access, expense tax CRUD, broad rollback cases and integrated UI behavior are tested.
6. The clinic confirms billing, recipient and expense semantics.
7. Migration-history reconciliation is completed separately.

Passing local tests does not authorize production deployment.
