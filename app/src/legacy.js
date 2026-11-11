// Código de KOVO (extraído de source/dist/Sesiona.html). Desde la capa de datos, este archivo
// es el código fuente: ya no se regenera con extract-legacy.py.
// Los datos se cargan y guardan a través de ./data (modo demo por defecto).
import { data } from './data/index.js';
/* ===== utilidades ===== */
const pad=n=>String(n).padStart(2,'0');
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse=s=>{const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return iso(d)};
const TODAY=iso(new Date());
const YEAR=Number(TODAY.slice(0,4));
const dow=s=>(parse(s).getDay()+6)%7;
const mondayOf=s=>addDays(s,-dow(s));
const eur=c=>(c/100).toLocaleString('es-ES',{style:'currency',currency:'EUR'});
const eur0=c=>(c/100).toLocaleString('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0});
const fD=s=>s?parse(s).toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'}):'—';
const fDs=s=>parse(s).toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'});
const fDl=s=>{const t=parse(s).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});return t[0].toUpperCase()+t.slice(1)};
const hm=m=>`${pad(Math.floor(m/60))}:${pad(m%60)}`;
const toMin=t=>{const[h,m]=t.split(':').map(Number);return h*60+m};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ym=s=>s.slice(0,7);
const monthName=k=>{const[y,m]=k.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('es-ES',{month:'short'}).replace('.','')};
const monthLong=k=>{const[y,m]=k.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('es-ES',{month:'long',year:'numeric'})};
const nowMin=()=>{const d=new Date();return d.getHours()*60+d.getMinutes()};
const qOf=s=>Math.floor((Number(s.slice(5,7))-1)/3)+1;
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function fnv(str){let h=0x811c9dc5;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,0x01000193)}let h2=0x12345;for(let i=str.length-1;i>=0;i--){h2^=str.charCodeAt(i);h2=Math.imul(h2,0x01000193)}return((h>>>0).toString(16).padStart(8,'0')+(h2>>>0).toString(16).padStart(8,'0')).toUpperCase()}
const maskEmail=e=>{const[a,b]=String(e).split('@');return b?a[0]+'•••@'+b:'•••'};
const SVG=p=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const IC={
  cam:'<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  pen:'<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  doc:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  cal:'<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  bank:'<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
  tax:'<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
  upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  eye:'<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  sign:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m9 15 2 2 4-4"/>',
  img:'<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  user:'<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  moon:'<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  trend:'<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  clock:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  wallet:'<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  more:'<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  plus:'<path d="M5 12h14"/><path d="M12 5v14"/>',
  lock:'<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
};
const NAVI={
  inicio:'<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  calendario:IC.cal,
  pacientes:IC.users,
  informes:IC.doc,
  seguimiento:'<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  contabilidad:IC.tax,
  config:'<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  ayuda:'<circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/>'
};

/* ===== capacidades del visor (IA para leer facturas, almacenamiento de fotos, descargas) ===== */
let SAMPLE=null,ASSETS=null,DL=null;
if(window.claude&&typeof window.claude.use==='function'){
  window.claude.use('sample').then(s=>SAMPLE=s).catch(()=>{});
  window.claude.use('assets').then(s=>ASSETS=s).catch(()=>{});
  window.claude.use('downloads').then(s=>DL=s).catch(()=>{});
}

/* ===== catálogos ===== */
const DEF_AVAIL={0:[[600,840],[960,1200]],1:[[600,840],[960,1200]],2:[[600,840],[960,1200]],3:[[600,840],[960,1200]],4:[[600,840],[960,1200]]};
let AVAIL=JSON.parse(JSON.stringify(DEF_AVAIL));
const DAYN=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const FIELDS={
  sesion:[['objetivos','Objetivos abordados'],['resumen','Resumen profesional de la sesión'],['intervenciones','Técnicas o intervenciones realizadas'],['observaciones','Observaciones y evolución'],['acuerdos','Acuerdos y tareas para el paciente'],['plan','Plan para la siguiente sesión'],['proxima','Recordatorio para la próxima sesión']],
  inicial:[['motivo','Motivo de consulta'],['antecedentes','Antecedentes relevantes'],['evaluacion','Evaluación'],['formulacion','Hipótesis o formulación clínica'],['objetivos','Objetivos terapéuticos'],['plan','Plan de intervención']],
  evolucion:[['objetivos','Objetivos revisados'],['cambios','Cambios observados'],['valoracion','Valoración profesional'],['plan','Próximos pasos']],
  cierre:[['motivo','Motivo de cierre'],['trabajo','Trabajo realizado'],['logros','Objetivos alcanzados y pendientes'],['recomendaciones','Recomendaciones']]
};
const NOTE_T={sesion:'Nota de sesión',inicial:'Evaluación inicial',evolucion:'Informe de evolución',cierre:'Informe de cierre'};
const CATS=['Alquiler','Suministros','Seguros','Material','Gestoría y asesoría','Tecnología y software','Cuotas e impuestos','Personal','Formación','Otros'];
const RULES=[[/alquiler|inmobiliari|arrend|local|despacho/i,'Alquiler'],[/luz|el[eé]ctric|endesa|iberdrola|naturgy|agua|emasa|gas|fibra|telef|movistar|vodafone|orange|digi|internet|telecom/i,'Suministros'],[/seguro|asegurad|mapfre|mutua|axa|allianz|responsabilidad civil/i,'Seguros'],[/papeler|material|tinta|folios|test|amazon|oficina/i,'Material'],[/gestor|asesor|abogad|notar|contable/i,'Gestoría y asesoría'],[/software|licencia|saas|google|microsoft|apple|zoom|hosting|dominio|web/i,'Tecnología y software'],[/aut[oó]nomo|tesorer|seguridad social|hacienda|aeat|colegio|ayuntamiento|tasa|impuesto/i,'Cuotas e impuestos'],[/n[oó]mina|salario|personal/i,'Personal'],[/curso|formaci|congreso|master|máster|jornada/i,'Formación']];
const guessCat=t=>{for(const[re,c]of RULES)if(re.test(t||''))return c;return'Otros'};

/* ===== datos de ejemplo ===== */
function payroll(bruto){const ssT=Math.round(bruto*.0648),irpf=Math.round(bruto*.02),ssE=Math.round(bruto*.319);return{bruto,ssT,irpf,neto:bruto-ssT-irpf,ssE,coste:bruto+ssE}}
function seed(){
  const r=rng(42);
  const pick=a=>a[Math.floor(r()*a.length)];
  const S={seq:1,role:'psicologa',view:'inicio',cal:{mode:'semana',date:TODAY},sel:{homeDay:TODAY},
    pro:{loc:'Despacho Málaga Centro',name:'Laura Benítez Ortega',col:'AN-09999 (ficticio)',nif:'00000000T (ficticio)',addr:'C/ Ejemplo 12, 2º B · 29001 Málaga',email:'consulta@ejemplo.es',sanitaria:true},
    settings:{confirmEmail:true,reminder:true,reminderH:24,noteTask:true,invoiceMode:'auto',sendInvoice:true,overdue:true,dueDays:15,aiScan:true,accent:'azul',h0:9,h1:21},
    services:[
      {id:'s1',name:'Sesión individual',dur:60,price:5500,exempt:true},
      {id:'s2',name:'Terapia de pareja',dur:75,price:7500,exempt:true},
      {id:'s3',name:'Evaluación inicial',dur:60,price:7000,exempt:true},
      {id:'s4',name:'Sesión online',dur:50,price:5000,exempt:true},
      {id:'s5',name:'Taller o formación (no sanitario)',dur:120,price:15000,exempt:false}
    ],
    patients:[],appts:[],notes:[],invoices:[],expenses:[],bank:[],employees:[],payrolls:[],oblPaid:{},audit:[],outbox:[],avail:JSON.parse(JSON.stringify(DEF_AVAIL))};
  const id=p=>p+(S.seq++);
  const used=new Set();const code=()=>{let c;do{c=String(1000+Math.floor(r()*9000))}while(used.has(c));used.add(c);return c};
  const names=['Lucía Romero Vega','Javier Ortega Ruiz','Marta Gil Navarro','Pablo Herrera y Nuria Sanz','Carmen Delgado Ríos','Sergio Molina Paz','Elena Castro Prieto','Andrés Vidal Ramos','Nerea Fuentes Lara','Daniel Cano Aguilar','Rocío Márquez León','Hugo Serrano Bravo','Paula Iglesias Mora','Tomás Reyes Cabello','Laura Pineda Soto','Álvaro Núñez Carrasco','Inés Garrido Peña','Raúl Campos Medina','Silvia Herrero Blanco','Óscar Méndez Rubio','Clara Benavente Ruiz','Marcos Lorente Gil','Beatriz Sáez Ortiz','Adrián Pastor Vera','Natalia Ibáñez Cruz','Víctor Calvo Moreno','Alba Rosales Díaz','Jorge Esteban Marín','Cristina Vallejo Pozo','Iván Montero Sanz','Lorena Cortés Vidal','Gonzalo Prieto Arias','Miriam Solís Fajardo','Rubén Ferrer Luna','Patricia Rey Salinas','Héctor Quintana Mora'];
  const pool=[];[0,1,2,3,4].forEach(d=>(d===4?[600,660,720,960,1020,1080,1140]:[600,660,720,780,960,1020,1080,1140]).forEach(t=>{if(!(d===2&&t===1140))pool.push([d,t])}));
  const slots=names.map((_,i)=>i===3?[2,1140]:pool[(i*11)%pool.length]);
  const altas=names.map((_,i)=>i<names.length-6?-(420-i*6):-(54-(i-names.length+6)*8));
  names.forEach((n,i)=>{
    const first=n.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
    S.patients.push({id:id('p'),code:code(),name:n,email:`${first}.${i+3}@correo-ejemplo.es`,phone:'6'+String(10000000+Math.floor(r()*89999999)),alta:addDays(TODAY,altas[i]),status:'activo',
      slot:slots[i],service:i===3?'s2':(i%5===4?'s4':'s1'),modal:i%5===4?'online':'presencial',bi:i===2||i===10||i===19,
      billing:i===7?{type:'empresa',name:'Grupo Alameda Logística SL',nif:'B00000000 (ficticio)',addr:'Polígono Ejemplo, nave 4 · Málaga',ret:15}:{type:'particular',name:n,nif:'',addr:''},
      consent:(i===31||i===34)?null:{at:addDays(TODAY,altas[i]),file:'consentimiento-firmado.pdf',url:null},docs:[],reminders:true});
  });
  S.patients[1].status='alta terapéutica';
  const irene={id:id('p'),code:code(),name:'Irene Lozano Mena',email:'irene.lozano@correo-ejemplo.es',phone:'612000111',alta:TODAY,status:'nuevo',slot:[4,780],service:'s3',modal:'presencial',billing:{type:'particular',name:'Irene Lozano Mena',nif:'',addr:''},consent:null,docs:[],reminders:true};
  S.patients.push(irene);
  const OBJ=['Regulación emocional ante situaciones de estrés laboral','Reducción de pensamientos anticipatorios','Mejora de la higiene del sueño','Comunicación asertiva en el ámbito familiar','Afrontamiento de la toma de decisiones','Exposición gradual a situaciones evitadas','Revisión de expectativas y autoexigencia'];
  const INT=['Reestructuración cognitiva','Entrenamiento en respiración diafragmática','Psicoeducación','Registro de pensamientos','Ensayo conductual','Resolución de problemas','Trabajo con valores'];
  const EVO=['Refiere menor intensidad del malestar respecto a la sesión anterior.','Mantiene la adherencia a las tareas acordadas.','Avances parciales; conviene consolidar.','Semana con mayor carga externa; estabilidad general.','Aplica de forma autónoma las estrategias trabajadas.'];
  const end=addDays(TODAY,21);
  S.patients.forEach(p=>{
    const start=p.alta<addDays(TODAY,-182)?addDays(TODAY,-182):p.alta;let first=true,wk=0;
    for(let d=start;d<=end;d=addDays(d,1)){
      if(dow(d)!==p.slot[0])continue;
      wk++;if(p.bi&&wk%2===0)continue;
      if(p.status==='alta terapéutica'&&d>addDays(TODAY,-20))break;
      if(p.id===irene.id&&!first)break;
      const svc=first?'s3':p.service;const sv=S.services.find(s=>s.id===svc);
      let st;
      if(d<TODAY){const x=r();st=x<.045?'ausencia':x<.09?'cancelada':'realizada'}
      else if(d===TODAY)st=p.id===irene.id?'pendiente':'confirmada';
      else st=d<=addDays(TODAY,7)?(r()<.25?'pendiente':'confirmada'):'confirmada';
      S.appts.push({id:id('a'),patientId:p.id,date:d,start:p.slot[1],dur:sv.dur,service:svc,modal:p.modal,loc:p.modal==='online'?'Videollamada':'Despacho Málaga Centro',status:st,price:sv.price,
        log:[{at:addDays(d,-7),who:'Psicóloga',what:'Cita creada'}].concat(st==='realizada'?[{at:d,who:'Psicóloga',what:'Marcada como realizada'}]:[]),cancelReason:st==='cancelada'?pick(['Enfermedad','Motivo laboral','Viaje']):''});
      first=false;
    }
  });
  S.appts.filter(a=>a.status==='realizada').forEach(a=>{
    const recent=a.date>=addDays(TODAY,-6);
    if(recent&&r()<.6)return;
    const type=a.service==='s3'?'inicial':'sesion';const f={};
    if(type==='inicial'){f.motivo='Malestar sostenido asociado a sobrecarga laboral y dificultades de descanso.';f.antecedentes='Sin intervenciones psicológicas previas relevantes.';f.evaluacion='Entrevista semiestructurada y cuestionarios de cribado.';f.formulacion='Patrón de autoexigencia elevado con escasas estrategias de recuperación.';f.objetivos=pick(OBJ);f.plan='Intervención semanal de 10 a 12 sesiones con revisión a la sexta.'}
    else{f.objetivos=pick(OBJ);f.resumen='Se revisan las tareas de la semana y se trabaja sobre situaciones concretas aportadas.';f.intervenciones=pick(INT)+', '+pick(INT).toLowerCase();f.observaciones=pick(EVO);f.acuerdos='Continuar con el registro diario y practicar la técnica trabajada.';f.plan='Profundizar en '+pick(OBJ).toLowerCase()+'.'}
    const st=recent?'borrador':'firmada';
    S.notes.push({id:id('n'),patientId:a.patientId,apptId:a.id,type,fields:f,status:st,author:S.pro.name,created:a.date,signedAt:st==='firmada'?a.date:null,versions:[]});
  });
  // facturas emitidas
  const methods=['Tarjeta','Bizum','Transferencia','Efectivo'];
  const done=S.appts.filter(a=>a.status==='realizada').sort((x,y)=>x.date.localeCompare(y.date)||x.start-y.start);
  const empresa=S.patients[7];
  done.forEach(a=>{
    if(a.patientId===empresa.id)return;
    const p=S.patients.find(q=>q.id===a.patientId);const sv=S.services.find(s=>s.id===a.service);
    const age=(parse(TODAY)-parse(a.date))/864e5;
    const inv=mkInv(S,p,a.date,[{desc:`${sv.name} · ${fD(a.date)}`,qty:1,price:a.price,exempt:sv.exempt}],[a.id]);
    inv.status='emitida';inv.sent={at:a.date,to:p.email,ok:true};
    const unpaid=age>12?r()<.012:r()<.22;
    if(!unpaid)inv.payments.push({id:id('pay'),date:a.date,amount:tot(inv).total,method:pick(methods),ref:''});
    S.invoices.push(inv);a.invoiceId=inv.id;
  });
  const byM={};done.filter(a=>a.patientId===empresa.id).forEach(a=>{(byM[ym(a.date)]=byM[ym(a.date)]||[]).push(a)});
  Object.keys(byM).sort().forEach(k=>{
    if(k===ym(TODAY))return;
    const list=byM[k];const[y,m]=k.split('-').map(Number);const last=iso(new Date(y,m,0));
    const inv=mkInv(S,empresa,last,list.map(a=>({desc:`Sesión individual · ${fD(a.date)}`,qty:1,price:a.price,exempt:true})),list.map(a=>a.id));
    inv.status='emitida';inv.sent={at:last,to:'administracion@grupoalameda-ejemplo.es',ok:true};
    const payD=addDays(last,20);if(payD<=TODAY)inv.payments.push({id:id('pay'),date:payD,amount:tot(inv).total,method:'Transferencia',ref:'TRF-'+k});
    S.invoices.push(inv);list.forEach(a=>a.invoiceId=inv.id);
  });
  const tdate=addDays(TODAY,-34);
  const tall=mkInv(S,{id:null,billing:{type:'empresa',name:'Asociación Cultural Ejemplo',nif:'G00000000 (ficticio)',addr:'Málaga',ret:15}},tdate,[{desc:'Taller de gestión del estrés (4 h)',qty:2,price:15000,exempt:false}],[]);
  tall.status='emitida';tall.sent={at:tdate,to:'info@asociacion-ejemplo.es',ok:true};tall.payments.push({id:id('pay'),date:addDays(tdate,12),amount:Math.round(tot(tall).total/2),method:'Transferencia',ref:'Pago a cuenta'});
  S.invoices.push(tall);
  numberAll(S);
  // gastos (facturas recibidas)
  const months=[];for(let i=6;i>=0;i--){const d=parse(TODAY);d.setDate(1);d.setMonth(d.getMonth()-i);months.push(iso(d))}
  const exp=(date,supplier,cat,concept,base,ivaPct,method,num,ret)=>{const iva=Math.round(base*ivaPct/100),rt=ret?Math.round(base*ret/100):0;S.expenses.push({id:id('g'),date,supplier,nif:'',cat,concept,base,iva,ret:rt,total:base+iva-rt,method,num,status:'revisado',source:num?'importada':'domiciliación',photo:null})};
  months.forEach((m,i)=>{
    const d=n=>{const x=addDays(m,n-1);return x>TODAY?null:x};
    if(d(1))exp(d(1),'Inmobiliaria Ejemplo SL','Alquiler','Alquiler despacho',45000,21,'Transferencia','ALQ-'+m.slice(0,7),19);
    if(d(5))exp(d(5),'Compañía Eléctrica Ejemplo','Suministros','Electricidad',3200+Math.round(r()*1500),21,'Domiciliación','LUZ-'+m.slice(0,7));
    if(d(8))exp(d(8),'Operador Telecom Ejemplo','Suministros','Fibra y móvil',3300,21,'Domiciliación','TEL-'+m.slice(0,7));
    if(d(10))exp(d(10),'Gestoría Ejemplo','Gestoría y asesoría','Asesoría fiscal y contable',6000,21,'Domiciliación','GES-'+m.slice(0,7));
    if(d(12))exp(d(12),'Software Ejemplo SaaS','Tecnología y software','Licencia software',2400,21,'Tarjeta','SW-'+m.slice(0,7));
    if(d(28))exp(d(28),'Tesorería General de la Seguridad Social','Cuotas e impuestos','Cuota de autónomos',29400,0,'Domiciliación','');
    if(i%3===0&&d(15))exp(d(15),'Colegio Oficial de Psicología','Cuotas e impuestos','Cuota colegial trimestral',3300,0,'Domiciliación','COP-'+m.slice(0,7));
    if(i===1&&d(18))exp(d(18),'Aseguradora Ejemplo','Seguros','Seguro de responsabilidad civil',16800,0,'Tarjeta','RC-'+YEAR);
    if(i===3&&d(20))exp(d(20),'Centro de Formación Ejemplo','Formación','Curso de actualización clínica',24000,0,'Tarjeta','FOR-001');
    if(i%2===0&&d(22))exp(d(22),'Papelería Ejemplo','Material','Material de oficina',1500+Math.round(r()*2000),21,'Tarjeta','PAP-'+m.slice(0,7));
  });
  // personal
  const emp={id:id('e'),name:'Ana Ruiz Prieto (ficticia)',role:'Recepcionista',contract:'Indefinido · tiempo parcial 20 h/semana',start:addDays(TODAY,-140),bruto:85000,docs:[{name:'Contrato de trabajo firmado',at:addDays(TODAY,-140)},{name:'Alta en la Seguridad Social (IDC)',at:addDays(TODAY,-141)},{name:'Protección de datos y confidencialidad',at:addDays(TODAY,-140)}]};
  S.employees.push(emp);
  months.forEach(m=>{const k=m.slice(0,7);const last=iso(new Date(Number(k.slice(0,4)),Number(k.slice(5,7)),0));if(last>TODAY||last<emp.start)return;S.payrolls.push({id:id('n'),emp:emp.id,month:k,date:last,...payroll(emp.bruto),paid:true})});
  // banco
  const lastDays=addDays(TODAY,-10);
  S.invoices.forEach(inv=>inv.payments.forEach(p=>{if(p.method==='Efectivo')return;const c=p.method==='Tarjeta'?'LIQUIDACION TPV':p.method==='Bizum'?'BIZUM RECIBIDO':'TRANSFERENCIA RECIBIDA '+inv.to.name.toUpperCase().slice(0,22);S.bank.push({id:id('b'),date:p.date,concept:c,amount:p.amount,match:p.date<lastDays?{t:'pay',inv:inv.id,pay:p.id}:null})}));
  S.expenses.forEach(e=>{if(e.method==='Efectivo')return;S.bank.push({id:id('b'),date:addDays(e.date,e.method==='Domiciliación'?1:0),concept:(e.method==='Domiciliación'?'RECIBO ':'PAGO ')+e.supplier.toUpperCase().slice(0,26),amount:-e.total,match:e.date<lastDays?{t:'exp',id:e.id}:null})});
  S.payrolls.forEach(n=>{S.bank.push({id:id('b'),date:n.date,concept:'TRANSFERENCIA NOMINA',amount:-n.neto,match:n.date<lastDays?{t:'nom',id:n.id,part:'neto'}:null});const d2=addDays(n.date,30)>TODAY?null:addDays(n.date,30);if(d2)S.bank.push({id:id('b'),date:d2,concept:'TGSS SEGUROS SOCIALES',amount:-(n.ssE+n.ssT),match:d2<lastDays?{t:'nom',id:n.id,part:'ss'}:null})});
  // cobros que llegaron al banco pero no se han registrado aún
  S.invoices.filter(i=>invStatus(i)!=='cobrada'&&i.patientId&&i.date>=addDays(TODAY,-9)).slice(0,3).forEach(i=>S.bank.push({id:id('b'),date:addDays(i.date,1)>TODAY?TODAY:addDays(i.date,1),concept:'BIZUM RECIBIDO',amount:tot(i).pending,match:null}));
  S.bank.push({id:id('b'),date:addDays(TODAY,-4),concept:'COMISION MANTENIMIENTO CUENTA',amount:-600,match:null});
  S.bank.push({id:id('b'),date:addDays(TODAY,-2),concept:'COMPRA TARJETA LIBRERIA CENTRO',amount:-2890,match:null});
  // obligaciones ya pagadas (trimestres anteriores)
  [1,2,3].forEach(q=>['130','115','111','303'].forEach(m=>S.oblPaid[`${m}-${YEAR}-${q}`]=`${YEAR}-${pad(q*3+1)}-18`));
  months.forEach(m=>{const k=m.slice(0,7);if(k<ym(TODAY))S.oblPaid[`rlc-${k}`]=addDays(iso(new Date(Number(k.slice(0,4)),Number(k.slice(5,7))+1,0)),-1)});
  S.audit.push({at:new Date().toISOString(),who:'Sistema',what:'Datos de ejemplo cargados'});
  return S;
}
function mkInv(S,p,date,lines,appts){
  const ret=p.billing.type==='empresa'?(p.billing.ret||15):0;
  return {id:'f'+(S.seq++),serie:'A',num:null,patientId:p.id,to:{...p.billing},date,due:addDays(date,S.settings.dueDays),lines,ret,appts,payments:[],sent:null,status:'borrador',hash:null,prevHash:null,kind:'F'};
}
function numberAll(S){
  const em=S.invoices.filter(i=>i.status!=='borrador').sort((a,b)=>a.date.localeCompare(b.date));
  let prev='0000000000000000';const cnt={};
  em.forEach(i=>{const yr=i.date.slice(0,4);const k=i.serie+yr;cnt[k]=(cnt[k]||0)+1;i.num=`${i.serie}${yr}/${String(cnt[k]).padStart(4,'0')}`;i.prevHash=prev;i.hash=fnv(prev+i.num+i.date+tot(i).total);prev=i.hash});
  S.lastHash=prev;
}
function tot(inv){let base=0,iva=0;inv.lines.forEach(l=>{const b=Math.round(l.qty*l.price);base+=b;if(!l.exempt)iva+=Math.round(b*.21)});const ret=Math.round(base*(inv.ret||0)/100);const total=base+iva-ret;const paid=inv.payments.reduce((a,p)=>a+p.amount,0);return{base,iva,ret,total,paid,pending:total-paid}}

/* ===== estado ===== */
let S;
try{S=await data.load({seed,today:TODAY})}catch(e){document.getElementById('view').textContent=e.message;throw e}
S.avail=S.avail||JSON.parse(JSON.stringify(DEF_AVAIL));AVAIL=S.avail;S.settings=Object.assign({accent:'azul',h0:9,h1:21},S.settings);S.pro.loc=S.pro.loc||'Despacho Málaga Centro';
let REVEAL={};
function save(){try{data.persist(S)}catch(e){toast('El almacenamiento del navegador está lleno; las últimas fotos no se guardarán')}}
const nid=p=>data.newId(p,S);
// Modo Supabase: altas y cambios de pacientes y citas se guardan uno a uno y el estado local solo
// cambia cuando Supabase confirma. En modo demo W es null y todo funciona como siempre.
const W=data.writes||null;let BUSY=false;
// Conectado: el apartado «proxima» (recordatorio para la próxima sesión) no existe en el catálogo del servidor; no se ofrece.
if(W)FIELDS.sesion=FIELDS.sesion.filter(f=>f[0]!=='proxima');
// Modo conectado: ajustes, equipo, suscripción, documentos y facturación contra el servidor (saas/connected.js).
let CN=null;
async function reloadS(){const keep={view:S.view,sel:S.sel,cal:S.cal,theme:S.settings.theme};const n=await data.load({seed,today:TODAY});
  n.avail=n.avail||JSON.parse(JSON.stringify(DEF_AVAIL));n.settings=Object.assign({accent:'azul',h0:9,h1:21},n.settings,keep.theme?{theme:keep.theme}:{});n.pro.loc=n.pro.loc||'Despacho Málaga Centro';
  S=n;AVAIL=S.avail;migrate();Object.assign(S,{view:keep.view,sel:keep.sel,cal:keep.cal});REVEAL={};if(CN)CN.refresh();render()}
function remote(btn,op,ok,fail){if(BUSY)return;BUSY=true;if(btn)btn.disabled=true;op().then(r=>{BUSY=false;ok(r)},e=>{BUSY=false;if(btn)btn.disabled=false;(fail||(x=>toast(x.message||'No se ha podido guardar')))(e)})}
// Guardar el borrador en Supabase. La interfaz solo da por guardado lo que confirma el servidor; el
// texto escrito durante el guardado se conserva. En un conflicto no se sobrescribe nada: el editor
// conserva el texto y muestra la versión guardada para comparar (force: guardar la mía sobre ella).
function saveNoteW(id,btn,force){if(BUSY)return;if(!NB[id]){const c=S.notes.find(x=>x.id===id);if(c)NB[id]=nbCopy(c)}const n=NB[id];if(!n)return;if(n.status==='firmada'){toast('Esta nota está firmada y no se puede modificar. Las correcciones se añaden como rectificación.');return}readNote(n);const sent={...n.fields};NSAVING=id;nbMark();
  remote(btn,()=>W.notes.saveNote({note:force?{...n,serverVersion:n.conflict&&n.conflict.version}:n,fields:sent,knownIds:S.notes.map(x=>x.id),force}),({note:x,replacedId})=>{NSAVING=null;const now={};document.querySelectorAll('[data-nf]').forEach(t=>now[t.dataset.nf]=t.value.trim());W.notes.applyNote(S,x,replacedId);delete NB[id];nlog(x,'Borrador guardado');if(S.sel.editing===x.id){NB[x.id]=nbCopy(x);Object.assign(NB[x.id].fields,now)}audit(`Nota de ${P(x.patientId).code} guardada como borrador`);render();toast('Borrador guardado')},
  e=>{NSAVING=null;const b=NB[id];if(e&&e.code==='conflict'&&b){const now={};document.querySelectorAll('[data-nf]').forEach(t=>now[t.dataset.nf]=t.value.trim());Object.assign(b.fields,now);b.conflict={version:Number.isInteger(e.currentVersion)?e.currentVersion:null,server:e.serverNote||null};if(e.serverNote)W.notes.applyNote(S,e.serverNote);render()}else nbMark();toast(e&&e.message||'No se ha podido guardar')})}
function remoteStatus(btn,a,status,ok){remote(btn,()=>W.setAppointmentStatus({appt:a,status,services:S.services}),({appt})=>{W.applyAppointment(S,appt);ok(appt)})}
// Notas en modo Supabase: el editor trabaja sobre una copia; S.notes solo cambia tras confirmar el guardado.
const NB={};function edNote(id){return(W&&NB[id])||S.notes.find(x=>x.id===id)}
const nbCopy=x=>({...x,fields:{...x.fields},versions:(x.versions||[]).slice(),log:(x.log||[]).slice()});
function nbDirty(n){const saved=S.notes.find(x=>x.id===n.id);const f=n.fields||{};return saved?JSON.stringify(f)!==JSON.stringify(saved.fields||{}):Object.values(f).some(v=>v)}
// Estado del guardado de la nota abierta (solo modo Supabase): guardado, sin guardar, guardando o conflicto.
let NSAVING=null;
function nbLive(n){const m={...n,fields:{...n.fields}};if(n.id===S.sel.editing&&n.status!=='firmada')readNote(m);return m}
function nbState(n){if(n.conflict)return['bad','Conflicto: hay una versión guardada más reciente'];if(NSAVING===n.id)return['','Guardando…'];if(n.unsaved||nbDirty(n))return['warn','Sin guardar'];return['ok',n.version?`Guardado · versión ${n.version}`:'Guardado']}
function nbStateHTML(n){const[c,t]=nbState(n);return`<span class="chip ${c}" id="nb-state" role="status" aria-live="polite">${t}</span>`}
function nbMark(){const n=S.sel.editing?edNote(S.sel.editing):null;const el=document.getElementById('nb-state');if(!n||!el)return;const[c,t]=nbState(nbLive(n));el.className=`chip ${c}`;el.textContent=t}
const P=id=>S.patients.find(p=>p.id===id);
const SV=id=>S.services.find(s=>s.id===id);
const ME={psicologa:'Psicóloga',recepcion:'Recepción',gestoria:'Gestoría externa',agenda:'Solo calendario'};
const ROLE_L={psicologa:'Psicóloga',recepcion:'Recepción',gestoria:'Gestoría',agenda:'Solo calendario'};
const ROLE_D={psicologa:'Todo: ve y edita toda la consulta',recepcion:'Agenda, pacientes y facturación, sin notas clínicas',gestoria:'Ingresos, gastos, impuestos y libros, sin datos clínicos',agenda:'Solo el calendario, por código y sin hacer cambios'};
const curUser=()=>(S.users||[]).find(u=>u.id===S.userId)||{role:S.role,name:ME[S.role],titular:!!W&&S.role==='psicologa'};
const uName=u=>u.titular?S.pro.name:u.name;
const calView=()=>isMob()&&!S.cal.picked?'dia':S.cal.mode;
function nextWorkDay(){for(let i=0;i<21;i++){const d=addDays(TODAY,i);if(((AVAIL[dow(d)]||[]).length&&!blockOn(d))||apptsOn(d).some(a=>a.status!=='cancelada'))return d}return TODAY}
const noEdit=()=>S.role==='gestoria'||S.role==='agenda';
function userOptions(short){return (S.users||[]).map(u=>{const n=uName(u).replace(/\s*\(.*?\)\s*/g,' ').trim();return `<option value="${u.id}" ${u.id===S.userId?'selected':''}>${esc(short?n.split(/\s+/).slice(0,2).join(' '):uName(u))} · ${ROLE_L[u.role]}</option>`}).join('')}
function setUser(id){if(W)return;const u=S.users.find(x=>x.id===id)||S.users[0];S.userId=u.id;S.role=u.role;if(noEdit())S.sel.patient=null;S.sel.editing=null;REVEAL={};closeModal();render()}
const pc=p=>p?`<span class="pc">${p.code}</span>`:'';
function auditAs(who,what){S.audit.unshift({at:new Date().toISOString(),who,what})}
function audit(what){S.audit.unshift({at:new Date().toISOString(),who:uName(curUser()),what});if(S.audit.length>300)S.audit.length=300}
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,2800)}
function mail(to,subject,body,kind,status){S.outbox.unshift({id:nid('m'),at:new Date().toISOString(),to,subject,body,kind,status:status||'enviado'})}
function invStatus(i){if(i.kind==='R')return'rectificativa';if(i.status==='borrador'||i.status==='rectificada')return i.status;const t=tot(i);if(t.pending<=0)return'cobrada';if(t.paid>0)return i.due<TODAY?'vencida':'parcial';if(i.due<TODAY)return'vencida';return i.sent?'enviada':'emitida'}
const CHIP={confirmada:'acc',pendiente:'warn',realizada:'ok',cancelada:'',ausencia:'bad',borrador:'warn',emitida:'info',enviada:'info',parcial:'warn',cobrada:'ok',vencida:'bad',rectificada:'',rectificativa:'clin',firmada:'ok',activo:'ok',nuevo:'info','alta terapéutica':'','por revisar':'warn',revisado:'ok',pagado:'ok',presentado:'ok',vencido:'bad',enviado:'ok','pendiente de aprobación':'warn',conciliado:'ok','sin conciliar':'warn',pagada:'ok'};
const chip=s=>`<span class="chip ${CHIP[s]??''}">${esc(s[0].toUpperCase()+s.slice(1))}</span>`;
const toLabel=i=>i.patientId&&P(i.patientId)?`${P(i.patientId).code}`:i.to.name;

function apptsOn(d){return S.appts.filter(a=>a.date===d).sort((a,b)=>a.start-b.start)}
function noteFor(a){return S.notes.find(n=>n.apptId===a.id)}
function pendingNotes(){return S.appts.filter(a=>a.status==='realizada'&&(!noteFor(a)||noteFor(a).status==='borrador')&&a.date>=addDays(TODAY,-30)).sort((a,b)=>b.date.localeCompare(a.date))}
function unbilled(){return S.appts.filter(a=>a.status==='realizada'&&!a.invoiceId)}
function unmatched(){return S.bank.filter(b=>!b.match)}
function occupancy(mon){let avail=0,booked=0;for(let i=0;i<7;i++){(AVAIL[i]||[]).forEach(([a,b])=>avail+=b-a);booked+=apptsOn(addDays(mon,i)).filter(a=>a.status!=='cancelada').reduce((s,a)=>s+a.dur,0)}return{avail:Math.round(avail/60),booked:Math.round(booked/60*10)/10,pct:avail?Math.round(booked/avail*100):0}}

/* ===== correo de confirmación de cada mañana ===== */
const remBody=a=>`Te recordamos tu cita en la consulta de ${S.pro.name} el ${fDs(a.date)} a las ${hm(a.start)} (${a.loc}). Si no puedes venir, avísanos cuanto antes para dejar el hueco a otra persona.`;
function runReminders(){
  if(!S.settings.reminder)return 0;
  const now=Date.now(),H=(S.settings.reminderH||24)*3600000;let n=0;
  S.appts.forEach(a=>{
    if(!['pendiente','confirmada'].includes(a.status)||a.remSent)return;
    const t=parse(a.date).getTime()+a.start*60000;if(t<=now||t>now+H)return;
    if(a.date===TODAY&&S.settings.dailyConfirm)return;
    const made=a.log&&a.log[0]?Date.parse(a.log[0].at):0;if(made>t-H)return;
    const p=P(a.patientId);if(!p||p.reminders===false)return;
    mail(p.email,'Recordatorio de tu cita',remBody(a),'Cita');S.outbox[0].apptId=a.id;
    a.remSent=TODAY;a.log.push({at:new Date().toISOString(),who:'Sistema',what:'Recordatorio de la cita enviado'});n++});
  if(n)auditAs('Sistema',`Recordatorio enviado a ${n} ${n===1?'paciente':'pacientes'}`);
  return n;
}
const dayBody=a=>`Hoy tienes cita en la consulta de ${S.pro.name} a las ${hm(a.start)} en ${a.loc}. Por favor, confirma tu asistencia.`;
function runDaily(force){
  if(!force){if(!S.settings.dailyConfirm)return 0;if(nowMin()<toMin(S.settings.dailyHour||'08:00'))return 0}
  const nm=nowMin();let n=0;
  apptsOn(TODAY).forEach(a=>{
    if(!['pendiente','confirmada'].includes(a.status)||a.dayMail===TODAY||a.dayOk===TODAY||a.start+a.dur<=nm)return;
    const p=P(a.patientId);if(!p||p.reminders===false)return;
    mail(p.email,'Confirma tu cita de hoy',dayBody(a),'Cita');S.outbox[0].apptId=a.id;
    a.dayMail=TODAY;a.status='pendiente';a.log.push({at:new Date().toISOString(),who:'Sistema',what:'Correo de confirmación del día enviado'});n++});
  if(n)auditAs('Sistema',`Correo de confirmación enviado a ${n} ${n===1?'paciente':'pacientes'}`);
  return n;
}

/* ===== porcentaje deducible ===== */
const dedCat=c=>((W?S.settings.ded:S.ded)||{})[c]??100;
const dedOf=e=>e.ded!=null?e.ded:dedCat(e.cat);
const dedAmt=e=>Math.round((e.base+e.iva)*dedOf(e)/100);
const pctVal=id=>{const v=val(id);return v===''?null:Math.min(100,Math.max(0,Number(v)||0))};

/* ===== gastos fijos: se registran solos cada mes ===== */
const fxIva=f=>Math.round(f.base*f.ivaPct/100);
const fxRet=f=>Math.round(f.base*f.retPct/100);
const fxTotal=f=>f.base+fxIva(f)-fxRet(f);
const nextMonth=k=>{const[y,m]=k.split('-').map(Number);return m===12?`${y+1}-01`:`${y}-${pad(m+1)}`};
function runFixed(){
  if(!S.fixed)return;const cur=ym(TODAY);
  S.fixed.forEach(f=>{if(!f.active)return;
    for(let k=f.since;k<=cur;k=nextMonth(k)){
      const[y,m]=k.split('-').map(Number);const date=`${k}-${pad(Math.min(f.day,Number(lastDay(y,m).slice(8))))}`;
      if(date>TODAY||S.fixedSkip[f.id+'-'+k]||S.expenses.some(e=>e.fixedId===f.id&&ym(e.date)===k))continue;
      S.expenses.push({id:nid('g'),date,supplier:f.name,nif:'',cat:f.cat,concept:'Gasto fijo mensual',base:f.base,iva:fxIva(f),ret:fxRet(f),total:fxTotal(f),method:'Domiciliación',num:'',status:'revisado',source:'gasto fijo',photo:null,fixedId:f.id,ded:f.ded});
    }});
}

