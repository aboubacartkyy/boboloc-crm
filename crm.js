(function(){
'use strict';
const TR="Période d'essai",SETST='Nouveau lead setter';
const ST=[SETST,'Nouveau lead','Répond pas','Répond pas (+2 véhicules)','Lead qualifié','Démo planifiée','Démo reussi (Lancement future)','Démo terminée (1 véhicule)','Démo terminée (+2 véhicules)',TR,'Abandonné','Archive ( 1 véhicule )','Archive ( +2 véhicules )','Converti'];
const LEG={'À appeler':'Nouveau lead','Messagerie':'Répond pas','Rappeler':'Répond pas','Intéressé':'Lead qualifié','RDV fixé':'Démo planifiée','Pas intéressé':'Abandonné','Faux numéro':'Abandonné','Gagné':'Converti'};
const ms=s=>ST.includes(s)?s:(LEG[s]||'Nouveau lead');
const isCB=s=>s==='Répond pas'||s==='Répond pas (+2 véhicules)';
const CMAP={'Nouveau lead setter':8,'Nouveau lead':0,'Répond pas':1,'Répond pas (+2 véhicules)':1,'Lead qualifié':3,'Démo planifiée':2,'Démo reussi (Lancement future)':3,'Démo terminée (1 véhicule)':3,'Démo terminée (+2 véhicules)':4,"Période d'essai":7,'Abandonné':5,'Archive ( 1 véhicule )':6,'Archive ( +2 véhicules )':6,'Converti':4};
const RES=ST.filter(s=>s!=='Converti'&&s!==SETST);
const DEMO_ST=['Démo reussi (Lancement future)','Démo terminée (1 véhicule)','Démo terminée (+2 véhicules)'];
const VEH={'Démo reussi (Lancement future)':'future','Démo terminée (1 véhicule)':'1','Démo terminée (+2 véhicules)':'2+'};
const VL={'1':'1 véhicule','2+':'+2 véhicules','future':'Lancement future','':'Non précisé'};
const PLANS=[['eco','Éco',29.99],['sport','Sport',59.99],['sportp','Sport+',94.99]];
const planOf=k=>PLANS.find(p=>p[0]===k);
const eur=n=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(n||0);
const MN=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const monthOf=t=>{if(!t)return '';const d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')};
const curMonth=()=>monthOf(Date.now());
const monthLabel=m=>{const a=String(m).split('-');return (MN[+a[1]-1]||'?')+' '+a[0]};
const isConv=l=>l.status==='Converti';
const isDemo=l=>DEMO_ST.includes(l.status)||l.status===TR||isConv(l)||!!l.demo_done_at;
const isTrial=l=>l.status===TR||isConv(l)||!!l.trial_at;
const vehOf=l=>l.demo_veh||VEH[l.status]||'';
const demoMonth=l=>monthOf(l.demo_done_at||l.trial_at||l.converted_at||l.updated_at);
/* fuseaux horaires : Madagascar, France, Géorgie */
const ZN={mg:{l:'Madagascar',n:'heure de Madagascar',tz:'Indian/Antananarivo'},fr:{l:'France',n:'heure française',tz:'Europe/Paris'},ge:{l:'Géorgie',n:'heure de Géorgie',tz:'Asia/Tbilisi'}};
const guessZone=()=>{try{const t=Intl.DateTimeFormat().resolvedOptions().timeZone||'';return /Antananarivo/.test(t)?'mg':/Tbilisi/.test(t)?'ge':'fr'}catch(e){return 'fr'}};
const myZone=()=>{try{const z=localStorage.getItem('bb_tz');if(ZN[z])return z}catch(e){}return guessZone()};
function tzOff(tz,ms){const p={};new Intl.DateTimeFormat('en-US',{timeZone:tz,hourCycle:'h23',year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',second:'numeric'}).formatToParts(new Date(ms)).forEach(x=>{p[x.type]=+x.value});return Date.UTC(p.year,p.month-1,p.day,p.hour%24,p.minute,p.second)-Math.floor(ms/1000)*1000}
function zonedToUtc(s,z){const m=/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/.exec(s||'');if(!m||!ZN[z])return null;const g=Date.UTC(+m[1],m[2]-1,+m[3],+m[4],+m[5]);let t=g-tzOff(ZN[z].tz,g);t=g-tzOff(ZN[z].tz,t);return new Date(t).toISOString()}
const fz=(iso,z,o)=>new Intl.DateTimeFormat('fr-FR',Object.assign({timeZone:ZN[z].tz},o)).format(new Date(iso));
const fDay={weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'};
const fHour={hour:'2-digit',minute:'2-digit'};
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
  aq:'',af:'all',ast:'all',alim:100,imp:null,impTo:'',impSrc:'liste_abou',busy:null,att:{uid:'',region:'',dept:'',n:50},err:'',authTab:'in',msg:'',
  subs:[],sources:[],origins:[],costs:[],planFor:null,planVeh:'',addSet:false,abMonth:'',cfgMonth:'',stMonth:''};
let rafId=0,timer=0;
const isAdmin=()=>S.me&&S.me.role==='admin';
const isSetter=()=>S.me&&S.me.role==='setter';
const tgt=()=>S.viewAs||S.me.id;

function toast(m){const t=$('toast');t.textContent=m;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>t.hidden=true,2600)}
function editing(){const a=document.activeElement;return a&&(a.tagName==='TEXTAREA'||a.tagName==='INPUT')&&a.type!=='file'}
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
  S.calls=await pageAll(()=>sb.from('calls').select('*').gte('day',addDays(-90)).order('id'));
  const pr=await sb.from('profiles').select('*').order('created_at');if(pr.data)S.team=pr.data;
  const so=await sb.from('sources').select('*').order('id');if(so.data)S.sources=so.data;
  const og=await sb.from('origin_types').select('*').order('id');if(og.data)S.origins=og.data;
  if(isAdmin()){
    S.subs=await pageAll(()=>sb.from('subscriptions').select('*').order('lead_id').order('month'));
    const co=await sb.from('source_costs').select('*');S.costs=co.data||[];
  }
}
async function refresh(){
  if(!S.me||S.busy||document.hidden||S.open||S.adding||S.addSet||S.planFor)return;
  try{await loadAll();sched()}catch(e){}
}
const nameOf=u=>{const p=S.team.find(x=>x.id===u);return p?(p.name||p.email):(u===S.me.id?(S.me.name||'Moi'):'—')};
const mineList=()=>S.leads.filter(l=>l.owner===tgt()||(!S.viewAs&&!l.owner&&l.setter_id));
const poolList=()=>S.leads.filter(l=>!l.owner);
const members=()=>S.team.filter(p=>p.role==='agent'||p.role==='admin'||p.role==='setter');
const srcNames=()=>{const a=S.sources.map(x=>x.name);S.leads.forEach(l=>{if(l.source&&!a.includes(l.source))a.push(l.source)});return a};
const activeSrc=()=>S.sources.filter(x=>x.active).map(x=>x.name);
const activeOrg=()=>S.origins.filter(x=>x.active).map(x=>x.name);

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
  S.view=isAdmin()?'over':isSetter()?'set':'mine';
  gate('<p class="sub" style="padding-top:40px">Chargement de tes numéros…</p>');
  try{await loadAll()}catch(e){S.err='Chargement impossible : '+msgErr(e)}
  render();
  clearInterval(timer);timer=setInterval(refresh,30000);clearInterval(S.tk);S.tk=setInterval(tick,30000);tick();
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
async function setStatus(id,st,extra){
  const l=S.leads.find(x=>x.id===id);if(!l)return;
  const now=new Date().toISOString();
  const p={status:st,updated_at:now,last_call_at:now,calls:(l.calls||0)+1,
    callback_at:isCB(st)?(l.callback_at&&l.callback_at>=today()?l.callback_at:addDays(1)):null,
    converted_at:st==='Converti'?(l.converted_at||now):null};
  if(!isCB(st)){p.callback_ts=null;p.callback_zone=null}
  if(DEMO_ST.includes(st)){p.demo_done_at=l.demo_done_at||now;p.demo_veh=VEH[st]}
  if(st===TR){p.trial_at=l.trial_at||now;if(!l.demo_done_at)p.demo_done_at=now}
  if(st==='Converti'){if(!l.demo_done_at)p.demo_done_at=now;Object.assign(p,extra||{});p.churned_month=null}
  else if(l.status==='Converti'){p.plan=null;p.amount=null;p.churned_month=null}
  const old={...l};patchLocal(id,p);render();
  const {error}=await S.sb.from('leads').update(p).eq('id',id);
  if(error){patchLocal(id,old);render();toast("Erreur d'enregistrement");return}
  if(st==='Converti'&&p.plan)await setSub(S.leads.find(x=>x.id===id),(S.view==='abo'&&S.abMonth)||curMonth(),true,p.plan);
  if(!S.viewAs){const r=await S.sb.from('calls').insert({lead_id:id,user_id:S.me.id,status:st,day:today()});if(!r.error)S.calls.push({lead_id:id,user_id:S.me.id,status:st,day:today()})}
  toast(st==='Converti'?'Converti 🎉 '+(p.plan?planOf(p.plan)[1]:''):'Enregistré : '+st);sched();
}
function requestStatus(id,st){
  const l=S.leads.find(x=>x.id===id);if(!l||l.status===st)return;
  if(st==='Converti'){if(!isAdmin()){toast('Seul l’admin valide une conversion, après vérification de l’abonnement');return}S.planFor=id;render();return}
  if(st===SETST){toast('Cette colonne est réservée aux leads du setter');return}
  if(!(isAdmin()||l.owner===S.me.id)){toast('Ce lead n’est pas à toi : clique d’abord sur « Je m’assigne »');return}
  setStatus(id,st);
}
async function claim(id){
  const l=S.leads.find(x=>x.id===id);if(!l||l.owner)return;
  const p={owner:S.me.id,status:'Démo planifiée',updated_at:new Date().toISOString()},old={...l};
  patchLocal(id,p);render();
  const {data,error}=await S.sb.from('leads').update(p).eq('id',id).is('owner',null).select('id');
  if(error||!data||!data.length){patchLocal(id,old);toast(error?"Erreur d'assignation":'Quelqu’un d’autre l’a déjà pris');await refreshNow();return}
  toast('Lead assigné à toi : démo planifiée');sched();
}
async function setSub(l,month,paid,planKey){
  if(!l)return;const k=planKey||l.plan,pl=planOf(k);
  const row={lead_id:l.id,month,paid,plan:k||null,amount:paid&&pl?pl[2]:0,checked_at:new Date().toISOString()};
  const {error}=await S.sb.from('subscriptions').upsert(row,{onConflict:'lead_id,month'});
  if(error){toast("Erreur d'enregistrement de l'abonnement");return false}
  const i=S.subs.findIndex(x=>x.lead_id===l.id&&x.month===month);if(i>=0)S.subs[i]=row;else S.subs.push(row);
  return true;
}
const subOf=(id,m)=>S.subs.find(x=>x.lead_id===id&&x.month===m);
const ltv=l=>S.subs.filter(x=>x.lead_id===l.id&&x.paid).reduce((a,x)=>a+(+x.amount||0),0);
async function saveField(id,p){
  p.updated_at=new Date().toISOString();patchLocal(id,p);
  const {error}=await S.sb.from('leads').update(p).eq('id',id);
  if(error)toast("Erreur d'enregistrement");
}
async function addProspect(f){
  const d=digits(f.phone);
  if(!f.name.trim()){toast("Mets au moins le nom de l'agence");return}
  if(d.length<8){toast('Numéro de téléphone invalide');return}
  const row={owner:S.me.id,phone_key:d,name:f.name.trim(),city:f.city.trim(),dept:f.dept.trim(),phone:f.phone.trim(),phone2:f.phone2.trim(),veh:f.veh.trim(),contact:f.contact.trim(),notes:f.notes.trim(),src:'Saisie manuelle',source:f.source||'liste_abou',status:'Nouveau lead'};
  const {data,error}=await S.sb.from('leads').insert(row).select().single();
  if(error){toast(error.code==='23505'?'Ce numéro existe déjà dans le CRM (chez toi ou une collègue)':"Erreur de création");return}
  S.leads.push(data);S.adding=false;S.open=data.id;render();toast('Profil créé');
}
async function addSetterLead(f){
  const d=digits(f.phone);
  if(!f.name.trim()){toast('Mets le nom du prospect');return}
  if(d.length<8){toast('Numéro de téléphone invalide');return}
  if(!f.source||!f.origin_type){toast('Choisis la source et le type d’origine');return}
  if(f.recap.trim().length<5){toast('Écris un petit récap de l’échange');return}
  const iso=zonedToUtc(f.demo,f.zone);
  if(!iso){toast('Indique la date et l’heure de la démo');return}
  if(new Date(iso)<=new Date()){toast('La date de la démo doit être à partir de maintenant');return}
  const row={owner:null,setter_id:S.me.id,phone_key:d,name:f.name.trim(),city:f.city.trim(),phone:f.phone.trim(),contact:f.contact.trim(),veh:f.veh.trim(),source:f.source,origin_type:f.origin_type,recap:f.recap.trim(),demo_at:iso,demo_zone:f.zone,status:SETST,src:'Setter',notes:''};
  const {data,error}=await S.sb.from('leads').insert(row).select().single();
  if(error){toast(error.code==='23505'?'Ce numéro existe déjà dans le CRM':"Erreur de création : "+error.message);return}
  S.leads.push(data);S.addSet=false;render();toast('Lead ajouté : il apparaît chez les démonstratrices');
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
/* ---------------- taux et statistiques ---------------- */
function rates(L){
  const d=L.filter(isDemo),t=L.filter(isTrial),c=L.filter(isConv);
  const by={'1':0,'2+':0,'future':0,'':0},byC={'1':0,'2+':0,'future':0,'':0};
  d.forEach(x=>{const k=vehOf(x);by[k]++;if(isConv(x))byC[k]++});
  return {n:L.length,d:d.length,t:t.length,c:c.length,by,byC,t1:pct(c.length,t.length),t2:pct(c.length,d.length)};
}
function grp(L,f){const m={};L.forEach(x=>{const k=f(x)||'—';(m[k]||(m[k]=[])).push(x)});return Object.entries(m).map(([k,a])=>[k,rates(a),a]).sort((a,b)=>b[1].c-a[1].c||b[1].d-a[1].d||b[1].n-a[1].n)}
const rateHead='<th class="n">Leads</th><th class="n">Démos faites</th><th class="n">Période d’essai</th><th class="n">Convertis</th><th class="n">Taux 1<br>converti ÷ essai</th><th class="n">Taux 2<br>converti ÷ démos</th>';
const rateCells=r=>'<td class="n">'+nf(r.n)+'</td><td class="n">'+nf(r.d)+'</td><td class="n">'+nf(r.t)+'</td><td class="n">'+nf(r.c)+'</td><td class="n">'+r.t1+'</td><td class="n">'+r.t2+'</td>';
const vehHead=['1','2+','future'].map(k=>'<th class="n">'+VL[k]+'<br>démos / convertis</th>').join('');
const vehCells=r=>['1','2+','future'].map(k=>'<td class="n">'+r.by[k]+' / '+r.byC[k]+' ('+pct(r.byC[k],r.by[k])+')</td>').join('');
function rateTable(G,first,extra){
  return '<div class="scroll"><table><thead><tr><th>'+first+'</th>'+rateHead+(extra?'<th class="n">% démo ÷ leads</th><th class="n">% converti ÷ leads</th>':'')+'</tr></thead><tbody>'+
   (G.length?G.map(([k,r])=>'<tr><td>'+esc(k)+'</td>'+rateCells(r)+(extra?'<td class="n">'+pct(r.d,r.n)+'</td><td class="n">'+pct(r.c,r.n)+'</td>':'')+'</tr>').join(''):'<tr><td colspan="9" class="note">Aucune donnée pour le moment.</td></tr>')+'</tbody></table></div>';
}
const TNOTE='<p class="note"><b>Taux 1</b> = convertis ÷ personnes en période d’essai (ceux déjà convertis comptent aussi dans l’essai). <b>Taux 2</b> = convertis ÷ toutes les démos faites.</p>';
function demoPanel(L,title,noK){
  const r=rates(L);
  return '<div class="panel"><h3>'+esc(title)+'</h3>'+(noK?'':'<div class="kpis">'+kpi(r.d,'Démos faites')+kpi(r.t,"Période d'essai")+kpi(r.c,'Convertis','hot')+kpi(r.t1,'Taux 1 · converti ÷ essai')+kpi(r.t2,'Taux 2 · converti ÷ démos')+'</div>')+
   '<div class="scroll"><table><thead><tr><th>Démos terminées par véhicules</th><th class="n">Démos</th><th class="n">Convertis</th><th class="n">Taux</th></tr></thead><tbody>'+
   ['1','2+','future',''].filter(k=>k||r.by['']).map(k=>'<tr><td>'+VL[k]+'</td><td class="n">'+r.by[k]+'</td><td class="n">'+r.byC[k]+'</td><td class="n">'+pct(r.byC[k],r.by[k])+'</td></tr>').join('')+'</tbody></table></div>'+(r.by['']?'<p class="note">« Non précisé » = démo ou conversion sans nombre de véhicules enregistré (par exemple un lead passé directement en Converti). Une démo est comptée une fois ; un lead converti compte aussi comme démo faite.</p>':'')+'</div>';
}
const localInput=(iso,z)=>new Intl.DateTimeFormat('sv-SE',{timeZone:ZN[z].tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(iso)).replace(' ','T');
function zonesHtml(iso,zone){
  const z=myZone(),o=Object.keys(ZN).filter(k=>k!==z);
  return '<b>'+esc(fz(iso,z,fDay))+'</b> <em>'+esc(ZN[z].n)+'</em><small>= '+o.map(k=>esc(fz(iso,k,fHour))+' '+esc(ZN[k].n)).join(' · ')+(zone&&ZN[zone]?' · saisie en '+esc(ZN[zone].n):'')+'</small>';
}
const cbHtml=l=>l.callback_ts?'<span class="demo">'+zonesHtml(l.callback_ts,l.callback_zone)+'</span>':'';
const cbDue=l=>l.callback_ts?new Date(l.callback_ts).getTime()<=Date.now():!!(l.callback_at&&l.callback_at<=today());
function cbRow(l){const z=l.callback_zone&&ZN[l.callback_zone]?l.callback_zone:myZone();return '<div class="cbrow">Rappeler le <input type="datetime-local" data-act="cbt" value="'+(l.callback_ts?localInput(l.callback_ts,z):'')+'"> <select data-act="cbt">'+zoneOpts(z)+'</select>'+cbHtml(l)+'</div>'}
function agenda(){
  const u=tgt(),now=Date.now(),out=[];
  S.leads.forEach(l=>{if(l.owner!==u)return;
    if(isCB(l.status)&&l.callback_ts)out.push({l,t:new Date(l.callback_ts).getTime(),k:'Rappel'});
    if(l.status==='Démo planifiée'&&l.demo_at)out.push({l,t:new Date(l.demo_at).getTime(),k:'Démo'})});
  return out.filter(x=>x.t<now+864e5).sort((a,b)=>a.t-b.t);
}
function agendaPanel(){
  const A=agenda(),now=Date.now();
  let h='<div class="panel agenda"><h3>Rappels et démos des prochaines 24 h</h3>';
  if(!S.viewAs&&typeof Notification!=='undefined'&&Notification.permission==='default')h+='<p class="note">Pour ne rien oublier : <button class="btn sm primary" data-act="notif">Activer les alertes sur cet appareil</button> (une alerte avec son apparaît 10 minutes avant, tant que cette page reste ouverte).</p>';
  if(!A.length)return h+'<p class="note">Aucun rappel ni démo daté dans les prochaines 24 h.</p></div>';
  h+=A.map(x=>{const d=Math.round((x.t-now)/6e4),cls=d<0?'late':d<=30?'soon':'',lab=d<0?'En retard de '+(-d<60?(-d)+' min':Math.round(-d/60)+' h'):d<60?'Dans '+d+' min':'Dans '+Math.floor(d/60)+' h '+pad(d%60);
    return '<div class="ag '+cls+'" data-id="'+esc(x.l.id)+'"><span class="tag2">'+x.k+'</span><div><a class="open" data-act="open" style="cursor:pointer;font-weight:700">'+esc(x.l.name||'')+'</a> · '+esc(fmtPhone(x.l.phone))+'<span class="demo">'+zonesHtml(x.k==='Démo'?x.l.demo_at:x.l.callback_ts,x.k==='Démo'?x.l.demo_zone:x.l.callback_zone)+'</span></div><b class="when">'+lab+'</b></div>'}).join('');
  return h+'</div>';
}
function beep(){try{const c=new (window.AudioContext||window.webkitAudioContext)(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=880;g.gain.value=.15;o.start();setTimeout(()=>{o.stop();c.close()},450)}catch(e){}}
function tick(){
  if(!S.me)return;const now=Date.now();let n=0,seen={};
  try{seen=JSON.parse(localStorage.getItem('bb_seen')||'{}')}catch(e){}
  agenda().forEach(x=>{const d=x.t-now;if(d<=10*6e4){n++;const key=x.k+x.l.id+x.t;if(!seen[key]&&d>-36e5*6){seen[key]=now;const msg=x.k+' : '+(x.l.name||'')+(d<=0?' (maintenant)':' dans '+Math.max(1,Math.round(d/6e4))+' min');toast(msg);beep();try{if(typeof Notification!=='undefined'&&Notification.permission==='granted')new Notification('Boboloc · '+x.k,{body:msg})}catch(e){}}}});
  Object.keys(seen).forEach(k=>{if(now-seen[k]>864e5)delete seen[k]});
  try{localStorage.setItem('bb_seen',JSON.stringify(seen))}catch(e){}
  document.title=(n?'('+n+') ':'')+'Espace équipe — Boboloc';
  if(S.view==='mine'&&!S.open)sched();
}
function demoHtml(l){
  if(!l.demo_at)return '';
  const z=myZone(),o=Object.keys(ZN).filter(k=>k!==z);
  return '<span class="demo"><b>'+esc(fz(l.demo_at,z,fDay))+'</b> <em>'+esc(ZN[z].n)+'</em><small>= '+o.map(k=>esc(fz(l.demo_at,k,fHour))+' '+esc(ZN[k].n)).join(' · ')+(l.demo_zone&&ZN[l.demo_zone]?' · saisie en '+esc(ZN[l.demo_zone].n):'')+'</small></span>';
}
function setterBox(l){
  if(!l.setter_id)return '';
  return '<div class="setbox"><b>Lead du setter '+esc(nameOf(l.setter_id))+'</b><div class="note">'+esc([l.source,l.origin_type].filter(Boolean).join(' · '))+'</div>'+(l.recap?'<p>'+esc(l.recap)+'</p>':'')+demoHtml(l)+'</div>';
}
const canEditLead=l=>isAdmin()||l.owner===S.me.id;
const srcOpts=(cur,withEmpty)=>(withEmpty?'<option value="">Choisir…</option>':'')+[...new Set([...activeSrc(),...(cur?[cur]:[])])].map(n=>'<option'+(n===cur?' selected':'')+'>'+esc(n)+'</option>').join('');
const orgOpts=(cur,withEmpty)=>(withEmpty?'<option value="">Choisir…</option>':'')+[...new Set([...activeOrg(),...(cur?[cur]:[])])].map(n=>'<option'+(n===cur?' selected':'')+'>'+esc(n)+'</option>').join('');
const zoneOpts=cur=>Object.keys(ZN).map(k=>'<option value="'+k+'"'+(k===cur?' selected':'')+'>'+esc(ZN[k].l)+'</option>').join('');
function viewMine(){
  const L=mineList(),t=today(),own=L.filter(x=>x.owner===tgt());
  const cToday=S.calls.filter(c=>c.user_id===tgt()&&c.day===t).length;
  const c=countBy(L,x=>x.status);
  const due=L.filter(x=>isCB(x.status)&&x.callback_at&&cbDue(x));
  let h=(S.viewAs?'<div class="panel" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>Tu regardes le pipeline de '+esc(nameOf(S.viewAs))+'</b><button class="btn sm primary" data-act="unview">← Retour à la vue d’ensemble</button></div>':'')+'<h2>'+(S.viewAs?'Pipeline de '+esc(nameOf(S.viewAs)):'Mes appels')+'</h2><p class="sub">Appelle, puis choisis le résultat. Les leads du setter arrivent dans la colonne « Nouveau lead setter » : clique sur « Je m’assigne » pour faire la démo.</p>';
  h+=agendaPanel();
  h+='<div class="kpis">'+kpi(cToday,"Appels aujourd'hui")+kpi(due.length,'Rappels à faire')+kpi(c[SETST]||0,'Nouveau lead setter','hot')+kpi(c['Nouveau lead']||0,'Nouveau lead')+kpi(c['Lead qualifié']||0,'Lead qualifié','hot')+kpi(c['Démo planifiée']||0,'Démo planifiée','hot')+kpi(c['Converti']||0,'Converti','hot')+kpi(own.length,'Mes numéros')+'</div>';
  h+=toolbar();
  if(!L.length)return h+'<div class="empty"><b>Aucun numéro pour le moment.</b><p>Aboubacar ou son associé va t’attribuer ta liste d’appels, ou importe ton propre fichier Excel.</p></div>'+demoPanel(own,'Mes démos et mes taux de conversion');
  if(S.mode==='pipe')return h+board(L)+demoPanel(own,S.viewAs?'Démos et taux de conversion':'Mes démos et mes taux de conversion');
  const isTodo=x=>x.status==='Nouveau lead'||x.status===SETST||isCB(x.status);
  const cnt={todo:L.filter(isTodo).length,all:L.length};ST.forEach(s=>cnt[s]=c[s]||0);
  const fl=[['todo','À faire'],['all','Tous'],...ST.map(s=>[s,s])];
  h+='<div class="chips">'+fl.map(([k,l])=>'<button class="chip" data-act="flt" data-v="'+esc(k)+'" aria-pressed="'+(S.flt===k)+'">'+esc(l)+'<small>'+(cnt[k]||0)+'</small></button>').join('')+'</div>';
  h+='<input class="search" type="search" id="q" placeholder="Chercher une agence, une ville, un numéro…" value="'+esc(S.q)+'">';
  let V=S.q.trim()?search(L):L.filter(x=>S.flt==='all'?true:S.flt==='todo'?isTodo(x):x.status===S.flt);
  const score=x=>x.status===SETST?0:isCB(x.status)&&x.callback_at&&x.callback_at<=t?1:x.status==='Nouveau lead'?2:isCB(x.status)?3:4;
  V=V.slice().sort((a,b)=>score(a)-score(b)||String(a.dept||'').localeCompare(String(b.dept||''))||String(a.city||'').localeCompare(String(b.city||'')));
  if(!V.length)return h+'<div class="empty">Rien dans cette liste.</div>';
  h+=S.mode==='sheet'?sheetTable(V.slice(0,S.lim)):V.slice(0,S.lim).map(leadCard).join('');
  if(V.length>S.lim)h+='<p style="text-align:center"><button class="btn" data-act="more">Voir plus ('+nf(V.length-S.lim)+' restants)</button></p>';
  return h+demoPanel(own,'Mes démos et mes taux de conversion');
}
function kcard(l,st,t){
  const mine=canEditLead(l),free=!l.owner&&l.setter_id,pl=l.plan?planOf(l.plan):null;
  return '<div class="kc'+(l.setter_id?' fs':'')+'" draggable="'+(mine&&!free?'true':'false')+'" data-act="open" data-id="'+esc(l.id)+'">'+
   (l.setter_id?'<span class="tag">SETTER · '+esc(nameOf(l.setter_id))+'</span>':'')+
   '<b>'+esc(l.name||'(sans nom)')+'</b><div class="m">'+esc([l.city,l.dept?('('+l.dept+')'):''].filter(Boolean).join(' '))+'</div><div class="t">'+esc(fmtPhone(l.phone))+'</div>'+
   (l.demo_at&&(st===SETST||st==='Démo planifiée')?demoHtml(l):'')+
   (isCB(st)&&l.callback_ts?cbHtml(l):l.callback_at&&isCB(st)?'<span class="dt">'+(l.callback_at<=t?'À rappeler aujourd’hui':'Rappel le '+esc(l.callback_at))+'</span>':'')+
   (l.source&&l.source!=='liste_abou'?'<span class="src">'+esc(l.source)+'</span>':'')+
   (isConv(l)&&pl?'<span class="src plan">'+esc(pl[1])+' · '+eur(l.amount)+'/mois</span>':'')+
   (free?'<button class="btn sm primary" data-act="claim">Je m’assigne</button>':'')+
   (l.setter_id&&l.recap?'<div class="nn">'+esc(l.recap)+'</div>':(l.notes?'<div class="nn">'+esc(l.notes)+'</div>':''))+'</div>';
}
function board(L){
  const V=search(L),t=today();
  const by=countBy(V,x=>x.status);
  let h='<input class="search" type="search" id="q" placeholder="Chercher une agence, une ville, un numéro…" value="'+esc(S.q)+'"><p class="note" style="margin:0 0 8px">Glisse une carte d’une colonne à l’autre pour changer son étape. Clique sur une carte pour ouvrir le profil. Les cartes bleues « SETTER » viennent du setter.</p><div class="board">';
  ST.forEach(st=>{
    const c=V.filter(x=>x.status===st).sort((a,b)=>isCB(st)?String(a.callback_at||'').localeCompare(String(b.callback_at||'')):st===SETST?String(a.demo_at||'').localeCompare(String(b.demo_at||'')):String(b.updated_at||'').localeCompare(String(a.updated_at||''))||String(a.city||'').localeCompare(String(b.city||'')));
    const lim=S.kl[st]||25,tot=st==='Converti'?c.reduce((a,x)=>a+(+x.amount||0),0):0;
    h+='<div class="col r'+sIdx(st)+'" data-col="'+esc(st)+'"><h4>'+esc(st)+'<span>'+(by[st]||0)+'</span></h4>'+(st==='Converti'?'<div class="amt">'+eur(tot)+' / mois</div>':'')+'<div class="cards">'+
      c.slice(0,lim).map(l=>kcard(l,st,t)).join('')+
      (c.length>lim?'<button class="btn sm" data-act="kmore" data-v="'+esc(st)+'">Voir plus ('+(c.length-lim)+')</button>':'')+(!c.length?'<p class="note" style="margin:4px">Vide</p>':'')+'</div></div>';
  });
  return h+'</div>';
}
function sheetTable(V){
  return '<div class="scroll sheet"><table class="sheet"><thead><tr><th>Statut</th><th>Agence</th><th>Ville</th><th>Dépt</th><th>Téléphone</th><th>Notes / suivi</th><th></th></tr></thead><tbody>'+
  V.map(l=>{const s=l.status,mine=canEditLead(l),free=!l.owner&&l.setter_id;return '<tr class="r'+sIdx(s)+'" data-id="'+esc(l.id)+'"><td>'+(mine&&!free?'<select data-act="st" class="s'+sIdx(s)+'">'+ST.map(x=>'<option'+(x===s?' selected':'')+'>'+esc(x)+'</option>').join('')+'</select>':pill(s))+(isCB(s)&&l.callback_at?'<div class="sub2">le '+esc(l.callback_at)+'</div>':'')+'</td>'+
   '<td><a class="open" data-act="open">'+esc(l.name||'(sans nom)')+'</a>'+(l.setter_id?' <span class="tag">SETTER</span>':'')+'<div class="sub2">'+esc([l.source,l.veh?('≈ '+l.veh+' véhicules'):'',l.calls?(l.calls+' appel'+(l.calls>1?'s':'')):''].filter(Boolean).join(' · '))+'</div>'+(l.demo_at&&(s===SETST||s==='Démo planifiée')?demoHtml(l):'')+'</td><td>'+esc(l.city)+'</td><td>'+esc(l.dept)+'</td>'+
   '<td><div class="tel">'+esc(fmtPhone(l.phone))+'</div>'+(l.phone2?'<div class="alt">Autre : '+esc(fmtPhone(l.phone2))+'</div>':'')+'<button class="btn sm" style="margin-top:6px" data-act="copy" data-v="'+esc(l.phone)+'">Copier</button></td>'+
   '<td>'+(mine&&!free?'<textarea class="nt" data-act="note" placeholder="Note…">'+esc(l.notes||'')+'</textarea>':'<div class="sub2">'+esc(l.recap||'')+'</div>')+'</td>'+
   '<td><div class="acts">'+(free?'<button class="btn sm primary" data-act="claim">Je m’assigne</button>':(isAdmin()&&s!=='Converti'?'<button class="btn sm primary" data-act="conv">Convertir</button>':''))+'<button class="btn sm" data-act="open">Profil</button></div></td></tr>'}).join('')+'</tbody></table></div>';
}
function leadCard(l){
  const s=l.status,tel=String(l.phone||'').replace(/[^\d+]/g,''),free=!l.owner&&l.setter_id,mine=canEditLead(l);
  let h='<article class="lead'+(l.setter_id?' fs':'')+'" data-id="'+esc(l.id)+'"><div class="lead-top"><div><h3><a class="open" data-act="open" style="cursor:pointer">'+esc(l.name||'(sans nom)')+'</a></h3><p class="meta">'+esc([l.city,l.dept?('('+l.dept+')'):'',l.veh?('≈ '+l.veh+' véhicules'):'',l.source].filter(Boolean).join(' · '))+(l.calls?' · '+l.calls+' appel'+(l.calls>1?'s':''):'')+'</p></div>'+pill(s)+'</div>';
  h+='<div class="phone"><a href="tel:'+esc(tel)+'">'+esc(fmtPhone(l.phone))+'</a><button class="btn sm" data-act="copy" data-v="'+esc(l.phone)+'">Copier</button>'+(l.phone2?'<span class="alt">Autre : '+esc(fmtPhone(l.phone2))+'</span>':'')+'</div>';
  h+=setterBox(l);
  if(free)return h+'<p style="margin:10px 0 0"><button class="btn primary" data-act="claim">Je m’assigne ce lead</button> <button class="btn sm" data-act="open">Ouvrir le profil</button></p></article>';
  if(!mine)return h+'<p style="margin:8px 0 0"><button class="btn sm" data-act="open">Ouvrir le profil</button></p></article>';
  h+='<div class="results">'+RES.map(r=>'<button class="res s'+sIdx(r)+'" data-act="res" data-v="'+esc(r)+'" aria-pressed="'+(s===r)+'">'+esc(r)+'</button>').join('')+'</div>';
  if(isCB(s))h+=cbRow(l);
  h+='<textarea data-act="note" placeholder="Notes : nom du gérant, ce qu’il a dit…">'+esc(l.notes||'')+'</textarea><p style="margin:8px 0 0">'+(isAdmin()&&s!=='Converti'?'<button class="btn sm" data-act="conv">Convertir en client</button> ':'')+'<button class="btn sm" data-act="open">Ouvrir le profil</button></p></article>';
  return h;
}
function planModal(){
  const l=S.leads.find(x=>x.id===S.planFor);if(!l)return '';
  return '<div class="ov" data-act="close"><div class="modal" data-id="'+esc(l.id)+'"><div class="hd"><h2>Convertir '+esc(l.name||'')+'</h2><button class="btn sm" data-act="close">Fermer</button></div>'+(vehOf(l)?'':'<p>Combien de véhicules a-t-il ?</p><div class="chips">'+['1','2+','future'].map(k=>'<button class="chip" data-act="pveh" data-v="'+k+'" aria-pressed="'+(S.planVeh===k)+'">'+VL[k]+'</button>').join('')+'</div>')+'<p>Quelle formule a-t-il prise ? (abonnement mensuel)</p><div class="plans">'+PLANS.map(p=>'<button class="btn plan" data-act="plan" data-v="'+p[0]+'"><b>'+p[1]+'</b><span>'+eur(p[2])+' / mois</span></button>').join('')+'</div></div></div>';
}
function setModal(){
  const f=['name:Nom du prospect','phone:Téléphone','city:Ville','contact:Nom du contact','veh:Nb véhicules'];
  return '<div class="ov" data-act="close"><div class="modal" id="adds"><div class="hd"><h2>Nouveau lead (démo acceptée)</h2><button class="btn sm" data-act="close">Fermer</button></div><p class="note">Ajoute un lead seulement quand le prospect a répondu <b>et accepté une démo</b>.</p><div class="fg">'+
   f.map(x=>{const[k,l]=x.split(':');return '<label class="fld">'+l+'<input data-k="'+k+'"></label>'}).join('')+
   '<label class="fld">Source (réseau)<select data-k="source">'+srcOpts('',true)+'</select></label><label class="fld">Type d’origine<select data-k="origin_type">'+orgOpts('',true)+'</select></label>'+
   '<label class="fld">Date et heure de la démo<input type="datetime-local" data-k="demo"></label><label class="fld">Heure saisie en<select data-k="zone">'+zoneOpts(myZone())+'</select></label></div>'+
   '<label class="fld">Récap de l’échange (lu par la démonstratrice avant d’appeler)<textarea data-k="recap" style="min-height:100px" placeholder="Ce qu’il a dit, son activité, ses besoins, son nombre de véhicules…"></textarea></label>'+
   '<p class="note">Si le client donne l’heure en heure française, choisis « France » : chaque démonstratrice la verra dans son propre fuseau, avec le nom du fuseau.</p><p style="margin:12px 0 0"><button class="btn primary" data-act="saveset">Ajouter le lead</button></p></div></div>';
}
function modal(){
  if(S.planFor)return planModal();
  if(S.addSet)return setModal();
  if(S.adding){
    const f=['name:Nom de l’agence','city:Ville','dept:Département','phone:Téléphone','phone2:Autre numéro','veh:Nb véhicules','contact:Nom du contact'];
    return '<div class="ov" data-act="close"><div class="modal" id="addf"><div class="hd"><h2>Nouveau prospect</h2><button class="btn sm" data-act="close">Fermer</button></div><div class="fg">'+f.map(x=>{const[k,l]=x.split(':');return '<label class="fld">'+l+'<input data-k="'+k+'"></label>'}).join('')+'<label class="fld">Source<select data-k="source">'+srcOpts('liste_abou')+'</select></label></div><label class="fld">Notes<textarea data-k="notes" placeholder="Notes…"></textarea></label><p style="margin:12px 0 0"><button class="btn primary" data-act="saveadd">Créer le profil</button></p></div></div>';
  }
  const l=S.leads.find(x=>x.id===S.open);if(!l)return '';
  const s=l.status,mine=canEditLead(l),free=!l.owner&&l.setter_id,pl=l.plan?planOf(l.plan):null;
  const F=[['name','Agence'],['contact','Contact / gérant'],['city','Ville'],['dept','Département'],['phone2','Autre numéro'],['veh','Nb véhicules'],['email','E-mail']];
  let h='<div class="ov" data-act="close"><div class="modal" data-id="'+esc(l.id)+'"><div class="hd"><div><h2>'+esc(l.name||'(sans nom)')+'</h2><p class="meta">'+pill(s)+(l.converted_at?' · converti le '+esc(dayStr(l.converted_at)):'')+(l.owner&&(isAdmin()||isSetter())?' · démo / suivi : '+esc(nameOf(l.owner)):'')+(pl?' · '+esc(pl[1])+' '+eur(l.amount)+'/mois':'')+'</p></div><button class="btn sm" data-act="close">Fermer</button></div>';
  h+='<div class="phone"><span class="num">'+esc(fmtPhone(l.phone))+'</span><button class="btn sm" data-act="copy" data-v="'+esc(l.phone)+'">Copier</button></div>';
  h+=setterBox(l);
  h+='<p class="note" style="margin:0 0 10px">Source : '+(isAdmin()?'<select data-act="lsrc">'+srcOpts(l.source||'liste_abou')+'</select>':'<b>'+esc(l.source||'liste_abou')+'</b>')+(l.setter_id||isAdmin()?' · Origine : '+(isAdmin()?'<select data-act="lorg"><option value="">—</option>'+orgOpts(l.origin_type||'')+'</select>':'<b>'+esc(l.origin_type||'—')+'</b>'):'')+'</p>';
  if(free)return h+'<p><button class="btn primary" data-act="claim">Je m’assigne ce lead</button></p></div></div>';
  if(mine){
    if(s==='Converti')h+=isAdmin()?'<p><button class="btn" data-act="res" data-v="Lead qualifié">Annuler la conversion</button></p>':'';
    else h+=(isAdmin()?'<p style="margin:0 0 12px"><button class="btn conv" data-act="conv">✔ Convertir en client</button></p>':'')+'<div class="results">'+RES.map(r=>'<button class="res s'+sIdx(r)+'" data-act="res" data-v="'+esc(r)+'" aria-pressed="'+(s===r)+'">'+esc(r)+'</button>').join('')+'</div>';
    if(isCB(s))h+=cbRow(l);
    h+='<div class="fg">'+F.map(([k,lb])=>'<label class="fld">'+lb+'<input data-act="fld" data-f="'+k+'" value="'+esc(l[k]||'')+'"></label>').join('')+'</div>';
    h+='<label class="fld">Notes<textarea data-act="note" style="min-height:90px" placeholder="Notes : ce qui a été dit, prochaine étape…">'+esc(l.notes||'')+'</textarea></label>';
  }else{
    h+='<div class="fg">'+F.map(([k,lb])=>'<div class="fld">'+lb+'<b style="color:var(--ink)">'+esc(l[k]||'—')+'</b></div>').join('')+'</div><div class="fld" style="margin-top:8px">Notes de la démonstratrice<p style="margin:0;color:var(--ink);white-space:pre-wrap">'+esc(l.notes||'—')+'</p></div>';
  }
  h+='<p class="note" style="margin-top:10px">'+(l.calls||0)+' appel(s)'+(l.last_call_at?' · dernier le '+esc(dayStr(l.last_call_at)):'')+(l.region?' · '+esc(l.region):'')+(l.src?' · Sources : '+esc(l.src):'')+(l.ver?' · Vérifié le '+esc(l.ver):'')+(l.demo_done_at?' · démo faite le '+esc(dayStr(l.demo_done_at)):'')+(l.demo_veh?' ('+esc(VL[l.demo_veh]||'')+')':'')+'</p></div></div>';
  return h;
}
/* ---------------- espace setter ---------------- */
function viewSetter(){
  const L=S.leads.filter(l=>l.setter_id===S.me.id).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))),r=rates(L);
  let h='<h2>Mon espace setter</h2><p class="sub">Ajoute un lead seulement quand il a répondu et accepté une démo. Ici tu vois où en est chacun de tes leads.</p>';
  h+='<div class="kpis">'+kpi(L.length,'Leads qualifiés ramenés')+kpi(r.d,'Démos faites','hot')+kpi(r.t,"Période d'essai")+kpi(r.c,'Convertis','hot')+kpi(pct(r.d,r.n),'% de démos faites')+kpi(pct(r.c,r.n),'% convertis')+'</div>';
  h+='<p><button class="btn primary" data-act="addset">+ Ajouter un lead</button></p>';
  h+='<div class="panel"><h3>Mes leads et leur étape</h3><div class="scroll"><table><thead><tr><th>Prospect</th><th>Source</th><th>Origine</th><th>Étape</th><th>Démo prévue</th><th>Démo faite par</th></tr></thead><tbody>'+
   (L.length?L.map(l=>'<tr data-id="'+esc(l.id)+'"><td><a class="open" data-act="open" style="cursor:pointer;font-weight:700">'+esc(l.name||'')+'</a><div class="sub2">'+esc(fmtPhone(l.phone))+'</div></td><td>'+esc(l.source)+'</td><td>'+esc(l.origin_type||'')+'</td><td>'+pill(l.status)+(isConv(l)?' <span class="note">'+(l.plan?esc(planOf(l.plan)[1]):'')+'</span>':'')+'</td><td>'+demoHtml(l)+'</td><td>'+(l.owner?esc(nameOf(l.owner)):'<span class="note">Pas encore pris</span>')+'</td></tr>').join(''):'<tr><td colspan="6" class="note">Aucun lead pour le moment.</td></tr>')+'</tbody></table></div></div>';
  h+='<div class="panel"><h3>Par canal (source)</h3>'+rateTable(grp(L,l=>l.source),'Canal',true)+'</div>';
  h+='<div class="panel"><h3>Par type d’origine</h3>'+rateTable(grp(L,l=>l.origin_type),'Origine',true)+TNOTE+'</div>';
  return h;
}
function viewSetters(){
  const SL=S.leads.filter(l=>l.setter_id),r=rates(SL);
  let h='<h2>Setters</h2><p class="sub">Performance des setters : leads qualifiés ramenés, démos obtenues, conversions, par canal et par origine.</p>';
  h+='<div class="kpis">'+kpi(SL.length,'Leads qualifiés ramenés')+kpi(r.d,'Démos faites','hot')+kpi(r.t,"Période d'essai")+kpi(r.c,'Convertis','hot')+kpi(pct(r.d,r.n),'% démos ÷ leads')+kpi(pct(r.c,r.n),'% convertis ÷ leads')+'</div>';
  const ch=grp(SL,l=>l.source).filter(g=>g[1].n>=1).slice().sort((a,b)=>(b[1].c/Math.max(1,b[1].n))-(a[1].c/Math.max(1,a[1].n))||b[1].n-a[1].n);
  if(ch.length)h+='<div class="panel"><b>Canal le plus pertinent : '+esc(ch[0][0])+'</b> — '+ch[0][1].c+' converti(s) sur '+ch[0][1].n+' lead(s) ('+pct(ch[0][1].c,ch[0][1].n)+').</div>';
  h+='<div class="panel"><h3>Par setter</h3>'+rateTable(grp(SL,l=>nameOf(l.setter_id)),'Setter',true)+TNOTE+'</div>';
  h+='<div class="panel"><h3>Par canal (source)</h3>'+rateTable(ch,'Canal',true)+'</div>';
  h+='<div class="panel"><h3>Par type d’origine</h3>'+rateTable(grp(SL,l=>l.origin_type),'Origine',true)+'</div>';
  h+='<div class="panel"><h3>Par mois (date d’ajout)</h3>'+rateTable(grp(SL,l=>monthOf(l.created_at)).sort((a,b)=>b[0].localeCompare(a[0])).map(g=>[monthLabel(g[0]),g[1]]),'Mois',true)+'</div>';
  return h;
}
/* ---------------- admin : conversion, abonnements, paramètres ---------------- */
function toCheck(m){return S.leads.filter(l=>isConv(l)?(monthOf(l.converted_at)<=m&&!(l.churned_month&&l.churned_month<=m)):(DEMO_ST.includes(l.status)||l.status===TR))}
const pendingCheck=m=>toCheck(m).filter(l=>!subOf(l.id,m));
const PCOLS=[['Démo planifiée','Démo planifiée'],['Démo terminée (1 véhicule)','Terminée 1 véh.'],['Démo terminée (+2 véhicules)','Terminée +2 véh.'],['Démo reussi (Lancement future)','Lancement future'],[TR,'Période d’essai'],['Converti','Converti'],['Abandonné','Abandonné']];
function pipeByPerson(){
  const P=members().map(p=>[p,S.leads.filter(l=>l.owner===p.id)]).filter(x=>x[1].length);
  const cell=(L,s)=>L.filter(l=>l.status===s).length;
  const tot=PCOLS.map(c=>'<td class="n"><b>'+cell(S.leads,c[0])+'</b></td>').join('');
  return '<div class="panel"><h3>Pipeline des démos par personne</h3><p class="note">Nombre de leads dans chaque statut, pour chaque démonstratrice. Clique sur un nom pour voir son tableau complet.</p><div class="scroll"><table><thead><tr><th>Nom</th>'+PCOLS.map(c=>'<th class="n">'+c[1]+'</th>').join('')+'</tr></thead><tbody>'+
   (P.length?P.map(([p,L])=>'<tr><td><a class="open" data-act="viewas" data-v="'+esc(p.id)+'" style="cursor:pointer;font-weight:700">'+esc(p.name||p.email)+'</a></td>'+PCOLS.map(c=>'<td class="n">'+cell(L,c[0])+'</td>').join('')+'</tr>').join('')+'<tr><td><b>Total</b></td>'+tot+'</tr>':'<tr><td colspan="8" class="note">Aucune donnée.</td></tr>')+'</tbody></table></div></div>';
}
function trialStat(L){const T=L.filter(isTrial),c=T.filter(isConv).length,ec=T.filter(l=>l.status===TR).length,lost=T.length-c-ec;return {n:T.length,ec,c,lost,t1:pct(c,T.length),t3:pct(c,c+lost)}}
function trialPanel(){
  const row=(k,L)=>{const r=trialStat(L);return '<tr><td>'+esc(k)+'</td><td class="n">'+r.n+'</td><td class="n">'+r.ec+'</td><td class="n">'+r.c+'</td><td class="n">'+r.lost+'</td><td class="n"><b>'+r.t1+'</b></td><td class="n">'+r.t3+'</td></tr>'};
  const P=members().map(p=>[p,S.leads.filter(l=>l.owner===p.id)]).filter(x=>x[1].some(isTrial));
  const mo=[...new Set(S.leads.filter(isTrial).map(l=>monthOf(l.trial_at||l.converted_at||l.updated_at)).filter(Boolean))].sort().reverse();
  const head=f=>'<div class="scroll"><table><thead><tr><th>'+f+'</th><th class="n">Entrés en essai</th><th class="n">Encore en essai</th><th class="n">Convertis</th><th class="n">Perdus après essai</th><th class="n">Taux essai → converti</th><th class="n">Sur essais terminés</th></tr></thead><tbody>';
  return '<div class="panel"><h3>Période d’essai → converti</h3><p class="note"><b>Taux essai → converti</b> = convertis ÷ tous ceux qui sont entrés en période d’essai. <b>Sur essais terminés</b> = convertis ÷ (convertis + perdus), sans compter ceux qui sont encore en essai. « Perdus » = sortis de l’essai sans convertir (abandonné ou archivé).</p>'+
   head('Global')+row('Global',S.leads)+'</tbody></table></div>'+
   head('Par personne')+(P.length?P.map(([p,L])=>row(p.name||p.email,L)).join(''):'<tr><td colspan="7" class="note">Aucune donnée.</td></tr>')+'</tbody></table></div>'+
   head('Par mois (entrée en essai)')+(mo.length?mo.map(m=>row(monthLabel(m),S.leads.filter(l=>isTrial(l)&&monthOf(l.trial_at||l.converted_at||l.updated_at)===m))).join(''):'<tr><td colspan="7" class="note">Aucune donnée.</td></tr>')+'</tbody></table></div></div>';
}
function viewStats(){
  const R=rates(S.leads),mrr=S.subs.filter(x=>x.month===curMonth()&&x.paid).reduce((a,x)=>a+(+x.amount||0),0);
  let h='<h2>Conversion</h2><p class="sub">Taux de conversion global, par mois, par personne et par source.</p>';
  h+='<div class="kpis">'+kpi(R.d,'Démos faites')+kpi(R.t,"Période d'essai")+kpi(R.c,'Convertis','hot')+kpi(R.t1,'Taux 1 · converti ÷ essai')+kpi(R.t2,'Taux 2 · converti ÷ démos')+kpi(eur(mrr),'Abonnements payés ce mois','hot')+'</div>'+TNOTE;
  h+=demoPanel(S.leads,'Global : démos par nombre de véhicules',true);
  h+=pipeByPerson()+trialPanel();
  const months=[...new Set(S.leads.filter(isDemo).map(demoMonth).filter(Boolean))].sort().reverse();
  h+='<div class="panel"><h3>Taux de conversion par mois</h3><p class="note">Chaque mois = les leads dont la démo date de ce mois.</p>'+rateTable([['Global',R]].concat(months.map(m=>[monthLabel(m),rates(S.leads.filter(l=>isDemo(l)&&demoMonth(l)===m))])),'Mois')+'</div>';
  const P=members().map(p=>[p,rates(S.leads.filter(l=>l.owner===p.id))]).filter(x=>x[1].n>0).sort((a,b)=>b[1].d-a[1].d);
  h+='<div class="panel"><h3>Par personne (démos et conversion)</h3><div class="scroll"><table><thead><tr><th>Nom</th><th class="n">Leads</th><th class="n">Démos faites</th>'+vehHead+'<th class="n">Essai</th><th class="n">Convertis</th><th class="n">Taux 1</th><th class="n">Taux 2</th></tr></thead><tbody>'+
   (P.length?P.map(([p,r])=>'<tr><td><b>'+esc(p.name||p.email)+'</b></td><td class="n">'+nf(r.n)+'</td><td class="n">'+r.d+'</td>'+vehCells(r)+'<td class="n">'+r.t+'</td><td class="n">'+r.c+'</td><td class="n">'+r.t1+'</td><td class="n">'+r.t2+'</td></tr>').join(''):'<tr><td colspan="9" class="note">Aucune donnée.</td></tr>')+'</tbody></table></div></div>';
  const rows=srcNames().map(n=>{const L=S.leads.filter(l=>(l.source||'liste_abou')===n),r=rates(L),cost=S.costs.filter(c=>c.source===n).reduce((a,c)=>a+(+c.amount||0),0),cv=L.filter(isConv),lt=cv.reduce((a,l)=>a+ltv(l),0);return {n,r,cost,avg:cv.length?lt/cv.length:0,ratio:r.d?r.c/r.d:0}}).filter(x=>x.r.n>0||x.cost>0).sort((a,b)=>b.ratio-a.ratio||b.r.c-a.r.c);
  h+='<div class="panel"><h3>Par source : meilleures sources d’acquisition</h3><div class="scroll"><table><thead><tr><th>Source</th>'+rateHead+'<th class="n">LTV moyen</th><th class="n">Coût total</th><th class="n">Coût par converti</th></tr></thead><tbody>'+
   (rows.length?rows.map((x,i)=>'<tr><td><b>'+(i===0&&x.r.c>0?'🏆 ':'')+esc(x.n)+'</b></td>'+rateCells(x.r)+'<td class="n">'+eur(x.avg)+'</td><td class="n">'+eur(x.cost)+'</td><td class="n">'+(x.r.c&&x.cost?eur(x.cost/x.r.c):'–')+'</td></tr>').join(''):'<tr><td colspan="10" class="note">Aucune donnée.</td></tr>')+'</tbody></table></div><p class="note">Classée par taux 2. Le coût se saisit dans « Paramètres ».</p></div>';
  return h;
}
function viewAbo(){
  const m=S.abMonth||(S.abMonth=curMonth()),C=toCheck(m),pend=C.filter(l=>!subOf(l.id,m));
  const paid=C.filter(l=>{const x=subOf(l.id,m);return isConv(l)&&x&&x.paid}),unp=C.filter(l=>{const x=subOf(l.id,m);return isConv(l)&&x&&!x.paid});
  const conv=S.leads.filter(isConv),churn=conv.filter(l=>l.churned_month),avg=conv.length?conv.reduce((a,l)=>a+ltv(l),0)/conv.length:0;
  const mrr=S.subs.filter(x=>x.month===m&&x.paid).reduce((a,x)=>a+(+x.amount||0),0);
  let h='<h2>Abonnements</h2><p class="sub">Vérifie chaque mois si les démos et les convertis ont bien un abonnement. Les abonnements sont mensuels : le LTV est le total encaissé par client.</p>';
  h+='<div class="row" style="margin-bottom:12px"><label class="fld">Mois à vérifier<input type="month" data-act="abm" value="'+esc(m)+'"></label></div>';
  h+='<div class="kpis">'+kpi(pend.length,'À vérifier ce mois','hot')+kpi(paid.length,'Payés')+kpi(unp.length,'Non payés')+kpi(eur(mrr),'Encaissé ce mois','hot')+kpi(eur(avg),'LTV moyen')+kpi(churn.length,'Désabonnés')+kpi(pct(churn.length,conv.length),'Taux de désabonnement')+'</div>';
  const row=l=>{
    const x=subOf(l.id,m),cv=isConv(l),chips=S.subs.filter(y=>y.lead_id===l.id).sort((a,b)=>a.month.localeCompare(b.month)).map(y=>'<span class="chip2 '+(y.paid?'ok':'ko')+'">'+esc(monthLabel(y.month))+' '+(y.paid?'✅':'❌')+'</span>').join(' ');
    return '<tr data-id="'+esc(l.id)+'"><td><a class="open" data-act="open" style="cursor:pointer;font-weight:700">'+esc(l.name||'')+'</a><div class="sub2">'+esc(l.owner?nameOf(l.owner):'—')+' · '+esc(l.source||'')+'</div></td><td>'+pill(l.status)+'</td>'+
     '<td>'+(cv?'<select data-act="aplan">'+PLANS.map(p=>'<option value="'+p[0]+'"'+(l.plan===p[0]?' selected':'')+'>'+p[1]+' '+eur(p[2])+'</option>').join('')+(l.plan?'':'<option value="" selected>—</option>')+'</select>':'<span class="note">—</span>')+'</td>'+
     '<td>'+(x?(x.paid?'✅ Payé':'❌ Non payé'):'<span class="note">À vérifier</span>')+'</td><td>'+chips+'</td><td class="n">'+eur(ltv(l))+'</td>'+
     '<td><div class="acts">'+(cv?'<button class="btn sm primary" data-act="paid">Payé</button><button class="btn sm" data-act="unpaid">Non payé</button><button class="btn sm" data-act="churn">Désabonné</button>':'<button class="btn sm primary" data-act="vyes">A pris un abonnement</button><button class="btn sm" data-act="vno">Pas d’abonnement</button>')+'</div></td></tr>';
  };
  h+='<div class="panel"><h3>À vérifier pour '+esc(monthLabel(m))+'</h3><div class="scroll"><table><thead><tr><th>Lead</th><th>Étape</th><th>Formule</th><th>Ce mois</th><th>Historique</th><th class="n">LTV</th><th></th></tr></thead><tbody>'+(C.length?C.sort((a,b)=>(subOf(a.id,m)?1:0)-(subOf(b.id,m)?1:0)).map(row).join(''):'<tr><td colspan="7" class="note">Rien à vérifier.</td></tr>')+'</tbody></table></div></div>';
  const CH=conv.filter(l=>l.churned_month);
  h+='<div class="panel"><h3>Désabonnés</h3><div class="scroll"><table><thead><tr><th>Lead</th><th>Arrêt depuis</th><th class="n">LTV</th><th></th></tr></thead><tbody>'+(CH.length?CH.map(l=>'<tr data-id="'+esc(l.id)+'"><td>'+esc(l.name||'')+'</td><td>'+esc(monthLabel(l.churned_month))+'</td><td class="n">'+eur(ltv(l))+'</td><td><button class="btn sm" data-act="unchurn">Réabonner</button></td></tr>').join(''):'<tr><td colspan="4" class="note">Aucun désabonnement.</td></tr>')+'</tbody></table></div></div>';
  return h;
}
function viewCfg(){
  const m=S.cfgMonth||(S.cfgMonth=curMonth());
  const list=(arr,kind)=>'<div class="scroll"><table><tbody>'+arr.map(x=>'<tr data-id="'+x.id+'"><td><input data-act="'+kind+'ren" value="'+esc(x.name)+'"></td><td><label><input type="checkbox" data-act="'+kind+'tog"'+(x.active?' checked':'')+'> actif</label></td></tr>').join('')+'</tbody></table></div><div class="row" style="margin-top:8px"><input id="new'+kind+'" placeholder="Nouveau nom…"><button class="btn primary" data-act="'+kind+'add">Ajouter</button></div>';
  let h='<h2>Paramètres</h2><p class="sub">Sources, types d’origine et coûts. Renommer une source ou une origine la modifie dans tous les leads.</p>';
  h+='<div class="grid2"><div class="panel"><h3>Sources</h3>'+list(S.sources,'src')+'<p class="note">Les démonstratrices et les setters choisissent dans cette liste. Après création, seule l’admin peut changer la source d’un lead.</p></div><div class="panel"><h3>Types d’origine</h3>'+list(S.origins,'org')+'</div></div>';
  h+='<div class="panel"><h3>Coût par source</h3><label class="fld" style="max-width:200px">Mois<input type="month" data-act="cfgm" value="'+esc(m)+'"></label><div class="scroll"><table><thead><tr><th>Source</th><th>Coût du mois (€)</th></tr></thead><tbody>'+S.sources.map(x=>{const c=S.costs.find(y=>y.source===x.name&&y.month===m);return '<tr><td>'+esc(x.name)+'</td><td><input type="number" min="0" step="0.01" data-act="cost" data-s="'+esc(x.name)+'" value="'+(c?c.amount:'')+'" placeholder="0"></td></tr>'}).join('')+'</tbody></table></div></div>';
  return h;
}
/* ---------------- vues : administration ---------------- */
function viewOver(){
  const M=members().map(p=>memberStats(p.id));
  const assigned=M.reduce((a,m)=>a+m.n,0);
  const cToday=M.reduce((a,m)=>a+m.calledToday,0),c7=M.reduce((a,m)=>a+m.called7,0);
  const sc=countBy(S.leads,x=>x.status),pool=poolList(),mx=Math.max(1,...ST.map(s=>sc[s]||0));
  let h='<h2>Vue d’ensemble</h2><p class="sub">Toute l’équipe, mise à jour toutes les 30 secondes.</p>';
  h+='<div class="kpis">'+kpi(S.leads.length,'Numéros au total')+kpi(pool.length,'Non attribués')+kpi(assigned,'Attribués')+kpi(cToday,"Appels aujourd'hui")+kpi(c7,'Appels sur 7 jours')+kpi(sc['Lead qualifié']||0,'Lead qualifié','hot')+kpi(sc['Démo planifiée']||0,'Démo planifiée','hot')+kpi(sc['Converti']||0,'Converti','hot')+'</div>';
  const pc=pendingCheck(curMonth()).length;
  if(pc)h+='<div class="panel remind"><b>Rappel du mois :</b> '+pc+' lead(s) à vérifier pour '+esc(monthLabel(curMonth()))+' (abonnement pris ou non). <button class="btn sm primary" data-act="tab" data-v="abo">Vérifier maintenant</button></div>';
  const RR=rates(S.leads);h+='<div class="kpis">'+kpi(RR.d,'Démos faites')+kpi(RR.t,"Période d'essai")+kpi(RR.t1,'Taux 1 · converti ÷ essai')+kpi(RR.t2,'Taux 2 · converti ÷ démos')+'</div>';
  h+='<div class="grid2"><div class="panel"><h3>Appels par jour (14 jours)</h3>'+dayChart(last14(S.calls))+'</div>';
  h+='<div class="panel"><h3>Où en sont les leads</h3><div class="scroll"><table><tbody>'+ST.map(s=>'<tr><td>'+pill(s)+'</td><td class="n">'+nf(sc[s]||0)+'</td><td style="width:30%"><div class="bar"><i style="width:'+Math.round((sc[s]||0)/mx*100)+'%"></i></div></td></tr>').join('')+'</tbody></table></div></div></div>';
  const tot={};ST.forEach(s=>tot[s]=M.reduce((a,m)=>a+(m.c[s]||0),0));
  h+='<div class="panel"><h3>Par collaboratrice</h3><div class="scroll"><table><thead><tr><th>Nom</th><th class="n">Numéros</th><th class="n">Aujourd’hui</th><th class="n">7 jours</th>'+ST.map(s=>'<th class="n">'+esc(s)+'</th>').join('')+'</tr></thead><tbody>'+
   (M.length?M.sort((a,b)=>b.calledToday-a.calledToday||b.called7-a.called7).map(m=>'<tr><td><button class="btn sm" data-act="viewas" data-v="'+esc(m.u)+'"><b>'+esc(nameOf(m.u))+'</b> · voir</button></td><td class="n">'+nf(m.n)+'</td><td class="n">'+m.calledToday+'</td><td class="n">'+m.called7+'</td>'+ST.map(s=>'<td class="n">'+(m.c[s]||0)+'</td>').join('')+'</tr>').join('')+
   '<tr class="total"><td>Total</td><td class="n">'+nf(assigned)+'</td><td class="n">'+cToday+'</td><td class="n">'+c7+'</td>'+ST.map(s=>'<td class="n">'+tot[s]+'</td>').join('')+'</tr>':'<tr><td colspan="'+(ST.length+4)+'" class="note">Personne n’est encore actif.</td></tr>')+'</tbody></table></div></div>';
  const reg={};S.leads.forEach(x=>{const r=x.region||'—';const o=reg[r]||(reg[r]={n:0,t:0,q:0,d:0,g:0});o.n++;if(x.calls>0)o.t++;if(x.status==='Lead qualifié')o.q++;if(x.status==='Démo planifiée')o.d++;if(x.status==='Converti')o.g++});
  const R=Object.entries(reg).sort((a,b)=>b[1].g-a[1].g||b[1].q-a[1].q||b[1].n-a[1].n);
  h+='<div class="panel"><h3>Par région</h3><div class="scroll"><table><thead><tr><th>Région</th><th class="n">Numéros</th><th class="n">Déjà appelés</th><th class="n">Lead qualifié</th><th class="n">Démo planifiée</th><th class="n">Converti</th></tr></thead><tbody>'+
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
   '<td><select data-act="role"'+(p.id===S.me.id?' disabled':'')+'>'+[['pending','En attente'],['agent','Collaboratrice'],['setter','Setter'],['admin','Admin']].map(([k,l])=>'<option value="'+k+'"'+(p.role===k?' selected':'')+'>'+l+'</option>').join('')+'</select></td>'+
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
  return '<label class="fld" style="max-width:260px;margin-bottom:8px">Source de ces numéros<select data-act="impsrc">'+srcOpts(S.impSrc||'liste_abou')+'</select></label><p style="margin:0 0 8px"><b>'+nf(i.items.length)+'</b> numéros lus · <b>'+nf(i.fresh.length)+'</b> nouveaux pour toi · '+nf(i.items.length-i.fresh.length)+' déjà dans ta liste</p><button class="btn primary" data-act="doimport"'+(S.busy||!i.items.length?' disabled':'')+'>Importer</button><p class="note" style="margin-top:6px">Les numéros qui existent déjà ailleurs dans le CRM sont automatiquement ignorés (pas de doublon).</p>';
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
  h+='<div class="panel scroll" style="padding:6px 10px"><table><thead><tr><th>Agence</th><th>Ville</th><th>Dépt</th><th>Région</th><th>Téléphone</th><th>Statut</th><th>Source</th><th>Attribué à</th></tr></thead><tbody>'+
   (V.length?V.slice(0,S.alim).map(x=>'<tr><td><a class="open" data-act="open" data-id="'+esc(x.id)+'" style="cursor:pointer;font-weight:700">'+esc(x.name)+'</a></td><td>'+esc(x.city)+'</td><td>'+esc(x.dept)+'</td><td>'+esc(x.region)+'</td><td>'+esc(fmtPhone(x.phone))+'</td><td>'+pill(x.status)+'</td><td>'+esc(x.source||'')+'</td><td>'+(x.owner?esc(nameOf(x.owner)):'<span class="note">—</span>')+'</td></tr>').join(''):'<tr><td colspan="8" class="note">Aucun numéro.</td></tr>')+'</tbody></table></div>';
  h+='<p class="note">'+nf(Math.min(V.length,S.alim))+' affichés sur '+nf(V.length)+'.'+(V.length>S.alim?' <button class="btn sm" data-act="alim">Afficher 200 de plus</button>':'')+'</p>';
  return h;
}
function render(){
  S.dirty=false;
  if(!S.me)return;
  const A=isAdmin(),SE=isSetter();
  const tabs=A?[['over',"Vue d'ensemble"],['stats','Conversion'],['setters','Setters'],['abo','Abonnements'],['cfg','Paramètres'],['team','Équipe'],['all','Numéros'],['mine','Mes appels']]:SE?[['set','Mon espace setter'],['mine','Pipeline démos']]:[['mine','Mes appels']];
  const z=myZone();
  let h='<header class="top"><div class="brand"><div class="logo">B</div>Boboloc · CRM</div><div class="who"><label class="tzl" title="Fuseau horaire utilisé pour afficher les heures de démo">Mon heure : <select data-act="tz">'+zoneOpts(z)+'</select></label><span class="badge">'+(A?'Admin':SE?'Setter':'Collaboratrice')+'</span><span class="nm">'+esc(S.me.name||S.me.email)+'</span><button class="btn sm" data-act="logout">Quitter</button></div></header>';
  if(tabs.length>1)h+='<nav class="tabs">'+tabs.map(([k,l])=>'<button data-act="tab" data-v="'+k+'" aria-selected="'+(S.view===k)+'">'+l+'</button>').join('')+'</nav>';
  if(S.err)h+='<p class="err">'+esc(S.err)+'</p>';
  const V={over:viewOver,team:viewTeam,all:viewAll,stats:viewStats,setters:viewSetters,abo:viewAbo,cfg:viewCfg,set:viewSetter};
  h+=(V[S.view]||viewMine)();
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
  const rows=S.imp.items.map(x=>({...x,owner,source:S.impSrc||'liste_abou'}));
  let added=0;
  await runChunks(rows,'Import',300,async part=>{
    const {data,error}=await S.sb.from('leads').upsert(part,{onConflict:'phone_key',ignoreDuplicates:true}).select('id');
    if(error)throw error;added+=data.length;
  });
  toast(nf(added)+' numéros ajoutés, '+nf(rows.length-added)+' ignorés (déjà dans le CRM)');
  S.imp=null;render();
}
function exportCsv(){
  const cols=['region','dept','city','name','phone','phone2','status','callback_at','calls','notes','veh','src','ver','source'];
  const head=['Région','Département','Ville','Agence','Téléphone','Autre numéro','Statut','Rappel le','Nb appels','Notes','Véhicules','Sources','Vérifié le','Source du lead','Attribué à'];
  const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  const csv='﻿'+[head.map(q).join(';')].concat(S.leads.map(r=>cols.map(c=>q(r[c])).concat(q(r.owner?nameOf(r.owner):'')).join(';'))).join('\r\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='boboloc_crm_'+today()+'.csv';document.body.appendChild(a);a.click();a.remove();
}

async function aboSet(id,paid){
  const l=S.leads.find(x=>x.id===id);if(!l)return;
  if(paid&&!l.plan){toast('Choisis d’abord la formule');return}
  if(await setSub(l,S.abMonth,paid,l.plan)){render();toast(paid?'Payé pour '+monthLabel(S.abMonth):'Non payé pour '+monthLabel(S.abMonth))}
}
async function addCfg(kind){
  const inp=$('new'+kind),v=inp&&inp.value.trim();if(!v)return;
  const tbl=kind==='src'?'sources':'origin_types';
  const {data,error}=await S.sb.from(tbl).insert({name:v}).select().single();
  if(error){toast(error.code==='23505'?'Ce nom existe déjà':'Erreur');return}
  (kind==='src'?S.sources:S.origins).push(data);render();toast('Ajouté');
}
async function renameCfg(kind,id,val){
  val=val.trim();const arr=kind==='src'?S.sources:S.origins,tbl=kind==='src'?'sources':'origin_types',x=arr.find(y=>String(y.id)===String(id));
  if(!x||!val||val===x.name){render();return}
  const old=x.name,col=kind==='src'?'source':'origin_type';
  const {error}=await S.sb.from(tbl).update({name:val}).eq('id',x.id);
  if(error){toast(error.code==='23505'?'Ce nom existe déjà':'Erreur');render();return}
  await S.sb.from('leads').update({[col]:val}).eq(col,old);
  if(kind==='src'){await S.sb.from('source_costs').update({source:val}).eq('source',old);S.costs.forEach(c=>{if(c.source===old)c.source=val})}
  x.name=val;S.leads.forEach(l=>{if(l[col]===old)l[col]=val});render();toast('Renommé dans tous les leads');
}
async function toggleCfg(kind,id,on){
  const arr=kind==='src'?S.sources:S.origins,x=arr.find(y=>String(y.id)===String(id));if(!x)return;
  const {error}=await S.sb.from(kind==='src'?'sources':'origin_types').update({active:on}).eq('id',x.id);
  if(error){toast('Erreur');return}x.active=on;toast(on?'Activé':'Désactivé (reste dans les anciens leads)');
}
async function saveCost(src,val){
  const m=S.cfgMonth||curMonth(),amount=+val||0;
  const {error}=await S.sb.from('source_costs').upsert({source:src,month:m,amount},{onConflict:'source,month'});
  if(error){toast('Erreur');return}
  const i=S.costs.findIndex(c=>c.source===src&&c.month===m);if(i>=0)S.costs[i].amount=amount;else S.costs.push({source:src,month:m,amount});toast('Coût enregistré');
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
  else if(a==='notif'){try{Notification.requestPermission().then(()=>render())}catch(e){toast('Alertes non disponibles sur cet appareil')}}
  else if(a==='open'&&id){S.open=id;render()}
  else if(a==='close'){S.open=null;S.adding=false;S.planFor=null;S.planVeh='';S.addSet=false;render()}
  else if(a==='addset'){S.addSet=true;render()}
  else if(a==='saveset'){const f={};document.querySelectorAll('#adds [data-k]').forEach(i=>f[i.dataset.k]=i.value);addSetterLead(f)}
  else if(a==='claim'&&id)claim(id);
  else if(a==='pveh'){S.planVeh=v;render()}
  else if(a==='plan'&&S.planFor){const pid=S.planFor,pv=S.planVeh;S.planFor=null;S.planVeh='';setStatus(pid,'Converti',Object.assign({plan:v,amount:planOf(v)[2]},pv?{demo_veh:pv}:{}))}
  else if(a==='paid'&&id)aboSet(id,true);
  else if(a==='unpaid'&&id)aboSet(id,false);
  else if(a==='vyes'&&id){S.planFor=id;render()}
  else if(a==='vno'&&id){const l=S.leads.find(x=>x.id===id);setSub(l,S.abMonth,false,null).then(()=>render())}
  else if(a==='churn'&&id){saveField(id,{churned_month:S.abMonth});render();toast('Marqué désabonné à partir de '+monthLabel(S.abMonth))}
  else if(a==='unchurn'&&id){saveField(id,{churned_month:null});render();toast('Réabonné')}
  else if(a==='srcadd'||a==='orgadd')addCfg(a==='srcadd'?'src':'org');
  else if(a==='add'){S.adding=true;render()}
  else if(a==='saveadd'){const f={};document.querySelectorAll('#addf [data-k]').forEach(i=>f[i.dataset.k]=i.value);addProspect(f)}
  else if(a==='res'&&id)requestStatus(id,v);
  else if(a==='conv'&&id)requestStatus(id,'Converti');
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
  else if(a==='st'&&id){requestStatus(id,t.value);render()}
  else if(a==='tz'){try{localStorage.setItem('bb_tz',t.value)}catch(e){}render()}
  else if(a==='abm'){S.abMonth=t.value||curMonth();render()}
  else if(a==='cfgm'){S.cfgMonth=t.value||curMonth();render()}
  else if(a==='impsrc'){S.impSrc=t.value}
  else if(a==='lsrc'&&id){saveField(id,{source:t.value});toast('Source modifiée')}
  else if(a==='lorg'&&id){saveField(id,{origin_type:t.value||null});toast('Origine modifiée')}
  else if(a==='aplan'&&id){const l=S.leads.find(x=>x.id===id),pl=planOf(t.value);if(l&&pl){await saveField(id,{plan:t.value,amount:pl[2]});const x=subOf(id,S.abMonth);if(x&&x.paid)await setSub(l,S.abMonth,true,t.value);render();toast('Formule modifiée')}}
  else if(a==='srcren'||a==='orgren')renameCfg(a==='srcren'?'src':'org',id,t.value);
  else if(a==='srctog'||a==='orgtog')toggleCfg(a==='srctog'?'src':'org',id,t.checked);
  else if(a==='cost')saveCost(t.dataset.s,t.value);
  else if(a==='fld'&&id)saveField(id,{[t.dataset.f]:t.value.trim()});
  else if(a==='cbt'&&id){const row=t.closest('.cbrow'),dt=row.querySelector('input').value,z=row.querySelector('select').value,iso=dt?zonedToUtc(dt,z):null,l0=S.leads.find(x=>x.id===id);saveField(id,{callback_ts:iso,callback_zone:iso?z:null,callback_at:iso?dayStr(iso):(l0&&l0.callback_at)||null});render()}
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
app.addEventListener('drop',e=>{const c=e.target.closest&&e.target.closest('.col');if(!c)return;e.preventDefault();c.classList.remove('over');const id=e.dataTransfer.getData('text/plain'),l=S.leads.find(x=>x.id===id);if(l&&l.status!==c.dataset.col)requestStatus(id,c.dataset.col)});

start().catch(e=>gate('<div class="auth"><div class="panel"><h2>Erreur au démarrage</h2><p class="sub">'+esc(msgErr(e))+'</p></div></div>'));
})();
