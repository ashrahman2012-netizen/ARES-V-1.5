
const ARES={raw:[],obs:[],activities:[],contactEvents:[],selected:null,fileName:""};
const APP_NAMES={"com.apple.mobilephone":"Phone","net.whatsapp.WhatsApp":"WhatsApp","com.apple.facetime":"FaceTime","imoimiphone":"imo","com.burbn.instagram":"Instagram","com.apple.MobileSMS":"Messages","com.apple.camera":"Camera","com.apple.mobileslideshow":"Photos","com.apple.mobilesafari":"Safari","com.google.ios.youtube":"YouTube","com.videobrowser.ios":"Video Browser","com.google.GoogleMobile":"Google","com.apple.MobileAddressBook":"Contacts","com.openai.chat":"ChatGPT"};
const fmtTime=d=>new Date(d).toLocaleTimeString("en-GB",{hour12:false});
const fmtDate=d=>new Date(d).toLocaleDateString("en-GB");
const sec=(a,b)=>(new Date(b)-new Date(a))/1000;
const overlap=(a,b)=>Math.max(0,(Math.min(+new Date(a.end),+new Date(b.end))-Math.max(+new Date(a.start),+new Date(b.start)))/1000);
const appName=id=>APP_NAMES[id]||id?.split(".").slice(-2).join(".")||"Unknown";
const durText=s=>{s=Math.max(0,Math.round(s));let h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return h?`${h}h ${m}m ${x}s`:`${m}m ${x}s`};
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