/* ===== datos nuevos sobre el estado guardado ===== */
function migrate(){
  // Modo conectado: nada de datos de ejemplo ni automatismos locales. Lo nuevo sin servidor queda vacío.
  if(W){S.settings=Object.assign({dailyHour:'08:00'},S.settings,{dailyConfirm:false});S.ded=S.settings.ded||{};S.fixedSkip={};S.users=[];S.fixed=S.fixed||[];S.blocks=S.blocks||[];S.outbox=S.outbox||[];return}
  S.settings=Object.assign({dailyConfirm:true,dailyHour:'08:00'},S.settings);
  S.ded=S.ded||{};S.fixedSkip=S.fixedSkip||{};S.cal.date=nextWorkDay();
  if(!S.users)S.users=[{id:'u1',titular:true,name:'',email:'',role:'psicologa'},{id:'u2',name:'Ana Ruiz Prieto (ficticia)',email:'recepcion@ejemplo.es',role:'recepcion'},{id:'u3',name:'Gestoría Ejemplo',email:'gestor@gestoria-ejemplo.es',role:'gestoria'},{id:'u4',name:'Compañero de consulta (ficticio)',email:'companero@ejemplo.es',role:'agenda'}];
  if(!S.users.some(u=>u.id===S.userId))S.userId=(S.users.find(u=>u.role===S.role)||S.users[0]).id;
  S.role=curUser().role;
  if(!S.fixed){
    const since=monthsBack(7)[0];
    S.fixed=[['Alquiler del despacho','Alquiler',1,45000,21,19,'Inmobiliaria Ejemplo SL'],['Luz','Suministros',5,3900,21,0,'Compañía Eléctrica Ejemplo'],['Fibra y móvil','Suministros',8,3300,21,0,'Operador Telecom Ejemplo'],['Gestoría','Gestoría y asesoría',10,6000,21,0,'Gestoría Ejemplo'],['Software','Tecnología y software',12,2400,21,0,'Software Ejemplo SaaS'],['Cuota de autónomos','Cuotas e impuestos',28,29400,0,0,'Tesorería General de la Seguridad Social']].map(([name,cat,day,base,ivaPct,retPct,sup])=>{
      const id=nid('fx');S.expenses.forEach(e=>{if(e.supplier===sup)e.fixedId=id});
      return{id,name,cat,day,base,ivaPct,retPct,ded:null,active:true,since}});
  }
  if(!S.dxSeeded){
    S.dxSeeded=true;const p=S.patients[0];const t=nid('t');
    p.tests=[{id:t,name:'Inventario de Depresión de Beck (BDI-II)',date:addDays(TODAY,-30),result:'24 puntos: sintomatología moderada.',file:null,url:null,isImg:false}];
    p.dx=[{id:nid('dx'),title:'Trastorno depresivo persistente (ejemplo ficticio)',date:addDays(TODAY,-28),text:'Valoración a partir de la entrevista clínica y de la prueba aplicada.',tests:[t],author:S.pro.name}];
  }
  (S.notes||[]).forEach(n=>{if(n.author==='Laura Benítez')n.author=S.pro.name});
  if(!S.prepSeeded){S.prepSeeded=true;const lastNote=pid=>S.notes.filter(n=>n.patientId===pid&&n.type==='sesion').sort((x,y)=>y.created.localeCompare(x.created))[0];
    const n0=lastNote(S.patients[0].id);if(n0)n0.fields.proxima='Preguntar cómo fue la conversación con su jefa.';
    const p2=S.patients[2];const n2=lastNote(p2&&p2.id);if(n2){n2.risk=true;n2.fields.proxima='Revisar plan de seguridad.'}
    const p3=S.patients[3];if(p3&&!(p3.tests||[]).length){p3.tests=[{id:nid('t'),name:'Inventario de Ansiedad de Beck (BAI)',date:addDays(TODAY,-90),result:'22 puntos: ansiedad moderada.',file:null,url:null,isImg:false}]}}
  if(!S.pauseSeeded){S.pauseSeeded=true;[8,19].forEach(i=>{const p=S.patients[i];if(!p||p.status==='alta terapéutica')return;S.appts.forEach(a=>{if(a.patientId===p.id&&a.date>=TODAY&&['pendiente','confirmada'].includes(a.status)){a.status='cancelada';a.cancelReason='El paciente pidió una pausa'}})})}
  if(!S.blocks){S.blocks=[{id:nid('b'),from:YEAR+'-12-08',to:YEAR+'-12-08',label:'Inmaculada Concepción'},{id:nid('b'),from:YEAR+'-12-24',to:(YEAR+1)+'-01-06',label:'Vacaciones de Navidad'}].filter(b=>b.to>=TODAY);S.appts=S.appts.filter(a=>!(a.date>=TODAY&&blockOn(a.date)))}
  if(!S.testsSeeded){S.testsSeeded=true;const p=S.patients[0];const b=(p.tests||[]).find(x=>/BDI/.test(x.name));
    if(b&&p.tests.length===1){[[-120,'31 puntos: sintomatología grave.'],[-75,'28 puntos: sintomatología moderada.'],[-3,'19 puntos: sintomatología leve.']].forEach(([d,r])=>p.tests.push({id:nid('t'),name:b.name,date:addDays(TODAY,d),result:r,file:null,url:null,isImg:false}))}}
}

/* ===== impuestos (estimación orientativa) ===== */
const lastDay=(y,m)=>iso(new Date(y,m,0));
function quarterRange(y,q){return[`${y}-${pad(q*3-2)}-01`,lastDay(y,q*3)]}
function taxes(){
  const out=[];const y=YEAR;
  const firstData=[...S.invoices.map(i=>i.date),...S.expenses.map(e=>e.date)].sort()[0]||TODAY;
  let prev130=0;
  for(let q=1;q<=4;q++){
    const[qs,qe]=quarterRange(y,q);if(qe<firstData)continue;if(qs>addDays(TODAY,100))continue;
    const inYTD=d=>d>=`${y}-01-01`&&d<=qe,inQ=d=>d>=qs&&d<=qe;
    const em=S.invoices.filter(i=>i.num);
    const ing=em.filter(i=>inYTD(i.date)).reduce((a,i)=>a+tot(i).base,0);
    const ret=em.filter(i=>inYTD(i.date)).reduce((a,i)=>a+tot(i).ret,0);
    const gas=S.expenses.filter(e=>inYTD(e.date)).reduce((a,e)=>a+dedAmt(e),0)+S.payrolls.filter(n=>inYTD(n.date)).reduce((a,n)=>a+n.coste,0);
    const m130=Math.max(0,Math.round((ing-gas)*.2)-ret-prev130);prev130+=m130;
    const m115=S.expenses.filter(e=>e.cat==='Alquiler'&&inQ(e.date)).reduce((a,e)=>a+e.ret,0);
    const m111=S.payrolls.filter(n=>inQ(n.date)).reduce((a,n)=>a+n.irpf,0);
    const m303=em.filter(i=>inQ(i.date)).reduce((a,i)=>a+tot(i).iva,0);
    const due4=q===4?`${y+1}-01-30`:`${y}-${pad(q*3+1)}-20`;const due4b=q===4?`${y+1}-01-20`:due4;
    const partial=qs<firstData;
    out.push({key:`130-${y}-${q}`,model:'Modelo 130',name:'Pago fraccionado IRPF',period:`${q}T ${y}`,due:due4,amount:m130,calc:`20 % de (ingresos ${eur(ing)} − gastos deducibles ${eur(gas)}) − retenciones ${eur(ret)} − pagos anteriores`,partial});
    if(m115||q<=qOf(TODAY))out.push({key:`115-${y}-${q}`,model:'Modelo 115',name:'Retenciones del alquiler',period:`${q}T ${y}`,due:due4b,amount:m115,calc:'19 % de la base del alquiler del trimestre'});
    if(m111||S.payrolls.length)out.push({key:`111-${y}-${q}`,model:'Modelo 111',name:'Retenciones de nóminas',period:`${q}T ${y}`,due:due4b,amount:m111,calc:'IRPF retenido en las nóminas del trimestre'});
    if(m303)out.push({key:`303-${y}-${q}`,model:'Modelo 303',name:'IVA trimestral',period:`${q}T ${y}`,due:due4,amount:m303,calc:'IVA repercutido de servicios no sanitarios (prorrata a validar)'});
  }
  S.payrolls.forEach(n=>out.push({key:`rlc-${n.month}`,model:'Seguros sociales',name:'Cotización de personal (RLC)',period:monthLong(n.month),due:lastDay(Number(n.month.slice(0,4)),Number(n.month.slice(5,7))+1),amount:n.ssE+n.ssT,calc:'Cuota empresa + cuota trabajador'}));
  out.push({key:`180-${y}`,model:'Modelo 180',name:'Resumen anual retenciones alquiler',period:`Anual ${y}`,due:`${y+1}-01-31`,amount:0,calc:'Informativo'});
  out.push({key:`190-${y}`,model:'Modelo 190',name:'Resumen anual retenciones trabajo',period:`Anual ${y}`,due:`${y+1}-01-31`,amount:0,calc:'Informativo'});
  out.push({key:`347-${y}`,model:'Modelo 347',name:'Operaciones con terceros',period:`Anual ${y}`,due:`${y+1}-02-28`,amount:0,calc:'Informativo'});
  return out.map(o=>({...o,paid:S.oblPaid[o.key]||null,state:S.oblPaid[o.key]?(o.amount?'pagado':'presentado'):o.due<TODAY?'vencido':'pendiente'})).sort((a,b)=>a.due.localeCompare(b.due));
}

/* ===== navegación ===== */
const NAV=[['inicio','Dashboard',['psicologa','recepcion'],'Inicio','work'],['calendario','Calendario',['psicologa','recepcion','agenda'],'Agenda','work'],['pacientes','Pacientes',['psicologa','recepcion'],'Pacientes','work'],['informes','Informes clínicos',['psicologa'],'Informes','work'],['seguimiento','Seguimiento terapéutico',['psicologa'],'Seguimiento','work'],['contabilidad','Facturación',['psicologa','recepcion','gestoria'],'Facturación','work'],['config','Ajustes',['psicologa'],'Ajustes','menu'],['ayuda','Ayuda y soporte',['psicologa','recepcion','gestoria','agenda'],'Ayuda','menu']];
// En modo conectado, Ajustes también lo abre la administración que no es psicóloga (pestañas de la clínica, no las clínicas).
const seen=n=>n[2].includes(S.role)||(n[0]==='config'&&!!(CN&&CN.isAdmin()));
const can=v=>seen(NAV.find(n=>n[0]===v));
function todos(){
  const T=[];const isPsi=S.role==='psicologa';
  const pn=pendingNotes();const noNote=pn.filter(a=>!noteFor(a)),draftN=pn.filter(a=>noteFor(a));
  const halfAll=S.notes.filter(n=>n.status==='borrador').length;
  if(isPsi&&(noNote.length||halfAll))T.push({cls:'clin',ic:IC.pen,t:'Informes pendientes',d:'Sesiones con el informe sin terminar',n:noNote.length+halfAll,act:'goNotes',f:'pendientes'});
  const nc=S.patients.filter(p=>!p.consent&&p.status!=='alta terapéutica');
  if(nc.length)T.push({cls:'warn',ic:IC.upload,t:'Consentimientos por subir',d:nc.map(p=>p.code).join(' · '),n:nc.length,act:'openPatient',id:nc[0].id,tab:'docs'});
  const inB=S.role==='gestoria'?[]:S.appts.filter(a=>['pendiente','confirmada'].includes(a.status)&&a.date>=TODAY&&blockOn(a.date)).sort((a,b)=>a.date.localeCompare(b.date));
  if(inB.length)T.push({cls:'bad',ic:IC.cal,t:'Citas en días cerrados',d:'Caen en vacaciones o festivo · muévelas o cancélalas',n:inB.length,act:'openAppt',id:inB[0].id});
  const conf=S.appts.filter(a=>a.status==='pendiente'&&a.date>=TODAY);
  if(conf.length)T.push({cls:'warn',ic:IC.cal,t:'Citas por confirmar',d:'Esperando respuesta del paciente',n:conf.length,act:'pendList'});
  const nm=nowMin();const toClose=S.appts.filter(a=>['confirmada','pendiente'].includes(a.status)&&(a.date<TODAY||(a.date===TODAY&&a.start+a.dur<=nm))).sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start);
  if(toClose.length){const old=toClose.filter(a=>a.date<TODAY).length;T.push({cls:old?'warn':'',ic:IC.cal,t:'Sesiones por cerrar',d:old?`${old} de días anteriores · márcalas como realizadas o ausencia`:'Márcalas como realizadas o ausencia',n:toClose.length,act:'openAppt',id:toClose[0].id})}
  if(S.role!=='recepcion'){
    const rev=S.expenses.filter(e=>e.status==='por revisar');
    if(rev.length)T.push({cls:'warn',ic:IC.cam,t:'Facturas escaneadas por revisar',d:'Comprueba nombre y categoría',n:rev.length,act:'goAcc',tab:'facturas'});
    const um=unmatched();if(um.length)T.push({cls:'',ic:IC.bank,t:'Movimientos bancarios sin conciliar',d:'Relaciónalos con facturas o gastos',n:um.length,act:'goAcc',tab:'banco'});
    const tx=taxes().filter(o=>!o.paid&&o.amount>0&&o.due<=addDays(TODAY,45));
    if(tx.length)T.push({cls:tx.some(o=>o.state==='vencido')?'bad':'',ic:IC.tax,t:'Impuestos próximos',d:`${tx[0].model} vence el ${fD(tx[0].due)}`,n:tx.length,act:'goAcc',tab:'impuestos'});
  }
  const ub=unbilled();if(ub.length&&S.role!=='gestoria')T.push({cls:'',ic:IC.doc,t:'Sesiones sin facturar',d:'Se facturan al firmar la nota · las de empresa, a final de mes',n:ub.length,act:'goAcc',tab:'facturas'});
  const rk=c=>c==='bad'?0:c==='warn'?1:2;
  return T.map((t,i)=>[t,i]).sort((a,b)=>rk(a[0].cls)-rk(b[0].cls)||a[1]-b[1]).map(x=>x[0]);
}
const LOGO='data:image/png;base64,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';
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const initials=n=>String(n||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();
const avStyle=()=>'';
const LOC=()=>S.pro.loc||'Despacho Málaga Centro';
const isMob=()=>window.matchMedia('(max-width:860px)').matches;
const effTheme=()=>'light';
function applyTheme(){}
function navBadges(){
  const pn=S.role==='psicologa'?pendingNotes().length:0;
  const acc=S.role!=='recepcion'?S.expenses.filter(e=>e.status==='por revisar').length+unmatched().length:0;
  return{informes:pn,contabilidad:acc};
}
function renderNav(){
  const badge=navBadges();const vis=NAV.filter(n=>seen(n)&&n[4]==='work');
  const item=n=>`<button data-act="go" data-v="${n[0]}" ${S.view===n[0]?'aria-current="page"':''}>${SVG(NAVI[n[0]])}<span>${n[1]}</span>${badge[n[0]]?`<span class="badge">${badge[n[0]]}</span>`:''}</button>`;
  document.getElementById('nav').innerHTML=`<div class="navlabel">Espacio de trabajo</div>${vis.map(item).join('')}`;
  const dk=n=>`<button data-act="go" data-v="${n[0]}" aria-label="${n[1]}" ${S.view===n[0]?'aria-current="page"':''}><span class="pill">${SVG(NAVI[n[0]])}</span><span>${n[3]}</span>${badge[n[0]]?`<span class="badge">${badge[n[0]]}</span>`:''}</button>`;
  document.getElementById('dock').innerHTML=vis.filter(n=>n[0]!=='seguimiento').map(dk).join('');
  document.getElementById('role').innerHTML=userOptions(true);
}
function renderTop(){
  const psi=S.role==='psicologa';const who=uName(curUser());
  document.getElementById('top').innerHTML=`<span class="tb-brand"><img class="logo" src="${LOGO}" alt=""><b>KOVO</b></span>${!noEdit()?`<label class="tsearch">${SVG(IC.search)}<input type="search" id="gq" placeholder="Buscar paciente por nombre o código" autocomplete="off" aria-label="Buscar paciente"></label>`:'<span style="flex:1"></span>'}
  <div class="tb-r"><div class="pwrap"><button class="avatar-btn" data-act="pmenu" aria-label="Perfil, ajustes y ayuda" aria-haspopup="true">${esc(initials(who))}</button>
    <div class="pmenu" id="pmenu" hidden>
      <div class="pm-h"><span class="av">${esc(initials(who))}</span><div><b>${esc(who)}</b><span>${psi?'Psicóloga · titular':ROLE_L[S.role]}</span></div></div>
      ${psi?`<button data-act="goProfile">${SVG(IC.user)}Perfil profesional</button>`:''}${can('config')?`<button data-act="goSettings">${SVG(NAVI.config)}Ajustes</button>`:''}
      <button data-act="goHelp">${SVG(NAVI.ayuda)}Ayuda y soporte</button>
      ${CN?`<div class="cn-sep"></div><div class="pm-h" style="padding-top:2px"><div><b>${esc(S.org.name||'Clínica')}</b><span>${esc(S.org.userEmail||'')}</span></div></div>${S.org.multi?`<button data-act="cnSwitch">${SVG(IC.users)}Cambiar de clínica</button>`:''}<button data-act="cnLogout">${SVG(IC.lock)}Cerrar sesión</button>`:
      `<label class="field pm-role"><span>Ver como (prototipo)</span><select id="role3">${userOptions()}</select></label>`}
    </div></div></div>`;
}
let LASTV=null;
function render(){
  if(!W){runFixed();runDaily();runReminders()}
  if(!can(S.view))S.view=NAV.find(seen)[0];
  H0=Math.min(22,Math.max(0,S.settings.h0??9));H1=Math.max(H0+1,Math.min(24,S.settings.h1??21));
  renderNav();renderTop();
  const w=document.getElementById('view');
  w.innerHTML=VIEWS[S.view]();
  if(LASTV!==S.view){w.classList.remove('enter');void w.offsetWidth;w.classList.add('enter');LASTV=S.view;clearTimeout(window.__entT);window.__entT=setTimeout(()=>w.classList.remove('enter'),400)}else w.classList.remove('enter');
  document.querySelectorAll('textarea[data-nf]').forEach(autosize);
  initCarousel();
  w.querySelectorAll('table:not(.mcards)').forEach(t=>{if(t.querySelector('input,select,textarea'))return;const n=t.querySelectorAll('thead th').length;if(n&&n<=7)t.classList.add('mcards')});
  w.querySelectorAll('.tabs').forEach(t=>{const sel=t.querySelector('[aria-selected="true"]');if(sel&&sel.offsetLeft+sel.offsetWidth>t.clientWidth)t.scrollLeft=sel.offsetLeft-16;const f=()=>t.classList.toggle('more',t.scrollLeft+t.clientWidth<t.scrollWidth-4);f();t.addEventListener('scroll',f,{passive:true})});
  if(S.sel.scrollTo){const el=document.getElementById(S.sel.scrollTo);S.sel.scrollTo=null;if(el)el.scrollIntoView({block:'start'})}
  save();
}
function autosize(t){t.style.height='auto';t.style.height=Math.max(96,t.scrollHeight+2)+'px'}
function skeleton(){return `<div class="sk" style="height:34px;width:min(320px,70%)"></div><div class="sk" style="height:200px"></div><div class="grid3"><div class="sk" style="height:300px"></div><div class="sk" style="height:300px"></div></div>`}
const bellBtn=()=>{const n=todos().reduce((a,t)=>a+t.n,0);return `<button class="btn bell" data-act="bell" aria-label="Pendientes">${SVG(IC.bell)}${n?`<span class="dotn">${n}</span>`:''}</button>`};

/* ===== vistas ===== */
const VIEWS={};
const roleBanner=()=>S.role==='agenda'?`<div class="roleban">Vista de solo calendario: citas por código y sin hacer cambios. Sin acceso a pacientes, informes ni facturación.</div>`:S.role==='recepcion'?`<div class="roleban">Vista de recepción: agenda, datos administrativos y facturación. Sin acceso a notas clínicas.</div>`:S.role==='gestoria'?`<div class="roleban">Vista de gestoría: solo contabilidad. Los pacientes aparecen únicamente por su código.</div>`:'';

/* calendario reutilizable */
let H0=9,H1=21;
function weekGrid(days,px){
  const hgt=(H1-H0)*px;
  const times=Array.from({length:H1-H0},(_,i)=>`<span style="top:${i*px}px">${pad(H0+i)}:00</span>`).join('');
  const cols=days.map(d=>{
    const av=AVAIL[dow(d)]||[];let off='';let cur=H0*60;
    av.forEach(([a,b])=>{if(a>cur)off+=`<div class="off" style="top:${(cur-H0*60)/60*px}px;height:${(a-cur)/60*px}px"></div>`;cur=b});
    if(cur<H1*60)off+=`<div class="off" style="top:${(cur-H0*60)/60*px}px;height:${(H1*60-cur)/60*px}px"></div>`;
    const nm=nowMin();const now=d===TODAY&&nm>H0*60&&nm<H1*60?`<div class="now" style="top:${(nm-H0*60)/60*px}px"></div>`:'';
    const aps=apptsOn(d).map(a=>{const p=P(a.patientId);const h=a.dur/60*px-2;return `<button class="ap ${a.status}" style="top:${(a.start-H0*60)/60*px+1}px;height:${h}px" data-act="openAppt" data-id="${a.id}"><b>${p.code}</b>${h>30?`<span class="sl">${hm(a.start)} · ${esc(SV(a.service).name)}</span>`:''}</button>`}).join('');
    const bl=blockOn(d);return `<div class="col" style="height:${hgt}px;--px:${px}px" data-act="slot" data-d="${d}" data-px="${px}">${off}${bl?`<div class="blkov"><span>${esc(bl.label)}</span></div>`:''}${now}${aps}</div>`}).join('');
  const heads=days.map(d=>`<div class="${d===TODAY?'today':''}">${DAYN[dow(d)].slice(0,3)}<small>${parse(d).getDate()}</small></div>`).join('');
  return `<div class="cal-scroll"><div class="cal ${days.length===1?'day':''}" style="grid-template-columns:50px repeat(${days.length},minmax(0,1fr))"><div class="cal-h"><div></div>${heads}</div><div class="times" style="height:${hgt}px">${times}</div>${cols}</div></div>`;
}

VIEWS.inicio=()=>{
  const isPsi=S.role==='psicologa';const nm=nowMin();
  const T=todos();const nT=T.reduce((a,t)=>a+t.n,0);
  const mon=mondayOf(nextWorkDay());const days=Array.from({length:5},(_,i)=>addDays(mon,i));
  const todayList=apptsOn(TODAY).filter(a=>a.status!=='cancelada');
  let showD=TODAY;if(!todayList.length){for(let i=1;i<=21;i++){const d=addDays(TODAY,i);if(apptsOn(d).some(a=>a.status!=='cancelada')){showD=d;break}}}
  const isT=showD===TODAY;const nmx=isT?nm:-1;
  const today=isT?todayList:apptsOn(showD).filter(a=>a.status!=='cancelada');
  const nextIdx=today.findIndex(a=>a.start+a.dur>nmx&&['confirmada','pendiente'].includes(a.status));
  const focus=nextIdx>=0?nextIdx:Math.max(0,today.length-1);
  const next=today[nextIdx];
  const up=S.appts.filter(a=>['confirmada','pendiente'].includes(a.status)&&a.date>TODAY).sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start).slice(0,5);
  const h=new Date().getHours();const hi=h<13?'Buenos días':h<20?'Buenas tardes':'Buenas noches';
  const who=isPsi?', '+S.pro.name.split(' ')[0]:'';
  const rel=d=>d===addDays(TODAY,1)?'Mañana':fDs(d);
const upDay=d=>{const t=parse(d).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});return t[0].toUpperCase()+t.slice(1)};
  const card=(a,i)=>{
    const p=P(a.patientId);const n=noteFor(a);const ended=a.start+a.dur<=nmx;const open=['confirmada','pendiente'].includes(a.status);const inProg=open&&a.start<=nmx&&!ended;
    const lbl=a.status==='realizada'?'Realizada':a.status==='ausencia'?'Ausencia':inProg?'En curso':i===nextIdx?'Siguiente sesión':ended?'Terminada · sin cerrar':'Programada';
    const live=isT&&(inProg||i===nextIdx);
    let main='';
    if(open&&ended)main=isPsi?`<button class="btn primary" data-act="fillNote" data-id="${a.id}">Cerrar y rellenar informe</button>`:`<button class="btn primary" data-act="done" data-id="${a.id}">Marcar realizada</button>`;
    else if(a.status==='pendiente')main=`<button class="btn primary" data-act="confirm" data-id="${a.id}">Confirmar</button>`;
    else if(a.status==='realizada'&&isPsi&&(!n||n.status==='borrador'))main=`<button class="btn primary" data-act="fillNote" data-id="${a.id}">${n?'Terminar informe':'Rellenar informe'}</button>`;
    return `<article class="next ${['realizada','ausencia'].includes(a.status)?'done':''}" ${i===focus?'data-focus="1"':''}>
      <div class="nl">${live?'<span class="live"></span>':''}${lbl}<span class="ncount">${i+1} / ${today.length}</span></div>
      <div class="nt">${hm(a.start)} – ${hm(a.start+a.dur)}</div>
      <div class="ncode"><span class="pc big">${p.code}</span>${a.status==='pendiente'?'<span class="nflag">Sin confirmar</span>':''}</div>
      <div class="ns">${esc(modeL(a))}${a.notes?`<br>${esc(a.notes)}`:''}</div>
      <div class="na"><button class="btn" data-act="openPatient" data-id="${p.id}">Ficha</button><button class="btn" data-act="openAppt" data-id="${a.id}">${isPsi?(main?'Preparar':'Preparar sesión'):'Detalles'}</button>${main}</div></article>`;
  };
  const reps=todayList.filter(a=>a.status!=='ausencia');
  const repRow=a=>{const n=noteFor(a);const ended=a.start+a.dur<=nm;let act;
    if(n&&n.status==='firmada')act=`<span class="chip ok">Firmado</span><button class="btn sm ghost" data-act="openNote" data-id="${n.id}">Ver</button>`;
    else if(n)act=`<span class="chip warn">A medias</span><button class="btn sm primary" data-act="fillNote" data-id="${a.id}">Continuar</button>`;
    else if(ended||a.status==='realizada')act=`<button class="btn sm primary" data-act="fillNote" data-id="${a.id}">Rellenar informe</button>`;
    else act=`<span class="muted small">Disponible a las ${hm(a.start+a.dur)}</span>`;
    return `<div class="row"><div class="t">${hm(a.start)}</div><div class="m"><b>${pc(P(a.patientId))} ${esc(SV(a.service).name)}</b>${a.service==='s3'?`<span>${NOTE_T.inicial}</span>`:''}</div>${act}</div>`};
  const toFill=reps.filter(a=>{const n=noteFor(a);return !(n&&n.status==='firmada')}).length;
  return `${roleBanner()}
  <div class="head"><div><div class="eyebrow">${fDl(TODAY)}</div><h1>${hi}${esc(who)}</h1><p class="today-count">${todayList.length?`Hoy tienes <b>${todayList.length}</b> ${todayList.length===1?'cita':'citas'}${next?` · la siguiente a las ${hm(next.start)}`:''}`:'Hoy no tienes citas'}</p></div>
  <div class="actions hide-m"><button class="btn" data-act="newPatient">${SVG(IC.user)}Nuevo paciente</button><button class="btn primary" data-act="newAppt">${SVG(IC.cal)}Nueva cita</button></div></div><button class="fab" data-act="fabMenu" aria-label="Crear">${SVG(IC.plus)}</button>
  <div class="home">
    <div class="home-side">
      <section class="car-wrap"><div class="car-h"><h2>${isT?'Citas de hoy':'Próximas citas · '+(showD===addDays(TODAY,1)?'mañana':fDs(showD))}</h2><div class="car-nav"><button class="btn sm" data-act="carMove" data-n="-1" aria-label="Cita anterior">‹</button><button class="btn sm" data-act="carMove" data-n="1" aria-label="Cita siguiente">›</button></div></div>
        <div class="car" id="car">${today.length?today.map(card).join(''):`<article class="next" data-focus="1"><div class="nl">Agenda</div><div class="nt">Sin citas</div><div class="ns">No hay citas en las próximas tres semanas.</div><div class="na"><button class="btn primary" data-act="newAppt">Nueva cita</button></div></article>`}</div>
        ${today.length>1?`<div class="car-dots" id="cardots">${today.map(()=>'<i></i>').join('')}</div>`:''}</section>
      <section class="panel todo-panel"><header><h2>Pendiente</h2><span class="muted small">${T.length?T.length+(T.length===1?' aviso':' avisos'):'Todo al día'}</span></header>
        ${(()=>{const row=t=>`<button class="todo ${t.cls}" data-act="${t.act}" data-id="${t.id||''}" data-f="${t.f||''}" data-tab="${t.tab||''}"><span class="ic">${SVG(t.ic)}</span><span class="tx"><b>${t.t}</b><span>${esc(t.d)}</span></span><span class="n">${t.n}</span></button>`;
          if(!T.length)return '<div class="list"><div class="empty">Nada pendiente.</div></div>';
          const k=Math.max(3,T.filter(t=>t.cls==='bad'||t.cls==='warn').length);const vis=T.slice(0,k),rest=T.slice(k);
          const ml=`Ver ${rest.length} ${rest.length===1?'aviso más':'avisos más'}`;
          return `<div class="list">${T.map((t,i)=>row(t).replace('class="todo ','class="todo '+(i>=k?'xtra ':''))).join('')}</div>${rest.length?`<button class="todo-more" data-act="todosMore" data-more="${ml}">${ml}</button>`:''}`})()}</section>
    </div>
    <aside class="home-side hide-m">
      <section class="panel"><header><h2>Semana</h2><div class="seg wk-seg">${[['m','Mañana'],['t','Tarde']].map(([k,l])=>`<button data-act="wkHalf" data-h="${k}" aria-pressed="${wkH()===k}">${l}</button>`).join('')}</div></header>${weekMap(days,{compact:true,half:wkH()})}<button class="card-link wk-more" data-act="goCal">Abrir calendario</button></section>
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

function wkH(){return S.sel.wkHalf||(nowMin()>=14*60?'t':'m')}
function weekMap(days,o){o=o||{};
  const nm=nowMin();const rows=[];
  for(let h=H0;h<H1;h++){const t=h*60;if(o.half==='m'&&h>=15||o.half==='t'&&h<15)continue;if(days.some(d=>(AVAIL[dow(d)]||[]).some(([a,b])=>t>=a&&t<b)||apptsOn(d).some(x=>Math.floor(x.start/60)===h&&x.status!=='cancelada')))rows.push(h)}
  const head='<div class="wm-corner"></div>'+days.map(d=>{const bl=blockOn(d);return `<div class="wm-day ${d===TODAY?'today':''} ${d<TODAY?'past':''}"><span>${DAYN[dow(d)].slice(0,3)}</span><b>${parse(d).getDate()}</b>${bl&&!o.compact?`<i title="${esc(bl.label)}">${esc(bl.label)}</i>`:''}</div>`}).join('');
  const firstRow=rows[0];
  const LBL={pendiente:'Por confirmar',ausencia:'Ausencia',realizada:'Realizada'};
  let prev=null;
  const cells=rows.map(h=>{
    const gap=prev!==null&&h>prev+1?'<div class="wm-gap"></div>':'';prev=h;
    return gap+`<div class="wm-time">${pad(h)}:00</div>`+days.map(d=>{
      const t=h*60;const ap=apptsOn(d).filter(x=>Math.floor(x.start/60)===h&&x.status!=='cancelada');
      const inAv=(AVAIL[dow(d)]||[]).some(([a,b])=>t>=a&&t<b);const cls=`${d===TODAY?'tcol':''} ${d<TODAY?'pday':''}`;
      const bl=blockOn(d);
      if(ap.length){const a=ap[0];const dr=!o.compact&&!noEdit()&&['pendiente','confirmada'].includes(a.status)&&d>=TODAY;return `<button class="wm-c busy ${a.status} ${cls} ${bl&&['pendiente','confirmada'].includes(a.status)?'inblock':''}" data-act="openAppt" data-id="${a.id}" ${dr?'data-drag="1"':''} title="${hm(a.start)} · ${esc(SV(a.service).name)} · ${a.status}${dr?' · arrastra para moverla':''}">${a.seriesId&&!o.compact?`<span class="wm-rep" aria-label="Se repite">${REPSVG}</span>`:''}<span class="wm-p">${P(a.patientId).code}${ap.length>1?` +${ap.length-1}`:''}</span>${a.start%60?`<span class="wm-s">${hm(a.start)}</span>`:''}${o.compact?'':`<span class="wm-s">${LBL[a.status]||esc(SV(a.service).name)}</span>`}</button>`}
      if(bl)return `<div class="wm-c closed ${cls}">${h===firstRow&&!o.compact?`<span class="wm-s">Cerrado</span>`:''}</div>`;
      const past=d<TODAY||(d===TODAY&&t+60<=nm);
      if(inAv&&!past&&!noEdit())return `<button class="wm-c free ${cls}" data-act="slotNew" data-d="${d}" data-t="${t}" aria-label="Crear cita el ${fDs(d)} a las ${pad(h)}:00"><span class="wm-l">Libre</span></button>`;
      return `<div class="wm-c ${inAv?'free past':'off'} ${cls}"></div>`}).join('')}).join('');
  return `<div class="wmap ${o.compact?'compact':''}" style="--cols:${days.length}">${head}${cells}</div>`;
}
const MAP_LEGEND=`<div class="legend"><span><i style="background:var(--surface);box-shadow:inset 3px 0 0 var(--accent),inset 0 0 0 1px var(--line-2)"></i>Confirmada</span><span><i style="background:var(--warn-soft);box-shadow:inset 3px 0 0 var(--warn)"></i>Por confirmar</span><span><i style="background:var(--tint);box-shadow:inset 3px 0 0 var(--line-2)"></i>Realizada</span><span><i style="background:var(--bad-soft);box-shadow:inset 3px 0 0 var(--bad)"></i>Ausencia</span><span><i style="background:var(--tint-2)"></i>Libre</span><span><i style="background:repeating-linear-gradient(135deg,var(--warn) 0 1.5px,var(--warn-soft) 1.5px 4px)"></i>Cerrado</span></div>`;
VIEWS.calendario=()=>{
  const c=S.cal;const mob=isMob();const mode=calView();let label,body;
  const mon=mondayOf(c.date);const nDays=(AVAIL[6]||[]).length||apptsOn(addDays(mon,6)).length?7:((AVAIL[5]||[]).length||apptsOn(addDays(mon,5)).length?6:5);
  const week=Array.from({length:nDays},(_,i)=>addDays(mon,i));
  const cnt=d=>apptsOn(d).filter(a=>a.status!=='cancelada').length;
  let legend=`<div class="cal-sub">${MAP_LEGEND}<div class="cal-tools hide-m">${noEdit()?'':'<span class="muted small">Arrastra una cita para moverla</span>'}${S.role==='psicologa'?'<button class="card-link" data-act="goBlocks">Vacaciones y festivos</button>':''}</div></div>`;
  if(mode==='mes'){
    const d=parse(c.date);const first=iso(new Date(d.getFullYear(),d.getMonth(),1));const start=mondayOf(first);
    label=d.toLocaleDateString('es-ES',{month:'long'})+' '+d.getFullYear();
    let cells='';for(let i=0;i<42;i++){const day=addDays(start,i);const list=apptsOn(day);
      if(ym(day)!==ym(first)){if(i>=35&&ym(addDays(start,35))!==ym(first))break;if(i===0){const lead=dow(first);if(lead>=3){cells+=`<div class="mlabel" style="grid-column:span ${lead}"><b>${esc(d.toLocaleDateString('es-ES',{month:'long'}))}</b><span>${d.getFullYear()}</span></div>`;i=lead-1;continue}}cells+='<div class="dc out blank"></div>';continue}
      const bl=blockOn(day);const nn0=list.filter(a=>a.status!=='cancelada').length;const lv=nn0?Math.min(4,Math.ceil(nn0/2)):0;cells+=`<div class="dc lv${lv} ${ym(day)!==ym(first)?'out':''} ${day===TODAY?'today':''} ${day<TODAY?'pastd':''} ${dow(day)>4?'wknd':''} ${bl?'closed':''}" data-act="pickDay" data-d="${day}"><span class="d">${parse(day).getDate()}</span>${bl?`<span class="mi cl">${esc(bl.label)}</span><span class="mclosed">Cerrado</span>`:''}${list.slice(0,3).map(a=>`<span class="mi ${a.status}">${hm(a.start)} ${P(a.patientId).code}</span>`).join('')}${list.length>3?`<span class="mi">+${list.length-3}</span>`:''}${(()=>{const nn=list.filter(a=>a.status!=='cancelada');return nn.length?`<span class="mcount ${nn.some(a=>a.status==='pendiente')?'has-p':''}">${nn.length} ${nn.length===1?'cita':'citas'}</span>`:''})()}</div>`}
    const lead0=dow(first);body=`<div class="month">${['L','M','X','J','V','S','D'].map(x=>`<div class="dh">${x}</div>`).join('')}${lead0<3?`<div class="mlabel mtop"><b>${esc(d.toLocaleDateString('es-ES',{month:'long'}))}</b><span>${d.getFullYear()}</span></div>`:''}${cells}</div>`;
    legend='';
  }else if(mode==='dia'){
    label=fDl(c.date);
    body=`<div class="daystrip" style="--n:${week.length}">${week.map(d=>`<button data-act="pickCalDay" data-d="${d}" aria-pressed="${d===c.date}">${DAYN[dow(d)].slice(0,3)}<b>${parse(d).getDate()}</b><i>${blockOn(d)?'Cerrado':cnt(d)+' citas'}</i></button>`).join('')}</div>${dayList(c.date)}`;
  }else{
    label=`${parse(week[0]).getDate()} – ${sdm(week[week.length-1])}`;
    body=weekMap(week);
  }
  const pend=S.appts.filter(a=>a.status==='pendiente'&&a.date>=TODAY).sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start);
  return `${S.role==='agenda'?roleBanner():''}${noEdit()?'':`<button class="fab" data-act="newAppt" aria-label="Nueva cita">${SVG(IC.plus)}</button>`}<div class="head calhead"><div><div class="eyebrow">Agenda${(()=>{const cur=mode==='mes'?ym(c.date)===ym(TODAY):mode==='semana'?mondayOf(c.date)===mondayOf(nextWorkDay()):(c.date===TODAY||c.date===nextWorkDay());return cur?'':' · <button class="card-link cal-back" data-act="calToday">Volver a hoy</button>'})()}</div>${mode==='mes'?'<h1 class="cal-title">Calendario</h1>':`<h1 class="cal-title">${esc(label[0].toUpperCase()+label.slice(1))}</h1>`}</div>
    <div class="actions"><button class="btn" data-act="calNav" data-n="-1" aria-label="Anterior">‹</button><button class="btn" data-act="calNav" data-n="1" aria-label="Siguiente">›</button>
    <div class="seg" role="group" aria-label="Vista">${['dia','semana','mes'].map(m=>`<button data-act="calMode" data-m="${m}" aria-pressed="${mode===m}">${m==='dia'?'Día':m[0].toUpperCase()+m.slice(1)}</button>`).join('')}</div>
    ${noEdit()?'':`<button class="btn primary" data-act="newAppt">${SVG(IC.plus)}Nueva cita</button>`}</div></div>
  ${legend}
  ${body}
