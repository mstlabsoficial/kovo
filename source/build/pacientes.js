function patientList(){
  const q=norm(S.sel.q||'').replace('#','').trim();const f=S.sel.pf||'todos';
  const found=S.patients.filter(p=>(f==='todos'||p.status===f)&&(!q||p.code.includes(q)||norm(p.name).includes(q)||norm(p.email).includes(q)||p.phone.replace(/\s/g,'').includes(q))).sort((a,b)=>norm(a.name).localeCompare(norm(b.name)));
  const rows=found.map(p=>{
    const ap=S.appts.filter(a=>a.patientId===p.id);
    const next=ap.filter(a=>a.date>=TODAY&&!['cancelada','ausencia'].includes(a.status)).sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start)[0];
    return `<button class="prow" data-act="openPatient" data-id="${p.id}"><span class="av" style="${avStyle(p)}">${esc(initials(p.name))}</span><span class="pm"><b>${esc(p.name)}</b><span>${pc(p)} · ${esc(SV(p.service).name)} · ${esc(p.modal)}</span></span><span class="pn"><small>Próxima cita</small>${next?`${fDs(next.date)} · ${hm(next.start)}`:'—'}</span><span class="pst">${chip(p.status)}${!p.consent?'<span class="chip warn">Sin consentimiento</span>':''}</span></button>`}).join('');
  return `<div class="muted small" id="pcount" style="padding:0 6px">${found.length} ${found.length===1?'paciente':'pacientes'}${q?' · resultado de la búsqueda':''}</div>${rows||'<div class="panel empty">No hay pacientes con ese criterio.</div>'}`;
}
VIEWS.pacientes=()=>{
  if(S.sel.patient&&P(S.sel.patient))return ficha(P(S.sel.patient));
  const f=S.sel.pf||'todos';
  return `${roleBanner()}<div class="head"><div><div class="eyebrow">Consulta</div><h1>Pacientes</h1><p>${S.patients.filter(p=>p.status!=='alta terapéutica').length} en seguimiento · en calendario e informes aparecen solo por su código de 4 dígitos</p></div><div class="actions"><button class="btn primary" data-act="newPatient">+ Nuevo paciente</button></div></div>
  <div class="toolbar"><label class="search">${SVG(IC.search)}<input type="search" id="pq" placeholder="Buscar por nombre, código, email o teléfono" value="${esc(S.sel.q||'')}" aria-label="Buscar paciente" autocomplete="off"></label>
  <div class="seg">${['todos','activo','nuevo','alta terapéutica'].map(x=>`<button data-act="pfilter" data-f="${x}" aria-pressed="${f===x}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</div></div>
  <div class="plist" id="plist">${patientList()}</div>`;
};
