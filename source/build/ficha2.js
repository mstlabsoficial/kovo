function ficha(p){
  const tab=S.sel.ptab||'resumen';const isPsi=S.role==='psicologa';
  const ap=S.appts.filter(a=>a.patientId===p.id).sort((a,b)=>b.date.localeCompare(a.date)||b.start-a.start);
  const inv=S.invoices.filter(i=>i.patientId===p.id).sort((a,b)=>b.date.localeCompare(a.date));
  const notes=S.notes.filter(n=>n.patientId===p.id).sort((a,b)=>b.created.localeCompare(a.created));
  const done=ap.filter(a=>a.status==='realizada').length;
  const nextA=ap.filter(a=>a.date>=TODAY&&!['cancelada','ausencia'].includes(a.status)).sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start)[0];
  const locked=()=>`<div class="panel lock">${SVG(IC.lock)}<b>Acceso restringido</b><span>El expediente clínico solo es visible para profesionales autorizados.</span></div>`;
  const noteTbl=(list,empty,cols)=>`<section class="panel flush"><div class="tbl-wrap"><table><thead><tr><th>Fecha</th><th>Documento</th><th>Autoría</th><th>Versiones</th><th>Estado</th></tr></thead><tbody>${list.map(n=>`<tr class="click" data-act="openNote" data-id="${n.id}"><td>${fD(n.created)}</td><td>${NOTE_T[n.type]}</td><td>${esc(n.author)}</td><td class="num">${1+n.versions.length}</td><td>${chip(n.status)}</td></tr>`).join('')||`<tr><td colspan="5" class="empty">${empty}</td></tr>`}</tbody></table></div></section>`;
  let content='';
  if(tab==='resumen'){
    const ev=[{d:p.alta,c:'',t:'Alta en la consulta'}];
    if(p.consent)ev.push({d:p.consent.at,c:'',t:'Consentimiento informado subido'});
    ap.forEach(a=>ev.push({d:a.date,c:a.status==='ausencia'?'bad':'',t:`${a.date>TODAY?'Cita programada':'Cita'} · ${SV(a.service).name} · ${hm(a.start)} · ${a.status}`,id:a.id,act:'openAppt'}));
    if(isPsi)notes.forEach(n=>ev.push({d:n.created,c:'clin',t:`${NOTE_T[n.type]} · ${n.status}`,id:n.id,act:'openNote'}));
    inv.forEach(i=>ev.push({d:i.date,c:'fac',t:`Factura ${i.num||'(borrador)'} · ${eur(tot(i).total)} · ${invStatus(i)}`,id:i.id,act:'openInv'}));
    ev.sort((a,b)=>b.d.localeCompare(a.d));
    content=`<div class="grid3"><section class="panel"><header><h2>Línea temporal</h2><span class="muted small">Navegación rápida</span></header><div class="timeline">${ev.slice(0,40).map(e=>`<div class="ev"><span class="dt">${fD(e.d)}</span><span class="dot ${e.c}"></span><span class="tx">${e.act?`<a href="#" data-act="${e.act}" data-id="${e.id}">${esc(e.t)}</a>`:esc(e.t)}</span></div>`).join('')}</div></section>
    <section class="panel"><header><h2>Información personal</h2><div class="actions"><button class="btn sm" data-act="editPatient" data-id="${p.id}">Editar</button></div></header><dl class="dl">
      <dt>Nombre</dt><dd><b>${esc(p.name)}</b></dd><dt>Código</dt><dd>${pc(p)}</dd><dt>Email</dt><dd><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></dd><dt>Teléfono</dt><dd><a href="tel:${esc(p.phone)}">${esc(p.phone)}</a></dd>
      <dt>NIF / CIF</dt><dd>${esc(p.billing.nif||'—')}</dd><dt>Dirección</dt><dd>${esc(p.billing.addr||'—')}</dd>
      <dt>Alta</dt><dd>${fD(p.alta)}</dd><dt>Servicio habitual</dt><dd>${esc(SV(p.service).name)}</dd><dt>Modalidad</dt><dd>${esc(p.modal)}</dd>
      <dt>Facturar a</dt><dd>${p.billing.type==='empresa'?`${esc(p.billing.name)}<br><span class="muted">retención IRPF ${p.billing.ret}%</span>`:'El propio paciente'}</dd>
      <dt>Recordatorios</dt><dd>${p.reminders?'Activados':'Desactivados'}</dd><dt>Consentimiento</dt><dd>${p.consent?`Subido el ${fD(p.consent.at)}`:`<a href="#" data-act="ptab" data-t="docs" style="color:var(--warn-ink);font-weight:600">Pendiente de subir</a>`}</dd></dl>
      <p class="muted small" style="margin:14px 0 0">Estos datos solo los ven psicóloga y recepción. En calendario, informes y contabilidad el paciente aparece únicamente por su código.</p></section></div>`;
  }else if(tab==='sesiones')content=!isPsi?locked():noteTbl(notes.filter(n=>n.type==='sesion'),'Sin notas de sesión todavía.');
  else if(tab==='clinico')content=!isPsi?locked():`<div class="actions"><button class="btn sm" data-act="newDoc" data-t="inicial" data-p="${p.id}">${SVG(IC.plus)}Evaluación inicial</button><button class="btn sm" data-act="newDoc" data-t="cierre" data-p="${p.id}">${SVG(IC.plus)}Informe de cierre</button></div>${noteTbl(notes.filter(n=>n.type==='inicial'||n.type==='cierre'),'Sin informes clínicos todavía.')}`;
  else if(tab==='seguimiento')content=!isPsi?locked():`<div class="actions"><button class="btn sm primary" data-act="newDoc" data-t="evolucion" data-p="${p.id}">${SVG(IC.plus)}Informe de seguimiento</button></div>${noteTbl(notes.filter(n=>n.type==='evolucion'),'Sin informes de seguimiento todavía.')}`;
  else if(tab==='evolucion'){
    const ms=monthsBack(6);const by=Object.fromEntries(ms.map(k=>[k,0]));ap.filter(a=>a.status==='realizada').forEach(a=>{if(a.date.slice(0,7) in by)by[a.date.slice(0,7)]++});
    const mx=Math.max(1,...Object.values(by));const att=ap.filter(a=>a.date<=TODAY&&['realizada','ausencia','cancelada'].includes(a.status));const rate=att.length?Math.round(att.filter(a=>a.status==='realizada').length/att.length*100):null;
    const objs=isPsi?notes.filter(n=>n.fields&&n.fields.objetivos).slice(0,6):[];
    content=`<div class="grid2"><section class="panel"><header><h2>Sesiones por mes</h2><span class="muted small">Últimos 6 meses</span></header><div class="hbar" style="grid-template-columns:60px minmax(0,1fr) 28px">${ms.map(k=>`<span style="text-transform:capitalize">${monthName(k)}</span><span class="b"><i style="width:${by[k]/mx*100}%"></i></span><span class="num">${by[k]}</span>`).join('')}</div>
      <dl class="dl" style="margin-top:16px"><dt>Sesiones realizadas</dt><dd class="num">${done}</dd><dt>Asistencia</dt><dd class="num">${rate==null?'—':rate+' %'}</dd><dt>En tratamiento desde</dt><dd>${fD(p.alta)}</dd></dl></section>
      <section class="panel"><header><h2>Objetivos trabajados</h2></header>${!isPsi?`<div class="empty">Contenido clínico restringido.</div>`:`<div class="timeline">${objs.map(n=>`<div class="ev"><span class="dt">${fD(n.created)}</span><span class="dot clin"></span><span class="tx">${esc(n.fields.objetivos)}</span></div>`).join('')||'<div class="empty">Aún no hay objetivos registrados.</div>'}</div>`}</section></div>`;
  }else if(tab==='citas'){
    content=`<section class="panel flush"><div class="tbl-wrap"><table><thead><tr><th>Fecha</th><th>Hora</th><th>Servicio</th><th>Modalidad</th><th>Estado</th></tr></thead><tbody>${ap.map(a=>`<tr class="click" data-act="openAppt" data-id="${a.id}"><td>${fDs(a.date)}</td><td class="num">${hm(a.start)}</td><td>${esc(SV(a.service).name)}</td><td>${esc(a.modal)}</td><td>${chip(a.status)}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">Sin citas.</td></tr>'}</tbody></table></div></section>`;
  }else if(tab==='facturas'){
    content=`<section class="panel flush"><div class="tbl-wrap"><table><thead><tr><th>Número</th><th>Fecha</th><th class="r">Total</th><th class="r">Pendiente</th><th>Estado</th></tr></thead><tbody>${inv.map(i=>`<tr class="click" data-act="openInv" data-id="${i.id}"><td class="mono">${i.num||'Borrador'}</td><td>${fD(i.date)}</td><td class="r">${eur(tot(i).total)}</td><td class="r">${eur(Math.max(0,tot(i).pending))}</td><td>${chip(invStatus(i))}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">Sin facturas.</td></tr>'}</tbody></table></div></section>`;
  }else{
    const isImg=u=>u&&/^data:image|\.(png|jpe?g|webp)$|image/i.test(u);
    content=`<section class="panel"><header><h2>Consentimiento informado</h2>${p.consent?chip('firmada'):'<span class="chip warn">Pendiente</span>'}</header>
      ${p.consent?`<div class="row"><span class="thumb">${p.consent.url&&isImg(p.consent.url)?`<img src="${esc(p.consent.url)}" alt="" class="thumb">`:SVG(IC.doc)}</span><div class="m"><b>${esc(p.consent.file)}</b><span>Subido el ${fD(p.consent.at)} · almacenamiento privado</span></div><label class="btn sm">Sustituir<input type="file" hidden accept="application/pdf,image/*" data-up="consent" data-p="${p.id}"></label></div>
      ${p.consent.url&&isImg(p.consent.url)?`<img class="preview" src="${esc(p.consent.url)}" alt="Consentimiento firmado">`:''}`:
      `<div class="drop">${SVG(IC.upload)}<b>Sube el consentimiento firmado</b><span class="muted small">PDF o foto. Desde el móvil puedes hacer la foto directamente.</span>
      <div class="actions" style="justify-content:center"><label class="btn primary">${SVG(IC.cam)}Hacer foto<input type="file" hidden accept="image/*" capture="environment" data-up="consent" data-p="${p.id}"></label><label class="btn">${SVG(IC.upload)}Elegir archivo<input type="file" hidden accept="application/pdf,image/*" data-up="consent" data-p="${p.id}"></label></div></div>`}
    </section>
    <section class="panel"><header><h2>Documentación adjunta</h2><label class="btn sm">${SVG(IC.upload)}Adjuntar<input type="file" hidden accept="application/pdf,image/*" data-up="doc" data-p="${p.id}"></label></header><div class="list">
      ${(p.docs||[]).map(d=>`<div class="row"><span class="thumb">${SVG(IC.doc)}</span><div class="m"><b>${esc(d.name)}</b><span>Subido el ${fD(d.at)}</span></div></div>`).join('')||'<div class="empty">Sin documentos adicionales.</div>'}
    </div></section>`;
  }
  const TABS=[['resumen','Resumen'],['sesiones','Historial de sesiones'],['clinico','Informes clínicos'],['seguimiento','Seguimiento'],['evolucion','Evolución'],['citas','Citas'],['facturas','Facturas'],['docs','Documentación']];
  return `${roleBanner()}<div><button class="btn sm ghost" data-act="backPatients">‹ Pacientes</button></div>
  <section class="fhead"><span class="av">${esc(initials(p.name))}</span>
    <div><div class="eyebrow">Ficha de paciente</div><h1>${esc(p.name)}</h1>
    <div class="fmeta"><span class="pc big">#${p.code}</span>${chip(p.status)}${!p.consent?'<span class="chip warn">Sin consentimiento</span>':''}</div>
    <div class="fstats"><div><b>${done}</b><span>Sesiones</span></div><div><b>${fD(p.alta)}</b><span>Alta</span></div><div><b>${nextA?fDs(nextA.date)+' · '+hm(nextA.start):'—'}</b><span>Próxima cita</span></div></div></div>
    <div class="actions"><button class="btn primary" data-act="newAppt" data-p="${p.id}">${SVG(IC.plus)}Cita</button>${isPsi?`<button class="btn" data-act="newDoc" data-t="evolucion" data-p="${p.id}">${SVG(IC.plus)}Informe</button>`:''}</div></section>
  <div class="tabs" role="tablist">${TABS.map(([k,l])=>`<button role="tab" aria-selected="${tab===k}" data-act="ptab" data-t="${k}">${l}${k==='docs'&&!p.consent?' <span class="chip warn">1</span>':''}</button>`).join('')}</div>${content}`;
}

