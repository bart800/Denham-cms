import { useState, useMemo } from "react";
const B={navy:"#000066",gold:"#ebb003",green:"#386f4a",bg:"#08080f",card:"#111119",cardH:"#16161f",bdr:"#1e1e2e",bdrL:"#2a2a3a",txt:"#e8e8f0",txtM:"#8888a0",txtD:"#55556a",danger:"#e04050",dangerBg:"rgba(224,64,80,0.1)",greenBg:"rgba(56,111,74,0.12)",goldBg:"rgba(235,176,3,0.1)",navyBg:"rgba(0,0,102,0.15)",purple:"#7c5cbf"};
const JURIS=["KY","TN","MT","NC","TX","CA","WA","CO","NY"];
const CTYPES=["Property - Wind/Hail","Property - Fire","Property - Water","Property - Theft","Property - Mold","Personal Injury - Auto","Personal Injury - Slip & Fall","Personal Injury - Dog Bite"];
const CSTATS=["Intake","Investigation","Presuit Demand","Presuit Negotiation","Litigation - Filed","Litigation - Discovery","Litigation - Mediation","Litigation - Trial Prep","Appraisal","Settled","Closed"];
const INSURERS=["State Farm","Allstate","USAA","Liberty Mutual","Nationwide","Travelers","Progressive","Erie","QBE","Citizens","Farmers","American Family","Auto-Owners","Cincinnati Financial","Westfield"];
const PTYPES=["Complaint","Answer","Motion to Dismiss","Motion for Summary Judgment","Motion to Compel","Interrogatories","Requests for Production","Requests for Admission","Deposition Notice","Subpoena","Motion in Limine","Pretrial Order","Mediation Brief","Trial Brief"];
const ETYPES=["Contractor Estimate","Public Adjuster Estimate","Insurance Estimate","Supplement","Engineer Report","Independent Estimate"];
const ATYPES=["note","call","email","task","document","negotiation","pleading","estimate","status_change","deadline"];
const NTYPES=["bottom_line","plaintiff_offer","defendant_offer","presuit_demand","settlement","undisputed_payment","denial","appraisal_award"];
const TEAM=[
{id:1,name:"Bart Denham",role:"Admin",title:"Principal Attorney",ini:"BD",clr:"#ebb003"},
{id:2,name:"Joey",role:"Attorney",title:"Associate Attorney",ini:"JY",clr:"#5b8def"},
{id:3,name:"Chad",role:"Attorney",title:"Associate Attorney",ini:"CH",clr:"#e07850"},
{id:4,name:"Daniel Kwiatkowski",role:"Attorney",title:"Associate Attorney",ini:"DK",clr:"#50c878"},
{id:5,name:"Eliza",role:"Paralegal",title:"Paralegal",ini:"EL",clr:"#c77dba"},
{id:6,name:"Kristen",role:"Case Manager",title:"Case Manager",ini:"KR",clr:"#e0a050"},
{id:7,name:"Shelby",role:"Legal Assistant",title:"Legal Assistant",ini:"SH",clr:"#50b8c8"},
{id:8,name:"Kami",role:"Legal Assistant",title:"Legal Assistant",ini:"KM",clr:"#d4708f"},
{id:9,name:"Martin",role:"Attorney",title:"Of Counsel",ini:"MR",clr:"#7eb87e"},
{id:10,name:"Justin",role:"Legal Assistant",title:"Legal Assistant",ini:"JT",clr:"#8888cc"},
{id:11,name:"Caroline",role:"Legal Assistant",title:"Legal Assistant",ini:"CR",clr:"#cc8888"},
{id:12,name:"Ariana",role:"Paralegal",title:"Paralegal",ini:"AR",clr:"#88ccaa"}
];

function sr(seed){let s=seed;return()=>{s=(s*16807)%2147483647;return(s-1)/2147483646;};}
function genData(){
const r=sr(42),pk=a=>a[Math.floor(r()*a.length)],ri=(a,b)=>Math.floor(r()*(b-a+1))+a;
const rd=(sy,ey)=>{const s=new Date(sy,0,1).getTime(),e=new Date(ey,11,31).getTime();return new Date(s+r()*(e-s)).toISOString().split("T")[0];};
const fn=["James","Mary","Robert","Linda","Michael","Barbara","William","Susan","David","Jessica","Thomas","Sarah","Richard","Karen","Joseph","Lisa","Charles","Nancy","Daniel","Betty","Mark","Dorothy","Paul","Sandra","Steven","Ashley","Kevin","Kimberly","Brian","Emily"];
const ln=["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez","Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin"];
const st=["Main St","Oak Ave","Maple Dr","Cedar Ln","Pine Rd","Elm St","Walnut Ct","Birch Way"];
const ct={KY:["Lexington","Louisville","Frankfort"],TN:["Nashville","Memphis","Knoxville"],MT:["Billings","Missoula","Helena"],NC:["Charlotte","Raleigh","Asheville"],TX:["Houston","Dallas","Austin"],CA:["Los Angeles","San Francisco","San Diego"],WA:["Seattle","Tacoma","Spokane"],CO:["Denver","Boulder","Colorado Springs"],NY:["New York","Buffalo","Albany"]};
const sy={KY:5,TN:1,MT:5,NC:3,TX:2,CA:2,WA:3,CO:2,NY:3};
const cases=[];
for(let i=0;i<200;i++){
const j=pk(JURIS),tp=pk(CTYPES),sts=pk(CSTATS),ip=tp.startsWith("Property"),att=pk(TEAM.filter(t=>t.role==="Admin"||t.role==="Attorney")),sup=pk(TEAM.filter(t=>t.role!=="Admin"&&t.role!=="Attorney")),ins=pk(INSURERS),dol=rd(2023,2025),dop=rd(2024,2026),f=pk(fn),l=pk(ln),cn=`${ins.substring(0,2).toUpperCase()}-${ri(100000,999999)}`,pn=`POL-${ri(1000000,9999999)}`,isL=sts.startsWith("Litigation"),sol=new Date(new Date(dol).getTime()+(sy[j]||3)*365.25*86400000).toISOString().split("T")[0];
const negs=[];let nd=new Date(dop);
for(let n=0;n<ri(0,8);n++){nd=new Date(nd.getTime()+ri(7,60)*86400000);const nt=pk(NTYPES);negs.push({id:`n${i}-${n}`,date:nd.toISOString().split("T")[0],type:nt,amount:nt==="denial"?0:ri(5000,500000),notes:nt==="denial"?"Full denial":"Settlement reached",by:pk(TEAM).name});}
const ests=[];for(let e=0;e<(ip?ri(1,5):ri(0,2));e++){ests.push({id:`e${i}-${e}`,date:rd(2024,2026),type:pk(ETYPES),amount:ri(8000,350000),vendor:`${pk(["Premier","National","Apex","Summit"])} ${pk(["Roofing","Construction","Restoration","Engineering"])}`,notes:pk(["Full scope","Partial - supplement pending","Depreciation included","Emergency repairs only"])});}
const pleads=[];if(isL){let pd=new Date(dop);for(let p=0;p<ri(2,8);p++){pd=new Date(pd.getTime()+ri(5,45)*86400000);pleads.push({id:`p${i}-${p}`,date:pd.toISOString().split("T")[0],type:pk(PTYPES),filedBy:r()>0.5?"Plaintiff":"Defendant",status:pk(["Filed","Served","Pending","Granted","Denied","Withdrawn"]),notes:pk(["E-filed","Served via email","Hearing scheduled","Awaiting ruling",""]),docUrl:r()>0.3?"#":null});}}
const acts=[];let ad=new Date(dop);
for(let a=0;a<ri(5,25);a++){ad=new Date(ad.getTime()+ri(1,14)*86400000);const at=pk(ATYPES),ac=pk(TEAM);
acts.push({id:`a${i}-${a}`,date:ad.toISOString().split("T")[0],time:`${ri(8,18)}:${String(ri(0,59)).padStart(2,"0")}`,type:at,actor:ac.name,aIni:ac.ini,aClr:ac.clr,
title:at==="note"?pk(["Case note added","Internal memo","Client update"]):at==="call"?pk(["Called client","Called adjuster","Conference call"]):at==="email"?pk(["Email to adjuster","Email from client","Demand sent"]):at==="task"?pk(["Task created","Task completed"]):at==="document"?pk(["Doc uploaded","Doc signed","Policy uploaded"]):at==="negotiation"?pk(["Offer received","Counter sent","Demand issued"]):at==="pleading"?pk(["Motion filed","Response served","Discovery sent"]):at==="estimate"?pk(["Estimate received","Supplement submitted"]):at==="status_change"?"Status \u2192 "+pk(CSTATS):pk(["SOL approaching","Hearing date set"]),
desc:pk(["","Details attached","Follow up required","No action needed","Awaiting response"])});}
acts.sort((a,b)=>new Date(b.date)-new Date(a.date));
const cd={policyNumber:pn,claimNumber:cn,insurer:ins,adjuster:`${pk(fn)} ${pk(ln)}`,adjPhone:`(${ri(200,999)}) ${ri(200,999)}-${ri(1000,9999)}`,adjEmail:`adj${ri(100,999)}@${ins.toLowerCase().replace(/\s/g,"")}.com`,dateOfLoss:dol,dateReported:new Date(new Date(dol).getTime()+ri(1,30)*86400000).toISOString().split("T")[0],dateDenied:r()>0.6?new Date(new Date(dol).getTime()+ri(30,120)*86400000).toISOString().split("T")[0]:null,policyType:ip?pk(["HO-3","HO-5","HO-6","Commercial Property"]):pk(["Auto Liability","Premises Liability"]),policyLimits:`$${ri(100,2000)}K`,deductible:ip?`$${pk(["1,000","2,500","5,000"])}`:"N/A",causeOfLoss:ip?pk(["Wind/Hail","Fire","Water Damage","Theft","Mold"]):pk(["Auto Collision","Slip & Fall","Dog Bite"]),propAddr:ip?`${ri(100,9999)} ${pk(st)}, ${pk(ct[j])}, ${j}`:null};
const ld=isL?{caseNum:`${ri(20,26)}-CI-${ri(10000,99999)}`,court:`${pk(ct[j])} ${pk(["Circuit","District","Superior"])} Court`,judge:`Hon. ${pk(fn)} ${pk(ln)}`,filedDate:rd(2024,2026),oppCounsel:`${pk(fn)} ${pk(ln)}`,oppFirm:`${pk(ln)} & ${pk(ln)}, PLLC`,oppPhone:`(${ri(200,999)}) ${ri(200,999)}-${ri(1000,9999)}`,oppEmail:`atty${ri(100,999)}@${pk(ln).toLowerCase()}law.com`,trialDate:r()>0.5?rd(2026,2027):null,medDate:r()>0.4?rd(2026,2027):null,discDeadline:rd(2026,2027)}:null;
cases.push({id:i+1,ref:`DEN-${String(2024+Math.floor(i/80)).slice(-2)}-${String(i+1).padStart(4,"0")}`,client:`${f} ${l}`,clientPhone:`(${ri(200,999)}) ${ri(200,999)}-${ri(1000,9999)}`,clientEmail:`${f.toLowerCase()}.${l.toLowerCase()}@${pk(["gmail","yahoo","outlook"])}.com`,type:tp,status:sts,juris:j,attorney:att,support:sup,dol,dop,sol,insurer:ins,cn,pn,cd,ld,negs,ests,pleads,acts,totalRec:sts==="Settled"?ri(15000,750000):0,attFees:sts==="Settled"?ri(5000,250000):0});}
return cases;}

