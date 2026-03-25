import { useState, useCallback, useRef } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, LineChart, Line, ComposedChart, Legend, Cell, PieChart, Pie } from "recharts";

// ═══════════════════════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════════════════════
const T = {
  bg:"#06080F",surface:"#0D1117",card:"#161B22",cardHover:"#1C2333",
  border:"#21262D",borderLight:"#30363D",
  text:"#E6EDF3",textMid:"#8B949E",textDim:"#484F58",
  cyan:"#58A6FF",green:"#3FB950",red:"#F85149",
  yellow:"#D29922",orange:"#DB6D28",purple:"#BC8CFF",blue:"#388BFD",
  teal:"#2DD4BF",pink:"#F778BA",lime:"#A3E635",
};
const f=`'SF Mono','Cascadia Code','JetBrains Mono',monospace`;
const s=`'Inter',system-ui,sans-serif`;
const $=n=>`$${Math.abs(n).toLocaleString(undefined,{maximumFractionDigits:0})}`;
const $k=n=>Math.abs(n)>=1000?`$${(n/1000).toFixed(1)}K`:`$${n.toFixed(0)}`;
const pc=n=>`${(n*100).toFixed(0)}%`;
const pc1=n=>`${(n*100).toFixed(1)}%`;

const Badge=({children,color=T.cyan,size="sm"})=><span style={{display:"inline-flex",padding:size==="sm"?"1px 7px":"3px 10px",borderRadius:"12px",fontFamily:f,fontSize:size==="sm"?"9px":"10px",fontWeight:600,letterSpacing:"0.03em",color,background:`${color}18`,border:`1px solid ${color}30`}}>{children}</span>;

const Stat=({label,value,sub,color=T.cyan,small})=>(
  <div style={{padding:small?"8px":"10px 12px",background:T.card,borderRadius:"8px",border:`1px solid ${T.border}`}}>
    <div style={{fontFamily:f,fontSize:"8px",color:T.textDim,letterSpacing:"0.08em",marginBottom:"4px",textTransform:"uppercase"}}>{label}</div>
    <div style={{fontFamily:f,fontSize:small?"14px":"18px",fontWeight:700,color,lineHeight:1}}>{value}</div>
    {sub&&<div style={{fontFamily:f,fontSize:"9px",color:T.textDim,marginTop:"3px"}}>{sub}</div>}
  </div>
);

const PBar=({value,color,h=5})=>(
  <div style={{height:`${h}px`,background:T.border,borderRadius:`${h}px`,overflow:"hidden"}}>
    <div style={{width:`${Math.min(value*100,100)}%`,height:"100%",background:color,borderRadius:`${h}px`,transition:"width 0.8s ease"}}/>
  </div>
);

const chartTheme={bg:T.card,grid:T.border,text:T.textDim,font:f,tooltip:{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,fontSize:11,fontFamily:s,color:T.text}};

