// Synthetic, committed fixtures for the HTTP and concurrency suites (separate DB connections need
// committed data). Fixed UUIDs so tests are readable. No real data.
export const ORG_A = '0a000000-0000-4000-8000-00000000000a';
export const ORG_B = '0b000000-0000-4000-8000-00000000000b';
export const U = {
  psicoA: 'a0000000-0000-4000-8000-000000000001', psicoA2: 'a0000000-0000-4000-8000-000000000002',
  recepcion: 'a0000000-0000-4000-8000-000000000003', gestoria: 'a0000000-0000-4000-8000-000000000004',
  inactiva: 'a0000000-0000-4000-8000-000000000005', sinMembresia: 'a0000000-0000-4000-8000-000000000006',
  psicoB: 'b0000000-0000-4000-8000-000000000001'
};
export const SERVICE = 'e1000000-0000-4000-8000-000000000001';
export const PROFESSIONAL = 'e2000000-0000-4000-8000-000000000001';
export const P = { a1: 'c0000000-0000-4000-8000-0000000000a1', a2: 'c0000000-0000-4000-8000-0000000000a2', b1: 'c0000000-0000-4000-8000-0000000000b1' };
export const A = {
  doneA1: 'd0000000-0000-4000-8000-0000000000c1', doneA2: 'd0000000-0000-4000-8000-0000000000c2',
  futureA1: 'd0000000-0000-4000-8000-0000000000c3', doneA1b: 'd0000000-0000-4000-8000-0000000000c4',
  raceA1: 'd0000000-0000-4000-8000-0000000000c5', race2A1: 'd0000000-0000-4000-8000-0000000000c6',
  doneB1: 'd0000000-0000-4000-8000-0000000000b1'
};

export async function seed(admin) {
  await admin.query(`
    INSERT INTO auth.users (id, aud, role, email) VALUES
      ('${U.psicoA}', 'authenticated', 'authenticated', 'psico-a1@kovo.test'),
      ('${U.psicoA2}', 'authenticated', 'authenticated', 'psico-a2@kovo.test'),
      ('${U.recepcion}', 'authenticated', 'authenticated', 'recepcion-a@kovo.test'),
      ('${U.gestoria}', 'authenticated', 'authenticated', 'gestoria-a@kovo.test'),
      ('${U.inactiva}', 'authenticated', 'authenticated', 'inactiva-a@kovo.test'),
      ('${U.sinMembresia}', 'authenticated', 'authenticated', 'sin-membresia@kovo.test'),
      ('${U.psicoB}', 'authenticated', 'authenticated', 'psico-b1@kovo.test');
    INSERT INTO public.organizations (id, name) VALUES ('${ORG_A}', 'Consulta Ficticia A'), ('${ORG_B}', 'Consulta Ficticia B');
    INSERT INTO public.memberships (org_id, user_id, role, active) VALUES
      ('${ORG_A}', '${U.psicoA}', 'psychologa', true), ('${ORG_A}', '${U.psicoA2}', 'psychologa', true),
      ('${ORG_A}', '${U.recepcion}', 'recepcion', true), ('${ORG_A}', '${U.gestoria}', 'gestoria', true),
      ('${ORG_A}', '${U.inactiva}', 'psychologa', false), ('${ORG_B}', '${U.psicoB}', 'psychologa', true);
    INSERT INTO public.services (id, org_id, name, duration_minutes, price_cents, tax_exempt, active) VALUES
      ('${SERVICE}', '${ORG_A}', 'Sesión individual ficticia', 50, 5500, true, true);
    INSERT INTO public.professionals (id, org_id, display_name) VALUES ('${PROFESSIONAL}', '${ORG_A}', 'Profesional Ficticia');
    INSERT INTO public.patients (id, org_id, patient_code, first_name, last_name) VALUES
      ('${P.a1}', '${ORG_A}', 'AUTO', 'Paciente', 'Ficticio Uno'),
      ('${P.a2}', '${ORG_A}', 'AUTO', 'Paciente', 'Ficticio Dos'),
      ('${P.b1}', '${ORG_B}', 'AUTO', 'Paciente', 'Ficticio Tres');
    INSERT INTO public.appointments (id, org_id, patient_id, starts_at, ends_at, status) VALUES
      ('${A.doneA1}', '${ORG_A}', '${P.a1}', '2026-11-09 10:00+01', '2026-11-09 10:50+01', 'completed'),
      ('${A.doneA2}', '${ORG_A}', '${P.a2}', '2026-11-09 11:00+01', '2026-11-09 11:50+01', 'completed'),
      ('${A.futureA1}', '${ORG_A}', '${P.a1}', '2026-11-20 10:00+01', '2026-11-20 10:50+01', 'scheduled'),
      ('${A.doneA1b}', '${ORG_A}', '${P.a1}', '2026-11-08 10:00+01', '2026-11-08 10:50+01', 'completed'),
      ('${A.raceA1}', '${ORG_A}', '${P.a1}', '2026-11-07 10:00+01', '2026-11-07 10:50+01', 'completed'),
      ('${A.race2A1}', '${ORG_A}', '${P.a1}', '2026-11-06 10:00+01', '2026-11-06 10:50+01', 'completed'),
      ('${A.doneB1}', '${ORG_B}', '${P.b1}', '2026-11-09 10:00+01', '2026-11-09 10:50+01', 'completed');
  `);
}

// Tiny assertion collector: every check is listed, failures are kept (the run continues).
export function suite(name) {
  const results = [];
  const check = (cond, label) => { results.push({ ok: Boolean(cond), label }); };
  return { name, results, check, eq: (a, b, label) => check(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)})`) };
}
