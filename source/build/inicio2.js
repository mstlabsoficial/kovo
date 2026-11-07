VIEWS.inicio=()=>{
  const isPsi=S.role==='psicologa';const nm=nowMin();
  const T=todos();const nT=T.reduce((a,t)=>a+t.n,0);
  const mon=mondayOf(TODAY);const days=Array.from({length:5},(_,i)=>addDays(mon,i));
  const today=apptsOn(TODAY).filter(a=>a.status!=='cancelada');
  const nextIdx=today.findIndex(a=>a.start+a.dur>nm&&['confirmada','pendiente'].includes(a.status));
  const focus=nextIdx>=0?nextIdx:Math.max(0,today.length-1);
  const next=today[nextIdx];
  const up=S.appts.filter(a=>['confirmada','pendiente'].includes(a.status)&&a.date>TODAY).sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start).slice(0,5);
  const h=new Date().getHours();const hi=h<13?'Buenos días':h<20?'Buenas tardes':'Buenas noches';
  const who=isPsi?', '+S.pro.name.split(' ')[0]:'';
  const rel=d=>d===addDays(TODAY,1)?'Mañana':fDs(d);
  const card=(a,i)=>{
    const p=P(a.patientId);const n=noteFor(a);const ended=a.start+a.dur<=nm;const open=['confirmada','pendiente'].includes(a.status);const inProg=open&&a.start<=nm&&!ended;
    const lbl=a.status==='realizada'?'Realizada':a.status==='ausencia'?'Ausencia':inProg?'En curso':i===nextIdx?'Siguiente sesión':ended?'Terminada · sin cerrar':'Programada';
    const live=inProg||i===nextIdx;
    let main='';
    if(open&&ended)main=isPsi?`<button class="btn primary" data-act="fillNote" data-id="${a.id}">Cerrar y rellenar informe</button>`:`<button class="btn primary" data-act="done" data-id="${a.id}">Marcar realizada</button>`;
    else if(a.status==='pendiente')main=`<button class="btn primary" data-act="confirm" data-id="${a.id}">Confirmar</button>`;
    else if(a.status==='realizada'&&isPsi&&(!n||n.status==='borrador'))main=`<button class="btn primary" data-act="fillNote" data-id="${a.id}">${n?'Terminar informe':'Rellenar informe'}</button>`;
    return `<article class="next ${['realizada','ausencia'].includes(a.status)?'done':''}" ${i===focus?'data-focus="1"':''}>
      <div class="nl">${live?'<span class="live"></span>':''}${lbl}<span class="ncount">${i+1} / ${today.length}</span></div>
      <div class="nt">${hm(a.start)} – ${hm(a.start+a.dur)}</div>
      <div class="ncode"><span class="pc big">#${p.code}</span>${a.status==='pendiente'?'<span class="nflag">Sin confirmar</span>':''}</div>
      <div class="ns">${esc(SV(a.service).name)} · ${esc(a.modal)}<br>${esc(a.loc)}${a.notes?' · '+esc(a.notes):''}</div>
      <div class="na"><button class="btn" data-act="openPatient" data-id="${p.id}">Ficha</button><button class="btn" data-act="openAppt" data-id="${a.id}">Detalles</button>${main}</div></article>`;
  };
  const reps=today.filter(a=>a.status!=='ausencia');
  const repRow=a=>{const n=noteFor(a);const ended=a.start+a.dur<=nm;let act;
    if(n&&n.status==='firmada')act=`<span class="chip ok">Firmado</span><button class="btn sm ghost" data-act="openNote" data-id="${n.id}">Ver</button>`;
    else if(n)act=`<span class="chip warn">Borrador</span><button class="btn sm primary" data-act="fillNote" data-id="${a.id}">Continuar</button>`;
    else if(ended||a.status==='realizada')act=`<button class="btn sm primary" data-act="fillNote" data-id="${a.id}">Rellenar informe</button>`;
    else act=`<span class="muted small">Disponible a las ${hm(a.start+a.dur)}</span>`;
    return `<div class="row"><div class="t">${hm(a.start)}</div><div class="m"><b>${pc(P(a.patientId))} ${esc(SV(a.service).name)}</b><span>${a.type||''}${NOTE_T[a.service==='s3'?'inicial':'sesion']}</span></div>${act}</div>`};
  const toFill=reps.filter(a=>{const n=noteFor(a);return !(n&&n.status==='firmada')}).length;
  return `${roleBanner()}
  <div class="head"><div><div class="eyebrow">${fDl(TODAY)}</div><h1>${hi}${esc(who)}</h1><p class="today-count">Hoy tienes <b>${today.length}</b> ${today.length===1?'cita':'citas'}${next?` · la siguiente a las ${hm(next.start)}`:''}</p></div>
  <div class="actions"><button class="btn" data-act="newPatient">${SVG(IC.user)}Nuevo paciente</button><button class="btn primary" data-act="newAppt">${SVG(IC.cal)}Nueva cita</button></div></div>
  <div class="home">
    <div class="home-side">
      <section class="car-wrap"><div class="car-h"><h2>Citas de hoy</h2><div class="car-nav"><button class="btn sm" data-act="carMove" data-n="-1" aria-label="Cita anterior">‹</button><button class="btn sm" data-act="carMove" data-n="1" aria-label="Cita siguiente">›</button></div></div>
        <div class="car" id="car">${today.length?today.map(card).join(''):`<article class="next" data-focus="1"><div class="nl">Hoy</div><div class="nt">Sin citas</div><div class="ns">Tienes el día libre en la agenda.</div><div class="na"><button class="btn primary" data-act="newAppt">Nueva cita</button></div></article>`}</div>
        ${today.length>1?`<div class="car-dots" id="cardots">${today.map(()=>'<i></i>').join('')}</div>`:''}</section>
      <section class="panel"><header><h2>Notificaciones pendientes</h2><span class="muted small">${nT?nT+' tareas':'Todo al día'}</span></header>
        <div class="list">${T.length?T.map(t=>`<button class="todo ${t.cls}" data-act="${t.act}" data-id="${t.id||''}" data-f="${t.f||''}" data-tab="${t.tab||''}"><span class="ic">${SVG(t.ic)}</span><span class="tx"><b>${t.t}</b><span>${esc(t.d)}</span></span><span class="n">${t.n}</span></button>`).join(''):'<div class="empty">Nada pendiente.</div>'}</div></section>
      ${isPsi?`<section class="panel"><header><h2>Informes de hoy</h2><span class="muted small">${toFill?toFill+' por rellenar':'Todo firmado'}</span></header>
        <p class="muted small" style="margin:-6px 0 8px">Al terminar cada sesión puedes cerrar la cita y escribir el informe desde aquí.</p>
        <div class="list">${reps.length?reps.map(repRow).join(''):'<div class="empty">Hoy no hay sesiones con informe.</div>'}</div></section>`:''}
    </div>
    <aside class="home-side">
      <section class="panel"><header><h2>Semana</h2><button class="card-link" data-act="goCal">Abrir calendario</button></header>${weekMap(days,{compact:true})}</section>
      <section class="panel"><header><h2>Próximos días</h2><button class="card-link" data-act="goCal">Ver agenda</button></header>
        <div class="list">${up.length?up.map(a=>`<div class="row" data-act="openAppt" data-id="${a.id}"><div class="m"><b>${pc(P(a.patientId))} ${esc(SV(a.service).name)}</b><span>${rel(a.date)} · ${hm(a.start)}</span></div>${a.status==='pendiente'?chip('pendiente'):''}</div>`).join(''):'<div class="empty">Sin sesiones programadas.</div>'}</div></section>
    </aside>
  </div>`;
};
function carStep(c){const k=c.children;return k.length>1?k[1].offsetLeft-k[0].offsetLeft:c.clientWidth}
function initCarousel(){
  const c=document.getElementById('car');if(!c)return;
  const f=c.querySelector('[data-focus]');if(f)c.scrollLeft=f.offsetLeft-c.children[0].offsetLeft;
  const dots=[...document.querySelectorAll('#cardots i')];
  const sync=()=>{const i=Math.round(c.scrollLeft/carStep(c));dots.forEach((d,k)=>d.classList.toggle('on',k===i))};sync();
  c.addEventListener('scroll',()=>requestAnimationFrame(sync),{passive:true});
  c.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='mouse'||e.button!==0)return;
    const sx=e.clientX,sl=c.scrollLeft;let moved=false;
    const mv=ev=>{const dx=ev.clientX-sx;if(!moved&&Math.abs(dx)>6){moved=true;c.classList.add('dragging')}if(moved)c.scrollLeft=sl-dx};
    const upH=()=>{document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',upH);
      if(moved){c.classList.remove('dragging');const s=carStep(c);c.scrollTo({left:Math.round(c.scrollLeft/s)*s,behavior:'smooth'});c.dataset.dragged='1';setTimeout(()=>delete c.dataset.dragged,60)}};
    document.addEventListener('pointermove',mv);document.addEventListener('pointerup',upH)});
  c.addEventListener('click',e=>{if(c.dataset.dragged){e.stopPropagation();e.preventDefault()}},true);
}
