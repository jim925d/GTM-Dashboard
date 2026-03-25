"""
RevOS Event Context Integration Module
========================================
Drop-in module that adds event context as a prediction factor.
Integrates with the existing Bayesian Beta distribution update pipeline
alongside stage_timing, product_type, rep_performance, deal_size, and activity_recency.

Usage in prediction.py:
    from event_context import EventContextEngine
    
    # At engine init (once):
    event_engine = EventContextEngine('revos_event_ledger.csv')
    
    # Per deal in the prediction loop:
    event_mod = event_engine.get_modifier(deal)
    alpha_updated *= event_mod
    beta_updated /= event_mod
"""

import pandas as pd
import numpy as np
from datetime import timedelta
from typing import Dict, Optional, Union

# ─── Product Mapping (Zayo-specific) ─────────────────────────
PRODUCT_ALIASES = {
    'dark fiber - metro': {'Dark Fiber - Metro'},
    'dark fiber - long haul': {'Wavelengths - Long Haul'},
    'wavelengths - long haul': {'Wavelengths - Long Haul'},
    'wavelengths - metro': {'Wavelengths - Long Haul'},
    'ip services': {'IP Services'},
    'ethernet': {'Ethernet'},
    'sd-wan': {'SD-WAN'},
    'sase': {'SD-WAN'},
    'managed wan-lan': {'SD-WAN', 'Ethernet'},
    'managed cyber security': {'DDoS Protection'},
    'ddos protection': {'DDoS Protection'},
    'zcolo': {'zColo'},
    'cloud': {'Ethernet', 'IP Services'},
    'sonet': {'Wavelengths - Long Haul'},
    'voice': {'IP Services'},
    'ftt - ethernet': {'Ethernet'},
    'live video': {'Wavelengths - Long Haul'},
    'all': {'Dark Fiber - Metro', 'Wavelengths - Long Haul', 'IP Services',
            'Ethernet', 'SD-WAN', 'DDoS Protection', 'zColo'},
}

ADJACENCY = {
    'Dark Fiber - Metro': {'Wavelengths - Long Haul', 'Ethernet'},
    'Wavelengths - Long Haul': {'Dark Fiber - Metro', 'IP Services'},
    'IP Services': {'Ethernet', 'Wavelengths - Long Haul'},
    'Ethernet': {'IP Services', 'Dark Fiber - Metro', 'SD-WAN'},
    'SD-WAN': {'Ethernet', 'DDoS Protection', 'IP Services'},
    'DDoS Protection': {'SD-WAN', 'IP Services'},
    'zColo': {'Dark Fiber - Metro', 'Ethernet'},
}

SENTIMENT_MAP = {'positive': 1.0, 'negative': -1.0, 'neutral': 0.0}