`;
};

/* pacientes */
const PCAT=[['todos','Todos'],['sincita','Sin próxima cita'],['terapia','En terapia'],['primeras','Primeras sesiones'],['fin','Terapia finalizada']];
function pLast(p){return S.appts.filter(a=>a.patientId===p.id&&a.status==='realizada').map(a=>a.date+' '+String(a.start).padStart(4,'0')).sort().pop()||''}
function pNext(p){return S.appts.filter(a=>a.patientId===p.id&&a.date>=TODAY&&!['cancelada','ausencia'].includes(a.status)).sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start)[0]}
function pCat(p){if(p.status==='alta terapéutica')return 'fin';const done=S.appts.filter(a=>a.patientId===p.id&&a.status==='realizada');if(done.length<3)return 'primeras';return pNext(p)?'terapia':'sincita'}
function catChip(p){const c=pCat(p);return c==='terapia'?'<span class="chip ok">En terapia</span>':c==='primeras'?'<span class="chip info">Primeras sesiones</span>':c==='sincita'?'<span class="chip warn">Sin próxima cita</span>':'<span class="chip">Terapia finalizada</span>'}
function pdayModal(){
  const [y,m]=S.sel.pdm.split('-').map(Number);const first=iso(new Date(y,m-1,1));const nd=new Date(y,m,0).getDate();const lead=dow(first);
  const has=new Set(S.appts.filter(a=>a.status!=='cancelada'&&a.date.slice(0,7)===S.sel.pdm).map(a=>a.date));
  let cells='';for(let i=0;i<lead;i++)cells+='<span></span>';
  for(let k=1;k<=nd;k++){const d=`${S.sel.pdm}-${pad(k)}`;const h=has.has(d);cells+=`<button class="mc-d ${d===TODAY?'today':''} ${d===S.sel.pday?'sel':''} ${h?'has':''}" ${h?`data-act="pdayPick" data-d="${d}"`:'disabled'}>${k}</button>`}
  const label=new Date(y,m-1,1).toLocaleDateString('es-ES',{month:'long'})+' '+y;
  modal('Buscar por día',`<div class="mc"><div class="mc-h"><button class="btn sm" data-act="pdayNav" data-n="-1" aria-label="Mes anterior">‹</button><b>${esc(label[0].toUpperCase()+label.slice(1))}</b><button class="btn sm" data-act="pdayNav" data-n="1" aria-label="Mes siguiente">›</button></div><div class="mc-g">${['L','M','X','J','V','S','D'].map(x=>`<i>${x}</i>`).join('')}${cells}</div><p class="muted small" style="margin:6px 0 0">Los días con punto tienen citas. Toca uno para ver qué pacientes vinieron.</p></div>`);
}
function patientList(){
  const q=norm(S.sel.q||'').replace('#','').trim();let f=S.sel.pf||'todos';if(!PCAT.some(x=>x[0]===f))f='todos';
  const key=p=>{const n=pNext(p);return n?n.date+' '+String(n.start).padStart(4,'0'):'9999'};
  const found=S.patients.filter(p=>(f==='todos'||pCat(p)===f)&&(!q||p.code.includes(q)||norm(p.name).includes(q)||norm(p.email).includes(q)||p.phone.replace(/\s/g,'').includes(q))).sort((a,b)=>pLast(b).localeCompare(pLast(a))||norm(a.name).localeCompare(norm(b.name)));
  const pd=S.sel.pday||null;const dayAp=p=>S.appts.filter(a=>a.patientId===p.id&&a.date===pd&&a.status!=='cancelada').sort((a,b)=>a.start-b.start)[0];
  const list=pd?found.filter(p=>dayAp(p)).sort((a,b)=>dayAp(a).start-dayAp(b).start):found;
  const htmlOf=p=>{
    const ap=S.appts.filter(a=>a.patientId===p.id);
    const next=ap.filter(a=>a.date>=TODAY&&!['cancelada','ausencia'].includes(a.status)).sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start)[0];
    return `<button class="prow" data-act="openPatient" data-id="${p.id}"><span class="av" style="${avStyle(p)}">${esc(initials(p.name))}</span><span class="pm"><b>${esc(p.name)}</b><span>${pc(p)}<span class="pm-sv"> · ${esc(SV(p.service).name)} · ${esc(p.modal)}</span><span class="pm-nx">${pd?' · '+hm(dayAp(p).start):pLast(p)?' · '+hm(Number(pLast(p).slice(11))):''}</span></span></span><span class="pn"><small>Próxima cita</small>${next?`${fDs(next.date)} · ${hm(next.start)}`:'—'}</span><span class="pst">${catChip(p)}${!p.consent?'<span class="chip warn">Sin consentimiento</span>':''}</span></button>`};
  const dayL=d=>d===TODAY?'Hoy':d===addDays(TODAY,-1)?'Ayer':parse(d).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
  let lastD=null;const rows=pd?list.map(htmlOf).join(''):found.map(p=>{const d=pLast(p).slice(0,10)||'none';let h='';if(d!==lastD){lastD=d;h=`<div class="pday">${d==='none'?'Aún no han venido':dayL(d)}</div>`}return h+htmlOf(p)}).join('');
  const n=list.length;
  return `${pd?`<div class="pday-chip"><span>${esc(dayL(pd).replace(/^./,c=>c.toUpperCase()))} · ${n} ${n===1?'paciente':'pacientes'}</span><button data-act="pdayClear" aria-label="Quitar el día">×</button></div>`:''}${rows||`<div class="empty">${pd?'Nadie tuvo cita ese día.':'No hay pacientes con ese criterio.'}</div>`}`;
}
VIEWS.pacientes=()=>{
  if(S.sel.patient&&P(S.sel.patient))return ficha(P(S.sel.patient));
  const f=S.sel.pf||'todos';
  return `${roleBanner()}<div class="head"><div><div class="eyebrow">Consulta</div><h1>Pacientes</h1><p>${S.patients.filter(p=>p.status!=='alta terapéutica').length} en seguimiento</p></div><div class="actions"><button class="btn primary" data-act="newPatient">+ Nuevo paciente</button></div></div>
  <div class="toolbar"><div class="psrch"><label class="search">${SVG(IC.search)}<input type="search" id="pq" placeholder="Buscar por nombre o código" value="${esc(S.sel.q||'')}" aria-label="Buscar paciente" autocomplete="off"></label><button class="pday-btn ${S.sel.pday?'on':''}" data-act="pdayOpen" aria-label="Buscar por día">${SVG(IC.cal)}</button></div>
  <div class="seg pseg">${PCAT.map(([k,l])=>{const n=k==='todos'?S.patients.length:S.patients.filter(p=>pCat(p)===k).length;return `<button data-act="pfilter" data-f="${k}" aria-pressed="${(PCAT.some(x=>x[0]===f)?f:'todos')===k}">${l}${k!=='todos'?` <span class="segn ${k==='sincita'&&n?'w':''}">${n}</span>`:''}</button>`}).join('')}</div></div>
  <div class="plist" id="plist">${patientList()}</div>`;
};
const PT_MAP={citas:'sesiones',diagnostico:'clinico',seguimiento:'clinico',evolucion:'clinico'};
function testSeries(p){const g={};(p.tests||[]).forEach(t=>{const m=String(t.result||'').match(/-?\d+(?:[.,]\d+)?/);if(!m)return;(g[t.name]=g[t.name]||[]).push({d:t.date,v:parseFloat(m[0].replace(',','.'))})});return Object.entries(g).map(([name,pts])=>({name,pts:pts.sort((a,b)=>a.d.localeCompare(b.d))}))}
function testChart(pts){
  const W=480,H=150,px=34,top=26,bot=26;const vs=pts.map(q=>q.v);const mn=Math.min(...vs),mx=Math.max(...vs),rg=mx-mn||1;
  const x=i=>pts.length===1?W/2:px+i*(W-2*px)/(pts.length-1);const y=v=>pts.length===1?(H-bot+top)/2:top+(mx-v)/rg*(H-top-bot);
  const sd=d=>parse(d).toLocaleDateString('es-ES',{day:'numeric',month:'short'}).replace('.','');
  const path=pts.map((q,i)=>`${i?'L':'M'}${x(i).toFixed(1)} ${y(q.v).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución de la puntuación"><line x1="${px}" x2="${W-px}" y1="${H-bot+6}" y2="${H-bot+6}" stroke="var(--line)"/>${pts.length>1?`<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`:''}
    ${pts.map((q,i)=>`<circle cx="${x(i)}" cy="${y(q.v)}" r="${i===pts.length-1?5.5:4}" fill="${i===pts.length-1?'var(--accent)':'var(--surface)'}" stroke="var(--accent)" stroke-width="2"/><text class="val" x="${x(i)}" y="${y(q.v)-11}" text-anchor="middle">${q.v}</text><text x="${x(i)}" y="${H-4}" text-anchor="middle">${sd(q.d)}</text>`).join('')}</svg>`;
}
function testsPanel(p){
  const ser=testSeries(p);
  return `<section class="panel"><header><h2>Evolución de las pruebas</h2><button class="btn sm" data-act="testForm" data-p="${p.id}">${SVG(IC.plus)}Añadir resultado</button></header>
    ${ser.length?ser.map(s=>{const f=s.pts[0],l=s.pts[s.pts.length-1];const dl=Math.round((l.v-f.v)*10)/10;
      return `<div class="tchart"><div class="tchart-h"><div><b>${esc(s.name)}</b><div class="muted small">${s.pts.length>1?`${dl>0?'+':''}${dl} puntos desde el ${fD(f.d)}`:'Añade otra medición para ver la evolución'}</div></div><span class="tchart-v">${l.v}</span></div>${testChart(s.pts)}</div>`}).join(''):'<div class="empty">Cuando añadas pruebas con puntuación, aquí verás cómo evoluciona.</div>'}</section>`;
}
function ficha(p){
  const isPsi=S.role==='psicologa';let tab=S.sel.ptab||'resumen';tab=PT_MAP[tab]||tab;if(tab==='clinico'&&!isPsi)tab='resumen';
  const ap=S.appts.filter(a=>a.patientId===p.id).sort((a,b)=>b.date.localeCompare(a.date)||b.start-a.start);
  const inv=S.invoices.filter(i=>i.patientId===p.id).sort((a,b)=>b.date.localeCompare(a.date));
  const notes=S.notes.filter(n=>n.patientId===p.id).sort((a,b)=>b.created.localeCompare(a.created));
  const done=ap.filter(a=>a.status==='realizada').length;
  const nextA=ap.filter(a=>a.date>=TODAY&&!['cancelada','ausencia'].includes(a.status)).sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start)[0];
  const locked=()=>`<div class="panel lock">${SVG(IC.lock)}<b>Acceso restringido</b><span>El expediente clínico solo es visible para profesionales autorizados.</span></div>`;
  const noteTbl=(list,empty,cols)=>`<section class="panel flush"><div class="tbl-wrap"><table class="mcards"><thead><tr><th>Fecha</th><th>Documento</th><th>Autoría</th><th>Versiones</th><th>Estado</th></tr></thead><tbody>${list.map(n=>`<tr class="click" data-act="openNote" data-id="${n.id}"><td>${fD(n.created)}</td><td>${NOTE_T[n.type]}</td><td>${esc(n.author)}</td><td class="num">${1+n.versions.length}</td><td>${chip(n.status)}</td></tr>`).join('')||`<tr><td colspan="5" class="empty">${empty}</td></tr>`}</tbody></table></div></section>`;
  let content='';
  if(tab==='resumen'){
    const ses=ap.filter(a=>a.status==='realizada').sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start);
    const ev=ses.map((a,k)=>{const n=noteFor(a);const F=n&&n.fields||{};const sum=[F.resumen,F.observaciones].filter(Boolean).join(' ');
      return {d:a.date,c:'clin',t:`Sesión nº ${k+1} · ${modeL(a)}`,s:isPsi?(sum?cutT(sum,150):'Sin nota escrita'):`${hm(a.start)} · Realizada`,id:isPsi&&n?n.id:a.id,act:isPsi&&n?'openNote':'openAppt'}});
    ev.sort((a,b)=>b.d.localeCompare(a.d));
    content=`<div class="fs-wrap">${fichaTop(p,isPsi)}<details class="fs-more"><summary>Datos personales</summary><section class="panel"><header><h2>Información personal</h2><div class="actions">${isPsi?`<button class="btn sm" data-act="exportPatient" data-id="${p.id}">${SVG(IC.download)}Exportar datos</button>`:''}${S.role!=='gestoria'?`<button class="btn sm" data-act="pStatus" data-id="${p.id}">${p.status==='alta terapéutica'?'Reanudar terapia':'Finalizar terapia'}</button>`:''}<button class="btn sm" data-act="editPatient" data-id="${p.id}">Editar</button></div></header><dl class="dl">
      <dt>Nombre</dt><dd><b>${esc(p.name)}</b></dd><dt>Código</dt><dd>${pc(p)}</dd><dt>Email</dt><dd><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></dd><dt>Teléfono</dt><dd><a href="tel:${esc(p.phone)}">${esc(p.phone)}</a></dd>
      <dt>NIF / CIF</dt><dd>${esc(p.billing.nif||'—')}</dd><dt>Dirección</dt><dd>${esc(p.billing.addr||'—')}</dd>
      <dt>Alta</dt><dd>${fD(p.alta)}</dd><dt>Servicio habitual</dt><dd>${esc(SV(p.service).name)}</dd><dt>Modalidad</dt><dd>${esc(p.modal)}</dd>
      <dt>Facturar a</dt><dd>${p.billing.type==='empresa'?`${esc(p.billing.name)}<br><span class="muted">retención IRPF ${p.billing.ret}%</span>`:'El propio paciente'}</dd>
      ${p.obs?`<dt>Observaciones</dt><dd style="white-space:pre-wrap">${esc(p.obs)}</dd>`:''}<dt>Recordatorios</dt><dd>${p.reminders?'Activados':'Desactivados'}</dd><dt>Consentimiento</dt><dd>${p.consent?`Subido el ${fD(p.consent.at)}`:`<a href="#" data-act="ptab" data-t="docs" style="color:var(--warn-ink);font-weight:600">Pendiente de subir</a>`}</dd></dl>
      <p class="muted small" style="margin:14px 0 0">Estos datos solo los ven psicóloga y recepción. En calendario, informes y contabilidad el paciente aparece únicamente por su código.</p></section></details><details class="fs-more"><summary>Historial</summary><section class="panel"><div class="timeline tl2">${ev.slice(0,40).map(e=>{const dd=e.d.slice(0,4)===String(YEAR)?sdm(e.d):fD(e.d);const inner=`<b>${esc(e.t)}</b>${e.s?`<small>${esc(e.s)}</small>`:''}`;return `<div class="ev"><span class="dt">${dd}</span><span class="dot ${e.c}"></span>${e.act?`<a href="#" class="tx evl" data-act="${e.act}" data-id="${e.id}">${inner}</a>`:`<span class="tx">${inner}</span>`}</div>`}).join('')}</div></section></details></div>`;
  }else if(tab==='sesiones'){
    const ms=monthsBack(6);const by=Object.fromEntries(ms.map(k=>[k,0]));ap.filter(a=>a.status==='realizada').forEach(a=>{if(a.date.slice(0,7) in by)by[a.date.slice(0,7)]++});
    const mx=Math.max(1,...Object.values(by));const att=ap.filter(a=>a.date<=TODAY&&['realizada','ausencia','cancelada'].includes(a.status));const rate=att.length?Math.round(att.filter(a=>a.status==='realizada').length/att.length*100):null;
    const aus=ap.filter(a=>a.status==='ausencia').length;
    const sesChip=a=>{if(a.status==='realizada'&&isPsi){const n=noteFor(a);return n?(n.status==='firmada'?'<span class="chip ok">Informe terminado</span>':'<span class="chip warn">Informe a medias</span>'):'<span class="chip warn">Sin nota</span>'}return `<span class="chip ${CHIP[a.status]||''}">${ST_L[a.status]||esc(a.status[0].toUpperCase()+a.status.slice(1))}</span>`};
    const noteCell=a=>{if(a.status!=='realizada')return '<span class="muted">—</span>';const n=noteFor(a);return n?chip(n.status):'<span class="chip warn">Sin nota</span>'};
    content=`<section class="panel"><div class="grid2" style="align-items:center"><div class="sstats"><div><b>${done}</b><span>Realizadas</span></div><div><b>${rate==null?'—':rate+' %'}</b><span>Asistencia</span></div><div><b>${aus}</b><span>Ausencias</span></div><div><b>${fD(p.alta)}</b><span>En tratamiento desde</span></div></div>
      <div><div class="spark">${ms.map(k=>`<i class="${k===TODAY.slice(0,7)?'cur':''}" style="height:${Math.max(4,by[k]/mx*100)}%" title="${by[k]} sesiones"></i>`).join('')}</div><div class="sparklbl">${ms.map(k=>`<span>${monthName(k)}</span>`).join('')}</div></div></div></section>
    <section class="panel flush"><div class="tbl-wrap"><table class="mcards"><thead><tr><th>Fecha</th><th>Hora</th><th>Sesión</th><th>Estado</th></tr></thead><tbody>${ap.map(a=>`<tr class="click" data-act="openAppt" data-id="${a.id}"><td>${fDs(a.date)}</td><td class="num">${hm(a.start)}</td><td>${esc(modeL(a))}</td><td>${sesChip(a)}</td></tr>`).join('')||`<tr><td colspan="4" class="empty">Sin citas.</td></tr>`}</tbody></table></div></section>`;
  }else if(tab==='clinico'){
    const objs=notes.filter(n=>n.fields&&n.fields.objetivos).slice(0,6);
    content=`<div class="grid2 tchart-grid" style="align-items:start">${testsPanel(p)}<section class="panel"><header><h2>Objetivos trabajados</h2></header><div class="timeline">${objs.map(n=>`<div class="ev"><span class="dt">${fD(n.created)}</span><span class="dot clin"></span><span class="tx">${esc(n.fields.objetivos)}</span></div>`).join('')||'<div class="empty">Aún no hay objetivos registrados.</div>'}</div></section></div>
    ${dxView(p)}
    <div class="ph" style="margin:0"><h2>Informes clínicos</h2><div class="actions"><button class="btn sm" data-act="newDoc" data-t="inicial" data-p="${p.id}">${SVG(IC.plus)}Evaluación inicial</button><button class="btn sm" data-act="newDoc" data-t="evolucion" data-p="${p.id}">${SVG(IC.plus)}Seguimiento</button><button class="btn sm" data-act="newDoc" data-t="cierre" data-p="${p.id}">${SVG(IC.plus)}Cierre</button></div></div>
    ${noteTbl(notes.filter(n=>n.type!=='sesion'),'Sin informes clínicos todavía.')}`;
  }else if(tab==='facturas'){
    content=`<section class="panel flush"><div class="tbl-wrap"><table class="mcards"><thead><tr><th>Número</th><th>Fecha</th><th class="r">Total</th><th class="r">Pendiente</th><th>Estado</th></tr></thead><tbody>${inv.map(i=>`<tr class="click" data-act="openInv" data-id="${i.id}"><td class="mono">${i.num||'Borrador'}</td><td>${fD(i.date)}</td><td class="r">${eur(tot(i).total)}</td><td class="r">${eur(Math.max(0,tot(i).pending))}</td><td>${chip(invStatus(i))}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">Sin facturas.</td></tr>'}</tbody></table></div></section>`;
  }else{
    const isImg=u=>u&&/^data:image|\.(png|jpe?g|webp)$|image/i.test(u);
    if(CN&&S.role!=='psicologa')content=`<section class="panel"><p style="margin:0">La documentación clínica (consentimientos e informes) solo la ve la psicóloga.</p></section>`;else
    content=`<section class="panel"><header><h2>Consentimiento informado</h2>${p.consent?chip('firmada'):'<span class="chip warn">Pendiente</span>'}</header>
      ${p.consent?`<div class="row"><span class="thumb">${p.consent.url&&isImg(p.consent.url)?`<img src="${esc(p.consent.url)}" alt="" class="thumb">`:SVG(IC.doc)}</span><div class="m"><b>${esc(p.consent.file)}</b><span>Subido el ${fD(p.consent.at)} · almacenamiento privado</span></div>${CN&&p.consent.storagePath?`<button class="btn sm" data-act="cnOpenDoc" data-path="${esc(p.consent.storagePath)}" data-name="${esc(p.consent.file)}">Abrir</button>`:''}<label class="btn sm">Sustituir<input type="file" hidden accept="application/pdf,image/*" data-up="consent" data-p="${p.id}"></label></div>
      ${p.consent.url&&isImg(p.consent.url)?`<img class="preview" src="${esc(p.consent.url)}" alt="Consentimiento firmado">`:''}`:
      `<div class="drop">${SVG(IC.upload)}<b>Sube el consentimiento firmado</b><span class="muted small">PDF o foto. Desde el móvil puedes hacer la foto directamente.</span>
      <div class="actions" style="justify-content:center"><label class="btn primary">${SVG(IC.cam)}Hacer foto<input type="file" hidden accept="image/*" capture="environment" data-up="consent" data-p="${p.id}"></label><label class="btn">${SVG(IC.upload)}Elegir archivo<input type="file" hidden accept="application/pdf,image/*" data-up="consent" data-p="${p.id}"></label></div></div>`}
    </section>
    <section class="panel"><header><h2>Documentación adjunta</h2><label class="btn sm">${SVG(IC.upload)}Adjuntar<input type="file" hidden accept="application/pdf,image/*" data-up="doc" data-p="${p.id}"></label></header><div class="list">
      ${(p.docs||[]).map(d=>`<div class="row"><span class="thumb">${SVG(IC.doc)}</span><div class="m"><b>${esc(d.name)}</b><span>Subido el ${fD(d.at)}</span></div>${CN&&d.storagePath?`<button class="btn sm" data-act="cnOpenDoc" data-path="${esc(d.storagePath)}" data-name="${esc(d.name)}">Abrir</button><button class="btn sm ghost" data-act="cnWithdrawDoc" data-id="${d.id}">Retirar</button>`:''}</div>`).join('')||'<div class="empty">Sin documentos adicionales.</div>'}
    </div></section>`;
  }
  const TABS=[['resumen','Resumen'],['sesiones','Sesiones'],...(isPsi?[['clinico','Clínico']]:[]),['facturas','Facturas'],['docs','Documentos']];
  return `${roleBanner()}<div><button class="btn sm ghost" data-act="backPatients">‹ Pacientes</button></div>
  <section class="fhead"><span class="av">${esc(initials(p.name))}</span>
    <div><div class="eyebrow">Ficha de paciente</div><h1>${esc(p.name)}</h1>
    <div class="fmeta"><span class="pc big">${p.code}</span>${catChip(p)}${!p.consent?'<span class="chip warn">Sin consentimiento</span>':''}</div>
    </div>
    <div class="actions"><button class="btn primary" data-act="newAppt" data-p="${p.id}">${SVG(IC.plus)}Cita</button>${isPsi?`<button class="btn" data-act="newDoc" data-t="evolucion" data-p="${p.id}">${SVG(IC.plus)}Informe</button>`:''}</div></section>
  <div class="tabs ptabs" role="tablist">${TABS.map(([k,l])=>`<button role="tab" aria-selected="${tab===k}" data-act="ptab" data-t="${k}">${l}${k==='docs'&&!p.consent?' <span class="chip warn">1</span>':''}</button>`).join('')}</div>${content}`;
}

/* informes */
const TEMPLATES={
  sesion:[['Sesión de seguimiento',{objetivos:'Objetivos revisados:\n- ',resumen:'Se revisan las tareas acordadas y se trabaja sobre:\n',intervenciones:'Técnicas aplicadas:\n- ',observaciones:'Evolución respecto a la sesión anterior:\n',acuerdos:'Tareas para el paciente:\n- ',plan:'Próxima sesión:\n'}],['Formato SOAP',{resumen:'S (subjetivo):\n\nO (objetivo):\n\nA (valoración):\n\nP (plan):\n'}]],
  inicial:[['Primera entrevista',{motivo:'Motivo de consulta expresado por el paciente:\n',antecedentes:'Antecedentes personales, familiares y de tratamiento:\n',evaluacion:'Instrumentos y entrevista realizados:\n',formulacion:'Hipótesis de trabajo:\n',objetivos:'1. \n2. \n3. ',plan:'Frecuencia, duración estimada y técnicas previstas:\n'}]],
  evolucion:[['Revisión periódica',{objetivos:'Estado de cada objetivo terapéutico:\n- ',cambios:'Cambios observados por el paciente y por el profesional:\n',valoracion:'Valoración profesional:\n',plan:'Ajustes al plan y próximos pasos:\n'}]],
  cierre:[['Cierre de proceso',{motivo:'Motivo del cierre:\n',trabajo:'Resumen del trabajo realizado:\n',logros:'Objetivos alcanzados:\n- \nObjetivos pendientes:\n- ',recomendaciones:'Recomendaciones y pautas de mantenimiento:\n'}]]
};
function nlog(n,what){(n.log=n.log||[]).push({at:new Date().toISOString(),who:S.pro.name,what})}
function editorView(n){
  const p=P(n.patientId);const locked=n.status==='firmada';const fs=FIELDS[n.type];
  const a=n.apptId?S.appts.find(x=>x.id===n.apptId):null;
  const prev=S.notes.filter(x=>x.patientId===n.patientId&&x.id!==n.id&&x.status==='firmada'&&x.created<=n.created).sort((x,y)=>y.created.localeCompare(x.created))[0];
  const hist=[{at:n.created,w:'Documento creado'}].concat((n.log||[]).map(l=>({at:l.at.slice(0,10),w:l.what})),n.versions.map(v=>({at:v.at.slice(0,10),w:`Rectificación · ${v.author}`})));
  return `<div class="ed-bar"><button class="btn sm ghost" data-act="closeEditor">‹ Informes</button><div class="actions">${W&&!locked?nbStateHTML(n):''}${n.status==='firmada'?'<span class="chip ok">Terminado</span>':'<span class="chip warn">A medias</span>'}${locked?`<button class="btn primary" data-act="rectNote" data-id="${n.id}">Guardar rectificación</button>`:`<button class="btn" data-act="saveNote" data-id="${n.id}">Guardar y seguir luego</button><button class="btn primary" data-act="signNote" data-id="${n.id}">${SVG(IC.sign)}Terminar informe</button>`}</div></div>
  <div class="ed-grid">
    <article class="doc"><div class="doc-head"><div class="eyebrow">${NOTE_T[n.type]}</div><h1>${a?`Sesión del ${fD(a.date)}`:`Documento del ${fD(n.created)}`}</h1><div class="fmeta"><span class="pc big">${p.code}</span><span class="muted small">${esc(n.author)}${locked?` · terminado el ${fD(n.signedAt)}`:' · a medias'}</span></div></div>
    ${W&&n.conflict&&!locked?`<div class="box warn" style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><span><b>Otra sesión ha guardado este borrador${n.conflict.version?` (versión ${n.conflict.version})`:''} mientras lo editabas.</b> Tu texto sigue aquí y no se ha guardado.</span><span class="actions"><button class="btn sm" data-act="noteCompare" data-id="${n.id}">Ver versión guardada</button><button class="btn sm primary" data-act="noteForce" data-id="${n.id}">Guardar la mía</button></span></div>`:''}
    ${locked||W?'':`<section class="dict"><div class="dict-h"><span class="dict-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg></span><div><b>Dictar la sesión</b><span>Cuéntala con tus palabras y la IA rellena los apartados. Después revisas y firmas.</span></div></div>
      <textarea id="nf-dict" data-nf="dict" class="dict-ta" placeholder="Toca aquí y pulsa el micrófono del teclado para dictar…">${esc(n.fields.dict||'')}</textarea>
      <div class="dict-a">${(window.SpeechRecognition||window.webkitSpeechRecognition)?`<button class="btn" data-act="dictMic" id="dict-mic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>Hablar</button>`:''}<button class="btn primary" data-act="dictAI" data-id="${n.id}" id="dict-ai"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>Ordenar con IA</button><button class="btn ghost" data-act="dictUndo" id="dict-undo" hidden>Deshacer</button></div>
      <p class="dict-st" id="dict-st">Revisa siempre el texto antes de firmar.</p></section>`}
    ${prev&&!locked?`<details><summary class="muted small" style="cursor:pointer">Plan de la nota anterior (${fD(prev.created)})</summary><p style="margin:8px 0 0">${esc(prev.fields.plan||'—')}</p></details>`:''}
    ${fs.map(([k,l])=>`<label class="field"><span>${l}</span>${locked?`<div class="ro">${esc(n.fields[k]||'—')}</div>`:`<textarea id="nf-${k}" data-nf="${k}" placeholder="Escribe aquí…">${esc(n.fields[k]||'')}</textarea>`}</label>`).join('')}
    ${n.type==='sesion'&&!W?(locked?(n.risk?'<div class="risk-ro">Riesgo señalado en esta sesión</div>':''):`<label class="risk-tg"><div><b>Hay riesgo</b><small>Ideas de hacerse daño, crisis o algo que vigilar. Avisará antes de la próxima sesión.</small></div><input type="checkbox" class="sw" id="nf-risk" ${n.risk?'checked':''}></label>`):''}
    ${n.versions.length?`<section><h3 style="margin-bottom:8px">Rectificaciones</h3><div class="timeline">${n.versions.map(v=>`<div class="ev"><span class="dt">${fD(v.at.slice(0,10))}</span><span class="dot clin"></span><span class="tx"><b>${esc(v.author)}</b>: ${esc(v.text)}</span></div>`).join('')}</div></section>`:''}
    ${locked?`<label class="field"><span>Añadir rectificación · el contenido original se conserva</span><textarea id="nf-rect" placeholder="Describe la corrección…"></textarea></label>`:''}
    </article>
    <aside class="ed-side">
      <section class="panel"><header><h2>Detalles</h2></header><dl class="dl"><dt>Tipo</dt><dd>${NOTE_T[n.type]}</dd><dt>Paciente</dt><dd>${pc(p)} <a href="#" data-act="openPatient" data-id="${p.id}">Ver ficha</a></dd><dt>Creado</dt><dd>${fD(n.created)}</dd><dt>Versiones</dt><dd class="num">${1+n.versions.length}</dd></dl></section>
      ${locked?'':`<section class="panel"><header><h2>Plantillas</h2></header><div class="tpl">${(TEMPLATES[n.type]||[]).map(([t],i)=>`<button class="btn sm" data-act="applyTpl" data-i="${i}">${SVG(IC.doc)}${t}</button>`).join('')}</div><p class="muted small" style="margin:10px 0 0">Rellena solo los apartados vacíos.</p></section>`}
      <section class="panel"><header><h2>Historial de modificaciones</h2></header><div class="timeline">${hist.map(h=>`<div class="ev" style="grid-template-columns:70px 12px minmax(0,1fr)"><span class="dt">${fD(h.at)}</span><span class="dot mail"></span><span class="tx">${esc(h.w)}</span></div>`).join('')}</div></section>
    </aside>
  </div>`;
}
VIEWS.informes=()=>{
  if(S.sel.editing){const n=edNote(S.sel.editing);if(n)return editorView(n);S.sel.editing=null}
  let f=S.sel.nf||'pendientes';if(f!=='firmada')f='pendientes';
  const toWrite=pendingNotes().filter(a=>!noteFor(a)).map(a=>({d:a.date,a}));
  const half=S.notes.filter(n=>n.status==='borrador').map(n=>({d:n.created,n}));
  const pend=toWrite.concat(half).sort((x,y)=>y.d.localeCompare(x.d));
  const done=S.notes.filter(n=>n.status==='firmada').sort((a,b)=>b.created.localeCompare(a.created)).slice(0,60);
  const ttl=n=>n.type==='sesion'?`Sesión del ${sdm(n.created)}`:`${NOTE_T[n.type]} · ${sdm(n.created)}`;
  const row=(code,t,sub,btn)=>`<div class="nt-row"><div class="nt-m"><b><span class="pc">${code}</span> ${t}</b>${sub?`<span>${sub}</span>`:''}</div>${btn}</div>`;
  const list=f==='pendientes'
    ?pend.map(x=>x.a?row(P(x.a.patientId).code,`Sesión del ${sdm(x.a.date)}`,`${esc(modeL(x.a))} · ${hm(x.a.start)}`,`<button class="btn sm primary" data-act="note" data-id="${x.a.id}">Completar</button>`)
      :row(P(x.n.patientId).code,ttl(x.n),'<span class="chip warn">A medias</span>',`<button class="btn sm primary" data-act="openNote" data-id="${x.n.id}">Completar</button>`)).join('')
    :done.map(n=>row(P(n.patientId).code,ttl(n),`Terminado el ${sdm(n.signedAt||n.created)}`,`<button class="btn sm" data-act="openNote" data-id="${n.id}">Ver</button>`)).join('');
  return `<div class="head"><div><div class="eyebrow">Documentación clínica</div><h1>Informes</h1></div><div class="actions"><button class="btn sm" data-act="newReport">${SVG(IC.plus)}Otro informe</button></div></div>
  <div class="nt-hero"><b>${pend.length}</b><span>${pend.length===1?'informe pendiente':'informes pendientes'}</span><small>Después de cada sesión, completa su informe. Una vez terminado ya no se puede cambiar.</small></div>
  <div class="toolbar"><div class="seg">${[['pendientes','Pendientes'],['firmada','Terminados']].map(([k,l])=>`<button data-act="nfilter" data-f="${k}" aria-pressed="${f===k}">${l}</button>`).join('')}</div></div>
  <section class="panel flush nt-list">${list||`<div class="empty">${f==='pendientes'?'No hay informes pendientes. Todo al día.':'Todavía no hay informes terminados.'}</div>`}</section>`;
};
VIEWS.seguimiento=()=>{
  const f=S.sel.sf||'activo';
  const rows=S.patients.filter(p=>f==='todos'||(f==='activo'?p.status!=='alta terapéutica':p.status===f)).sort((a,b)=>norm(a.name).localeCompare(norm(b.name))).map(p=>{
    const done=S.appts.filter(a=>a.patientId===p.id&&a.status==='realizada').length;
    const evo=S.notes.filter(n=>n.patientId===p.id&&n.type==='evolucion').sort((a,b)=>b.created.localeCompare(a.created))[0];
    const obj=S.notes.filter(n=>n.patientId===p.id&&n.fields.objetivos).sort((a,b)=>b.created.localeCompare(a.created))[0];
    const due=p.status!=='alta terapéutica'&&done>=6&&(!evo||evo.created<addDays(TODAY,-60));
    return `<tr class="click" data-act="openPatient" data-id="${p.id}" data-tab="seguimiento"><td><div style="display:flex;gap:10px;align-items:center"><span class="av sm">${esc(initials(p.name))}</span><span class="pm"><b>${esc(p.name)}</b><span>${pc(p)}</span></span></div></td><td class="num">${done}</td><td>${evo?`<span class="inf-d">${fD(evo.created)}</span>`:'<span class="muted">Sin informe</span>'}</td><td style="max-width:320px"><div class="muted small seg-obj" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(obj?obj.fields.objetivos:'—')}</div></td><td>${p.status==='alta terapéutica'?chip('alta terapéutica'):due?'<span class="chip warn">Revisión pendiente</span>':'<span class="chip ok">Al día</span>'}</td><td class="r"><button class="btn sm" data-act="newDoc" data-t="evolucion" data-p="${p.id}">${SVG(IC.plus)}Informe</button></td></tr>`}).join('');
  return `<div class="head"><div><div class="eyebrow">Proceso terapéutico</div><h1>Seguimiento terapéutico</h1><p>Evolución de cada paciente e informes de seguimiento. Se sugiere revisión a partir de la sexta sesión.</p></div></div>
  <div class="toolbar"><div class="seg">${[['activo','En seguimiento'],['alta terapéutica','Terapia finalizada'],['todos','Todos']].map(([k,l])=>`<button data-act="sfilter" data-f="${k}" aria-pressed="${f===k}">${l}</button>`).join('')}</div></div>
  <div class="panel flush"><div class="tbl-wrap"><table class="segt"><thead><tr><th>Paciente</th><th>Sesiones</th><th>Último informe</th><th>Objetivo actual</th><th>Estado</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="6" class="empty">No hay pacientes en este filtro.</td></tr>'}</tbody></table></div></div>`;
};
VIEWS.ayuda=()=>`<div class="head"><div><div class="eyebrow">Centro de ayuda</div><h1>Ayuda y soporte</h1><p>Respuestas rápidas sobre el uso diario de KOVO.</p></div></div>${ayudaBody()}`;
function ayudaBody(){
  const Q=[['¿Por qué veo códigos de 4 dígitos en el calendario?','Cada paciente tiene un código aleatorio. Así, la agenda, los informes y la contabilidad no muestran nombres a quien no los necesita. En Pacientes puedes buscar por nombre y abrir la ficha completa.'],
    ['¿Cómo creo una cita?','Pulsa «Nueva cita» o haz clic en un hueco libre del calendario. Busca al paciente por nombre o código, elige el servicio y la hora. Si hay solapamiento, la aplicación te avisa.'],
    ['¿Cómo firmo un informe?','Abre el informe desde «Informes clínicos», escribe cada apartado y pulsa «Firmar y cerrar». Una nota firmada no se sobrescribe: las correcciones se guardan como rectificación con autoría y fecha.'],
    ['¿Cómo exporto una factura en PDF?','Abre la factura desde Facturación y pulsa «Exportar PDF». Necesita que el visor permita descargas.'],
    ['¿Puedo cambiar el horario y las tarifas?','Sí. En Ajustes puedes editar servicios y precios, franjas horarias de cada día, datos profesionales y el modo claro u oscuro.'],
    ['¿Dónde se guardan mis datos?','En este prototipo, solo en este navegador y con datos ficticios. Si borras los datos del navegador, se pierden.']];
  return `<div class="grid3"><section class="panel"><header><h2>Preguntas frecuentes</h2></header>${Q.map(([q,a])=>`<details class="faq"><summary>${q}</summary><p>${a}</p></details>`).join('')}</section>
  <section class="panel"><header><h2>Contacto</h2></header><dl class="dl"><dt>Email</dt><dd class="mono">soporte@kovo-ejemplo.es</dd><dt>Horario</dt><dd>Lunes a viernes, 9:00 a 18:00</dd></dl><p class="muted small" style="margin:14px 0 0">Dirección ficticia de ejemplo para el prototipo.</p></section></div>`;
};

/* diagnóstico y pruebas */
function dxView(p){
  const T=(p.tests||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));const D=(p.dx||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));
  const tn=id=>T.find(t=>t.id===id);
  return `<div class="grid2"><section class="panel"><header><h2>Diagnóstico</h2><button class="btn sm primary" data-act="dxForm" data-p="${p.id}">${SVG(IC.plus)}Añadir diagnóstico</button></header>
    ${D.map(x=>`<div class="dx"><div class="dx-h"><div><b>${esc(x.title)}</b><div class="muted small">${fD(x.date)} · ${esc(x.author)}</div></div><button class="btn sm" data-act="dxForm" data-p="${p.id}" data-id="${x.id}">Editar</button></div>${x.text?`<p>${esc(x.text)}</p>`:''}${x.tests.some(tn)?`<div class="actions">${x.tests.filter(tn).map(id=>`<span class="chip">${esc(tn(id).name)}</span>`).join('')}</div>`:''}</div>`).join('')||'<div class="empty">Sin diagnóstico registrado.</div>'}</section>
  <section class="panel"><header><h2>Pruebas y resultados</h2><button class="btn sm" data-act="testForm" data-p="${p.id}">${SVG(IC.upload)}Añadir prueba</button></header>
    ${T.map(t=>`<div class="dx"><div class="dx-h"><div><b>${esc(t.name)}</b><div class="muted small">${fD(t.date)}</div></div><button class="btn sm" data-act="testForm" data-p="${p.id}" data-id="${t.id}">Editar</button></div>${t.result?`<p>${esc(t.result)}</p>`:''}${t.file?`<div class="actions"><span class="chip">${esc(t.file)}</span>${!t.url?'<span class="muted small">Archivo demasiado grande para guardarlo en este navegador</span>':t.isImg?`<button class="btn sm" data-act="testView" data-p="${p.id}" data-id="${t.id}">${SVG(IC.eye)}Ver</button>`:`<a class="btn sm" href="${esc(t.url)}" download="${esc(t.file)}">${SVG(IC.download)}Descargar</a>`}</div>`:''}</div>`).join('')||'<div class="empty">Sin pruebas subidas.</div>'}</section></div>
  <p class="muted small" style="margin:0">Solo lo ve la psicóloga. Nada de este apartado se envía por correo ni aparece en facturación.</p>`;
}
function fiscalBar(){return `<div class="fiscal"><span><b>Datos fiscales</b>${esc(S.pro.name)} · NIF ${esc(S.pro.nif)} · ${esc(S.pro.addr)}</span>${S.role==='psicologa'?'<button class="btn sm" data-act="goFiscal">Editar</button>':''}</div>`}
async function pdfInv(i){
  const J=window.jspdf&&window.jspdf.jsPDF;
  if(!J){toast('El generador de PDF no se ha cargado. Revisa la conexión e inténtalo de nuevo');return}
  const doc=new J({unit:'mm',format:'a4'});const t=tot(i);const m=c=>(c/100).toFixed(2).replace('.',',')+' EUR';
  let y=22;doc.setFont('helvetica','bold');doc.setFontSize(18);doc.text(`Factura ${i.num||'(borrador)'}`,20,y);
  doc.setFontSize(10);doc.setFont('helvetica','normal');doc.text(`Fecha: ${fD(i.date)}`,190,y-6,{align:'right'});doc.text(`Vence: ${fD(i.due)}`,190,y,{align:'right'});
  y+=12;doc.setFont('helvetica','bold');doc.text('Emisor',20,y);doc.setFont('helvetica','normal');y+=5;
  [issuerOf(i).name,'NIF '+issuerOf(i).nif,issuerOf(i).addr,'Colegiada '+S.pro.col].forEach(l=>{doc.text(String(l),20,y);y+=5});
  y+=4;doc.setFont('helvetica','bold');doc.text('Destinatario',20,y);doc.setFont('helvetica','normal');y+=5;
  [i.to.name,i.to.nif,i.to.addr].filter(Boolean).forEach(l=>{doc.text(String(l),20,y);y+=5});
  y+=8;doc.setFont('helvetica','bold');doc.text('Concepto',20,y);doc.text('Cant.',120,y,{align:'right'});doc.text('Precio',152,y,{align:'right'});doc.text('Importe',190,y,{align:'right'});y+=2;doc.line(20,y,190,y);y+=6;doc.setFont('helvetica','normal');
  i.lines.forEach(l=>{doc.text(String(l.desc).slice(0,62),20,y);doc.text(String(l.qty),120,y,{align:'right'});doc.text(m(l.price),152,y,{align:'right'});doc.text(m(Math.round(l.qty*l.price)),190,y,{align:'right'});y+=6});
  y+=2;doc.line(120,y,190,y);y+=6;
  [['Base imponible',t.base],['IVA',t.iva]].concat(i.ret?[[`Retención IRPF ${i.ret} %`,-t.ret]]:[]).forEach(([k,v])=>{doc.text(k,120,y);doc.text(m(v),190,y,{align:'right'});y+=6});
  doc.setFont('helvetica','bold');doc.text('Total',120,y);doc.text(m(t.total),190,y,{align:'right'});
  if(i.lines.some(l=>l.exempt)){y+=14;doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text('Operación exenta de IVA conforme al art. 20.Uno.3º de la Ley 37/1992.',20,y)}
  const fn=`factura-${String(i.num||'borrador').replace('/','-')}.pdf`;
  audit(`PDF de la factura ${i.num||'borrador'} exportado`);
  if(DL){try{await DL.save({filename:fn,data:doc.output('blob')});toast('PDF exportado');return}catch(e){if(e&&e.code==='declined')return}}
  toast('La descarga no está disponible en este visor');
}

