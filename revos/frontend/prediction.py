"""
RevOS Prediction Engine
Bayesian win probability + survival analysis close date prediction.
Learns from historical deal patterns and scores active deals in real time.
"""

import pandas as pd
import numpy as np
from scipy import stats as sp_stats
from datetime import datetime, timedelta
from typing import Optional
from dataclasses import dataclass, field, asdict
import logging
import json

logger = logging.getLogger(__name__)

STAGE_ORDER = ["Discover", "Propose", "Negotiate", "Verbal Agreement"]


@dataclass
class DealPrediction:
    """Prediction output for a single deal."""
    deal_id: str
    win_probability: float
    win_prob_ci_low: float
    win_prob_ci_high: float
    win_prob_trend: str  # "rising", "declining", "stable"
    predicted_close_date: Optional[str]
    close_date_range_70: Optional[list[str]]
    close_date_range_90: Optional[list[str]]
    expected_deal_size: Optional[float]
    size_adjustment_ratio: Optional[float]
    risk_flags: list[str] = field(default_factory=list)
    similar_deals: dict = field(default_factory=dict)
    model_basis: dict = field(default_factory=dict)

    def to_dict(self):
        return asdict(self)


class PredictionEngine:
    """
    Self-calibrating Bayesian prediction engine.

    Core models:
    1. Stage transition matrix — historical timing per stage
    2. Win rate model — Bayesian posterior updated by deal features
    3. Close date model — survival analysis for time-to-close
    4. Size adjustment — historical quote-to-close ratio
    """

    def __init__(self, decay_lambda: float = 0.3):
        """
        Args:
            decay_lambda: Exponential decay rate for time-weighting.
                          0.3 means 3-year-old data has ~40% weight.
        """
        self.decay_lambda = decay_lambda
        self.is_trained = False

        # Learned parameters
        self.stage_stats = {}       # per-stage timing distributions
        self.win_rates = {}         # per-stage win rates
        self.product_win_rates = {} # per-product win rates
        self.rep_win_rates = {}     # per-rep win rates
        self.size_buckets = {}      # win rates by deal size
        self.size_ratios = {}       # quote-to-close amount ratios
        self.overall_win_rate = 0.5
        self.training_count = 0
        self.trained_at = None

        # Stage timing distributions (days)
        self.stage_timing_won = {}   # {stage: [days list for won deals]}
        self.stage_timing_lost = {}  # {stage: [days list for lost deals]}

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def train(self, closed_deals: pd.DataFrame,
              quotes: pd.DataFrame = None):
        """
        Train on historical closed deals (won + lost).
        Optionally include quotes for size adjustment model.
        """
        if closed_deals.empty:
            logger.warning("No closed deals to train on")
            return self

        # Time-weight recent deals more heavily
        closed_deals = self._apply_time_weights(closed_deals)

        self.training_count = len(closed_deals)
        self.trained_at = datetime.now().isoformat()

        won = closed_deals[closed_deals["status"] == "won"]
        lost = closed_deals[closed_deals["status"] == "lost"]

        self.overall_win_rate = len(won) / len(closed_deals)

        # 1. Stage-level win rates (Bayesian with Beta prior)
        self._learn_stage_win_rates(closed_deals)

        # 2. Stage timing distributions
        self._learn_stage_timing(closed_deals)

        # 3. Product-level win rates
        self._learn_segment_rates(closed_deals, "product_type",
                                  self.product_win_rates)

        # 4. Rep-level win rates
        self._learn_segment_rates(closed_deals, "rep_name",
                                  self.rep_win_rates)

        # 5. Size bucket win rates
        self._learn_segment_rates(closed_deals, "amount_bucket",
                                  self.size_buckets)

        # 6. Size adjustment model (quote vs close amount)
        if quotes is not None and not quotes.empty:
            self._learn_size_ratios(won, quotes)

        self.is_trained = True
        logger.info(
            f"Trained on {len(closed_deals)} deals "
            f"({len(won)} won, {len(lost)} lost). "
            f"Overall win rate: {self.overall_win_rate:.1%}"
        )
        return self

    def _apply_time_weights(self, df: pd.DataFrame) -> pd.DataFrame:
        """Weight recent deals more heavily via exponential decay."""
        df = df.copy()
        if "close_date" in df.columns:
            now = pd.Timestamp.now()
            years_ago = (now - df["close_date"]).dt.days / 365.25
            df["_weight"] = np.exp(-self.decay_lambda * years_ago.clip(lower=0))
        else:
            df["_weight"] = 1.0
        return df

    def _learn_stage_win_rates(self, df: pd.DataFrame):
        """Bayesian stage win rates with Beta(1,1) prior.
        Uses last_active_stage to know which stage a deal reached before closing."""
        
        # Determine which column tells us the furthest stage reached
        stage_col = "last_active_stage" if "last_active_stage" in df.columns else "stage"
        
        for idx, stage in enumerate(STAGE_ORDER):
            # A deal "reached" this stage if its last_active_stage is this stage or later
            reachable_stages = STAGE_ORDER[idx:]
            stage_deals = df[df[stage_col].isin(reachable_stages)]
            
            if stage_deals.empty:
                self.win_rates[stage] = {"alpha": 1, "beta": 1,
                                         "mean": 0.5, "count": 0}
                continue

            won = stage_deals[stage_deals["status"] == "won"]
            lost = stage_deals[stage_deals["status"] == "lost"]

            w_won = won["_weight"].sum() if "_weight" in won.columns else len(won)
            w_lost = lost["_weight"].sum() if "_weight" in lost.columns else len(lost)

            alpha = w_won + 1
            beta = w_lost + 1
            mean = alpha / (alpha + beta)

            self.win_rates[stage] = {
                "alpha": float(alpha), "beta": float(beta),
                "mean": float(mean), "count": len(stage_deals),
            }

    def _learn_stage_timing(self, df: pd.DataFrame):
        """Learn how long deals spend in pipeline (won vs lost)."""
        if "days_in_pipeline" not in df.columns:
            return

        stage_col = "last_active_stage" if "last_active_stage" in df.columns else "stage"

        for idx, stage in enumerate(STAGE_ORDER):
            # Deals that reached at least this stage
            reachable = STAGE_ORDER[idx:]
            stage_deals = df[df[stage_col].isin(reachable)]
            won = stage_deals[stage_deals["status"] == "won"]
            lost = stage_deals[stage_deals["status"] == "lost"]

            # Scale timing by position in funnel (earlier stages = less time)
            stage_fraction = (idx + 1) / len(STAGE_ORDER)

            self.stage_timing_won[stage] = {
                "median": float(won["days_in_pipeline"].median() * stage_fraction) if not won.empty else 30,
                "p75": float(won["days_in_pipeline"].quantile(0.75) * stage_fraction) if not won.empty else 50,
                "p90": float(won["days_in_pipeline"].quantile(0.90) * stage_fraction) if not won.empty else 80,
                "mean": float(won["days_in_pipeline"].mean() * stage_fraction) if not won.empty else 35,
            }
            self.stage_timing_lost[stage] = {
                "median": float(lost["days_in_pipeline"].median() * stage_fraction) if not lost.empty else 45,
                "p75": float(lost["days_in_pipeline"].quantile(0.75) * stage_fraction) if not lost.empty else 70,
                "p90": float(lost["days_in_pipeline"].quantile(0.90) * stage_fraction) if not lost.empty else 100,
                "mean": float(lost["days_in_pipeline"].mean() * stage_fraction) if not lost.empty else 55,
            }

    def _learn_segment_rates(self, df: pd.DataFrame, col: str,
                             target: dict):
        """Learn win rates per segment value."""
        if col not in df.columns:
            return
        for val in df[col].dropna().unique():
            seg = df[df[col] == val]
            won = seg[seg["status"] == "won"]
            w_won = won["_weight"].sum() if "_weight" in won.columns else len(won)
            w_total = seg["_weight"].sum() if "_weight" in seg.columns else len(seg)
            target[str(val)] = {
                "win_rate": float(w_won / w_total) if w_total > 0 else 0.5,
                "count": len(seg),
                "alpha": float(w_won + 1),
                "beta": float(w_total - w_won + 1),
            }

    def _learn_size_ratios(self, won: pd.DataFrame,
                           quotes: pd.DataFrame):
        """Learn how much deals shrink/expand from quote to close."""
        if "opportunity_id" not in won.columns or quotes.empty:
            return
        if "opportunity_id" not in quotes.columns:
            return

        merged = won.merge(
            quotes.groupby("opportunity_id")["quote_amount"]
            .max().reset_index(),
            on="opportunity_id", how="inner"
        )
        if merged.empty or "amount" not in merged.columns:
            return

        ratios = merged["amount"] / merged["quote_amount"]
        ratios = ratios.replace([np.inf, -np.inf], np.nan).dropna()

        if ratios.empty:
            return

        self.size_ratios = {
            "median": float(ratios.median()),
            "mean": float(ratios.mean()),
            "std": float(ratios.std()),
            "count": len(ratios),
        }
        logger.info(
            f"Size ratio model: deals close at "
            f"{self.size_ratios['median']:.1%} of quoted value"
        )

    # ------------------------------------------------------------------
    # Scoring
    # ------------------------------------------------------------------

    def score_deal(self, deal: pd.Series,
                   prev_prediction: dict = None) -> DealPrediction:
        """
        Score a single active deal. Returns full prediction object.

        Args:
            deal: Series with deal fields (from open deals DataFrame)
            prev_prediction: Previous prediction for trend calculation
        """
        if not self.is_trained:
            raise RuntimeError("Engine not trained. Call train() first.")

        deal_id = str(deal.get("opportunity_id", "unknown"))
        stage = deal.get("stage", "Discover")

        # --- Win Probability (Bayesian posterior) ---
        win_prob, ci_low, ci_high = self._compute_win_probability(deal)

        # --- Trend ---
        trend = "stable"
        if prev_prediction:
            prev_prob = prev_prediction.get("win_probability", win_prob)
            delta = win_prob - prev_prob
            if delta > 0.03:
                trend = "rising"
            elif delta < -0.03:
                trend = "declining"

        # --- Close Date Prediction ---
        close_date, range_70, range_90 = self._predict_close_date(deal)

        # --- Expected Deal Size ---
        expected_size, size_ratio = self._predict_deal_size(deal)

        # --- Risk Flags ---
        risk_flags = self._assess_risks(deal)

        # --- Similar Deals ---
        similar = self._find_similar_counts(deal)

        return DealPrediction(
            deal_id=deal_id,
            win_probability=round(win_prob, 3),
            win_prob_ci_low=round(ci_low, 3),
            win_prob_ci_high=round(ci_high, 3),
            win_prob_trend=trend,
            predicted_close_date=close_date,
            close_date_range_70=range_70,
            close_date_range_90=range_90,
            expected_deal_size=expected_size,
            size_adjustment_ratio=size_ratio,
            risk_flags=risk_flags,
            similar_deals=similar,
            model_basis={
                "training_deals": self.training_count,
                "trained_at": self.trained_at,
                "overall_win_rate": round(self.overall_win_rate, 3),
            }
        )

    def score_all(self, open_deals: pd.DataFrame,
                  prev_predictions: dict = None) -> list[DealPrediction]:
        """Score all active deals."""
        prev_predictions = prev_predictions or {}
        results = []
        for _, deal in open_deals.iterrows():
            deal_id = str(deal.get("opportunity_id", ""))
            prev = prev_predictions.get(deal_id)
            results.append(self.score_deal(deal, prev))
        return results

    # ------------------------------------------------------------------
    # Win probability computation
    # ------------------------------------------------------------------

    def _compute_win_probability(self, deal: pd.Series) -> tuple:
        """
        Bayesian win probability with feature-based likelihood updates.
        Returns (mean, ci_low, ci_high).
        """
        stage = deal.get("stage", "Discover")

        # Start with stage-level prior
        stage_params = self.win_rates.get(stage, {"alpha": 1, "beta": 1})
        alpha = stage_params["alpha"]
        beta = stage_params["beta"]

        # --- Feature-based likelihood adjustments ---

        # 1. Time in stage (deals that linger are less likely to close)
        days = deal.get("days_in_pipeline", 0)
        if stage in self.stage_timing_won:
            median_won = self.stage_timing_won[stage]["median"]
            if median_won > 0 and days > 0:
                time_ratio = days / median_won
                if time_ratio > 2.0:
                    # Heavily penalize stalled deals
                    beta += 2.0 * (time_ratio - 1.0)
                elif time_ratio > 1.0:
                    beta += 0.5 * (time_ratio - 1.0)
                elif time_ratio < 0.5:
                    # Moving faster than normal — slight boost
                    alpha += 0.3

        # 2. Product type adjustment
        product = str(deal.get("product_type", ""))
        if product in self.product_win_rates:
            prod_rate = self.product_win_rates[product]["win_rate"]
            # Shift prior toward product-specific rate
            prod_count = self.product_win_rates[product]["count"]
            weight = min(prod_count / 50, 1.0)  # max influence at 50 deals
            alpha += weight * (prod_rate - self.overall_win_rate) * 3
            beta -= weight * (prod_rate - self.overall_win_rate) * 3

        # 3. Rep performance adjustment
        rep = str(deal.get("rep_name", ""))
        if rep in self.rep_win_rates:
            rep_rate = self.rep_win_rates[rep]["win_rate"]
            rep_count = self.rep_win_rates[rep]["count"]
            weight = min(rep_count / 30, 1.0)
            alpha += weight * (rep_rate - self.overall_win_rate) * 2
            beta -= weight * (rep_rate - self.overall_win_rate) * 2

        # 4. Deal size adjustment
        amount_bucket = str(deal.get("amount_bucket", ""))
        if amount_bucket in self.size_buckets:
            size_rate = self.size_buckets[amount_bucket]["win_rate"]
            size_count = self.size_buckets[amount_bucket]["count"]
            weight = min(size_count / 40, 1.0)
            alpha += weight * (size_rate - self.overall_win_rate) * 2
            beta -= weight * (size_rate - self.overall_win_rate) * 2

        # 5. Activity recency
        days_inactive = deal.get("days_since_activity", 0)
        if isinstance(days_inactive, (int, float)) and days_inactive > 14:
            beta += min(days_inactive / 14, 3.0)

        # Ensure alpha and beta stay positive
        alpha = max(alpha, 0.5)
        beta = max(beta, 0.5)

        # Compute posterior
        dist = sp_stats.beta(alpha, beta)
        mean = float(dist.mean())
        ci_low = float(dist.ppf(0.15))
        ci_high = float(dist.ppf(0.85))

        return (
            np.clip(mean, 0.01, 0.99),
            np.clip(ci_low, 0.01, 0.99),
            np.clip(ci_high, 0.01, 0.99),
        )

    # ------------------------------------------------------------------
    # Close date prediction
    # ------------------------------------------------------------------

    def _predict_close_date(self, deal: pd.Series):
        """Predict close date using historical timing distributions."""
        stage = deal.get("stage", "Discover")
        days_so_far = deal.get("days_in_pipeline", 0)

        if stage not in self.stage_timing_won:
            return None, None, None

        timing = self.stage_timing_won[stage]
        # Remaining days = historical total - days already elapsed
        remaining_median = max(timing["median"] - days_so_far, 7)
        remaining_p75 = max(timing["p75"] - days_so_far, 10)
        remaining_p90 = max(timing["p90"] - days_so_far, 14)

        now = datetime.now()
        predicted = (now + timedelta(days=remaining_median)).strftime("%Y-%m-%d")

        range_70 = [
            (now + timedelta(days=max(remaining_median * 0.7, 3))).strftime("%Y-%m-%d"),
            (now + timedelta(days=remaining_p75)).strftime("%Y-%m-%d"),
        ]
        range_90 = [
            (now + timedelta(days=max(remaining_median * 0.5, 2))).strftime("%Y-%m-%d"),
            (now + timedelta(days=remaining_p90)).strftime("%Y-%m-%d"),
        ]

        return predicted, range_70, range_90

    # ------------------------------------------------------------------
    # Deal size prediction
    # ------------------------------------------------------------------

    def _predict_deal_size(self, deal: pd.Series):
        """Predict actual close amount based on historical shrinkage."""
        amount = deal.get("amount", 0)
        if not amount or amount == 0:
            return None, None

        if self.size_ratios:
            ratio = self.size_ratios["median"]
            return round(amount * ratio, 2), round(ratio, 3)

        return float(amount), 1.0

    # ------------------------------------------------------------------
    # Risk assessment
    # ------------------------------------------------------------------

    def _assess_risks(self, deal: pd.Series) -> list[str]:
        flags = []
        stage = deal.get("stage", "Discover")
        days = deal.get("days_in_pipeline", 0)
        amount = deal.get("amount", 0)

        # Stalled in stage
        if stage in self.stage_timing_won:
            median = self.stage_timing_won[stage]["median"]
            p90 = self.stage_timing_won[stage]["p90"]
            if days > p90:
                flags.append(
                    f"Deal has been in pipeline {int(days)} days "
                    f"(90th percentile for won deals: {int(p90)} days)"
                )
            elif days > median * 1.5:
                flags.append(
                    f"Deal at {int(days)} days in pipeline "
                    f"(median for won deals: {int(median)} days)"
                )

        # No recent activity
        days_inactive = deal.get("days_since_activity", None)
        if isinstance(days_inactive, (int, float)) and days_inactive > 14:
            flags.append(
                f"No activity logged in {int(days_inactive)} days"
            )

        # Large deal for rep
        rep = str(deal.get("rep_name", ""))
        if rep in self.rep_win_rates and amount:
            rep_data = self.rep_win_rates[rep]
            if rep_data["count"] > 5:
                # Check if this is significantly larger than rep's typical deal
                rep_rate = rep_data["win_rate"]
                if rep_rate < self.overall_win_rate * 0.8:
                    flags.append(
                        f"Rep has below-average win rate "
                        f"({rep_rate:.0%} vs {self.overall_win_rate:.0%} overall)"
                    )

        # Product segment underperformance
        product = str(deal.get("product_type", ""))
        if product in self.product_win_rates:
            prod_rate = self.product_win_rates[product]["win_rate"]
            if prod_rate < self.overall_win_rate * 0.7:
                flags.append(
                    f"{product} deals have low win rate "
                    f"({prod_rate:.0%} vs {self.overall_win_rate:.0%} overall)"
                )

        return flags

    def _find_similar_counts(self, deal: pd.Series) -> dict:
        """Count similar historical deals."""
        product = str(deal.get("product_type", ""))
        stage = deal.get("stage", "Discover")

        similar = {
            "by_product": self.product_win_rates.get(product, {}).get("count", 0),
            "by_stage": self.win_rates.get(stage, {}).get("count", 0),
        }

        bucket = str(deal.get("amount_bucket", ""))
        if bucket in self.size_buckets:
            similar["by_size"] = self.size_buckets[bucket]["count"]

        return similar

    # ------------------------------------------------------------------
    # Serialization
    # ------------------------------------------------------------------

    def get_model_params(self) -> dict:
        """Export model parameters for storage/inspection."""
        return {
            "trained_at": self.trained_at,
            "training_count": self.training_count,
            "overall_win_rate": self.overall_win_rate,
            "decay_lambda": self.decay_lambda,
            "stage_win_rates": self.win_rates,
            "product_win_rates": self.product_win_rates,
            "rep_win_rates": self.rep_win_rates,
            "size_buckets": self.size_buckets,
            "size_ratios": self.size_ratios,
            "stage_timing_won": self.stage_timing_won,
            "stage_timing_lost": self.stage_timing_lost,
        }

    def save_params(self, path: str):
        """Save model parameters to JSON."""
        with open(path, "w") as f:
            json.dump(self.get_model_params(), f, indent=2, default=str)

    def load_params(self, path: str):
        """Load model parameters from JSON."""
        with open(path) as f:
            params = json.load(f)
        self.trained_at = params["trained_at"]
        self.training_count = params["training_count"]
        self.overall_win_rate = params["overall_win_rate"]
        self.win_rates = params["stage_win_rates"]
        self.product_win_rates = params["product_win_rates"]
        self.rep_win_rates = params["rep_win_rates"]
        self.size_buckets = params["size_buckets"]
        self.size_ratios = params["size_ratios"]
        self.stage_timing_won = params["stage_timing_won"]
        self.stage_timing_lost = params["stage_timing_lost"]
        self.is_trained = True
