import re
D='/private/tmp/claude-501/sesiona/'
t=open(D+'Sesiona.v2.html',encoding='utf-8').read()
def rd(n):
    s=open(D+n,encoding='utf-8').read()
    return s if s.endswith('\n') else s+'\n'
def rep(old,new,count=1):
    global t
    n=t.count(old)
    assert n==count,(n,old[:100])
    t=t.replace(old,new)
def blk(a,b,new,incl_b=False):
    global t
    i=t.index(a);j=t.index(b,i)+(len(b) if incl_b else 0)
    t=t[:i]+new+t[j:]

# colores de texto semánticos (antes de insertar nada nuevo)
t=t.replace('var(--warn)','var(--warn-ink)').replace('var(--ok)','var(--ok-ink)').replace('var(--bad)','var(--bad-ink)')

# tipografía
rep('family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap','family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap')
css=rd('css2.css').replace('--info-ink:#3D6501','--info-ink:#3F67A3')
blk('<style>\n/* Diseño:','</style>',css,True)
blk('<div class="bg" aria-hidden="true">','<div id="toast" class="toast" hidden></div>',rd('markup2.html').rstrip('\n'),True)
blk('const NAVI={','const NAV=[','')
blk('const IC={','/* ===== capacidades',rd('icons2.js')+'\n')
rep("const NAV=[['inicio','Inicio',['psicologa','recepcion'],'Inicio'],['calendario','Calendario',['psicologa','recepcion'],'Agenda'],['pacientes','Pacientes',['psicologa','recepcion'],'Pacientes'],['informes','Informes clínicos',['psicologa'],'Informes'],['contabilidad','Contabilidad',['psicologa','recepcion','gestoria'],'Cuentas'],['config','Configuración',['psicologa'],'Ajustes']];",
"const NAV=[['inicio','Dashboard',['psicologa','recepcion'],'Inicio','work'],['calendario','Calendario',['psicologa','recepcion'],'Agenda','work'],['pacientes','Pacientes',['psicologa','recepcion'],'Pacientes','work'],['informes','Informes clínicos',['psicologa'],'Informes','work'],['seguimiento','Seguimiento terapéutico',['psicologa'],'Seguimiento','work'],['contabilidad','Facturación',['psicologa','recepcion','gestoria'],'Facturación','work'],['config','Ajustes',['psicologa'],'Ajustes','conf'],['ayuda','Ayuda y soporte',['psicologa','recepcion','gestoria'],'Ayuda','conf']];")
blk('const THEMES=','const bellBtn=',rd('navrender2.js'))
blk('VIEWS.inicio=()=>{','VIEWS.calendario=',rd('inicio2.js')+'\n')
blk('const masked=(p,field,txt)','/* informes */',rd('ficha2.js'))
blk('/* informes */','/* ===== contabilidad',rd('informes2.js')+rd('extras.js')+'\n')
blk('function noteEditor(n){','function ensureNote',"function noteEditor(n){closeModal();S.view='informes';S.sel.editing=n.id;render();window.scrollTo(0,0)}\n")

# configuración: pestaña de apariencia
blk("  else if(tab==='apariencia')c=","  else if(tab==='comms')",
"""  else if(tab==='apariencia')c=`<section class="panel"><header><h2>Tema</h2></header><div class="seg" role="group" aria-label="Tema">${[['light','Claro'],['dark','Oscuro'],['system','Automático']].map(([k,l])=>`<button data-act="setTheme" data-k="${k}" aria-pressed="${(s.theme||'system')===k}">${l}</button>`).join('')}</div>
    <p class="muted small" style="margin:14px 0 0">Automático sigue el modo claro u oscuro de tu dispositivo. El color de identidad de la plataforma es el índigo.</p></section>`;
""")

