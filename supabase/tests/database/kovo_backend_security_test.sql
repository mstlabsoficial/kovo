-- KOVO proposed backend: role, tenant and write-boundary tests.
-- This suite runs only on the disposable schema assembled by
-- scripts/validate-backend-proposal.sh. All fixtures are rolled back.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = extensions, public;

SELECT plan(43);

-- Deterministic test actors: psychologist, reception and finance in Org A,
-- plus a psychologist in Org B to prove tenant isolation.
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'authenticated', 'authenticated',
   'psych-a@kovo.test', 'not-a-real-password', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'authenticated', 'authenticated',
   'reception-a@kovo.test', 'not-a-real-password', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'authenticated', 'authenticated',
   'finance-a@kovo.test', 'not-a-real-password', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'authenticated', 'authenticated',
   'psych-b@kovo.test', 'not-a-real-password', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

INSERT INTO public.organizations (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'KOVO Test Org A'),
  ('22222222-2222-2222-2222-222222222222', 'KOVO Test Org B');

INSERT INTO public.memberships (org_id, user_id, role, active) VALUES
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'psychologa', true),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'recepcion', true),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'gestoria', true),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'psychologa', true);

INSERT INTO public.patients (id, org_id, patient_code, first_name, last_name) VALUES
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', '11111111-1111-1111-1111-111111111111', 'A-001', 'Paciente', 'Uno'),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc2', '11111111-1111-1111-1111-111111111111', 'A-002', 'Paciente', 'Dos'),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd1', '22222222-2222-2222-2222-222222222222', 'B-001', 'Paciente', 'Tres');

INSERT INTO public.professionals (id, org_id, display_name) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', '11111111-1111-1111-1111-111111111111', 'Profesional A');

INSERT INTO public.appointments (
  id, org_id, patient_id, professional_id, starts_at, ends_at, status
) VALUES
  ('ffffffff-ffff-ffff-ffff-fffffffffff1',
   '11111111-1111-1111-1111-111111111111',
   'cccccccc-cccc-cccc-cccc-ccccccccccc1',
   'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1',
   '2026-11-10 10:00:00+01', '2026-11-10 10:50:00+01', 'scheduled'),
  ('ffffffff-ffff-ffff-ffff-fffffffffff2',
   '11111111-1111-1111-1111-111111111111',
   'cccccccc-cccc-cccc-cccc-ccccccccccc1',
   NULL,
   '2026-11-10 11:00:00+01', '2026-11-10 11:50:00+01', 'completed'),
  ('ffffffff-ffff-ffff-ffff-fffffffffff3',
   '11111111-1111-1111-1111-111111111111',
   'cccccccc-cccc-cccc-cccc-ccccccccccc2',
   NULL,
   '2026-11-10 12:00:00+01', '2026-11-10 12:50:00+01', 'completed'),
  ('ffffffff-ffff-ffff-ffff-fffffffffff4',
   '22222222-2222-2222-2222-222222222222',
   'dddddddd-dddd-dddd-dddd-ddddddddddd1',
   NULL,
   '2026-11-10 10:00:00+01', '2026-11-10 10:50:00+01', 'scheduled');

INSERT INTO public.clinical_notes (
  org_id, patient_id, appointment_id, author_id, note_type, content, status
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'cccccccc-cccc-cccc-cccc-ccccccccccc1',
  'ffffffff-ffff-ffff-ffff-fffffffffff1',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'session', 'Synthetic test note only', 'draft'
);

INSERT INTO public.organization_billing_profiles (
  org_id, legal_name, tax_id, address_line, postal_code, city, country_code, invoice_series
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'KOVO Test Clinic', 'X0000000T', 'Calle de Prueba 1', '29001', 'Málaga', 'ES', 'TEST'
);

INSERT INTO public.patient_billing_profiles (
  org_id, patient_id, legal_name, tax_id, address_line, postal_code, city, country_code
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'cccccccc-cccc-cccc-cccc-ccccccccccc1',
  'Paciente Uno', '12345678Z', 'Calle Ficticia 2', '29002', 'Málaga', 'ES'
);