/* ===== contabilidad: los 7 criterios ===== */
const ACC=[['facturas','01','Facturas'],['gastos','02','Clasificación de gastos'],['impuestos','03','Impuestos'],['banco','04','Conciliación bancaria'],['libros','05','Libros'],['rentabilidad','06','Rentabilidad'],['laboral','07','Laboral']];
function monthTotals(k){
  const em=S.invoices.filter(i=>i.num&&ym(i.date)===k);
  const inc=em.reduce((a,i)=>a+tot(i).base,0);
  const exp=S.expenses.filter(e=>ym(e.date)===k).reduce((a,e)=>a+e.base+e.iva,0);
  const pay=S.payrolls.filter(n=>n.month===k).reduce((a,n)=>a+n.coste,0);
  const cob=S.invoices.reduce((a,i)=>a+i.payments.filter(p=>ym(p.date)===k).reduce((x,p)=>x+p.amount,0),0);
  return{inc,gas:exp+pay,res:inc-exp-pay,n:em.filter(i=>i.kind!=='R').length,cob};
}
function openAccSec(t){
  const m={facturas:S.sel.fdir==='emitidas'?'ingresos':'gastos',emitidas:'ingresos',gastos:'gastos',ingresos:'ingresos',impuestos:'impuestos',banco:'gestoria',libros:'gestoria',laboral:'gestoria'};
  const k=m[t];if(!k)return;
  S.sel.fopen=Object.assign({},S.sel.fopen,{[k]:true});
  if(k==='gestoria')S.sel.gsub=t;
  S.sel.scrollTo='sec-'+k;
}
function payCard(){
  const tx=taxes().filter(o=>!o.paid&&o.amount>0);
  const late=tx.filter(o=>o.due<TODAY);const up=tx.filter(o=>o.due>=TODAY);
  if(!tx.length)return '';
  const d=up.length?up[0].due:null;const grp=d?up.filter(o=>ym(o.due)===ym(d)):[];const sum=grp.reduce((a,o)=>a+o.amount,0);
  const days=d?Math.round((parse(d)-parse(TODAY))/864e5):0;
  return `<section class="paycard"><div class="pc-top"><div><span class="pc-k">Lo que te toca pagar</span><b class="pc-v">${d?eur0(sum):eur0(late.reduce((a,o)=>a+o.amount,0))}</b><span class="pc-d">${d?`Primer plazo el ${parse(d).toLocaleDateString('es-ES',{day:'numeric',month:'long'})}, faltan ${days} días`:'Pagos vencidos'}</span></div><button class="btn sm" data-act="atab" data-t="impuestos">Ver impuestos</button></div>
  ${grp.length?`<div class="pc-list">${grp.map(o=>`<div><span>${esc(o.model)}<em>${esc(o.name)} · ${parse(o.due).toLocaleDateString('es-ES',{day:'numeric',month:'short'}).replace('.','')}</em></span><b>${eur0(o.amount)}</b></div>`).join('')}</div>`:''}
  ${late.length?`<div class="pc-late">${late.length} ${late.length===1?'pago vencido':'pagos vencidos'} sin marcar como pagado</div>`:''}
  <p class="pc-note">Estimación con los datos de la app. La cantidad final la calcula tu gestoría.</p></section>`;
}
const ACC_SECS=[
  ['ingresos','Ingresos','Facturas a pacientes, cobros y pendientes de cobro',IC.wallet],
  ['gastos','Gastos','Facturas recibidas y gasto por categoría',IC.doc],
  ['impuestos','Impuestos','Lo que toca pagar a Hacienda y cuándo',IC.cal],
  ['fijos','Gastos fijos y ajustes','Gastos que se apuntan solos cada mes y % deducible',IC.clock],
  ['gestoria','Gestoría','Libros registro, banco y nóminas para tu gestor',IC.bank]];
const GSUB=[['libros','Libros registro'],['banco','Banco'],['laboral','Nóminas y personal']];
VIEWS.contabilidad=()=>{
  if(S.sel.atab){openAccSec(S.sel.atab);S.sel.atab=null}
  const ro=S.role==='gestoria';const rec=S.role==='recepcion';
  const fo=S.sel.fopen||(S.sel.fopen={});
  const ms=monthsBack(7);const ms6=ms.slice(0,6);const pk=ms[5],ppk=ms[4];
  const T={};ms6.forEach(k=>T[k]=monthTotals(k));const cur=T[pk],prev=T[ppk];
  const dl=(a,b,inv)=>{if(!b)return'';const d=Math.round((a-b)/Math.abs(b)*100);const good=inv?d<=0:d>=0;return `<span class="delta ${good?'up':'down'}">${d>=0?'+':''}${d} % vs ${monthName(ppk)}</span>`};
  const inc={},gas={};ms6.forEach(k=>{inc[k]=T[k].inc;gas[k]=T[k].gas});
  const cap=s=>s[0].toUpperCase()+s.slice(1);
  const nRev=S.expenses.filter(e=>e.status==='por revisar').length,nUb=unbilled().length;
  const pend=S.invoices.filter(i=>i.num&&i.kind!=='R'&&i.status!=='rectificada'&&tot(i).pending>0);
  const txSoon=taxes().filter(o=>!o.paid&&o.amount>0&&o.due<=addDays(TODAY,45)).length;
  const badge={fijos:'',gastos:nRev?`<span class="chip warn">${nRev} por revisar</span>`:'',ingresos:(pend.length+nUb)?`<span class="chip warn">${pend.length+nUb} por cobrar o facturar</span>`:'',impuestos:txSoon?`<span class="chip warn">${txSoon} ${txSoon===1?'pago cerca':'pagos cerca'}</span>`:'',gestoria:unmatched().length?`<span class="chip warn">${unmatched().length} avisos</span>`:''};
  const body={
    ingresos:()=>`${ACCV.facturas('emitidas')}<h3 class="acc-sub">Cobros</h3>${ACCV.ingresos()}`,
    gastos:()=>`${ACCV.facturas('recibidas')}<h3 class="acc-sub">Gasto por categoría</h3>${ACCV.gastos()}`,
    impuestos:()=>ACCV.impuestos(),
    fijos:()=>`${ACCV.fijos()}<h3 class="acc-sub">Ajustes de gastos</h3>${ACCV.ajustes()}`,
    gestoria:()=>{const g=GSUB.some(x=>x[0]===S.sel.gsub)?S.sel.gsub:'libros';return `<div class="gbar"><div><b>Gestoría Ejemplo</b><span>gestor@gestoria-ejemplo.es · contacto ficticio</span></div><button class="btn sm dark" data-act="exportBook">${SVG(IC.download)}Exportar libros</button></div>
      <div class="seg" role="group">${GSUB.map(([k,l])=>`<button data-act="gsub" data-t="${k}" aria-pressed="${g===k}">${l}</button>`).join('')}</div>${ACCV[g]()}`}
  };
  const secs=ACC_SECS.filter(s=>!(rec&&['gestoria','fijos','impuestos'].includes(s[0])));
  return `${roleBanner()}<div class="head"><div><div class="eyebrow">Gestión económica</div><h1>Facturación</h1><p>Todo lo económico de la consulta en un solo sitio.</p></div></div>
  ${ro?'':CN?`<section class="addbar"><div><h2>Añadir</h2><p>Registra un gasto o crea una factura para un paciente.</p></div><div class="actions"><button class="btn" data-act="cnNewExp">${SVG(IC.plus)}Nuevo gasto</button><button class="btn primary" data-act="newInvoice">${SVG(IC.plus)}Nueva factura</button></div></section>`:`<section class="addbar"><div><h2>Añadir facturas</h2><p>Haz una foto a una factura recibida y se registra como gasto, o crea una factura para un paciente.</p></div>
    <div class="actions"><label class="btn primary">${SVG(IC.cam)}Foto de factura<input type="file" hidden accept="image/*" capture="environment" data-up="scan"></label><label class="btn">${SVG(IC.upload)}Subir archivo<input type="file" hidden accept="image/*,application/pdf" data-up="scan"></label><button class="btn" data-act="newInvoice">${SVG(IC.plus)}Nueva factura</button></div></section>`}
  ${rec?'':payCard()}
  ${rec?'':`<section class="stack" style="gap:16px"><div class="ph" style="margin:0"><h2 style="font-size:1.0625rem">Resumen de ${monthLong(pk)}</h2><span class="muted small">Mes cerrado</span></div>
  <div class="kpis"><div class="kpi"><div class="l">Ingresos</div><div class="v">${eur0(cur.inc)}</div><div class="s">${dl(cur.inc,prev.inc)}</div></div><div class="kpi"><div class="l">Gastos</div><div class="v">${eur0(cur.gas)}</div><div class="s">${dl(cur.gas,prev.gas,true)}</div></div><div class="kpi"><div class="l">Beneficio</div><div class="v" style="color:var(--ok-ink)">${eur0(cur.res)}</div><div class="s">Margen ${cur.inc?Math.round(cur.res/cur.inc*100):0} %</div></div><div class="kpi"><div class="l">Cobrado</div><div class="v">${eur0(cur.cob)}</div><div class="s">${cur.n} facturas emitidas</div></div></div>
  <div class="grid3"><section class="panel chart"><header><h2>Últimos 6 meses</h2><div class="legend"><span><i style="background:var(--c1)"></i>Ingresos</span><span><i style="background:var(--c3)"></i>Gastos</span><span><i style="background:var(--c2);height:3px;vertical-align:3px"></i>Beneficio</span></div></header>${barChart(ms6,inc,gas)}</section>
  <section class="panel flush"><header><h2>Comparativa mensual</h2></header><div class="tbl-wrap"><table><thead><tr><th>Mes</th><th class="r">Ingresos</th><th class="r">Gastos</th><th class="r">Beneficio</th></tr></thead><tbody>${ms6.slice().reverse().map(k=>`<tr><td>${cap(monthName(k))}</td><td class="r">${eur0(T[k].inc)}</td><td class="r">${eur0(T[k].gas)}</td><td class="r"><b style="color:var(--ok-ink)">${eur0(T[k].res)}</b></td></tr>`).join('')}</tbody></table></div></section></div></section>`}
  ${secs.map(([k,t,d,ic])=>`<details class="acc" id="sec-${k}" data-acc="${k}" ${fo[k]?'open':''}><summary><span class="acc-ic">${SVG(ic)}</span><span class="acc-t"><b>${t}</b><span>${d}</span></span>${badge[k]}<span class="acc-chev">${SVG('<path d="m6 9 6 6 6-6"/>')}</span></summary>${fo[k]?`<div class="acc-bd">${body[k]()}</div>`:''}</details>`).join('')}`;
};

