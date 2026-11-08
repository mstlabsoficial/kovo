// Pruebas del adaptador de lectura Supabase → modelo legacy.
// Node nativo (node:test). Datos 100 % sintéticos. Sin red ni Supabase.
// Uso (desde app/): node --test tests/unit/*.unit.mjs
process.env.TZ = 'Europe/Madrid'; // mapping.js usa la hora local del proceso
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as A from '../../src/data/from-supabase.js';
import * as M from '../../src/data/mapping.js';

const ORG = '11111111-1111-4111-8111-111111111111';
const ORG2 = '22222222-2222-4222-8222-222222222222';
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const P1 = uuid(1), P2 = uuid(2), S1 = uuid(10), PRO1 = uuid(20), A1 = uuid(30), A2 = uuid(31), A3 = uuid(32);
const INV1 = uuid(40), INV2 = uuid(41), L1 = uuid(50), L2 = uuid(51), L3 = uuid(52), PAY1 = uuid(60);
const N1 = uuid(70), N2 = uuid(71), R1 = uuid(80), R2 = uuid(81), D1 = uuid(90), D2 = uuid(91), D3 = uuid(92), E1 = uuid(100), EMP1 = uuid(110);
const deepFreeze = o => { if (o && typeof o === 'object') { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };

// Paciente sintético completo y otro mínimo (solo columnas obligatorias).
const patientFull = () => ({
  id: P1, org_id: ORG, legacy_id: 'p7', patient_code: '4821', first_name: 'Ana', last_name: 'Prueba Ficticia',
  email: 'ana.prueba@correo-ejemplo.test', phone: '600000001', birth_date: '1990-04-02', address: 'Calle Ficticia 1',
  emergency_contact: null, administrative_notes: null, status: 'active',
  profile_data: { alta: '2026-03-02', slot: [2, 600], service: S1, modal: 'presencial', bi: false, reminders: true, billing: { type: 'particular', name: 'Ana Prueba Ficticia', nif: '', addr: '' } },
  created_at: '2026-03-02T09:00:00+00:00', updated_at: '2026-03-02T09:00:00+00:00'
});
const patientMin = () => ({
  id: P2, org_id: ORG, legacy_id: null, patient_code: '0007', first_name: 'Sin nombre', last_name: '-', email: null, phone: null,
  birth_date: null, address: null, emergency_contact: null, administrative_notes: null, status: 'inactive', profile_data: {},
  created_at: '2026-11-05T23:30:00+00:00', updated_at: '2026-11-05T23:30:00+00:00'
});
const appt = (id, patient, starts, ends, status = 'confirmed', extra = {}) => ({
  id, org_id: ORG, patient_id: patient, professional_id: PRO1, service_id: S1, starts_at: starts, ends_at: ends, status,
  location: 'Despacho', modality: 'presencial', price_cents: 5500, administrative_note: null, legacy_id: null, created_by: null,
  created_at: '2026-11-01T10:00:00+00:00', updated_at: '2026-11-01T10:00:00+00:00', ...extra
});
const line = (id, inv, desc, qty, unit, rate) => ({ id, org_id: ORG, invoice_id: inv, description: desc, quantity: qty, unit_price_cents: unit, tax_rate: rate, line_total_cents: Math.round(Math.round(qty * unit) * (1 + rate / 100)) });
const invoice = (id, extra = {}) => ({
  id, org_id: ORG, patient_id: P1, invoice_number: null, series: null, issue_date: '2026-11-06', due_date: '2026-11-21', status: 'draft',
  currency: 'EUR', subtotal_cents: 5500, tax_cents: 0, retention_cents: 0, total_cents: 5500, notes: null, legacy_id: null, legacy_status: null,
  created_at: '2026-11-06T10:00:00+00:00', ...extra
});
const note = (id, extra = {}) => ({
  id, org_id: ORG, patient_id: P1, appointment_id: A1, author_id: uuid(999), note_type: 'session', status: 'draft', signed_at: null,
  content: 'objetivos: Objetivo ficticio\n\nresumen: Resumen ficticio', created_at: '2026-11-03T10:00:00+00:00', updated_at: '2026-11-03T10:00:00+00:00', ...extra
});

describe('fechas en hora de Madrid', () => {
  test('invierno (UTC+1) y verano (UTC+2)', () => {
    assert.equal(A.toLocalDate('2026-11-06T09:30:00+00:00'), '2026-11-06');
    assert.equal(A.toLocalMinutes('2026-11-06T09:30:00+00:00'), 10 * 60 + 30);
    assert.equal(A.toLocalMinutes('2026-07-06T09:30:00+00:00'), 11 * 60 + 30);
  });
  test('cambio de día por la zona horaria', () => {
    assert.equal(A.toLocalDate('2026-11-05T23:30:00+00:00'), '2026-11-06');
    assert.equal(A.toLocalMinutes('2026-11-05T23:30:00+00:00'), 30);
  });
  test('cambio de hora de octubre: 00:30 UTC del domingo es 02:30 CEST', () => {
    assert.equal(A.toLocalMinutes('2026-10-25T00:30:00+00:00'), 150);
    assert.equal(A.toLocalMinutes('2026-10-25T01:30:00+00:00'), 150); // 02:30 CET, misma hora local repetida
  });
  test('valores nulos o inválidos devuelven null', () => {
    for (const v of [null, undefined, '', 'no-es-fecha']) { assert.equal(A.toLocalDate(v), null); assert.equal(A.toLocalMinutes(v), null); }
    assert.equal(A.dateOnly('2026-11-06'), '2026-11-06');
    assert.equal(A.dateOnly('06/11/2026'), null);
    assert.equal(A.dateOnly(null), null);
  });
});

describe('pacientes', () => {
  test('conversión de campos', () => {
    const p = A.patientFromRow(patientFull());
    assert.equal(p.id, P1); assert.equal(p.orgId, ORG); assert.equal(p.legacyId, 'p7');
    assert.equal(p.code, '4821'); assert.equal(p.name, 'Ana Prueba Ficticia');
    assert.equal(p.status, 'activo'); assert.equal(p.alta, '2026-03-02');
    assert.deepEqual(p.slot, [2, 600]); assert.equal(p.service, S1); assert.equal(p.modal, 'presencial');
    assert.equal(p.billing.type, 'particular'); assert.equal(p.reminders, true);
    assert.equal(p.birthDate, '1990-04-02');
  });
  test('registro mínimo: nulos sin inventar valores', () => {
    const report = A.createReport();
    const p = A.patientFromRow(patientMin(), { report });
    assert.equal(p.name, 'Sin nombre');               // el '-' de splitName no se añade al nombre
    assert.equal(p.status, 'alta terapéutica');
    assert.equal(p.alta, '2026-11-06');               // de created_at, en hora de Madrid
    for (const k of ['email', 'phone', 'birthDate', 'address', 'slot', 'service', 'modal', 'bi', 'billing', 'reminders', 'consent']) assert.equal(p[k], null, k);
    assert.deepEqual(p.docs, []);
    const missing = report.entries.filter(e => e.issue === 'missing_in_db').map(e => e.field).sort();
    assert.deepEqual(missing, ['bi', 'billing', 'modal', 'reminders', 'service', 'slot']);
    assert.ok(report.entries.some(e => e.field === 'alta' && e.issue === 'derived_from_created_at'));
    assert.ok(!JSON.stringify(p).includes('undefined'));
  });
  test('estado desconocido queda null y se anota', () => {
    const report = A.createReport();
    const p = A.patientFromRow({ ...patientMin(), status: 'archived' }, { report });
    assert.equal(p.status, null);
    assert.deepEqual(report.entries.find(e => e.field === 'status'), { entity: 'patient', id: P2, field: 'status', issue: 'unknown_value', value: 'archived' });
  });
  test('profile_data con tipos incorrectos no se acepta', () => {
    const report = A.createReport();
    const p = A.patientFromRow({ ...patientFull(), profile_data: { slot: 'martes', modal: 'telefono', billing: { type: 'otro' }, bi: 'no', reminders: 1, service: '' } }, { report });
    for (const k of ['slot', 'modal', 'billing', 'bi', 'reminders', 'service']) assert.equal(p[k], null, k);
    assert.equal(report.entries.filter(e => e.issue === 'invalid_profile_data').length, 6);
  });
  test('documentos: consentimiento más reciente y resto como documentos; sin URL inventada', () => {
    const p = A.patientFromRow(patientFull());
    const docs = [
      { id: D1, org_id: ORG, patient_id: P1, document_type: 'consent', file_name: 'consentimiento-antiguo.pdf', storage_path: `${ORG}/${P1}/a.pdf`, uploaded_by: null, created_at: '2026-03-02T10:00:00+00:00' },
      { id: D2, org_id: ORG, patient_id: P1, document_type: 'consent', file_name: 'consentimiento.pdf', storage_path: `${ORG}/${P1}/b.pdf`, uploaded_by: null, created_at: '2026-06-02T10:00:00+00:00' },
      { id: D3, org_id: ORG, patient_id: P1, document_type: 'report', file_name: 'informe-externo.pdf', storage_path: `${ORG}/${P1}/c.pdf`, uploaded_by: null, created_at: '2026-05-02T10:00:00+00:00' }
    ].map(A.documentFromRow);
    A.attachDocuments(p, docs);
    assert.equal(p.consent.file, 'consentimiento.pdf'); assert.equal(p.consent.at, '2026-06-02'); assert.equal(p.consent.url, null);
    assert.equal(p.consent.storagePath, `${ORG}/${P1}/b.pdf`);
    assert.deepEqual(p.docs.map(d => d.name), ['informe-externo.pdf', 'consentimiento-antiguo.pdf']);
    assert.ok(p.docs.every(d => d.url === null));
  });
});

describe('citas', () => {
  test('conversión de campos, fecha, hora y duración', () => {
    const a = A.appointmentFromRow(appt(A1, P1, '2026-11-06T09:00:00+00:00', '2026-11-06T09:50:00+00:00'));
    assert.equal(a.id, A1); assert.equal(a.patientId, P1); assert.equal(a.professionalId, PRO1);
    assert.equal(a.date, '2026-11-06'); assert.equal(a.start, 600); assert.equal(a.dur, 50);
    assert.equal(a.service, S1); assert.equal(a.modal, 'presencial'); assert.equal(a.loc, 'Despacho');
    assert.equal(a.status, 'confirmada'); assert.equal(a.price, 5500);
    assert.deepEqual(a.log, []); assert.equal(a.cancelReason, null); assert.equal(a.invoiceId, null);
  });
  test('todos los estados con evidencia', () => {
    const map = { scheduled: 'pendiente', confirmed: 'confirmada', completed: 'realizada', cancelled: 'cancelada', no_show: 'ausencia' };
    for (const [db, legacy] of Object.entries(map)) assert.equal(A.appointmentFromRow(appt(A1, P1, '2026-11-06T09:00:00Z', '2026-11-06T10:00:00Z', db)).status, legacy);
  });
  test('estado desconocido, rango inválido y modalidad ausente', () => {
    const report = A.createReport();
    const a = A.appointmentFromRow(appt(A1, P1, '2026-11-06T10:00:00Z', '2026-11-06T10:00:00Z', 'rescheduled', { modality: null, service_id: null }), { report });
    assert.equal(a.status, null); assert.equal(a.dur, null); assert.equal(a.modal, null); assert.equal(a.service, null);
    const issues = report.entries.map(e => `${e.field}:${e.issue}`).sort();
    assert.deepEqual(issues, ['dur:invalid_time_range', 'modal:missing_in_db', 'service:missing_in_db', 'status:unknown_value']);
  });
  test('cita que cruza la medianoche se anota', () => {
    const report = A.createReport();
    A.appointmentFromRow(appt(A1, P1, '2026-11-06T22:30:00Z', '2026-11-06T23:30:00Z'), { report });
    assert.ok(report.entries.some(e => e.issue === 'crosses_midnight'));
  });
});

describe('servicios y profesionales', () => {
  test('servicio', () => {
    const s = A.serviceFromRow({ id: S1, org_id: ORG, legacy_id: 's1', name: 'Sesión individual', duration_minutes: 60, price_cents: 5500, tax_exempt: true, active: true, created_at: 'x' });
    assert.deepEqual(s, { id: S1, orgId: ORG, legacyId: 's1', name: 'Sesión individual', dur: 60, price: 5500, exempt: true, active: true });
  });
  test('profesional y forma de S.pro sin datos fiscales inventados', () => {
    const report = A.createReport();
    const p = A.professionalFromRow({ id: PRO1, org_id: ORG, display_name: 'Profesional Ficticia', professional_number: 'AN-00000', email: null, phone: null, created_at: 'x' });
    const pro = A.legacyProFromProfessional(p, { report });
    assert.deepEqual(pro, { name: 'Profesional Ficticia', col: 'AN-00000', email: null, nif: null, addr: null, loc: null, sanitaria: null });
    assert.deepEqual(report.entries.map(e => e.field).sort(), ['addr', 'loc', 'nif', 'sanitaria']);
  });
});

describe('facturas, líneas y cobros', () => {
  test('borrador exento con su línea y cobro', () => {
    const { collections, report } = A.buildLegacyCollections({
      patients: [patientFull()], invoices: [invoice(INV1)],
      invoiceLines: [line(L1, INV1, 'Sesión individual', 1, 5500, 0)],
      payments: [{ id: PAY1, org_id: ORG, invoice_id: INV1, amount_cents: 5500, method: 'Bizum', reference: null, paid_at: '2026-11-06T18:00:00+00:00', created_at: 'x' }]
    });
    const i = collections.invoices[0];
    assert.equal(i.status, 'borrador'); assert.equal(i.num, null); assert.equal(i.kind, 'F'); assert.equal(i.ret, 0);
    assert.equal(i.lines.length, 1); assert.deepEqual(i.lines[0], { id: L1, invoiceId: INV1, desc: 'Sesión individual', qty: 1, price: 5500, exempt: true, taxRate: 0, lineTotal: 5500 });
    assert.deepEqual(i.payments, [{ id: PAY1, invoiceId: INV1, date: '2026-11-06', amount: 5500, method: 'Bizum', ref: null }]);
    assert.equal(i.to, null); assert.deepEqual(i.appts, []); assert.equal(i.hash, null);
    assert.ok(!report.some(e => e.issue === 'mismatch_with_db'));
  });
  test('cada factura recibe solo sus líneas', () => {
    const { collections } = A.buildLegacyCollections({
      invoices: [invoice(INV1), invoice(INV2, { subtotal_cents: 15000, tax_cents: 3150, total_cents: 18150 })],
      invoiceLines: [line(L1, INV1, 'Sesión', 1, 5500, 0), line(L2, INV2, 'Taller A', 1, 10000, 21), line(L3, INV2, 'Taller B', 1, 5000, 21)]
    });
    const [i1, i2] = collections.invoices;
    assert.deepEqual(i1.lines.map(l => l.id), [L1]);
    assert.deepEqual(i2.lines.map(l => l.id), [L2, L3]);
    assert.ok(i2.lines.every(l => l.exempt === false));
    assert.deepEqual(A.legacyTotals(i2.lines, i2.ret), { base: 15000, iva: 3150, ret: 0, total: 18150 });
  });
  test('retención del 15 % a empresa se convierte a porcentaje exacto', () => {
    const { collections, report } = A.buildLegacyCollections({
      invoices: [invoice(INV1, { subtotal_cents: 20000, tax_cents: 0, retention_cents: 3000, total_cents: 17000 })],
      invoiceLines: [line(L1, INV1, 'Sesiones de octubre', 4, 5000, 0)]
    });
    assert.equal(collections.invoices[0].ret, 15);
    assert.equal(collections.invoices[0].retentionCents, 3000);
    assert.ok(!report.some(e => e.issue === 'mismatch_with_db'));
  });
  test('retención que no es un porcentaje entero queda null', () => {
    assert.equal(A.retentionPercent(1234, 20000), null);
    assert.equal(A.retentionPercent(0, 0), 0);
    assert.equal(A.retentionPercent(100, 0), null);
  });
  test('totales que no cuadran con la BD se anotan', () => {
    const { report } = A.buildLegacyCollections({ invoices: [invoice(INV1, { total_cents: 9999 })], invoiceLines: [line(L1, INV1, 'Sesión', 1, 5500, 0)] });
    assert.ok(report.some(e => e.entity === 'invoice' && e.issue === 'mismatch_with_db'));
  });
  test('tipo de IVA no soportado por la interfaz (10 %) se anota', () => {
    const report = A.createReport();
    const l = A.invoiceLineFromRow(line(L1, INV1, 'Material', 1, 1000, 10), { report });
    assert.equal(l.exempt, false); assert.equal(l.taxRate, 10);
    assert.ok(report.entries.some(e => e.issue === 'unsupported_rate' && e.value === 10));
  });
  test('estados: draft, desconocido y legacy_status', () => {
    const report = A.createReport();
    assert.equal(A.invoiceFromRow(invoice(INV1, { status: 'issued', invoice_number: 'A2026/0001' }), [], [], { report }).status, null);
    assert.ok(report.entries.some(e => e.field === 'status' && e.issue === 'unknown_value' && e.value === 'issued'));
    assert.equal(A.invoiceFromRow(invoice(INV1, { status: 'issued', legacy_status: 'emitida' }), [], []).status, 'emitida');
    assert.equal(A.invoiceFromRow(invoice(INV1, { series: 'R' }), [], []).kind, 'R');
  });
  test('líneas o cobros no cargados quedan null (no [])', () => {
    const { collections, report } = A.buildLegacyCollections({ invoices: [invoice(INV1)] });
    assert.equal(collections.invoices[0].lines, null);
    assert.equal(collections.invoices[0].payments, null);
    assert.ok(report.some(e => e.field === 'lines' && e.issue === 'not_loaded'));
  });
});

describe('gastos y empleados', () => {
  test('gasto: solo importe total; desglose fiscal null', () => {
    const report = A.createReport();
    const e = A.expenseFromRow({ id: E1, org_id: ORG, legacy_id: 'g3', description: 'Alquiler despacho', category: 'Alquiler', amount_cents: 45000, expense_date: '2026-11-01', supplier: 'Inmobiliaria Ficticia', document_path: null, created_at: 'x' }, { report });
    assert.equal(e.total, 45000); assert.equal(e.cat, 'Alquiler'); assert.equal(e.concept, 'Alquiler despacho'); assert.equal(e.date, '2026-11-01');
    for (const k of ['base', 'iva', 'ret', 'nif', 'method', 'num', 'status', 'source', 'photo', 'documentPath']) assert.equal(e[k], null, k);
    assert.ok(report.entries.some(x => x.field === 'total' && x.issue === 'amount_semantics_unverified'));
  });
  test('categoría que la interfaz no conoce se conserva y se anota', () => {
    const report = A.createReport();
    assert.equal(A.expenseFromRow({ id: E1, org_id: ORG, description: 'x', category: 'Viajes', amount_cents: 100, expense_date: '2026-11-01' }, { report }).cat, 'Viajes');
    assert.ok(report.entries.some(x => x.issue === 'unknown_category' && x.value === 'Viajes'));
  });
  test('empleado', () => {
    const e = A.employeeFromRow({ id: EMP1, org_id: ORG, full_name: 'Empleada Ficticia', role_title: 'Recepcionista', email: null, active: true, created_at: 'x' });
    assert.deepEqual(e, { id: EMP1, orgId: ORG, name: 'Empleada Ficticia', role: 'Recepcionista', email: null, active: true, contract: null, start: null, bruto: null, docs: [] });
  });
});

describe('notas clínicas', () => {
  test('borrador estructurado', () => {
    const n = A.clinicalNoteFromRow(note(N1), []);
    assert.equal(n.type, 'sesion'); assert.equal(n.status, 'borrador'); assert.equal(n.structured, true);
    assert.deepEqual(n.fields, { objetivos: 'Objetivo ficticio', resumen: 'Resumen ficticio' });
    assert.equal(n.apptId, A1); assert.equal(n.patientId, P1); assert.equal(n.author, null); assert.equal(n.authorId, uuid(999));
    assert.equal(n.created, '2026-11-03'); assert.equal(n.signedAt, null);
  });
  test('firmada (signed_at) con rectificaciones ordenadas', () => {
    const { collections } = A.buildLegacyCollections({
      clinicalNotes: [note(N1, { status: 'signed', signed_at: '2026-11-03T18:00:00+00:00' })],
      rectifications: [
        { id: R2, org_id: ORG, note_id: N1, author_id: uuid(999), reason: 'r2', replacement_text: 'texto 2', created_at: '2026-11-05T10:00:00+00:00' },
        { id: R1, org_id: ORG, note_id: N1, author_id: uuid(999), reason: 'r1', replacement_text: 'texto 1', created_at: '2026-11-04T10:00:00+00:00' }
      ]
    });
    const n = collections.notes[0];
    assert.equal(n.status, 'firmada'); assert.equal(n.signedAt, '2026-11-03');
    assert.deepEqual(n.versions.map(v => v.id), [R1, R2]);
    assert.equal(n.versions[0].text, 'texto 1'); assert.equal(n.versions[0].author, null);
  });
  test('contenido sin formato de apartados no se reparte y se conserva entero', () => {
    const report = A.createReport();
    const n = A.clinicalNoteFromRow(note(N1, { content: 'Texto libre ficticio sin apartados' }), [], { report });
    assert.equal(n.structured, false); assert.deepEqual(n.fields, {}); assert.equal(n.content, 'Texto libre ficticio sin apartados');
    assert.ok(report.entries.some(e => e.issue === 'content_unstructured'));
  });
  test('clave repetida o de otro tipo de informe: no estructurado', () => {
    assert.equal(A.parseNoteContent('objetivos: a\n\nobjetivos: b', 'sesion').structured, false);
    assert.equal(A.parseNoteContent('motivo: x', 'sesion').structured, false);
    assert.equal(A.parseNoteContent('motivo: x', 'inicial').structured, true);
  });
  test('estado y tipo desconocidos', () => {
    const report = A.createReport();
    const n = A.clinicalNoteFromRow(note(N1, { status: 'archived', note_type: 'phone_call' }), [], { report });
    assert.equal(n.status, null); assert.equal(n.type, null); assert.equal(n.structured, false);
    assert.ok(report.entries.some(e => e.field === 'status' && e.value === 'archived'));
    assert.ok(report.entries.some(e => e.field === 'type' && e.value === 'phone_call'));
  });
  test('draft con signed_at: se trata como firmada y se anota la contradicción', () => {
    const report = A.createReport();
    assert.equal(A.clinicalNoteFromRow(note(N1, { signed_at: '2026-11-03T18:00:00Z' }), [], { report }).status, 'firmada');
    assert.ok(report.entries.some(e => e.issue === 'draft_with_signed_at'));
  });
});

describe('relaciones e integridad del conjunto', () => {
  const snapshot = () => ({
    patients: [patientFull(), patientMin()],
    appointments: [appt(A1, P1, '2026-11-03T09:00:00Z', '2026-11-03T10:00:00Z', 'completed'), appt(A2, P1, '2026-11-10T09:00:00Z', '2026-11-10T10:00:00Z'), appt(A3, P2, '2026-11-04T09:00:00Z', '2026-11-04T10:00:00Z')],
    services: [{ id: S1, org_id: ORG, legacy_id: null, name: 'Sesión', duration_minutes: 60, price_cents: 5500, tax_exempt: true, active: true, created_at: 'x' }],
    professionals: [{ id: PRO1, org_id: ORG, display_name: 'Profesional Ficticia', professional_number: null, email: null, phone: null, created_at: 'x' }],
    invoices: [invoice(INV1)], invoiceLines: [line(L1, INV1, 'Sesión', 1, 5500, 0)], payments: [],
    clinicalNotes: [note(N1)], rectifications: [], patientDocuments: [], expenses: [], employees: []
  });
  test('cada paciente con sus citas, por id', () => {
    const { collections } = A.buildLegacyCollections(snapshot());
    const byPatient = id => collections.appts.filter(a => a.patientId === id).map(a => a.id).sort();
    assert.deepEqual(byPatient(P1), [A1, A2]);
    assert.deepEqual(byPatient(P2), [A3]);
    assert.ok(collections.appts.every(a => collections.patients.some(p => p.id === a.patientId)));
  });
  test('referencias huérfanas se detectan', () => {
    const s = snapshot();
    s.appointments.push(appt(uuid(33), uuid(404), '2026-11-04T09:00:00Z', '2026-11-04T10:00:00Z'));
    s.invoiceLines.push(line(uuid(53), uuid(405), 'x', 1, 100, 0));
    s.clinicalNotes.push(note(N2, { appointment_id: uuid(406) }));
    const { report } = A.buildLegacyCollections(s);
    const orphans = report.filter(e => e.issue === 'orphan_reference').map(e => `${e.entity}.${e.field}`).sort();
    assert.deepEqual(orphans, ['appointment.patientId', 'clinical_note.apptId', 'invoice_line.invoiceId']);
  });
  test('varias organizaciones en el mismo conjunto se anotan', () => {
    const s = snapshot(); s.patients[1] = { ...s.patients[1], org_id: ORG2 };
    assert.ok(A.buildLegacyCollections(s).report.some(e => e.issue === 'multiple_organizations'));
  });
  test('colección no cargada (por el rol) frente a colección vacía', () => {
    const { loaded, report } = A.buildLegacyCollections({ invoices: [], expenses: [] });
    assert.equal(loaded.invoices, true); assert.equal(loaded.patients, false);
    assert.ok(!report.some(e => e.issue === 'orphan_reference'));
  });
  test('UUID reales se conservan como id', () => {
    const { collections } = A.buildLegacyCollections(snapshot());
    for (const col of Object.values(collections)) for (const x of col) assert.ok(M.isUuid(x.id), x.id);
  });
  test('las claves que lee la interfaz existen en cada objeto', () => {
    const { collections: c } = A.buildLegacyCollections(snapshot());
    const need = {
      patients: ['id', 'code', 'name', 'email', 'phone', 'alta', 'status', 'slot', 'service', 'modal', 'bi', 'billing', 'consent', 'docs', 'reminders'],
      appts: ['id', 'patientId', 'date', 'start', 'dur', 'service', 'modal', 'loc', 'status', 'price', 'log', 'cancelReason', 'notes', 'invoiceId'],
      services: ['id', 'name', 'dur', 'price', 'exempt'],
      invoices: ['id', 'serie', 'num', 'patientId', 'to', 'date', 'due', 'lines', 'ret', 'appts', 'payments', 'sent', 'status', 'hash', 'prevHash', 'kind'],
      notes: ['id', 'patientId', 'apptId', 'type', 'fields', 'status', 'author', 'created', 'signedAt', 'versions', 'log']
    };
    for (const [col, keys] of Object.entries(need)) for (const x of c[col]) for (const k of keys) assert.ok(k in x, `${col}.${k}`);
  });
  test('funciones puras: no modifican la entrada y son deterministas', () => {
    const input = deepFreeze(snapshot());
    const a = A.buildLegacyCollections(input), b = A.buildLegacyCollections(input);
    assert.deepEqual(a, b);
  });
  test('el informe no contiene datos personales ni clínicos', () => {
    const s = snapshot();
    s.patients[0] = { ...s.patients[0], status: 'raro' };
    s.clinicalNotes[0] = { ...s.clinicalNotes[0], content: 'Texto clínico ficticio', status: 'raro' };
    const text = JSON.stringify(A.buildLegacyCollections(s).report);
    for (const pii of ['Ana', 'Prueba Ficticia', 'ana.prueba@', '600000001', 'Calle Ficticia', 'Texto clínico', 'Objetivo ficticio', '4821']) assert.ok(!text.includes(pii), pii);
  });
});

describe('diferencias entre registros legacy y relacionales (ida y vuelta con mapping.js)', () => {
  test('paciente: se conserva lo administrativo; se pierde "nuevo" y lo que no tiene columna', () => {
    const legacy = { id: 'p3', code: '5123', name: 'Bea Ficticia Ruiz', email: 'bea@correo-ejemplo.test', phone: '600000002', status: 'nuevo', slot: [1, 600], service: 's1', modal: 'online', billing: { type: 'particular', name: 'Bea Ficticia Ruiz', nif: '', addr: '' }, reminders: true };
    const row = { ...M.patientToRow(legacy, ORG), id: P1, legacy_id: legacy.id, profile_data: {}, created_at: '2026-11-06T10:00:00Z' };
    const back = A.patientFromRow(row);
    assert.equal(back.name, legacy.name); assert.equal(back.code, legacy.code); assert.equal(back.email, legacy.email); assert.equal(back.phone, legacy.phone);
    assert.equal(back.legacyId, 'p3');
    assert.equal(back.status, 'activo');               // 'nuevo' no existe en la BD
    for (const k of ['slot', 'service', 'modal', 'billing', 'reminders']) assert.equal(back[k], null, k); // patientToRow no los guarda
  });
  test('cita: fecha, hora, duración, estado y lugar sobreviven; historial y motivo no', () => {
    const legacy = { id: 'a9', patientId: 'p3', date: '2026-11-06', start: 600, dur: 50, status: 'cancelada', loc: 'Videollamada', cancelReason: 'Motivo laboral', log: [{ at: 'x', who: 'y', what: 'z' }] };
    for (const status of ['pendiente', 'confirmada', 'realizada', 'cancelada', 'ausencia']) {
      const row = { ...M.appointmentToRow({ ...legacy, status }, P1, ORG, PRO1, S1), id: A1, modality: 'online', price_cents: 5000 };
      const back = A.appointmentFromRow(row);
      assert.equal(back.date, legacy.date); assert.equal(back.start, legacy.start); assert.equal(back.dur, legacy.dur);
      assert.equal(back.status, status); assert.equal(back.loc, legacy.loc);
      assert.deepEqual(back.log, []); assert.equal(back.cancelReason, null);
    }
  });
  test('nota: los apartados sobreviven al texto de mapping.clinicalNoteToRow', () => {
    const fields = { objetivos: 'Regulación emocional (ficticio)', resumen: 'Línea 1\nLínea 2', intervenciones: '', plan: 'Seguir: con tareas' };
    const row = { ...M.clinicalNoteToRow({ id: 'n1', type: 'sesion', fields }, P1, A1, ORG, uuid(999)), id: N1, created_at: '2026-11-03T10:00:00Z' };
    const back = A.clinicalNoteFromRow(row, []);
    assert.equal(back.structured, true); assert.deepEqual(back.fields, fields); assert.equal(back.type, 'sesion');
  });
  test('nota: un valor que contiene "\\n\\nclave: " se reparte mal (limitación documentada)', () => {
    const fields = { resumen: 'texto\n\nplan: dentro del resumen' };
    const row = { ...M.clinicalNoteToRow({ type: 'sesion', fields }, P1, null, ORG, null), id: N1 };
    assert.notDeepEqual(A.clinicalNoteFromRow(row, []).fields, fields);
  });
  test('factura: importes de mapping.invoiceToRow cuadran con legacyTotals', () => {
    const legacy = { id: 'f1', date: '2026-11-06', due: '2026-11-21', status: 'borrador', ret: 15, lines: [{ desc: 'Taller', qty: 2, price: 15000, exempt: false }, { desc: 'Sesión', qty: 1, price: 5500, exempt: true }] };
    const row = { ...M.invoiceToRow(legacy, P1, ORG), id: INV1, retention_cents: Math.round(35500 * 15 / 100) };
    const lines = M.invoiceLinesToRows(legacy, INV1, ORG).map((l, k) => A.invoiceLineFromRow({ ...l, id: uuid(500 + k) }));
    const report = A.createReport();
    const back = A.invoiceFromRow(row, lines, [], { report });
    assert.equal(back.status, 'borrador'); assert.equal(back.ret, 15);
    assert.deepEqual(back.lines.map(l => [l.desc, l.qty, l.price, l.exempt]), legacy.lines.map(l => [l.desc, l.qty, l.price, l.exempt]));
    assert.deepEqual([row.subtotal_cents, row.tax_cents, row.total_cents], [35500, 6300, 36475]);
    assert.ok(!report.entries.some(e => e.issue === 'mismatch_with_db'));
  });
});

describe('copias que no deben desincronizarse', () => {
  const legacySrc = readFileSync(new URL('../../src/legacy.js', import.meta.url), 'utf8');
  test('NOTE_FIELD_KEYS coincide con FIELDS de legacy.js', () => {
    const literal = legacySrc.match(/const FIELDS=(\{[\s\S]*?\n\});/)[1];
    const FIELDS = new Function(`return ${literal}`)();
    assert.deepEqual(Object.fromEntries(Object.entries(FIELDS).map(([k, v]) => [k, v.map(x => x[0])])), A.NOTE_FIELD_KEYS);
  });
  test('LEGACY_EXPENSE_CATEGORIES coincide con CATS de legacy.js', () => {
    const CATS = new Function(`return ${legacySrc.match(/const CATS=(\[[^\]]*\]);/)[1]}`)();
    assert.deepEqual(CATS, [...A.LEGACY_EXPENSE_CATEGORIES]);
  });
  test('los estados son el inverso exacto de mapping.js', () => {
    for (const [db, legacy] of Object.entries(A.APPOINTMENT_STATUS)) assert.equal(M.appointmentToRow({ date: '2026-11-06', start: 600, dur: 60, status: legacy }, P1, ORG).status, db);
    for (const [db, legacy] of Object.entries(A.NOTE_TYPE)) assert.equal(M.clinicalNoteToRow({ type: legacy, fields: {} }, P1, null, ORG, null).note_type, db);
    assert.equal(M.patientToRow({ status: 'alta terapéutica' }, ORG).status, 'inactive');
    assert.equal(M.patientToRow({ status: 'activo' }, ORG).status, 'active');
  });
});