INSERT INTO public.invoices (id, org_id, patient_id, status, issue_date)
VALUES (
  '99999999-9999-9999-9999-999999999991',
  '11111111-1111-1111-1111-111111111111',
  'cccccccc-cccc-cccc-cccc-ccccccccccc1',
  'draft', DATE '2026-11-10'
);

-- Psychologist A
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';

SELECT is((SELECT count(*)::bigint FROM public.patients WHERE id = 'cccccccc-cccc-cccc-cccc-ccccccccccc1'), 1::bigint, 'psychologist reads their own patient');
SELECT is((SELECT count(*)::bigint FROM public.patients WHERE id = 'dddddddd-dddd-dddd-dddd-ddddddddddd1'), 0::bigint, 'psychologist cannot read another organization patient');
SELECT is((SELECT count(*)::bigint FROM public.appointments WHERE id = 'ffffffff-ffff-ffff-ffff-fffffffffff1'), 1::bigint, 'psychologist reads their own appointment');
SELECT is((SELECT count(*)::bigint FROM public.clinical_notes WHERE patient_id = 'cccccccc-cccc-cccc-cccc-ccccccccccc1'), 1::bigint, 'psychologist reads clinical notes');
SELECT isnt(
  public.save_clinical_note_draft(
    '11111111-1111-1111-1111-111111111111',
    'cccccccc-cccc-cccc-cccc-ccccccccccc1',
    'ffffffff-ffff-ffff-ffff-fffffffffff1',
    'session', 'TAP created clinical draft', '77777777-7777-7777-7777-777777777771'
  ),
  NULL::uuid,
  'psychologist can create a draft linked to the same patient appointment'
);
SELECT is(
  public.save_clinical_note_draft(
    '11111111-1111-1111-1111-111111111111',
    'cccccccc-cccc-cccc-cccc-ccccccccccc1',
    'ffffffff-ffff-ffff-ffff-fffffffffff1',
    'session', 'TAP created clinical draft', '77777777-7777-7777-7777-777777777771'
  )::text,
  '77777777-7777-7777-7777-777777777771'::text,
  'retry with the same client draft UUID returns the same note id'
);
SELECT isnt(
  public.save_clinical_note_draft(
    '11111111-1111-1111-1111-111111111111',
    'cccccccc-cccc-cccc-cccc-ccccccccccc1',
    'ffffffff-ffff-ffff-ffff-fffffffffff1',
    'session', 'TAP edited clinical draft',
    '77777777-7777-7777-7777-777777777771'
  ),
  NULL::uuid,
  'psychologist can edit their own draft'
);
SELECT is(
  (SELECT count(*)::bigint FROM public.clinical_notes WHERE content = 'TAP edited clinical draft'),
  1::bigint,
  'clinical draft edit persists its new content'
);
SELECT throws_ok(
  $$SELECT public.save_clinical_note_draft(
    '11111111-1111-1111-1111-111111111111',
    'cccccccc-cccc-cccc-cccc-ccccccccccc1',
    'ffffffff-ffff-ffff-ffff-fffffffffff3',
    'session', 'Invalid patient appointment combination', NULL
  )$$,
  'P0001', NULL, 'clinical draft RPC rejects an appointment belonging to a different patient'
);
SELECT is((SELECT count(*)::bigint FROM public.organization_billing_profiles WHERE org_id = '11111111-1111-1111-1111-111111111111'), 1::bigint, 'psychologist reads organization billing profile');
SELECT is((SELECT count(*)::bigint FROM public.patient_billing_profiles WHERE patient_id = 'cccccccc-cccc-cccc-cccc-ccccccccccc1'), 1::bigint, 'psychologist reads patient billing profile');

