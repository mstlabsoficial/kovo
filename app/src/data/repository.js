import { supabaseRequest } from './supabase-client.js';
import { getOrganizationContext, restoreSession, getCurrentUser } from './auth.js';
import { isUuid } from './mapping.js';

const one = value => Array.isArray(value) ? value[0] : value;

// Tablas que lee loadSnapshot() y roles que pueden leerlas. Copia de las políticas RLS de SELECT
// (supabase/recovered-schema/catalog-security.json). La BD es quien protege los datos; esta tabla
// solo evita pedir lo que el rol no puede ver y distinguir "no cargado" de "vacío".
// `agenda` (solo calendario, db/migrations/20261112090300) no lee pacientes ni citas: su calendario
// llega por la RPC agenda_calendar (códigos de paciente, sin nombres).
const ALL_ROLES = ['psychologa', 'recepcion', 'gestoria', 'agenda'];
export const SNAPSHOT_TABLES = Object.freeze([
  { key: 'services', table: 'services', order: 'name.asc,id.asc', roles: ALL_ROLES },
  { key: 'professionals', table: 'professionals', order: 'display_name.asc,id.asc', roles: ALL_ROLES },
  { key: 'patients', table: 'patients', order: 'created_at.desc,id.asc', roles: ['psychologa', 'recepcion'] },
  { key: 'appointments', table: 'appointments', order: 'starts_at.asc,id.asc', roles: ['psychologa', 'recepcion'] },
  { key: 'invoices', table: 'invoices', order: 'issue_date.desc,id.asc', roles: ['psychologa', 'gestoria'] },
  { key: 'invoiceLines', table: 'invoice_lines', order: 'id.asc', roles: ['psychologa', 'gestoria'] },
  { key: 'payments', table: 'payments', order: 'paid_at.asc,id.asc', roles: ['psychologa', 'gestoria'] },
  { key: 'expenses', table: 'expenses', order: 'expense_date.desc,id.asc', roles: ['psychologa', 'gestoria'] },
  { key: 'employees', table: 'employees', order: 'full_name.asc,id.asc', roles: ['psychologa'] },
  { key: 'clinicalNotes', table: 'clinical_notes', order: 'created_at.desc,id.asc', roles: ['psychologa'] },
  { key: 'rectifications', table: 'clinical_note_rectifications', order: 'created_at.asc,id.asc', roles: ['psychologa'] },
  { key: 'patientDocuments', table: 'patient_documents', order: 'created_at.desc,id.asc', roles: ['psychologa'] }
]);
export const PAGE_SIZE = 500;
const MAX_PAGES = 200;   // 100 000 filas por tabla: por encima se considera una respuesta anómala

// Error de carga sin datos personales: tipo, tabla y estado HTTP.
export class SnapshotError extends Error {
  constructor(code, message, { table = null, status = null } = {}) {
    super(message);
    this.name = 'SnapshotError'; this.code = code; this.table = table; this.status = status;
  }
}
function classify(error, table) {
  if (error instanceof SnapshotError) return error;
  const status = Number.isInteger(error?.status) ? error.status : null;
  if (status === 401 || status === 403)
    return new SnapshotError('auth', 'Tu sesión ha caducado o tu perfil no tiene acceso. Vuelve a iniciar sesión.', { table, status });
  if (status) return new SnapshotError('http', `No se han podido cargar los datos (HTTP ${status}). Inténtalo de nuevo.`, { table, status });
  return new SnapshotError('network', 'No hay conexión con el servidor. Comprueba tu red e inténtalo de nuevo.', { table });
}

// Calendario del rol «solo calendario»: 120 días atrás y 280 adelante (hora de Madrid). Las citas y
// los pacientes se construyen solo con lo que devuelve la RPC: código, horas, estado y servicio.
const madridDay = (offset = 0) => new Date(Date.now() + offset * 864e5).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
export function agendaRows(rows, orgId) {
  const appointments = [], patients = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!isUuid(r?.id) || !isUuid(r?.patient_id)) continue;
    appointments.push({ id: r.id, org_id: orgId, patient_id: r.patient_id, professional_id: r.professional_id ?? null, service_id: r.service_id ?? null,
      starts_at: r.starts_at, ends_at: r.ends_at, status: r.status, modality: r.modality ?? null, location: null, price_cents: null,
      administrative_note: null, updated_at: r.updated_at ?? null });
    if (!patients.has(r.patient_id)) patients.set(r.patient_id, { id: r.patient_id, org_id: orgId, patient_code: r.patient_code, first_name: null, last_name: null,
      email: null, phone: null, status: 'active', profile_data: {} });
  }
  return { appointments, patients: [...patients.values()] };
}

