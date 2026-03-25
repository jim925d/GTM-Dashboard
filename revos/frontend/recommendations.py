"""
RevOS Recommendation Engine
Pricing, product, and engagement strategy recommendations.
Grounded in historical patterns — every recommendation cites its basis.
"""

import pandas as pd
import numpy as np
from dataclasses import dataclass, field, asdict
from typing import Optional
import logging

logger = logging.getLogger(__name__)


@dataclass
class PricingRec:
    recommended_mrr: Optional[float] = None
    recommended_tcv: Optional[float] = None
    sweet_spot_discount: float = 0.0
    max_discount: float = 0.0
    discount_floor_mrr: Optional[float] = None
    term_recommendation: str = ""
    term_alternative: str = ""
    quote_timing_insight: str = ""
    competitor_range: str = ""
    market_position: str = ""
    differentiator: str = ""
    historical_basis: dict = field(default_factory=dict)


@dataclass
class ProductBundle:
    name: str
    incremental_mrr: float = 0.0
    attach_rate: float = 0.0
    win_rate_lift: float = 0.0
    retention_factor: str = ""
    timing: str = ""
    priority: str = "medium"


@dataclass
class ProductRec:
    primary_product: str = ""
    primary_confidence: float = 0.0
    bundles: list = field(default_factory=list)
    products_to_avoid: list = field(default_factory=list)
    expansion_path: str = ""
    historical_basis: dict = field(default_factory=dict)


@dataclass
class EngagementRec:
    urgency_score: float = 0.0
    next_action: str = ""
    next_deadline: str = ""
    next_rationale: str = ""
    talk_track: str = ""
    cadence_current: str = ""
    cadence_recommended: str = ""
    cadence_impact: str = ""
    contacts_current: int = 0
    contacts_recommended: int = 0
    contacts_impact: str = ""
    roles_to_add: list = field(default_factory=list)
    is_stalled: bool = False
    momentum_window: str = ""
    rescue_play: str = ""
    competitive: dict = field(default_factory=dict)
    historical_basis: dict = field(default_factory=dict)


@dataclass
class DealStrategy:
    deal_id: str
    pricing: PricingRec = field(default_factory=PricingRec)
    product: ProductRec = field(default_factory=ProductRec)
    engagement: EngagementRec = field(default_factory=EngagementRec)

    def to_dict(self):
        return asdict(self)


