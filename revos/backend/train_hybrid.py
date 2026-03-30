#!/usr/bin/env python3
"""
Training script for the hybrid prediction model.
Loads deals from historical.csv + close_lost.csv, extracts features,
trains the calibration logistic regression, and saves the model.

Usage: python train_hybrid.py
"""

import csv
import json
import sys
import os
from pathlib import Path
from collections import defaultdict

# Ensure imports work
sys.path.insert(0, str(Path(__file__).parent))

from feature_engine import extract_all_features, parse_date
from calibration import (
    prepare_training_data,
    train_calibration_model,
    save_calibration,
    brier_score,
    auc_score,
    accuracy,
    SimpleLogisticRegression,
    SimpleScaler,
)

DATA_DIR = Path(__file__).parent.parent / "frontend" / "data"


# ═══════════════════════════════════════
# CSV LOADING (quote-aware parser)
# ═══════════════════════════════════════

def parse_csv_file(filepath):
    """Parse a CSV file with quote-aware handling."""
    try:
        with open(filepath, "r", encoding="utf-8-sig") as f:
            content = f.read()
    except UnicodeDecodeError:
        with open(filepath, "r", encoding="latin-1") as f:
            content = f.read()

    rows = []
    headers = []
    pos = 0

    def parse_row(start):
        fields = []
        cur = ""
        in_q = False
        i = start
        while i < len(content):
            ch = content[i]
            if in_q:
                if ch == '"':
                    if i + 1 < len(content) and content[i + 1] == '"':
                        cur += '"'
                        i += 2
                        continue
                    in_q = False
                else:
                    cur += ch
            else:
                if ch == '"':
                    in_q = True
                elif ch == ',':
                    fields.append(cur.strip())
                    cur = ""
                elif ch == '\n' or ch == '\r':
                    if ch == '\r' and i + 1 < len(content) and content[i + 1] == '\n':
                        i += 1
                    fields.append(cur.strip())
                    return fields, i + 1
                else:
                    cur += ch
            i += 1
        fields.append(cur.strip())
        return fields, i

    # Parse header
    header_fields, pos = parse_row(0)
    headers = header_fields

    # Parse data
    while pos < len(content):
        if content[pos] in ('\n', '\r'):
            pos += 1
            continue
        fields, pos = parse_row(pos)
        if len(fields) == 1 and not fields[0]:
            continue
        row = {}
        for i, h in enumerate(headers):
            row[h] = fields[i] if i < len(fields) else ""
        rows.append(row)

    return headers, rows


# ═══════════════════════════════════════
# DATA LOADING
# ═══════════════════════════════════════

