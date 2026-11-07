import subprocess,sys,re
D='/private/tmp/claude-501/sesiona/'
OUT='/Users/tmesa/Downloads/Sesiona.html'

# CSS: base + ajustes de la barra superior negra con logo
a=open(D+'cssA.css',encoding='utf-8').read()
b=open(D+'cssB.css',encoding='utf-8').read()
def r(s,old,new):
    assert s.count(old)==1,(s.count(old),old[:70])
    return s.replace(old,new)
a=r(a,'.app{display:grid;grid-template-columns:240px minmax(0,1fr);min-height:100vh}','.app{display:grid;grid-template-columns:240px minmax(0,1fr);grid-template-rows:auto 1fr;min-height:100vh}')
a=r(a,'.side{position:sticky;top:0;height:100vh;','.side{position:sticky;top:64px;height:calc(100vh - 64px);border-top:1px solid rgba(255,255,255,.06);')
a=r(a,'.topbar{position:sticky;top:0;z-index:20;height:60px;display:flex;align-items:center;gap:16px;padding:0 40px;background:rgba(243,245,244,.82);backdrop-filter:blur(14px) saturate(1.4);-webkit-backdrop-filter:blur(14px) saturate(1.4);border-bottom:1px solid var(--line)}',
      '.topbar{grid-column:1/-1;position:sticky;top:0;z-index:20;height:64px;display:flex;align-items:center;gap:16px;padding:0 24px 0 22px;background:#0A0C0B;color:#fff}')
a=r(a,'.tb-brand{display:none;align-items:center;gap:10px}','.tb-brand{display:flex;align-items:center;gap:12px;width:196px;flex:none}.tb-brand .logo{height:38px;width:auto;display:block}')
a=r(a,'.tsearch input[type=search]{padding-left:38px;height:38px;border-radius:99px;background:var(--surface)}','.tsearch input[type=search]{padding-left:38px;height:38px;border-radius:99px;background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.1);color:#fff}.tsearch input[type=search]::placeholder{color:#79837E}.tsearch input[type=search]:focus{border-color:var(--signal);box-shadow:0 0 0 3px rgba(52,211,153,.2)}')
a=r(a,'cursor:pointer;color:var(--muted);transition:background var(--t),color var(--t)}\n.ibtn:hover{background:var(--tint-2);color:var(--fg)}','cursor:pointer;color:#A9B4AF;transition:background var(--t),color var(--t)}\n.ibtn:hover{background:rgba(255,255,255,.08);color:#fff}')
a=r(a,'.dotn{position:absolute;top:2px;right:0;background:var(--accent);color:#fff;','.dotn{position:absolute;top:2px;right:0;background:var(--signal);color:#06150F;')
a=r(a,'.head p{margin:6px 0 0;color:var(--muted);font-size:.9375rem}','.head p{margin:6px 0 0;color:var(--muted);font-size:.9375rem}\n.head p.today-count{font-size:1.0625rem;margin-top:10px}.today-count b{font-size:2.25rem;font-weight:600;color:var(--accent);letter-spacing:-.04em;vertical-align:-5px;margin:0 3px;font-variant-numeric:tabular-nums}\n.wlist{display:grid;gap:12px}.wday{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:12px 16px 6px;box-shadow:var(--shadow)}.wday.today{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}.wday-h{display:flex;justify-content:space-between;align-items:baseline;padding-bottom:6px;border-bottom:1px solid var(--line);margin-bottom:2px}.wday-h b{font-weight:600;text-transform:capitalize}')
b=r(b,'  .tb-brand{display:flex}\n  .tb-brand b{color:var(--fg)}','  .tb-brand{width:auto}\n  .tb-brand .logo{height:32px}')
b=r(b,'  .topbar{top:env(safe-area-inset-top,0px);padding:0 16px;gap:10px;height:56px}','  .topbar{top:env(safe-area-inset-top,0px);padding:0 14px;gap:10px;height:58px}')
open(D+'css2.css','w',encoding='utf-8').write(a+b+open(D+'cssC.css',encoding='utf-8').read())

subprocess.run([sys.executable,'-I',D+'patch2.py'],check=True,stdout=subprocess.DEVNULL)

