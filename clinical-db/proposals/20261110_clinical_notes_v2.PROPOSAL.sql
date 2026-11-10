-- KOVO — CLINICAL NOTES v2 — PROPOSAL ONLY (2026-11-10)
-- =============================================================================================
-- NOT an active migration. DO NOT run against production or any hosted Supabase project.
-- Keep it outside supabase/migrations. Validated only on disposable local PostgreSQL by
-- clinical-db/run-local.mjs, on top of the recovered baseline (with and without the backend
-- proposal PROPOSAL_ONLY_20261108.sql, whose save_clinical_note_draft replacement it keeps).
--
-- Goals (see clinical-db/README.md):
--   1. PostgreSQL is the authority for clinical-note integrity, whatever the write path:
--      patient/appointment in the same organization, appointment of the same patient,
--      appointment completed when a note is attached, immutable scope (org/patient/appointment),
--      signed/rectified notes immutable (existing trigger), rectifications append-only.
--   2. Idempotent saves with a caller-generated stable UUID (no duplicate on retries, including
--      concurrent retries) and optimistic concurrency with an incremental version.
--   3. Audit of create / update / delete / sign / rectify without clinical content.
--   4. Structured sections (jsonb) validated against a catalog, while `content` keeps the
--      existing "key: value" text so older clients and the sign/rectify RPCs keep working.
--      Historical notes are NOT converted: they stay 'legacy_text' until a psychologist edits
--      and saves them explicitly.
--   5. Authorship: signing no longer overwrites author_id; only the author signs her draft.
--
-- Error codes (SQLSTATE, PostgREST returns them in `code`):
--   42501 role/membership   KN001 patient not in org      KN002 appointment not of patient/org
--   KN003 note locked       KN004 not the author          KN005 version conflict (DETAIL: json)
--   KN006 note not found    KN007 invalid input           KN008 appointment not completed
--   KN009 scope mismatch    KN010 appointment patient change blocked
--   KN011 appointment status change blocked               KN012 structured note via legacy RPC
--   KN013 append-only record
-- =============================================================================================

-- ---------------------------------------------------------------------------------------------
-- 1. Data model: version, structured sections, format
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.clinical_notes
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sections jsonb,
  ADD COLUMN IF NOT EXISTS content_format text NOT NULL DEFAULT 'legacy_text';

ALTER TABLE public.clinical_notes
  ADD CONSTRAINT clinical_notes_version_positive CHECK (version >= 1),
  ADD CONSTRAINT clinical_notes_content_format_check CHECK (content_format IN ('legacy_text', 'sections_v1')),
  ADD CONSTRAINT clinical_notes_sections_shape CHECK (
    (content_format = 'legacy_text' AND sections IS NULL)
    OR (content_format = 'sections_v1' AND jsonb_typeof(sections) = 'object')
  );

-- Catalog of sections per note type. Adding a clinical field is a reviewed data change
-- (INSERT … active = true) plus the matching UI field; no schema change.
CREATE TABLE IF NOT EXISTS public.clinical_note_section_catalog (
  note_type text NOT NULL,
  section_key text NOT NULL,
  label text NOT NULL,
  position smallint NOT NULL,
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (note_type, section_key),
  CONSTRAINT clinical_note_section_key_format CHECK (section_key ~ '^[a-z][a-z_]{0,39}$'),
  CONSTRAINT clinical_note_section_type_known CHECK (note_type IN ('session', 'initial', 'progress', 'discharge'))
);

