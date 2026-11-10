-- KOVO · 20261111090500 · Explicit EXECUTE privileges for every RPC added by this chain.
-- PostgreSQL grants EXECUTE to PUBLIC by default and Supabase adds default grants to anon /
-- authenticated / service_role, so each function is closed first and opened only to who needs it.

DO $$
DECLARE
  f text;
BEGIN
  -- Callable by signed-in users (each function checks the role / organization itself).
  FOREACH f IN ARRAY ARRAY[
    'public.invite_member(uuid, text, text, boolean)',
    'public.revoke_invitation(uuid)',
    'public.accept_invitation(text)',
    'public.update_membership(uuid, text, boolean, boolean)',
    'public.list_team(uuid)',
    'public.my_organizations()',
    'public.create_organization(text, text, text)',
    'public.change_plan(uuid, text)',
    'public.set_subscription_cancellation(uuid, boolean)',
    'public.am_platform_admin()',
    'public.platform_list_organizations()',
    'public.platform_set_account_status(uuid, text, text)',
    'public.platform_set_subscription(uuid, text, text, text)',
    'public.platform_list_tickets(text)',
    'public.platform_update_ticket(uuid, text, text)',
    'public.record_invoice_payment(uuid, integer, text, timestamptz, text)',
    'public.delete_invoice_draft(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, service_role', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;

  -- Server only (payment webhook, service role). Never from the browser.
  REVOKE ALL ON FUNCTION public.apply_billing_event(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.apply_billing_event(text, text, text, jsonb) TO service_role;
END $$;
