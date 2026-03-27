# Churn Probability Model — Risk-Weighted MRR

## Concept

At-Risk MRR is not a binary flag. Every account has a **probability of churn** based on multiple signals, and the risk-weighted MRR is:

```
riskWeightedMRR = accountMRR × churnProbability
```

Sum across all accounts = total At-Risk MRR shown in the summary strip.

This mirrors the pipeline approach: just as weighted pipeline = deal MRR × win probability, at-risk MRR = account MRR × churn probability.

## Signals → Probability

Each signal contributes an independent churn probability. They combine using the complement method (like independent failure modes):

```
P(churn) = 1 - (1 - p_mtm)(1 - p_expiring)(1 - p_nib)(1 - p_disconnect)(1 - p_engagement)(1 - p_health)(1 - p_headwind)
```

This means: the probability of churning is 1 minus the probability of surviving ALL risk factors simultaneously. Each signal can independently cause churn — having multiple signals compounds the risk without exceeding 100%.

### Signal Definitions

| Signal | Condition | Churn Probability | Data Source |
|--------|-----------|-------------------|-------------|
| MTM exposure | `exp_period = "1-MTM"` | 0.35 (35% of MTM services churn within 12 months) | Services tab: `exp_period` field |
| Contract expiring (no renewal) | Service expires within 90 days AND no renewal deal in active pipeline | 0.45 | Services tab: `service_exp` cross-referenced with Pipeline tab |
| Contract expiring (renewal exists) | Service expires within 90 days AND renewal deal exists | 0.10 | Same cross-reference |
| Negative NIB (24m) | `nib_24m < 0` | `min(0.40, abs(nib_24m) / accountMRR × 0.5)` — scales with severity | Computed from Historical + Churn tabs |
| Recent disconnects | 1+ disconnect events in last 180 days | 0.25 per disconnect (capped at 0.60) | Churn tab: disconnect records |
| Engagement decay | No activity in 30+ days (was previously active) | 0.15 | Engagement tab: last activity date |
| Health score critical | `health < 40` | 0.30 | Computed health score |
| Health score watch | `40 ≤ health < 60` | 0.10 | Computed health score |
| Event headwind | `event_modifier < 0.98` | 0.08 | Event context engine |

### Example Calculations

**Broadleaf Energy** (TMR $1,900/mo):
- MTM: 3 services MTM → p = 0.35
- Negative NIB: nib_24m = -$18,400, MRR = $1,900 → p = min(0.40, 18400/1900 × 0.5) = 0.40
- Engagement: 24 days silent → p = 0.15
- Health: 38 → p = 0.30
- Headwind: mod 0.96 → p = 0.08

```
P(churn) = 1 - (1-0.35)(1-0.40)(1-0.15)(1-0.30)(1-0.08)
         = 1 - (0.65)(0.60)(0.85)(0.70)(0.92)
         = 1 - 0.213
         = 0.787 (78.7%)

Risk-weighted MRR = $1,900 × 0.787 = $1,495/mo
```

**CloudNexus Inc** (TMR $5,600/mo):
- No MTM: p = 0
- Positive NIB: nib_24m = +$48,200 → p = 0
- Engagement: 2 days → p = 0
- Health: 88 → p = 0
- Tailwind: mod 1.09 → p = 0

```
P(churn) = 1 - (1-0)(1-0)(1-0)(1-0)(1-0)
         = 1 - 1.0
         = 0.0 (0%)

Risk-weighted MRR = $5,600 × 0.0 = $0
```

**Apex Financial** (TMR $2,408/mo):
- No MTM: p = 0
- Engagement: 14 days (borderline) → p = 0
- Health: 65 → watch → p = 0.10
- Tailwind: mod 1.18 → p = 0

```
P(churn) = 1 - (1-0.10)
         = 0.10 (10%)

Risk-weighted MRR = $2,408 × 0.10 = $241/mo
```

## Implementation

### Python (backend — inside modeling_layer.py)

