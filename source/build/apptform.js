let APPT_CTX={isNew:true,keep:''};
function pickerList(q,keep){const n=norm(q).replace('#','').trim();return S.patients.filter(p=>(p.status!=='alta terapéutica'||p.id===keep)&&(!n||p.code.includes(n)||norm(p.name).includes(n))).sort((a,b)=>norm(a.name).localeCompare(norm(b.name))).slice(0,40)}
function pickerHTML(list){return list.length?list.map(p=>`<button type="button" class="combo-it" data-act="pickPt" data-id="${p.id}"><span class="av sm" style="${avStyle(p)}">${esc(initials(p.name))}</span><span class="pm"><b>${esc(p.name)}</b><span>${esc(SV(p.service).name)}</span></span><span class="pc">#${p.code}</span></button>`).join(''):'<div class="empty">Sin resultados</div>'}
function onPatientPick(p){
  if(!APPT_CTX.isNew||!p)return;
  const s=document.getElementById('f-s');s.value=p.service;s.onchange();
  document.getElementById('f-m').value=p.modal;document.getElementById('f-l').value=p.modal==='online'?'Videollamada':LOC();
}
function apptForm(a,pre){
  pre=pre||{};const isNew=!a;a=a||{patientId:pre.p||'',date:pre.d||TODAY,start:pre.t||600,service:'s1',dur:60,modal:'presencial',loc:LOC()};
  APPT_CTX={isNew,keep:a.patientId};const cur=P(a.patientId);
  modal(isNew?'Nueva cita':'Reprogramar cita',`<div class="form">
    <div class="field full combo"><span>Paciente · busca por nombre o código</span>
      <input type="text" id="f-pq" placeholder="Escribe un nombre o un código…" autocomplete="off" value="${cur?esc('#'+cur.code+' · '+cur.name):''}">
      <input type="hidden" id="f-p" value="${esc(a.patientId)}">
      <div class="combo-list" id="f-plist" hidden></div></div>
    <div class="full muted small" style="margin-top:-6px">En el calendario la cita aparecerá solo con el código. ¿Paciente nuevo? <a href="#" data-act="newPatient">Créalo</a> y se le asignará un código.</div>
    <label class="field"><span>Fecha</span><input type="date" id="f-d" value="${a.date}"></label>
    <label class="field"><span>Hora</span><input type="time" id="f-t" step="900" value="${hm(a.start)}"></label>
    <label class="field"><span>Servicio</span><select id="f-s">${S.services.map(s=>`<option value="${s.id}" ${s.id===a.service?'selected':''}>${esc(s.name)} · ${eur(s.price)}</option>`).join('')}</select></label>
    <label class="field"><span>Duración (min)</span><input type="number" id="f-dur" min="15" step="5" value="${a.dur}"></label>
    <label class="field"><span>Modalidad</span><select id="f-m"><option ${a.modal==='presencial'?'selected':''}>presencial</option><option ${a.modal==='online'?'selected':''}>online</option></select></label>
    <label class="field"><span>Ubicación o enlace</span><input type="text" id="f-l" value="${esc(a.loc)}"></label>
    <div id="f-warn" class="full" hidden></div></div>`,
    `<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="saveAppt" data-id="${isNew?'':a.id}">${isNew?'Crear cita':'Guardar cambios'}</button>`);
  const s=document.getElementById('f-s');
  s.onchange=()=>{document.getElementById('f-dur').value=SV(s.value).dur;if(s.value==='s4'){document.getElementById('f-m').value='online';document.getElementById('f-l').value='Videollamada'}};
  const l=document.getElementById('f-plist');
  if(a.patientId){l.hidden=true}else{l.innerHTML=pickerHTML(pickerList('',''));l.hidden=isMob()}
  if(isNew&&pre.p)onPatientPick(P(pre.p));
}
