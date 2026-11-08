-- KOVO BACKEND GAPS — PROPOSAL ONLY
-- DO NOT RUN against production.
-- Not an active Supabase migration. Keep this file under docs/backend/proposed-migrations/.
-- Validate first against a fresh disposable local Supabase stack built from the recovered
-- baseline. This proposal assumes the catalog captured on 2026-11-08 and the current
-- function signatures. Reconcile the active migration history before any deployment.
--
-- Business rule chosen for this first draft:
--   * one completed appointment can be linked to at most one invoice line;
--   * an invoice can contain multiple appointment-linked lines;
--   * voided/corrective invoice handling must retain the original appointment link
--     until a separate, explicit credit/reissue workflow is approved.
-- If the clinic sells session packages or splits a session across invoices, replace
-- the direct invoice_lines.appointment_id relation with a separately designed
-- allocation table before adopting this SQL.

-- ============================================================================
-- PHASE 1 — appointment to invoice-line traceability
-- ============================================================================

ALTER TABLE public.invoice_lines
  ADD COLUMN appointment_id uuid;

ALTER TABLE public.invoice_lines
  ADD CONSTRAINT invoice_lines_org_appointment_fkey
  FOREIGN KEY (org_id, appointment_id)
  REFERENCES public.appointments (org_id, id)
  ON DELETE RESTRICT;

CREATE UNIQUE INDEX invoice_lines_one_billable_line_per_appointment_uq
  ON public.invoice_lines (org_id, appointment_id)
  WHERE appointment_id IS NOT NULL;

-- Extend the existing atomic draft-creation RPC to accept appointment_id in each
-- p_lines[] item. The rest of the existing calculation and authorization behavior
-- is preserved. Existing callers remain compatible: missing appointment_id => NULL.
CREATE OR REPLACE FUNCTION public.save_invoice_draft(
  p_org_id uuid,
  p_patient_id uuid,
  p_issue_date date,
  p_due_date date,
  p_lines jsonb,
  p_legacy_id text DEFAULT NULL::text,
  p_retention_cents integer DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
  v_subtotal bigint := 0;
  v_tax bigint := 0;
  v_total bigint := 0;
  v_line jsonb;
  v_qty numeric;
  v_unit integer;
  v_rate numeric;
  v_base bigint;
  v_line_total bigint;
  v_appointment_id uuid;
BEGIN
  IF auth.uid() IS NULL
     OR NOT private.has_role(p_org_id, ARRAY['psychologa','gestoria']) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
  END IF;

  IF p_lines IS NULL
     OR jsonb_typeof(p_lines) <> 'array'
     OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one invoice line is required';
  END IF;

  INSERT INTO public.invoices(
    org_id, patient_id, invoice_number, issue_date, due_date, status,
    subtotal_cents, tax_cents, total_cents, retention_cents, legacy_id
  )
  VALUES (
    p_org_id, p_patient_id, NULL, coalesce(p_issue_date, current_date),
    p_due_date, 'draft', 0, 0, 0,
    greatest(coalesce(p_retention_cents, 0), 0), p_legacy_id
  )
  RETURNING id INTO v_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_qty := (v_line->>'quantity')::numeric;
    v_unit := (v_line->>'unit_price_cents')::integer;
    v_rate := coalesce((v_line->>'tax_rate')::numeric, 0);
    v_appointment_id := nullif(btrim(v_line->>'appointment_id'), '')::uuid;

    IF v_qty IS NULL OR v_unit IS NULL
       OR v_qty <= 0 OR v_unit < 0 OR v_rate < 0 OR v_rate > 100 THEN
      RAISE EXCEPTION 'Invalid invoice line';
    END IF;

    IF v_appointment_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.org_id = p_org_id
        AND a.id = v_appointment_id
        AND a.patient_id = p_patient_id
        AND a.status = 'completed'
    ) THEN
      RAISE EXCEPTION 'Only a completed appointment for this invoice patient can be billed';
    END IF;

    v_base := round(v_qty * v_unit);
    v_line_total := round(v_base * (1 + v_rate / 100));
    v_subtotal := v_subtotal + v_base;
    v_tax := v_tax + (v_line_total - v_base);

    INSERT INTO public.invoice_lines(
      org_id, invoice_id, appointment_id, description, quantity,
      unit_price_cents, tax_rate, line_total_cents
    )
    VALUES (
      p_org_id, v_id, v_appointment_id,
      coalesce(nullif(v_line->>'description', ''), 'Servicio'),
      v_qty, v_unit, v_rate, v_line_total
    );
  END LOOP;

  v_total := v_subtotal + v_tax - greatest(coalesce(p_retention_cents, 0), 0);
  IF v_total < 0 THEN
    RAISE EXCEPTION 'Invoice total cannot be negative';
  END IF;

  UPDATE public.invoices
  SET subtotal_cents = v_subtotal,
      tax_cents = v_tax,
      total_cents = v_total
  WHERE id = v_id;

  RETURN v_id;
