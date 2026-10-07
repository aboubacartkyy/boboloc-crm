(function(){
'use strict';
const ST=['Nouveau lead','Répond pas','Répond pas (+2 véhicules)','Lead qualifié','Démo planifiée','Démo reussi (Lancement future)','Démo terminée (1 véhicule)','Démo terminée (+2 véhicules)',"Période d'essai",'Abandonné','Archive ( 1 véhicule )','Archive ( +2 véhicules )','Gagné'];
const LEG={'À appeler':'Nouveau lead','Messagerie':'Répond pas','Rappeler':'Répond pas','Intéressé':'Lead qualifié','RDV fixé':'Démo planifiée','Pas intéressé':'Abandonné','Faux numéro':'Abandonné','Converti':'Gagné'};
const ms=s=>ST.includes(s)?s:(LEG[s]||'Nouveau lead');
const isCB=s=>s==='Répond pas'||s==='Répond pas (+2 véhicules)';
const CMAP={'Nouveau lead':0,'Répond pas':1,'Répond pas (+2 véhicules)':1,'Lead qualifié':3,'Démo planifiée':2,'Démo reussi (Lancement future)':3,'Démo terminée (1 véhicule)':3,'Démo terminée (+2 véhicules)':4,"Période d'essai":7,'Abandonné':5,'Archive ( 1 véhicule )':6,'Archive ( +2 véhicules )':6,'Gagné':4};
const RES=ST.filter(s=>s!=='Gagné');
const sIdx=s=>CMAP[s]!=null?CMAP[s]:Math.max(0,ST.indexOf(s));
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const dayStr=t=>{const d=new Date(t);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
const today=()=>dayStr(Date.now());
const addDays=n=>dayStr(Date.now()+n*864e5);
const digits=p=>String(p||'').replace(/\D/g,'');
const fmtPhone=p=>{const d=digits(p);return d.length===10?d.replace(/(\d\d)(?=\d)/g,'$1 '):String(p||'')};
const nf=n=>new Intl.NumberFormat('fr-FR').format(n);
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
const countBy=(a,f)=>{const m={};a.forEach(x=>{const k=f(x);m[k]=(m[k]||0)+1});return m};
const pct=(a,b)=>b?Math.round(a*100/b)+' %':'–';

const S={sb:null,me:null,leads:[],calls:[],team:[],view:'mine',mode:(function(){try{return localStorage.getItem('bb_mode')||'pipe'}catch(e){return 'pipe'}})(),flt:'todo',q:'',lim:40,kl:{},open:null,adding:false,
  aq:'',af:'all',ast:'all',alim:100,imp:null,impTo:'',busy:null,att:{uid:'',region:'',dept:'',n:50},err:'',authTab:'in',msg:''};
let rafId=0,timer=0;
const isAdmin=()=>S.me&&S.me.role==='admin';
const tgt=()=>S.viewAs||S.me.id;

function toast(m){const t=$('toast');t.textContent=m;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>t.hidden=true,2600)}
function editing(){const a=document.activeElement;return a&&(a.tagName==='TEXTAREA'||a.tagName==='INPUT')&&a.type!=='file'&&a.closest&&a.closest('.modal,.sheet,.lead')}
function sched(){if(rafId)return;rafId=requestAnimationFrame(()=>{rafId=0;if(editing()){S.dirty=true;return}render()})}
function msgErr(e){return (e&&e.message)||String(e)}

/* ---------------- accès aux données ---------------- */
async function pageAll(build){
  let out=[],i=0;
  for(;;){const {data,error}=await build().range(i,i+999);if(error)throw error;out=out.concat(data);if(data.length<1000)break;i+=1000}
  return out;
}
async function loadAll(){
  const sb=S.sb;
  S.leads=await pageAll(()=>sb.from('leads').select('*').order('id'));
  S.leads.forEach(l=>{l.status=ms(l.status)});
  S.calls=await pageAll(()=>sb.from('calls').select('*').gte('day',addDays(-30)).order('id'));
  if(isAdmin()){const {data}=await sb.from('profiles').select('*').order('created_at');S.team=data||[]}
}
async function refresh(){
  if(!S.me||S.busy||document.hidden||S.open||S.adding)return;
  try{await loadAll();sched()}catch(e){}
}
const nameOf=u=>{const p=S.team.find(x=>x.id===u);return p?(p.name||p.email):(u===S.me.id?(S.me.name||'Moi'):'—')};
const mineList=()=>S.leads.filter(l=>l.owner===tgt());
const poolList=()=>S.leads.filter(l=>!l.owner);
const members=()=>S.team.filter(p=>p.role==='agent'||p.role==='admin');

/* ---------------- démarrage / connexion ---------------- */
function gate(html){$('app').innerHTML=html}
async function start(){
  const C=window.CONFIG||{};
  if(!C.SUPABASE_URL||C.SUPABASE_URL.startsWith('COLLE')){gate('<div class="auth"><div class="panel"><h2>Configuration manquante</h2><p class="sub">Ouvre le fichier <b>config.js</b> et colle l’adresse et la clé de ton projet Supabase (voir le guide, étape 3).</p></div></div>');return}
  S.sb=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY);
  S.sb.auth.onAuthStateChange((ev)=>{if(ev==='SIGNED_OUT'){S.me=null;S.leads=[];S.calls=[];renderAuth()}});
  const {data}=await S.sb.auth.getSession();
  if(data.session)await enter(data.session.user);else renderAuth();
}
async function enter(user){
  const {data,error}=await S.sb.from('profiles').select('*').eq('id',user.id).maybeSingle();
  if(error||!data){gate('<div class="auth"><div class="panel"><h2>Compte introuvable</h2><p class="sub">Le profil n’a pas été créé. Vérifie que supabase.sql a bien été exécuté, puis reconnecte-toi.</p><button class="btn" data-act="logout">Se déconnecter</button></div></div>');return}
  S.me=data;
  if(data.role==='pending'){
    gate('<div class="auth"><div class="panel"><h2>Compte en attente</h2><p class="sub">Ton compte est créé. Aboubacar ou son associé doit maintenant l’activer. Reviens dans un instant.</p><button class="btn" data-act="reload">Vérifier</button><button class="btn out" data-act="logout">Se déconnecter</button></div></div>');return}
  S.view=isAdmin()?'over':'mine';
  gate('<p class="sub" style="padding-top:40px">Chargement de tes numéros…</p>');
  try{await loadAll()}catch(e){S.err='Chargement impossible : '+msgErr(e)}
  render();
  clearInterval(timer);timer=setInterval(refresh,30000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
}
function renderAuth(){
  const up=S.authTab==='up';
  gate('<div class="auth"><div class="brand" style="margin-bottom:14px"><div class="logo">B</div>Boboloc · Espace équipe</div><div class="panel"><div class="tabs2"><span class="seg"><button data-act="authtab" data-v="in" aria-pressed="'+!up+'">Se connecter</button><button data-act="authtab" data-v="up" aria-pressed="'+up+'">Créer mon compte</button></span></div>'+
    '<form id="authform">'+(up?'<input name="name" placeholder="Ton prénom" required autocomplete="name">':'')+
    '<input name="email" type="email" placeholder="E-mail" required autocomplete="email"><input name="password" type="password" placeholder="Mot de passe'+(up?' (8 caractères minimum)':'')+'" minlength="'+(up?8:1)+'" required autocomplete="'+(up?'new-password':'current-password')+'">'+
    (S.err?'<p class="err">'+esc(S.err)+'</p>':'')+(S.msg?'<p class="ok">'+esc(S.msg)+'</p>':'')+
    '<button class="btn primary" style="width:100%" type="submit">'+(up?'Créer mon compte':'Se connecter')+'</button></form>'+
    (up?'<p class="note" style="margin-top:10px">Après création, ton compte doit être activé par Aboubacar ou son associé.</p>':'')+'</div></div>');
}
async function submitAuth(f){
  S.err='';S.msg='';
  const em=f.email.value.trim(),pw=f.password.value;
  try{
    if(S.authTab==='up'){
      const {data,error}=await S.sb.auth.signUp({email:em,password:pw,options:{data:{name:f.name.value.trim()}}});
      if(error)throw error;
      if(data.session){await enter(data.user);return}
      S.msg='Compte créé. Vérifie ta boîte mail pour confirmer, puis connecte-toi.';S.authTab='in';
    }else{
      const {data,error}=await S.sb.auth.signInWithPassword({email:em,password:pw});
      if(error)throw error;await enter(data.user);return;
    }
  }catch(e){S.err=/Invalid login/i.test(msgErr(e))?'E-mail ou mot de passe incorrect.':msgErr(e)}
  renderAuth();
}

/* ---------------- actions sur les numéros ---------------- */
function patchLocal(id,p){const l=S.leads.find(x=>x.id===id);if(l)Object.assign(l,p);return l}
async function setStatus(id,st){
  const l=S.leads.find(x=>x.id===id);if(!l)return;
  const now=new Date().toISOString();
  const p={status:st,updated_at:now,last_call_at:now,calls:(l.calls||0)+1,
    callback_at:isCB(st)?(l.callback_at&&l.callback_at>=today()?l.callback_at:addDays(1)):null,
    converted_at:st==='Gagné'?now:null};
  const old={...l};patchLocal(id,p);render();
  const {error}=await S.sb.from('leads').update(p).eq('id',id);
  if(error){patchLocal(id,old);render();toast("Erreur d'enregistrement");return}
  if(!S.viewAs){const r=await S.sb.from('calls').insert({lead_id:id,user_id:S.me.id,status:st,day:today()});if(!r.error)S.calls.push({lead_id:id,user_id:S.me.id,status:st,day:today()})}
  toast(st==='Gagné'?'Client gagné 🎉':'Enregistré : '+st);sched();
}
async function saveField(id,p){
  p.updated_at=new Date().toISOString();patchLocal(id,p);
  const {error}=await S.sb.from('leads').update(p).eq('id',id);
  if(error)toast("Erreur d'enregistrement");
}
async function addProspect(f){
  const d=digits(f.phone);
  if(!f.name.trim()){toast("Mets au moins le nom de l'agence");return}
  if(d.length<8){toast('Numéro de téléphone invalide');return}
  const row={owner:S.me.id,phone_key:d,name:f.name.trim(),city:f.city.trim(),dept:f.dept.trim(),phone:f.phone.trim(),phone2:f.phone2.trim(),veh:f.veh.trim(),contact:f.contact.trim(),notes:f.notes.trim(),src:'Saisie manuelle',status:'Nouveau lead'};
  const {data,error}=await S.sb.from('leads').insert(row).select().single();
  if(error){toast(error.code==='23505'?'Ce numéro existe déjà dans le CRM (chez toi ou une collègue)':"Erreur de création");return}
  S.leads.push(data);S.adding=false;S.open=data.id;render();toast('Profil créé');
}
function copy(t){
  const fb=()=>{const i=document.createElement('input');i.value=t;document.body.appendChild(i);i.select();try{document.execCommand('copy');toast('Numéro copié')}catch(e){toast(t)}i.remove()};
  try{navigator.clipboard.writeText(t).then(()=>toast('Numéro copié'),fb)}catch(e){fb()}
}

/* ---------------- statistiques ---------------- */
function memberStats(u){
  const L=S.leads.filter(x=>x.owner===u),C=S.calls.filter(x=>x.user_id===u),t=today(),w=addDays(-6);
  const c=countBy(L,x=>x.status);
  return {u,n:L.length,c,calledToday:C.filter(x=>x.day===t).length,called7:C.filter(x=>x.day>=w).length,touched:L.filter(x=>x.calls>0).length};
}
function last14(calls){const out=[];for(let i=13;i>=0;i--)out.push({d:addDays(-i),n:0});const m={};out.forEach(o=>m[o.d]=o);calls.forEach(c=>{if(m[c.day])m[c.day].n++});return out}
function dayChart(a){const mx=Math.max(1,...a.map(x=>x.n));return '<div class="days">'+a.map(x=>'<div title="'+x.d+' : '+x.n+' appels"><b>'+(x.n||'')+'</b><i style="height:'+Math.round(x.n/mx*70)+'px"></i><em>'+x.d.slice(8)+'</em></div>').join('')+'</div>'}
const kpi=(v,l,c)=>'<div class="kpi '+(c||'')+'"><b>'+(typeof v==='number'?nf(v):esc(v))+'</b><span>'+esc(l)+'</span></div>';
const pill=s=>'<span class="pill s'+sIdx(s)+'">'+esc(s)+'</span>';
/* ---------------- vues : Mes appels ---------------- */
function search(L){
  const q=S.q.trim().toLowerCase(),qd=q.replace(/\D/g,'');
  return q?L.filter(x=>[x.name,x.city,x.dept,x.notes].join(' ').toLowerCase().includes(q)||(qd.length>2&&digits(x.phone).includes(qd))):L;
}
function toolbar(){
  let h='<div class="row" style="margin-bottom:12px">'+(S.viewAs?'':'<button class="btn primary" data-act="add">+ Nouveau prospect</button>');
  if(!isAdmin())h+='<label class="btn" style="cursor:pointer">Importer un Excel<input type="file" id="file" accept=".xlsx,.xls,.csv" hidden></label>';
  h+='<span class="seg" style="margin-left:auto"><button data-act="mode" data-v="pipe" aria-pressed="'+(S.mode==='pipe')+'">Pipeline</button><button data-act="mode" data-v="sheet" aria-pressed="'+(S.mode==='sheet')+'">Tableau</button><button data-act="mode" data-v="cards" aria-pressed="'+(S.mode==='cards')+'">Fiches</button></span></div>';
  if(!isAdmin()&&S.imp)h+='<div class="panel">'+impBody()+progress()+'</div>';
  return h;
}
function viewMine(){
  const L=mineList(),t=today();
  const cToday=S.calls.filter(c=>c.user_id===tgt()&&c.day===t).length;
  const c=countBy(L,x=>x.status);
  const due=L.filter(x=>isCB(x.status)&&x.callback_at&&x.callback_at<=t);
  let h=(S.viewAs?'<div class="panel" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>Tu regardes le pipeline de '+esc(nameOf(S.viewAs))+'</b><button class="btn sm primary" data-act="unview">← Retour à la vue d’ensemble</button></div>':'')+'<h2>'+(S.viewAs?'Pipeline de '+esc(nameOf(S.viewAs)):'Mes appels')+'</h2><p class="sub">Appelle, puis choisis le résultat. Chaque résultat compte un appel dans tes statistiques.</p>';
  h+='<div class="kpis">'+kpi(cToday,"Appels aujourd'hui")+kpi(due.length,'Rappels à faire')+kpi(c['Nouveau lead']||0,'Nouveau lead')+kpi(c['Lead qualifié']||0,'Lead qualifié','hot')+kpi(c['Démo planifiée']||0,'Démo planifiée','hot')+kpi(c['Gagné']||0,'Gagné','hot')+kpi(L.length,'Mes numéros')+'</div>';
  h+=toolbar();
  if(!L.length)return h+'<div class="empty"><b>Aucun numéro pour le moment.</b><p>Aboubacar ou son associé va t’attribuer ta liste d’appels, ou importe ton propre fichier Excel.</p></div>';
  if(S.mode==='pipe')return h+board(L);
  const isTodo=x=>x.status==='Nouveau lead'||isCB(x.status);
  const cnt={todo:L.filter(isTodo).length,all:L.length};ST.forEach(s=>cnt[s]=c[s]||0);
  const fl=[['todo','À faire'],['all','Tous'],...ST.map(s=>[s,s])];
  h+='<div class="chips">'+fl.map(([k,l])=>'<button class="chip" data-act="flt" data-v="'+esc(k)+'" aria-pressed="'+(S.flt===k)+'">'+esc(l)+'<small>'+(cnt[k]||0)+'</small></button>').join('')+'</div>';
  h+='<input class="search" type="search" id="q" placeholder="Chercher une agence, une ville, un numéro…" value="'+esc(S.q)+'">';
  let V=S.q.trim()?search(L):L.filter(x=>S.flt==='all'?true:S.flt==='todo'?isTodo(x):x.status===S.flt);
  const score=x=>isCB(x.status)&&x.callback_at&&x.callback_at<=t?0:x.status==='Nouveau lead'?1:isCB(x.status)?2:4;
  V=V.slice().sort((a,b)=>score(a)-score(b)||String(a.dept||'').localeCompare(String(b.dept||''))||String(a.city||'').localeCompare(String(b.city||'')));
  if(!V.length)return h+'<div class="empty">Rien dans cette liste.</div>';
  h+=S.mode==='sheet'?sheetTable(V.slice(0,S.lim)):V.slice(0,S.lim).map(leadCard).join('');
  if(V.length>S.lim)h+='<p style="text-align:center"><button class="btn" data-act="more">Voir plus ('+nf(V.length-S.lim)+' restants)</button></p>';
  return h;
}
function board(L){
  const V=search(L),t=today();
  const order=[...ST];
  const by=countBy(V,x=>x.status);
  let h='<input class="search" type="search" id="q" placeholder="Chercher une agence, une ville, un numéro…" value="'+esc(S.q)+'"><p class="note" style="margin:0 0 8px">Glisse une carte d’une colonne à l’autre pour changer son étape. Clique sur une carte pour ouvrir le profil.</p><div class="board">';
  order.forEach(st=>{
    const c=V.filter(x=>x.status===st).sort((a,b)=>isCB(st)?String(a.callback_at||'').localeCompare(String(b.callback_at||'')):String(b.updated_at||'').localeCompare(String(a.updated_at||''))||String(a.city||'').localeCompare(String(b.city||'')));
    const lim=S.kl[st]||25;
    h+='<div class="col r'+sIdx(st)+'" data-col="'+esc(st)+'"><h4>'+esc(st)+'<span>'+(by[st]||0)+'</span></h4><div class="cards">'+
      c.slice(0,lim).map(l=>'<div class="kc" draggable="true" data-act="open" data-id="'+esc(l.id)+'"><b>'+esc(l.name||'(sans nom)')+'</b><div class="m">'+esc([l.city,l.dept?('('+l.dept+')'):''].filter(Boolean).join(' '))+'</div><div class="t">'+esc(fmtPhone(l.phone))+'</div>'+
      (l.callback_at&&isCB(st)?'<span class="dt">'+(l.callback_at<=t?'À rappeler aujourd’hui':'Rappel le '+esc(l.callback_at))+'</span>':'')+(l.notes?'<div class="nn">'+esc(l.notes)+'</div>':'')+'</div>').join('')+
      (c.length>lim?'<button class="btn sm" data-act="kmore" data-v="'+esc(st)+'">Voir plus ('+(c.length-lim)+')</button>':'')+(!c.length?'<p class="note" style="margin:4px">Vide</p>':'')+'</div></div>';
  });
  return h+'</div>';
}
function sheetTable(V){
  return '<div class="scroll sheet"><table class="sheet"><thead><tr><th>Statut</th><th>Agence</th><th>Ville</th><th>Dépt</th><th>Téléphone</th><th>Notes / suivi</th><th></th></tr></thead><tbody>'+
  V.map(l=>{const s=l.status;return '<tr class="r'+sIdx(s)+'" data-id="'+esc(l.id)+'"><td><select data-act="st" class="s'+sIdx(s)+'">'+ST.map(x=>'<option'+(x===s?' selected':'')+'>'+esc(x)+'</option>').join('')+'</select>'+(isCB(s)&&l.callback_at?'<div class="sub2">le '+esc(l.callback_at)+'</div>':'')+'</td>'+
   '<td><a class="open" data-act="open">'+esc(l.name||'(sans nom)')+'</a><div class="sub2">'+esc([l.veh?('≈ '+l.veh+' véhicules'):'',l.calls?(l.calls+' appel'+(l.calls>1?'s':'')):''].filter(Boolean).join(' · '))+'</div></td><td>'+esc(l.city)+'</td><td>'+esc(l.dept)+'</td>'+
   '<td><div class="tel">'+esc(fmtPhone(l.phone))+'</div>'+(l.phone2?'<div class="alt">Autre : '+esc(fmtPhone(l.phone2))+'</div>':'')+'<button class="btn sm" style="margin-top:6px" data-act="copy" data-v="'+esc(l.phone)+'">Copier</button></td>'+
   '<td><textarea class="nt" data-act="note" placeholder="Note…">'+esc(l.notes||'')+'</textarea></td>'+
   '<td><div class="acts">'+(s==='Gagné'?'':'<button class="btn sm primary" data-act="conv">Convertir</button>')+'<button class="btn sm" data-act="open">Profil</button></div></td></tr>'}).join('')+'</tbody></table></div>';
}
function leadCard(l){
  const s=l.status,tel=String(l.phone||'').replace(/[^\d+]/g,'');
  let h='<article class="lead" data-id="'+esc(l.id)+'"><div class="lead-top"><div><h3><a class="open" data-act="open" style="cursor:pointer">'+esc(l.name||'(sans nom)')+'</a></h3><p class="meta">'+esc([l.city,l.dept?('('+l.dept+')'):'',l.veh?('≈ '+l.veh+' véhicules'):''].filter(Boolean).join(' · '))+(l.calls?' · '+l.calls+' appel'+(l.calls>1?'s':''):'')+'</p></div>'+pill(s)+'</div>';
  h+='<div class="phone"><a href="tel:'+esc(tel)+'">'+esc(fmtPhone(l.phone))+'</a><button class="btn sm" data-act="copy" data-v="'+esc(l.phone)+'">Copier</button>'+(l.phone2?'<span class="alt">Autre : '+esc(fmtPhone(l.phone2))+'</span>':'')+'</div>';
  h+='<div class="results">'+RES.map(r=>'<button class="res s'+sIdx(r)+'" data-act="res" data-v="'+esc(r)+'" aria-pressed="'+(s===r)+'">'+esc(r)+'</button>').join('')+'</div>';
  if(isCB(s))h+='<label class="cbrow">Rappeler le <input type="date" data-act="cb" value="'+esc(l.callback_at||'')+'"></label>';
  h+='<textarea data-act="note" placeholder="Notes : nom du gérant, ce qu’il a dit…">'+esc(l.notes||'')+'</textarea><p style="margin:8px 0 0">'+(s==='Gagné'?'':'<button class="btn sm" data-act="conv">Convertir en client</button> ')+'<button class="btn sm" data-act="open">Ouvrir le profil</button></p></article>';
  return h;
}
function modal(){
  if(S.adding){
    const f=['name:Nom de l’agence','city:Ville','dept:Département','phone:Téléphone','phone2:Autre numéro','veh:Nb véhicules','contact:Nom du contact'];
    return '<div class="ov" data-act="close"><div class="modal" id="addf"><div class="hd"><h2>Nouveau prospect</h2><button class="btn sm" data-act="close">Fermer</button></div><div class="fg">'+f.map(x=>{const[k,l]=x.split(':');return '<label class="fld">'+l+'<input data-k="'+k+'"></label>'}).join('')+'</div><label class="fld">Notes<textarea data-k="notes" placeholder="Notes…"></textarea></label><p style="margin:12px 0 0"><button class="btn primary" data-act="saveadd">Créer le profil</button></p></div></div>';
  }
  const l=S.leads.find(x=>x.id===S.open);if(!l)return '';
  const s=l.status;
  const F=[['name','Agence'],['contact','Contact / gérant'],['city','Ville'],['dept','Département'],['phone2','Autre numéro'],['veh','Nb véhicules'],['email','E-mail']];
  let h='<div class="ov" data-act="close"><div class="modal" data-id="'+esc(l.id)+'"><div class="hd"><div><h2>'+esc(l.name||'(sans nom)')+'</h2><p class="meta">'+pill(s)+(l.converted_at?' · converti le '+esc(dayStr(l.converted_at)):'')+(isAdmin()&&l.owner?' · attribué à '+esc(nameOf(l.owner)):'')+'</p></div><button class="btn sm" data-act="close">Fermer</button></div>';
  h+='<div class="phone"><span class="num">'+esc(fmtPhone(l.phone))+'</span><button class="btn sm" data-act="copy" data-v="'+esc(l.phone)+'">Copier</button></div>';
  if(s==='Gagné')h+='<p><button class="btn" data-act="res" data-v="Lead qualifié">Annuler la conversion</button></p>';
  else h+='<p style="margin:0 0 12px"><button class="btn conv" data-act="conv">✔ Convertir en client</button></p><div class="results">'+RES.map(r=>'<button class="res s'+sIdx(r)+'" data-act="res" data-v="'+esc(r)+'" aria-pressed="'+(s===r)+'">'+esc(r)+'</button>').join('')+'</div>';
  if(isCB(s))h+='<label class="cbrow">Rappeler le <input type="date" data-act="cb" value="'+esc(l.callback_at||'')+'"></label>';
  h+='<div class="fg">'+F.map(([k,lb])=>'<label class="fld">'+lb+'<input data-act="fld" data-f="'+k+'" value="'+esc(l[k]||'')+'"></label>').join('')+'</div>';
  h+='<label class="fld">Notes<textarea data-act="note" style="min-height:90px" placeholder="Notes : ce qui a été dit, prochaine étape…">'+esc(l.notes||'')+'</textarea></label>';
  h+='<p class="note" style="margin-top:10px">'+(l.calls||0)+' appel(s)'+(l.last_call_at?' · dernier le '+esc(dayStr(l.last_call_at)):'')+(l.region?' · '+esc(l.region):'')+(l.src?' · Sources : '+esc(l.src):'')+(l.ver?' · Vérifié le '+esc(l.ver):'')+'</p></div></div>';
  return h;
}
/* ---------------- vues : administration ---------------- */
function viewOver(){
  const M=members().map(p=>memberStats(p.id));
  const assigned=M.reduce((a,m)=>a+m.n,0);
  const cToday=M.reduce((a,m)=>a+m.calledToday,0),c7=M.reduce((a,m)=>a+m.called7,0);
  const sc=countBy(S.leads,x=>x.status),pool=poolList(),mx=Math.max(1,...ST.map(s=>sc[s]||0));
  let h='<h2>Vue d’ensemble</h2><p class="sub">Toute l’équipe, mise à jour toutes les 30 secondes.</p>';
  h+='<div class="kpis">'+kpi(S.leads.length,'Numéros au total')+kpi(pool.length,'Non attribués')+kpi(assigned,'Attribués')+kpi(cToday,"Appels aujourd'hui")+kpi(c7,'Appels sur 7 jours')+kpi(sc['Lead qualifié']||0,'Lead qualifié','hot')+kpi(sc['Démo planifiée']||0,'Démo planifiée','hot')+kpi(sc['Gagné']||0,'Gagné','hot')+'</div>';
  h+='<div class="grid2"><div class="panel"><h3>Appels par jour (14 jours)</h3>'+dayChart(last14(S.calls))+'</div>';
  h+='<div class="panel"><h3>Où en sont les leads</h3><div class="scroll"><table><tbody>'+ST.map(s=>'<tr><td>'+pill(s)+'</td><td class="n">'+nf(sc[s]||0)+'</td><td style="width:30%"><div class="bar"><i style="width:'+Math.round((sc[s]||0)/mx*100)+'%"></i></div></td></tr>').join('')+'</tbody></table></div></div></div>';
  const tot={};ST.forEach(s=>tot[s]=M.reduce((a,m)=>a+(m.c[s]||0),0));
  h+='<div class="panel"><h3>Par collaboratrice</h3><div class="scroll"><table><thead><tr><th>Nom</th><th class="n">Numéros</th><th class="n">Aujourd’hui</th><th class="n">7 jours</th>'+ST.map(s=>'<th class="n">'+esc(s)+'</th>').join('')+'</tr></thead><tbody>'+
   (M.length?M.sort((a,b)=>b.calledToday-a.calledToday||b.called7-a.called7).map(m=>'<tr><td><button class="btn sm" data-act="viewas" data-v="'+esc(m.u)+'"><b>'+esc(nameOf(m.u))+'</b> · voir</button></td><td class="n">'+nf(m.n)+'</td><td class="n">'+m.calledToday+'</td><td class="n">'+m.called7+'</td>'+ST.map(s=>'<td class="n">'+(m.c[s]||0)+'</td>').join('')+'</tr>').join('')+
   '<tr class="total"><td>Total</td><td class="n">'+nf(assigned)+'</td><td class="n">'+cToday+'</td><td class="n">'+c7+'</td>'+ST.map(s=>'<td class="n">'+tot[s]+'</td>').join('')+'</tr>':'<tr><td colspan="'+(ST.length+4)+'" class="note">Personne n’est encore actif.</td></tr>')+'</tbody></table></div></div>';
  const reg={};S.leads.forEach(x=>{const r=x.region||'—';const o=reg[r]||(reg[r]={n:0,t:0,q:0,d:0,g:0});o.n++;if(x.calls>0)o.t++;if(x.status==='Lead qualifié')o.q++;if(x.status==='Démo planifiée')o.d++;if(x.status==='Gagné')o.g++});
  const R=Object.entries(reg).sort((a,b)=>b[1].g-a[1].g||b[1].q-a[1].q||b[1].n-a[1].n);
  h+='<div class="panel"><h3>Par région</h3><div class="scroll"><table><thead><tr><th>Région</th><th class="n">Numéros</th><th class="n">Déjà appelés</th><th class="n">Lead qualifié</th><th class="n">Démo planifiée</th><th class="n">Gagné</th></tr></thead><tbody>'+
   (R.length?R.map(([r,o])=>'<tr><td>'+esc(r)+'</td><td class="n">'+nf(o.n)+'</td><td class="n">'+nf(o.t)+'</td><td class="n">'+nf(o.q)+'</td><td class="n">'+nf(o.d)+'</td><td class="n">'+nf(o.g)+'</td></tr>').join(''):'<tr><td colspan="6" class="note">Aucun numéro. Va dans « Numéros » pour importer le fichier.</td></tr>')+'</tbody></table></div></div>';
  return h;
}
function progress(){
  if(!S.busy)return '';
  return '<div class="prog"><i style="width:'+Math.round(S.busy.done/Math.max(1,S.busy.total)*100)+'%"></i></div><p class="note">'+esc(S.busy.label)+' : '+S.busy.done+' / '+S.busy.total+'</p>';
}
function viewTeam(){
  const regs=[...new Set(poolList().map(x=>x.region).filter(Boolean))].sort(),a=S.att;
  const act=members();
  let h='<h2>Équipe & attribution</h2><p class="sub">Les nouveaux comptes apparaissent « En attente » : active-les ici. Chacune ne voit que les numéros que tu lui attribues.</p>';
  h+='<div class="panel"><h3>Comptes</h3><div class="scroll"><table><thead><tr><th>Nom</th><th>E-mail</th><th>Rôle</th><th>Étiquette fichier</th><th class="n">Numéros</th><th></th></tr></thead><tbody>'+
   S.team.map(p=>{const m=memberStats(p.id);return '<tr data-u="'+esc(p.id)+'"><td><b>'+esc(p.name||'')+'</b>'+(p.id===S.me.id?' <span class="note">(moi)</span>':'')+'</td><td>'+esc(p.email)+'</td>'+
   '<td><select data-act="role"'+(p.id===S.me.id?' disabled':'')+'>'+[['pending','En attente'],['agent','Collaboratrice'],['admin','Admin']].map(([k,l])=>'<option value="'+k+'"'+(p.role===k?' selected':'')+'>'+l+'</option>').join('')+'</select></td>'+
   '<td><input data-act="label" size="9" placeholder="ex. Meva" value="'+esc(p.label||'')+'"></td><td class="n">'+nf(m.n)+'</td>'+
   '<td>'+(p.role==='pending'?'':'<button class="btn sm primary" data-act="viewas" data-v="'+esc(p.id)+'">Voir son pipeline</button> <button class="btn sm" data-act="claimlabel"'+(p.label?'':' disabled')+'>Prendre ses numéros du fichier</button> <button class="btn sm" data-act="release">Reprendre les non appelés</button>')+'</td></tr>'}).join('')+'</tbody></table></div>'+
   '<p class="note">Étiquette : « Prendre ses numéros du fichier » donne à la personne les numéros non attribués dont la colonne « Assigné à » porte son étiquette.</p></div>';
  h+='<div class="panel"><h3>Attribuer des numéros</h3><p class="note">Non attribués disponibles : <b>'+nf(poolList().length)+'</b></p><div class="row" style="margin-top:8px">'+
   '<label class="fld">À qui<select data-act="att" data-f="uid"><option value="">Choisir…</option>'+act.map(p=>'<option value="'+esc(p.id)+'"'+(a.uid===p.id?' selected':'')+'>'+esc(p.name||p.email)+'</option>').join('')+'</select></label>'+
   '<label class="fld">Région<select data-act="att" data-f="region"><option value="">Toutes</option>'+regs.map(r=>'<option'+(a.region===r?' selected':'')+'>'+esc(r)+'</option>').join('')+'</select></label>'+
   '<label class="fld">Département<input data-act="att" data-f="dept" size="4" placeholder="ex. 93" value="'+esc(a.dept)+'"></label>'+
   '<label class="fld">Combien<input data-act="att" data-f="n" type="number" min="1" max="1000" style="width:90px" value="'+esc(a.n)+'"></label>'+
   '<button class="btn primary" data-act="assign"'+(S.busy?' disabled':'')+'>Attribuer</button><button class="btn" data-act="spread"'+(S.busy?' disabled':'')+'>Répartir équitablement</button></div><p class="note" style="margin-top:8px">« Répartir équitablement » donne le même nombre de numéros (« Combien ») à chaque collaboratrice active, avec la région et le département choisis.</p>'+progress()+'</div>';
  return h;
}
function impBody(){
  const i=S.imp;if(!i)return '';
  if(i.err)return '<p class="err">'+esc(i.err)+'</p>';
  return '<p style="margin:0 0 8px"><b>'+nf(i.items.length)+'</b> numéros lus · <b>'+nf(i.fresh.length)+'</b> nouveaux pour toi · '+nf(i.items.length-i.fresh.length)+' déjà dans ta liste</p><button class="btn primary" data-act="doimport"'+(S.busy||!i.items.length?' disabled':'')+'>Importer</button><p class="note" style="margin-top:6px">Les numéros qui existent déjà ailleurs dans le CRM sont automatiquement ignorés (pas de doublon).</p>';
}
function viewAll(){
  const q=S.aq.trim().toLowerCase(),qd=q.replace(/\D/g,'');
  let V=S.leads.filter(x=>(S.af==='all'||(S.af==='pool'?!x.owner:x.owner===S.af))&&(S.ast==='all'||x.status===S.ast)&&(!q||[x.name,x.city,x.dept,x.region].join(' ').toLowerCase().includes(q)||(qd.length>2&&digits(x.phone).includes(qd))));
  V=V.slice().sort((a,b)=>String(a.region||'').localeCompare(String(b.region||''))||String(a.dept||'').localeCompare(String(b.dept||'')));
  let h='<h2>Numéros</h2><p class="sub">Tous les numéros du CRM, importés et attribués.</p>';
  h+='<div class="panel"><h3>Importer ou exporter</h3><p class="note">Choisis ton fichier Excel BOBOLOC : tous les onglets sont lus, les doublons de numéro sont ignorés.</p><div class="row" style="margin-top:8px"><input type="file" id="file" accept=".xlsx,.xls,.csv"><button class="btn" data-act="export">Exporter tout (CSV)</button></div>';
  if(S.imp&&!S.imp.err)h+='<label class="fld" style="margin-top:10px;max-width:280px">Mettre les numéros dans<select data-act="impto"><option value="">Non attribués (à répartir)</option>'+members().map(p=>'<option value="'+esc(p.id)+'"'+(S.impTo===p.id?' selected':'')+'>La liste de '+esc(p.name||p.email)+'</option>').join('')+'</select></label>';
  if(S.imp)h+='<div style="margin-top:10px">'+impBody()+'</div>';
  h+=progress()+'</div>';
  h+='<div class="row" style="margin-bottom:12px"><input type="search" id="aq" placeholder="Chercher…" value="'+esc(S.aq)+'" style="flex:1;min-width:180px"><select data-act="af"><option value="all">Tout le monde</option><option value="pool"'+(S.af==='pool'?' selected':'')+'>Non attribués</option>'+members().map(p=>'<option value="'+esc(p.id)+'"'+(S.af===p.id?' selected':'')+'>'+esc(p.name||p.email)+'</option>').join('')+'</select><select data-act="ast"><option value="all">Tous les statuts</option>'+ST.map(s=>'<option'+(S.ast===s?' selected':'')+'>'+esc(s)+'</option>').join('')+'</select></div>';
  h+='<div class="panel scroll" style="padding:6px 10px"><table><thead><tr><th>Agence</th><th>Ville</th><th>Dépt</th><th>Région</th><th>Téléphone</th><th>Statut</th><th>Attribué à</th></tr></thead><tbody>'+
   (V.length?V.slice(0,S.alim).map(x=>'<tr><td><a class="open" data-act="open" data-id="'+esc(x.id)+'" style="cursor:pointer;font-weight:700">'+esc(x.name)+'</a></td><td>'+esc(x.city)+'</td><td>'+esc(x.dept)+'</td><td>'+esc(x.region)+'</td><td>'+esc(fmtPhone(x.phone))+'</td><td>'+pill(x.status)+'</td><td>'+(x.owner?esc(nameOf(x.owner)):'<span class="note">—</span>')+'</td></tr>').join(''):'<tr><td colspan="7" class="note">Aucun numéro.</td></tr>')+'</tbody></table></div>';
  h+='<p class="note">'+nf(Math.min(V.length,S.alim))+' affichés sur '+nf(V.length)+'.'+(V.length>S.alim?' <button class="btn sm" data-act="alim">Afficher 200 de plus</button>':'')+'</p>';
  return h;
}
function render(){
  S.dirty=false;
  if(!S.me)return;
  const tabs=isAdmin()?[['over',"Vue d'ensemble"],['team','Équipe'],['all','Numéros'],['mine','Mes appels']]:[['mine','Mes appels']];
  let h='<header class="top"><div class="brand"><div class="logo">B</div>Boboloc · CRM</div><div class="who"><span class="badge">'+(isAdmin()?'Admin':'Collaboratrice')+'</span><span class="nm">'+esc(S.me.name||S.me.email)+'</span><button class="btn sm" data-act="logout">Quitter</button></div></header>';
  if(tabs.length>1)h+='<nav class="tabs">'+tabs.map(([k,l])=>'<button data-act="tab" data-v="'+k+'" aria-selected="'+(S.view===k)+'">'+l+'</button>').join('')+'</nav>';
  if(S.err)h+='<p class="err">'+esc(S.err)+'</p>';
  h+=S.view==='over'?viewOver():S.view==='team'?viewTeam():S.view==='all'?viewAll():viewMine();
  const sx=window.scrollX,sy=window.scrollY;
  $('app').innerHTML=h+modal();window.scrollTo(sx,sy);
}
/* ---------------- opérations d'administration ---------------- */
async function runChunks(items,label,size,fn){
  S.busy={label,total:items.length,done:0};render();
  let fail=0;
  for(let i=0;i<items.length;i+=size){
    const part=items.slice(i,i+size);
    try{await fn(part)}catch(e){fail++;S.err=msgErr(e)}
    S.busy.done=Math.min(items.length,i+size);sched();
  }
  S.busy=null;await refreshNow();
  toast(fail?'Terminé avec '+fail+' erreur(s)':'Terminé');
}
async function refreshNow(){try{await loadAll()}catch(e){S.err=msgErr(e)}render()}
async function setOwner(ids,owner){
  const {error}=await S.sb.from('leads').update({owner,updated_at:new Date().toISOString()}).in('id',ids);
  if(error)throw error;
}
function candidates(filter){
  const a=S.att;
  return poolList().filter(x=>(!a.region||x.region===a.region)&&(!a.dept||String(x.dept||'').startsWith(a.dept.trim()))&&(!filter||filter(x)))
    .sort((x,y)=>String(x.dept||'').localeCompare(String(y.dept||''))||String(x.city||'').localeCompare(String(y.city||'')));
}
async function assign(){
  const a=S.att;if(!a.uid){toast('Choisis une personne');return}
  const c=candidates().slice(0,Math.max(1,Math.min(1000,+a.n||50)));
  if(!c.length){toast('Aucun numéro correspondant');return}
  await runChunks(c.map(x=>x.id),'Attribution',100,ids=>setOwner(ids,a.uid));
}
async function spread(){
  const a=S.att,ppl=S.team.filter(p=>p.role==='agent');
  if(!ppl.length){toast('Aucune collaboratrice active');return}
  const n=Math.max(1,Math.min(1000,+a.n||50)),c=candidates();
  if(!c.length){toast('Aucun numéro correspondant');return}
  let i=0;const jobs=[];
  ppl.forEach(p=>{const part=c.slice(i,i+n).map(x=>x.id);i+=n;if(part.length)jobs.push([p.id,part])});
  const total=jobs.reduce((s,j)=>s+j[1].length,0);
  S.busy={label:'Répartition',total,done:0};render();
  for(const [u,ids] of jobs){for(let k=0;k<ids.length;k+=100){try{await setOwner(ids.slice(k,k+100),u)}catch(e){S.err=msgErr(e)}S.busy.done+=Math.min(100,ids.length-k);sched()}}
  S.busy=null;await refreshNow();toast(total+' numéros répartis');
}
async function claimLabel(u){
  const p=S.team.find(x=>x.id===u),lab=norm(p&&p.label);if(!lab)return;
  const c=poolList().filter(x=>norm(x.label)===lab);
  if(!c.length){toast('Aucun numéro avec cette étiquette');return}
  await runChunks(c.map(x=>x.id),'Attribution',100,ids=>setOwner(ids,u));
}
async function release(u){
  const c=S.leads.filter(x=>x.owner===u&&x.status==='Nouveau lead'&&!(x.calls>0));
  if(!c.length){toast('Rien à reprendre');return}
  await runChunks(c.map(x=>x.id),'Reprise',100,ids=>setOwner(ids,null));
}

/* ---------------- import Excel ---------------- */
function parseWb(buf){
  const wb=XLSX.read(buf,{type:'array'}),map=new Map();
  const col=(h,keys)=>h.findIndex(x=>keys.some(k=>x===k||x.startsWith(k)));
  wb.SheetNames.forEach(sn=>{
    if(norm(sn)==='accueil')return;
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:'',raw:false});
    const hi=rows.findIndex((r,i)=>i<12&&r.some(c=>norm(c)==='telephone'));if(hi<0)return;
    const h=rows[hi].map(norm);
    const ix={region:col(h,['region']),label:col(h,['assigne']),status:col(h,['statut']),name:col(h,['nom agence','nom']),city:col(h,['ville']),dept:col(h,['departement','dept','dep']),phone:col(h,['telephone']),phone2:col(h,['autre num']),notes:col(h,['notes']),veh:col(h,['nb vehicules','nb v']),src:col(h,['sources']),ver:col(h,['date verif'])};
    const g=(r,k)=>ix[k]>=0?String(r[ix[k]]==null?'':r[ix[k]]).trim():'';
    for(let i=hi+1;i<rows.length;i++){
      const r=rows[i],ph=g(r,'phone'),d=digits(ph);if(d.length<8)continue;
      const label=g(r,'label'),st=g(r,'status'),prev=map.get(d);
      if(prev){if(!prev.label&&label)prev.label=label;if(!prev.region&&g(r,'region'))prev.region=g(r,'region');continue}
      map.set(d,{phone_key:d,name:g(r,'name'),city:g(r,'city'),dept:g(r,'dept'),region:g(r,'region')||(sn==='_base'?'':sn),phone:ph,phone2:g(r,'phone2'),notes:g(r,'notes'),veh:g(r,'veh'),src:g(r,'src'),ver:g(r,'ver'),label,status:ms(st)});
    }
  });
  return [...map.values()];
}
async function onFile(f){
  if(!f)return;
  try{
    const items=parseWb(await f.arrayBuffer());
    if(!items.length)S.imp={err:'Aucun numéro trouvé : il faut une colonne « Téléphone ».'};
    else{const have=new Set(S.leads.map(x=>x.phone_key));S.imp={items,fresh:items.filter(x=>!have.has(x.phone_key))}}
  }catch(e){S.imp={err:'Fichier illisible : '+msgErr(e)}}
  render();
}
async function doImport(){
  const owner=isAdmin()?(S.impTo||null):S.me.id;
  const rows=S.imp.items.map(x=>({...x,owner}));
  let added=0;
  await runChunks(rows,'Import',300,async part=>{
    const {data,error}=await S.sb.from('leads').upsert(part,{onConflict:'phone_key',ignoreDuplicates:true}).select('id');
    if(error)throw error;added+=data.length;
  });
  toast(nf(added)+' numéros ajoutés, '+nf(rows.length-added)+' ignorés (déjà dans le CRM)');
  S.imp=null;render();
}
function exportCsv(){
  const cols=['region','dept','city','name','phone','phone2','status','callback_at','calls','notes','veh','src','ver'];
  const head=['Région','Département','Ville','Agence','Téléphone','Autre numéro','Statut','Rappel le','Nb appels','Notes','Véhicules','Sources','Vérifié le','Attribué à'];
  const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  const csv='﻿'+[head.map(q).join(';')].concat(S.leads.map(r=>cols.map(c=>q(r[c])).concat(q(r.owner?nameOf(r.owner):'')).join(';'))).join('\r\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='boboloc_crm_'+today()+'.csv';document.body.appendChild(a);a.click();a.remove();
}

/* ---------------- événements ---------------- */
const app=$('app');
app.addEventListener('submit',e=>{if(e.target.id==='authform'){e.preventDefault();submitAuth(e.target)}});
app.addEventListener('click',e=>{
  let b=e.target.closest('[data-act]');if(!b||['INPUT','SELECT','TEXTAREA'].includes(b.tagName))return;
  if(b.classList.contains('ov')&&e.target!==b)return;
  const a=b.dataset.act,v=b.dataset.v,holder=b.closest('[data-id]'),row=b.closest('tr[data-u]');
  const id=holder&&holder.dataset.id;
  if(a==='logout'){S.sb.auth.signOut();return}
  if(a==='reload'){location.reload();return}
  if(a==='authtab'){S.authTab=v;S.err='';S.msg='';renderAuth()}
  else if(a==='tab'){S.view=v;S.viewAs=null;render()}
  else if(a==='viewas'){S.viewAs=v;S.view='mine';S.q='';render();window.scrollTo(0,0)}
  else if(a==='unview'){S.viewAs=null;S.view='over';render()}
  else if(a==='flt'){S.flt=v;S.lim=40;render()}
  else if(a==='more'){S.lim+=40;render()}
  else if(a==='kmore'){S.kl[v]=(S.kl[v]||25)+25;render()}
  else if(a==='mode'){S.mode=v;try{localStorage.setItem('bb_mode',v)}catch(e){}render()}
  else if(a==='copy')copy(v);
  else if(a==='open'&&id){S.open=id;render()}
  else if(a==='close'){S.open=null;S.adding=false;render()}
  else if(a==='add'){S.adding=true;render()}
  else if(a==='saveadd'){const f={};document.querySelectorAll('#addf [data-k]').forEach(i=>f[i.dataset.k]=i.value);addProspect(f)}
  else if(a==='res'&&id)setStatus(id,v);
  else if(a==='conv'&&id)setStatus(id,'Gagné');
  else if(a==='assign')assign();
  else if(a==='spread')spread();
  else if(a==='doimport')doImport();
  else if(a==='export')exportCsv();
  else if(a==='alim'){S.alim+=200;render()}
  else if(a==='claimlabel'&&row)claimLabel(row.dataset.u);
  else if(a==='release'&&row)release(row.dataset.u);
});
app.addEventListener('change',async e=>{
  const t=e.target,a=t.dataset.act,holder=t.closest('[data-id]'),id=holder&&holder.dataset.id;
  if(t.id==='file'){onFile(t.files[0]);return}
  if(a==='note'&&id){saveField(id,{notes:t.value});if(S.dirty)sched()}
  else if(a==='st'&&id)setStatus(id,t.value);
  else if(a==='fld'&&id)saveField(id,{[t.dataset.f]:t.value.trim()});
  else if(a==='cb'&&id)saveField(id,{callback_at:t.value||null});
  else if(a==='impto'){S.impTo=t.value;render()}
  else if(a==='att'){S.att[t.dataset.f]=t.dataset.f==='n'?(+t.value||50):t.value;if(t.dataset.f!=='dept'&&t.dataset.f!=='n')render()}
  else if(a==='af'){S.af=t.value;S.alim=100;render()}
  else if(a==='ast'){S.ast=t.value;S.alim=100;render()}
  else if(a==='role'){
    const u=t.closest('tr').dataset.u;
    const {error}=await S.sb.from('profiles').update({role:t.value}).eq('id',u);
    if(error)toast('Erreur');else{const p=S.team.find(x=>x.id===u);if(p)p.role=t.value;toast('Rôle mis à jour');render()}
  }else if(a==='label'){
    const u=t.closest('tr').dataset.u;
    const {error}=await S.sb.from('profiles').update({label:t.value.trim()}).eq('id',u);
    if(error)toast('Erreur');else{const p=S.team.find(x=>x.id===u);if(p)p.label=t.value.trim();toast('Étiquette enregistrée');render()}
  }
});
app.addEventListener('input',e=>{
  const t=e.target;
  const redo=(id,key)=>{S[key]=t.value;if(key==='q')S.lim=40;else S.alim=100;clearTimeout(S.qt);S.qt=setTimeout(()=>{const p=t.selectionStart;render();const n=$(id);if(n){n.focus();n.setSelectionRange(p,p)}},250)};
  if(t.id==='q')redo('q','q');else if(t.id==='aq')redo('aq','aq');
});
app.addEventListener('focusout',()=>{setTimeout(()=>{if(S.dirty&&!editing())sched()},150)});
app.addEventListener('dragstart',e=>{const k=e.target.closest&&e.target.closest('.kc');if(!k)return;e.dataTransfer.setData('text/plain',k.dataset.id);e.dataTransfer.effectAllowed='move'});
app.addEventListener('dragend',()=>document.querySelectorAll('.col.over').forEach(c=>c.classList.remove('over')));
app.addEventListener('dragover',e=>{const c=e.target.closest&&e.target.closest('.col');if(!c)return;e.preventDefault();document.querySelectorAll('.col.over').forEach(x=>{if(x!==c)x.classList.remove('over')});c.classList.add('over')});
app.addEventListener('drop',e=>{const c=e.target.closest&&e.target.closest('.col');if(!c)return;e.preventDefault();c.classList.remove('over');const id=e.dataTransfer.getData('text/plain'),l=S.leads.find(x=>x.id===id);if(l&&l.status!==c.dataset.col)setStatus(id,c.dataset.col)});

start().catch(e=>gate('<div class="auth"><div class="panel"><h2>Erreur au démarrage</h2><p class="sub">'+esc(msgErr(e))+'</p></div></div>'));
})();
