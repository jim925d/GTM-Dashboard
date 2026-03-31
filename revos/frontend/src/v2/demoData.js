/**
 * V2 Demo Data — realistic baked-in data for design partner demos.
 * Used by shared hooks when accounts array is empty.
 */

const DEMO_DEALS = [
  { id: 'd1', accountName: 'Apex Financial Group', product_group: 'Ethernet', stage: 'Negotiate', mrr: 14200, close_date: '2026-04-15', created_date: '2026-01-10', winProb: 0.78, gap: 8, daysInStage: 12, term: '36 mo', rep: 'DCosta' },
  { id: 'd2', accountName: 'TerraWave Communications', product_group: 'Dark Fiber', stage: 'Propose', mrr: 28500, close_date: '2026-04-22', created_date: '2026-02-03', winProb: 0.52, gap: 22, daysInStage: 18, term: '60 mo', rep: 'Kahn' },
  { id: 'd3', accountName: 'Broadleaf Energy', product_group: 'Wavelengths', stage: 'Design', mrr: 9800, close_date: '2026-05-10', created_date: '2026-02-14', winProb: 0.35, gap: 35, daysInStage: 25, term: '36 mo', rep: 'Ochoa' },
  { id: 'd4', accountName: 'CloudNexus Inc', product_group: 'SD-WAN', stage: 'Discover', mrr: 6200, close_date: '2026-06-01', created_date: '2026-03-01', winProb: 0.15, gap: 48, daysInStage: 8, term: '24 mo', rep: 'Malcolm' },
  { id: 'd5', accountName: 'Summit Manufacturing', product_group: 'Ethernet', stage: 'Negotiate', mrr: 18900, close_date: '2026-03-31', created_date: '2025-12-05', winProb: 0.85, gap: 4, daysInStage: 6, term: '36 mo', rep: 'DCosta' },
  { id: 'd6', accountName: 'Desert Health Systems', product_group: 'zColo', stage: 'Propose', mrr: 22100, close_date: '2026-04-08', created_date: '2026-01-22', winProb: 0.60, gap: 15, daysInStage: 14, term: '48 mo', rep: 'Kahn' },
  { id: 'd7', accountName: 'Pacific Logistics Corp', product_group: 'IP Services', stage: 'Design', mrr: 11400, close_date: '2026-05-20', created_date: '2026-02-28', winProb: 0.30, gap: 38, daysInStage: 30, term: '36 mo', rep: 'Ochoa' },
  { id: 'd8', accountName: 'Meridian Insurance', product_group: 'Dark Fiber', stage: 'Discover', mrr: 8700, close_date: '2026-06-15', created_date: '2026-03-10', winProb: 0.12, gap: 52, daysInStage: 5, term: '60 mo', rep: 'Malcolm' },
  { id: 'd9', accountName: 'Horizon Media Group', product_group: 'Ethernet', stage: 'Propose', mrr: 15600, close_date: '2026-04-18', created_date: '2026-01-15', winProb: 0.55, gap: 18, daysInStage: 20, term: '36 mo', rep: 'DCosta' },
  { id: 'd10', accountName: 'Atlas Biotech', product_group: 'Wavelengths', stage: 'Negotiate', mrr: 32400, close_date: '2026-04-05', created_date: '2025-11-20', winProb: 0.72, gap: 10, daysInStage: 9, term: '60 mo', rep: 'Kahn' },
  { id: 'd11', accountName: 'Apex Financial Group', product_group: 'SD-WAN', stage: 'Design', mrr: 4800, close_date: '2026-05-30', created_date: '2026-03-05', winProb: 0.28, gap: 40, daysInStage: 22, term: '24 mo', rep: 'DCosta' },
  { id: 'd12', accountName: 'TerraWave Communications', product_group: 'IP Services', stage: 'Negotiate', mrr: 7300, close_date: '2026-04-02', created_date: '2025-12-18', winProb: 0.82, gap: 6, daysInStage: 10, term: '36 mo', rep: 'Kahn' },
]