END;
$function$;

-- ============================================================================
-- PHASE 2 — fiscal profiles and immutable invoice snapshots
-- ============================================================================

CREATE TABLE public.organization_billing_profiles (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  legal_name text NOT NULL CHECK (length(btrim(legal_name)) > 0),
  tax_id text NOT NULL CHECK (length(btrim(tax_id)) > 0),
  address_line text NOT NULL CHECK (length(btrim(address_line)) > 0),
  postal_code text NOT NULL CHECK (length(btrim(postal_code)) > 0),
  city text NOT NULL CHECK (length(btrim(city)) > 0),
  region text,
  country_code character(2) NOT NULL DEFAULT 'ES',
  billing_email text,
  billing_phone text,
  invoice_series text NOT NULL DEFAULT 'KOVO'
    CHECK (length(btrim(invoice_series)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (country_code = upper(country_code))
);

-- A patient may have a different billing identity from their clinical/contact
-- identity. Gestoría gets access to this finance-specific table, not to patients.
CREATE TABLE public.patient_billing_profiles (
  org_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  legal_name text NOT NULL CHECK (length(btrim(legal_name)) > 0),
  tax_id text,
  address_line text NOT NULL CHECK (length(btrim(address_line)) > 0),
  postal_code text,
  city text,
  region text,
  country_code character(2) NOT NULL DEFAULT 'ES',
  billing_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, patient_id),
  FOREIGN KEY (org_id, patient_id)
    REFERENCES public.patients (org_id, id) ON DELETE RESTRICT,
  CHECK (country_code = upper(country_code))
);

ALTER TABLE public.invoices
  ADD COLUMN issuer_snapshot jsonb,
  ADD COLUMN recipient_snapshot jsonb;

-- NOT VALID preserves compatibility with any historical issued invoices whose
-- original identity data was never captured, while enforcing all new status changes.
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_issued_snapshots_required
  CHECK (
    status NOT IN ('issued', 'paid', 'partially_paid')
    OR (
      issuer_snapshot IS NOT NULL
      AND recipient_snapshot IS NOT NULL
      AND jsonb_typeof(issuer_snapshot) = 'object'
      AND jsonb_typeof(recipient_snapshot) = 'object'
    )
  ) NOT VALID;

ALTER TABLE public.organization_billing_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_billing_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY organization_billing_profiles_finance_all
  ON public.organization_billing_profiles
  FOR ALL TO authenticated
  USING (private.has_role(org_id, ARRAY['psychologa','gestoria']))
  WITH CHECK (private.has_role(org_id, ARRAY['psychologa','gestoria']));

CREATE POLICY patient_billing_profiles_finance_all
  ON public.patient_billing_profiles
  FOR ALL TO authenticated
  USING (private.has_role(org_id, ARRAY['psychologa','gestoria']))
  WITH CHECK (private.has_role(org_id, ARRAY['psychologa','gestoria']));

GRANT SELECT, INSERT, UPDATE
  ON TABLE public.organization_billing_profiles, public.patient_billing_profiles
  TO authenticated;

-- Replace the private issuance implementation. The existing public.emit_invoice
-- wrapper remains unchanged and continues to check the psychologa/gestoria role.
-- This operation validates both profiles before consuming the invoice counter.
CREATE OR REPLACE FUNCTION private.emit_invoice(p_invoice uuid)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v public.invoices;
  v_issuer jsonb;
  v_recipient jsonb;
  v_series text;
  n bigint;
BEGIN
  SELECT * INTO v
  FROM public.invoices
  WHERE id = p_invoice
  FOR UPDATE;

  IF NOT FOUND
     OR auth.uid() IS NULL
     OR NOT private.has_role(v.org_id, ARRAY['psychologa','gestoria']) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
  END IF;

  IF v.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft invoices can be issued';
  END IF;

  IF v.patient_id IS NULL THEN
    RAISE EXCEPTION 'An invoice recipient with a billing profile is required';
  END IF;

  SELECT
    jsonb_build_object(
      'legal_name', legal_name,
      'tax_id', tax_id,
      'address_line', address_line,
      'postal_code', postal_code,
      'city', city,
      'region', region,
      'country_code', country_code,
      'billing_email', billing_email,
      'billing_phone', billing_phone
    ),
    invoice_series
  INTO v_issuer, v_series
  FROM public.organization_billing_profiles
  WHERE org_id = v.org_id;

  SELECT jsonb_build_object(
    'legal_name', legal_name,
    'tax_id', tax_id,
    'address_line', address_line,
    'postal_code', postal_code,
    'city', city,
    'region', region,
    'country_code', country_code,
    'billing_email', billing_email
  )
  INTO v_recipient
  FROM public.patient_billing_profiles
  WHERE org_id = v.org_id
    AND patient_id = v.patient_id;

  IF v_issuer IS NULL OR v_recipient IS NULL THEN
    RAISE EXCEPTION 'Complete issuer and recipient billing profiles before issuing';
  END IF;

  n := private.next_counter(v.org_id, 'invoice');

  UPDATE public.invoices
  SET series = v_series,
      invoice_number = v_series || '-' || to_char(issue_date, 'YYYY') || '-' || lpad(n::text, 6, '0'),
      issuer_snapshot = v_issuer,
      recipient_snapshot = v_recipient,
      status = 'issued'
  WHERE id = p_invoice
  RETURNING * INTO v;

  INSERT INTO public.audit_log(
    org_id, actor_id, action, entity_type, entity_id, metadata
  )
  VALUES (
    v.org_id, auth.uid(), 'emit', 'invoice', v.id,
    jsonb_build_object('invoice_number', v.invoice_number, 'snapshots_captured', true)
  );

  RETURN v;
END;
$function$;

-- ============================================================================
-- PHASE 3 — expense tax breakdown (do not reinterpret amount_cents)
-- ============================================================================

-- Required because expenses currently has no unique (org_id,id) target for a
-- tenant-safe composite foreign key.
CREATE UNIQUE INDEX expenses_org_id_id_key
  ON public.expenses (org_id, id);

CREATE TABLE public.expense_tax_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  expense_id uuid NOT NULL,
  tax_base_cents integer NOT NULL CHECK (tax_base_cents >= 0),
  tax_rate numeric(5,2) NOT NULL CHECK (tax_rate >= 0 AND tax_rate <= 100),
  tax_cents integer NOT NULL CHECK (tax_cents >= 0),
  deductible_tax_cents integer NOT NULL DEFAULT 0
    CHECK (deductible_tax_cents >= 0 AND deductible_tax_cents <= tax_cents),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (org_id, expense_id)
    REFERENCES public.expenses (org_id, id) ON DELETE RESTRICT
);

