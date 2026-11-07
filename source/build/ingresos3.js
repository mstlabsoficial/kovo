ACCV.ingresos=()=>{
  const per=S.sel.iper||'mes';const ro=S.role==='gestoria';
  const prevK=monthsBack(2)[0];
  const [from,to]=per==='mes'?[ym(TODAY)+'-01',TODAY]:per==='anterior'?[prevK+'-01',lastDay(Number(prevK.slice(0,4)),Number(prevK.slice(5,7)))]:per==='trimestre'?quarterRange(YEAR,qOf(TODAY)):[`${YEAR}-01-01`,`${YEAR}-12-31`];
  const pays=[];S.invoices.forEach(i=>i.payments.forEach(p=>{if(p.date>=from&&p.date<=to)pays.push({...p,inv:i})}));
  pays.sort((a,b)=>b.date.localeCompare(a.date));
  const total=pays.reduce((a,p)=>a+p.amount,0);
  const by={};pays.forEach(p=>{by[p.method]=by[p.method]||{n:0,s:0};by[p.method].n++;by[p.method].s+=p.amount});
  const mx=Math.max(1,...Object.values(by).map(v=>v.s));
  const who=i=>i.patientId&&P(i.patientId)&&P(i.patientId).billing.type!=='empresa'?pc(P(i.patientId)):esc(i.to.name);
  const pend=S.invoices.filter(i=>i.num&&i.kind!=='R'&&i.status!=='rectificada'&&tot(i).pending>0).sort((a,b)=>a.due.localeCompare(b.due));
  const pSum=pend.reduce((a,i)=>a+tot(i).pending,0);
  return `<div class="toolbar"><div class="seg" role="group">${[['mes','Este mes'],['anterior','Mes anterior'],['trimestre','Trimestre'],['año','Año']].map(([k,l])=>`<button data-act="iper" data-p="${k}" aria-pressed="${per===k}">${l}</button>`).join('')}</div><span class="muted small">${pays.length} cobros · ${eur(total)}</span></div>
  <div class="grid3"><section class="panel flush"><header><h2>Consultas cobradas</h2></header><div class="tbl-wrap" style="max-height:440px;overflow:auto"><table><thead><tr><th>Fecha</th><th>Paciente</th><th>Concepto</th><th>Factura</th><th>Pago</th><th class="r">Importe</th></tr></thead><tbody>
    ${pays.slice(0,150).map(p=>`<tr class="click" data-act="openInv" data-id="${p.inv.id}"><td class="num" style="white-space:nowrap">${fD(p.date)}</td><td>${who(p.inv)}</td><td class="small">${esc((p.inv.lines[0]||{}).desc||'')}</td><td class="mono">${p.inv.num||'—'}</td><td><span class="chip pay">${esc(p.method)}</span></td><td class="r"><b>${eur(p.amount)}</b></td></tr>`).join('')||'<tr><td colspan="6" class="empty">Sin cobros en este periodo.</td></tr>'}</tbody></table></div></section>
  <section class="panel"><header><h2>Cómo te han pagado</h2></header><div class="hbar" style="grid-template-columns:96px minmax(0,1fr) auto">${['Tarjeta','Bizum','Transferencia','Efectivo'].map(m=>{const v=by[m]||{n:0,s:0};return `<span>${m}</span><span class="b"><i style="width:${v.s/mx*100}%"></i></span><span class="num small">${eur0(v.s)} <span class="muted">· ${v.n}</span></span>`}).join('')}</div>
    <p class="muted small" style="margin:14px 0 0">Los cobros por Bizum, tarjeta y transferencia se concilian con el banco en Gestoría.</p></section></div>
  <section class="panel flush"><header><h2>Pendiente de cobro</h2><span class="muted small">${pend.length} facturas · ${eur(pSum)}</span></header><div class="tbl-wrap"><table><thead><tr><th>Factura</th><th>Paciente</th><th>Emitida</th><th>Vence</th><th class="r">Pendiente</th><th>Estado</th><th></th></tr></thead><tbody>
    ${pend.map(i=>`<tr><td class="mono">${i.num}</td><td>${who(i)}</td><td class="num" style="white-space:nowrap">${fD(i.date)}</td><td class="num" style="white-space:nowrap">${fD(i.due)}</td><td class="r"><b>${eur(tot(i).pending)}</b></td><td>${chip(invStatus(i))}</td><td class="r">${ro?'':`<button class="btn sm primary" data-act="openInv" data-id="${i.id}">Registrar cobro</button>${invStatus(i)==='vencida'?` <button class="btn sm" data-act="remind" data-id="${i.id}">Recordar</button>`:''}`}</td></tr>`).join('')||'<tr><td colspan="7" class="empty">Todo cobrado.</td></tr>'}</tbody></table></div></section>`;
};