-- Active sections = the structure the clinic uses today (legacy.js FIELDS), unchanged.
-- Inactive rows are prepared fields from the T2D brief; they are rejected until a clinical
-- review activates them (and the UI shows them).
INSERT INTO public.clinical_note_section_catalog (note_type, section_key, label, position, active) VALUES
  ('session',   'objetivos',      'Objetivos abordados', 10, true),
  ('session',   'resumen',        'Resumen profesional de la sesión', 20, true),
  ('session',   'intervenciones', 'Técnicas o intervenciones realizadas', 30, true),
  ('session',   'observaciones',  'Observaciones y evolución', 40, true),
  ('session',   'acuerdos',       'Acuerdos y tareas para el paciente', 50, true),
  ('session',   'plan',           'Plan para la siguiente sesión', 60, true),
  ('session',   'evolucion',      'Evolución de la sesión', 70, false),
  ('session',   'proxima_sesion', 'Próxima sesión', 80, false),
  ('initial',   'motivo',         'Motivo de consulta', 10, true),
  ('initial',   'antecedentes',   'Antecedentes relevantes', 20, true),
  ('initial',   'evaluacion',     'Evaluación', 30, true),
  ('initial',   'formulacion',    'Hipótesis o formulación clínica', 40, true),
  ('initial',   'objetivos',      'Objetivos terapéuticos', 50, true),
  ('initial',   'plan',           'Plan de intervención', 60, true),
  ('progress',  'objetivos',      'Objetivos revisados', 10, true),
  ('progress',  'cambios',        'Cambios observados', 20, true),
  ('progress',  'valoracion',     'Valoración profesional', 30, true),
  ('progress',  'plan',           'Próximos pasos', 40, true),
  ('discharge', 'motivo',         'Motivo de cierre', 10, true),
  ('discharge', 'trabajo',        'Trabajo realizado', 20, true),
  ('discharge', 'logros',         'Objetivos alcanzados y pendientes', 30, true),
  ('discharge', 'recomendaciones','Recomendaciones', 40, true)
ON CONFLICT (note_type, section_key) DO NOTHING;

ALTER TABLE public.clinical_note_section_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.clinical_note_section_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.clinical_note_section_catalog TO authenticated;
GRANT ALL ON TABLE public.clinical_note_section_catalog TO service_role;
-- No patient data: any signed-in member may read the catalog (labels only).
CREATE POLICY clinical_note_section_catalog_read ON public.clinical_note_section_catalog
  FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------------------------
-- 2. Helpers: validation, normalization, rendering
-- ---------------------------------------------------------------------------------------------
-- Every active section present (missing ones as ''), only known active keys, text values.
CREATE OR REPLACE FUNCTION private.normalize_note_sections(p_note_type text, p_sections jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO ''
AS $function$
DECLARE
  v_key text;
  v_out jsonb := '{}'::jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.clinical_note_section_catalog c WHERE c.note_type = p_note_type AND c.active) THEN
    RAISE EXCEPTION 'Unknown clinical note type' USING ERRCODE = 'KN007';
  END IF;
  IF p_sections IS NULL OR jsonb_typeof(p_sections) <> 'object' THEN
    RAISE EXCEPTION 'Clinical note sections must be a JSON object' USING ERRCODE = 'KN007';
  END IF;
  FOR v_key IN SELECT jsonb_object_keys(p_sections) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.clinical_note_section_catalog c
                   WHERE c.note_type = p_note_type AND c.section_key = v_key AND c.active) THEN
      RAISE EXCEPTION 'Unknown or inactive section for this note type' USING ERRCODE = 'KN007';
    END IF;
    IF jsonb_typeof(p_sections -> v_key) <> 'string' THEN
      RAISE EXCEPTION 'Section values must be text' USING ERRCODE = 'KN007';
    END IF;
  END LOOP;
  SELECT jsonb_object_agg(c.section_key, coalesce(p_sections ->> c.section_key, ''))
    INTO v_out
    FROM public.clinical_note_section_catalog c
   WHERE c.note_type = p_note_type AND c.active;
  IF length(v_out::text) > 200000 THEN
    RAISE EXCEPTION 'Clinical note is too long' USING ERRCODE = 'KN007';
  END IF;
  RETURN v_out;
END;
$function$;

