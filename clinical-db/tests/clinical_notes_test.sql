-- KOVO clinical notes v2 — pgTAP on REAL PostgreSQL (disposable DB built by clinical-db/run-local.mjs).
-- Integrity, idempotency, versions, audit, roles, tenant isolation, signed-note immutability,
-- rectifications and private documents. Synthetic data only; everything is rolled back.
-- Concurrency (two sessions at once) is tested from Node: clinical-db/tests/concurrency.mjs.
BEGIN;
SET LOCAL search_path = extensions, public;
SELECT * FROM no_plan();

-- Act as a user: JWT claims exactly as PostgREST sets them, then `SET LOCAL ROLE authenticated`.
CREATE FUNCTION pg_temp.claims(p_sub uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', 'authenticated')::text, true);
$$;
CREATE FUNCTION pg_temp.save(p_id uuid, p_patient uuid, p_appt uuid, p_type text, p_sections jsonb, p_version int DEFAULT NULL,
                             p_org uuid DEFAULT '0a000000-0000-4000-8000-00000000000a')
RETURNS public.clinical_notes LANGUAGE sql AS $$
  SELECT * FROM public.save_clinical_note_draft_v2(p_id, p_org, p_patient, p_appt, p_type, p_sections, p_version)
$$;

-- ------------------------------------------------------------------------- fixtures (postgres)
INSERT INTO auth.users (id, aud, role, email) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'psico-a1@kovo.test'),
  ('a0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'psico-a2@kovo.test'),
  ('a0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'recepcion-a@kovo.test'),
  ('a0000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'gestoria-a@kovo.test'),
  ('a0000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'psico-inactiva-a@kovo.test'),
  ('a0000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'sin-membresia@kovo.test'),
  ('b0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'psico-b1@kovo.test');
INSERT INTO public.organizations (id, name) VALUES
  ('0a000000-0000-4000-8000-00000000000a', 'Consulta Ficticia A'),
  ('0b000000-0000-4000-8000-00000000000b', 'Consulta Ficticia B');
INSERT INTO public.memberships (org_id, user_id, role, active) VALUES
  ('0a000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000001', 'psychologa', true),
  ('0a000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000002', 'psychologa', true),
  ('0a000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000003', 'recepcion', true),
  ('0a000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000004', 'gestoria', true),
  ('0a000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000005', 'psychologa', false),
  ('0b000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-000000000001', 'psychologa', true);
INSERT INTO public.patients (id, org_id, patient_code, first_name, last_name) VALUES
  ('c0000000-0000-4000-8000-0000000000a1', '0a000000-0000-4000-8000-00000000000a', 'P-00001', 'Paciente', 'Ficticio Uno'),
  ('c0000000-0000-4000-8000-0000000000a2', '0a000000-0000-4000-8000-00000000000a', 'P-00002', 'Paciente', 'Ficticio Dos'),
  ('c0000000-0000-4000-8000-0000000000b1', '0b000000-0000-4000-8000-00000000000b', 'P-00001', 'Paciente', 'Ficticio Tres');
INSERT INTO public.appointments (id, org_id, patient_id, starts_at, ends_at, status) VALUES
  ('d0000000-0000-4000-8000-0000000000c1', '0a000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-0000000000a1', '2026-11-09 10:00+01', '2026-11-09 10:50+01', 'completed'),
  ('d0000000-0000-4000-8000-0000000000c2', '0a000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-0000000000a2', '2026-11-09 11:00+01', '2026-11-09 11:50+01', 'completed'),
  ('d0000000-0000-4000-8000-0000000000c3', '0a000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-0000000000a1', '2026-11-20 10:00+01', '2026-11-20 10:50+01', 'scheduled'),
  ('d0000000-0000-4000-8000-0000000000c4', '0a000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-0000000000a1', '2026-11-08 10:00+01', '2026-11-08 10:50+01', 'completed'),
  ('d0000000-0000-4000-8000-0000000000b1', '0b000000-0000-4000-8000-00000000000b', 'c0000000-0000-4000-8000-0000000000b1', '2026-11-09 10:00+01', '2026-11-09 10:50+01', 'completed');
-- A historical note written before the proposal (legacy text format).
INSERT INTO public.clinical_notes (id, org_id, patient_id, appointment_id, author_id, note_type, content, status) VALUES
  ('e0000000-0000-4000-8000-0000000000e1', '0a000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-0000000000a2', NULL,
   'a0000000-0000-4000-8000-000000000001', 'session', 'Texto libre histórico SINTETICO', 'draft');

-- ------------------------------------------------------------------------- catalog and history
SELECT is((SELECT count(*)::int FROM public.clinical_note_section_catalog WHERE note_type = 'session' AND active), 6,
          'catalog: the 6 session sections the clinic uses today are active');
SELECT is((SELECT count(*)::int FROM public.clinical_note_section_catalog WHERE NOT active), 2,
          'catalog: prepared fields (evolución, próxima sesión) exist but are inactive');
SELECT is((SELECT row(content_format, sections IS NULL, version)::text FROM public.clinical_notes WHERE id = 'e0000000-0000-4000-8000-0000000000e1'),
          row('legacy_text', true, 1)::text, 'history: a legacy note is not converted by the migration');

-- ------------------------------------------------------------------------- create + idempotency
SELECT pg_temp.claims('a0000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;

SELECT is((SELECT row(version, content_format, status, author_id)::text FROM pg_temp.save('f0000000-0000-4000-8000-000000000001',
            'c0000000-0000-4000-8000-0000000000a1', 'd0000000-0000-4000-8000-0000000000c1', 'session',
            '{"objetivos":"SINTETICO objetivo","resumen":"Primer párrafo\n\nSegundo"}')),
          row(1, 'sections_v1', 'draft', 'a0000000-0000-4000-8000-000000000001'::uuid)::text,
          'create: version 1, structured, draft, authored by the caller');
SELECT is((SELECT sections FROM public.clinical_notes WHERE id = 'f0000000-0000-4000-8000-000000000001'),
          '{"objetivos":"SINTETICO objetivo","resumen":"Primer párrafo\n\nSegundo","intervenciones":"","observaciones":"","acuerdos":"","plan":""}'::jsonb,
          'create: sections normalized to every active section');
SELECT is((SELECT content FROM public.clinical_notes WHERE id = 'f0000000-0000-4000-8000-000000000001'),
          E'objetivos: SINTETICO objetivo\n\nresumen: Primer párrafo\n\nSegundo\n\nintervenciones: \n\nobservaciones: \n\nacuerdos: \n\nplan: ',
          'create: content derived in the existing "key: value" format');
SELECT is((SELECT version FROM pg_temp.save('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-0000000000a1',
            'd0000000-0000-4000-8000-0000000000c1', 'session', '{"objetivos":"SINTETICO objetivo","resumen":"Primer párrafo\n\nSegundo"}')),
          1, 'retry of the create (same UUID, lost response): same row, no new version');
SELECT is((SELECT count(*)::int FROM public.clinical_notes WHERE id = 'f0000000-0000-4000-8000-000000000001'), 1, 'retry: no duplicate');
SELECT is((SELECT version FROM pg_temp.save('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-0000000000a1',
            'd0000000-0000-4000-8000-0000000000c1', 'session', '{"objetivos":"SINTETICO cambiado antes del reintento"}')),
          2, 'retry with edited form after a lost create response: continues the same draft');

-- ------------------------------------------------------------------------- optimistic concurrency
SELECT is((SELECT version FROM pg_temp.save('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-0000000000a1',
            'd0000000-0000-4000-8000-0000000000c1', 'session', '{"objetivos":"SINTETICO v3"}', 2)), 3, 'edit with the right version → version 3');
SELECT throws_ok($$SELECT pg_temp.save('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-0000000000a1',
            'd0000000-0000-4000-8000-0000000000c1', 'session', '{"objetivos":"SINTETICO otra sesión"}', 2)$$,
          'KN005', NULL, 'stale version with different content → conflict, nothing overwritten');
SELECT is((SELECT sections ->> 'objetivos' FROM public.clinical_notes WHERE id = 'f0000000-0000-4000-8000-000000000001'),
          'SINTETICO v3', 'conflict: stored content unchanged');
SELECT is((SELECT version FROM pg_temp.save('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-0000000000a1',
            'd0000000-0000-4000-8000-0000000000c1', 'session', '{"objetivos":"SINTETICO v3"}', 2)),
          3, 'retry of an already-applied edit (stale version, same content) → returns the stored row');
SELECT throws_ok($$SELECT pg_temp.save('f0000000-0000-4000-8000-0000000000ff', 'c0000000-0000-4000-8000-0000000000a1',
            NULL, 'session', '{"objetivos":"x"}', 4)$$, 'KN006', NULL, 'editing a note that does not exist → not found');

-- ------------------------------------------------------------------------- validation
SELECT throws_ok($$SELECT pg_temp.save(gen_random_uuid(), 'c0000000-0000-4000-8000-0000000000a1', NULL, 'session', '{"inventado":"x"}')$$,
          'KN007', NULL, 'unknown section rejected');
SELECT throws_ok($$SELECT pg_temp.save(gen_random_uuid(), 'c0000000-0000-4000-8000-0000000000a1', NULL, 'session', '{"proxima_sesion":"x"}')$$,
          'KN007', NULL, 'prepared but inactive section rejected until reviewed');
SELECT throws_ok($$SELECT pg_temp.save(gen_random_uuid(), 'c0000000-0000-4000-8000-0000000000a1', NULL, 'session', '{"resumen":3}')$$,
          'KN007', NULL, 'non-text section value rejected');
SELECT throws_ok($$SELECT pg_temp.save(gen_random_uuid(), 'c0000000-0000-4000-8000-0000000000a1', NULL, 'desconocido', '{}')$$,
          'KN007', NULL, 'unknown note type rejected');
SELECT throws_ok($$SELECT pg_temp.save(NULL, 'c0000000-0000-4000-8000-0000000000a1', NULL, 'session', '{}')$$,
          'KN007', NULL, 'v2 requires the stable client UUID');

-- ------------------------------------------------------------------------- clinical relationships
SELECT throws_ok($$SELECT pg_temp.save(gen_random_uuid(), 'c0000000-0000-4000-8000-0000000000a1', 'd0000000-0000-4000-8000-0000000000c2', 'session', '{}')$$,
          'KN002', NULL, 'appointment of another patient → rejected by PostgreSQL');
SELECT throws_ok($$SELECT pg_temp.save(gen_random_uuid(), 'c0000000-0000-4000-8000-0000000000a1', 'd0000000-0000-4000-8000-0000000000b1', 'session', '{}')$$,
          'KN002', NULL, 'appointment of another organization → rejected');
SELECT throws_ok($$SELECT pg_temp.save(gen_random_uuid(), 'c0000000-0000-4000-8000-0000000000a1', 'd0000000-0000-4000-8000-0000000000c3', 'session', '{}')$$,
          'KN008', NULL, 'appointment not completed → no clinical note attached');
SELECT throws_ok($$SELECT pg_temp.save(gen_random_uuid(), 'c0000000-0000-4000-8000-0000000000b1', NULL, 'session', '{}')$$,
          'KN001', NULL, 'patient of another organization → rejected');
SELECT throws_ok($$SELECT pg_temp.save('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-0000000000a2', NULL, 'session', '{"objetivos":"x"}', 3)$$,
          'KN009', NULL, 'an existing note id cannot be moved to another patient/appointment');
-- The old RPC (kept for older clients) is now also bound by the table triggers.
SELECT throws_matching($$SELECT public.save_clinical_note_draft('0a000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-0000000000a1',
            'd0000000-0000-4000-8000-0000000000c2', 'session', 'SINTETICO')$$, 'same patient and organization',
          'v1 RPC: appointment of another patient rejected (table trigger KN002, or the backend proposal''s own check)');
SELECT throws_ok($$SELECT public.save_clinical_note_draft('0a000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-0000000000a1',
            'd0000000-0000-4000-8000-0000000000c3', 'session', 'SINTETICO')$$, 'KN008', NULL, 'v1 RPC: appointment not completed rejected');
SELECT throws_ok($$SELECT public.save_clinical_note_draft('0a000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-0000000000a1',
            'd0000000-0000-4000-8000-0000000000c1', 'session', 'texto plano', 'f0000000-0000-4000-8000-000000000001')$$,
          'KN012', NULL, 'v1 RPC cannot overwrite a structured note with plain text');

-- ------------------------------------------------------------------------- legacy → structured on explicit save
SELECT is((SELECT row(version, content_format)::text FROM pg_temp.save('e0000000-0000-4000-8000-0000000000e1', 'c0000000-0000-4000-8000-0000000000a2',
            NULL, 'session', '{"objetivos":"Texto libre histórico SINTETICO"}', 1)),
          row(2, 'sections_v1')::text, 'a legacy draft becomes structured only when the psychologist saves it');

-- ------------------------------------------------------------------------- privileges: direct writes
SELECT throws_ok($$INSERT INTO public.clinical_notes (org_id, patient_id, note_type, content) VALUES
            ('0a000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-0000000000a1', 'session', 'x')$$,
          '42501', NULL, 'no direct INSERT into clinical_notes (RPC only)');
SELECT throws_ok($$UPDATE public.clinical_notes SET content = 'x' WHERE id = 'f0000000-0000-4000-8000-000000000001'$$,
          '42501', NULL, 'no direct UPDATE of clinical_notes');
SELECT throws_ok($$DELETE FROM public.clinical_notes WHERE id = 'f0000000-0000-4000-8000-000000000001'$$,
          '42501', NULL, 'no direct DELETE of clinical_notes');
SELECT throws_ok($$INSERT INTO public.audit_log (org_id, action, entity_type) VALUES ('0a000000-0000-4000-8000-00000000000a', 'fake', 'clinical_note')$$,
          '42501', NULL, 'audit_log cannot be written by users');

-- ------------------------------------------------------------------------- authorship
RESET ROLE; SELECT pg_temp.claims('a0000000-0000-4000-8000-000000000002'); SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT pg_temp.save('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-0000000000a1',
            'd0000000-0000-4000-8000-0000000000c1', 'session', '{"objetivos":"x"}', 3)$$, 'KN004', NULL, 'another psychologist cannot edit the draft');
SELECT throws_ok($$SELECT public.sign_clinical_note('f0000000-0000-4000-8000-000000000001')$$, 'KN004', NULL,
          'another psychologist cannot sign the draft (authorship is not taken over)');
SELECT is((SELECT count(*)::int FROM public.clinical_notes WHERE id = 'f0000000-0000-4000-8000-000000000001'), 1,
          'a colleague psychologist of the same clinic can READ the note (existing RLS)');

-- ------------------------------------------------------------------------- roles and memberships
RESET ROLE; SELECT pg_temp.claims('a0000000-0000-4000-8000-000000000003'); SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT pg_temp.save(gen_random_uuid(), 'c0000000-0000-4000-8000-0000000000a1', NULL, 'session', '{}')$$, '42501', NULL, 'reception cannot save notes');
SELECT is((SELECT count(*)::int FROM public.clinical_notes), 0, 'reception reads no clinical notes');
SELECT is((SELECT count(*)::int FROM public.audit_log), 0, 'reception reads no audit log');
SELECT is((SELECT count(*)::int FROM public.clinical_note_rectifications), 0, 'reception reads no rectifications');
SELECT is((SELECT count(*)::int FROM public.patient_documents), 0, 'reception reads no private patient documents');
SELECT ok((SELECT count(*) FROM public.patients) = 2, 'reception does read the administrative patient list');
SELECT ok((SELECT count(*) FROM public.clinical_note_section_catalog) > 0, 'section catalog (labels only) is readable');

RESET ROLE; SELECT pg_temp.claims('a0000000-0000-4000-8000-000000000004'); SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT pg_temp.save(gen_random_uuid(), 'c0000000-0000-4000-8000-0000000000a1', NULL, 'session', '{}')$$, '42501', NULL, 'gestoría cannot save notes');
SELECT is((SELECT count(*)::int FROM public.clinical_notes), 0, 'gestoría reads no clinical notes');
SELECT is((SELECT count(*)::int FROM public.patients), 0, 'gestoría reads no patients');
SELECT is((SELECT count(*)::int FROM public.appointments), 0, 'gestoría reads no appointments');

RESET ROLE; SELECT pg_temp.claims('a0000000-0000-4000-8000-000000000005'); SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT pg_temp.save(gen_random_uuid(), 'c0000000-0000-4000-8000-0000000000a1', NULL, 'session', '{}')$$, '42501', NULL, 'inactive membership cannot save notes');
SELECT is((SELECT count(*)::int FROM public.clinical_notes), 0, 'inactive membership reads no notes');

RESET ROLE; SELECT pg_temp.claims('a0000000-0000-4000-8000-000000000006'); SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT pg_temp.save(gen_random_uuid(), 'c0000000-0000-4000-8000-0000000000a1', NULL, 'session', '{}')$$, '42501', NULL, 'user without membership cannot save notes');
SELECT is((SELECT count(*)::int FROM public.patients), 0, 'user without membership reads no patients');

RESET ROLE; SELECT set_config('request.jwt.claims', '', true); SET LOCAL ROLE anon;
SELECT throws_ok($$SELECT public.save_clinical_note_draft_v2(gen_random_uuid(), '0a000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-0000000000a1', NULL, 'session', '{}', NULL)$$,
          '42501', NULL, 'anonymous cannot execute the RPC');

-- ------------------------------------------------------------------------- tenant isolation (org_id tampering)
RESET ROLE; SELECT pg_temp.claims('b0000000-0000-4000-8000-000000000001'); SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.clinical_notes WHERE org_id = '0a000000-0000-4000-8000-00000000000a'), 0, 'psychologist of org B reads nothing of org A');
SELECT throws_ok($$SELECT pg_temp.save(gen_random_uuid(), 'c0000000-0000-4000-8000-0000000000a1', NULL, 'session', '{}')$$,
          '42501', NULL, 'org_id of another clinic sent from the browser → no authorization');