// ═══════════════════════════════════════════════════════════════
// DEMO DATA — 3 telecom infrastructure accounts
// ═══════════════════════════════════════════════════════════════
const ACCOUNTS = [
  {
    id:"cust1",name:"Customer 1",vertical:"Carrier",
    arr:515299,mrr:42941,pipeline_mrr:34639,pipeline_count:14,
    won:22,lost:4,win_rate:0.846,avg_cycle:23,nrr:1.12,
    days_silent:14,velocity:"accelerating",risk_score:18,risk_level:"moderate",
    rep:"William Good",reps:11,tenure_mo:62,
    disconnects:2,downgrades:2,downgrade_mrr:2050,lost_mrr:10750,
    products:["Wavelengths - Long Haul","Dark Fiber - Metro"],
    concentration:{
      "Wavelengths - Long Haul":{mrr:29140,pct:0.68},
      "Dark Fiber - Metro":{mrr:13802,pct:0.32}
    },
    pipeline_by_stage:{Discover:{count:7,mrr:20860},Design:{count:2,mrr:0},Propose:{count:3,mrr:7061},Negotiate:{count:2,mrr:6718}},
    // Bayesian demo
    predictions:[
      {product:"Dark Fiber - Metro",event:"expansion",prior:0.35,posterior:0.78,mrr:"$3,000-$5,000",timing:"30-60 days",evidence:["2 deals in Negotiate stage","Accelerating velocity (13 deals in 6mo)","Historical 90-day purchase cadence — currently at day 40"],direction:"strengthened",confidence:0.82},
      {product:"IP Services",event:"new_purchase",prior:0.15,posterior:0.42,mrr:"$4,000-$8,000",timing:"60-90 days",evidence:["Cross-sell gap: Carrier vertical buys IP 87% of the time","14 active deals signal infrastructure buildout","No IP in current portfolio despite heavy fiber/wavelength footprint"],direction:"strengthened",confidence:0.71},
      {product:"Wavelengths - Long Haul",event:"expansion",prior:0.40,posterior:0.65,mrr:"$4,000-$10,000",timing:"30-45 days",evidence:["4 Discover-stage wavelength deals","68% of revenue = wavelengths, natural expansion vector","Recent $10K+/mo wavelength wins signal ongoing capacity buildout"],direction:"strengthened",confidence:0.77},
    ],
    cross_sell:[{product:"IP Services",prob:0.42,reason:"Carrier customers buying wavelengths and dark fiber purchase IP 87% of the time. Gap likely means competitor-served.",trigger:"Mention IP bundling during next Negotiate-stage conversation"},{product:"Ethernet",prob:0.28,reason:"Natural complement to dark fiber for last-mile delivery. 4 of 5 similar carrier accounts have Ethernet.",trigger:"Technical review meeting — ask about last-mile connectivity needs"}],
    churn_preds:[{product:"Wavelengths - Long Haul",prob:0.15,timing:"6-12 months",signals:["3 recent Close-Lost wavelength deals ($10,750)","Commoditization pressure on wavelength pricing","2 disconnects in 2025"],action:"Lock in multi-year agreement with volume discount to prevent circuit-by-circuit attrition"}],
    portfolio_health:"growing",arr_12mo_change:"+$60K-$100K",
    // Active deals for GT
    active_deals:[
      {product:"Dark Fiber - Metro",mrr:3255,stage:"Negotiate",forecast:"Best Case",close:"4/30/2026",rep:"William Good"},
      {product:"Dark Fiber - Metro",mrr:3463,stage:"Negotiate",forecast:"Best Case",close:"4/30/2026",rep:"William Good"},
      {product:"Dark Fiber - Metro",mrr:4561,stage:"Propose",forecast:"Longshot",close:"4/30/2026",rep:"William Good"},
      {product:"Wavelengths - Long Haul",mrr:3961,stage:"Discover",forecast:"Not In Forecast",close:"3/31/2026",rep:"William Good"},
      {product:"Wavelengths - Long Haul",mrr:4065,stage:"Discover",forecast:"Not In Forecast",close:"3/31/2026",rep:"William Good"},
    ],
    // GT demo for first deal
    game_theory:{
      win_prob:0.82,value:"$3,255/mo ($39K ARR)",buyer_urgency:"high",competition:"moderate",info_edge:"seller",
      strategy:{name:"Accelerate Close — Bundle Lock",type:"bundle_lock",rationale:"Two Negotiate-stage fiber deals from same account. Bundle into single MSA with volume pricing. The buyer is expanding infrastructure rapidly (14 deals) — they want speed and simplicity, not lowest price. Your physical fiber presence is non-replicable."},
      nash:"Seller bundles both Negotiate deals into MSA; buyer accepts because switching costs for lit dark fiber are prohibitive and timeline is urgent. Competitor's best response is to target wavelength pricing on future deals rather than contest active fiber.",
      sequence:[{move:1,actor:"seller",action:"Present combined proposal for both Negotiate-stage fiber deals as single MSA",response:"Buyer evaluates total package vs. individual circuits",timing:"This week"},{move:2,actor:"buyer",action:"Requests 5-8% discount for commitment",response:"Offer 3% + waived install fees (higher perceived value, lower cost)",timing:"Week 2"},{move:3,actor:"seller",action:"Introduce IP Services discussion while momentum is high",response:"Buyer agrees to technical review meeting",timing:"Week 3"}],
      pricing:{anchor:"$3,255/mo per circuit (list rate)",floor:"$2,930/mo (10% max discount)",value_levers:["Waived installation ($15K value per circuit)","Dedicated project manager for both circuits","Priority provisioning (30-day vs. 60-day standard)","Future wavelength pricing lock for 12 months"],bundles:["Both fiber circuits + 12-month wavelength commitment = 5% blended","Add IP Services DIA = additional 3% across all products"]},
      concessions:[{if_says:"Your competitor quoted 15% less on similar fiber routes.",respond:"On a single-circuit basis, that may be true for certain routes. But when we look at your total infrastructure — 14 active projects — an MSA structure gives you a blended rate that individual circuit quotes can't match. Plus, our fiber is already in-building at 8 of your 10 target locations.",cost:"0% — reframing, no actual discount",value:"High — shifts comparison from price to total value"},{if_says:"We need to push the timeline out 60 days.",respond:"I understand timeline flexibility. However, I should let you know that our install crews are currently scheduled for your routes in the next 30 days. If we push past that window, the next available slot is 90+ days out. I'd recommend we lock the agreement now with a flexible start date.",cost:"Low — schedule hold costs minimal",value:"High — creates urgency without being aggressive"}],
      competitive:{competitor_offer:"Regional fiber provider quoting 12-15% below on individual dark fiber circuits",differentiation:"In-building presence at 8 of 10 target locations. Competitor would require new construction (6-12 month lead time vs. 30 days). Total cost of delay exceeds any per-circuit savings.",trap:"Ask buyer to compare total project timeline and construction risk, not just monthly rate."},
      closing:["Buyer asks about implementation timeline specifics","Buyer introduces procurement/legal team to the conversation","Buyer requests contract redline rather than asking for more proposals","References to 'when we go live' rather than 'if we choose you'"],
      walk_away:["Buyer demands >15% discount with no volume commitment","Buyer reveals they've already signed with competitor for primary routes","Decision timeline extends beyond 120 days with no executive engagement"],
      talk_track:"I've put together a combined proposal for both fiber circuits that gives you better economics than individual quotes. Given that we already have fiber in-building at most of your target locations, we can have both circuits lit within 30 days of signing. I'd also like to schedule a technical review to discuss how our IP Services portfolio could simplify your network architecture as you scale."
    },
    // Signals demo
    signals:{
      company_summary:"Customer 1 is a major regional carrier expanding fiber and wavelength infrastructure across the western US. Recent FCC filings indicate spectrum acquisition for 5G backhaul, and the company has announced $200M in capital expenditure for 2026 network buildout.",
      signal_strength:"strong",match_confidence:0.92,
      items:[
        {headline:"$200M CapEx plan announced for 2026 network expansion",type:"expansion",urgency:"act_now",impact:"Major infrastructure buildout = sustained demand for dark fiber and wavelengths over 12-18 months. Pipeline should grow significantly beyond current 14 deals.",confidence:0.88},
        {headline:"FCC spectrum acquisition filing for 5G backhaul",type:"regulatory",urgency:"this_week",impact:"5G backhaul requires fiber connectivity to tower sites. New product opportunity for small-cell fiber connections. Opens door to IP transit discussion.",confidence:0.85},
        {headline:"New VP of Network Engineering hired from competitor",type:"leadership",urgency:"this_month",impact:"New technical leader may re-evaluate vendor relationships. Risk: could favor previous employer's solutions. Opportunity: fresh relationship, chance to demonstrate technical depth.",confidence:0.79},
        {headline:"Q4 2025 earnings: 18% YoY revenue growth, upgraded guidance",type:"financial",urgency:"monitor",impact:"Strong financial health confirms ability to fund infrastructure expansion. Low churn risk on existing services. Budget availability for new purchases.",confidence:0.91},
      ]
    },
    // Backtest demo
    backtest:[
      {q:"2024 Q3",actual:{outcome:"expanded",won_mrr:20121,lost_mrr:0,net:20121},predicted:{outcome:"expanded",churn:"low",confidence:0.78},score:90},
      {q:"2024 Q4",actual:{outcome:"grew_modestly",won_mrr:44,lost_mrr:0,net:44},predicted:{outcome:"stable",churn:"low",confidence:0.65},score:60},
      {q:"2025 Q1",actual:{outcome:"churned/contracted",won_mrr:20,lost_mrr:5200,net:-5180},predicted:{outcome:"stable",churn:"low",confidence:0.62},score:20},
      {q:"2025 Q2",actual:{outcome:"expanded",won_mrr:10000,lost_mrr:3800,net:6200},predicted:{outcome:"expanded",churn:"medium",confidence:0.71},score:70},
      {q:"2025 Q3",actual:{outcome:"churned/contracted",won_mrr:12579,lost_mrr:1750,net:10829},predicted:{outcome:"expanded",churn:"medium",confidence:0.68},score:50},
      {q:"2025 Q4",actual:{outcome:"expanded",won_mrr:8987,lost_mrr:0,net:8987},predicted:{outcome:"expanded",churn:"low",confidence:0.74},score:80},
      {q:"2026 Q1",actual:{outcome:"expanded",won_mrr:4494,lost_mrr:0,net:4494},predicted:{outcome:"expanded",churn:"low",confidence:0.81},score:90},
    ],
    // Losses
    losses:{
      deals:[
        {product:"Wavelengths - Long Haul",mrr:5200,date:"6/15/2025",type:"New Service",rep:"William Good",days_pipe:97},
        {product:"Dark Fiber - Metro",mrr:3800,date:"9/22/2025",type:"New Service",rep:"William Good",days_pipe:113},
        {product:"Wavelengths - Long Haul",mrr:1750,date:"11/30/2025",type:"New Service",rep:"Michael Kahn",days_pipe:107},
        {product:"Wavelengths - Long Haul",mrr:0,date:"1/2/2022",type:"Positive Re-Rate",rep:"Usama Fayyaz",days_pipe:90},
      ],
      disconnects:[{product:"Wavelengths - Long Haul",date:"4/15/2025"},{product:"Dark Fiber - Metro",date:"7/20/2025"}],
      downgrades:[{product:"Wavelengths - Long Haul",mrr:-1200,date:"8/1/2025"},{product:"Dark Fiber - Metro",mrr:-850,date:"1/15/2026"}],
      by_product:{"Wavelengths - Long Haul":{count:3,mrr:6950},"Dark Fiber - Metro":{count:1,mrr:3800}},
      timeline:[{q:"2022 Q1",lost:0,disc:0,down:0},{q:"2025 Q2",lost:5200,disc:1,down:0},{q:"2025 Q3",lost:3800,disc:1,down:1200},{q:"2025 Q4",lost:1750,disc:0,down:0},{q:"2026 Q1",lost:0,disc:0,down:850}],
    },
    // Revenue timeline
    revenue_tl:[
      {q:"2021 Q1",new:949,rr_up:8,rr_down:0,lost:0,net:957,cum:957},
      {q:"2021 Q4",new:0,rr_up:50,rr_down:0,lost:0,net:50,cum:1007},
      {q:"2022 Q4",new:0,rr_up:91,rr_down:0,lost:0,net:91,cum:1098},
      {q:"2023 Q4",new:0,rr_up:43,rr_down:0,lost:0,net:43,cum:1141},
      {q:"2024 Q1",new:0,rr_up:20,rr_down:0,lost:0,net:20,cum:1161},
      {q:"2024 Q4",new:0,rr_up:44,rr_down:0,lost:0,net:44,cum:1205},
      {q:"2025 Q2",new:0,rr_up:0,rr_down:0,lost:5200,net:-5200,cum:-3995},
      {q:"2025 Q3",new:20121,rr_up:0,rr_down:-1200,lost:3800,net:15121,cum:11126},
      {q:"2025 Q4",new:12579,rr_up:46,rr_down:0,lost:1750,net:10875,cum:22001},
      {q:"2026 Q1",new:8987,rr_up:5,rr_down:-850,lost:0,net:8142,cum:30143},
    ],
    // Learning curve
    learning:[
      {deals:5,accuracy:32,churn:20,expand:40,outcome:25},
      {deals:10,accuracy:45,churn:35,expand:50,outcome:40},
      {deals:15,accuracy:58,churn:50,expand:60,outcome:55},
      {deals:20,accuracy:67,churn:65,expand:70,outcome:62},
      {deals:25,accuracy:74,churn:72,expand:75,outcome:70},
      {deals:30,accuracy:79,churn:78,expand:80,outcome:76},
      {deals:35,accuracy:83,churn:82,expand:84,outcome:81},
      {deals:40,accuracy:85,churn:84,expand:86,outcome:84},
    ],
    locations:[
      {name:"Denver POP - 900 Auraria",type:"Data Center",lat:39.7456,lng:-105.0069,status:"on-net",lit:true,services:2,mrr:20121,products:["Wavelengths - Long Haul"],note:"Primary POP. 2x100G wavelengths to COS."},
      {name:"Centennial Medical Campus",type:"Hospital",lat:39.7329,lng:-104.9408,status:"on-net",lit:true,services:4,mrr:12579,products:["Dark Fiber - Metro"],note:"Main campus. 4 buildings connected via intra-campus fiber."},
      {name:"Springs Campus",type:"Hospital",lat:38.8561,lng:-104.8214,status:"on-net",lit:true,services:2,mrr:10121,products:["Wavelengths - Long Haul"],note:"Secondary campus. Wavelength to Denver."},
      {name:"Pueblo Clinic",type:"Branch",lat:38.2650,lng:-104.6127,status:"near-net",lit:false,services:0,mrr:0,products:[],note:"New clinic Q3 2026. Fiber within 800ft."},
      {name:"Fort Collins Medical",type:"Branch",lat:40.5853,lng:-105.0844,status:"near-net",lit:false,services:0,mrr:0,products:[],note:"Satellite office. Near-net fiber available."},
      {name:"Grand Junction Clinic",type:"Branch",lat:39.0639,lng:-108.5506,status:"off-net",lit:false,services:0,mrr:0,products:[],note:"Western slope. No fiber. New build required."},
      {name:"Boulder Research Lab",type:"Office",lat:40.0150,lng:-105.2705,status:"near-net",lit:false,services:0,mrr:0,products:[],note:"Research facility. Dark fiber prospect."},
      {name:"DIA Medical Facility",type:"Branch",lat:39.8561,lng:-104.6737,status:"on-net",lit:true,services:1,mrr:4494,products:["Wavelengths - Long Haul"],note:"Airport facility. Recently lit wavelength."},
    ],
  },
  {
    id:"cust2",name:"Customer 2",vertical:"Software & Tech",
    arr:448786,mrr:37399,pipeline_mrr:1000,pipeline_count:1,
    won:34,lost:5,win_rate:0.872,avg_cycle:30,nrr:0.87,
    days_silent:497,velocity:"stalled",risk_score:62,risk_level:"critical",
    rep:"Jose Banales",reps:19,tenure_mo:75,
    disconnects:3,downgrades:3,downgrade_mrr:4850,lost_mrr:12200,
    products:["IP Services","zColo","Ethernet","Dark Fiber - Metro"],
    concentration:{"zColo":{mrr:13848,pct:0.37},"IP Services":{mrr:17201,pct:0.46},"Ethernet":{mrr:6133,pct:0.16},"Dark Fiber - Metro":{mrr:217,pct:0.01}},
    pipeline_by_stage:{Design:{count:1,mrr:1000}},
    predictions:[
      {product:"IP Services",event:"churn",prior:0.20,posterior:0.52,mrr:"-$3,000-$8,000",timing:"60-90 days",evidence:["2 recent IP losses ($5,300 MRR)","497 days since last activity","NRR below 90% — account is contracting","New VP of Engineering may consolidate vendors"],direction:"strengthened",confidence:0.74},
      {product:"zColo",event:"churn",prior:0.15,posterior:0.38,mrr:"-$5,000-$13,000",timing:"3-6 months",evidence:["3 colo disconnects in last 18 months","Cloud migration trend in Software & Tech vertical","$2,400 colo downgrade in Q1 2024"],direction:"strengthened",confidence:0.68},
      {product:"IP Services",event:"renewal",prior:0.60,posterior:0.45,mrr:"$2,000-$5,000",timing:"90+ days",evidence:["Only active pipeline deal is Longshot","19 reps = no relationship continuity","497 days silence = lowest engagement in account history"],direction:"weakened",confidence:0.61},
    ],
    cross_sell:[{product:"Cloud Connect",prob:0.35,reason:"Software companies migrating from colo to cloud need connectivity bridges. This is the natural next step.",trigger:"Strategic Business Review — ask about AWS/Azure adoption plans"}],
    churn_preds:[{product:"zColo",prob:0.38,timing:"3-6 months",signals:["3 disconnects","Cloud migration pressure","$2,400 downgrade"],action:"Schedule colo contract review. Offer hybrid cloud connectivity package before next renewal."},{product:"IP Services",prob:0.52,timing:"60-90 days",signals:["2 losses","497 days silent","Negative velocity"],action:"Immediate re-engagement. Assign dedicated rep. Executive outreach within 1 week."}],
    portfolio_health:"at_risk",arr_12mo_change:"-$30K-$60K",
    active_deals:[{product:"IP Services",mrr:1000,stage:"Design Solution",forecast:"Longshot",close:"10/31/2026",rep:"Jose Banales"}],
    game_theory:{
      win_prob:0.35,value:"$1,000/mo ($12K ARR)",buyer_urgency:"low",competition:"fierce",info_edge:"buyer",
      strategy:{name:"Relationship Recovery — Value Reframe",type:"value_reframe",rationale:"This deal is a lifeline for a $449K ARR account that's gone dark. The $1K/mo deal itself is small, but it represents the only active engagement. Use it as the entry point to re-establish the relationship, not as a standalone negotiation."},
      nash:"Buyer has all the leverage — they know you've been absent for 16 months and competitors are offering alternatives. Your equilibrium move is to over-invest in this deal (concede on price) to re-establish presence, then leverage the colo stickiness to rebuild the broader relationship.",
      sequence:[{move:1,actor:"seller",action:"Executive-level outreach acknowledging the gap, requesting Strategic Business Review",response:"Buyer cautiously agrees to meeting",timing:"This week"},{move:2,actor:"buyer",action:"Reveals they've been evaluating cloud migration and competitor IP offerings",response:"Listen, document, don't pitch. Acknowledge their evaluation is reasonable.",timing:"Week 2"},{move:3,actor:"seller",action:"Present hybrid cloud connectivity proposal + IP deal with aggressive pricing",response:"Buyer compares to competitor proposals",timing:"Week 4"}],
      pricing:{anchor:"$1,000/mo (current proposal)",floor:"$750/mo (25% discount)",value_levers:["Free 90-day proof of concept","Dedicated technical account manager","Cloud connectivity assessment at no cost","Bundle with colo renewal for blended pricing"],bundles:["IP + Cloud Connect + colo renewal = 15% blended discount","Multi-year commitment = additional 5%"]},
      concessions:[{if_says:"We've been getting better pricing from CloudNet for the last year.",respond:"That's fair — and I'll be direct, we haven't been showing up for you the way we should have. Rather than competing on price alone, I'd like to show you our cloud connectivity roadmap that integrates with your existing colo footprint. That's something CloudNet can't offer because your infrastructure is physically in our facility.",cost:"Moderate — may need 10-15% discount to match",value:"High — shifts conversation from commodity pricing to integrated value"}],
      competitive:{competitor_offer:"CloudNet offering IP transit at 20% below your rates with cloud-native bundling",differentiation:"Physical colo presence — their servers are in your facility. Cloud connectivity that bridges on-prem and cloud. Integrated billing across all services.",trap:"Ask buyer to model the total cost of migrating colo workloads to a new provider vs. leveraging existing infrastructure with cloud connectivity overlay."},
      closing:["Buyer asks to include colo team in next meeting","Buyer shares their cloud migration timeline","Buyer asks about multi-year pricing"],
      walk_away:["Buyer has already signed 3-year deal with competitor for IP","Colo contract is not renewing and they've begun physical migration","No executive engagement after 3 outreach attempts"],
      talk_track:"I want to start by acknowledging something — we haven't been the partner you deserve over the last 16 months, and that changes today. I've been assigned as your dedicated account manager, and my first priority is understanding where your infrastructure strategy is heading. I know you're evaluating options, and I think there's a compelling story around how your existing colo footprint connects to wherever you're going with cloud."
    },
    signals:{
      company_summary:"Customer 2 is a mid-market software company that has been shifting workloads to AWS over the past 18 months. Recent job postings indicate hiring for cloud infrastructure roles, and the company announced a $45M Series C focused on platform scalability.",
      signal_strength:"strong",match_confidence:0.88,
      items:[
        {headline:"$45M Series C announced — platform scalability focus",type:"funding",urgency:"act_now",impact:"Capital infusion means infrastructure spend is increasing. But direction matters: if it's all going to cloud, colo and traditional IP are at risk. If hybrid, opportunity to position cloud connectivity.",confidence:0.90},
        {headline:"Hiring 3 Cloud Infrastructure Engineers (AWS focus)",type:"technology",urgency:"this_week",impact:"Confirms cloud migration trajectory. On-prem/colo workloads likely decreasing. Need to pivot positioning from traditional infrastructure to cloud connectivity and hybrid solutions.",confidence:0.86},
        {headline:"CTO keynote at re:Invent mentioned 'cloud-first infrastructure strategy'",type:"leadership",urgency:"act_now",impact:"CTO publicly committed to cloud-first. Colo and traditional IP positioning must shift to 'cloud enablement' — interconnection, Direct Connect, low-latency bridges. Existing framing will not resonate.",confidence:0.83},
        {headline:"Glassdoor reviews mention 'aging infrastructure' as pain point",type:"risk",urgency:"this_month",impact:"Internal frustration with current infrastructure = both risk (they want change) and opportunity (position as the modernization partner, not the legacy vendor).",confidence:0.62},
      ]
    },
    backtest:[
      {q:"2024 Q1",actual:{outcome:"grew_modestly",won_mrr:949,lost_mrr:0,net:949},predicted:{outcome:"stable",churn:"low",confidence:0.60},score:50},
      {q:"2024 Q2",actual:{outcome:"churned/contracted",won_mrr:0,lost_mrr:1800,net:-1800},predicted:{outcome:"stable",churn:"medium",confidence:0.55},score:40},
      {q:"2024 Q3",actual:{outcome:"churned/contracted",won_mrr:0,lost_mrr:4500,net:-4500},predicted:{outcome:"churned/contracted",churn:"high",confidence:0.72},score:90},
      {q:"2024 Q4",actual:{outcome:"dormant",won_mrr:0,lost_mrr:0,net:0},predicted:{outcome:"dormant",churn:"medium",confidence:0.65},score:80},
      {q:"2025 Q1",actual:{outcome:"dormant",won_mrr:0,lost_mrr:0,net:0},predicted:{outcome:"dormant",churn:"high",confidence:0.70},score:80},
    ],
    losses:{
      deals:[
        {product:"IP Services",mrr:3500,date:"8/15/2023",type:"New Service",rep:"Andrew Jahant",days_pipe:106},
        {product:"Ethernet",mrr:2200,date:"2/10/2024",type:"New Service",rep:"Andrew Jahant",days_pipe:87},
        {product:"IP Services",mrr:1800,date:"7/30/2024",type:"New Service",rep:"Andrew Jahant",days_pipe:99},
        {product:"zColo",mrr:4500,date:"11/5/2024",type:"New Service",rep:"Jennifer Middleton",days_pipe:96},
        {product:"zColo",mrr:200,date:"2/28/2021",type:"New Service",rep:"Joseph Quick",days_pipe:88},
      ],
      disconnects:[{product:"zColo",date:"6/1/2023"},{product:"zColo",date:"1/15/2024"},{product:"Ethernet",date:"5/1/2024"}],
      downgrades:[{product:"zColo",mrr:-2400,date:"3/1/2024"},{product:"IP Services",mrr:-1650,date:"9/15/2024"},{product:"zColo",mrr:-800,date:"12/1/2024"}],
      by_product:{"IP Services":{count:2,mrr:5300},"Ethernet":{count:1,mrr:2200},"zColo":{count:2,mrr:4700}},
      timeline:[{q:"2023 Q3",lost:3500,disc:1,down:0},{q:"2024 Q1",lost:2200,disc:1,down:2400},{q:"2024 Q2",lost:1800,disc:1,down:0},{q:"2024 Q3",lost:0,disc:0,down:1650},{q:"2024 Q4",lost:4500,disc:0,down:800}],
    },
    revenue_tl:[
      {q:"2020 Q1",new:1840,rr_up:0,rr_down:0,lost:0,net:1840,cum:1840},
      {q:"2020 Q2",new:14200,rr_up:22,rr_down:0,lost:0,net:14222,cum:16062},
      {q:"2020 Q3",new:1550,rr_up:18,rr_down:0,lost:0,net:1568,cum:17630},
      {q:"2021 Q2",new:1870,rr_up:117,rr_down:0,lost:0,net:1987,cum:19617},
      {q:"2022 Q2",new:2133,rr_up:9422,rr_down:0,lost:0,net:11555,cum:31172},
      {q:"2023 Q1",new:1312,rr_up:0,rr_down:0,lost:0,net:1312,cum:32484},
      {q:"2023 Q3",new:0,rr_up:1406,rr_down:0,lost:3500,net:-2094,cum:30390},
      {q:"2024 Q1",new:949,rr_up:0,rr_down:-2400,lost:2200,net:-3651,cum:26739},
      {q:"2024 Q3",new:0,rr_up:0,rr_down:-1650,lost:6300,net:-7950,cum:18789},
    ],
    learning:[
      {deals:10,accuracy:28,churn:20,expand:35,outcome:22},
      {deals:20,accuracy:42,churn:38,expand:45,outcome:38},
      {deals:30,accuracy:55,churn:52,expand:55,outcome:50},
      {deals:40,accuracy:65,churn:68,expand:60,outcome:62},
      {deals:50,accuracy:72,churn:75,expand:68,outcome:70},
      {deals:60,accuracy:78,churn:80,expand:74,outcome:76},
    ],
    locations:[
      {name:"Arapahoe HQ",type:"Office",lat:39.5964,lng:-104.8690,status:"on-net",lit:true,services:1,mrr:8500,products:["IP Services"],note:"Primary office + NOC. 1G DIA + DDoS."},
      {name:"Denver Data Center",type:"Colo",lat:39.7536,lng:-104.9998,status:"on-net",lit:true,services:1,mrr:2100,products:["zColo"],note:"Edge colo for SCADA. One cab disconnected — migrated to AWS."},
      {name:"San Luis Valley Solar Site",type:"Tower",lat:37.4695,lng:-105.8700,status:"off-net",lit:false,services:0,mrr:0,products:[],note:"400MW solar+storage. DOE funded. Fiber buildout opportunity."},
      {name:"Pueblo Solar Array",type:"Tower",lat:38.2970,lng:-104.5980,status:"off-net",lit:false,services:0,mrr:0,products:[],note:"Phase 2 solar installation. Needs SCADA connectivity."},
      {name:"Colorado Springs Substation",type:"Remote Site",lat:38.8339,lng:-104.8253,status:"near-net",lit:false,services:0,mrr:0,products:[],note:"Grid interconnection point. Fiber within 500ft."},
      {name:"AWS US-West-2 (Oregon)",type:"Data Center",lat:45.5946,lng:-122.1509,status:"off-net",lit:false,services:0,mrr:0,products:[],note:"Primary cloud region. Direct Connect prospect."},
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// PAGES
// ═══════════════════════════════════════════════════════════════
const PAGES=[
  {id:"overview",label:"Overview",icon:"◉"},
  {id:"locations",label:"Locations",icon:"📍"},
  {id:"predict",label:"Predictions",icon:"📊"},
  {id:"deals",label:"Deals",icon:"♟"},
  {id:"signals",label:"Signals",icon:"📡"},
  {id:"losses",label:"Losses",icon:"⚠"},
  {id:"backtest",label:"Backtest",icon:"⏪"},
  {id:"learning",label:"Learning",icon:"📈"},
];

// ─── US MAP PROJECTION (simplified Albers for continental US) ──
function projectUS(lat,lng,w=800,h=500){
  // Simple conic projection approximation for continental US
  // Covers roughly lng -125 to -66, lat 24 to 50
  const lngMin=-125,lngMax=-66,latMin=24,latMax=50;
  const x=((lng-lngMin)/(lngMax-lngMin))*w;
  const y=((latMax-lat)/(latMax-latMin))*h;
  return[x,y];
}

const statusColor={"on-net":T.green,"near-net":T.yellow,"off-net":T.red};
const statusLabel={"on-net":"On-Net","near-net":"Near-Net","off-net":"Off-Net"};

// Simplified US state boundary path (continental outline + major state borders)
const US_OUTLINE="M50,180 L55,120 L80,80 L130,50 L200,30 L280,20 L350,15 L420,18 L500,25 L560,30 L610,50 L650,70 L680,95 L710,130 L730,170 L740,220 L735,270 L720,310 L700,345 L670,370 L640,390 L600,400 L550,410 L500,420 L440,425 L380,420 L320,410 L260,395 L200,380 L150,360 L110,330 L80,290 L60,250 L50,210 Z";
const US_STATES=[
  // Rough state border segments for visual effect
  "M350,15 L350,425","M500,25 L500,420","M200,30 L200,380","M650,70 L640,390",
  "M130,50 L130,330","M280,20 L280,395","M420,18 L420,425","M560,30 L560,410",
  "M50,180 L740,220","M55,120 L730,170","M80,290 L720,310","M110,330 L700,345",
  "M150,360 L670,370",
];

function PageLocations({a}){
  const[selLoc,setSelLoc]=useState(null);
  const locs=a.locations||[];
  const W=800,H=500;
  const onNet=locs.filter(l=>l.status==="on-net");
  const nearNet=locs.filter(l=>l.status==="near-net");
  const offNet=locs.filter(l=>l.status==="off-net");
  const totalLocMRR=locs.reduce((s,l)=>s+(l.mrr||0),0);
  const totalServices=locs.reduce((s,l)=>s+(l.services||0),0);

  // Project all locations
  const projected=locs.map(l=>{const[x,y]=projectUS(l.lat,l.lng,W,H);return{...l,x,y};});

  return(<div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"8px",marginBottom:"14px"}}>
      <Stat label="TOTAL LOCATIONS" value={locs.length} color={T.cyan}/>
      <Stat label="ON-NET" value={onNet.length} sub={`${$(onNet.reduce((s,l)=>s+(l.mrr||0),0))}/mo`} color={T.green}/>
      <Stat label="NEAR-NET" value={nearNet.length} sub="Expansion targets" color={T.yellow}/>
      <Stat label="OFF-NET" value={offNet.length} sub="New build required" color={T.red}/>
      <Stat label="ACTIVE SERVICES" value={totalServices} sub={`${$(totalLocMRR)}/mo`} color={T.blue}/>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:"12px"}}>
      {/* Map */}
      <div style={{background:T.card,borderRadius:"10px",border:`1px solid ${T.border}`,padding:"16px"}}>
        <div style={{fontFamily:f,fontSize:"9px",color:T.textDim,letterSpacing:"0.08em",marginBottom:"10px"}}>LOCATION MAP</div>
        <div style={{position:"relative",width:"100%",paddingBottom:`${(H/W)*100}%`,background:"linear-gradient(180deg, #0a0e1a 0%, #0f1726 100%)",borderRadius:"8px",border:`1px solid ${T.border}`,overflow:"hidden"}}>
          {/* US outline via SVG background */}
          <svg viewBox={`0 0 ${W} ${H}`} style={{position:"absolute",top:0,left:0,width:"100%",height:"100%"}}>
            <path d={US_OUTLINE} fill={`${T.borderLight}15`} stroke={T.borderLight} strokeWidth="1.5" opacity="0.6"/>
            {US_STATES.map((d,i)=><path key={`s${i}`} d={d} fill="none" stroke={T.border} strokeWidth="0.5" opacity="0.3"/>)}
            {[0,1,2,3,4].map(i=><line key={`gh${i}`} x1="0" y1={i*H/4} x2={W} y2={i*H/4} stroke={T.border} strokeWidth="0.3" opacity="0.2"/>)}
            {[0,1,2,3,4,5,6].map(i=><line key={`gv${i}`} x1={i*W/6} y1="0" x2={i*W/6} y2={H} stroke={T.border} strokeWidth="0.3" opacity="0.2"/>)}
            {/* Connection lines between on-net sites */}
            {projected.filter(l=>l.status==="on-net").map((l,i,arr)=>{
              if(i===0)return null;
              return <line key={`cn${i}`} x1={arr[i-1].x} y1={arr[i-1].y} x2={l.x} y2={l.y} stroke={T.green} strokeWidth="1" opacity="0.2" strokeDasharray="4 4"/>;
            })}
          </svg>

          {/* Location pins as absolutely positioned divs (avoids SVG animate crash) */}
          {projected.map((l,i)=>{
            const c=statusColor[l.status];
            const isSel=selLoc===i;
            const sz=isSel?20:l.services>0?14:10;
            const leftPct=(l.x/W)*100;
            const topPct=(l.y/H)*100;
            return(
              <div key={i} onClick={()=>setSelLoc(isSel?null:i)} style={{
                position:"absolute",left:`${leftPct}%`,top:`${topPct}%`,transform:"translate(-50%,-50%)",
                cursor:"pointer",zIndex:isSel?10:l.services>0?5:1,
              }}>
                {/* Glow ring for active sites */}
                {l.mrr>0&&<div style={{position:"absolute",left:"50%",top:"50%",transform:"translate(-50%,-50%)",
                  width:`${sz+16}px`,height:`${sz+16}px`,borderRadius:"50%",background:`radial-gradient(circle,${c}25 0%,transparent 70%)`,pointerEvents:"none"}}/>}
                {/* Selected ring */}
                {isSel&&<div style={{position:"absolute",left:"50%",top:"50%",transform:"translate(-50%,-50%)",
                  width:`${sz+12}px`,height:`${sz+12}px`,borderRadius:"50%",border:`2px solid ${c}`,opacity:0.5,
                  animation:"locPulse 1.5s ease-out infinite",pointerEvents:"none"}}/>}
                {/* Main dot */}
                <div style={{width:`${sz}px`,height:`${sz}px`,borderRadius:"50%",
                  background:isSel?c:`${c}BB`,border:`2px solid ${c}`,
                  boxShadow:isSel?`0 0 12px ${c}60`:"none",transition:"all 0.2s"}}/>
                {/* Label */}
                <div style={{position:"absolute",bottom:`${sz/2+6}px`,left:"50%",transform:"translateX(-50%)",
                  whiteSpace:"nowrap",fontFamily:f,fontSize:"8px",color:isSel?T.text:`${T.text}AA`,
                  textShadow:"0 1px 3px rgba(0,0,0,0.8)",pointerEvents:"none",fontWeight:isSel?600:400}}>
                  {l.name.length>20?l.name.slice(0,18)+"…":l.name}
                </div>
                {/* MRR label for active sites */}
                {l.mrr>0&&<div style={{position:"absolute",top:`${sz/2+4}px`,left:"50%",transform:"translateX(-50%)",
                  whiteSpace:"nowrap",fontFamily:f,fontSize:"8px",fontWeight:700,color:c,
                  textShadow:"0 1px 3px rgba(0,0,0,0.8)",pointerEvents:"none"}}>
                  {$k(l.mrr)}/mo
                </div>}
              </div>
            );
          })}

          {/* Legend */}
          <div style={{position:"absolute",bottom:"10px",right:"10px",padding:"8px 12px",background:`${T.card}EE`,borderRadius:"6px",border:`1px solid ${T.border}`}}>
            {[{label:"On-Net",color:T.green},{label:"Near-Net",color:T.yellow},{label:"Off-Net",color:T.red}].map(l=>(
              <div key={l.label} style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"3px"}}>
                <div style={{width:"8px",height:"8px",borderRadius:"50%",background:l.color,border:`1px solid ${l.color}`}}/>
                <span style={{fontFamily:f,fontSize:"8px",color:T.textMid}}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Location list */}
      <div style={{overflowY:"auto",maxHeight:"560px"}}>
        <div style={{fontFamily:f,fontSize:"9px",color:T.textDim,letterSpacing:"0.08em",marginBottom:"8px"}}>{locs.length} LOCATIONS</div>
        {locs.map((l,i)=>{
          const isSel=selLoc===i;const c=statusColor[l.status];
          return(<div key={i} onClick={()=>setSelLoc(isSel?null:i)} style={{
            background:isSel?T.cardHover:T.card,border:`1px solid ${isSel?c+"50":T.border}`,
            borderRadius:"6px",padding:"10px",marginBottom:"6px",cursor:"pointer",
            borderLeft:`3px solid ${c}`,transition:"all 0.15s",
          }}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:"3px"}}>
              <span style={{fontWeight:600,fontSize:"11px"}}>{l.name}</span>
              <Badge color={c}>{statusLabel[l.status]}</Badge>
            </div>
            <div style={{fontFamily:f,fontSize:"9px",color:T.textDim,marginBottom:"3px"}}>{l.type}{l.lit?" · Fiber Lit":""}</div>
            {l.mrr>0&&<div style={{fontFamily:f,fontSize:"11px",fontWeight:700,color:T.cyan,marginBottom:"3px"}}>{$k(l.mrr)}/mo · {l.services} services</div>}
            {l.products&&l.products.length>0&&<div style={{display:"flex",gap:"3px",flexWrap:"wrap",marginBottom:"3px"}}>{l.products.map(p=><Badge key={p} color={T.blue} size="sm">{p}</Badge>)}</div>}
            {isSel&&l.note&&<div style={{fontSize:"10px",color:T.textMid,lineHeight:1.5,marginTop:"6px",padding:"6px 8px",background:T.surface,borderRadius:"4px"}}>{l.note}</div>}
          </div>);
        })}
      </div>
    </div>
  </div>);
}