```python
def compute_churn_probability(account, services, pipeline_deals, engagement):
    """
    Compute per-account churn probability from independent signals.
    Returns: { probability: float, risk_mrr: float, signals: list }
    """
    signals = []
    
    # MTM exposure
    mtm_services = [s for s in services if s.get('exp_period') == '1-MTM']
    if mtm_services:
        p = 0.35
        signals.append({'signal': 'MTM exposure', 'probability': p, 
                        'detail': f'{len(mtm_services)} services month-to-month'})
    
    # Contract expiring without renewal
    expiring = [s for s in services 
                if s.get('service_exp') and days_until(s['service_exp']) <= 90]
    for svc in expiring:
        has_renewal = any(d for d in pipeline_deals 
                         if d.get('type', '').lower().find('renewal') >= 0)
        p = 0.10 if has_renewal else 0.45
        signals.append({'signal': 'Contract expiring', 'probability': p,
                        'detail': f'Expires {svc["service_exp"]}, {"renewal in pipe" if has_renewal else "no renewal"}'})
    
    # Negative NIB (24m)
    nib_24m = account.get('nib_24m', 0)
    account_mrr = account.get('tmr', 0) or 1
    if nib_24m < 0:
        p = min(0.40, abs(nib_24m) / account_mrr * 0.5)
        signals.append({'signal': 'Negative NIB (24m)', 'probability': round(p, 3),
                        'detail': f'NIB = ${nib_24m:,.0f}'})
    
    # Recent disconnects
    recent_disconnects = account.get('disconnects_180d', 0)
    if recent_disconnects > 0:
        p = min(0.60, 0.25 * recent_disconnects)
        signals.append({'signal': 'Recent disconnects', 'probability': p,
                        'detail': f'{recent_disconnects} in last 180d'})
    
    # Engagement decay
    days_silent = account.get('days_since_last_activity', 0)
    if days_silent >= 30:
        p = 0.15
        signals.append({'signal': 'Engagement decay', 'probability': p,
                        'detail': f'{days_silent} days silent'})
    
    # Health score
    health = account.get('health', 100)
    if health < 40:
        signals.append({'signal': 'Critical health', 'probability': 0.30, 'detail': f'Score: {health}'})
    elif health < 60:
        signals.append({'signal': 'Watch health', 'probability': 0.10, 'detail': f'Score: {health}'})
    
    # Event headwind
    mod = account.get('avg_event_modifier', 1.0)
    if mod < 0.98:
        signals.append({'signal': 'Market headwind', 'probability': 0.08, 
                        'detail': f'Modifier: {mod:.2f}×'})
    
    # Combine: P(churn) = 1 - product of (1 - p_i)
    if not signals:
        return {'probability': 0.0, 'risk_mrr': 0.0, 'signals': []}
    
    survival = 1.0
    for s in signals:
        survival *= (1.0 - s['probability'])
    
    churn_prob = round(1.0 - survival, 4)
    risk_mrr = round(account_mrr * churn_prob, 2)
    
    return {
        'probability': churn_prob,
        'risk_mrr': risk_mrr,
        'signals': signals,
    }
```

### JavaScript (frontend — inside ModelingContext or page-level computation)

```javascript
function churnProb(account) {
  const signals = [];
  
  if (account.mtm_services > 0) signals.push({ signal: 'MTM', p: 0.35 });
  if (account.expiring_no_renewal) signals.push({ signal: 'Expiring (no renewal)', p: 0.45 });
  if (account.expiring_with_renewal) signals.push({ signal: 'Expiring (renewal)', p: 0.10 });
  
  const nib24 = account.nib_24m || 0;
  const mrr = account.tmr || 1;
  if (nib24 < 0) signals.push({ signal: 'Negative NIB', p: Math.min(0.40, Math.abs(nib24) / mrr * 0.5) });
  
  const dc = account.disconnects_180d || 0;
  if (dc > 0) signals.push({ signal: 'Disconnects', p: Math.min(0.60, 0.25 * dc) });
  
  if ((account.days_since_last_activity || 0) >= 30) signals.push({ signal: 'Silent', p: 0.15 });
  
  if ((account.health || 100) < 40) signals.push({ signal: 'Critical', p: 0.30 });
  else if ((account.health || 100) < 60) signals.push({ signal: 'Watch', p: 0.10 });
  
  if ((account.avg_event_modifier || 1) < 0.98) signals.push({ signal: 'Headwind', p: 0.08 });
  
  const survival = signals.reduce((s, sig) => s * (1 - sig.p), 1.0);
  const prob = Math.round((1 - survival) * 10000) / 10000;
  
  return { probability: prob, riskMRR: Math.round(mrr * prob), signals };
}

// Total at-risk MRR across all accounts:
const atRiskMRR = enrichedAccounts.reduce((sum, acct) => sum + churnProb(acct).riskMRR, 0);
```

## How It Reads

In the summary strip: **At-Risk MRR: $48.2K** — this is the probability-weighted sum across all accounts. It's not "accounts below a threshold" — it's a continuous, data-driven estimate of how much MRR is likely to churn.

In the expanded account card: **Churn Risk: 78.7% ($1,495/mo)** — the seller sees both the probability and the dollar impact. The signals list shows exactly why: "MTM exposure (35%), Negative NIB (40%), Silent 24d (15%), Health 38 (30%), Headwind (8%)".

## Calibration Notes

The base probabilities (0.35 for MTM, 0.45 for expiring-no-renewal, etc.) should be calibrated against historical data:
- What % of MTM services actually churned within 12 months?
- What % of expiring contracts without renewal deals churned?
- What's the correlation between NIB trend and actual churn?

Start with these estimates, then backtest against the Historical + Churn tabs. The same validation approach used for the event context engine (Brier score, cross-validation) applies here.