class EventContextEngine:
    """
    Computes a single event context modifier per deal for the Bayesian engine.
    
    The modifier is a float in [0.7, 1.3]:
      > 1.0 = favorable event context (boost alpha / reduce beta)
      < 1.0 = unfavorable context (reduce alpha / boost beta)
      = 1.0 = neutral (no event signal)
    
    This is intentionally one number, not 8 separate factors, to avoid
    overfitting on the relatively small lost-deal sample (103 deals).
    """

    # ─── Default weights (calibrate these with grid search) ───
    # Derived from won/lost signal analysis on 16K historical deals:
    #   - macro_sentiment: strongest signal (+0.36 delta, all products)
    #   - ma_proximity: second strongest (-0.16 delta, freezes deals)
    #   - outage_count: third (-0.31 delta, but direction surprising)
    #   - tech_shift: positive for won (+0.04 delta)
    # Calibrated on 22,867 deals (16,020 won + 6,847 lost) via grid search.
    # Validated: Brier improvement -0.0042, p < 0.0001, won 5/5 CV folds.
    DEFAULT_WEIGHTS = {
        'tech_shift_relevance':      0.18844,  # STRONGEST: tech shifts strongly favor wins
        'regulatory_tailwind_180d':  0.10232,  # Subsidies/BEAD are real tailwinds
        'ma_severity_weighted_90d':  0.03470,  # M&A direction matters
        'event_density_30d':         0.02046,  # More market activity slightly helps
        'macro_sentiment_90d':       0.01370,  # Small positive signal
        'ma_proximity_90d':         -0.02217,  # M&A proximity slightly hurts
        'outage_count_60d':         -0.04695,  # Outages hurt (counter to hypothesis)
        'competitive_pressure_90d': -0.01319,  # Adjacent disruption slightly hurts
    }

    def __init__(self, ledger_path: str, weights: Optional[Dict[str, float]] = None):
        """
        Args:
            ledger_path: Path to the event ledger CSV.
            weights: Optional override weights. If None, uses DEFAULT_WEIGHTS.
        """
        self.weights = self.DEFAULT_WEIGHTS.copy() if weights is None else weights
        self._load_events(ledger_path)

    def _load_events(self, path: str):
        if path.endswith('.xlsx'):
            self.events = pd.read_excel(path, sheet_name='Event Ledger')
        else:
            self.events = pd.read_csv(path)

        self.events['event_date'] = pd.to_datetime(self.events['event_date'])
        self.events['severity'] = pd.to_numeric(self.events['severity'], errors='coerce').fillna(1)
        self.events['duration_days'] = pd.to_numeric(self.events['duration_days'], errors='coerce').fillna(30)
        self.events['sentiment_val'] = self.events['sentiment'].str.lower().map(SENTIMENT_MAP).fillna(0.0)
        self.events['product_set'] = self.events['affected_products'].apply(self._parse_products)
        self.events = self.events.sort_values('event_date').reset_index(drop=True)

    @staticmethod
    def _parse_products(raw) -> set:
        if pd.isna(raw): return set()
        products = set()
        for token in str(raw).split(','):
            key = token.strip().lower()
            if key in PRODUCT_ALIASES:
                products |= PRODUCT_ALIASES[key]
            for canon in ADJACENCY:
                if key == canon.lower():
                    products.add(canon)
        return products

    @staticmethod
    def _product_relevance(event_products: set, deal_product: str) -> float:
        if not event_products or pd.isna(deal_product): return 0.0
        dp_key = deal_product.strip().lower()
        canonical = set()
        if dp_key in PRODUCT_ALIASES:
            canonical = PRODUCT_ALIASES[dp_key]
        else:
            for c in ADJACENCY:
                if dp_key == c.lower():
                    canonical = {c}
        if not canonical: return 0.1
        if canonical & event_products: return 1.0
        if len(event_products) >= 6: return 0.8
        for c in canonical:
            adj = ADJACENCY.get(c, set())
            if event_products & adj: return 0.5
        return 0.0

    def _events_in_window(self, center, days_before, days_after=0):
        start = center - timedelta(days=days_before)
        end = center + timedelta(days=days_after)
        return self.events[(self.events['event_date'] >= start) & 
                           (self.events['event_date'] <= end)]

    def compute_features(self, created_date, close_date, product) -> Dict[str, float]:
        """Compute all 8 features for a single deal."""
        cd = pd.to_datetime(created_date)
        ref_raw = pd.to_datetime(close_date) if close_date is not None else pd.NaT
        ref = ref_raw if pd.notna(ref_raw) else cd

        features = {}

        # 1-2: M&A proximity and severity
        w = self._events_in_window(cd, 90)
        ma = w[w['category'] == 'M&A / Consolidation']
        features['ma_proximity_90d'] = 0
        scores = []
        for _, evt in ma.iterrows():
            rel = self._product_relevance(evt['product_set'], product)
            if rel > 0.3:
                features['ma_proximity_90d'] = 1
                scores.append(evt['severity'] * evt['sentiment_val'] * rel)
        features['ma_severity_weighted_90d'] = max(scores, key=abs) if scores else 0.0

        # 3: Outage count
        w2 = self._events_in_window(ref, 60)
        outages = w2[(w2['category'] == 'Outage / Incident') & (w2['severity'] >= 3)]
        features['outage_count_60d'] = sum(
            1 for _, e in outages.iterrows() 
            if self._product_relevance(e['product_set'], product) > 0
        )

        # 4: Regulatory tailwind
        w3 = self._events_in_window(cd, 180)
        reg = w3[(w3['category'] == 'Regulatory / Policy') & (w3['sentiment_val'] > 0)]
        score = sum(
            e['severity'] * min(e['duration_days'] / 365, 1.0) * 
            self._product_relevance(e['product_set'], product)
            for _, e in reg.iterrows()
        )
        features['regulatory_tailwind_180d'] = min(score / 15.0, 1.0)

        # 5: Tech shift relevance
        w4 = self._events_in_window(cd, 180, 180)
        tech = w4[w4['category'] == 'Technology Shift']
        score = sum(
            e['severity'] * self._product_relevance(e['product_set'], product) / 5.0
            for _, e in tech.iterrows()
        )
        features['tech_shift_relevance'] = min(score / 3.0, 1.0)

        # 6: Macro sentiment
        w5 = self._events_in_window(cd, 90, 90)
        macro = w5[w5['category'] == 'Macro / Economic']
        if not macro.empty:
            ws = (macro['severity'] * macro['sentiment_val']).sum()
            wt = macro['severity'].sum()
            features['macro_sentiment_90d'] = ws / wt if wt > 0 else 0.0
        else:
            features['macro_sentiment_90d'] = 0.0

        # 7: Event density
        w6 = self._events_in_window(ref, 30, 30)
        features['event_density_30d'] = int((w6['severity'] >= 2).sum())

        # 8: Competitive pressure
        w7 = self._events_in_window(cd, 90)
        rel_evts = w7[w7['category'].isin(['Technology Shift', 'M&A / Consolidation'])]
        adj_count = sum(
            1 for _, e in rel_evts.iterrows()
            if 0.3 < self._product_relevance(e['product_set'], product) < 1.0
        )
        features['competitive_pressure_90d'] = min(adj_count / 5.0, 1.0)

        return features

    def get_modifier(self, deal: Union[dict, pd.Series], 
                     features: Optional[Dict[str, float]] = None) -> float:
        """
        Get the event context modifier for a deal.
        
        Args:
            deal: Dict or Series with 'created_date', 'close_date', 'product_type' keys.
                  Key names are flexible — checks common aliases.
            features: Pre-computed features dict. If None, computes on the fly.
            
        Returns:
            Float in [0.7, 1.3] — multiply into alpha, divide into beta.
        """
        if features is None:
            cd = deal.get('created_date') or deal.get('Created Date') or deal.get('created')
            cld = deal.get('close_date') or deal.get('Close Date') or deal.get('close')
            prod = deal.get('product_type') or deal.get('Product Group') or deal.get('product')
            features = self.compute_features(cd, cld, prod)

        score = sum(features.get(k, 0) * v for k, v in self.weights.items())
        return max(0.7, min(1.3, 1.0 + score))

    def get_modifier_with_detail(self, created_date, close_date, product) -> dict:
        """
        Compute modifier with full feature breakdown and top drivers.
        Used by the modeling layer to surface explanations to the frontend.

        Returns:
            { modifier: float, features: dict, drivers: list[{feature, value, contribution, direction}] }
        """
        features = self.compute_features(created_date, close_date, product)
        contributions = {k: features.get(k, 0) * self.weights[k] for k in self.weights}
        score = sum(contributions.values())
        modifier = max(0.7, min(1.3, 1.0 + score))

        drivers = sorted(contributions.items(), key=lambda x: abs(x[1]), reverse=True)
        return {
            "modifier": round(modifier, 4),
            "features": {k: round(v, 4) for k, v in features.items()},
            "drivers": [
                {"feature": k, "value": round(features[k], 4), "contribution": round(v, 4),
                 "direction": "boost" if v > 0 else "drag"}
                for k, v in drivers if abs(v) > 0.003
            ][:4],
        }

    def get_active_events(self, lookback_days: int = 90) -> list:
        """Return recent events for the Event Feed UI."""
        cutoff = pd.Timestamp.now() - timedelta(days=lookback_days)
        active = self.events[self.events['event_date'] >= cutoff].copy()
        cols = [c for c in ['event_id', 'event_date', 'category', 'subcategory', 'headline',
                            'severity', 'sentiment', 'affected_products', 'duration_days']
                if c in active.columns]
        return active[cols].to_dict(orient='records')

    def get_modifier_from_precomputed(self, feature_row: dict) -> float:
        """
        Fast path: compute modifier from pre-computed feature columns.
        Use this when features are already in the DataFrame (e.g., from batch processing).
        """
        score = sum(feature_row.get(k, 0) * v for k, v in self.weights.items())
        return max(0.7, min(1.3, 1.0 + score))

    def calibrate_weights(self, deals_df: pd.DataFrame, 
                          outcome_col: str = 'won',
                          n_iterations: int = 200) -> Dict[str, float]:
        """
        Grid search over weight space to minimize Brier score.
        
        Args:
            deals_df: DataFrame with feature columns + binary outcome column.
            outcome_col: Column name where 1=won, 0=lost.
            n_iterations: Number of random weight configurations to try.
            
        Returns:
            Best weight dict found.
        """
        feat_cols = list(self.DEFAULT_WEIGHTS.keys())
        best_brier = float('inf')
        best_weights = self.weights.copy()

        rng = np.random.RandomState(42)

        for i in range(n_iterations):
            # Random weights in plausible ranges
            trial = {}
            for k in feat_cols:
                base = self.DEFAULT_WEIGHTS[k]
                trial[k] = base + rng.uniform(-0.05, 0.05)

            # Compute modifiers with trial weights
            modifiers = []
            for _, row in deals_df.iterrows():
                score = sum(float(row.get(k, 0)) * trial[k] for k in feat_cols)
                modifiers.append(max(0.7, min(1.3, 1.0 + score)))

            # Brier score: apply modifier to base win rate, then score
            mods = np.array(modifiers)
            base_rate = deals_df[outcome_col].mean()
            probs = np.clip(mods * base_rate, 0.0, 1.0)
            outcomes = deals_df[outcome_col].values
            brier = np.mean((probs - outcomes) ** 2)

            if brier < best_brier:
                best_brier = brier
                best_weights = trial.copy()

        self.weights = best_weights
        return best_weights
