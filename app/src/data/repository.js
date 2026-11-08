import { supabaseRequest } from './supabase-client.js';
import { getOrganizationContext, restoreSession, getCurrentUser } from './auth.js';
import { isUuid, splitName } from './mapping.js';

const one = value => Array.isArray(value) ? value[0] : value;
const json = value => JSON.stringify(value);
export function createKovoRepository() {
  let context = null;
  const requireContext = async () => {
    if (!getCurrentUser()) await restoreSession();
    if (!context) context = await getOrganizationContext();
    return context;
  };
  const table = async (name, query, options={}) => {
    const ctx=await requireContext();
    const suffix=query ? `&${query}` : '';
    return supabaseRequest(`${name}?select=*${suffix}`,options);
  };
  const insert = (name,row) => supabaseRequest(name,{method:'POST',body:row,headers:{Prefer:'return=representation'}});
  const patch = (name,id,row) => supabaseRequest(`${name}?id=eq.${id}`,{method:'PATCH',body:row,headers:{Prefer:'return=representation'}});
  const rpc = (name,args) => supabaseRequest(`rpc/${name}`,{method:'POST',body:args});
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
    async savePatient(patient){
      const ctx=await role('psychologa','recepcion');
      const {first_name,last_name}=splitName(patient.name || [patient.first_name,patient.last_name].filter(Boolean).join(' '));
      const row={org_id:ctx.id,first_name,last_name,email:patient.email||null,phone:patient.phone||null,
        birth_date:patient.birth_date||null,address:patient.address||null,
        emergency_contact:patient.emergency_contact||null,
        status:patient.status==='alta terapéutica'?'inactive':'active',
        administrative_notes:patient.administrative_notes||null,
        profile_data:patient.profile_data||{},legacy_id:patient.legacy_id||(!isUuid(patient.id)?patient.id:null)};
      if(patient.id && isUuid(patient.id)) return one(await patch('patients',patient.id,row));
      return one(await insert('patients',row));
    },
    async listAppointments(){
      const ctx=await role('psychologa','recepcion');
      return table('appointments',`org_id=eq.${ctx.id}&order=starts_at.asc`);
    },
    async saveAppointment(row){
      const ctx=await role('psychologa','recepcion');
      const payload={...row,org_id:ctx.id};
      delete payload.id;
      return one(await insert('appointments',payload));
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
    async loadSnapshot(){
      const ctx=await requireContext();
      const result={context:ctx,patients:[],appointments:[],services:[],professionals:[],invoices:[],expenses:[],employees:[],clinicalNotes:[]};
      const common=[this.listServices(),this.listProfessionals()];
      if(['psychologa','recepcion'].includes(ctx.role)) common.push(this.listPatients(),this.listAppointments());
      if(['psychologa','gestoria'].includes(ctx.role)) common.push(this.listInvoices(),this.listExpenses());
      if(ctx.role==='psychologa') common.push(this.listEmployees(),this.listClinicalNotes());
      const values=await Promise.all(common); let i=0;
      [result.services,result.professionals]=values.slice(i,i+=2);
      if(['psychologa','recepcion'].includes(ctx.role)) [result.patients,result.appointments]=values.slice(i,i+=2);
      if(['psychologa','gestoria'].includes(ctx.role)) [result.invoices,result.expenses]=values.slice(i,i+=2);
      if(ctx.role==='psychologa') [result.employees,result.clinicalNotes]=values.slice(i,i+=2);
      return result;
    }
  };
}
