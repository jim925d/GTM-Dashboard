"""
Learned calibration layer for the hybrid prediction model.
Trains a logistic regression on the full outcome using the base prediction
plus new features from feature_engine.py.

Requires: pip install scikit-learn
"""

import json
import math
import numpy as np
from pathlib import Path
from collections import defaultdict

CALIBRATION_MODEL_PATH = Path(__file__).parent / "snapshots" / "calibration_model.json"
CALIBRATION_REPORT_PATH = Path(__file__).parent / "snapshots" / "calibration_report.json"


# ═══════════════════════════════════════
# PURE-PYTHON LOGISTIC REGRESSION
# (no sklearn dependency — works standalone)
# ═══════════════════════════════════════

def _sigmoid(x):
    x = max(-500, min(500, x))
    return 1.0 / (1.0 + math.exp(-x))


def _dot(a, b):
    return sum(ai * bi for ai, bi in zip(a, b))


class SimpleLogisticRegression:
    """Minimal L2-regularized logistic regression trained via gradient descent."""

    def __init__(self, C=1.0, max_iter=2000, lr=0.1):
        self.C = C
        self.max_iter = max_iter
        self.lr = lr
        self.weights = []
        self.bias = 0.0

    def fit(self, X, y):
        n_samples, n_features = len(X), len(X[0])
        self.weights = [0.0] * n_features
        self.bias = 0.0
        reg = 1.0 / (self.C * n_samples)

        for epoch in range(self.max_iter):
            dw = [0.0] * n_features
            db = 0.0
            for i in range(n_samples):
                pred = _sigmoid(_dot(self.weights, X[i]) + self.bias)
                err = pred - y[i]
                for j in range(n_features):
                    dw[j] += err * X[i][j]
                db += err
            for j in range(n_features):
                self.weights[j] -= self.lr * (dw[j] / n_samples + reg * self.weights[j])
            self.bias -= self.lr * db / n_samples

    def predict_proba(self, X):
        return [_sigmoid(_dot(self.weights, x) + self.bias) for x in X]

    def to_dict(self):
        return {"weights": self.weights, "bias": self.bias, "C": self.C}

    @classmethod
    def from_dict(cls, d):
        m = cls(C=d.get("C", 1.0))
        m.weights = d["weights"]
        m.bias = d["bias"]
        return m


class SimpleScaler:
    """StandardScaler — mean/std normalization."""

    def __init__(self):
        self.means = []
        self.stds = []

    def fit(self, X):
        n_features = len(X[0])
        self.means = [0.0] * n_features
        self.stds = [1.0] * n_features
        n = len(X)
        for j in range(n_features):
            vals = [X[i][j] for i in range(n)]
            m = sum(vals) / n
            self.means[j] = m
            var = sum((v - m) ** 2 for v in vals) / max(n - 1, 1)
            self.stds[j] = max(var ** 0.5, 1e-8)

    def transform(self, X):
        return [
            [(X[i][j] - self.means[j]) / self.stds[j] for j in range(len(self.means))]
            for i in range(len(X))
        ]

    def fit_transform(self, X):
        self.fit(X)
        return self.transform(X)

    def to_dict(self):
        return {"means": self.means, "stds": self.stds}

    @classmethod
    def from_dict(cls, d):
        s = cls()
        s.means = d["means"]
        s.stds = d["stds"]
        return s


# ═══════════════════════════════════════
# METRICS
# ═══════════════════════════════════════

def brier_score(preds, actuals):
    return sum((p - a) ** 2 for p, a in zip(preds, actuals)) / len(preds)


def auc_score(preds, actuals):
    pos = sum(1 for a in actuals if a == 1)
    neg = len(actuals) - pos
    if not pos or not neg:
        return 0.5
    paired = sorted(zip(preds, actuals), key=lambda x: -x[0])
    tp = fp = ptp = pfp = area = 0
    for p, a in paired:
        if a == 1:
            tp += 1
        else:
            fp += 1
        area += (fp - pfp) * (tp + ptp) / 2
        ptp, pfp = tp, fp
    return area / (pos * neg)


def accuracy(preds, actuals, threshold=0.5):
    correct = sum(1 for p, a in zip(preds, actuals) if (p >= threshold) == (a == 1))
    return correct / len(preds)


# ═══════════════════════════════════════
# TRAINING
# ═══════════════════════════════════════

def prepare_training_data(deals, feature_extractor, engagements_by_account=None):
    """
    Prepare feature matrix and targets from deals with known outcomes.

    Args:
        deals: list of deal dicts with outcome (won/lost), product, vertical, etc.
        feature_extractor: function(deal, engagements) -> dict of features
        engagements_by_account: dict mapping account_name -> list of engagement events

    Returns: X (list of lists), y (list of 0/1), feature_names (list), deal_ids (list)
    """
    if engagements_by_account is None:
        engagements_by_account = {}

    feature_rows = []
    targets = []
    deal_ids = []
    feature_names = None

    for deal in deals:
        deal_id = deal.get("opportunity_id") or deal.get("id") or deal.get("customer_account")

        outcome_raw = str(deal.get("outcome") or deal.get("stage") or "").lower()
        if any(kw in outcome_raw for kw in ("won", "closed won", "accepted", "win")):
            outcome = 1
        elif any(kw in outcome_raw for kw in ("lost", "closed lost", "loss")):
            outcome = 0
        else:
            continue

        acct = deal.get("customer_account") or deal.get("account") or ""
        engs = engagements_by_account.get(acct, [])

        features = feature_extractor(deal, engs)

        if feature_names is None:
            feature_names = sorted(features.keys())

        row = [float(features.get(fn, 0) or 0) for fn in feature_names]
        # Replace NaN/inf
        row = [0.0 if (math.isnan(v) or math.isinf(v)) else v for v in row]
        feature_rows.append(row)
        targets.append(outcome)
        deal_ids.append(deal_id)

    return feature_rows, targets, feature_names, deal_ids