class RecommendationEngine:
    """
    Generates pricing, product, and engagement recommendations
    grounded in historical deal data.
    """

    def __init__(self):
        self.is_trained = False
        # Learned patterns
        self.pricing_patterns = {}
        self.discount_curves = {}
        self.product_attach = {}
        self.product_expansion = {}
        self.engagement_patterns = {}
        self.term_analysis = {}
        self.competitive_patterns = {}

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def train(self, closed_deals: pd.DataFrame,
              quotes: pd.DataFrame = None,
              services: pd.DataFrame = None):
        """Learn recommendation patterns from historical data."""
        if closed_deals.empty:
            logger.warning("No data to train recommendation engine")
            return self

        won = closed_deals[closed_deals["status"] == "won"]
        lost = closed_deals[closed_deals["status"] == "lost"]

        self._learn_pricing_patterns(won, lost, quotes)
        self._learn_product_patterns(won, lost, services)
        self._learn_engagement_patterns(won, lost)

        self.is_trained = True
        logger.info("Recommendation engine trained")
        return self

    # ------------------------------------------------------------------
    # Pricing pattern learning
    # ------------------------------------------------------------------

    def _learn_pricing_patterns(self, won: pd.DataFrame,
                                lost: pd.DataFrame,
                                quotes: pd.DataFrame = None):
        """Learn pricing patterns by product type and deal size."""

        # Overall pricing stats from won deals
        if "amount" in won.columns:
            self.pricing_patterns["overall"] = {
                "median_amount": float(won["amount"].median()),
                "mean_amount": float(won["amount"].mean()),
                "p25_amount": float(won["amount"].quantile(0.25)),
                "p75_amount": float(won["amount"].quantile(0.75)),
                "count": len(won),
            }

        # Per product type
        if "product_type" in won.columns:
            for prod in won["product_type"].dropna().unique():
                prod_won = won[won["product_type"] == prod]
                prod_lost = lost[lost["product_type"] == prod] if "product_type" in lost.columns else pd.DataFrame()
                all_prod = pd.concat([prod_won, prod_lost])

                self.pricing_patterns[str(prod)] = {
                    "median_won": float(prod_won["amount"].median()) if not prod_won.empty else 0,
                    "mean_won": float(prod_won["amount"].mean()) if not prod_won.empty else 0,
                    "median_lost": float(prod_lost["amount"].median()) if not prod_lost.empty else 0,
                    "win_rate": len(prod_won) / len(all_prod) if len(all_prod) > 0 else 0,
                    "count": len(all_prod),
                }

        # Discount analysis from quotes
        if quotes is not None and "discount_pct" in quotes.columns:
            q = quotes[quotes["discount_pct"].notna()]
            if not q.empty:
                self.discount_curves = {
                    "median": float(q["discount_pct"].median()),
                    "mean": float(q["discount_pct"].mean()),
                    "p75": float(q["discount_pct"].quantile(0.75)),
                    "p90": float(q["discount_pct"].quantile(0.90)),
                    "max_observed": float(q["discount_pct"].max()),
                }

                # Discount cliff: group by discount bucket and measure win rates
                if "opportunity_id" in q.columns and "opportunity_id" in won.columns:
                    won_ids = set(won["opportunity_id"].dropna().astype(str))
                    q["won"] = q["opportunity_id"].astype(str).isin(won_ids)
                    q["discount_bucket"] = pd.cut(
                        q["discount_pct"],
                        bins=[0, 0.05, 0.10, 0.15, 0.20, 1.0],
                        labels=["0-5%", "5-10%", "10-15%", "15-20%", "20%+"]
                    )
                    cliff = q.groupby("discount_bucket", observed=True)["won"].mean()
                    self.discount_curves["cliff"] = cliff.to_dict()

        # Term analysis
        if quotes is not None and "term_months" in quotes.columns:
            q = quotes[quotes["term_months"].notna()]
            if not q.empty and "opportunity_id" in q.columns and "opportunity_id" in won.columns:
                won_ids = set(won["opportunity_id"].dropna().astype(str))
                q["won"] = q["opportunity_id"].astype(str).isin(won_ids)
                term_rates = q.groupby("term_months")["won"].agg(["mean", "count"])
                self.term_analysis = {
                    str(int(t)): {"win_rate": float(r["mean"]), "count": int(r["count"])}
                    for t, r in term_rates.iterrows() if r["count"] >= 5
                }

    # ------------------------------------------------------------------
    # Product pattern learning
    # ------------------------------------------------------------------

    def _learn_product_patterns(self, won: pd.DataFrame,
                                lost: pd.DataFrame,
                                services: pd.DataFrame = None):
        """Learn product attach rates, bundles, and expansion paths."""

        if "product_type" not in won.columns:
            return

        products = won["product_type"].dropna().unique()

        # Per-product win rates and counts
        all_deals = pd.concat([won, lost])
        for prod in products:
            prod_deals = all_deals[all_deals["product_type"] == prod]
            prod_won = prod_deals[prod_deals["status"] == "won"]
            self.product_attach[str(prod)] = {
                "win_rate": len(prod_won) / len(prod_deals) if len(prod_deals) > 0 else 0,
                "count": len(prod_deals),
                "median_amount": float(prod_won["amount"].median()) if not prod_won.empty else 0,
            }

        # Cross-sell / expansion analysis from services
        if services is not None and "customer_id" in services.columns and "service_type" in services.columns:
            # Count products per customer
            cust_products = services.groupby("customer_id")["service_type"].nunique()
            self.product_expansion = {
                "avg_products_per_customer": float(cust_products.mean()),
                "median_products": float(cust_products.median()),
                "pct_multi_product": float((cust_products > 1).mean()),
            }

            # Co-occurrence matrix (what products are bought together)
            cust_types = services.groupby("customer_id")["service_type"].apply(set)
            co_occur = {}
            for prods_set in cust_types:
                for p in prods_set:
                    for q in prods_set:
                        if p != q:
                            key = f"{p}→{q}"
                            co_occur[key] = co_occur.get(key, 0) + 1
            self.product_expansion["co_occurrence"] = co_occur

    # ------------------------------------------------------------------
    # Engagement pattern learning
    # ------------------------------------------------------------------

    def _learn_engagement_patterns(self, won: pd.DataFrame,
                                   lost: pd.DataFrame):
        """Learn engagement cadence and velocity patterns."""

        all_deals = pd.concat([won, lost])

        # Pipeline velocity (days)
        if "days_in_pipeline" in all_deals.columns:
            self.engagement_patterns["velocity"] = {
                "won_median": float(won["days_in_pipeline"].median()) if not won.empty else 30,
                "won_mean": float(won["days_in_pipeline"].mean()) if not won.empty else 35,
                "won_p75": float(won["days_in_pipeline"].quantile(0.75)) if not won.empty else 55,
                "lost_median": float(lost["days_in_pipeline"].median()) if not lost.empty else 50,
                "lost_mean": float(lost["days_in_pipeline"].mean()) if not lost.empty else 60,
            }

        # Activity patterns
        if "days_since_activity" in won.columns:
            self.engagement_patterns["activity"] = {
                "won_median_gap": float(won["days_since_activity"].median()) if not won.empty else 5,
                "lost_median_gap": float(lost["days_since_activity"].median()) if not lost.empty else 14,
            }

        # Multi-threading (contacts per deal)
        if "num_contacts" in all_deals.columns:
            self.engagement_patterns["threading"] = {
                "won_median_contacts": float(won["num_contacts"].median()) if "num_contacts" in won.columns and not won.empty else 3,
                "lost_median_contacts": float(lost["num_contacts"].median()) if "num_contacts" in lost.columns and not lost.empty else 1,
            }

        # Stage-specific insights
        for stage in ["Discover", "Propose", "Negotiate", "Verbal Agreement"]:
            stage_won = won[won["stage"].isin(
                ["Closed Won"]  # Won deals passed through this stage
            )]
            stage_lost = lost[lost["stage"].isin(["Closed Lost"])]

            # Per-product engagement
            if "product_type" in all_deals.columns:
                for prod in all_deals["product_type"].dropna().unique():
                    key = f"{stage}_{prod}"
                    pw = won[(won["product_type"] == prod)]
                    pl = lost[(lost["product_type"] == prod)]
                    if len(pw) + len(pl) >= 5:
                        self.engagement_patterns[key] = {
                            "win_rate": len(pw) / (len(pw) + len(pl)),
                            "count": len(pw) + len(pl),
                        }

    # ------------------------------------------------------------------
    # Strategy generation
    # ------------------------------------------------------------------

    def recommend(self, deal: pd.Series,
                  win_probability: float = None) -> DealStrategy:
        """Generate full strategy recommendation for a deal."""
        deal_id = str(deal.get("opportunity_id", "unknown"))
        strategy = DealStrategy(deal_id=deal_id)

        strategy.pricing = self._pricing_strategy(deal)
        strategy.product = self._product_strategy(deal)
        strategy.engagement = self._engagement_strategy(deal, win_probability)

        return strategy

    # ------------------------------------------------------------------
    # Pricing strategy
    # ------------------------------------------------------------------

    def _pricing_strategy(self, deal: pd.Series) -> PricingRec:
        rec = PricingRec()
        product = str(deal.get("product_type", ""))
        amount = deal.get("amount", 0) or 0

        # Base recommendation from product-specific historical wins
        if product in self.pricing_patterns:
            pp = self.pricing_patterns[product]
            rec.recommended_mrr = pp.get("median_won", amount)
            rec.historical_basis = {
                "similar_deals": pp.get("count", 0),
                "avg_won_amount": pp.get("mean_won", 0),
                "median_won_amount": pp.get("median_won", 0),
                "win_rate": pp.get("win_rate", 0),
            }
        elif "overall" in self.pricing_patterns:
            op = self.pricing_patterns["overall"]
            rec.recommended_mrr = amount or op.get("median_amount", 0)
            rec.historical_basis = {
                "similar_deals": op.get("count", 0),
                "avg_won_amount": op.get("mean_amount", 0),
            }

        # Discount recommendations
        if self.discount_curves:
            rec.sweet_spot_discount = self.discount_curves.get("median", 0.08)
            rec.max_discount = self.discount_curves.get("p90", 0.15)
            if amount > 0:
                rec.discount_floor_mrr = round(
                    amount * (1 - rec.max_discount), 2
                )

            # Discount cliff insight
            cliff = self.discount_curves.get("cliff", {})
            if cliff:
                best_bucket = max(cliff, key=cliff.get, default=None)
                if best_bucket:
                    rec.differentiator = (
                        f"Highest win rate at {best_bucket} discount "
                        f"({cliff[best_bucket]:.0%} close rate)"
                    )

        # Term recommendation
        if self.term_analysis:
            best_term = max(
                self.term_analysis.items(),
                key=lambda x: x[1]["win_rate"] if x[1]["count"] >= 10 else 0,
                default=("36", {"win_rate": 0})
            )
            rec.term_recommendation = (
                f"{best_term[0]}-month term "
                f"({best_term[1]['win_rate']:.0%} win rate, "
                f"n={best_term[1].get('count', 0)})"
            )

        # Quote timing
        days = deal.get("days_in_pipeline", 0)
        velocity = self.engagement_patterns.get("velocity", {})
        won_median = velocity.get("won_median", 30)
        if days > won_median * 1.5:
            rec.quote_timing_insight = (
                f"Deal at {int(days)} days — median won deal closes in "
                f"{int(won_median)} days. Consider resending updated proposal."
            )
        elif days < won_median * 0.5:
            rec.quote_timing_insight = (
                f"Deal moving fast ({int(days)} days vs {int(won_median)} median). "
                f"Maintain momentum — don't delay on pricing."
            )

        return rec

    # ------------------------------------------------------------------
    # Product strategy
    # ------------------------------------------------------------------

    def _product_strategy(self, deal: pd.Series) -> ProductRec:
        rec = ProductRec()
        product = str(deal.get("product_type", ""))

        if product in self.product_attach:
            pa = self.product_attach[product]
            rec.primary_product = product
            rec.primary_confidence = min(pa["win_rate"] * 1.3, 0.99)
            rec.historical_basis = {
                "similar_deals": pa["count"],
                "product_win_rate": pa["win_rate"],
                "median_amount": pa.get("median_amount", 0),
            }

        # Bundle recommendations from co-occurrence
        if hasattr(self, 'product_expansion') and "co_occurrence" in self.product_expansion:
            co = self.product_expansion["co_occurrence"]
            # Find products frequently bought with the primary product
            bundles = []
            for key, count in sorted(co.items(), key=lambda x: -x[1]):
                if key.startswith(f"{product}→"):
                    addon = key.split("→")[1]
                    if addon == product:
                        continue
                    addon_data = self.product_attach.get(addon, {})
                    total_primary = self.product_attach.get(product, {}).get("count", 1)
                    attach_rate = count / max(total_primary, 1)

                    bundles.append(ProductBundle(
                        name=addon,
                        attach_rate=round(attach_rate, 2),
                        incremental_mrr=addon_data.get("median_amount", 0),
                        win_rate_lift=round(
                            addon_data.get("win_rate", 0)
                            - self.product_attach.get(product, {}).get("win_rate", 0),
                            2
                        ),
                        priority="high" if attach_rate > 0.3 else "medium" if attach_rate > 0.15 else "later",
                        timing="Bundle now" if attach_rate > 0.3 else "Phase 2 — introduce post-close",
                    ))
                    if len(bundles) >= 3:
                        break

            rec.bundles = [asdict(b) for b in bundles]

        # Expansion path
        if self.product_expansion:
            avg_prods = self.product_expansion.get("avg_products_per_customer", 1)
            multi_pct = self.product_expansion.get("pct_multi_product", 0)
            rec.expansion_path = (
                f"Customers average {avg_prods:.1f} products. "
                f"{multi_pct:.0%} are multi-product accounts."
            )

        return rec

    # ------------------------------------------------------------------
    # Engagement strategy
    # ------------------------------------------------------------------

    def _engagement_strategy(self, deal: pd.Series,
                             win_probability: float = None) -> EngagementRec:
        rec = EngagementRec()
        stage = deal.get("stage", "Discover")
        days = deal.get("days_in_pipeline", 0)
        product = str(deal.get("product_type", ""))

        velocity = self.engagement_patterns.get("velocity", {})
        won_median = velocity.get("won_median", 30)
        won_p75 = velocity.get("won_p75", 55)

        # Stall detection
        rec.is_stalled = days > won_median * 1.5
        if rec.is_stalled:
            rec.urgency_score = min(10, 5 + (days / won_median - 1) * 3)
        elif win_probability and win_probability > 0.7:
            rec.urgency_score = 3.0
        else:
            rec.urgency_score = 5.0

        # Next action based on stage + stall status
        if rec.is_stalled:
            rec.next_action = "Executive sponsor meeting — stalled deals require senior engagement"
            rec.next_deadline = "Within 5 business days"
            rec.next_rationale = (
                f"Deal at {int(days)} days (median won: {int(won_median)}). "
                f"Deals that recover from stalls at this point require "
                f"executive engagement historically."
            )
            rec.rescue_play = (
                f"Executive outreach + competitive displacement offer. "
                f"Deals at this age that don't advance in 10 more days "
                f"drop below 30% win probability."
            )
        elif stage == "Discover":
            rec.next_action = "Schedule discovery call or demo"
            rec.next_deadline = "Within 3 business days"
            rec.next_rationale = "Speed through discovery correlates with higher close rates."
        elif stage == "Propose":
            rec.next_action = "Send proposal or follow up on outstanding proposal"
            rec.next_deadline = "Within 5 business days"
            rec.next_rationale = (
                f"Proposals older than {int(won_p75)} days have significantly lower close rates."
            )
        elif stage == "Negotiate":
            rec.next_action = "Send final terms with locked pricing"
            rec.next_deadline = "Within 3 business days"
            rec.next_rationale = "Speed in negotiation signals confidence and maintains momentum."
        elif stage == "Verbal Agreement":
            rec.next_action = "Secure signed contract"
            rec.next_deadline = "Within 7 business days"
            rec.next_rationale = "Verbal commitments decay quickly — formalize immediately."

        # Momentum window
        if win_probability and win_probability > 0.5:
            rec.momentum_window = (
                f"Strong momentum (win prob: {win_probability:.0%}). "
                f"Maintain pace — don't over-discount."
            )
        elif days > won_p75:
            rec.momentum_window = (
                f"If no movement in 10 days, win probability drops sharply "
                f"based on historical decay curve."
            )

        # Cadence recommendation
        activity = self.engagement_patterns.get("activity", {})
        won_gap = activity.get("won_median_gap", 5)
        lost_gap = activity.get("lost_median_gap", 14)
        rec.cadence_recommended = f"Every {int(max(won_gap, 2))}-{int(max(won_gap * 1.5, 3))} days"
        rec.cadence_impact = (
            f"Won deals average {int(won_gap)}-day activity gap. "
            f"Lost deals average {int(lost_gap)} days between touches."
        )

        # Multi-threading
        threading = self.engagement_patterns.get("threading", {})
        won_contacts = threading.get("won_median_contacts", 3)
        rec.contacts_recommended = int(max(won_contacts, 2))
        rec.contacts_impact = (
            f"Won deals average {won_contacts:.1f} stakeholders engaged."
        )

        # Historical basis
        rec.historical_basis = {
            "median_cycle_days_won": won_median,
            "median_cycle_days_lost": velocity.get("lost_median", 50),
            "median_activity_gap_won": won_gap,
        }

        return rec

    # ------------------------------------------------------------------
    # Serialization
    # ------------------------------------------------------------------

    def get_params(self) -> dict:
        return {
            "pricing_patterns": self.pricing_patterns,
            "discount_curves": self.discount_curves,
            "product_attach": self.product_attach,
            "product_expansion": self.product_expansion,
            "engagement_patterns": self.engagement_patterns,
            "term_analysis": self.term_analysis,
        }
