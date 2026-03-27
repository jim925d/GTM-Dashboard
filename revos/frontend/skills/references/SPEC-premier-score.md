# Premier Score — Engine-Driven Account Ranking

## Philosophy

The Premier Score answers: **"If a rep has one hour, which account should they work?"**

It blends three dimensions:
1. **Urgency** — time-sensitive signals that decay if you don't act (outage, churn risk, engagement decay)
2. **Opportunity** — how much revenue is available (addressable spend × probability of capture)
3. **Confidence** — how sure the engines are that this recommendation is right (location affinity, win rate, event support)

No single dimension dominates. An outage on a small account can outscore a big opportunity with weak confidence. A greenfield with 96% location affinity and strong event tailwind can outscore an existing customer going cold.

---

## Formula

```
PremierScore = Urgency + Opportunity + Confidence
```

Each component scores 0–100. Total range: 0–300.

### Component 1: Urgency (0–100)

Time-sensitive signals that require action now. These decay — an outage today won't matter next week.

| Signal | Points | Condition | Source |
|--------|--------|-----------|--------|
| Active outage | +40 | Account impacted by detected outage | Outage engine |
| Churn probability | +0 to +30 | `churn_prob × 30` (scales linearly) | Churn model (7 signals) |
| Engagement decay | +0 to +20 | `min(20, days_silent / 3)` — maxes at 60 days | Engagement tab |
| Contract expiring | +10 | Any service expires within 90d with no renewal in pipe | Services + Pipeline tabs |

```javascript
urgency =
  (outage_active ? 40 : 0) +
  Math.min(30, churn_probability * 30) +
  Math.min(20, days_silent / 3) +
  (expiring_no_renewal ? 10 : 0);
```

**Why these weights:**
- Outage is 40 because it's the most time-sensitive signal — competitors are calling this account right now
- Churn scales to 30 because a 100% churn probability account needs immediate save action
- Engagement scales gradually — 10 days silent is only +3, but 60 days is +20
- Expiring contract is +10 — important but less urgent than an active outage

### Component 2: Opportunity (0–100)

How much revenue is available and how likely we are to capture it.

```
Opportunity = Spend Score + Expected Value Score
```

| Factor | Points | Calculation | Source |
|--------|--------|-------------|--------|
| Addressable spend | 0–50 | `min(50, addressable_spend_mrr / 1000)` — $50K/mo caps at 50 | Location intelligence gaps |
| Expected value | 0–50 | `min(50, (addressable_spend × predicted_win_rate) / 500)` | Spend × Prediction engine |

```javascript
const spendScore = Math.min(50, addressable_spend / 1000);
const evScore = Math.min(50, (addressable_spend * win_rate) / 500);
opportunity = spendScore + evScore;
```

**Why these weights:**
- Raw spend matters (a $37K opportunity is worth more attention than a $7K one)
- But spend × win rate matters more — a $20K opportunity at 74% beats a $37K opportunity at 30%
- Both cap at 50 so neither dominates — a huge-but-unlikely deal doesn't crowd out a small-but-certain one

### Component 3: Confidence (0–100)

How sure the engines are that this recommendation will convert. This is what makes the score *intelligent* rather than just a pipeline sorting exercise.

| Factor | Points | Calculation | Source |
|--------|--------|-------------|--------|
| Location affinity | 0–35 | `max_product_affinity × 0.35` (top product match) | Location intelligence |
| Predicted win rate | 0–35 | `win_rate × 0.35` | Prediction engine (Bayesian) |
| Event modifier | 0–20 | `max(0, (modifier - 0.90) × 200)` — starts scoring above 0.90, maxes at 1.00+ | Event context engine |
| On-net bonus | +10 | If account has on-net locations | Location intelligence |

```javascript
const affinityScore = max_product_affinity * 0.35;  // e.g., 92% → 32.2
const winScore = predicted_win_rate * 0.35;          // e.g., 74% → 25.9
const eventScore = Math.min(20, Math.max(0, (modifier - 0.90) * 200));  // 1.14 → 20, 0.96 → 12
const onNetBonus = on_net ? 10 : 0;
confidence = affinityScore + winScore + eventScore + onNetBonus;
```

**Why these weights:**
- Location affinity and win rate share equal weight (35 each) — the location engine says "what to sell" and the prediction engine says "how likely it closes"
- Event modifier gets 20 because it's a multiplier, not a primary signal — it amplifies an already-good opportunity
- On-net is a binary +10 because deliverability matters — you can't sell what you can't light up

---

## Score Ranges

