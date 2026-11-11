-- KOVO · 20261112090400 · Audit of patient data exports (ficha › «Exportar datos»).
--
-- The export itself is generated in the browser from data the psychologist can already read; nothing
-- is sent to the server. This function only leaves a trace in public.audit_log of WHO exported WHICH
-- patient and WHEN (RGPD art. 15 / accountability). It stores no personal or clinical data: the
-- metadata holds only the section names and row counts the browser reports.
--
-- Allowed while the clinic account is suspended (exporting is a read; suspension must not prevent a
-- patient's access request). Psychologists only, same as the export button.

CREATE OR REPLACE FUNCTION public.log_patient_export(p_patient_id uuid, p_counts jsonb DEFAULT '{}'::jsonb)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
  v_org uuid;
  v_at timestamptz := now();
  v_counts jsonb := '{}'::jsonb;
  k text; v jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501'; END IF;
  SELECT org_id INTO v_org FROM public.patients WHERE id = p_patient_id;
  IF v_org IS NULL OR NOT private.has_role(v_org, ARRAY['psychologa']) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  -- Only known section names with small non-negative integer counts are kept.
  IF jsonb_typeof(p_counts) = 'object' THEN
    FOR k, v IN SELECT * FROM jsonb_each(p_counts) LOOP
      IF k = ANY (ARRAY['citas','informes','pruebas','diagnosticos','facturas','documentos'])
         AND jsonb_typeof(v) = 'number' AND (v #>> '{}')::numeric BETWEEN 0 AND 100000
         AND (v #>> '{}')::numeric = trunc((v #>> '{}')::numeric) THEN
        v_counts := v_counts || jsonb_build_object(k, (v #>> '{}')::int);
      END IF;
    END LOOP;
  END IF;
  INSERT INTO public.audit_log(org_id, actor_id, action, entity_type, entity_id, metadata, created_at)
  VALUES (v_org, auth.uid(), 'patient.export', 'patient', p_patient_id, jsonb_build_object('secciones', v_counts), v_at);
  RETURN v_at;
END; $function$;
REVOKE ALL ON FUNCTION public.log_patient_export(uuid, jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.log_patient_export(uuid, jsonb) TO authenticated;
