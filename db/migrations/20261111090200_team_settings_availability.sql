-- KOVO · 20261111090200 · Clinic configuration, team, invitations and professional availability.
--
-- Closes the write gaps of the recovered baseline (gap inventory in PROJECT_STATUS.md):
--   * services / professionals had INSERT/UPDATE grants but only SELECT policies (writes blocked);
--   * organizations and memberships were read-only (no settings, no team management).
-- Rules:
--   * clinic data (name, timezone, settings) and the team: clinic administrators (is_admin);
--   * services: psychologists (the role that already manages configuration in the app);
--   * professionals: administrators; a professional may edit their own profile row;
--   * availability / time off: administrators, or the professional linked to the row;
--   * memberships are never written directly: invitations + RPCs with explicit guards.

-- Organizations: only safe columns are updatable, only by administrators -------------------------
GRANT UPDATE (name, timezone, settings) ON public.organizations TO authenticated;
CREATE POLICY organizations_admin_update ON public.organizations
  FOR UPDATE TO authenticated
  USING (private.is_org_admin(id))
  WITH CHECK (private.is_org_admin(id) AND private.org_writable(id));

CREATE OR REPLACE FUNCTION private.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $function$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $function$;
REVOKE ALL ON FUNCTION private.touch_updated_at() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER organizations_touch BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
-- Suspended clinics cannot change their settings either (platform operations excepted).
CREATE OR REPLACE FUNCTION private.guard_org_row_writable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  IF NOT private.org_writable(OLD.id) THEN
    RAISE EXCEPTION 'La cuenta de esta clínica no permite cambios (suspendida o cerrada).' USING ERRCODE = 'KS001';
  END IF;
  RETURN NEW;
END; $function$;
REVOKE ALL ON FUNCTION private.guard_org_row_writable() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER organizations_writable BEFORE UPDATE ON public.organizations
  FOR EACH ROW WHEN (OLD.account_status IS NOT DISTINCT FROM NEW.account_status)
  EXECUTE FUNCTION private.guard_org_row_writable();

-- Services --------------------------------------------------------------------------------------
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS modality text NOT NULL DEFAULT 'presencial';
ALTER TABLE public.services
  ADD CONSTRAINT services_name_check CHECK (length(btrim(name)) BETWEEN 1 AND 120) NOT VALID,
  ADD CONSTRAINT services_modality_check CHECK (modality IN ('presencial','online','mixta'));
CREATE POLICY services_psychologist_insert ON public.services
  FOR INSERT TO authenticated WITH CHECK (private.has_role(org_id, ARRAY['psychologa']));
CREATE POLICY services_psychologist_update ON public.services
  FOR UPDATE TO authenticated
  USING (private.has_role(org_id, ARRAY['psychologa']))
  WITH CHECK (private.has_role(org_id, ARRAY['psychologa']));
CREATE TRIGGER services_touch BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

-- Professionals ---------------------------------------------------------------------------------
ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS specialty text,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.professionals
  ADD CONSTRAINT professionals_display_name_check CHECK (length(btrim(display_name)) BETWEEN 1 AND 120) NOT VALID,
  ADD CONSTRAINT professionals_color_check CHECK (color IS NULL OR color ~ '^#[0-9a-fA-F]{6}$');
CREATE UNIQUE INDEX IF NOT EXISTS professionals_org_user_uq ON public.professionals (org_id, user_id) WHERE user_id IS NOT NULL;
CREATE POLICY professionals_admin_insert ON public.professionals
  FOR INSERT TO authenticated WITH CHECK (private.is_org_admin(org_id));
CREATE POLICY professionals_admin_or_self_update ON public.professionals
  FOR UPDATE TO authenticated
  USING (private.is_org_admin(org_id) OR (user_id = (SELECT auth.uid()) AND private.is_member(org_id)))
  WITH CHECK (private.is_org_admin(org_id) OR (user_id = (SELECT auth.uid()) AND private.is_member(org_id)));
-- A non-admin editing their own row cannot relink it to someone else or (de)activate it.
CREATE OR REPLACE FUNCTION private.guard_professional_self_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  IF current_user IN ('authenticated','anon') AND NOT private.is_org_admin(NEW.org_id)
     AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.active IS DISTINCT FROM OLD.active OR NEW.org_id IS DISTINCT FROM OLD.org_id) THEN
    RAISE EXCEPTION 'Solo la administración de la clínica puede cambiar ese dato' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $function$;