function parseNDJSON(text){const rows=[];text.split(/\r?\n/).forEach((line,i)=>{if(!line.trim())return;try{let r=JSON.parse(line);r.__line=i+1;rows.push(r)}catch(e){}});return rows}
function buildObservations(raw){
 const starts=new Map(),out=[];
 for(const r of raw){
  if(r.type==="access"){
   const app=appName(r.accessor?.identifier);
   if(r.kind==="intervalBegin")starts.set(r.identifier,r);
   else if(r.kind==="intervalEnd"&&starts.has(r.identifier)){
    const st=starts.get(r.identifier);starts.delete(r.identifier);
    out.push({id:`OBS-${out.length+1}`,kind:"access",app,bundle:st.accessor?.identifier,resource:st.category,start:st.timeStamp,end:r.timeStamp,duration:sec(st.timeStamp,r.timeStamp),line:[st.__line,r.__line],evidence:"Recorded",raw:[st,r]})
   }
  }else if(r.type==="networkActivity"){
   const t=r.firstTimeStamp||r.timeStamp;
   out.push({id:`OBS-${out.length+1}`,kind:"network",app:appName(r.bundleID),bundle:r.bundleID,resource:"network",start:t,end:r.timeStamp||t,duration:Math.max(0,sec(t,r.timeStamp||t)),domain:r.domain||"",context:r.context||"",hits:r.hits||1,line:[r.__line],evidence:"Recorded",raw:[r]})
  }
 }return out.sort((a,b)=>new Date(a.start)-new Date(b.start))
}
function involvementFor(o){if(o.kind==="network")return 15;if(o.resource==="contacts")return 20;if(o.resource==="photos")return o.duration>=120?60:35;if(o.resource==="location")return 20;if(o.resource==="microphone")return o.duration>60?90:45;if(o.resource==="camera")return o.duration>60?90:55;return 25}
function classifyActivities(obs){
 const primary=[],byApp={};for(const o of obs)(byApp[o.app]??=[]).push(o);
 for(const [app,arr] of Object.entries(byApp)){
  const mics=arr.filter(x=>x.resource==="microphone"&&x.duration>60),cams=arr.filter(x=>x.resource==="camera");
  for(const m of mics){
   const camOverlap=cams.reduce((n,c)=>n+overlap(m,c),0);let type="Voice / Audio",label=`Likely ${app} sustained audio interaction`,score=90;
   if(app==="Phone"){type="Voice Call";label="Likely cellular/Wi‑Fi phone call";score=94}
   else if(app==="FaceTime"&&camOverlap>=10){type="Video Call";label="Likely FaceTime video call";score=98}
   else if(app==="FaceTime"){type="Voice Call";label="Likely FaceTime audio call";score=94}
   else if(camOverlap>=10){type="Video Call";label=`Likely ${app} video call`;score=98}
   else if(app==="Messages"){type="Audio Recording";label="Likely Messages audio recording / voice interaction";score=82}
   primary.push({app,start:m.start,end:m.end,duration:m.duration,type,label,userScore:score,evidence:"Inferred",primary:[m.id],support:[],network:[],alternatives:app==="Phone"?["voicemail/audio feature"]:["voice note or other audio feature"],rationale:`Sustained microphone ${durText(m.duration)}${camOverlap>=10?`; camera overlap ${Math.round(camOverlap)}s`:""}`})
  }
 }
 for(const o of obs.filter(x=>x.resource==="camera"&&x.duration>60&&x.duration<=1800)){
  const already=primary.some(a=>a.app===o.app&&overlap(a,o)>=0.8*o.duration);
  if(!already)primary.push({app:o.app,start:o.start,end:o.end,duration:o.duration,type:"Camera Use",label:`${o.app} camera interaction`,userScore:92,evidence:"Correlated",primary:[o.id],support:[],network:[],alternatives:[],rationale:`Sustained camera access ${durText(o.duration)}`})
 }
 for(const [app,arr] of Object.entries(byApp)){
  const ph=arr.filter(x=>x.resource==="photos"&&x.duration>60);if(!ph.length)continue;
  const threshold=Math.max(120,2*Math.min(...ph.map(x=>x.duration)));
  for(const o of ph.filter(x=>x.duration>=threshold)){
   const already=primary.some(a=>a.app===app&&overlap(a,o)>=0.8*o.duration);
   if(!already)primary.push({app,start:o.start,end:o.end,duration:o.duration,type:"Media / Photos",label:`Significant ${app} photo-library interaction`,userScore:67,evidence:"Correlated",primary:[o.id],support:[],network:[],alternatives:["media browsing without sending"],rationale:`Photos access ${durText(o.duration)} exceeded significance threshold ${Math.round(threshold)}s`})
  }
 }
 for(const app of ["Safari","YouTube","Video Browser","Google"]){
  const nets=(byApp[app]||[]).filter(x=>x.kind==="network").sort((a,b)=>new Date(a.start)-new Date(b.start));let cl=[];
  const flush=()=>{if(cl.length>=2){const st=cl[0].start,en=cl[cl.length-1].start,d=sec(st,en);if(d>60&&d<=7200){const contexts=cl.map(x=>x.context||x.domain).filter(Boolean),youtube=contexts.some(x=>/youtube|googlevideo/i.test(x)),ctx=youtube?"YouTube":(contexts[0]||"Web");primary.push({app,start:st,end:en,duration:d,type:youtube?"Video Streaming":"Web / Online",label:youtube?"Probable YouTube/video streaming session":`Probable ${ctx} browsing session`,userScore:youtube?72:62,evidence:"Inferred",primary:cl.map(x=>x.id),support:[],network:cl.map(x=>x.id),alternatives:["background browser/network activity"],rationale:`${cl.length} related network observations clustered within 5-minute gaps`})}}cl=[]};
  for(const n of nets){if(!cl.length||sec(cl[cl.length-1].start,n.start)<=300)cl.push(n);else{flush();cl=[n]}}flush()
 }
 for(const a of primary){
  const near=(byApp[a.app]||[]).filter(o=>!a.primary.includes(o.id)&&new Date(o.start)<=new Date(+new Date(a.end)+90000)&&new Date(o.end)>=new Date(+new Date(a.start)-90000));
  for(const o of near){if(o.kind==="network")a.network.push(o.id);else if(["contacts","photos","location","camera"].includes(o.resource))a.support.push(o.id)}
 }
 primary.sort((a,b)=>new Date(a.start)-new Date(b.start));const merged=[];
 const fam=x=>["Voice Call","Video Call","Voice / Audio","Audio Recording"].includes(x.type)?"comm":x.type;
 for(const a of primary){
  const prev=merged[merged.length-1];
  if(prev&&prev.app===a.app&&fam(prev)==="comm"&&fam(a)==="comm"&&sec(prev.end,a.start)<=60){
   prev.end=new Date(Math.max(+new Date(prev.end),+new Date(a.end))).toISOString();prev.duration=sec(prev.start,prev.end);prev.primary.push(...a.primary);prev.support.push(...a.support);prev.network.push(...a.network);
   if(prev.type!==a.type){prev.type="Communication Sequence";prev.label=`${a.app} communication sequence with voice/video mode changes`;prev.userScore=Math.max(prev.userScore,a.userScore)}
   prev.rationale+="; merged adjacent communication segment";
  }else merged.push({...a})
 }
 return merged.map((a,i)=>({...a,id:`ACT-${String(i+1).padStart(4,"0")}`}))
}

