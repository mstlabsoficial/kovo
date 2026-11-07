VIEWS.calendario=()=>{
  const c=S.cal;const mob=isMob();const mode=(mob&&c.mode==='semana')?'dia':c.mode;let label,body;
  if(mode==='mes'){
    const d=parse(c.date);const first=iso(new Date(d.getFullYear(),d.getMonth(),1));const start=mondayOf(first);
    label=d.toLocaleDateString('es-ES',{month:'long',year:'numeric'});
    let cells='';for(let i=0;i<42;i++){const day=addDays(start,i);const list=apptsOn(day);
      cells+=`<div class="dc ${ym(day)!==ym(first)?'out':''} ${day===TODAY?'today':''}" data-act="pickDay" data-d="${day}"><span class="d">${parse(day).getDate()}</span>${list.slice(0,3).map(a=>`<span class="mi ${a.status}">${hm(a.start)} #${P(a.patientId).code}</span>`).join('')}${list.length>3?`<span class="mi">+${list.length-3}</span>`:''}</div>`}
    body=`<div class="month">${['L','M','X','J','V','S','D'].map(x=>`<div class="dh">${x}</div>`).join('')}${cells}</div>`;
  }else if(mob){
    const mon=mondayOf(c.date);const wk=Array.from({length:7},(_,i)=>addDays(mon,i)).filter((d,i)=>i<6||(AVAIL[6]||[]).length||apptsOn(d).length);
    label=fDl(c.date);
    body=`<div class="daystrip" style="--n:${wk.length}">${wk.map(d=>`<button data-act="pickCalDay" data-d="${d}" aria-pressed="${d===c.date}">${DAYN[dow(d)].slice(0,3)}<b>${parse(d).getDate()}</b><i>${apptsOn(d).filter(a=>a.status!=='cancelada').length}</i></button>`).join('')}</div>${weekGrid([c.date],46)}`;
  }else{
    const mon=mondayOf(c.date);const n=mode==='dia'?1:((AVAIL[6]||[]).length||apptsOn(addDays(mon,6)).length?7:6);
    const days=mode==='dia'?[c.date]:Array.from({length:n},(_,i)=>addDays(mon,i));
    label=mode==='dia'?fDl(c.date):`${fD(days[0])} – ${fD(days[days.length-1])}`;
    body=weekGrid(days,46);
  }
  const pend=S.appts.filter(a=>a.status==='pendiente'&&a.date>=TODAY).sort((a,b)=>a.date.localeCompare(b.date));
  const modes=mob?['dia','mes']:['dia','semana','mes'];
  return `<div class="head"><div><div class="eyebrow">Agenda</div><h1>Calendario</h1><p style="text-transform:capitalize">${label}</p></div>
    <div class="actions"><button class="btn" data-act="calNav" data-n="-1" aria-label="Anterior">‹</button><button class="btn" data-act="calToday">Hoy</button><button class="btn" data-act="calNav" data-n="1" aria-label="Siguiente">›</button>
    <div class="seg" role="group" aria-label="Vista">${modes.map(m=>`<button data-act="calMode" data-m="${m}" aria-pressed="${mode===m}">${m==='dia'?'Día':m[0].toUpperCase()+m.slice(1)}</button>`).join('')}</div>
    <button class="btn primary" data-act="newAppt">+ Nueva cita</button></div></div>
  ${body}
  <div class="legend"><span><i style="background:var(--sky-mid)"></i>Confirmada</span><span><i style="background:var(--warn-soft);box-shadow:inset 0 0 0 1.5px #f5c27a"></i>Por confirmar</span><span><i style="background:var(--ok-soft)"></i>Realizada</span><span><i style="background:var(--bad-soft)"></i>Ausencia</span><span>Pulsa un hueco libre para crear una cita. Los pacientes aparecen por su código.</span></div>
  ${pend.length?`<section class="panel"><header><h2>Por confirmar</h2></header><div class="list">${pend.map(a=>`<div class="row"><div class="m"><b>${pc(P(a.patientId))}</b><span>${fDs(a.date)} · ${hm(a.start)} · ${esc(SV(a.service).name)}</span></div><button class="btn sm" data-act="confirm" data-id="${a.id}">Confirmar</button><button class="btn sm" data-act="openAppt" data-id="${a.id}">Abrir</button></div>`).join('')}</div></section>`:''}`;
};
