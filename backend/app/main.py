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
        
        # Phases 5-9 will go here later
        
        return {
            "status": "success", 
            "filename": file.filename, 
            "raw_text": raw_text,
            "message": "OCR completed successfully"
        }
    except Exception as e:
        print(f"Error in analyze_report: {traceback.format_exc()}")
        return {"status": "error", "message": str(e)}

@app.post("/api/chat")
def chat_with_report(request: ChatRequest):
    # Placeholder for Phase 10
    return {"status": "success", "response": "Chatbot endpoint ready"}