const ACCV={};
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
  <div class="grid3"><section class="panel flush"><header><h2>Consultas cobradas</h2></header><div class="tbl-wrap"><table><thead><tr><th>Fecha</th><th>Paciente</th><th>Concepto</th><th>Factura</th><th>Pago</th><th class="r">Importe</th></tr></thead><tbody>
    ${pays.slice(0,S.sel.allPay?300:10).map(p=>`<tr class="click" data-act="openInv" data-id="${p.inv.id}"><td class="num" style="white-space:nowrap">${fD(p.date)}</td><td>${who(p.inv)}</td><td class="small">${esc((p.inv.lines[0]||{}).desc||'')}</td><td class="mono">${p.inv.num||'—'}</td><td><span class="chip pay">${esc(p.method)}</span></td><td class="r"><b>${eur(p.amount)}</b></td></tr>`).join('')||'<tr><td colspan="6" class="empty">Sin cobros en este periodo.</td></tr>'}</tbody></table></div>${pays.length>10?`<button class="list-more" data-act="allList" data-k="allPay">${S.sel.allPay?'Ver menos':`Ver todos (${pays.length})`}</button>`:''}</section>
  <section class="panel"><header><h2>Cómo te han pagado</h2></header><div class="hbar" style="grid-template-columns:96px minmax(0,1fr) auto">${['Tarjeta','Bizum','Transferencia','Efectivo'].map(m=>{const v=by[m]||{n:0,s:0};return `<span>${m}</span><span class="b"><i style="width:${v.s/mx*100}%"></i></span><span class="num small">${eur0(v.s)} <span class="muted">· ${v.n}</span></span>`}).join('')}</div>
    <p class="muted small" style="margin:14px 0 0">Los cobros por Bizum, tarjeta y transferencia se concilian con el banco en Gestoría.</p></section></div>
  <section class="panel flush"><header><h2>Pendiente de cobro</h2><span class="muted small">${pend.length} facturas · ${eur(pSum)}</span></header><div class="tbl-wrap"><table><thead><tr><th>Factura</th><th>Paciente</th><th>Emitida</th><th>Vence</th><th class="r">Pendiente</th><th>Estado</th><th></th></tr></thead><tbody>
    ${pend.slice(0,S.sel.allPend?300:10).map(i=>`<tr><td class="mono">${i.num}</td><td>${who(i)}</td><td class="num" style="white-space:nowrap">${fD(i.date)}</td><td class="num" style="white-space:nowrap">${fD(i.due)}</td><td class="r"><b>${eur(tot(i).pending)}</b></td><td>${chip(invStatus(i))}</td><td class="r">${ro?'':`<button class="btn sm primary" data-act="openInv" data-id="${i.id}">Registrar cobro</button>${invStatus(i)==='vencida'?` <button class="btn sm" data-act="remind" data-id="${i.id}">Recordar</button>`:''}`}</td></tr>`).join('')||'<tr><td colspan="7" class="empty">Todo cobrado.</td></tr>'}</tbody></table></div>${pend.length>10?`<button class="list-more" data-act="allList" data-k="allPend">${S.sel.allPend?'Ver menos':`Ver todas (${pend.length})`}</button>`:''}</section>`;
};

ACCV.facturas=(fixed)=>{
  const dir=fixed||S.sel.fdir||'recibidas';const ro=S.role==='gestoria';
  let body='';
  if(dir==='recibidas'){
    const exAll=S.expenses.slice().sort((a,b)=>(a.status==='por revisar'?-1:0)-(b.status==='por revisar'?-1:0)||b.date.localeCompare(a.date));const ex=exAll.slice(0,S.sel.allRec?300:10);
    body=`
    <div class="panel flush"><div class="tbl-wrap"><table><thead><tr><th></th><th>Fecha</th><th>Proveedor</th><th>Categoría</th><th class="r">Total</th><th>Origen</th><th>Estado</th></tr></thead><tbody>
    ${ex.map(e=>`<tr class="click" data-act="openExp" data-id="${e.id}"><td style="width:56px">${e.photo?`<img class="thumb" src="${esc(e.photo)}" alt="">`:`<span class="thumb">${SVG(IC.doc)}</span>`}</td><td>${fD(e.date)}</td><td><b>${esc(e.supplier)}</b><div class="muted small">${esc(e.concept||'')}</div></td><td>${esc(e.cat)}</td><td class="r">${e.total?eur(e.total):'<span class="muted">Leyendo…</span>'}</td><td><span class="muted small">${esc(e.source)}</span></td><td>${chip(e.status)}</td></tr>`).join('')}</tbody></table></div></div>${exAll.length>10?`<button class="list-more" data-act="allList" data-k="allRec">${S.sel.allRec?'Ver menos':`Ver todas (${exAll.length})`}</button>`:''}`;
  }else{
    const f=S.sel.if||'todas';
    const all=S.invoices.slice().sort((a,b)=>b.date.localeCompare(a.date)||(b.num||'').localeCompare(a.num||''));
    const fl=all.filter(i=>f==='todas'||invStatus(i)===f);const rows=fl.slice(0,S.sel.allEm?400:10);const ub=unbilled();
    body=`${fiscalBar()}<div class="box">${S.settings.invoiceMode==='auto'?'Las facturas se emiten solas al firmar la nota de la sesión y se envían al paciente. Solo tienes que intervenir en lo que aparece en «Pendiente».':'Al firmar la nota de la sesión se crea un borrador que revisas antes de emitir.'}</div>
    ${ub.length&&!ro&&(!W||S.role==='psicologa'&&S.billingLinkAvailable)?`<div class="box warn" style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><span><b>${ub.length} ${ub.length===1?'sesión':'sesiones'} sin facturar.</b> Las de pacientes que facturan a empresa se agrupan en una factura mensual.</span><button class="btn sm" data-act="billAll">Facturar ahora</button></div>`:''}
    <div class="toolbar"><div class="seg">${['todas','emitida','enviada','parcial','vencida','cobrada','borrador'].map(x=>`<button data-act="ifilter" data-f="${x}" aria-pressed="${f===x}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</div>${S.role!=='gestoria'?`<button class="btn primary" data-act="newInvoice">${SVG(IC.plus)}Nueva factura</button>`:''}</div>
    <div class="panel flush"><div class="tbl-wrap"><table><thead><tr><th>Número</th><th>Fecha</th><th>Destinatario</th><th class="r">Total</th><th class="r">Pendiente</th><th>Estado</th></tr></thead><tbody>
    ${rows.map(i=>{const t=tot(i);return `<tr class="click" data-act="openInv" data-id="${i.id}"><td class="mono">${i.num||'—'}</td><td>${fD(i.date)}</td><td>${i.patientId&&P(i.patientId)&&P(i.patientId).billing.type!=='empresa'?pc(P(i.patientId)):esc(i.to.name)}</td><td class="r">${eur(t.total)}</td><td class="r">${t.pending>0&&i.status!=='borrador'&&i.kind!=='R'?eur(t.pending):'—'}</td><td>${chip(invStatus(i))}</td></tr>`}).join('')||'<tr><td colspan="6" class="empty">Sin facturas con este filtro.</td></tr>'}
    </tbody></table></div></div>${fl.length>10?`<button class="list-more" data-act="allList" data-k="allEm">${S.sel.allEm?'Ver menos':`Ver todas (${fl.length})`}</button>`:''}`;
  }
  const nRev=S.expenses.filter(e=>e.status==='por revisar').length;
  if(fixed)return body;
  return `<div class="seg" role="group"><button data-act="fdir" data-d="recibidas" aria-pressed="${dir==='recibidas'}">Recibidas · gastos${nRev?` (${nRev} por revisar)`:''}</button><button data-act="fdir" data-d="emitidas" aria-pressed="${dir==='emitidas'}">Emitidas · ingresos</button></div>${body}`;
};
ACCV.ajustes=()=>{
  const per=S.sel.gper||'año';
  const from=per==='mes'?ym(TODAY)+'-01':per==='trimestre'?quarterRange(YEAR,qOf(TODAY))[0]:`${YEAR}-01-01`;
  const ex=S.expenses.filter(e=>e.date>=from);
  const dedBy={};ex.forEach(e=>{const r=dedBy[e.cat]=dedBy[e.cat]||{g:0,d:0};r.g+=e.base+e.iva;r.d+=dedAmt(e)});
  const dedT=Object.values(dedBy).reduce((a,r)=>a+r.d,0);
  return `<section class="panel flush"><header><h2>Porcentaje deducible por categoría</h2><span class="muted small">Deducible en el periodo: ${eur(dedT)}</span></header><div class="tbl-wrap"><table><thead><tr><th>Categoría</th><th class="r">% deducible</th><th class="r">Gasto</th><th class="r">Deducible</th></tr></thead><tbody>${CATS.filter(c=>c!=='Personal').map(c=>{const r=dedBy[c]||{g:0,d:0};return `<tr><td>${esc(c)}</td><td class="r"><input type="number" min="0" max="100" value="${dedCat(c)}" data-ded="${esc(c)}" style="width:84px;text-align:right" aria-label="Porcentaje deducible de ${esc(c)}" ${S.role==='psicologa'?'':'disabled'}></td><td class="r">${eur(r.g)}</td><td class="r"><b>${eur(r.d)}</b></td></tr>`}).join('')}</tbody></table></div><p class="muted small" style="margin:0;padding:10px 18px 16px">Se aplica a todos los gastos de la categoría, salvo a las facturas con su propio porcentaje. Confírmalo con tu gestoría, porque cambia la estimación del modelo 130.</p></section>
<section class="panel"><header><h2>Clasificación automática</h2></header><p class="muted small" style="margin:0 0 10px">Al escanear, la categoría se propone por el proveedor y por lo que lee la IA. Siempre puedes cambiarla.</p>
    <div class="list">${RULES.slice(0,7).map(([re,c])=>`<div class="row"><div class="m"><b>${c}</b><span class="mono">${esc(String(re.source).split('|').slice(0,4).join(', ').replace(/\\|\[|\]|\?/g,''))}…</span></div></div>`).join('')}</div></section>`;
};
ACCV.gastos=()=>{
  const per=S.sel.gper||'año';
  const from=per==='mes'?ym(TODAY)+'-01':per==='trimestre'?quarterRange(YEAR,qOf(TODAY))[0]:`${YEAR}-01-01`;
  const ex=S.expenses.filter(e=>e.date>=from);
  const pay=S.payrolls.filter(n=>n.date>=from);
  const by={};CATS.forEach(c=>by[c]={sum:0,n:0});
  ex.forEach(e=>{by[e.cat]=by[e.cat]||{sum:0,n:0};by[e.cat].sum+=e.total+e.ret;by[e.cat].n++});
  pay.forEach(n=>{by.Personal.sum+=n.coste;by.Personal.n++});
  const total=Object.values(by).reduce((a,b)=>a+b.sum,0);const max=Math.max(1,...Object.values(by).map(b=>b.sum));
  const cat=S.sel.gcat;
  const dedBy={};ex.forEach(e=>{const r=dedBy[e.cat]=dedBy[e.cat]||{g:0,d:0};r.g+=e.base+e.iva;r.d+=dedAmt(e)});
  const dedT=Object.values(dedBy).reduce((a,r)=>a+r.d,0);
  const det=cat?ex.filter(e=>e.cat===cat).sort((a,b)=>b.date.localeCompare(a.date)):[];
  return `<div class="toolbar"><div class="seg">${['mes','trimestre','año'].map(x=>`<button data-act="gper" data-p="${x}" aria-pressed="${per===x}">${x==='año'?'Este año':'Este '+x}</button>`).join('')}</div><span class="muted small">Total ${eur(total)} · IVA soportado incluido (la actividad sanitaria está exenta y no lo recupera)</span></div>
  <section class="panel"><header><h2>Gasto por categoría</h2></header>
    <div class="hbar">${Object.entries(by).filter(([,v])=>v.sum).sort((a,b)=>b[1].sum-a[1].sum).map(([k,v])=>`<a href="#" data-act="gcat" data-c="${esc(k)}" style="color:inherit;font-weight:${cat===k?800:500}">${esc(k)}</a><span class="b"><i style="width:${v.sum/max*100}%"></i></span><span class="num">${eur0(v.sum)} <span class="muted small">${Math.round(v.sum/total*100)}%</span></span>`).join('')}</div></section>

  ${cat?`<section class="panel flush"><header><h2>${esc(cat)}</h2><button class="btn sm" data-act="gcat" data-c="">Cerrar</button></header><div class="tbl-wrap"><table><thead><tr><th>Fecha</th><th>Proveedor</th><th>Concepto</th><th class="r">Total</th></tr></thead><tbody>${det.map(e=>`<tr class="click" data-act="openExp" data-id="${e.id}"><td>${fD(e.date)}</td><td>${esc(e.supplier)}</td><td>${esc(e.concept)}</td><td class="r">${eur(e.total)}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">Los costes de personal se ven en «Laboral».</td></tr>'}</tbody></table></div></section>`:''}`;
};
ACCV.impuestos=()=>{
  const tx=taxes();const pend=tx.filter(o=>!o.paid);const amt=pend.reduce((a,o)=>a+o.amount,0);
  const next=pend.filter(o=>o.amount>0)[0];
  const hist=S.sel.thist;const cut=ym(TODAY)+'-01';const shown=tx.filter(o=>hist?o.due<cut:o.due>=cut||!o.paid);
  const byM={};shown.forEach(o=>{(byM[ym(o.due)]=byM[ym(o.due)]||[]).push(o)});const cap=t=>t[0].toUpperCase()+t.slice(1);
  return `<div class="kpis"><div class="kpi"><div class="l">Pendiente de pago</div><div class="v">${eur0(amt)}</div><div class="s">${pend.filter(o=>o.amount>0).length} obligaciones con importe</div></div><div class="kpi"><div class="l">Próximo vencimiento</div><div class="v" style="font-size:1.15rem">${next?fD(next.due):'—'}</div><div class="s">${next?next.model:''}</div></div><div class="kpi"><div class="l">Vencidas</div><div class="v" style="color:${tx.some(o=>o.state==='vencido')?'var(--bad-ink)':'inherit'}">${tx.filter(o=>o.state==='vencido').length}</div></div><div class="kpi"><div class="l">Presentadas este año</div><div class="v">${tx.filter(o=>o.paid).length}</div></div></div>
  <div class="box warn">Importes estimados a partir de los datos de la app para planificar la tesorería. La gestoría calcula y presenta las declaraciones definitivas.</div>
  <div class="toolbar"><div class="seg"><button data-act="thist" data-h="" aria-pressed="${!hist}">Próximas</button><button data-act="thist" data-h="1" aria-pressed="${!!hist}">Historial ${YEAR}</button></div></div>
  ${Object.keys(byM).sort(hist?(a,b)=>b.localeCompare(a):undefined).map(k=>`<section class="panel flush"><header><h2>${cap(monthLong(k))}</h2></header><div class="tbl-wrap"><table><thead><tr><th>Modelo</th><th>Periodo</th><th>Vence</th><th class="r">Importe estimado</th><th>Estado</th><th></th></tr></thead><tbody>
  ${byM[k].map(o=>`<tr><td><b>${o.model}</b><div class="muted small">${o.name}${o.partial?' · datos parciales del año':''}</div><div class="muted small" style="font-size:.72rem">${esc(o.calc)}</div></td><td>${o.period}</td><td class="num">${fD(o.due)}</td><td class="r">${o.amount?eur(o.amount):'<span class="muted">Informativo</span>'}</td><td>${chip(o.state)}</td><td>${!o.paid&&S.role==='psicologa'?`<button class="btn sm" data-act="payObl" data-k="${o.key}">${o.amount?'Marcar pagado':'Marcar presentado'}</button>`:''}</td></tr>`).join('')}</tbody></table></div></section>`).join('')}`;
};
ACCV.fijos=()=>{
  const ed=S.role==='psicologa';const on=S.fixed.filter(f=>f.active);
  const mes=on.reduce((a,f)=>a+f.base+fxIva(f),0);const ded=on.reduce((a,f)=>a+Math.round((f.base+fxIva(f))*dedOf(f)/100),0);
  const r115=on.filter(f=>f.cat==='Alquiler').reduce((a,f)=>a+fxRet(f)*3,0);
  return `<div class="kpis"><div class="kpi"><div class="l">Coste fijo al mes</div><div class="v">${eur0(mes)}</div><div class="s">Base más IVA</div></div><div class="kpi"><div class="l">Deducible al mes</div><div class="v">${eur0(ded)}</div><div class="s">Según tus porcentajes</div></div><div class="kpi"><div class="l">Retención del alquiler</div><div class="v">${eur0(r115)}</div><div class="s">Al trimestre · modelo 115</div></div><div class="kpi"><div class="l">Gastos activos</div><div class="v">${on.length}</div><div class="s">De ${S.fixed.length} configurados</div></div></div>
  <div class="box">Cada gasto se registra solo en «Recibidas» el día indicado y entra en libros, rentabilidad e impuestos. Los cambios valen para los próximos meses. Las compras puntuales se añaden con «Foto de factura».</div>
  <section class="panel flush"><header><h2>Gastos configurados</h2>${ed?`<button class="btn sm primary" data-act="fxForm">${SVG(IC.plus)}Añadir gasto fijo</button>`:''}</header><div class="tbl-wrap"><table><thead><tr><th>Concepto</th><th>Categoría</th><th class="r">Día</th><th class="r">Base</th><th class="r">IVA</th><th class="r">Retención</th><th class="r">Deducible</th><th>Estado</th><th></th></tr></thead><tbody>
  ${S.fixed.map(f=>`<tr><td style="min-width:150px"><b>${esc(f.name)}</b></td><td style="min-width:130px">${esc(f.cat)}</td><td class="r num">${f.day}</td><td class="r" style="white-space:nowrap">${eur(f.base)}</td><td class="r num" style="white-space:nowrap">${f.ivaPct} %</td><td class="r num" style="white-space:nowrap">${f.retPct?f.retPct+' %':'—'}</td><td class="r num" style="white-space:nowrap">${dedOf(f)} %</td><td>${f.active?'<span class="chip ok">Activo</span>':'<span class="chip">Pausado</span>'}</td><td class="r">${ed?`<button class="btn sm" data-act="fxForm" data-id="${f.id}">Editar</button>`:''}</td></tr>`).join('')||'<tr><td colspan="9" class="empty">Sin gastos fijos configurados.</td></tr>'}
  </tbody></table></div></section>`;
};
ACCV.banco=()=>{
  const f=S.sel.bf||'pendientes';const um=unmatched();
  const list=S.bank.slice().sort((a,b)=>b.date.localeCompare(a.date)).filter(b=>f==='todos'||!b.match).slice(0,120);
  const bal=S.bank.reduce((a,b)=>a+b.amount,0)+1250000;
  const pctOk=Math.round((S.bank.length-um.length)/S.bank.length*100);
  const desc=b=>{if(!b.match)return'<span class="muted">—</span>';if(b.match.t==='pay'){const i=S.invoices.find(x=>x.id===b.match.inv);return i?`Cobro factura <span class="mono">${i.num}</span>`:'Cobro'}if(b.match.t==='exp'){const e=S.expenses.find(x=>x.id===b.match.id);return e?`Gasto · ${esc(e.supplier)}`:'Gasto'}if(b.match.t==='nom')return b.match.part==='ss'?'Seguros sociales':'Nómina';return'Otro'};
  return `<div class="kpis"><div class="kpi"><div class="l">Saldo en cuenta</div><div class="v">${eur0(bal)}</div><div class="s">Cuenta de la consulta (ficticia)</div></div><div class="kpi"><div class="l">Conciliado</div><div class="v">${pctOk}%</div><div class="prog" style="margin-top:6px"><i style="width:${pctOk}%"></i></div></div><div class="kpi"><div class="l">Sin conciliar</div><div class="v" style="color:${um.length?'var(--warn-ink)':'inherit'}">${um.length}</div></div><div class="kpi"><div class="l">Último movimiento</div><div class="v" style="font-size:1.15rem">${fD(S.bank.map(b=>b.date).sort().pop())}</div></div></div>
  <div class="toolbar"><div class="seg"><button data-act="bf" data-f="pendientes" aria-pressed="${f==='pendientes'}">Sin conciliar</button><button data-act="bf" data-f="todos" aria-pressed="${f==='todos'}">Todos</button></div>
  ${S.role!=='gestoria'||true?`<button class="btn primary" data-act="autoMatch" ${um.length?'':'disabled'}>Conciliar automáticamente</button><label class="btn">${SVG(IC.upload)}Importar extracto (CSV)<input type="file" hidden accept=".csv,text/csv,text/plain" data-up="bank"></label>`:''}</div>
  <p class="muted small" style="margin:0">La conciliación automática relaciona cada movimiento con un cobro, una factura pendiente o un gasto del mismo importe y fecha cercana. Formato del CSV: fecha;concepto;importe.</p>
  <div class="panel flush"><div class="tbl-wrap"><table><thead><tr><th>Fecha</th><th>Concepto bancario</th><th class="r">Importe</th><th>Relacionado con</th><th></th></tr></thead><tbody>
  ${list.map(b=>`<tr><td class="num">${fD(b.date)}</td><td class="mono" style="font-size:.78rem">${esc(b.concept)}</td><td class="r" style="color:${b.amount>0?'var(--ok-ink)':'inherit'};font-weight:600">${b.amount>0?'+':''}${eur(b.amount)}</td><td>${desc(b)}</td><td class="r">${b.match?chip('conciliado'):`<button class="btn sm" data-act="matchOne" data-id="${b.id}">Relacionar</button>`}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">Todos los movimientos están conciliados.</td></tr>'}
  </tbody></table></div></div>`;
};
function libros(q){
  const[a,b]=q==='año'?[`${YEAR}-01-01`,`${YEAR}-12-31`]:quarterRange(YEAR,Number(q));
  const ing=S.invoices.filter(i=>i.num&&i.date>=a&&i.date<=b).sort((x,y)=>x.num.localeCompare(y.num)).map(i=>{const t=tot(i);return{fecha:i.date,num:i.num,cliente:i.to.name,pc:!!(i.patientId&&P(i.patientId)&&P(i.patientId).billing.type!=='empresa'),code:i.patientId&&P(i.patientId)&&P(i.patientId).billing.type!=='empresa'?P(i.patientId).code:i.to.name,nif:i.to.nif||'',concepto:i.lines.map(l=>l.desc).join(' / '),base:t.base,iva:t.iva,ret:t.ret,total:t.total}});
  const gas=S.expenses.filter(e=>e.date>=a&&e.date<=b).map(e=>({fecha:e.date,num:e.num||'',prov:e.supplier,nif:e.nif||'',cat:e.cat,concepto:e.concept,base:e.base,iva:e.iva,ret:e.ret,total:e.total,ded:dedOf(e),dedAmt:dedAmt(e)}))
    .concat(S.payrolls.filter(n=>n.date>=a&&n.date<=b).flatMap(n=>[{fecha:n.date,num:'NOM-'+n.month,prov:'Personal',nif:'',cat:'Sueldos y salarios',concepto:'Nómina '+monthLong(n.month),base:n.bruto,iva:0,ret:n.irpf,total:n.bruto,ded:100,dedAmt:n.bruto},{fecha:n.date,num:'SS-'+n.month,prov:'Seguridad Social',nif:'',cat:'Seguridad Social a cargo de la empresa',concepto:'Cuota empresa '+monthLong(n.month),base:n.ssE,iva:0,ret:0,total:n.ssE,ded:100,dedAmt:n.ssE}]))
    .sort((x,y)=>x.fecha.localeCompare(y.fecha));
  return{ing,gas};
}
ACCV.libros=()=>{
  const q=S.sel.lq||String(qOf(TODAY));const book=S.sel.lb||'ingresos';const L=libros(q);
  const rows=book==='ingresos'?L.ing:L.gas;const sum=k=>rows.reduce((a,r)=>a+r[k],0);
  return `<div class="toolbar"><div class="seg">${['1','2','3','4','año'].map(x=>`<button data-act="lq" data-q="${x}" aria-pressed="${q===x}">${x==='año'?'Año '+YEAR:x+'T'}</button>`).join('')}</div><div class="seg"><button data-act="lb" data-b="ingresos" aria-pressed="${book==='ingresos'}">Libro de ingresos</button><button data-act="lb" data-b="gastos" aria-pressed="${book==='gastos'}">Libro de gastos</button></div>
  <button class="btn primary" data-act="exportBook">${SVG(IC.upload)}Exportar para la gestoría</button></div>
  <p class="muted small" style="margin:0">Formato de libro registro de ingresos y gastos para estimación directa. En pantalla los pacientes aparecen por código; el archivo exportado incluye los datos fiscales que exige la gestoría.</p>
  <div class="panel flush"><div class="tbl-wrap"><table><thead><tr><th>Fecha</th><th>Nº</th><th>${book==='ingresos'?'Destinatario':'Proveedor'}</th><th>${book==='ingresos'?'Concepto':'Tipo de gasto'}</th><th class="r">Base</th><th class="r">IVA</th><th class="r">Retención</th><th class="r">Total</th>${book==='gastos'?'<th class="r">Deducible</th>':''}</tr></thead><tbody>
  ${rows.slice(0,S.sel.allBook?1000:15).map(r=>`<tr><td class="num">${fD(r.fecha)}</td><td class="mono">${esc(r.num)}</td><td>${book==='ingresos'?(r.pc?`<span class="pc">${r.code}</span>`:esc(r.code)):esc(r.prov)}</td><td class="small">${esc(book==='ingresos'?r.concepto:r.cat)}</td><td class="r">${eur(r.base)}</td><td class="r">${eur(r.iva)}</td><td class="r">${r.ret?eur(r.ret):'—'}</td><td class="r"><b>${eur(r.total)}</b></td>${book==='gastos'?`<td class="r">${eur(r.dedAmt)}<div class="muted small">${r.ded} %</div></td>`:''}</tr>`).join('')||`<tr><td colspan="${book==='gastos'?9:8}" class="empty">Sin registros en este periodo.</td></tr>`}
  ${rows.length?`<tr><td colspan="4"><b>${rows.length} registros</b></td><td class="r"><b>${eur(sum('base'))}</b></td><td class="r"><b>${eur(sum('iva'))}</b></td><td class="r"><b>${eur(sum('ret'))}</b></td><td class="r"><b>${eur(sum('total'))}</b></td>${book==='gastos'?`<td class="r"><b>${eur(sum('dedAmt'))}</b></td>`:''}</tr>`:''}
  </tbody></table></div></div>${rows.length>15?`<button class="list-more" data-act="allList" data-k="allBook">${S.sel.allBook?'Ver menos':`Ver los ${rows.length} registros`}</button>`:''}`;
};
function monthsBack(n){const out=[];const d=parse(TODAY);d.setDate(1);for(let i=n-1;i>=0;i--)out.push(iso(new Date(d.getFullYear(),d.getMonth()-i,1)).slice(0,7));return out}
ACCV.rentabilidad=()=>{
  const ms=monthsBack(6);const inc={},gas={},res={};ms.forEach(k=>{inc[k]=0;gas[k]=0});
  S.invoices.filter(i=>i.num).forEach(i=>{const k=ym(i.date);if(k in inc)inc[k]+=tot(i).base});
  S.expenses.forEach(e=>{const k=ym(e.date);if(k in gas)gas[k]+=e.base+e.iva});
  S.payrolls.forEach(n=>{const k=n.month;if(k in gas)gas[k]+=n.coste});
  ms.forEach(k=>res[k]=inc[k]-gas[k]);
  const sum=o=>Object.values(o).reduce((a,b)=>a+b,0);const I=sum(inc),G=sum(gas),R=I-G;
  const sess=S.appts.filter(a=>a.status==='realizada'&&ms.includes(ym(a.date)));
  const hours=sess.reduce((a,s)=>a+s.dur,0)/60;
  const avgP=sess.length?sess.reduce((a,s)=>a+s.price,0)/sess.length:0;
  const fixedM=G/6;const be=avgP?Math.ceil(fixedM/avgP):0;
  const bySvc={};sess.forEach(a=>{bySvc[a.service]=(bySvc[a.service]||0)+a.price});const svMax=Math.max(1,...Object.values(bySvc));
  const weeks=[];for(let i=7;i>=0;i--){const mo=addDays(mondayOf(TODAY),-7*i);weeks.push({mo,...occupancy(mo)})}
  const half=ms.slice(3),prevHalf=ms.slice(0,3);const r1=half.reduce((a,k)=>a+res[k],0),r0=prevHalf.reduce((a,k)=>a+res[k],0);
  return `<div class="kpis"><div class="kpi"><div class="l">Ingresos 6 meses</div><div class="v">${eur0(I)}</div><div class="s">Base facturada</div></div><div class="kpi"><div class="l">Gastos 6 meses</div><div class="v">${eur0(G)}</div><div class="s">Incluye personal</div></div><div class="kpi"><div class="l">Resultado</div><div class="v" style="color:${R<0?'var(--bad-ink)':'var(--ok-ink)'}">${eur0(R)}</div><div class="s">Margen ${I>0?Math.round(R/I*100)+' %':'—'} · antes de IRPF</div></div><div class="kpi"><div class="l">Por hora de consulta</div><div class="v">${hours?eur0(R/hours):'—'}</div><div class="s">Resultado / ${Math.round(hours)} h atendidas</div></div></div>
  <section class="panel chart"><header><h2>Evolución mensual</h2><div class="legend"><span><i style="background:var(--c1)"></i>Ingresos</span><span><i style="background:var(--c3)"></i>Gastos</span><span><i style="background:var(--c2);height:3px;vertical-align:3px"></i>Resultado</span></div></header>${barChart(ms,inc,gas)}
  <p class="muted small" style="margin:8px 0 0">Último trimestre frente al anterior: resultado ${r0?(r1>=r0?'+':'')+Math.round((r1-r0)/Math.abs(r0)*100)+' %':'—'} (${eur0(r1)} frente a ${eur0(r0)}).</p></section>
  <div class="grid2"><section class="panel"><header><h2>Ingresos por servicio</h2></header><div class="hbar">${Object.entries(bySvc).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<span>${esc(SV(k).name)}</span><span class="b"><i style="width:${v/svMax*100}%"></i></span><span class="num">${eur0(v)}</span>`).join('')}</div>
    <dl class="dl" style="margin-top:16px"><dt>Sesiones realizadas</dt><dd class="num">${sess.length}</dd><dt>Precio medio por sesión</dt><dd class="num">${eur(Math.round(avgP))}</dd><dt>Punto de equilibrio</dt><dd class="num">${be} sesiones al mes para cubrir ${eur0(fixedM)} de gastos</dd></dl></section>
  <section class="panel chart"><header><h2>Ocupación de agenda</h2><span class="muted small">${weeks[0].avail} h disponibles por semana</span></header>${occChart(weeks)}</section></div>`;
};
ACCV.laboral=()=>{
  const e=S.employees[0];
  const ps=S.payrolls.slice().sort((a,b)=>b.month.localeCompare(a.month));
  const cy=ps.filter(n=>n.month.startsWith(String(YEAR)));const coste=cy.reduce((a,n)=>a+n.coste,0);
  const cur=ym(TODAY);const hasCur=ps.some(n=>n.month===cur);
  if(!e)return `<div class="empty">Sin personal dado de alta.</div>`;
  return `<div class="kpis"><div class="kpi"><div class="l">Plantilla</div><div class="v">${S.employees.length}</div><div class="s">${esc(e.role)}</div></div><div class="kpi"><div class="l">Coste de personal ${YEAR}</div><div class="v">${eur0(coste)}</div><div class="s">Bruto + Seguridad Social empresa</div></div><div class="kpi"><div class="l">Coste mensual</div><div class="v">${eur0(payroll(e.bruto).coste)}</div><div class="s">${eur0(e.bruto)} brutos</div></div><div class="kpi"><div class="l">Peso sobre ingresos</div><div class="v">${(()=>{const inc=S.invoices.filter(i=>i.num&&i.date.startsWith(String(YEAR))).reduce((a,i)=>a+tot(i).base,0);return inc?Math.round(coste/inc*100)+' %':'—'})()}</div></div></div>
  <div class="grid3"><section class="panel flush"><header><h2>Nóminas</h2>${hasCur||S.role!=='psicologa'?'':`<button class="btn sm primary" data-act="genPayroll">Generar nómina de ${monthName(cur)}</button>`}</header><div class="tbl-wrap"><table><thead><tr><th>Mes</th><th class="r">Bruto</th><th class="r">SS trabajador</th><th class="r">IRPF</th><th class="r">Neto</th><th class="r">SS empresa</th><th class="r">Coste total</th><th>Estado</th></tr></thead><tbody>
    ${ps.map(n=>`<tr><td style="text-transform:capitalize">${monthLong(n.month)}</td><td class="r">${eur(n.bruto)}</td><td class="r">${eur(n.ssT)}</td><td class="r">${eur(n.irpf)}</td><td class="r"><b>${eur(n.neto)}</b></td><td class="r">${eur(n.ssE)}</td><td class="r">${eur(n.coste)}</td><td>${n.paid?chip('pagada'):`<button class="btn sm" data-act="payPayroll" data-id="${n.id}">Marcar pagada</button>`}</td></tr>`).join('')}
    </tbody></table></div><p class="muted small" style="margin:0;padding:10px 18px 16px">Cálculo orientativo (SS trabajador 6,48 %, empresa 31,9 %, IRPF 2 %). La gestoría laboral emite la nómina oficial; aquí se registra y se integra en impuestos, banco y rentabilidad.</p></section>
  <section class="panel"><header><h2>${esc(e.name)}</h2></header><dl class="dl"><dt>Puesto</dt><dd>${esc(e.role)}</dd><dt>Contrato</dt><dd>${esc(e.contract)}</dd><dt>Alta</dt><dd>${fD(e.start)}</dd><dt>Acceso a la app</dt><dd>Rol recepción · sin acceso clínico</dd></dl>
    <h3 style="margin:16px 0 6px">Documentación laboral</h3><div class="list">${e.docs.map(d=>`<div class="row"><span class="thumb">${SVG(IC.doc)}</span><div class="m"><b>${esc(d.name)}</b><span>${fD(d.at)}</span></div></div>`).join('')}
    ${ps.slice(0,3).map(n=>`<div class="row"><span class="thumb">${SVG(IC.doc)}</span><div class="m"><b>Recibo de nómina · ${monthName(n.month)}</b><span>${fD(n.date)}</span></div></div>`).join('')}</div>
    <label class="btn sm" style="margin-top:10px">${SVG(IC.upload)}Subir documento<input type="file" hidden accept="application/pdf,image/*" data-up="empdoc"></label></section></div>`;
};
function barChart(ms,a,b){
  const mob=isMob();const W=mob?380:720,Hh=mob?230:240,L=mob?38:60,B=26,T=10;const vals=ms.flatMap(k=>[a[k],b[k]]);const max=Math.max(1,...vals);
  const step=niceStep(max);const top=Math.ceil(max/step)*step;
  const y=v=>T+(Hh-T-B)*(1-Math.max(0,v)/top);const gw=(W-L-10)/ms.length;const bw=Math.min(28,gw/3.2);
  let g='';for(let v=0;v<=top;v+=step){g+=`<line x1="${L}" x2="${W-10}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L-8}" y="${y(v)+4}" text-anchor="end">${mob?(v>=100000?(v/100000).toLocaleString('es-ES',{maximumFractionDigits:1})+'k':String(v/100)):(v/100).toLocaleString('es-ES')+' €'}</text>`}
  let bars='',pts=[];
  ms.forEach((k,i)=>{const cx=L+gw*i+gw/2;bars+=`<rect x="${cx-bw-2}" y="${y(a[k])}" width="${bw}" height="${y(0)-y(a[k])}" rx="4" fill="var(--c1)"><title>${eur(a[k])}</title></rect><rect x="${cx+2}" y="${y(b[k])}" width="${bw}" height="${y(0)-y(b[k])}" rx="4" fill="var(--c3)"><title>${eur(b[k])}</title></rect><text x="${cx}" y="${Hh-6}" text-anchor="middle">${monthName(k)}</text>`;pts.push([cx,y(a[k]-b[k])])});
  const line=`<polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="var(--c2)" stroke-width="2.5"/>${pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="var(--surface)" stroke="var(--c2)" stroke-width="2.5"/>`).join('')}`;
  return `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Ingresos y gastos por mes">${g}${bars}${line}</svg>`;
}
function niceStep(max){const raw=max/4;const p=Math.pow(10,Math.floor(Math.log10(raw)));const n=raw/p;return(n<=1?1:n<=2?2:n<=5?5:10)*p}
function occChart(weeks){
  const W=360,Hh=180,L=34,B=24,T=8;const y=v=>T+(Hh-T-B)*(1-v/100);const gw=(W-L-6)/weeks.length;
  let g='';[0,25,50,75,100].forEach(v=>g+=`<line x1="${L}" x2="${W-6}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L-6}" y="${y(v)+4}" text-anchor="end">${v}%</text>`);
  const bars=weeks.map((w,i)=>{const x=L+gw*i+gw*.18;const last=i===weeks.length-1;const v=Math.min(100,w.pct);return `<rect x="${x}" y="${y(v)}" width="${gw*.64}" height="${y(0)-y(v)}" rx="4" fill="${last?'var(--c2)':'var(--c1)'}"><title>Semana del ${fD(w.mo)}: ${w.pct}%</title></rect><text x="${x+gw*.32}" y="${Hh-6}" text-anchor="middle">${parse(w.mo).getDate()}/${parse(w.mo).getMonth()+1}</text>`}).join('');
  return `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Ocupación semanal">${g}${bars}</svg><p class="muted small" style="margin:6px 0 0">Horas reservadas sobre horas disponibles. La última barra es la semana en curso.</p>`;
}

/* configuración */
VIEWS.config=()=>{
  const s=S.settings;const tg=(k,t,d)=>`<div class="toggle"><div><b>${t}</b><small>${d}</small></div><input type="checkbox" class="sw" id="set-${k}" data-set="${k}" ${s[k]?'checked':''} aria-label="${esc(t)}"></div>`;
  const tabs=CN?CN.tabsFor(S.role):null;let tab=S.sel.ctab||'auto';if(tabs&&!tabs.some(t=>t[0]===tab))tab=tabs[0][0];let c='';
  if(CN&&CN.isPanel(tab))c=CN.panel(tab);
  else if(tab==='auto')c=`<div class="grid2"><section class="panel"><header><h2>Automatizaciones</h2></header>
    ${CN?`<div class="box" style="margin-bottom:12px">KOVO todavía no tiene proveedor de correo: estas preferencias se guardan para la clínica, pero no se envía ningún email.${CN.isAdmin()?'':' Solo la administración puede cambiarlas.'}</div>`:''}
    ${CN?'':tg('dailyConfirm','Correo de confirmación cada mañana','Lo reciben los pacientes con cita ese día. Al responder, la agenda se actualiza sola.')}
    ${tg('confirmEmail','Aviso al crear una cita','Email con fecha, hora y lugar. Nunca incluye datos clínicos.')}
    ${tg('reminder','Recordatorio antes de la sesión',`Se envía ${s.reminderH} h antes. Se puede desactivar por paciente.`)}
    ${tg('noteTask','Aviso de nota al cerrar una sesión','Aparece en «Pendiente». La nota nunca se firma sola.')}
    ${tg('sendInvoice','Enviar la factura al emitirla','El paciente la recibe por email y queda registrado.')}
    ${CN?'':tg('aiScan','Leer facturas escaneadas con IA','Extrae fecha, número e importes de la foto. Requiere permitir a Claude en este visor.')}
    <label class="field" style="margin-top:14px"><span>Horas de antelación del recordatorio</span><input type="number" id="reminderH" min="1" max="168" value="${s.reminderH}"></label>
    ${CN?'':`<label class="field" style="margin-top:14px"><span>Hora del correo de la mañana</span><input type="time" id="dailyHour" step="900" value="${esc(s.dailyHour)}"></label>
    <div class="actions" style="margin-top:12px"><button class="btn sm" data-act="dailyNow">Enviar ahora el correo de hoy</button></div>
    <p class="muted small" style="margin:10px 0 0">En este prototipo los correos son simulados: se ven en «Comunicaciones».</p>`}</section>
    <section class="panel"><header><h2>Facturación al firmar la nota</h2></header><div class="stack">
    ${[['auto','Emitir automáticamente','Recomendado para servicios con IVA y retenciones ya configurados.'],['borrador','Crear borrador para revisar','Revisas destinatario e importes antes de emitir.'],['manual','No hacer nada','La sesión queda en «sin facturar».']].map(([k,t,d])=>`<label class="toggle" style="cursor:pointer"><div><b>${t}</b><small>${d}</small></div><input type="radio" name="invmode" value="${k}" ${s.invoiceMode===k?'checked':''}></label>`).join('')}
    <label class="field"><span>Días de vencimiento de las facturas</span><input type="number" id="dueDays" min="0" max="90" value="${s.dueDays}"></label></div></section></div>`;
  else if(tab==='servicios')c=`<section class="panel flush"><header><h2>Servicios y tarifas</h2><button class="btn sm primary" data-act="addSvc">+ Añadir servicio</button></header><div class="tbl-wrap"><table><thead><tr><th>Servicio</th><th>Duración (min)</th><th class="r">Precio (€)</th><th>IVA</th><th></th></tr></thead><tbody>${S.services.filter(sv=>sv.active!==false&&!sv.placeholder).map(sv=>`<tr><td style="min-width:220px"><input type="text" value="${esc(sv.name)}" data-sv="${sv.id}" data-f="name" aria-label="Nombre del servicio"></td><td><input type="number" min="5" step="5" value="${sv.dur}" data-sv="${sv.id}" data-f="dur" style="width:96px" aria-label="Duración de ${esc(sv.name)}"></td><td class="r"><input type="number" step="0.5" min="0" value="${sv.price/100}" data-sv="${sv.id}" data-f="price" style="width:110px;text-align:right" aria-label="Precio de ${esc(sv.name)}"></td><td style="min-width:170px"><select data-sv="${sv.id}" data-f="exempt" aria-label="IVA de ${esc(sv.name)}"><option value="1" ${sv.exempt?'selected':''}>Exento de IVA</option><option value="0" ${sv.exempt?'':'selected'}>IVA 21 %</option></select></td><td class="r"><button class="btn sm danger" data-act="delSvc" data-id="${sv.id}">Eliminar</button></td></tr>`).join('')}</tbody></table></div></section>
    <div class="box">Los cambios de tarifa se aplican a las citas nuevas; las citas ya creadas conservan su precio. La exención de IVA aplica a la asistencia sanitaria de profesionales con habilitación sanitaria. Talleres o formación tributan al 21 %. Si el destinatario es una empresa, la factura lleva retención de IRPF.</div>`;
  else if(tab==='perfil'&&CN)c=S.pro.id?`<section class="panel"><div class="form">${[['name','Nombre y apellidos'],['col','Nº de colegiada'],['email','Email profesional'],['phone','Teléfono']].map(([k,l])=>`<label class="field"><span>${l}</span><input type="text" id="pro-${k}" data-pro="${k}" value="${esc(S.pro[k]||'')}"></label>`).join('')}</div>
    <p class="muted small" style="margin:12px 0 0">Los datos fiscales (NIF y dirección) son los de la clínica: Ajustes › Clínica. La exención de IVA se indica en cada servicio.</p></section>`
    :`<section class="panel"><p style="margin:0 0 12px">Todavía no tienes ficha profesional en esta clínica. La necesitas para tener agenda propia y horario.</p><button class="btn primary" data-act="cnEnsurePro">Crear mi ficha profesional</button></section>`;
  else if(tab==='perfil')c=`<section class="panel"><div class="form">${[['name','Nombre y apellidos'],['nif','NIF'],['col','Nº de colegiada'],['email','Email de la consulta'],['loc','Ubicación habitual de las citas'],['addr','Dirección fiscal']].map(([k,l])=>`<label class="field ${k==='addr'?'full':''}"><span>${l}</span><input type="text" id="pro-${k}" data-pro="${k}" value="${esc(S.pro[k]||'')}"></label>`).join('')}
    <label class="toggle full"><div><b>Habilitación sanitaria</b><small>Determina la exención de IVA de los servicios sanitarios.</small></div><input type="checkbox" class="sw" id="pro-san" data-pro="sanitaria" ${S.pro.sanitaria?'checked':''}></label></div></section>`;
  else if(tab==='horario')c=`${CN&&!S.pro.id?`<section class="panel"><p style="margin:0 0 12px">Para guardar tu horario necesitas una ficha profesional en esta clínica.</p><button class="btn primary" data-act="cnEnsurePro">Crear mi ficha profesional</button></section>`:''}${CN&&S.pro.id&&!S.availSaved?'<div class="box">Este es un horario de ejemplo y todavía no está guardado. Cualquier cambio guarda la semana completa.</div>':''}<div class="grid3"><section class="panel"><header><h2>Horario de consulta</h2><span class="muted small">Lo que queda fuera se sombrea en el calendario</span></header>
    ${[0,1,2,3,4,5,6].map(d=>{const rs=AVAIL[d]||[];return `<div class="avrow"><b>${DAYN[d]}</b><div class="rgs">${rs.map(([a,b],i)=>`<span class="rg"><input type="time" step="900" value="${hm(a)}" data-av="${d}:${i}:0" aria-label="Inicio de franja ${DAYN[d]}"><span>–</span><input type="time" step="900" value="${hm(b)}" data-av="${d}:${i}:1" aria-label="Fin de franja ${DAYN[d]}"><button class="x" data-act="delRange" data-d="${d}" data-i="${i}" aria-label="Quitar franja">×</button></span>`).join('')}${rs.length?'':'<span class="muted small">Cerrado</span>'}<button class="btn sm" data-act="addRange" data-d="${d}">+ Franja</button></div></div>`}).join('')}</section>
    <section class="panel"><header><h2>Horas visibles</h2></header><div class="form"><label class="field"><span>Primera hora</span><input type="number" min="0" max="22" id="h0" value="${H0}"></label><label class="field"><span>Última hora</span><input type="number" min="1" max="24" id="h1" value="${H1}"></label></div>
    <p class="muted small" style="margin:12px 0 0">Define el tramo del día que muestra el calendario. Las citas fuera de ese tramo no se dibujan.</p></section></div>${blocksPanel()}`;
  else if(tab==='apariencia')c=`<section class="panel"><header><h2>Tema</h2></header><div class="seg" role="group" aria-label="Tema">${[['light','Claro'],['dark','Oscuro'],['system','Automático']].map(([k,l])=>`<button data-act="setTheme" data-k="${k}" aria-pressed="${(s.theme||'system')===k}">${l}</button>`).join('')}</div>
    <p class="muted small" style="margin:14px 0 0">Automático sigue el modo claro u oscuro de tu dispositivo. El color de identidad de la plataforma es el índigo.</p></section>`;
  else if(tab==='usuarios')c=`<section class="panel flush"><header><h2>Usuarios</h2><button class="btn sm primary" data-act="userForm">${SVG(IC.plus)}Nuevo usuario</button></header><div class="tbl-wrap"><table><thead><tr><th>Nombre</th><th>Email</th><th>Perfil</th><th>Qué puede ver</th><th></th></tr></thead><tbody>${S.users.map(u=>`<tr><td style="min-width:170px"><b>${esc(uName(u))}</b></td><td class="mono" style="font-size:.78rem;white-space:nowrap">${esc(u.titular?S.pro.email:u.email)}</td><td style="min-width:170px">${u.titular?'<span class="chip acc">Titular</span>':`<select data-urole="${u.id}" aria-label="Perfil de ${esc(u.name)}">${['recepcion','gestoria','agenda'].map(r=>`<option value="${r}" ${u.role===r?'selected':''}>${ROLE_L[r]}</option>`).join('')}</select>`}</td><td class="small muted" style="min-width:230px">${ROLE_D[u.role]}</td><td class="r" style="white-space:nowrap">${u.titular?'':`<button class="btn sm" data-act="userAs" data-id="${u.id}">Entrar como</button> <button class="btn sm danger" data-act="userDel" data-id="${u.id}">Quitar</button>`}</td></tr>`).join('')}</tbody></table></div></section>
    <div class="box warn">Prototipo: «Entrar como» simula lo que vería cada persona. Las contraseñas y el acceso real necesitan un servidor.</div>`;
  else if(tab==='comms')c=`<section class="panel flush"><div class="tbl-wrap"><table><thead><tr><th>Fecha</th><th>Destinatario</th><th>Asunto</th><th>Estado</th></tr></thead><tbody>${S.outbox.map(m=>`<tr><td class="num">${new Date(m.at).toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'})}</td><td class="mono" style="font-size:.78rem">${esc(maskEmail(m.to))}</td><td>${esc(m.subject)}<div class="muted small">${esc(m.body)}</div></td><td style="white-space:nowrap">${chip(m.status)}${m.apptId&&(S.appts.find(x=>x.id===m.apptId)||{}).status==='pendiente'&&(S.appts.find(x=>x.id===m.apptId)||{}).dayMail===TODAY?` <button class="btn sm" data-act="mailView" data-id="${m.apptId}">Abrir</button>`:''}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">Todavía no hay envíos. Crea una cita o cierra una sesión para ver uno aquí.</td></tr>'}</tbody></table></div></section>
    <p class="muted small">En el prototipo los emails no se envían; se registran como lo haría el proveedor de correo.</p>`;
  else if(tab==='ayuda')c=ayudaBody();
  else c=`<section class="panel flush"><div class="tbl-wrap"><table><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th></tr></thead><tbody>${S.audit.slice(0,150).map(a=>`<tr><td class="num">${new Date(a.at).toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'})}</td><td>${esc(a.who)}</td><td>${esc(a.what)}</td></tr>`).join('')}</tbody></table></div></section>`;
  return `<div class="head"><div><div class="eyebrow">Ajustes</div><h1>Configuración</h1><p>${CN?`${esc(S.org.name||'')} · cada cambio se guarda en el servidor al confirmarse`:`${esc(S.pro.name)} · todo es editable y se guarda al instante`}</p></div></div>
  <div class="tabs" role="tablist">${(CN?tabs:[['auto','Automatizaciones'],['servicios','Servicios y tarifas'],['perfil','Datos profesionales'],['usuarios','Usuarios y permisos'],['horario','Horario y agenda'],['comms','Comunicaciones'],['audit','Auditoría'],['ayuda','Ayuda y soporte']]).map(([k,l])=>`<button role="tab" aria-selected="${tab===k}" data-act="ctab" data-t="${k}">${l}</button>`).join('')}</div>${c}${CN?'':`<div class="reset-zone"><button class="btn danger" data-act="reset">Restablecer datos de ejemplo</button><span class="muted small">Borra los cambios hechos en este navegador y vuelve a los datos de ejemplo.</span></div>`}`;
};

/* ===== modales ===== */
function modal(title,body,foot,wide){document.getElementById('modal').innerHTML=`<div class="ov" data-act="ovClose"><div class="mod ${wide?'wide':''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="grip"></div><header><h2>${title}</h2><button class="x" data-act="close" aria-label="Cerrar">×</button></header><div class="bd">${body}</div>${foot?`<footer>${foot}</footer>`:''}</div></div>`;const f=document.querySelector('.mod input:not([type=file]):not([type=hidden]),.mod select,.mod textarea');if(f&&!isMob())f.focus()}
function closeModal(){document.getElementById('modal').innerHTML=''}
const val=id=>{const e=document.getElementById(id);return e?e.value:''};

let APPT_CTX={isNew:true,keep:''};
function pickerList(q,keep){const n=norm(q).replace('#','').trim();return S.patients.filter(p=>(p.status!=='alta terapéutica'||p.id===keep)&&(!n||p.code.includes(n)||norm(p.name).includes(n))).sort((a,b)=>norm(a.name).localeCompare(norm(b.name))).slice(0,40)}
function pickerHTML(list){return list.length?list.map(p=>`<button type="button" class="combo-it" data-act="pickPt" data-id="${p.id}"><span class="av sm" style="${avStyle(p)}">${esc(initials(p.name))}</span><span class="pm"><b>${esc(p.name)}</b><span>${esc(SV(p.service).name)}</span></span><span class="pc">${p.code}</span></button>`).join(''):'<div class="empty">Sin resultados</div>'}
function onPatientPick(p){
  if(!APPT_CTX.isNew||!p)return;
  const s=document.getElementById('f-s');s.value=p.service;s.onchange();
  document.getElementById('f-m').value=p.modal;document.getElementById('f-l').value=p.modal==='online'?'Videollamada':LOC();
}
function apptForm(a,pre){
  pre=pre||{};const isNew=!a;if(W&&isNew)W.resetPending('appointment');a=a||{patientId:pre.p||'',date:pre.d||TODAY,start:pre.t||600,service:'s1',dur:60,modal:'presencial',loc:LOC()};
  APPT_CTX={isNew,keep:a.patientId};const cur=P(a.patientId);
  modal(isNew?'Nueva cita':'Reprogramar cita',`<div class="form">
    <div class="field full combo"><span>Paciente · busca por nombre o código</span>
      <input type="text" id="f-pq" placeholder="Escribe un nombre o un código…" autocomplete="off" value="${cur?esc('#'+cur.code+' · '+cur.name):''}">
      <input type="hidden" id="f-p" value="${esc(a.patientId)}">
      <div class="combo-list" id="f-plist" hidden></div></div>
    <div class="full muted small" style="margin-top:-6px">En el calendario la cita aparecerá solo con el código. ¿Paciente nuevo? <a href="#" data-act="newPatient">Créalo</a> y se le asignará un código.</div>
    <label class="field"><span>Fecha</span><input type="date" id="f-d" value="${a.date}"></label>
    <label class="field"><span>Hora</span><input type="time" id="f-t" step="900" value="${hm(a.start)}"></label>
    <label class="field"><span>Servicio</span><select id="f-s">${S.services.map(s=>`<option value="${s.id}" ${s.id===a.service?'selected':''}>${esc(s.name)} · ${eur(s.price)}</option>`).join('')}</select></label>
    <label class="field"><span>Duración (min)</span><input type="number" id="f-dur" min="15" step="5" value="${a.dur}"></label>
    <label class="field"><span>Modalidad</span><select id="f-m"><option ${a.modal==='presencial'?'selected':''}>presencial</option><option ${a.modal==='online'?'selected':''}>online</option></select></label>
    <label class="field"><span>Ubicación o enlace</span><input type="text" id="f-l" value="${esc(a.loc)}"></label>
    ${isNew?`<label class="field"><span>Repetir</span><select id="f-rep"><option value="0">No se repite</option><option value="7">Cada semana</option><option value="14">Cada dos semanas</option></select></label><label class="field" id="f-repn-w" hidden><span>Número de citas</span><input type="number" id="f-repn" min="2" max="52" value="8"></label><div id="f-rep-prev" class="full rep-prev" hidden></div>`:''}
    <label class="field full"><span>Notas administrativas (opcional)</span><textarea id="f-n" style="min-height:64px" placeholder="Por ejemplo: pago pendiente, cambio de sala…">${esc(a.notes||'')}</textarea></label>
    <div id="f-warn" class="full" hidden></div></div>`,
    `<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="saveAppt" data-id="${isNew?'':a.id}">${isNew?'Crear cita':'Guardar cambios'}</button>`);
  const s=document.getElementById('f-s');
  s.onchange=()=>{document.getElementById('f-dur').value=SV(s.value).dur;if(s.value==='s4'){document.getElementById('f-m').value='online';document.getElementById('f-l').value='Videollamada'}};
  const l=document.getElementById('f-plist');
  if(a.patientId){l.hidden=true}else{l.innerHTML=pickerHTML(pickerList('',''));l.hidden=isMob()}
  if(isNew&&pre.p)onPatientPick(P(pre.p));
  if(isNew){['f-rep','f-repn','f-d','f-t','f-dur'].forEach(id=>{const e=document.getElementById(id);if(e){e.addEventListener('input',repPreview);e.addEventListener('change',repPreview)}});const so=s.onchange;s.onchange=()=>{so();repPreview()}}
}
function conflicts(id,date,start,dur){return S.appts.filter(x=>x.id!==id&&x.date===date&&x.status!=='cancelada'&&x.start<start+dur&&start<x.start+x.dur)}
function blockOn(d){return (S.blocks||[]).find(b=>d>=b.from&&d<=b.to)}
const cutT=(t,n)=>{t=String(t||'').replace(/\s+/g,' ').trim();return t.length>n?t.slice(0,n).replace(/\s+\S*$/,'')+'…':t};
function prepInfo(a){
  const p=P(a.patientId);
  const prev=S.notes.filter(n=>n.patientId===p.id&&n.fields&&(n.created<a.date||(n.apptId&&n.apptId!==a.id&&n.created===a.date&&(S.appts.find(x=>x.id===n.apptId)||{start:9999}).start<a.start))).sort((x,y)=>y.created.localeCompare(x.created));
  const last=prev.find(n=>n.type==='sesion'||n.type==='inicial'||n.type==='evolucion');
  const ini=S.notes.filter(n=>n.patientId===p.id&&n.type==='inicial'&&n.fields&&n.fields.motivo).sort((x,y)=>x.created.localeCompare(y.created))[0];
  const num=S.appts.filter(x=>x.patientId===p.id&&x.status==='realizada'&&(x.date<a.date||(x.date===a.date&&x.start<a.start))).length+1;
  return {p,last,F:last?last.fields:{},ini,num};
}
const PI={
  target:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="m8 12.5 2.8 2.8L16.5 9"/></svg>',
  clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg>',
  layers:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/></svg>',
  flag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></svg>',
  pulse:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2.5-6 4 12 2.5-6H21"/></svg>',
  phone:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/></svg>'
};
function prepBlock(a){
  const {p,last,F,ini,num}=prepInfo(a);
  const dx=(p.dx||[]).slice().sort((x,y)=>y.date.localeCompare(x.date))[0];
  const ser=testSeries(p).map(t=>{const f=t.pts[0],l=t.pts[t.pts.length-1];const ab=(t.name.match(/\(([^)]+)\)/)||[])[1]||cutT(t.name,14);return {ab,l,dl:Math.round((l.v-f.v)*10)/10,n:t.pts.length}});
  const debt=S.invoices.filter(i=>i.patientId===p.id&&i.num).reduce((t,i)=>t+Math.max(0,tot(i).pending),0);
  const aus=S.appts.filter(x=>x.patientId===p.id&&x.status==='ausencia'&&x.date>=addDays(TODAY,-60)&&x.date<=TODAY).length;
  const att=S.appts.filter(x=>x.patientId===p.id&&x.date<=TODAY&&['realizada','ausencia','cancelada'].includes(x.status));const rate=att.length?Math.round(att.filter(x=>x.status==='realizada').length/att.length*100):null;
  const since=parse(p.alta).toLocaleDateString('es-ES',{month:'short',year:'numeric'}).replace('.','');
  const riskN=S.notes.filter(n=>n.patientId===p.id&&n.risk&&n.created<=a.date).sort((x,y)=>y.created.localeCompare(x.created))[0];
  const lastA=S.appts.filter(x=>x.patientId===p.id&&x.status==='realizada'&&x.date<a.date).sort((x,y)=>y.date.localeCompare(x.date))[0];
  const gap=lastA?Math.round((parse(a.date)-parse(lastA.date))/864e5):null;
  const gapTxt=gap==null?'':gap===0?'última sesión hoy':gap===1?'última sesión ayer':gap<14?`última sesión hace ${gap} días`:`última sesión hace ${Math.round(gap/7)} semanas`;
  const dueT=testSeries(p).filter(t=>{const ld=t.pts[t.pts.length-1].d;return S.appts.filter(x=>x.patientId===p.id&&x.status==='realizada'&&x.date>ld&&x.date<a.date).length>=8}).map(t=>(t.name.match(/\(([^)]+)\)/)||[])[1]||t.name);
  const alerts=[!p.consent?'<span class="chip warn">Sin consentimiento firmado</span>':'',debt>0?`<span class="chip warn">Pendiente de pago · ${eur(debt)}</span>`:'',aus?`<span class="chip bad">${aus} ${aus===1?'ausencia':'ausencias'} en 2 meses</span>`:''].filter(Boolean).join('');
  const t0=ser[0];
  const it=(ic,l,t,act,id,tab,cls)=>t?`<div class="pp-it"><span class="pp-ic ${cls||''}">${PI[ic]}</span><span class="pp-tx"><span class="pp-l">${l}</span><p>${esc(String(t).trim())}</p></span></div>`:'';
  const nid_=last?last.id:'';
  return `<section class="prep2">
    ${riskN?`<div class="pp-risk"><b>Riesgo señalado</b><span>En la sesión del ${fDy(riskN.created)}. Revisa la nota antes de empezar.</span></div>`:''}
    ${alerts?`<div class="pp-alerts">${alerts}</div>`:''}
    <div class="pp-head"><span class="pp-av">${esc(initials(p.name))}</span><div class="pp-who"><b>${esc(p.name)}</b><span>${num===1?'Primera sesión':'Desde '+since}${gapTxt?` · <em class="${gap>=21?'gap-long':''}">${gapTxt}</em>`:''}</span></div><button class="btn sm" data-act="openPatient" data-id="${p.id}" data-tab="clinico">Ficha</button></div>
    <div class="pp-stats">
      <div class="pp-stat"><span>Sesión</span><b>${num}</b></div>
      ${t0?`<div class="pp-stat"><span>${esc(t0.ab)}</span><b>${t0.l.v}${t0.n>1?`<em>${t0.dl>0?'+':''}${t0.dl}</em>`:''}</b></div>`:`<div class="pp-stat"><span>Pruebas</span><b class="pp-none">—</b></div>`}
      <div class="pp-stat"><span>Asistencia</span><b>${rate==null?'—':rate+'%'}</b></div>
    </div>
    ${last&&F.plan?`<div class="pp-plan"><span class="pp-k">${PI.target}${a.date===TODAY?'Plan para hoy':'Plan para el '+fDs(a.date)}</span><p>${esc(String(F.plan).trim())}</p></div>`:''}
    ${last&&F.proxima?`<div class="pp-note"><span class="pp-k">Recordatorio que dejaste</span><p>${esc(F.proxima)}</p></div>`:''}
    ${dueT.length?`<div class="pp-due">Toca repetir: <b>${dueT.map(esc).join(', ')}</b> · han pasado 8 sesiones o más desde la última vez</div>`:''}
    <div class="pp-list">
      ${last?it('check','Repasar tareas',F.acuerdos,'openNote',nid_)+it('clock','Cómo fue la última sesión',[F.observaciones,F.resumen].filter(Boolean).join(' '),'openNote',nid_)+it('layers','Se trabajó',F.objetivos,'openNote',nid_):`<div class="pp-it pp-first"><span class="pp-ic">${PI.flag}</span><span class="pp-tx"><span class="pp-l">Primera sesión</span><p>Todavía no hay notas anteriores de este paciente.</p></span></div>`}
      ${ini&&num>1?it('flag','Motivo de consulta',ini.fields.motivo,'openNote',ini.id):''}
      ${dx?it('pulse','Diagnóstico',dx.title.replace(/\s*\(.*?\)\s*/g,' '),'openPatient',p.id,'clinico','soft'):''}
      ${p.obs?it('phone','Observaciones de la llamada',p.obs,'openPatient',p.id,'resumen','warm'):''}
    </div>
    ${last?`<div class="pp-foot">Última nota del ${fD(last.created)}${last.status==='borrador'?' <span class="chip warn">A medias</span>':''}</div>`:''}
  </section>`;
}
const modeL=a=>{const n=SV(a.service).name;return /^Sesión (individual|online)$/.test(n)?(a.modal==='online'?'Sesión online':'Sesión presencial'):`${n}${a.modal?' · '+a.modal:''}`};
const ICH={
  chat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4A8 8 0 1 1 20 11.5Z"/><path d="M9 10.5h6M9 13.5h4"/></svg>',
  ok:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>'
};
function waLink(a){const p=P(a.patientId);let n=String(p.phone||'').replace(/\D/g,'');if(!n)return '';if(n.length===9)n='34'+n;
  const t=`Hola, te escribimos de la consulta de ${S.pro.name}. Tienes cita el ${fDs(a.date)} a las ${hm(a.start)}. ¿Nos confirmas tu asistencia? Responde SÍ o NO. Gracias.`;
  return `https://wa.me/${n}?text=${encodeURIComponent(t)}`}
const fDy=d=>d&&d.slice(0,4)===String(YEAR)?sdm(d):fD(d);
function fichaTop(p,isPsi){
  const ap=S.appts.filter(a=>a.patientId===p.id);const done=ap.filter(a=>a.status==='realizada').length;
  const att=ap.filter(a=>a.date<=TODAY&&['realizada','ausencia','cancelada'].includes(a.status));const rate=att.length?Math.round(att.filter(a=>a.status==='realizada').length/att.length*100):null;
  const nx=pNext(p);const since=parse(p.alta).toLocaleDateString('es-ES',{month:'short',year:'numeric'}).replace('.','');
  const ser=testSeries(p)[0];let t0=null;if(ser){const f=ser.pts[0],l=ser.pts[ser.pts.length-1];t0={ab:(ser.name.match(/\(([^)]+)\)/)||[])[1]||cutT(ser.name,14),v:l.v,dl:Math.round((l.v-f.v)*10)/10,n:ser.pts.length}}
  const ph=String(p.phone||'').replace(/\D/g,'');const wa=ph?'https://wa.me/'+(ph.length===9?'34'+ph:ph):'';
  const debt=S.invoices.filter(i=>i.patientId===p.id&&i.num).reduce((t,i)=>t+Math.max(0,tot(i).pending),0);
  const alerts=[!p.consent?'<button class="chip warn" data-act="ptab" data-t="docs">Sin consentimiento firmado ›</button>':'',debt>0?`<span class="chip warn">Pendiente de pago · ${eur(debt)}</span>`:''].filter(Boolean).join('');
  let clin='';
  if(isPsi){const notes=S.notes.filter(n=>n.patientId===p.id&&n.fields).sort((a,b)=>b.created.localeCompare(a.created));
    const ini=notes.filter(n=>n.type==='inicial'&&n.fields.motivo).pop();const dx=(p.dx||[]).slice().sort((a,b)=>b.date.localeCompare(a.date))[0];
    const obj=notes.find(n=>n.fields.objetivos);const last=notes.find(n=>n.type==='sesion');
    const it=(ic,l,t,cls)=>t?`<div class="pp-it"><span class="pp-ic ${cls||''}">${PI[ic]}</span><span class="pp-tx"><span class="pp-l">${l}</span><p>${esc(String(t).trim())}</p></span></div>`:'';
    clin=it('flag','Motivo de consulta',ini&&ini.fields.motivo)+it('pulse','Diagnóstico',dx&&dx.title.replace(/\s*\(.*?\)\s*/g,' '),'soft')+it('target','Objetivo actual',obj&&obj.fields.objetivos)+it('clock',last?'Última sesión · '+fDy(last.created):'Última sesión',last&&[last.fields.observaciones,last.fields.resumen].filter(Boolean).join(' '))+it('check','Tareas para casa',last&&last.fields.acuerdos);
    if(!clin)clin=`<div class="pp-it"><span class="pp-ic">${PI.flag}</span><span class="pp-tx"><span class="pp-l">Sin notas todavía</span><p>Aquí aparecerá lo clínico cuando escribas la primera nota.</p></span></div>`}
  return `<div class="fs">
    <div class="fs-contact">${ph?`<a class="btn" href="tel:${esc(p.phone)}">${PI.phone}Llamar</a>`:''}${wa?`<a class="btn" href="${wa}" target="_blank" rel="noopener">${ICH.chat}WhatsApp</a>`:''}${p.email?`<a class="btn" href="mailto:${esc(p.email)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>Email</a>`:''}</div>
    ${alerts?`<div class="pp-alerts">${alerts}</div>`:''}
    <section class="fs-card"><h3>En qué punto está</h3><div class="pp-stats"><div class="pp-stat"><span>Sesiones</span><b>${done}</b></div><div class="pp-stat"><span>Asistencia</span><b>${rate==null?'—':rate+'%'}</b></div>${!isPsi?`<div class="pp-stat"><span>Viene desde</span><b style="font-size:1.05rem">${since}</b></div>`:t0?`<div class="pp-stat"><span>${esc(t0.ab)}</span><b>${t0.v}${t0.n>1?`<em>${t0.dl>0?'+':''}${t0.dl}</em>`:''}</b></div>`:`<div class="pp-stat"><span>Pruebas</span><b class="pp-none">—</b></div>`}</div>
    <p class="fs-line">${nx?`Próxima cita: <b>${fDs(nx.date)}, ${hm(nx.start)}</b>`:'<b>Sin próxima cita</b>'} · viene desde ${since}</p></section>
    ${isPsi?`<section class="fs-card"><h3>Clínico</h3><div class="pp-list">${clin}</div></section>`:''}
  </div>`;
}
const ST_L={confirmada:'Confirmada',pendiente:'Por confirmar',realizada:'Realizada',ausencia:'Ausencia'};
function dayList(d){
  const av=(AVAIL[dow(d)]||[]).slice().sort((a,b)=>a[0]-b[0]);const bl=blockOn(d);
  const aps=apptsOn(d).filter(a=>a.status!=='cancelada');const nc=apptsOn(d).length-aps.length;
  const nm=nowMin();const isT=d===TODAY;const past=d<TODAY;
  if(bl&&!aps.length)return `<div class="dl-empty closed">${SVG(IC.cal)}<b>${esc(bl.label)}</b><span>Día cerrado: no se dan citas.</span></div>`;
  const items=aps.map(a=>({t:a.start,k:'a',a}));
  if(!bl&&!past&&!noEdit())av.forEach(([s0,e0])=>{for(let t=s0;t+60<=e0;t+=60){if(isT&&t+60<=nm)continue;if(!aps.some(a=>a.start<t+60&&t<a.start+a.dur))items.push({t,k:'f'})}});
  for(let i=1;i<av.length;i++)if(av[i][0]>av[i-1][1])items.push({t:av[i-1][1],k:'b',e:av[i][0]});
  items.sort((x,y)=>x.t-y.t||(x.k==='b'?-1:y.k==='b'?1:0));
  if(!items.length)return `<div class="dl-empty">${SVG(IC.cal)}<b>Sin citas</b><span>${av.length?'No hay citas este día.':'Este día no hay horario de consulta.'}</span></div>`;
  let nowDone=!isT||nm<H0*60||nm>H1*60;const nowLine=`<div class="dl-now"><span>Ahora · ${hm(nm)}</span></div>`;
  const html=items.map(it=>{let pre='';if(!nowDone&&it.t>=nm){nowDone=true;pre=nowLine}
    if(it.k==='b')return pre+`<div class="dl-break"><span>Descanso · ${hm(it.t)} – ${hm(it.e)}</span></div>`;
    if(it.k==='f')return pre+`<button class="dl-row dl-free" data-act="slotNew" data-d="${d}" data-t="${it.t}" aria-label="Crear cita a las ${hm(it.t)}"><span class="dl-time"><b>${hm(it.t)}</b></span><span class="dl-card"><span class="dl-plus">+</span>Hueco libre</span></button>`;
    const a=it.a;const p=P(a.patientId);
    return pre+`<button class="dl-row" data-act="openAppt" data-id="${a.id}"><span class="dl-time"><b>${hm(a.start)}</b><small>${hm(a.start+a.dur)}</small></span><span class="dl-card st-${a.status}${bl?' inblock':''}"><span class="dl-top"><span class="pc">${p.code}</span><span class="chip ${CHIP[a.status]||''}">${ST_L[a.status]||esc(a.status)}</span></span><span class="dl-sv">${esc(modeL(a))}</span><span class="dl-meta">${[S.role==='psicologa'&&!['realizada','ausencia'].includes(a.status)?'Sesión nº '+prepInfo(a).num:'',a.seriesId?(a.seriesEvery===14?'Cada dos semanas':'Cada semana'):''].filter(Boolean).join(' · ')}</span></span></button>`}).join('');
  return `<div class="dlist">${html}${nowDone?'':nowLine}${nc?`<div class="dl-canc">${nc} ${nc===1?'cita cancelada':'citas canceladas'} este día</div>`:''}</div>`;
}
const REPSVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></svg>';
const sdm=d=>parse(d).toLocaleDateString('es-ES',{day:'numeric',month:'short'}).replace('.','');
function seriesDates(date,start,dur,every,n){const out=[];for(let k=0;k<n;k++){const d=addDays(date,k*every);const b=blockOn(d);const cf=b?[]:conflicts(null,d,start,dur);out.push({d,skip:b?b.label:cf.length?'Ocupado':''})}return out}
function repPreview(){
  const r=Number(val('f-rep'));const w=document.getElementById('f-repn-w'),pv=document.getElementById('f-rep-prev');if(!w||!pv)return;
  w.hidden=!r;pv.hidden=!r;if(!r)return;
  const n=Math.min(52,Math.max(2,Number(val('f-repn'))||8));const t=val('f-t'),date=val('f-d'),dur=Number(val('f-dur'))||60;if(!date||!t){pv.innerHTML='';return}
  const L=seriesDates(date,toMin(t),dur,r,n);const ok=L.filter(x=>!x.skip).length;
  pv.innerHTML=`<div class="rep-h">${!ok?'<b>Ninguna fecha está libre a esa hora.</b> Prueba otro día u otra hora':`<b>${ok} ${ok===1?'cita':'citas'}</b> ${r===7?'cada semana':'cada dos semanas'} a las ${t}`}${ok&&ok<L.length?` · <span class="rep-skip">${L.length-ok} ${L.length-ok===1?'fecha se salta':'fechas se saltan'}</span>`:''}</div><div class="rep-dates">${L.map(x=>x.skip?`<span class="rep-d skip" title="${esc(x.skip)}"><s>${sdm(x.d)}</s><small>${esc(x.skip)}</small></span>`:`<span class="rep-d">${sdm(x.d)}</span>`).join('')}</div>`;
}
function blocksPanel(){
  if(W&&!S.blocksAvailable)return `<section class="panel" id="sec-blocks"><header><h2>Vacaciones y festivos</h2></header><div class="box">Este servidor todavía no guarda días cerrados. No se pueden añadir con la cuenta conectada.</div></section>`;
  if(W&&!(S.pro&&S.pro.id))return `<section class="panel" id="sec-blocks"><header><h2>Vacaciones y festivos</h2></header><div class="box">Para cerrar días, primero crea tu ficha profesional en Ajustes › Mi perfil profesional.</div></section>`;
  const B=(S.blocks||[]).slice().sort((a,b)=>a.from.localeCompare(b.from));const fut=B.filter(b=>b.to>=TODAY),pst=B.filter(b=>b.to<TODAY);
  const nd=b=>Math.round((parse(b.to)-parse(b.from))/864e5)+1;
  const row=b=>`<div class="blk ${b.to<TODAY?'past':''}"><span class="blk-ic">${SVG(IC.cal)}</span><div class="blk-t"><b>${esc(b.label)}</b><span>${b.from===b.to?fDs(b.from):`${fD(b.from)} – ${fD(b.to)}`} · ${nd(b)} ${nd(b)===1?'día':'días'}</span></div><button class="x" data-act="blockDel" data-id="${b.id}" aria-label="Quitar ${esc(b.label)}">×</button></div>`;
  return `<section class="panel" id="sec-blocks"><header><h2>Vacaciones y festivos</h2><span class="muted small">Esos días no se dan citas</span></header>
    <div class="blk-wrap"><div><div class="blk-list">${fut.map(row).join('')||'<div class="empty">No hay días cerrados próximos.</div>'}</div>
    ${pst.length?`<details class="more-todos"><summary>Ver ${pst.length} ${pst.length===1?'pasado':'pasados'}</summary><div class="blk-list" style="margin:8px 0 0">${pst.map(row).join('')}</div></details>`:''}</div>
    <div class="form blk-form"><label class="field"><span>Desde</span><input type="date" id="bk-f" value="${TODAY}"></label><label class="field"><span>Hasta</span><input type="date" id="bk-t" value="${TODAY}"></label>
    <label class="field full"><span>Motivo</span><input type="text" id="bk-l" placeholder="Vacaciones, festivo local, formación…"></label><div class="full"><button class="btn primary" data-act="blockAdd">${SVG(IC.plus)}Añadir días cerrados</button></div></div></div></section>`;
}
let DRAG=null;
function moveAsk(id,d,t){
  const a=S.appts.find(x=>x.id===id);if(!a)return;const ns=t+(a.start%60);if(a.date===d&&a.start===ns)return;const p=P(a.patientId);const cf=conflicts(a.id,d,ns,a.dur);
  modal('Mover cita',`<div class="mv"><div class="mv-b"><span>Ahora</span><b>${fDs(a.date)}</b><em>${hm(a.start)}</em></div><span class="mv-ar">→</span><div class="mv-b now"><span>Nueva fecha</span><b>${fDs(d)}</b><em>${hm(ns)}</em></div></div>
    <p style="margin:0">${pc(p)} ${esc(SV(a.service).name)} · ${a.dur} min</p>${cf.length?`<div class="box warn">Se solapa con ${cf.map(c=>P(c.patientId).code).join(', ')}.</div>`:''}${S.settings.confirmEmail?'<p class="muted small" style="margin:0">El paciente recibirá un correo con la nueva fecha.</p>':''}`,
    `<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="moveDo" data-id="${a.id}" data-d="${d}" data-t="${ns}">Mover cita</button>`);
}
function openAppt(id){
  if(S.role==='agenda'){const x=S.appts.find(y=>y.id===id);const q=P(x.patientId);modal(`<span class="pc big">${q.code}</span> <span style="font-weight:600;color:var(--muted);font-size:.95rem">${fDs(x.date)}</span>`,`<dl class="dl"><dt>Estado</dt><dd>${chip(x.status)}</dd><dt>Horario</dt><dd>${hm(x.start)}–${hm(x.start+x.dur)} (${x.dur} min)</dd><dt>Modalidad</dt><dd>${esc(x.modal)} · ${esc(x.loc)}</dd></dl>`,`<button class="btn" data-act="close">Cerrar</button>`);return}
  const a=S.appts.find(x=>x.id===id);const p=P(a.patientId);const n=noteFor(a);const inv=S.invoices.find(i=>i.id===a.invoiceId);const isPsi=S.role==='psicologa';
  const open=['pendiente','confirmada'].includes(a.status);
  modal(`<span class="pc big">${p.code}</span> <span style="font-weight:600;color:var(--muted);font-size:.95rem">${fDs(a.date)}</span>`,`${isPsi?prepBlock(a)+'<div class="pp-sep">Datos de la cita</div>':''}<dl class="dl"><dt>Estado</dt><dd>${chip(a.status)}${a.cancelReason?` <span class="muted">${esc(a.cancelReason)}</span>`:''}</dd><dt>Horario</dt><dd>${hm(a.start)}–${hm(a.start+a.dur)} (${a.dur} min)</dd>${a.seriesId?`<dt>Se repite</dt><dd>${a.seriesEvery===14?'Cada dos semanas':'Cada semana'} · cita ${a.seriesIdx} de ${a.seriesTotal}</dd>`:''}${blockOn(a.date)&&['pendiente','confirmada'].includes(a.status)?`<dt>Aviso</dt><dd><span class="chip bad">Día cerrado · ${esc(blockOn(a.date).label)}</span></dd>`:''}<dt>Servicio</dt><dd>${esc(SV(a.service).name)} · ${eur(a.price)}</dd><dt>Modalidad</dt><dd>${esc(a.modal)} · ${esc(a.loc)}</dd>${a.notes?`<dt>Notas</dt><dd>${esc(a.notes)}</dd>`:''}
    ${isPsi&&a.status==='realizada'?`<dt>Nota</dt><dd>${n?chip(n.status):'<span class="chip warn">Sin nota</span>'}</dd>`:''}
    ${a.status==='realizada'?`<dt>Factura</dt><dd>${inv?`<a href="#" data-act="openInv" data-id="${inv.id}">${inv.num||'Borrador'}</a> · ${chip(invStatus(inv))}`:'Sin facturar'}</dd>`:''}</dl>
    ${open?`<label class="field"><span>Motivo si se cancela</span><select id="f-cr"><option>Indisposición del paciente</option><option>Motivo laboral</option><option>Cancelada por la consulta</option><option>Otro</option></select></label>`:''}
    <details><summary class="muted" style="cursor:pointer">Cambios en esta cita (${a.log.length})</summary><div class="timeline" style="margin-top:8px">${a.log.slice().reverse().map(l=>`<div class="ev"><span class="dt">${fD(l.at.slice(0,10))}</span><span class="dot mail"></span><span class="tx">${esc(l.what)} · ${esc(l.who)}</span></div>`).join('')}</div></details>`,
    `<button class="btn sm" data-act="openPatient" data-id="${p.id}">Ficha</button>
    ${open?`<button class="btn sm" data-act="reschedule" data-id="${a.id}">Reprogramar</button><button class="btn sm danger" data-act="cancelAppt" data-id="${a.id}">Cancelar</button>${a.seriesId&&S.appts.some(x=>x.seriesId===a.seriesId&&x.date>a.date&&['pendiente','confirmada'].includes(x.status))?`<button class="btn sm danger" data-act="cancelSeries" data-id="${a.id}">Cancelar esta y las siguientes</button>`:''}<button class="btn sm" data-act="noshow" data-id="${a.id}" ${a.date>TODAY?'disabled':''}>Ausencia</button>${a.dayMail===TODAY&&a.status==='pendiente'?`<button class="btn sm" data-act="mailView" data-id="${a.id}">Ver correo</button>`:''}${a.status!=='confirmada'?`<button class="btn sm" data-act="confirm" data-id="${a.id}">Confirmar</button>`:''}<button class="btn sm primary" data-act="done" data-id="${a.id}" ${a.date>TODAY?'disabled title="Solo el día de la cita o después"':''}>Marcar realizada</button>`:''}
    ${(!W||isPsi&&S.billingLinkAvailable)&&a.status==='realizada'&&!inv&&p.billing.type!=='empresa'&&S.settings.invoiceMode!=='manual'?`<button class="btn sm" data-act="billNow" data-id="${a.id}">Facturar ya</button>`:''}
    ${a.status==='realizada'&&isPsi?`<button class="btn sm primary" data-act="note" data-id="${a.id}">${n?'Abrir nota':'Escribir nota'}</button>`:''}`);
}
function logA(a,what){a.log.push({at:new Date().toISOString(),who:uName(curUser()),what})}
function markDone(a){
  a.status='realizada';logA(a,'Marcada como realizada');const p=P(a.patientId);audit(`Cita ${p.code} del ${a.date} marcada como realizada`);
  toast(p.billing.type==='empresa'?'Sesión cerrada · irá en la factura mensual de la empresa':S.settings.invoiceMode==='manual'?'Sesión cerrada':'Sesión cerrada · la factura saldrá al firmar la nota');
}
function billAppt(a){
  const p=P(a.patientId);const msgs=[];
  if(S.settings.invoiceMode!=='manual'&&p.billing.type!=='empresa'&&!a.invoiceId){
    const sv=SV(a.service);const inv=mkInv(S,p,TODAY,[{desc:`${sv.name} · ${fD(a.date)}`,qty:1,price:a.price,exempt:sv.exempt&&S.pro.sanitaria}],[a.id]);
    S.invoices.push(inv);a.invoiceId=inv.id;
    if(S.settings.invoiceMode==='auto'){emit(inv);msgs.push(`factura ${inv.num} emitida${S.settings.sendInvoice?' y enviada':''}`)}else msgs.push('borrador de factura creado');
  }else if(p.billing.type==='empresa')msgs.push('irá en la factura mensual de la empresa');
  return msgs;
}
function emit(inv){
  const yr=inv.date.slice(0,4);const pre=inv.serie+yr+'/';
  const n=S.invoices.filter(i=>i.num&&i.num.startsWith(pre)).length+1;
  inv.num=pre+String(n).padStart(4,'0');inv.status='emitida';inv.prevHash=S.lastHash||'0000000000000000';inv.hash=fnv(inv.prevHash+inv.num+inv.date+tot(inv).total);S.lastHash=inv.hash;
  inv.due=addDays(inv.date,S.settings.dueDays);audit(`Factura ${inv.num} emitida (${eur(tot(inv).total)})`);
  if(S.settings.sendInvoice)sendInv(inv,true);
}
function sendInv(inv,quiet){const to=inv.patientId?P(inv.patientId).email:'cliente';mail(to,`Factura ${inv.num}`,`Adjuntamos la factura ${inv.num} por importe de ${eur(tot(inv).total)}.`,'Factura');inv.sent={at:TODAY,to,ok:true};audit(`Factura ${inv.num} enviada`);if(!quiet)toast('Factura enviada')}
// Emisor de la factura: el congelado al emitir (modo conectado), el perfil fiscal de la clínica o, en la demo, la profesional.
const issuerOf=i=>i.issuer||S.issuer||{name:S.pro.name,nif:S.pro.nif,addr:S.pro.addr};
function openInv(id){
  const i=S.invoices.find(x=>x.id===id);const t=tot(i);const st=invStatus(i);const ro=S.role==='gestoria';const draft=i.status==='borrador';
  const lines=i.lines.map((l,k)=>`<tr><td>${draft&&!ro?`<input type="text" value="${esc(l.desc)}" data-ld="${k}" id="ld-${k}" aria-label="Concepto">`:esc(l.desc)}</td><td class="r num">${l.qty}</td><td class="r">${draft&&!ro?`<input type="number" step="0.01" value="${l.price/100}" data-lp="${k}" id="lp-${k}" style="width:90px;text-align:right" aria-label="Precio">`:eur(l.price)}</td><td>${l.exempt?'Exento':'21 %'}</td><td class="r">${eur(Math.round(l.qty*l.price))}</td></tr>`).join('');
  const p=i.patientId?P(i.patientId):null;const showName=!p||p.billing.type==='empresa'||REVEAL[p.id]||S.role!=='gestoria';
  modal(i.num?`Factura ${i.num}`:'Borrador de factura',`<div class="inv">
    <div class="top"><div><div class="eyebrow" style="color:var(--muted)">Emisor</div><b>${esc(issuerOf(i).name)}</b><div class="muted small">NIF ${esc(issuerOf(i).nif)}<br>${esc(issuerOf(i).addr)}<br>Colegiada ${esc(S.pro.col)}</div></div>
    <div style="text-align:right"><div class="numb">${i.num||'BORRADOR'}</div><div class="muted small">Fecha ${fD(i.date)}<br>Vence ${fD(i.due)}</div><div style="margin-top:6px">${chip(st)}</div></div></div>
    <div><div class="eyebrow" style="color:var(--muted)">Destinatario</div>${showName?`<b>${esc(i.to.name)}</b>${i.to.nif?`<div class="muted small">${esc(i.to.nif)} · ${esc(i.to.addr)}</div>`:''}`:`${pc(p)} <span class="masked">••••••••</span> <button class="btn sm ghost" data-act="revealInv" data-id="${p.id}" data-inv="${i.id}">${SVG(IC.eye)}Mostrar</button><div class="muted small">El nombre figura en el documento que recibe el paciente.</div>`}</div>
    <div class="tbl-wrap"><table><thead><tr><th>Concepto</th><th class="r">Cant.</th><th class="r">Precio</th><th>IVA</th><th class="r">Importe</th></tr></thead><tbody>${lines}</tbody></table></div>
    <div class="tot"><span>Base imponible</span><span>${eur(t.base)}</span><span>IVA</span><span>${eur(t.iva)}</span>${i.ret?`<span>Retención IRPF ${i.ret} %</span><span>−${eur(t.ret)}</span>`:''}<span class="g">Total</span><span class="g">${eur(t.total)}</span>${t.paid?`<span class="muted">Cobrado</span><span class="muted">${eur(t.paid)}</span><span class="muted">Pendiente</span><span class="muted">${eur(Math.max(0,t.pending))}</span>`:''}</div>
    ${i.lines.some(l=>l.exempt)?`<div class="muted small">Operación exenta de IVA conforme al art. 20.Uno.3º de la Ley 37/1992.</div>`:''}
    ${i.hash?`<div class="vf"><div>Registro de facturación encadenado (simulado)<br><span class="mono">Huella ${i.hash} · anterior ${i.prevHash}</span><br>Prototipo: no conectado a la AEAT ni certificado Verifactu.</div></div>`:''}
  </div>
  ${i.payments.length?`<section><h3>Cobros</h3><div class="list">${i.payments.map(x=>`<div class="row"><div class="m"><b>${eur(x.amount)}</b><span>${fD(x.date)} · ${esc(x.method)}${x.ref?' · '+esc(x.ref):''}</span></div></div>`).join('')}</div></section>`:''}
  ${i.sent?`<p class="muted small" style="margin:0">Enviada el ${fD(i.sent.at)} a ${esc(maskEmail(i.sent.to))} · entrega correcta</p>`:''}
  ${!draft&&t.pending>0&&!ro&&i.kind!=='R'?`<div class="form" style="align-items:end"><label class="field"><span>Registrar cobro</span><input type="number" step="0.01" id="pay-a" value="${(t.pending/100).toFixed(2)}"></label><label class="field"><span>Método</span><select id="pay-m"><option>Tarjeta</option><option>Bizum</option><option>Transferencia</option><option>Efectivo</option></select></label></div>`:''}`,
  ro?'<button class="btn" data-act="close">Cerrar</button>':
  draft?`<button class="btn danger" data-act="delInv" data-id="${i.id}">Descartar</button><button class="btn" data-act="saveDraft" data-id="${i.id}">Guardar</button><button class="btn primary" data-act="emitInv" data-id="${i.id}">Emitir</button>`:
  `${i.kind!=='R'&&st!=='rectificada'?`<button class="btn" data-act="rectInv" data-id="${i.id}">Rectificar</button>`:''}${st==='vencida'?`<button class="btn" data-act="remind" data-id="${i.id}">Recordatorio de pago</button>`:''}<button class="btn" data-act="pdfInv" data-id="${i.id}">${SVG(IC.download)}Exportar PDF</button><button class="btn" data-act="sendInv" data-id="${i.id}">${i.sent?'Reenviar':'Enviar'}</button>${t.pending>0&&i.kind!=='R'?`<button class="btn primary" data-act="payInv" data-id="${i.id}">Registrar cobro</button>`:''}`,true);
}
function noteEditor(n){if(W&&n&&!NB[n.id])NB[n.id]=nbCopy(n);closeModal();S.view='informes';S.sel.editing=n.id;render();window.scrollTo(0,0)}
function ensureNote(a){let n=noteFor(a)||(W?Object.values(NB).find(x=>x.apptId===a.id):null);if(!n){n={id:nid('n'),patientId:a.patientId,apptId:a.id,type:a.service==='s3'?'inicial':'sesion',fields:{},status:'borrador',author:W?'':S.pro.name,created:a.date,signedAt:null,versions:[]};if(W){n.unsaved=true;NB[n.id]=n}else S.notes.push(n)}return n}
function readNote(n){document.querySelectorAll('[data-nf]').forEach(t=>n.fields[t.dataset.nf]=t.value.trim());const r=document.getElementById('nf-risk');if(r)n.risk=r.checked}
function newCode(){let c;do{c=String(1000+Math.floor(Math.random()*9000))}while(S.patients.some(p=>p.code===c));return c}
function patientForm(p){
  const isNew=!p;if(W&&isNew)W.resetPending('patient');p=p||{code:W?'····':newCode(),name:'',email:'',phone:'',modal:'presencial',service:'s1',billing:{type:'particular',name:'',nif:'',addr:'',ret:15},reminders:true};
  modal(isNew?'Nuevo paciente':`Editar <span class="pc">${p.code}</span>`,`${isNew?`<div class="box" style="display:flex;gap:12px;align-items:center"><span class="pc big">${p.code}</span><span>Código confidencial asignado. Es el que verás en el calendario, las reservas y los listados.</span></div>`:''}
  <div class="form">
  <label class="field full"><span>Nombre y apellidos</span><input type="text" id="np-n" value="${esc(p.name)}"></label>
  <label class="field"><span>Email</span><input type="email" id="np-e" value="${esc(p.email)}"></label><label class="field"><span>Teléfono</span><input type="tel" id="np-t" value="${esc(p.phone)}"></label>
  <label class="field"><span>Servicio habitual</span><select id="np-s">${S.services.map(s=>`<option value="${s.id}" ${s.id===p.service?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>
  <label class="field"><span>Modalidad</span><select id="np-m"><option ${p.modal==='presencial'?'selected':''}>presencial</option><option ${p.modal==='online'?'selected':''}>online</option></select></label>
  <label class="field"><span>Facturar a</span><select id="np-bt"><option value="particular" ${p.billing.type==='particular'?'selected':''}>El propio paciente</option><option value="empresa" ${p.billing.type==='empresa'?'selected':''}>Empresa (con retención)</option></select></label>
  <label class="field"><span>Razón social si es empresa</span><input type="text" id="np-bn" value="${p.billing.type==='empresa'?esc(p.billing.name):''}"></label>
  <label class="field"><span>NIF / CIF para la factura</span><input type="text" id="np-bnif" value="${esc(p.billing.nif)}"></label>
  <label class="field full"><span>Dirección</span><input type="text" id="np-addr" value="${esc(p.billing.addr||'')}"></label>
  ${W?'':`<label class="field full"><span>Observaciones de la llamada</span><textarea id="np-obs" style="min-height:76px">${esc(p.obs||'')}</textarea></label>`}
  <label class="toggle"><div><b>Recordatorios de cita</b></div><input type="checkbox" class="sw" id="np-r" ${p.reminders?'checked':''}></label>
  </div>${isNew?'<p class="muted small" style="margin:0">El consentimiento firmado se sube después desde la ficha (foto o PDF).</p>':''}<div id="np-err" hidden class="box warn"></div>`,`<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="savePatient" data-id="${isNew?'':p.id}" data-code="${p.code}">${isNew?'Crear paciente':'Guardar'}</button>`);
}

/* ===== archivos: fotos y PDF ===== */
async function compress(file,max=1400,q=.72){
  if(!file.type.startsWith('image/'))return null;
  try{const bmp=await createImageBitmap(file);const s=Math.min(1,max/Math.max(bmp.width,bmp.height));const c=document.createElement('canvas');c.width=Math.round(bmp.width*s);c.height=Math.round(bmp.height*s);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);return await new Promise(r=>c.toBlob(r,'image/jpeg',q))}catch(e){return null}
}
const toDataURL=b=>new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.onerror=()=>r(null);fr.readAsDataURL(b)});
async function store(blob){
  return await data.uploadFile(blob,{assets:ASSETS,toDataURL});
}
let SCAN=null;
async function startScan(file){
  const blob=await compress(file);const isPdf=file.type==='application/pdf';
  SCAN={file,blob,preview:blob?URL.createObjectURL(blob):null,ai:null,status:'idle'};
  const guessName=file.name.replace(/\.[a-z0-9]+$/i,'').replace(/[_-]+/g,' ').replace(/^(img|image|scan|foto|photo|pxl|dsc)\s?\d*/i,'').trim();
  modal('Nueva factura recibida',`<div class="grid2" style="gap:16px">
    <div>${SCAN.preview?`<img class="preview" src="${SCAN.preview}" alt="Foto de la factura">`:`<div class="drop">${SVG(IC.doc)}<b>${esc(file.name)}</b><span class="muted small">${isPdf?'PDF adjuntado':'Archivo adjuntado'}</span></div>`}</div>
    <div class="stack" style="gap:12px">
      <label class="field"><span>Nombre del proveedor o concepto</span><input type="text" id="sc-n" value="${esc(guessName)}" placeholder="Ej.: Inmobiliaria, Endesa, papelería…"></label>
      <label class="field"><span>Categoría</span><select id="sc-c">${CATS.map(c=>`<option ${c===guessCat(guessName)?'selected':''}>${c}</option>`).join('')}</select></label>
      <label class="field"><span>% deducible</span><input type="number" min="0" max="100" id="sc-ded" placeholder="Según la categoría"></label>
      <div id="sc-ai" class="box">${blob&&SAMPLE&&S.settings.aiScan?'<span class="spin"></span> Leyendo la factura…':'Los importes quedarán pendientes de revisar y podrás completarlos desde el gasto.'}</div>
      <details id="sc-det"><summary class="muted small" style="cursor:pointer">Ver o corregir los datos leídos</summary><div class="form" style="margin-top:10px">
        <label class="field"><span>Fecha</span><input type="date" id="sc-d" value="${TODAY}"></label><label class="field"><span>Nº factura</span><input type="text" id="sc-num"></label>
        <label class="field"><span>Base (€)</span><input type="number" step="0.01" id="sc-b"></label><label class="field"><span>IVA (€)</span><input type="number" step="0.01" id="sc-i"></label>
        <label class="field"><span>Retención (€)</span><input type="number" step="0.01" id="sc-r"></label><label class="field"><span>Total (€)</span><input type="number" step="0.01" id="sc-t"></label></div></details>
    </div></div>`,
    `<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="saveScan">Añadir a la contabilidad</button>`,true);
  const n=document.getElementById('sc-n');n.addEventListener('input',()=>{if(!SCAN.catTouched)document.getElementById('sc-c').value=guessCat(n.value)});
  document.getElementById('sc-c').addEventListener('change',()=>SCAN.catTouched=true);
  if(blob&&SAMPLE&&S.settings.aiScan)runOCR(blob);
}
async function runOCR(blob){
  const box=()=>document.getElementById('sc-ai');
  try{
    const lim=await SAMPLE.limits().catch(()=>null);
    if(lim&&!lim.images)throw{code:'images_unavailable'};
    const prompt=`Lee esta factura española recibida por una consulta de psicología. Responde SOLO con un objeto JSON con estas claves: "proveedor" (texto), "nif" (texto o null), "numero" (texto o null), "fecha" ("AAAA-MM-DD" o null), "base" (número en euros o null), "iva" (número o null), "retencion" (número o null), "total" (número o null), "categoria" (exactamente una de: ${CATS.join(', ')}). Usa punto decimal. No inventes datos que no aparezcan.`;
    const d=await SAMPLE.json(prompt,{images:[blob],modelTier:'default'});
    if(!SCAN||SCAN.blob!==blob)return;
    SCAN.ai=d;
    const set=(id,v)=>{const e=document.getElementById(id);if(e&&v!=null&&v!=='')e.value=v};
    const n=document.getElementById('sc-n');if(n&&!n.value&&d.proveedor)n.value=d.proveedor;
    if(d.categoria&&CATS.includes(d.categoria)&&!SCAN.catTouched)document.getElementById('sc-c').value=d.categoria;
    set('sc-d',d.fecha);set('sc-num',d.numero);set('sc-b',d.base);set('sc-i',d.iva);set('sc-r',d.retencion);set('sc-t',d.total);
    if(box()){box().className='box ok';box().innerHTML=`Leída: ${esc(d.proveedor||'proveedor')} · ${d.fecha?fD(d.fecha):'sin fecha'} · total <b>${d.total!=null?eur(Math.round(d.total*100)):'—'}</b>`}
  }catch(e){
    if(box()){box().className='box warn';box().textContent=e&&e.code==='not_granted'?'Lectura automática no permitida. Puedes guardarla igualmente y completar los importes después.':'No se pudo leer automáticamente. Guarda la factura y revisa los importes en el detalle.'}
  }
}
function parseCSV(text){
  const out=[];text.split(/\r?\n/).forEach(l=>{const c=l.split(/[;\t]/);if(c.length<3)return;let[d,concept,amt]=c;d=d.trim();let date=null;
    if(/^\d{4}-\d{2}-\d{2}$/.test(d))date=d;else{const m=d.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);if(m)date=`${m[3].length===2?'20'+m[3]:m[3]}-${pad(m[2])}-${pad(m[1])}`}
    const a=Number(String(amt).trim().replace(/\./g,'').replace(',','.'));if(date&&!isNaN(a))out.push({date,concept:concept.trim().toUpperCase(),amount:Math.round(a*100)})});
  return out;
}
document.addEventListener('change',async e=>{
  const t=e.target;if(!t.dataset||!t.dataset.up||!t.files||!t.files[0])return;
  const f=t.files[0];const kind=t.dataset.up;t.value='';
  if(kind==='scan'){startScan(f);return}
  if(kind==='bank'){const rows=parseCSV(await f.text());rows.forEach(r=>S.bank.push({id:nid('b'),...r,match:null}));audit(`Extracto importado: ${rows.length} movimientos`);render();toast(rows.length?`${rows.length} movimientos importados`:'No se reconocieron movimientos. Usa fecha;concepto;importe');return}
  const blob=(await compress(f,1600,.75))||f;const url=await store(blob);
  if(kind==='consent'){const p=P(t.dataset.p);p.consent={at:TODAY,file:f.name,url};audit(`Consentimiento subido para ${p.code}`);render();toast('Consentimiento guardado en la ficha');return}
  if(kind==='doc'){const p=P(t.dataset.p);(p.docs=p.docs||[]).push({name:f.name,at:TODAY,url});audit(`Documento adjuntado a ${p.code}`);render();toast('Documento adjuntado');return}
  if(kind==='empdoc'){S.employees[0].docs.push({name:f.name,at:TODAY,url});audit('Documento laboral subido');render();toast('Documento laboral guardado')}
});

