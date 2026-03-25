import { useState } from "react";

const sigmoid = x => 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const predict = (x, model) => sigmoid(dot(model.weights, x) + model.bias);

function extractFeatures(deal, stats) {
  const ov = stats.overall;
  const vwr = stats.vwr[deal.vertical] ?? ov;
  const pwr = stats.pwr[deal.product] ?? ov;
  const szp = stats.valsSorted.length ? stats.valsSorted.findIndex(v => v >= deal.dealValue) / stats.valsSorted.length : 0.5;
  const dn = deal.daysOpen != null ? Math.max(0, Math.min(1, 1 - (deal.daysOpen - stats.daysMean) / (stats.daysStd * 3 + 1))) : 0.5;
  const cwr = stats.comboR[`${deal.vertical}|${deal.product}`] ?? ov;
  return [vwr, pwr, szp < 0 ? 1 : szp, dn, cwr];
}

const DEMO_MODEL = {
  generatedAt: "2026-03-18T00:00:00Z", source: "demo",
  stats: {
    overall: 0.52,
    vwr: { "Enterprise Telco": 0.68, "Regional ISP": 0.54, "Cable MSO": 0.61, "Neutral Host": 0.44 },
    pwr: { "Metro Ethernet": 0.71, "DIA": 0.58, "SD-WAN": 0.63, "MPLS": 0.49 },
    comboR: { "Enterprise Telco|Metro Ethernet": 0.79, "Regional ISP|DIA": 0.55, "Cable MSO|SD-WAN": 0.66, "Neutral Host|MPLS": 0.38 },
    valsSorted: [2000,4000,6000,8000,10000,12000,15000,20000], daysMean: 28, daysStd: 14,
  },
  vertModels: {
    "Enterprise Telco": { weights: [1.2,0.9,-0.3,0.4,1.1], bias: -0.5 },
    "Regional ISP":     { weights: [0.8,1.1,-0.2,0.3,0.7], bias: -0.3 },
  },
  globalModel: { weights: [0.9,0.8,-0.25,0.35,0.85], bias: -0.35 },
  churnModel:  { weights: [1.1,0.9,-0.3,0.4,0.8],   bias: -0.4  },
};

const scoreWinProb = (deal, md) => Math.round(predict(extractFeatures(deal, md.stats), md.vertModels[deal.vertical] || md.globalModel) * 100);
const scoreChurnRisk = (deal, md) => {
  const s = md.stats;
  const mtmNorm = Math.min(1,(deal.mtmDays||0)/90);
  const touchNorm = deal.daysSinceContact!=null ? Math.min(1,deal.daysSinceContact/60) : 0.5;
  const szp = s.valsSorted.length ? s.valsSorted.findIndex(v=>v>=(deal.dealValue||0))/s.valsSorted.length : 0.5;
  const vcr = 1-(s.vwr[deal.vertical]??s.overall);
  return Math.round(predict([mtmNorm,touchNorm,szp<0?1:szp,vcr,0.5], md.churnModel)*100);
};

const buildWinBreakdown = (deal, md) => {
  const s = md.stats;
  const vwr = s.vwr[deal.vertical]??s.overall, pwr = s.pwr[deal.product]??s.overall;
  const cwr = s.comboR[`${deal.vertical}|${deal.product}`]??s.overall;
  const szp = s.valsSorted.length ? s.valsSorted.findIndex(v=>v>=deal.dealValue)/s.valsSorted.length : 0.5;
  return [
    { icon:"📊", label:"Vertical win rate",   value:`${Math.round(vwr*100)}%`, sub:deal.vertical, score:Math.round(vwr*100) },
    { icon:"✅", label:"Product win rate",     value:`${Math.round(pwr*100)}%`, sub:deal.product,  score:Math.round(pwr*100) },
    { icon:"⚔️", label:"Vertical × Product",  value:`${Math.round(cwr*100)}%`, sub:`${deal.vertical} + ${deal.product}`, score:Math.round(cwr*100) },
    { icon:"💰", label:"Deal size percentile", value:`${Math.round((szp<0?1:szp)*100)}th`, sub:`$${(deal.dealValue||0).toLocaleString()} MRR`, score:Math.round((szp<0?1:szp)*100) },
    { icon:"⏱", label:"Days open", value:deal.daysOpen!=null?`${deal.daysOpen}d`:"—", sub:`Avg close: ${s.daysMean}d`, score:deal.daysOpen!=null?Math.round(Math.max(0,Math.min(1,1-(deal.daysOpen-s.daysMean)/(s.daysStd*3+1)))*100):50 },
  ];
};