SELECT throws_ok($$SELECT pg_temp.save('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-0000000000b1', NULL, 'session', '{}', NULL,
            '0b000000-0000-4000-8000-00000000000b')$$, 'KN006', NULL, 'a note id of another clinic answers "not found" (no leak)');
SELECT is((SELECT version FROM pg_temp.save('f0000000-0000-4000-8000-0000000000b1', 'c0000000-0000-4000-8000-0000000000b1',
            'd0000000-0000-4000-8000-0000000000b1', 'session', '{"objetivos":"SINTETICO B"}', NULL, '0b000000-0000-4000-8000-00000000000b')),
          1, 'org B psychologist works normally in her own clinic');

-- ------------------------------------------------------------------------- signing, immutability, rectification
RESET ROLE; SELECT pg_temp.claims('a0000000-0000-4000-8000-000000000001'); SET LOCAL ROLE authenticated;
SELECT is((SELECT row(status, author_id, version)::text FROM public.sign_clinical_note('f0000000-0000-4000-8000-000000000001')),
          row('signed', 'a0000000-0000-4000-8000-000000000001'::uuid, 4)::text, 'the author signs: status signed, author kept, version 4');
SELECT throws_ok($$SELECT pg_temp.save('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-0000000000a1',
            'd0000000-0000-4000-8000-0000000000c1', 'session', '{"objetivos":"x"}', 4)$$, 'KN003', NULL, 'v2 cannot modify a signed note');
