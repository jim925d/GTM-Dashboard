import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, AreaChart, Area, CartesianGrid } from "recharts";

const T = { bg:"#0B0F19",card:"#111827",alt:"#1A2035",srf:"#1F2A40",bdr:"#1F2937",bdrl:"#374151",txt:"#E5E7EB",dim:"#9CA3AF",fnt:"#6B7280",cy:"#22D3EE",gn:"#34D399",pu:"#A78BFA",rd:"#F87171",am:"#FBBF24",bl:"#60A5FA" };
const mono = "'IBM Plex Mono',monospace";

const MKTS = [
  { id:"nyc",city:"New York",st:"NY",lat:40.71,lng:-74.01,deals:55,closed:248200,pipe:68200,on:28,tot:42,mod:1.10,ctx:"Favorable — financial capex loosening + AI fiber demand",
    verts:[{n:"Finance",d:28,m:118400},{n:"Media",d:12,m:52600},{n:"Tech",d:9,m:42800}],
    prods:[{n:"Ethernet",p:28},{n:"Dark Fiber",p:23},{n:"Wavelengths",p:16},{n:"zColo",p:14}],
    evts:[{t:"macro",l:"Macro",x:"Fed easing — financial budgets opening",d:"Mar 12"},{t:"tech",l:"Tech",x:"AI trading infra driving fiber demand",d:"Mar 8"}],
    out:null,
    accts:[
      {nm:"Apex Financial",vt:"Finance",tmr:2408,dl:3,on:true,nrr:1.04,hp:65,md:1.18,ot:false,ds:4,intel:"Fed easing — financial budgets unlocking",has:["Ethernet","SD-WAN","IP Svc"],gaps:["zColo","DDoS","Dark Fiber"],g$:22400,tk:"SD-WAN across 6 states but NYC HQ has no colo or DDoS — compliance gap. Bundle at preferred rate."},
      {nm:"Metro Media",vt:"Media",tmr:3183,dl:4,on:true,nrr:1.11,hp:80,md:1.10,ot:false,ds:2,intel:null,has:["Dark Fiber","Ethernet","WL"],gaps:["zColo","DDoS"],g$:16800,tk:"Content at scale — need colo near peering. 60 Hudson is where their traffic terminates."},
    ]},
  { id:"dallas",city:"Dallas",st:"TX",lat:32.78,lng:-96.80,deals:62,closed:224800,pipe:58100,on:22,tot:31,mod:1.08,ctx:"Favorable — carrier consolidation creating switching",
    verts:[{n:"Carrier",d:24,m:96200},{n:"Data Centers",d:15,m:58400},{n:"Tech",d:11,m:38600}],
    prods:[{n:"Dark Fiber",p:32},{n:"Wavelengths",p:18},{n:"Ethernet",p:16},{n:"zColo",p:14}],
    evts:[{t:"ma",l:"M&A",x:"Lumen exploring strategic alternatives",d:"Mar 14"}],out:null,
    accts:[
      {nm:"TerraWave Comm",vt:"Carrier",tmr:15533,dl:8,on:true,nrr:0.94,hp:52,md:1.08,ot:false,ds:12,intel:"Lumen strategic review — long-haul provider may exit enterprise",has:["Dark Fiber","WL Metro","Ethernet","IP Svc","zColo"],gaps:["WL Long Haul","DDoS"],g$:37600,tk:"Biggest metro fiber customer buying long-haul elsewhere. Bundle beats their carrier by 25%."},
      {nm:"Nexus Data",vt:"Data Centers",tmr:7850,dl:5,on:true,nrr:1.08,hp:72,md:1.08,ot:false,ds:6,intel:"Nokia 800G ZR launch creates upgrade window",has:["Dark Fiber","zColo"],gaps:["WL Long Haul","DDoS","Ethernet"],g$:22400,tk:"Growing DC — dark fiber maxed, needs wavelengths. 800G ZR tech angle nobody else has."},
    ]},
  { id:"denver",city:"Denver",st:"CO",lat:39.74,lng:-104.99,deals:48,closed:186400,pipe:41200,on:14,tot:19,mod:1.12,ctx:"Strong tailwind — BEAD + AI colo demand",
    verts:[{n:"Tech",d:18,m:68200},{n:"Healthcare",d:12,m:42300},{n:"Finance",d:9,m:38100}],
    prods:[{n:"Ethernet",p:34},{n:"Dark Fiber",p:22},{n:"zColo",p:17},{n:"IP Services",p:14}],
    evts:[{t:"tech",l:"Tech",x:"AI DC buildout accelerating in Denver",d:"Mar 14"},{t:"reg",l:"Reg",x:"Colorado BEAD: $826M allocated",d:"Feb 28"}],out:null,
    accts:[
      {nm:"Meridian Health",vt:"Healthcare",tmr:3550,dl:4,on:true,nrr:1.12,hp:78,md:1.14,ot:false,ds:6,intel:"BEAD $826M allocated to Colorado",has:["Ethernet","IP Svc","zColo"],gaps:["Dark Fiber","SD-WAN"],g$:12700,tk:"3 DCs on-net running lit — dark fiber saves 40-60%. BEAD = best window in 18 months."},
      {nm:"CloudNexus",vt:"Tech",tmr:5600,dl:6,on:true,nrr:1.22,hp:88,md:1.09,ot:false,ds:2,intel:"AI DC buildout accelerating — their sector driving demand",has:["Dark Fiber","zColo","Ethernet","DDoS","IP Svc"],gaps:["Wavelengths"],g$:18000,tk:"NRR 1.22 — fastest growing. Wavelengths before they outgrow lit."},
      {nm:"Alpine Financial",vt:"Finance",tmr:2408,dl:2,on:true,nrr:1.04,hp:65,md:1.18,ot:false,ds:14,intel:"Fed easing — financial budgets unlocking",has:["Ethernet","SD-WAN"],gaps:["zColo","DDoS"],g$:15200,tk:"SD-WAN but no colo/DDoS — compliance gap. Bundle into existing."},
      {nm:"Peak Logistics",vt:"Mfg",tmr:0,dl:0,on:false,nrr:null,hp:null,md:1.12,ot:false,ds:null,intel:null,has:[],gaps:["Ethernet","IP Svc","SD-WAN"],g$:6800,tk:"Greenfield — 4 warehouses. Vertical pattern: Ethernet + SD-WAN. On-net Q1."},
    ]},
  { id:"phx",city:"Phoenix",st:"AZ",lat:33.45,lng:-112.07,deals:28,closed:98600,pipe:24300,on:10,tot:15,mod:1.06,ctx:"Moderate tailwind + active outage",
    verts:[{n:"Healthcare",d:10,m:36200},{n:"Tech",d:8,m:28400}],
    prods:[{n:"Ethernet",p:35},{n:"zColo",p:20},{n:"IP Services",p:15}],
    evts:[{t:"outage",l:"Outage",x:"Cox Phoenix — 15K+ business customers affected",d:"Mar 18"}],
    out:{x:"Cox outage — 15K+ impacted",op:"Redundancy for 6 single-carrier accounts"},
    accts:[
      {nm:"Desert Health",vt:"Healthcare",tmr:1533,dl:2,on:true,nrr:1.01,hp:62,md:1.14,ot:true,ds:1,intel:"Cox outage ongoing since Mar 18",has:["Ethernet"],gaps:["Dark Fiber","SD-WAN","DDoS"],g$:9200,tk:"Cox outage hit 3 clinics. Single-carrier, no failover — the redundancy pitch."},
      {nm:"SunBelt Tech",vt:"Tech",tmr:1017,dl:1,on:true,nrr:1.15,hp:70,md:1.06,ot:true,ds:3,intel:"Cox outage ongoing since Mar 18",has:["Ethernet","IP Svc"],gaps:["zColo","SD-WAN"],g$:8400,tk:"Fast SaaS on single ethernet. SD-WAN + colo = natural bundle."},
    ]},
  { id:"atl",city:"Atlanta",st:"GA",lat:33.75,lng:-84.39,deals:32,closed:118400,pipe:21800,on:12,tot:18,mod:0.96,ctx:"Headwind — Brightspeed + macro drag",
    verts:[{n:"Carrier",d:12,m:48200},{n:"Healthcare",d:8,m:28600}],
    prods:[{n:"Ethernet",p:33},{n:"IP Services",p:21},{n:"Dark Fiber",p:17}],
    evts:[{t:"ma",l:"M&A",x:"Brightspeed transition disrupting Southeast",d:"Mar 10"},{t:"macro",l:"Macro",x:"SE capex flat — tariff uncertainty",d:"Mar 2"}],
    out:{x:"Brightspeed transition — Lumen customers impacted",op:"4 legacy Lumen accounts — migration opp"},
    accts:[
      {nm:"Peachtree Health",vt:"Healthcare",tmr:1900,dl:2,on:true,nrr:0.92,hp:44,md:0.96,ot:true,ds:24,intel:"Brightspeed disruptions — customers seeking alternatives",has:["Ethernet","IP Svc"],gaps:["SD-WAN","Dark Fiber"],g$:7200,tk:"NRR 0.92 — contracting. Brightspeed pain. Save play first, expansion second."},
    ]},
];

