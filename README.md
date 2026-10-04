# AI-Based Diabetes Laboratory Report Analysis and Explainable Assessment System

## Project Overview & Problem Statement
Understanding clinical laboratory test reports is often challenging for patients without a medical background. Patients receive complex tables with raw values, reference ranges, and medical terminology, which can lead to confusion or anxiety. 

This project aims to bridge that gap by providing an end-to-end AI system that reads raw laboratory reports (images or PDFs), extracts key metabolic parameters, assesses diabetes risk using a Machine Learning model, and explains the results in plain, patient-friendly language using Large Language Models (LLMs). It also includes a report-grounded chatbot to answer specific patient queries.

## Product Workflow
1. **Upload**: User uploads a clinical laboratory report (PDF, JPG, PNG).
2. **OCR**: Tesseract OCR extracts text from the document.
3. **Parameter Extraction**: Rule-based extraction identifies key biomarkers and their reference ranges.
4. **Status Analysis**: Analyzes whether extracted parameters fall within normal ranges.
5. **ML Model**: Evaluates diabetes risk based on 5 core features.
6. **XAI/SHAP**: Generates feature contributions explaining *why* the model made its prediction.
7. **Gemini Explanation**: An LLM translates the technical findings into a patient-friendly summary.
8. **Chatbot**: Users can ask follow-up questions grounded entirely in their report's context.

## Architecture & Tech Stack
* **Frontend**: React + Vite (Fast, modern SPA framework)
* **Backend**: FastAPI (High-performance Python web framework)
* **OCR**: Tesseract & pdf2image
* **Machine Learning**: Scikit-Learn (Random Forest pipeline)
* **Explainable AI**: SHAP (TreeExplainer)
* **LLM**: Google Gemini API (`google-genai` SDK)
* **Deployment**: Docker, Vercel (Frontend), Render (Backend)

## Major Features
### 1. OCR & Parameter Extraction
The backend utilizes Tesseract to convert images and PDFs into raw text. A customized extraction service uses regular expressions to reliably pull parameter names, values, units, and reference ranges despite OCR noise.

### 2. Status Analysis
Compares extracted patient values against standard or report-provided reference ranges, categorizing them as Normal, Low, High, or Attention/Uncertain.

### 3. ML Model (Diabetes Risk)
The core ML engine is a Random Forest model trained to evaluate diabetes risk. It utilizes exactly 5 features:
* `age`
* `sex_male`
* `bmi`
* `hba1c` (Glycated Hemoglobin)
* `fasting_glucose`

### 4. XAI/SHAP Integration
Explainable AI is a critical component of the system. We use SHAP (`TreeExplainer`) to break down the Random Forest prediction, showing exactly how much each feature contributed to the final risk score.

### 5. Gemini Explanation & Chatbot
Google's Gemini model acts as the "virtual physician's assistant". It consumes the ML assessment, SHAP values, and extracted lab data to generate a highly empathetic, easy-to-read explanation. A chat interface allows the user to ask targeted questions about their report.

---

## Local Setup & Run Instructions

### Prerequisites
1. **Python**: 3.10 to 3.13 (3.13 recommended)
2. **Node.js**: v18+ 
3. **Tesseract OCR**: Must be installed on your OS and available in your system PATH.
4. **Poppler**: Required for `pdf2image` to process PDFs.

### Environment Variables
**Backend (`backend/.env`)**:
```
GEMINI_API_KEY=your_google_ai_studio_key
GEMINI_MODEL=gemini-3.8-flash (or gemini-2.5-flash)
FRONTEND_ORIGIN=http://localhost:5173
```

**Frontend (`frontend/.env`)**:
```
VITE_API_BASE_URL=http://localhost:8000
```

### Running the Backend
```bash
cd backend
python -m venv venv
# Activate venv (Windows: .\venv\Scripts\activate | Mac/Linux: source venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Running the Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Deployment Architecture
* **Frontend**: Deployed as a static application on **Vercel**. 
* **Backend**: Containerized using the provided `Dockerfile` and deployed as a web service on **Render**. The Dockerfile automatically provisions the necessary Linux packages for Tesseract and Poppler.
* **Model Setup**: The `diabetes_model.joblib` artifact (~1.4MB) must be available to the production backend.

---

## Testing & Limitations
* **Testing**: The API endpoints (`/api/extract`, `/api/assess`, `/api/chat`) have been integration-tested. Graceful fallbacks exist for missing parameters (e.g., missing demographics will revert the ML to "Demo Mode").
* **Limitations**: OCR accuracy heavily depends on image quality. The model is currently constrained to the 5 specific metabolic features mentioned above.

---

## ⚠️ Important Medical Disclaimer
**This application is a demonstration product created for an academic AIML Honors project.** It is NOT a certified medical device and should NEVER be used for self-diagnosis or to replace professional medical advice. Always consult a qualified healthcare provider regarding laboratory results and health conditions.
