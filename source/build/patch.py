import re,sys
D='/private/tmp/claude-501/sesiona/'
src=open(D+'Sesiona.original.html',encoding='utf-8').read()
lines=src.splitlines(keepends=True)
def rd(n):
    t=open(D+n,encoding='utf-8').read()
    return t if t.endswith('\n') else t+'\n'

# comprobaciones de anclaje (numeración original)
chk={6:'fonts.googleapis.com/css2',7:'<style>',227:'</style>',229:'<div class="app">',245:'id="toast"',538:'function renderNav',550:'}',573:'VIEWS.inicio',596:'};',598:'VIEWS.calendario',619:'};',622:'VIEWS.pacientes',635:'};',652:'Datos administrativos',656:'</section></div>`;',675:'return `${roleBanner()}',677:'<div class="tabs"',844:'VIEWS.config',866:'};',869:'function modal(',873:'function apptForm',891:'}'}
for k,v in chk.items():
    assert v in lines[k-1],(k,lines[k-1][:80])

ranges=[(873,891,'apptform.js'),(869,869,'modal.js'),(844,866,'config.js'),(675,677,'ficha_head.js'),(652,656,'ficha_datos.js'),(622,635,'pacientes.js'),(598,619,'cal.js'),(573,596,'inicio.js'),(538,550,'nav_render.js'),(229,245,'markup.html'),(7,227,'css.css')]
for a,b,f in ranges:
    lines[a-1:b]=[rd(f)]
lines[5]='<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap">\n'
t=''.join(lines)

def rep(old,new,count=1):
    global t
    n=t.count(old)
    assert n==count,(n,old[:90])
    t=t.replace(old,new)

rep("const AVAIL={0:[[960,1200]],1:[[600,840],[960,1200]],2:[[960,1200]],3:[[600,840],[960,1200]],4:[[600,840]]};",
    "const DEF_AVAIL={0:[[960,1200]],1:[[600,840],[960,1200]],2:[[960,1200]],3:[[600,840],[960,1200]],4:[[600,840]]};\nlet AVAIL=JSON.parse(JSON.stringify(DEF_AVAIL));")
rep("pro:{name:'Laura Benítez Ortega',","pro:{loc:'Despacho Málaga Centro',name:'Laura Benítez Ortega',")
rep("dueDays:15,aiScan:true}","dueDays:15,aiScan:true,accent:'azul',h0:9,h1:21}")
rep("payrolls:[],oblPaid:{},audit:[],outbox:[]};","payrolls:[],oblPaid:{},audit:[],outbox:[],avail:JSON.parse(JSON.stringify(DEF_AVAIL))};")
rep("const KEY='sesiona-prototipo-v2';","const KEY='sesiona-prototipo-v3';")
rep("if(!S){S=seed();S.builtFor=TODAY.slice(0,7)}",
    "if(!S){S=seed();S.builtFor=TODAY.slice(0,7)}\nS.avail=S.avail||JSON.parse(JSON.stringify(DEF_AVAIL));AVAIL=S.avail;S.settings=Object.assign({accent:'azul',h0:9,h1:21},S.settings);S.pro.loc=S.pro.loc||'Despacho Málaga Centro';")
rep("S=seed();S.builtFor=TODAY.slice(0,7);REVEAL={};closeModal();","S=seed();S.builtFor=TODAY.slice(0,7);AVAIL=S.avail;REVEAL={};closeModal();")
rep("const H0=9,H1=21;","let H0=9,H1=21;")
rep("const NAV=[['inicio','Inicio',['psicologa','recepcion']],['calendario','Calendario',['psicologa','recepcion']],['pacientes','Pacientes',['psicologa','recepcion']],['informes','Informes clínicos',['psicologa']],['contabilidad','Contabilidad',['psicologa','recepcion','gestoria']],['config','Configuración',['psicologa']]];",
    "const NAV=[['inicio','Inicio',['psicologa','recepcion'],'Inicio'],['calendario','Calendario',['psicologa','recepcion'],'Agenda'],['pacientes','Pacientes',['psicologa','recepcion'],'Pacientes'],['informes','Informes clínicos',['psicologa'],'Informes'],['contabilidad','Contabilidad',['psicologa','recepcion','gestoria'],'Cuentas'],['config','Configuración',['psicologa'],'Ajustes']];")