SELECT is(
  public.record_patient_consent(
    '11111111-1111-1111-1111-111111111111',
    'cccccccc-cccc-cccc-cccc-ccccccccccc1',
    'privacy', 'v1', 'granted',
    TIMESTAMPTZ '2026-11-09 12:00:00+01', NULL, NULL,
    '88888888-8888-8888-8888-888888888881'
  )::text,
  public.record_patient_consent(
    '11111111-1111-1111-1111-111111111111',
    'cccccccc-cccc-cccc-cccc-ccccccccccc1',
    'privacy', 'v1', 'granted',
    TIMESTAMPTZ '2026-11-09 12:00:00+01', NULL, NULL,
    '88888888-8888-8888-8888-888888888881'
  )::text,
  'repeated consent request returns the same event id'
);
SELECT is((SELECT count(*)::bigint FROM public.patient_consents), 1::bigint, 'consent retry creates only one event');
SELECT is((SELECT count(*)::bigint FROM public.patient_consent_status), 1::bigint, 'consent event updates the operational projection');
SELECT throws_ok(
  $$SELECT public.record_patient_consent(
    '22222222-2222-2222-2222-222222222222',
    'dddddddd-dddd-dddd-dddd-ddddddddddd1',
    'privacy', 'v1', 'pending', NULL, NULL, NULL,
    '88888888-8888-8888-8888-888888888882'
  )$$,
  '42501', NULL, 'psychologist cannot write consent in another organization'
);
SELECT throws_ok(
  $$INSERT INTO public.patient_consents (
    org_id, patient_id, consent_type, document_version, status, recorded_by, request_key
  ) VALUES (
    '11111111-1111-1111-1111-111111111111',
    'cccccccc-cccc-cccc-cccc-ccccccccccc1',
    'privacy', 'v1', 'pending',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    '88888888-8888-8888-8888-888888888883'
  )$$,
  '42501', NULL, 'clinical consent events cannot be inserted directly'
);

-- Reception A
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2';

SELECT is((SELECT count(*)::bigint FROM public.patients WHERE id = 'cccccccc-cccc-cccc-cccc-ccccccccccc1'), 1::bigint, 'reception reads their own patient');
SELECT is((SELECT count(*)::bigint FROM public.patients WHERE id = 'dddddddd-dddd-dddd-dddd-ddddddddddd1'), 0::bigint, 'reception cannot read another organization patient');
SELECT is((SELECT count(*)::bigint FROM public.appointments WHERE id = 'ffffffff-ffff-ffff-ffff-fffffffffff1'), 1::bigint, 'reception reads their own appointment');
SELECT is((SELECT count(*)::bigint FROM public.clinical_notes), 0::bigint, 'reception cannot read clinical notes');
SELECT is((SELECT count(*)::bigint FROM public.patient_consent_status), 1::bigint, 'reception reads the limited consent status projection');
SELECT is((SELECT count(*)::bigint FROM public.patient_consents), 0::bigint, 'reception cannot read private consent events');
SELECT is((SELECT count(*)::bigint FROM public.organization_billing_profiles), 0::bigint, 'reception cannot read organization billing profile');
SELECT throws_ok(
  $$SELECT public.record_patient_consent(
    '11111111-1111-1111-1111-111111111111',
    'cccccccc-cccc-cccc-cccc-ccccccccccc1',
    'privacy', 'v1', 'pending', NULL, NULL, NULL,
    '88888888-8888-8888-8888-888888888884'
  )$$,
  '42501', NULL, 'reception cannot record clinical consent'
);

-- Finance / gestoría A
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3';

SELECT is((SELECT count(*)::bigint FROM public.patients WHERE id = 'cccccccc-cccc-cccc-cccc-ccccccccccc1'), 0::bigint, 'gestoría cannot read patient clinical/administrative records');
SELECT is((SELECT count(*)::bigint FROM public.appointments), 0::bigint, 'gestoría cannot read appointments');
SELECT is((SELECT count(*)::bigint FROM public.organization_billing_profiles), 1::bigint, 'gestoría reads organization billing profile');
SELECT is((SELECT count(*)::bigint FROM public.patient_billing_profiles), 1::bigint, 'gestoría reads patient billing profile');
SELECT is((SELECT count(*)::bigint FROM public.patient_consents), 0::bigint, 'gestoría cannot read private consent events');
SELECT is((SELECT count(*)::bigint FROM public.patient_consent_status), 0::bigint, 'gestoría cannot read consent status');

-- Psychologist B in another organization
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';

