import { memo } from 'react'
import { T } from '../lib/constants'
import { cn } from '@/lib/utils'
import Stat from '../components/shared/Stat'
import Badge from '../components/shared/Badge'
import Tip from '../components/shared/Tip'
import { $, pc } from '../components/shared/ChartTheme'

export default memo(function Losses({ a }) {
  const l = a.losses || {}
  const hasLosses = (l.deals?.length > 0) || (a.churn_deals > 0) || (a.disconnects > 0) || (a.downgrades > 0) || (a.lost > 0)

  return (
    <div>
      {/* Summary stats */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        <Stat label="CLOSE-LOST MRR" value={$(a.lost_mrr)} sub={`${a.lost} deals`} color={T.red} />
        <Stat label="CHURN / RE-RATES" value={`-${$(a.churn_mrr || 0)}`} sub={`${a.churn_deals || 0} deals`} color={T.red} />
        <Stat label="DISCONNECTS" value={`${a.disconnects}`} color={T.orange} />
        <Stat label="DOWNGRADES" value={`-${$(a.downgrade_mrr)}`} sub={`${a.downgrades} events`} color={T.yellow} />
        <Stat label="NRR" value={pc(a.nrr)} color={a.nrr >= 1 ? T.green : T.red} />
      </div>

      {!hasLosses && (
        <div className="text-center p-10 text-revos-text-dim">
          <div className="font-mono text-[11px]">No loss events for this account</div>
        </div>
      )}

      {/* Churn / negative re-rate deals */}
      {a.churn_deals_list?.length > 0 && (
        <div className="bg-revos-card rounded-lg p-3.5 mb-3.5" style={{ border: `1px solid ${T.red}18` }}>
          <div className="font-mono text-[9px] text-revos-red tracking-[0.08em] mb-2.5">
            <Tip label="CHURN / NEGATIVE RE-RATES">CHURN / NEGATIVE RE-RATES</Tip> ({a.churn_deals_list.length})
          </div>
          {a.churn_deals_list.map((d, i) => (
            <div key={i} className={cn('p-2 rounded mb-1', i % 2 ? 'bg-revos-surface' : 'bg-transparent')}>
              <div className="flex justify-between mb-0.5">
                <span className="font-semibold text-xs">{d.product}</span>
                <span className="font-mono text-xs font-bold text-revos-red">-{$(Math.abs(d.mrr))} MRR</span>
              </div>
              <div className="font-mono text-[9px] text-revos-text-dim">
                {d.close} · {d.type || 'Re-Rate'} · {d.rep}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Losses by product */}
      {Object.keys(l.by_product || {}).length > 0 && (
        <div className="bg-revos-card border border-revos-border rounded-lg p-3.5 mb-3.5">
          <div className="font-mono text-[9px] text-revos-red tracking-[0.08em] mb-2.5"><Tip label="LOSSES BY PRODUCT">LOSSES BY PRODUCT</Tip></div>
          {Object.entries(l.by_product)
            .sort((a, b) => b[1].mrr - a[1].mrr)
            .map(([prod, d]) => (
              <div key={prod} className="flex justify-between py-1.5 border-b border-revos-border">
                <span className="text-xs text-revos-text-mid">
                  {prod} ({d.count} deals)
                </span>
                <span className="font-mono text-xs font-semibold text-revos-red">{$(d.mrr)} MRR</span>
              </div>
            ))}
        </div>
      )}

      {/* Close-Lost deals */}
      {l.deals?.length > 0 && (
        <div className="bg-revos-card border border-revos-border rounded-lg p-3.5 mb-3.5">
          <div className="font-mono text-[9px] text-revos-red tracking-[0.08em] mb-2.5">
            <Tip label="CLOSE-LOST DEALS">CLOSE-LOST DEALS</Tip> ({l.deals.length})
          </div>
          {l.deals.map((d, i) => (
            <div key={i} className={cn('p-2 rounded mb-1', i % 2 ? 'bg-revos-surface' : 'bg-transparent')}>
              <div className="flex justify-between mb-0.5">
                <span className="font-semibold text-xs">{d.product}</span>
                <span className="font-mono text-xs font-bold text-revos-red">{$(d.mrr)} MRR</span>
              </div>
              <div className="font-mono text-[9px] text-revos-text-dim">
                Lost {d.date} · {d.type} · {d.rep}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Disconnected services */}
      {l.disconnects?.length > 0 && (
        <div className="bg-revos-card rounded-lg p-3.5 mb-3.5" style={{ border: `1px solid ${T.orange}18` }}>
          <div className="font-mono text-[9px] text-revos-orange tracking-[0.08em] mb-2">
            <Tip label="DISCONNECTED SERVICES">DISCONNECTED SERVICES</Tip> ({l.disconnects.length})
          </div>
          {l.disconnects.map((d, i) => (
            <div key={i} className="flex justify-between py-1.5 border-b border-revos-border text-[11px]">
              <span>{d.product}</span>
              {d.mrr > 0 && <span className="font-mono font-semibold text-revos-orange">{$(d.mrr)}/mo</span>}
              <span className="text-revos-text-dim">{d.date || 'N/A'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})
