function weekMap(days,o){o=o||{};
  const nm=nowMin();const rows=[];
  for(let h=H0;h<H1;h++){const t=h*60;if(days.some(d=>(AVAIL[dow(d)]||[]).some(([a,b])=>t>=a&&t<b)||apptsOn(d).some(x=>Math.floor(x.start/60)===h&&x.status!=='cancelada')))rows.push(h)}
  const head=days.map(d=>`<div class="wm-day ${d===TODAY?'today':''}"><span>${DAYN[dow(d)].slice(0,3)}</span><b>${parse(d).getDate()}</b></div>`).join('');
  const cells=rows.map(h=>days.map(d=>{
    const t=h*60;const ap=apptsOn(d).filter(x=>Math.floor(x.start/60)===h&&x.status!=='cancelada');
    const inAv=(AVAIL[dow(d)]||[]).some(([a,b])=>t>=a&&t<b);
    const hr=`<span class="wm-hr">${pad(h)}<small>:00</small></span>`;
    if(ap.length){const a=ap[0];return `<button class="wm-c busy ${a.status}" data-act="openAppt" data-id="${a.id}" title="${hm(a.start)} · ${esc(SV(a.service).name)} · ${a.status}">${hr}<span class="wm-p">#${P(a.patientId).code}${ap.length>1?` +${ap.length-1}`:''}</span>${o.compact?'':`<span class="wm-s">${esc(SV(a.service).name)}</span>`}</button>`}
    const past=d<TODAY||(d===TODAY&&t+60<=nm);
    if(inAv&&!past&&S.role!=='gestoria')return `<button class="wm-c free" data-act="slotNew" data-d="${d}" data-t="${t}" aria-label="Crear cita el ${fDs(d)} a las ${pad(h)}:00">${hr}<span class="wm-l">Libre</span></button>`;
    return `<div class="wm-c ${inAv?'free past':'off'}">${hr}</div>`}).join('')).join('');
  return `<div class="wmap ${o.compact?'compact':''}" style="--cols:${days.length}">${head}${cells}</div>`;
}
const MAP_LEGEND=`<div class="legend"><span><i style="background:var(--accent)"></i>Ocupada</span><span><i style="background:var(--accent-soft);box-shadow:inset 0 0 0 1.5px var(--accent)"></i>Por confirmar</span><span><i style="background:#2E4A3E"></i>Realizada</span><span><i style="background:var(--surface);box-shadow:inset 0 0 0 1px var(--line-2)"></i>Libre</span><span><i style="background:var(--tint-2)"></i>Fuera de horario</span></div>`;
VIEWS.calendario=()=>{
  const c=S.cal;const mob=isMob();const mode=c.mode;let label,body;
  const mon=mondayOf(c.date);const nDays=(AVAIL[6]||[]).length||apptsOn(addDays(mon,6)).length?7:((AVAIL[5]||[]).length||apptsOn(addDays(mon,5)).length?6:5);
  const week=Array.from({length:nDays},(_,i)=>addDays(mon,i));
  const cnt=d=>apptsOn(d).filter(a=>a.status!=='cancelada').length;
  let legend=MAP_LEGEND;
  if(mode==='mes'){
    const d=parse(c.date);const first=iso(new Date(d.getFullYear(),d.getMonth(),1));const start=mondayOf(first);
    label=d.toLocaleDateString('es-ES',{month:'long',year:'numeric'});
    let cells='';for(let i=0;i<42;i++){const day=addDays(start,i);const list=apptsOn(day);
      cells+=`<div class="dc ${ym(day)!==ym(first)?'out':''} ${day===TODAY?'today':''}" data-act="pickDay" data-d="${day}"><span class="d">${parse(day).getDate()}</span>${list.slice(0,3).map(a=>`<span class="mi ${a.status}">${hm(a.start)} #${P(a.patientId).code}</span>`).join('')}${list.length>3?`<span class="mi">+${list.length-3}</span>`:''}</div>`}
    body=`<div class="month">${['L','M','X','J','V','S','D'].map(x=>`<div class="dh">${x}</div>`).join('')}${cells}</div>`;
    legend='';
  }else if(mode==='dia'){
    label=fDl(c.date);
    body=`<div class="daystrip" style="--n:${week.length}">${week.map(d=>`<button data-act="pickCalDay" data-d="${d}" aria-pressed="${d===c.date}">${DAYN[dow(d)].slice(0,3)}<b>${parse(d).getDate()}</b><i>${cnt(d)} citas</i></button>`).join('')}</div>${weekGrid([c.date],mob?52:48)}`;
    legend='';
  }else{
    label=`${fD(week[0])} – ${fD(week[week.length-1])}`;
    body=weekMap(week);
  }
  const pend=S.appts.filter(a=>a.status==='pendiente'&&a.date>=TODAY).sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start);
  return `<div class="head"><div><div class="eyebrow">Agenda</div><h1>Calendario</h1><p style="text-transform:capitalize">${label}</p></div>
    <div class="actions"><button class="btn" data-act="calNav" data-n="-1" aria-label="Anterior">‹</button><button class="btn" data-act="calToday">Hoy</button><button class="btn" data-act="calNav" data-n="1" aria-label="Siguiente">›</button>
    <div class="seg" role="group" aria-label="Vista">${['dia','semana','mes'].map(m=>`<button data-act="calMode" data-m="${m}" aria-pressed="${mode===m}">${m==='dia'?'Día':m[0].toUpperCase()+m.slice(1)}</button>`).join('')}</div>
    <button class="btn primary" data-act="newAppt">${SVG(IC.plus)}Nueva cita</button></div></div>
  ${body}
  ${legend}
  ${pend.length?`<section class="panel"><header><h2>Por confirmar</h2><span class="muted small">${pend.length} citas</span></header><div class="list">${pend.map(a=>`<div class="row"><div class="m"><b>${pc(P(a.patientId))} ${esc(SV(a.service).name)}</b><span>${fDs(a.date)} · ${hm(a.start)}</span></div><button class="btn sm" data-act="confirm" data-id="${a.id}">Confirmar</button><button class="btn sm" data-act="openAppt" data-id="${a.id}">Abrir</button></div>`).join('')}</div></section>`:''}`;
};