REVOKE ALL ON FUNCTION private.guard_professional_self_edit() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER professionals_self_edit BEFORE UPDATE ON public.professionals
  FOR EACH ROW EXECUTE FUNCTION private.guard_professional_self_edit();
CREATE TRIGGER professionals_touch BEFORE UPDATE ON public.professionals
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

-- Availability (weekly ranges) and time off -----------------------------------------------------
CREATE TABLE public.professional_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),          -- ISO: 1 = Monday
  start_minute integer NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute integer NOT NULL CHECK (end_minute BETWEEN 1 AND 1440),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_minute > start_minute),
  FOREIGN KEY (org_id, professional_id) REFERENCES public.professionals(org_id, id) ON DELETE CASCADE,
  EXCLUDE USING gist (org_id WITH =, professional_id WITH =, weekday WITH =, int4range(start_minute, end_minute, '[)') WITH &&)
);
CREATE INDEX professional_availability_org_pro_idx ON public.professional_availability (org_id, professional_id);

CREATE TABLE public.professional_time_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text CHECK (reason IS NULL OR length(reason) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  FOREIGN KEY (org_id, professional_id) REFERENCES public.professionals(org_id, id) ON DELETE CASCADE
);
CREATE INDEX professional_time_off_org_pro_idx ON public.professional_time_off (org_id, professional_id, starts_at);

CREATE OR REPLACE FUNCTION private.can_edit_schedule(target_org uuid, target_professional uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  SELECT private.is_org_admin(target_org) OR (
    private.is_member(target_org) AND EXISTS (
      SELECT 1 FROM public.professionals p
      WHERE p.org_id = target_org AND p.id = target_professional AND p.user_id = (SELECT auth.uid())
    )
  )
$function$;
REVOKE ALL ON FUNCTION private.can_edit_schedule(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_edit_schedule(uuid, uuid) TO authenticated;

ALTER TABLE public.professional_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_time_off ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.professional_availability, public.professional_time_off FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_availability, public.professional_time_off TO authenticated;
GRANT ALL ON public.professional_availability, public.professional_time_off TO service_role;
CREATE POLICY availability_read ON public.professional_availability FOR SELECT TO authenticated USING (private.is_member(org_id));
CREATE POLICY availability_write ON public.professional_availability FOR ALL TO authenticated
  USING (private.can_edit_schedule(org_id, professional_id)) WITH CHECK (private.can_edit_schedule(org_id, professional_id));
CREATE POLICY time_off_read ON public.professional_time_off FOR SELECT TO authenticated USING (private.is_member(org_id));
CREATE POLICY time_off_write ON public.professional_time_off FOR ALL TO authenticated
  USING (private.can_edit_schedule(org_id, professional_id)) WITH CHECK (private.can_edit_schedule(org_id, professional_id));
CREATE TRIGGER professional_availability_org_writable BEFORE INSERT OR UPDATE OR DELETE ON public.professional_availability
  FOR EACH ROW EXECUTE FUNCTION private.guard_org_writable();
CREATE TRIGGER professional_time_off_org_writable BEFORE INSERT OR UPDATE OR DELETE ON public.professional_time_off
  FOR EACH ROW EXECUTE FUNCTION private.guard_org_writable();

-- Invitations -----------------------------------------------------------------------------------
-- The token is shown once to the administrator who creates it (to send it by their own channel
-- until an email provider is configured); only its SHA-256 is stored.
CREATE TABLE public.org_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND length(email) <= 254),
  role text NOT NULL CHECK (role IN ('psychologa','recepcion','gestoria')),
  is_admin boolean NOT NULL DEFAULT false,
  token_hash text NOT NULL UNIQUE,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz
);
CREATE UNIQUE INDEX org_invitations_pending_uq ON public.org_invitations (org_id, lower(email))
  WHERE accepted_at IS NULL AND revoked_at IS NULL;
ALTER TABLE public.org_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.org_invitations FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, org_id, email, role, is_admin, invited_by, created_at, expires_at, accepted_at, accepted_by, revoked_at)
  ON public.org_invitations TO authenticated;
