import { supabaseRequest } from './supabase-client.js';
import { getOrganizationContext, restoreSession, getCurrentUser } from './auth.js';
import { isUuid } from './mapping.js';

const one = value => Array.isArray(value) ? value[0] : value;

// Tablas que lee loadSnapshot() y roles que pueden leerlas. Copia de las políticas RLS de SELECT
// (supabase/recovered-schema/catalog-security.json). La BD es quien protege los datos; esta tabla
// solo evita pedir lo que el rol no puede ver y distinguir "no cargado" de "vacío".
const ALL_ROLES = ['psychologa', 'recepcion', 'gestoria'];
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
    async loadSnapshot(){
      let ctx;
      try { ctx=await requireContext(); } catch (error) { throw classify(error, 'memberships'); }
      if(!ctx || !isUuid(ctx.id)) throw new SnapshotError('unexpected_response','No se ha podido identificar tu consulta.',{table:'organizations'});
      if(!ALL_ROLES.includes(ctx.role)) throw new SnapshotError('forbidden','Tu perfil no tiene acceso a KOVO.',{table:'memberships'});
      const specs=SNAPSHOT_TABLES.filter(s=>s.roles.includes(ctx.role));
      const values=await Promise.all(specs.map(s=>readAll(s,ctx.id)));
      const result={context:ctx};
      specs.forEach((s,i)=>{ result[s.key]=values[i]; });
      return result;
    }
  };
}
