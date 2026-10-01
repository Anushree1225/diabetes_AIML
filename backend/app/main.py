from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Diabetes Report Analyzer API")

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    report_context: dict

@app.get("/")
def read_root():
    return {"message": "Welcome to the Diabetes Report Analyzer API"}

from app.services.ocr_service import process_document
from app.services.extraction_service import extract_parameters
from app.services.status_service import analyze_status
from app.services.ml_service import run_ml_assessment, ml_service_instance
from app.services.xai_service import run_xai_analysis
from app.services.llm_service import run_llm_explanation
import traceback

@app.post("/api/analyze")
async def analyze_report(file: UploadFile = File(...)):
    try:
        allowed_extensions = {".pdf", ".jpg", ".jpeg", ".png"}
        import os
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in allowed_extensions:
            return {"status": "error", "message": f"Unsupported file type. Allowed types: {', '.join(allowed_extensions)}"}

        # Phase 4: Read and OCR the document
        file_bytes = await file.read()
        raw_text = process_document(file_bytes, file.filename)
        
        # Phase 5: Extract structured parameters
        extracted_data = extract_parameters(raw_text)
        
        # Phase 6: Analyze Reference Ranges and Status
        extracted_data = analyze_status(extracted_data)
        
        # Phase 7: ML Integration Layer
        ml_assessment = run_ml_assessment(extracted_data)
        
        # Phase 8: XAI Layer
        features = ml_service_instance.prepare_features(extracted_data)
        xai_assessment = run_xai_analysis(ml_service_instance.model, features, ml_assessment)
        
        # Phase 9: LLM Explanation Layer
        llm_assessment = run_llm_explanation(extracted_data, ml_assessment, xai_assessment)
        
        return {
            "status": "success", 
            "filename": file.filename, 
            "raw_text": raw_text,
            "extracted_data": extracted_data,
            "ml_assessment": ml_assessment,
            "xai_assessment": xai_assessment,
            "llm_assessment": llm_assessment,
            "message": "Pipeline completed successfully"
        }
    except Exception as e:
        print(f"Error in analyze_report: {traceback.format_exc()}")
        return {"status": "error", "message": str(e)}

@app.post("/api/chat")
def chat_with_report(request: ChatRequest):
    # Placeholder for Phase 10
    return {"status": "success", "response": "Chatbot endpoint ready"}