SELECT throws_ok($$SELECT public.save_clinical_note_draft('0a000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-0000000000a1',
            'd0000000-0000-4000-8000-0000000000c1', 'session', 'x', 'f0000000-0000-4000-8000-000000000001')$$, 'P0001', NULL, 'v1 cannot modify a signed note');
SELECT throws_ok($$SELECT public.delete_clinical_note_draft('0a000000-0000-4000-8000-00000000000a', 'f0000000-0000-4000-8000-000000000001')$$,
          'P0001', NULL, 'a signed note cannot be deleted');
SELECT lives_ok($$SELECT public.rectify_clinical_note('f0000000-0000-4000-8000-000000000001', 'Corrección ficticia de prueba', 'Texto corregido SINTETICO')$$,
          'the author can add a rectification to a signed note');
RESET ROLE;
SELECT throws_ok($$UPDATE public.clinical_notes SET content = 'x' WHERE id = 'f0000000-0000-4000-8000-000000000001'$$,
          'P0001', NULL, 'even the table owner cannot modify a signed note (immutability trigger)');
SELECT is((SELECT sections ->> 'objetivos' FROM public.clinical_notes WHERE id = 'f0000000-0000-4000-8000-000000000001'),
          'SINTETICO v3', 'the rectification did not change the original document');
