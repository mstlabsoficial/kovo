const THEMES={azul:['#0a84ff','#0a5fc4','#5ac8fa','Azul'],indigo:['#5e5ce6','#4240b5','#a5a4ff','Índigo'],esmeralda:['#12a37f','#0b7a5d','#5ee0b4','Esmeralda'],coral:['#ff6b4a','#c4452a','#ffb199','Coral'],grafito:['#2b3447','#0b1220','#7d8aa5','Grafito']};
function applyTheme(){const t=THEMES[S.settings.accent]||THEMES.azul;const r=document.documentElement.style;r.setProperty('--accent',t[0]);r.setProperty('--accent-ink',t[1]);r.setProperty('--accent-2',t[2])}
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const initials=n=>String(n||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();
const avStyle=p=>{const h=(Number(p.code)*37)%360;return `background:linear-gradient(135deg,hsl(${h} 78% 60%),hsl(${(h+42)%360} 80% 48%))`};
const LOC=()=>S.pro.loc||'Despacho Málaga Centro';
const isMob=()=>window.matchMedia('(max-width:860px)').matches;
function renderNav(){
  const pn=S.role==='psicologa'?pendingNotes().length:0;
  const acc=S.role!=='recepcion'?S.expenses.filter(e=>e.status==='por revisar').length+unmatched().length:0;
  const badge={informes:pn,contabilidad:acc};
  document.getElementById('nav').innerHTML=NAV.filter(n=>n[2].includes(S.role)).map(([id,l,,s])=>`<button data-act="go" data-v="${id}" aria-label="${l}" ${S.view===id?'aria-current="page"':''}>${SVG(NAVI[id])}<span class="lb">${l}</span><span class="sh">${s}</span>${badge[id]?`<span class="badge">${badge[id]}</span>`:''}</button>`).join('');
  document.getElementById('role').value=S.role;
}
let LASTV=null;
function render(){
  if(!can(S.view))S.view=NAV.find(n=>n[2].includes(S.role))[0];
  H0=Math.min(22,Math.max(0,S.settings.h0??9));H1=Math.max(H0+1,Math.min(24,S.settings.h1??21));
  applyTheme();
  renderNav();
  const w=document.getElementById('view');
  w.innerHTML=VIEWS[S.view]();
  if(LASTV!==S.view){w.classList.remove('enter');void w.offsetWidth;w.classList.add('enter');LASTV=S.view}
  save();
}
