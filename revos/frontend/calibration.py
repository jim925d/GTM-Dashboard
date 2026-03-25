"""
RevOS Calibration Engine
Tracks prediction accuracy, detects model drift, and manages retraining.
The engine's report card — proves it works and improves over time.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from dataclasses import dataclass, field, asdict
from typing import Optional
import json
import logging

logger = logging.getLogger(__name__)


@dataclass
class CalibrationMetrics:
    """Model accuracy report card."""
    brier_score: float = 0.0          # 0=perfect, 0.25=coin flip
    calibration_error: float = 0.0     # how well probabilities match reality
    auc_roc: float = 0.0              # discrimination ability
    close_date_mae_days: float = 0.0   # mean absolute error on close date
    coverage_70: float = 0.0           # % of actuals within 70% interval
    sample_size: int = 0
    period: str = ""                   # "30d", "60d", "90d"
    computed_at: str = ""

    def to_dict(self):
        return asdict(self)


@dataclass
class DriftAlert:
    severity: str       # "info", "warning", "critical"
    segment: str        # which segment is drifting
    message: str
    detected_at: str
    metric: str         # which metric drifted
    expected: float
    actual: float


@dataclass
class CalibrationBucket:
    """Single bucket in the calibration curve."""
    predicted_low: float
    predicted_high: float
    predicted_mean: float
    actual_win_rate: float
    count: int


class CalibrationEngine:
    """
    Tracks prediction accuracy over time and detects model drift.

    Core loop:
    1. Snapshot predictions daily for all active deals
    2. When deals close, compare prediction to outcome
    3. Compute rolling accuracy metrics
    4. Detect drift and trigger retraining
    """

    def __init__(self,
                 brier_threshold: float = 0.20,
                 drift_threshold: float = 0.03,
                 calibration_threshold: float = 0.05):
        self.brier_threshold = brier_threshold
        self.drift_threshold = drift_threshold
        self.calibration_threshold = calibration_threshold

        # Prediction log: list of {deal_id, predicted_at, win_prob,
        #                           close_date_pred, actual_outcome, actual_close}
        self.prediction_log: list[dict] = []

        # Historical metrics (tracked over time)
        self.metrics_history: list[dict] = []

        # Retrain log
        self.retrain_log: list[dict] = []

        # Active drift alerts
        self.drift_alerts: list[DriftAlert] = []

        # Baseline metrics (set after first full training)
        self.baseline: Optional[CalibrationMetrics] = None

    # ------------------------------------------------------------------
    # Snapshot predictions
    # ------------------------------------------------------------------

    def snapshot_predictions(self, predictions: list[dict]):
        """
        Record today's predictions for all active deals.
        Call this daily before any deals close.
        """
        timestamp = datetime.now().isoformat()
        for pred in predictions:
            self.prediction_log.append({
                "deal_id": pred.get("deal_id"),
                "predicted_at": timestamp,
                "win_probability": pred.get("win_probability"),
                "predicted_close_date": pred.get("predicted_close_date"),
                "actual_outcome": None,   # filled when deal closes
                "actual_close_date": None,
            })

    def record_outcome(self, deal_id: str, outcome: str,
                       close_date: str = None):
        """
        Record the actual outcome when a deal closes.
        outcome: "won" or "lost"
        """
        # Find the most recent prediction for this deal
        for entry in reversed(self.prediction_log):
            if entry["deal_id"] == deal_id and entry["actual_outcome"] is None:
                entry["actual_outcome"] = 1.0 if outcome == "won" else 0.0
                entry["actual_close_date"] = close_date
                break

    def record_outcomes_from_data(self, closed_deals: pd.DataFrame):
        """
        Bulk-record outcomes from a DataFrame of recently closed deals.
        Matches by opportunity_id against the prediction log.
        """
        for _, deal in closed_deals.iterrows():
            deal_id = str(deal.get("opportunity_id", ""))
            status = deal.get("status", "")
            close_date = None
            if "close_date" in deal and pd.notna(deal["close_date"]):
                close_date = str(deal["close_date"].date()) if hasattr(
                    deal["close_date"], "date") else str(deal["close_date"])
            self.record_outcome(deal_id, status, close_date)

    # ------------------------------------------------------------------
    # Metrics computation
    # ------------------------------------------------------------------

    def compute_metrics(self, window_days: int = 90) -> CalibrationMetrics:
        """Compute accuracy metrics over a rolling window."""
        cutoff = (datetime.now() - timedelta(days=window_days)).isoformat()

        # Filter to predictions that have outcomes and are within window
        scored = [
            e for e in self.prediction_log
            if e["actual_outcome"] is not None
            and e["predicted_at"] >= cutoff
        ]

        if len(scored) < 10:
            return CalibrationMetrics(
                sample_size=len(scored),
                period=f"{window_days}d",
                computed_at=datetime.now().isoformat()
            )

        predicted = np.array([e["win_probability"] for e in scored])
        actual = np.array([e["actual_outcome"] for e in scored])

        # Brier Score: mean squared error of probabilities
        brier = float(np.mean((predicted - actual) ** 2))

        # Calibration Error: binned predicted vs actual
        cal_error = self._calibration_error(predicted, actual)

        # AUC-ROC
        auc = self._compute_auc(predicted, actual)

        # Close date MAE
        close_mae = self._close_date_mae(scored)

        # Coverage: % of actual close dates within predicted 70% interval
        coverage = self._compute_coverage(scored)

        metrics = CalibrationMetrics(
            brier_score=round(brier, 4),
            calibration_error=round(cal_error, 4),
            auc_roc=round(auc, 3),
            close_date_mae_days=round(close_mae, 1),
            coverage_70=round(coverage, 3),
            sample_size=len(scored),
            period=f"{window_days}d",
            computed_at=datetime.now().isoformat(),
        )

        self.metrics_history.append(metrics.to_dict())
        return metrics

    def _calibration_error(self, predicted: np.ndarray,
                           actual: np.ndarray) -> float:
        """Mean absolute calibration error across probability bins."""
        bins = np.linspace(0, 1, 11)  # 10 bins
        errors = []
        for i in range(len(bins) - 1):
            mask = (predicted >= bins[i]) & (predicted < bins[i + 1])
            if mask.sum() >= 3:
                bin_pred = predicted[mask].mean()
                bin_actual = actual[mask].mean()
                errors.append(abs(bin_pred - bin_actual))
        return float(np.mean(errors)) if errors else 0.0

    def _compute_auc(self, predicted: np.ndarray,
                     actual: np.ndarray) -> float:
        """Compute AUC-ROC manually (no sklearn dependency for this)."""
        if len(np.unique(actual)) < 2:
            return 0.5  # Can't compute AUC with single class

        # Sort by predicted descending
        order = np.argsort(-predicted)
        actual_sorted = actual[order]

        n_pos = actual.sum()
        n_neg = len(actual) - n_pos
        if n_pos == 0 or n_neg == 0:
            return 0.5

        tp = 0
        fp = 0
        auc = 0.0
        prev_fp = 0

        for i in range(len(actual_sorted)):
            if actual_sorted[i] == 1.0:
                tp += 1
            else:
                fp += 1
                auc += tp

        return float(auc / (n_pos * n_neg)) if (n_pos * n_neg) > 0 else 0.5

    def _close_date_mae(self, scored: list[dict]) -> float:
        """Mean absolute error on close date predictions (days)."""
        errors = []
        for e in scored:
            if e.get("predicted_close_date") and e.get("actual_close_date"):
                try:
                    pred = pd.Timestamp(e["predicted_close_date"])
                    actual = pd.Timestamp(e["actual_close_date"])
                    if pd.notna(pred) and pd.notna(actual):
                        errors.append(abs((pred - actual).days))
                except (ValueError, TypeError):
                    pass
        return float(np.mean(errors)) if errors else 0.0

    def _compute_coverage(self, scored: list[dict]) -> float:
        """% of actual close dates within predicted range."""
        # This would need the range stored in the snapshot
        # Placeholder for now — requires prediction log to include ranges
        return 0.70  # Default until range tracking is implemented

    # ------------------------------------------------------------------
    # Calibration curve
    # ------------------------------------------------------------------

    def calibration_curve(self, window_days: int = 90) -> list[CalibrationBucket]:
        """Generate calibration curve data for visualization."""
        cutoff = (datetime.now() - timedelta(days=window_days)).isoformat()
        scored = [
            e for e in self.prediction_log
            if e["actual_outcome"] is not None and e["predicted_at"] >= cutoff
        ]

        if len(scored) < 10:
            return []

        predicted = np.array([e["win_probability"] for e in scored])
        actual = np.array([e["actual_outcome"] for e in scored])

        buckets = []
        bins = np.linspace(0, 1, 11)
        for i in range(len(bins) - 1):
            mask = (predicted >= bins[i]) & (predicted < bins[i + 1])
            if mask.sum() >= 3:
                buckets.append(CalibrationBucket(
                    predicted_low=float(bins[i]),
                    predicted_high=float(bins[i + 1]),
                    predicted_mean=float(predicted[mask].mean()),
                    actual_win_rate=float(actual[mask].mean()),
                    count=int(mask.sum()),
                ))

        return buckets

    # ------------------------------------------------------------------
    # Drift detection
    # ------------------------------------------------------------------

    def check_drift(self, current: CalibrationMetrics) -> list[DriftAlert]:
        """Compare current metrics against baseline, flag drift."""
        alerts = []

        if self.baseline is None:
            self.baseline = current
            return alerts

        now = datetime.now().isoformat()

        # Brier score drift
        brier_delta = current.brier_score - self.baseline.brier_score
        if brier_delta > self.drift_threshold:
            severity = "critical" if brier_delta > 0.05 else "warning"
            alerts.append(DriftAlert(
                severity=severity,
                segment="overall",
                message=(
                    f"Brier score degraded from {self.baseline.brier_score:.3f} "
                    f"to {current.brier_score:.3f} (+{brier_delta:.3f})"
                ),
                detected_at=now,
                metric="brier_score",
                expected=self.baseline.brier_score,
                actual=current.brier_score,
            ))

        # Calibration error drift
        cal_delta = current.calibration_error - self.baseline.calibration_error
        if cal_delta > self.calibration_threshold:
            alerts.append(DriftAlert(
                severity="warning",
                segment="overall",
                message=(
                    f"Calibration error increased from "
                    f"{self.baseline.calibration_error:.3f} to "
                    f"{current.calibration_error:.3f}"
                ),
                detected_at=now,
                metric="calibration_error",
                expected=self.baseline.calibration_error,
                actual=current.calibration_error,
            ))

        # AUC drop
        auc_delta = self.baseline.auc_roc - current.auc_roc
        if auc_delta > 0.05:
            alerts.append(DriftAlert(
                severity="warning",
                segment="overall",
                message=(
                    f"AUC-ROC dropped from {self.baseline.auc_roc:.3f} "
                    f"to {current.auc_roc:.3f}"
                ),
                detected_at=now,
                metric="auc_roc",
                expected=self.baseline.auc_roc,
                actual=current.auc_roc,
            ))

        self.drift_alerts = alerts
        return alerts

    def should_retrain(self, metrics: CalibrationMetrics) -> bool:
        """Determine if the model should be retrained based on metrics."""
        if metrics.brier_score > self.brier_threshold:
            return True
        if metrics.calibration_error > self.calibration_threshold * 2:
            return True
        if metrics.auc_roc < 0.65:
            return True

        alerts = self.check_drift(metrics)
        if any(a.severity == "critical" for a in alerts):
            return True

        return False

    def log_retrain(self, trigger: str, deals_added: int,
                    brier_before: float, brier_after: float):
        """Record a retraining event."""
        self.retrain_log.append({
            "date": datetime.now().isoformat(),
            "trigger": trigger,
            "deals_added": deals_added,
            "brier_before": round(brier_before, 4),
            "brier_after": round(brier_after, 4),
            "improvement": round(brier_before - brier_after, 4),
            "status": "complete",
        })
        logger.info(
            f"Retrain logged: {trigger}, "
            f"Brier {brier_before:.4f} → {brier_after:.4f}"
        )

    # ------------------------------------------------------------------
    # Segment-level calibration
    # ------------------------------------------------------------------

    def segment_metrics(self, segment_col: str,
                        deals: pd.DataFrame,
                        predictions: list[dict]) -> dict:
        """Compute per-segment accuracy (product type, rep, etc.)."""
        # Build lookup of predictions by deal_id
        pred_map = {p["deal_id"]: p for p in predictions
                    if p.get("actual_outcome") is not None}

        segments = {}
        for val in deals[segment_col].dropna().unique():
            seg_deals = deals[deals[segment_col] == val]
            seg_preds = []
            seg_actuals = []

            for _, deal in seg_deals.iterrows():
                did = str(deal.get("opportunity_id", ""))
                if did in pred_map:
                    seg_preds.append(pred_map[did]["win_probability"])
                    seg_actuals.append(pred_map[did]["actual_outcome"])

            if len(seg_preds) >= 5:
                p = np.array(seg_preds)
                a = np.array(seg_actuals)
                brier = float(np.mean((p - a) ** 2))
                segments[str(val)] = {
                    "brier_score": round(brier, 4),
                    "count": len(seg_preds),
                    "win_rate": round(float(a.mean()), 3),
                    "avg_predicted": round(float(p.mean()), 3),
                    "trend": (
                        "overconfident" if p.mean() > a.mean() + 0.05
                        else "underconfident" if p.mean() < a.mean() - 0.05
                        else "calibrated"
                    ),
                }

        return segments

    # ------------------------------------------------------------------
    # Recommendation tracking
    # ------------------------------------------------------------------

    def track_recommendation(self, deal_id: str, domain: str,
                             followed: bool, outcome: str = None):
        """
        Track whether a recommendation was followed and its outcome.
        domain: "pricing", "product", "engagement"
        """
        # This would be stored in a database in production
        # Here we maintain an in-memory list
        if not hasattr(self, "rec_tracking"):
            self.rec_tracking = []
        self.rec_tracking.append({
            "deal_id": deal_id,
            "domain": domain,
            "followed": followed,
            "outcome": outcome,
            "recorded_at": datetime.now().isoformat(),
        })

    def recommendation_report_card(self) -> dict:
        """
        Compute win rate lift from following recommendations.
        The ultimate proof: "Deals that follow RevOS recs win X% more."
        """
        if not hasattr(self, "rec_tracking") or not self.rec_tracking:
            return {}

        df = pd.DataFrame(self.rec_tracking)
        if "outcome" not in df.columns or df["outcome"].isna().all():
            return {}

        df["won"] = df["outcome"] == "won"
        report = {}

        for domain in ["pricing", "product", "engagement"]:
            domain_df = df[df["domain"] == domain]
            if len(domain_df) < 5:
                continue

            followed = domain_df[domain_df["followed"]]
            ignored = domain_df[~domain_df["followed"]]

            report[domain] = {
                "total_recs": len(domain_df),
                "followed_count": len(followed),
                "followed_pct": round(len(followed) / len(domain_df), 2),
                "win_rate_followed": round(
                    float(followed["won"].mean()), 3
                ) if len(followed) > 0 else None,
                "win_rate_ignored": round(
                    float(ignored["won"].mean()), 3
                ) if len(ignored) > 0 else None,
            }
            if report[domain]["win_rate_followed"] is not None and report[domain]["win_rate_ignored"] is not None:
                report[domain]["lift"] = round(
                    report[domain]["win_rate_followed"]
                    - report[domain]["win_rate_ignored"], 3
                )

        return report

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def save_state(self, path: str):
        """Save calibration state to JSON."""
        state = {
            "prediction_log": self.prediction_log[-10000:],  # keep last 10K
            "metrics_history": self.metrics_history,
            "retrain_log": self.retrain_log,
            "baseline": self.baseline.to_dict() if self.baseline else None,
        }
        with open(path, "w") as f:
            json.dump(state, f, indent=2, default=str)

    def load_state(self, path: str):
        """Load calibration state from JSON."""
        with open(path) as f:
            state = json.load(f)
        self.prediction_log = state.get("prediction_log", [])
        self.metrics_history = state.get("metrics_history", [])
        self.retrain_log = state.get("retrain_log", [])
        if state.get("baseline"):
            self.baseline = CalibrationMetrics(**state["baseline"])