// ─── PAGE: OVERVIEW ─────────────────────────────────────
function PageOverview({a}){
  const stages=["Discover","Design","Propose","Negotiate"];
  const stageC={Discover:T.blue,Design:T.purple,Propose:T.yellow,Negotiate:T.green};
  return(<div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:"8px",marginBottom:"16px"}}>
      <Stat label="TOTAL ARR" value={$(a.arr)} color={T.cyan}/>
      <Stat label="PIPELINE" value={`${$k(a.pipeline_mrr)}/mo`} sub={`${a.pipeline_count} deals`} color={T.blue}/>
      <Stat label="WIN RATE" value={pc(a.win_rate)} sub={`${a.won}W / ${a.lost}L`} color={a.win_rate>0.7?T.green:T.yellow}/>
      <Stat label="LOST MRR" value={$(a.lost_mrr)} sub={`${a.lost} deals`} color={T.red}/>
      <Stat label="NRR" value={pc(a.nrr)} color={a.nrr>=1?T.green:a.nrr>=0.9?T.yellow:T.red}/>
      <Stat label="RISK" value={`${a.risk_score}/100`} sub={a.risk_level} color={a.risk_score>=50?T.red:a.risk_score>=30?T.orange:T.green}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"16px"}}>
      <div style={{background:T.card,borderRadius:"8px",border:`1px solid ${T.border}`,padding:"14px"}}>
        <div style={{fontFamily:f,fontSize:"9px",color:T.textDim,letterSpacing:"0.08em",marginBottom:"12px"}}>PIPELINE BY STAGE</div>
        <div style={{display:"flex",gap:"6px",alignItems:"flex-end",height:"70px"}}>
          {stages.map(st=>{const d=a.pipeline_by_stage?.[st];const mx=Math.max(...Object.values(a.pipeline_by_stage).map(x=>x.mrr),1);const h=d?Math.max(6,(d.mrr/mx)*60):3;
            return(<div key={st} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:"3px"}}>
              <div style={{fontFamily:f,fontSize:"10px",fontWeight:600,color:stageC[st]}}>{d?$k(d.mrr):"$0"}</div>
              <div style={{width:"100%",height:`${h}px`,borderRadius:"3px",background:d?`${stageC[st]}35`:T.border}}/>
              <div style={{fontFamily:f,fontSize:"8px",color:T.textDim}}>{st} {d?`(${d.count})`:""}</div>
            </div>);
          })}
        </div>
      </div>
      <div style={{background:T.card,borderRadius:"8px",border:`1px solid ${a.risk_score>=30?T.red+"30":T.border}`,padding:"14px"}}>
        <div style={{fontFamily:f,fontSize:"9px",color:a.risk_score>=30?T.red:T.textDim,letterSpacing:"0.08em",marginBottom:"10px"}}>RISK SIGNALS</div>
        <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
          {[a.days_silent>90&&`${a.days_silent}d silent`,a.lost>2&&`${a.lost} losses`,a.disconnects>0&&`${a.disconnects} disconnects`,a.downgrades>0&&`↓$${a.downgrade_mrr}`,a.velocity==="stalled"&&"Stalled velocity",a.reps>10&&`${a.reps} reps (churn)`,a.nrr<0.9&&`NRR ${pc(a.nrr)}`].filter(Boolean).map((r,i)=>
            <Badge key={i} color={T.red}>{r}</Badge>
          )}
          {a.risk_score<20&&<span style={{fontFamily:f,fontSize:"10px",color:T.green}}>✓ Account is healthy</span>}
        </div>
      </div>
    </div>
    <div style={{background:T.card,borderRadius:"8px",border:`1px solid ${T.border}`,padding:"14px",marginBottom:"16px"}}>
      <div style={{fontFamily:f,fontSize:"9px",color:T.textDim,letterSpacing:"0.08em",marginBottom:"10px"}}>REVENUE TRAJECTORY</div>
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={a.revenue_tl} margin={{top:5,right:10,bottom:5,left:10}}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
          <XAxis dataKey="q" tick={{fontFamily:f,fontSize:8,fill:T.textDim}} tickLine={false} axisLine={{stroke:T.border}}/>
          <YAxis tick={{fontFamily:f,fontSize:8,fill:T.textDim}} axisLine={false} tickLine={false} tickFormatter={v=>`$${(v/1000).toFixed(0)}K`}/>
          <Tooltip contentStyle={chartTheme.tooltip}/>
          <ReferenceLine y={0} stroke={T.borderLight}/>
          <Bar dataKey="new" fill={T.green} opacity={0.7} name="New Service" radius={[2,2,0,0]}/>
          <Bar dataKey="rr_up" fill={T.blue} opacity={0.7} name="Re-Rate Up" radius={[2,2,0,0]}/>
          <Bar dataKey="lost" fill={T.red} opacity={0.7} name="Lost" radius={[0,0,2,2]}/>
          <Line type="monotone" dataKey="cum" stroke={T.cyan} strokeWidth={2} dot={false} name="Cumulative"/>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    <div style={{background:T.card,borderRadius:"8px",border:`1px solid ${T.border}`,padding:"14px"}}>
      <div style={{fontFamily:f,fontSize:"9px",color:T.textDim,letterSpacing:"0.08em",marginBottom:"10px"}}>PRODUCT MIX</div>
      <div style={{display:"flex",gap:"8px"}}>
        {Object.entries(a.concentration).map(([p,d])=>(<div key={p} style={{flex:1,padding:"8px",background:T.surface,borderRadius:"6px"}}>
          <div style={{fontSize:"11px",fontWeight:600,marginBottom:"4px"}}>{p}</div>
          <div style={{fontFamily:f,fontSize:"13px",fontWeight:700,color:T.cyan}}>{$k(d.mrr)}/mo</div>
          <PBar value={d.pct} color={T.cyan} h={4}/>
          <div style={{fontFamily:f,fontSize:"8px",color:T.textDim,marginTop:"2px"}}>{pc(d.pct)} of revenue</div>
        </div>))}
      </div>
    </div>
  </div>);
}

