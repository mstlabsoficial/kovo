// D + E: real PostgREST 16.5 in front of real PostgreSQL, with JWTs signed exactly like Supabase Auth
// tokens (HS256, role=authenticated, sub=user id) using the local secret. Tests the REST surface the
// browser uses: RPC, table reads, manipulated requests, expired/forged tokens, roles and tenants.
// NOT covered here: token issuance by Supabase Auth (GoTrue) itself — see clinical-db/README.md.
import { randomUUID } from 'node:crypto';
import { signJwt } from '../local/env.mjs';
import { ORG_A, ORG_B, U, P, A, suite } from './fixtures.mjs';

export async function runHttp(rest) {
  const s = suite('D/E · PostgREST + JWT (HTTP)');
  const tokens = Object.fromEntries(Object.entries(U).map(([k, id]) => [k, signJwt(rest.secret, { sub: id, role: 'authenticated' })]));
  const anon = signJwt(rest.secret, { role: 'anon' });
  const call = async (path, { as = 'psicoA', token, method = 'GET', body, prefer } = {}) => {
    const headers = { Authorization: `Bearer ${token ?? tokens[as]}`, Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (prefer) headers.Prefer = prefer;
    const r = await fetch(`${rest.base}/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const raw = await r.text();
    let data = null; try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
    return { status: r.status, data };
  };
  const save = (args, as = 'psicoA') => call('rpc/save_clinical_note_draft_v2', { as, method: 'POST', body: {
    p_note_id: args.id, p_org_id: args.org ?? ORG_A, p_patient_id: args.patient ?? P.a1, p_appointment_id: args.appt ?? null,
    p_note_type: args.type ?? 'session', p_sections: args.sections ?? {}, p_expected_version: args.version ?? null } });

  // --- create, read back, retry, edit, conflict
  const id = randomUUID();
  let r = await save({ id, appt: A.doneA1, sections: { objetivos: 'SINTETICO http', resumen: 'Uno\n\nDos' } });
  s.check(r.status === 200 && r.data?.id === id && r.data?.version === 1, `RPC v2 crea el borrador con el UUID del cliente (HTTP ${r.status})`);
  r = await call(`clinical_notes?select=id,version,status,sections,content_format,author_id&id=eq.${id}`);
  s.check(r.status === 200 && r.data?.[0]?.sections?.resumen === 'Uno\n\nDos' && r.data[0].author_id === U.psicoA, 'GET devuelve el borrador con sus apartados y autoría');
  r = await save({ id, appt: A.doneA1, sections: { objetivos: 'SINTETICO http', resumen: 'Uno\n\nDos' } });
  s.check(r.status === 200 && r.data?.version === 1, 'reintento idéntico (respuesta perdida): misma fila, misma versión');
  r = await call(`clinical_notes?select=id&patient_id=eq.${P.a1}&appointment_id=eq.${A.doneA1}`);
  s.eq(r.data?.length, 1, 'sin duplicados tras el reintento');
  r = await save({ id, appt: A.doneA1, version: 1, sections: { objetivos: 'SINTETICO v2' } });
  s.check(r.status === 200 && r.data?.version === 2, 'edición con versión correcta → versión 2');
  r = await save({ id, appt: A.doneA1, version: 1, sections: { objetivos: 'SINTETICO otra pestaña' } });
  s.check(r.status === 400 && r.data?.code === 'KN005' && JSON.parse(r.data?.details || '{}').current_version === 2, `versión antigua → 400 KN005 con la versión actual (HTTP ${r.status} ${r.data?.code})`);
  s.check(!JSON.stringify(r.data).includes('SINTETICO'), 'el error de conflicto no incluye contenido clínico');

  // --- relationships enforced by PostgreSQL
  r = await save({ id: randomUUID(), appt: A.doneA2 });
  s.check(r.status === 400 && r.data?.code === 'KN002', `cita de otro paciente → KN002 (HTTP ${r.status} ${r.data?.code})`);
  r = await save({ id: randomUUID(), appt: A.futureA1 });
  s.check(r.status === 400 && r.data?.code === 'KN008', 'cita no realizada → KN008');
  r = await save({ id: randomUUID(), patient: P.b1 });
  s.check(r.status === 400 && r.data?.code === 'KN001', 'paciente de otra consulta → KN001');

  // --- roles
  for (const who of ['recepcion', 'gestoria', 'inactiva', 'sinMembresia']) {
    r = await save({ id: randomUUID() }, who);
    s.check(r.status === 403 && r.data?.code === '42501', `${who}: el RPC responde 403 (HTTP ${r.status})`);
    r = await call(`clinical_notes?select=id,content,sections`, { as: who });
    s.check(r.status === 200 && Array.isArray(r.data) && r.data.length === 0, `${who}: no lee ninguna nota clínica`);
  }
  r = await call('patients?select=id', { as: 'recepcion' });
  s.check(r.status === 200 && r.data.length === 2, 'recepción sí lee el listado administrativo de pacientes');
  r = await call('patients?select=id', { as: 'gestoria' });
  s.check(r.status === 200 && r.data.length === 0, 'gestoría no lee pacientes');
  r = await call('audit_log?select=id', { as: 'recepcion' });
  s.check(r.status === 200 && r.data.length === 0, 'recepción no lee la auditoría');

  // --- tenant isolation and org_id tampering
  r = await save({ id: randomUUID(), org: ORG_B, patient: P.b1 });
  s.check(r.status === 403, 'org_id de otra consulta enviado desde el navegador → 403');
  r = await call(`clinical_notes?select=id&org_id=eq.${ORG_A}`, { as: 'psicoB' });
  s.check(r.status === 200 && r.data.length === 0, 'psicóloga de otra consulta no ve las notas (filtro org_id manipulado)');
  r = await save({ id, org: ORG_B, patient: P.b1 }, 'psicoB');
  s.check(r.status === 400 && r.data?.code === 'KN006', 'el UUID de una nota de otra consulta responde «no existe» (sin filtrar datos)');

  // --- authorship
  r = await save({ id, appt: A.doneA1, version: 2, sections: { objetivos: 'x' } }, 'psicoA2');
  s.check(r.status === 400 && r.data?.code === 'KN004', 'otra psicóloga de la consulta no edita el borrador ajeno');

  // --- manipulated REST requests
  r = await call('clinical_notes', { method: 'POST', body: { org_id: ORG_A, patient_id: P.a1, note_type: 'session', content: 'x' } });
  s.check([401, 403].includes(r.status), `INSERT directo en clinical_notes rechazado (HTTP ${r.status})`);
  r = await call(`clinical_notes?id=eq.${id}`, { method: 'PATCH', body: { content: 'x', version: 99 } });
  s.check([401, 403].includes(r.status), `PATCH directo rechazado (HTTP ${r.status})`);
  r = await call(`clinical_notes?id=eq.${id}`, { method: 'DELETE' });
  s.check([401, 403].includes(r.status), `DELETE directo rechazado (HTTP ${r.status})`);
  r = await call('audit_log', { method: 'POST', body: { org_id: ORG_A, action: 'falso', entity_type: 'clinical_note' } });
  s.check([401, 403].includes(r.status), `escritura en audit_log rechazada (HTTP ${r.status})`);
  r = await call('rpc/guard_clinical_note_integrity', { method: 'POST', body: {} });
  s.check(r.status === 404, `las funciones del esquema private no están expuestas (HTTP ${r.status})`);
  r = await call('rpc/sign_clinical_note', { as: 'recepcion', method: 'POST', body: { p_note: id } });
  s.check(r.status >= 400, `recepción no puede firmar llamando directamente a la RPC (HTTP ${r.status})`);
  r = await call(`appointments?id=eq.${A.doneA1}`, { as: 'recepcion', method: 'PATCH', body: { patient_id: P.a2 } });
  s.check(r.status === 400 && r.data?.code === 'KN010', `recepción no puede mover a otro paciente una cita con nota (HTTP ${r.status} ${r.data?.code})`);
  r = await call(`appointments?id=eq.${A.doneA1}`, { as: 'recepcion', method: 'PATCH', body: { status: 'no_show' } });
  s.check(r.status === 400 && r.data?.code === 'KN011', 'ni marcarla como ausencia');

  // --- tokens
  r = await call('clinical_notes?select=id', { token: anon });
  s.check(r.status === 401 || (r.status === 200 && r.data.length === 0), `anónimo no lee notas (HTTP ${r.status})`);
  const expired = signJwt(rest.secret, { sub: U.psicoA, role: 'authenticated', exp: Math.floor(Date.now() / 1000) - 60 });
  r = await call('rpc/save_clinical_note_draft_v2', { token: expired, method: 'POST', body: { p_note_id: randomUUID(), p_org_id: ORG_A, p_patient_id: P.a1, p_appointment_id: null, p_note_type: 'session', p_sections: {} } });
  s.check(r.status === 401, `token caducado → 401 (lo que dispara la renovación de sesión en el cliente) (HTTP ${r.status})`);
  const forged = signJwt('otro-secreto-que-no-es-el-del-servidor-0000', { sub: U.psicoA, role: 'authenticated' });
  r = await call('clinical_notes?select=id', { token: forged });
  s.check(r.status === 401, `token con firma falsa → 401 (HTTP ${r.status})`);
  const serviceLike = signJwt('otro-secreto-que-no-es-el-del-servidor-0000', { role: 'service_role' });
  r = await call('clinical_notes?select=id', { token: serviceLike });
  s.check(r.status === 401, 'un token service_role falsificado no da acceso');

  // --- private documents (metadata table; files live in the private Storage bucket)
  const doc = { org_id: ORG_A, patient_id: P.a1, storage_path: `${ORG_A}/${P.a1}/consentimiento-sintetico.pdf`, document_type: 'consent', file_name: 'consentimiento-sintetico.pdf' };
  r = await call('patient_documents', { method: 'POST', body: doc, prefer: 'return=minimal' });
  s.check(r.status === 201, `psicóloga registra un documento privado del paciente (HTTP ${r.status})`);
  for (const who of ['recepcion', 'gestoria', 'psicoB']) {
    r = await call('patient_documents?select=id,file_name', { as: who });
    s.check(r.status === 200 && r.data.length === 0, `${who}: no ve documentos privados`);
  }
  r = await call('patient_documents', { as: 'recepcion', method: 'POST', body: { ...doc, storage_path: `${ORG_A}/${P.a1}/otro.pdf` } });
  s.check([401, 403].includes(r.status), `recepción no registra documentos privados (HTTP ${r.status})`);
  r = await call('patient_documents', { as: 'psicoB', method: 'POST', body: { ...doc, storage_path: `${ORG_A}/${P.a1}/intruso.pdf` } });
  s.check([401, 403].includes(r.status), `otra consulta no registra documentos en esta (HTTP ${r.status})`);

  // --- authorised delete (draft only, author only) and its audit
  const del = randomUUID();
  await save({ id: del, appt: A.doneA1b, sections: { objetivos: 'SINTETICO borrar' } });
  r = await call('rpc/delete_clinical_note_draft', { as: 'psicoA2', method: 'POST', body: { p_org_id: ORG_A, p_note_id: del } });
  s.check(r.status >= 400, `otra psicóloga no borra el borrador ajeno (HTTP ${r.status})`);
  r = await call('rpc/delete_clinical_note_draft', { as: 'recepcion', method: 'POST', body: { p_org_id: ORG_A, p_note_id: del } });
  s.check(r.status === 403, `recepción no borra borradores (HTTP ${r.status})`);
  r = await call('rpc/delete_clinical_note_draft', { method: 'POST', body: { p_org_id: ORG_A, p_note_id: del } });
  s.check(r.status === 204 || r.status === 200, `la autora borra su borrador (HTTP ${r.status})`);
  r = await call(`audit_log?select=action&entity_id=eq.${del}&order=id`);
  s.eq(r.data?.map(x => x.action), ['clinical_note.draft_created', 'clinical_note.draft_deleted'], 'el borrado autorizado queda auditado');

  // --- audit through REST (psychologist), without content
  r = await call(`audit_log?select=action,actor_id,metadata&entity_id=eq.${id}&order=id`);
  s.check(r.status === 200 && r.data.map(x => x.action).join() === 'clinical_note.draft_created,clinical_note.draft_updated', `auditoría: alta y una modificación (${r.data?.map?.(x => x.action)})`);
  s.check(r.data?.every?.(x => x.actor_id === U.psicoA), 'la auditoría registra a la usuaria que actuó');
  s.check(!JSON.stringify(r.data).includes('SINTETICO'), 'auditoría sin contenido clínico');
  r = await call(`audit_log?select=id&entity_id=eq.${id}`, { as: 'psicoB' });
  s.check(r.status === 200 && r.data.length === 0, 'otra consulta no ve la auditoría');
  return s;
}
