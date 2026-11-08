# KOVO live authorization model (catalog review)

Captured read-only from the hosted KOVO Supabase project on 2026-11-08. This document describes current catalog policies and grants; it is not a security certification or penetration test.

## Role matrix

| Resource | psychologa | recepcion | gestoria |
|---|---:|---:|---:|
| Patients | Read / insert / update | Read / insert / update | No access |
| Appointments | Read / insert / update | Read / insert / update | No access |
| Clinical notes | Read; draft/sign/rectify through guarded RPCs | No access | No access |
| Clinical note rectifications | Read; create through guarded workflow | No access | No access |
| Patient document metadata and private Storage | Read / insert / update; Storage read/write/delete policies | No access | No access |
| Professionals | Read | Read | Read |
| Services | Read | Read | Read |
| Employees | Read / insert / update | No access | No access |
| Invoices | Read / insert / update; issue through guarded RPC | No access | Read / insert / update; issue through guarded RPC |
| Invoice lines | Read / insert / update on draft invoices; DB trigger protects issued invoices | No access | Read / insert / update on draft invoices; DB trigger protects issued invoices |
| Expenses | Read / insert / update | No access | Read / insert / update |
| Payments | Read / insert / update | No access | Read / insert / update |
| Audit log | Read | No access | No access |
| Organizations / memberships | Own-organization read through private membership helper | Same | Same |

Delete privileges are not granted to authenticated for most business tables even where a policy is ALL; table privileges and RLS both apply. Do not infer delete access from the policy command alone.

## Catalog facts

- RLS is enabled on each of the 15 public tables; it is not forced.
- There are 21 policies across the public business tables and 4 KOVO policies on storage.objects.
- Organization and membership scope is provided by private.my_orgs() and private.has_role(uuid,text[]), both SECURITY DEFINER with empty search_path.
- The live private.org_counters table has RLS disabled, but no table privileges for anon/authenticated/service_role were present in the inspected table grants; postgres has the table privileges.
- The private storage bucket kovo-patient-documents is not public, has a 20 MiB file limit and permits PDF/JPEG/PNG. Its four object policies require an organization UUID as the first path segment and psychologa membership for that organization.
- Clinical note writes are mediated by guarded public RPCs; signed/rectified note mutation is prevented by a database trigger.
- Invoice issuance is mediated by guarded public RPCs; issued invoices and their lines are protected by database triggers.
- Audit triggers currently record inserts, updates and deletes for appointments, expenses, invoices, patients and payments.

## Security-definer functions

The catalog contains 17 functions, 11 private and 6 public. All SECURITY DEFINER functions inspected have search_path = ''. Function grants are recorded in catalog-security.json.

The six public SECURITY DEFINER workflow RPCs are:
- save_clinical_note_draft
- delete_clinical_note_draft
- sign_clinical_note
- rectify_clinical_note
- save_invoice_draft
- emit_invoice

They are granted to authenticated (and service_role in the catalog ACL) rather than anon/public. Their bodies contain role checks through private.has_role; continue reviewing the exact function definitions before any change.

## Items to verify before real clinic use

1. Create test users for each role in a disposable environment and run negative as well as positive authorization tests. The hosted project currently has no auth users or memberships, so RLS cannot be verified end-to-end with real actors without provisioning identities.
2. Test cross-organization access attempts for every table, RPC, and Storage operation.
3. Confirm whether professionals and services should be editable by a specific role. Their current RLS policy is SELECT-only, although authenticated has INSERT/UPDATE table grants; RLS denies those writes today.
4. Confirm whether storage document deletion should also remove the matching patient_documents metadata row; catalog inspection alone cannot prove application workflow consistency.
5. Add tests that prove signed notes and issued invoices remain immutable through direct REST requests, not only through the UI.
6. Review refresh/logout behavior and token invalidation in the client separately; these are not determined by database policies.

No changes were made to production during this review.