-- Same text format the application already writes and parses ("key: value", blank line between).
CREATE OR REPLACE FUNCTION private.render_note_sections(p_note_type text, p_sections jsonb)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO ''
AS $function$
  SELECT coalesce(string_agg(c.section_key || ': ' || coalesce(p_sections ->> c.section_key, ''), E'\n\n' ORDER BY c.position), '')
    FROM public.clinical_note_section_catalog c
   WHERE c.note_type = p_note_type AND (c.active OR p_sections ? c.section_key);
$function$;

-- ---------------------------------------------------------------------------------------------
-- 3. Integrity on every write path (table triggers, not only the RPC)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.guard_clinical_note_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_status text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id <> OLD.id OR NEW.org_id <> OLD.org_id OR NEW.patient_id <> OLD.patient_id
       OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id THEN
      RAISE EXCEPTION 'The organization, patient and appointment of a clinical note cannot change' USING ERRCODE = 'KN009';
    END IF;
    -- Authorship is kept; the only allowed change is to NULL (user deleted: FK ON DELETE SET NULL).
    IF NEW.author_id IS DISTINCT FROM OLD.author_id AND NEW.author_id IS NOT NULL THEN
      RAISE EXCEPTION 'The author of a clinical note cannot change' USING ERRCODE = 'KN004';
    END IF;
    -- A structured note edited through the legacy text RPC would desynchronize sections/content.
    IF OLD.content_format = 'sections_v1' AND NEW.sections IS NOT DISTINCT FROM OLD.sections
       AND NEW.content IS DISTINCT FROM OLD.content THEN
      RAISE EXCEPTION 'Structured clinical notes must be saved with save_clinical_note_draft_v2' USING ERRCODE = 'KN012';
    END IF;
    IF OLD.content_format = 'sections_v1' AND NEW.content_format <> 'sections_v1' THEN
      RAISE EXCEPTION 'Structured clinical notes cannot go back to legacy text' USING ERRCODE = 'KN012';
    END IF;
  END IF;

  IF NEW.appointment_id IS NOT NULL AND (TG_OP = 'INSERT') THEN
    -- FOR SHARE: a concurrent change of the appointment's patient/status waits for this insert.
    SELECT a.status INTO v_status
      FROM public.appointments a
     WHERE a.org_id = NEW.org_id AND a.id = NEW.appointment_id AND a.patient_id = NEW.patient_id
       FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Appointment must belong to the same patient and organization' USING ERRCODE = 'KN002';
    END IF;
    IF v_status <> 'completed' THEN
      RAISE EXCEPTION 'A clinical note can only be attached to a completed appointment' USING ERRCODE = 'KN008';
    END IF;
  END IF;

  IF NEW.content_format = 'sections_v1' AND (TG_OP = 'INSERT' OR NEW.sections IS DISTINCT FROM OLD.sections
                                             OR NEW.note_type IS DISTINCT FROM OLD.note_type
                                             OR OLD.content_format <> 'sections_v1') THEN
    NEW.sections := private.normalize_note_sections(NEW.note_type, NEW.sections);
    NEW.content := private.render_note_sections(NEW.note_type, NEW.sections);   -- content is derived
  END IF;
  RETURN NEW;
END;
$function$;

-- Version: computed by the database, never trusted from the caller.
CREATE OR REPLACE FUNCTION private.bump_clinical_note_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.version := 1;
    RETURN NEW;
  END IF;
  IF (NEW.content, NEW.sections, NEW.note_type, NEW.status, NEW.content_format, NEW.signed_at)
     IS DISTINCT FROM (OLD.content, OLD.sections, OLD.note_type, OLD.status, OLD.content_format, OLD.signed_at) THEN
    NEW.version := OLD.version + 1;
    NEW.updated_at := now();
  ELSE
    NEW.version := OLD.version;
  END IF;
  RETURN NEW;
END;
$function$;

-- BEFORE triggers fire in name order: clinical_notes_immutable (existing) → _integrity → _version.
DROP TRIGGER IF EXISTS clinical_notes_integrity ON public.clinical_notes;
CREATE TRIGGER clinical_notes_integrity BEFORE INSERT OR UPDATE ON public.clinical_notes
  FOR EACH ROW EXECUTE FUNCTION private.guard_clinical_note_integrity();
