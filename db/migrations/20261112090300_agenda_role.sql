-- KOVO · 20261112090300 · Calendar-only role `agenda` (interfaz v3, «solo calendario»).
--
-- Someone who only needs to see when the professionals are busy (e.g. a shared front desk):
--   * reads the calendar through public.agenda_calendar(): times, status, patient CODE (and its
--     opaque id, to group appointments), service and modality. Never patient names or contact data, administrative notes, clinical
--     notes, documents, invoices or expenses;
--   * gets no new table policy: every existing policy lists its roles explicitly, so `agenda`
--     reads nothing directly except what any member reads (clinic name, team list, services,
--     professionals, weekly availability and closed days, subscription, own support tickets);
--   * writes nothing (no write policy names it).
-- Generated: invite_member and update_membership are the versions of 20261111090200 with the role
-- list extended; nothing else changes in them.

ALTER TABLE public.memberships DROP CONSTRAINT IF EXISTS memberships_role_check;
ALTER TABLE public.memberships ADD CONSTRAINT memberships_role_check CHECK (role IN ('psychologa','recepcion','gestoria','agenda'));
ALTER TABLE public.org_invitations DROP CONSTRAINT IF EXISTS org_invitations_role_check;
ALTER TABLE public.org_invitations ADD CONSTRAINT org_invitations_role_check CHECK (role IN ('psychologa','recepcion','gestoria','agenda'));

CREATE OR REPLACE FUNCTION public.invite_member(p_org_id uuid, p_email text, p_role text, p_is_admin boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_token text;
  v_id uuid;
  v_email text := lower(btrim(coalesce(p_email, '')));
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_org_admin(p_org_id) THEN
    RAISE EXCEPTION 'Solo la administración de la clínica puede invitar' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('psychologa','recepcion','gestoria','agenda') THEN
    RAISE EXCEPTION 'Rol no válido' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.memberships m JOIN auth.users u ON u.id = m.user_id
    WHERE m.org_id = p_org_id AND lower(u.email) = v_email AND m.active
  ) THEN
    RAISE EXCEPTION 'Esa persona ya forma parte del equipo' USING ERRCODE = 'KT001';
  END IF;
  PERFORM private.assert_plan_limit(p_org_id, 'members', 1);
  -- A new invitation to the same address replaces the pending one.
  UPDATE public.org_invitations SET revoked_at = now()
  WHERE org_id = p_org_id AND lower(email) = v_email AND accepted_at IS NULL AND revoked_at IS NULL;
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  INSERT INTO public.org_invitations(org_id, email, role, is_admin, token_hash, invited_by)
  VALUES (p_org_id, v_email, p_role, coalesce(p_is_admin, false), encode(extensions.digest(v_token, 'sha256'), 'hex'), auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO public.audit_log(org_id, actor_id, action, entity_type, entity_id, metadata)
  VALUES (p_org_id, auth.uid(), 'invite', 'org_invitation', v_id, jsonb_build_object('role', p_role, 'is_admin', coalesce(p_is_admin, false)));
  RETURN jsonb_build_object('id', v_id, 'token', v_token);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_membership(p_membership_id uuid, p_role text DEFAULT NULL, p_active boolean DEFAULT NULL, p_is_admin boolean DEFAULT NULL)
RETURNS public.memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v public.memberships;
  v_new public.memberships;
BEGIN
  SELECT * INTO v FROM public.memberships WHERE id = p_membership_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT private.is_org_admin(v.org_id) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  IF p_role IS NOT NULL AND p_role NOT IN ('psychologa','recepcion','gestoria','agenda') THEN
    RAISE EXCEPTION 'Rol no válido' USING ERRCODE = '22023';
  END IF;
  IF v.user_id = auth.uid() AND (p_active IS false OR p_is_admin IS false) THEN
    RAISE EXCEPTION 'No puedes quitarte a ti mismo la administración ni desactivarte' USING ERRCODE = 'KT005';
  END IF;
  IF p_active IS true AND NOT v.active THEN
    PERFORM private.assert_plan_limit(v.org_id, 'members', 1);
  END IF;
  UPDATE public.memberships
  SET role = coalesce(p_role, role), active = coalesce(p_active, active), is_admin = coalesce(p_is_admin, is_admin), updated_at = now()
  WHERE id = v.id RETURNING * INTO v_new;
  IF NOT EXISTS (SELECT 1 FROM public.memberships WHERE org_id = v.org_id AND active AND is_admin) THEN
    RAISE EXCEPTION 'La clínica debe conservar al menos una persona administradora' USING ERRCODE = 'KT006';
  END IF;
  INSERT INTO public.audit_log(org_id, actor_id, action, entity_type, entity_id, metadata)
  VALUES (v.org_id, auth.uid(), 'update', 'membership', v.id, jsonb_build_object(
    'role', jsonb_build_array(v.role, v_new.role), 'active', jsonb_build_array(v.active, v_new.active),
    'is_admin', jsonb_build_array(v.is_admin, v_new.is_admin)));
  RETURN v_new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.agenda_calendar(p_org_id uuid, p_from date, p_to date)
RETURNS TABLE (id uuid, professional_id uuid, patient_id uuid, service_id uuid, starts_at timestamptz, ends_at timestamptz,
               status text, patient_code text, service_name text, modality text, updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_role(p_org_id, ARRAY['psychologa','recepcion','agenda']) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from OR p_to - p_from > 400 THEN
    RAISE EXCEPTION 'Intervalo no válido (máximo 400 días)' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT a.id, a.professional_id, a.patient_id, a.service_id, a.starts_at, a.ends_at, a.status, p.patient_code, s.name, a.modality, a.updated_at
    FROM public.appointments a
    JOIN public.patients p ON p.org_id = a.org_id AND p.id = a.patient_id
    LEFT JOIN public.services s ON s.org_id = a.org_id AND s.id = a.service_id
    WHERE a.org_id = p_org_id
      AND a.starts_at >= (p_from::timestamp AT TIME ZONE 'Europe/Madrid')
      AND a.starts_at < ((p_to + 1)::timestamp AT TIME ZONE 'Europe/Madrid')
    ORDER BY a.starts_at, a.id;
END; $function$;
REVOKE ALL ON FUNCTION public.agenda_calendar(uuid, date, date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.agenda_calendar(uuid, date, date) TO authenticated;
