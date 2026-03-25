# RevOS Prediction & Recommendation Engine

Self-calibrating Bayesian engine for B2B sales intelligence. Learns from your historical deal data and generates pricing, product, and engagement recommendations for every active deal.

## Quick Start

```bash
pip install -r requirements.txt
python demo.py                                # generates data + trains + scores
uvicorn engine.api:app --reload --port 8000   # starts the API
```

## Architecture

```
engine/
├── data_loader.py      # CSV/Excel ingestion, column normalization, feature derivation
├── prediction.py       # Bayesian win probability + survival analysis close dates
├── recommendations.py  # Pricing, product, and engagement strategy generation
├── calibration.py      # Self-grading: Brier score, drift detection, retrain triggers
├── main.py             # Orchestrator tying all modules together
├── api.py              # FastAPI server for frontend consumption
└── __init__.py
```

## What It Does

### Prediction Engine
- **Win probability**: Bayesian posterior (Beta distribution) per stage, adjusted by deal features (time in stage, product type, rep performance, deal size, activity recency)
- **Close date**: Probability distribution over future dates based on historical stage timing
- **Deal size**: Expected close amount based on historical quote-to-close ratios
- **Risk flags**: Auto-detected stalls, inactivity, rep underperformance

### Recommendation Engine
- **Pricing**: Optimal price, discount sweet spot, discount cliff, term recommendations
- **Product**: Bundle recommendations from co-occurrence analysis, attach rates, expansion paths
- **Engagement**: Urgency scoring, next action + deadline, cadence, multi-threading, rescue playbooks

### Self-Calibration
- Brier score, calibration error, AUC-ROC tracked over rolling windows
- Drift detection with configurable thresholds
- Auto-retrain when accuracy degrades
- Recommendation report card: "Deals that follow RevOS recommendations close X% more often"

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/engine/load-and-train` | Load data files + train both engines |
| GET | `/api/strategies` | Full Deal Strategy Cards for all open deals |
| GET | `/api/strategies/{deal_id}` | Single deal strategy |
| GET | `/api/predictions` | Win probabilities for all open deals |
| GET | `/api/calibration` | Model health dashboard data |
| POST | `/api/calibration/outcome` | Record a deal outcome (won/lost) |
| POST | `/api/calibration/check-retrain` | Check drift + retrain if needed |
| GET | `/api/model/params` | Inspect all model weights |

## Using With Your Data

1. Place CSV/Excel files in a `data/` directory
2. Name them so the auto-discovery can find them:
   - `opportunities.csv`, `pipeline.csv`, or `deals.csv` → opportunities table
   - `quotes.csv` or `pricing.csv` → quotes table
   - `services.csv` or `products.csv` → services table
3. Or explicitly specify files via the API:
   ```json
   POST /api/engine/load-and-train
   {"files": {"opportunities": "my_opps.csv", "quotes": "my_quotes.xlsx"}}
   ```

The engine handles column name variants from Salesforce, HubSpot, and custom exports automatically.

## Key Design Decisions

- **Bayesian over pure ML**: With 2-10K deals, Bayesian models avoid overfitting and provide natural uncertainty (confidence intervals)
- **Exponential decay**: Recent deals weighted 3x vs 3+ year old data (configurable via `decay_lambda`)
- **Calibration over accuracy**: Optimizes for reliable probabilities, not just correct/incorrect
- **Transparency**: Every prediction includes its basis (n similar deals, feature contributions)