// ─── PAGE: PREDICTIONS ──────────────────────────────────
function PagePredict({a}){
  return(<div>
    <div style={{background:`linear-gradient(135deg,${T.teal}08,${T.blue}08)`,border:`1px solid ${T.teal}25`,borderRadius:"10px",padding:"16px",marginBottom:"16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:"8px"}}>
        <div style={{fontFamily:f,fontSize:"9px",color:T.teal,letterSpacing:"0.08em"}}>BAYESIAN PREDICTION SUMMARY</div>
        <div style={{display:"flex",gap:"4px"}}><Badge color={a.portfolio_health==="growing"?T.green:T.red}>{a.portfolio_health?.toUpperCase()}</Badge><Badge color={T.cyan}>{a.arr_12mo_change}</Badge></div>
      </div>
      <div style={{fontSize:"13px",color:T.textMid,lineHeight:1.6}}>
        {a.predictions?.[0]&&`Highest probability: ${a.predictions[0].product} ${a.predictions[0].event} at ${pc(a.predictions[0].posterior)} (prior was ${pc(a.predictions[0].prior)}). ${a.portfolio_health==="growing"?"Account is expanding — focus on accelerating pipeline and cross-sell.":"Account is contracting — prioritize retention before expansion."}`}
      </div>
    </div>
    {a.predictions?.map((p,i)=>{const prob=p.posterior;const color=prob>0.6?T.green:prob>0.35?T.yellow:T.orange;
      return(<div key={i} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:"8px",padding:"14px",marginBottom:"10px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
          <div><span style={{fontWeight:600,fontSize:"14px"}}>{p.product}</span><span style={{fontFamily:f,fontSize:"10px",color:T.textDim,marginLeft:"8px"}}>{p.event}</span></div>
          <div style={{display:"flex",alignItems:"center",gap:"8px"}}><span style={{fontFamily:f,fontSize:"10px",color:T.textDim}}>Prior: {pc(p.prior)}</span><span style={{fontFamily:f,fontSize:"10px",color:T.textDim}}>→</span><span style={{fontFamily:f,fontSize:"16px",fontWeight:700,color}}>{pc(prob)}</span></div>
        </div>
        <PBar value={prob} color={color} h={6}/>
        <div style={{display:"flex",gap:"10px",marginTop:"8px",fontFamily:f,fontSize:"10px"}}>
          <span style={{color:T.cyan}}>{p.mrr}/mo</span>
          <span style={{color:T.yellow}}>{p.timing}</span>
          <span style={{color:p.direction==="strengthened"?T.green:T.red}}>{p.direction==="strengthened"?"↑ Evidence strengthened":"↓ Evidence weakened"}</span>
        </div>
        {p.evidence&&<div style={{marginTop:"8px"}}>{p.evidence.map((e,j)=><div key={j} style={{fontSize:"11px",color:T.textMid,paddingLeft:"8px",borderLeft:`2px solid ${color}30`,marginBottom:"3px"}}>{e}</div>)}</div>}
      </div>);
    })}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
      {a.cross_sell?.length>0&&<div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:"8px",padding:"14px"}}>
        <div style={{fontFamily:f,fontSize:"9px",color:T.blue,letterSpacing:"0.08em",marginBottom:"10px"}}>CROSS-SELL OPPORTUNITIES</div>
        {a.cross_sell.map((cs,i)=>(<div key={i} style={{marginBottom:"10px"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:"2px"}}><span style={{fontWeight:600,fontSize:"12px"}}>{cs.product}</span><span style={{fontFamily:f,fontSize:"12px",fontWeight:700,color:T.blue}}>{pc(cs.prob)}</span></div><div style={{fontSize:"11px",color:T.textMid,lineHeight:1.5}}>{cs.reason}</div><div style={{fontFamily:f,fontSize:"9px",color:T.cyan,marginTop:"3px"}}>Trigger: {cs.trigger}</div></div>))}
      </div>}
      {a.churn_preds?.length>0&&<div style={{background:T.card,border:`1px solid ${T.red}18`,borderRadius:"8px",padding:"14px"}}>
        <div style={{fontFamily:f,fontSize:"9px",color:T.red,letterSpacing:"0.08em",marginBottom:"10px"}}>⚠ CHURN RISK</div>
        {a.churn_preds.map((ch,i)=>(<div key={i} style={{marginBottom:"10px"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:"2px"}}><span style={{fontWeight:600,fontSize:"12px"}}>{ch.product}</span><span style={{fontFamily:f,fontSize:"12px",fontWeight:700,color:T.red}}>{pc(ch.prob)} risk</span></div><div style={{fontSize:"10px",color:T.textDim}}>{ch.timing}</div>{ch.signals?.map((w,j)=><div key={j} style={{fontSize:"10px",color:T.red,paddingLeft:"6px",borderLeft:`2px solid ${T.red}30`,marginTop:"2px"}}>{w}</div>)}<div style={{fontSize:"10px",color:T.green,marginTop:"4px"}}>→ {ch.action}</div></div>))}
      </div>}
    </div>
  </div>);
}

