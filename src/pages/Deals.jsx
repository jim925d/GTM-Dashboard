import { useState, useMemo, memo } from 'react'
import { T } from '../lib/constants'
import { cn } from '@/lib/utils'
import Stat from '../components/shared/Stat'
import Badge from '../components/shared/Badge'
import Tip from '../components/shared/Tip'
import { $, $k, pc } from '../components/shared/ChartTheme'
import { AnimatedBorderCard, RevealCard, GlowBadge } from '../components/effects'

const TAB_STYLE = (active) => ({
  background: active ? `${T.purple}15` : T.surface,
  boxShadow: active ? `0 0 0 1px ${T.purple}30` : 'none',
  color: active ? T.purple : T.textDim,
  fontWeight: active ? 700 : 400,
})

function normalizeStage(s) {
  if (!s) return ''
  const l = s.toLowerCase().trim()
  if (l === 'closed won' || l === 'closed-won' || l.includes('accepted') || l === '5 - accepted') return 'Closed Won'
  if (l === 'close lost' || l === 'closed lost') return 'Closed Lost'
  return s
}

// Deals dashboard uses funnel.csv ONLY (no historical.json or close_lost.csv)
function getClosedDeals(a) {
  const all = (a.funnel_closed || []).map(d => ({ ...d, stage: normalizeStage(d.stage) }))

  // Sort by close date descending
  all.sort((a, b) => {
    const da = a.close ? new Date(a.close).getTime() : 0
    const db = b.close ? new Date(b.close).getTime() : 0
    return (db || 0) - (da || 0)
  })

  return all
}

