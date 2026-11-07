/* informes */
const TEMPLATES={
  sesion:[['Sesión de seguimiento',{objetivos:'Objetivos revisados:\n- ',resumen:'Se revisan las tareas acordadas y se trabaja sobre:\n',intervenciones:'Técnicas aplicadas:\n- ',observaciones:'Evolución respecto a la sesión anterior:\n',acuerdos:'Tareas para el paciente:\n- ',plan:'Próxima sesión:\n'}],['Formato SOAP',{resumen:'S (subjetivo):\n\nO (objetivo):\n\nA (valoración):\n\nP (plan):\n'}]],
  inicial:[['Primera entrevista',{motivo:'Motivo de consulta expresado por el paciente:\n',antecedentes:'Antecedentes personales, familiares y de tratamiento:\n',evaluacion:'Instrumentos y entrevista realizados:\n',formulacion:'Hipótesis de trabajo:\n',objetivos:'1. \n2. \n3. ',plan:'Frecuencia, duración estimada y técnicas previstas:\n'}]],
  evolucion:[['Revisión periódica',{objetivos:'Estado de cada objetivo terapéutico:\n- ',cambios:'Cambios observados por el paciente y por el profesional:\n',valoracion:'Valoración profesional:\n',plan:'Ajustes al plan y próximos pasos:\n'}]],
  cierre:[['Cierre de proceso',{motivo:'Motivo del cierre:\n',trabajo:'Resumen del trabajo realizado:\n',logros:'Objetivos alcanzados:\n- \nObjetivos pendientes:\n- ',recomendaciones:'Recomendaciones y pautas de mantenimiento:\n'}]]
};
function nlog(n,what){(n.log=n.log||[]).push({at:new Date().toISOString(),who:'Laura Benítez',what})}
function editorView(n){
  const p=P(n.patientId);const locked=n.status==='firmada';const fs=FIELDS[n.type];
  const a=n.apptId?S.appts.find(x=>x.id===n.apptId):null;
  const prev=S.notes.filter(x=>x.patientId===n.patientId&&x.id!==n.id&&x.status==='firmada'&&x.created<=n.created).sort((x,y)=>y.created.localeCompare(x.created))[0];
  const hist=[{at:n.created,w:'Documento creado'}].concat((n.log||[]).map(l=>({at:l.at.slice(0,10),w:l.what})),n.versions.map(v=>({at:v.at.slice(0,10),w:`Rectificación · ${v.author}`})));
  return `<div class="ed-bar"><button class="btn sm ghost" data-act="closeEditor">‹ Informes</button><div class="actions">${chip(n.status)}${locked?`<button class="btn primary" data-act="rectNote" data-id="${n.id}">Guardar rectificación</button>`:`<button class="btn" data-act="saveNote" data-id="${n.id}">Guardar borrador</button><button class="btn primary" data-act="signNote" data-id="${n.id}">${SVG(IC.sign)}Firmar y cerrar</button>`}</div></div>
  <div class="ed-grid">
    <article class="doc"><div class="doc-head"><div class="eyebrow">${NOTE_T[n.type]}</div><h1>${a?`Sesión del ${fD(a.date)}`:`Documento del ${fD(n.created)}`}</h1><div class="fmeta"><span class="pc big">#${p.code}</span><span class="muted small">${esc(n.author)}${locked?` · firmado el ${fD(n.signedAt)}`:' · borrador'}</span></div></div>
    ${prev&&!locked?`<details><summary class="muted small" style="cursor:pointer">Plan de la nota anterior (${fD(prev.created)})</summary><p style="margin:8px 0 0">${esc(prev.fields.plan||'—')}</p></details>`:''}
    ${fs.map(([k,l])=>`<label class="field"><span>${l}</span>${locked?`<div class="ro">${esc(n.fields[k]||'—')}</div>`:`<textarea id="nf-${k}" data-nf="${k}" placeholder="Escribe aquí…">${esc(n.fields[k]||'')}</textarea>`}</label>`).join('')}
    ${n.versions.length?`<section><h3 style="margin-bottom:8px">Rectificaciones</h3><div class="timeline">${n.versions.map(v=>`<div class="ev"><span class="dt">${fD(v.at.slice(0,10))}</span><span class="dot clin"></span><span class="tx"><b>${esc(v.author)}</b>: ${esc(v.text)}</span></div>`).join('')}</div></section>`:''}
    ${locked?`<label class="field"><span>Añadir rectificación · el contenido original se conserva</span><textarea id="nf-rect" placeholder="Describe la corrección…"></textarea></label>`:''}
    </article>
    <aside class="ed-side">
      <section class="panel"><header><h2>Detalles</h2></header><dl class="dl"><dt>Tipo</dt><dd>${NOTE_T[n.type]}</dd><dt>Paciente</dt><dd>${pc(p)} <a href="#" data-act="openPatient" data-id="${p.id}">Ver ficha</a></dd><dt>Creado</dt><dd>${fD(n.created)}</dd><dt>Versiones</dt><dd class="num">${1+n.versions.length}</dd></dl></section>
      ${locked?'':`<section class="panel"><header><h2>Plantillas</h2></header><div class="tpl">${(TEMPLATES[n.type]||[]).map(([t],i)=>`<button class="btn sm" data-act="applyTpl" data-i="${i}">${SVG(IC.doc)}${t}</button>`).join('')}</div><p class="muted small" style="margin:10px 0 0">Rellena solo los apartados vacíos.</p></section>`}
      <section class="panel"><header><h2>Historial de modificaciones</h2></header><div class="timeline">${hist.map(h=>`<div class="ev" style="grid-template-columns:70px 12px minmax(0,1fr)"><span class="dt">${fD(h.at)}</span><span class="dot mail"></span><span class="tx">${esc(h.w)}</span></div>`).join('')}</div></section>
    </aside>
  </div>`;
}
VIEWS.informes=()=>{
  if(S.sel.editing){const n=S.notes.find(x=>x.id===S.sel.editing);if(n)return editorView(n);S.sel.editing=null}
  const f=S.sel.nf||'pendientes';const pn=pendingNotes();
  let list;
  if(f==='pendientes')list=pn.filter(a=>!noteFor(a)).map(a=>`<tr class="click" data-act="note" data-id="${a.id}"><td>${fD(a.date)}</td><td>${pc(P(a.patientId))}</td><td>${esc(SV(a.service).name)}</td><td><span class="chip warn">Sin nota</span></td></tr>`).join('');
  else{const ns=S.notes.filter(n=>f==='todas'||n.status===f).sort((a,b)=>b.created.localeCompare(a.created)).slice(0,80);
    list=ns.map(n=>`<tr class="click" data-act="openNote" data-id="${n.id}"><td>${fD(n.created)}</td><td>${pc(P(n.patientId))}</td><td>${NOTE_T[n.type]}</td><td>${chip(n.status)}</td></tr>`).join('')}
  return `<div class="head"><div><div class="eyebrow">Documentación clínica</div><h1>Informes clínicos</h1><p>${pn.length} sesiones de los últimos 30 días sin nota firmada</p></div><div class="actions"><button class="btn primary" data-act="newReport">${SVG(IC.plus)}Nuevo informe</button></div></div>
  <div class="box clin">Las notas firmadas no se pueden sobrescribir: las correcciones se añaden como rectificación con autoría y fecha. Ningún contenido clínico se envía por email.</div>
  <div class="toolbar"><div class="seg">${[['pendientes','Sin nota'],['borrador','Por firmar'],['firmada','Firmadas'],['todas','Todas']].map(([k,l])=>`<button data-act="nfilter" data-f="${k}" aria-pressed="${f===k}">${l}</button>`).join('')}</div></div>
  <div class="panel flush"><div class="tbl-wrap"><table><thead><tr><th>Fecha</th><th>Paciente</th><th>${f==='pendientes'?'Servicio':'Documento'}</th><th>Estado</th></tr></thead><tbody>${list||'<tr><td colspan="4" class="empty">Nada pendiente en este apartado.</td></tr>'}</tbody></table></div></div>`;
};
VIEWS.seguimiento=()=>{
  const f=S.sel.sf||'activo';
  const rows=S.patients.filter(p=>f==='todos'||(f==='activo'?p.status!=='alta terapéutica':p.status===f)).sort((a,b)=>norm(a.name).localeCompare(norm(b.name))).map(p=>{
    const done=S.appts.filter(a=>a.patientId===p.id&&a.status==='realizada').length;
    const evo=S.notes.filter(n=>n.patientId===p.id&&n.type==='evolucion').sort((a,b)=>b.created.localeCompare(a.created))[0];
    const obj=S.notes.filter(n=>n.patientId===p.id&&n.fields.objetivos).sort((a,b)=>b.created.localeCompare(a.created))[0];
    const due=p.status!=='alta terapéutica'&&done>=6&&(!evo||evo.created<addDays(TODAY,-60));
    return `<tr class="click" data-act="openPatient" data-id="${p.id}" data-tab="seguimiento"><td><div style="display:flex;gap:10px;align-items:center"><span class="av sm">${esc(initials(p.name))}</span><span class="pm"><b>${esc(p.name)}</b><span>${pc(p)}</span></span></div></td><td class="num">${done}</td><td>${evo?fD(evo.created):'<span class="muted">Sin informe</span>'}</td><td style="max-width:320px"><div class="muted small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(obj?obj.fields.objetivos:'—')}</div></td><td>${p.status==='alta terapéutica'?chip('alta terapéutica'):due?'<span class="chip warn">Revisión pendiente</span>':'<span class="chip ok">Al día</span>'}</td><td class="r"><button class="btn sm" data-act="newDoc" data-t="evolucion" data-p="${p.id}">${SVG(IC.plus)}Informe</button></td></tr>`}).join('');
  return `<div class="head"><div><div class="eyebrow">Proceso terapéutico</div><h1>Seguimiento terapéutico</h1><p>Evolución de cada paciente e informes de seguimiento. Se sugiere revisión a partir de la sexta sesión.</p></div></div>
  <div class="toolbar"><div class="seg">${[['activo','En seguimiento'],['alta terapéutica','Alta terapéutica'],['todos','Todos']].map(([k,l])=>`<button data-act="sfilter" data-f="${k}" aria-pressed="${f===k}">${l}</button>`).join('')}</div></div>
  <div class="panel flush"><div class="tbl-wrap"><table><thead><tr><th>Paciente</th><th>Sesiones</th><th>Último informe</th><th>Objetivo actual</th><th>Estado</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="6" class="empty">No hay pacientes en este filtro.</td></tr>'}</tbody></table></div></div>`;
};
VIEWS.ayuda=()=>{
  const Q=[['¿Por qué veo códigos de 4 dígitos en el calendario?','Cada paciente tiene un código aleatorio. Así, la agenda, los informes y la contabilidad no muestran nombres a quien no los necesita. En Pacientes puedes buscar por nombre y abrir la ficha completa.'],
    ['¿Cómo creo una cita?','Pulsa «Nueva cita» o haz clic en un hueco libre del calendario. Busca al paciente por nombre o código, elige el servicio y la hora. Si hay solapamiento, la aplicación te avisa.'],
    ['¿Cómo firmo un informe?','Abre el informe desde «Informes clínicos», escribe cada apartado y pulsa «Firmar y cerrar». Una nota firmada no se sobrescribe: las correcciones se guardan como rectificación con autoría y fecha.'],
    ['¿Cómo exporto una factura en PDF?','Abre la factura desde Facturación y pulsa «Exportar PDF». Necesita que el visor permita descargas.'],
    ['¿Puedo cambiar el horario y las tarifas?','Sí. En Ajustes puedes editar servicios y precios, franjas horarias de cada día, datos profesionales y el modo claro u oscuro.'],
    ['¿Dónde se guardan mis datos?','En este prototipo, solo en este navegador y con datos ficticios. Si borras los datos del navegador, se pierden.']];
  return `<div class="head"><div><div class="eyebrow">Centro de ayuda</div><h1>Ayuda y soporte</h1><p>Respuestas rápidas sobre el uso diario de Sesiona.</p></div></div>
  <div class="grid3"><section class="panel"><header><h2>Preguntas frecuentes</h2></header>${Q.map(([q,a])=>`<details class="faq"><summary>${q}</summary><p>${a}</p></details>`).join('')}</section>
  <section class="panel"><header><h2>Contacto</h2></header><dl class="dl"><dt>Email</dt><dd class="mono">soporte@sesiona-ejemplo.es</dd><dt>Horario</dt><dd>Lunes a viernes, 9:00 a 18:00</dd></dl><p class="muted small" style="margin:14px 0 0">Dirección ficticia de ejemplo para el prototipo.</p></section></div>`;
};

