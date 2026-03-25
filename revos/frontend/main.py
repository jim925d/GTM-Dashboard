"""
RevOS Engine Orchestrator
Ties together data loading, prediction, recommendations, and calibration.
Single entry point for training, scoring, and serving.
"""

import json
import logging
from pathlib import Path
from datetime import datetime
from typing import Optional

from .data_loader import DataLoader
from .prediction import PredictionEngine
from .recommendations import RecommendationEngine
from .calibration import CalibrationEngine

logger = logging.getLogger(__name__)


class RevOSEngine:
    """
    Main orchestrator for the RevOS Prediction & Recommendation Engine.

    Usage:
        engine = RevOSEngine(data_dir="data")
        engine.load_data({"opportunities": "opps.csv", "quotes": "quotes.csv"})
        engine.train()
        results = engine.score_all_deals()
        strategy = engine.get_deal_strategy("OPP-4821")
    """

    def __init__(self, data_dir: str = "data",
                 model_dir: str = "models",
                 decay_lambda: float = 0.3):
        self.data_dir = data_dir
        self.model_dir = Path(model_dir)
        self.model_dir.mkdir(parents=True, exist_ok=True)

        self.loader = DataLoader(data_dir=data_dir)
        self.predictor = PredictionEngine(decay_lambda=decay_lambda)
        self.recommender = RecommendationEngine()
        self.calibrator = CalibrationEngine()

        # Cached predictions
        self._predictions: dict[str, dict] = {}
        self._strategies: dict[str, dict] = {}

    # ------------------------------------------------------------------
    # Data loading
    # ------------------------------------------------------------------

    def load_data(self, files: dict[str, str] = None):
        """
        Load data files. Pass a dict mapping table names to file paths,
        or leave None to auto-discover CSVs in data_dir.
        """
        self.loader.load_all(files)
        summary = self.loader.summary()
        logger.info(f"Data loaded: {json.dumps(summary, indent=2, default=str)}")
        return summary

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def train(self, save: bool = True):
        """
        Train both prediction and recommendation engines on historical data.
        """
        closed = self.loader.get_closed_deals()
        if closed.empty:
            raise ValueError(
                "No closed deals found. Check that your data includes "
                "won/lost deals with status or stage indicators."
            )

        quotes = self.loader.quotes
        services = self.loader.services

        # Train prediction engine
        logger.info(f"Training prediction engine on {len(closed)} closed deals...")
        self.predictor.train(closed, quotes)

        # Train recommendation engine
        logger.info("Training recommendation engine...")
        self.recommender.train(closed, quotes, services)

        # Establish calibration baseline
        logger.info("Establishing calibration baseline...")
        self._establish_baseline(closed)

        if save:
            self._save_models()

        return self.get_training_summary()

    def _establish_baseline(self, closed):
        """Score historical deals and compute baseline metrics."""
        # Use most recent 20% of closed deals as a validation set
        if "close_date" in closed.columns:
            closed_sorted = closed.sort_values("close_date")
        else:
            closed_sorted = closed
        split = int(len(closed_sorted) * 0.8)
        validation = closed_sorted.iloc[split:]

        if validation.empty:
            return

        # Score validation deals (pretend they're open)
        for _, deal in validation.iterrows():
            pred = self.predictor.score_deal(deal)
            outcome = 1.0 if deal.get("status") == "won" else 0.0
            self.calibrator.prediction_log.append({
                "deal_id": pred.deal_id,
                "predicted_at": datetime.now().isoformat(),
                "win_probability": pred.win_probability,
                "predicted_close_date": pred.predicted_close_date,
                "actual_outcome": outcome,
                "actual_close_date": (
                    str(deal["close_date"].date())
                    if "close_date" in deal and hasattr(deal.get("close_date"), "date")
                    else None
                ),
            })

        baseline = self.calibrator.compute_metrics(window_days=9999)
        self.calibrator.baseline = baseline
        logger.info(
            f"Baseline established: Brier={baseline.brier_score:.4f}, "
            f"CalErr={baseline.calibration_error:.4f}, "
            f"AUC={baseline.auc_roc:.3f} "
            f"(n={baseline.sample_size})"
        )

    # ------------------------------------------------------------------
    # Scoring
    # ------------------------------------------------------------------

    def score_all_deals(self) -> list[dict]:
        """Score all active/open deals. Returns list of prediction dicts."""
        open_deals = self.loader.get_open_deals()
        if open_deals.empty:
            logger.warning("No open deals to score")
            return []

        predictions = self.predictor.score_all(
            open_deals, self._predictions
        )

        # Cache predictions
        results = []
        for pred in predictions:
            d = pred.to_dict()
            self._predictions[pred.deal_id] = d
            results.append(d)

        # Snapshot for calibration tracking
        self.calibrator.snapshot_predictions(results)

        logger.info(f"Scored {len(results)} open deals")
        return results

    def score_deal(self, deal_id: str) -> Optional[dict]:
        """Score a single deal by ID."""
        open_deals = self.loader.get_open_deals()
        deal = open_deals[
            open_deals["opportunity_id"].astype(str) == str(deal_id)
        ]
        if deal.empty:
            return None

        pred = self.predictor.score_deal(
            deal.iloc[0],
            self._predictions.get(deal_id)
        )
        result = pred.to_dict()
        self._predictions[deal_id] = result
        return result

    # ------------------------------------------------------------------
    # Strategy (combined prediction + recommendations)
    # ------------------------------------------------------------------

    def get_deal_strategy(self, deal_id: str) -> Optional[dict]:
        """
        Get the full Deal Strategy Card for a deal:
        prediction + pricing + product + engagement recommendations.
        """
        open_deals = self.loader.get_open_deals()
        deal = open_deals[
            open_deals["opportunity_id"].astype(str) == str(deal_id)
        ]
        if deal.empty:
            return None

        deal_row = deal.iloc[0]

        # Prediction
        pred = self.predictor.score_deal(
            deal_row, self._predictions.get(deal_id)
        )

        # Recommendations
        strategy = self.recommender.recommend(
            deal_row, win_probability=pred.win_probability
        )

        result = {
            "deal_id": deal_id,
            "deal_name": deal_row.get("opportunity_name", ""),
            "account_name": deal_row.get("account_name", ""),
            "stage": deal_row.get("stage", ""),
            "amount": float(deal_row.get("amount", 0) or 0),
            "product_type": str(deal_row.get("product_type", "")),
            "rep_name": str(deal_row.get("rep_name", "")),
            "prediction": pred.to_dict(),
            "strategy": strategy.to_dict(),
        }

        self._strategies[deal_id] = result
        return result

    def get_all_strategies(self) -> list[dict]:
        """Get strategies for all open deals."""
        open_deals = self.loader.get_open_deals()
        results = []
        for _, deal in open_deals.iterrows():
            deal_id = str(deal.get("opportunity_id", ""))
            strategy = self.get_deal_strategy(deal_id)
            if strategy:
                results.append(strategy)
        return results

    # ------------------------------------------------------------------
    # Calibration
    # ------------------------------------------------------------------

    def get_calibration_report(self) -> dict:
        """Full calibration dashboard data."""
        metrics_30 = self.calibrator.compute_metrics(30)
        metrics_60 = self.calibrator.compute_metrics(60)
        metrics_90 = self.calibrator.compute_metrics(90)
        curve = self.calibrator.calibration_curve(90)
        alerts = self.calibrator.check_drift(metrics_90)

        return {
            "metrics": {
                "30d": metrics_30.to_dict(),
                "60d": metrics_60.to_dict(),
                "90d": metrics_90.to_dict(),
            },
            "calibration_curve": [
                {"predicted": b.predicted_mean,
                 "actual": b.actual_win_rate,
                 "count": b.count}
                for b in curve
            ],
            "drift_alerts": [
                {"severity": a.severity, "segment": a.segment,
                 "message": a.message, "detected_at": a.detected_at}
                for a in alerts
            ],
            "retrain_log": self.calibrator.retrain_log,
            "recommendation_report_card": (
                self.calibrator.recommendation_report_card()
            ),
            "baseline": (
                self.calibrator.baseline.to_dict()
                if self.calibrator.baseline else None
            ),
        }

    def check_and_retrain(self) -> dict:
        """
        Check if retraining is needed and do it if so.
        Returns summary of what happened.
        """
        metrics = self.calibrator.compute_metrics(90)
        needs_retrain = self.calibrator.should_retrain(metrics)

        if not needs_retrain:
            return {
                "retrained": False,
                "reason": "Model within thresholds",
                "current_brier": metrics.brier_score,
            }

        # Record pre-retrain metrics
        brier_before = metrics.brier_score

        # Retrain
        self.train(save=True)

        # Record post-retrain metrics
        metrics_after = self.calibrator.compute_metrics(90)
        brier_after = metrics_after.brier_score

        # Determine trigger reason
        alerts = self.calibrator.drift_alerts
        trigger = (
            alerts[0].message if alerts
            else f"Brier score {brier_before:.4f} exceeded threshold"
        )

        closed = self.loader.get_closed_deals()
        self.calibrator.log_retrain(
            trigger=trigger,
            deals_added=len(closed),
            brier_before=brier_before,
            brier_after=brier_after,
        )

        return {
            "retrained": True,
            "trigger": trigger,
            "brier_before": brier_before,
            "brier_after": brier_after,
            "improvement": round(brier_before - brier_after, 4),
        }

    # ------------------------------------------------------------------
    # Summary / inspection
    # ------------------------------------------------------------------

    def get_training_summary(self) -> dict:
        """Get a summary of the trained model."""
        return {
            "prediction_engine": {
                "trained_at": self.predictor.trained_at,
                "training_count": self.predictor.training_count,
                "overall_win_rate": round(self.predictor.overall_win_rate, 3),
                "stages": list(self.predictor.win_rates.keys()),
                "products": list(self.predictor.product_win_rates.keys()),
                "reps": list(self.predictor.rep_win_rates.keys()),
                "size_buckets": list(self.predictor.size_buckets.keys()),
                "size_ratio": self.predictor.size_ratios,
            },
            "recommendation_engine": {
                "pricing_segments": len(self.recommender.pricing_patterns),
                "product_segments": len(self.recommender.product_attach),
                "has_discount_curves": bool(self.recommender.discount_curves),
                "has_term_analysis": bool(self.recommender.term_analysis),
                "has_expansion_data": bool(self.recommender.product_expansion),
            },
            "calibration": {
                "baseline": (
                    self.calibrator.baseline.to_dict()
                    if self.calibrator.baseline else None
                ),
                "prediction_log_size": len(self.calibrator.prediction_log),
            },
        }

    def get_model_params(self) -> dict:
        """Export all model parameters for inspection."""
        return {
            "prediction": self.predictor.get_model_params(),
            "recommendation": self.recommender.get_params(),
        }

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def _save_models(self):
        self.predictor.save_params(str(self.model_dir / "prediction_model.json"))
        self.calibrator.save_state(str(self.model_dir / "calibration_state.json"))

        with open(self.model_dir / "recommendation_params.json", "w") as f:
            json.dump(self.recommender.get_params(), f, indent=2, default=str)

        logger.info(f"Models saved to {self.model_dir}")

    def load_models(self):
        """Load previously saved models."""
        pred_path = self.model_dir / "prediction_model.json"
        cal_path = self.model_dir / "calibration_state.json"

        if pred_path.exists():
            self.predictor.load_params(str(pred_path))
            logger.info("Prediction model loaded")

        if cal_path.exists():
            self.calibrator.load_state(str(cal_path))
            logger.info("Calibration state loaded")