rep("""  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'""",
    """  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'""")
rep("for(let i=0;i<5;i++){(AVAIL[i]||[])","for(let i=0;i<7;i++){(AVAIL[i]||[])")
rep("""<label class="field"><span>NIF / CIF para la factura</span><input type="text" id="np-bnif" value="${esc(p.billing.nif)}"></label>""",
    """<label class="field"><span>NIF / CIF para la factura</span><input type="text" id="np-bnif" value="${esc(p.billing.nif)}"></label>
  <label class="field full"><span>Dirección</span><input type="text" id="np-addr" value="${esc(p.billing.addr||'')}"></label>""")
rep("{type:'empresa',name:val('np-bn')||name,nif:val('np-bnif'),addr:'',ret:15}:{type:'particular',name,nif:val('np-bnif'),addr:''}",
    "{type:'empresa',name:val('np-bn')||name,nif:val('np-bnif'),addr:val('np-addr'),ret:15}:{type:'particular',name,nif:val('np-bnif'),addr:val('np-addr')}")
rep("openPatient:d=>{if(S.role==='gestoria')return;closeModal();","openPatient:d=>{if(S.role==='gestoria')return;closeModal();if(P(d.id))audit(`Ficha de #${P(d.id).code} consultada`);")
rep("  const done=ap.filter(a=>a.status==='realizada').length;",
    "  const done=ap.filter(a=>a.status==='realizada').length;\n  const nextA=ap.filter(a=>a.date>=TODAY&&!['cancelada','ausencia'].includes(a.status)).sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start)[0];")
rep("calNav:d=>{const c=S.cal;const n=Number(d.n);if(c.mode==='mes'){const x=parse(c.date);c.date=iso(new Date(x.getFullYear(),x.getMonth()+n,1))}else c.date=addDays(c.date,c.mode==='dia'?n:7*n);render()},",
    "calNav:d=>{const c=S.cal;const n=Number(d.n);const mode=(isMob()&&c.mode==='semana')?'dia':c.mode;if(mode==='mes'){const x=parse(c.date);c.date=iso(new Date(x.getFullYear(),x.getMonth()+n,1))}else c.date=addDays(c.date,mode==='dia'?n:7*n);render()},")
rep("Elige el paciente por su código y completa fecha, hora y duración.","Elige un paciente de la lista y completa fecha, hora y duración.")
rep("const showName=!p||p.billing.type==='empresa'||REVEAL[p.id];","const showName=!p||p.billing.type==='empresa'||REVEAL[p.id]||S.role!=='gestoria';")

# acciones nuevas
rep("  reset:()=>{modal('Restablecer datos'","""  pickCalDay:d=>{S.cal.date=d.d;render()},
  pickPt:d=>{const p=P(d.id);if(!p)return;document.getElementById('f-p').value=p.id;document.getElementById('f-pq').value=`#${p.code} · ${p.name}`;document.getElementById('f-plist').hidden=true;onPatientPick(p)},
  addSvc:()=>{S.services.push({id:nid('s'),name:'Nuevo servicio',dur:60,price:5000,exempt:true});audit('Servicio añadido');render();toast('Servicio añadido · edítalo en la tabla')},
  delSvc:d=>{const sv=SV(d.id);if(S.services.length<2){toast('Debe quedar al menos un servicio');return}if(S.appts.some(a=>a.service===d.id)||S.patients.some(p=>p.service===d.id)){toast('Hay citas o pacientes con este servicio; no se puede eliminar');return}S.services=S.services.filter(x=>x.id!==d.id);audit(`Servicio «${sv.name}» eliminado`);render();toast('Servicio eliminado')},
  addRange:d=>{const a=(AVAIL[d.d]=AVAIL[d.d]||[]);const last=a[a.length-1];const st=last?Math.min(last[1]+60,1260):600;a.push([st,Math.min(st+240,1380)]);audit(`Franja añadida el ${DAYN[d.d].toLowerCase()}`);render()},
  delRange:d=>{AVAIL[d.d].splice(Number(d.i),1);audit(`Franja quitada el ${DAYN[d.d].toLowerCase()}`);render()},
  theme:d=>{S.settings.accent=d.k;audit(`Color de acento: ${THEMES[d.k][3]}`);render();toast('Color aplicado')},
  reset:()=>{modal('Restablecer datos'""")