def load_deals():
    """Load and combine historical + close_lost deals."""
    hist_path = DATA_DIR / "historical.csv"
    lost_path = DATA_DIR / "close_lost.csv"

    deals = []

    if hist_path.exists():
        print(f"Loading {hist_path}...")
        headers, rows = parse_csv_file(hist_path)

        # Find columns
        fc_col = next((h for h in headers if "forecast category" in h.lower()), None)
        mega_col = next((h for h in headers if h.lower().strip() == "mega vertical grouping"), None)
        vert_col = next((h for h in headers if h.lower().strip() == "vertical"), None)
        prod_col = next((h for h in headers if h.lower().strip() == "product group"), None)
        mrr_col = next((h for h in headers if "total mrr" in h.lower() and "currency" not in h.lower()), None)
        stage_col = next((h for h in headers if h.lower().strip() == "stage"), None)
        close_col = next((h for h in headers if h.lower().strip() == "close date"), None)
        created_col = next((h for h in headers if h.lower().strip() == "created date"), None)
        acct_col = next((h for h in headers if "customer account" in h.lower()), None)

        # Build vertical lookup
        vert_to_mega = {}
        if mega_col and vert_col:
            for r in rows:
                v = r.get(vert_col, "").strip()
                m = r.get(mega_col, "").strip()
                if v and m and v not in vert_to_mega:
                    vert_to_mega[v] = m

        # Filter to Closed only (won deals)
        for r in rows:
            fc = (r.get(fc_col, "") if fc_col else "").lower().strip()
            if fc not in ("closed", "close"):
                continue

            mega = (r.get(mega_col, "") if mega_col else "").strip()
            if not mega and vert_col:
                vert = r.get(vert_col, "").strip()
                mega = vert_to_mega.get(vert, "Unknown")

            mrr_raw = r.get(mrr_col, "0") if mrr_col else "0"
            mrr = float(str(mrr_raw).replace("$", "").replace(",", "").strip() or 0)

            deals.append({
                "customer_account": r.get(acct_col, "") if acct_col else "",
                "outcome": "won",
                "product": r.get(prod_col, "Unknown") if prod_col else "Unknown",
                "mega_vertical": mega or "Unknown",
                "stage": r.get(stage_col, "") if stage_col else "",
                "mrr": mrr,
                "close_date": r.get(close_col, "") if close_col else "",
                "created_date": r.get(created_col, "") if created_col else "",
            })

        print(f"  Won deals: {len(deals)}")

    if lost_path.exists():
        print(f"Loading {lost_path}...")
        headers, rows = parse_csv_file(lost_path)

        mega_col = next((h for h in headers if h.lower().strip() == "mega vertical grouping"), None)
        prod_col = next((h for h in headers if h.lower().strip() == "product group"), None)
        mrr_col = next((h for h in headers if "total mrr" in h.lower() and "currency" not in h.lower()), None)
        stage_col = next((h for h in headers if h.lower().strip() == "stage"), None)
        close_col = next((h for h in headers if h.lower().strip() == "close date"), None)
        created_col = next((h for h in headers if h.lower().strip() == "created date"), None)
        acct_col = next((h for h in headers if "customer account" in h.lower()), None)

        lost_count = 0
        for r in rows:
            mega = (r.get(mega_col, "") if mega_col else "").strip()
            mrr_raw = r.get(mrr_col, "0") if mrr_col else "0"
            mrr = float(str(mrr_raw).replace("$", "").replace(",", "").strip() or 0)

            deals.append({
                "customer_account": r.get(acct_col, "") if acct_col else "",
                "outcome": "lost",
                "product": r.get(prod_col, "Unknown") if prod_col else "Unknown",
                "mega_vertical": mega or "Unknown",
                "stage": r.get(stage_col, "") if stage_col else "",
                "mrr": mrr,
                "close_date": r.get(close_col, "") if close_col else "",
                "created_date": r.get(created_col, "") if created_col else "",
            })
            lost_count += 1

        print(f"  Lost deals: {lost_count}")

    print(f"Total deals: {len(deals)}")
    return deals


def load_engagements():
    """Load engagement data from engagements JSONs."""
    engagements_by_account = defaultdict(list)

    for fname in ("engagements_2026.json", "engagements.json"):
        fpath = DATA_DIR / fname
        if not fpath.exists():
            continue
        print(f"Loading {fpath}...")
        with open(fpath) as f:
            data = json.load(f)

        count = 0
        for acct_name, acct_data in data.items():
            # Events are in the "e" key if the structure is {t, tp, m, c, r, e}
            events = acct_data if isinstance(acct_data, list) else acct_data.get("e", [])
            if not isinstance(events, list):
                continue
            for ev in events:
                if not isinstance(ev, dict):
                    continue
                engagements_by_account[acct_name].append({
                    "date": ev.get("d", ""),
                    "type": ev.get("t", ""),
                    "subject": ev.get("s", ""),
                    "contact": ev.get("c", ""),
                })
                count += 1
        print(f"  Events loaded: {count}")

    print(f"Accounts with engagement data: {len(engagements_by_account)}")
    return dict(engagements_by_account)


# ═══════════════════════════════════════
# MAIN
# ═══════════════════════════════════════

