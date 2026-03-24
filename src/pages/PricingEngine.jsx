import { useState, useMemo, useRef } from 'react'
import { T } from '../lib/constants'
import { cn } from '@/lib/utils'

// ── Demo pricing data ───────────────────────────────────────────────────────

const PRODUCTS = [
  {
    product: 'Ethernet',
    tiers: [
      { bandwidth: '100M', term_12: 1200, term_24: 1100, term_36: 950, mtm: 1450, nrc: 500 },
      { bandwidth: '500M', term_12: 2400, term_24: 2200, term_36: 1900, mtm: 2900, nrc: 750 },
      { bandwidth: '1G', term_12: 3200, term_24: 2900, term_36: 2600, mtm: 3800, nrc: 1000 },
      { bandwidth: '10G', term_12: 8500, term_24: 7800, term_36: 7000, mtm: 10200, nrc: 2500 },
    ],
  },
  {
    product: 'DIA',
    tiers: [
      { bandwidth: '100M', term_12: 900, term_24: 820, term_36: 740, mtm: 1100, nrc: 400 },
      { bandwidth: '500M', term_12: 1800, term_24: 1650, term_36: 1500, mtm: 2200, nrc: 600 },
      { bandwidth: '1G', term_12: 2500, term_24: 2300, term_36: 2050, mtm: 3000, nrc: 800 },
      { bandwidth: '10G', term_12: 6800, term_24: 6200, term_36: 5600, mtm: 8200, nrc: 2000 },
    ],
  },
  {
    product: 'SD-WAN',
    tiers: [
      { bandwidth: '50M', term_12: 600, term_24: 540, term_36: 480, mtm: 750, nrc: 300 },
      { bandwidth: '100M', term_12: 950, term_24: 870, term_36: 780, mtm: 1150, nrc: 400 },
      { bandwidth: '500M', term_12: 1600, term_24: 1450, term_36: 1300, mtm: 1950, nrc: 600 },
      { bandwidth: '1G', term_12: 2200, term_24: 2000, term_36: 1800, mtm: 2700, nrc: 800 },
    ],
  },
  {
    product: 'Dark Fiber',
    tiers: [
      { bandwidth: 'Strand', term_12: 3500, term_24: 3200, term_36: 2800, mtm: 4200, nrc: 5000 },
      { bandwidth: 'Pair', term_12: 5500, term_24: 5000, term_36: 4500, mtm: 6600, nrc: 7500 },
      { bandwidth: '4-Count', term_12: 8000, term_24: 7300, term_36: 6600, mtm: 9600, nrc: 10000 },
    ],
  },
  {
    product: 'UCaaS',
    tiers: [
      { bandwidth: '10 Seats', term_12: 350, term_24: 320, term_36: 290, mtm: 420, nrc: 200 },
      { bandwidth: '25 Seats', term_12: 750, term_24: 680, term_36: 620, mtm: 900, nrc: 350 },
      { bandwidth: '50 Seats', term_12: 1300, term_24: 1180, term_36: 1060, mtm: 1560, nrc: 500 },
      { bandwidth: '100 Seats', term_12: 2200, term_24: 2000, term_36: 1800, mtm: 2640, nrc: 750 },
    ],
  },
  {
    product: 'Managed NOC',
    tiers: [
      { bandwidth: 'Basic', term_12: 800, term_24: 720, term_36: 650, mtm: 960, nrc: 1000 },
      { bandwidth: 'Standard', term_12: 1500, term_24: 1350, term_36: 1220, mtm: 1800, nrc: 1500 },
      { bandwidth: 'Premium', term_12: 2800, term_24: 2520, term_36: 2270, mtm: 3360, nrc: 2500 },
    ],
  },
]

const DISCOUNT_RULES = {
  maxPct: 15,
  termDiscount: { '24': 5, '36': 10 },
  volumeDiscount: { threshold: 5, pct: 3 },
  bundleDiscount: { minProducts: 2, pct: 5 },
}

const VERTICAL_ADJ = [
  { vertical: 'Healthcare', pct: 5, note: 'HIPAA compliance premium' },
  { vertical: 'Government', pct: -8, note: 'Public sector discount' },
  { vertical: 'Education', pct: -10, note: 'Education discount' },
  { vertical: 'Enterprise', pct: 0, note: 'Standard pricing' },
  { vertical: 'Financial Services', pct: 3, note: 'SLA premium' },
]

const UPLOAD_HISTORY = [
  { date: '2026-03-18', user: 'J. Martinez', file: 'pricing_q1_2026.csv', products: 6, tiers: 23 },
  { date: '2026-01-05', user: 'S. Patel', file: 'pricing_annual_2026.csv', products: 5, tiers: 20 },
  { date: '2025-10-12', user: 'J. Martinez', file: 'pricing_q4_update.csv', products: 3, tiers: 12 },
]