const DEMO_ACCOUNTS = [
  {
    name: 'Apex Financial Group',
    totalTMR: 142000, totalMRR: 11833, servicesMRR: 11833, pipelineMRR: 19000,
    churnProbability: 0.12, premierScore: 245, winRate: 0.68,
    daysSilent: 3, manager: 'DCosta',
    pipeline: DEMO_DEALS.filter(d => d.accountName === 'Apex Financial Group'),
    services: [
      { product_group: 'Ethernet', mrr: 8200, service_status: 'active' },
      { product_group: 'IP Services', mrr: 3633, service_status: 'active' },
    ],
    locations: [
      { city: 'Phoenix', state: 'AZ', onNet: true, lat: 33.45, lng: -112.07 },
      { city: 'Scottsdale', state: 'AZ', onNet: true, lat: 33.49, lng: -111.93 },
      { city: 'Tucson', state: 'AZ', onNet: false, lat: 32.22, lng: -110.97, isNew: true },
    ],
    signals: [
      { engine: 'prediction', type: 'prediction', text: 'Win probability increased 12% after Propose stage entry', ts: '2026-03-25' },
      { engine: 'location', type: 'location', text: 'SEC filing reveals new Tucson data center lease', ts: '2026-03-22' },
    ],
    engagement: { events: [
      { d: '3/25/2026', s: 'Call - Pricing review', t: 'call', c: 'J. Martinez' },
      { d: '3/22/2026', s: 'Email - Proposal follow-up', t: 'email', c: 'S. Chen' },
      { d: '3/18/2026', s: 'Meeting - Technical design', t: 'meeting', c: 'J. Martinez' },
    ]},
  },
  {
    name: 'TerraWave Communications',
    totalTMR: 285000, totalMRR: 23750, servicesMRR: 23750, pipelineMRR: 35800,
    churnProbability: 0.08, premierScore: 278, winRate: 0.72,
    daysSilent: 1, manager: 'Kahn',
    pipeline: DEMO_DEALS.filter(d => d.accountName === 'TerraWave Communications'),
    services: [
      { product_group: 'Dark Fiber', mrr: 15200, service_status: 'active' },
      { product_group: 'Ethernet', mrr: 8550, service_status: 'active' },
    ],
    locations: [
      { city: 'Dallas', state: 'TX', onNet: true, lat: 32.78, lng: -96.80 },
      { city: 'Houston', state: 'TX', onNet: true, lat: 29.76, lng: -95.37 },
      { city: 'Austin', state: 'TX', onNet: false, lat: 30.27, lng: -97.74 },
    ],
    signals: [
      { engine: 'prediction', type: 'prediction', text: 'Dark Fiber deal has 52% close probability — below stage avg', ts: '2026-03-26' },
      { engine: 'outage', type: 'outage', text: 'Competitor outage in Dallas market (AT&T) — 4hr duration', ts: '2026-03-24' },
      { engine: 'event', type: 'event', text: 'TerraWave announced Q1 revenue beat, expanding infrastructure budget', ts: '2026-03-20' },
    ],
    engagement: { events: [
      { d: '3/26/2026', s: 'Call - Contract negotiation', t: 'call', c: 'R. Patel' },
      { d: '3/24/2026', s: 'Email - Outage notification sent', t: 'email', c: 'R. Patel' },
      { d: '3/20/2026', s: 'Meeting - QBR', t: 'meeting', c: 'R. Patel' },
    ]},
  },
  {
    name: 'Broadleaf Energy',
    totalTMR: 98000, totalMRR: 8167, servicesMRR: 8167, pipelineMRR: 9800,
    churnProbability: 0.31, premierScore: 185, winRate: 0.45,
    daysSilent: 14, manager: 'Ochoa',
    pipeline: DEMO_DEALS.filter(d => d.accountName === 'Broadleaf Energy'),
    services: [
      { product_group: 'Wavelengths', mrr: 5400, service_status: 'active' },
      { product_group: 'Ethernet', mrr: 2767, service_status: 'active' },
    ],
    locations: [
      { city: 'Denver', state: 'CO', onNet: true, lat: 39.74, lng: -104.99 },
      { city: 'Boulder', state: 'CO', onNet: false, lat: 40.01, lng: -105.27 },
    ],
    signals: [
      { engine: 'prediction', type: 'prediction', text: 'Churn risk elevated — 14 days since last engagement', ts: '2026-03-27' },
      { engine: 'competitive', type: 'competitive', text: 'Lumen pricing 15% below current rate in Denver market', ts: '2026-03-18' },
    ],
    engagement: { events: [
      { d: '3/13/2026', s: 'Email - Service review', t: 'email', c: 'M. Torres' },
    ]},
  },
  {
    name: 'CloudNexus Inc',
    totalTMR: 62000, totalMRR: 5167, servicesMRR: 5167, pipelineMRR: 6200,
    churnProbability: 0.05, premierScore: 210, winRate: 0.58,
    daysSilent: 5, manager: 'Malcolm',
    pipeline: DEMO_DEALS.filter(d => d.accountName === 'CloudNexus Inc'),
    services: [
      { product_group: 'SD-WAN', mrr: 3200, service_status: 'active' },
      { product_group: 'IP Services', mrr: 1967, service_status: 'active' },
    ],
    locations: [
      { city: 'Seattle', state: 'WA', onNet: true, lat: 47.61, lng: -122.33 },
      { city: 'Portland', state: 'OR', onNet: true, lat: 45.52, lng: -122.68 },
      { city: 'Boise', state: 'ID', onNet: false, lat: 43.62, lng: -116.21, isNew: true },
    ],
    signals: [
      { engine: 'location', type: 'location', text: 'New Boise office discovered via SEC 10-K filing', ts: '2026-03-23' },
    ],
    engagement: { events: [
      { d: '3/22/2026', s: 'Call - Expansion discussion', t: 'call', c: 'A. Williams' },
      { d: '3/19/2026', s: 'Demo - SD-WAN upgrade', t: 'demo', c: 'A. Williams' },
    ]},
  },
  {
    name: 'Summit Manufacturing',
    totalTMR: 189000, totalMRR: 15750, servicesMRR: 15750, pipelineMRR: 18900,
    churnProbability: 0.03, premierScore: 292, winRate: 0.82,
    daysSilent: 2, manager: 'DCosta',
    pipeline: DEMO_DEALS.filter(d => d.accountName === 'Summit Manufacturing'),
    services: [
      { product_group: 'Ethernet', mrr: 12200, service_status: 'active' },
      { product_group: 'zColo', mrr: 3550, service_status: 'active' },
    ],
    locations: [
      { city: 'Chicago', state: 'IL', onNet: true, lat: 41.88, lng: -87.63 },
      { city: 'Milwaukee', state: 'WI', onNet: true, lat: 43.04, lng: -87.91 },
      { city: 'Indianapolis', state: 'IN', onNet: true, lat: 39.77, lng: -86.16 },
    ],
    signals: [
      { engine: 'prediction', type: 'prediction', text: 'High-confidence close — 85% probability, 6 days in Negotiate', ts: '2026-03-26' },
      { engine: 'backtest', type: 'backtest', text: 'Similar deals at this stage close within 10 days (87% historical)', ts: '2026-03-25' },
    ],
    engagement: { events: [
      { d: '3/26/2026', s: 'Meeting - Final contract review', t: 'meeting', c: 'K. Johnson' },
      { d: '3/24/2026', s: 'Call - Legal terms alignment', t: 'call', c: 'K. Johnson' },
      { d: '3/21/2026', s: 'Email - SLA documentation', t: 'email', c: 'K. Johnson' },
    ]},
  },
  {
    name: 'Desert Health Systems',
    totalTMR: 221000, totalMRR: 18417, servicesMRR: 18417, pipelineMRR: 22100,
    churnProbability: 0.18, premierScore: 232, winRate: 0.61,
    daysSilent: 4, manager: 'Kahn',
    pipeline: DEMO_DEALS.filter(d => d.accountName === 'Desert Health Systems'),
    services: [
      { product_group: 'zColo', mrr: 9800, service_status: 'active' },
      { product_group: 'Ethernet', mrr: 8617, service_status: 'active' },
    ],
    locations: [
      { city: 'Las Vegas', state: 'NV', onNet: true, lat: 36.17, lng: -115.14 },
      { city: 'Henderson', state: 'NV', onNet: true, lat: 36.04, lng: -114.98 },
      { city: 'Reno', state: 'NV', onNet: false, lat: 39.53, lng: -119.81 },
    ],
    signals: [
      { engine: 'outage', type: 'outage', text: 'Regional ISP outage near Las Vegas — potential upsell moment', ts: '2026-03-25' },
      { engine: 'prediction', type: 'prediction', text: 'zColo deal trending positive — 60% win probability', ts: '2026-03-23' },
    ],
    engagement: { events: [
      { d: '3/23/2026', s: 'Call - Outage follow-up', t: 'call', c: 'L. Garcia' },
      { d: '3/20/2026', s: 'Meeting - zColo site tour', t: 'meeting', c: 'L. Garcia' },
    ]},
  },
  {
    name: 'Pacific Logistics Corp',
    totalTMR: 114000, totalMRR: 9500, servicesMRR: 9500, pipelineMRR: 11400,
    churnProbability: 0.22, premierScore: 175, winRate: 0.40,
    daysSilent: 18, manager: 'Ochoa',
    pipeline: DEMO_DEALS.filter(d => d.accountName === 'Pacific Logistics Corp'),
    services: [
      { product_group: 'IP Services', mrr: 6800, service_status: 'active' },
      { product_group: 'Ethernet', mrr: 2700, service_status: 'active' },
    ],
    locations: [
      { city: 'Los Angeles', state: 'CA', onNet: true, lat: 34.05, lng: -118.24 },
      { city: 'Long Beach', state: 'CA', onNet: true, lat: 33.77, lng: -118.19 },
    ],
    signals: [
      { engine: 'prediction', type: 'prediction', text: 'Deal velocity below average — 30 days in Design stage', ts: '2026-03-26' },
    ],
    engagement: { events: [
      { d: '3/9/2026', s: 'Email - Technical questionnaire', t: 'email', c: 'D. Reyes' },
    ]},
  },
  {
    name: 'Meridian Insurance',
    totalTMR: 87000, totalMRR: 7250, servicesMRR: 7250, pipelineMRR: 8700,
    churnProbability: 0.07, premierScore: 198, winRate: 0.55,
    daysSilent: 7, manager: 'Malcolm',
    pipeline: DEMO_DEALS.filter(d => d.accountName === 'Meridian Insurance'),
    services: [
      { product_group: 'Dark Fiber', mrr: 4800, service_status: 'active' },
      { product_group: 'Ethernet', mrr: 2450, service_status: 'active' },
    ],
    locations: [
      { city: 'San Francisco', state: 'CA', onNet: true, lat: 37.77, lng: -122.42 },
      { city: 'San Jose', state: 'CA', onNet: false, lat: 37.34, lng: -121.89 },
    ],
    signals: [
      { engine: 'event', type: 'event', text: 'Meridian expanding claims processing to San Jose office', ts: '2026-03-21' },
    ],
    engagement: { events: [
      { d: '3/20/2026', s: 'Call - Discovery call', t: 'call', c: 'P. Nakamura' },
    ]},
  },
  {
    name: 'Horizon Media Group',
    totalTMR: 156000, totalMRR: 13000, servicesMRR: 13000, pipelineMRR: 15600,
    churnProbability: 0.15, premierScore: 220, winRate: 0.58,
    daysSilent: 6, manager: 'DCosta',
    pipeline: DEMO_DEALS.filter(d => d.accountName === 'Horizon Media Group'),
    services: [
      { product_group: 'Ethernet', mrr: 9200, service_status: 'active' },
      { product_group: 'SD-WAN', mrr: 3800, service_status: 'active' },
    ],
    locations: [
      { city: 'New York', state: 'NY', onNet: true, lat: 40.71, lng: -74.01 },
      { city: 'Newark', state: 'NJ', onNet: true, lat: 40.74, lng: -74.17 },
    ],
    signals: [
      { engine: 'prediction', type: 'prediction', text: 'Ethernet deal at 55% — needs exec engagement to advance', ts: '2026-03-24' },
      { engine: 'competitive', type: 'competitive', text: 'Crown Castle bidding on same Ethernet route in Newark', ts: '2026-03-19' },
    ],
    engagement: { events: [
      { d: '3/21/2026', s: 'Meeting - Proposal walkthrough', t: 'meeting', c: 'V. Sharma' },
      { d: '3/18/2026', s: 'Email - RFP response', t: 'email', c: 'V. Sharma' },
    ]},
  },
  {
    name: 'Atlas Biotech',
    totalTMR: 324000, totalMRR: 27000, servicesMRR: 27000, pipelineMRR: 32400,
    churnProbability: 0.04, premierScore: 265, winRate: 0.75,
    daysSilent: 2, manager: 'Kahn',
    pipeline: DEMO_DEALS.filter(d => d.accountName === 'Atlas Biotech'),
    services: [
      { product_group: 'Wavelengths', mrr: 18500, service_status: 'active' },
      { product_group: 'Dark Fiber', mrr: 8500, service_status: 'active' },
    ],
    locations: [
      { city: 'Boston', state: 'MA', onNet: true, lat: 42.36, lng: -71.06 },
      { city: 'Cambridge', state: 'MA', onNet: true, lat: 42.37, lng: -71.11 },
      { city: 'Worcester', state: 'MA', onNet: false, lat: 42.26, lng: -71.80, isNew: true },
    ],
    signals: [
      { engine: 'prediction', type: 'prediction', text: 'Wavelengths deal at 72% — strong momentum in Negotiate', ts: '2026-03-27' },
      { engine: 'location', type: 'location', text: 'New Worcester lab facility identified in building permits', ts: '2026-03-24' },
      { engine: 'backtest', type: 'backtest', text: 'Wavelength deals at this MRR tier close at 78% historically', ts: '2026-03-22' },
    ],
    engagement: { events: [
      { d: '3/25/2026', s: 'Call - Pricing finalization', t: 'call', c: 'M. O\'Brien' },
      { d: '3/23/2026', s: 'Meeting - Network architecture review', t: 'meeting', c: 'M. O\'Brien' },
      { d: '3/20/2026', s: 'Demo - Wavelength monitoring tools', t: 'demo', c: 'M. O\'Brien' },
    ]},
  },
]