const EXTRA_CHART = [{n:"Chicago",c:162300,p:28600,lat:41.88,lng:-87.63,prods:[{n:"Ethernet",p:30},{n:"Dark Fiber",p:20},{n:"IP Svc",p:17},{n:"WL",p:13}]},{n:"Seattle",c:124800,p:36200,lat:47.61,lng:-122.33,prods:[{n:"Dark Fiber",p:28},{n:"Ethernet",p:24},{n:"zColo",p:18}]},{n:"LA",c:118200,p:42800,lat:34.05,lng:-118.24,prods:[{n:"Ethernet",p:30},{n:"zColo",p:22},{n:"Dark Fiber",p:18}]},{n:"Miami",c:88400,p:22100,lat:25.76,lng:-80.19,prods:[{n:"Ethernet",p:35},{n:"IP Svc",p:22},{n:"Dark Fiber",p:15}]},{n:"DC",c:82600,p:31400,lat:38.91,lng:-77.04,prods:[{n:"Dark Fiber",p:26},{n:"Ethernet",p:24},{n:"WL",p:18}]},{n:"Boston",c:76200,p:18900,lat:42.36,lng:-71.06,prods:[{n:"Ethernet",p:32},{n:"Dark Fiber",p:20},{n:"zColo",p:16}]},{n:"Minneapolis",c:52400,p:14200,lat:44.98,lng:-93.27,prods:[{n:"Ethernet",p:38},{n:"IP Svc",p:22}]},{n:"Portland",c:38600,p:11800,lat:45.52,lng:-122.68,prods:[{n:"Ethernet",p:34},{n:"Dark Fiber",p:20}]},{n:"Nashville",c:34200,p:9400,lat:36.16,lng:-86.78,prods:[{n:"Ethernet",p:36},{n:"IP Svc",p:22}]},{n:"Salt Lake",c:28400,p:8200,lat:40.76,lng:-111.89,prods:[{n:"Ethernet",p:34},{n:"IP Svc",p:20}]}];
const ALL_CHART = [...MKTS.map(m=>({n:m.city,c:m.closed,p:m.pipe})),...EXTRA_CHART].sort((a,b)=>b.c-a.c);

const ec={tech:T.gn,reg:T.bl,ma:T.pu,outage:T.rd,macro:T.am};
const eb={tech:`${T.gn}20`,reg:`${T.bl}20`,ma:`${T.pu}20`,outage:`${T.rd}20`,macro:`${T.am}20`};
const SL={outage:"Outage urgency",intel:"Overnight intel",tailwind:"Market tailwind",whitespace:"Whitespace $",nrrGrowth:"NRR growth",stale:"Engagement decay",onNet:"On-net bonus"};
const PC={"Ethernet":T.cy,"Dark Fiber":T.gn,"Wavelengths":T.pu,"WL":T.pu,"zColo":T.am,"IP Services":T.bl,"IP Svc":T.bl,"SD-WAN":T.rd};
const proj=(lat,lng,w=800,h=480)=>[(lng+125)/58*w,(49-lat)/24*h];
const donutArcs=(prods,r)=>{const C=2*Math.PI*r;let off=0;return prods.map(p=>{const len=C*p.p/100;const d={offset:C-off,length:len,color:PC[p.n]||T.dim,name:p.n,pct:p.p};off+=len;return d;});};

const Mod=({v})=><span className={`mod ${v>1.05?"gn":v<0.98?"am":""}`}>{v>1.05?"▲":v<0.98?"▼":""}{v.toFixed(2)}×</span>;

const Tip=({active,payload,label})=>{
  if(!active||!payload?.length)return null;
  return <div className="chtip"><b>{label}</b>{payload.map((p,i)=><div key={i} style={{color:p.color}}>{p.name}: ${(p.value/1000).toFixed(0)}K</div>)}</div>;
};