export default memo(function Deals({ a }) {
  const [tab, setTab] = useState('current')
  const [selDeal, setSelDeal] = useState(0)
  const [histFilter, setHistFilter] = useState('all')

  const activeDeals = a.active_deals || []
  const allHistorical = useMemo(() => getClosedDeals(a), [a])

  // Filter historicals by sub-tab
  const historicalDeals = histFilter === 'all' ? allHistorical
    : histFilter === 'won' ? allHistorical.filter(d => normalizeStage(d.stage) === 'Closed Won' && d.mrr >= 0)
    : histFilter === 'lost' ? allHistorical.filter(d => normalizeStage(d.stage) === 'Closed Lost')
    : histFilter === 'churn' ? allHistorical.filter(d => d.mrr < 0)
    : allHistorical

  const hasNone = activeDeals.length === 0 && allHistorical.length === 0

  if (hasNone) {
    return (
      <div className="text-center p-10 opacity-50">
        <div className="text-[28px] mb-2">&#9823;</div>
        <div className="font-mono text-[11px] text-revos-text-dim">No deals</div>
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
      <div className="flex gap-2 mb-4">
        <button className="px-4 py-1.5 font-sans text-[10px] tracking-[0.04em] cursor-pointer border-none rounded" style={TAB_STYLE(tab === 'current')} onClick={() => { setTab('current'); setSelDeal(0) }}>
          <Tip label="CURRENT FUNNEL">CURRENT FUNNEL</Tip> ({activeDeals.length})
        </button>
        <button className="px-4 py-1.5 font-sans text-[10px] tracking-[0.04em] cursor-pointer border-none rounded" style={TAB_STYLE(tab === 'historical')} onClick={() => { setTab('historical'); setHistFilter('all') }}>
          <Tip label="HISTORICALS">HISTORICALS</Tip> ({allHistorical.length})
        </button>
      </div>

      {tab === 'current' && (
        activeDeals.length === 0 ? (
          <div className="text-center p-[30px] opacity-50">
            <div className="font-mono text-[11px] text-revos-text-dim">No active pipeline deals</div>
          </div>
        ) : (
          <div className="grid grid-cols-[280px_1fr] gap-3">
            {/* Deal list */}
            <div>
              <div className="font-sans text-[10px] text-revos-purple tracking-[0.04em] mb-2">
                {activeDeals.length} ACTIVE DEALS
              </div>
              {activeDeals.map((d, i) => (
                <RevealCard
                  key={i}
                  className={cn('mb-1.5 cursor-pointer opacity-0 animate-fade-slide-in', i === selDeal && '!border-revos-purple/30')}
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                <div
                  onClick={() => setSelDeal(i)}
                  className="p-2.5 shadow-card rounded-xl"
                  style={{
                    background: i === selDeal ? T.cardHover : T.card,
                    borderLeft: `3px solid ${i === selDeal ? T.purple : 'transparent'}`,
                  }}
                >
                  <div className="flex justify-between mb-0.5">
                    <span className="font-semibold text-[11px]">{d.product}</span>
                    <div className="flex items-center gap-1">
                      {d.icb_id && (
                        <a
                          href={`https://zayo.lightning.force.com/lightning/r/Opportunity/${d.icb_id}/view`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-[8px] font-semibold px-1.5 py-0.5 rounded-[3px] no-underline cursor-pointer"
                          style={{
                            background: `${T.orange}18`, border: `1px solid ${T.orange}`,
                            color: T.orange,
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
                          className="font-mono text-[8px] font-semibold px-1.5 py-0.5 rounded-[3px] no-underline cursor-pointer"
                          style={{
                            background: `${T.cyan}18`, border: `1px solid ${T.cyan}`,
                            color: T.cyan,
                          }}
                        >
                          SFDC
                        </a>
                      )}
                      <Badge color={T.purple}>{d.stage}</Badge>
                    </div>
                  </div>
                  <div className="font-mono text-[10px] text-revos-text-mid">
                    {$k(d.mrr)}/mo &middot; {d.forecast} &middot; {d.close}
                  </div>
                </div>
                </RevealCard>
              ))}
            </div>

            {/* Deal detail panel */}
            <div>
              {activeDeals[selDeal] && (() => {
                const d = activeDeals[selDeal]
                return (
                  <AnimatedBorderCard borderColor={`${T.purple}60`}>
                  <div className="bg-revos-card shadow-card rounded-xl p-4">
                    <div className="flex justify-between items-center mb-3">
                      <div className="font-bold text-[15px]">{d.product}</div>
                      <div className="flex gap-1.5">
                        {d.icb_id && (
                          <a
                            href={`https://zayo.lightning.force.com/lightning/r/Opportunity/${d.icb_id}/view`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-[9px] font-semibold px-3 py-[5px] rounded-[5px] no-underline cursor-pointer flex items-center gap-1"
                            style={{
                              background: `${T.orange}18`, border: `1px solid ${T.orange}`,
                              color: T.orange,
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
                            className="font-mono text-[9px] font-semibold px-3 py-[5px] rounded-[5px] no-underline cursor-pointer flex items-center gap-1"
                            style={{
                              background: `${T.cyan}18`, border: `1px solid ${T.cyan}`,
                              color: T.cyan,
                            }}
                          >
                            OPEN IN SALESFORCE ↗
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2.5 mb-3">
                      <Stat small label="MRR" value={$k(d.mrr)} color={T.green} />
                      <Stat small label="STAGE" value={d.stage} color={T.purple} />
                      <Stat small label="FORECAST" value={d.forecast} color={T.cyan} />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="p-2 bg-revos-surface rounded-[5px]">
                        <div className="font-sans text-[10px] text-revos-text-dim tracking-[0.04em] mb-0.5"><Tip label="CLOSE DATE">CLOSE DATE</Tip></div>
                        <div className="text-xs font-semibold">{d.close || '---'}</div>
                      </div>
                      <div className="p-2 bg-revos-surface rounded-[5px]">
                        <div className="font-sans text-[10px] text-revos-text-dim tracking-[0.04em] mb-0.5"><Tip label="REP">REP</Tip></div>
                        <div className="text-xs font-semibold">{d.rep || '---'}</div>
                      </div>
                    </div>

                    {/* ICB Details */}
                    {d.icb && (
                      <div
                        className="mt-3 rounded-lg p-3"
                        style={{ background: `${T.orange}08`, border: `1px solid ${T.orange}22` }}
                      >
                        <div className="flex justify-between items-center mb-2.5">
                          <div className="font-sans text-[10px] text-revos-orange tracking-[0.04em] font-bold">
                            ICB DETAILS
                          </div>
                          {d.icb.status && (
                            <GlowBadge color={
                              d.icb.status.toLowerCase().includes('approved') ? T.green
                              : d.icb.status.toLowerCase().includes('reject') ? T.red
                              : d.icb.status.toLowerCase().includes('pending') ? T.yellow
                              : T.orange
                            }>
                              {d.icb.status.toUpperCase()}
                            </GlowBadge>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          <div className="px-2 py-1.5 bg-revos-surface rounded-[5px]">
                            <div className="font-mono text-[7px] text-revos-text-dim mb-0.5">STAGE</div>
                            <div className="text-[11px] font-semibold text-revos-text">{d.icb.stage || '---'}</div>
                          </div>
                          <div className="px-2 py-1.5 bg-revos-surface rounded-[5px]">
                            <div className="font-mono text-[7px] text-revos-text-dim mb-0.5">CREATED DATE</div>
                            <div className="text-[11px] font-semibold text-revos-text">{d.icb.created_date || '---'}</div>
                          </div>
                          <div className="px-2 py-1.5 bg-revos-surface rounded-[5px]">
                            <div className="font-mono text-[7px] text-revos-text-dim mb-0.5">SE NAME</div>
                            <div className="text-[11px] font-semibold text-revos-text">{d.icb.se_name || '---'}</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="px-2 py-1.5 bg-revos-surface rounded-[5px]">
                            <div className="font-mono text-[7px] text-revos-text-dim mb-0.5">DATE SE REVIEW</div>
                            <div className="text-[11px] font-semibold text-revos-text">{d.icb.se_review_date || '---'}</div>
                          </div>
                          <div className="px-2 py-1.5 bg-revos-surface rounded-[5px]">
                            <div className="font-mono text-[7px] text-revos-text-dim mb-0.5">ICB SE REVIEW TIME</div>
                            <div className="text-[11px] font-semibold text-revos-text">{d.icb.se_review_time || '---'}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  </AnimatedBorderCard>
                )
              })()}
            </div>
          </div>
        )
      )}

      {tab === 'historical' && (
        allHistorical.length === 0 ? (
          <div className="text-center p-[30px] opacity-50">
            <div className="font-mono text-[11px] text-revos-text-dim">No historical deals</div>
          </div>
        ) : (
          <div>
            {/* Summary stats */}
            <div className="grid grid-cols-4 gap-2.5 mb-3">
              {[
                { label: 'TOTAL DEALS', value: allHistorical.length, color: T.purple },
                { label: 'NET MRR', value: $k(histTotalMRR), color: histTotalMRR >= 0 ? T.green : T.red },
                { label: 'WON', value: histWon.length, color: T.green },
                { label: 'LOST / CHURN', value: `${histLost.length} / ${histChurn.length}`, color: T.red },
              ].map((s, i) => (
                <div key={s.label} className="opacity-0 animate-fade-slide-in" style={{ animationDelay: `${i * 0.08}s` }}>
                  <Stat small label={s.label} value={s.value} color={s.color} />
                </div>
              ))}
            </div>

            {/* Sub-filter tabs */}
            <div className="flex gap-1.5 mb-3">
              {[
                { id: 'all', label: 'ALL', count: allHistorical.length, color: T.purple },
                { id: 'won', label: 'BOOKINGS', count: histWon.length, color: T.green },
                { id: 'churn', label: 'CHURN', count: histChurn.length, color: T.red },
                { id: 'lost', label: 'CLOSED LOST', count: histLost.length, color: T.orange },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setHistFilter(f.id)}
                  className="px-2.5 py-1 font-sans text-[10px] tracking-[0.04em] cursor-pointer border-none rounded"
                  style={{
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
            <div className="bg-revos-card shadow-card rounded-xl overflow-hidden">
              {/* Header */}
              <div
                className="grid grid-cols-[2fr_1fr_1fr_1.2fr_1fr_1fr_50px] gap-1 px-3 py-2 bg-revos-surface font-mono text-[8px] text-revos-text-dim tracking-[0.06em]"
                style={{ borderBottom: `1px solid ${T.border}` }}
              >
                <div><Tip label="PRODUCT">PRODUCT</Tip></div>
                <div className="text-right"><Tip label="MRR">MRR</Tip></div>
                <div><Tip label="STAGE">STAGE</Tip></div>
                <div><Tip tip="Deal type: New Service, Re-Rate, Renewal, Disconnect, etc.">TYPE</Tip></div>
                <div><Tip label="CLOSE DATE">CLOSE DATE</Tip></div>
                <div><Tip label="REP">REP</Tip></div>
                <div></div>
              </div>

              {/* Rows */}
              <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
                {historicalDeals.map((d, i) => {
                  const isNeg = d.mrr < 0
                  const isLost = d.stage === 'Closed Lost'
                  const isWon = d.stage === 'Closed Won' && !isNeg
                  return (
                    <div
                      key={i}
                      className="grid grid-cols-[2fr_1fr_1fr_1.2fr_1fr_1fr_50px] gap-1 px-3 py-2 text-[11px]"
                      style={{
                        borderBottom: `1px solid ${T.border}`,
                        background: i % 2 === 0 ? 'transparent' : T.surface + '40',
                      }}
                    >
                      <div className="font-semibold overflow-hidden text-ellipsis whitespace-nowrap">
                        {d.product}
                      </div>
                      <div
                        className="text-right font-mono text-[10px] font-semibold"
                        style={{ color: isNeg ? T.red : T.green }}
                      >
                        {isNeg ? '-' : ''}{$(Math.abs(d.mrr))}
                      </div>
                      <div>
                        <Badge color={isWon ? T.green : isNeg ? T.red : isLost ? T.orange : T.purple}>
                          {isWon ? 'WON' : isNeg ? 'CHURN' : isLost ? 'LOST' : d.stage || '---'}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-revos-text-mid overflow-hidden text-ellipsis whitespace-nowrap">
                        {d.type || '---'}
                      </div>
                      <div className="font-mono text-[10px] text-revos-text-dim">
                        {d.close || '---'}
                      </div>
                      <div className="text-[10px] text-revos-text-mid overflow-hidden text-ellipsis whitespace-nowrap">
                        {d.rep || '---'}
                      </div>
                      <div className="text-center">
                        {d.opportunity_id && (
                          <a
                            href={`https://zayo.lightning.force.com/lightning/r/Opportunity/${d.opportunity_id}/view`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-[8px] font-semibold px-1.5 py-0.5 rounded-[3px] no-underline cursor-pointer"
                            style={{
                              background: `${T.cyan}18`, border: `1px solid ${T.cyan}`,
                              color: T.cyan,
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
})
