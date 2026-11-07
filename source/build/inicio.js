VIEWS.inicio=()=>{
  const mon=mondayOf(TODAY);const days=Array.from({length:5},(_,i)=>addDays(mon,i));
  const hd=S.sel.homeDay||TODAY;const list=apptsOn(hd);const isPsi=S.role==='psicologa';
  const T=todos();const nm=nowMin();
  const next=apptsOn(TODAY).find(a=>a.start+a.dur>nm&&!['cancelada','realizada','ausencia'].includes(a.status));
  const nToday=apptsOn(TODAY).filter(a=>a.status!=='cancelada').length;
  const nConf=S.appts.filter(a=>a.status==='pendiente'&&a.date>=TODAY).length;
  const h=new Date().getHours();const hi=h<13?'Buenos días':h<20?'Buenas tardes':'Buenas noches';
  const who=isPsi?', '+S.pro.name.split(' ')[0]:'';
  return `${roleBanner()}
  <section class="hero"><div><div class="eyebrow">${fDl(TODAY)}</div><h1>${hi}${esc(who)}</h1><p>${nToday} ${nToday===1?'sesión':'sesiones'} hoy${next?` · la próxima a las ${hm(next.start)} (#${P(next.patientId).code})`:''}</p>
    <div class="hero-stats"><div class="hs"><b>${nToday}</b><span>Hoy</span></div><div class="hs"><b>${nConf}</b><span>Por confirmar</span></div><div class="hs"><b>${T.reduce((a,t)=>a+t.n,0)}</b><span>Pendientes</span></div></div></div>
    <div class="actions">${bellBtn()}<button class="btn" data-act="newPatient">+ Paciente</button><button class="btn primary" data-act="newAppt">+ Nueva cita</button></div></section>
  <div class="grid3">
    <div class="stack hide-m" style="gap:14px">${weekGrid(days,40)}
      <div class="legend"><span><i style="background:var(--sky-mid)"></i>Confirmada</span><span><i style="background:var(--warn-soft);box-shadow:inset 0 0 0 1.5px #f5c27a"></i>Por confirmar</span><span><i style="background:var(--ok-soft)"></i>Realizada</span><span><i style="background:var(--bad-soft)"></i>Ausencia</span><span><i style="background:var(--tint-2)"></i>Fuera de horario</span></div>
    </div>
    <div class="stack" style="gap:22px">
      <section class="panel"><header><h2>Pendiente</h2><span class="muted small">${T.reduce((a,t)=>a+t.n,0)} tareas</span></header>
        <div class="stack" style="gap:2px">${T.length?T.map(t=>`<button class="todo ${t.cls}" data-act="${t.act}" data-id="${t.id||''}" data-f="${t.f||''}" data-tab="${t.tab||''}"><span class="ic">${SVG(t.ic)}</span><span class="tx"><b>${t.t}</b><span>${esc(t.d)}</span></span><span class="n">${t.n}</span></button>`).join(''):'<div class="empty">Todo al día.</div>'}</div></section>
      <section class="panel"><header><h2>${hd===TODAY?'Hoy':fDl(hd)}</h2></header>
        <div class="daystrip">${days.map(d=>`<button data-act="homeDay" data-d="${d}" aria-pressed="${d===hd}">${DAYN[dow(d)].slice(0,3)}<b>${parse(d).getDate()}</b><i>${apptsOn(d).filter(a=>a.status!=='cancelada').length} citas</i></button>`).join('')}</div>
        <div class="list">${list.length?list.map(a=>{const p=P(a.patientId);const n=noteFor(a);return `<div class="row"><div class="t">${hm(a.start)}</div><div class="m"><b>${pc(p)} <span style="font-weight:500;color:var(--muted)">${esc(SV(a.service).name)}</span></b><span>${a.dur} min · ${esc(a.modal)}</span></div>
          ${['confirmada','pendiente'].includes(a.status)&&a.date<=TODAY?`<button class="btn sm" data-act="done" data-id="${a.id}">Realizada</button>`:chip(a.status)}
          ${a.status==='realizada'&&isPsi&&(!n||n.status==='borrador')?`<button class="btn sm" data-act="note" data-id="${a.id}">${n?'Firmar':'Nota'}</button>`:''}</div>`}).join(''):'<div class="empty">Sin citas este día.</div>'}</div>
      </section>
    </div>
  </div>`;
};