// ─── PAGE: DEALS ────────────────────────────────────────
function PageDeals({a}){
  const[selDeal,setSelDeal]=useState(0);
  const gt=a.game_theory;const deal=a.active_deals?.[selDeal];
  if(!a.active_deals?.length)return<div style={{textAlign:"center",padding:"40px",opacity:0.5}}><div style={{fontSize:"28px",marginBottom:"8px"}}>♟</div><div style={{fontFamily:f,fontSize:"11px",color:T.textDim}}>No active deals</div></div>;
  return(<div style={{display:"grid",gridTemplateColumns:"280px 1fr",gap:"12px"}}>
    <div>
      <div style={{fontFamily:f,fontSize:"9px",color:T.purple,letterSpacing:"0.08em",marginBottom:"8px"}}>{a.active_deals.length} ACTIVE DEALS</div>
      {a.active_deals.map((d,i)=>(<div key={i} onClick={()=>setSelDeal(i)} style={{background:i===selDeal?T.cardHover:T.card,border:`1px solid ${i===selDeal?T.purple+"50":T.border}`,borderRadius:"6px",padding:"10px",marginBottom:"6px",cursor:"pointer",borderLeft:`3px solid ${i===selDeal?T.purple:"transparent"}`}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:"2px"}}><span style={{fontWeight:600,fontSize:"11px"}}>{d.product}</span><Badge color={T.purple}>{d.stage}</Badge></div>
        <div style={{fontFamily:f,fontSize:"10px",color:T.textDim}}>{$k(d.mrr)}/mo · {d.forecast} · {d.close}</div>
      </div>))}
    </div>
    <div style={{overflowY:"auto",maxHeight:"calc(100vh - 140px)"}}>
      {gt&&(<>
        <div style={{background:`linear-gradient(135deg,${T.purple}08,${T.pink}08)`,border:`1px solid ${T.purple}25`,borderRadius:"10px",padding:"16px",marginBottom:"12px"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px",marginBottom:"12px"}}>
            <Stat small label="WIN PROB" value={pc(gt.win_prob)} color={T.green}/>
            <Stat small label="BUYER URGENCY" value={gt.buyer_urgency.toUpperCase()} color={gt.buyer_urgency==="high"?T.green:T.yellow}/>
            <Stat small label="COMPETITION" value={gt.competition.toUpperCase()} color={gt.competition==="fierce"?T.red:T.yellow}/>
            <Stat small label="INFO EDGE" value={gt.info_edge.toUpperCase()} color={gt.info_edge==="seller"?T.green:T.red}/>
          </div>
          <div style={{padding:"10px",background:T.card,borderRadius:"6px",borderLeft:`3px solid ${T.purple}`,marginBottom:"10px"}}>
            <div style={{fontFamily:f,fontSize:"8px",color:T.purple,marginBottom:"3px"}}>OPTIMAL STRATEGY</div>
            <div style={{fontWeight:700,fontSize:"13px",marginBottom:"4px"}}>{gt.strategy.name}</div>
            <div style={{fontSize:"11px",color:T.textMid,lineHeight:1.6}}>{gt.strategy.rationale}</div>
          </div>
          <div style={{padding:"8px",background:T.surface,borderRadius:"5px",marginBottom:"10px"}}><div style={{fontFamily:f,fontSize:"8px",color:T.teal,marginBottom:"2px"}}>NASH EQUILIBRIUM</div><div style={{fontSize:"11px",color:T.textMid,lineHeight:1.5}}>{gt.nash}</div></div>
          <div style={{padding:"8px",background:T.surface,borderRadius:"5px",borderLeft:`3px solid ${T.cyan}`}}><div style={{fontFamily:f,fontSize:"8px",color:T.cyan,marginBottom:"2px"}}>TALK TRACK</div><div style={{fontSize:"11px",color:T.textMid,lineHeight:1.5,fontStyle:"italic"}}>"{gt.talk_track}"</div></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"12px"}}>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:"8px",padding:"12px"}}>
            <div style={{fontFamily:f,fontSize:"8px",color:T.green,marginBottom:"8px"}}>PRICING</div>
            <div style={{display:"flex",gap:"6px",marginBottom:"8px"}}><div style={{flex:1,padding:"6px",background:T.surface,borderRadius:"4px"}}><div style={{fontFamily:f,fontSize:"7px",color:T.green}}>ANCHOR</div><div style={{fontFamily:f,fontSize:"12px",fontWeight:700,color:T.green}}>{gt.pricing.anchor}</div></div><div style={{flex:1,padding:"6px",background:T.surface,borderRadius:"4px"}}><div style={{fontFamily:f,fontSize:"7px",color:T.red}}>FLOOR</div><div style={{fontFamily:f,fontSize:"12px",fontWeight:700,color:T.red}}>{gt.pricing.floor}</div></div></div>
            {gt.pricing.value_levers?.map((v,i)=><div key={i} style={{fontSize:"10px",color:T.cyan,paddingLeft:"6px",borderLeft:`2px solid ${T.cyan}25`,marginBottom:"2px"}}>{v}</div>)}
          </div>
          <div style={{background:T.card,border:`1px solid ${T.red}18`,borderRadius:"8px",padding:"12px"}}>
            <div style={{fontFamily:f,fontSize:"8px",color:T.red,marginBottom:"8px"}}>COMPETITIVE COUNTER</div>
            <div style={{fontSize:"10px",color:T.textMid,lineHeight:1.5,marginBottom:"4px"}}><span style={{color:T.red,fontWeight:600}}>They'll offer:</span> {gt.competitive.competitor_offer}</div>
            <div style={{fontSize:"10px",color:T.textMid,lineHeight:1.5,marginBottom:"4px"}}><span style={{color:T.green,fontWeight:600}}>Your edge:</span> {gt.competitive.differentiation}</div>
            <div style={{fontSize:"10px",color:T.textMid,lineHeight:1.5}}><span style={{color:T.purple,fontWeight:600}}>Trap:</span> {gt.competitive.trap}</div>
          </div>
        </div>
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:"8px",padding:"12px",marginBottom:"12px"}}>
          <div style={{fontFamily:f,fontSize:"8px",color:T.purple,marginBottom:"8px"}}>NEGOTIATION SEQUENCE</div>
          {gt.sequence?.map((m,i)=>(<div key={i} style={{display:"flex",gap:"8px",marginBottom:"8px"}}>
            <div style={{width:"20px",height:"20px",borderRadius:"50%",flexShrink:0,background:`${m.actor==="seller"?T.green:m.actor==="buyer"?T.blue:T.red}18`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:f,fontSize:"9px",fontWeight:700,color:m.actor==="seller"?T.green:m.actor==="buyer"?T.blue:T.red}}>{m.move}</div>
            <div><div style={{fontSize:"11px"}}><span style={{fontWeight:600,color:m.actor==="seller"?T.green:m.actor==="buyer"?T.blue:T.red}}>{m.actor}:</span> {m.action}</div><div style={{fontSize:"10px",color:T.textDim}}>→ {m.response} · {m.timing}</div></div>
          </div>))}
        </div>
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:"8px",padding:"12px"}}>
          <div style={{fontFamily:f,fontSize:"8px",color:T.orange,marginBottom:"8px"}}>CONCESSION PLAYBOOK</div>
          {gt.concessions?.map((c,i)=>(<div key={i} style={{padding:"8px",background:T.surface,borderRadius:"5px",marginBottom:"6px"}}><div style={{fontSize:"11px",fontWeight:600,color:T.orange,marginBottom:"3px"}}>If: "{c.if_says}"</div><div style={{fontSize:"11px",color:T.text,marginBottom:"2px"}}>{c.respond}</div><div style={{fontFamily:f,fontSize:"9px",color:T.textDim}}>Cost: {c.cost} · Value: {c.value}</div></div>))}
        </div>
      </>)}
    </div>
  </div>);
}