function detectContactManagementEvents(obs,activities){
 const contacts=obs.filter(o=>o.resource==="contacts").sort((a,b)=>new Date(a.start)-new Date(b.start));
 if(!contacts.length)return [];

 // App-specific contact-duration baseline; unusually long access is a candidate signal.
 const byApp={};for(const o of contacts)(byApp[o.app]??=[]).push(o.duration);
 const threshold={};
 for(const [app,vals] of Object.entries(byApp)){
   const s=[...vals].sort((a,b)=>a-b);
   const med=s[Math.floor(s.length/2)]||0;
   const p90=s[Math.min(s.length-1,Math.floor(s.length*.90))]||med;
   threshold[app]=Math.max(75,p90,med*2);
 }

 const directApps=new Set(["Phone","Contacts","FaceTime","Messages"]);
 const systemTokens=/preferences|settings|springboard|contact|addressbook|callservices|telephony/i;
 const candidates=[];

 for(const c of contacts){
   const t0=+new Date(c.start), t1=+new Date(c.end);
   const direct=directApps.has(c.app) || activities.some(a=>directApps.has(a.app)&&Math.abs(+new Date(a.start)-t0)<=120000);
   const unusual=c.duration>=threshold[c.app];

   // APR often does not expose Settings itself. We look only for recorded system-like observations nearby.
   const transitionObs=obs.filter(o=>{
     const ot=+new Date(o.start);
     return Math.abs(ot-t0)<=180000 && (systemTokens.test(o.bundle||"")||systemTokens.test(o.domain||"")||systemTokens.test(o.context||""));
   });
   const transition=transitionObs.length>0;

   // Behavioural transition: compare direct communication/contact activity 30 min before vs after.
   const before=activities.filter(a=>directApps.has(a.app)&&+new Date(a.start)>=t0-1800000&&+new Date(a.start)<t0);
   const after=activities.filter(a=>directApps.has(a.app)&&+new Date(a.start)>t1&&+new Date(a.start)<=t1+1800000);
   const beforeContacts=contacts.filter(x=>+new Date(x.start)>=t0-1800000&&+new Date(x.start)<t0).length;
   const afterContacts=contacts.filter(x=>+new Date(x.start)>t1&&+new Date(x.start)<=t1+1800000).length;
   const behaviourChange=Math.abs(after.length-before.length)>=2 || Math.abs(afterContacts-beforeContacts)>=3;

   const components=[direct,unusual,transition,behaviourChange];
   const met=components.filter(Boolean).length;
   if(met<2)continue;

   let score=(direct?25:0)+(unusual?25:0)+(transition?25:0)+(behaviourChange?25:0);
   let level=score>=75?"Strong candidate":score>=50?"Potential":"Weak";
   let blockLevel=(transition&&behaviourChange&&direct&&unusual)?"Possible Block/Unblock Candidate":"Potential Contact-Management Event";

   candidates.push({
     id:`CME-${String(candidates.length+1).padStart(4,"0")}`,
     start:c.start,end:c.end,app:c.app,duration:c.duration,score,level,classification:blockLevel,
     components:{directPhoneContactsActivity:direct,unusualContactsAccess:unusual,possibleSettingsSystemTransition:transition,subsequentBehaviourChange:behaviourChange},
     baselineThresholdSeconds:Math.round(threshold[c.app]),
     evidence:[c.id,...transitionObs.map(x=>x.id)],
     before:{directActivityItems:before.length,contactsObservations:beforeContacts},
     after:{directActivityItems:after.length,contactsObservations:afterContacts},
     interpretation:"Candidate state-change window only. APR does not identify the contact, action, or prove blocking/unblocking.",
     alternatives:["contact lookup/name resolution","contact synchronisation","recipient selection","ordinary Phone/Messages/FaceTime workflow"]
   });
 }
 // avoid floods: keep strongest candidate per 5-minute window
 candidates.sort((a,b)=>new Date(a.start)-new Date(b.start)||b.score-a.score);
 const out=[];
 for(const c of candidates){
   const prior=out[out.length-1];
   if(prior && (+new Date(c.start)-+new Date(prior.start))<=300000){
     if(c.score>prior.score)out[out.length-1]=c;
   }else out.push(c);
 }
 return out;
}