DROP TRIGGER IF EXISTS clinical_notes_version ON public.clinical_notes;
CREATE TRIGGER clinical_notes_version BEFORE INSERT OR UPDATE ON public.clinical_notes
  FOR EACH ROW EXECUTE FUNCTION private.bump_clinical_note_version();

-- Appointments with clinical documentation keep their patient and their completed status.
CREATE OR REPLACE FUNCTION private.guard_appointment_clinical_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.patient_id IS DISTINCT FROM OLD.patient_id OR (OLD.status = 'completed' AND NEW.status <> 'completed') THEN
    IF EXISTS (SELECT 1 FROM public.clinical_notes n WHERE n.org_id = OLD.org_id AND n.appointment_id = OLD.id) THEN
      IF NEW.patient_id IS DISTINCT FROM OLD.patient_id THEN
        RAISE EXCEPTION 'This appointment has clinical documentation: its patient cannot change' USING ERRCODE = 'KN010';
      END IF;
      RAISE EXCEPTION 'This appointment has clinical documentation: it must stay completed' USING ERRCODE = 'KN011';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS appointments_clinical_link ON public.appointments;
CREATE TRIGGER appointments_clinical_link BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION private.guard_appointment_clinical_link();

-- Rectifications never modify the original note and are themselves append-only.
CREATE OR REPLACE FUNCTION private.prevent_append_only_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = 'KN013';
END;
$function$;
DROP TRIGGER IF EXISTS clinical_note_rectifications_append_only ON public.clinical_note_rectifications;
CREATE TRIGGER clinical_note_rectifications_append_only BEFORE UPDATE OR DELETE ON public.clinical_note_rectifications
  FOR EACH ROW EXECUTE FUNCTION private.prevent_append_only_change();