const S={card:{background:B.card,border:`1px solid ${B.bdr}`,borderRadius:10,padding:20},badge:{display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600},mono:{fontFamily:"'JetBrains Mono',monospace"},input:{background:"#0a0a14",border:`1px solid ${B.bdr}`,borderRadius:6,padding:"8px 12px",color:B.txt,fontSize:13,outline:"none",width:"100%",fontFamily:"'DM Sans',sans-serif"},btn:{background:B.gold,color:"#000",border:"none",borderRadius:6,padding:"8px 16px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"},btnO:{background:"transparent",border:`1px solid ${B.bdr}`,borderRadius:6,padding:"8px 16px",fontSize:13,fontWeight:500,cursor:"pointer",color:B.txtM,fontFamily:"'DM Sans',sans-serif"},tbl:{width:"100%",borderCollapse:"collapse",fontSize:13},th:{textAlign:"left",padding:"10px 16px",borderBottom:`1px solid ${B.bdr}`,color:B.txtD,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:0.5},td:{padding:"10px 16px",borderBottom:`1px solid ${B.bdr}06`},secT:{fontSize:15,fontWeight:700,color:B.txt,marginBottom:16}};
const fmt=n=>"$"+Number(n).toLocaleString("en-US");
const fmtD=d=>{if(!d)return"\u2014";return new Date(d+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});};
const dU=d=>Math.ceil((new Date(d+"T00:00:00")-new Date())/86400000);
function stClr(st){if(st.includes("Intake"))return{bg:B.goldBg,t:B.gold};if(st.includes("Investigation"))return{bg:"rgba(91,141,239,0.12)",t:"#5b8def"};if(st.includes("Presuit"))return{bg:"rgba(235,176,3,0.12)",t:"#e0a050"};if(st.includes("Litigation"))return{bg:"rgba(0,0,102,0.2)",t:"#6b6bff"};if(st.includes("Appraisal"))return{bg:"rgba(124,92,191,0.12)",t:B.purple};if(st.includes("Settled"))return{bg:B.greenBg,t:B.green};return{bg:"rgba(85,85,106,0.15)",t:B.txtD};}
function nClr(t){return{bottom_line:B.gold,plaintiff_offer:B.green,defendant_offer:"#5b8def",presuit_demand:"#e0a050",settlement:"#50c878",undisputed_payment:"#7eb87e",denial:B.danger,appraisal_award:B.purple}[t]||B.txtM;}
function nLbl(t){return t.split("_").map(w=>w[0].toUpperCase()+w.slice(1)).join(" ");}
function aIcon(t){return{note:"\u270d\ufe0f",call:"\ud83d\udcde",email:"\u2709\ufe0f",task:"\u2705",document:"\ud83d\udcc4",negotiation:"\ud83d\udcb0",pleading:"\u2696\ufe0f",estimate:"\ud83d\udcca",status_change:"\ud83d\udd04",deadline:"\u23f0"}[t]||"\u2022";}

