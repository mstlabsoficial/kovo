// F: concurrency on real PostgreSQL. Two kinds of tests:
//   * deterministic interleavings: session 1 holds an open transaction, session 2 is started and we
//     wait until PostgreSQL reports it blocked on a lock (pg_stat_activity), then session 1 commits;
//   * bursts of parallel HTTP requests through PostgREST (several pool connections at once).
import { randomUUID } from 'node:crypto';
import { signJwt } from '../local/env.mjs';
import { ORG_A, U, P, A, suite } from './fixtures.mjs';

const SAVE = 'SELECT * FROM public.save_clinical_note_draft_v2($1, $2, $3, $4, $5, $6, $7)';

async function session(env, uid) {
  const c = await env.client();
  const pid = (await c.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  await c.query('SET ROLE authenticated');
  await c.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: uid, role: 'authenticated' })]);
  return { c, pid };
}

async function waitBlocked(admin, pid) {
  for (let i = 0; i < 200; i++) {
    const r = await admin.query(`SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1`, [pid]);
    if (r.rows[0]?.wait_event_type === 'Lock') return true;
    await new Promise(ok => setTimeout(ok, 25));
  }
  return false;
}

const settle = p => p.then(v => ({ ok: true, v }), e => ({ ok: false, e }));

export async function runConcurrency(env, rest) {
  const s = suite('F · Concurrencia (PostgreSQL real)');
  const admin = env.admin;
  const s1 = await session(env, U.psicoA);
  const s2 = await session(env, U.psicoA);
  const rec = await session(env, U.recepcion);
  try {
    // 1. Same new UUID saved by two sessions at once (lost response + retry racing the original).
    const id = randomUUID();
    await s1.c.query('BEGIN');
    await s1.c.query(SAVE, [id, ORG_A, P.a1, A.raceA1, 'session', { objetivos: 'SINTETICO a' }, null]);
    const p2 = settle(s2.c.query(SAVE, [id, ORG_A, P.a1, A.raceA1, 'session', { objetivos: 'SINTETICO a' }, null]));
    s.check(await waitBlocked(admin, s2.pid), 'creación simultánea con el mismo UUID: la segunda sesión espera a la primera');
    await s1.c.query('COMMIT');
    let r = await p2;
    s.check(r.ok && r.v.rows[0].id === id && r.v.rows[0].version === 1, `la segunda sesión recibe la misma nota, sin error ni duplicado (${r.ok ? 'ok' : r.e.code + ' ' + r.e.message})`);
    let n = await admin.query('SELECT count(*)::int AS n FROM public.clinical_notes WHERE id = $1', [id]);
    s.eq(n.rows[0].n, 1, 'una sola fila');

    // 2. Two sessions edit the same version: one wins, the other gets KN005 and nothing is overwritten.
    await s1.c.query('BEGIN');
    await s1.c.query(SAVE, [id, ORG_A, P.a1, A.raceA1, 'session', { objetivos: 'SINTETICO pestaña 1' }, 1]);
    const p3 = settle(s2.c.query(SAVE, [id, ORG_A, P.a1, A.raceA1, 'session', { objetivos: 'SINTETICO pestaña 2' }, 1]));
    s.check(await waitBlocked(admin, s2.pid), 'edición simultánea: la segunda sesión espera al bloqueo de fila');
    await s1.c.query('COMMIT');
    r = await p3;
    s.check(!r.ok && r.e.code === 'KN005' && JSON.parse(r.e.detail).current_version === 2, `la segunda recibe conflicto KN005 con la versión actual (${r.ok ? 'guardó' : r.e.code})`);
    n = await admin.query(`SELECT version, sections->>'objetivos' AS o FROM public.clinical_notes WHERE id = $1`, [id]);
    s.eq(n.rows[0], { version: 2, o: 'SINTETICO pestaña 1' }, 'la versión ganadora no se sobrescribe');

    // 3. Note insert vs. reception moving the appointment to another patient (both orders).
    const id2 = randomUUID();
    await s1.c.query('BEGIN');
    await s1.c.query(SAVE, [id2, ORG_A, P.a1, A.doneA1b, 'session', { objetivos: 'SINTETICO' }, null]);
    const p4 = settle(rec.c.query('UPDATE public.appointments SET patient_id = $1 WHERE id = $2', [P.a2, A.doneA1b]));
    s.check(await waitBlocked(admin, rec.pid), 'cambio de paciente de la cita mientras se crea la nota: espera');
    await s1.c.query('COMMIT');
    r = await p4;
    s.check(!r.ok && r.e.code === 'KN010', `después, el cambio se rechaza porque la cita ya tiene nota (${r.ok ? 'se aplicó' : r.e.code})`);

    await rec.c.query('BEGIN');
    await rec.c.query('UPDATE public.appointments SET patient_id = $1 WHERE id = $2', [P.a2, A.race2A1]);
    const p5 = settle(s1.c.query(SAVE, [randomUUID(), ORG_A, P.a1, A.race2A1, 'session', { objetivos: 'SINTETICO' }, null]));
    s.check(await waitBlocked(admin, s1.pid), 'nota creada mientras recepción cambia el paciente de la cita: espera');
    await rec.c.query('COMMIT');
    r = await p5;
    s.check(!r.ok && r.e.code === 'KN002', `la nota se rechaza: la cita ya es de otro paciente (${r.ok ? 'se guardó' : r.e.code})`);
    n = await admin.query('SELECT count(*)::int AS n FROM public.clinical_notes WHERE appointment_id = $1', [A.race2A1]);
    s.eq(n.rows[0].n, 0, 'ninguna nota quedó enlazada a un paciente equivocado');
    await admin.query('UPDATE public.appointments SET patient_id = $1 WHERE id = $2', [P.a1, A.race2A1]);

    // 4. Same, with the appointment leaving "completed" (cancelled) concurrently.
    await rec.c.query('BEGIN');
    await rec.c.query(`UPDATE public.appointments SET status = 'cancelled' WHERE id = $1`, [A.race2A1]);
    const p6 = settle(s1.c.query(SAVE, [randomUUID(), ORG_A, P.a1, A.race2A1, 'session', { objetivos: 'SINTETICO' }, null]));
    s.check(await waitBlocked(admin, s1.pid), 'nota creada mientras la cita se anula: espera');
    await rec.c.query('COMMIT');
    r = await p6;
    s.check(!r.ok && r.e.code === 'KN008', `la nota se rechaza: la cita ya no está realizada (${r.ok ? 'se guardó' : r.e.code})`);
  } finally {
    for (const x of [s1, s2, rec]) { await x.c.query('ROLLBACK').catch(() => {}); await x.c.end().catch(() => {}); }
  }

  // 5. Bursts through PostgREST (real HTTP, real pool).
  const token = signJwt(rest.secret, { sub: U.psicoA, role: 'authenticated' });
  const post = body => fetch(`${rest.base}/rpc/save_clinical_note_draft_v2`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }).then(async r => ({ status: r.status, data: await r.json().catch(() => null) }));
  const base = { p_org_id: ORG_A, p_patient_id: P.a1, p_appointment_id: null, p_note_type: 'session' };

  const burst = randomUUID();
  let rs = await Promise.all(Array.from({ length: 8 }, () => post({ ...base, p_note_id: burst, p_sections: { objetivos: 'SINTETICO ráfaga' } })));
  s.check(rs.every(x => x.status === 200 && x.data.id === burst && x.data.version === 1), `8 reintentos simultáneos de creación → todos 200 con la misma nota (${rs.map(x => x.status)})`);
  let n = await admin.query(`SELECT count(*)::int AS n, (SELECT count(*)::int FROM public.audit_log WHERE entity_id = $1) AS a FROM public.clinical_notes WHERE id = $1`, [burst]);
  s.eq(n.rows[0], { n: 1, a: 1 }, 'una fila y una sola entrada de auditoría');

  rs = await Promise.all(Array.from({ length: 6 }, (_, i) => post({ ...base, p_note_id: burst, p_sections: { objetivos: `SINTETICO edición ${i}` }, p_expected_version: 1 })));
  const won = rs.filter(x => x.status === 200), lost = rs.filter(x => x.status !== 200);
  s.check(won.length === 1 && lost.every(x => x.status === 400 && x.data.code === 'KN005'), `6 ediciones simultáneas sobre la versión 1 → 1 guardada, 5 conflictos (${rs.map(x => x.status + (x.data?.code ? ':' + x.data.code : ''))})`);
  n = await admin.query(`SELECT version, sections->>'objetivos' AS o FROM public.clinical_notes WHERE id = $1`, [burst]);
  s.check(n.rows[0].version === 2 && n.rows[0].o === won[0]?.data.sections.objetivos, 'la base de datos guarda exactamente la edición confirmada');

  rs = await Promise.all(Array.from({ length: 5 }, () => post({ ...base, p_note_id: burst, p_sections: { objetivos: 'SINTETICO reintento' }, p_expected_version: 2 })));
  s.check(rs.every(x => x.status === 200 && x.data.version === 3), `5 reintentos simultáneos de la misma edición → todos confirman la versión 3 (${rs.map(x => x.status + ':' + x.data?.version)})`);
  return s;
}