def main():
    print("=" * 60)
    print("RevOS Hybrid Model Training")
    print("=" * 60)

    # Step 1: Load data
    deals = load_deals()
    engagements = load_engagements()

    if not deals:
        print("ERROR: No deals found. Check CSV files in frontend/data/")
        return

    # Step 2: Prepare training data
    print("\nExtracting features...")
    X, y, feature_names, deal_ids = prepare_training_data(
        deals, extract_all_features, engagements
    )
    wins = sum(y)
    print(f"  Deals: {len(y)} ({wins:.0f} wins, {len(y) - wins:.0f} losses)")
    print(f"  Features: {len(feature_names)}")
    print(f"  Win rate: {wins / len(y):.1%}")

    # Feature diagnostics
    print("\n  Feature ranges:")
    for j, fn in enumerate(feature_names):
        vals = [X[i][j] for i in range(len(X))]
        non_zero = sum(1 for v in vals if v != 0)
        mn = min(vals)
        mx = max(vals)
        avg = sum(vals) / len(vals)
        print(f"    {fn:40s} min={mn:>10.2f}  max={mx:>10.2f}  avg={avg:>10.2f}  non0={non_zero}")

    # Step 3: Shuffle then 80/20 split for evaluation
    import random
    indices = list(range(len(X)))
    random.seed(42)
    random.shuffle(indices)
    X = [X[i] for i in indices]
    y = [y[i] for i in indices]
    deal_ids = [deal_ids[i] for i in indices]

    split = int(len(X) * 0.8)
    X_train, X_test = X[:split], X[split:]
    y_train, y_test = y[:split], y[split:]

    print(f"\nTrain: {len(X_train)}, Test: {len(X_test)}")

    # Train on full data for the saved model, but evaluate on split
    print("Training calibration model (5-fold CV for regularization)...")
    model, scaler, report = train_calibration_model(X, y, feature_names)

    # Evaluate on held-out test set
    X_test_scaled = scaler.transform(X_test)
    test_preds = model.predict_proba(X_test_scaled)
    test_brier = brier_score(test_preds, y_test)
    test_auc = auc_score(test_preds, y_test)
    test_acc = accuracy(test_preds, y_test)

    report["test_brier"] = test_brier
    report["test_auc"] = test_auc
    report["test_accuracy"] = test_acc

    # Step 4: Save
    all_feature_names = list(feature_names)
    save_calibration(model, scaler, report, all_feature_names)

    # Step 5: Print results
    print(f"\n{'=' * 60}")
    print("Training complete!")
    print(f"  CV Brier:   {report['cv_brier']:.4f}")
    print(f"  Test Brier: {test_brier:.4f}")
    print(f"  Test AUC:   {test_auc:.4f}")
    print(f"  Test Acc:   {test_acc:.1%}")
    print(f"  Best C:     {report['best_C']}")
    print(f"\nTop 10 features by importance:")
    for name, coeff in report["top_10_features"].items():
        direction = "win+" if coeff > 0 else "loss-"
        print(f"  {name:40s} {coeff:+.4f} ({direction})")

    # Calibration table
    print(f"\nCalibration (test set):")
    buckets = defaultdict(lambda: {"n": 0, "wins": 0, "pred_sum": 0})
    for p, a in zip(test_preds, y_test):
        b = min(int(p * 10), 9)
        key = f"{b * 10}-{(b + 1) * 10}%"
        buckets[key]["n"] += 1
        buckets[key]["wins"] += a
        buckets[key]["pred_sum"] += p
    for key in sorted(buckets.keys()):
        b = buckets[key]
        actual = b["wins"] / b["n"] if b["n"] else 0
        predicted = b["pred_sum"] / b["n"] if b["n"] else 0
        print(f"  {key:8s}: n={b['n']:4d}  predicted={predicted:.1%}  actual={actual:.1%}")

    print("\nDone. Model saved to snapshots/calibration_model.json")


if __name__ == "__main__":
    main()