const $ = n => `$${n.toLocaleString()}`

// ── Section component ───────────────────────────────────────────────────────

function Section({ title, color = T.cyan, badge, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyRef = useRef(null)
  const [h, setH] = useState(0)

  const toggle = () => {
    if (bodyRef.current) setH(bodyRef.current.scrollHeight)
    setOpen(o => !o)
  }

  return (
    <div className="bg-revos-card rounded-xl shadow-card mb-3 overflow-hidden border border-revos-border">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2 px-4 py-3 bg-transparent border-none cursor-pointer text-left"
      >
        <span
          className="text-[10px] transition-transform duration-200"
          style={{ color, transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >▶</span>
        <span className="font-sans text-[11px] font-semibold text-revos-text flex-1">{title}</span>
        {badge && <span className="font-mono text-[10px] text-revos-text-dim">{badge}</span>}
      </button>
      <div
        style={{ maxHeight: open ? (h || 2000) : 0, opacity: open ? 1 : 0 }}
        className="transition-all duration-300 ease-out overflow-hidden"
      >
        <div ref={bodyRef} className="px-4 pb-4">
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function PricingEngine() {
  const [activeProduct, setActiveProduct] = useState('Ethernet')
  const [uploading, setUploading] = useState(false)
  const [uploadDone, setUploadDone] = useState(false)

  const product = PRODUCTS.find(p => p.product === activeProduct) || PRODUCTS[0]
  const totalTiers = PRODUCTS.reduce((s, p) => s + p.tiers.length, 0)

  const handleUpload = () => {
    setUploading(true)
    setUploadDone(false)
    setTimeout(() => {
      setUploading(false)
      setUploadDone(true)
      setTimeout(() => setUploadDone(false), 3000)
    }, 2000)
  }

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-revos-text m-0 font-sans tracking-tight">
            Pricing Engine
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-[9px] px-2 py-0.5 rounded-full"
              style={{ background: `${T.green}18`, color: T.green, border: `1px solid ${T.green}30` }}>
              ACTIVE
            </span>
            <span className="font-mono text-[9px] text-revos-text-dim">v2.1 · Q1 2026</span>
          </div>
        </div>
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="border-none rounded-lg px-4 py-2 text-[12px] font-semibold cursor-pointer font-sans transition-all"
          style={{
            background: uploading ? T.surface : T.cyan,
            color: uploading ? T.textDim : T.bg,
            opacity: uploading ? 0.7 : 1,
          }}
        >
          {uploading ? '⏳ Processing...' : uploadDone ? '✓ Uploaded' : '📤 Upload Pricing'}
        </button>
      </div>

      {/* ── Status Strip ── */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'PRODUCTS', value: PRODUCTS.length, color: T.cyan },
          { label: 'TOTAL TIERS', value: totalTiers, color: T.purple },
          { label: 'EFFECTIVE', value: 'Mar 2026', color: T.green },
          { label: 'DISCOUNT CEILING', value: `${DISCOUNT_RULES.maxPct}%`, color: T.orange },
        ].map((kpi, i) => (
          <div key={i} className="bg-revos-card rounded-xl border border-revos-border px-4 py-3">
            <div className="font-sans text-[8px] text-revos-text-dim tracking-wider uppercase mb-1">{kpi.label}</div>
            <div className="font-mono text-lg font-bold" style={{ color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* ── Product Tabs ── */}
      <div className="flex gap-1 mb-4 bg-revos-surface rounded-xl p-1 flex-wrap">
        {PRODUCTS.map(p => (
          <button
            key={p.product}
            onClick={() => setActiveProduct(p.product)}
            className={cn(
              'px-3 py-1.5 rounded-lg border-none cursor-pointer font-mono text-[10px] font-semibold transition-all',
              activeProduct === p.product
                ? 'bg-revos-card text-revos-cyan shadow-card'
                : 'bg-transparent text-revos-text-dim'
            )}
          >
            {p.product}
          </button>
        ))}
      </div>

      {/* ── Pricing Table ── */}
      <div className="bg-revos-card rounded-xl border border-revos-border overflow-hidden mb-5">
        <div className="px-4 py-3 border-b border-revos-border flex items-center justify-between">
          <div className="font-sans text-[12px] font-semibold text-revos-text">{product.product} Pricing</div>
          <div className="font-mono text-[9px] text-revos-text-dim">{product.tiers.length} tiers</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-revos-border">
                {['Bandwidth', '12 mo', '24 mo', '36 mo', 'MtM', 'NRC'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-sans text-[9px] text-revos-text-dim tracking-wider uppercase font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {product.tiers.map((tier, i) => (
                <tr key={i} className="border-b border-revos-border last:border-b-0"
                  style={{ background: i % 2 === 0 ? 'transparent' : `${T.surface}40` }}>
                  <td className="px-4 py-2.5 font-mono text-[11px] font-semibold text-revos-text">{tier.bandwidth}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-revos-text-mid">{$(tier.term_12)}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-revos-cyan">{$(tier.term_24)}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-revos-green font-semibold">{$(tier.term_36)}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-revos-orange">{$(tier.mtm)}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-revos-text-dim">{$(tier.nrc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Vertical Adjustments ── */}
      <Section title="Vertical Adjustments" color={T.purple} badge={`${VERTICAL_ADJ.length} verticals`}>
        <div className="space-y-2">
          {VERTICAL_ADJ.map((v, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 bg-revos-surface rounded-lg">
              <span className="font-sans text-[11px] font-semibold text-revos-text w-36">{v.vertical}</span>
              <div className="flex-1 h-[4px] bg-revos-border rounded-sm relative">
                <div
                  className="absolute top-0 h-full rounded-sm"
                  style={{
                    left: v.pct >= 0 ? '50%' : `${50 + (v.pct / 20) * 50}%`,
                    width: `${Math.abs(v.pct) / 20 * 50}%`,
                    background: v.pct > 0 ? T.orange : T.green,
                  }}
                />
                <div className="absolute top-[-3px] left-1/2 w-px h-[10px] bg-revos-text-dim" />
              </div>
              <span className="font-mono text-[11px] font-bold w-12 text-right"
                style={{ color: v.pct > 0 ? T.orange : v.pct < 0 ? T.green : T.textDim }}>
                {v.pct > 0 ? '+' : ''}{v.pct}%
              </span>
              <span className="font-mono text-[9px] text-revos-text-dim w-40">{v.note}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Discount Rules ── */}
      <Section title="Discount Rules" color={T.cyan} badge={`${DISCOUNT_RULES.maxPct}% ceiling`}>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-revos-surface rounded-lg p-3 border border-revos-border">
            <div className="font-sans text-[9px] text-revos-text-dim tracking-wider uppercase mb-2">TERM DISCOUNTS</div>
            {Object.entries(DISCOUNT_RULES.termDiscount).map(([term, pct]) => (
              <div key={term} className="flex justify-between items-center mb-1">
                <span className="font-mono text-[10px] text-revos-text-mid">{term} months</span>
                <span className="font-mono text-[10px] font-semibold text-revos-green">-{pct}%</span>
              </div>
            ))}
          </div>
          <div className="bg-revos-surface rounded-lg p-3 border border-revos-border">
            <div className="font-sans text-[9px] text-revos-text-dim tracking-wider uppercase mb-2">VOLUME DISCOUNT</div>
            <div className="font-mono text-[10px] text-revos-text-mid mb-1">
              ≥ {DISCOUNT_RULES.volumeDiscount.threshold} circuits
            </div>
            <div className="font-mono text-[14px] font-bold text-revos-green">
              -{DISCOUNT_RULES.volumeDiscount.pct}%
            </div>
          </div>
          <div className="bg-revos-surface rounded-lg p-3 border border-revos-border">
            <div className="font-sans text-[9px] text-revos-text-dim tracking-wider uppercase mb-2">BUNDLE DISCOUNT</div>
            <div className="font-mono text-[10px] text-revos-text-mid mb-1">
              ≥ {DISCOUNT_RULES.bundleDiscount.minProducts} products
            </div>
            <div className="font-mono text-[14px] font-bold text-revos-green">
              -{DISCOUNT_RULES.bundleDiscount.pct}%
            </div>
          </div>
        </div>
      </Section>

      {/* ── Upload History ── */}
      <Section title="Upload History" color={T.textDim} badge={`${UPLOAD_HISTORY.length} uploads`}>
        <div className="space-y-1.5">
          {UPLOAD_HISTORY.map((u, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg"
              style={{ background: i % 2 === 0 ? 'transparent' : `${T.surface}40` }}>
              <span className="font-mono text-[10px] text-revos-text-dim w-24">{u.date}</span>
              <span className="font-mono text-[10px] text-revos-text-mid w-24">{u.user}</span>
              <span className="font-mono text-[10px] text-revos-cyan flex-1">{u.file}</span>
              <span className="font-mono text-[9px] text-revos-text-dim">{u.products} products · {u.tiers} tiers</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Bottom Actions ── */}
      <div className="flex gap-3 mt-4 pb-6">
        <button className="bg-transparent border border-revos-border rounded-lg px-4 py-2 text-[11px] font-mono text-revos-text-dim cursor-pointer transition-all hover:border-revos-cyan hover:text-revos-cyan">
          📥 Download Template
        </button>
        <button className="bg-transparent border border-revos-border rounded-lg px-4 py-2 text-[11px] font-mono text-revos-text-dim cursor-pointer transition-all hover:border-revos-green hover:text-revos-green">
          📤 Export Current
        </button>
      </div>
    </div>
  )
}
