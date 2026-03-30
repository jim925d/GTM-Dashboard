import { useState, useRef } from "react";

/* ── Theme tokens (mapped to CSS vars for shadcn pattern) ── */
const TABS=[{n:"Historical",r:3842,i:"📊"},{n:"Bookings",r:1206,i:"💰"},{n:"Engagement",r:8421,i:"📧"},{n:"Churn",r:486,i:"⚠"},{n:"Markets",r:42,i:"🗺"},{n:"Locations",r:318,i:"📍"},{n:"Services",r:2104,i:"⚡"}];
const TEAM=[{n:"Sarah Chen",reps:["Jose Banales","Katie Allen","Michael Kahn"]},{n:"Marcus Webb",reps:["Jennifer Middleton","William Good","David Park"]}];
const ALL_REPS=TEAM.flatMap(m=>m.reps.map(r=>({name:r,mgr:m.n})));

const D={
  summary:{closed:842600,closedSub:"+$62K vs prior 12m",pipeActive:63000,pipeSub:"48 deals · 52.7% avg prob",locSpend:134200,atRiskMRR:48200,pipeWtd:98200,
    headline:"$843K closed in trailing 12 months with $63K still in active pipeline. $134K/mo in location addressable spend identified across 28 accounts. $48K at risk from 14 expiring contracts. 5 accounts have outage or intel urgency signals right now."},
  actions:[
    {p:1,a:"Desert Health",m:"Phoenix",tags:[{l:"Outage",cl:"rd"},{l:"New Intel",cl:"bl"}],prod:"SD-WAN + DDoS",v:9200,sc:156,ps:{u:52.9,o:20.6,c:82.5},hasPipe:true,pipeDeals:2,
      tk:"Cox outage hit 3 clinics. They're running single-carrier with no failover — this is the redundancy pitch you've been waiting for. Lead with failover architecture, close with bundled DDoS.",
      stats:{tmr:1533,deals:2,nibAll:42800,nib24:18200,health:62,mod:1.14,ds:1},
      churn:{prob:0.42,risk:644,signals:[{s:"Engagement (1d)",p:.15},{s:"Health watch",p:.10},{s:"Single-carrier",p:.25}]},
      intel:"Cox Phoenix outage ongoing since Mar 18 — 15K+ business customers impacted",gaps:["Dark Fiber","SD-WAN","DDoS"],
      engines:{
        outage:{active:true,event:"Cox Phoenix outage — 15K+ affected",signal:"Single-carrier Ethernet, no failover. Redundancy products (SD-WAN, DDoS) have 3× urgency.",products:["SD-WAN","DDoS"],urgency:"critical"},
        location:{footprint:3,onNet:true,spread:"single-metro",affinity:[{p:"Dark Fiber",score:88},{p:"SD-WAN",score:82},{p:"DDoS",score:78}],reason:"3 clinic locations on-net in Phoenix metro. Footprint matches Dark Fiber + SD-WAN + DDoS bundle pattern."},
        prediction:{similar:"Healthcare accounts in Phoenix close SD-WAN at 62% win rate, 38-day avg cycle. Recommended entry: Design Solution.",winRate:62,cycle:38,entry:"Design Solution"},
        event:{modifier:1.14,context:"Cox outage creating 14% uplift on redundancy deals in AZ. Accounts exposed closing 3× faster than baseline."}
      }},
    {p:2,a:"TerraWave Comm",m:"Dallas",tags:[{l:"New Intel",cl:"bl"},{l:"Tailwind",cl:"gn"}],prod:"WL Long Haul",v:37600,sc:191,ps:{u:15.4,o:87.6,c:88.2},hasPipe:true,pipeDeals:3,
      tk:"Your biggest metro fiber customer is buying long-haul from someone else. Lumen may exit enterprise — lock them in now with a bundled Dallas-Chicago-Atlanta rate that beats their current carrier by 25%.",
      stats:{tmr:15533,deals:8,nibAll:386200,nib24:-12400,health:52,mod:1.08,ds:12},
      churn:{prob:0.38,risk:5903,signals:[{s:"Negative NIB (24m)",p:.33},{s:"Health watch",p:.10}]},
      intel:"Lumen exploring strategic alternatives — their long-haul provider may exit enterprise",gaps:["WL Long Haul","DDoS"],
      engines:{
        outage:{active:false},
        location:{footprint:12,onNet:true,spread:"multi-metro",affinity:[{p:"WL Long Haul",score:95},{p:"DDoS",score:72}],reason:"12 locations across Dallas-Chicago-Atlanta. Metro fiber maxed — long-haul wavelengths are the natural next product for this footprint."},
        prediction:{similar:"Carrier accounts with 8+ deals close WL Long Haul at 71% win rate, 52-day cycle. Their metro spend predicts $37K+ long-haul addressable.",winRate:71,cycle:52,entry:"Propose"},
        event:{modifier:1.08,context:"Lumen strategic review creating switching opportunity. M&A event gives 8% uplift on carrier displacement deals."}
      }},
    {p:3,a:"Apex Financial",m:"New York",tags:[{l:"Tailwind",cl:"gn"},{l:"14d silent",cl:"am"}],prod:"zColo + DDoS",v:22400,sc:151,ps:{u:7.7,o:55.6,c:88.1},hasPipe:true,pipeDeals:1,
      tk:"SD-WAN across 6 states but NYC HQ has no colo or DDoS — for a financial firm, that's a compliance conversation. Fed easing means budgets are loosening. Bundle at preferred rate.",
      stats:{tmr:2408,deals:3,nibAll:68400,nib24:8200,health:65,mod:1.18,ds:14},
      churn:{prob:0.10,risk:241,signals:[{s:"Health watch",p:.10}]},
      intel:"Fed easing signal — financial budgets unlocking this quarter",gaps:["zColo","DDoS","Dark Fiber"],
      engines:{
        outage:{active:false},
        location:{footprint:6,onNet:true,spread:"multi-state",affinity:[{p:"zColo",score:92},{p:"DDoS",score:89},{p:"Dark Fiber",score:74}],reason:"6 locations across 4 states with NYC HQ. Financial vertical + no colo = compliance gap. Location profile is 92% match for zColo."},
        prediction:{similar:"Financial accounts in NYC close zColo at 74% win rate. Compliance-driven deals have 28-day avg cycle — faster than avg.",winRate:74,cycle:28,entry:"Propose"},
        event:{modifier:1.18,context:"Fed easing + AI fiber demand creating strongest NYC tailwind in 18 months. 18% uplift on financial infrastructure deals."}
      }},
    {p:4,a:"Broadleaf Energy",m:"Houston",tags:[{l:"Churn Risk",cl:"rd"},{l:"24d silent",cl:"am"}],prod:"SD-WAN",v:7800,sc:134,ps:{u:41.7,o:16.8,c:75.2},hasPipe:false,pipeDeals:0,
      tk:"NIB is -$18K over 24 months — 3 services month-to-month. This is a save play — lead with MPLS-to-SD-WAN cost savings across their 24 locations. Retention first, expansion second.",
      stats:{tmr:1900,deals:2,nibAll:24600,nib24:-18400,health:38,mod:0.96,ds:24},
      churn:{prob:0.79,risk:1501,signals:[{s:"MTM (3 svc)",p:.35},{s:"Negative NIB",p:.40},{s:"Silent 24d",p:.15},{s:"Critical health",p:.30},{s:"Headwind",p:.08}]},
      intel:"Brightspeed transition disruptions — former Lumen customers seeking alternatives",gaps:["SD-WAN","Dark Fiber"],
      engines:{
        outage:{active:false},
        location:{footprint:24,onNet:true,spread:"multi-state",affinity:[{p:"SD-WAN",score:94},{p:"Dark Fiber",score:68}],reason:"24 warehouse/office locations across TX and LA. MPLS-to-SD-WAN migration pattern — this footprint is a 94% match for SD-WAN."},
        prediction:{similar:"Energy vertical accounts with declining NIB respond to cost-savings positioning. SD-WAN save deals close at 58% when led with TCO comparison.",winRate:58,cycle:42,entry:"Discover"},
        event:{modifier:0.96,context:"Brightspeed transition creating 4% headwind in SE markets. But Lumen migration pain is creating switching opportunity on legacy circuits."}
      }},
    {p:5,a:"CloudNexus Inc",m:"Denver",tags:[{l:"NIB +$48K",cl:"gn"},{l:"Tailwind",cl:"gn"}],prod:"Wavelengths",v:18000,sc:135,ps:{u:0.7,o:45.4,c:88.5},hasPipe:true,pipeDeals:2,
      tk:"Fastest growing account in your patch. DC bandwidth will double within 12 months — get them on wavelengths before they outgrow lit services. AI buildout in Denver is driving their demand curve.",
      stats:{tmr:5600,deals:6,nibAll:142800,nib24:48200,health:88,mod:1.09,ds:2},
      churn:{prob:0.0,risk:0,signals:[]},
      intel:"AI data center buildout accelerating in Denver metro",gaps:["Wavelengths"],
      engines:{
        outage:{active:false},
        location:{footprint:4,onNet:true,spread:"single-metro",affinity:[{p:"Wavelengths",score:91}],reason:"4 DC locations in Denver metro running Dark Fiber at capacity. Bandwidth growth trajectory predicts wavelength need within 6 months."},
        prediction:{similar:"Tech accounts with NRR >1.15 close Wavelengths at 76% win rate. High-growth accounts accept 15-20% premium for capacity guarantees.",winRate:76,cycle:35,entry:"Design Solution"},
        event:{modifier:1.09,context:"AI DC buildout creating 9% uplift on high-bandwidth products in Denver. Wavelengths and Dark Fiber deals closing 2× faster than 2024."}
      }},
    {p:6,a:"Summit Manufacturing",m:"Chicago",tags:[{l:"No Pipeline",cl:"am"},{l:"Location Match",cl:"pu"}],prod:"Ethernet + SD-WAN",v:14200,sc:118,ps:{u:0,o:32.4,c:86.0},hasPipe:false,pipeDeals:0,
      tk:"No active pipeline but the engines say sell here. 8 manufacturing locations went on-net in Q4, footprint is a 90% match for Ethernet + SD-WAN. Similar accounts in this vertical buy within 60 days of going on-net.",
      stats:{tmr:0,deals:0,nibAll:0,nib24:0,health:null,mod:1.04,ds:null},
      churn:{prob:0,risk:0,signals:[]},
      intel:null,gaps:["Ethernet","SD-WAN","IP Svc"],
      engines:{
        outage:{active:false},
        location:{footprint:8,onNet:true,spread:"multi-state",affinity:[{p:"Ethernet",score:96},{p:"SD-WAN",score:88},{p:"IP Svc",score:72}],reason:"8 manufacturing/warehouse locations across IL, IN, OH newly on-net. This footprint is a 96% match for Ethernet — no services yet. Pure greenfield."},
        prediction:{similar:"Manufacturing greenfield accounts that go on-net convert to Ethernet within 58 days at 64% rate. SD-WAN follows within 90 days at 48%.",winRate:64,cycle:58,entry:"Discover"},
        event:{modifier:1.04,context:"Neutral market. No significant event tailwind, but on-net activation is the trigger — similar accounts convert quickly post-activation."}
      }},
  ],
  health:{score:68,ok:96,watch:28,risk:18,accts:142,
    risks:[{n:"Peachtree Health",s:44,why:"NIB -$8K (24m), 2 disconnects in 90d"},{n:"Broadleaf Energy",s:38,why:"3 services MTM, no renewal activity"},{n:"Cascade Telecom",s:42,why:"Primary contact left, engagement -80%"},{n:"Summit Industries",s:48,why:"Contract expires 45d, no renewal in pipe"}],
    up:[{n:"CloudNexus Inc",s:88,d:"+12"},{n:"Meridian Health",s:78,d:"+6"}]},
  churn:{mrr:48200,exp:14,
    reasons:[{r:"Contract expiry",w:38},{r:"Competitor",w:29},{r:"Service quality",w:18},{r:"Budget",w:15}],
    expiring:[{n:"Broadleaf Energy",mrr:4200,ex:"Apr 2026"},{n:"Summit Industries",mrr:3800,ex:"May 2026"},{n:"Pacific Retail",mrr:2600,ex:"Apr 2026"}]},
  pipe:{deals:48,raw:186400,wtd:98200,avg:52.7,
    stages:[{s:"Discover",p:31,d:12},{s:"Design",p:53,d:10},{s:"Propose",p:66,d:11},{s:"Negotiate",p:85,d:9},{s:"Verbal",p:92,d:6}]},
  mkts:{grow:[{c:"New York",d:"+18%",md:1.10},{c:"Dallas",d:"+14%",md:1.08},{c:"Denver",d:"+22%",md:1.12}],
    down:[{c:"Atlanta",d:"-6%",md:0.96}],
    events:[{t:"tech",h:"AI DC buildout — Denver, Dallas",dl:12},{t:"reg",h:"BEAD $42.45B allocations live",dl:8},{t:"ma",h:"Lumen strategic alternatives",dl:4},{t:"outage",h:"Cox Phoenix — 15K+ affected",dl:6}]},
};