function involvementLabel(score){return score>=95?"Very High":score>=80?"High":score>=55?"Moderate":"Low"}
function filters(){return{date:dateFilter.value,app:appFilter.value,inv:involvementFilter.value,q:search.value.toLowerCase()}}
function filteredActivities(){const f=filters();return ARES.activities.filter(a=>(!f.date||fmtDate(a.start)===f.date)&&(!f.app||a.app===f.app)&&(!f.inv||involvementLabel(a.userScore)===f.inv)&&(!f.q||JSON.stringify(a).toLowerCase().includes(f.q)))}
function table(headers,rows){return `<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`}
function render(){
 const acts=filteredActivities(),appDur={};acts.forEach(a=>appDur[a.app]=(appDur[a.app]||0)+a.duration);
 cards.innerHTML=[["Primary user activities",acts.length],["Very high involvement",acts.filter(a=>a.userScore>=95).length],["Communication",acts.filter(a=>/Call|Voice|Communication|Audio/.test(a.type)).length],["Apps represented",new Set(acts.map(a=>a.app)).size]].map(x=>`<div class=card><div class=small>${x[0]}</div><div class=n>${x[1]}</div></div>`).join("");
 const top=[...acts].sort((a,b)=>b.duration-a.duration).slice(0,12);
 headline.innerHTML=table(["Date","Time","App","Activity","Duration","User involvement"],top.map(a=>`<tr class=activityRow data-id="${a.id}"><td>${fmtDate(a.start)}</td><td>${fmtTime(a.start)}–${fmtTime(a.end)}</td><td>${esc(a.app)}</td><td>${esc(a.label)}</td><td>${durText(a.duration)}</td><td><span class="badge ${involvementLabel(a.userScore).toLowerCase().replace(" ","")}">${involvementLabel(a.userScore)}</span></td></tr>`));
 activityTable.innerHTML=table(["Date","Start–End","App","Type","Outcome","Duration","User score","Evidence","Support"],acts.map(a=>`<tr class=activityRow data-id="${a.id}"><td>${fmtDate(a.start)}</td><td>${fmtTime(a.start)}–${fmtTime(a.end)}</td><td>${esc(a.app)}</td><td>${esc(a.type)}</td><td>${esc(a.label)}</td><td>${durText(a.duration)}</td><td class=score>${a.userScore}/100<div class=progress><span style="width:${a.userScore}%"></span></div></td><td class="${a.evidence.toLowerCase()}">${a.evidence}</td><td>${a.support.length} resource + ${a.network.length} network</td></tr>`));
 const f=filters(),obs=ARES.obs.filter(o=>(!f.date||fmtDate(o.start)===f.date)&&(!f.app||o.app===f.app)&&(!f.q||JSON.stringify(o).toLowerCase().includes(f.q))).slice(0,2500);
 observationTable.innerHTML=table(["Date","Time","App","Observation","Duration","User relevance","Evidence"],obs.map(o=>`<tr class=activityRow data-obs="${o.id}"><td>${fmtDate(o.start)}</td><td>${fmtTime(o.start)}–${fmtTime(o.end)}</td><td>${esc(o.app)}</td><td>${esc(o.kind==="network"?(o.context||o.domain||"Network"):o.resource)}</td><td>${durText(o.duration)}</td><td>${involvementFor(o)}/100</td><td class=recorded>Recorded</td></tr>`));
 const nets=ARES.obs.filter(o=>o.kind==="network").filter(o=>(!f.date||fmtDate(o.start)===f.date)&&(!f.app||o.app===f.app)&&(!f.q||JSON.stringify(o).toLowerCase().includes(f.q)));
 networkTable.innerHTML=table(["Date","Time","App","Context","Domain","Hits","Role"],nets.slice(0,2500).map(o=>{const linked=ARES.activities.some(a=>a.network.includes(o.id));return `<tr data-obs="${o.id}" class=activityRow><td>${fmtDate(o.start)}</td><td>${fmtTime(o.start)}</td><td>${esc(o.app)}</td><td>${esc(o.context)}</td><td>${esc(o.domain)}</td><td>${o.hits}</td><td>${linked?"Supporting active session":"Background / unlinked"}</td></tr>`}));
 appTable.innerHTML=table(["App","Reconstructed active duration","Activity items"],Object.entries(appDur).sort((a,b)=>b[1]-a[1]).map(([app,d])=>`<tr><td>${esc(app)}</td><td>${durText(d)}</td><td>${acts.filter(a=>a.app===app).length}</td></tr>`));

 if(typeof contactMgmtTable!=="undefined"){
   const cm=ARES.contactEvents.filter(c=>{const f=filters();return(!f.date||fmtDate(c.start)===f.date)&&(!f.app||c.app===f.app)&&(!f.q||JSON.stringify(c).toLowerCase().includes(f.q))});
   contactMgmtTable.innerHTML=table(["Date","Candidate Window","App","Classification","Score","Rule Components","Assessment"],cm.map(c=>{
     const parts=[
       c.components.directPhoneContactsActivity?"Direct Phone/Contacts ✓":"Direct Phone/Contacts —",
       c.components.unusualContactsAccess?"Unusual Contacts ✓":"Unusual Contacts —",
       c.components.possibleSettingsSystemTransition?"Settings/System ✓":"Settings/System —",
       c.components.subsequentBehaviourChange?"Later behaviour change ✓":"Later behaviour change —"
     ].join("<br>");
     return `<tr class=activityRow data-cme="${c.id}"><td>${fmtDate(c.start)}</td><td>${fmtTime(c.start)}–${fmtTime(c.end)}</td><td>${esc(c.app)}</td><td>${esc(c.classification)}</td><td class=score>${c.score}/100</td><td>${parts}</td><td>${esc(c.interpretation)}</td></tr>`
   }));
 }

 document.querySelectorAll(".activityRow").forEach(el=>el.onclick=()=>{ARES.selected=el.dataset.cme?ARES.contactEvents.find(x=>x.id===el.dataset.cme):(el.dataset.id?ARES.activities.find(x=>x.id===el.dataset.id):ARES.obs.find(x=>x.id===el.dataset.obs));inspectorBody.textContent=JSON.stringify(ARES.selected,null,2)})
}
function setupFilters(){
 const dates=[...new Set(ARES.activities.map(a=>fmtDate(a.start)))].sort((a,b)=>a.split("/").reverse().join("").localeCompare(b.split("/").reverse().join("")));
 dateFilter.innerHTML='<option value="">All dates</option>'+dates.map(x=>`<option>${x}</option>`).join("");
 const apps=[...new Set(ARES.activities.map(a=>a.app))].sort();appFilter.innerHTML='<option value="">All apps</option>'+apps.map(x=>`<option>${esc(x)}</option>`).join("")
}
async function loadFile(file){const text=await file.text();ARES.fileName=file.name;ARES.raw=parseNDJSON(text);ARES.obs=buildObservations(ARES.raw);ARES.activities=classifyActivities(ARES.obs);ARES.contactEvents=detectContactManagementEvents(ARES.obs,ARES.activities);setupFilters();render();status.textContent=`${file.name}: ${ARES.raw.length.toLocaleString()} raw records → ${ARES.obs.length.toLocaleString()} observations → ${ARES.activities.length.toLocaleString()} human-level activity items; ${ARES.contactEvents.length.toLocaleString()} contact-management candidates.`}
fileInput.onchange=e=>e.target.files[0]&&loadFile(e.target.files[0]);
["dateFilter","appFilter","involvementFilter","search"].forEach(id=>document.getElementById(id).addEventListener(id==="search"?"input":"change",render));
nav.onclick=e=>{if(!e.target.dataset.view)return;document.querySelectorAll(".view").forEach(x=>x.classList.add("hidden"));document.getElementById(e.target.dataset.view).classList.remove("hidden");document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active"));e.target.classList.add("active")};
exportBtn.onclick=()=>{const rows=filteredActivities(),headers=["Date","Start","End","App","Type","Outcome","DurationSeconds","UserInvolvementScore","EvidenceStatus","Rationale"],csv=[headers.join(","),...rows.map(a=>[fmtDate(a.start),fmtTime(a.start),fmtTime(a.end),a.app,a.type,a.label,Math.round(a.duration),a.userScore,a.evidence,a.rationale].map(v=>`"${String(v).replaceAll('"','""')}"`).join(","))].join("\n");const blob=new Blob([csv],{type:"text/csv"}),url=URL.createObjectURL(blob),x=document.createElement("a");x.href=url;x.download="ARES_v1.4_User_Activities.csv";x.click();URL.revokeObjectURL(url)};