SELECT throws_ok($$UPDATE public.clinical_note_rectifications SET replacement_text = 'x'$$, 'KN013', NULL, 'rectifications cannot be modified');
SELECT throws_ok($$DELETE FROM public.clinical_note_rectifications$$, 'KN013', NULL, 'rectifications cannot be deleted');
SELECT is((SELECT version FROM public.clinical_notes WHERE id = 'f0000000-0000-4000-8000-000000000001'), 4, 'version unchanged by rectification');

-- ------------------------------------------------------------------------- appointments keep the clinical link
SELECT pg_temp.claims('a0000000-0000-4000-8000-000000000003'); SET LOCAL ROLE authenticated;   -- reception
SELECT throws_ok($$UPDATE public.appointments SET patient_id = 'c0000000-0000-4000-8000-0000000000a2' WHERE id = 'd0000000-0000-4000-8000-0000000000c1'$$,
          'KN010', NULL, 'an appointment with a clinical note cannot move to another patient');
SELECT throws_ok($$UPDATE public.appointments SET status = 'cancelled' WHERE id = 'd0000000-0000-4000-8000-0000000000c1'$$,
          'KN011', NULL, 'an appointment with a clinical note must stay completed');
SELECT lives_ok($$UPDATE public.appointments SET status = 'cancelled' WHERE id = 'd0000000-0000-4000-8000-0000000000c4'$$,
          'an appointment without notes can still be cancelled');
