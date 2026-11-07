function monthTotals(k){
  const em=S.invoices.filter(i=>i.num&&ym(i.date)===k);
  const inc=em.reduce((a,i)=>a+tot(i).base,0);
  const exp=S.expenses.filter(e=>ym(e.date)===k).reduce((a,e)=>a+e.base+e.iva,0);
  const pay=S.payrolls.filter(n=>n.month===k).reduce((a,n)=>a+n.coste,0);
  const cob=S.invoices.reduce((a,i)=>a+i.payments.filter(p=>ym(p.date)===k).reduce((x,p)=>x+p.amount,0),0);
  return{inc,gas:exp+pay,res:inc-exp-pay,n:em.filter(i=>i.kind!=='R').length,cob};
}
function openAccSec(t){
  const m={facturas:'fyg',gastos:'fyg',ingresos:'ingresos',impuestos:'gestoria',banco:'gestoria',libros:'gestoria',laboral:'gestoria'};
  const k=m[t];if(!k)return;
  S.sel.fopen=Object.assign({},S.sel.fopen,{[k]:true});
  if(k==='gestoria')S.sel.gsub=t;
  S.sel.scrollTo='sec-'+k;
}
const ACC_SECS=[
  ['fyg','Facturas y gastos','Emitidas, recibidas, borradores y gastos por categoría',IC.doc],
  ['ingresos','Ingresos','Consultas cobradas, cómo se han pagado y pendientes de cobro',IC.wallet],
  ['gestoria','Gestoría','Impuestos, libros registro, banco y nóminas para tu gestor',IC.bank]];
const GSUB=[['impuestos','Impuestos'],['libros','Libros registro'],['banco','Banco'],['laboral','Nóminas y personal']];
VIEWS.contabilidad=()=>{
  if(S.sel.atab){openAccSec(S.sel.atab);S.sel.atab=null}
  const ro=S.role==='gestoria';const rec=S.role==='recepcion';
  const fo=S.sel.fopen||(S.sel.fopen={fyg:true});
  const ms=monthsBack(7);const ms6=ms.slice(0,6);const pk=ms[5],ppk=ms[4];
  const T={};ms6.forEach(k=>T[k]=monthTotals(k));const cur=T[pk],prev=T[ppk];
  const dl=(a,b,inv)=>{if(!b)return'';const d=Math.round((a-b)/Math.abs(b)*100);const good=inv?d<=0:d>=0;return `<span class="delta ${good?'up':'down'}">${d>=0?'+':''}${d} % vs ${monthName(ppk)}</span>`};
  const inc={},gas={};ms6.forEach(k=>{inc[k]=T[k].inc;gas[k]=T[k].gas});
  const cap=s=>s[0].toUpperCase()+s.slice(1);
  const nRev=S.expenses.filter(e=>e.status==='por revisar').length,nUb=unbilled().length;
  const pend=S.invoices.filter(i=>i.num&&i.kind!=='R'&&i.status!=='rectificada'&&tot(i).pending>0);
  const txSoon=taxes().filter(o=>!o.paid&&o.amount>0&&o.due<=addDays(TODAY,45)).length;
  const badge={fyg:nRev+nUb?`<span class="chip warn">${nRev+nUb} por revisar</span>`:'',ingresos:pend.length?`<span class="chip warn">${pend.length} por cobrar</span>`:'',gestoria:(txSoon+unmatched().length)?`<span class="chip warn">${txSoon+unmatched().length} avisos</span>`:''};
  const body={
    fyg:()=>`${ACCV.facturas()}<h3 class="acc-sub">Gastos por categoría</h3>${ACCV.gastos()}`,
    ingresos:()=>ACCV.ingresos(),
    gestoria:()=>{const g=S.sel.gsub||'impuestos';return `<div class="gbar"><div><b>Gestoría Ejemplo</b><span>gestor@gestoria-ejemplo.es · contacto ficticio</span></div><button class="btn sm dark" data-act="exportBook">${SVG(IC.download)}Exportar libros</button></div>
      <div class="seg" role="group">${GSUB.map(([k,l])=>`<button data-act="gsub" data-t="${k}" aria-pressed="${g===k}">${l}</button>`).join('')}</div>${ACCV[g]()}`}
  };
  const secs=ACC_SECS.filter(s=>!(rec&&s[0]==='gestoria'));
  return `${roleBanner()}<div class="head"><div><div class="eyebrow">Gestión económica</div><h1>Facturación</h1><p>Todo lo económico de la consulta en un solo sitio.</p></div></div>
  ${ro?'':`<section class="addbar"><div><h2>Añadir facturas</h2><p>Haz una foto a una factura recibida y se registra como gasto, o crea una factura para un paciente.</p></div>
    <div class="actions"><label class="btn primary">${SVG(IC.cam)}Foto de factura<input type="file" hidden accept="image/*" capture="environment" data-up="scan"></label><label class="btn">${SVG(IC.upload)}Subir archivo<input type="file" hidden accept="image/*,application/pdf" data-up="scan"></label><button class="btn" data-act="newInvoice">${SVG(IC.plus)}Nueva factura</button></div></section>`}
  ${rec?'':`<section class="stack" style="gap:16px"><div class="ph" style="margin:0"><h2 style="font-size:1.0625rem">Resumen de ${monthLong(pk)}</h2><span class="muted small">Mes cerrado</span></div>
  <div class="kpis"><div class="kpi"><div class="l">Ingresos</div><div class="v">${eur0(cur.inc)}</div><div class="s">${dl(cur.inc,prev.inc)}</div></div><div class="kpi"><div class="l">Gastos</div><div class="v">${eur0(cur.gas)}</div><div class="s">${dl(cur.gas,prev.gas,true)}</div></div><div class="kpi"><div class="l">Beneficio</div><div class="v" style="color:var(--ok-ink)">${eur0(cur.res)}</div><div class="s">Margen ${cur.inc?Math.round(cur.res/cur.inc*100):0} %</div></div><div class="kpi"><div class="l">Cobrado</div><div class="v">${eur0(cur.cob)}</div><div class="s">${cur.n} facturas emitidas</div></div></div>
  <div class="grid3"><section class="panel chart"><header><h2>Últimos 6 meses</h2><div class="legend"><span><i style="background:var(--c1)"></i>Ingresos</span><span><i style="background:var(--c3)"></i>Gastos</span><span><i style="background:var(--c2);height:3px;vertical-align:3px"></i>Beneficio</span></div></header>${barChart(ms6,inc,gas)}</section>
  <section class="panel flush"><header><h2>Comparativa mensual</h2></header><div class="tbl-wrap"><table><thead><tr><th>Mes</th><th class="r">Ingresos</th><th class="r">Gastos</th><th class="r">Beneficio</th></tr></thead><tbody>${ms6.slice().reverse().map(k=>`<tr><td>${cap(monthName(k))}</td><td class="r">${eur0(T[k].inc)}</td><td class="r">${eur0(T[k].gas)}</td><td class="r"><b style="color:var(--ok-ink)">${eur0(T[k].res)}</b></td></tr>`).join('')}</tbody></table></div></section></div></section>`}
  ${secs.map(([k,t,d,ic])=>`<details class="acc" id="sec-${k}" data-acc="${k}" ${fo[k]?'open':''}><summary><span class="acc-ic">${SVG(ic)}</span><span class="acc-t"><b>${t}</b><span>${d}</span></span>${badge[k]}<span class="acc-chev">${SVG('<path d="m6 9 6 6 6-6"/>')}</span></summary>${fo[k]?`<div class="acc-bd">${body[k]()}</div>`:''}</details>`).join('')}`;
};
