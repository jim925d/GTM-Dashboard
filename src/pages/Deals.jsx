import { useState } from 'react'
import { T, FONT_MONO, FONT_SANS, RADIUS, CARD_SHADOW } from '../lib/constants'
import Stat from '../components/shared/Stat'
import Badge from '../components/shared/Badge'
import Tip from '../components/shared/Tip'
import { $, $k, pc } from '../components/shared/ChartTheme'

const TAB_STYLE = (active) => ({
  padding: '6px 16px',
  fontFamily: FONT_SANS,
  fontSize: '10px',
  letterSpacing: '0.04em',
  cursor: 'pointer',
  border: 'none',
  borderRadius: '4px',
  background: active ? `${T.purple}15` : T.surface,
  boxShadow: active ? `0 0 0 1px ${T.purple}30` : 'none',
  color: active ? T.purple : T.textDim,
  fontWeight: active ? 700 : 400,
})

function normalizeStage(s) {
  if (!s) return ''
  const l = s.toLowerCase().trim()
  if (l === 'closed won') return 'Closed Won'
  if (l === 'close lost' || l === 'closed lost') return 'Closed Lost'
  return s
}

function mergeAllDeals(a) {
  const seen = new Set()
  const all = []

  // Add historical deals (from historical.json — bookings, some losses, open stages)
  for (const d of (a.historical_deals || [])) {
    const key = `${d.product}|${d.mrr}|${d.close}|${d.type}`
    seen.add(key)
    all.push({ ...d, stage: normalizeStage(d.stage) })
  }

  // Add close_lost deals that aren't already in historicals
  for (const d of (a.losses?.deals || [])) {
    const key = `${d.product}|${d.mrr}|${d.date}|${d.type}`
    if (seen.has(key)) continue
    seen.add(key)
    all.push({
      product: d.product,
      mrr: d.mrr,
      stage: 'Closed Lost',
      type: d.type || '',
      close: d.date || '',
      rep: d.rep || '',
      manager: '',
      forecast: '',
      term: 0,
      npv: 0,
      opportunity_id: d.opportunity_id || '',
    })
  }

  // Sort by close date descending
  all.sort((a, b) => {
    const da = a.close ? new Date(a.close).getTime() : 0
    const db = b.close ? new Date(b.close).getTime() : 0
    return (db || 0) - (da || 0)
  })

  return all
}

