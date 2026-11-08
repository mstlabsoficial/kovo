// Datos 100 % sintéticos y doble de la API REST de Supabase (PostgREST) para las pruebas.
// Lo usan las pruebas de Node (tests/unit) y la prueba de navegador del modo Supabase
// (tests/supabase). Nada de esto se conecta a ningún servidor.
export const ORG = '11111111-1111-4111-8111-111111111111';
export const ORG2 = '22222222-2222-4222-8222-222222222222';
export const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

// Políticas SELECT reales (catalog-security.json): tabla → roles que la leen.
export const RLS = {
  services: ['psychologa', 'recepcion', 'gestoria'], professionals: ['psychologa', 'recepcion', 'gestoria'],
  patients: ['psychologa', 'recepcion'], appointments: ['psychologa', 'recepcion'],
  invoices: ['psychologa', 'gestoria'], invoice_lines: ['psychologa', 'gestoria'], payments: ['psychologa', 'gestoria'], expenses: ['psychologa', 'gestoria'],
  employees: ['psychologa'], clinical_notes: ['psychologa'], clinical_note_rectifications: ['psychologa'], patient_documents: ['psychologa']
};

// Datos sintéticos de dos consultas. La segunda no debe aparecer nunca.
export function syntheticDb() {
  const P1 = uuid(1), P2 = uuid(2), S1 = uuid(10), S2 = uuid(11), PRO = uuid(20), INV = uuid(40), N1 = uuid(70);
  const db = {
    services: [
      { id: S1, org_id: ORG, name: 'Sesión individual', duration_minutes: 60, price_cents: 5500, tax_exempt: true, active: true, legacy_id: null, created_at: '2026-01-01T00:00:00Z' },
      { id: S2, org_id: ORG, name: 'Servicio antiguo', duration_minutes: 50, price_cents: 5000, tax_exempt: true, active: false, legacy_id: null, created_at: '2026-01-01T00:00:00Z' }
    ],
    professionals: [{ id: PRO, org_id: ORG, display_name: 'Profesional Ficticia', professional_number: 'AN-00000', email: 'pro@correo-ejemplo.test', phone: null, created_at: '2026-01-01T00:00:00Z' }],
    patients: [
      { id: P1, org_id: ORG, patient_code: '1001', first_name: 'Paciente', last_name: 'Uno Ficticio', email: 'uno@correo-ejemplo.test', phone: '600000011', birth_date: null, address: null, emergency_contact: null, administrative_notes: null, status: 'active', legacy_id: null, created_at: '2026-10-01T09:00:00Z', updated_at: '2026-10-01T09:00:00Z',
        profile_data: { billing: { type: 'empresa', name: 'Empresa Ficticia SL', nif: 'B00000000', addr: 'Calle Ficticia 2', ret: 15 }, service: S1, modal: 'presencial' } },
      { id: P2, org_id: ORG, patient_code: '1002', first_name: 'Paciente', last_name: 'Dos Ficticio', email: null, phone: null, birth_date: null, address: null, emergency_contact: null, administrative_notes: null, status: 'inactive', legacy_id: null, created_at: '2026-10-02T09:00:00Z', updated_at: '2026-10-02T09:00:00Z', profile_data: {} }
    ],
    appointments: [
      { id: uuid(30), org_id: ORG, patient_id: P1, professional_id: PRO, service_id: S1, starts_at: '2026-11-02T09:00:00Z', ends_at: '2026-11-02T10:00:00Z', status: 'completed', location: 'Despacho', modality: 'presencial', price_cents: 5500, administrative_note: null, legacy_id: null, created_by: null, created_at: '2026-10-20T09:00:00Z', updated_at: '2026-10-20T09:00:00Z' },
      { id: uuid(31), org_id: ORG, patient_id: P1, professional_id: PRO, service_id: S2, starts_at: '2026-11-09T09:00:00Z', ends_at: '2026-11-09T09:50:00Z', status: 'scheduled', location: null, modality: 'online', price_cents: 5000, administrative_note: null, legacy_id: null, created_by: null, created_at: '2026-10-20T09:00:00Z', updated_at: '2026-10-20T09:00:00Z' },
      { id: uuid(32), org_id: ORG, patient_id: P2, professional_id: PRO, service_id: null, starts_at: '2026-11-05T23:30:00Z', ends_at: '2026-11-06T00:20:00Z', status: 'confirmed', location: null, modality: null, price_cents: 0, administrative_note: null, legacy_id: null, created_by: null, created_at: '2026-10-20T09:00:00Z', updated_at: '2026-10-20T09:00:00Z' }
    ],
    invoices: [{ id: INV, org_id: ORG, patient_id: P1, invoice_number: 'KOVO-2026-000001', series: null, issue_date: '2026-11-02', due_date: '2026-11-17', status: 'issued', currency: 'EUR', subtotal_cents: 5500, tax_cents: 0, retention_cents: 825, total_cents: 4675, notes: null, legacy_id: null, legacy_status: null, created_at: '2026-11-02T10:00:00Z' }],
    invoice_lines: [{ id: uuid(50), org_id: ORG, invoice_id: INV, description: 'Sesión individual', quantity: 1, unit_price_cents: 5500, tax_rate: 0, line_total_cents: 5500 }],
    payments: [{ id: uuid(60), org_id: ORG, invoice_id: INV, amount_cents: 2000, method: 'Transferencia', reference: null, paid_at: '2026-11-03T10:00:00Z', created_at: '2026-11-03T10:00:00Z' }],
    expenses: [{ id: uuid(100), org_id: ORG, description: 'Alquiler despacho', category: 'Alquiler', amount_cents: 45000, expense_date: '2026-11-01', supplier: 'Inmobiliaria Ficticia', document_path: null, legacy_id: null, created_at: '2026-11-01T00:00:00Z' }],
    employees: [{ id: uuid(110), org_id: ORG, full_name: 'Empleada Ficticia', role_title: 'Recepcionista', email: null, active: true, created_at: '2026-01-01T00:00:00Z' }],
    clinical_notes: [
      { id: N1, org_id: ORG, patient_id: P1, appointment_id: uuid(30), author_id: uuid(999), note_type: 'session', content: 'objetivos: Objetivo ficticio\n\nresumen: Resumen ficticio', status: 'signed', signed_at: '2026-11-02T11:00:00Z', created_at: '2026-11-02T10:30:00Z', updated_at: '2026-11-02T11:00:00Z' },
      { id: uuid(71), org_id: ORG, patient_id: P2, appointment_id: null, author_id: uuid(999), note_type: 'session', content: 'Texto libre ficticio', status: 'draft', signed_at: null, created_at: '2026-11-04T10:30:00Z', updated_at: '2026-11-04T10:30:00Z' }
    ],
    clinical_note_rectifications: [{ id: uuid(80), org_id: ORG, note_id: N1, author_id: uuid(999), reason: 'Corrección ficticia de prueba', replacement_text: 'Texto corregido ficticio', created_at: '2026-11-03T10:00:00Z' }],
    patient_documents: [{ id: uuid(90), org_id: ORG, patient_id: P1, document_type: 'consent', file_name: 'consentimiento.pdf', storage_path: `${ORG}/${P1}/consentimiento.pdf`, uploaded_by: uuid(999), created_at: '2026-10-01T10:00:00Z' }]
  };
  // Otra consulta con datos que nunca deben mezclarse.
  for (const t of Object.keys(db)) db[t] = db[t].concat(db[t].map((r, k) => ({ ...r, id: uuid(5000 + Object.keys(db).indexOf(t) * 100 + k), org_id: ORG2 })));
  return db;
}

