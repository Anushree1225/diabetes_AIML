try:
    import shap
    import pandas as pd
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False

class XAIService:
    def explain(self, model, features_dict: dict, ml_assessment: dict) -> dict:
        if not ml_assessment.get("connected", False) or ml_assessment.get("status") == "error":
            return {
                "status": "unavailable",
                "message": "XAI unavailable \u2014 real ML model not connected or error.",
                "contributions": None
            }
        
        if not SHAP_AVAILABLE:
            return {
                "status": "error",
                "message": "SHAP library is not installed.",
                "contributions": None
            }
            
        try:
            df = pd.DataFrame([features_dict])
            df = df[["age", "sex_male", "bmi", "hba1c", "fasting_glucose"]]
            
            preprocessor = model.named_steps['prep']
            classifier = model.named_steps['clf']
            
            X_transformed = preprocessor.transform(df)
            
            explainer = shap.TreeExplainer(classifier)
            shap_values = explainer.shap_values(X_transformed)
            
            if isinstance(shap_values, list):
                sv = shap_values[1][0]
            else:
                sv = shap_values[0, :, 1] if len(shap_values.shape) == 3 else shap_values[0]
            
            # Note: Columns inside the ColumnTransformer output will be numeric first, then binary
            # NUMERIC = ["age", "bmi", "hba1c", "fasting_glucose"]
            # BINARY = ["sex_male"]
            feature_names = ["age", "bmi", "hba1c", "fasting_glucose", "sex_male"]
            
            contributions = []
            for i, name in enumerate(feature_names):
                contributions.append({
                    "feature": name,
                    "value": float(sv[i])
                })
            
            return {
                "status": "success",
                "message": "Feature contributions generated successfully.",
                "contributions": contributions
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Could not generate explanations: {str(e)}",
                "contributions": None
            }

xai_service_instance = XAIService()

def run_xai_analysis(model, features: dict, ml_assessment: dict) -> dict:
    return xai_service_instance.explain(model, features, ml_assessment)