SELECT lives_ok($$UPDATE public.appointments SET starts_at = '2026-11-09 10:05+01', ends_at = '2026-11-09 10:55+01' WHERE id = 'd0000000-0000-4000-8000-0000000000c1'$$,
          'an appointment with notes can still be rescheduled (time only)');
RESET ROLE;

-- ------------------------------------------------------------------------- version is computed by the DB
SELECT pg_temp.claims('a0000000-0000-4000-8000-000000000001');
INSERT INTO public.clinical_notes (id, org_id, patient_id, author_id, note_type, content, version)
  VALUES ('f0000000-0000-4000-8000-000000000099', '0a000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-0000000000a1',
          'a0000000-0000-4000-8000-000000000001', 'session', 'SINTETICO', 99);
SELECT is((SELECT version FROM public.clinical_notes WHERE id = 'f0000000-0000-4000-8000-000000000099'), 1, 'a forged version on insert is reset to 1');
UPDATE public.clinical_notes SET version = 50 WHERE id = 'f0000000-0000-4000-8000-000000000099';
SELECT is((SELECT version FROM public.clinical_notes WHERE id = 'f0000000-0000-4000-8000-000000000099'), 1, 'a forged version on update without changes is ignored');

-- ------------------------------------------------------------------------- audit trail
SELECT is((SELECT array_agg(action ORDER BY id)::text FROM public.audit_log WHERE entity_id = 'f0000000-0000-4000-8000-000000000001'),
          '{clinical_note.draft_created,clinical_note.draft_updated,clinical_note.draft_updated,clinical_note.signed,clinical_note.rectified}',
          'audit: create, 2 real updates (identical retries not audited), sign, rectify — once each');