| Range | Tier | Typical Profile |
|-------|------|-----------------|
| 200+ | **Critical** | Outage-impacted, high spend, strong engine confidence |
| 150–199 | **High Priority** | Strong opportunity + urgency OR engine confidence |
| 100–149 | **Priority** | Good opportunity with moderate confidence |
| 60–99 | **Worth Pursuing** | Smaller opportunity or lower confidence |
| <60 | **Monitor** | Low urgency, small spend, or weak engine signals |

---

## Worked Examples

### Desert Health — Score: 226

```
URGENCY (78):
  Outage active:           +40
  Churn prob (42%):        +12.6
  Engagement (1d silent):  +0.3
  Expiring contract:       +0
  Subtotal urgency:         53 → rounds to 53

Wait — let me recalculate properly:

URGENCY:
  Outage:                  +40
  Churn (0.42 × 30):      +12.6
  Silent (1 / 3):         +0.3
  Expiring:               +0
  = 52.9

OPPORTUNITY:
  Spend ($9.2K → 9.2):    +9.2
  EV ($9.2K × 62% / 500): +11.4
  = 20.6

CONFIDENCE:
  Affinity (88% × 0.35):  +30.8
  Win rate (62% × 0.35):  +21.7
  Event ((1.14-0.90)×200): +20 (capped)
  On-net:                  +10
  = 82.5

TOTAL: 52.9 + 20.6 + 82.5 = 156
```

**Why it ranks #1:** Outage urgency (+40) plus extremely high confidence (82.5 — the engines are very sure about this one). The opportunity isn't huge ($9.2K) but urgency + confidence push it to the top.

### TerraWave Comm — Score: 188

```
URGENCY:
  Outage:                  +0
  Churn (0.38 × 30):      +11.4
  Silent (12 / 3):        +4.0
  Expiring:               +0
  = 15.4

OPPORTUNITY:
  Spend ($37.6K → 37.6):  +37.6
  EV ($37.6K × 71% / 500): +50 (capped)
  = 87.6

CONFIDENCE:
  Affinity (95% × 0.35):  +33.3
  Win rate (71% × 0.35):  +24.9
  Event ((1.08-0.90)×200): +20 (capped)
  On-net:                  +10
  = 88.2

TOTAL: 15.4 + 87.6 + 88.2 = 191.2
```

**Why it ranks #2:** Massive opportunity ($37.6K spend × 71% win rate) with near-perfect confidence. Low urgency keeps it below Desert Health's outage.

### Summit Manufacturing (greenfield) — Score: 118

```
URGENCY:
  Outage:                  +0
  Churn (0%):              +0
  Silent (no history):     +0
  Expiring:               +0
  = 0

OPPORTUNITY:
  Spend ($14.2K → 14.2):  +14.2
  EV ($14.2K × 64% / 500): +18.2
  = 32.4

CONFIDENCE:
  Affinity (96% × 0.35):  +33.6
  Win rate (64% × 0.35):  +22.4
  Event ((1.04-0.90)×200): +20 (capped)
  On-net:                  +10
  = 86.0

TOTAL: 0 + 32.4 + 86.0 = 118.4
```

**Why it still ranks well despite zero pipeline:** The engines are extremely confident (86/100) — 96% location affinity, 64% predicted win rate, on-net. It has zero urgency, so it won't outrank crisis accounts, but it's a better use of time than a random cold call.

### Broadleaf Energy (save play) — Score: 102

```
URGENCY:
  Outage:                  +0
  Churn (0.79 × 30):      +23.7
  Silent (24 / 3):        +8.0
  Expiring:               +10 (MTM = effectively always expiring)
  = 41.7

OPPORTUNITY:
  Spend ($7.8K → 7.8):    +7.8
  EV ($7.8K × 58% / 500): +9.0
  = 16.8

CONFIDENCE:
  Affinity (94% × 0.35):  +32.9
  Win rate (58% × 0.35):  +20.3
  Event ((0.96-0.90)×200): +12.0
  On-net:                  +10
  = 75.2

TOTAL: 41.7 + 16.8 + 75.2 = 133.7
```

**Why it ranks mid-pack despite high churn risk:** High urgency (41.7 — churn probability driving it) but small opportunity ($7.8K) and moderate confidence. The headwind actually hurts the event score. This is a save play, not a growth play.

---

## Implementation

### Python (backend)

