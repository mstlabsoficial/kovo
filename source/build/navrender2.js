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
  const badge=navBadges();const vis=NAV.filter(n=>n[2].includes(S.role)&&n[4]==='work');
  const item=n=>`<button data-act="go" data-v="${n[0]}" ${S.view===n[0]?'aria-current="page"':''}>${SVG(NAVI[n[0]])}<span>${n[1]}</span>${badge[n[0]]?`<span class="badge">${badge[n[0]]}</span>`:''}</button>`;
  document.getElementById('nav').innerHTML=`<div class="navlabel">Espacio de trabajo</div>${vis.map(item).join('')}`;
  const dk=n=>`<button data-act="go" data-v="${n[0]}" aria-label="${n[1]}" ${S.view===n[0]?'aria-current="page"':''}><span class="pill">${SVG(NAVI[n[0]])}</span><span>${n[3]}</span>${badge[n[0]]?`<span class="badge">${badge[n[0]]}</span>`:''}</button>`;
  document.getElementById('dock').innerHTML=vis.filter(n=>n[0]!=='seguimiento').map(dk).join('');
  document.getElementById('role').value=S.role;
}
function renderTop(){
  const psi=S.role==='psicologa';const who=psi?S.pro.name:ME[S.role];
  document.getElementById('top').innerHTML=`<span class="tb-brand"><img class="logo" src="${LOGO}" alt=""><b>KOVO</b></span>${S.role!=='gestoria'?`<label class="tsearch">${SVG(IC.search)}<input type="search" id="gq" placeholder="Buscar paciente por nombre o código" autocomplete="off" aria-label="Buscar paciente"></label>`:'<span style="flex:1"></span>'}
  <div class="tb-r"><div class="pwrap"><button class="avatar-btn" data-act="pmenu" aria-label="Perfil, ajustes y ayuda" aria-haspopup="true">${esc(initials(psi?S.pro.name:ME[S.role]))}</button>
    <div class="pmenu" id="pmenu" hidden>
      <div class="pm-h"><span class="av">${esc(initials(who))}</span><div><b>${esc(who)}</b><span>${psi?'Psicóloga · titular':ME[S.role]}</span></div></div>
      ${psi?`<button data-act="goProfile">${SVG(IC.user)}Perfil profesional</button><button data-act="goSettings">${SVG(NAVI.config)}Ajustes</button>`:''}
      <button data-act="goHelp">${SVG(NAVI.ayuda)}Ayuda y soporte</button>
      <label class="field pm-role"><span>Ver como (prototipo)</span><select id="role3">${[['psicologa','Psicóloga'],['recepcion','Recepción'],['gestoria','Gestoría']].map(([v,l])=>`<option value="${v}" ${S.role===v?'selected':''}>${l}</option>`).join('')}</select></label>
    </div></div></div>`;
}
let LASTV=null;
function render(){
  if(!can(S.view))S.view=NAV.find(n=>n[2].includes(S.role))[0];
  H0=Math.min(22,Math.max(0,S.settings.h0??9));H1=Math.max(H0+1,Math.min(24,S.settings.h1??21));
  renderNav();renderTop();
  const w=document.getElementById('view');
  w.innerHTML=VIEWS[S.view]();
  if(LASTV!==S.view){w.classList.remove('enter');void w.offsetWidth;w.classList.add('enter');LASTV=S.view}
  document.querySelectorAll('textarea[data-nf]').forEach(autosize);
  initCarousel();
  if(S.sel.scrollTo){const el=document.getElementById(S.sel.scrollTo);S.sel.scrollTo=null;if(el)el.scrollIntoView({block:'start'})}
  save();
}
function autosize(t){t.style.height='auto';t.style.height=Math.max(96,t.scrollHeight+2)+'px'}
function skeleton(){return `<div class="sk" style="height:34px;width:min(320px,70%)"></div><div class="sk" style="height:200px"></div><div class="grid3"><div class="sk" style="height:300px"></div><div class="sk" style="height:300px"></div></div>`}
