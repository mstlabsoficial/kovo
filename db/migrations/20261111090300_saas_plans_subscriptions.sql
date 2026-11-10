-- KOVO · 20261111090300 · SaaS layer: plans, subscriptions, clinic sign-up, platform (KOVO staff)
-- administration, support tickets and the payment-provider event inbox.
--
-- Separation of the two kinds of billing (never mixed):
--   * KOVO → clinic (this file): plans, subscriptions, billing_provider_events. Charged by an
--     external payment provider through a server-side webhook; no card data ever reaches KOVO.
--   * clinic → patient (baseline + backend proposal): invoices, invoice_lines, payments, expenses.
--
-- Commercial values are NOT decided here. prices are NULL; limits and the trial length are
-- PROVISIONAL placeholders so the enforcement can be tested, and must be approved
-- (PROJECT_STATUS.md · decisiones pendientes).

-- Plans -----------------------------------------------------------------------------------------
CREATE TABLE public.plans (
  code text PRIMARY KEY CHECK (code ~ '^[a-z][a-z0-9_]{1,30}$'),
  name text NOT NULL,
  position smallint NOT NULL DEFAULT 0,
  max_professionals integer CHECK (max_professionals IS NULL OR max_professionals > 0),   -- NULL = sin límite
  max_members integer CHECK (max_members IS NULL OR max_members > 0),
  max_storage_mb integer CHECK (max_storage_mb IS NULL OR max_storage_mb > 0),
  trial_days integer NOT NULL DEFAULT 14 CHECK (trial_days BETWEEN 0 AND 90),
  monthly_price_cents integer CHECK (monthly_price_cents IS NULL OR monthly_price_cents >= 0),  -- NULL = precio no decidido
  provider_price_ref text,          -- id of the price in the payment provider (set when configured)
  features jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(features) = 'object'),
  provisional boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true
);
INSERT INTO public.plans(code, name, position, max_professionals, max_members, max_storage_mb, trial_days, features) VALUES
  ('starter',      'Starter',      1, 1,    2,    2048,  14, '{"billing": true, "documents": true, "multi_professional": false}'),
  ('professional', 'Professional', 2, 3,    6,    10240, 14, '{"billing": true, "documents": true, "multi_professional": true}'),
  ('clinic',       'Clinic',       3, NULL, NULL, 51200, 14, '{"billing": true, "documents": true, "multi_professional": true, "priority_support": true}');

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plans FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
CREATE POLICY plans_public_read ON public.plans FOR SELECT TO anon, authenticated USING (active);