function MktRow({m,isOpen,onToggle}){
  const[sort,setSort]=useState("g$");
  const[flt,setFlt]=useState("all");
  const gap=m.accts.reduce((s,a)=>s+a.g$,0);
  const ho=m.accts.some(a=>a.ot);
  const accts=useMemo(()=>{
    let l=[...m.accts];
    if(flt==="outage")l=l.filter(a=>a.ot);if(flt==="onnet")l=l.filter(a=>a.on);if(flt==="new")l=l.filter(a=>a.dl===0);if(flt==="risk")l=l.filter(a=>a.hp&&a.hp<50);
    l.sort((a,b)=>sort==="g$"?b.g$-a.g$:sort==="tmr"?b.tmr-a.tmr:sort==="dl"?b.dl-a.dl:b.md-a.md);return l;
  },[m.accts,sort,flt]);
  return(
    <div className={`mcard${isOpen?" open":""}`}>
      <div className="mhdr" onClick={onToggle}>
        <div className={`mdl${m.out?" rdbox":m.mod>1.05?" gnbox":m.mod<0.98?" ambox":""}`}><b>{m.deals}</b><span>deals</span></div>
        <div className="minfo">
          <div className="mrow"><b className="mcity">{m.city}, {m.st}</b>{m.out&&<span className="tag rd">⚠ OUTAGE</span>}<Mod v={m.mod}/></div>
          <div className="mstats">
            <span>Closed <b className="cy">${(m.closed/1000).toFixed(0)}K</b></span>
            <span>Pipeline <b className="pu">${(m.pipe/1000).toFixed(0)}K</b></span>
            <span>On-net <b className="gn">{m.on}/{m.tot}</b></span>
            <span>Gaps <b className="pu">${(gap/1000).toFixed(0)}K/mo</b></span>
          </div>
        </div>
        <span className="chev">{isOpen?"▲":"▼"}</span>
      </div>
      {isOpen&&<div className="mexp">
        {m.out&&<div className="outalert"><b>⚠ Active Outage</b><p>{m.out.x}</p><p className="wht">{m.out.op}</p></div>}
        <div className="g3">
          <div className="ibox"><p className="ilbl">Top Verticals</p>{m.verts.map((v,i)=><div key={i} className="irow"><span>{v.n}</span><span className="imono">{v.d}d · ${(v.m/1000).toFixed(0)}K</span></div>)}</div>
          <div className="ibox"><p className="ilbl">Product Mix</p>{m.prods.map((p,i)=><div key={i} className="pbar"><div className="pbhdr"><span>{p.n}</span><span className="imono">{p.p}%</span></div><div className="pbtrk"><div className="pbfill" style={{width:`${p.p}%`}}/></div></div>)}</div>
          <div className="ibox"><p className="ilbl">Market Intel</p>{m.evts.map((e,i)=><div key={i} className="evt"><div className="evhdr"><span className="evtag" style={{background:eb[e.t],color:ec[e.t]}}>{e.l}</span><span className="evdt">{e.d}</span></div><p>{e.x}</p></div>)}</div>
        </div>
        <div className="aflt">
          <div className="afltr">
            <b className="ilbl">Accounts ({accts.length})</b>
            {[["all","All"],["onnet","On-Net"],["new","New Logo"],...(m.accts.some(a=>a.hp&&a.hp<50)?[["risk","At Risk"]]:[]),...(ho?[["outage","Outage"]]:[])].map(([k,l])=>
              <button key={k} onClick={e=>{e.stopPropagation();setFlt(k)}} className={`fbtn${flt===k?(k==="outage"?" act-rd":" act"):""}`}>{l}</button>
            )}
          </div>
          <div className="afltr">
            <span className="slbl">Sort</span>
            {[["g$","Gap $"],["tmr","TMR"],["dl","Deals"],["md","Context"]].map(([k,l])=>
              <button key={k} onClick={e=>{e.stopPropagation();setSort(k)}} className={`sbtn${sort===k?" sact":""}`}>{l}</button>
            )}
          </div>
        </div>
        {accts.map((a,i)=>(
          <div key={i} className="acard">
            <div className="ahdr">
              <div><div className="aname"><b>{a.nm}</b><span className="vtag">{a.vt}</span><span className={`ntag${a.on?" gn":" am"}`}>{a.on?"⚡ On-Net":"Off-Net"}</span>{a.ot&&<span className="ntag rd">⚡ Outage</span>}</div>
                <div className="astats"><span>TMR <b className="cy">{a.tmr>0?`$${a.tmr.toLocaleString()}`:"—"}</b></span><span>Deals <b>{a.dl}</b></span>{a.nrr&&<span>NRR <b className={a.nrr>=1?"gn":"rd"}>{a.nrr.toFixed(2)}</b></span>}{a.hp&&<span>Health <b className={a.hp>=70?"gn":a.hp>=40?"am":"rd"}>{a.hp}</b></span>}<Mod v={a.md}/></div>
              </div>
              <div className="agap"><span className="agaplbl">Whitespace</span><b className="agapv">${(a.g$/1000).toFixed(1)}K<small>/mo</small></b></div>
            </div>
            <div className="pills">{a.has.map((p,j)=><span key={j} className="pill">{p}</span>)}{a.gaps.map((g,j)=><span key={`g${j}`} className="pill gap">+ {g}</span>)}</div>
            <div className="talk">{a.tk}</div>
          </div>
        ))}
      </div>}
    </div>
  );
}

