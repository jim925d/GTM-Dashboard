import { memo } from 'react'
import { T, FONT_MONO } from '../lib/constants'
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '16px' }}>
        <Stat label="CLOSE-LOST MRR" value={$(a.lost_mrr)} sub={`${a.lost} deals`} color={T.red} />
        <Stat label="CHURN / RE-RATES" value={`-${$(a.churn_mrr || 0)}`} sub={`${a.churn_deals || 0} deals`} color={T.red} />
        <Stat label="DISCONNECTS" value={`${a.disconnects}`} color={T.orange} />
        <Stat label="DOWNGRADES" value={`-${$(a.downgrade_mrr)}`} sub={`${a.downgrades} events`} color={T.yellow} />
        <Stat label="NRR" value={pc(a.nrr)} color={a.nrr >= 1 ? T.green : T.red} />
      </div>

      {!hasLosses && (
        <div style={{ textAlign: 'center', padding: '40px', color: T.textDim }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: '11px' }}>No loss events for this account</div>
        </div>
      )}

      {/* Churn / negative re-rate deals */}
      {a.churn_deals_list?.length > 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.red}18`, borderRadius: '8px', padding: '14px', marginBottom: '14px' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.red, letterSpacing: '0.08em', marginBottom: '10px' }}>
            <Tip label="CHURN / NEGATIVE RE-RATES">CHURN / NEGATIVE RE-RATES</Tip> ({a.churn_deals_list.length})
          </div>
          {a.churn_deals_list.map((d, i) => (
            <div key={i} style={{ padding: '8px', background: i % 2 ? T.surface : 'transparent', borderRadius: '4px', marginBottom: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ fontWeight: 600, fontSize: '12px' }}>{d.product}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: '12px', fontWeight: 700, color: T.red }}>-{$(Math.abs(d.mrr))} MRR</span>
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim }}>
                {d.close} · {d.type || 'Re-Rate'} · {d.rep}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Losses by product */}
      {Object.keys(l.by_product || {}).length > 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '8px', padding: '14px', marginBottom: '14px' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.red, letterSpacing: '0.08em', marginBottom: '10px' }}><Tip label="LOSSES BY PRODUCT">LOSSES BY PRODUCT</Tip></div>
          {Object.entries(l.by_product)
            .sort((a, b) => b[1].mrr - a[1].mrr)
            .map(([prod, d]) => (
              <div key={prod} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontSize: '12px', color: T.textMid }}>
                  {prod} ({d.count} deals)
                </span>
                <span style={{ fontFamily: FONT_MONO, fontSize: '12px', fontWeight: 600, color: T.red }}>{$(d.mrr)} MRR</span>
              </div>
            ))}
        </div>
      )}

      {/* Close-Lost deals */}
      {l.deals?.length > 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '8px', padding: '14px', marginBottom: '14px' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.red, letterSpacing: '0.08em', marginBottom: '10px' }}>
            <Tip label="CLOSE-LOST DEALS">CLOSE-LOST DEALS</Tip> ({l.deals.length})
          </div>
          {l.deals.map((d, i) => (
            <div key={i} style={{ padding: '8px', background: i % 2 ? T.surface : 'transparent', borderRadius: '4px', marginBottom: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ fontWeight: 600, fontSize: '12px' }}>{d.product}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: '12px', fontWeight: 700, color: T.red }}>{$(d.mrr)} MRR</span>
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim }}>
                Lost {d.date} · {d.type} · {d.rep}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Disconnected services */}
      {l.disconnects?.length > 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.orange}18`, borderRadius: '8px', padding: '14px', marginBottom: '14px' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.orange, letterSpacing: '0.08em', marginBottom: '8px' }}>
            <Tip label="DISCONNECTED SERVICES">DISCONNECTED SERVICES</Tip> ({l.disconnects.length})
          </div>
          {l.disconnects.map((d, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${T.border}`, fontSize: '11px' }}>
              <span>{d.product}</span>
              {d.mrr > 0 && <span style={{ fontFamily: FONT_MONO, fontWeight: 600, color: T.orange }}>{$(d.mrr)}/mo</span>}
              <span style={{ color: T.textDim }}>{d.date || 'N/A'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})