// Alerts for dashboard sidebar
export const DEMO_ALERTS = [
  { id: 'a1', type: 'outage', severity: 'high', text: 'AT&T Dallas outage — TerraWave impacted area', ts: '2026-03-27 08:15' },
  { id: 'a2', type: 'backtest', severity: 'medium', text: 'Model recalibration complete — Propose→Close rate updated to 48%', ts: '2026-03-26 16:00' },
  { id: 'a3', type: 'prediction', severity: 'low', text: 'Broadleaf Energy churn score rising — now 31%', ts: '2026-03-26 09:30' },
]

// Action recommendations per deal
export const DEMO_ACTIONS = {
  d2: { title: 'Accelerate TerraWave Dark Fiber', desc: 'Competitor outage creates urgency. Schedule exec-to-exec call to fast-track proposal.', cta: 'Schedule Call' },
  d3: { title: 'Re-engage Broadleaf', desc: '14 days silent + competitive pricing pressure. Send updated rate comparison.', cta: 'Send Comparison' },
  d6: { title: 'Close Desert Health zColo', desc: 'Outage in their market + positive deal momentum. Push for verbal commitment.', cta: 'Request Commitment' },
  d9: { title: 'Horizon Media escalation', desc: 'Crown Castle competing on same route. Needs VP engagement to differentiate.', cta: 'Request Exec Sponsor' },
  d7: { title: 'Unstick Pacific Logistics', desc: '30 days in Design. Technical blockers likely — schedule architecture workshop.', cta: 'Book Workshop' },
  d4: { title: 'Qualify CloudNexus SD-WAN', desc: 'Early stage, low probability. New Boise site could expand scope. Validate budget.', cta: 'Discovery Call' },
}