SELECT is((SELECT array_agg(DISTINCT actor_id)::text FROM public.audit_log WHERE entity_id = 'f0000000-0000-4000-8000-000000000001'),
          '{a0000000-0000-4000-8000-000000000001}', 'audit: responsible user recorded');
SELECT ok((SELECT bool_and(created_at IS NOT NULL) FROM public.audit_log WHERE entity_id = 'f0000000-0000-4000-8000-000000000001'), 'audit: timestamp recorded');
SELECT is((SELECT count(*)::int FROM public.audit_log WHERE metadata::text ILIKE '%SINTETICO%'), 0, 'audit: no clinical content stored');
SELECT is((SELECT metadata -> 'changed_sections' FROM public.audit_log WHERE entity_id = 'f0000000-0000-4000-8000-000000000001'
            AND metadata ->> 'version' = '3'), '["objetivos"]'::jsonb, 'audit: names of changed sections, not their text');
SELECT is((SELECT count(*)::int FROM public.audit_log WHERE entity_id = 'f0000000-0000-4000-8000-000000000001' AND action = 'sign'), 0,
          'audit: no duplicate legacy "sign" row');

-- ------------------------------------------------------------------------- private documents (Storage policies)
SELECT pg_temp.claims('a0000000-0000-4000-8000-000000000001'); SET LOCAL ROLE authenticated;
SELECT lives_ok($$INSERT INTO storage.objects (bucket_id, name) VALUES ('kovo-patient-documents',
            '0a000000-0000-4000-8000-00000000000a/c0000000-0000-4000-8000-0000000000a1/consentimiento.pdf')$$, 'psychologist stores a document in her clinic folder');
SELECT throws_ok($$INSERT INTO storage.objects (bucket_id, name) VALUES ('kovo-patient-documents',
            '0b000000-0000-4000-8000-00000000000b/c0000000-0000-4000-8000-0000000000b1/x.pdf')$$, '42501', NULL, 'psychologist cannot write in another clinic folder');
RESET ROLE; SELECT pg_temp.claims('a0000000-0000-4000-8000-000000000003'); SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM storage.objects), 0, 'reception cannot see private documents');
RESET ROLE; SELECT pg_temp.claims('b0000000-0000-4000-8000-000000000001'); SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM storage.objects), 0, 'another clinic cannot see the documents');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