CREATE INDEX expense_tax_lines_org_expense_idx
  ON public.expense_tax_lines (org_id, expense_id);

ALTER TABLE public.expense_tax_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY expense_tax_lines_finance_all
  ON public.expense_tax_lines
  FOR ALL TO authenticated
  USING (private.has_role(org_id, ARRAY['psychologa','gestoria']))
  WITH CHECK (private.has_role(org_id, ARRAY['psychologa','gestoria']));

GRANT SELECT, INSERT, UPDATE
  ON TABLE public.expense_tax_lines
  TO authenticated;

-- Important: amount_cents remains untouched. Its gross/net meaning must be
-- explicitly decided and historic expenses classified before fiscal summaries
-- aggregate this table. Multiple tax lines support mixed rates per supplier invoice.

-- ============================================================================
-- PHASE 4 — consent history plus a minimal operational status projection
-- ============================================================================

-- A triple key makes the evidence-document relation tenant- and patient-safe.
CREATE UNIQUE INDEX patient_documents_org_patient_id_id_key
  ON public.patient_documents (org_id, patient_id, id);

CREATE TABLE public.patient_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  consent_type text NOT NULL CHECK (length(btrim(consent_type)) > 0),
  document_version text NOT NULL CHECK (length(btrim(document_version)) > 0),
  status text NOT NULL CHECK (status IN ('pending','granted','withdrawn')),
  signed_at timestamptz,
  withdrawn_at timestamptz,
  evidence_document_id uuid,
  recorded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  request_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, request_key),
  FOREIGN KEY (org_id, patient_id)
    REFERENCES public.patients (org_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (org_id, patient_id, evidence_document_id)
    REFERENCES public.patient_documents (org_id, patient_id, id) ON DELETE RESTRICT,
  CHECK (status <> 'granted' OR signed_at IS NOT NULL),
  CHECK (status <> 'withdrawn' OR withdrawn_at IS NOT NULL)
);

-- This table intentionally contains only the operational fields reception needs.
-- It has no evidence path, file name, signature content or clinical document data.
CREATE TABLE public.patient_consent_status (
  org_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  consent_type text NOT NULL,
  document_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','granted','withdrawn')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, patient_id, consent_type),
  FOREIGN KEY (org_id, patient_id)
    REFERENCES public.patients (org_id, id) ON DELETE RESTRICT
);

CREATE INDEX patient_consents_org_patient_created_idx
  ON public.patient_consents (org_id, patient_id, created_at DESC);

ALTER TABLE public.patient_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_consent_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY patient_consents_psychologist_read
  ON public.patient_consents
  FOR SELECT TO authenticated
  USING (private.has_role(org_id, ARRAY['psychologa']));