```python
def compute_premier_score(account, engines):
    """
    Compute the 3-component Premier Score from engine outputs.
    Returns: { total, urgency, opportunity, confidence, breakdown }
    """
    # Urgency
    outage_pts = 40 if engines.get('outage', {}).get('active') else 0
    churn_pts = min(30, account.get('churn_probability', 0) * 30)
    silent_pts = min(20, (account.get('days_since_last_activity', 0) or 0) / 3)
    expiry_pts = 10 if account.get('expiring_no_renewal') else 0
    urgency = outage_pts + churn_pts + silent_pts + expiry_pts

    # Opportunity
    spend = account.get('addressable_spend', 0)
    win_rate = engines.get('prediction', {}).get('win_rate', 50) / 100
    spend_pts = min(50, spend / 1000)
    ev_pts = min(50, (spend * win_rate) / 500)
    opportunity = spend_pts + ev_pts

    # Confidence
    affinity = engines.get('location', {}).get('max_affinity', 50) / 100
    affinity_pts = affinity * 35
    win_pts = win_rate * 35
    modifier = engines.get('event', {}).get('modifier', 1.0)
    event_pts = min(20, max(0, (modifier - 0.90) * 200))
    onnet_pts = 10 if engines.get('location', {}).get('on_net') else 0
    confidence = affinity_pts + win_pts + event_pts + onnet_pts

    total = round(urgency + opportunity + confidence)

    return {
        'total': total,
        'urgency': round(urgency, 1),
        'opportunity': round(opportunity, 1),
        'confidence': round(confidence, 1),
        'breakdown': {
            'outage': outage_pts,
            'churn': round(churn_pts, 1),
            'silent': round(silent_pts, 1),
            'expiring': expiry_pts,
            'spend': round(spend_pts, 1),
            'expected_value': round(ev_pts, 1),
            'affinity': round(affinity_pts, 1),
            'win_rate': round(win_pts, 1),
            'event': round(event_pts, 1),
            'on_net': onnet_pts,
        }
    }
```

### JavaScript (frontend)

```javascript
function premierScore(account, engines) {
  const outage = engines.outage?.active ? 40 : 0;
  const churn = Math.min(30, (account.churn_probability || 0) * 30);
  const silent = Math.min(20, (account.days_since_last_activity || 0) / 3);
  const expiry = account.expiring_no_renewal ? 10 : 0;
  const urgency = outage + churn + silent + expiry;

  const spend = account.addressable_spend || 0;
  const winRate = (engines.prediction?.win_rate || 50) / 100;
  const spendPts = Math.min(50, spend / 1000);
  const evPts = Math.min(50, (spend * winRate) / 500);
  const opportunity = spendPts + evPts;

  const affinity = (engines.location?.max_affinity || 50) / 100;
  const affinityPts = affinity * 35;
  const winPts = winRate * 35;
  const mod = engines.event?.modifier || 1.0;
  const eventPts = Math.min(20, Math.max(0, (mod - 0.90) * 200));
  const onNetPts = engines.location?.on_net ? 10 : 0;
  const confidence = affinityPts + winPts + eventPts + onNetPts;

  return {
    total: Math.round(urgency + opportunity + confidence),
    urgency: Math.round(urgency * 10) / 10,
    opportunity: Math.round(opportunity * 10) / 10,
    confidence: Math.round(confidence * 10) / 10,
  };
}
```

---

## How It's Different From the Old Scoring

| Old (Today's Targets) | New (Premier Score) |
|------------------------|---------------------|
| Fixed point buckets (+100, +40, +25...) | Continuous scoring from engine outputs |
| Outage dominates everything | Outage is 40/300 — high but not absolute |
| Whitespace capped at 30 pts | Spend + Expected Value can reach 100 |
| No engine confidence | Location affinity + win rate = 70 pts |
| No churn integration | Churn probability scales 0–30 |
| Binary tags (tailwind yes/no) | Continuous modifier scoring |
| Max ~225 | Max 300, better distribution |
| Ranks urgency | Ranks value × urgency × confidence |

---

## Display

In the account card collapsed row, the score box shows the total. On hover, the tooltip breaks it down:

```
Premier Score: 191
─────────────────
Urgency:      15  (churn 11, silent 4)
Opportunity:  88  (spend 38, EV 50)
Confidence:   88  (affinity 33, win 25, event 20, on-net 10)
```

In the summary strip, "Priority Score" is now "Premier Score" with a brief subtitle: "0–300 · urgency × opportunity × confidence"

---

## Calibration

The weights (40 for outage, 35/35 affinity/win, etc.) should be tuned over time:
- Track which scored accounts actually converted
- Measure if high-scored greenfield accounts convert at the predicted rate
- Compare rep activity against score rank — are they working the highest-scored accounts?
- A/B test: reps using Premier Score ranking vs. reps using their own judgment

The initial weights are based on sales leader input and engine validation results. They should be treated as v1 and adjusted quarterly.
