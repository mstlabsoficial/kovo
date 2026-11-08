-- Recovered verbatim from supabase_migrations.schema_migrations.
-- Original applied version: 20261108000732
-- Original migration name: restrict_employee_access_and_lock_issued_invoices
-- Archival copy only; see README before replaying.

-- Gestoría no debe acceder a datos identificativos de empleados en esta fase.
DROP POLICY IF EXISTS employees_finance_all ON public.employees;
DROP POLICY IF EXISTS employees_psychologist_all ON public.employees;
CREATE POLICY employees_psychologist_all
ON public.employees
FOR ALL TO authenticated
USING (private.has_role(org_id, ARRAY['psychologa']))
WITH CHECK (private.has_role(org_id, ARRAY['psychologa']));

-- Bloqueo de facturas emitidas y sus líneas.
CREATE OR REPLACE FUNCTION private.prevent_issued_invoice_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'An issued invoice is immutable; use an authorized correction workflow.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS invoices_immutable_after_issue ON public.invoices;
CREATE TRIGGER invoices_immutable_after_issue
BEFORE UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION private.prevent_issued_invoice_mutation();

CREATE OR REPLACE FUNCTION private.prevent_issued_invoice_line_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  old_is_issued boolean := false;
  new_is_issued boolean := false;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    SELECT (i.status <> 'draft') INTO old_is_issued
    FROM public.invoices i WHERE i.id = OLD.invoice_id AND i.org_id = OLD.org_id;
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN
    SELECT (i.status <> 'draft') INTO new_is_issued
    FROM public.invoices i WHERE i.id = NEW.invoice_id AND i.org_id = NEW.org_id;
  END IF;
  IF coalesce(old_is_issued,false) OR coalesce(new_is_issued,false) THEN
    RAISE EXCEPTION 'Invoice lines are immutable after invoice issue.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS invoice_lines_immutable_after_issue ON public.invoice_lines;
CREATE TRIGGER invoice_lines_immutable_after_issue
BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_lines
FOR EACH ROW EXECUTE FUNCTION private.prevent_issued_invoice_line_mutation();
