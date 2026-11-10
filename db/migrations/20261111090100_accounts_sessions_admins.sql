-- KOVO · 20261111090100 · Clinic account status, clinic administrators, revocable sessions and
-- write protection for suspended accounts.
--
--   * organizations.account_status: active | suspended | closed.
--       - suspended: members can still READ (and export) their data, but every write is refused
--         by the database (KS001). Used for non-payment or a platform decision.
--       - closed: nobody in the clinic can read or write (has_role/my_orgs return nothing).
--         Data retention and deletion follow docs/legal (no automatic deletion here).
--   * memberships.is_admin: clinic administrator (team, settings, subscription). Independent of the
--     professional role (psychologa / recepcion / gestoria).
--   * private.session_ok(): a JWT that carries a Supabase Auth session_id is only valid while that
--     session exists in auth.sessions. Logging out (or an admin revoking a session) therefore takes
--     effect immediately in the database, not when the JWT expires (gap S2).

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS status_reason text,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Madrid',
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_account_status_check CHECK (account_status IN ('active','suspended','closed')),
  ADD CONSTRAINT organizations_name_check CHECK (length(btrim(name)) BETWEEN 2 AND 120) NOT VALID,
  ADD CONSTRAINT organizations_settings_object CHECK (jsonb_typeof(settings) = 'object'),
  ADD CONSTRAINT organizations_timezone_check CHECK (timezone ~ '^[A-Za-z_]+(/[A-Za-z_]+)*$');

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Existing organizations: the oldest active psychologist becomes the clinic administrator, so no
-- organization is left without one. Review after deployment (docs/ops/migraciones.md).
UPDATE public.memberships m SET is_admin = true
WHERE m.id IN (
  SELECT DISTINCT ON (org_id) id FROM public.memberships
  WHERE active AND role = 'psychologa'
  ORDER BY org_id, created_at, id
)
AND NOT EXISTS (SELECT 1 FROM public.memberships x WHERE x.org_id = m.org_id AND x.is_admin);

-- Revocable sessions --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.session_ok()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN nullif(auth.jwt() ->> 'session_id', '') IS NULL THEN true
    ELSE EXISTS (
      SELECT 1 FROM auth.sessions s
      WHERE s.id = (auth.jwt() ->> 'session_id')::uuid
        AND s.user_id = (SELECT auth.uid())
        AND (s.not_after IS NULL OR s.not_after > now())
    )
  END
$function$;

CREATE OR REPLACE FUNCTION private.has_role(target_org uuid, allowed_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT private.session_ok() AND EXISTS (
    SELECT 1
    FROM public.memberships m
    JOIN public.organizations o ON o.id = m.org_id
    WHERE m.org_id = target_org
      AND m.user_id = (SELECT auth.uid())
      AND m.active
      AND m.role = ANY (allowed_roles)
      AND o.account_status <> 'closed'
  )
$function$;

CREATE OR REPLACE FUNCTION private.my_orgs()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT m.org_id
  FROM public.memberships m
  JOIN public.organizations o ON o.id = m.org_id
  WHERE m.user_id = (SELECT auth.uid())
    AND m.active
    AND o.account_status <> 'closed'
    AND private.session_ok()
$function$;

CREATE OR REPLACE FUNCTION private.is_org_admin(target_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT private.session_ok() AND EXISTS (
    SELECT 1
    FROM public.memberships m
    JOIN public.organizations o ON o.id = m.org_id
    WHERE m.org_id = target_org
      AND m.user_id = (SELECT auth.uid())
      AND m.active
      AND m.is_admin
      AND o.account_status <> 'closed'
  )
$function$;

-- Membership without role filter (any active member of a non-closed clinic).
CREATE OR REPLACE FUNCTION private.is_member(target_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT target_org IN (SELECT private.my_orgs())
$function$;

REVOKE ALL ON FUNCTION private.session_ok() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.is_org_admin(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.is_member(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.session_ok() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_org_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_member(uuid) TO authenticated;

-- Suspended accounts are read-only ---------------------------------------------------------------
-- Platform operations (KOVO staff RPCs, billing webhooks) set kovo.platform_op locally in their own
-- transaction; nothing a clinic user can call sets it.
CREATE OR REPLACE FUNCTION private.org_writable(target_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT coalesce(current_setting('kovo.platform_op', true), '') = 'on'
      OR EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = target_org AND o.account_status = 'active')
$function$;
REVOKE ALL ON FUNCTION private.org_writable(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.org_writable(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.guard_org_writable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_org uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN v_org := OLD.org_id; ELSE v_org := NEW.org_id; END IF;
  IF NOT private.org_writable(v_org) THEN
    RAISE EXCEPTION 'La cuenta de esta clínica no permite cambios (suspendida o cerrada).'
      USING ERRCODE = 'KS001', HINT = 'Los datos siguen disponibles para consulta y exportación.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.guard_org_writable() FROM PUBLIC, anon, authenticated, service_role;

-- Applied to every tenant table that exists at this point; later migrations add their own tables.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'patients','appointments','clinical_notes','clinical_note_rectifications','employees','expenses',
    'invoices','invoice_lines','payments','patient_documents','professionals','services','memberships',
    'organization_billing_profiles','patient_billing_profiles','expense_tax_lines','patient_consents',
    'patient_consent_status'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_org_writable', t);
      EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.guard_org_writable()', t || '_org_writable', t);
    END IF;
  END LOOP;
END $$;