export default function GTMPremier(){
  const[pg,setPg]=useState("targets");
  const[exp,setExp]=useState("denver");
  const[vf,setVf]=useState("all");
  const[af,setAf]=useState("all");
  const[of2,setOf]=useState(false);
  const[ce,setCe]=useState(false);
  const[te,setTe]=useState(false);
  const[mv,setMv]=useState("list"); // "list" | "map"
  const[cf,setCf]=useState(null);
  const[tc,setTc]=useState(5);
  const[et,setEt]=useState(null);

  const filt=useMemo(()=>{
    let r=[...MKTS];if(cf)r=r.filter(m=>m.city===cf);if(of2)r=r.filter(m=>m.out);
    if(af==="high")r=r.filter(m=>m.deals>=40);if(af==="tail")r=r.filter(m=>m.mod>1.05);if(af==="head")r=r.filter(m=>m.mod<1.0);
    if(vf!=="all")r=r.filter(m=>m.verts.some(v=>v.n===vf||v.n.startsWith(vf)));
    return r.sort((a,b)=>b.closed-a.closed);
  },[vf,af,of2,cf]);

  const tots=useMemo(()=>({c:MKTS.reduce((s,m)=>s+m.closed,0),p:MKTS.reduce((s,m)=>s+m.pipe,0),g:MKTS.reduce((s,m)=>s+m.accts.reduce((a,x)=>a+x.g$,0),0),on:MKTS.reduce((s,m)=>s+m.on,0),tot:MKTS.reduce((s,m)=>s+m.tot,0),ot:MKTS.filter(m=>m.out).length}),[]);

  const allT=useMemo(()=>{
    const a=[];MKTS.forEach(m=>{m.accts.forEach(x=>{
      let s=0,bd={},tg=[];
      if(x.ot){s+=100;bd.outage=100;tg.push({l:"Outage",c:T.rd})}
      if(x.intel){s+=40;bd.intel=40;tg.push({l:"New Intel",c:T.bl})}
      if(x.md>1.05){s+=25;bd.tailwind=25;tg.push({l:"Tailwind",c:T.gn})}
      const gp=Math.min(x.g$/1000,30);s+=gp;bd.whitespace=Math.round(gp);
      if(x.nrr&&x.nrr>1.10){s+=15;bd.nrrGrowth=15;tg.push({l:`NRR ${x.nrr.toFixed(2)}`,c:T.gn})}
      if(x.ds&&x.ds>14){s+=10;bd.stale=10;tg.push({l:`${x.ds}d silent`,c:T.am})}
      if(x.on){s+=5;bd.onNet=5}
      a.push({...x,mkt:m.city,mid:m.id,sc:Math.round(s),bd,tg,mevts:m.evts,mctx:m.ctx,mmod:m.mod});
    })});return a.sort((a,b)=>b.sc-a.sc);
  },[]);
  const tgts=allT.slice(0,tc);

  const cd=ce?ALL_CHART:ALL_CHART.slice(0,5);
  const pd=[{n:"Ethernet",v:32},{n:"Dark Fiber",v:24},{n:"Wavelengths",v:15},{n:"zColo",v:14},{n:"IP Svc",v:10},{n:"SD-WAN",v:5}];
  const pc2=[T.cy,T.gn,T.pu,T.am,T.bl,T.rd];
  const tdS=[{m:"Oct",v:68200},{m:"Nov",v:72400},{m:"Dec",v:81300},{m:"Jan",v:76100},{m:"Feb",v:84600},{m:"Mar",v:92800}];
  const tdF=[{m:"Apr'25",v:42100},{m:"May",v:48200},{m:"Jun",v:52800},{m:"Jul",v:54100},{m:"Aug",v:58400},{m:"Sep",v:62800},{m:"Oct",v:68200},{m:"Nov",v:72400},{m:"Dec",v:81300},{m:"Jan'26",v:76100},{m:"Feb",v:84600},{m:"Mar",v:92800}];
  const td=te?tdF:tdS;

  return(
    <div className="root">
      <div className="hdr">
        <div><div className="brand"><div className="dot"/>RevOS · GTM Premier</div><h1>Market Intelligence</h1></div>
        <div className="tabs">
          <button onClick={()=>setPg("targets")} className={`tab${pg==="targets"?" tact":""}`}>◎ Today's Targets{allT.some(t=>t.ot)&&<span className="rdot"/>}</button>
          <button onClick={()=>setPg("markets")} className={`tab${pg==="markets"?" tact cy":""}`}>◫ Market Review</button>
        </div>
      </div>

      <div className="body">
        {/* TARGETS */}
        {pg==="targets"&&<div>
          <div className="thdr">
            <div><b>Priority Accounts</b><span className="sub">Ranked: outage → intel → tailwind → whitespace</span></div>
            <div className="thdr-r">
              <span className="sub mono">Updated 6:00 AM · {allT.filter(t=>t.intel).length} intel signals</span>
              <div className="tcnt">{[5,10,allT.length].map(n=><button key={n} onClick={()=>setTc(n)} className={`cnbtn${tc===n?" cnact":""}`}>{n===allT.length?"All":`Top ${n}`}</button>)}</div>
            </div>
          </div>
          <div className="tlist">
            {tgts.map((t,i)=>{const op=et===i;return(
              <div key={i} className={`trow${op?" topen":""}${t.ot?" trow-out":""}`}>
                <div className="trhdr" onClick={()=>setEt(op?null:i)}>
                  <div className={`rank${i<3?" top":""}`}>{i+1}</div>
                  <div className="trinfo">
                    <div className="trname"><b>{t.nm}</b><span className="sub">{t.mkt} · {t.vt}</span>{t.on&&<span className="ntag sm gn">⚡ On</span>}</div>
                    <div className="trtags">{t.tg.map((g,j)=><span key={j} className="ttag" style={{background:`${g.c}20`,color:g.c}}>{g.l}</span>)}</div>
                  </div>
                  <div className="trgap"><span className="pill gap">+ {t.gaps[0]}</span>{t.gaps.length>1&&<span className="sub">+{t.gaps.length-1}</span>}</div>
                  <div className="trval"><b>${(t.g$/1000).toFixed(0)}K</b><span>/mo</span></div>
                  <div className="sbox" title={Object.entries(t.bd).map(([k,v])=>`${SL[k]||k}: +${v}`).join('\n')+`\nTotal: ${t.sc}`}>
                    <b style={{color:t.sc>=100?T.rd:t.sc>=60?T.pu:T.cy}}>{t.sc}</b><span>score</span>
                  </div>
                  <Mod v={t.md}/>
                  <span className="chev">{op?"▲":"▼"}</span>
                </div>
                {op&&<div className="trexp">
                  <div className="g2">
                    <div>
                      <div className="astats mb">{[
                        ["TMR",t.tmr>0?`$${t.tmr.toLocaleString()}`:"—","cy"],
                        ["Deals",t.dl,""],
                        ...(t.nrr?[["NRR",t.nrr.toFixed(2),t.nrr>=1?"gn":"rd"]]:[]),
                        ...(t.hp?[["Health",t.hp,t.hp>=70?"gn":t.hp>=40?"am":"rd"]]:[]),
                        [t.ds?`${t.ds}d since contact`:"No history","","sub"]
                      ].map(([l,v,c],j)=>c==="sub"?<span key={j} className="sub">{l}</span>:<span key={j}>{l} <b className={c}>{v}</b></span>)}</div>
                      <p className="ilbl">Products</p>
                      <div className="pills mb">{t.has.map((p,j)=><span key={j} className="pill">{p}</span>)}{t.gaps.map((g,j)=><span key={`g${j}`} className="pill gap">+ {g}</span>)}</div>
                      <p className="ilbl">Conversation Strategy</p>
                      <div className="talk">{t.tk}</div>
                    </div>
                    <div>
                      {t.intel&&<div className="intelbox"><p className="ilbl bl">Overnight Intel</p><p>{t.intel}</p></div>}
                      <p className="ilbl">Market Context — {t.mkt}</p>
                      <p className={`mctx${t.mmod>1.05?" gn":t.mmod<0.98?" am":""}`}>{t.mctx}</p>
                      <div className="evtlist">{t.mevts.map((e,j)=><div key={j} className="evt"><div className="evhdr"><span className="evtag" style={{background:eb[e.t],color:ec[e.t]}}>{e.l}</span><span className="evdt">{e.d}</span></div><p>{e.x}</p></div>)}</div>
                      <button className="mkbtn" onClick={()=>{setPg("markets");setCf(t.mkt);setExp(t.mid)}}>◎ View {t.mkt} market →</button>
                    </div>
                  </div>
                </div>}
              </div>
            );})}
          </div>
        </div>}

        {/* MARKETS */}
        {pg==="markets"&&<>
          <div className="krow">{[
            ["CLOSED 12M",`$${(tots.c/1000).toFixed(0)}K`,"+12.3%","cy"],
            ["PIPELINE WTD",`$${(tots.p/1000).toFixed(0)}K`,"+8.1%","pu"],
            ["WHITESPACE",`$${(tots.g/1000).toFixed(0)}K/mo`,null,"pu"],
            ["ON-NET",`${tots.on}/${tots.tot}`,`${Math.round(tots.on/tots.tot*100)}%`,"gn"],
            ["OUTAGE ALERTS",tots.ot,null,tots.ot>0?"rd":"fnt"],
          ].map(([l,v,tr,c],i)=><div key={i} className="kpi"><span className="klbl">{l}</span><b className={`kval ${c}`}>{v}</b>{tr&&<span className={`ktrend ${c}`}>▲ {tr}</span>}</div>)}</div>

          {/* Map / List toggle */}
          <div className="mvtog">
            <button onClick={()=>setMv("map")} className={`tab sm${mv==="map"?" tact":""}`}>◉ Map View</button>
            <button onClick={()=>setMv("list")} className={`tab sm${mv==="list"?" tact cy":""}`}>☰ List View</button>
          </div>

          {/* ── MAP VIEW ── */}
          {mv==="map"&&<div className="mapcard">
            <svg viewBox="0 0 800 480" className="mapsvg">
              {/* US outline simplified */}
              <path d="M92,140 L108,128 C140,112,180,108,210,105 C250,100,290,96,330,100 C370,104,410,100,450,106 C490,110,530,116,560,120 C580,124,600,130,614,138 L620,148 C616,158,600,168,588,172 C570,178,548,180,528,176 C506,174,484,178,462,180 C438,184,414,188,390,184 C366,188,340,192,316,190 C290,194,264,198,238,196 C212,200,186,204,160,202 C136,206,112,208,92,204 C78,200,68,196,62,188 C60,180,64,172,72,164 C80,156,86,148,92,140 Z" fill={T.srf} stroke={T.bdr} strokeWidth="1" opacity="0.6"/>
              {/* Grid */}
              {[150,250,350,450,550,650].map(x=><line key={x} x1={x} y1={80} x2={x} y2={420} stroke={T.bdr} strokeWidth="0.3" opacity="0.15"/>)}
              {[120,180,240,300,360].map(y=><line key={y} x1={80} y1={y} x2={720} y2={y} stroke={T.bdr} strokeWidth="0.3" opacity="0.15"/>)}

              {/* Market donut bubbles */}
              {[...MKTS.map(m=>({n:m.city,lat:m.lat,lng:m.lng,d:m.deals,c:m.closed,prods:m.prods,out:!!m.out,mod:m.mod,id:m.id})),...EXTRA_CHART.map(e=>({n:e.n,lat:e.lat,lng:e.lng,d:Math.round(e.c/4000),c:e.c,prods:e.prods||[],out:false,mod:1.0}))].map((m,i)=>{
                const[cx,cy]=proj(m.lat,m.lng);
                const maxD=62;const r=Math.max(12,Math.min(32,m.d/maxD*32));
                const arcs=donutArcs(m.prods,r*0.7);
                const circ=2*Math.PI*r*0.7;
                return(
                  <g key={i} style={{cursor:"pointer"}} onClick={()=>{const mt=MKTS.find(x=>x.city===m.n);if(mt){setCf(m.n);setExp(mt.id);setMv("list");}}} >
                    {/* Glow */}
                    <circle cx={cx} cy={cy} r={r+3} fill="none" stroke={m.out?T.rd:m.mod>1.05?T.gn:T.cy} strokeWidth="1" opacity="0.15"/>
                    {/* Heatspot background */}
                    <circle cx={cx} cy={cy} r={r} fill={m.out?`${T.rd}15`:m.mod>1.05?`${T.gn}10`:`${T.cy}08`}/>
                    {/* Product donut segments */}
                    {arcs.map((a,j)=><circle key={j} cx={cx} cy={cy} r={r*0.7} fill="none" stroke={a.color} strokeWidth={r*0.45} strokeDasharray={`${a.length} ${circ-a.length}`} strokeDashoffset={a.offset} opacity="0.8" transform={`rotate(-90 ${cx} ${cy})`}/>)}
                    {/* Center: deal count */}
                    <circle cx={cx} cy={cy} r={r*0.38} fill={T.card}/>
                    <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="central" fill={T.txt} fontSize={r>20?"11":"9"} fontWeight="700" fontFamily={mono}>{m.d}</text>
                    {/* City label */}
                    <text x={cx} y={cy+r+14} textAnchor="middle" fill={T.dim} fontSize="10" fontFamily="'IBM Plex Sans'">{m.n}</text>
                    <text x={cx} y={cy+r+25} textAnchor="middle" fill={T.fnt} fontSize="9" fontFamily={mono}>${(m.c/1000).toFixed(0)}K</text>
                    {m.out&&<text x={cx+r+4} y={cy-r+4} fill={T.rd} fontSize="12">⚠</text>}
                  </g>
                );
              })}
            </svg>
            {/* Product color legend */}
            <div className="mapleg">
              <span className="sub">Product spectrum:</span>
              {[["Ethernet",T.cy],["Dark Fiber",T.gn],["Wavelengths",T.pu],["zColo",T.am],["IP Services",T.bl],["SD-WAN",T.rd]].map(([n,c],i)=>
                <span key={i} className="legd"><span className="lbox" style={{background:c}}/>{n}</span>
              )}
              <span style={{flex:1}}/>
              <span className="sub">Bubble size = deals · Ring segments = product mix · Click to drill in</span>
            </div>
          </div>}

          {/* ── LIST VIEW ── */}
          {mv==="list"&&<>
          <div className={`chrow${ce?" full":""}`}>
            <div className="chcard lg">
              <div className="chhdr"><div><b>Revenue by Market</b><p className="sub">{ce?`All ${ALL_CHART.length}`:"Top 5"} — closed vs pipeline</p></div>
                <div className="chleg"><span className="legd"><span className="lbox cy"/>Closed</span><span className="legd"><span className="lbox pu"/>Pipeline</span>
                  <button className="ebtn" onClick={()=>setCe(!ce)}>{ce?"▲ Top 5":`All ${ALL_CHART.length} →`}</button>
                </div>
              </div>
              <div style={{height:ce?300:240}}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cd.map(d=>({name:d.n,closed:d.c,pipeline:d.p}))} barGap={ce?2:4} margin={{top:4,right:8,bottom:ce?20:4,left:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.bdr} vertical={false}/>
                    <XAxis dataKey="name" tick={{fill:T.dim,fontSize:ce?10:11}} axisLine={false} tickLine={false} dy={4} {...(ce?{interval:0,angle:-35,textAnchor:"end",height:55}:{})}/>
                    <YAxis tick={{fill:T.fnt,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v/1000}K`} width={50}/>
                    <Tooltip content={<Tip/>} cursor={{fill:"rgba(255,255,255,0.03)"}}/>
                    <Bar dataKey="closed" name="Closed" fill={T.cy} radius={[4,4,0,0]} barSize={ce?16:28} onClick={(d)=>{if(d?.name){setCf(cf===d.name?null:d.name);const mt=MKTS.find(m=>m.city===d.name);if(mt)setExp(mt.id);}}} style={{cursor:"pointer"}}>
                      {cd.map((e,i)=><Cell key={i} fill={T.cy} opacity={!cf?0.85:e.n===cf?1:0.2}/>)}
                    </Bar>
                    <Bar dataKey="pipeline" name="Pipeline" fill={T.pu} radius={[4,4,0,0]} barSize={ce?16:28} onClick={(d)=>{if(d?.name){setCf(cf===d.name?null:d.name);const mt=MKTS.find(m=>m.city===d.name);if(mt)setExp(mt.id);}}} style={{cursor:"pointer"}}>
                      {cd.map((e,i)=><Cell key={i} fill={T.pu} opacity={!cf?0.85:e.n===cf?1:0.2}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            {!ce&&<div className="chside">
              <div className="chcard sm">
                <div className="chhdr"><b>Bookings Trend</b><div style={{display:"flex",gap:8,alignItems:"center"}}><span className="ktrend gn">▲ +36%</span>{!te&&<button className="ebtn" onClick={()=>setTe(true)}>12m →</button>}</div></div>
                <div style={{height:100}}><ResponsiveContainer width="100%" height="100%"><AreaChart data={td.map(d=>({month:d.m,mrr:d.v}))} margin={{top:0,right:4,bottom:0,left:-20}}><defs><linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.gn} stopOpacity={0.3}/><stop offset="100%" stopColor={T.gn} stopOpacity={0}/></linearGradient></defs><XAxis dataKey="month" tick={{fill:T.fnt,fontSize:9}} axisLine={false} tickLine={false}/><YAxis tick={false} axisLine={false}/><Tooltip content={<Tip/>}/><Area type="monotone" dataKey="mrr" stroke={T.gn} strokeWidth={2} fill="url(#gr)" name="Bookings"/></AreaChart></ResponsiveContainer></div>
              </div>
              <div className="chcard sm">
                <b>Product Mix</b>
                <div className="pmix"><div style={{width:90,height:90}}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pd} dataKey="v" nameKey="n" cx="50%" cy="50%" innerRadius={25} outerRadius={42} strokeWidth={0}>{pd.map((_,i)=><Cell key={i} fill={pc2[i]} opacity={0.75}/>)}</Pie></PieChart></ResponsiveContainer></div>
                  <div className="pleg">{pd.map((p,i)=><div key={i} className="plrow"><span className="plbox" style={{background:pc2[i]}}/><span>{p.n}</span><span className="imono">{p.v}%</span></div>)}</div>
                </div>
              </div>
            </div>}
          </div>
          {te&&<div className="chcard" style={{marginBottom:16}}>
            <div className="chhdr"><div><b>Monthly Bookings — 12m</b><p className="sub">$42.1K → $92.8K</p></div><div style={{display:"flex",gap:10,alignItems:"center"}}><span className="ktrend gn">▲ +121% YoY</span><button className="ebtn" onClick={()=>setTe(false)}>▲ Collapse</button></div></div>
            <div style={{height:200}}><ResponsiveContainer width="100%" height="100%"><AreaChart data={td.map(d=>({month:d.m,mrr:d.v}))} margin={{top:4,right:8,bottom:4,left:0}}><defs><linearGradient id="gr2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.gn} stopOpacity={0.25}/><stop offset="100%" stopColor={T.gn} stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke={T.bdr} vertical={false}/><XAxis dataKey="month" tick={{fill:T.dim,fontSize:10}} axisLine={false} tickLine={false}/><YAxis tick={{fill:T.fnt,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v/1000}K`} width={50}/><Tooltip content={<Tip/>}/><Area type="monotone" dataKey="mrr" stroke={T.gn} strokeWidth={2.5} fill="url(#gr2)" name="Bookings" dot={{fill:T.gn,r:3,strokeWidth:0}}/></AreaChart></ResponsiveContainer></div>
          </div>}

          <div className="fbar">
            {cf&&<><button className="cfbtn" onClick={()=>setCf(null)}>◎ {cf} ✕</button><div className="sep"/></>}
            <span className="sub">Vertical</span>
            {["all","Carrier","Tech","Healthcare","Finance"].map(v=><button key={v} onClick={()=>setVf(v)} className={`fbtn${vf===v?" act":""}`}>{v==="all"?"All":v}</button>)}
            <div className="sep"/>
            <span className="sub">Activity</span>
            {[["all","All"],["high","High Volume"],["tail","Tailwind"],["head","Headwind"]].map(([k,l])=><button key={k} onClick={()=>setAf(k)} className={`fbtn${af===k?" act-cy":""}`}>{l}</button>)}
            <div className="sep"/>
            <button onClick={()=>setOf(!of2)} className={`fbtn${of2?" act-rd":""}`}>{of2?"⚡ ":""}Outage</button>
          </div>

          <div className="mlist">{filt.map(m=><MktRow key={m.id} m={m} isOpen={exp===m.id} onToggle={()=>setExp(exp===m.id?null:m.id)}/>)}{!filt.length&&<p className="empty">No markets match</p>}</div>
          </>}
        </>}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0} .root{min-height:100vh;background:${T.bg};color:${T.txt};font-family:'IBM Plex Sans',sans-serif}
        .hdr{padding:16px 24px;border-bottom:1px solid ${T.bdr};display:flex;justify-content:space-between;align-items:center}
        .brand{display:flex;align-items:center;gap:8px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${T.dim};margin-bottom:2px}
        .dot{width:8px;height:8px;border-radius:50%;background:${T.pu};box-shadow:0 0 8px ${T.pu}60} h1{font-size:20px;font-weight:600}
        .tabs{display:flex;gap:2px;padding:3px;border-radius:10px;background:${T.srf};border:1px solid ${T.bdr}}
        .tab{display:flex;align-items:center;gap:6px;padding:7px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:none;background:transparent;color:${T.fnt}}
        .tab.tact{background:${T.card};color:${T.pu};box-shadow:0 1px 4px rgba(0,0,0,0.3)} .tab.cy{color:${T.cy}}
        .rdot{width:6px;height:6px;border-radius:50%;background:${T.rd};box-shadow:0 0 6px ${T.rd}}
        .body{padding:20px 24px}

        /* Targets */
        .thdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px}
        .thdr b{font-size:14px} .thdr-r{display:flex;align-items:center;gap:10px}
        .tcnt{display:flex;gap:2px;padding:2px;border-radius:7px;background:${T.srf}}
        .cnbtn{padding:4px 12px;border-radius:5px;font-size:10px;font-weight:600;font-family:${mono};cursor:pointer;border:none;background:transparent;color:${T.fnt}}
        .cnact{background:${T.card};color:${T.pu};box-shadow:0 1px 3px rgba(0,0,0,0.3)}
        .tlist{display:flex;flex-direction:column;gap:8px}
        .trow{background:${T.card};border-radius:12px;border:1px solid ${T.bdr};overflow:hidden;transition:border-color 0.15s}
        .trow.topen{border-color:${T.pu}40} .trow-out{border-color:${T.rd}25}
        .trhdr{padding:12px 18px;cursor:pointer;display:flex;align-items:center;gap:14px}
        .rank{width:30px;height:30px;border-radius:8px;background:${T.srf};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;font-family:${mono};color:${T.fnt};flex-shrink:0}
        .rank.top{background:${T.pu}20;color:${T.pu}}
        .trinfo{flex:1;min-width:0} .trname{display:flex;align-items:center;gap:8px;margin-bottom:3px} .trname b{font-size:14px}
        .trtags{display:flex;gap:4px;flex-wrap:wrap}
        .ttag{padding:2px 7px;border-radius:5px;font-size:9px;font-weight:600;font-family:${mono}}
        .trgap{display:flex;align-items:center;gap:4px;flex-shrink:0}
        .trval{text-align:right;width:75px;flex-shrink:0} .trval b{font-size:17px;font-weight:700;font-family:${mono};color:${T.pu};display:block;line-height:1} .trval span{font-size:9px;color:${T.fnt}}
        .sbox{width:42px;height:42px;border-radius:9px;background:${T.srf};border:1px solid ${T.bdr};display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;cursor:help}
        .sbox b{font-size:14px;font-weight:700;font-family:${mono};line-height:1} .sbox span{font-size:7px;color:${T.fnt};margin-top:1px}
        .trexp{border-top:1px solid ${T.bdr};padding:16px 18px;background:${T.alt}}
        .g2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .intelbox{padding:12px 14px;border-radius:8px;border-left:3px solid ${T.bl}60;background:${T.bl}08;margin-bottom:14px}
        .intelbox p{font-size:12px;color:${T.dim};line-height:1.5}
        .mctx{font-size:12px;margin-bottom:10px;color:${T.dim}} .mctx.gn{color:${T.gn}} .mctx.am{color:${T.am}}
        .mkbtn{display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;border:none;background:${T.srf};color:${T.cy};margin-top:14px}

        /* Markets */
        .krow{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px}
        .kpi{background:${T.card};border-radius:12px;padding:14px 16px;border:1px solid ${T.bdr}}
        .klbl{font-size:10px;color:${T.dim};display:block;margin-bottom:6px} .kval{font-size:22px;font-family:${mono};display:block}
        .ktrend{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:600;margin-top:4px}
        .ktrend.gn{background:${T.gn}20;color:${T.gn}} .ktrend.rd{background:${T.rd}20;color:${T.rd}}
        .cy{color:${T.cy}} .pu{color:${T.pu}} .gn{color:${T.gn}} .rd{color:${T.rd}} .am{color:${T.am}} .bl{color:${T.bl}} .fnt{color:${T.fnt}}
        .chrow{display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:20px} .chrow.full{grid-template-columns:1fr}
        .chside{display:flex;flex-direction:column;gap:14px}
        .chcard{background:${T.card};border-radius:12px;padding:16px 18px;border:1px solid ${T.bdr}} .chcard.lg{} .chcard.sm{flex:1}
        .chhdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
        .chleg{display:flex;gap:12px;align-items:center} .legd{display:flex;align-items:center;gap:5px;font-size:10px;color:${T.dim}}
        .lbox{width:8px;height:8px;border-radius:2px;opacity:0.8} .lbox.cy{background:${T.cy}} .lbox.pu{background:${T.pu}}
        .ebtn{padding:4px 10px;border-radius:6px;font-size:10px;font-weight:600;cursor:pointer;border:none;background:${T.srf};color:${T.cy}}
        .chtip{background:${T.card};border:1px solid ${T.bdr};border-radius:8px;padding:8px 12px;font-size:11px}
        .pmix{display:flex;align-items:center;gap:12px;margin-top:10px}
        .pleg{display:flex;flex-direction:column;gap:4px} .plrow{display:flex;align-items:center;gap:6px;font-size:10px} .plbox{width:7px;height:7px;border-radius:2px;opacity:0.75;flex-shrink:0}

        .fbar{display:flex;align-items:center;gap:7px;margin-bottom:14px;flex-wrap:wrap}
        .cfbtn{display:flex;align-items:center;gap:6px;padding:5px 14px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid ${T.cy}40;background:${T.cy}15;color:${T.cy}}
        .fbtn{padding:5px 14px;border-radius:8px;font-size:11px;font-weight:500;cursor:pointer;border:none;background:${T.srf};color:${T.fnt}}
        .fbtn.act{background:${T.pu}20;color:${T.pu}} .fbtn.act-cy{background:${T.cy}18;color:${T.cy}} .fbtn.act-rd{background:${T.rd}20;color:${T.rd}}
        .sbtn{padding:3px 8px;border-radius:6px;font-size:10px;font-family:${mono};font-weight:500;cursor:pointer;border:none;background:${T.srf};color:${T.fnt}} .sbtn.sact{background:${T.cy}18;color:${T.cy}}
        .sep{width:1px;height:18px;background:${T.bdr};margin:0 2px}
        .sub{font-size:11px;color:${T.fnt}} .mono{font-family:${mono}} .mb{margin-bottom:14px}
        .mod{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:6px;font-size:10px;font-family:${mono};font-weight:600;background:${T.srf};color:${T.dim}}
        .mod.gn{background:${T.gn}20;color:${T.gn}} .mod.am{background:${T.am}20;color:${T.am}}
        .mlist{display:flex;flex-direction:column;gap:10px} .empty{text-align:center;color:${T.dim};padding:40px}
        .mvtog{display:flex;gap:2px;padding:3px;border-radius:8px;background:${T.srf};width:fit-content;margin-bottom:16px}
        .tab.sm{padding:5px 14px;font-size:11px}
        .mapcard{background:${T.card};border-radius:12px;border:1px solid ${T.bdr};padding:16px 18px;margin-bottom:20px}
        .mapsvg{width:100%;height:auto;display:block}
        .mapleg{display:flex;align-items:center;gap:14px;margin-top:12px;padding-top:12px;border-top:1px solid ${T.bdr};flex-wrap:wrap}

        .mcard{background:${T.card};border-radius:12px;border:1px solid ${T.bdr};overflow:hidden} .mcard.open{border-color:${T.pu}40}
        .mhdr{padding:14px 18px;cursor:pointer;display:flex;align-items:center;gap:14px}
        .mdl{width:46px;height:46px;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;background:${T.srf};border:1px solid ${T.bdr}}
        .mdl b{font-size:17px;font-family:${mono};line-height:1;color:${T.cy}} .mdl span{font-size:8px;color:${T.fnt}}
        .rdbox{background:${T.rd}15;border-color:${T.rd}30} .rdbox b{color:${T.rd}} .gnbox{background:${T.gn}15;border-color:${T.gn}30} .gnbox b{color:${T.gn}} .ambox{background:${T.am}15;border-color:${T.am}30} .ambox b{color:${T.am}}
        .minfo{flex:1} .mrow{display:flex;align-items:center;gap:8px;margin-bottom:4px} .mcity{font-size:15px}
        .mstats{display:flex;gap:18px;font-size:12px;color:${T.dim}} .mstats b{font-family:${mono};font-weight:600}
        .chev{font-size:12px;color:${T.fnt};flex-shrink:0}
        .mexp{border-top:1px solid ${T.bdr};padding:0 18px 18px}
        .outalert{margin:14px 0;padding:12px 16px;border-radius:10px;background:${T.rd}15;border-left:3px solid ${T.rd}}
        .outalert b{color:${T.rd};font-size:13px;display:block;margin-bottom:4px} .outalert p{font-size:12px;color:${T.dim}} .outalert .wht{color:${T.txt}}
        .g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:14px 0}
        .ibox{background:${T.srf};border-radius:10px;padding:12px} .ilbl{font-size:10px;font-weight:600;color:${T.fnt};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px} .ilbl.bl{color:${T.bl}}
        .irow{display:flex;justify-content:space-between;padding:3px 0;font-size:12px} .imono{font-family:${mono};font-size:11px;color:${T.dim}}
        .pbar{margin-bottom:6px} .pbhdr{display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px} .pbtrk{height:4px;border-radius:2px;background:${T.card}} .pbfill{height:100%;border-radius:2px;background:linear-gradient(90deg,${T.cy}90,${T.cy}40)}
        .evt{margin-bottom:8px} .evhdr{display:flex;align-items:center;gap:6px;margin-bottom:3px} .evtag{padding:1px 7px;border-radius:4px;font-size:9px;font-family:${mono};font-weight:600} .evdt{font-size:10px;color:${T.fnt}} .evt p{font-size:11px;color:${T.dim};line-height:1.4}
        .evtlist{display:flex;flex-direction:column;gap:8px}
        .aflt{display:flex;justify-content:space-between;align-items:center;margin:4px 0 12px;flex-wrap:wrap;gap:8px} .afltr{display:flex;align-items:center;gap:6px} .slbl{font-size:10px;color:${T.fnt}}
        .tag{padding:2px 8px;border-radius:6px;font-size:10px;font-family:${mono}} .tag.rd{background:${T.rd}20;color:${T.rd}}
        .ntag{padding:2px 7px;border-radius:5px;font-size:10px;font-family:${mono}} .ntag.gn{background:${T.gn}20;color:${T.gn}} .ntag.am{background:${T.am}20;color:${T.am}} .ntag.rd{background:${T.rd}20;color:${T.rd}} .ntag.sm{font-size:9px;padding:1px 5px}
        .acard{background:${T.alt};border-radius:10px;padding:14px 16px;border:1px solid ${T.bdr};margin-bottom:8px}
        .ahdr{display:flex;justify-content:space-between;align-items:start;margin-bottom:10px} .aname{display:flex;align-items:center;gap:6px;margin-bottom:5px} .aname b{font-size:14px}
        .vtag{padding:2px 8px;border-radius:5px;font-size:10px;background:${T.srf};color:${T.dim}}
        .astats{display:flex;gap:14px;font-size:11px;color:${T.dim}} .astats b{font-family:${mono};font-weight:600}
        .agap{text-align:right;flex-shrink:0;padding-left:16px} .agaplbl{font-size:10px;color:${T.fnt}} .agapv{font-size:19px;font-family:${mono};color:${T.pu};display:block;line-height:1} .agapv small{font-size:10px;font-weight:400;color:${T.fnt}}
        .pills{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px} .pill{padding:3px 9px;border-radius:6px;font-size:10px;font-family:${mono};background:${T.srf};color:${T.dim}} .pill.gap{background:${T.pu}20;color:${T.pu}}
        .talk{padding:10px 14px;border-radius:8px;border-left:3px solid ${T.pu}60;background:${T.pu}08;font-size:12px;color:${T.dim};line-height:1.65}
        button:hover{filter:brightness(1.15)}
        ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:${T.bdr};border-radius:3px}
      `}</style>
    </div>
  );
}