# cambios de configuración
rep("""  if(t.dataset.price){const s=SV(t.dataset.price);s.price=Math.round(Number(t.value)*100);audit(`Tarifa de ${s.name}: ${eur(s.price)}`);save();toast('Tarifa actualizada');return}""",
"""  if(t.dataset.sv){const sv=SV(t.dataset.sv);const f=t.dataset.f;
    if(f==='name'){const v=t.value.trim();if(!v){t.value=sv.name;return}sv.name=v}
    else if(f==='dur')sv.dur=Math.max(5,Number(t.value)||sv.dur);
    else if(f==='price')sv.price=Math.max(0,Math.round(Number(t.value)*100));
    else if(f==='exempt')sv.exempt=t.value==='1';
    audit(`Servicio «${sv.name}» editado`);save();toast('Servicio actualizado');return}
  if(t.dataset.av){const[dd,i,k]=t.dataset.av.split(':').map(Number);const r=AVAIL[dd][i];const old=r[k];
    if(t.value)r[k]=toMin(t.value);
    if(!t.value||r[1]<=r[0]){r[k]=old;toast('La hora de fin debe ser posterior a la de inicio')}
    else{AVAIL[dd].sort((x,y)=>x[0]-y[0]);audit(`Horario del ${DAYN[dd].toLowerCase()} editado`);toast('Horario actualizado')}
    render();return}
  if(t.id==='reminderH'){S.settings.reminderH=Math.min(168,Math.max(1,Number(t.value)||24));audit('Antelación del recordatorio editada');render();toast('Recordatorio actualizado');return}
  if(t.id==='h0'||t.id==='h1'){const v=Number(t.value);const n0=t.id==='h0'?v:H0,n1=t.id==='h1'?v:H1;
    if(!(n0>=0&&n1<=24&&n1>n0)){toast('Revisa las horas: la última debe ser posterior a la primera');render();return}
    S.settings.h0=n0;S.settings.h1=n1;audit('Horas visibles del calendario editadas');render();toast('Calendario actualizado');return}""")
rep("""audit('Datos profesionales actualizados');save()}""","""audit('Datos profesionales actualizados');save();toast('Guardado')}""")

# búsqueda y desplegable
rep("""  if(e.target.id==='pq'){S.sel.q=e.target.value;const pos=e.target.selectionStart;render();const n=document.getElementById('pq');n.focus();n.setSelectionRange(pos,pos)}""",
"""  if(e.target.id==='f-pq'){const l=document.getElementById('f-plist');document.getElementById('f-p').value='';l.innerHTML=pickerHTML(pickerList(e.target.value,APPT_CTX.keep));l.hidden=false;return}
  if(e.target.id==='pq'){S.sel.q=e.target.value;const l=document.getElementById('plist');if(l)l.innerHTML=patientList()}""")

rep("render();\n</script>","""document.addEventListener('focusin',e=>{if(e.target.id==='f-pq'){const l=document.getElementById('f-plist');if(!l)return;const has=val('f-p');l.innerHTML=pickerHTML(pickerList(has?'':e.target.value,APPT_CTX.keep));l.hidden=false;if(has)e.target.select()}});
document.addEventListener('click',e=>{if(!e.target.closest('.combo')){const l=document.getElementById('f-plist');if(l)l.hidden=true}});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='f-pq'){e.preventDefault();const b=document.querySelector('#f-plist .combo-it');if(b)b.click()}});
window.matchMedia('(max-width:860px)').addEventListener('change',()=>render());
render();
</script>""")

open('/Users/tmesa/Downloads/Sesiona.html','w',encoding='utf-8').write(t)
print('ok',len(t))
