  return `${roleBanner()}<div><button class="btn sm ghost" data-act="backPatients">‹ Pacientes</button></div>
  <section class="fhead"><span class="av" style="${avStyle(p)}">${esc(initials(p.name))}</span>
    <div><div class="eyebrow">Ficha de paciente</div><h1>${esc(p.name)}</h1>
    <div class="fmeta"><span class="pc big">#${p.code}</span>${chip(p.status)}${!p.consent?'<span class="chip warn">Sin consentimiento</span>':''}</div>
    <div class="fstats"><div><b>${done}</b><span>Sesiones</span></div><div><b>${fD(p.alta)}</b><span>Alta</span></div><div><b>${nextA?fDs(nextA.date)+' · '+hm(nextA.start):'—'}</b><span>Próxima cita</span></div></div></div>
    <div class="actions"><button class="btn primary" data-act="newAppt" data-p="${p.id}">+ Cita</button>${isPsi?`<button class="btn" data-act="newDoc" data-t="evolucion" data-p="${p.id}">+ Informe</button>`:''}</div></section>
  <div class="tabs" role="tablist">${[['resumen','Resumen'],['clinico','Expediente clínico'],['facturas','Facturas'],['docs','Documentos']].map(([k,l])=>`<button role="tab" aria-selected="${tab===k}" data-act="ptab" data-t="${k}">${l}${k==='docs'&&!p.consent?' <span class="chip warn">1</span>':''}</button>`).join('')}</div>${content}`;
