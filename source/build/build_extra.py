# Pasos extra de la versión con mapa semanal, carrusel y facturación por secciones.
# Se ejecuta dentro de build.py (comparte t, rep, blk, D).
import re as _re

blk('VIEWS.contabilidad=()=>{','const ACCV={};',open(D+'fact3.js',encoding='utf-8').read()+'\n')
rep('const ACCV={};','const ACCV={};\n'+open(D+'ingresos3.js',encoding='utf-8').read())

# la barra de escaneo ya está arriba del todo
t,_n=_re.subn(r"\$\{ro\?'':`<div class=\"scanbar\">.*?</label></div></div>`\}","",t,count=1,flags=_re.S)
assert _n==1,'scanbar'

t,_n=_re.subn(r"  goAcc:d=>\{closeModal\(\);S\.view='contabilidad';.*?\},\n","  goAcc:d=>{closeModal();S.view='contabilidad';S.sel.patient=null;openAccSec(d.tab||'facturas');render()},\n",t,count=1)
assert _n==1,'goAcc'

rep("  reset:()=>{modal('Restablecer datos'","""  slotNew:d=>{if(S.role==='gestoria')return;apptForm(null,{d:d.d,t:Number(d.t)})},
  fillNote:d=>{if(S.role!=='psicologa')return;const a=S.appts.find(x=>x.id===d.id);if(!a)return;if(['confirmada','pendiente'].includes(a.status)){if(a.date>TODAY)return;markDone(a)}noteEditor(ensureNote(a))},
  carMove:d=>{const c=document.getElementById('car');if(c)c.scrollBy({left:Number(d.n)*carStep(c),behavior:'smooth'})},
  pmenu:()=>{const m=document.getElementById('pmenu');if(m)m.hidden=!m.hidden},
  goSettings:()=>{S.view='config';S.sel.ctab='auto';S.sel.patient=null;render();window.scrollTo(0,0)},
  goHelp:()=>{if(S.role==='psicologa'){S.view='config';S.sel.ctab='ayuda'}else S.view='ayuda';S.sel.patient=null;render();window.scrollTo(0,0)},
  iper:d=>{S.sel.iper=d.p;render()},
  gsub:d=>{S.sel.gsub=d.t;render()},
  reset:()=>{modal('Restablecer datos'""")

# Ajustes y Ayuda salen del menú lateral: van al menú del perfil
rep("['psicologa'],'Ajustes','conf']","['psicologa'],'Ajustes','menu']")
rep("'Ayuda','conf']","'Ayuda','menu']")
rep("if(t.id==='role'||t.id==='role2'){","if(t.id==='role'||t.id==='role2'||t.id==='role3'){")

# Ayuda y soporte también como pestaña de Ajustes
rep("VIEWS.ayuda=()=>{","function ayudaBody(){")
rep("""  return `<div class="head"><div><div class="eyebrow">Centro de ayuda</div><h1>Ayuda y soporte</h1><p>Respuestas rápidas sobre el uso diario de KOVO.</p></div></div>
  <div class="grid3">""","""  return `<div class="grid3">""")
rep("function ayudaBody(){","""VIEWS.ayuda=()=>`<div class="head"><div><div class="eyebrow">Centro de ayuda</div><h1>Ayuda y soporte</h1><p>Respuestas rápidas sobre el uso diario de KOVO.</p></div></div>${ayudaBody()}`;
function ayudaBody(){""")
rep("['comms','Comunicaciones'],['audit','Auditoría']]","['comms','Comunicaciones'],['audit','Auditoría'],['ayuda','Ayuda y soporte']]")
rep("""  else c=`<section class="panel flush"><div class="tbl-wrap"><table><thead><tr><th>Fecha</th><th>Usuario</th>""","""  else if(tab==='ayuda')c=ayudaBody();
  else c=`<section class="panel flush"><div class="tbl-wrap"><table><thead><tr><th>Fecha</th><th>Usuario</th>""")

rep("applyTheme();renderNav();renderTop();document.getElementById('view').innerHTML=skeleton();","""document.addEventListener('toggle',e=>{const d=e.target;if(!d.dataset||!d.dataset.acc)return;S.sel.fopen=Object.assign({},S.sel.fopen,{[d.dataset.acc]:d.open});if(d.open&&!d.querySelector('.acc-bd'))render();else save()},true);
document.addEventListener('click',e=>{if(!e.target.closest('.pwrap')){const m=document.getElementById('pmenu');if(m)m.hidden=true}});
renderNav();renderTop();document.getElementById('view').innerHTML=skeleton();""")
rep("const KEY='sesiona-prototipo-v5';","const KEY='sesiona-prototipo-v7';")

rep("const months=[];for(let i=5;i>=0;i--)","const months=[];for(let i=6;i>=0;i--)")
rep("const unpaid=age>12?r()<.05:r()<.4;","const unpaid=age>12?r()<.012:r()<.22;")

# descargas directas cuando la app se usa fuera del visor de Claude
rep("toast('La descarga no está disponible en este visor');","saveBlob(doc.output('blob'),fn);toast('PDF descargado');")
rep("modal('Exportar libro',","if(!window.claude){saveBlob(new Blob([csv],{type:'text/csv'}),fn);toast('Libro exportado');return}\n    modal('Exportar libro',")
rep("function fiscalBar(){","function saveBlob(b,fn){const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=fn;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000)}\nfunction fiscalBar(){")