def train_calibration_model(X, y, feature_names, base_predictions=None):
    """
    Train the calibration logistic regression.

    Returns: model, scaler, report dict
    """
    # Add base prediction as first feature if available
    if base_predictions is not None:
        X_full = [[bp] + row for bp, row in zip(base_predictions, X)]
        all_names = ["base_prob"] + list(feature_names)
    else:
        X_full = X
        all_names = list(feature_names)

    # Scale
    scaler = SimpleScaler()
    X_scaled = scaler.fit_transform(X_full)

    # Cross-validate to find best C
    best_c = 1.0
    best_brier = 999
    n = len(y)

    # Fast CV: use 3 folds and fewer iterations for speed
    for c in [0.1, 1.0, 10.0]:
        fold_briers = []
        fold_size = n // 3
        for fold in range(3):
            val_start = fold * fold_size
            val_end = val_start + fold_size
            X_train = X_scaled[:val_start] + X_scaled[val_end:]
            y_train = y[:val_start] + y[val_end:]
            X_val = X_scaled[val_start:val_end]
            y_val = y[val_start:val_end]

            if not X_val:
                continue
            model = SimpleLogisticRegression(C=c, max_iter=300, lr=0.2)
            model.fit(X_train, y_train)
            preds = model.predict_proba(X_val)
            fold_briers.append(brier_score(preds, y_val))

        if fold_briers:
            avg_brier = sum(fold_briers) / len(fold_briers)
            if avg_brier < best_brier:
                best_brier = avg_brier
                best_c = c

    # Train final model with best C and more iterations
    model = SimpleLogisticRegression(C=best_c, max_iter=1000, lr=0.15)
    model.fit(X_scaled, y)

    # Coefficients for explainability
    coefficients = dict(zip(all_names, model.weights))
    coefficients_sorted = dict(sorted(coefficients.items(), key=lambda x: abs(x[1]), reverse=True))

    # Training metrics
    y_pred = model.predict_proba(X_scaled)
    train_brier = brier_score(y_pred, y)
    train_auc = auc_score(y_pred, y)
    train_acc = accuracy(y_pred, y)

    report = {
        "best_C": best_c,
        "cv_brier": best_brier,
        "train_brier": train_brier,
        "train_auc": train_auc,
        "train_accuracy": train_acc,
        "n_features": len(all_names),
        "n_training_deals": len(y),
        "win_rate": sum(y) / len(y),
        "feature_names": all_names,
        "coefficients": coefficients_sorted,
        "top_10_features": dict(list(coefficients_sorted.items())[:10]),
    }

    return model, scaler, report


def save_calibration(model, scaler, report, feature_names):
    """Save model as JSON (no pickle needed)."""
    data = {
        "model": model.to_dict(),
        "scaler": scaler.to_dict(),
        "feature_names": feature_names,
        "report": report,
    }
    with open(CALIBRATION_MODEL_PATH, "w") as f:
        json.dump(data, f, indent=2)
    with open(CALIBRATION_REPORT_PATH, "w") as f:
        json.dump(report, f, indent=2)
    print(f"Calibration model saved: {CALIBRATION_MODEL_PATH}")
    return report


def load_calibration():
    """Load the trained calibration model."""
    if not CALIBRATION_MODEL_PATH.exists():
        return None, None, None
    with open(CALIBRATION_MODEL_PATH) as f:
        data = json.load(f)
    model = SimpleLogisticRegression.from_dict(data["model"])
    scaler = SimpleScaler.from_dict(data["scaler"])
    feature_names = data["feature_names"]
    return model, scaler, feature_names


def predict_calibrated(deal, engagements, base_prob, model=None, scaler=None, feature_names=None):
    """
    Make a calibrated prediction for a single deal.
    Falls back to base_prob if calibration model isn't available.
    """
    if model is None or scaler is None:
        return {
            "probability": base_prob,
            "calibrated": False,
            "features": {},
            "factor_contributions": {},
        }

    from feature_engine import extract_all_features

    features = extract_all_features(deal, engagements)

    # Build feature vector: base_prob first, then all extracted features
    non_base_names = [fn for fn in feature_names if fn != "base_prob"]
    feature_vector = [base_prob] + [float(features.get(fn, 0) or 0) for fn in non_base_names]
    feature_vector = [0.0 if (math.isnan(v) or math.isinf(v)) else v for v in feature_vector]

    X_scaled = scaler.transform([feature_vector])
    calibrated_prob = model.predict_proba(X_scaled)[0]
    calibrated_prob = max(0.01, min(0.99, calibrated_prob))

    # Factor contributions
    all_names = ["base_prob"] + non_base_names
    contributions = {}
    for i, name in enumerate(all_names):
        coeff = model.weights[i] if i < len(model.weights) else 0
        scaled_val = X_scaled[0][i] if i < len(X_scaled[0]) else 0
        contribution = coeff * scaled_val
        if abs(contribution) > 0.001:
            contributions[name] = round(contribution, 4)
    contributions = dict(sorted(contributions.items(), key=lambda x: abs(x[1]), reverse=True))

    return {
        "probability": round(calibrated_prob, 4),
        "base_probability": round(base_prob, 4),
        "adjustment": round(calibrated_prob - base_prob, 4),
        "calibrated": True,
        "features": features,
        "factor_contributions": contributions,
    }