const CL={rd:"var(--rd)",gn:"var(--gn)",am:"var(--am)",bl:"var(--bl)",pu:"var(--pu)",cy:"var(--cy)"};
const ecBg={tech:"var(--gn-bg)",reg:"var(--bl-bg)",ma:"var(--pu-bg)",outage:"var(--rd-bg)"};
const ecFg={tech:"var(--gn)",reg:"var(--bl)",ma:"var(--pu)",outage:"var(--rd)"};

function Bar({w,color="var(--cy)"}){return <div className="bar-track"><div className="bar-fill" style={{width:`${w}%`,background:color}}/></div>;}

function Acc({title,sub,id,state,set,children}){
  var open=state===id;
  return <div className="card acc">
    <button className="acc-trigger" onClick={function(){set(open?null:id);}}>
      <span className="acc-title">{title}</span>
      <span className="acc-right"><span className="text-xs font-mono text-muted">{sub}</span><span className="chevron">{open?"▲":"▼"}</span></span>
    </button>
    {open&&<div className="acc-content">{children}</div>}
  </div>;
}

export default function IntelReadout(){
  const[phase,setPhase]=useState("upload");
  const[tabs,setTabs]=useState([]);
  const[secs,setSecs]=useState(0);
  const[fname,setFname]=useState("");
  const[scope,setScope]=useState("all");
  const[sType,setSType]=useState("all");
  const[openAcc,setOpenAcc]=useState(null);
  const[expAct,setExpAct]=useState(0);
  const[promptOpen,setPromptOpen]=useState(null);
  const[copied,setCopied]=useState(false);
  const readoutRef=useRef(null);
  const timerRef=useRef(null);

  function setS(t,n){setSType(t);setScope(n);}
  var sLabel=sType==="all"?"All Teams":scope;

  function buildPrompt(c){
    var e=c.engines;
    var pipeStatus=c.hasPipe?c.pipeDeals+" active deals in pipeline":"NO active pipeline — this is a greenfield/engine-driven recommendation";
    return "You are a B2B telecom sales strategist. I need a complete execution plan for "+c.a+" ("+c.m+" market). All data below comes from 4 analytics engines cross-referenced against "+c.a+"'s profile.\n\n## Account Overview\n- Account: "+c.a+"\n- Market: "+c.m+"\n- Pipeline Status: "+pipeStatus+"\n- Current TMR: $"+(c.stats.tmr>0?c.stats.tmr.toLocaleString():"0")+"/mo\n- Historical Deals: "+c.stats.deals+"\n- NIB (All-Time): $"+(c.stats.nibAll?c.stats.nibAll.toLocaleString():"0")+" (bookings minus churn/disconnects)\n- NIB (24m): $"+(c.stats.nib24?c.stats.nib24.toLocaleString():"0")+(c.stats.nib24&&c.stats.nib24<0?" (contracting — churn risk)":c.stats.nib24&&c.stats.nib24>20000?" (strong growth)":"")+"\n- Health: "+(c.stats.health||"N/A")+"/100"+(c.stats.health&&c.stats.health<50?" (at risk)":"")+"\n- Churn Probability: "+Math.round(c.churn.prob*100)+"% ($"+c.churn.risk.toLocaleString()+"/mo at risk)\n- Days Since Contact: "+(c.stats.ds||"No history")+"\n- Premier Score: "+c.sc+"/300 (Urgency: "+c.ps.u.toFixed(0)+", Opportunity: "+c.ps.o.toFixed(0)+", Confidence: "+c.ps.c.toFixed(0)+")\n\n## Engine 1: Location Intelligence\n- Footprint: "+e.location.footprint+" locations, "+e.location.spread+", "+(e.location.onNet?"on-net":"off-net")+"\n- Analysis: "+e.location.reason+"\n- Product Affinity:\n"+e.location.affinity.map(function(a){return "  - "+a.p+": "+a.score+"% match"}).join("\n")+"\n\n## Engine 2: Prediction Engine (Bayesian)\n- "+e.prediction.similar+"\n- Win Rate: "+e.prediction.winRate+"% | Avg Cycle: "+e.prediction.cycle+" days\n- Recommended Entry Stage: "+e.prediction.entry+"\n\n## Engine 3: Event Context\n- Deal Climate: "+(e.event.modifier>1.05?"Favorable":"Headwind")+" "+e.event.modifier.toFixed(2)+"x\n- "+e.event.context+"\n\n"+(e.outage.active?"## Engine 4: Outage Detection\n- Event: "+e.outage.event+"\n- Signal: "+e.outage.signal+"\n- Urgency Products: "+e.outage.products.join(", ")+"\n- Urgency Level: "+e.outage.urgency+"\n\n":"")+"## Overnight Intel\n"+(c.intel||"No new signals")+"\n\n## What to Sell\n- Recommended Products: "+c.prod+"\n- Product Gaps: "+c.gaps.join(", ")+"\n- Addressable Spend: $"+(c.v/1000).toFixed(1)+"K/mo\n\n## Conversation Strategy\n"+c.tk+"\n\n---\n\nDeliver:\n1. Week 1-2 Execution Plan — outreach sequence with 3 email drafts (initial, follow-up, break-up). Include who to contact by title/role.\n2. 8-10 Discovery Questions tailored to: "+c.tags.map(function(t){return t.l}).join(", ")+"\n3. Top 5 Objection Handlers based on their profile"+(c.stats.nib24&&c.stats.nib24<0?" (they're shrinking — budget is tight)":"")+(c.stats.health&&c.stats.health<50?" (service issues top of mind)":"")+"\n4. Competitive Positioning with ROI for $"+(c.v/1000).toFixed(0)+"K/mo opportunity\n5. Close Plan — timeline from "+e.prediction.entry+" to signed contract ("+e.prediction.cycle+"-day target)\n6. Risk Mitigation\n\n"+(c.hasPipe?"":"IMPORTANT: There is NO active pipeline on "+c.a+". Your plan should start from zero — cold outreach to "+c.a+", explain why we're reaching out now (reference the engine signals above), and build the case from scratch.\n\n")+"Be specific to "+c.a+". Reference their location footprint ("+e.location.footprint+" sites), NIB trend, engine predictions, and market conditions directly. No generic playbooks.";
  }

  function copyPrompt(c){navigator.clipboard.writeText(buildPrompt(c)).then(function(){setCopied(true);setTimeout(function(){setCopied(false);},2000);});}

  function startDemo(){
    setFname("RevOS-Data-Template.xlsx");setPhase("parsing");setTabs([]);setSecs(0);
    var i=0;
    function nextTab(){
      if(i>=TABS.length){setPhase("analyzing");var s=0;
        function nextSec(){s++;setSecs(s);if(s>=3)setPhase("complete");else timerRef.current=setTimeout(nextSec,700);}
        timerRef.current=setTimeout(nextSec,400);return;}
      var t=TABS[i];i++;setTabs(function(p){return p.concat(t);});timerRef.current=setTimeout(nextTab,180);
    }
    timerRef.current=setTimeout(nextTab,300);
  }

  function exportHTML(){
    var el=readoutRef.current;if(!el)return;
    var css=document.querySelector("style");
    var html='<!DOCTYPE html><html><head><meta charset="utf-8"><title>RevOS Readout — '+sLabel+'</title><style>'+(css?css.textContent:'')+'</style></head><body><div class="root"><div class="header"><div class="brand-row"><div class="brand-dot"></div>RevOS · Intelligence Readout</div><h1>'+sLabel+' — '+new Date().toLocaleDateString()+'</h1></div><div class="main">'+el.innerHTML+'</div></div></body></html>';
    var b=new Blob([html],{type:"text/html"});var u=URL.createObjectURL(b);var a=document.createElement("a");
    a.href=u;a.download='RevOS-Readout-'+sLabel.replace(/\s+/g,'-')+'-'+new Date().toISOString().slice(0,10)+'.html';a.click();URL.revokeObjectURL(u);
  }

  var vis=function(n){return secs>=n;};

  return(
    <div className="root">
      {/* HEADER */}
      <div className="header">
        <div>
          <div className="brand-row"><div className="brand-dot"/>RevOS · Intelligence Readout</div>
          <h1>Drop Your Data</h1>
        </div>
        {phase!=="upload"&&<div className="header-right">
          <div className="status-badge">{phase==="complete"?<span className="status-dot done"/>:<span className="status-dot pulse"/>}<span>{phase==="parsing"?"Parsing...":phase==="analyzing"?"Analyzing...":"Ready"}</span></div>
          {phase==="complete"&&<button className="btn-outline-purple" onClick={exportHTML}>⬇ Export HTML</button>}
        </div>}
      </div>

      <div className="main">
        {/* UPLOAD */}
        {phase==="upload"&&<div className="dropzone" onClick={startDemo}>
          <div style={{fontSize:48,marginBottom:20}}>📁</div>
          <p className="drop-title">Drop your Excel workbook here</p>
          <p className="text-sm text-muted">Historical · Bookings · Engagement · Churn · Markets · Locations · Services</p>
          <p className="text-xs text-faint" style={{marginTop:8}}>.xlsx · Auto-detects tabs and maps columns · Click for demo</p>
        </div>}

        {/* TAB STRIP */}
        {phase!=="upload"&&<div className="card tab-strip">
          <div className="tab-file">📄 <b>{fname}</b> <span className="text-xs text-faint">{tabs.length}/{TABS.length} tabs</span></div>
          <div className="tab-row">{TABS.map(function(t,i){var ok=tabs.some(function(x){return x.n===t.n;});return <div key={i} className={ok?"tab-chip done":"tab-chip"}><span>{t.i}</span><b>{t.n}</b>{ok?<span className="text-xs font-mono text-green">{t.r.toLocaleString()}</span>:<span className="text-xs text-faint">···</span>}</div>;})}</div>
        </div>}

        <div ref={readoutRef}>

        {/* ═══ LAYER 1: SUMMARY ═══ */}
        {vis(1)&&<div className="summary-card fade-up">
          <div className="summary-grid">
            {[["Closed (12m)","$"+(D.summary.closed/1000).toFixed(0)+"K",D.summary.closedSub,"cy","gn"],
              ["Active Pipeline","$"+(D.summary.pipeActive/1000).toFixed(0)+"K",D.summary.pipeSub,"cy",""],
              ["Location Addressable Spend","$"+(D.summary.locSpend/1000).toFixed(0)+"K/mo","28 accounts","pu",""],
              ["At-Risk MRR","$"+(D.summary.atRiskMRR/1000).toFixed(1)+"K","probability-weighted · 7 signals","rd",""],
              ["Pipeline (Bayesian)","$"+(D.summary.pipeWtd/1000).toFixed(0)+"K",D.pipe.deals+" deals · "+D.pipe.avg+"% avg","pu",""],
            ].map(function(s,i){return <div key={i} className="summary-item">
              <span className="summary-label">{s[0]}</span>
              <b className={"summary-value "+s[3]}>{s[1]}</b>
              <span className={"summary-sub "+(s[4]||"")}>{s[2]}</span>
            </div>;})}
          </div>
          <p className="summary-story">{D.summary.headline}</p>
        </div>}

        {/* SCOPE */}
        {vis(1)&&<div className="scope-bar fade-up" style={{animationDelay:".1s"}}>
          <button onClick={function(){setS("all","all");}} className={sType==="all"?"scope-btn active":"scope-btn"}>All Teams</button>
          <span className="scope-div"/>
          {TEAM.map(function(m){return <button key={m.n} onClick={function(){setS("mgr",m.n);}} className={sType==="mgr"&&scope===m.n?"scope-btn active":"scope-btn"}>{m.n}</button>;})}
          <span className="scope-div"/>
          {ALL_REPS.filter(function(r){return sType!=="mgr"||r.mgr===scope;}).map(function(r){return <button key={r.name} onClick={function(){setS("rep",r.name);}} className={sType==="rep"&&scope===r.name?"scope-btn active":"scope-btn"}>{r.name}</button>;})}
        </div>}

        {/* ═══ LAYER 2: WHERE TO TARGET ═══ */}
        {vis(2)&&<div className="fade-up" style={{animationDelay:".15s",marginBottom:28}}>
          <div className="section-header">
            <h2>Where to Target</h2>
            <span className="text-xs text-faint">{D.actions.length} accounts · ranked by Premier Score (urgency × opportunity × confidence)</span>
          </div>

          <div className="action-list">
          {D.actions.slice().sort(function(a,b){return b.sc-a.sc;}).map(function(c,i){var open=expAct===i;return(
            <div key={i} className={open?"card action-card open":"card action-card"}>
              <div className="action-row" onClick={function(){setExpAct(open?-1:i);}}>
                <div className={i<3?"rank top":"rank"}>{i+1}</div>
                <div className="action-info">
                  <div className="action-name"><b>{c.a}</b><span className="text-xs text-faint">{c.m}</span></div>
                  <div className="tag-row">{c.tags.map(function(t,j){return <span key={j} className={"tag "+t.cl}>{t.l}</span>;})}</div>
                </div>
                <div className="gap-pills">{c.gaps.slice(0,2).map(function(g,j){return <span key={j} className="tag pu">+ {g}</span>;})}{c.gaps.length>2&&<span className="text-xs text-faint">+{c.gaps.length-2}</span>}</div>
                <div className="pipe-badge">{c.hasPipe?<span className="text-xs font-mono cy">{c.pipeDeals}d in pipe</span>:<span className="text-xs font-mono am">No pipeline</span>}</div>
                <div className="action-val"><b>${(c.v/1000).toFixed(0)}K</b><span>/mo</span></div>
                <div className="score-box" title={"Premier Score: "+c.sc+"/300\n────────────\nUrgency:      "+c.ps.u.toFixed(0)+"  "+(c.ps.u>=40?"(outage)":c.ps.u>=20?"(churn risk)":c.ps.u>=5?"(mild)":"(none)")+"\nOpportunity:  "+c.ps.o.toFixed(0)+"  ($"+(c.v/1000).toFixed(0)+"K spend)"+"\nConfidence:   "+c.ps.c.toFixed(0)+"  (engines)"}><b className={c.sc>=200?"rd":c.sc>=150?"pu":c.sc>=100?"cy":""}>{c.sc}</b></div>
                <span className="chevron">{open?"▲":"▼"}</span>
              </div>

              {open&&<div className="action-expand">
                <div className="talk-track">{c.tk}</div>

                <div className="detail-row">
                  <div className="stat-chips">
                    {[["TMR",c.stats.tmr>0?"$"+c.stats.tmr.toLocaleString():"—","cy"],
                      ["Deals",""+c.stats.deals,""],
                      ["NIB (all)","$"+(c.stats.nibAll/1000).toFixed(1)+"K",c.stats.nibAll>=0?"gn":"rd"],
                      ["NIB (24m)","$"+(c.stats.nib24/1000).toFixed(1)+"K",c.stats.nib24>=0?"gn":"rd"],
                      ["Health",""+c.stats.health,c.stats.health>=70?"gn":c.stats.health>=40?"am":"rd"],
                      ["Climate",c.stats.mod>1.05?"Favorable "+c.stats.mod.toFixed(2)+"×":c.stats.mod<0.98?"Headwind "+c.stats.mod.toFixed(2)+"×":"Neutral",c.stats.mod>1.05?"gn":c.stats.mod<0.98?"am":""],
                      ["Silent",c.stats.ds+"d",""]
                    ].map(function(s,j){return <span key={j} className="stat-chip">{s[0]} <b className={s[2]}>{s[1]}</b></span>;})}
                  </div>
                  {c.intel&&<div className="intel-card"><span className="intel-label">Overnight Intel</span>{c.intel}</div>}
                </div>

                {c.churn.prob>0&&<div className="churn-bar">
                  <span className="churn-label">Churn Risk</span>
                  <b className={c.churn.prob>=0.5?"rd":c.churn.prob>=0.2?"am":""}>{Math.round(c.churn.prob*100)}%</b>
                  <span className="text-xs text-faint">·</span>
                  <span className="text-xs font-mono rd">${(c.churn.risk/1000).toFixed(1)}K/mo</span>
                  <span className="text-xs text-faint">·</span>
                  {c.churn.signals.map(function(s,j){return <span key={j} className="churn-sig">{s.s} <b>{Math.round(s.p*100)}%</b></span>;})}
                </div>}

                {/* ── Engine Signals: What to Sell & Why ── */}
                <div className="engine-grid">
                  {!c.hasPipe&&<div className="engine-alert">
                    <b>⚡ No active pipeline — engine-driven recommendation</b>
                    <span className="text-xs text-muted">These product recommendations come from cross-referencing 4 engines against this account's profile, footprint, and market conditions.</span>
                  </div>}

                  <div className="engine-card">
                    <div className="engine-hdr"><span className="engine-icon" style={{background:"var(--pu-bg)",color:"var(--pu)"}}>📍</span><b>Location Intelligence</b><span className="text-xs font-mono text-faint">{c.engines.location.footprint} locations · {c.engines.location.spread}</span></div>
                    <p className="engine-text">{c.engines.location.reason}</p>
                    <div className="engine-products">{c.engines.location.affinity.map(function(a,j){return <div key={j} className="engine-prod"><span className="tag pu">{a.p}</span><Bar w={a.score} color="var(--pu)"/><span className="text-xs font-mono pu">{a.score}%</span></div>;})}</div>
                  </div>

                  <div className="engine-card">
                    <div className="engine-hdr"><span className="engine-icon" style={{background:"var(--cy-bg)",color:"var(--cy)"}}>🎯</span><b>Prediction Engine</b><span className="text-xs font-mono text-faint">{c.engines.prediction.winRate}% win · {c.engines.prediction.cycle}d cycle</span></div>
                    <p className="engine-text">{c.engines.prediction.similar}</p>
                    <div className="engine-rec"><span className="text-xs text-faint">Recommended entry:</span><span className="tag cy">{c.engines.prediction.entry}</span></div>
                  </div>

                  <div className="engine-card">
                    <div className="engine-hdr"><span className="engine-icon" style={{background:"var(--gn-bg)",color:"var(--gn)"}}>📡</span><b>Event Context</b><span className={"text-xs font-mono "+(c.engines.event.modifier>1.05?"gn":c.engines.event.modifier<0.98?"am":"text-faint")}>{c.engines.event.modifier>1.05?"Favorable":"Headwind"} {c.engines.event.modifier.toFixed(2)}×</span></div>
                    <p className="engine-text">{c.engines.event.context}</p>
                  </div>

                  {c.engines.outage.active&&<div className="engine-card outage-card">
                    <div className="engine-hdr"><span className="engine-icon" style={{background:"var(--rd-bg)",color:"var(--rd)"}}>⚠</span><b>Outage Detection</b><span className="badge rd">{c.engines.outage.urgency}</span></div>
                    <p className="engine-text">{c.engines.outage.signal}</p>
                    <div className="engine-products">{c.engines.outage.products.map(function(p,j){return <span key={j} className="tag rd">{p}</span>;})}</div>
                  </div>}
                </div>

                <button className="prompt-trigger" onClick={function(){setPromptOpen(promptOpen===i?null:i);}}>
                  {promptOpen===i?"▲ Hide Prompt":"🤖 Generate Execution Prompt"}
                </button>
                {promptOpen===i&&<div className="prompt-box">
                  <div className="prompt-header">
                    <span>Ready to paste into ChatGPT, Claude, or any AI</span>
                    <button className="btn-sm-purple" onClick={function(){copyPrompt(c);}}>{copied?"✓ Copied":"📋 Copy"}</button>
                  </div>
                  <pre className="prompt-text">{buildPrompt(c)}</pre>
                </div>}
              </div>}
            </div>
          );})}
          </div>
        </div>}

        {/* ═══ LAYER 3: SUPPORTING EVIDENCE ═══ */}
        {vis(3)&&<div className="fade-up" style={{animationDelay:".3s"}}>
          <p className="evidence-label">Supporting Detail</p>

          <Acc title="Health & Churn Risk" sub={D.health.ok+" healthy · "+D.health.risk+" at-risk · $"+(D.churn.mrr/1000).toFixed(0)+"K at-risk MRR"} id="hc" state={openAcc} set={setOpenAcc}>
            <div className="acc-grid">
              <div>
                <p className="label">Health Distribution</p>
                {[["Healthy (70+)",D.health.ok,"gn"],["Watch (50-69)",D.health.watch,"am"],["At Risk (<50)",D.health.risk,"rd"]].map(function(r,i){return <div key={i} className="bar-row"><span className="bar-label">{r[0]}</span><Bar w={r[1]/D.health.accts*100} color={"var(--"+r[2]+")"}/><b className={r[2]}>{r[1]}</b></div>;})}
                <div style={{marginTop:16}}><p className="label">Improving</p>{D.health.up.map(function(a,i){return <div key={i} className="list-row"><b>{a.n}</b><span className="font-mono gn">{a.s}</span><span className="badge gn">{a.d}</span></div>;})}</div>
              </div>
              <div>
                <p className="label">Churn by Reason</p>
                {D.churn.reasons.map(function(r,i){return <div key={i} className="bar-row"><span className="bar-label">{r.r}</span><Bar w={r.w} color="var(--rd)"/><span className="text-xs font-mono text-faint">{r.w}%</span></div>;})}
                <div style={{marginTop:16}}><p className="label">Expiring Soon</p>{D.churn.expiring.map(function(e,i){return <div key={i} className="list-row"><b>{e.n}</b><span className="text-xs text-faint">exp {e.ex}</span><span className="badge rd">${(e.mrr/1000).toFixed(1)}K</span></div>;})}</div>
              </div>
            </div>
          </Acc>

          <Acc title="Bayesian Pipeline" sub={D.pipe.deals+" deals · $"+(D.pipe.raw/1000).toFixed(0)+"K → $"+(D.pipe.wtd/1000).toFixed(0)+"K weighted"} id="pipe" state={openAcc} set={setOpenAcc}>
            <p className="label">Win Probability by Stage</p>
            {D.pipe.stages.map(function(s,i){return <div key={i} className="bar-row"><span className="bar-label">{s.s}</span><Bar w={s.p} color="var(--pu)"/><span className="text-xs font-mono pu">{s.p}%</span><span className="text-xs font-mono text-faint">{s.d}d</span></div>;})}
          </Acc>

          <Acc title="Markets & Events" sub={D.mkts.grow.length+" growing · "+D.mkts.down.length+" declining · "+D.mkts.events.length+" events"} id="mkt" state={openAcc} set={setOpenAcc}>
            <div className="acc-grid">
              <div>
                <p className="label">Momentum</p>
                {D.mkts.grow.map(function(m,i){return <div key={i} className="list-row"><b>{m.c}</b><span className="badge gn">{m.d}</span><span className="text-xs font-mono text-faint">{m.md.toFixed(2)}×</span></div>;})}
                {D.mkts.down.map(function(m,i){return <div key={i} className="list-row"><b>{m.c}</b><span className="badge rd">{m.d}</span><span className="text-xs font-mono text-faint">{m.md.toFixed(2)}×</span></div>;})}
              </div>
              <div>
                <p className="label">Active Events</p>
                {D.mkts.events.map(function(e,i){return <div key={i} className="event-row"><span className="event-tag" style={{background:ecBg[e.t],color:ecFg[e.t]}}>{e.t}</span><span className="event-text">{e.h}</span><span className="text-xs font-mono text-faint">{e.dl}d</span></div>;})}
              </div>
            </div>
          </Acc>
        </div>}

        </div>

        {phase==="complete"&&<div className="cta-bar fade-up">
          <span className="text-sm text-muted">{sLabel} · {D.health.accts} accounts · ${(D.summary.locSpend/1000).toFixed(0)}K/mo addressable spend</span>
          <div style={{display:"flex",gap:8}}>
            <button className="btn-purple">Open in GTM Premier →</button>
            <button className="btn-blue" onClick={exportHTML}>⬇ Export</button>
            <button className="btn-ghost" onClick={function(){setPhase("upload");setSecs(0);setTabs([]);setSType("all");setScope("all");}}>Upload New</button>
          </div>
        </div>}
      </div>

      <style>{`
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
:root{--bg:#0a0e1a;--card:#111827;--card-alt:#161f30;--surface:#1c2538;--border:#1e293b;--border-light:#334155;--text:#e2e8f0;--muted:#94a3b8;--faint:#64748b;--cy:#22d3ee;--gn:#34d399;--pu:#a78bfa;--rd:#f87171;--am:#fbbf24;--bl:#60a5fa;--cy-bg:rgba(34,211,238,.1);--gn-bg:rgba(52,211,153,.1);--pu-bg:rgba(167,139,250,.1);--rd-bg:rgba(248,113,113,.1);--am-bg:rgba(251,191,36,.1);--bl-bg:rgba(96,165,250,.1);--mono:'IBM Plex Mono',monospace;--sans:'IBM Plex Sans',sans-serif;--radius:10px}
*{box-sizing:border-box;margin:0}

/* Base */
.root{min-height:100vh;background:var(--bg);color:var(--text);font-family:var(--sans);-webkit-font-smoothing:antialiased}

/* Header */
.header{padding:18px 28px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}
.brand-row{display:flex;align-items:center;gap:10px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);margin-bottom:4px}
.brand-dot{width:8px;height:8px;border-radius:50%;background:var(--pu);box-shadow:0 0 10px rgba(167,139,250,.4)}
h1{font-size:22px;font-weight:600;letter-spacing:-.01em}h2{font-size:17px;font-weight:600;letter-spacing:-.01em}
.header-right{display:flex;align-items:center;gap:14px}
.status-badge{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted)}
.status-dot{width:8px;height:8px;border-radius:50%;background:var(--am)}.status-dot.done{background:var(--gn)}.status-dot.pulse{animation:pulse 1.2s infinite}

/* Main */
.main{padding:24px 28px;max-width:1120px;margin:0 auto}

/* Card base — shadcn pattern */
.card{background:var(--card);border-radius:var(--radius);border:1px solid var(--border);overflow:hidden}

/* Dropzone */
.dropzone{border:2px dashed var(--border-light);border-radius:16px;padding:80px 48px;text-align:center;cursor:pointer;background:var(--card);transition:all .2s}
.dropzone:hover{border-color:var(--pu);background:var(--card-alt)}
.drop-title{font-size:18px;font-weight:600;margin-bottom:10px}

/* Tab strip */
.tab-strip{padding:16px 18px;margin-bottom:18px}
.tab-file{display:flex;align-items:center;gap:10px;font-size:13px;margin-bottom:12px}
.tab-row{display:flex;gap:8px;flex-wrap:wrap}
.tab-chip{display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;font-size:12px;border:1px solid var(--border);background:var(--surface);opacity:.3;transition:all .3s}
.tab-chip.done{opacity:1;border-color:rgba(52,211,153,.2);background:rgba(52,211,153,.05)}

/* ── Summary ── */
.summary-card{margin-bottom:20px}
.summary-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:var(--border);border-radius:var(--radius);overflow:hidden;margin-bottom:14px}
.summary-item{background:var(--card);padding:22px 18px;text-align:center}
.summary-label{font-size:10px;color:var(--faint);display:block;margin-bottom:8px;text-transform:uppercase;letter-spacing:.08em;font-weight:600}
.summary-value{font-size:28px;font-family:var(--mono);font-weight:700;display:block;line-height:1.1}
.summary-sub{font-size:11px;color:var(--faint);display:block;margin-top:6px}
.summary-story{font-size:14px;color:var(--muted);line-height:1.8;padding:18px 22px;background:var(--card);border-radius:var(--radius);border:1px solid var(--border);border-left:3px solid var(--pu)}

/* ── Scope ── */
.scope-bar{display:flex;align-items:center;gap:6px;margin-bottom:22px;flex-wrap:wrap}
.scope-btn{padding:6px 16px;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;border:1px solid transparent;background:var(--surface);color:var(--faint);transition:all .15s}
.scope-btn.active{background:var(--pu-bg);color:var(--pu);border-color:rgba(167,139,250,.2)}
.scope-btn:hover{border-color:var(--border-light)}
.scope-div{width:1px;height:18px;background:var(--border);margin:0 4px}

/* ── Section header ── */
.section-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:16px}

/* ── Action cards ── */
.action-list{display:flex;flex-direction:column;gap:8px}
.action-card{transition:border-color .15s}.action-card.open{border-color:rgba(167,139,250,.25)}
.action-row{display:flex;align-items:center;gap:16px;padding:16px 20px;cursor:pointer;transition:background .1s}
.action-row:hover{background:var(--card-alt)}
.rank{width:34px;height:34px;border-radius:9px;background:var(--surface);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;font-family:var(--mono);color:var(--faint);flex-shrink:0}
.rank.top{background:var(--pu-bg);color:var(--pu)}
.action-info{flex:1;min-width:0}.action-name{display:flex;align-items:center;gap:10px;margin-bottom:4px}.action-name b{font-size:15px}
.tag-row{display:flex;gap:5px;flex-wrap:wrap}
.gap-pills{display:flex;gap:5px;flex-shrink:0;flex-wrap:wrap}
.action-val{text-align:right;width:72px;flex-shrink:0}.action-val b{font-size:18px;font-family:var(--mono);color:var(--pu);display:block;line-height:1}.action-val span{font-size:9px;color:var(--faint)}
.score-box{width:40px;height:40px;border-radius:9px;background:var(--surface);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:help}
.score-box b{font-size:14px;font-weight:700;font-family:var(--mono)}
.chevron{font-size:12px;color:var(--faint);flex-shrink:0;width:16px;text-align:center}

.action-expand{border-top:1px solid var(--border);padding:20px;background:var(--card-alt)}
.talk-track{font-size:14px;color:var(--text);line-height:1.8;padding:18px 22px;border-radius:var(--radius);border-left:3px solid var(--pu);background:rgba(167,139,250,.04);margin-bottom:16px}
.detail-row{display:flex;gap:16px;align-items:start;flex-wrap:wrap;margin-bottom:12px}
.stat-chips{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--muted)}.stat-chip b{font-family:var(--mono);font-weight:600;margin-left:3px}
.intel-card{flex:1;min-width:220px;padding:12px 16px;border-radius:var(--radius);border-left:3px solid rgba(96,165,250,.5);background:rgba(96,165,250,.06);font-size:13px;color:var(--muted);line-height:1.6}
.intel-label{font-size:10px;font-weight:600;color:var(--bl);display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.06em}
.churn-bar{display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:var(--radius);background:rgba(248,113,113,.04);border:1px solid rgba(248,113,113,.1);margin-bottom:14px;flex-wrap:wrap}
.churn-label{font-size:10px;font-weight:600;color:var(--rd);text-transform:uppercase;letter-spacing:.06em}
.churn-bar>b{font-family:var(--mono);font-size:15px;font-weight:700}
.churn-sig{font-size:10px;color:var(--faint);font-family:var(--mono);padding:3px 8px;border-radius:5px;background:var(--surface)}.churn-sig b{font-size:10px;color:var(--am)}

.prompt-trigger{width:100%;padding:12px;border-radius:var(--radius);font-size:12px;font-weight:600;cursor:pointer;border:1px solid rgba(167,139,250,.2);background:rgba(167,139,250,.06);color:var(--pu);text-align:center;transition:all .15s}

/* Engine signals */
.engine-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}
.engine-alert{grid-column:1/-1;padding:12px 16px;border-radius:var(--radius);background:var(--am-bg);border:1px solid rgba(251,191,36,.15)}
.engine-alert b{display:block;font-size:12px;color:var(--am);margin-bottom:4px}
.engine-card{padding:14px 16px;border-radius:var(--radius);background:var(--surface);border:1px solid var(--border)}
.engine-card.outage-card{border-color:rgba(248,113,113,.2);background:rgba(248,113,113,.04)}
.engine-hdr{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}
.engine-icon{width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0}
.engine-hdr b{font-size:12px;flex:1}
.engine-text{font-size:12px;color:var(--muted);line-height:1.6;margin-bottom:8px}
.engine-products{display:flex;flex-direction:column;gap:6px}
.engine-prod{display:flex;align-items:center;gap:8px}
.engine-rec{display:flex;align-items:center;gap:8px}
.pipe-badge{flex-shrink:0;width:68px;text-align:center}
.prompt-trigger:hover{background:rgba(167,139,250,.12);border-color:rgba(167,139,250,.35)}
.prompt-box{margin-top:12px;border-radius:var(--radius);border:1px solid var(--border);overflow:hidden}
.prompt-header{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:var(--surface);font-size:11px;color:var(--faint)}
.prompt-text{padding:18px;background:var(--bg);font-family:var(--mono);font-size:11px;color:var(--muted);line-height:1.75;white-space:pre-wrap;word-wrap:break-word;max-height:420px;overflow-y:auto;margin:0}

/* ── Evidence accordions ── */
.evidence-label{font-size:11px;color:var(--faint);text-transform:uppercase;letter-spacing:.12em;margin-bottom:12px;font-weight:600}
.acc{margin-bottom:8px}
.acc-trigger{width:100%;display:flex;justify-content:space-between;align-items:center;padding:14px 18px;cursor:pointer;background:transparent;border:none;color:var(--text);font-family:var(--sans);text-align:left}
.acc-title{font-size:13px;font-weight:600}.acc-right{display:flex;align-items:center;gap:12px}
.acc-content{padding:18px;border-top:1px solid var(--border);background:var(--card-alt)}
.acc-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}

/* ── Shared atoms ── */
.tag{padding:3px 9px;border-radius:6px;font-size:10px;font-weight:600;font-family:var(--mono)}
.tag.rd{background:var(--rd-bg);color:var(--rd)}.tag.gn{background:var(--gn-bg);color:var(--gn)}.tag.am{background:var(--am-bg);color:var(--am)}.tag.bl{background:var(--bl-bg);color:var(--bl)}.tag.pu{background:var(--pu-bg);color:var(--pu)}
.badge{padding:2px 8px;border-radius:6px;font-size:10px;font-weight:600;font-family:var(--mono)}.badge.gn{background:var(--gn-bg);color:var(--gn)}.badge.rd{background:var(--rd-bg);color:var(--rd)}.badge.am{background:var(--am-bg);color:var(--am)}
.label{font-size:10px;font-weight:600;color:var(--faint);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px}
.bar-track{height:6px;background:var(--bg);border-radius:4px;flex:1;min-width:50px}.bar-fill{height:100%;border-radius:4px;opacity:.7;transition:width .5s}
.bar-row{display:flex;align-items:center;gap:12px;padding:5px 0;font-size:12px}.bar-label{width:105px;color:var(--muted);flex-shrink:0}
.list-row{display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--surface);border-radius:8px;margin-bottom:5px;font-size:12px}.list-row b{flex:1}
.event-row{display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--surface);border-radius:8px;margin-bottom:5px;font-size:12px}
.event-tag{padding:3px 9px;border-radius:5px;font-size:9px;font-family:var(--mono);font-weight:700;flex-shrink:0;text-transform:uppercase}.event-text{flex:1}

/* ── Buttons — shadcn variants ── */
.btn-purple{padding:9px 20px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:none;background:var(--pu);color:var(--bg);transition:filter .15s}
.btn-blue{padding:9px 20px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:none;background:var(--bl);color:var(--bg)}
.btn-ghost{padding:9px 20px;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;border:1px solid var(--border);background:transparent;color:var(--muted)}
.btn-outline-purple{padding:7px 16px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid rgba(167,139,250,.25);background:rgba(167,139,250,.08);color:var(--pu)}
.btn-sm-purple{padding:6px 14px;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer;border:none;background:var(--pu);color:var(--bg)}
button:hover{filter:brightness(1.12)}

/* ── CTA ── */
.cta-bar{background:var(--card);border-radius:var(--radius);border:1px solid rgba(167,139,250,.15);padding:16px 22px;display:flex;justify-content:space-between;align-items:center;margin-top:24px}

/* ── Colors ── */
.cy{color:var(--cy)}.pu{color:var(--pu)}.gn{color:var(--gn)}.rd{color:var(--rd)}.am{color:var(--am)}.bl{color:var(--bl)}
.text-sm{font-size:13px}.text-xs{font-size:11px}.text-muted{color:var(--muted)}.text-faint{color:var(--faint)}.text-green{color:var(--gn)}
.font-mono{font-family:var(--mono)}

/* ── Animation ── */
.fade-up{animation:fadeUp .45s ease-out both}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}

::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
      `}</style>
    </div>
  );
}