-- Subscriptions (one per clinic) ----------------------------------------------------------------
CREATE TABLE public.subscriptions (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_code text NOT NULL REFERENCES public.plans(code),
  status text NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing','active','past_due','unpaid','cancelled','incomplete')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  provider text,                    -- e.g. 'stripe' once approved; NULL while no provider is configured
  provider_customer_id text,
  provider_subscription_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
-- Read-only for the clinic's members (the plan and status drive what the app shows). Writes only
-- through RPCs (trial plan change, cancellation) or the provider webhook (service role).
CREATE POLICY subscriptions_member_read ON public.subscriptions FOR SELECT TO authenticated USING (private.is_member(org_id));
CREATE TRIGGER subscriptions_touch BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

-- Plan limits -----------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.assert_plan_limit(p_org uuid, p_kind text, p_adding integer DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_plan public.plans;
  v_limit integer;
  v_used integer;
BEGIN
  -- Serialises concurrent additions in one clinic (two invitations at once cannot both pass).
  PERFORM pg_advisory_xact_lock(hashtext('kovo-plan-limit:' || p_org::text));
  SELECT p.* INTO v_plan FROM public.subscriptions s JOIN public.plans p ON p.code = s.plan_code WHERE s.org_id = p_org;
  IF NOT FOUND THEN RETURN; END IF;   -- organizations created before the SaaS layer: no limit until a plan is assigned
  IF p_kind = 'members' THEN
    v_limit := v_plan.max_members;
    SELECT count(*) INTO v_used FROM public.memberships WHERE org_id = p_org AND active;
    v_used := v_used + (SELECT count(*) FROM public.org_invitations WHERE org_id = p_org AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now());
  ELSIF p_kind = 'professionals' THEN
    v_limit := v_plan.max_professionals;
    SELECT count(*) INTO v_used FROM public.professionals WHERE org_id = p_org AND active;
  ELSE
    RAISE EXCEPTION 'Unknown limit %', p_kind;
  END IF;
  IF v_limit IS NOT NULL AND v_used + p_adding > v_limit THEN
    RAISE EXCEPTION 'Tu plan % permite % (%). Cambia de plan para añadir más.', v_plan.name,
      CASE p_kind WHEN 'members' THEN 'personas en el equipo' ELSE 'profesionales activos' END, v_limit
      USING ERRCODE = 'KP001';
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION private.assert_plan_limit(uuid, text, integer) FROM PUBLIC, anon, authenticated, service_role;

-- Enforced by the database for direct REST writes too.
CREATE OR REPLACE FUNCTION private.guard_professional_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  IF NEW.active AND (TG_OP = 'INSERT' OR NOT OLD.active) THEN
    PERFORM private.assert_plan_limit(NEW.org_id, 'professionals', 1);
  END IF;
  RETURN NEW;
END; $function$;
REVOKE ALL ON FUNCTION private.guard_professional_limit() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER professionals_plan_limit BEFORE INSERT OR UPDATE OF active ON public.professionals
  FOR EACH ROW EXECUTE FUNCTION private.guard_professional_limit();

-- Clinic sign-up --------------------------------------------------------------------------------
-- Any signed-in user with a confirmed e-mail can create a clinic: organization + their membership
-- (psychologa, administrator) + their professional profile + a trial subscription, atomically.
CREATE OR REPLACE FUNCTION public.create_organization(p_name text, p_plan_code text DEFAULT 'starter', p_display_name text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user auth.users;
  v_plan public.plans;
  v_org uuid;
  v_name text := btrim(coalesce(p_name, ''));
BEGIN
  IF auth.uid() IS NULL OR NOT private.session_ok() THEN
    RAISE EXCEPTION 'Inicia sesión para crear tu clínica' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_user FROM auth.users WHERE id = auth.uid();
  IF v_user.email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Confirma tu correo antes de crear la clínica' USING ERRCODE = 'KO001';
  END IF;
  IF length(v_name) < 2 OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'El nombre de la clínica debe tener entre 2 y 120 caracteres' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_plan FROM public.plans WHERE code = coalesce(p_plan_code, 'starter') AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan no disponible' USING ERRCODE = '22023'; END IF;
  -- Anti-abuse: at most 3 clinics created by the same account (provisional value).
  PERFORM pg_advisory_xact_lock(hashtext('kovo-create-org:' || auth.uid()::text));
  IF (SELECT count(*) FROM public.organizations WHERE created_by = auth.uid()) >= 3 THEN
    RAISE EXCEPTION 'Has alcanzado el máximo de clínicas por cuenta. Contacta con soporte.' USING ERRCODE = 'KO002';
  END IF;

  INSERT INTO public.organizations(name, created_by) VALUES (v_name, auth.uid()) RETURNING id INTO v_org;
  INSERT INTO public.subscriptions(org_id, plan_code, status, trial_ends_at)
  VALUES (v_org, v_plan.code, 'trialing', now() + make_interval(days => v_plan.trial_days));
  INSERT INTO public.memberships(org_id, user_id, role, active, is_admin) VALUES (v_org, auth.uid(), 'psychologa', true, true);
  INSERT INTO public.professionals(org_id, display_name, email, user_id)
  VALUES (v_org, coalesce(nullif(btrim(p_display_name), ''), v_user.raw_user_meta_data ->> 'full_name', split_part(v_user.email, '@', 1)), v_user.email, auth.uid());
  INSERT INTO public.services(org_id, name, duration_minutes, price_cents, tax_exempt)
  VALUES (v_org, 'Sesión individual', 50, 0, true);
  INSERT INTO public.audit_log(org_id, actor_id, action, entity_type, entity_id, metadata)
  VALUES (v_org, auth.uid(), 'create', 'organization', v_org, jsonb_build_object('plan', v_plan.code));
  RETURN v_org;
END;
$function$;

-- Plan change by the clinic: only during the trial (no charge involved). Once a payment provider is
-- configured, paid plan changes go through its checkout and come back through the webhook.
CREATE OR REPLACE FUNCTION public.change_plan(p_org_id uuid, p_plan_code text)
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v public.subscriptions;
  v_plan public.plans;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_org_admin(p_org_id) THEN
    RAISE EXCEPTION 'Solo la administración de la clínica puede cambiar el plan' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.subscriptions WHERE org_id = p_org_id FOR UPDATE;
  SELECT * INTO v_plan FROM public.plans WHERE code = p_plan_code AND active;
  IF v.org_id IS NULL OR v_plan.code IS NULL THEN RAISE EXCEPTION 'Plan no disponible' USING ERRCODE = '22023'; END IF;
  IF v.status <> 'trialing' THEN
    RAISE EXCEPTION 'El cambio de un plan de pago se hace desde la pasarela de pago (pendiente de configurar)' USING ERRCODE = 'KP003';
  END IF;
  IF v_plan.max_members IS NOT NULL AND (SELECT count(*) FROM public.memberships WHERE org_id = p_org_id AND active) > v_plan.max_members THEN
    RAISE EXCEPTION 'El equipo actual supera el límite del plan %', v_plan.name USING ERRCODE = 'KP002';
  END IF;
  IF v_plan.max_professionals IS NOT NULL AND (SELECT count(*) FROM public.professionals WHERE org_id = p_org_id AND active) > v_plan.max_professionals THEN
    RAISE EXCEPTION 'Los profesionales activos superan el límite del plan %', v_plan.name USING ERRCODE = 'KP002';
  END IF;
  UPDATE public.subscriptions SET plan_code = v_plan.code WHERE org_id = p_org_id RETURNING * INTO v;
  INSERT INTO public.audit_log(org_id, actor_id, action, entity_type, entity_id, metadata)
  VALUES (p_org_id, auth.uid(), 'change_plan', 'subscription', p_org_id, jsonb_build_object('plan', v_plan.code));
  RETURN v;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_subscription_cancellation(p_org_id uuid, p_cancel boolean)
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v public.subscriptions;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_org_admin(p_org_id) THEN
    RAISE EXCEPTION 'Solo la administración de la clínica puede cancelar la suscripción' USING ERRCODE = '42501';
  END IF;
  UPDATE public.subscriptions SET cancel_at_period_end = coalesce(p_cancel, false)
  WHERE org_id = p_org_id AND status NOT IN ('cancelled') RETURNING * INTO v;
  IF NOT FOUND THEN RAISE EXCEPTION 'No hay una suscripción activa' USING ERRCODE = 'KP004'; END IF;
  INSERT INTO public.audit_log(org_id, actor_id, action, entity_type, entity_id, metadata)
  VALUES (p_org_id, auth.uid(), CASE WHEN p_cancel THEN 'cancel' ELSE 'resume' END, 'subscription', p_org_id, '{}'::jsonb);
  RETURN v;
END;
$function$;

-- My organizations (organization selector after sign-in).
CREATE OR REPLACE FUNCTION public.my_organizations()
RETURNS TABLE (org_id uuid, name text, role text, is_admin boolean, account_status text, plan_code text, subscription_status text, trial_ends_at timestamptz, cancel_at_period_end boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT o.id, o.name, m.role, m.is_admin, o.account_status, s.plan_code, s.status, s.trial_ends_at, s.cancel_at_period_end
  FROM public.memberships m
  JOIN public.organizations o ON o.id = m.org_id
  LEFT JOIN public.subscriptions s ON s.org_id = o.id
  WHERE m.user_id = (SELECT auth.uid()) AND m.active AND o.account_status <> 'closed' AND private.session_ok()
  ORDER BY o.name
$function$;

-- Platform (KOVO staff) -------------------------------------------------------------------------
-- Separate from clinic roles: a platform admin is NOT a member of any clinic and cannot read
-- patients, notes, documents or invoices. The platform RPCs only return aggregated, non-clinical
-- account data. Platform admins are added by the operator with SQL (docs/ops/operaciones.md).
CREATE TABLE public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_admins FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.platform_admins TO service_role;

CREATE TABLE public.platform_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_audit_log FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.platform_audit_log TO service_role;

CREATE OR REPLACE FUNCTION private.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  SELECT private.session_ok() AND EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = (SELECT auth.uid()))
$function$;
REVOKE ALL ON FUNCTION private.is_platform_admin() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_platform_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.am_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  SELECT private.is_platform_admin()
$function$;

CREATE OR REPLACE FUNCTION public.platform_list_organizations()
RETURNS TABLE (org_id uuid, name text, created_at timestamptz, account_status text, status_reason text, plan_code text,
               subscription_status text, trial_ends_at timestamptz, cancel_at_period_end boolean,
               members integer, professionals integer, patients integer, open_tickets integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NOT private.is_platform_admin() THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT o.id, o.name, o.created_at, o.account_status, o.status_reason, s.plan_code, s.status, s.trial_ends_at, s.cancel_at_period_end,
         (SELECT count(*)::int FROM public.memberships m WHERE m.org_id = o.id AND m.active),
         (SELECT count(*)::int FROM public.professionals p WHERE p.org_id = o.id AND p.active),
         (SELECT count(*)::int FROM public.patients pa WHERE pa.org_id = o.id),
         (SELECT count(*)::int FROM public.support_tickets t WHERE t.org_id = o.id AND t.status <> 'closed')
  FROM public.organizations o
  LEFT JOIN public.subscriptions s ON s.org_id = o.id
  WHERE NOT o.is_demo
  ORDER BY o.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_set_account_status(p_org_id uuid, p_status text, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_old text;
BEGIN
  IF NOT private.is_platform_admin() THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('active','suspended','closed') THEN RAISE EXCEPTION 'Estado no válido' USING ERRCODE = '22023'; END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 5 THEN RAISE EXCEPTION 'Indica el motivo' USING ERRCODE = '22023'; END IF;
  SELECT account_status INTO v_old FROM public.organizations WHERE id = p_org_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Clínica no encontrada' USING ERRCODE = 'P0002'; END IF;
  PERFORM set_config('kovo.platform_op', 'on', true);
  UPDATE public.organizations SET account_status = p_status, status_reason = btrim(p_reason) WHERE id = p_org_id;
  PERFORM set_config('kovo.platform_op', 'off', true);
  INSERT INTO public.platform_audit_log(actor_id, action, org_id, metadata)
  VALUES (auth.uid(), 'set_account_status', p_org_id, jsonb_build_object('from', v_old, 'status', p_status, 'reason', btrim(p_reason)));
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_set_subscription(p_org_id uuid, p_plan_code text, p_status text, p_reason text)
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v public.subscriptions;
BEGIN
  IF NOT private.is_platform_admin() THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.plans WHERE code = p_plan_code) THEN RAISE EXCEPTION 'Plan no válido' USING ERRCODE = '22023'; END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 5 THEN RAISE EXCEPTION 'Indica el motivo' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.subscriptions(org_id, plan_code, status)
  VALUES (p_org_id, p_plan_code, coalesce(p_status, 'active'))
  ON CONFLICT (org_id) DO UPDATE SET plan_code = EXCLUDED.plan_code, status = coalesce(p_status, public.subscriptions.status)
  RETURNING * INTO v;
  INSERT INTO public.platform_audit_log(actor_id, action, org_id, metadata)
  VALUES (auth.uid(), 'set_subscription', p_org_id, jsonb_build_object('plan', p_plan_code, 'status', v.status, 'reason', btrim(p_reason)));
  RETURN v;
END;
$function$;

-- Support ---------------------------------------------------------------------------------------
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject text NOT NULL CHECK (length(btrim(subject)) BETWEEN 3 AND 160),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 3 AND 5000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','closed')),
  platform_reply text CHECK (platform_reply IS NULL OR length(platform_reply) <= 5000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_tickets_org_idx ON public.support_tickets (org_id, created_at DESC);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_tickets FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.support_tickets TO authenticated;
GRANT INSERT (org_id, subject, body) ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
CREATE POLICY support_tickets_member_read ON public.support_tickets FOR SELECT TO authenticated USING (private.is_member(org_id));
-- Any member can open a ticket for their clinic, even while the account is suspended (it is how
-- they contact KOVO), so this table has no org_writable guard.
CREATE POLICY support_tickets_member_insert ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (private.is_member(org_id));
CREATE OR REPLACE FUNCTION private.support_ticket_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid(); NEW.status := 'open'; NEW.platform_reply := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $function$;
REVOKE ALL ON FUNCTION private.support_ticket_defaults() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER support_tickets_defaults BEFORE INSERT OR UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION private.support_ticket_defaults();

CREATE OR REPLACE FUNCTION public.platform_list_tickets(p_status text DEFAULT NULL)
RETURNS TABLE (id uuid, org_id uuid, org_name text, subject text, body text, status text, platform_reply text, created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  IF NOT private.is_platform_admin() THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT t.id, t.org_id, o.name, t.subject, t.body, t.status, t.platform_reply, t.created_at, t.updated_at
  FROM public.support_tickets t JOIN public.organizations o ON o.id = t.org_id
  WHERE p_status IS NULL OR t.status = p_status
  ORDER BY t.created_at DESC;
END; $function$;

CREATE OR REPLACE FUNCTION public.platform_update_ticket(p_ticket_id uuid, p_status text, p_reply text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_org uuid;
BEGIN
  IF NOT private.is_platform_admin() THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('open','in_progress','closed') THEN RAISE EXCEPTION 'Estado no válido' USING ERRCODE = '22023'; END IF;
  UPDATE public.support_tickets SET status = p_status, platform_reply = coalesce(p_reply, platform_reply)
  WHERE id = p_ticket_id RETURNING org_id INTO v_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket no encontrado' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.platform_audit_log(actor_id, action, org_id, metadata)
  VALUES (auth.uid(), 'update_ticket', v_org, jsonb_build_object('ticket_id', p_ticket_id, 'status', p_status));
END; $function$;

-- Payment-provider event inbox (KOVO → clinic billing) --------------------------------------------
-- Written ONLY by the server-side webhook handler (supabase/functions/billing-webhook) with the
-- service role, after verifying the provider's signature. Idempotent by (provider, event_id).
-- No real provider is configured: this is the prepared integration point.
CREATE TABLE public.billing_provider_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error text,
  UNIQUE (provider, event_id)
);
ALTER TABLE public.billing_provider_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_provider_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.billing_provider_events TO service_role;

-- Normalised event (the webhook maps the provider's own payload to this shape):
--   {"org_id": uuid, "plan_code": text, "status": trialing|active|past_due|unpaid|cancelled|incomplete,
--    "current_period_end": timestamptz, "cancel_at_period_end": bool,
--    "provider_customer_id": text, "provider_subscription_id": text}
-- Account effect (DECISION PENDING APPROVAL, see PROJECT_STATUS.md): unpaid / cancelled → the
-- clinic becomes read-only (suspended); active / trialing → active again (unless suspended or closed
-- by KOVO staff for another reason, which is recorded in status_reason and not overridden).
CREATE OR REPLACE FUNCTION public.apply_billing_event(p_provider text, p_event_id text, p_event_type text, p_payload jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_org uuid;
  v_status text;
  v_inserted bigint;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Solo el servidor de pagos puede registrar eventos' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.billing_provider_events(provider, event_id, event_type, payload)
  VALUES (p_provider, p_event_id, p_event_type, p_payload)
  ON CONFLICT (provider, event_id) DO NOTHING
  RETURNING id INTO v_inserted;
  IF v_inserted IS NULL THEN RETURN 'duplicate'; END IF;

  BEGIN
    v_org := (p_payload ->> 'org_id')::uuid;
    v_status := p_payload ->> 'status';
    IF v_org IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org) THEN
      RAISE EXCEPTION 'org_id desconocido';
    END IF;
    IF v_status NOT IN ('trialing','active','past_due','unpaid','cancelled','incomplete') THEN
      RAISE EXCEPTION 'estado desconocido %', v_status;
    END IF;
    UPDATE public.billing_provider_events SET org_id = v_org WHERE id = v_inserted;
    INSERT INTO public.subscriptions(org_id, plan_code, status, current_period_end, cancel_at_period_end, provider, provider_customer_id, provider_subscription_id)
    VALUES (v_org, coalesce(p_payload ->> 'plan_code', 'starter'), v_status, (p_payload ->> 'current_period_end')::timestamptz,
            coalesce((p_payload ->> 'cancel_at_period_end')::boolean, false), p_provider, p_payload ->> 'provider_customer_id', p_payload ->> 'provider_subscription_id')
    ON CONFLICT (org_id) DO UPDATE SET
      plan_code = coalesce(p_payload ->> 'plan_code', public.subscriptions.plan_code),
      status = v_status,
      current_period_end = coalesce((p_payload ->> 'current_period_end')::timestamptz, public.subscriptions.current_period_end),
      cancel_at_period_end = coalesce((p_payload ->> 'cancel_at_period_end')::boolean, public.subscriptions.cancel_at_period_end),
      provider = p_provider,
      provider_customer_id = coalesce(p_payload ->> 'provider_customer_id', public.subscriptions.provider_customer_id),
      provider_subscription_id = coalesce(p_payload ->> 'provider_subscription_id', public.subscriptions.provider_subscription_id);
    PERFORM set_config('kovo.platform_op', 'on', true);
    IF v_status IN ('unpaid','cancelled') THEN
      UPDATE public.organizations SET account_status = 'suspended', status_reason = 'billing:' || v_status
      WHERE id = v_org AND account_status = 'active';
    ELSIF v_status IN ('active','trialing') THEN
      UPDATE public.organizations SET account_status = 'active', status_reason = NULL
      WHERE id = v_org AND account_status = 'suspended' AND status_reason LIKE 'billing:%';
    END IF;
    PERFORM set_config('kovo.platform_op', 'off', true);
    UPDATE public.billing_provider_events SET processed_at = now() WHERE id = v_inserted;
    INSERT INTO public.platform_audit_log(actor_id, action, org_id, metadata)
    VALUES (NULL, 'billing_event', v_org, jsonb_build_object('provider', p_provider, 'event_id', p_event_id, 'type', p_event_type, 'status', v_status));
    RETURN 'processed';
  EXCEPTION WHEN others THEN
    UPDATE public.billing_provider_events SET error = SQLERRM WHERE id = v_inserted;
    RETURN 'error';
  END;
END;
$function$;