function Login({onLogin}){
const[e,setE]=useState("");const[p,setP]=useState("");
return(<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:`radial-gradient(ellipse at 30% 20%,${B.navyBg} 0%,${B.bg} 70%)`}}>
<div style={{width:380,...S.card,padding:40,textAlign:"center"}}>
<div style={{width:56,height:56,borderRadius:14,background:`linear-gradient(135deg,${B.navy},${B.gold})`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",fontSize:22,fontWeight:800,color:"#fff"}}>D</div>
<h1 style={{fontSize:20,fontWeight:700,marginBottom:4}}>DENHAM LAW</h1>
<p style={{fontSize:13,color:B.txtM,marginBottom:28}}>Staff Portal</p>
<div style={{marginBottom:12}}><input placeholder="Email" value={e} onChange={x=>setE(x.target.value)} style={S.input}/></div>
<div style={{marginBottom:20}}><input placeholder="Password" type="password" value={p} onChange={x=>setP(x.target.value)} style={S.input}/></div>
<button style={{...S.btn,width:"100%",padding:"10px 0"}}>Sign In</button>
<p style={{fontSize:11,color:B.txtD,marginTop:24,marginBottom:12}}>Demo — click to login as:</p>
<div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center"}}>
{TEAM.slice(0,8).map(t=>(<button key={t.id} onClick={()=>onLogin(t)} style={{background:`${t.clr}15`,border:`1px solid ${t.clr}30`,borderRadius:6,padding:"4px 10px",fontSize:11,color:t.clr,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{t.name.split(" ")[0]}</button>))}
</div>
<p style={{fontSize:10,color:B.txtD,marginTop:28}}>859-900-BART · denham.law</p>
</div></div>);}

function Side({user,active,onNav,onOut}){
const nav=[{id:"dashboard",label:"Dashboard",icon:"\u2b21"},{id:"cases",label:"My Cases",icon:"\u25c8"},{id:"tasks",label:"Tasks",icon:"\u2610"},{id:"docs",label:"Documents",icon:"\u25c7"}];
return(<div style={{width:220,minHeight:"100vh",background:B.card,borderRight:`1px solid ${B.bdr}`,display:"flex",flexDirection:"column",position:"fixed",left:0,top:0,zIndex:100}}>
<div style={{padding:"20px 16px",borderBottom:`1px solid ${B.bdr}`}}>
<div style={{display:"flex",alignItems:"center",gap:10}}>
<div style={{width:34,height:34,borderRadius:8,background:`linear-gradient(135deg,${B.navy},${B.gold})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#fff"}}>D</div>
<div><div style={{fontSize:13,fontWeight:700}}>DENHAM CMS</div><div style={{fontSize:10,color:B.txtD}}>v2.0</div></div></div></div>
<div style={{padding:"12px 8px",flex:1}}>{nav.map(n=>(<button key={n.id} onClick={()=>onNav(n.id)} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"10px 12px",borderRadius:8,border:"none",background:active===n.id?`${B.gold}15`:"transparent",color:active===n.id?B.gold:B.txtM,cursor:"pointer",fontSize:13,fontWeight:active===n.id?600:400,fontFamily:"'DM Sans',sans-serif",marginBottom:2,textAlign:"left"}}><span style={{fontSize:16,opacity:0.7}}>{n.icon}</span>{n.label}</button>))}</div>
<div style={{padding:16,borderTop:`1px solid ${B.bdr}`}}>
<div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
<div style={{width:32,height:32,borderRadius:"50%",background:user.clr,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#fff"}}>{user.ini}</div>
<div><div style={{fontSize:12,fontWeight:600}}>{user.name.split(" ")[0]}</div><div style={{fontSize:10,color:B.txtD}}>{user.title}</div></div></div>
<button onClick={onOut} style={{...S.btnO,width:"100%",fontSize:11,padding:"6px 0"}}>Sign Out</button>
</div></div>);}

function Dash({user,cases,onOpen}){
const my=cases.filter(c=>c.attorney.id===user.id||c.support.id===user.id);
const ac=my.filter(c=>c.status!=="Settled"&&c.status!=="Closed");
const sol90=ac.filter(c=>dU(c.sol)<90);
const rec=my.reduce((s,c)=>s+c.totalRec,0);
const sc={};ac.forEach(c=>{sc[c.status]=(sc[c.status]||0)+1;});
return(<div>
<h2 style={{fontSize:22,fontWeight:700,marginBottom:24}}>Welcome back, {user.name.split(" ")[0]}</h2>
<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:24}}>
{[{l:"Active Cases",v:ac.length,c:B.gold},{l:"Total Recoveries",v:fmt(rec),c:B.green},{l:"SOL < 90 Days",v:sol90.length,c:sol90.length>0?B.danger:B.txtD},{l:"My Cases Total",v:my.length,c:"#5b8def"}].map((x,i)=>(<div key={i} style={S.card}><div style={{fontSize:11,color:B.txtM,marginBottom:6,textTransform:"uppercase",letterSpacing:0.5,fontWeight:600}}>{x.l}</div><div style={{fontSize:26,fontWeight:700,color:x.c,...S.mono}}>{x.v}</div></div>))}</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
<div style={S.card}><h3 style={S.secT}>Cases by Status</h3>
{Object.entries(sc).sort((a,b)=>b[1]-a[1]).map(([st,ct])=>{const c=stClr(st);return(<div key={st} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${B.bdr}06`}}><span style={{...S.badge,background:c.bg,color:c.t}}>{st}</span><span style={{...S.mono,fontSize:14,fontWeight:600,color:c.t}}>{ct}</span></div>);})}</div>
<div style={S.card}><h3 style={S.secT}>Upcoming SOL Deadlines</h3>
{ac.sort((a,b)=>new Date(a.sol)-new Date(b.sol)).slice(0,6).map(c=>{const d=dU(c.sol);return(<div key={c.id} onClick={()=>onOpen(c)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${B.bdr}06`,cursor:"pointer"}}><div><div style={{fontSize:13,fontWeight:500}}>{c.client}</div><div style={{fontSize:11,color:B.txtD}}>{c.ref}</div></div><span style={{...S.mono,fontSize:12,fontWeight:600,color:d<30?B.danger:d<90?B.gold:B.txtM}}>{d}d</span></div>);})}</div>
</div></div>);}

function Cases({user,cases,onOpen}){
const[search,setSearch]=useState("");const[fSt,setFSt]=useState("All");const[fJ,setFJ]=useState("All");const[sBy,setSBy]=useState("dop");const[sDir,setSDir]=useState("desc");
const my=cases.filter(c=>c.attorney.id===user.id||c.support.id===user.id);
const fl=my.filter(c=>{if(search&&!c.client.toLowerCase().includes(search.toLowerCase())&&!c.ref.toLowerCase().includes(search.toLowerCase())&&!c.insurer.toLowerCase().includes(search.toLowerCase()))return false;if(fSt!=="All"&&c.status!==fSt)return false;if(fJ!=="All"&&c.juris!==fJ)return false;return true;}).sort((a,b)=>{let va=a[sBy]||"",vb=b[sBy]||"";if(typeof va==="string")va=va.toLowerCase();if(typeof vb==="string")vb=vb.toLowerCase();if(va<vb)return sDir==="asc"?-1:1;if(va>vb)return sDir==="asc"?1:-1;return 0;});
return(<div>
<h2 style={{fontSize:22,fontWeight:700,marginBottom:20}}>My Cases <span style={{fontSize:14,color:B.txtD,fontWeight:400}}>({fl.length})</span></h2>
<div style={{display:"flex",gap:10,marginBottom:16}}>
<input placeholder="Search client, case #, insurer..." value={search} onChange={e=>setSearch(e.target.value)} style={{...S.input,maxWidth:300}}/>
<select value={fSt} onChange={e=>setFSt(e.target.value)} style={{...S.input,width:180}}><option value="All">All Statuses</option>{CSTATS.map(x=><option key={x} value={x}>{x}</option>)}</select>
<select value={fJ} onChange={e=>setFJ(e.target.value)} style={{...S.input,width:100}}><option value="All">All States</option>{JURIS.map(x=><option key={x} value={x}>{x}</option>)}</select></div>
<div style={{...S.card,padding:0,overflow:"hidden"}}><table style={S.tbl}><thead><tr>
{[["ref","Case #"],["client","Client"],["type","Type"],["status","Status"],["juris","State"],["insurer","Insurer"],["dop","Opened"],["sol","SOL"]].map(([c,l])=>(<th key={c} onClick={()=>{if(sBy===c)setSDir(d=>d==="asc"?"desc":"asc");else{setSBy(c);setSDir("desc");}}} style={{...S.th,cursor:"pointer"}}>{l}{sBy===c?(sDir==="asc"?" \u2191":" \u2193"):""}</th>))}
</tr></thead><tbody>
{fl.slice(0,50).map(c=>{const sc=stClr(c.status);const sd=dU(c.sol);return(<tr key={c.id} onClick={()=>onOpen(c)} style={{cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background=B.cardH} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
<td style={{...S.td,...S.mono,fontSize:12,color:B.gold,fontWeight:500}}>{c.ref}</td>
<td style={{...S.td,fontWeight:500}}>{c.client}</td>
<td style={{...S.td,fontSize:12,color:B.txtM}}>{c.type}</td>
<td style={S.td}><span style={{...S.badge,background:sc.bg,color:sc.t}}>{c.status}</span></td>
<td style={{...S.td,...S.mono,fontSize:12}}>{c.juris}</td>
<td style={{...S.td,fontSize:12}}>{c.insurer}</td>
<td style={{...S.td,...S.mono,fontSize:12,color:B.txtM}}>{fmtD(c.dop)}</td>
<td style={{...S.td,...S.mono,fontSize:12,fontWeight:600,color:sd<30?B.danger:sd<90?B.gold:B.txtM}}>{fmtD(c.sol)}</td>
</tr>);})}
</tbody></table></div></div>);}

function ActivityFeed({c}){
const[ft,setFt]=useState("all");const[sd,setSd]=useState("desc");
const acts=c.acts.filter(a=>ft==="all"||a.type===ft).sort((a,b)=>sd==="desc"?new Date(b.date)-new Date(a.date):new Date(a.date)-new Date(b.date));
return(<div>
<div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center"}}>
<select value={ft} onChange={e=>setFt(e.target.value)} style={{...S.input,width:180}}><option value="all">All Activity</option>{ATYPES.map(t=><option key={t} value={t}>{t.replace(/_/g," ").replace(/\b\w/g,l=>l.toUpperCase())}</option>)}</select>
<button onClick={()=>setSd(d=>d==="desc"?"asc":"desc")} style={S.btnO}>{sd==="desc"?"Newest First \u2193":"Oldest First \u2191"}</button>
<div style={{marginLeft:"auto",fontSize:12,color:B.txtD}}>{acts.length} entries</div></div>
<div style={{...S.card,padding:0}}>
{acts.length===0?<div style={{padding:40,textAlign:"center",color:B.txtD}}>No activity matching filter</div>:
acts.map((a,i)=>(<div key={a.id} style={{display:"flex",gap:14,padding:"14px 20px",borderBottom:i<acts.length-1?`1px solid ${B.bdr}06`:"none"}}>
<div style={{width:32,height:32,borderRadius:"50%",background:a.aClr,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",flexShrink:0}}>{a.aIni}</div>
<div style={{flex:1}}>
<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
<span style={{fontSize:13,fontWeight:600}}>{a.actor}</span>
<span style={{fontSize:12}}>{aIcon(a.type)}</span>
<span style={{fontSize:12,color:B.txtM}}>{a.title}</span>
<span style={{marginLeft:"auto",...S.mono,fontSize:11,color:B.txtD}}>{fmtD(a.date)} {a.time}</span></div>
{a.desc&&<div style={{fontSize:12,color:B.txtD}}>{a.desc}</div>}
</div></div>))}
</div></div>);}

function ClaimDetails({c}){
const d=c.cd;
const F=({l,v,m,clr})=>(<div style={{marginBottom:14}}><div style={{fontSize:10,color:B.txtD,textTransform:"uppercase",letterSpacing:0.5,fontWeight:600,marginBottom:3}}>{l}</div><div style={{fontSize:m?13:14,fontWeight:500,color:clr||B.txt,...(m?S.mono:{})}}>{v||"\u2014"}</div></div>);
return(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
<div style={S.card}><h3 style={{...S.secT,marginBottom:20}}>Policy Information</h3>
<F l="Policy Number" v={d.policyNumber} m/><F l="Claim Number" v={d.claimNumber} m/><F l="Insurance Company" v={d.insurer}/><F l="Policy Type" v={d.policyType}/><F l="Policy Limits" v={d.policyLimits} m clr={B.gold}/><F l="Deductible" v={d.deductible} m/></div>
<div style={S.card}><h3 style={{...S.secT,marginBottom:20}}>Claim Information</h3>
<F l="Date of Loss" v={fmtD(d.dateOfLoss)} m/><F l="Date Reported" v={fmtD(d.dateReported)} m/><F l="Date Denied" v={d.dateDenied?fmtD(d.dateDenied):"Not denied"} m clr={d.dateDenied?B.danger:B.green}/><F l="Cause of Loss" v={d.causeOfLoss}/>{d.propAddr&&<F l="Property Address" v={d.propAddr}/>}</div>
<div style={{...S.card,gridColumn:"1/-1"}}><h3 style={{...S.secT,marginBottom:20}}>Adjuster Contact</h3>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}><F l="Name" v={d.adjuster}/><F l="Phone" v={d.adjPhone} m/><F l="Email" v={d.adjEmail} m/></div></div>
</div>);}

function LitDetails({c}){
const l=c.ld;
const F=({l:lb,v,m,clr})=>(<div style={{marginBottom:14}}><div style={{fontSize:10,color:B.txtD,textTransform:"uppercase",letterSpacing:0.5,fontWeight:600,marginBottom:3}}>{lb}</div><div style={{fontSize:m?13:14,fontWeight:500,color:clr||B.txt,...(m?S.mono:{})}}>{v||"\u2014"}</div></div>);
if(!l)return(<div style={{...S.card,padding:60,textAlign:"center"}}><div style={{fontSize:40,marginBottom:12}}>{"\u2696\ufe0f"}</div><div style={{fontSize:16,fontWeight:600,marginBottom:8}}>Not in Litigation</div><div style={{fontSize:13,color:B.txtM}}>Litigation details will appear here once a complaint is filed.</div></div>);
return(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
<div style={S.card}><h3 style={{...S.secT,marginBottom:20}}>Court Information</h3><F l="Case Number" v={l.caseNum} m/><F l="Court" v={l.court}/><F l="Judge" v={l.judge}/><F l="Filed Date" v={fmtD(l.filedDate)} m/></div>
<div style={S.card}><h3 style={{...S.secT,marginBottom:20}}>Opposing Counsel</h3><F l="Attorney" v={l.oppCounsel}/><F l="Firm" v={l.oppFirm}/><F l="Phone" v={l.oppPhone} m/><F l="Email" v={l.oppEmail} m/></div>
<div style={{...S.card,gridColumn:"1/-1"}}><h3 style={{...S.secT,marginBottom:20}}>Key Dates</h3>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
<div><F l="Trial Date" v={l.trialDate?fmtD(l.trialDate):"Not set"} m clr={l.trialDate?B.danger:B.txtD}/>{l.trialDate&&<div style={{...S.mono,fontSize:11,color:dU(l.trialDate)<60?B.danger:B.gold}}>{dU(l.trialDate)} days away</div>}</div>
<div><F l="Mediation Date" v={l.medDate?fmtD(l.medDate):"Not set"} m clr={l.medDate?B.purple:B.txtD}/>{l.medDate&&<div style={{...S.mono,fontSize:11,color:B.purple}}>{dU(l.medDate)} days away</div>}</div>
<F l="Discovery Deadline" v={fmtD(l.discDeadline)} m clr="#5b8def"/>
</div></div></div>);}

function Negotiations({c}){
const[sd,setSd]=useState("desc");
const negs=[...c.negs].sort((a,b)=>sd==="desc"?new Date(b.date)-new Date(a.date):new Date(a.date)-new Date(b.date));
const bl=c.negs.find(n=>n.type==="bottom_line"),lp=[...c.negs].filter(n=>n.type==="plaintiff_offer").sort((a,b)=>new Date(b.date)-new Date(a.date))[0],ld=[...c.negs].filter(n=>n.type==="defendant_offer").sort((a,b)=>new Date(b.date)-new Date(a.date))[0],sett=c.negs.find(n=>n.type==="settlement"),den=c.negs.find(n=>n.type==="denial"),apr=c.negs.find(n=>n.type==="appraisal_award"),psd=c.negs.find(n=>n.type==="presuit_demand"),und=c.negs.find(n=>n.type==="undisputed_payment");
return(<div>
<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
{[{l:"Bottom Line",v:bl?fmt(bl.amount):"\u2014",c:B.gold},{l:"Last Plaintiff Offer",v:lp?fmt(lp.amount):"\u2014",c:B.green},{l:"Last Defendant Offer",v:ld?fmt(ld.amount):"\u2014",c:"#5b8def"},{l:"Presuit Demand",v:psd?fmt(psd.amount):"\u2014",c:"#e0a050"}].map((x,i)=>(<div key={i} style={{...S.card,padding:"12px 16px"}}><div style={{fontSize:10,color:B.txtD,textTransform:"uppercase",letterSpacing:0.5,fontWeight:600,marginBottom:4}}>{x.l}</div><div style={{...S.mono,fontSize:18,fontWeight:700,color:x.c}}>{x.v}</div></div>))}</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
{[{l:"Settlement",v:sett?fmt(sett.amount):"\u2014",c:"#50c878"},{l:"Undisputed Payment",v:und?fmt(und.amount):"\u2014",c:"#7eb87e"},{l:"Denial",v:den?"DENIED":"\u2014",c:den?B.danger:B.txtD},{l:"Appraisal Award",v:apr?fmt(apr.amount):"\u2014",c:B.purple}].map((x,i)=>(<div key={i} style={{...S.card,padding:"12px 16px"}}><div style={{fontSize:10,color:B.txtD,textTransform:"uppercase",letterSpacing:0.5,fontWeight:600,marginBottom:4}}>{x.l}</div><div style={{...S.mono,fontSize:18,fontWeight:700,color:x.c}}>{x.v}</div></div>))}</div>
{c.negs.filter(n=>n.amount>0).length>0&&<div style={{...S.card,marginBottom:20}}><h3 style={{...S.secT,marginBottom:16}}>Negotiation Spread</h3>
<div style={{display:"flex",flexDirection:"column",gap:6}}>
{[...c.negs].filter(n=>n.amount>0).sort((a,b)=>b.amount-a.amount).map((n,i)=>{const mx=Math.max(...c.negs.filter(x=>x.amount>0).map(x=>x.amount));return(<div key={i} style={{display:"flex",alignItems:"center",gap:12}}>
<div style={{width:120,fontSize:11,color:B.txtM,textAlign:"right",flexShrink:0}}>{nLbl(n.type)}</div>
<div style={{flex:1,height:24,background:`${B.bdr}40`,borderRadius:4,position:"relative",overflow:"hidden"}}>
<div style={{height:"100%",width:`${(n.amount/mx)*100}%`,background:`${nClr(n.type)}22`,borderRadius:4,borderRight:`3px solid ${nClr(n.type)}`}}/>
<span style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",fontSize:11,color:nClr(n.type),...S.mono}}>{fmt(n.amount)}</span>
</div></div>);})}
</div></div>}
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><h3 style={S.secT}>Negotiation History</h3><button onClick={()=>setSd(d=>d==="desc"?"asc":"desc")} style={S.btnO}>{sd==="desc"?"Newest \u2193":"Oldest \u2191"}</button></div>
<div style={{...S.card,padding:0,overflow:"hidden"}}>
{negs.length===0?<div style={{padding:40,textAlign:"center",color:B.txtD}}>No negotiation events</div>:
<table style={S.tbl}><thead><tr><th style={S.th}>Date</th><th style={S.th}>Type</th><th style={S.th}>Amount</th><th style={S.th}>Notes</th><th style={S.th}>By</th></tr></thead><tbody>
{negs.map((n,i)=>(<tr key={i}><td style={{...S.td,...S.mono,fontSize:12}}>{fmtD(n.date)}</td><td style={S.td}><span style={{...S.badge,background:`${nClr(n.type)}18`,color:nClr(n.type)}}>{nLbl(n.type)}</span></td><td style={{...S.td,...S.mono,fontSize:13,fontWeight:600,color:nClr(n.type)}}>{n.type==="denial"?"\u2014":fmt(n.amount)}</td><td style={{...S.td,fontSize:12,color:B.txtM}}>{n.notes}</td><td style={{...S.td,fontSize:12,color:B.txtM}}>{n.by}</td></tr>))}
</tbody></table>}</div></div>);}

function Estimates({c}){
const ests=[...c.ests].sort((a,b)=>new Date(b.date)-new Date(a.date));
const hi=ests.length>0?Math.max(...ests.map(e=>e.amount)):0,lo=ests.length>0?Math.min(...ests.map(e=>e.amount)):0,av=ests.length>0?Math.round(ests.reduce((s,e)=>s+e.amount,0)/ests.length):0;
return(<div>
<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
{[{l:"Highest Estimate",v:hi>0?fmt(hi):"\u2014",c:B.green},{l:"Lowest Estimate",v:lo>0?fmt(lo):"\u2014",c:B.danger},{l:"Average Estimate",v:av>0?fmt(av):"\u2014",c:B.gold}].map((x,i)=>(<div key={i} style={{...S.card,padding:"12px 16px"}}><div style={{fontSize:10,color:B.txtD,textTransform:"uppercase",letterSpacing:0.5,fontWeight:600,marginBottom:4}}>{x.l}</div><div style={{...S.mono,fontSize:20,fontWeight:700,color:x.c}}>{x.v}</div></div>))}</div>
<div style={{...S.card,padding:0,overflow:"hidden"}}>
{ests.length===0?<div style={{padding:40,textAlign:"center",color:B.txtD}}>No estimates recorded</div>:
<table style={S.tbl}><thead><tr><th style={S.th}>Date</th><th style={S.th}>Type</th><th style={S.th}>Vendor</th><th style={S.th}>Amount</th><th style={S.th}>Notes</th></tr></thead><tbody>
{ests.map((e,i)=>(<tr key={i}><td style={{...S.td,...S.mono,fontSize:12}}>{fmtD(e.date)}</td><td style={S.td}><span style={{...S.badge,background:B.goldBg,color:B.gold}}>{e.type}</span></td><td style={{...S.td,fontSize:13}}>{e.vendor}</td><td style={{...S.td,...S.mono,fontSize:14,fontWeight:600,color:B.green}}>{fmt(e.amount)}</td><td style={{...S.td,fontSize:12,color:B.txtM}}>{e.notes}</td></tr>))}
</tbody></table>}</div></div>);}

function Pleadings({c}){
const pl=[...c.pleads].sort((a,b)=>new Date(b.date)-new Date(a.date));
const byP=pl.filter(p=>p.filedBy==="Plaintiff").length,byD=pl.filter(p=>p.filedBy==="Defendant").length;
if(pl.length===0)return(<div style={{...S.card,padding:60,textAlign:"center"}}><div style={{fontSize:40,marginBottom:12}}>{"\u2696\ufe0f"}</div><div style={{fontSize:16,fontWeight:600,marginBottom:8}}>No Pleadings</div><div style={{fontSize:13,color:B.txtM}}>Pleadings will appear here once the case enters litigation.</div></div>);
return(<div>
<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
{[{l:"Total Pleadings",v:pl.length,c:B.purple},{l:"By Plaintiff",v:byP,c:B.green},{l:"By Defendant",v:byD,c:"#5b8def"}].map((x,i)=>(<div key={i} style={{...S.card,padding:"12px 16px"}}><div style={{fontSize:10,color:B.txtD,textTransform:"uppercase",letterSpacing:0.5,fontWeight:600,marginBottom:4}}>{x.l}</div><div style={{...S.mono,fontSize:20,fontWeight:700,color:x.c}}>{x.v}</div></div>))}</div>
<div style={{...S.card,padding:0,overflow:"hidden"}}>
<table style={S.tbl}><thead><tr><th style={S.th}>Date</th><th style={S.th}>Type</th><th style={S.th}>Filed By</th><th style={S.th}>Status</th><th style={S.th}>Notes</th><th style={S.th}>Doc</th></tr></thead><tbody>
{pl.map((p,i)=>(<tr key={i}><td style={{...S.td,...S.mono,fontSize:12}}>{fmtD(p.date)}</td><td style={{...S.td,fontSize:13,fontWeight:500}}>{p.type}</td><td style={S.td}><span style={{...S.badge,background:p.filedBy==="Plaintiff"?B.greenBg:"rgba(91,141,239,0.12)",color:p.filedBy==="Plaintiff"?B.green:"#5b8def"}}>{p.filedBy}</span></td><td style={S.td}><span style={{...S.badge,background:p.status==="Granted"?B.greenBg:p.status==="Denied"?B.dangerBg:B.goldBg,color:p.status==="Granted"?B.green:p.status==="Denied"?B.danger:B.gold}}>{p.status}</span></td><td style={{...S.td,fontSize:12,color:B.txtM}}>{p.notes||"\u2014"}</td><td style={S.td}>{p.docUrl?<span style={{fontSize:12,color:B.gold,cursor:"pointer"}}>{"\ud83d\udcce"} View</span>:<span style={{fontSize:12,color:B.txtD}}>{"\u2014"}</span>}</td></tr>))}
</tbody></table></div></div>);}

const DISC_TYPES=["Interrogatories","Requests for Production","Requests for Admission"];
const OBJ_TEMPLATES=[
{id:"overly_broad",name:"Overly Broad",text:"Defendant objects to this request as overly broad, unduly burdensome, and not reasonably calculated to lead to the discovery of admissible evidence."},
{id:"vague",name:"Vague & Ambiguous",text:"Defendant objects to this request as vague and ambiguous, rendering it impossible to determine with reasonable certainty what information is sought."},
{id:"attorney_client",name:"Attorney-Client Privilege",text:"Defendant objects to this request to the extent it seeks information protected by the attorney-client privilege and/or work product doctrine."},
{id:"not_relevant",name:"Not Relevant",text:"Defendant objects to this request on the grounds that it seeks information that is neither relevant to any party's claim or defense nor proportional to the needs of the case."},
{id:"unduly_burden",name:"Unduly Burdensome",text:"Defendant objects to this request as unduly burdensome and oppressive in that compliance would require unreasonable expense and effort disproportionate to any benefit."},
{id:"already_provided",name:"Already Provided",text:"Defendant objects to this request as duplicative of prior discovery requests to which responses have already been provided."},
{id:"premature",name:"Premature",text:"Defendant objects to this request as premature given the current stage of litigation."},
{id:"trade_secret",name:"Trade Secret/Proprietary",text:"Defendant objects to this request to the extent it seeks trade secrets, proprietary, or confidential business information."},
{id:"calls_for_legal",name:"Calls for Legal Conclusion",text:"Defendant objects to this request to the extent it calls for a legal conclusion."},
{id:"compound",name:"Compound",text:"Defendant objects to this request as compound, containing multiple discrete sub-parts that should be propounded as separate requests."}
];

function Discovery({c}){
const[requests,setRequests]=useState(()=>{
const r=[];const rng=sr(c.id*7);const pk=a=>a[Math.floor(rng()*a.length)];const ri=(a,b)=>Math.floor(rng()*(b-a+1))+a;
const isLit=c.status.startsWith("Litigation");
if(!isLit)return r;
const numSets=ri(1,3);
for(let s=0;s<numSets;s++){
const dtype=pk(DISC_TYPES);const numReqs=dtype==="Requests for Admission"?ri(5,20):ri(8,25);
const servedDate=new Date(new Date(c.dop).getTime()+ri(60,200)*86400000).toISOString().split("T")[0];
const dueDate=new Date(new Date(servedDate).getTime()+30*86400000).toISOString().split("T")[0];
const items=[];
for(let q=0;q<numReqs;q++){
const qText=dtype==="Interrogatories"?pk(["State the full name, address, and telephone number of each person with knowledge of the facts of this case.","Describe in detail the damages you claim to have suffered as a result of the incident.","Identify all documents that support your claim for damages.","State whether you have given any written or recorded statements regarding this matter.","Describe the factual basis for each affirmative defense raised in your Answer.","Identify each expert witness you intend to call at trial and state the subject matter of their testimony.","State the amount of insurance coverage available to satisfy a judgment in this case.","Describe all communications between you and any insurance adjuster regarding this claim.","Identify all persons who participated in the investigation of this claim.","State whether you contend that any of the claimed damages were pre-existing.","Describe the methodology used to calculate the estimated damages.","Identify all contractors or vendors who provided estimates for repairs.","State whether any payments have been made on this claim and the amounts thereof.","Describe any inspections conducted of the subject property and identify all persons who conducted them.","State whether surveillance was conducted on the plaintiff and produce any resulting materials."]):
dtype==="Requests for Production"?pk(["Produce all documents relating to the investigation of the claim at issue.","Produce the complete claim file maintained by the insurer for this loss.","Produce all correspondence between the insurer and any contractor or vendor regarding this claim.","Produce all photographs or videos taken of the subject property.","Produce all internal memoranda, emails, or communications regarding this claim.","Produce the insurance policy in effect at the time of the loss, including all endorsements.","Produce all expert reports obtained in connection with this claim.","Produce all training materials provided to adjusters regarding claims of this type.","Produce all documents reflecting the basis for any denial or partial denial of coverage.","Produce the insurer's underwriting file for this policy.","Produce all reserve information and documents related to this claim.","Produce any surveillance materials obtained regarding the plaintiff."]):
pk(["Admit that the insurance policy at issue was in full force and effect on the date of loss.","Admit that the subject property sustained damage as a result of the claimed cause of loss.","Admit that the insurer received timely notice of the claim.","Admit that the insurer assigned an adjuster to investigate the claim.","Admit that the insurer's estimate did not include all damaged items.","Admit that the insurer failed to pay the full amount of covered damages.","Admit that no exclusion in the policy applies to bar coverage for this loss.","Admit that the plaintiff complied with all conditions precedent under the policy.","Admit that the insurer did not inspect the property within a reasonable time.","Admit that the cause of loss is a covered peril under the policy."]);
items.push({id:`disc-${c.id}-${s}-${q}`,num:q+1,text:qText,status:pk(["pending","drafted","reviewed","final","objection_only"]),objections:rng()>0.4?[pk(OBJ_TEMPLATES).id]:[],response:rng()>0.5?pk(["See documents produced herewith.","Subject to and without waiving said objections, Plaintiff responds as follows:","Admitted.","Denied.","Plaintiff is without sufficient knowledge to admit or deny and therefore denies.",""]):"",aiDraft:null,dueDate});}
r.push({id:`dset-${c.id}-${s}`,type:dtype,setNum:s+1,servedDate,dueDate,from:c.ld?c.ld.oppCounsel:"Unknown",status:pk(["pending","in_progress","completed","overdue"]),items});}
return r;});

const[selSet,setSelSet]=useState(null);
const[selItem,setSelItem]=useState(null);
const[aiLoading,setAiLoading]=useState(false);
const[aiDraft,setAiDraft]=useState("");
const[showTemplates,setShowTemplates]=useState(false);

const activeSet=requests.find(r=>r.id===selSet);
const activeItem=activeSet?activeSet.items.find(i=>i.id===selItem):null;

const toggleObj=(itemId,objId)=>{setRequests(prev=>prev.map(set=>({...set,items:set.items.map(item=>{if(item.id!==itemId)return item;const has=item.objections.includes(objId);return{...item,objections:has?item.objections.filter(o=>o!==objId):[...item.objections,objId]};})
})));};

const updateResponse=(itemId,text)=>{setRequests(prev=>prev.map(set=>({...set,items:set.items.map(item=>item.id===itemId?{...item,response:text}:item)})));};

const updateStatus=(itemId,st)=>{setRequests(prev=>prev.map(set=>({...set,items:set.items.map(item=>item.id===itemId?{...item,status:st}:item)})));};

const generateAiDraft=async(item)=>{
setAiLoading(true);setAiDraft("");
try{
const selectedObjs=item.objections.map(oId=>OBJ_TEMPLATES.find(t=>t.id===oId)).filter(Boolean);
const prompt=`You are a litigation attorney at a plaintiff-side insurance law firm. Draft a response to the following discovery request in a first-party property insurance case.\n\nCase: ${c.client} v. ${c.insurer}\nJurisdiction: ${c.juris}\nCase Type: ${c.type}\nCause of Loss: ${c.cd.causeOfLoss}\n\nDiscovery Request #${item.num}:\n"${item.text}"\n\n${selectedObjs.length>0?`Apply these objections first:\n${selectedObjs.map(o=>"- "+o.text).join("\n")}\n\nThen provide a substantive response after the objections.`:"Provide a direct substantive response."}\n\nFormat: Start with any objections, then "Subject to and without waiving the foregoing objections, Plaintiff responds as follows:" followed by the substantive response. Be thorough but concise. Use proper legal formatting.`;
const resp=await fetch("/api/discovery",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})});
const data=await resp.json();
const text=data.text||"Error generating response.";
setAiDraft(text);
updateResponse(item.id,text);
updateStatus(item.id,"drafted");
}catch(e){setAiDraft("Error: "+e.message);}
setAiLoading(false);};