/* ===== conciliación ===== */
function linkedPays(){return new Set(S.bank.filter(b=>b.match&&b.match.t==='pay').map(b=>b.match.pay))}
function linkedExp(){return new Set(S.bank.filter(b=>b.match&&b.match.t==='exp').map(b=>b.match.id))}
const near=(a,b,n)=>Math.abs(parse(a)-parse(b))/864e5<=n;
function candidates(b){
  const C=[];
  if(b.amount>0){const lp=linkedPays();
    S.invoices.forEach(i=>i.payments.forEach(p=>{if(!lp.has(p.id)&&p.method!=='Efectivo'&&p.amount===b.amount&&near(p.date,b.date,5))C.push({t:'pay',inv:i.id,pay:p.id,label:`Cobro ya registrado · ${i.num} · ${toLabel(i)}`})}));
    S.invoices.forEach(i=>{if(i.num&&i.kind!=='R'&&['emitida','enviada','parcial','vencida'].includes(invStatus(i))&&tot(i).pending===b.amount&&i.date<=b.date)C.push({t:'inv',inv:i.id,label:`Factura pendiente ${i.num} · ${toLabel(i)} · registrar cobro`})});
  }else{const le=linkedExp();
    S.expenses.forEach(e=>{if(!le.has(e.id)&&e.method!=='Efectivo'&&e.total===-b.amount&&near(e.date,b.date,7))C.push({t:'exp',id:e.id,label:`Gasto · ${e.supplier} · ${fD(e.date)}`})});
  }
  const dist=c=>{const d=c.t==='exp'?S.expenses.find(e=>e.id===c.id).date:c.t==='pay'?S.invoices.find(i=>i.id===c.inv).payments.find(p=>p.id===c.pay).date:S.invoices.find(i=>i.id===c.inv).date;return Math.abs(parse(d)-parse(b.date))};
  return C.sort((x,y)=>dist(x)-dist(y));
}
function applyMatch(b,c){
  if(c.t==='inv'){const i=S.invoices.find(x=>x.id===c.inv);const p={id:nid('pay'),date:b.date,amount:b.amount,method:/BIZUM/.test(b.concept)?'Bizum':/TPV/.test(b.concept)?'Tarjeta':'Transferencia',ref:'Banco'};i.payments.push(p);b.match={t:'pay',inv:i.id,pay:p.id};audit(`Cobro de ${i.num} registrado desde el banco`)}
  else b.match=c.t==='pay'?{t:'pay',inv:c.inv,pay:c.pay}:{t:'exp',id:c.id};
}

