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

@app.post("/api/analyze")
async def analyze_report(file: UploadFile = File(...)):
    # Placeholder for Phase 4-9
    return {"status": "success", "filename": file.filename, "message": "Analysis endpoint ready"}

@app.post("/api/chat")
def chat_with_report(request: ChatRequest):
    # Placeholder for Phase 10
    return {"status": "success", "response": "Chatbot endpoint ready"}
