-- KOVO · 20261112090100 · Diagnoses and psychological tests (interfaz v3, ficha › Clínico).
--
-- Clinical data, same regime as clinical notes:
--   * only psychologists of the clinic read or write them (reception, accounting and the
--     calendar-only role never see them; KOVO staff neither);
--   * nothing is physically deleted: "Eliminar" sets retired_at (clinical history must be kept,
--     Ley 41/2002 art. 17). Rows cannot be hard-deleted by the clinic;
--   * every insert/update is audited with field NAMES only (private.write_audit_event);
--   * writes are blocked while the clinic account is suspended (private.guard_org_writable).
-- A test's file, if any, lives in patient_documents (private Storage); the test only points to it.

CREATE TABLE public.patient_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  test_date date NOT NULL,
  result text NOT NULL DEFAULT '' CHECK (length(result) <= 4000),
  document_id uuid,
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, patient_id) REFERENCES public.patients(org_id, id),
  FOREIGN KEY (document_id) REFERENCES public.patient_documents(id)
);
CREATE INDEX patient_tests_org_patient_idx ON public.patient_tests (org_id, patient_id, test_date);

CREATE TABLE public.patient_diagnoses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 300),
  diagnosis_date date NOT NULL,
  rationale text NOT NULL DEFAULT '' CHECK (length(rationale) <= 4000),
  test_ids uuid[] NOT NULL DEFAULT '{}' CHECK (cardinality(test_ids) <= 50),
  author_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text CHECK (author_name IS NULL OR length(author_name) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  FOREIGN KEY (org_id, patient_id) REFERENCES public.patients(org_id, id)
);
CREATE INDEX patient_diagnoses_org_patient_idx ON public.patient_diagnoses (org_id, patient_id, diagnosis_date);

-- The tests a diagnosis cites must be tests of the same patient and clinic; the document of a
-- test must be a document of the same patient. Identity columns never change.
CREATE OR REPLACE FUNCTION private.guard_clinical_dx()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  IF tg_op = 'UPDATE' AND (new.org_id <> old.org_id OR new.patient_id <> old.patient_id OR new.id <> old.id) THEN
    RAISE EXCEPTION 'La clínica y el paciente no se pueden cambiar' USING ERRCODE = 'KC001';
  END IF;
  IF tg_op = 'UPDATE' AND old.retired_at IS NOT NULL THEN
    RAISE EXCEPTION 'Un registro retirado no se puede modificar' USING ERRCODE = 'KC002';
  END IF;
  IF tg_table_name = 'patient_diagnoses' THEN
    IF EXISTS (SELECT 1 FROM unnest(new.test_ids) t(id)
               WHERE NOT EXISTS (SELECT 1 FROM public.patient_tests x WHERE x.id = t.id AND x.org_id = new.org_id AND x.patient_id = new.patient_id)) THEN
      RAISE EXCEPTION 'Las pruebas citadas deben ser del mismo paciente' USING ERRCODE = 'KC003';
    END IF;
  ELSIF new.document_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.patient_documents d WHERE d.id = new.document_id AND d.org_id = new.org_id AND d.patient_id = new.patient_id) THEN
    RAISE EXCEPTION 'El documento debe ser del mismo paciente' USING ERRCODE = 'KC003';
  END IF;
  new.updated_at := now();
  RETURN new;
END; $function$;
REVOKE ALL ON FUNCTION private.guard_clinical_dx() FROM PUBLIC, anon, authenticated, service_role;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['patient_tests','patient_diagnoses'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO authenticated', t);   -- no DELETE: retirement only
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format($p$CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (private.has_role(org_id, ARRAY['psychologa']))$p$, t || '_read', t);
    EXECUTE format($p$CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (private.has_role(org_id, ARRAY['psychologa']) AND retired_at IS NULL)$p$, t || '_insert', t);
    EXECUTE format($p$CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (private.has_role(org_id, ARRAY['psychologa'])) WITH CHECK (private.has_role(org_id, ARRAY['psychologa']))$p$, t || '_update', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.guard_clinical_dx()', t || '_guard', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.guard_org_writable()', t || '_org_writable', t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.write_audit_event()', 'audit_' || t, t);
  END LOOP;
END $$;

COMMENT ON TABLE public.patient_tests IS 'Psychological tests and results (clinical data: psychologists only; retired, never deleted).';
COMMENT ON TABLE public.patient_diagnoses IS 'Diagnoses with rationale and cited tests (clinical data: psychologists only; retired, never deleted).';
