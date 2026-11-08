-- Recovered verbatim from supabase_migrations.schema_migrations.
-- Original applied version: 20261108001145
-- Original migration name: 006_legacy_mapping_and_clinical_draft_workflow
-- Archival copy only; see README before replaying.

ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS legacy_id text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS profile_data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS tax_exempt boolean NOT NULL DEFAULT false;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS legacy_id text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS modality text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS price_cents integer NOT NULL DEFAULT 0;
ALTER TABLE public.invoices ALTER COLUMN invoice_number DROP NOT NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS legacy_id text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS series text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS retention_cents integer NOT NULL DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS legacy_status text;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS legacy_id text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS legacy_id text;

CREATE UNIQUE INDEX IF NOT EXISTS patients_org_legacy_id_uq ON public.patients(org_id,legacy_id) WHERE legacy_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS appointments_org_legacy_id_uq ON public.appointments(org_id,legacy_id) WHERE legacy_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_org_legacy_id_uq ON public.invoices(org_id,legacy_id) WHERE legacy_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS expenses_org_legacy_id_uq ON public.expenses(org_id,legacy_id) WHERE legacy_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS services_org_legacy_id_uq ON public.services(org_id,legacy_id) WHERE legacy_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.save_clinical_note_draft(
  p_org_id uuid, p_patient_id uuid, p_appointment_id uuid, p_note_type text, p_content text, p_note_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_role(p_org_id, ARRAY['psychologa']) THEN
    RAISE EXCEPTION 'Not authorized to manage clinical notes' USING ERRCODE='42501';
  END IF;
  IF p_content IS NULL OR length(trim(p_content))=0 THEN
    RAISE EXCEPTION 'Clinical note content cannot be empty';
  END IF;
  IF p_note_id IS NULL THEN
    INSERT INTO public.clinical_notes(org_id,patient_id,appointment_id,author_id,note_type,content,status)
    VALUES(p_org_id,p_patient_id,p_appointment_id,auth.uid(),coalesce(nullif(p_note_type,''),'session'),p_content,'draft')
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.clinical_notes
      SET content=p_content,note_type=coalesce(nullif(p_note_type,''),'session'),updated_at=now()
      WHERE id=p_note_id AND org_id=p_org_id AND author_id=auth.uid() AND status='draft'
      RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Draft not found or not editable'; END IF;
  END IF;
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.save_clinical_note_draft(uuid,uuid,uuid,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_clinical_note_draft(uuid,uuid,uuid,text,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_clinical_note_draft(p_org_id uuid,p_note_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_role(p_org_id, ARRAY['psychologa']) THEN
    RAISE EXCEPTION 'Not authorized to manage clinical notes' USING ERRCODE='42501';
  END IF;
  DELETE FROM public.clinical_notes
  WHERE id=p_note_id AND org_id=p_org_id AND author_id=auth.uid() AND status='draft';
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft not found or not deletable'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.delete_clinical_note_draft(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_clinical_note_draft(uuid,uuid) TO authenticated;
