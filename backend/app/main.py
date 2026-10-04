import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from the backend directory (next to requirements.txt).
# This must run before any service module is imported so that
# os.getenv("GEMINI_API_KEY") etc. are populated at class-init time.
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_env_path, override=False)

# Confirm (without revealing the value) whether the key was found.
_key_present = bool(os.getenv("GEMINI_API_KEY"))
print(f"[config] .env loaded from: {_env_path}")
print(f"[config] GEMINI_API_KEY present: {_key_present}")
print(f"[config] GEMINI_MODEL : {os.getenv('GEMINI_MODEL', 'gemini-2.5-flash')} (default if unset)")

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import json

app = FastAPI(title="Diabetes Report Analyzer API")

# Configure CORS for frontend access
frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin, "http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    report_context: dict
    history: list = []

@app.get("/")
def read_root():
    return {"message": "Welcome to the Diabetes Report Analyzer API"}

from app.services.ocr_service import process_document
from app.services.extraction_service import extract_parameters
from app.services.status_service import analyze_status
from app.services.ml_service import run_ml_assessment, ml_service_instance
from app.services.xai_service import run_xai_analysis
from app.services.llm_service import run_llm_explanation, run_chat
import traceback

@app.post("/api/extract")
async def extract_report(file: UploadFile = File(...)):
    try:
        allowed_extensions = {".pdf", ".jpg", ".jpeg", ".png"}
        import os
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in allowed_extensions:
            return {"status": "error", "message": f"Unsupported file type. Allowed types: {', '.join(allowed_extensions)}"}

        file_bytes = await file.read()
        raw_text = process_document(file_bytes, file.filename)
        
        extracted_data = extract_parameters(raw_text)
        extracted_data = analyze_status(extracted_data)
        
        # Try to extract demographics
        import re
        demo = {}
        age_match = re.search(r'\bage\s*[:\-]?\s*(\d{1,3})\b', raw_text, re.IGNORECASE)
        sex_match = re.search(r'\b(sex|gender)\s*[:\-]?\s*(male|female|m|f)\b', raw_text, re.IGNORECASE)
        if age_match:
            demo['age'] = age_match.group(1)
        if sex_match:
            s = sex_match.group(2).lower()
            demo['sex'] = "Male" if s in ['male', 'm'] else "Female"
            
        return {
            "status": "success",
            "filename": file.filename,
            "raw_text": raw_text,
            "extracted_data": extracted_data,
            "demographics": demo
        }
    except Exception as e:
        print(f"Error in extract_report: {traceback.format_exc()}")
        return {"status": "error", "message": str(e)}

class AssessRequest(BaseModel):
    extracted_data: list
    demographics: dict
    raw_text: str = ""
    filename: str = ""

@app.post("/api/assess")
def assess_report(req: AssessRequest):
    try:
        demographics = req.demographics
        if "sex" in demographics and demographics["sex"]:
            demographics["sex_male"] = 1 if demographics["sex"].lower() == "male" else 0
            
        ml_assessment = run_ml_assessment(req.extracted_data, demographics)
        features = ml_service_instance.prepare_features(req.extracted_data, demographics)
        xai_assessment = run_xai_analysis(ml_service_instance.model, features, ml_assessment)
        llm_assessment = run_llm_explanation(req.extracted_data, ml_assessment, xai_assessment)
        
        return {
            "status": "success",
            "ml_assessment": ml_assessment,
            "xai_assessment": xai_assessment,
            "llm_assessment": llm_assessment
        }
    except Exception as e:
        print(f"Error in assess_report: {traceback.format_exc()}")
        return {"status": "error", "message": str(e)}

@app.post("/api/chat")
def chat_with_report(request: ChatRequest):
    try:
        result = run_chat(request.message, request.report_context, request.history)
        return result
    except Exception as e:
        print(f"Error in chat endpoint: {traceback.format_exc()}")
        return {"status": "error", "response": str(e)}