// Doble de PostgREST: GET con select, filtro org_id=eq., order, limit y offset; RLS por rol.
export function fakeApi(db, role, { maxRows = Infinity, fail = null } = {}) {
  const calls = [];
  const request = async (path, options = {}) => {
    calls.push({ path, method: options.method || 'GET' });
    if (options.method && options.method !== 'GET') throw new Error('Escritura no permitida en las pruebas');
    const [table, qs] = path.split('?');
    const q = new URLSearchParams(qs);
    if (fail) { const r = fail(table, q); if (r !== undefined) return r; }
    const rows = RLS[table]?.includes(role) ? (db[table] || []) : [];   // RLS: sin permiso, sin filas
    const org = (q.get('org_id') || '').replace(/^eq\./, '');
    const filtered = rows.filter(r => !org || r.org_id === org);
    const offset = Number(q.get('offset') || 0), limit = Math.min(Number(q.get('limit') || Infinity), maxRows);
    return filtered.slice(offset, offset + limit).map(r => ({ ...r }));
  };
  return { request, calls };
}

// Políticas de INSERT/UPDATE reales (catalog-security.json) de las tablas que se escriben.
export const RLS_WRITE = { patients: ['psychologa', 'recepcion'], appointments: ['psychologa', 'recepcion'] };