export function createKovoRepository({ request = supabaseRequest, getContext = null } = {}) {
  let context = null;
  const requireContext = async () => {
    if (getContext) { if (!context) context = await getContext(); return context; }
    if (!getCurrentUser()) await restoreSession();
    if (!context) context = await getOrganizationContext();
    return context;
  };
  const table = async (name, query, options={}) => {
    await requireContext();
    const suffix=query ? `&${query}` : '';
    return request(`${name}?select=*${suffix}`,options);
  };
  const insert = (name,row) => request(name,{method:'POST',body:row,headers:{Prefer:'return=representation'}});
  const rpc = (name,args) => request(`rpc/${name}`,{method:'POST',body:args});
  const agendaSnapshot = async ctx => {
    try { return agendaRows(await rpc('agenda_calendar', { p_org_id: ctx.id, p_from: madridDay(-120), p_to: madridDay(280) }), ctx.id); }
    catch (e) { throw classify(e, 'agenda_calendar'); }
  };

  // Lee todas las filas de la organización, página a página. Se para con una página vacía (no
  // con una incompleta) para no truncar si el servidor limita filas por respuesta.
  const readAll = async (spec, orgId) => {
    const rows = [];
    let offset = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      let data;
      try {
        data = await request(`${spec.table}?select=*&org_id=eq.${orgId}&order=${spec.order}&limit=${PAGE_SIZE}&offset=${offset}`);
      } catch (error) { throw classify(error, spec.table); }
      if (!Array.isArray(data))
        throw new SnapshotError('unexpected_response', 'El servidor ha devuelto una respuesta inesperada.', { table: spec.table });
      for (const row of data) {
        if (!row || typeof row !== 'object' || typeof row.id !== 'string' || row.org_id !== orgId)
          throw new SnapshotError('unexpected_response', 'El servidor ha devuelto registros que no corresponden a tu consulta.', { table: spec.table });
      }
      if (!data.length) return rows;
      rows.push(...data);
      offset += data.length;
    }
    throw new SnapshotError('unexpected_response', 'Demasiados registros para cargar de una vez.', { table: spec.table });
  };
  const role = async (...roles) => {
    const ctx=await requireContext();
    if(!roles.includes(ctx.role)) throw new Error('Tu perfil no tiene permiso para realizar esta operación.');
    return ctx;
  };
  return {
    async context(){ return requireContext(); },
    async listPatients(){
      const ctx=await role('psychologa','recepcion');
      return table('patients',`org_id=eq.${ctx.id}&order=created_at.desc`);
    },
    // Altas y cambios de pacientes y citas: writes.js (validados, idempotentes y confirmados).
    async listAppointments(){
      const ctx=await role('psychologa','recepcion');
      return table('appointments',`org_id=eq.${ctx.id}&order=starts_at.asc`);
    },
    async listClinicalNotes(patientId){
      const ctx=await role('psychologa');
      const filter=patientId?`&patient_id=eq.${patientId}`:'';
      return table('clinical_notes',`org_id=eq.${ctx.id}&order=created_at.desc${filter}`);
    },
    async saveClinicalNoteDraft({patientId,appointmentId=null,noteType='session',content,noteId=null}){
      const ctx=await role('psychologa');
      return rpc('save_clinical_note_draft',{p_org_id:ctx.id,p_patient_id:patientId,p_appointment_id:appointmentId,p_note_type:noteType,p_content:content,p_note_id:noteId});
    },
    async signClinicalNote(noteId){
      await role('psychologa');
      return rpc('sign_clinical_note',{p_note:noteId});
    },
    async rectifyClinicalNote(noteId,reason,replacement){
      await role('psychologa');
      return rpc('rectify_clinical_note',{p_note:noteId,p_reason:reason,p_replacement:replacement});
    },
    async deleteClinicalNoteDraft(noteId){
      const ctx=await role('psychologa');
      return rpc('delete_clinical_note_draft',{p_org_id:ctx.id,p_note_id:noteId});
    },
    async listInvoices(){
      const ctx=await role('psychologa','gestoria');
      return table('invoices',`org_id=eq.${ctx.id}&order=issue_date.desc`);
    },
    async createInvoiceDraft({patientId=null,issueDate,dueDate=null,lines,legacyId=null,retentionCents=0}){
      const ctx=await role('psychologa','gestoria');
      const normalized=(lines||[]).map(line=>({
        description:String(line.description||line.desc||'Servicio'),
        quantity:Number(line.quantity??line.qty??1),
        unit_price_cents:Math.round(Number(line.unit_price_cents??line.price??0)),
        tax_rate:Number(line.tax_rate??(line.exempt?0:21))
      }));
      return rpc('save_invoice_draft',{p_org_id:ctx.id,p_patient_id:patientId,p_issue_date:issueDate,p_due_date:dueDate,p_lines:normalized,p_legacy_id:legacyId,p_retention_cents:retentionCents});
    },
    async issueInvoice(invoiceId){
      await role('psychologa','gestoria');
      return rpc('emit_invoice',{p_invoice:invoiceId});
    },
    async listExpenses(){
      const ctx=await role('psychologa','gestoria');
      return table('expenses',`org_id=eq.${ctx.id}&order=expense_date.desc`);
    },
    async saveExpense(expense){
      const ctx=await role('psychologa','gestoria');
      const row={org_id:ctx.id,description:expense.description,category:expense.category||null,
        amount_cents:Math.round(Number(expense.amount_cents??expense.amount??0)),
        expense_date:expense.expense_date||expense.date,supplier:expense.supplier||null,
        document_path:expense.document_path||null,legacy_id:expense.legacy_id||null};
      return one(await insert('expenses',row));
    },
    async listServices(){
      const ctx=await requireContext();
      return table('services',`org_id=eq.${ctx.id}&active=eq.true&order=name.asc`);
    },
    async listProfessionals(){
      const ctx=await requireContext();
      return table('professionals',`org_id=eq.${ctx.id}&order=display_name.asc`);
    },
    async listEmployees(){
      const ctx=await role('psychologa');
      return table('employees',`org_id=eq.${ctx.id}&order=full_name.asc`);
    },
    // Lectura completa para la interfaz. Solo GET. Devuelve las filas tal cual, por tabla; las
    // tablas que el rol no puede leer no aparecen (no cargadas ≠ vacías). Todo o nada: si falla
    // una tabla, falla la carga y no se devuelve un estado parcial.
    // Se cargan todos los servicios, también los inactivos, porque citas antiguas los usan.
    // Ajustes de la clínica y horario de la profesional (cadena consolidada). Con el esquema
    // anterior (sin esa tabla o columna) se devuelven vacíos y la interfaz usa los valores por defecto.
    async loadExtras(ctx, professionalId){
      const optional = async path => {
        try { return await request(path); }
        catch (e) { if ([400, 404].includes(e?.status) || ['PGRST205', 'PGRST204', '42703', '42P01'].includes(e?.details?.code)) return null; throw classify(e, path.split('?')[0]); }
      };
      const out = {};
      const org = await optional(`organizations?select=id,name,settings&id=eq.${ctx.id}`);
      if (Array.isArray(org) && org[0]?.id === ctx.id) { out.settings = org[0].settings || null; out.name = org[0].name || null; }
      if (['psychologa', 'gestoria'].includes(ctx.role)) {
        const bp = await optional(`organization_billing_profiles?select=legal_name,tax_id,address_line,postal_code,city,region,billing_email,invoice_series&org_id=eq.${ctx.id}`);
        if (Array.isArray(bp)) out.billingProfile = bp[0] || null;
      }
      if (professionalId) {
        const av = await optional(`professional_availability?select=weekday,start_minute,end_minute&org_id=eq.${ctx.id}&professional_id=eq.${professionalId}&order=weekday.asc,start_minute.asc`);
        if (Array.isArray(av)) out.availability = av;
      }
      // Interfaz v3 (db/migrations/20261112090100-0200). Sin esas tablas, null: la interfaz lo explica.
      if (ctx.role === 'psychologa') {
        out.tests = await optional(`patient_tests?select=id,patient_id,name,test_date,result,document_id,retired_at&org_id=eq.${ctx.id}&order=test_date.asc`);
        out.diagnoses = await optional(`patient_diagnoses?select=id,patient_id,title,diagnosis_date,rationale,test_ids,author_name,retired_at&org_id=eq.${ctx.id}&order=diagnosis_date.asc`);
      }
      // Facturar sesiones exige el enlace cita ↔ línea de factura (propuesta 20261108). Sin la columna,
      // facturar no guardaría el enlace y la misma sesión podría facturarse otra vez: se bloquea.
      if (ctx.role === 'psychologa') out.billingLink = Array.isArray(await optional(`invoice_lines?select=appointment_id&org_id=eq.${ctx.id}&limit=1`));
      if (['psychologa', 'gestoria'].includes(ctx.role))
        out.recurring = await optional(`recurring_expenses?select=*&org_id=eq.${ctx.id}&order=created_at.asc`);
      // Vacaciones y días cerrados: los de la profesional de la sesión (o, si no hay, los de la clínica).
      const off = await optional(`professional_time_off?select=id,professional_id,starts_at,ends_at,reason&org_id=eq.${ctx.id}${professionalId ? `&professional_id=eq.${professionalId}` : ''}&order=starts_at.asc`);
      if (Array.isArray(off)) out.timeOff = off;
      return out;
    },
    async loadSnapshot(){
      let ctx;
      try { ctx=await requireContext(); } catch (error) { throw classify(error, 'memberships'); }
      if(!ctx || !isUuid(ctx.id)) throw new SnapshotError('unexpected_response','No se ha podido identificar tu consulta.',{table:'organizations'});
      if(!ALL_ROLES.includes(ctx.role)) throw new SnapshotError('forbidden','Tu perfil no tiene acceso a KOVO.',{table:'memberships'});
      const specs=SNAPSHOT_TABLES.filter(s=>s.roles.includes(ctx.role));
      const values=await Promise.all(specs.map(s=>readAll(s,ctx.id)));
      const result={context:ctx};
      specs.forEach((s,i)=>{ result[s.key]=values[i]; });
      if(ctx.role==='agenda') Object.assign(result, await agendaSnapshot(ctx));
      return result;
    }
  };
}