t=open(OUT,encoding='utf-8').read()
def rep(old,new,n=1):
    global t
    c=t.count(old)
    assert c==n,(c,old[:90])
    t=t.replace(old,new)
def blk(x,y,new):
    global t
    i=t.index(x);j=t.index(y,i)
    t=t[:i]+new+t[j:]

rep('family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap','family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap')
rep('stroke-width="1.9"','stroke-width="1.8"')
for w in ('700','800'): t=t.replace('font-weight:'+w,'font-weight:600')
rep("['apariencia','Apariencia'],","")
t=t.replace('Sesiona','KOVO')

# logo
logo=open(D+'logo.b64').read().strip()
rep('const norm=s=>',"const LOGO='data:image/png;base64,"+logo+"';\nconst norm=s=>")

# agenda: semana visible también en móvil
blk('VIEWS.calendario=()=>{','/* pacientes */',open(D+'cal3.js',encoding='utf-8').read()+'\n')
rep("const mode=(isMob()&&c.mode==='semana')?'dia':c.mode;","const mode=c.mode;")

# datos de ejemplo: consulta con agenda llena
rep("const DEF_AVAIL={0:[[960,1200]],1:[[600,840],[960,1200]],2:[[960,1200]],3:[[600,840],[960,1200]],4:[[600,840]]};",
    "const DEF_AVAIL={0:[[600,840],[960,1200]],1:[[600,840],[960,1200]],2:[[600,840],[960,1200]],3:[[600,840],[960,1200]],4:[[600,840],[960,1200]]};")
t,n=re.subn(r"const names=\[[^\]]*\];","const names=['Lucía Romero Vega','Javier Ortega Ruiz','Marta Gil Navarro','Pablo Herrera y Nuria Sanz','Carmen Delgado Ríos','Sergio Molina Paz','Elena Castro Prieto','Andrés Vidal Ramos','Nerea Fuentes Lara','Daniel Cano Aguilar','Rocío Márquez León','Hugo Serrano Bravo','Paula Iglesias Mora','Tomás Reyes Cabello','Laura Pineda Soto','Álvaro Núñez Carrasco','Inés Garrido Peña','Raúl Campos Medina','Silvia Herrero Blanco','Óscar Méndez Rubio','Clara Benavente Ruiz','Marcos Lorente Gil','Beatriz Sáez Ortiz','Adrián Pastor Vera','Natalia Ibáñez Cruz','Víctor Calvo Moreno','Alba Rosales Díaz','Jorge Esteban Marín','Cristina Vallejo Pozo','Iván Montero Sanz','Lorena Cortés Vidal','Gonzalo Prieto Arias','Miriam Solís Fajardo','Rubén Ferrer Luna','Patricia Rey Salinas','Héctor Quintana Mora'];",t)
assert n==1
rep("  const slots=[[0,960],[0,1080],[1,600],[1,720],[1,1020],[2,960],[2,1080],[3,600],[3,660],[3,1020],[4,720],[4,780],[2,1140],[1,1140]];",
    "  const pool=[];[0,1,2,3,4].forEach(d=>(d===4?[600,660,720,960,1020,1080,1140]:[600,660,720,780,960,1020,1080,1140]).forEach(t=>{if(!(d===2&&t===1140))pool.push([d,t])}));\n  const slots=names.map((_,i)=>i===3?[2,1140]:pool[(i*11)%pool.length]);")
rep("  const altas=[-178,-170,-150,-140,-120,-95,-88,-80,-66,-52,-40,-30,-18,-9];","  const altas=names.map((_,i)=>i<names.length-6?-(420-i*6):-(54-(i-names.length+6)*8));")
rep("bi:i===2||i===10,","bi:i===2||i===10||i===19,")
rep("consent:(i===12||i===13)?null:","consent:(i===31||i===34)?null:")
rep("status:'nuevo',slot:[4,600],","status:'nuevo',slot:[4,780],")
rep("const KEY='sesiona-prototipo-v3';","const KEY='sesiona-prototipo-v5';")
rep("{id:'s3',name:'Evaluación inicial',dur:75,","{id:'s3',name:'Evaluación inicial',dur:60,")

exec(open(D+'build_extra.py',encoding='utf-8').read())
open(OUT,'w',encoding='utf-8').write(t)
print('ok',len(t))
