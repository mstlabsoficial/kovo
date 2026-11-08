-- Recovered verbatim from supabase_migrations.schema_migrations.
-- Original applied version: 20261108000745
-- Original migration name: fix_invoice_line_move_guard
-- Archival copy only; see README before replaying.

CREATE OR REPLACE FUNCTION private.prevent_issued_invoice_line_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  v_old_status text;
  v_new_status text;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    SELECT status INTO v_old_status
    FROM public.invoices
    WHERE id = OLD.invoice_id AND org_id = OLD.org_id;
    IF v_old_status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'Invoice lines cannot be changed or removed after issue.';
    END IF;
  END IF;

  IF TG_OP IN ('INSERT','UPDATE') THEN
    SELECT status INTO v_new_status
    FROM public.invoices
    WHERE id = NEW.invoice_id AND org_id = NEW.org_id;
    IF v_new_status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'Invoice lines can only be added to draft invoices.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;
