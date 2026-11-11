import { signIn, signOut, restoreSession, getOrganizationContext } from './data/auth.js';
import { createKovoRepository } from './data/repository.js';
import { isSupabaseConfigured } from './data/supabase-client.js';

const root=document.querySelector('.app');
const repoApi=createKovoRepository();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=c=>(Number(c||0)/100).toLocaleString('es-ES',{style:'currency',currency:'EUR'});
const date=v=>v?new Date(v).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'}):'—';
const roleName={psicologa:'Psicóloga',recepcion:'Recepción',gestoria:'Gestoría'};
let context=null,snapshot=null,section='inicio',busy=false;
const css=`
.remote-shell{min-height:100vh;background:var(--bg);color:var(--fg);font-family:var(--f);display:grid;grid-template-columns:245px minmax(0,1fr)}
.remote-side{background:#0A0C0B;color:#ECF0EE;padding:28px 18px;display:flex;flex-direction:column;gap:32px}
.remote-brand{display:flex;align-items:center;gap:12px;font-weight:700;letter-spacing:.2em;font-size:18px}
.remote-mark{width:11px;height:11px;background:#34D399;transform:rotate(45deg);border-radius:2px}
.remote-nav{display:grid;gap:5px}.remote-nav button{border:0;background:transparent;color:#A9B4AF;text-align:left;padding:11px 13px;border-radius:10px;cursor:pointer;font:500 14px var(--f)}
.remote-nav button.active,.remote-nav button:hover{background:rgba(52,211,153,.13);color:#fff}
.remote-sidefoot{margin-top:auto;color:#89948E;font-size:12px;line-height:1.6}
.remote-main{min-width:0;padding:28px clamp(18px,4vw,48px) 60px}
.remote-top{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:34px}
.remote-kicker{font-size:12px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.08em}
.remote-title{font-size:30px;letter-spacing:-.04em;margin:5px 0}
.remote-sub{color:var(--muted);margin:0}
.remote-card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px;box-shadow:var(--shadow)}
.remote-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:22px 0}
.remote-stat{font-size:27px;font-weight:650;letter-spacing:-.04em;margin-top:8px}
.remote-statlabel{color:var(--muted);font-size:13px}
.remote-table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
.remote-table th,.remote-table td{text-align:left;padding:12px 10px;border-bottom:1px solid var(--line);vertical-align:top}
.remote-table th{color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.06em}
.remote-empty{padding:30px;text-align:center;color:var(--muted)}
.remote-btn{border:1px solid var(--line-2);background:#fff;padding:9px 13px;border-radius:9px;cursor:pointer;font:600 13px var(--f)}
.remote-btn.primary{background:#1F5E46;color:#fff;border-color:#1F5E46}
.remote-alert{background:#FBF0D9;color:#79520D;padding:12px 15px;border-radius:10px;font-size:13px;margin:14px 0}
.remote-login{min-height:100vh;display:grid;place-items:center;padding:24px;background:#F3F5F4;font-family:var(--f)}
.remote-login-card{width:min(100%,430px);background:#fff;border:1px solid var(--line);border-radius:20px;padding:34px;box-shadow:0 18px 55px rgba(10,12,11,.09)}
.remote-login-card h1{font-size:29px;letter-spacing:-.04em;margin:28px 0 6px}
.remote-field{display:grid;gap:7px;margin:17px 0}.remote-field label{font-size:13px;font-weight:600;color:#46514B}
.remote-field input{width:100%;border:1px solid #D0D6D3;border-radius:10px;padding:12px 13px;font:14px var(--f)}
.remote-error{color:#A32E21;background:#FBE7E4;padding:10px 12px;border-radius:9px;font-size:13px;margin-top:14px}
.remote-note{color:#66716B;font-size:12px;line-height:1.6;margin-top:20px}
@media(max-width:760px){.remote-shell{grid-template-columns:1fr}.remote-side{padding:14px 16px;gap:12px}.remote-nav{display:flex;overflow:auto}.remote-nav button{white-space:nowrap}.remote-sidefoot{display:none}.remote-main{padding:22px 16px}.remote-grid{grid-template-columns:1fr 1fr}.remote-title{font-size:25px}}
`;
function style(){if(document.getElementById('remote-style'))return;const s=document.createElement('style');s.id='remote-style';s.textContent=css;document.head.append(s)}
function login(error=''){style();document.body.style.margin='0';document.body.style.background='#F3F5F4';root.innerHTML=`
<div class="remote-login"><form class="remote-login-card" id="login-form">
<div class="remote-brand"><span class="remote-mark"></span><span style="color:#0A0C0B">KOVO</span></div>
<h1>Bienvenido de nuevo</h1><p class="remote-sub">Accede al espacio de trabajo de tu consulta.</p>
<div class="remote-field"><label for="email">Correo electrónico</label><input id="email" name="email" type="email" autocomplete="username" placeholder="tu-correo@example.com" required></div>
<div class="remote-field"><label for="password">Contraseña</label><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Tu contraseña" required></div>
<button class="remote-btn primary" style="width:100%;padding:12px" type="submit" ${busy?'disabled':''}>${busy?'Entrando…':'Iniciar sesión'}</button>
${error?`<div class="remote-error" role="alert">${esc(error)}</div>`:''}
<p class="remote-note">Acceso privado. Las cuentas las habilita la administración de KOVO; no existe registro público.</p>
</form></div>`;
document.getElementById('login-form').addEventListener('submit',async e=>{e.preventDefault();if(busy)return;const form=e.currentTarget;const email=form.elements.email.value;const password=form.elements.password.value;busy=true;login();try{await signIn(email,password);await openWorkspace()}catch(err){busy=false;login(err.message||'No se ha podido iniciar sesión.')}})}
function menu(){const items=[['inicio','Resumen']];if(['psicologa','recepcion'].includes(context.role))items.push(['pacientes','Pacientes'],['agenda','Agenda']);if(context.role==='psicologa')items.push(['clinico','Informes clínicos']);if(['psicologa','gestoria'].includes(context.role))items.push(['finanzas','Facturación y gastos']);if(context.role==='psicologa')items.push(['equipo','Equipo']);return items}
function nav(){return menu().map(([k,l])=>`<button data-section="${k}" class="${section===k?'active':''}">${l}</button>`).join('')}
function stat(label,value){return `<div class="remote-card"><div class="remote-statlabel">${label}</div><div class="remote-stat">${value}</div></div>`}
function table(headers,rows){return `<div style="overflow:auto"><table class="remote-table"><thead><tr>${headers.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.join(''):`<tr><td colspan="${headers.length}" class="remote-empty">Todavía no hay registros.</td></tr>`}</tbody></table></div>`}
function page(){
const p=snapshot;
let title='Resumen',desc='Actividad y datos de tu consulta.',body='';
if(section==='inicio'){
const stats=[];
if(['psicologa','recepcion'].includes(context.role)){stats.push(stat('Pacientes',p.patients.length),stat('Citas',p.appointments.length))}
if(['psicologa','gestoria'].includes(context.role)){stats.push(stat('Facturas',p.invoices.length),stat('Gastos',p.expenses.length))}
body=`<div class="remote-grid">${stats.join('')}</div><div class="remote-card"><h2 style="margin:0 0 6px">Tu espacio KOVO</h2><p class="remote-sub">Organización: <b>${esc(context.name)}</b> · Perfil: <b>${roleName[context.role]||context.role}</b></p><p class="remote-sub" style="margin-top:12px">La información que aparece aquí procede del espacio remoto y se filtra por los permisos de tu perfil.</p></div>`;
}else if(section==='pacientes'){title='Pacientes';desc='Datos administrativos de pacientes.';body=`<div class="remote-card">${table(['Paciente','Correo','Teléfono','Estado'],p.patients.map(x=>`<tr><td><b>${esc([x.first_name,x.last_name].filter(Boolean).join(' '))}</b></td><td>${esc(x.email||'—')}</td><td>${esc(x.phone||'—')}</td><td>${esc(x.status||'Activo')}</td></tr>`))}</div>`}
else if(section==='agenda'){title='Agenda';desc='Citas de la consulta.';body=`<div class="remote-card">${table(['Fecha','Inicio','Fin','Paciente','Estado'],p.appointments.map(x=>`<tr><td>${date(x.starts_at)}</td><td>${esc(x.starts_at?.slice(11,16)||'—')}</td><td>${esc(x.ends_at?.slice(11,16)||'—')}</td><td>${esc(x.patient_id||'—')}</td><td>${esc(x.status||'—')}</td></tr>`))}</div>`}
else if(section==='clinico'){title='Informes clínicos';desc='Información clínica restringida al perfil de psicóloga.';body=`<div class="remote-card">${table(['Fecha','Tipo','Estado','Paciente'],p.clinicalNotes.map(x=>`<tr><td>${date(x.created_at)}</td><td>${esc(x.note_type||'Nota')}</td><td>${esc(x.status||'Borrador')}</td><td>${esc(x.patient_id||'—')}</td></tr>`))}</div>`}
else if(section==='finanzas'){title='Facturación y gastos';desc='Información económica de la consulta.';body=`<div class="remote-grid">${stat('Facturas',p.invoices.length)}${stat('Gastos',p.expenses.length)}</div><div class="remote-card"><h2>Facturas</h2>${table(['Fecha','Número','Estado','Total'],p.invoices.map(x=>`<tr><td>${date(x.issue_date)}</td><td>${esc(x.invoice_number||'Borrador')}</td><td>${esc(x.status||'—')}</td><td>${money(x.total_cents)}</td></tr>`))}<h2 style="margin-top:24px">Gastos</h2>${table(['Fecha','Concepto','Proveedor','Importe'],p.expenses.map(x=>`<tr><td>${date(x.expense_date)}</td><td>${esc(x.description)}</td><td>${esc(x.supplier||'—')}</td><td>${money(x.amount_cents)}</td></tr>`))}</div>`}
else if(section==='equipo'){title='Equipo';desc='Personal de la consulta. Acceso exclusivo de psicóloga.';body=`<div class="remote-card">${table(['Nombre','Puesto','Estado'],p.employees.map(x=>`<tr><td>${esc(x.full_name)}</td><td>${esc(x.position||'—')}</td><td>${esc(x.status||'Activo')}</td></tr>`))}</div>`}
root.innerHTML=`<div class="remote-shell"><aside class="remote-side"><div class="remote-brand"><span class="remote-mark"></span>KOVO</div><nav class="remote-nav">${nav()}</nav><div class="remote-sidefoot">Sesión segura<br>${esc(context.name)}<br>${roleName[context.role]||context.role}</div></aside><main class="remote-main"><header class="remote-top"><div><div class="remote-kicker">Espacio de trabajo</div><h1 class="remote-title">${title}</h1><p class="remote-sub">${desc}</p></div><button class="remote-btn" id="logout">Cerrar sesión</button></header>${context.is_demo?'<div class="remote-alert">Entorno de demostración. No introduzcas datos reales de pacientes.</div>':''}${body}</main></div>`;
root.querySelectorAll('[data-section]').forEach(b=>b.addEventListener('click',()=>{section=b.dataset.section;page()}));
document.getElementById('logout').addEventListener('click',async()=>{await signOut();context=null;snapshot=null;section='inicio';login()});
}
async function openWorkspace(){context=await getOrganizationContext();snapshot=await repoApi.loadSnapshot();section='inicio';busy=false;page()}
async function boot(){if(!isSupabaseConfigured()){login('Falta configurar la conexión con Supabase en el archivo .env.');return}try{const user=await restoreSession();if(user)await openWorkspace();else login()}catch(e){login(e.message||'No se ha podido recuperar la sesión.')}}
boot();