export default function Deals({ a }) {
  const [tab, setTab] = useState('current')
  const [selDeal, setSelDeal] = useState(0)
  const [histFilter, setHistFilter] = useState('all')

  const activeDeals = a.active_deals || []
  const allHistorical = mergeAllDeals(a)

  // Filter historicals by sub-tab
  const historicalDeals = histFilter === 'all' ? allHistorical
    : histFilter === 'won' ? allHistorical.filter(d => normalizeStage(d.stage) === 'Closed Won' && d.mrr >= 0)
    : histFilter === 'lost' ? allHistorical.filter(d => normalizeStage(d.stage) === 'Closed Lost')
    : histFilter === 'churn' ? allHistorical.filter(d => d.mrr < 0)
    : allHistorical

  const hasNone = activeDeals.length === 0 && allHistorical.length === 0

  if (hasNone) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
        <div style={{ fontSize: '28px', marginBottom: '8px' }}>&#9823;</div>
        <div style={{ fontFamily: FONT_MONO, fontSize: '11px', color: T.textDim }}>No deals</div>
      </div>
    )
  }

  // Summary stats for historicals (use unfiltered totals)
  const histWon = allHistorical.filter(d => d.stage === 'Closed Won' && d.mrr >= 0)
  const histLost = allHistorical.filter(d => d.stage === 'Closed Lost')
  const histChurn = allHistorical.filter(d => d.mrr < 0)
  const histTotalMRR = allHistorical.reduce((s, d) => s + d.mrr, 0)

  return (
    <div>
      {/* Tab toggle */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button style={TAB_STYLE(tab === 'current')} onClick={() => { setTab('current'); setSelDeal(0) }}>
          <Tip label="CURRENT FUNNEL">CURRENT FUNNEL</Tip> ({activeDeals.length})
        </button>
        <button style={TAB_STYLE(tab === 'historical')} onClick={() => { setTab('historical'); setHistFilter('all') }}>
          <Tip label="HISTORICALS">HISTORICALS</Tip> ({allHistorical.length})
        </button>
      </div>

      {tab === 'current' && (
        activeDeals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', opacity: 0.5 }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: '11px', color: T.textDim }}>No active pipeline deals</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '12px' }}>
            {/* Deal list */}
            <div>
              <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.purple, letterSpacing: '0.04em', marginBottom: '8px' }}>
                {activeDeals.length} ACTIVE DEALS
              </div>
              {activeDeals.map((d, i) => (
                <div
                  key={i}
                  onClick={() => setSelDeal(i)}
                  style={{
                    background: i === selDeal ? T.cardHover : T.card,
                    boxShadow: CARD_SHADOW,
                    borderRadius: RADIUS,
                    padding: '10px',
                    marginBottom: '6px',
                    cursor: 'pointer',
                    borderLeft: `3px solid ${i === selDeal ? T.purple : 'transparent'}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ fontWeight: 600, fontSize: '11px' }}>{d.product}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {d.icb_id && (
                        <a
                          href={`https://zayo.lightning.force.com/lightning/r/Opportunity/${d.icb_id}/view`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            fontFamily: FONT_MONO, fontSize: '8px', fontWeight: 600,
                            padding: '2px 6px', borderRadius: '3px',
                            background: `${T.orange}18`, border: `1px solid ${T.orange}`,
                            color: T.orange, textDecoration: 'none', cursor: 'pointer',
                          }}
                        >
                          ICB
                        </a>
                      )}
                      {d.opportunity_id && (
                        <a
                          href={`https://zayo.lightning.force.com/lightning/r/Opportunity/${d.opportunity_id}/view`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            fontFamily: FONT_MONO, fontSize: '8px', fontWeight: 600,
                            padding: '2px 6px', borderRadius: '3px',
                            background: `${T.cyan}18`, border: `1px solid ${T.cyan}`,
                            color: T.cyan, textDecoration: 'none', cursor: 'pointer',
                          }}
                        >
                          SFDC
                        </a>
                      )}
                      <Badge color={T.purple}>{d.stage}</Badge>
                    </div>
                  </div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.textMid }}>
                    {$k(d.mrr)}/mo &middot; {d.forecast} &middot; {d.close}
                  </div>
                </div>
              ))}
            </div>

            {/* Deal detail panel */}
            <div>
              {activeDeals[selDeal] && (() => {
                const d = activeDeals[selDeal]
                return (
                  <div style={{ background: T.card, boxShadow: CARD_SHADOW, borderRadius: RADIUS, padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ fontWeight: 700, fontSize: '15px' }}>{d.product}</div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {d.icb_id && (
                          <a
                            href={`https://zayo.lightning.force.com/lightning/r/Opportunity/${d.icb_id}/view`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontFamily: FONT_MONO, fontSize: '9px', fontWeight: 600,
                              padding: '5px 12px', borderRadius: '5px',
                              background: `${T.orange}18`, border: `1px solid ${T.orange}`,
                              color: T.orange, textDecoration: 'none', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: '4px',
                            }}
                          >
                            OPEN ICB ↗
                          </a>
                        )}
                        {d.opportunity_id && (
                          <a
                            href={`https://zayo.lightning.force.com/lightning/r/Opportunity/${d.opportunity_id}/view`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontFamily: FONT_MONO, fontSize: '9px', fontWeight: 600,
                              padding: '5px 12px', borderRadius: '5px',
                              background: `${T.cyan}18`, border: `1px solid ${T.cyan}`,
                              color: T.cyan, textDecoration: 'none', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: '4px',
                            }}
                          >
                            OPEN IN SALESFORCE ↗
                          </a>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px' }}>
                      <Stat small label="MRR" value={$k(d.mrr)} color={T.green} />
                      <Stat small label="STAGE" value={d.stage} color={T.purple} />
                      <Stat small label="FORECAST" value={d.forecast} color={T.cyan} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div style={{ padding: '8px', background: T.surface, borderRadius: '5px' }}>
                        <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '2px' }}><Tip label="CLOSE DATE">CLOSE DATE</Tip></div>
                        <div style={{ fontSize: '12px', fontWeight: 600 }}>{d.close || '---'}</div>
                      </div>
                      <div style={{ padding: '8px', background: T.surface, borderRadius: '5px' }}>
                        <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '2px' }}><Tip label="REP">REP</Tip></div>
                        <div style={{ fontSize: '12px', fontWeight: 600 }}>{d.rep || '---'}</div>
                      </div>
                    </div>

                    {/* ICB Details */}
                    {d.icb && (
                      <div style={{ marginTop: '12px', background: `${T.orange}08`, border: `1px solid ${T.orange}22`, borderRadius: '8px', padding: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.orange, letterSpacing: '0.04em', fontWeight: 700 }}>
                            ICB DETAILS
                          </div>
                          {d.icb.status && (
                            <Badge color={
                              d.icb.status.toLowerCase().includes('approved') ? T.green
                              : d.icb.status.toLowerCase().includes('reject') ? T.red
                              : d.icb.status.toLowerCase().includes('pending') ? T.yellow
                              : T.orange
                            }>
                              {d.icb.status.toUpperCase()}
                            </Badge>
                          )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '8px' }}>
                          <div style={{ padding: '6px 8px', background: T.surface, borderRadius: '5px' }}>
                            <div style={{ fontFamily: FONT_MONO, fontSize: '7px', color: T.textDim, marginBottom: '2px' }}>STAGE</div>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: T.text }}>{d.icb.stage || '---'}</div>
                          </div>
                          <div style={{ padding: '6px 8px', background: T.surface, borderRadius: '5px' }}>
                            <div style={{ fontFamily: FONT_MONO, fontSize: '7px', color: T.textDim, marginBottom: '2px' }}>CREATED DATE</div>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: T.text }}>{d.icb.created_date || '---'}</div>
                          </div>
                          <div style={{ padding: '6px 8px', background: T.surface, borderRadius: '5px' }}>
                            <div style={{ fontFamily: FONT_MONO, fontSize: '7px', color: T.textDim, marginBottom: '2px' }}>SE NAME</div>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: T.text }}>{d.icb.se_name || '---'}</div>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                          <div style={{ padding: '6px 8px', background: T.surface, borderRadius: '5px' }}>
                            <div style={{ fontFamily: FONT_MONO, fontSize: '7px', color: T.textDim, marginBottom: '2px' }}>DATE SE REVIEW</div>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: T.text }}>{d.icb.se_review_date || '---'}</div>
                          </div>
                          <div style={{ padding: '6px 8px', background: T.surface, borderRadius: '5px' }}>
                            <div style={{ fontFamily: FONT_MONO, fontSize: '7px', color: T.textDim, marginBottom: '2px' }}>ICB SE REVIEW TIME</div>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: T.text }}>{d.icb.se_review_time || '---'}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        )
      )}

      {tab === 'historical' && (
        allHistorical.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', opacity: 0.5 }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: '11px', color: T.textDim }}>No historical deals</div>
          </div>
        ) : (
          <div>
            {/* Summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '12px' }}>
              <Stat small label="TOTAL DEALS" value={allHistorical.length} color={T.purple} />
              <Stat small label="NET MRR" value={$k(histTotalMRR)} color={histTotalMRR >= 0 ? T.green : T.red} />
              <Stat small label="WON" value={histWon.length} color={T.green} />
              <Stat small label="LOST / CHURN" value={`${histLost.length} / ${histChurn.length}`} color={T.red} />
            </div>

            {/* Sub-filter tabs */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              {[
                { id: 'all', label: 'ALL', count: allHistorical.length, color: T.purple },
                { id: 'won', label: 'BOOKINGS', count: histWon.length, color: T.green },
                { id: 'churn', label: 'CHURN', count: histChurn.length, color: T.red },
                { id: 'lost', label: 'CLOSED LOST', count: histLost.length, color: T.orange },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setHistFilter(f.id)}
                  style={{
                    padding: '4px 10px',
                    fontFamily: FONT_SANS,
                    fontSize: '10px',
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                    border: 'none',
                    borderRadius: '4px',
                    background: histFilter === f.id ? `${f.color}15` : T.surface,
                    boxShadow: histFilter === f.id ? `0 0 0 1px ${f.color}30` : 'none',
                    color: histFilter === f.id ? f.color : T.textDim,
                    fontWeight: histFilter === f.id ? 700 : 400,
                  }}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </div>

            {/* Historicals table */}
            <div style={{ background: T.card, boxShadow: CARD_SHADOW, borderRadius: RADIUS, overflow: 'hidden' }}>
              {/* Header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1.2fr 1fr 1fr 50px',
                  gap: '4px',
                  padding: '8px 12px',
                  background: T.surface,
                  borderBottom: `1px solid ${T.border}`,
                  fontFamily: FONT_MONO,
                  fontSize: '8px',
                  color: T.textDim,
                  letterSpacing: '0.06em',
                }}
              >
                <div><Tip label="PRODUCT">PRODUCT</Tip></div>
                <div style={{ textAlign: 'right' }}><Tip label="MRR">MRR</Tip></div>
                <div><Tip label="STAGE">STAGE</Tip></div>
                <div><Tip tip="Deal type: New Service, Re-Rate, Renewal, Disconnect, etc.">TYPE</Tip></div>
                <div><Tip label="CLOSE DATE">CLOSE DATE</Tip></div>
                <div><Tip label="REP">REP</Tip></div>
                <div></div>
              </div>

              {/* Rows */}
              <div style={{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
                {historicalDeals.map((d, i) => {
                  const isNeg = d.mrr < 0
                  const isLost = d.stage === 'Closed Lost'
                  const isWon = d.stage === 'Closed Won' && !isNeg
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 1fr 1.2fr 1fr 1fr 50px',
                        gap: '4px',
                        padding: '8px 12px',
                        borderBottom: `1px solid ${T.border}`,
                        fontSize: '11px',
                        background: i % 2 === 0 ? 'transparent' : T.surface + '40',
                      }}
                    >
                      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.product}
                      </div>
                      <div style={{ textAlign: 'right', fontFamily: FONT_MONO, fontSize: '10px', fontWeight: 600, color: isNeg ? T.red : T.green }}>
                        {isNeg ? '-' : ''}{$(Math.abs(d.mrr))}
                      </div>
                      <div>
                        <Badge color={isWon ? T.green : isNeg ? T.red : isLost ? T.orange : T.purple}>
                          {isWon ? 'WON' : isNeg ? 'CHURN' : isLost ? 'LOST' : d.stage || '---'}
                        </Badge>
                      </div>
                      <div style={{ fontSize: '10px', color: T.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.type || '---'}
                      </div>
                      <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.textDim }}>
                        {d.close || '---'}
                      </div>
                      <div style={{ fontSize: '10px', color: T.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.rep || '---'}
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        {d.opportunity_id && (
                          <a
                            href={`https://zayo.lightning.force.com/lightning/r/Opportunity/${d.opportunity_id}/view`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontFamily: FONT_MONO, fontSize: '8px', fontWeight: 600,
                              padding: '2px 6px', borderRadius: '3px',
                              background: `${T.cyan}18`, border: `1px solid ${T.cyan}`,
                              color: T.cyan, textDecoration: 'none', cursor: 'pointer',
                            }}
                          >
                            SFDC
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  )
}
