# RevOS — AI Sales Intelligence Platform

Multi-model AI orchestration platform for B2B sales. Uses Bayesian analysis to predict what and when customers will buy, and game theory to optimize deal negotiation.

## Quick Start

### Frontend (Demo Mode — no backend required)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — demo data loads automatically with 2 telecom accounts.

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your ANTHROPIC_API_KEY
python main.py
```

Backend runs on http://localhost:8000. Frontend proxies `/api` requests to backend automatically.

## Architecture

- **Frontend**: React + Vite + Tailwind + Recharts + Leaflet
- **Backend**: FastAPI + Anthropic Claude API + SQLAlchemy
- **AI Engines**: Bayesian Prediction, Game Theory, Signal Intelligence, Backtest, Learning Curve

## AI Engines

| Engine | Purpose | Endpoint |
|--------|---------|----------|
| Bayesian | Predict WHAT/WHEN a customer buys | `POST /api/analyze/bayesian/{id}` |
| Game Theory | HOW TO WIN a specific deal | `POST /api/analyze/game-theory/{id}/{deal}` |
| Signals | Web scrub for company news | `POST /api/analyze/signals/{id}` |
| Backtest | Historical predict vs actual | `POST /api/backtest/{id}` |
| Learning | Accuracy vs data volume | `POST /api/learning-curve/{id}` |

## Data Upload

Upload CSVs via `POST /api/ingest` or `POST /api/ingest-multi`. Accepts any CRM export (Salesforce, HubSpot, Dynamics) — smart header detection maps columns automatically.

## Scripts

- `scripts/revos-anonymize.py` — Anonymize customer data from Excel exports