// ─── PAGE: SIGNALS ──────────────────────────────────────
function PageSignals({a}){
  const sig=a.signals;if(!sig)return null;
  const urgC={act_now:T.red,this_week:T.orange,this_month:T.yellow,monitor:T.textDim};
  const typeC={funding:T.green,expansion:T.cyan,leadership:T.purple,acquisition:T.blue,technology:T.orange,regulatory:T.yellow,financial:T.lime,risk:T.red};
  return(<div>
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:"8px",padding:"14px",marginBottom:"14px"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}>
        <div style={{fontFamily:f,fontSize:"9px",color:T.textDim,letterSpacing:"0.08em"}}>COMPANY INTELLIGENCE</div>
        <div style={{display:"flex",gap:"4px"}}><Badge color={sig.signal_strength==="strong"?T.green:T.yellow}>SIGNAL: {sig.signal_strength?.toUpperCase()}</Badge><Badge color={sig.match_confidence>0.8?T.green:T.yellow}>MATCH: {pc(sig.match_confidence)}</Badge></div>
      </div>
      <div style={{fontSize:"13px",color:T.textMid,lineHeight:1.6}}>{sig.company_summary}</div>
    </div>
    <div style={{fontFamily:f,fontSize:"9px",color:T.orange,letterSpacing:"0.08em",marginBottom:"10px"}}>{sig.items.length} SIGNALS DETECTED</div>
    {sig.items.map((s,i)=>(<div key={i} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:"8px",padding:"12px",marginBottom:"8px",borderLeft:`3px solid ${typeC[s.type]||T.textDim}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"6px"}}>
        <span style={{fontSize:"13px",fontWeight:600,flex:1,marginRight:"8px"}}>{s.headline}</span>
        <div style={{display:"flex",gap:"4px",flexShrink:0}}><Badge color={typeC[s.type]}>{s.type}</Badge><Badge color={urgC[s.urgency]}>{s.urgency?.replace("_"," ")}</Badge></div>
      </div>
      <div style={{fontSize:"12px",color:T.textMid,lineHeight:1.6}}>{s.impact}</div>
      <div style={{fontFamily:f,fontSize:"9px",color:T.textDim,marginTop:"4px"}}>{pc(s.confidence)} confidence</div>
    </div>))}
  </div>);
}

// ─── PAGE: LOSSES ───────────────────────────────────────
function PageLosses({a}){
  const l=a.losses;if(!l)return null;
  return(<div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px",marginBottom:"16px"}}>
      <Stat label="TOTAL LOST MRR" value={$(a.lost_mrr)} sub={`${a.lost} deals`} color={T.red}/>
      <Stat label="DISCONNECTS" value={`${a.disconnects}`} sub={`${l.disconnects?.length||0} events`} color={T.orange}/>
      <Stat label="DOWNGRADES" value={`-${$(a.downgrade_mrr)}`} sub={`${a.downgrades} events`} color={T.yellow}/>
      <Stat label="NRR" value={pc(a.nrr)} color={a.nrr>=1?T.green:T.red}/>
    </div>
    {Object.keys(l.by_product||{}).length>0&&<div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:"8px",padding:"14px",marginBottom:"14px"}}>
      <div style={{fontFamily:f,fontSize:"9px",color:T.red,letterSpacing:"0.08em",marginBottom:"10px"}}>LOSSES BY PRODUCT</div>
      {Object.entries(l.by_product).sort((a,b)=>b[1].mrr-a[1].mrr).map(([prod,d])=>(<div key={prod} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.border}`}}><span style={{fontSize:"12px",color:T.textMid}}>{prod} ({d.count} deals)</span><span style={{fontFamily:f,fontSize:"12px",fontWeight:600,color:T.red}}>{$(d.mrr)} MRR</span></div>))}
    </div>}
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:"8px",padding:"14px",marginBottom:"14px"}}>
      <div style={{fontFamily:f,fontSize:"9px",color:T.red,letterSpacing:"0.08em",marginBottom:"10px"}}>CLOSE-LOST DEALS</div>
      {l.deals?.map((d,i)=>(<div key={i} style={{padding:"8px",background:i%2?T.surface:"transparent",borderRadius:"4px",marginBottom:"4px"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:"2px"}}><span style={{fontWeight:600,fontSize:"12px"}}>{d.product}</span><span style={{fontFamily:f,fontSize:"12px",fontWeight:700,color:T.red}}>{$(d.mrr)} MRR</span></div>
        <div style={{fontFamily:f,fontSize:"9px",color:T.textDim}}>Lost {d.date} · {d.type} · {d.days_pipe}d in pipeline · {d.rep}</div>
      </div>))}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
      {l.disconnects?.length>0&&<div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:"8px",padding:"14px"}}>
        <div style={{fontFamily:f,fontSize:"9px",color:T.orange,letterSpacing:"0.08em",marginBottom:"8px"}}>DISCONNECTS</div>
        {l.disconnects.map((d,i)=>(<div key={i} style={{padding:"5px 0",borderBottom:`1px solid ${T.border}`,fontSize:"11px"}}>{d.product} <span style={{color:T.orange}}>DISCONNECTED</span> <span style={{color:T.textDim}}>{d.date}</span></div>))}
      </div>}
      {l.downgrades?.length>0&&<div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:"8px",padding:"14px"}}>
        <div style={{fontFamily:f,fontSize:"9px",color:T.yellow,letterSpacing:"0.08em",marginBottom:"8px"}}>DOWNGRADES</div>
        {l.downgrades.map((d,i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${T.border}`,fontSize:"11px"}}><span>{d.product}</span><span style={{fontFamily:f,fontWeight:600,color:T.yellow}}>{$(Math.abs(d.mrr))}/mo</span><span style={{color:T.textDim}}>{d.date}</span></div>))}
      </div>}
    </div>
  </div>);
}

// ─── PAGE: BACKTEST ─────────────────────────────────────
function PageBacktest({a}){
  const bt=a.backtest;if(!bt?.length)return null;
  const[selQ,setSelQ]=useState(0);
  const avg=Math.round(bt.reduce((s,b)=>s+b.score,0)/bt.length);
  const outcomeHits=bt.filter(b=>b.predicted.outcome===b.actual.outcome).length;
  return(<div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px",marginBottom:"14px"}}>
      <Stat label="AVG ACCURACY" value={`${avg}%`} color={avg>=60?T.green:T.yellow}/>
      <Stat label="OUTCOME HIT" value={`${outcomeHits}/${bt.length}`} color={T.cyan}/>
      <Stat label="QUARTERS TESTED" value={bt.length} color={T.purple}/>
    </div>
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:"8px",padding:"14px",marginBottom:"14px"}}>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={bt.map(b=>({q:b.q,won:b.actual.won_mrr,lost:-(b.actual.lost_mrr||0),acc:b.score}))}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border}/><XAxis dataKey="q" tick={{fontFamily:f,fontSize:8,fill:T.textDim}} tickLine={false}/>
          <YAxis yAxisId="m" tick={{fontFamily:f,fontSize:8,fill:T.textDim}} axisLine={false} tickLine={false} tickFormatter={v=>`$${(v/1000).toFixed(0)}K`}/>
          <YAxis yAxisId="a" orientation="right" domain={[0,100]} tick={{fontFamily:f,fontSize:8,fill:T.purple}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`}/>
          <Tooltip contentStyle={chartTheme.tooltip}/><ReferenceLine y={0} yAxisId="m" stroke={T.borderLight}/>
          <Bar yAxisId="m" dataKey="won" fill={T.green} opacity={0.6} radius={[2,2,0,0]}/>
          <Bar yAxisId="m" dataKey="lost" fill={T.red} opacity={0.6} radius={[0,0,2,2]}/>
          <Line yAxisId="a" type="monotone" dataKey="acc" stroke={T.purple} strokeWidth={2} dot={{fill:T.purple,r:3}}/>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"220px 1fr",gap:"10px"}}>
      <div>
        {bt.map((b,i)=>{const sc=b.score>=80?T.green:b.score>=50?T.yellow:T.red;
          return(<div key={i} onClick={()=>setSelQ(i)} style={{padding:"8px 10px",cursor:"pointer",borderBottom:`1px solid ${T.border}`,borderLeft:`3px solid ${i===selQ?T.purple:"transparent"}`,background:i===selQ?T.cardHover:"transparent"}}>
            <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontFamily:f,fontSize:"11px",fontWeight:600}}>{b.q}</span><Badge color={sc}>{b.score}%</Badge></div>
            <div style={{fontFamily:f,fontSize:"9px",color:T.textDim}}>Actual: {b.actual.outcome} · AI: {b.predicted.outcome}</div>
          </div>);
        })}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
        <div style={{background:T.card,border:`1px solid ${T.purple}30`,borderRadius:"8px",padding:"14px",borderTop:`3px solid ${T.purple}`}}>
          <div style={{fontFamily:f,fontSize:"9px",color:T.purple,marginBottom:"8px"}}>AI PREDICTED</div>
          <Badge color={T.purple}>{bt[selQ].predicted.outcome?.toUpperCase()}</Badge>
          <div style={{marginTop:"6px"}}><Badge color={bt[selQ].predicted.churn==="high"?T.red:bt[selQ].predicted.churn==="medium"?T.orange:T.green}>CHURN: {bt[selQ].predicted.churn?.toUpperCase()}</Badge></div>
          <div style={{fontFamily:f,fontSize:"10px",color:T.textDim,marginTop:"6px"}}>{pc(bt[selQ].predicted.confidence)} confidence</div>
        </div>
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:"8px",padding:"14px",borderTop:`3px solid ${bt[selQ].actual.net>=0?T.green:T.red}`}}>
          <div style={{fontFamily:f,fontSize:"9px",color:bt[selQ].actual.net>=0?T.green:T.red,marginBottom:"8px"}}>ACTUAL</div>
          <Badge color={bt[selQ].actual.outcome==="expanded"?T.green:bt[selQ].actual.outcome.includes("churn")?T.red:T.yellow}>{bt[selQ].actual.outcome?.toUpperCase()}</Badge>
          <div style={{display:"flex",gap:"6px",marginTop:"8px"}}>
            <div style={{flex:1,padding:"6px",background:T.surface,borderRadius:"4px"}}><div style={{fontFamily:f,fontSize:"7px",color:T.green}}>WON</div><div style={{fontFamily:f,fontSize:"14px",fontWeight:700,color:T.green}}>{$k(bt[selQ].actual.won_mrr)}</div></div>
            <div style={{flex:1,padding:"6px",background:T.surface,borderRadius:"4px"}}><div style={{fontFamily:f,fontSize:"7px",color:T.red}}>LOST</div><div style={{fontFamily:f,fontSize:"14px",fontWeight:700,color:T.red}}>{$k(bt[selQ].actual.lost_mrr)}</div></div>
          </div>
          <div style={{marginTop:"6px",padding:"6px",background:bt[selQ].actual.net>=0?`${T.green}12`:`${T.red}12`,borderRadius:"4px"}}><div style={{fontFamily:f,fontSize:"15px",fontWeight:700,color:bt[selQ].actual.net>=0?T.green:T.red}}>{bt[selQ].actual.net>=0?"+":""}{$k(bt[selQ].actual.net)} NET</div></div>
        </div>
      </div>
    </div>
  </div>);
}

