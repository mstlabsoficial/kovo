-- KOVO · 20261111090400 · Patient documents (private Storage), invoice payments, appointment
-- reminders outbox and traceability of configuration changes.

-- Documents ---------------------------------------------------------------------------------------
-- Object path in the private bucket kovo-patient-documents: <org_id>/<patient_id>/<uuid>-<name>.
-- The row in patient_documents and the object must describe the same organization and patient.
ALTER TABLE public.patient_documents
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS size_bytes bigint CHECK (size_bytes IS NULL OR (size_bytes > 0 AND size_bytes <= 20971520)),
  ADD COLUMN IF NOT EXISTS description text CHECK (description IS NULL OR length(description) <= 300),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.patient_documents
  ADD CONSTRAINT patient_documents_mime_check CHECK (mime_type IS NULL OR mime_type IN ('application/pdf','image/jpeg','image/png')),
  ADD CONSTRAINT patient_documents_type_check CHECK (document_type IN ('consentimiento','informe_externo','justificante','factura','identificacion','otro')) NOT VALID,
  ADD CONSTRAINT patient_documents_file_name_check CHECK (length(btrim(file_name)) BETWEEN 1 AND 200) NOT VALID;

CREATE OR REPLACE FUNCTION private.guard_patient_document()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.storage_path !~ ('^' || NEW.org_id::text || '/' || NEW.patient_id::text || '/[0-9a-f-]{36}-[^/]{1,200}$') THEN
      RAISE EXCEPTION 'Ruta de documento no válida para este paciente' USING ERRCODE = 'KD001';
    END IF;
    NEW.uploaded_by := auth.uid();
    NEW.deleted_at := NULL; NEW.deleted_by := NULL;
    RETURN NEW;
  END IF;
  -- UPDATE: only description and the soft delete (once) can change.
  IF NEW.storage_path IS DISTINCT FROM OLD.storage_path OR NEW.org_id IS DISTINCT FROM OLD.org_id
     OR NEW.patient_id IS DISTINCT FROM OLD.patient_id OR NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
     OR NEW.size_bytes IS DISTINCT FROM OLD.size_bytes THEN
    RAISE EXCEPTION 'Solo se puede cambiar la descripción o retirar el documento' USING ERRCODE = 'KD002';
  END IF;
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION 'El documento ya está retirado' USING ERRCODE = 'KD003';
  END IF;
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    NEW.deleted_at := now(); NEW.deleted_by := auth.uid();
  END IF;
  RETURN NEW;
END; $function$;
REVOKE ALL ON FUNCTION private.guard_patient_document() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER patient_documents_guard BEFORE INSERT OR UPDATE ON public.patient_documents
  FOR EACH ROW EXECUTE FUNCTION private.guard_patient_document();
CREATE TRIGGER audit_patient_documents AFTER INSERT OR UPDATE OR DELETE ON public.patient_documents
  FOR EACH ROW EXECUTE FUNCTION private.write_audit_event();