// Servidor simulado CON ESTADO: lecturas como fakeApi y escrituras con las reglas de la BD real:
// RLS de INSERT/UPDATE por rol, claves primarias, índice único (org_id, legacy_id), claves foráneas
// compuestas (org_id, id), CHECK de estados y fechas, trigger del código de paciente (P-00001) y
// valores por defecto. Para simular fallos:
//   faults.beforeWrite(method, table) → lanza: la escritura NO llega (corte de red);
//   faults.afterWrite(method, table)  → lanza: la escritura SE APLICA pero la respuesta se pierde;
//   faults.expired = true             → 401 hasta que se llame a refresh().
// RPC: POST rpc/save_clinical_note_draft, copia de la función real (ver saveClinicalNoteDraft).
// `uid` es auth.uid() y `org` la consulta de la membresía con ese rol.
// Todo ocurre en memoria; nunca hay red.
export function createFakeServer({ role, db = syntheticDb(), clock = () => new Date().toISOString(), uid = uuid(999), org = ORG } = {}) {
  const calls = [];
  const faults = { beforeWrite: null, afterWrite: null, expired: false };
  const counters = {};
  const httpError = (status, code, message) => Object.assign(new Error(message), { status, details: { code, message } });
  const eqValue = v => (v == null ? null : decodeURIComponent(v.replace(/^eq\./, '')));
  const sameTs = (a, b) => a === b || (Date.parse(a) === Date.parse(b) && Number.isFinite(Date.parse(a)));
  const filterRows = (rows, q) => rows.filter(r => {
    for (const [k, v] of q) {
      if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
      if (v === 'is.null') { if (r[k] != null) return false; continue; }
      const want = eqValue(v);
      if (k === 'updated_at' ? !sameTs(r[k], want) : String(r[k]) !== want) return false;
    }
    return true;
  });
  const checkRefs = (table, row) => {
    if (table !== 'appointments') return;
    const has = (t, id) => (db[t] || []).some(x => x.org_id === row.org_id && x.id === id);
    if (!has('patients', row.patient_id)) throw httpError(409, '23503', 'violates foreign key constraint "appointments_org_id_patient_id_fkey"');
    if (row.professional_id != null && !has('professionals', row.professional_id)) throw httpError(409, '23503', 'violates foreign key constraint "appointments_org_id_professional_id_fkey"');
    if (row.service_id != null && !has('services', row.service_id)) throw httpError(409, '23503', 'violates foreign key constraint "appointments_org_id_service_id_fkey"');
  };
  const checkRow = (table, row) => {
    if (table === 'patients') {
      if (!['active', 'inactive', 'archived'].includes(row.status)) throw httpError(400, '23514', 'violates check constraint "patients_status_check"');
      if (!row.first_name || !row.last_name || !row.patient_code) throw httpError(400, '23502', 'null value violates not-null constraint');
    }
    if (table === 'appointments') {
      if (!['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'].includes(row.status)) throw httpError(400, '23514', 'violates check constraint "appointments_status_check"');
      if (!(Date.parse(row.ends_at) > Date.parse(row.starts_at))) throw httpError(400, '23514', 'violates check constraint "appointments_check"');
    }
  };
  const unique = (table, row, selfId) => {
    for (const x of db[table] || []) {
      if (x.id === row.id && x.id !== selfId) throw httpError(409, '23505', `duplicate key value violates unique constraint "${table}_pkey"`);
      if (row.legacy_id != null && x.id !== selfId && x.org_id === row.org_id && x.legacy_id === row.legacy_id) throw httpError(409, '23505', `duplicate key value violates unique constraint "${table}_org_legacy_id_uq"`);
      if (table === 'patients' && x.id !== selfId && x.org_id === row.org_id && x.patient_code === row.patient_code) throw httpError(409, '23505', 'duplicate key value violates unique constraint "patients_org_id_patient_code_key"');
    }
  };
  const defaults = {
    patients: () => ({ email: null, phone: null, birth_date: null, address: null, emergency_contact: null, administrative_notes: null, status: 'active', legacy_id: null, profile_data: {} }),
    appointments: () => ({ professional_id: null, service_id: null, status: 'scheduled', location: null, administrative_note: null, created_by: null, legacy_id: null, modality: null, price_cents: 0 })
  };

  // public.save_clinical_note_draft (SECURITY DEFINER): mismas comprobaciones y mismos errores.
  function saveClinicalNoteDraft(b = {}) {
    if (!uid || role !== 'psychologa' || b.p_org_id !== org) throw httpError(403, '42501', 'Not authorized to manage clinical notes');
    if (b.p_content == null || String(b.p_content).trim().length === 0) throw httpError(400, 'P0001', 'Clinical note content cannot be empty');
    const type = b.p_note_type ? b.p_note_type : 'session';
    const now = clock();
    if (b.p_note_id == null) {
      if (b.p_patient_id == null) throw httpError(400, '23502', 'null value in column "patient_id" violates not-null constraint');
      const has = (t, id) => (db[t] || []).some(x => x.org_id === b.p_org_id && x.id === id);
      if (!has('patients', b.p_patient_id)) throw httpError(409, '23503', 'violates foreign key constraint "clinical_notes_org_id_patient_id_fkey"');
      if (b.p_appointment_id != null && !has('appointments', b.p_appointment_id)) throw httpError(409, '23503', 'violates foreign key constraint "clinical_notes_org_id_appointment_id_fkey"');
      const row = { id: crypto.randomUUID(), org_id: b.p_org_id, patient_id: b.p_patient_id, appointment_id: b.p_appointment_id ?? null, author_id: uid, note_type: type, content: b.p_content, status: 'draft', signed_at: null, created_at: now, updated_at: now };
      (db.clinical_notes ||= []).push(row);
      return row.id;
    }
    const t = (db.clinical_notes || []).find(x => x.id === b.p_note_id && x.org_id === b.p_org_id && x.author_id === uid && x.status === 'draft');
    if (!t) throw httpError(400, 'P0001', 'Draft not found or not editable');
    Object.assign(t, { content: b.p_content, note_type: type, updated_at: now });   // patient_id y appointment_id no cambian
    return t.id;
  }

  async function request(path, options = {}) {
    const method = options.method || 'GET';
    calls.push({ method, path, body: options.body === undefined ? undefined : JSON.parse(JSON.stringify(options.body)) });
    if (faults.expired) throw httpError(401, 'PGRST301', 'JWT expired');
    const [table, qs] = path.split('?');
    const q = new URLSearchParams(qs || '');
    if (method === 'GET') {
      const rows = RLS[table]?.includes(role) ? (db[table] || []) : [];
      const offset = Number(q.get('offset') || 0), limit = Number(q.get('limit') || Infinity);
      return filterRows(rows, q).slice(offset, offset + limit).map(r => structuredClone(r));
    }
    if (faults.beforeWrite) faults.beforeWrite(method, table);
    let result;
    if (method === 'POST' && table === 'rpc/save_clinical_note_draft') {
      result = saveClinicalNoteDraft(structuredClone(options.body));
    } else if (table.startsWith('rpc/')) {
      throw httpError(404, 'PGRST202', 'Could not find the function in the schema cache');
    } else if (method === 'POST') {
      if (!RLS_WRITE[table]?.includes(role)) throw httpError(403, '42501', `new row violates row-level security policy for table "${table}"`);
      const now = clock();
      const row = { ...defaults[table](), ...structuredClone(options.body), created_at: now, updated_at: now };
      if (!row.id) row.id = crypto.randomUUID();
      if (table === 'patients' && (row.patient_code == null || String(row.patient_code).trim() === '' || row.patient_code === 'AUTO')) {
        counters[row.org_id] = (counters[row.org_id] || 0) + 1;   // trigger patients_assign_code
        row.patient_code = 'P-' + String(counters[row.org_id]).padStart(5, '0');
      }
      checkRow(table, row); unique(table, row); checkRefs(table, row);
      (db[table] ||= []).push(row);
      result = [structuredClone(row)];
    } else if (method === 'PATCH') {
      // RLS de UPDATE: las filas que el rol no puede modificar simplemente no se encuentran.
      const visible = RLS_WRITE[table]?.includes(role) ? (db[table] || []) : [];
      const targets = filterRows(visible, q);
      const out = [];
      for (const target of targets) {
        const next = { ...target, ...structuredClone(options.body), id: target.id, org_id: target.org_id, patient_code: target.patient_code };
        if (table !== 'patients') delete next.patient_code;
        checkRow(table, next); unique(table, next, target.id); checkRefs(table, next);
        Object.assign(target, next);
        out.push(structuredClone(target));
      }
      result = out;
    } else throw httpError(405, 'PGRST000', 'Método no permitido en la prueba');
    if (faults.afterWrite) faults.afterWrite(method, table);
    return result;
  }
  const refresh = async () => { faults.expired = false; return { id: 'usuario-renovado' }; };
  return { db, calls, faults, request, refresh, writes: () => calls.filter(c => c.method !== 'GET') };
}
