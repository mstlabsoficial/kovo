  toggleTheme:()=>{S.settings.theme=effTheme()==='dark'?'light':'dark';audit('Tema: '+S.settings.theme);render()},
  setTheme:d=>{S.settings.theme=d.k;audit('Tema: '+d.k);render();toast('Tema aplicado')},
  goProfile:()=>{S.view='config';S.sel.ctab='perfil';S.sel.patient=null;render();window.scrollTo(0,0)},
  goFiscal:()=>{S.view='config';S.sel.ctab='perfil';S.sel.patient=null;render();window.scrollTo(0,0)},
  more:()=>{const vis=NAV.filter(n=>n[2].includes(S.role));const shown=['inicio','calendario','pacientes','informes'];const rest=vis.filter(n=>!shown.includes(n[0]));
    modal('Más',`<div class="stack" style="gap:2px">${rest.map(n=>`<button class="todo" data-act="goClose" data-v="${n[0]}"><span class="ic">${SVG(NAVI[n[0]])}</span><span class="tx"><b>${n[1]}</b></span></button>`).join('')}</div>
    <label class="field"><span>Ver como (prototipo)</span><select id="role2">${[['psicologa','Psicóloga'],['recepcion','Recepción'],['gestoria','Gestoría']].map(([v,l])=>`<option value="${v}" ${S.role===v?'selected':''}>${l}</option>`).join('')}</select></label>`)},
  goClose:d=>{closeModal();ACT.go(d)},
  sfilter:d=>{S.sel.sf=d.f;render()},
  closeEditor:()=>{const n=S.notes.find(x=>x.id===S.sel.editing);if(n&&n.status!=='firmada')readNote(n);S.sel.editing=null;render();window.scrollTo(0,0)},
  applyTpl:d=>{const n=S.notes.find(x=>x.id===S.sel.editing);if(!n)return;readNote(n);const tpl=TEMPLATES[n.type][Number(d.i)][1];let c=0;Object.entries(tpl).forEach(([k,v])=>{if(!n.fields[k]){n.fields[k]=v;c++}});render();toast(c?`Plantilla aplicada a ${c} ${c===1?'apartado vacío':'apartados vacíos'}`:'No hay apartados vacíos')},
  newReport:()=>{if(S.role!=='psicologa')return;const pts=S.patients.slice().sort((a,b)=>norm(a.name).localeCompare(norm(b.name)));
    modal('Nuevo informe',`<div class="form"><label class="field full"><span>Paciente</span><select id="nr-p">${pts.map(p=>`<option value="${p.id}">${esc(p.name)} · #${p.code}</option>`).join('')}</select></label>
    <label class="field full"><span>Tipo de informe</span><select id="nr-t"><option value="inicial">Evaluación inicial</option><option value="evolucion">Informe de seguimiento</option><option value="cierre">Informe de cierre</option></select></label></div>`,
    `<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="saveReport">Crear y abrir editor</button>`)},
  saveReport:()=>{const p=val('nr-p'),t=val('nr-t');if(!p)return;ACT.newDoc({t,p})},
  newInvoice:()=>{if(S.role==='gestoria')return;const pts=S.patients.slice().sort((a,b)=>norm(a.name).localeCompare(norm(b.name)));
    modal('Nueva factura',`<div class="form"><label class="field full"><span>Paciente</span><select id="ni-p">${pts.map(p=>`<option value="${p.id}">${esc(p.name)} · #${p.code}</option>`).join('')}</select></label>
    <label class="field full"><span>Concepto</span><input type="text" id="ni-d" value="Sesión individual"></label>
    <label class="field"><span>Importe (€)</span><input type="number" step="0.01" min="0" id="ni-a" value="55"></label>
    <label class="field"><span>IVA</span><select id="ni-x"><option value="1">Exento (asistencia sanitaria)</option><option value="0">IVA 21 %</option></select></label></div>`,
    `<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="saveNewInv">Crear borrador</button>`)},
  saveNewInv:()=>{const p=P(val('ni-p'));const amt=Math.round(Number(val('ni-a'))*100);if(!p||!(amt>0)){toast('Indica el paciente y un importe mayor que cero');return}
    const inv=mkInv(S,p,TODAY,[{desc:val('ni-d')||'Servicio',qty:1,price:amt,exempt:val('ni-x')==='1'}],[]);S.invoices.push(inv);audit('Borrador de factura creado');closeModal();render();openInv(inv.id)},
  pdfInv:d=>pdfInv(S.invoices.find(x=>x.id===d.id)),
  saveNote:d=>{const n=S.notes.find(x=>x.id===d.id);readNote(n);nlog(n,'Borrador guardado');audit(`Nota de #${P(n.patientId).code} guardada como borrador`);render();toast('Borrador guardado')},
  signNote:d=>{const n=S.notes.find(x=>x.id===d.id);readNote(n);if(FIELDS[n.type].every(([k])=>!n.fields[k])){toast('Completa al menos un apartado antes de firmar');return}
    n.status='firmada';n.signedAt=TODAY;nlog(n,'Firmado y cerrado');audit(`${NOTE_T[n.type]} de #${P(n.patientId).code} firmado`);S.sel.editing=null;render();toast('Informe firmado y cerrado')},
  rectNote:d=>{const n=S.notes.find(x=>x.id===d.id);const t=val('nf-rect').trim();if(!t){toast('Escribe la rectificación antes de guardar');return}n.versions.push({at:new Date().toISOString(),author:'Laura Benítez',text:t});nlog(n,'Rectificación añadida');audit(`Rectificación en ${NOTE_T[n.type]} de #${P(n.patientId).code}`);render();toast('Rectificación añadida')},