-- Storage policies: same role rule as the baseline (psychologist) plus
--   * the second folder must be a patient of that organization (no path manipulation);
--   * uploads only while the clinic account is writable;
--   * objects are never overwritten or deleted by the app (retention; deletion is an operator
--     procedure, docs/legal/conservacion-y-supresion.md).
DROP POLICY IF EXISTS "kovo_documents_insert" ON storage.objects;
DROP POLICY IF EXISTS "kovo_documents_update" ON storage.objects;
DROP POLICY IF EXISTS "kovo_documents_delete" ON storage.objects;
CREATE OR REPLACE FUNCTION private.document_object_ok(p_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
  v_parts text[] := string_to_array(p_name, '/');
  v_org uuid;
  v_patient uuid;
BEGIN
  IF array_length(v_parts, 1) <> 3
     OR v_parts[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR v_parts[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  v_org := v_parts[1]::uuid; v_patient := v_parts[2]::uuid;
  RETURN private.has_role(v_org, ARRAY['psychologa'])
     AND private.org_writable(v_org)
     AND EXISTS (SELECT 1 FROM public.patients p WHERE p.org_id = v_org AND p.id = v_patient);
END; $function$;
REVOKE ALL ON FUNCTION private.document_object_ok(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.document_object_ok(text) TO authenticated;
CREATE POLICY "kovo_documents_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kovo-patient-documents' AND private.document_object_ok(name));

-- Invoice payments ------------------------------------------------------------------------------
-- Payments are append-only and recorded through record_invoice_payment(), which also moves the
-- invoice to partially_paid / paid. Direct REST may still INSERT (baseline grant) but never update
-- or delete, and only against issued invoices; the status is recomputed by the database either way.
REVOKE UPDATE, DELETE ON public.payments FROM authenticated;
DROP POLICY IF EXISTS "payments_finance_all" ON public.payments;
CREATE POLICY payments_finance_read ON public.payments FOR SELECT TO authenticated
  USING (private.has_role(org_id, ARRAY['psychologa','gestoria']));
CREATE POLICY payments_finance_insert ON public.payments FOR INSERT TO authenticated
  WITH CHECK (private.has_role(org_id, ARRAY['psychologa','gestoria']));
ALTER TABLE public.payments ADD CONSTRAINT payments_method_check
  CHECK (method IS NULL OR method IN ('efectivo','tarjeta','transferencia','bizum','domiciliacion','otro')) NOT VALID;

-- The issued-invoice immutability trigger now lets the payment synchronisation change ONLY the
-- status, ONLY along issued → partially_paid → paid, and only from the guarded code path.
CREATE OR REPLACE FUNCTION private.prevent_issued_invoice_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF OLD.status <> 'draft' THEN
    IF TG_OP = 'UPDATE'
       AND current_user = 'postgres'
       AND coalesce(current_setting('kovo.invoice_payment_sync', true), '') = 'on'
       AND (to_jsonb(NEW) - 'status') = (to_jsonb(OLD) - 'status')
       AND (OLD.status, NEW.status) IN (('issued','partially_paid'), ('issued','paid'), ('partially_paid','paid'), ('partially_paid','partially_paid'), ('issued','issued')) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'An issued invoice is immutable; use an authorized correction workflow.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

-- BEFORE INSERT on purpose: the invoice row is locked FOR UPDATE before the foreign-key check
-- takes its KEY SHARE lock, so two simultaneous payments queue up instead of deadlocking.
CREATE OR REPLACE FUNCTION private.sync_invoice_payment_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
  v public.invoices;
  v_paid bigint;
  v_new text;
BEGIN
  SELECT * INTO v FROM public.invoices WHERE id = NEW.invoice_id AND org_id = NEW.org_id FOR UPDATE;
  IF NOT FOUND OR v.status NOT IN ('issued','partially_paid') THEN
    RAISE EXCEPTION 'Solo se registran cobros de facturas emitidas pendientes de cobro' USING ERRCODE = 'KB001';
  END IF;
  SELECT coalesce(sum(amount_cents), 0) + NEW.amount_cents INTO v_paid FROM public.payments WHERE invoice_id = v.id AND org_id = v.org_id;
  IF v_paid > v.total_cents THEN
    RAISE EXCEPTION 'El cobro supera el importe pendiente de la factura' USING ERRCODE = 'KB002';
  END IF;
  v_new := CASE WHEN v_paid >= v.total_cents THEN 'paid' ELSE 'partially_paid' END;
  IF v_new <> v.status THEN
    PERFORM set_config('kovo.invoice_payment_sync', 'on', true);
    UPDATE public.invoices SET status = v_new WHERE id = v.id;
    PERFORM set_config('kovo.invoice_payment_sync', 'off', true);
  END IF;
  RETURN NEW;
END; $function$;
REVOKE ALL ON FUNCTION private.sync_invoice_payment_status() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER payments_sync_invoice_status BEFORE INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION private.sync_invoice_payment_status();

CREATE OR REPLACE FUNCTION public.record_invoice_payment(p_invoice_id uuid, p_amount_cents integer, p_method text, p_paid_at timestamptz DEFAULT now(), p_reference text DEFAULT NULL)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v public.invoices;
BEGIN
  SELECT * INTO v FROM public.invoices WHERE id = p_invoice_id;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT private.has_role(v.org_id, ARRAY['psychologa','gestoria']) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'El importe debe ser mayor que cero' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.payments(org_id, invoice_id, amount_cents, paid_at, method, reference)
  VALUES (v.org_id, v.id, p_amount_cents, coalesce(p_paid_at, now()), p_method, nullif(btrim(coalesce(p_reference, '')), ''));
  SELECT * INTO v FROM public.invoices WHERE id = p_invoice_id;
  RETURN v;
END;
$function$;

-- Draft invoices can be discarded (never issued ones). Lines go with them.
CREATE OR REPLACE FUNCTION public.delete_invoice_draft(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v public.invoices;
BEGIN
  SELECT * INTO v FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT private.has_role(v.org_id, ARRAY['psychologa','gestoria']) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  IF v.status <> 'draft' THEN
    RAISE EXCEPTION 'Solo se pueden descartar borradores' USING ERRCODE = 'KB003';
  END IF;
  DELETE FROM public.invoice_lines WHERE invoice_id = v.id AND org_id = v.org_id;
  DELETE FROM public.invoices WHERE id = v.id;
END;
$function$;

-- Appointment reminders (outbox) ------------------------------------------------------------------
-- Prepared, not sent: a pending reminder is queued 24 h before each scheduled/confirmed appointment
-- and cancelled when the appointment is cancelled or moved. Sending requires an e-mail/SMS provider
-- (external dependency, PROJECT_STATUS.md). No message content or patient data is stored here.
CREATE TABLE public.appointment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email','sms')),
  send_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (org_id, appointment_id) REFERENCES public.appointments(org_id, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX appointment_reminders_pending_uq ON public.appointment_reminders (appointment_id, channel) WHERE status = 'pending';
CREATE INDEX appointment_reminders_due_idx ON public.appointment_reminders (send_at) WHERE status = 'pending';
ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.appointment_reminders FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.appointment_reminders TO authenticated;
GRANT ALL ON public.appointment_reminders TO service_role;
CREATE POLICY appointment_reminders_read ON public.appointment_reminders FOR SELECT TO authenticated
  USING (private.has_role(org_id, ARRAY['psychologa','recepcion']));

CREATE OR REPLACE FUNCTION private.queue_appointment_reminder()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.starts_at IS NOT DISTINCT FROM OLD.starts_at AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  UPDATE public.appointment_reminders SET status = 'cancelled'
  WHERE appointment_id = NEW.id AND status = 'pending';
  IF NEW.status IN ('scheduled','confirmed') AND NEW.starts_at - interval '24 hours' > now() THEN
    INSERT INTO public.appointment_reminders(org_id, appointment_id, send_at)
    VALUES (NEW.org_id, NEW.id, NEW.starts_at - interval '24 hours');
  END IF;
  RETURN NEW;
END; $function$;
REVOKE ALL ON FUNCTION private.queue_appointment_reminder() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER appointments_queue_reminder AFTER INSERT OR UPDATE OF starts_at, status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION private.queue_appointment_reminder();

-- Traceability ----------------------------------------------------------------------------------
-- Audit rows record WHO changed WHAT entity and WHICH fields (names only, never values, so no
-- personal or clinical data is copied into the log).
CREATE OR REPLACE FUNCTION private.write_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_org uuid; v_id uuid; v_action text; v_changed jsonb := '[]'::jsonb;
BEGIN
  IF tg_op = 'DELETE' THEN v_org := old.org_id; v_id := old.id; v_action := 'delete';
  ELSIF tg_op = 'INSERT' THEN v_org := new.org_id; v_id := new.id; v_action := 'insert';
  ELSE
    v_org := new.org_id; v_id := new.id; v_action := 'update';
    SELECT coalesce(jsonb_agg(n.key ORDER BY n.key), '[]'::jsonb) INTO v_changed
    FROM jsonb_each(to_jsonb(new)) n JOIN jsonb_each(to_jsonb(old)) o USING (key)
    WHERE n.value IS DISTINCT FROM o.value AND n.key NOT IN ('updated_at');
  END IF;
  INSERT INTO public.audit_log(org_id, actor_id, action, entity_type, entity_id, metadata)
  VALUES (v_org, auth.uid(), v_action, tg_table_name, v_id,
          jsonb_build_object('source', 'database_trigger') || CASE WHEN v_action = 'update' THEN jsonb_build_object('changed', v_changed) ELSE '{}'::jsonb END);
  IF tg_op = 'DELETE' THEN RETURN old; ELSE RETURN new; END IF;
END;
$function$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['services','professionals','memberships','professional_availability','professional_time_off','invoice_lines','employees'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'audit_' || t, t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.write_audit_event()', 'audit_' || t, t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION private.audit_organization()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_changed jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(n.key ORDER BY n.key), '[]'::jsonb) INTO v_changed
  FROM jsonb_each(to_jsonb(NEW)) n JOIN jsonb_each(to_jsonb(OLD)) o USING (key)
  WHERE n.value IS DISTINCT FROM o.value AND n.key <> 'updated_at';
  INSERT INTO public.audit_log(org_id, actor_id, action, entity_type, entity_id, metadata)
  VALUES (NEW.id, auth.uid(), 'update', 'organizations', NEW.id, jsonb_build_object('source', 'database_trigger', 'changed', v_changed));
  RETURN NEW;
END; $function$;
REVOKE ALL ON FUNCTION private.audit_organization() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER audit_organizations AFTER UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION private.audit_organization();

-- Clinic administrators can read their clinic's audit trail too (baseline: psychologists only).
CREATE POLICY audit_log_admin_read ON public.audit_log FOR SELECT TO authenticated USING (private.is_org_admin(org_id));