// Playbooks per target
export const DEMO_PLAYBOOKS = {
  'Apex Financial Group': [
    { id: 'p1', title: 'Cross-sell SD-WAN to Tucson', desc: 'New Tucson site needs connectivity. Bundle SD-WAN with existing Ethernet.', products: ['SD-WAN', 'Ethernet'], mrrImpact: 4800, recommended: true },
    { id: 'p2', title: 'Ethernet upgrade cycle', desc: 'Current 1G circuits due for refresh. Position 10G upgrade.', products: ['Ethernet'], mrrImpact: 6400, recommended: false },
    { id: 'p3', title: 'IP Services expansion', desc: 'Consolidate multiple ISP relationships to single provider.', products: ['IP Services'], mrrImpact: 3200, recommended: false },
  ],
  'TerraWave Communications': [
    { id: 'p4', title: 'Capitalize on competitor outage', desc: 'AT&T Dallas outage — position redundant dark fiber path.', products: ['Dark Fiber'], mrrImpact: 12000, recommended: true },
    { id: 'p5', title: 'Austin market entry', desc: 'Expand into Austin with new office connectivity.', products: ['Ethernet', 'SD-WAN'], mrrImpact: 8200, recommended: false },
    { id: 'p6', title: 'Wavelength add-on', desc: 'High-bandwidth apps need dedicated wavelength capacity.', products: ['Wavelengths'], mrrImpact: 15000, recommended: false },
  ],
}

// Backtest calibration metrics
export const DEMO_BACKTEST = {
  accuracy: 0.82,
  avgError: 0.09,
  brierScore: 0.14,
  insights: [
    { text: '**Negotiate** stage deals close at **78%** — model predicts 75%. Slightly conservative.', engine: 'backtest' },
    { text: '**Dark Fiber** deals take **22 days** longer on average than **Ethernet** at same stage.', engine: 'backtest' },
    { text: '**Propose→Negotiate** conversion improved **8%** in Q1 vs Q4. Model weights updated.', engine: 'backtest' },
  ],
}

// Team hierarchy for filter bar
export const DEMO_TEAM = [
  { name: 'Sarah Chen', role: '1lm', reps: ['DCosta', 'Ochoa'] },
  { name: 'Marcus Webb', role: '1lm', reps: ['Kahn', 'Malcolm'] },
]

export const DEMO_REPS = ['DCosta', 'Kahn', 'Ochoa', 'Malcolm']

export const DEMO_QUOTA = 180000

export { DEMO_DEALS, DEMO_ACCOUNTS }
export default DEMO_ACCOUNTS
