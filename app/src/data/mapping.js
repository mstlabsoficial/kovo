// Transformaciones puras entre el modelo legacy de KOVO y el esquema relacional.
// No se generan UUID locales ni se sincroniza información clínica automáticamente.
export function splitName(fullName='') {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  return { first_name: parts.shift() || 'Sin nombre', last_name: parts.join(' ') || '-' };
}
export function patientToRow(p, orgId) {
  const name = splitName(p.name);
  return {
    ...(isUuid(p.id) ? { id: p.id } : {}),
    org_id: orgId,
    patient_code: p.code ? String(p.code) : 'AUTO',
    first_name: name.first_name, last_name: name.last_name,
    email: p.email || null, phone: p.phone || null,
    status: p.status === 'alta terapéutica' ? 'inactive' : 'active',
    administrative_notes: null
  };
}
export function appointmentToRow(a, patientId, orgId, professionalId=null, serviceId=null) {
  const starts = new Date(`${a.date}T${String(Math.floor(a.start/60)).padStart(2,'0')}:${String(a.start%60).padStart(2,'0')}:00`);
  const ends = new Date(starts.getTime() + Number(a.dur || 0)*60000);
  const status = ({ pendiente:'scheduled', confirmada:'confirmed', realizada:'completed', cancelada:'cancelled', ausencia:'no_show' })[a.status] || 'scheduled';
  return {
    ...(isUuid(a.id) ? { id:a.id } : {}), org_id:orgId, patient_id:patientId,
    professional_id:professionalId, service_id:serviceId,
    starts_at:starts.toISOString(), ends_at:ends.toISOString(), status,
    location:a.loc || null, administrative_note:null
  };
}
export function clinicalNoteToRow(note, patientId, appointmentId, orgId, authorId) {
  const content = Object.entries(note.fields || {}).map(([key,value]) => `${key}: ${value || ''}`).join('\n\n');
  return {
    ...(isUuid(note.id) ? { id:note.id } : {}), org_id:orgId, patient_id:patientId,
    appointment_id:appointmentId || null, author_id:authorId,
    note_type: ({sesion:'session',inicial:'initial',evolucion:'progress',cierre:'discharge'})[note.type] || 'session',
    content, status:'draft'
  };
}
export function invoiceToRow(invoice, patientId, orgId) {
  const subtotal = (invoice.lines || []).reduce((sum,line)=>sum+Math.round(Number(line.qty||0)*Number(line.price||0)),0);
  const tax = (invoice.lines || []).reduce((sum,line)=>sum+(line.exempt?0:Math.round(Math.round(Number(line.qty||0)*Number(line.price||0))*.21)),0);
  const retention = Math.round(subtotal*Number(invoice.ret||0)/100);
  const total = subtotal + tax - retention;
  return {
    ...(isUuid(invoice.id) ? { id:invoice.id } : {}), org_id:orgId, patient_id:patientId || null,
    invoice_number: invoice.num || 'BORRADOR', issue_date:invoice.date,
    due_date:invoice.due || null,
    status: invoice.status === 'borrador' ? 'draft' : 'draft',
    currency:'EUR', subtotal_cents:subtotal, tax_cents:tax, total_cents:total,
    notes:null
  };
}
export function invoiceLinesToRows(invoice, invoiceId, orgId) {
  return (invoice.lines || []).map(line=>{
    const base=Math.round(Number(line.qty||0)*Number(line.price||0));
    const taxRate=line.exempt?0:21;
    return { org_id:orgId, invoice_id:invoiceId, description:String(line.desc||'Servicio'),
      quantity:Number(line.qty||1), unit_price_cents:Number(line.price||0), tax_rate:taxRate,
      line_total_cents:Math.round(base*(1+taxRate/100)) };
  });
}
export function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||'')); }
