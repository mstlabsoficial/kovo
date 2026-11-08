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