// ─── PAGE: LEARNING CURVE ───────────────────────────────
function PageLearning({a}){
  const lc=a.learning;if(!lc?.length)return null;
  const above80=lc.find(d=>d.accuracy>=80);
  const best=lc.reduce((a,b)=>a.accuracy>b.accuracy?a:b,lc[0]);
  return(<div>
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:"8px",padding:"16px",marginBottom:"16px"}}>
      <div style={{fontFamily:f,fontSize:"9px",color:T.textDim,letterSpacing:"0.08em",marginBottom:"14px"}}>ACCURACY vs. TRAINING DATA VOLUME</div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={lc} margin={{top:5,right:20,bottom:5,left:10}}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
          <XAxis dataKey="deals" tick={{fontFamily:f,fontSize:10,fill:T.textDim}} label={{value:"Deals in Training Set",position:"insideBottom",offset:-2,style:{fontFamily:f,fontSize:10,fill:T.textDim}}}/>
          <YAxis domain={[0,100]} tick={{fontFamily:f,fontSize:10,fill:T.textDim}} tickFormatter={v=>`${v}%`}/>
          <Tooltip contentStyle={chartTheme.tooltip} formatter={(v,n)=>[`${v}%`,n]}/>
          <Legend wrapperStyle={{fontFamily:f,fontSize:10}}/>
          <Line type="monotone" dataKey="accuracy" stroke={T.cyan} strokeWidth={3} dot={{fill:T.cyan,r:4}} name="Overall"/>
          <Line type="monotone" dataKey="churn" stroke={T.red} strokeWidth={2} dot={{fill:T.red,r:3}} name="Churn Detection" strokeDasharray="5 5"/>
          <Line type="monotone" dataKey="expand" stroke={T.green} strokeWidth={2} dot={{fill:T.green,r:3}} name="Expansion" strokeDasharray="5 5"/>
          <Line type="monotone" dataKey="outcome" stroke={T.purple} strokeWidth={2} dot={{fill:T.purple,r:3}} name="Outcome Match"/>
          <ReferenceLine y={80} stroke={T.lime} strokeDasharray="8 4" label={{value:"80% Target",position:"right",style:{fontFamily:f,fontSize:9,fill:T.lime}}}/>
        </LineChart>
      </ResponsiveContainer>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px",marginBottom:"16px"}}>
      <Stat label="MIN VIABLE DATASET" value={above80?`${above80.deals} deals`:"TBD"} color={above80?T.green:T.yellow}/>
      <Stat label="PEAK ACCURACY" value={`${best.accuracy}%`} sub={`at ${best.deals} deals`} color={T.cyan}/>
      <Stat label="TREND" value={lc.length>=2&&lc[lc.length-1].accuracy>lc[lc.length-2].accuracy?"↗ Improving":"→ Plateau"} color={T.green}/>
    </div>
    <div style={{background:`${T.lime}08`,border:`1px solid ${T.lime}22`,borderRadius:"8px",padding:"14px"}}>
      <div style={{fontFamily:f,fontSize:"9px",color:T.lime,letterSpacing:"0.08em",marginBottom:"6px"}}>DATA EFFICIENCY ANALYSIS</div>
      <div style={{fontSize:"13px",color:T.text,lineHeight:1.7}}>
        {above80?<><span style={{fontWeight:700,color:T.green}}>80% accuracy reached at {above80.deals} deals.</span> This is the minimum viable dataset. Peak accuracy of {best.accuracy}% at {best.deals} deals. Beyond this point, additional data yields diminishing returns — focus shifts to data quality (richer loss/churn detail) rather than volume.</>
        :<><span style={{fontWeight:700,color:T.yellow}}>80% accuracy not yet reached.</span> Current best is {best.accuracy}% at {best.deals} deals. The curve is still rising — more historical data will improve predictions. Target: 2+ years of deal history including losses and disconnects.</>}
      </div>
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function RevOS(){
  const[selAcct,setSelAcct]=useState(0);
  const[page,setPage]=useState("overview");
  const a=ACCOUNTS[selAcct];

  return(
    <div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:s,display:"flex",flexDirection:"column"}}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet"/>

      {/* HEADER */}
      <div style={{padding:"8px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:T.surface,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          <div style={{width:"28px",height:"28px",borderRadius:"8px",background:`linear-gradient(135deg,${T.cyan},${T.purple})`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:f,fontWeight:700,fontSize:"12px",color:T.bg}}>R</div>
          <div>
            <div style={{fontFamily:f,fontWeight:700,fontSize:"13px",letterSpacing:"-0.01em"}}>RevOS</div>
            <div style={{fontFamily:f,fontSize:"8px",color:T.textDim,letterSpacing:"0.06em"}}>BAYESIAN PREDICTION · GAME THEORY · SIGNAL INTELLIGENCE</div>
          </div>
        </div>
        <div style={{fontFamily:f,fontSize:"9px",color:T.textDim}}>DEMO MODE · {ACCOUNTS.length} ACCOUNTS</div>
      </div>

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        {/* LEFT SIDEBAR — ACCOUNTS */}
        <div style={{width:"220px",borderRight:`1px solid ${T.border}`,background:T.surface,overflowY:"auto",flexShrink:0}}>
          <div style={{padding:"10px 12px",fontFamily:f,fontSize:"8px",color:T.textDim,letterSpacing:"0.1em",borderBottom:`1px solid ${T.border}`}}>ACCOUNTS</div>
          {ACCOUNTS.map((acc,i)=>{const isSel=i===selAcct;const rc=acc.risk_score>=50?T.red:acc.risk_score>=30?T.orange:T.green;
            return(<div key={acc.id} onClick={()=>{setSelAcct(i);}} style={{padding:"10px 12px",cursor:"pointer",borderBottom:`1px solid ${T.border}`,borderLeft:`3px solid ${isSel?T.cyan:"transparent"}`,background:isSel?T.card:"transparent",transition:"all 0.15s"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"3px"}}>
                <span style={{fontWeight:600,fontSize:"12px"}}>{acc.name}</span>
                <Badge color={rc} size="sm">{acc.risk_level.toUpperCase()}</Badge>
              </div>
              <div style={{fontFamily:f,fontSize:"9px",color:T.textDim,marginBottom:"3px"}}>{acc.vertical}</div>
              <div style={{display:"flex",gap:"6px",fontFamily:f,fontSize:"9px",flexWrap:"wrap"}}>
                <span style={{color:T.cyan}}>{$(acc.arr)}</span>
                {acc.lost>0&&<span style={{color:T.red}}>{acc.lost}L</span>}
                {acc.disconnects>0&&<span style={{color:T.orange}}>{acc.disconnects}D</span>}
              </div>
              <div style={{fontFamily:f,fontSize:"8px",color:acc.velocity==="accelerating"?T.green:acc.velocity==="stalled"?T.red:T.yellow,marginTop:"2px"}}>
                {acc.velocity==="accelerating"?"▲":acc.velocity==="stalled"?"▼":"●"} {acc.velocity} · {acc.days_silent}d
              </div>
            </div>);
          })}
        </div>

        {/* MAIN AREA */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {/* TOP TABS */}
          <div style={{padding:"6px 16px",borderBottom:`1px solid ${T.border}`,background:T.surface,display:"flex",gap:"2px",flexShrink:0}}>
            {PAGES.map(p=>(
              <button key={p.id} onClick={()=>setPage(p.id)} style={{padding:"6px 14px",borderRadius:"6px",border:"none",background:page===p.id?T.card:"transparent",color:page===p.id?T.text:T.textDim,fontFamily:f,fontSize:"10px",fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:"4px",transition:"all 0.15s",outline:page===p.id?`1px solid ${T.borderLight}`:"none"}}>
                <span style={{fontSize:"11px"}}>{p.icon}</span>{p.label}
              </button>
            ))}
          </div>

          {/* PAGE CONTENT */}
          <div style={{flex:1,overflowY:"auto",padding:"16px 20px"}}>
            {/* Page Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"16px"}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"3px"}}>
                  <h2 style={{fontSize:"18px",fontWeight:700,margin:0}}>{a.name}</h2>
                  <Badge color={a.risk_score>=50?T.red:a.risk_score>=30?T.orange:T.green}>{a.risk_level.toUpperCase()}</Badge>
                  {a.risk_score>=30&&<Badge color={T.red}>RISK {a.risk_score}/100</Badge>}
                </div>
                <div style={{fontFamily:f,fontSize:"10px",color:T.textDim}}>
                  {a.vertical} · {a.rep} · {a.tenure_mo}mo tenure · NRR: {pc(a.nrr)} · {a.products.join(", ")}
                </div>
              </div>
            </div>

            {page==="overview"&&<PageOverview a={a}/>}
            {page==="locations"&&<PageLocations a={a}/>}
            {page==="predict"&&<PagePredict a={a}/>}
            {page==="deals"&&<PageDeals a={a}/>}
            {page==="signals"&&<PageSignals a={a}/>}
            {page==="losses"&&<PageLosses a={a}/>}
            {page==="backtest"&&<PageBacktest a={a}/>}
            {page==="learning"&&<PageLearning a={a}/>}
          </div>
        </div>
      </div>

      <style>{`*{box-sizing:border-box;margin:0;}::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-track{background:${T.bg};}::-webkit-scrollbar-thumb{background:${T.borderLight};border-radius:3px;}button:hover{opacity:0.85;}@keyframes locPulse{0%{transform:translate(-50%,-50%) scale(1);opacity:0.5;}100%{transform:translate(-50%,-50%) scale(1.8);opacity:0;}}`}</style>
    </div>
  );
}
