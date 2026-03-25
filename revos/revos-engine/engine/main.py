"""
RevOS Prediction Engine — main orchestrator.
"""
from .data_loader import DataLoader
from .prediction import PredictionEngine
from .recommendations import build_strategies
from .calibration import CalibrationTracker


class RevOSEngine:
    def __init__(self):
        self.loader = DataLoader()
        self.predictor = PredictionEngine()
        self.calibrator = CalibrationTracker()
        self.last_predictions = []
        self.last_strategies = []

    def load_and_train(self, data_dir=None, deals_data=None):
        """Load data and train the model."""
        if data_dir:
            count = self.loader.load_from_csv(data_dir)
        elif deals_data:
            count = self.loader.load_from_json(deals_data)
        else:
            return {"error": "Provide data_dir or deals_data"}

        training_data = self.loader.get_training_data()
        result = self.predictor.train(training_data)

        if 'error' not in result:
            self.calibrator.log_retrain(result)

        return result

    def score_deals(self):
        """Score all active pipeline deals."""
        active = self.loader.get_active_deals()
        if active.empty:
            return []

        predictions = self.predictor.predict(active)
        self.calibrator.log_predictions(predictions)
        self.last_predictions = predictions
        return predictions

    def get_strategies(self):
        """Get strategy recommendations for scored deals."""
        if not self.last_predictions:
            self.score_deals()

        training_data = self.loader.get_training_data()
        strategies = build_strategies(self.last_predictions, training_data)
        self.last_strategies = strategies
        return strategies

    def get_health(self):
        """Return engine health status."""
        return {
            "status": "ok",
            "initialized": self.loader.get_deal_count() > 0,
            "trained": self.predictor.is_trained,
            "training_date": self.predictor.training_date,
            "training_deals": self.predictor.training_deals,
            "active_deals": len(self.loader.get_active_deals()) if self.loader.deals is not None else 0,
        }