SELECT is((SELECT count(*)::bigint FROM public.patients WHERE id = 'dddddddd-dddd-dddd-dddd-ddddddddddd1'), 1::bigint, 'second psychologist reads their own organization patient');
SELECT is((SELECT count(*)::bigint FROM public.patients WHERE id = 'cccccccc-cccc-cccc-cccc-ccccccccccc1'), 0::bigint, 'second psychologist cannot read first organization patient');
SELECT is((SELECT count(*)::bigint FROM public.appointments WHERE id = 'ffffffff-ffff-ffff-ffff-fffffffffff1'), 0::bigint, 'second psychologist cannot read first organization appointment');
SELECT is((SELECT count(*)::bigint FROM public.organization_billing_profiles), 0::bigint, 'second psychologist cannot read first organization billing profile');

-- Back to psychologist A for write-boundary and database integrity checks.
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';

SELECT throws_ok(
  $$INSERT INTO public.invoices (org_id, patient_id, status)
    VALUES ('11111111-1111-1111-1111-111111111111',
            'cccccccc-cccc-cccc-cccc-ccccccccccc1', 'issued')$$,
  'P0001', NULL, 'direct REST-style insert cannot create an issued invoice'
);
SELECT throws_ok(
  $$UPDATE public.invoices SET status = 'issued'
    WHERE id = '99999999-9999-9999-9999-999999999991'$$,
  'P0001', NULL, 'direct REST-style update cannot issue a draft invoice'
);
SELECT throws_ok(
  $$INSERT INTO public.appointments (
    org_id, patient_id, professional_id, starts_at, ends_at, status
  ) VALUES (
    '11111111-1111-1111-1111-111111111111',
    'cccccccc-cccc-cccc-cccc-ccccccccccc1',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1',
    '2026-11-10 10:30:00+01', '2026-11-10 11:00:00+01', 'scheduled'
  )$$,
  '23P01', NULL, 'database rejects overlapping active appointments'
);
SELECT lives_ok(
  $$INSERT INTO public.appointments (
    org_id, patient_id, professional_id, starts_at, ends_at, status
  ) VALUES (
    '11111111-1111-1111-1111-111111111111',
    'cccccccc-cccc-cccc-cccc-ccccccccccc1',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1',
    '2026-11-10 10:50:00+01', '2026-11-10 11:40:00+01', 'scheduled'
  )$$,
  'database allows back-to-back appointments for the same professional'
);
SELECT lives_ok(
  $$INSERT INTO public.invoice_lines (
    org_id, invoice_id, appointment_id, description, quantity, unit_price_cents, tax_rate, line_total_cents
  ) VALUES (
    '11111111-1111-1111-1111-111111111111',
    '99999999-9999-9999-9999-999999999991',
    'ffffffff-ffff-ffff-ffff-fffffffffff2',
    'Sesión completada', 1, 6000, 0, 6000
  )$$,
  'completed appointment for the same patient can be linked to a draft invoice'
);
SELECT throws_ok(
  $$INSERT INTO public.invoice_lines (
    org_id, invoice_id, appointment_id, description, quantity, unit_price_cents, tax_rate, line_total_cents
  ) VALUES (
    '11111111-1111-1111-1111-111111111111',
    '99999999-9999-9999-9999-999999999991',
    'ffffffff-ffff-ffff-ffff-fffffffffff3',
    'Sesión de otro paciente', 1, 6000, 0, 6000
  )$$,
  'P0001', NULL, 'invoice-line trigger rejects an appointment belonging to another patient'
);
SELECT throws_ok(
  $$UPDATE public.appointments
    SET patient_id = 'cccccccc-cccc-cccc-cccc-ccccccccccc2'
    WHERE id = 'ffffffff-ffff-ffff-ffff-fffffffffff2'$$,
  'P0001', NULL, 'billed appointment patient cannot be changed'
);
SELECT throws_ok(
  $$UPDATE public.appointments SET status = 'cancelled'
    WHERE id = 'ffffffff-ffff-ffff-ffff-fffffffffff2'$$,
  'P0001', NULL, 'billed appointment status cannot be changed'
);
SELECT throws_ok(
  $$UPDATE public.invoices SET patient_id = 'cccccccc-cccc-cccc-cccc-ccccccccccc2'
    WHERE id = '99999999-9999-9999-9999-999999999991'$$,
  'P0001', NULL, 'invoice patient cannot change while appointment-linked lines exist'
);

SELECT * FROM finish();
ROLLBACK;