GRANT ALL ON public.org_invitations TO service_role;
CREATE POLICY org_invitations_admin_read ON public.org_invitations FOR SELECT TO authenticated USING (private.is_org_admin(org_id));
CREATE TRIGGER org_invitations_org_writable BEFORE INSERT OR UPDATE OR DELETE ON public.org_invitations
  FOR EACH ROW EXECUTE FUNCTION private.guard_org_writable();

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
  IF p_role NOT IN ('psychologa','recepcion','gestoria') THEN
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

CREATE OR REPLACE FUNCTION public.revoke_invitation(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v public.org_invitations;
BEGIN
  SELECT * INTO v FROM public.org_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT private.is_org_admin(v.org_id) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  IF v.accepted_at IS NOT NULL OR v.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'La invitación ya no está pendiente' USING ERRCODE = 'KT002';
  END IF;
  UPDATE public.org_invitations SET revoked_at = now() WHERE id = v.id;
  INSERT INTO public.audit_log(org_id, actor_id, action, entity_type, entity_id)
  VALUES (v.org_id, auth.uid(), 'revoke', 'org_invitation', v.id);
END;
$function$;

-- The invited person signs up / signs in with the invited address and accepts. The email must be
-- the one on the invitation and must be confirmed in Supabase Auth.
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v public.org_invitations;
  v_user auth.users;
  v_membership uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT private.session_ok() THEN
    RAISE EXCEPTION 'Inicia sesión para aceptar la invitación' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.org_invitations
  WHERE token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
  FOR UPDATE;
  IF NOT FOUND OR v.revoked_at IS NOT NULL OR v.accepted_at IS NOT NULL OR v.expires_at <= now() THEN
    RAISE EXCEPTION 'La invitación no es válida o ha caducado' USING ERRCODE = 'KT003';
  END IF;
  SELECT * INTO v_user FROM auth.users WHERE id = auth.uid();
  IF lower(v_user.email) IS DISTINCT FROM lower(v.email) OR v_user.email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'La invitación es para otra dirección de correo' USING ERRCODE = 'KT004';
  END IF;
  IF NOT private.org_writable(v.org_id) THEN
    RAISE EXCEPTION 'La cuenta de esta clínica no admite altas ahora mismo' USING ERRCODE = 'KS001';
  END IF;
  -- The pending invitation already holds its place in the member limit (counted at invite time).
  PERFORM private.assert_plan_limit(v.org_id, 'members', 0);
  INSERT INTO public.memberships(org_id, user_id, role, active, is_admin)
  VALUES (v.org_id, auth.uid(), v.role, true, v.is_admin)
  ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role, active = true, is_admin = EXCLUDED.is_admin, updated_at = now()
  RETURNING id INTO v_membership;
  UPDATE public.org_invitations SET accepted_at = now(), accepted_by = auth.uid() WHERE id = v.id;
  INSERT INTO public.audit_log(org_id, actor_id, action, entity_type, entity_id, metadata)
  VALUES (v.org_id, auth.uid(), 'accept', 'org_invitation', v.id, jsonb_build_object('membership_id', v_membership, 'role', v.role));
  RETURN jsonb_build_object('org_id', v.org_id, 'membership_id', v_membership, 'role', v.role);
END;
$function$;

-- Team management: role, admin flag and deactivation. There is always at least one active admin;
-- an administrator cannot demote or deactivate themselves (another admin must do it).
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
  IF p_role IS NOT NULL AND p_role NOT IN ('psychologa','recepcion','gestoria') THEN
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

-- Team list with e-mail (auth.users is not exposed to the API): members see their colleagues'
-- name/role; e-mail addresses only for administrators.
CREATE OR REPLACE FUNCTION public.list_team(p_org_id uuid)
RETURNS TABLE (membership_id uuid, user_id uuid, role text, is_admin boolean, active boolean, email text, display_name text, professional_id uuid, created_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_member(p_org_id) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT m.id, m.user_id, m.role, m.is_admin, m.active,
         CASE WHEN private.is_org_admin(p_org_id) OR m.user_id = auth.uid() THEN u.email::text END,
         coalesce(p.display_name, u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1))::text,
         p.id, m.created_at
  FROM public.memberships m
  JOIN auth.users u ON u.id = m.user_id
  LEFT JOIN public.professionals p ON p.org_id = m.org_id AND p.user_id = m.user_id
  WHERE m.org_id = p_org_id
  ORDER BY m.active DESC, m.created_at;
END;
$function$;
