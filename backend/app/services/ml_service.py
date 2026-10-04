import os
import pandas as pd
import numpy as np

try:
    import joblib
    JOBLIB_AVAILABLE = True
except ImportError:
    JOBLIB_AVAILABLE = False

# The final model path
MODEL_PATH = os.getenv("ML_MODEL_PATH", os.path.join(os.path.dirname(__file__), "..", "models", "diabetes_model.joblib"))

class MLService:
    def __init__(self):
        self.model = None
        self.model_loaded = False
        self._load_model()

    def _load_model(self):
        try:
            if JOBLIB_AVAILABLE and os.path.exists(MODEL_PATH):
                self.model = joblib.load(MODEL_PATH)
                self.model_loaded = True
            else:
                self.model_loaded = False
        except Exception as e:
            print(f"Failed to load ML model: {e}")
            self.model_loaded = False

    def prepare_features(self, extracted_data: list, demographics: dict) -> dict:
        features = {}
        for item in extracted_data:
            features[item["name"]] = item["value"]
            
        # Map parameters to model features
        mapped_features = {
            "age": float(demographics.get("age", 0)) if demographics.get("age") else None,
            "sex_male": float(demographics.get("sex_male", 0)) if demographics.get("sex_male") is not None else None,
            "bmi": float(demographics.get("bmi")) if demographics.get("bmi") else np.nan,
            "hba1c": float(features.get("HbA1c", np.nan)),
            "fasting_glucose": float(features.get("Fasting Glucose", np.nan))
        }
        return mapped_features

    def predict(self, extracted_data: list, demographics: dict) -> dict:
        features_dict = self.prepare_features(extracted_data, demographics)
        
        if not self.model_loaded:
            return {
                "status": "success",
                "mode": "DEMO",
                "connected": False,
                "prediction": "Model not connected",
                "confidence": None,
                "message": "Real ML model is missing. This is a placeholder for development."
            }
            
        try:
            if features_dict["age"] is None or features_dict["sex_male"] is None:
                return {
                    "status": "error",
                    "mode": "REAL",
                    "connected": True,
                    "prediction": None,
                    "message": "Age and Sex are required for real prediction."
                }
            if np.isnan(features_dict["hba1c"]) or np.isnan(features_dict["fasting_glucose"]):
                return {
                    "status": "error",
                    "mode": "REAL",
                    "connected": True,
                    "prediction": None,
                    "message": "HbA1c and Fasting Glucose are required for real prediction."
                }

            df = pd.DataFrame([features_dict])
            df = df[["age", "sex_male", "bmi", "hba1c", "fasting_glucose"]]
            
            pred = self.model.predict(df)[0]
            proba = self.model.predict_proba(df)[0, 1]
            
            return {
                "status": "success",
                "mode": "REAL",
                "connected": True,
                "prediction": int(pred),
                "confidence": float(proba),
                "message": "ML-based assessment: higher diabetes likelihood according to the trained model." if pred == 1 else "ML-based assessment: lower diabetes likelihood according to the trained model."
            }
        except Exception as e:
            return {
                "status": "error",
                "mode": "REAL",
                "connected": True,
                "message": f"Model error: {str(e)}"
            }

ml_service_instance = MLService()

def run_ml_assessment(extracted_data: list, demographics: dict) -> dict:
    return ml_service_instance.predict(extracted_data, demographics)