const buildChurnBreakdown = (deal, md) => {
  const s = md.stats; const vwr = s.vwr[deal.vertical]??s.overall;
  return [
    { icon:"⏰", label:"Days in MtM",        value:`${deal.mtmDays||0}d`, sub:"churn risk rises after 60d", score:Math.min(100,Math.round(((deal.mtmDays||0)/90)*100)) },
    { icon:"📉", label:"Days since contact",  value:deal.daysSinceContact!=null?`${deal.daysSinceContact}d`:"—", sub:"no renewal discussion logged", score:Math.min(100,Math.round(((deal.daysSinceContact||0)/60)*100)) },
    { icon:"🏢", label:"Vertical churn rate", value:`${Math.round((1-vwr)*100)}%`, sub:deal.vertical, score:Math.round((1-vwr)*100) },
    { icon:"💰", label:"MRR at risk",         value:`$${(deal.dealValue||0).toLocaleString()}`, sub:"total exposed revenue", score:80 },
    { icon:"🛡️", label:"Save window",         value:deal.mtmDays<60?"Open":"Closing", sub:"save rate drops after day 60", score:deal.mtmDays<60?30:85 },
  ];
};

const dealProfiles = {
  conversation: { vertical:"Regional ISP",     product:"Metro Ethernet", dealValue:10000, daysOpen:null, mtmDays:null,  daysSinceContact:null },
  expansion:    { vertical:"Enterprise Telco", product:"Metro Ethernet", dealValue:12400, daysOpen:18,   mtmDays:null,  daysSinceContact:null },
  churn:        { vertical:"Enterprise Telco", product:"MPLS",           dealValue:11400, daysOpen:null, mtmDays:47,    daysSinceContact:47   },
};

const cardContent = {
  conversation: {
    type:"conversation", label:"PROSPECTING", labelColor:"#3B82F6",
    account:"Pacific Fiber Networks", tagline:"3 new locations detected · Competitor shift at HQ",
    signals:[
      { icon:"📍", text:"Added 3 locations in Sacramento metro (last 30 days)" },
      { icon:"⚡", text:"HQ site moved on-net — AT&T lost coverage on Nov build-out" },
      { icon:"📉", text:"Lost 2 competitor bids in 2023 — both on price, not product" },
      { icon:"💰", text:"Historically buys in $8K–$14K MRR range per location" },
    ],
    suggestedMove:"Reach out re: new Sacramento sites. Lead with the HQ on-net news — they've been price-sensitive, not product-sensitive. Anchor to $10K MRR per site.",
    cta:"Draft Outreach", hasWinProb:false, hasChurnRisk:false,
  },
  expansion: {
    type:"expansion", label:"GROWTH", labelColor:"#10B981",
    account:"Cascade Broadband Co.", tagline:"2 locations underserved · Competitor displacement opportunity",
    signals:[
      { icon:"🏢", text:"Phoenix (AZ-04): Currently on Lumen DIA 500Mb — your 1Gb fiber is on-net same building" },
      { icon:"🏢", text:"Tucson (AZ-07): Off-net today, new on-net POP live Q1 2026 — 0.3mi from their office" },
      { icon:"🔄", text:"Similar displacement win in Mesa, AZ — $6,200 MRR, 14-day close" },
      { icon:"💡", text:"Recommend: Metro Ethernet 1Gb at Phoenix, SD-WAN bundle at Tucson on activation" },
    ],
    suggestedMove:"Lead with Phoenix — it's a direct upgrade at the same building, easy yes. Use that to open Tucson conversation before your POP goes live.",
    cta:"Build Quote", ctaSecondary:"Build Outreach", hasWinProb:true, hasChurnRisk:false,
  },
  churn: {
    type:"churn", label:"RETENTION", labelColor:"#F59E0B",
    account:"TriState Infrastructure LLC", tagline:"2 services MtM · Contract window closing in 34 days",
    signals:[
      { icon:"⏰", text:"DIA 200Mb at Dallas-01 went MtM 47 days ago — no renewal discussion logged" },
      { icon:"⏰", text:"MPLS 3-site bundle expires Dec 31 — $11,400 MRR at risk" },
      { icon:"📊", text:"Accounts in this pattern churn within 90 days 68% of the time without contact" },
      { icon:"🛡️", text:"Save rate jumps to 81% when renewal offer made before day 60 of MtM" },
    ],
    suggestedMove:"Contact by Friday. Offer 2-year renewal with 5% rate lock — historicals show they respond to pricing stability over upgrades. Don't lead with new products.",
    cta:"Build Renewal Offer", hasWinProb:true, hasChurnRisk:true,
  },
};