-- ---------------------------------------------------------------------------------------------
-- 4. Audit (no clinical content: ids, version, status, type and the NAMES of changed sections)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.audit_clinical_note()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  r public.clinical_notes;
  v_action text;
  v_changed text[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    r := OLD; v_action := 'clinical_note.draft_deleted';
  ELSIF TG_OP = 'INSERT' THEN
    r := NEW; v_action := 'clinical_note.draft_created';
  ELSE
    r := NEW;
    IF NEW.version = OLD.version AND NEW.status = OLD.status THEN
      RETURN NULL;                                   -- nothing changed: nothing to audit
    END IF;
    v_action := CASE WHEN NEW.status <> OLD.status THEN 'clinical_note.' || NEW.status ELSE 'clinical_note.draft_updated' END;
    IF NEW.sections IS NOT NULL THEN
      SELECT array_agg(k ORDER BY k) INTO v_changed
        FROM jsonb_object_keys(NEW.sections) AS k
       WHERE (OLD.sections -> k) IS DISTINCT FROM (NEW.sections -> k);
    ELSIF NEW.content IS DISTINCT FROM OLD.content THEN
      v_changed := ARRAY['content'];
    END IF;
  END IF;
  INSERT INTO public.audit_log (org_id, actor_id, action, entity_type, entity_id, metadata)
  VALUES (r.org_id, auth.uid(), v_action, 'clinical_note', r.id, jsonb_build_object(
    'source', 'clinical_notes_trigger',
    'version', r.version,
    'previous_version', CASE WHEN TG_OP = 'UPDATE' THEN OLD.version END,
    'status', r.status,
    'note_type', r.note_type,
    'patient_id', r.patient_id,
    'appointment_id', r.appointment_id,
    'content_format', r.content_format,
    'changed_sections', to_jsonb(coalesce(v_changed, ARRAY[]::text[]))
  ));
  RETURN NULL;
END;
$function$;
DROP TRIGGER IF EXISTS audit_clinical_notes ON public.clinical_notes;
CREATE TRIGGER audit_clinical_notes AFTER INSERT OR UPDATE OR DELETE ON public.clinical_notes
  FOR EACH ROW EXECUTE FUNCTION private.audit_clinical_note();

CREATE OR REPLACE FUNCTION private.audit_clinical_note_rectification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.audit_log (org_id, actor_id, action, entity_type, entity_id, metadata)
  VALUES (NEW.org_id, auth.uid(), 'clinical_note.rectified', 'clinical_note', NEW.note_id,
          jsonb_build_object('source', 'clinical_note_rectifications_trigger', 'rectification_id', NEW.id));
  RETURN NULL;
END;
$function$;
DROP TRIGGER IF EXISTS audit_clinical_note_rectifications ON public.clinical_note_rectifications;
CREATE TRIGGER audit_clinical_note_rectifications AFTER INSERT ON public.clinical_note_rectifications
  FOR EACH ROW EXECUTE FUNCTION private.audit_clinical_note_rectification();

-- Sign/rectify: same behaviour, but the audit rows now come from the triggers (no duplicates)
-- and signing keeps the original author (only the author can sign her own draft).
CREATE OR REPLACE FUNCTION private.sign_clinical_note(p_note uuid)
RETURNS public.clinical_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v public.clinical_notes;
BEGIN
  SELECT * INTO v FROM public.clinical_notes WHERE id = p_note FOR UPDATE;
  IF NOT FOUND OR NOT private.has_role(v.org_id, ARRAY['psychologa']) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v.status <> 'draft' THEN RAISE EXCEPTION 'Only draft notes can be signed' USING ERRCODE = 'KN003'; END IF;
  IF v.author_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the author can sign this draft' USING ERRCODE = 'KN004'; END IF;
  UPDATE public.clinical_notes SET status = 'signed', signed_at = now() WHERE id = p_note RETURNING * INTO v;
  RETURN v;
END;
$function$;

CREATE OR REPLACE FUNCTION private.rectify_clinical_note(p_note uuid, p_reason text, p_replacement text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v public.clinical_notes; new_id uuid;
BEGIN
  SELECT * INTO v FROM public.clinical_notes WHERE id = p_note FOR UPDATE;
  IF NOT FOUND OR NOT private.has_role(v.org_id, ARRAY['psychologa']) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v.status <> 'signed' THEN RAISE EXCEPTION 'Only signed notes can be rectified' USING ERRCODE = 'KN003'; END IF;
  IF length(trim(coalesce(p_reason, ''))) < 10 OR length(trim(coalesce(p_replacement, ''))) = 0 THEN
    RAISE EXCEPTION 'A reason and replacement text are required' USING ERRCODE = 'KN007';
  END IF;
  INSERT INTO public.clinical_note_rectifications (org_id, note_id, author_id, reason, replacement_text)
  VALUES (v.org_id, v.id, auth.uid(), p_reason, p_replacement) RETURNING id INTO new_id;
  RETURN new_id;
END;
$function$;

-- ---------------------------------------------------------------------------------------------
-- 5. Draft RPC v2: stable client UUID + optimistic concurrency. Returns the confirmed row.
-- ---------------------------------------------------------------------------------------------
-- p_expected_version NULL  → "creating": insert with p_note_id, or (retry after a lost response)
--                             continue the same author's draft with that id.
-- p_expected_version = N   → "editing version N": conflict (KN005) if the stored version differs,
--                             unless the stored sections are exactly the ones sent (retry of an
--                             already-applied save), which returns the stored row.
CREATE OR REPLACE FUNCTION public.save_clinical_note_draft_v2(
  p_note_id uuid,
  p_org_id uuid,
  p_patient_id uuid,
  p_appointment_id uuid,
  p_note_type text,
  p_sections jsonb,
  p_expected_version integer DEFAULT NULL
)
RETURNS public.clinical_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v public.clinical_notes;
  v_type text := coalesce(nullif(p_note_type, ''), 'session');
  v_sections jsonb;
BEGIN
  IF auth.uid() IS NULL OR p_org_id IS NULL OR NOT private.has_role(p_org_id, ARRAY['psychologa']) THEN
    RAISE EXCEPTION 'Not authorized to manage clinical notes' USING ERRCODE = '42501';
  END IF;
  IF p_note_id IS NULL OR p_patient_id IS NULL THEN
    RAISE EXCEPTION 'A stable note id and a patient are required' USING ERRCODE = 'KN007';
  END IF;
  IF p_expected_version IS NOT NULL AND p_expected_version < 1 THEN
    RAISE EXCEPTION 'Invalid expected version' USING ERRCODE = 'KN007';
  END IF;
  v_sections := private.normalize_note_sections(v_type, p_sections);

  IF NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.org_id = p_org_id AND p.id = p_patient_id) THEN
    RAISE EXCEPTION 'Patient does not belong to this organization' USING ERRCODE = 'KN001';
  END IF;

  SELECT * INTO v FROM public.clinical_notes WHERE id = p_note_id FOR UPDATE;
  IF NOT FOUND THEN
    IF p_expected_version IS NOT NULL THEN
      RAISE EXCEPTION 'Clinical note not found' USING ERRCODE = 'KN006';
    END IF;
    INSERT INTO public.clinical_notes (id, org_id, patient_id, appointment_id, author_id, note_type,
                                       content, sections, content_format, status)
    VALUES (p_note_id, p_org_id, p_patient_id, p_appointment_id, auth.uid(), v_type,
            '', v_sections, 'sections_v1', 'draft')
    ON CONFLICT (id) DO NOTHING
    RETURNING * INTO v;
    IF v.id IS NOT NULL THEN
      RETURN v;
    END IF;
    -- A concurrent request with the same id inserted it first: continue with that row.
    SELECT * INTO v FROM public.clinical_notes WHERE id = p_note_id FOR UPDATE;
  END IF;

  -- The id may belong to another organization: answer exactly as if it did not exist.
  IF v.org_id <> p_org_id THEN
    RAISE EXCEPTION 'Clinical note not found' USING ERRCODE = 'KN006';
  END IF;
  IF v.patient_id <> p_patient_id OR v.appointment_id IS DISTINCT FROM p_appointment_id THEN
    RAISE EXCEPTION 'This clinical note belongs to a different patient or appointment' USING ERRCODE = 'KN009';
  END IF;
  IF v.status <> 'draft' OR v.signed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Signed or rectified clinical notes cannot be modified' USING ERRCODE = 'KN003';
  END IF;
  IF v.author_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the author can edit this draft' USING ERRCODE = 'KN004';
  END IF;

  IF v.content_format = 'sections_v1' AND v.note_type = v_type AND v.sections = v_sections THEN
    RETURN v;                                        -- identical: idempotent, no new version
  END IF;
  IF p_expected_version IS NOT NULL AND v.version <> p_expected_version THEN
    RAISE EXCEPTION 'The draft was modified in another session'
      USING ERRCODE = 'KN005', DETAIL = json_build_object('current_version', v.version)::text;
  END IF;

  UPDATE public.clinical_notes
     SET sections = v_sections, note_type = v_type, content_format = 'sections_v1'
   WHERE id = v.id
  RETURNING * INTO v;
  RETURN v;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_clinical_note_draft_v2(uuid, uuid, uuid, uuid, text, jsonb, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_clinical_note_draft_v2(uuid, uuid, uuid, uuid, text, jsonb, integer) TO authenticated;
REVOKE ALL ON FUNCTION private.normalize_note_sections(text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.render_note_sections(text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.guard_clinical_note_integrity() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.bump_clinical_note_version() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.guard_appointment_clinical_link() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.prevent_append_only_change() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.audit_clinical_note() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.audit_clinical_note_rectification() FROM PUBLIC, anon, authenticated, service_role;
