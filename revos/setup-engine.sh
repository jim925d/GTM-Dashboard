#!/bin/bash
echo "Setting up RevOS Prediction Engine..."
cd "$(dirname "$0")/revos-engine"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
echo ""
echo "Generating demo data (3,000 synthetic deals)..."
python demo.py
echo ""
echo "Setup complete."
echo "Start engine: cd revos-engine && source .venv/bin/activate && uvicorn engine.api:app --reload --port 8001"