const dSetClr=st=>({pending:B.gold,in_progress:"#5b8def",completed:B.green,overdue:B.danger}[st]||B.txtM);
const dItemClr=st=>({pending:B.txtM,drafted:"#5b8def",reviewed:B.gold,final:B.green,objection_only:B.purple}[st]||B.txtM);

if(!c.status.startsWith("Litigation"))return(<div style={{...S.card,padding:60,textAlign:"center"}}><div style={{fontSize:40,marginBottom:12}}>{"\ud83d\udcdd"}</div><div style={{fontSize:16,fontWeight:600,marginBottom:8}}>Not in Litigation</div><div style={{fontSize:13,color:B.txtM}}>Discovery tools will be available once the case enters litigation.</div></div>);

if(activeItem){
const selObjs=activeItem.objections;
return(<div>
<button onClick={()=>setSelItem(null)} style={{...S.btnO,marginBottom:16,fontSize:12}}>{"\u2190"} Back to {activeSet.type}</button>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
<div>
<div style={{...S.card,marginBottom:16}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
<h3 style={{fontSize:14,fontWeight:700}}>Request #{activeItem.num}</h3>
<select value={activeItem.status} onChange={e=>updateStatus(activeItem.id,e.target.value)} style={{...S.input,width:140,fontSize:12}}><option value="pending">Pending</option><option value="drafted">Drafted</option><option value="reviewed">Reviewed</option><option value="final">Final</option><option value="objection_only">Objection Only</option></select>
</div>
<div style={{background:"#0a0a14",borderRadius:8,padding:16,fontSize:13,lineHeight:1.7,color:B.txt,border:`1px solid ${B.bdr}`}}>{activeItem.text}</div>
</div>
<div style={{...S.card}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
<h3 style={{fontSize:14,fontWeight:700}}>Objections</h3>
<button onClick={()=>setShowTemplates(!showTemplates)} style={{...S.btnO,fontSize:11,padding:"4px 10px"}}>{showTemplates?"Hide":"Show All"}</button>
</div>
{(showTemplates?OBJ_TEMPLATES:OBJ_TEMPLATES.filter(o=>selObjs.includes(o.id))).map(obj=>{
const active=selObjs.includes(obj.id);
return(<div key={obj.id} onClick={()=>toggleObj(activeItem.id,obj.id)} style={{display:"flex",gap:10,padding:"8px 12px",marginBottom:4,borderRadius:6,cursor:"pointer",background:active?`${B.gold}10`:"transparent",border:`1px solid ${active?B.gold+"40":B.bdr}`}}>
<div style={{width:18,height:18,borderRadius:4,border:`2px solid ${active?B.gold:B.bdr}`,background:active?B.gold:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#000",flexShrink:0,marginTop:2}}>{active?"\u2713":""}</div>
<div><div style={{fontSize:12,fontWeight:600,color:active?B.gold:B.txtM,marginBottom:2}}>{obj.name}</div>
{(showTemplates||active)&&<div style={{fontSize:11,color:B.txtD,lineHeight:1.5}}>{obj.text}</div>}</div>
</div>);})}
</div>
</div>
<div>
<div style={{...S.card,marginBottom:16}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
<h3 style={{fontSize:14,fontWeight:700}}>Response</h3>
<button onClick={()=>generateAiDraft(activeItem)} disabled={aiLoading} style={{...S.btn,fontSize:12,padding:"6px 14px",opacity:aiLoading?0.5:1}}>{aiLoading?"\u23f3 Generating...":"\u2728 AI Draft"}</button>
</div>
<textarea value={activeItem.response} onChange={e=>updateResponse(activeItem.id,e.target.value)} placeholder="Type response or click AI Draft to generate..." style={{...S.input,minHeight:300,resize:"vertical",lineHeight:1.7,fontSize:13}} />
</div>
{aiDraft&&<div style={{...S.card,background:"#0a0a14"}}>
<div style={{fontSize:11,color:B.gold,fontWeight:600,marginBottom:8,textTransform:"uppercase",letterSpacing:0.5}}>AI Generated Draft</div>
<div style={{fontSize:13,color:B.txt,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{aiDraft}</div>
</div>}
</div>
</div></div>);}

if(activeSet){
const completed=activeSet.items.filter(i=>i.status==="final"||i.status==="reviewed").length;
const drafted=activeSet.items.filter(i=>i.status==="drafted").length;
return(<div>
<button onClick={()=>setSelSet(null)} style={{...S.btnO,marginBottom:16,fontSize:12}}>{"\u2190"} Back to Discovery Sets</button>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
<div><h3 style={{fontSize:18,fontWeight:700}}>{activeSet.type} — Set {activeSet.setNum}</h3>
<div style={{fontSize:12,color:B.txtM,marginTop:4}}>From: {activeSet.from} · Served: {fmtD(activeSet.servedDate)} · Due: <span style={{color:dU(activeSet.dueDate)<7?B.danger:dU(activeSet.dueDate)<14?B.gold:B.txtM,fontWeight:600}}>{fmtD(activeSet.dueDate)} ({dU(activeSet.dueDate)}d)</span></div></div>
<div style={{display:"flex",gap:8}}>
<div style={{textAlign:"center",padding:"8px 16px",background:`${B.green}15`,borderRadius:8}}><div style={{...S.mono,fontSize:16,fontWeight:700,color:B.green}}>{completed}</div><div style={{fontSize:10,color:B.txtD}}>Done</div></div>
<div style={{textAlign:"center",padding:"8px 16px",background:`rgba(91,141,239,0.12)`,borderRadius:8}}><div style={{...S.mono,fontSize:16,fontWeight:700,color:"#5b8def"}}>{drafted}</div><div style={{fontSize:10,color:B.txtD}}>Drafted</div></div>
<div style={{textAlign:"center",padding:"8px 16px",background:`${B.gold}15`,borderRadius:8}}><div style={{...S.mono,fontSize:16,fontWeight:700,color:B.gold}}>{activeSet.items.length-completed-drafted}</div><div style={{fontSize:10,color:B.txtD}}>Pending</div></div>
</div></div>
<div style={{...S.card,padding:0,overflow:"hidden"}}>
<table style={S.tbl}><thead><tr><th style={S.th}>#</th><th style={{...S.th,width:"50%"}}>Request</th><th style={S.th}>Objections</th><th style={S.th}>Status</th><th style={S.th}></th></tr></thead><tbody>
{activeSet.items.map(item=>{const ic=dItemClr(item.status);return(<tr key={item.id} style={{cursor:"pointer"}} onClick={()=>setSelItem(item.id)} onMouseEnter={e=>e.currentTarget.style.background=B.cardH} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
<td style={{...S.td,...S.mono,fontSize:12,color:B.gold}}>{item.num}</td>
<td style={{...S.td,fontSize:12,color:B.txt,maxWidth:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.text.substring(0,100)}{item.text.length>100?"...":""}</td>
<td style={S.td}>{item.objections.length>0?<span style={{...S.badge,background:`${B.purple}18`,color:B.purple}}>{item.objections.length}</span>:<span style={{fontSize:11,color:B.txtD}}>None</span>}</td>
<td style={S.td}><span style={{...S.badge,background:`${ic}18`,color:ic}}>{item.status.replace("_"," ").replace(/\b\w/g,l=>l.toUpperCase())}</span></td>
<td style={{...S.td,fontSize:12,color:B.gold}}>{"\u2192"}</td>
</tr>);})}
</tbody></table></div></div>);}

return(<div>
<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
{requests.map(set=>{const dc=dSetClr(set.status);const days=dU(set.dueDate);const done=set.items.filter(i=>i.status==="final"||i.status==="reviewed").length;
return(<div key={set.id} onClick={()=>setSelSet(set.id)} style={{...S.card,cursor:"pointer",borderColor:dc+"30"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
<span style={{...S.badge,background:`${dc}18`,color:dc}}>{set.status.replace("_"," ").replace(/\b\w/g,l=>l.toUpperCase())}</span>
<span style={{...S.mono,fontSize:11,color:days<7?B.danger:days<14?B.gold:B.txtD}}>{days}d left</span></div>
<h4 style={{fontSize:14,fontWeight:600,marginBottom:4}}>{set.type}</h4>
<div style={{fontSize:12,color:B.txtM,marginBottom:8}}>Set {set.setNum} · {set.items.length} requests · From: {set.from}</div>
<div style={{fontSize:11,color:B.txtD,marginBottom:8}}>Served: {fmtD(set.servedDate)} · Due: {fmtD(set.dueDate)}</div>
<div style={{height:6,background:`${B.bdr}40`,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${(done/set.items.length)*100}%`,background:B.green,borderRadius:3}}/></div>
<div style={{fontSize:10,color:B.txtD,marginTop:4}}>{done}/{set.items.length} complete</div>
</div>);})}
{requests.length===0&&<div style={{...S.card,gridColumn:"1/-1",padding:40,textAlign:"center"}}><div style={{fontSize:14,color:B.txtM}}>No discovery requests served yet.</div></div>}
</div></div>);}

function CaseDetail({c,onBack}){
const[tab,setTab]=useState("activity");
const tabs=[{id:"activity",l:"Activity Feed"},{id:"claim",l:"Claim Details"},{id:"litigation",l:"Litigation"},{id:"negotiations",l:"Negotiations"},{id:"estimates",l:"Estimates"},{id:"pleadings",l:"Pleadings"},{id:"discovery",l:"Discovery"},{id:"tasks",l:"Tasks"},{id:"docs",l:"Documents"}];
const sc=stClr(c.status);const sd=dU(c.sol);
return(<div>
<div style={{marginBottom:20}}>
<button onClick={onBack} style={{...S.btnO,marginBottom:16,fontSize:12}}>{"\u2190"} Back to Cases</button>
<div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
<div><h2 style={{fontSize:22,fontWeight:700,marginBottom:4}}>{c.client}</h2>
<div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
<span style={{...S.mono,fontSize:13,color:B.gold}}>{c.ref}</span>
<span style={{...S.badge,background:sc.bg,color:sc.t}}>{c.status}</span>
<span style={{fontSize:12,color:B.txtM}}>{c.type}</span>
<span style={{...S.mono,fontSize:12,color:B.txtM}}>{c.juris}</span>
<span style={{fontSize:12,color:B.txtM}}>v. {c.insurer}</span></div></div>
<div style={{textAlign:"right"}}><div style={{fontSize:11,color:B.txtD,marginBottom:2}}>SOL</div><div style={{...S.mono,fontSize:16,fontWeight:700,color:sd<30?B.danger:sd<90?B.gold:B.green}}>{fmtD(c.sol)}</div><div style={{...S.mono,fontSize:11,color:sd<30?B.danger:sd<90?B.gold:B.txtD}}>{sd} days</div></div></div></div>
<div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:20}}>
{[{l:"Attorney",v:c.attorney.name.split(" ")[0],c:c.attorney.clr},{l:"Support",v:c.support.name.split(" ")[0],c:c.support.clr},{l:"Date of Loss",v:fmtD(c.dol),c:B.txtM},{l:"Negotiations",v:c.negs.length,c:"#5b8def"},{l:"Recovery",v:c.totalRec>0?fmt(c.totalRec):"\u2014",c:c.totalRec>0?B.green:B.txtD}].map((x,i)=>(<div key={i} style={{...S.card,padding:"12px 16px"}}><div style={{fontSize:10,color:B.txtD,textTransform:"uppercase",letterSpacing:0.5,fontWeight:600,marginBottom:4}}>{x.l}</div><div style={{fontSize:14,fontWeight:600,color:x.c}}>{x.v}</div></div>))}</div>
<div style={{display:"flex",gap:4,marginBottom:20,borderBottom:`1px solid ${B.bdr}`,paddingBottom:0}}>
{tabs.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"10px 16px",border:"none",borderBottom:tab===t.id?`2px solid ${B.gold}`:"2px solid transparent",background:"transparent",color:tab===t.id?B.gold:B.txtM,fontSize:13,fontWeight:tab===t.id?600:400,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",marginBottom:-1}}>
{t.l}{t.id==="negotiations"&&c.negs.length>0&&<span style={{marginLeft:6,...S.mono,fontSize:10,background:`${B.gold}20`,color:B.gold,padding:"1px 6px",borderRadius:10}}>{c.negs.length}</span>}{t.id==="pleadings"&&c.pleads.length>0&&<span style={{marginLeft:6,...S.mono,fontSize:10,background:`${B.purple}20`,color:B.purple,padding:"1px 6px",borderRadius:10}}>{c.pleads.length}</span>}
</button>))}</div>
{tab==="activity"&&<ActivityFeed c={c}/>}
{tab==="claim"&&<ClaimDetails c={c}/>}
{tab==="litigation"&&<LitDetails c={c}/>}
{tab==="negotiations"&&<Negotiations c={c}/>}
{tab==="estimates"&&<Estimates c={c}/>}
{tab==="pleadings"&&<Pleadings c={c}/>}
{tab==="discovery"&&<Discovery c={c}/>}
{tab==="tasks"&&<div style={{...S.card,padding:40,textAlign:"center"}}><div style={{fontSize:14,color:B.txtM}}>Tasks — wiring to Supabase next</div></div>}
{tab==="docs"&&<div style={{...S.card,padding:40,textAlign:"center"}}><div style={{fontSize:14,color:B.txtM}}>Documents — wiring to SharePoint next</div></div>}
</div>);}

export default function DenhamStaffPortal(){
const[user,setUser]=useState(null);const[page,setPage]=useState("dashboard");const[selCase,setSelCase]=useState(null);
const cases=useMemo(()=>genData(),[]);
if(!user)return<Login onLogin={setUser}/>;
const openC=c=>{setSelCase(c);setPage("caseDetail");};
const backC=()=>{setSelCase(null);setPage("cases");};
return(<div style={{display:"flex",minHeight:"100vh",background:B.bg}}>
<Side user={user} active={page==="caseDetail"?"cases":page} onNav={p=>{setPage(p);setSelCase(null);}} onOut={()=>setUser(null)}/>
<div style={{marginLeft:220,flex:1,padding:"28px 32px",maxWidth:1200}}>
{page==="dashboard"&&<Dash user={user} cases={cases} onOpen={openC}/>}
{page==="cases"&&<Cases user={user} cases={cases} onOpen={openC}/>}
{page==="caseDetail"&&selCase&&<CaseDetail c={selCase} onBack={backC}/>}
{page==="tasks"&&<div><h2 style={{fontSize:22,fontWeight:700,marginBottom:20}}>Tasks</h2><div style={{...S.card,padding:40,textAlign:"center"}}><div style={{fontSize:14,color:B.txtM}}>Global tasks view — coming soon</div></div></div>}
{page==="docs"&&<div><h2 style={{fontSize:22,fontWeight:700,marginBottom:20}}>Documents</h2><div style={{...S.card,padding:40,textAlign:"center"}}><div style={{fontSize:14,color:B.txtM}}>Global documents view — coming soon</div></div></div>}
</div></div>);}
