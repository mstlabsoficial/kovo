// KOVO — concurrency on real PostgreSQL through the real API: simultaneous requests from several
// sessions must leave the database consistent (codes, agenda, plan limits, payments, invitations).
import { client, suite, newUser } from './client.mjs';

export async function runConcurrency(stack) {
  const api = client(stack);
  const s = suite('concurrency');
  const { check } = s;
  const owner = await newUser(api, 'concurrencia@kovo.test');
  const org = (await api.rpc(owner.token, 'create_organization', { p_name: 'Clínica Concurrencia', p_plan_code: 'starter' })).json;
  const second = (await api.signIn(owner.email, owner.password)).json.access_token;   // another session of the same person
  const tokens = [owner.token, second];

  // 1 · 30 simultaneous patient creations (automatic and explicit codes mixed)
  const codes = Array.from({ length: 30 }, (_, i) => (i % 6 === 5 ? `P-${String(40 + i).padStart(5, '0')}` : 'AUTO'));
  const created = await Promise.all(codes.map((c, i) => api.insert(tokens[i % 2], 'patients', { org_id: org, patient_code: c, first_name: 'Concurrente', last_name: String(i) })));
  const ok = created.filter(r => r.status === 201).map(r => r.json[0].patient_code);
  const autoFailed = created.filter((r, i) => codes[i] === 'AUTO' && r.status !== 201);
  check('Códigos: 25 altas automáticas simultáneas (mezcladas con explícitas) sin ningún error', autoFailed.length === 0, autoFailed.map(r => r.text).join(' | ').slice(0, 300));
  const explicitFailed = created.filter((r, i) => codes[i] !== 'AUTO' && r.status !== 201);
  check('Códigos: un código explícito solo se rechaza si ya estaba ocupado (23505), nunca se duplica',
    explicitFailed.every(r => r.json?.code === '23505'), explicitFailed.map(r => r.text).join(' | ').slice(0, 300));
  check('Códigos: ningún código repetido', new Set(ok).size === ok.length, ok.join(','));
  const next = await api.insert(owner.token, 'patients', { org_id: org, patient_code: 'AUTO', first_name: 'Después', last_name: 'Concurrencia' });
  const maxExplicit = Math.max(...ok.map(c => Number(c.slice(2))));
  check('Códigos: el siguiente automático supera a todos los existentes', next.status === 201 && Number(next.json[0].patient_code.slice(2)) > maxExplicit, next.text);
  const patient = next.json[0].id;

  // 2 · Same professional, same slot, 8 simultaneous bookings → exactly one
  const pro = (await api.get(owner.token, `professionals?org_id=eq.${org}&select=id`)).json[0].id;
  // Cinco rondas en huecos distintos: sin la serialización por profesional (20261112090500), PostgreSQL
  // podía devolver bloqueos mutuos (40P01) en vez del conflicto; una sola ronda no siempre lo mostraba.
  const book = slot => api.insert(tokens[Math.random() < .5 ? 0 : 1], 'appointments', { org_id: org, patient_id: patient, professional_id: pro, starts_at: `2026-12-0${slot}T10:00:00+01:00`, ends_at: `2026-12-0${slot}T10:50:00+01:00`, status: 'scheduled' });
  const rounds = [];
  for (const slot of [2, 3, 4, 5, 6]) rounds.push(await Promise.all(Array.from({ length: 8 }, () => book(slot))));
  check('Agenda: 8 reservas simultáneas del mismo hueco → solo 1 entra (5 rondas, restricción de exclusión)', rounds.every(b => b.filter(r => r.status === 201).length === 1), rounds.map(b => b.map(r => r.status).join(',')).join(' | '));
  check('Agenda: el resto recibe un conflicto explícito (23P01), nunca un bloqueo mutuo ni un error genérico', rounds.every(b => b.filter(r => r.status !== 201).every(r => r.json?.code === '23P01')), rounds.map(b => b.map(r => r.json?.code).join(',')).join(' | '));

  // 3 · Plan limit (Starter: 2 members, provisional) with 6 simultaneous invitations → exactly 1
  const invs = await Promise.all(Array.from({ length: 6 }, (_, i) => api.rpc(tokens[i % 2], 'invite_member', { p_org_id: org, p_email: `conc-${i}@kovo.test`, p_role: 'recepcion' })));
  check('Planes: 6 invitaciones simultáneas con hueco para 1 → solo 1 (límite serializado)', invs.filter(r => r.ok).length === 1, invs.map(r => r.json?.code || 'ok').join(','));

  // 4 · Same invitation accepted twice at the same time → one membership
  const invOk = invs.find(r => r.ok);
  const idx = invs.indexOf(invOk);
  const guest = await newUser(api, `conc-${idx}@kovo.test`);
  const guest2 = (await api.signIn(guest.email, guest.password)).json.access_token;
  const accepts = await Promise.all([api.rpc(guest.token, 'accept_invitation', { p_token: invOk.json.token }), api.rpc(guest2, 'accept_invitation', { p_token: invOk.json.token })]);
  check('Equipo: aceptar dos veces a la vez la misma invitación → una sola alta', accepts.filter(r => r.ok).length === 1, accepts.map(r => r.json?.code || 'ok').join(','));

  // 5 · Payments: two simultaneous payments that together exceed the total → one is rejected
  await api.insert(owner.token, 'organization_billing_profiles', { org_id: org, legal_name: 'Clínica Concurrencia SL', tax_id: 'B11111111', address_line: 'Calle 1', postal_code: '28001', city: 'Madrid' });
  await api.insert(owner.token, 'patient_billing_profiles', { org_id: org, patient_id: patient, legal_name: 'Paciente Concurrente', address_line: 'Calle 2' });
  const inv = (await api.rpc(owner.token, 'save_invoice_draft', { p_org_id: org, p_patient_id: patient, p_issue_date: '2026-11-10', p_due_date: null,
    p_lines: [{ description: 'Sesión', quantity: 1, unit_price_cents: 6000, tax_rate: 0 }] })).json;
  await api.rpc(owner.token, 'emit_invoice', { p_invoice: inv });
  const pays = await Promise.all([4000, 4000].map((a, i) => api.rpc(tokens[i], 'record_invoice_payment', { p_invoice_id: inv, p_amount_cents: a, p_method: 'tarjeta' })));
  check('Cobros: dos cobros simultáneos que superan el total → uno rechazado (KB002)', pays.filter(r => r.ok).length === 1 && pays.some(r => r.json?.code === 'KB002'), pays.map(r => r.json?.code || r.json?.status).join(','));

  // 6 · Two invoices issued at the same time → consecutive numbers, no duplicates
  const drafts = await Promise.all([0, 1, 2, 3].map(() => api.rpc(owner.token, 'save_invoice_draft', { p_org_id: org, p_patient_id: patient, p_issue_date: '2026-11-10', p_due_date: null,
    p_lines: [{ description: 'Sesión', quantity: 1, unit_price_cents: 6000, tax_rate: 0 }] })));
  const emits = await Promise.all(drafts.map((d, i) => api.rpc(tokens[i % 2], 'emit_invoice', { p_invoice: d.json })));
  const nums = emits.filter(r => r.ok).map(r => r.json.invoice_number).sort();
  check('Numeración: 4 emisiones simultáneas → 4 números distintos y correlativos', nums.length === 4 && new Set(nums).size === 4 &&
    nums.every((n, i) => i === 0 || Number(n.slice(-6)) === Number(nums[i - 1].slice(-6)) + 1), nums.join(','));
  return s;
}
