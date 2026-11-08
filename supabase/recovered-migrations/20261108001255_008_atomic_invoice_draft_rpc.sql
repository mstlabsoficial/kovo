-- Recovered verbatim from supabase_migrations.schema_migrations.
-- Original applied version: 20261108001255
-- Original migration name: 008_atomic_invoice_draft_rpc
-- Archival copy only; see README before replaying.

CREATE OR REPLACE FUNCTION public.save_invoice_draft(
 p_org_id uuid,p_patient_id uuid,p_issue_date date,p_due_date date,p_lines jsonb,p_legacy_id text DEFAULT NULL,p_retention_cents integer DEFAULT 0
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_id uuid; v_subtotal bigint:=0; v_tax bigint:=0; v_total bigint:=0; v_line jsonb; v_qty numeric; v_unit integer; v_rate numeric; v_base bigint; v_line_total bigint;
BEGIN
 IF auth.uid() IS NULL OR NOT private.has_role(p_org_id,ARRAY['psychologa','gestoria']) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 IF p_lines IS NULL OR jsonb_typeof(p_lines)<>'array' OR jsonb_array_length(p_lines)=0 THEN RAISE EXCEPTION 'At least one invoice line is required'; END IF;
 INSERT INTO public.invoices(org_id,patient_id,invoice_number,issue_date,due_date,status,subtotal_cents,tax_cents,total_cents,retention_cents,legacy_id)
 VALUES(p_org_id,p_patient_id,NULL,coalesce(p_issue_date,current_date),p_due_date,'draft',0,0,0,greatest(coalesce(p_retention_cents,0),0),p_legacy_id)
 RETURNING id INTO v_id;
 FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
   v_qty:=(v_line->>'quantity')::numeric;
   v_unit:=(v_line->>'unit_price_cents')::integer;
   v_rate:=coalesce((v_line->>'tax_rate')::numeric,0);
   IF v_qty<=0 OR v_unit<0 OR v_rate<0 OR v_rate>100 THEN RAISE EXCEPTION 'Invalid invoice line'; END IF;
   v_base:=round(v_qty*v_unit);
   v_line_total:=round(v_base*(1+v_rate/100));
   v_subtotal:=v_subtotal+v_base; v_tax:=v_tax+(v_line_total-v_base);
   INSERT INTO public.invoice_lines(org_id,invoice_id,description,quantity,unit_price_cents,tax_rate,line_total_cents)
   VALUES(p_org_id,v_id,coalesce(v_line->>'description','Servicio'),v_qty,v_unit,v_rate,v_line_total);
 END LOOP;
 v_total:=v_subtotal+v_tax-greatest(coalesce(p_retention_cents,0),0);
 IF v_total<0 THEN RAISE EXCEPTION 'Invoice total cannot be negative'; END IF;
 UPDATE public.invoices SET subtotal_cents=v_subtotal,tax_cents=v_tax,total_cents=v_total WHERE id=v_id;
 RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.save_invoice_draft(uuid,uuid,date,date,jsonb,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_invoice_draft(uuid,uuid,date,date,jsonb,text,integer) TO authenticated;
