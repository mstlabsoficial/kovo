-- KOVO — pgTAP for the consolidated chain (db/migrations) on REAL PostgreSQL with the REAL
-- Supabase Auth schema (auth.users / auth.sessions created by GoTrue's own migrations).
-- Synthetic data only; everything is rolled back. HTTP/Storage/session behaviour with real tokens
-- is tested from Node (db/tests/http.mjs).
BEGIN;
SET LOCAL search_path = extensions, public;
SELECT * FROM no_plan();

CREATE FUNCTION pg_temp.claims(p_sub uuid, p_extra jsonb DEFAULT '{}') RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', (jsonb_build_object('sub', p_sub, 'role', 'authenticated') || p_extra)::text, true);
$$;
CREATE FUNCTION pg_temp.newp(p_code text, p_org uuid DEFAULT '0a000000-0000-4000-8000-00000000000a') RETURNS text LANGUAGE sql AS $$
  INSERT INTO public.patients(org_id, patient_code, first_name, last_name) VALUES (p_org, p_code, 'Sintético', 'Prueba') RETURNING patient_code
$$;
CREATE TEMP TABLE ids (k text PRIMARY KEY, v text);
GRANT ALL ON ids TO authenticated;

-- ------------------------------------------------------------------------- fixtures (postgres)
INSERT INTO auth.users (id, aud, role, email, email_confirmed_at) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'admin-a@kovo.test', now()),
  ('a0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'psico-a2@kovo.test', now()),
  ('a0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'recepcion-a@kovo.test', now()),
  ('a0000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'gestoria-a@kovo.test', now()),
  ('b0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'admin-b@kovo.test', now()),
  ('90000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'nueva@kovo.test', now()),
  ('90000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'sin-confirmar@kovo.test', NULL),
  ('90000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'invitada@kovo.test', now()),
  ('90000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'otra@kovo.test', now()),
  ('f0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'staff@kovo.test', now());
INSERT INTO public.organizations (id, name) VALUES
  ('0a000000-0000-4000-8000-00000000000a', 'Consulta Ficticia A'),
  ('0b000000-0000-4000-8000-00000000000b', 'Consulta Ficticia B');
INSERT INTO public.subscriptions (org_id, plan_code, status) VALUES
  ('0a000000-0000-4000-8000-00000000000a', 'professional', 'active'),
  ('0b000000-0000-4000-8000-00000000000b', 'starter', 'trialing');
INSERT INTO public.memberships (org_id, user_id, role, active, is_admin) VALUES
  ('0a000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000001', 'psychologa', true, true),
  ('0a000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000002', 'psychologa', true, false),
  ('0a000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000003', 'recepcion', true, false),
  ('0a000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000004', 'gestoria', true, false),
  ('0b000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-000000000001', 'psychologa', true, true);
INSERT INTO public.professionals (id, org_id, display_name, user_id) VALUES
  ('e1000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-00000000000a', 'Profesional A1', 'a0000000-0000-4000-8000-000000000001'),
  ('e1000000-0000-4000-8000-000000000002', '0a000000-0000-4000-8000-00000000000a', 'Profesional A2', 'a0000000-0000-4000-8000-000000000002'),
  ('e1000000-0000-4000-8000-0000000000b1', '0b000000-0000-4000-8000-00000000000b', 'Profesional B1', 'b0000000-0000-4000-8000-000000000001');
INSERT INTO public.services (id, org_id, name, duration_minutes, price_cents) VALUES
  ('e2000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-00000000000a', 'Sesión', 50, 6000);
INSERT INTO public.patients (id, org_id, patient_code, first_name, last_name) VALUES
  ('c0000000-0000-4000-8000-0000000000a1', '0a000000-0000-4000-8000-00000000000a', 'P-00001', 'Paciente', 'Ficticio Uno'),
  ('c0000000-0000-4000-8000-0000000000a2', '0a000000-0000-4000-8000-00000000000a', 'P-00002', 'Paciente', 'Ficticio Dos'),
  ('c0000000-0000-4000-8000-0000000000b1', '0b000000-0000-4000-8000-00000000000b', 'P-00001', 'Paciente', 'Ficticio Tres');

-- ========================================================================= 1. patient codes
SELECT is((SELECT last_value FROM private.org_counters WHERE org_id = '0a000000-0000-4000-8000-00000000000a' AND counter_type = 'patient'), 2::bigint,
          'codes: explicit P-codes advance the counter (fix of the T2D collision)');
SELECT pg_temp.claims('a0000000-0000-4000-8000-000000000003');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.newp('AUTO'), 'P-00003', 'codes: the next automatic code follows the explicit ones');
SELECT is(pg_temp.newp('P-00010'), 'P-00010', 'codes: an explicit code is kept');
SELECT is(pg_temp.newp('AUTO'), 'P-00011', 'codes: AUTO after an explicit P-00010 does not collide');
SELECT is(pg_temp.newp('EXT-7'), 'EXT-7', 'codes: codes in another format are accepted');
SELECT is(pg_temp.newp(NULL), 'P-00012', 'codes: other formats do not move the counter');
UPDATE public.patients SET patient_code = 'P-00050' WHERE id = 'c0000000-0000-4000-8000-0000000000a2';
SELECT is(pg_temp.newp(''), 'P-00051', 'codes: changing a code with UPDATE also synchronises the counter');
SELECT throws_ok($$UPDATE public.patients SET patient_code = 'AUTO' WHERE id = 'c0000000-0000-4000-8000-0000000000a1'$$, '23514', NULL,
                 'codes: a code cannot be cleared with UPDATE');
RESET ROLE;
UPDATE private.org_counters SET last_value = 9 WHERE org_id = '0a000000-0000-4000-8000-00000000000a' AND counter_type = 'patient';
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.newp('AUTO'), 'P-00013', 'codes: a stale counter (legacy data) skips codes that already exist');
SELECT throws_ok($$SELECT pg_temp.newp('P-00001')$$, '23505', NULL, 'codes: UNIQUE (org, code) remains the final authority');
RESET ROLE;

-- ========================================================================= 2. clinic sign-up
SELECT pg_temp.claims('90000000-0000-4000-8000-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.create_organization('Clínica Sin Confirmar')$$, 'KO001', NULL, 'signup: an unconfirmed e-mail cannot create a clinic');
RESET ROLE;
SELECT pg_temp.claims('90000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.create_organization('x')$$, '22023', NULL, 'signup: the clinic name is validated');
SELECT throws_ok($$SELECT public.create_organization('Clínica', 'premium-inventado')$$, '22023', NULL, 'signup: unknown plans are rejected');
INSERT INTO ids SELECT 'neworg', public.create_organization('Clínica Nueva Sintética', 'professional', 'Dra. Sintética')::text;
SELECT is((SELECT row(role, is_admin, plan_code, subscription_status, account_status)::text FROM public.my_organizations()),
          row('psychologa', true, 'professional', 'trialing', 'active')::text,
          'signup: creator is psychologist + administrator, trial subscription, active account');
SELECT ok((SELECT trial_ends_at > now() + interval '13 days' FROM public.my_organizations()), 'signup: the trial end comes from the plan');
SELECT is((SELECT count(*)::int FROM public.professionals WHERE org_id = (SELECT v::uuid FROM ids WHERE k = 'neworg') AND user_id = auth.uid()), 1,
          'signup: the creator gets a linked professional profile');
SELECT is((SELECT count(*)::int FROM public.services WHERE org_id = (SELECT v::uuid FROM ids WHERE k = 'neworg')), 1, 'signup: a starter service is created');
SELECT is((SELECT count(*)::int FROM public.patients), 0, 'signup: the new clinic does not see any other clinic''s patients');
SELECT lives_ok($$SELECT public.create_organization('Segunda'); SELECT public.create_organization('Tercera')$$, 'signup: up to 3 clinics per account');
SELECT throws_ok($$SELECT public.create_organization('Cuarta')$$, 'KO002', NULL, 'signup: anti-abuse limit of clinics per account');
RESET ROLE;

-- ========================================================================= 3. isolation and roles
SELECT pg_temp.claims('b0000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.patients WHERE org_id = '0a000000-0000-4000-8000-00000000000a'), 0, 'isolation: clinic B cannot read clinic A patients');
SELECT throws_ok($$INSERT INTO public.patients(org_id, patient_code, first_name, last_name) VALUES ('0a000000-0000-4000-8000-00000000000a', 'AUTO', 'X', 'Y')$$,
                 '42501', NULL, 'isolation: clinic B cannot insert into clinic A (forged org_id)');
SELECT throws_ok($$SELECT * FROM public.list_team('0a000000-0000-4000-8000-00000000000a')$$, '42501', NULL, 'isolation: clinic B cannot list clinic A''s team');
SELECT is((SELECT count(*)::int FROM public.subscriptions), 1, 'isolation: only its own subscription is visible');
RESET ROLE;

SELECT pg_temp.claims('a0000000-0000-4000-8000-000000000003');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$INSERT INTO public.services(org_id, name, duration_minutes) VALUES ('0a000000-0000-4000-8000-00000000000a', 'X', 50)$$, '42501', NULL,
                 'roles: reception cannot create services');
SELECT is((SELECT count(*)::int FROM public.invoices), 0, 'roles: reception does not read invoices');
SELECT is((SELECT count(*) FILTER (WHERE email IS NOT NULL)::int FROM public.list_team('0a000000-0000-4000-8000-00000000000a')), 1,
          'roles: non-admins see colleagues but only their own e-mail');
RESET ROLE;
SELECT pg_temp.claims('a0000000-0000-4000-8000-000000000004');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.patients), 0, 'roles: gestoría does not read patients');
SELECT is((SELECT count(*)::int FROM public.clinical_notes), 0, 'roles: gestoría does not read clinical notes');
RESET ROLE;

SELECT pg_temp.claims('a0000000-0000-4000-8000-000000000002');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$INSERT INTO public.services(org_id, name, duration_minutes, price_cents) VALUES ('0a000000-0000-4000-8000-00000000000a', 'Pareja', 80, 9000)$$,
                'config: a psychologist can create services (baseline gap closed)');
UPDATE public.organizations SET name = 'Nombre cambiado por no-admin' WHERE id = '0a000000-0000-4000-8000-00000000000a';
SELECT throws_ok($$INSERT INTO public.professionals(org_id, display_name) VALUES ('0a000000-0000-4000-8000-00000000000a', 'X')$$, '42501', NULL,
                 'config: only administrators add professionals');
SELECT lives_ok($$UPDATE public.professionals SET specialty = 'Infanto-juvenil' WHERE id = 'e1000000-0000-4000-8000-000000000002'$$,
                'config: a professional edits their own profile');
SELECT throws_ok($$UPDATE public.professionals SET user_id = 'a0000000-0000-4000-8000-000000000003' WHERE id = 'e1000000-0000-4000-8000-000000000002'$$, '42501', NULL,
                 'config: a professional cannot relink their profile to another user');
SELECT lives_ok($$INSERT INTO public.professional_availability(org_id, professional_id, weekday, start_minute, end_minute) VALUES ('0a000000-0000-4000-8000-00000000000a', 'e1000000-0000-4000-8000-000000000002', 1, 540, 840)$$,
                'availability: a professional sets their own weekly hours');
SELECT throws_ok($$INSERT INTO public.professional_availability(org_id, professional_id, weekday, start_minute, end_minute) VALUES ('0a000000-0000-4000-8000-00000000000a', 'e1000000-0000-4000-8000-000000000002', 1, 800, 900)$$,
                 '23P01', NULL, 'availability: overlapping ranges are rejected by the database');
SELECT throws_ok($$INSERT INTO public.professional_availability(org_id, professional_id, weekday, start_minute, end_minute) VALUES ('0a000000-0000-4000-8000-00000000000a', 'e1000000-0000-4000-8000-000000000001', 2, 540, 840)$$,
                 '42501', NULL, 'availability: a non-admin cannot edit a colleague''s hours');
RESET ROLE;
SELECT is((SELECT name FROM public.organizations WHERE id = '0a000000-0000-4000-8000-00000000000a'), 'Consulta Ficticia A',
          'config: a non-admin cannot rename the clinic (RLS, no row changed)');

SELECT pg_temp.claims('a0000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
UPDATE public.organizations SET name = 'Consulta Ficticia A (renombrada)', settings = '{"dueDays": 15}' WHERE id = '0a000000-0000-4000-8000-00000000000a';
SELECT throws_ok($$UPDATE public.organizations SET account_status = 'active' WHERE id = '0a000000-0000-4000-8000-00000000000a'$$, '42501', NULL,
                 'config: the account status is not writable by the clinic (column privilege)');
SELECT lives_ok($$INSERT INTO public.professional_availability(org_id, professional_id, weekday, start_minute, end_minute) VALUES ('0a000000-0000-4000-8000-00000000000a', 'e1000000-0000-4000-8000-000000000001', 2, 540, 840)$$,
                'availability: an administrator edits any professional''s hours');
UPDATE public.services SET price_cents = 6500 WHERE id = 'e2000000-0000-4000-8000-000000000001';
RESET ROLE;
SELECT is((SELECT name FROM public.organizations WHERE id = '0a000000-0000-4000-8000-00000000000a'), 'Consulta Ficticia A (renombrada)', 'config: the administrator renames the clinic');
SELECT is((SELECT metadata -> 'changed' FROM public.audit_log WHERE entity_type = 'services' AND action = 'update' ORDER BY id DESC LIMIT 1), '["price_cents"]'::jsonb,
          'audit: configuration changes record which fields changed');
SELECT ok((SELECT NOT (metadata::text LIKE '%6500%') FROM public.audit_log WHERE entity_type = 'services' AND action = 'update' ORDER BY id DESC LIMIT 1),
          'audit: values are not copied into the log');
SELECT is((SELECT metadata -> 'changed' FROM public.audit_log WHERE entity_type = 'organizations' ORDER BY id DESC LIMIT 1), '["name", "settings"]'::jsonb,
          'audit: clinic settings changes are traced');

-- ========================================================================= 4. invitations and team
SELECT pg_temp.claims('a0000000-0000-4000-8000-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.invite_member('0a000000-0000-4000-8000-00000000000a', 'invitada@kovo.test', 'recepcion')$$, '42501', NULL,
                 'team: only administrators invite');
RESET ROLE;
SELECT pg_temp.claims('a0000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.invite_member('0a000000-0000-4000-8000-00000000000a', 'invitada@kovo.test', 'superadmin')$$, '22023', NULL, 'team: unknown roles are rejected');
SELECT throws_ok($$SELECT public.invite_member('0a000000-0000-4000-8000-00000000000a', 'psico-a2@kovo.test', 'recepcion')$$, 'KT001', NULL, 'team: current members cannot be invited again');
INSERT INTO ids SELECT 'token', public.invite_member('0a000000-0000-4000-8000-00000000000a', 'Invitada@kovo.test', 'recepcion') ->> 'token';
SELECT is((SELECT count(*)::int FROM public.org_invitations WHERE accepted_at IS NULL AND revoked_at IS NULL), 1, 'team: the administrator sees the pending invitation');
SELECT throws_ok($$SELECT token_hash FROM public.org_invitations$$, '42501', NULL, 'team: the token hash is not readable through the API');
SELECT throws_ok($$SELECT public.update_membership(id, NULL, NULL, false) FROM public.memberships WHERE user_id = auth.uid()$$, 'KT005', NULL,
                 'team: an administrator cannot remove their own admin rights');
RESET ROLE;
SELECT is((SELECT token_hash FROM public.org_invitations WHERE accepted_at IS NULL AND revoked_at IS NULL),
          encode(digest((SELECT v FROM ids WHERE k = 'token'), 'sha256'), 'hex'), 'team: only the SHA-256 of the token is stored');

SELECT pg_temp.claims('90000000-0000-4000-8000-000000000004');
SET LOCAL ROLE authenticated;
SELECT throws_ok(format('SELECT public.accept_invitation(%L)', (SELECT v FROM ids WHERE k = 'token')), 'KT004', NULL,
                 'team: an invitation cannot be accepted with a different e-mail');
SELECT throws_ok($$SELECT public.accept_invitation('token-inventado')$$, 'KT003', NULL, 'team: invented tokens are rejected');
RESET ROLE;
SELECT pg_temp.claims('90000000-0000-4000-8000-000000000003');
SET LOCAL ROLE authenticated;
SELECT is((SELECT (public.accept_invitation((SELECT v FROM ids WHERE k = 'token')) ->> 'role')), 'recepcion', 'team: the invited person joins with the invited role');
SELECT is((SELECT count(*)::int FROM public.patients WHERE org_id = '0a000000-0000-4000-8000-00000000000a') > 0, true, 'team: the new member reads what their role allows');
SELECT throws_ok(format('SELECT public.accept_invitation(%L)', (SELECT v FROM ids WHERE k = 'token')), 'KT003', NULL, 'team: an invitation is single-use');
RESET ROLE;

SELECT pg_temp.claims('a0000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.update_membership(id, NULL, false) FROM public.memberships WHERE user_id = '90000000-0000-4000-8000-000000000003'$$,
                'team: an administrator deactivates a member');
RESET ROLE;
SELECT pg_temp.claims('90000000-0000-4000-8000-000000000003');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.patients), 0, 'team: a deactivated member loses access immediately');
RESET ROLE;

-- Plan limits (clinic B: Starter, provisional 2 members / 1 professional).
SELECT pg_temp.claims('b0000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.invite_member('0b000000-0000-4000-8000-00000000000b', 'otra@kovo.test', 'recepcion')$$, 'plans: invitation within the limit');
SELECT throws_ok($$SELECT public.invite_member('0b000000-0000-4000-8000-00000000000b', 'tercera@kovo.test', 'gestoria')$$, 'KP001', NULL,
                 'plans: pending invitations count towards the member limit');
SELECT throws_ok($$INSERT INTO public.professionals(org_id, display_name) VALUES ('0b000000-0000-4000-8000-00000000000b', 'Segunda profesional')$$, 'KP001', NULL,
                 'plans: the professional limit is enforced by the database (direct REST too)');
SELECT lives_ok($$INSERT INTO public.professionals(org_id, display_name, active) VALUES ('0b000000-0000-4000-8000-00000000000b', 'Archivada', false)$$,
                'plans: inactive professionals do not count');
SELECT lives_ok($$SELECT public.change_plan('0b000000-0000-4000-8000-00000000000b', 'clinic')$$, 'plans: during the trial the administrator can change plan');
SELECT lives_ok($$INSERT INTO public.professionals(org_id, display_name) VALUES ('0b000000-0000-4000-8000-00000000000b', 'Segunda profesional')$$,
                'plans: after upgrading the new limit applies');
SELECT throws_ok($$SELECT public.change_plan('0b000000-0000-4000-8000-00000000000b', 'starter')$$, 'KP002', NULL,
                 'plans: no downgrade below current usage');
SELECT lives_ok($$SELECT public.set_subscription_cancellation('0b000000-0000-4000-8000-00000000000b', true)$$, 'plans: the administrator can cancel at period end');
RESET ROLE;
SELECT pg_temp.claims('a0000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.change_plan('0a000000-0000-4000-8000-00000000000a', 'clinic')$$, 'KP003', NULL,
                 'plans: a paid plan cannot be changed without the payment provider');
SELECT throws_ok($$UPDATE public.subscriptions SET plan_code = 'clinic'$$, '42501', NULL, 'plans: subscriptions are not writable by the clinic');
RESET ROLE;

-- ========================================================================= 5. platform administration
SELECT pg_temp.claims('a0000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT * FROM public.platform_list_organizations()$$, '42501', NULL, 'platform: clinic administrators are not KOVO staff');
SELECT is(public.am_platform_admin(), false, 'platform: am_platform_admin() is false for clinic users');
RESET ROLE;
INSERT INTO public.platform_admins(user_id, note) VALUES ('f0000000-0000-4000-8000-000000000001', 'pgTAP');
SELECT pg_temp.claims('f0000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT ok((SELECT count(*) >= 2 FROM public.platform_list_organizations()), 'platform: staff list every clinic');
SELECT is((SELECT row(members, patients)::text FROM public.platform_list_organizations() WHERE org_id = '0a000000-0000-4000-8000-00000000000a'),
          row(4, 9)::text, 'platform: only aggregated counts');
SELECT is((SELECT count(*)::int FROM public.patients), 0, 'platform: staff cannot read patients');
SELECT is((SELECT count(*)::int FROM public.clinical_notes), 0, 'platform: staff cannot read clinical notes');
SELECT throws_ok($$SELECT public.platform_set_account_status('0a000000-0000-4000-8000-00000000000a', 'suspended', '')$$, '22023', NULL, 'platform: a reason is mandatory');
SELECT lives_ok($$SELECT public.platform_set_account_status('0a000000-0000-4000-8000-00000000000a', 'suspended', 'Prueba de suspensión')$$, 'platform: staff suspend a clinic');
RESET ROLE;
SELECT is((SELECT action FROM public.platform_audit_log ORDER BY id DESC LIMIT 1), 'set_account_status', 'platform: staff actions are audited');

SELECT pg_temp.claims('a0000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT ok((SELECT count(*) > 0 FROM public.patients), 'suspended: data can still be read (and exported)');
SELECT throws_ok($$SELECT pg_temp.newp('AUTO')$$, 'KS001', NULL, 'suspended: writes are refused by the database');
SELECT throws_ok($$UPDATE public.organizations SET name = 'Otro' WHERE id = '0a000000-0000-4000-8000-00000000000a'$$, 'KS001', NULL, 'suspended: settings are read-only');
SELECT throws_ok($$SELECT public.invite_member('0a000000-0000-4000-8000-00000000000a', 'x@kovo.test', 'recepcion')$$, 'KS001', NULL, 'suspended: no invitations');
SELECT lives_ok($$INSERT INTO public.support_tickets(org_id, subject, body) VALUES ('0a000000-0000-4000-8000-00000000000a', 'Cuenta suspendida', 'Necesitamos ayuda')$$,
                'suspended: the clinic can still contact support');
SELECT throws_ok($$INSERT INTO public.support_tickets(org_id, subject, body) VALUES ('0b000000-0000-4000-8000-00000000000b', 'Ajeno', 'Ticket en otra clínica')$$, '42501', NULL,
                 'support: tickets only for one''s own clinic');
RESET ROLE;
SELECT is((SELECT row(status, created_by::text)::text FROM public.support_tickets LIMIT 1), row('open', 'a0000000-0000-4000-8000-000000000001')::text,
          'support: author and status are set by the database');
SELECT pg_temp.claims('f0000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.platform_list_tickets('open')), 1, 'platform: staff see the ticket');
SELECT lives_ok($$SELECT public.platform_update_ticket((SELECT id FROM public.platform_list_tickets() LIMIT 1), 'closed', 'Resuelto')$$, 'platform: staff answer and close it');
SELECT lives_ok($$SELECT public.platform_set_account_status('0a000000-0000-4000-8000-00000000000a', 'active', 'Fin de la prueba')$$, 'platform: staff reactivate the clinic');
SELECT lives_ok($$SELECT public.platform_set_account_status('0a000000-0000-4000-8000-00000000000a', 'closed', 'Prueba de cierre')$$, 'platform: staff close a clinic');
RESET ROLE;
SELECT pg_temp.claims('a0000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.patients), 0, 'closed: members of a closed clinic lose all access');
SELECT is((SELECT count(*)::int FROM public.my_organizations()), 0, 'closed: the clinic disappears from the selector');
RESET ROLE;
SELECT pg_temp.claims('f0000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.platform_set_account_status('0a000000-0000-4000-8000-00000000000a', 'active', 'Reapertura de prueba')$$, 'platform: staff reopen it');
RESET ROLE;

-- ========================================================================= 6. revocable sessions
SELECT pg_temp.claims('a0000000-0000-4000-8000-000000000001', jsonb_build_object('session_id', gen_random_uuid()));
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.patients), 0, 'sessions: a JWT whose session no longer exists in auth.sessions has no access');
RESET ROLE;
INSERT INTO auth.sessions(id, user_id, created_at) VALUES ('5e550000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', now());
SELECT pg_temp.claims('a0000000-0000-4000-8000-000000000001', '{"session_id": "5e550000-0000-4000-8000-000000000001"}');
SET LOCAL ROLE authenticated;
SELECT ok((SELECT count(*) > 0 FROM public.patients), 'sessions: a live session works');
RESET ROLE;
SELECT pg_temp.claims('a0000000-0000-4000-8000-000000000002', '{"session_id": "5e550000-0000-4000-8000-000000000001"}');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.patients), 0, 'sessions: another user''s session id is not accepted');
RESET ROLE;

-- ========================================================================= 7. invoices and payments
INSERT INTO public.organization_billing_profiles(org_id, legal_name, tax_id, address_line, postal_code, city)
VALUES ('0a000000-0000-4000-8000-00000000000a', 'Consulta Ficticia A SL', 'B00000000', 'Calle Ficticia 1', '29001', 'Málaga');
INSERT INTO public.patient_billing_profiles(org_id, patient_id, legal_name, address_line)
VALUES ('0a000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-0000000000a1', 'Paciente Ficticio Uno', 'Calle Inventada 2');
SELECT pg_temp.claims('a0000000-0000-4000-8000-000000000004');
SET LOCAL ROLE authenticated;
INSERT INTO ids SELECT 'inv', public.save_invoice_draft('0a000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-0000000000a1', current_date, NULL,
  '[{"description": "Sesión", "quantity": 2, "unit_price_cents": 6000, "tax_rate": 0}]')::text;
SELECT throws_ok(format('SELECT public.record_invoice_payment(%L, 1000, %L)', (SELECT v FROM ids WHERE k = 'inv'), 'bizum'), 'KB001', NULL,
                 'payments: drafts cannot be paid');
SELECT lives_ok(format('SELECT public.emit_invoice(%L)', (SELECT v FROM ids WHERE k = 'inv')), 'invoices: gestoría issues the invoice');
SELECT is((SELECT status FROM public.record_invoice_payment((SELECT v::uuid FROM ids WHERE k = 'inv'), 5000, 'bizum')), 'partially_paid', 'payments: partial payment');
SELECT throws_ok(format('SELECT public.record_invoice_payment(%L, 9000, %L)', (SELECT v FROM ids WHERE k = 'inv'), 'tarjeta'), 'KB002', NULL,
                 'payments: overpayment is rejected');
SELECT is((SELECT status FROM public.record_invoice_payment((SELECT v::uuid FROM ids WHERE k = 'inv'), 7000, 'tarjeta')), 'paid', 'payments: fully paid');
SELECT throws_ok(format('UPDATE public.payments SET amount_cents = 1 WHERE invoice_id = %L', (SELECT v FROM ids WHERE k = 'inv')), '42501', NULL,
                 'payments: recorded payments cannot be edited');
SELECT throws_ok(format('UPDATE public.invoices SET status = %L WHERE id = %L', 'draft', (SELECT v FROM ids WHERE k = 'inv')), 'P0001', NULL,
                 'invoices: an issued invoice cannot be changed through REST');
SELECT throws_ok(format('SELECT public.delete_invoice_draft(%L)', (SELECT v FROM ids WHERE k = 'inv')), 'KB003', NULL, 'invoices: issued invoices cannot be discarded');
INSERT INTO ids SELECT 'draft', public.save_invoice_draft('0a000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-0000000000a1', current_date, NULL,
  '[{"description": "Sesión", "quantity": 1, "unit_price_cents": 6000, "tax_rate": 0}]')::text;
SELECT lives_ok(format('SELECT public.delete_invoice_draft(%L)', (SELECT v FROM ids WHERE k = 'draft')), 'invoices: drafts can be discarded');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.payments WHERE invoice_id = (SELECT v::uuid FROM ids WHERE k = 'inv')), 2, 'payments: both payments recorded');
SELECT ok((SELECT invoice_number ~ '^KOVO-\d{4}-\d{6}$' AND issuer_snapshot ->> 'tax_id' = 'B00000000' FROM public.invoices WHERE id = (SELECT v::uuid FROM ids WHERE k = 'inv')),
          'invoices: number and fiscal snapshot fixed at issue');

-- ========================================================================= 8. documents and reminders
SELECT pg_temp.claims('a0000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$INSERT INTO public.patient_documents(org_id, patient_id, storage_path, document_type, file_name) VALUES
  ('0a000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-0000000000a1', '0b000000-0000-4000-8000-00000000000b/c0000000-0000-4000-8000-0000000000a1/00000000-0000-4000-8000-000000000001-x.pdf', 'otro', 'x.pdf')$$,
  'KD001', NULL, 'documents: the object path must belong to the same clinic and patient');
SELECT lives_ok($$INSERT INTO public.patient_documents(id, org_id, patient_id, storage_path, document_type, file_name, mime_type, size_bytes) VALUES
  ('d0c00000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-0000000000a1',
   '0a000000-0000-4000-8000-00000000000a/c0000000-0000-4000-8000-0000000000a1/00000000-0000-4000-8000-000000000001-consentimiento.pdf', 'consentimiento', 'consentimiento.pdf', 'application/pdf', 1234)$$,
  'documents: valid document row');
SELECT throws_ok($$UPDATE public.patient_documents SET storage_path = 'x' WHERE id = 'd0c00000-0000-4000-8000-000000000001'$$, 'KD002', NULL, 'documents: the path cannot be changed');
SELECT throws_ok($$INSERT INTO public.patient_documents(org_id, patient_id, storage_path, document_type, file_name, mime_type) VALUES
  ('0a000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-0000000000a1', '0a000000-0000-4000-8000-00000000000a/c0000000-0000-4000-8000-0000000000a1/00000000-0000-4000-8000-000000000002-x.exe', 'otro', 'x.exe', 'application/x-msdownload')$$,
  '23514', NULL, 'documents: only PDF, JPEG and PNG');
UPDATE public.patient_documents SET deleted_at = now() WHERE id = 'd0c00000-0000-4000-8000-000000000001';
SELECT is((SELECT deleted_by FROM public.patient_documents WHERE id = 'd0c00000-0000-4000-8000-000000000001'), 'a0000000-0000-4000-8000-000000000001'::uuid,
          'documents: withdrawal records who did it');
SELECT throws_ok($$DELETE FROM public.patient_documents$$, '42501', NULL, 'documents: rows are never hard-deleted from the app');
RESET ROLE;
SELECT pg_temp.claims('a0000000-0000-4000-8000-000000000003');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.patient_documents), 0, 'documents: reception does not see clinical documents');
INSERT INTO public.appointments(id, org_id, patient_id, starts_at, ends_at, status)
VALUES ('a9900000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-0000000000a1', now() + interval '3 days', now() + interval '3 days 50 minutes', 'scheduled');
SELECT is((SELECT row(status, send_at = (SELECT starts_at - interval '24 hours' FROM public.appointments WHERE id = 'a9900000-0000-4000-8000-000000000001'))::text
           FROM public.appointment_reminders WHERE appointment_id = 'a9900000-0000-4000-8000-000000000001'), row('pending', true)::text,
          'reminders: a pending reminder is queued 24 h before');
UPDATE public.appointments SET status = 'cancelled' WHERE id = 'a9900000-0000-4000-8000-000000000001';
SELECT is((SELECT array_agg(status) FROM public.appointment_reminders WHERE appointment_id = 'a9900000-0000-4000-8000-000000000001'), ARRAY['cancelled'],
          'reminders: cancelling the appointment cancels the reminder');
SELECT throws_ok($$INSERT INTO public.appointment_reminders(org_id, appointment_id, send_at) VALUES ('0a000000-0000-4000-8000-00000000000a', 'a9900000-0000-4000-8000-000000000001', now())$$,
                 '42501', NULL, 'reminders: the outbox is not writable by the app');
RESET ROLE;

-- ========================================================================= 9. payment provider events
SELECT pg_temp.claims('b0000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.apply_billing_event('stripe', 'evt_1', 'x', '{}')$$, '42501', NULL, 'billing: the browser cannot inject provider events');
SELECT throws_ok($$SELECT * FROM public.billing_provider_events$$, '42501', NULL, 'billing: the event inbox is not readable by clinics');
RESET ROLE;
SELECT is(public.apply_billing_event('stripe', 'evt_unpaid', 'customer.subscription.updated',
          '{"org_id": "0b000000-0000-4000-8000-00000000000b", "plan_code": "clinic", "status": "unpaid", "provider_subscription_id": "sub_test_1"}'),
          'processed', 'billing: a normalised provider event is processed');
SELECT is(public.apply_billing_event('stripe', 'evt_unpaid', 'customer.subscription.updated', '{}'), 'duplicate', 'billing: events are idempotent (redelivery)');
SELECT is((SELECT row(account_status, status_reason)::text FROM public.organizations WHERE id = '0b000000-0000-4000-8000-00000000000b'), row('suspended', 'billing:unpaid')::text,
          'billing: unpaid subscription → clinic read-only (pending approval of the rule)');
SELECT is(public.apply_billing_event('stripe', 'evt_paid', 'customer.subscription.updated',
          '{"org_id": "0b000000-0000-4000-8000-00000000000b", "status": "active"}'), 'processed', 'billing: payment recovered');
SELECT is((SELECT account_status FROM public.organizations WHERE id = '0b000000-0000-4000-8000-00000000000b'), 'active', 'billing: the clinic is reactivated');
SELECT is(public.apply_billing_event('stripe', 'evt_bad', 'x', '{"org_id": "0b000000-0000-4000-8000-00000000000b", "status": "inventado"}'), 'error',
          'billing: malformed events are kept with their error, not applied');
SELECT is((SELECT count(*)::int FROM public.billing_provider_events WHERE error IS NOT NULL), 1, 'billing: the failed event stays in the inbox for review');

SELECT * FROM finish();
ROLLBACK;