/* ===== acciones ===== */
const ACT={
  go:d=>{S.view=d.v;S.sel.patient=null;S.sel.editing=null;S.sel.pday=null;render();window.scrollTo(0,0)},
  goCal:()=>{S.view='calendario';render()},
  goNotes:d=>{S.view='informes';S.sel.editing=null;S.sel.nf=d.f;render()},
  goAcc:d=>{closeModal();S.view='contabilidad';S.sel.patient=null;openAccSec(d.tab||'facturas');render()},
  bell:()=>{const T=todos();modal('Pendiente',`<div class="stack" style="gap:2px">${T.map(t=>`<button class="todo ${t.cls}" data-act="${t.act}" data-id="${t.id||''}" data-f="${t.f||''}" data-tab="${t.tab||''}"><span class="ic">${SVG(t.ic)}</span><span class="tx"><b>${t.t}</b><span>${esc(t.d)}</span></span><span class="n">${t.n}</span></button>`).join('')||'<div class="empty">Todo al día.</div>'}</div>`)},
  homeDay:d=>{S.sel.homeDay=d.d;render()},
  close:()=>closeModal(),
  ovClose:(d,t,e)=>{if(e.target===t)closeModal()},
  newAppt:d=>{if(noEdit())return;apptForm(null,{p:d.p})},
  slot:(d,t,e)=>{if(e.target!==t||noEdit())return;const r=t.getBoundingClientRect();const px=Number(d.px);const min=H0*60+Math.floor((e.clientY-r.top)/px*2)*30;apptForm(null,{d:d.d,t:min})},
  pickDay:d=>{S.cal={mode:'dia',date:d.d};render()},
  saveAppt:(d,btn)=>{
    const pid=val('f-p'),date=val('f-d'),t=val('f-t'),dur=Number(val('f-dur'));const w=document.getElementById('f-warn');
    if(!pid||!date||!t||!dur){w.hidden=false;w.className='full box warn';w.textContent='Elige un paciente de la lista y completa fecha, hora y duración.';return}
    const start=toMin(t);const rp=Number(val('f-rep'))||0;
    if(!d.id&&rp){
      const n=Math.min(52,Math.max(2,Number(val('f-repn'))||8));const L=seriesDates(date,start,dur,rp,n);const ok=L.filter(x=>!x.skip);
      if(!ok.length){w.hidden=false;w.className='full box warn';w.textContent='Ninguna de esas fechas está libre. Cambia el día o la hora.';return}
      const sv=SV(val('f-s'));const p=P(pid);const sid=nid('s');
      if(W){if(ok.length<2){w.hidden=false;w.className='full box warn';w.textContent='Solo queda una fecha libre: quita la repetición y crea una cita normal.';return}
        const input={patientId:pid,start,dur,service:sv.id,price:sv.price,modal:val('f-m'),loc:val('f-l'),notes:val('f-n'),status:S.settings.confirmEmail?'pendiente':'confirmada'};
        remote(btn,()=>W.saveAppointmentSeries({input,dates:ok.map(x=>x.d),patient:p,professionalId:S.pro.id,userId:W.userId(),services:S.services}),({appts})=>{
          W.applyAppointments(S,appts);appts.forEach(a=>logA(a,'Cita creada (se repite)'));audit(`${appts.length} citas creadas para ${p.code} (${rp===7?'cada semana':'cada dos semanas'})`);
          const sk=L.length-ok.length;closeModal();render();toast(`${appts.length} citas creadas para ${p.code}${sk?` · ${sk} ${sk===1?'fecha saltada':'fechas saltadas'}`:''}`)},e=>{w.hidden=false;w.className='full box warn';w.textContent=e.message});
        return}
      ok.forEach((x,i)=>{const a={id:nid('a'),patientId:pid,date:x.d,start,dur,service:sv.id,price:sv.price,modal:val('f-m'),loc:val('f-l'),notes:val('f-n'),status:S.settings.confirmEmail?'pendiente':'confirmada',log:[],cancelReason:'',seriesId:sid,seriesEvery:rp,seriesIdx:i+1,seriesTotal:ok.length};logA(a,'Cita creada (se repite)');S.appts.push(a)});
      audit(`${ok.length} citas creadas para ${p.code} (${rp===7?'cada semana':'cada dos semanas'})`);
      if(S.settings.confirmEmail)mail(p.email,'Tus próximas citas',`Tienes ${ok.length} citas ${rp===7?'cada semana':'cada dos semanas'} a las ${t} en ${val('f-l')}: ${ok.map(x=>fDs(x.d)).join(' · ')}.${S.settings.dailyConfirm?' Cada día de cita recibirás por la mañana un correo para confirmar tu asistencia.':''}`,'Cita');
      const sk=L.length-ok.length;closeModal();render();toast(`${ok.length} citas creadas para ${p.code}${sk?` · ${sk} ${sk===1?'fecha saltada':'fechas saltadas'}`:''}`);return;
    }
    const cf=conflicts(d.id,date,start,dur);const bl=blockOn(date);const f1=document.getElementById('f-force'),f2=document.getElementById('f-forceb');
    if((cf.length&&!(f1&&f1.checked))||(bl&&!(f2&&f2.checked))){w.hidden=false;w.className='full box warn';w.innerHTML=[cf.length?`Se solapa con ${cf.map(c=>`${P(c.patientId).code} (${hm(c.start)}–${hm(c.start+c.dur)})`).join(', ')}.<label style="display:flex;gap:8px;margin-top:6px;align-items:center"><input type="checkbox" id="f-force" ${f1&&f1.checked?'checked':''}> Permitir el solapamiento</label>`:'',bl?`El ${fDs(date)} está cerrado: ${esc(bl.label)}.<label style="display:flex;gap:8px;margin-top:6px;align-items:center"><input type="checkbox" id="f-forceb" ${f2&&f2.checked?'checked':''}> Dar la cita igualmente</label>`:''].filter(Boolean).join('<div style="height:10px"></div>');return}
    const out=(AVAIL[dow(date)]||[]).every(([a,b])=>start<a||start+dur>b);const sv=SV(val('f-s'));const p=P(pid);
    if(W){const ex=d.id?S.appts.find(x=>x.id===d.id):null;
      const input={patientId:pid,date,start,dur,service:sv.id,price:sv.price,modal:val('f-m'),loc:val('f-l'),notes:val('f-n'),status:S.settings.confirmEmail?'pendiente':'confirmada'};
      remote(btn,()=>W.saveAppointment({existing:ex,input,patient:p,professionalId:S.pro.id,userId:W.userId(),services:S.services}),({appt,replacedId})=>{
        W.applyAppointment(S,appt,replacedId);
        if(ex){logA(appt,`Reprogramada de ${ex.date} ${hm(ex.start)} a ${date} ${t}`);audit(`Cita ${p.code} reprogramada`);toast('Cita reprogramada')}
        else{logA(appt,'Cita creada');audit(`Cita creada para ${p.code} el ${date} ${t}`);toast('Cita creada')}
        if(out)setTimeout(()=>toast('Aviso: la cita queda fuera de tu horario configurado'),2900);
        closeModal();render()},e=>{w.hidden=false;w.className='full box warn';w.textContent=e.message});
      return}
    if(d.id){const a=S.appts.find(x=>x.id===d.id);const old=`${a.date} ${hm(a.start)}`;Object.assign(a,{patientId:pid,date,start,dur,service:sv.id,price:sv.price,modal:val('f-m'),loc:val('f-l'),notes:val('f-n')});logA(a,`Reprogramada de ${old} a ${date} ${t}`);audit(`Cita ${p.code} reprogramada`);
      a.remSent=null;if(S.settings.confirmEmail)mail(p.email,'Cambio en tu cita',`Tu cita se ha movido al ${fDs(date)} a las ${t} (${a.loc}).`,'Cita');toast('Cita reprogramada')}
    else{const a={id:nid('a'),patientId:pid,date,start,dur,service:sv.id,price:sv.price,modal:val('f-m'),loc:val('f-l'),notes:val('f-n'),status:S.settings.confirmEmail?'pendiente':'confirmada',log:[],cancelReason:''};logA(a,'Cita creada');S.appts.push(a);audit(`Cita creada para ${p.code} el ${date} ${t}`);
      const dc=S.settings.dailyConfirm;if(S.settings.confirmEmail&&!(dc&&date===TODAY))mail(p.email,dc?'Cita reservada':'Confirma tu cita',dc?`Tienes una cita el ${fDs(date)} a las ${t} en ${a.loc}. Esa misma mañana recibirás un correo para confirmar tu asistencia.`:`Tienes una cita el ${fDs(date)} a las ${t} en ${a.loc}. Responde para confirmarla.`,'Cita');
      toast(S.settings.confirmEmail?`Cita para ${p.code} creada · ${dc?'aviso enviado':'confirmación enviada'}`:'Cita creada')}
    if(out)setTimeout(()=>toast('Aviso: la cita queda fuera de tu horario configurado'),2900);
    closeModal();render();
  },
  openAppt:d=>openAppt(d.id),
  reschedule:d=>apptForm(S.appts.find(x=>x.id===d.id)),
  confirm:(d,btn)=>{const a=S.appts.find(x=>x.id===d.id);if(W){remoteStatus(btn,a,'confirmada',x=>{logA(x,'Confirmada');audit(`Cita ${P(x.patientId).code} confirmada`);closeModal();render();toast('Cita confirmada')});return}a.status='confirmada';if(a.date===TODAY)a.dayOk=TODAY;logA(a,'Confirmada');audit(`Cita ${P(a.patientId).code} confirmada`);closeModal();render();toast('Cita confirmada')},
  done:(d,btn)=>{const a=S.appts.find(x=>x.id===d.id);if(a.date>TODAY)return;if(W){remoteStatus(btn,a,'realizada',x=>{logA(x,'Marcada como realizada');audit(`Cita ${P(x.patientId).code} del ${x.date} marcada como realizada`);closeModal();render();toast('Sesión cerrada · la factura todavía no se crea en este modo')});return}markDone(a);closeModal();render()},
  noshow:(d,btn)=>{const a=S.appts.find(x=>x.id===d.id);if(W){remoteStatus(btn,a,'ausencia',x=>{logA(x,'Ausencia del paciente');audit(`Ausencia ${P(x.patientId).code}`);closeModal();render();toast('Ausencia registrada')});return}a.status='ausencia';logA(a,'Ausencia del paciente');audit(`Ausencia ${P(a.patientId).code}`);closeModal();render();toast('Ausencia registrada')},
  ppToggle:(d,t)=>{t.classList.toggle('open')},
  pendList:()=>{const L=S.appts.filter(a=>a.status==='pendiente'&&a.date>=TODAY).sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start);
    modal('Citas por confirmar',`<p class="muted small" style="margin:0">Esperando respuesta del paciente. Si avisa por teléfono, abre la cita y márcala como confirmada.</p><div class="pl-list">${L.map(a=>`<button class="pl-row" data-act="openAppt" data-id="${a.id}"><span class="pl-m"><b><span class="pc">${P(a.patientId).code}</span> ${esc(modeL(a))}</b><span>${fDs(a.date)} · ${hm(a.start)}${a.dayMail===TODAY?' · aviso enviado hoy':''}</span></span><span class="pl-chev">›</span></button>`).join('')||'<div class="empty">No hay citas por confirmar.</div>'}</div>`)},
  fabMenu:()=>modal('Crear',`<div class="fab-opts"><button class="fab-opt" data-act="newAppt"><span class="fo-ic">${SVG(IC.cal)}</span><span><b>Nueva cita</b><small>Reservar una sesión en la agenda</small></span></button><button class="fab-opt" data-act="newPatient"><span class="fo-ic">${SVG(IC.user)}</span><span><b>Nuevo paciente</b><small>Dar de alta y asignar su código</small></span></button></div>`),
  pdayClear:()=>{S.sel.pday=null;render()},
  pdayOpen:()=>{S.sel.pdm=(S.sel.pday||TODAY).slice(0,7);pdayModal()},
  pdayNav:d=>{const[y,m]=S.sel.pdm.split('-').map(Number);const dt=new Date(y,m-1+Number(d.n),1);S.sel.pdm=iso(dt).slice(0,7);pdayModal()},
  pdayPick:d=>{S.sel.pday=d.d;closeModal();render();window.scrollTo(0,0)},
  dictMic:()=>{if(W)return;const st=document.getElementById('dict-st');const b=document.getElementById('dict-mic');
    if(DICT_REC){DICT_REC.stop();return}
    const R=window.SpeechRecognition||window.webkitSpeechRecognition;if(!R)return;
    try{const r=new R();r.lang='es-ES';r.continuous=true;r.interimResults=false;
      r.onresult=e=>{const ta=document.getElementById('nf-dict');if(!ta)return;for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal){ta.value=(ta.value?ta.value.trim()+' ':'')+e.results[i][0].transcript.trim();autosize(ta)}};
      r.onerror=()=>{st.textContent='El micrófono no está disponible aquí. Usa el micrófono del teclado del móvil.'};
      r.onend=()=>{DICT_REC=null;if(b)b.classList.remove('rec');if(b)b.lastChild.textContent='Hablar'};
      r.start();DICT_REC=r;b.classList.add('rec');b.lastChild.textContent='Parar';st.textContent='Escuchando… habla con normalidad.'}
    catch(e){st.textContent='El micrófono no está disponible aquí. Usa el micrófono del teclado del móvil.'}},
  dictAI:async d=>{if(W)return;const n=S.notes.find(x=>x.id===d.id);const ta=document.getElementById('nf-dict');const st=document.getElementById('dict-st');const btn=document.getElementById('dict-ai');
    const txt=(ta&&ta.value||'').trim();if(txt.length<20){st.textContent='Dicta o escribe primero cómo ha ido la sesión.';return}
    if(!SAMPLE){st.textContent='La IA no está disponible en este visor.';return}
    const fs=FIELDS[n.type];btn.disabled=true;btn.innerHTML='<span class="spin"></span> Ordenando…';st.textContent='La IA está redactando la nota a partir de tu dictado.';
    const prompt=`Eres el asistente de una psicóloga sanitaria en España. A partir del dictado de la sesión, redacta los apartados de la nota clínica en español, en tono profesional, claro y breve, en tercera persona ("la paciente", "el paciente"). No inventes nada que no aparezca en el dictado. Si un apartado no aparece, déjalo como cadena vacía.
Responde SOLO con un objeto JSON con estas claves: ${fs.map(([k,l])=>`"${k}" (${l})`).join(', ')}.
Dictado: «${txt}»`;
    try{const r=await SAMPLE.json(prompt,{modelTier:'default'});const prevV={};let k=0;
      fs.forEach(([key])=>{const el=document.getElementById('nf-'+key);if(!el)return;prevV[key]=el.value;const v=r&&typeof r[key]==='string'?r[key].trim():'';if(v){el.value=v;autosize(el);k++}});
      DICT_UNDO=prevV;const u=document.getElementById('dict-undo');if(u)u.hidden=!k;
      st.textContent=k?`Listo: ${k} ${k===1?'apartado rellenado':'apartados rellenados'}. Revísalos antes de firmar.`:'La IA no ha encontrado contenido para los apartados.';
      readNote(n);nlog(n,'Apartados redactados con IA a partir del dictado');save()}
    catch(e){st.textContent=e&&e.code==='not_granted'?'Hace falta dar permiso a la IA para usar esta función.':'No se ha podido ordenar ahora. Inténtalo de nuevo.'}
    finally{btn.disabled=false;btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>Ordenar con IA'}},
  dictUndo:()=>{if(W||!DICT_UNDO)return;Object.entries(DICT_UNDO).forEach(([k,v])=>{const el=document.getElementById('nf-'+k);if(el){el.value=v;autosize(el)}});DICT_UNDO=null;const nn=S.notes.find(x=>x.id===S.sel.editing);if(nn){readNote(nn);save()}const u=document.getElementById('dict-undo');if(u)u.hidden=true;document.getElementById('dict-st').textContent='Se ha vuelto al texto anterior.'},
  todosMore:(d,t)=>{const pn=t.closest('.todo-panel');pn.classList.toggle('all');t.textContent=pn.classList.contains('all')?'Ver menos':d.more},
  cancelSeries:(d,btn)=>{const a=S.appts.find(x=>x.id===d.id);const r=val('f-cr');
    if(W){remote(btn,()=>W.cancelSeries({appt:a,services:S.services}),({appts})=>{W.applyAppointments(S,appts);appts.forEach(x=>{x.cancelReason=r;logA(x,'Cancelada con las siguientes · '+r)});audit(`${appts.length} citas de ${P(a.patientId).code} canceladas (esta y las siguientes)`);closeModal();render();toast(`${appts.length} ${appts.length===1?'cita cancelada':'citas canceladas'}`)});return}
   const L=S.appts.filter(x=>x.seriesId===a.seriesId&&x.date>=a.date&&['pendiente','confirmada'].includes(x.status)).sort((x,y)=>x.date.localeCompare(y.date));
    L.forEach(x=>{x.status='cancelada';x.cancelReason=r;logA(x,'Cancelada con las siguientes · '+r)});const p=P(a.patientId);audit(`${L.length} citas de ${p.code} canceladas (esta y las siguientes)`);
    mail(p.email,'Citas canceladas',`Se han cancelado ${L.length} citas: ${L.map(x=>fDs(x.date)).join(' · ')}.`,'Cita');closeModal();render();toast(`${L.length} citas canceladas · aviso enviado`)},
  moveDo:(d,btn)=>{const a=S.appts.find(x=>x.id===d.id);const p=P(a.patientId);const old=`${a.date} ${hm(a.start)}`;
    if(W){const input={patientId:a.patientId,date:d.d,start:Number(d.t),dur:a.dur,service:a.service,price:a.price,modal:a.modal,loc:a.loc,notes:a.notes,status:a.status};
      remote(btn,()=>W.saveAppointment({existing:a,input,patient:p,professionalId:S.pro.id,userId:W.userId(),services:S.services}),({appt,replacedId})=>{W.applyAppointment(S,appt,replacedId);logA(appt,`Movida de ${old} a ${appt.date} ${hm(appt.start)}`);audit(`Cita ${p.code} movida`);closeModal();render();toast('Cita movida')},e=>{closeModal();render();toast(e.message)});return}
   a.date=d.d;a.start=Number(d.t);a.remSent=null;a.dayMail=null;
    logA(a,`Movida de ${old} a ${a.date} ${hm(a.start)}`);audit(`Cita ${p.code} movida`);if(S.settings.confirmEmail)mail(p.email,'Cambio en tu cita',`Tu cita se ha movido al ${fDs(a.date)} a las ${hm(a.start)} (${a.loc}).`,'Cita');closeModal();render();toast('Cita movida'+(S.settings.confirmEmail?' · aviso enviado':''))},
  goBlocks:()=>{S.view='config';S.sel.ctab='horario';S.sel.patient=null;S.sel.scrollTo='sec-blocks';render()},
  blockAdd:()=>{let f=val('bk-f'),t=val('bk-t');const l=val('bk-l').trim()||'Cerrado';if(!f||!t){toast('Elige las fechas');return}if(t<f)[f,t]=[t,f];
    (S.blocks=S.blocks||[]).push({id:nid('b'),from:f,to:t,label:l});audit(`Días cerrados añadidos: ${l} (${f} a ${t})`);
    const af=S.appts.filter(a=>['pendiente','confirmada'].includes(a.status)&&a.date>=f&&a.date<=t).length;render();toast(af?`Añadido · ${af} ${af===1?'cita cae':'citas caen'} en esas fechas`:'Días cerrados añadidos')},
  blockDel:d=>{const b=(S.blocks||[]).find(x=>x.id===d.id);S.blocks=(S.blocks||[]).filter(x=>x.id!==d.id);if(b)audit(`Días cerrados quitados: ${b.label}`);render();toast('Días cerrados quitados')},
  cancelAppt:(d,btn)=>{const a=S.appts.find(x=>x.id===d.id);if(W){const why=val('f-cr');remoteStatus(btn,a,'cancelada',x=>{x.cancelReason=why;logA(x,'Cancelada · '+why);audit(`Cita ${P(x.patientId).code} cancelada`);closeModal();render();toast('Cita cancelada')});return}a.status='cancelada';a.cancelReason=val('f-cr');logA(a,'Cancelada · '+a.cancelReason);audit(`Cita ${P(a.patientId).code} cancelada`);mail(P(a.patientId).email,'Cita cancelada',`Tu cita del ${fDs(a.date)} a las ${hm(a.start)} ha quedado cancelada.`,'Cita');closeModal();render();toast('Cita cancelada · aviso enviado')},
  calNav:d=>{const c=S.cal;const n=Number(d.n);const mode=calView();if(mode==='mes'){const x=parse(c.date);c.date=iso(new Date(x.getFullYear(),x.getMonth()+n,1))}else c.date=addDays(c.date,mode==='dia'?n:7*n);render()},
  calToday:()=>{S.cal.date=nextWorkDay();render()},
  calMode:d=>{S.cal.mode=d.m;S.cal.picked=true;render()},
  newPatient:()=>{if(noEdit())return;patientForm()},
  editPatient:d=>patientForm(P(d.id)),
  // Terapia finalizada ↔ en seguimiento. No borra datos ni cancela citas: avisa si quedan citas abiertas.
  pStatus:(d,btn)=>{if(noEdit())return;const p=P(d.id);const next=p.status==='alta terapéutica'?'activo':'alta terapéutica';
    const open=S.appts.filter(a=>a.patientId===p.id&&a.date>=TODAY&&['pendiente','confirmada'].includes(a.status)).length;
    const done=x=>{audit(`${x.code}: ${next==='activo'?'terapia reanudada':'terapia finalizada'}`);render();toast(next==='activo'?'Terapia reanudada':`Terapia finalizada${open?` · quedan ${open} ${open===1?'cita abierta':'citas abiertas'}: cancélalas si no se van a hacer`:''}`)};
    if(W){remote(btn,()=>W.setPatientStatus({patient:p,status:next,services:S.services}),({patient})=>{W.applyPatient(S,patient);done(patient)});return}
    p.status=next;done(p)},
  // Derecho de acceso / portabilidad: todo lo que la psicóloga ve del paciente, en un JSON descargable.
  // Se genera en el navegador con los datos ya cargados; no se envía a ningún sitio.
  exportPatient:async d=>{if(S.role!=='psicologa')return;const p=P(d.id);
    const pick=(o,ks)=>Object.fromEntries(ks.filter(k=>o[k]!==undefined).map(k=>[k,o[k]]));
    const data={generado:new Date().toISOString(),clinica:(S.org&&S.org.name)||null,aviso:'Datos de salud. Entrégalos solo al paciente o a quien acredite su representación, por un canal seguro.',
      paciente:pick(p,['code','name','email','phone','alta','status','modal','billing','obs','reminders']),
      citas:S.appts.filter(a=>a.patientId===p.id).map(a=>({fecha:a.date,hora:hm(a.start),duracion:a.dur,servicio:SV(a.service).name,modalidad:a.modal,estado:a.status,lugar:a.loc||null})),
      informes:S.notes.filter(n=>n.patientId===p.id).map(n=>({tipo:NOTE_T[n.type],fecha:n.created,estado:n.status,apartados:Object.fromEntries((FIELDS[n.type]||[]).map(([k,l])=>[l,(n.fields||{})[k]||''])),texto:n.content||undefined})),
      pruebas:(p.tests||[]).map(t=>({nombre:t.name,fecha:t.date,resultado:t.result})),
      diagnosticos:(p.dx||[]).map(x=>({diagnostico:x.title,fecha:x.date,fundamento:x.text})),
      facturas:S.invoices.filter(i=>i.patientId===p.id).map(i=>({numero:i.num||null,fecha:i.date,estado:invStatus(i),total:tot(i).total/100})),
      documentos:(p.docs||[]).map(x=>({nombre:x.name||x.file||x.fileName||null,fecha:x.date||x.at||null})).concat(p.consent?[{nombre:'Consentimiento informado',fecha:p.consent.at||null}]:[])};
    const fn=`paciente-${p.code}-${TODAY}.json`;const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    let note='';
    if(CN){const counts=Object.fromEntries(['citas','informes','pruebas','diagnosticos','facturas','documentos'].map(k=>[k,data[k].length]));
      try{const at=await CN.logExport(p.id,counts);if(at===null)note=' · este servidor aún no registra exportaciones en la auditoría'}
      catch(e){toast(e&&e.message?`No se ha exportado: ${e.message}`:'No se ha exportado: no se ha podido registrar en la auditoría');return}}
    audit(`Datos de ${p.code} exportados`);
    if(DL){try{await DL.save({filename:fn,data:blob});toast('Datos exportados'+note);return}catch(e){if(e&&e.code==='declined')return}}
    const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=fn;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),30000);
    toast('Datos exportados · los documentos se descargan uno a uno desde Documentos'+note)},
  savePatient:(d,btn)=>{
    const name=val('np-n').trim(),email=val('np-e').trim();const err=document.getElementById('np-err');
    if(!name||!email){err.hidden=false;err.textContent='El nombre y el email son obligatorios.';return}
    if(S.patients.some(p=>p.email===email&&p.id!==d.id)){err.hidden=false;err.textContent='Ya existe un paciente con ese email.';return}
    const bt=val('np-bt');const billing=bt==='empresa'?{type:'empresa',name:val('np-bn')||name,nif:val('np-bnif'),addr:val('np-addr'),ret:15}:{type:'particular',name,nif:val('np-bnif'),addr:val('np-addr')};
    if(W){const ex=d.id?P(d.id):null;
      const input={name,email,phone:val('np-t'),service:val('np-s'),modal:val('np-m'),billing,reminders:document.getElementById('np-r').checked};
      remote(btn,()=>W.savePatient({existing:ex,input,today:TODAY,services:S.services}),({patient,replacedId})=>{
        W.applyPatient(S,patient,replacedId);closeModal();
        if(ex){audit(`Datos de ${patient.code} editados`);render();toast('Datos guardados');return}
        audit(`Paciente ${patient.code} creado`);S.view='pacientes';S.sel.patient=patient.id;S.sel.ptab='docs';render();toast(`Paciente ${patient.code} creado · sube su consentimiento`)},e=>{err.hidden=false;err.textContent=e.message});
      return}
    if(d.id){const p=P(d.id);Object.assign(p,{name,email,phone:val('np-t'),service:val('np-s'),modal:val('np-m'),billing,obs:val('np-obs').trim(),reminders:document.getElementById('np-r').checked});audit(`Datos de ${p.code} editados`);closeModal();render();toast('Datos guardados');return}
    const p={id:nid('p'),code:d.code,name,email,phone:val('np-t'),alta:TODAY,status:'nuevo',slot:[0,600],service:val('np-s'),modal:val('np-m'),billing,obs:val('np-obs').trim(),consent:null,docs:[],reminders:document.getElementById('np-r').checked};
    S.patients.push(p);audit(`Paciente ${p.code} creado`);S.view='pacientes';S.sel.patient=p.id;S.sel.ptab='docs';closeModal();render();toast(`Paciente ${p.code} creado · sube su consentimiento`);
  },
  openPatient:d=>{if(noEdit())return;closeModal();if(P(d.id))audit(`Ficha de ${P(d.id).code} consultada`);S.view='pacientes';S.sel.patient=d.id;S.sel.ptab=d.tab||'resumen';render();window.scrollTo(0,0)},
  backPatients:()=>{S.sel.patient=null;render()},
  ptab:d=>{S.sel.ptab=d.t;render()},
  wkHalf:d=>{S.sel.wkHalf=d.h;render()},
  pfilter:d=>{const sg=document.querySelector('.pseg');const x=sg?sg.scrollLeft:0;S.sel.pf=d.f;S.sel.pday=null;render();const n=document.querySelector('.pseg');if(n)n.scrollLeft=x},
  reveal:d=>{REVEAL[d.id]=!REVEAL[d.id];if(REVEAL[d.id])audit(`Datos identificativos de ${P(d.id).code} visualizados`);render()},
  revealInv:d=>{REVEAL[d.id]=true;audit(`Datos identificativos de ${P(d.id).code} visualizados en factura`);openInv(d.inv)},
  note:d=>{if(S.role!=='psicologa')return;const a=S.appts.find(x=>x.id===d.id);noteEditor(ensureNote(a))},
  openNote:d=>{if(S.role!=='psicologa')return;noteEditor(S.notes.find(n=>n.id===d.id))},
  newDoc:d=>{const n={id:nid('n'),patientId:d.p,apptId:null,type:d.t,fields:{},status:'borrador',author:W?'':S.pro.name,created:TODAY,signedAt:null,versions:[]};if(W){n.unsaved=true;NB[n.id]=n;noteEditor(n);return}S.notes.push(n);audit(`${NOTE_T[d.t]} creado para ${P(d.p).code}`);noteEditor(n)},
  nfilter:d=>{S.sel.nf=d.f;render()},
  atab:d=>{S.sel.atab=d.t;render()},
  fdir:d=>{S.sel.fdir=d.d;render()},
  allList:d=>{S.sel[d.k]=!S.sel[d.k];render()},
  ifilter:d=>{S.sel.if=d.f;render()},
  gper:d=>{S.sel.gper=d.p;render()},
  gcat:d=>{S.sel.gcat=d.c||null;render()},
  lq:d=>{S.sel.lq=d.q;render()},
  lb:d=>{S.sel.lb=d.b;render()},
  bf:d=>{S.sel.bf=d.f;render()},
  thist:d=>{S.sel.thist=!!d.h;render()},
  openInv:d=>openInv(d.id),
  saveDraft:d=>{const i=S.invoices.find(x=>x.id===d.id);readLines(i);closeModal();render();toast('Guardada · puedes seguir luego')},
  emitInv:d=>{const i=S.invoices.find(x=>x.id===d.id);readLines(i);if(tot(i).total<=0){toast('El total debe ser mayor que cero');return}i.date=TODAY;emit(i);closeModal();render();toast(`Factura ${i.num} emitida`)},
  delInv:d=>{const i=S.invoices.find(x=>x.id===d.id);i.appts.forEach(id=>{const a=S.appts.find(x=>x.id===id);if(a)delete a.invoiceId});S.invoices=S.invoices.filter(x=>x.id!==i.id);closeModal();render();toast('Borrador descartado')},
  sendInv:d=>{sendInv(S.invoices.find(x=>x.id===d.id));closeModal();render()},
  payInv:d=>{const i=S.invoices.find(x=>x.id===d.id);const amt=Math.round(Number(val('pay-a'))*100);const t=tot(i);if(!(amt>0)){toast('Indica un importe válido');return}if(amt>t.pending){toast('El importe supera lo pendiente');return}
    i.payments.push({id:nid('pay'),date:TODAY,amount:amt,method:val('pay-m'),ref:''});audit(`Cobro de ${eur(amt)} en ${i.num}`);closeModal();render();toast(amt<t.pending?`Cobro parcial · quedan ${eur(t.pending-amt)}`:'Factura cobrada')},
  rectInv:d=>{const i=S.invoices.find(x=>x.id===d.id);const r={...mkInv(S,{id:i.patientId,billing:{...i.to,ret:i.ret}},TODAY,i.lines.map(l=>({...l,price:-l.price,desc:'Rectificación: '+l.desc})),[]),serie:'R',kind:'R',ret:i.ret};
    emit(r);i.status='rectificada';i.appts.forEach(id=>{const a=S.appts.find(x=>x.id===id);if(a)delete a.invoiceId});S.invoices.push(r);audit(`Factura ${i.num} rectificada por ${r.num}`);closeModal();render();toast(`Rectificativa ${r.num} emitida`)},
  remind:d=>{const i=S.invoices.find(x=>x.id===d.id);const to=i.patientId?P(i.patientId).email:'cliente';mail(to,`Recordatorio de pago · factura ${i.num}`,`La factura ${i.num} de ${eur(tot(i).pending)} figura pendiente.`,'Cobro');audit(`Recordatorio de cobro enviado: ${i.num}`);closeModal();render();toast('Recordatorio enviado')},
  billAll:()=>{let n=0;const emp={};
    unbilled().forEach(a=>{const p=P(a.patientId);if(p.billing.type==='empresa'){(emp[p.id]=emp[p.id]||[]).push(a);return}const sv=SV(a.service);const inv=mkInv(S,p,TODAY,[{desc:`${sv.name} · ${fD(a.date)}`,qty:1,price:a.price,exempt:sv.exempt&&S.pro.sanitaria}],[a.id]);S.invoices.push(inv);a.invoiceId=inv.id;if(S.settings.invoiceMode==='auto')emit(inv);n++});
    Object.entries(emp).forEach(([pid,list])=>{const p=P(pid);const inv=mkInv(S,p,TODAY,list.map(a=>({desc:`${SV(a.service).name} · ${fD(a.date)}`,qty:1,price:a.price,exempt:SV(a.service).exempt&&S.pro.sanitaria})),list.map(a=>a.id));S.invoices.push(inv);list.forEach(a=>a.invoiceId=inv.id);if(S.settings.invoiceMode==='auto')emit(inv);n++});
    audit(`${n} facturas generadas`);render();toast(`${n} facturas ${S.settings.invoiceMode==='auto'?'emitidas':'creadas en borrador'}`)},
  saveScan:async(d,btn)=>{
    const name=val('sc-n').trim();if(!name){toast('Indica el nombre del proveedor');return}
    btn.disabled=true;btn.textContent='Guardando…';
    const num=x=>{const v=val(x);return v===''?null:Math.round(Number(v)*100)};
    let base=num('sc-b'),iva=num('sc-i'),ret=num('sc-r')||0,total=num('sc-t');
    if(total==null&&base!=null)total=base+(iva||0)-ret;
    if(base==null&&total!=null){base=total-(iva||0)+ret}
    const photo=SCAN.blob?await store(SCAN.blob):null;
    const complete=total!=null&&total>0;
    const e={id:nid('g'),date:val('sc-d')||TODAY,supplier:name,nif:SCAN.ai?.nif||'',cat:val('sc-c'),concept:name,base:base||0,iva:iva||0,ret,total:total||0,method:'Tarjeta',num:val('sc-num'),status:complete?'revisado':'por revisar',source:SCAN.ai?'escaneada · leída por IA':'escaneada',photo,file:SCAN.file.name,ded:pctVal('sc-ded')};
    S.expenses.push(e);audit(`Factura recibida escaneada: ${name}${complete?' '+eur(total):''}`);SCAN=null;
    closeModal();S.view='contabilidad';S.sel.atab='gastos';S.sel.fdir='recibidas';render();toast(complete?`Añadida: ${eur(e.total)} en ${e.cat}`:'Añadida · completa los importes cuando puedas')},
  openExp:d=>{const e=S.expenses.find(x=>x.id===d.id);const ro=S.role==='gestoria';
    modal(esc(e.supplier),`<div class="grid2" style="gap:16px"><div>${e.photo?`<img class="preview" src="${esc(e.photo)}" alt="Foto de la factura">`:`<div class="drop">${SVG(IC.doc)}<span class="muted small">${e.file?esc(e.file):'Sin foto (cargo domiciliado)'}</span></div>`}</div>
    <div class="form">
      <label class="field full"><span>Proveedor</span><input type="text" id="ge-s" value="${esc(e.supplier)}" ${ro?'disabled':''}></label>
      <label class="field full"><span>Categoría</span><select id="ge-c" ${ro?'disabled':''}>${CATS.map(c=>`<option ${c===e.cat?'selected':''}>${c}</option>`).join('')}</select></label>
      <label class="field"><span>Fecha</span><input type="date" id="ge-d" value="${e.date}" ${ro?'disabled':''}></label><label class="field"><span>Nº factura</span><input type="text" id="ge-n" value="${esc(e.num||'')}" ${ro?'disabled':''}></label>
      <label class="field"><span>Base (€)</span><input type="number" step="0.01" id="ge-b" value="${(e.base/100).toFixed(2)}" ${ro?'disabled':''}></label><label class="field"><span>IVA (€)</span><input type="number" step="0.01" id="ge-i" value="${(e.iva/100).toFixed(2)}" ${ro?'disabled':''}></label>
      <label class="field"><span>Retención (€)</span><input type="number" step="0.01" id="ge-r" value="${(e.ret/100).toFixed(2)}" ${ro?'disabled':''}></label><label class="field"><span>Total</span><input type="text" value="${eur(e.total)}" disabled></label>
      <label class="field"><span>% deducible</span><input type="number" min="0" max="100" id="ge-ded" value="${e.ded??''}" placeholder="${dedCat(e.cat)} % por categoría" ${ro?'disabled':''}></label><label class="field"><span>Importe deducible</span><input type="text" value="${eur(dedAmt(e))}" disabled></label>
      <div class="full muted small">${esc(e.source)} · ${chip(e.status)}</div></div></div>`,
    ro?'<button class="btn" data-act="close">Cerrar</button>':`<button class="btn danger" data-act="delExp" data-id="${e.id}">Eliminar</button><button class="btn primary" data-act="saveExp" data-id="${e.id}">Guardar · revisado</button>`,true)},
  saveExp:d=>{const e=S.expenses.find(x=>x.id===d.id);const n=id=>Math.round(Number(val(id))*100)||0;Object.assign(e,{supplier:val('ge-s'),cat:val('ge-c'),date:val('ge-d'),num:val('ge-n'),base:n('ge-b'),iva:n('ge-i'),ret:n('ge-r'),ded:pctVal('ge-ded')});e.total=e.base+e.iva-e.ret;
    if(!(e.total>0)){toast('Indica al menos la base o el total');return}e.status='revisado';audit(`Gasto revisado: ${e.supplier}`);closeModal();render();toast('Gasto guardado')},
  delExp:d=>{const g=S.expenses.find(e=>e.id===d.id);if(g&&g.fixedId)S.fixedSkip[g.fixedId+'-'+ym(g.date)]=1;S.expenses=S.expenses.filter(e=>e.id!==d.id);S.bank.forEach(b=>{if(b.match&&b.match.t==='exp'&&b.match.id===d.id)b.match=null});audit('Gasto eliminado');closeModal();render();toast('Gasto eliminado')},
  payObl:d=>{S.oblPaid[d.k]=TODAY;audit(`Obligación ${d.k} marcada como pagada`);render();toast('Marcada como pagada')},
  autoMatch:()=>{let n=0;unmatched().forEach(b=>{const c=candidates(b);if(c.length){applyMatch(b,c[0]);n++}});const left=unmatched().length;audit(`Conciliación automática: ${n} movimientos`);render();toast(`${n} movimientos conciliados${left?` · ${left} requieren tu revisión`:''}`)},
  matchOne:d=>{const b=S.bank.find(x=>x.id===d.id);const C=candidates(b);
    modal('Relacionar movimiento',`<div class="row"><div class="m"><b class="mono">${esc(b.concept)}</b><span>${fD(b.date)}</span></div><b style="color:${b.amount>0?'var(--ok-ink)':'inherit'}">${eur(b.amount)}</b></div>
    ${C.length?`<div class="stack">${C.map((c,k)=>`<button class="todo" data-act="pickMatch" data-id="${b.id}" data-k="${k}"><span class="ic">${SVG(b.amount>0?IC.doc:IC.tax)}</span><span class="tx"><b>${esc(c.label)}</b></span></button>`).join('')}</div>`:'<div class="box warn">No hay facturas ni gastos con el mismo importe y fecha cercana.</div>'}
    ${b.amount<0?`<div class="ph" style="margin:0"><span class="muted small">¿Es un gasto sin factura escaneada (comisión, compra pequeña)?</span><div class="actions"><select id="mm-c" style="width:auto">${CATS.map(c=>`<option ${c===guessCat(b.concept)?'selected':''}>${c}</option>`).join('')}</select><button class="btn sm primary" data-act="expFromBank" data-id="${b.id}">Crear gasto</button></div></div>`:''}`,`<button class="btn" data-act="ignoreMove" data-id="${b.id}">Marcar como movimiento interno</button><button class="btn" data-act="close">Cerrar</button>`)},
  pickMatch:d=>{const b=S.bank.find(x=>x.id===d.id);applyMatch(b,candidates(b)[Number(d.k)]);audit('Movimiento conciliado manualmente');closeModal();render();toast('Movimiento conciliado')},
  expFromBank:d=>{const b=S.bank.find(x=>x.id===d.id);const cat=val('mm-c');const tt=-b.amount;const e={id:nid('g'),date:b.date,supplier:b.concept.replace(/^(PAGO|RECIBO|COMPRA TARJETA)\s*/,'').toLowerCase().replace(/^./,c=>c.toUpperCase()),nif:'',cat,concept:'Creado desde el banco',base:tt,iva:0,ret:0,total:tt,method:'Tarjeta',num:'',status:'por revisar',source:'banco',photo:null};S.expenses.push(e);b.match={t:'exp',id:e.id};audit(`Gasto creado desde movimiento bancario: ${eur(tt)}`);closeModal();render();toast('Gasto creado y conciliado · puedes adjuntar el justificante')},
  ignoreMove:d=>{const b=S.bank.find(x=>x.id===d.id);b.match={t:'int'};closeModal();render();toast('Marcado como movimiento interno')},
  exportBook:async()=>{const q=S.sel.lq||String(qOf(TODAY));const L=libros(q);const book=S.sel.lb||'ingresos';const per=q==='año'?String(YEAR):`${YEAR}-${q}T`;
    const n2=c=>(c/100).toFixed(2).replace('.',',');
    const rows=book==='ingresos'?[['Fecha','Número','Destinatario','NIF','Concepto','Base imponible','IVA','Retención IRPF','Total']].concat(L.ing.map(r=>[r.fecha,r.num,r.cliente,r.nif,r.concepto,n2(r.base),n2(r.iva),n2(r.ret),n2(r.total)]))
      :[['Fecha','Número','Proveedor','NIF','Tipo de gasto','Concepto','Base imponible','IVA','Retención','Total','% deducible','Importe deducible']].concat(L.gas.map(r=>[r.fecha,r.num,r.prov,r.nif,r.cat,r.concepto,n2(r.base),n2(r.iva),n2(r.ret),n2(r.total),String(r.ded),n2(r.dedAmt)]));
    const csv='﻿'+rows.map(r=>r.map(c=>/[;"\n]/.test(c)?`"${String(c).replace(/"/g,'""')}"`:c).join(';')).join('\n');
    const fn=`libro-${book}-${per}.csv`;audit(`Libro de ${book} ${per} exportado`);
    if(DL){try{await DL.save({filename:fn,data:new Blob([csv],{type:'text/csv'})});toast('Libro exportado');return}catch(e){if(e&&e.code==='declined')return}}
    modal('Exportar libro',`<p class="muted" style="margin:0">Copia el contenido y pégalo en una hoja de cálculo (${rows.length-1} registros).</p><textarea id="csv" readonly style="min-height:260px;font-family:var(--f-mono);font-size:.76rem">${esc(csv)}</textarea>`,`<button class="btn" data-act="close">Cerrar</button><button class="btn primary" data-act="copyCsv">Copiar</button>`,true)},
  copyCsv:()=>{const t=document.getElementById('csv');navigator.clipboard.writeText(t.value).then(()=>toast('Copiado'),()=>{t.focus();t.select();toast('Selecciona y copia con Ctrl+C')})},
  genPayroll:()=>{const e=S.employees[0];const k=ym(TODAY);const n={id:nid('n'),emp:e.id,month:k,date:lastDay(Number(k.slice(0,4)),Number(k.slice(5,7))),...payroll(e.bruto),paid:false};S.payrolls.push(n);audit(`Nómina de ${monthLong(k)} generada`);render();toast(`Nómina generada · coste ${eur(n.coste)}`)},
  payPayroll:d=>{const n=S.payrolls.find(x=>x.id===d.id);n.paid=true;S.bank.push({id:nid('b'),date:TODAY,concept:'TRANSFERENCIA NOMINA',amount:-n.neto,match:{t:'nom',id:n.id,part:'neto'}});audit(`Nómina ${n.month} pagada`);render();toast('Nómina pagada y conciliada')},
  ctab:d=>{S.sel.ctab=d.t;render()},
  pickCalDay:d=>{S.cal.date=d.d;render()},
  pickPt:d=>{const p=P(d.id);if(!p)return;document.getElementById('f-p').value=p.id;document.getElementById('f-pq').value=`${p.code} · ${p.name}`;document.getElementById('f-plist').hidden=true;onPatientPick(p)},
  addSvc:()=>{S.services.push({id:nid('s'),name:'Nuevo servicio',dur:60,price:5000,exempt:true});audit('Servicio añadido');render();toast('Servicio añadido · edítalo en la tabla')},
  delSvc:d=>{const sv=SV(d.id);if(S.services.length<2){toast('Debe quedar al menos un servicio');return}if(S.appts.some(a=>a.service===d.id)||S.patients.some(p=>p.service===d.id)){toast('Hay citas o pacientes con este servicio; no se puede eliminar');return}S.services=S.services.filter(x=>x.id!==d.id);audit(`Servicio «${sv.name}» eliminado`);render();toast('Servicio eliminado')},
  addRange:d=>{const a=(AVAIL[d.d]=AVAIL[d.d]||[]);const last=a[a.length-1];const st=last?Math.min(last[1]+60,1260):600;a.push([st,Math.min(st+240,1380)]);audit(`Franja añadida el ${DAYN[d.d].toLowerCase()}`);render()},
  delRange:d=>{AVAIL[d.d].splice(Number(d.i),1);audit(`Franja quitada el ${DAYN[d.d].toLowerCase()}`);render()},
  toggleTheme:()=>{S.settings.theme=effTheme()==='dark'?'light':'dark';audit('Tema: '+S.settings.theme);render()},
  setTheme:d=>{S.settings.theme=d.k;audit('Tema: '+d.k);render();toast('Tema aplicado')},
  goProfile:()=>{S.view='config';S.sel.ctab='perfil';S.sel.patient=null;render();window.scrollTo(0,0)},
  goFiscal:()=>{S.view='config';S.sel.ctab='perfil';S.sel.patient=null;render();window.scrollTo(0,0)},
  more:()=>{const vis=NAV.filter(seen);const shown=['inicio','calendario','pacientes','informes'];const rest=vis.filter(n=>!shown.includes(n[0]));
    modal('Más',`<div class="stack" style="gap:2px">${rest.map(n=>`<button class="todo" data-act="goClose" data-v="${n[0]}"><span class="ic">${SVG(NAVI[n[0]])}</span><span class="tx"><b>${n[1]}</b></span></button>`).join('')}</div>
    <label class="field"><span>Ver como (prototipo)</span><select id="role2">${userOptions()}</select></label>`)},
  goClose:d=>{closeModal();ACT.go(d)},
  sfilter:d=>{S.sel.sf=d.f;render()},
  closeEditor:()=>{const n=edNote(S.sel.editing);if(n&&n.status!=='firmada')readNote(n);const kept=W&&n&&NB[n.id]&&nbDirty(n);if(W&&n&&!kept)delete NB[n.id];S.sel.editing=null;render();window.scrollTo(0,0);if(kept)toast('El borrador tiene cambios sin guardar: siguen en el editor, pero no están guardados')},
  applyTpl:d=>{const n=edNote(S.sel.editing);if(!n)return;readNote(n);const tpl=TEMPLATES[n.type][Number(d.i)][1];let c=0;Object.entries(tpl).forEach(([k,v])=>{if(!n.fields[k]){n.fields[k]=v;c++}});render();toast(c?`Plantilla aplicada a ${c} ${c===1?'apartado vacío':'apartados vacíos'}`:'No hay apartados vacíos')},
  newReport:()=>{if(S.role!=='psicologa')return;const pts=S.patients.slice().sort((a,b)=>norm(a.name).localeCompare(norm(b.name)));
    modal('Nuevo informe',`<div class="form"><label class="field full"><span>Paciente</span><select id="nr-p">${pts.map(p=>`<option value="${p.id}">${esc(p.name)} · ${p.code}</option>`).join('')}</select></label>
    <label class="field full"><span>Tipo de informe</span><select id="nr-t"><option value="inicial">Evaluación inicial</option><option value="evolucion">Informe de seguimiento</option><option value="cierre">Informe de cierre</option></select></label></div>`,
    `<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="saveReport">Crear y abrir editor</button>`)},
  saveReport:()=>{const p=val('nr-p'),t=val('nr-t');if(!p)return;ACT.newDoc({t,p})},
  newInvoice:()=>{if(S.role==='gestoria')return;const pts=S.patients.slice().sort((a,b)=>norm(a.name).localeCompare(norm(b.name)));
    modal('Nueva factura',`<div class="form"><label class="field full"><span>Paciente</span><select id="ni-p">${pts.map(p=>`<option value="${p.id}">${esc(p.name)} · ${p.code}</option>`).join('')}</select></label>
    <label class="field full"><span>Concepto</span><input type="text" id="ni-d" value="Sesión individual"></label>
    <label class="field"><span>Importe (€)</span><input type="number" step="0.01" min="0" id="ni-a" value="55"></label>
    <label class="field"><span>IVA</span><select id="ni-x"><option value="1">Exento (asistencia sanitaria)</option><option value="0">IVA 21 %</option></select></label></div>`,
    `<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="saveNewInv">Crear borrador</button>`)},
  saveNewInv:()=>{const p=P(val('ni-p'));const amt=Math.round(Number(val('ni-a'))*100);if(!p||!(amt>0)){toast('Indica el paciente y un importe mayor que cero');return}
    const inv=mkInv(S,p,TODAY,[{desc:val('ni-d')||'Servicio',qty:1,price:amt,exempt:val('ni-x')==='1'}],[]);S.invoices.push(inv);audit('Borrador de factura creado');closeModal();render();openInv(inv.id)},
  pdfInv:d=>pdfInv(S.invoices.find(x=>x.id===d.id)),
  saveNote:(d,btn)=>{const n=edNote(d.id);readNote(n);if(W){saveNoteW(d.id,btn,false);return}nlog(n,'Borrador guardado');audit(`Nota de ${P(n.patientId).code} guardada como borrador`);render();toast('Guardada · puedes seguir luego')},
  noteForce:(d,btn)=>{const n=W&&NB[d.id];if(!n||!n.conflict)return;closeModal();saveNoteW(d.id,btn,true)},
  noteCompare:d=>{const n=W&&NB[d.id];if(!n||!n.conflict)return;readNote(n);const sv=n.conflict.server;const diff=sv?FIELDS[n.type].filter(([k])=>(sv.fields[k]||'')!==(n.fields[k]||'')):[];
    modal('Comparar con la versión guardada',sv?`<p class="muted small" style="margin:0">${diff.length?`${diff.length===1?'Un apartado distinto':`${diff.length} apartados distintos`}. Arriba, lo guardado por la otra sesión${n.conflict.version?` (versión ${n.conflict.version})`:''}; debajo, tu texto sin guardar.`:'Los apartados coinciden: puedes guardar sin perder nada.'}</p>${diff.map(([k,l])=>`<label class="field"><span>${l}</span><div class="ro">${esc(sv.fields[k]||'—')}</div><div class="ro">${esc(n.fields[k]||'—')}</div></label>`).join('')}`:'<p style="margin:0">No se ha podido leer la versión guardada. Recarga la página para verla (copia antes tu texto: no está guardado).</p>',
      `<button class="btn" data-act="close">Seguir editando</button>${sv?`<button class="btn" data-act="noteUseServer" data-id="${n.id}">Usar la guardada (descarta tu texto)</button>`:''}<button class="btn primary" data-act="noteForce" data-id="${n.id}">Guardar la mía</button>`,true)},
  noteUseServer:d=>{const n=W&&NB[d.id];const sv=n&&n.conflict&&n.conflict.server;if(!sv)return;delete NB[d.id];closeModal();noteEditor(S.notes.find(x=>x.id===sv.id)||sv);toast('Se ha cargado la versión guardada; tu texto se ha descartado')},
  signNote:d=>{if(W){toast('Terminar y firmar informes todavía no está disponible en este modo. Guarda el informe para seguir luego.');return}const n=S.notes.find(x=>x.id===d.id);readNote(n);if(FIELDS[n.type].every(([k])=>!n.fields[k])){toast('Completa al menos un apartado antes de terminar el informe');return}
    n.status='firmada';n.signedAt=TODAY;nlog(n,'Firmado y cerrado');audit(`${NOTE_T[n.type]} de ${P(n.patientId).code} firmado`);
    const ap=n.apptId?S.appts.find(x=>x.id===n.apptId):null;const msgs=ap&&ap.status==='realizada'?billAppt(ap):[];
    S.sel.editing=null;render();toast(['Informe terminado',...msgs].join(' · '))},
  rectNote:d=>{if(W){toast('Las rectificaciones todavía no están disponibles en este modo.');return}const n=S.notes.find(x=>x.id===d.id);const t=val('nf-rect').trim();if(!t){toast('Escribe la rectificación antes de guardar');return}n.versions.push({at:new Date().toISOString(),author:S.pro.name,text:t});nlog(n,'Rectificación añadida');audit(`Rectificación en ${NOTE_T[n.type]} de ${P(n.patientId).code}`);render();toast('Rectificación añadida')},
  slotNew:d=>{if(noEdit())return;apptForm(null,{d:d.d,t:Number(d.t)})},
  fillNote:(d,btn)=>{if(S.role!=='psicologa')return;const a=S.appts.find(x=>x.id===d.id);if(!a)return;if(['confirmada','pendiente'].includes(a.status)){if(a.date>TODAY)return;if(W){remoteStatus(btn,a,'realizada',x=>{logA(x,'Marcada como realizada');noteEditor(ensureNote(x))});return}markDone(a)}noteEditor(ensureNote(a))},
  carMove:d=>{const c=document.getElementById('car');if(c)c.scrollBy({left:Number(d.n)*carStep(c),behavior:'smooth'})},
  pmenu:()=>{const m=document.getElementById('pmenu');if(m)m.hidden=!m.hidden},
  goSettings:()=>{S.view='config';S.sel.ctab=S.role==='psicologa'?'auto':'clinica';S.sel.patient=null;render();window.scrollTo(0,0)},
  goHelp:()=>{if(S.role==='psicologa'){S.view='config';S.sel.ctab='ayuda'}else S.view='ayuda';S.sel.patient=null;render();window.scrollTo(0,0)},
  iper:d=>{S.sel.iper=d.p;render()},
  gsub:d=>{S.sel.gsub=d.t;render()},
  billNow:d=>{const a=S.appts.find(x=>x.id===d.id);const m=billAppt(a);audit(`Sesión de ${P(a.patientId).code} del ${a.date} facturada sin esperar a la nota`);closeModal();render();toast(m.length?m.join(' · '):'Sin cambios')},
  dailyNow:()=>{const n=runDaily(true);render();toast(n?`Correo enviado a ${n} ${n===1?'paciente':'pacientes'}`:'No quedan citas de hoy por avisar')},
  mailView:d=>{const a=S.appts.find(x=>x.id===d.id);const p=P(a.patientId);
    modal('Correo del paciente',`<div class="box warn">Simulación de lo que recibe el paciente. Con el servidor real, estos botones se pulsarán desde su correo.</div><div class="mailcard"><div class="mh"><span>De: <b>${esc(S.pro.email)}</b></span><span>Para: <b>${esc(maskEmail(p.email))}</b></span><span>Asunto: <b>Confirma tu cita de hoy</b></span></div><div class="mb"><p>${esc(dayBody(a))}</p><div class="actions"><button class="btn primary" data-act="patientYes" data-id="${a.id}">Confirmo mi asistencia</button><button class="btn" data-act="patientNo" data-id="${a.id}">No podré ir</button></div></div></div>`,`<button class="btn" data-act="close">Cerrar</button>`)},
  patientYes:d=>{const a=S.appts.find(x=>x.id===d.id);a.status='confirmada';a.dayOk=TODAY;a.log.push({at:new Date().toISOString(),who:'Paciente',what:'Asistencia confirmada desde el correo'});auditAs('Paciente',`Cita ${P(a.patientId).code} confirmada desde el correo`);closeModal();render();toast('Cita confirmada en la agenda')},
  patientNo:d=>{const a=S.appts.find(x=>x.id===d.id);a.status='cancelada';a.cancelReason='Aviso del paciente desde el correo';a.log.push({at:new Date().toISOString(),who:'Paciente',what:'Cancelada desde el correo'});auditAs('Paciente',`Cita ${P(a.patientId).code} cancelada desde el correo`);closeModal();render();toast('Cita cancelada · el hueco queda libre')},
  dxForm:d=>{if(S.role!=='psicologa')return;const p=P(d.p);const x=d.id?(p.dx||[]).find(y=>y.id===d.id):null;const T=p.tests||[];
    modal(x?'Editar diagnóstico':'Añadir diagnóstico',`<div class="form"><label class="field full"><span>Diagnóstico</span><input type="text" id="dx-t" value="${esc(x?x.title:'')}"></label><label class="field"><span>Fecha</span><input type="date" id="dx-d" value="${x?x.date:TODAY}"></label><label class="field full"><span>Cómo se ha llegado al diagnóstico</span><textarea id="dx-x">${esc(x?x.text:'')}</textarea></label>${T.length?`<div class="field full"><span>Pruebas en las que se basa</span><div class="checks">${T.map(t=>`<label><input type="checkbox" data-dxt="${t.id}" ${x&&x.tests.includes(t.id)?'checked':''}> ${esc(t.name)} · ${fD(t.date)}</label>`).join('')}</div></div>`:''}</div>`,
    `${x?`<button class="btn danger" data-act="dxDel" data-p="${p.id}" data-id="${x.id}">Eliminar</button>`:''}<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="dxSave" data-p="${p.id}" data-id="${x?x.id:''}">Guardar</button>`)},
  dxSave:d=>{const p=P(d.p);const title=val('dx-t').trim();if(!title){toast('Escribe el diagnóstico');return}
    const tests=[...document.querySelectorAll('[data-dxt]')].filter(c=>c.checked).map(c=>c.dataset.dxt);const data={title,date:val('dx-d')||TODAY,text:val('dx-x').trim(),tests};p.dx=p.dx||[];
    if(d.id)Object.assign(p.dx.find(x=>x.id===d.id),data);else p.dx.push({id:nid('dx'),author:S.pro.name,...data});
    audit(`Diagnóstico de ${p.code} guardado`);closeModal();render();toast('Diagnóstico guardado')},
  dxDel:d=>{const p=P(d.p);p.dx=p.dx.filter(x=>x.id!==d.id);audit(`Diagnóstico de ${p.code} eliminado`);closeModal();render();toast('Diagnóstico eliminado')},
  testForm:d=>{if(S.role!=='psicologa')return;const p=P(d.p);const t=d.id?(p.tests||[]).find(y=>y.id===d.id):null;
    modal(t?'Editar prueba':'Añadir prueba',`<div class="form"><label class="field full"><span>Nombre de la prueba</span><input type="text" id="tf-n" value="${esc(t?t.name:'')}"></label><label class="field"><span>Fecha</span><input type="date" id="tf-d" value="${t?t.date:TODAY}"></label>${W?'<p class="muted small full" style="margin:0">El archivo de la prueba se sube en la pestaña Documentos de la ficha (almacenamiento privado).</p>':'<label class="field"><span>Archivo (PDF o foto)</span><input type="file" id="tf-f" accept="application/pdf,image/*"></label>'}<label class="field full"><span>Resultados</span><textarea id="tf-r">${esc(t?t.result:'')}</textarea></label>${t&&t.file?`<p class="muted small full" style="margin:0">Archivo actual: ${esc(t.file)}. Si eliges otro, lo sustituye.</p>`:''}</div>`,
    `${t?`<button class="btn danger" data-act="testDel" data-p="${p.id}" data-id="${t.id}">Eliminar</button>`:''}<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="testSave" data-p="${p.id}" data-id="${t?t.id:''}">Guardar</button>`)},
  testSave:async(d,btn)=>{const p=P(d.p);const name=val('tf-n').trim();if(!name){toast('Indica el nombre de la prueba');return}
    btn.disabled=true;btn.textContent='Guardando…';const f=document.getElementById('tf-f').files[0];let file=null,url=null,isImg=false;
    if(f){const c=await compress(f,1600,.75);isImg=!!c;url=await store(c||f);file=f.name}
    p.tests=p.tests||[];let t=d.id?p.tests.find(x=>x.id===d.id):null;if(!t){t={id:nid('t'),file:null,url:null,isImg:false};p.tests.push(t)}
    Object.assign(t,{name,date:val('tf-d')||TODAY,result:val('tf-r').trim()});if(f)Object.assign(t,{file,url,isImg});
    audit(`Prueba de ${p.code} guardada`);closeModal();render();toast(f&&!url?'Prueba guardada · el archivo es demasiado grande para este navegador':'Prueba guardada')},
  testDel:d=>{const p=P(d.p);p.tests=p.tests.filter(x=>x.id!==d.id);(p.dx||[]).forEach(x=>x.tests=x.tests.filter(i=>i!==d.id));audit(`Prueba de ${p.code} eliminada`);closeModal();render();toast('Prueba eliminada')},
  testView:d=>{const t=P(d.p).tests.find(x=>x.id===d.id);modal(esc(t.name),`<img class="preview" style="max-height:70vh" src="${esc(t.url)}" alt="${esc(t.name)}">`,`<button class="btn" data-act="close">Cerrar</button>`,true)},
  fxForm:d=>{if(S.role!=='psicologa')return;const f=d.id?S.fixed.find(x=>x.id===d.id):{name:'',cat:'Suministros',day:1,base:0,ivaPct:21,retPct:0,ded:null,active:true};
    modal(d.id?'Editar gasto fijo':'Nuevo gasto fijo',`<div class="form"><label class="field full"><span>Concepto</span><input type="text" id="fx-n" value="${esc(f.name)}"></label><label class="field"><span>Categoría</span><select id="fx-c">${CATS.map(c=>`<option ${c===f.cat?'selected':''}>${c}</option>`).join('')}</select></label><label class="field"><span>Día del mes</span><input type="number" min="1" max="31" id="fx-d" value="${f.day}"></label><label class="field"><span>Base mensual (€)</span><input type="number" step="0.01" min="0" id="fx-b" value="${f.base?(f.base/100).toFixed(2):''}"></label><label class="field"><span>IVA (%)</span><input type="number" min="0" max="100" id="fx-i" value="${f.ivaPct}"></label><label class="field"><span>Retención (%)</span><input type="number" min="0" max="100" id="fx-r" value="${f.retPct}"></label><label class="field"><span>% deducible</span><input type="number" min="0" max="100" id="fx-ded" value="${f.ded??''}" placeholder="Según la categoría"></label><label class="toggle full"><div><b>Activo</b><small>Si lo pausas deja de registrarse. Lo ya registrado se conserva.</small></div><input type="checkbox" class="sw" id="fx-a" ${f.active?'checked':''}></label></div>`,
    `${d.id?`<button class="btn danger" data-act="fxDel" data-id="${f.id}">Eliminar</button>`:''}<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="fxSave" data-id="${d.id||''}">Guardar</button>`)},
  fxSave:d=>{const name=val('fx-n').trim();const base=Math.round(Number(val('fx-b'))*100);if(!name||!(base>0)){toast('Indica el concepto y un importe mayor que cero');return}
    const data={name,cat:val('fx-c'),day:Math.min(31,Math.max(1,Number(val('fx-d'))||1)),base,ivaPct:Math.max(0,Number(val('fx-i'))||0),retPct:Math.max(0,Number(val('fx-r'))||0),ded:pctVal('fx-ded'),active:document.getElementById('fx-a').checked};
    if(d.id){const f=S.fixed.find(x=>x.id===d.id);if(data.active&&!f.active)data.since=ym(TODAY);Object.assign(f,data);audit(`Gasto fijo «${name}» editado`)}
    else{S.fixed.push({id:nid('fx'),since:ym(TODAY),...data});audit(`Gasto fijo «${name}» añadido`)}
    closeModal();render();toast('Gasto fijo guardado')},
  fxDel:d=>{const f=S.fixed.find(x=>x.id===d.id);S.fixed=S.fixed.filter(x=>x.id!==d.id);audit(`Gasto fijo «${f.name}» eliminado`);closeModal();render();toast('Gasto fijo eliminado · lo ya registrado se conserva')},
  userForm:()=>{modal('Nuevo usuario',`<div class="form"><label class="field full"><span>Nombre</span><input type="text" id="us-n"></label><label class="field full"><span>Email</span><input type="email" id="us-e"></label><label class="field full"><span>Perfil</span><select id="us-r">${['agenda','gestoria','recepcion'].map(r=>`<option value="${r}">${ROLE_L[r]}: ${ROLE_D[r].toLowerCase()}</option>`).join('')}</select></label></div><div id="us-err" class="box warn" hidden></div>`,`<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="userSave">Crear usuario</button>`)},
  userSave:()=>{const name=val('us-n').trim(),email=val('us-e').trim(),role=val('us-r');const err=document.getElementById('us-err');
    if(!name||!email){err.hidden=false;err.textContent='El nombre y el email son obligatorios.';return}
    if(S.users.some(u=>(u.titular?S.pro.email:u.email)===email)){err.hidden=false;err.textContent='Ya existe un usuario con ese email.';return}
    S.users.push({id:nid('u'),name,email,role});mail(email,'Acceso a KOVO',`${S.pro.name} te ha dado acceso a KOVO con el perfil ${ROLE_L[role]}.`,'Acceso');audit(`Usuario «${name}» creado · ${ROLE_L[role]}`);closeModal();render();toast('Usuario creado · invitación simulada')},
  userAs:d=>{setUser(d.id);toast(`Viendo KOVO como ${uName(curUser())}`)},
  userDel:d=>{const u=S.users.find(x=>x.id===d.id);S.users=S.users.filter(x=>x.id!==d.id);audit(`Usuario «${u.name}» quitado`);render();toast('Usuario quitado')},
  reset:()=>{modal('Restablecer datos',`<p style="margin:0">Se borrarán los cambios hechos en este navegador y se cargarán de nuevo los datos de ejemplo.</p>`,`<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="doReset">Restablecer</button>`)},
  doReset:async()=>{S=await data.reset({seed,today:TODAY});AVAIL=S.avail;REVEAL={};migrate();closeModal();render();toast('Datos de ejemplo restablecidos')}
};
function readLines(i){document.querySelectorAll('[data-ld]').forEach(t=>i.lines[t.dataset.ld].desc=t.value);document.querySelectorAll('[data-lp]').forEach(t=>i.lines[t.dataset.lp].price=Math.round(Number(t.value)*100))}

document.addEventListener('click',e=>{const t=e.target.closest('[data-act]');if(!t)return;if(t.tagName==='A')e.preventDefault();const f=ACT[t.dataset.act];if(f){e.stopPropagation();f(t.dataset,t,e)}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.id==='pdayIn'){S.sel.pday=t.value||null;document.getElementById('plist').innerHTML=patientList();return}
  if(t.id==='role'||t.id==='role2'||t.id==='role3'){setUser(t.value);return}
  if(W&&(t.dataset.urole||t.id==='dailyHour')){render();toast('Este ajuste todavía no se guarda en el servidor. No se ha cambiado nada.');return}
  if(t.dataset.urole){const u=S.users.find(x=>x.id===t.dataset.urole);u.role=t.value;audit(`Perfil de «${u.name}» cambiado a ${ROLE_L[u.role]}`);render();toast('Perfil actualizado');return}
  if(t.dataset.ded){S.ded[t.dataset.ded]=Math.min(100,Math.max(0,Number(t.value)||0));audit(`Porcentaje deducible de ${t.dataset.ded} editado`);render();toast('Porcentaje actualizado');return}
  if(t.id==='dailyHour'){if(t.value)S.settings.dailyHour=t.value;audit('Hora del correo de la mañana editada');render();toast('Hora actualizada');return}
  if(t.dataset.set){S.settings[t.dataset.set]=t.checked;audit(`Ajuste «${t.dataset.set}» ${t.checked?'activado':'desactivado'}`);save();toast(t.checked?'Activado':'Desactivado');return}
  if(t.name==='invmode'){S.settings.invoiceMode=t.value;audit(`Modo de facturación: ${t.value}`);save();toast('Modo de facturación actualizado');return}
  if(t.id==='dueDays'){S.settings.dueDays=Math.max(0,Number(t.value)||0);save();return}
  if(t.dataset.sv){const sv=SV(t.dataset.sv);const f=t.dataset.f;
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
    S.settings.h0=n0;S.settings.h1=n1;audit('Horas visibles del calendario editadas');render();toast('Calendario actualizado');return}
  if(t.dataset.pro){S.pro[t.dataset.pro]=t.type==='checkbox'?t.checked:t.value;audit('Datos profesionales actualizados');save();toast('Guardado')}
});
document.addEventListener('input',e=>{
  if(e.target.dataset&&e.target.dataset.nf!==undefined){autosize(e.target);if(W)nbMark();return}
  if(e.target.id==='f-pq'){const l=document.getElementById('f-plist');document.getElementById('f-p').value='';l.innerHTML=pickerHTML(pickerList(e.target.value,APPT_CTX.keep));l.hidden=false;return}
  if(e.target.id==='pq'){S.sel.q=e.target.value;const l=document.getElementById('plist');if(l)l.innerHTML=patientList()}
});
document.addEventListener('focusin',e=>{if(e.target.id==='f-pq'){const l=document.getElementById('f-plist');if(!l)return;const has=val('f-p');l.innerHTML=pickerHTML(pickerList(has?'':e.target.value,APPT_CTX.keep));l.hidden=false;if(has)e.target.select()}});
document.addEventListener('click',e=>{if(!e.target.closest('.combo')){const l=document.getElementById('f-plist');if(l)l.hidden=true}});
document.addEventListener('touchstart',()=>{},{passive:true});
let PD=null,PSUP=0,DICT_REC=null,DICT_UNDO=null;
document.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0)return;const b=e.target.closest&&e.target.closest('.wm-c.busy[data-drag]');if(!b)return;PD={id:b.dataset.id,el:b,x:e.clientX,y:e.clientY,on:false}});
document.addEventListener('pointermove',e=>{if(!PD)return;
  if(!PD.on){if(Math.hypot(e.clientX-PD.x,e.clientY-PD.y)<6)return;PD.on=true;const r=PD.el.getBoundingClientRect();PD.ox=PD.x-r.left;PD.oy=PD.y-r.top;
    const g=PD.el.cloneNode(true);g.classList.add('ghost');g.removeAttribute('data-act');g.style.width=r.width+'px';g.style.height=r.height+'px';document.body.appendChild(g);PD.g=g;
    PD.el.classList.add('dragging');const m=PD.el.closest('.wmap');if(m)m.classList.add('dnd');document.body.classList.add('dragging-now')}
  e.preventDefault();PD.g.style.transform=`translate(${e.clientX-PD.ox}px,${e.clientY-PD.oy}px) rotate(-1.5deg)`;
  const t=document.elementFromPoint(e.clientX,e.clientY);const c=t&&t.closest('.wm-c.free[data-act="slotNew"]');document.querySelectorAll('.drop-ok').forEach(x=>x!==c&&x.classList.remove('drop-ok'));if(c)c.classList.add('drop-ok');PD.over=c});
const pdEnd=e=>{if(!PD)return;const d=PD;PD=null;if(!d.on)return;PSUP=Date.now();d.g.remove();document.body.classList.remove('dragging-now');
  document.querySelectorAll('.dragging,.drop-ok').forEach(x=>x.classList.remove('dragging','drop-ok'));document.querySelectorAll('.wmap.dnd').forEach(x=>x.classList.remove('dnd'));
  if(d.over&&e.type==='pointerup')moveAsk(d.id,d.over.dataset.d,Number(d.over.dataset.t))};
document.addEventListener('pointerup',pdEnd);document.addEventListener('pointercancel',pdEnd);
document.addEventListener('click',e=>{if(Date.now()-PSUP<400){e.stopPropagation();e.preventDefault()}},true);
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='gq'){S.sel.q=e.target.value;S.sel.patient=null;S.view='pacientes';render();return}if(e.key==='Enter'&&e.target.id==='f-pq'){e.preventDefault();const b=document.querySelector('#f-plist .combo-it');if(b)b.click()}});
window.matchMedia('(max-width:860px)').addEventListener('change',()=>render());
// Modo Supabase: avisar antes de salir si hay borradores clínicos sin guardar (no se guardan en el navegador).
window.addEventListener('beforeunload',e=>{if(!W)return;if(Object.values(NB).some(x=>{const m=nbLive(x);return nbDirty(m)||!!m.conflict})){e.preventDefault();e.returnValue=''}});
document.addEventListener('toggle',e=>{const d=e.target;if(!d.dataset||!d.dataset.acc)return;S.sel.fopen=Object.assign({},S.sel.fopen,{[d.dataset.acc]:d.open});if(d.open&&!d.querySelector('.acc-bd'))render();else save()},true);
document.addEventListener('click',e=>{if(!e.target.closest('.pwrap')){const m=document.getElementById('pmenu');if(m)m.hidden=true}});
migrate();
if(W&&data.clinic)CN=(await import('./saas/connected.js')).installConnected({data,today:TODAY,
  get S(){return S},get AVAIL(){return AVAIL},set AVAIL(v){AVAIL=v},render,toast,modal,closeModal,esc,openInv,addDays,P:id=>P(id),tot,effTheme:()=>effTheme(),reload:reloadS});
renderNav();renderTop();document.getElementById('view').innerHTML=skeleton();
setTimeout(render,320);
