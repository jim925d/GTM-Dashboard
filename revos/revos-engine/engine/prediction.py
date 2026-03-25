"""
Prediction engine — logistic regression + feature engineering.
No LLM calls. Pure Python math.
"""
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import cross_val_score
from datetime import datetime


STAGE_ORDER = {
    'discover': 0,
    'design_solution': 1,
    'propose': 2,
    'negotiate': 3,
    'verbal_agreement': 4,
    'closed_won': 5,
    'closed_lost': -1,
}

STAGE_BASE_PROB = {
    'discover': 0.306,
    'design_solution': 0.532,
    'propose': 0.662,
    'negotiate': 0.847,
    'verbal_agreement': 0.925,
}


class PredictionEngine:
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.feature_names = []
        self.is_trained = False
        self.training_date = None
        self.training_deals = 0
        self.product_win_rates = {}
        self.rep_win_rates = {}
        self.cv_scores = None

    def _engineer_features(self, df):
        """Build feature matrix from deal data."""
        features = pd.DataFrame(index=df.index)

        # Stage ordinal
        features['stage_ord'] = df['stage_normalized'].map(STAGE_ORDER).fillna(-1)

        # MRR (log-scaled)
        features['log_mrr'] = np.log1p(df['mrr'].clip(lower=0))

        # Days in pipeline
        if 'created_date' in df.columns:
            now = pd.Timestamp.now()
            features['days_in_pipe'] = (now - df['created_date']).dt.days.fillna(90).clip(0, 730)
        else:
            features['days_in_pipe'] = 90

        # Days until close
        if 'close_date' in df.columns:
            now = pd.Timestamp.now()
            features['days_to_close'] = (df['close_date'] - now).dt.days.fillna(30)
        else:
            features['days_to_close'] = 30

        # Product group encoding (top N + other)
        if 'product_group' in df.columns:
            top_products = df['product_group'].value_counts().head(10).index
            for prod in top_products:
                features[f'prod_{prod}'] = (df['product_group'] == prod).astype(int)

        # Rep encoding (top N)
        if 'rep' in df.columns:
            top_reps = df['rep'].value_counts().head(15).index
            for rep in top_reps:
                features[f'rep_{rep}'] = (df['rep'] == rep).astype(int)

        # Stage base probability
        features['stage_base_prob'] = df['stage_normalized'].map(STAGE_BASE_PROB).fillna(0.3)

        # Engagement features
        if 'eng_total' in df.columns:
            features['eng_total'] = np.log1p(df['eng_total'].fillna(0))
            features['eng_calls'] = np.log1p(df['eng_calls'].fillna(0))
            features['eng_emails'] = np.log1p(df['eng_emails'].fillna(0))
            features['eng_meetings'] = np.log1p(df['eng_meetings'].fillna(0))
            features['eng_contacts'] = df['eng_contacts'].fillna(0)
            features['eng_months_since_last'] = df['eng_months_since_last'].fillna(12).clip(0, 24)
            # Meeting ratio (meetings are high-intent)
            total = df['eng_total'].fillna(0).replace(0, 1)
            features['eng_meeting_ratio'] = df['eng_meetings'].fillna(0) / total

        # Services features
        if 'svc_total' in df.columns:
            features['svc_total'] = np.log1p(df['svc_total'].fillna(0))
            features['svc_active'] = np.log1p(df['svc_active'].fillna(0))
            features['svc_disconnected'] = df['svc_disconnected'].fillna(0)
            features['svc_mrr'] = np.log1p(df['svc_mrr'].fillna(0).clip(lower=0))
            features['svc_product_groups'] = df['svc_product_groups'].fillna(0)
            # Existing customer flag
            features['is_existing_customer'] = (df['svc_total'].fillna(0) > 0).astype(int)
            # Churn risk signal
            total_svc = df['svc_total'].fillna(0).replace(0, 1)
            features['svc_disconnect_ratio'] = df['svc_disconnected'].fillna(0) / total_svc

        # Deal type encoding
        if 'type' in df.columns:
            features['is_new_service'] = df['type'].str.lower().str.contains('new', na=False).astype(int)
            features['is_rerate'] = df['type'].str.lower().str.contains('re-rate|rerate', na=False).astype(int)
            features['is_renewal'] = df['type'].str.lower().str.contains('renew', na=False).astype(int)

        # Term in months
        if 'term_in_months' in df.columns:
            features['term_months'] = pd.to_numeric(df['term_in_months'], errors='coerce').fillna(12).clip(1, 120)

        return features.fillna(0)

    def train(self, training_data):
        """Train the prediction model on historical deal outcomes."""
        if training_data.empty or len(training_data) < 10:
            return {"error": "Need at least 10 deals with outcomes to train"}

        y = training_data['won'].astype(int)
        X = self._engineer_features(training_data)

        self.feature_names = list(X.columns)
        X_scaled = self.scaler.fit_transform(X)

        self.model = LogisticRegression(
            C=1.0, max_iter=1000, class_weight='balanced', random_state=42
        )
        self.model.fit(X_scaled, y)

        # Cross-validation
        if len(training_data) >= 30:
            self.cv_scores = cross_val_score(self.model, X_scaled, y, cv=min(5, len(training_data) // 10), scoring='roc_auc')

        # Compute segment win rates
        self._compute_segment_rates(training_data)

        self.is_trained = True
        self.training_date = datetime.now().isoformat()
        self.training_deals = len(training_data)

        return {
            "status": "trained",
            "deals": len(training_data),
            "won": int(y.sum()),
            "lost": int(len(y) - y.sum()),
            "features": len(self.feature_names),
            "cv_auc": float(np.mean(self.cv_scores)) if self.cv_scores is not None else None,
        }

    def predict(self, deals):
        """Score active deals with win probability."""
        if not self.is_trained or deals.empty:
            return []

        X = self._engineer_features(deals)

        # Align features with training features
        for col in self.feature_names:
            if col not in X.columns:
                X[col] = 0
        X = X[self.feature_names]

        X_scaled = self.scaler.transform(X)
        probs = self.model.predict_proba(X_scaled)[:, 1]

        results = []
        for idx, (_, deal) in enumerate(deals.iterrows()):
            win_prob = float(probs[idx])
            stage = deal.get('stage_normalized', 'unknown')
            base_prob = STAGE_BASE_PROB.get(stage, 0.3)

            # Risk flags
            risk_flags = []
            if win_prob < 0.3:
                risk_flags.append("Low win probability")
            if deal.get('mrr', 0) <= 0:
                risk_flags.append("Zero or negative MRR")
            days_in_pipe = 90
            if 'created_date' in deal.index and pd.notna(deal['created_date']):
                days_in_pipe = (pd.Timestamp.now() - deal['created_date']).days
                if days_in_pipe > 180:
                    risk_flags.append(f"Stale deal - {days_in_pipe} days in pipeline")
            if stage == 'discover' and days_in_pipe > 60:
                risk_flags.append("Stuck in Discover stage")

            # Engagement risk
            if 'eng_total' in deal.index and deal.get('eng_total', 0) == 0:
                risk_flags.append("No engagement activity")
            if 'eng_months_since_last' in deal.index and deal.get('eng_months_since_last', 0) > 3:
                risk_flags.append("No recent engagement")

            # Trend (compare to stage base)
            trend = "up" if win_prob > base_prob else "down" if win_prob < base_prob * 0.8 else "flat"

            # Handle opportunity_id — may be scalar or Series if duplicate cols
            opp_id = deal.get('opportunity_id', f'deal_{idx}')
            if hasattr(opp_id, 'iloc'):
                opp_id = opp_id.iloc[0]

            results.append({
                "deal_id": str(opp_id),
                "deal_name": deal.get('product_group', 'Unknown'),
                "account_name": deal.get('customer_account', 'Unknown'),
                "stage": deal.get('stage', 'Unknown'),
                "stage_normalized": stage,
                "amount": float(deal.get('mrr', 0)),
                "close_date": deal['close_date'].isoformat() if pd.notna(deal.get('close_date')) else None,
                "rep": deal.get('rep', ''),
                "prediction": {
                    "win_probability": round(win_prob, 4),
                    "stage_base_probability": round(base_prob, 4),
                    "win_prob_trend": trend,
                    "predicted_close_date": deal['close_date'].isoformat() if pd.notna(deal.get('close_date')) else None,
                    "risk_flags": risk_flags,
                    "confidence": "high" if len(self.feature_names) > 5 and self.training_deals > 100 else "medium",
                },
            })

        return sorted(self._sanitize_results(results), key=lambda x: x['prediction']['win_probability'], reverse=True)

    @staticmethod
    def _sanitize_results(results):
        """Replace NaN/Inf with safe defaults for JSON serialization."""
        import math
        def clean(v):
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                return 0.0
            if isinstance(v, dict):
                return {k: clean(val) for k, val in v.items()}
            if isinstance(v, list):
                return [clean(item) for item in v]
            return v
        return [clean(r) for r in results]

    def _compute_segment_rates(self, data):
        """Compute win rates by product and rep."""
        if 'product_group' in data.columns:
            grp = data.groupby('product_group')['won'].agg(['mean', 'count'])
            self.product_win_rates = {
                idx: {"win_rate": round(float(row['mean']), 4), "count": int(row['count'])}
                for idx, row in grp.iterrows() if row['count'] >= 3
            }

        if 'rep' in data.columns:
            grp = data.groupby('rep')['won'].agg(['mean', 'count'])
            self.rep_win_rates = {
                idx: {"win_rate": round(float(row['mean']), 4), "count": int(row['count'])}
                for idx, row in grp.iterrows() if row['count'] >= 3
            }

    def get_model_params(self):
        """Return model parameters for the Segments tab."""
        if not self.is_trained:
            return {}
        return {
            "prediction": {
                "product_win_rates": self.product_win_rates,
                "rep_win_rates": self.rep_win_rates,
                "feature_count": len(self.feature_names),
                "training_deals": self.training_deals,
            }
        }
