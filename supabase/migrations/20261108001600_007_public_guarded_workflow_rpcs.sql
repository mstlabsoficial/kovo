-- Public PostgREST wrappers for the private, authorization-checked workflow functions.
CREATE OR REPLACE FUNCTION public.sign_clinical_note(p_note uuid)
RETURNS public.clinical_notes
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v public.clinical_notes;
BEGIN
  SELECT * INTO v FROM public.clinical_notes WHERE id=p_note FOR UPDATE;
  IF NOT FOUND OR NOT private.has_role(v.org_id,ARRAY['psychologa']) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN private.sign_clinical_note(p_note);
END; $$;
REVOKE ALL ON FUNCTION public.sign_clinical_note(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sign_clinical_note(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.rectify_clinical_note(p_note uuid,p_reason text,p_replacement text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v public.clinical_notes;
BEGIN
  SELECT * INTO v FROM public.clinical_notes WHERE id=p_note;
  IF NOT FOUND OR NOT private.has_role(v.org_id,ARRAY['psychologa']) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN private.rectify_clinical_note(p_note,p_reason,p_replacement);
END; $$;
REVOKE ALL ON FUNCTION public.rectify_clinical_note(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rectify_clinical_note(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.emit_invoice(p_invoice uuid)
RETURNS public.invoices
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v public.invoices;
BEGIN
  SELECT * INTO v FROM public.invoices WHERE id=p_invoice FOR UPDATE;
  IF NOT FOUND OR NOT private.has_role(v.org_id,ARRAY['psychologa','gestoria']) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN private.emit_invoice(p_invoice);
END; $$;
REVOKE ALL ON FUNCTION public.emit_invoice(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.emit_invoice(uuid) TO authenticated;