# acciones
rep("go:d=>{S.view=d.v;S.sel.patient=null;render();window.scrollTo(0,0)},","go:d=>{S.view=d.v;S.sel.patient=null;S.sel.editing=null;render();window.scrollTo(0,0)},")
rep("goNotes:d=>{S.view='informes';S.sel.nf=d.f;render()},","goNotes:d=>{S.view='informes';S.sel.editing=null;S.sel.nf=d.f;render()},")
blk("  theme:d=>{S.settings.accent=d.k;","  reset:()=>{modal('Restablecer datos'","")
blk("  saveNote:d=>","  nfilter:d=>","")
rep("  reset:()=>{modal('Restablecer datos'",rd('actions2.js')+"  reset:()=>{modal('Restablecer datos'")
rep("if(t.id==='role'){","if(t.id==='role'||t.id==='role2'){")

# facturación
rep("<h1>Contabilidad</h1><p>Facturas, gastos, impuestos, banco, libros, rentabilidad y personal en un solo sitio</p>",
    '<div class="eyebrow">Gestión económica</div><h1>Facturación</h1><p>Facturas, cobros, gastos, impuestos, banco y libros en un solo sitio</p>')
rep("body=`<div class=\"box\">${S.settings.invoiceMode==='auto'","body=`${fiscalBar()}<div class=\"box\">${S.settings.invoiceMode==='auto'")
rep("""data-act="ifilter" data-f="${x}" aria-pressed="${f===x}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</div></div>""",
    """data-act="ifilter" data-f="${x}" aria-pressed="${f===x}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</div>${S.role!=='gestoria'?`<button class="btn primary" data-act="newInvoice">${SVG(IC.plus)}Nueva factura</button>`:''}</div>""")
rep("""<button class="btn" data-act="sendInv" data-id="${i.id}">${i.sent?'Reenviar':'Enviar'}</button>""",
    """<button class="btn" data-act="pdfInv" data-id="${i.id}">${SVG(IC.download)}Exportar PDF</button><button class="btn" data-act="sendInv" data-id="${i.id}">${i.sent?'Reenviar':'Enviar'}</button>""")

# citas: notas administrativas
rep("""    <div id="f-warn" class="full" hidden></div></div>`,""","""    <label class="field full"><span>Notas administrativas (opcional)</span><textarea id="f-n" style="min-height:64px" placeholder="Por ejemplo: pago pendiente, cambio de sala…">${esc(a.notes||'')}</textarea></label>
    <div id="f-warn" class="full" hidden></div></div>`,""")
rep("modal:val('f-m'),loc:val('f-l')})","modal:val('f-m'),loc:val('f-l'),notes:val('f-n')})")
rep("loc:val('f-l'),status:S.settings.confirmEmail?'pendiente':'confirmada',log:[],cancelReason:''}","loc:val('f-l'),notes:val('f-n'),status:S.settings.confirmEmail?'pendiente':'confirmada',log:[],cancelReason:''}")
rep("<dt>Modalidad</dt><dd>${esc(a.modal)} · ${esc(a.loc)}</dd>","<dt>Modalidad</dt><dd>${esc(a.modal)} · ${esc(a.loc)}</dd>${a.notes?`<dt>Notas</dt><dd>${esc(a.notes)}</dd>`:''}")

# entradas
rep("document.addEventListener('input',e=>{\n  if(e.target.id==='f-pq')","document.addEventListener('input',e=>{\n  if(e.target.dataset&&e.target.dataset.nf!==undefined){autosize(e.target);return}\n  if(e.target.id==='f-pq')")
rep("document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='f-pq'){","document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='gq'){S.sel.q=e.target.value;S.sel.patient=null;S.view='pacientes';render();return}if(e.key==='Enter'&&e.target.id==='f-pq'){")
rep("window.matchMedia('(max-width:860px)').addEventListener('change',()=>render());\nrender();\n</script>",
    "window.matchMedia('(max-width:860px)').addEventListener('change',()=>render());\napplyTheme();renderNav();renderTop();document.getElementById('view').innerHTML=skeleton();\nsetTimeout(render,320);\n</script>")

open('/Users/tmesa/Downloads/Sesiona.html','w',encoding='utf-8').write(t)
print('ok',len(t))
