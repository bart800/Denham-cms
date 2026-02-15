import { useState, useMemo } from "react";
const B={navy:"#000066",gold:"#ebb003",green:"#386f4a",bg:"#08080f",card:"#111119",bdr:"#1e1e2e",txt:"#e8e8f0",txtM:"#8888a0",txtD:"#55556a",danger:"#e04050",greenBg:"rgba(56,111,74,0.12)",goldBg:"rgba(235,176,3,0.1)"};
const S={card:{background:B.card,border:`1px solid ${B.bdr}`,borderRadius:10,padding:20},badge:{display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600},mono:{fontFamily:"'JetBrains Mono',monospace"},secT:{fontSize:15,fontWeight:700,color:B.txt,marginBottom:16}};
const fmt=n=>"$"+Number(n).toLocaleString("en-US");

export default function DenhamCMS(){
return(<div style={{minHeight:"100vh",background:B.bg,padding:"32px 40px"}}>
<div style={{display:"flex",alignItems:"center",gap:12,marginBottom:32}}>
<div style={{width:40,height:40,borderRadius:10,background:`linear-gradient(135deg,${B.navy},${B.gold})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:"#fff"}}>D</div>
<div><h1 style={{fontSize:22,fontWeight:700}}>DENHAM CMS</h1><p style={{fontSize:12,color:B.txtD}}>Management Dashboard</p></div></div>
<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:32}}>
{[{l:"Total Cases",v:"200",c:B.gold},{l:"Active Cases",v:"142",c:"#5b8def"},{l:"YTD Recoveries",v:"$8.2M",c:B.green},{l:"Attorneys",v:"5",c:"#c77dba"}].map((x,i)=>(<div key={i} style={S.card}><div style={{fontSize:11,color:B.txtM,marginBottom:6,textTransform:"uppercase",letterSpacing:0.5,fontWeight:600}}>{x.l}</div><div style={{fontSize:28,fontWeight:700,color:x.c,...S.mono}}>{x.v}</div></div>))}</div>
<div style={S.card}><h3 style={S.secT}>Admin dashboard — full build in progress</h3><p style={{color:B.txtM,fontSize:14}}>Firm-wide KPIs, all cases view, settlement pipeline, deadline calendar, and intake queue will be available here. Use the Staff Portal at / for case-level work.</p></div>
</div>);}