CREATE POLICY patient_consent_status_operational_read
  ON public.patient_consent_status
  FOR SELECT TO authenticated
  USING (private.has_role(org_id, ARRAY['psychologa','recepcion']));

-- Direct writes are intentionally not granted. The RPC below writes both the
-- append-only event and the limited status projection in one transaction.
GRANT SELECT ON TABLE public.patient_consents TO authenticated;
GRANT SELECT ON TABLE public.patient_consent_status TO authenticated;

CREATE OR REPLACE FUNCTION public.record_patient_consent(
  p_org_id uuid,
  p_patient_id uuid,
  p_consent_type text,
  p_document_version text,
  p_status text,
  p_signed_at timestamptz,
  p_withdrawn_at timestamptz,
  p_evidence_document_id uuid,
  p_request_key uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
  v_existing public.patient_consents;
BEGIN
  IF auth.uid() IS NULL
     OR NOT private.has_role(p_org_id, ARRAY['psychologa']) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
  END IF;

  IF p_consent_type IS NULL OR length(btrim(p_consent_type)) = 0
     OR p_document_version IS NULL OR length(btrim(p_document_version)) = 0
     OR p_request_key IS NULL THEN
    RAISE EXCEPTION 'Consent type, version and idempotency key are required';
  END IF;

  IF p_status NOT IN ('pending','granted','withdrawn') THEN
    RAISE EXCEPTION 'Invalid consent status';
  END IF;

  IF p_status = 'granted' AND p_signed_at IS NULL THEN
    RAISE EXCEPTION 'A granted consent requires signed_at';
  END IF;

  IF p_status = 'withdrawn' AND p_withdrawn_at IS NULL THEN
    RAISE EXCEPTION 'A withdrawn consent requires withdrawn_at';
  END IF;

  INSERT INTO public.patient_consents(
    org_id, patient_id, consent_type, document_version, status,
    signed_at, withdrawn_at, evidence_document_id, recorded_by, request_key
  )
  VALUES (
    p_org_id, p_patient_id, p_consent_type, p_document_version, p_status,
    p_signed_at, p_withdrawn_at, p_evidence_document_id, auth.uid(), p_request_key
  )
  ON CONFLICT (org_id, request_key) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT * INTO v_existing
    FROM public.patient_consents
    WHERE org_id = p_org_id AND request_key = p_request_key;

    IF NOT FOUND
       OR v_existing.patient_id IS DISTINCT FROM p_patient_id
       OR v_existing.consent_type IS DISTINCT FROM p_consent_type
       OR v_existing.document_version IS DISTINCT FROM p_document_version
       OR v_existing.status IS DISTINCT FROM p_status
       OR v_existing.signed_at IS DISTINCT FROM p_signed_at
       OR v_existing.withdrawn_at IS DISTINCT FROM p_withdrawn_at
       OR v_existing.evidence_document_id IS DISTINCT FROM p_evidence_document_id THEN
      RAISE EXCEPTION 'Idempotency key was already used with a different consent payload';
    END IF;

    RETURN v_existing.id;
  END IF;

  INSERT INTO public.patient_consent_status(
    org_id, patient_id, consent_type, document_version, status, updated_at
  )
  VALUES (
    p_org_id, p_patient_id, p_consent_type, p_document_version, p_status, now()
  )
  ON CONFLICT (org_id, patient_id, consent_type)
  DO UPDATE SET
    document_version = EXCLUDED.document_version,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO public.audit_log(
    org_id, actor_id, action, entity_type, entity_id, metadata
  )
  VALUES (
    p_org_id, auth.uid(), 'record', 'patient_consent', v_id,
    jsonb_build_object('consent_type', p_consent_type, 'status', p_status)
  );

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_patient_consent(
  uuid, uuid, text, text, text, timestamptz, timestamptz, uuid, uuid
) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.record_patient_consent(
  uuid, uuid, text, text, text, timestamptz, timestamptz, uuid, uuid
) TO authenticated;

-- ============================================================================
-- DEPLOYMENT GATE — do not skip
-- ============================================================================
-- 1. Confirm that the clinic accepts the one-appointment/one-line billing rule.
-- 2. Confirm invoice recipient profiles, invoice numbering/series and tax fields
--    with the clinic's gestor/a before enabling issuance.
-- 3. Define whether expenses.amount_cents is gross or net; do not report tax until
--    historic records have an explicit classification.
-- 4. Test all phases on a fresh local Supabase stack and against a snapshot diff.
-- 5. Run role, cross-tenant, retry, immutability and direct-REST tests.
-- 6. Reconcile the remote migration versions (history 001–008 vs local filenames)
--    before any deployment. Never apply this proposal directly to production.