// Pre-score all cards
const initScores = () => {
  const s = {};
  for (const [key, profile] of Object.entries(dealProfiles)) {
    const c = cardContent[key];
    if (c.hasWinProb)    s[key] = { winProb: scoreWinProb(profile, DEMO_MODEL), winBreakdown: buildWinBreakdown(profile, DEMO_MODEL) };
    if (c.hasChurnRisk)  s[key] = { ...s[key], churnRisk: scoreChurnRisk(profile, DEMO_MODEL), churnBreakdown: buildChurnBreakdown(profile, DEMO_MODEL) };
  }
  return s;
};

// ── ScoreBar
const ScoreBar = ({ score, color }) => (
  <div style={{ display:"flex", alignItems:"center", gap:"8px", marginTop:"3px" }}>
    <div style={{ flex:1, height:"2px", background:"#21262D", borderRadius:"2px" }}>
      <div style={{ width:`${score}%`, height:"100%", background:color, borderRadius:"2px", opacity:0.6 }} />
    </div>
    <span style={{ fontSize:"10px", color:"#4B5563", fontFamily:"SF Mono,monospace", minWidth:"28px" }}>{score}%</span>
  </div>
);

// ── TooltipBadge
const TooltipBadge = ({ prob, label, color, breakdown }) => {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position:"relative", display:"inline-block" }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", background:`${color}15`,
        border:`1px solid ${show ? color : color+"40"}`, borderRadius:"8px", padding:"8px 14px",
        minWidth:"80px", cursor:"default", transition:"border-color 0.15s" }}>
        <span style={{ fontSize:"22px", fontWeight:"700", color, fontFamily:"SF Mono,monospace" }}>{prob}%</span>
        <span style={{ fontSize:"10px", color:"#6B7280", letterSpacing:"0.08em", textTransform:"uppercase", marginTop:"2px" }}>
          {label} <span style={{ color:`${color}90`, fontSize:"9px" }}>ⓘ</span>
        </span>
      </div>
      {show && (
        <div onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
          style={{ position:"absolute", top:"calc(100% + 10px)", right:0, width:"300px",
            background:"#161B22", border:`1px solid ${color}40`, borderRadius:"10px", padding:"14px",
            zIndex:100, boxShadow:`0 16px 48px rgba(0,0,0,0.7)`, animation:"tooltipIn 0.15s ease" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
            <span style={{ fontSize:"10px", color:"#4B5563", letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"SF Mono,monospace" }}>
              {breakdown.length} signals · Option B
            </span>
            <span style={{ fontSize:"16px", fontWeight:"700", color, fontFamily:"SF Mono,monospace" }}>{prob}% confidence</span>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:"9px" }}>
            {breakdown.map((d, i) => (
              <div key={i} style={{ display:"flex", gap:"8px", alignItems:"flex-start" }}>
                <span style={{ fontSize:"12px", flexShrink:0, marginTop:"1px" }}>{d.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
                    <span style={{ fontSize:"11px", color:"#D1D5DB", fontWeight:"500" }}>{d.label}</span>
                    <span style={{ fontSize:"11px", color, fontFamily:"SF Mono,monospace", fontWeight:"600", marginLeft:"8px", flexShrink:0 }}>{d.value}</span>
                  </div>
                  <div style={{ fontSize:"10px", color:"#4B5563", marginTop:"1px" }}>{d.sub}</div>
                  <ScoreBar score={d.score} color={color} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:"10px", paddingTop:"8px", borderTop:"1px solid #21262D", fontSize:"10px", color:"#374151", display:"flex", justifyContent:"space-between" }}>
            <span>Per-vertical model · Option B</span>
            <span style={{ color:"#F59E0B" }}>⚠ demo data</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Card
const Card = ({ content, scores, active, onClick }) => (
  <div onClick={onClick} style={{ background:"#161B22",
    border:`1px solid ${active ? content.labelColor+"60" : "#21262D"}`,
    borderRadius:"12px", padding:"20px", cursor:"pointer", transition:"all 0.2s ease",
    boxShadow: active ? `0 0 0 1px ${content.labelColor}30, 0 8px 32px rgba(0,0,0,0.4)` : "none" }}>

    {/* Header */}
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"12px" }}>
      <div>
        <div style={{ display:"inline-block", fontSize:"10px", fontWeight:"700", letterSpacing:"0.12em",
          color:content.labelColor, background:`${content.labelColor}18`, border:`1px solid ${content.labelColor}35`,
          borderRadius:"4px", padding:"3px 8px", marginBottom:"8px", fontFamily:"SF Mono,monospace" }}>
          {content.label}
        </div>
        <div style={{ fontSize:"17px", fontWeight:"600", color:"#F0F6FC", letterSpacing:"-0.02em" }}>{content.account}</div>
        <div style={{ fontSize:"12px", color:"#6B7280", marginTop:"3px" }}>{content.tagline}</div>
      </div>
      <div style={{ display:"flex", gap:"8px", flexShrink:0, marginLeft:"16px" }} onClick={e => e.stopPropagation()}>
        {content.hasWinProb && scores && (
          <TooltipBadge prob={scores.winProb} label={content.type === "churn" ? "Save Rate" : "Win Prob"} color="#A855F7" breakdown={scores.winBreakdown} />
        )}
        {content.hasChurnRisk && scores && (
          <TooltipBadge prob={scores.churnRisk} label="Churn Risk" color="#EF4444" breakdown={scores.churnBreakdown} />
        )}
      </div>
    </div>

    {/* Signals */}
    {active && (
      <div style={{ marginBottom:"16px" }}>
        <div style={{ fontSize:"11px", color:"#4B5563", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:"8px", fontFamily:"SF Mono,monospace" }}>WHY NOW</div>
        <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
          {content.signals.map((s, i) => (
            <div key={i} style={{ display:"flex", gap:"10px", alignItems:"flex-start" }}>
              <span style={{ fontSize:"14px", flexShrink:0, marginTop:"1px" }}>{s.icon}</span>
              <span style={{ fontSize:"13px", color:"#9CA3AF", lineHeight:"1.5" }}>{s.text}</span>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Suggested move */}
    {active && (
      <div style={{ background:"#0D1117", border:"1px solid #21262D", borderLeft:`3px solid ${content.labelColor}`,
        borderRadius:"6px", padding:"12px 14px", marginBottom:"16px" }}>
        <div style={{ fontSize:"11px", color:"#4B5563", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:"6px", fontFamily:"SF Mono,monospace" }}>SUGGESTED MOVE</div>
        <p style={{ fontSize:"13px", color:"#D1D5DB", lineHeight:"1.6", margin:0 }}>{content.suggestedMove}</p>
      </div>
    )}

    {/* CTA row */}
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
      <span style={{ fontSize:"12px", color:"#4B5563" }}>{active ? "Click to collapse" : "Click to expand"}</span>
      {active && (
        <div style={{ display:"flex", gap:"8px" }} onClick={e => e.stopPropagation()}>
          {content.ctaSecondary && (
            <button style={{ background:"transparent", color:content.labelColor, border:`1px solid ${content.labelColor}50`,
              borderRadius:"6px", padding:"8px 16px", fontSize:"13px", fontWeight:"600", cursor:"pointer" }}>
              {content.ctaSecondary} →
            </button>
          )}
          <button style={{ background:content.labelColor, color:"#000", border:"none", borderRadius:"6px",
            padding:"8px 16px", fontSize:"13px", fontWeight:"600", cursor:"pointer" }}>
            {content.cta} →
          </button>
        </div>
      )}
    </div>
  </div>
);

// ── Main
export default function RevOSCards() {
  const [active, setActive] = useState("expansion");
  const [mode, setMode] = useState("Prospecting");
  const scores = initScores();
  const modes = [{ label:"Prospecting", color:"#3B82F6" }, { label:"Growth", color:"#10B981" }, { label:"Retention", color:"#F59E0B" }];

  return (
    <>
      <style>{`@keyframes tooltipIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }`}</style>
      <div style={{ background:"#06080F", minHeight:"100vh", padding:"28px 20px", fontFamily:"Inter,-apple-system,sans-serif" }}>

        {/* Header */}
        <div style={{ marginBottom:"20px" }}>
          <div style={{ fontSize:"11px", color:"#4B5563", letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"SF Mono,monospace", marginBottom:"6px" }}>REVOS · SELLER DASHBOARD</div>
          <h1 style={{ fontSize:"22px", fontWeight:"700", color:"#F0F6FC", margin:0, letterSpacing:"-0.03em" }}>Your Priority Actions</h1>
          <p style={{ fontSize:"13px", color:"#6B7280", margin:"6px 0 0" }}>3 accounts need your attention today · Ranked by impact</p>
        </div>

        {/* Model banner */}
        <div style={{ background:"#F59E0B10", border:"1px solid #F59E0B30", borderRadius:"8px", padding:"8px 14px",
          marginBottom:"16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:"11px", color:"#F59E0B", fontFamily:"SF Mono,monospace" }}>⚠ DEMO MODEL — run backtest with real data to activate live scoring</span>
          <span style={{ fontSize:"11px", color:"#F59E0B", textDecoration:"underline", cursor:"pointer" }}>Run Backtest →</span>
        </div>

        {/* Steering bar */}
        <div style={{ background:"#161B22", border:"1px solid #21262D", borderRadius:"10px", padding:"12px 16px",
          display:"flex", alignItems:"center", gap:"12px", marginBottom:"24px", flexWrap:"wrap" }}>
          <span style={{ fontSize:"11px", color:"#6B7280", letterSpacing:"0.08em", textTransform:"uppercase", fontFamily:"SF Mono,monospace" }}>MODE</span>
          {modes.map(m => (
            <button key={m.label} onClick={() => setMode(m.label)} style={{
              background: mode===m.label ? `${m.color}15` : "transparent",
              border: mode===m.label ? `1px solid ${m.color}50` : "1px solid #21262D",
              borderRadius:"20px", padding:"5px 14px", fontSize:"12px",
              color: mode===m.label ? m.color : "#6B7280", cursor:"pointer", fontWeight:"600" }}>
              {m.label}
            </button>
          ))}
          <div style={{ marginLeft:"auto", fontSize:"12px", color:"#4B5563" }}>Wed Mar 18 · Q1 closes in 13 days</div>
        </div>

        {/* Cards */}
        <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
          {Object.values(cardContent).map(card => (
            <Card key={card.type} content={card} scores={scores[card.type]}
              active={active===card.type} onClick={() => setActive(active===card.type ? null : card.type)} />
          ))}
        </div>

        {/* Legend */}
        <div style={{ marginTop:"24px", display:"flex", gap:"20px", flexWrap:"wrap", alignItems:"center" }}>
          {[{ color:"#A855F7", label:"Win / Save Probability · Option B model" }, { color:"#EF4444", label:"Churn Risk Score" }].map(l => (
            <div key={l.label} style={{ display:"flex", alignItems:"center", gap:"6px" }}>
              <div style={{ width:"8px", height:"8px", borderRadius:"2px", background:l.color }} />
              <span style={{ fontSize:"11px", color:"#4B5563" }}>{l.label}</span>
            </div>
          ))}
          <span style={{ fontSize:"11px", color:"#374151", marginLeft:"auto" }}>Hover badges to see signal breakdown</span>
        </div>
      </div>
    </>
  );
}
