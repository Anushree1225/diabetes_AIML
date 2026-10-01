import os
import json
try:
    from google import genai
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False

from app.prompts.explanation_prompt import EXPLANATION_PROMPT_TEMPLATE
from app.prompts.chat_prompt import CHAT_SYSTEM_PROMPT

class LLMService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        
        self.client = None
        if GENAI_AVAILABLE and self.api_key:
            try:
                self.client = genai.Client(api_key=self.api_key)
            except Exception as e:
                print(f"Failed to initialize Gemini client: {e}")

    def generate_explanation(self, extracted_data: list, ml_assessment: dict, xai_assessment: dict) -> dict:
        if not self.api_key:
            return {
                "status": "unavailable",
                "message": "LLM not configured. GEMINI_API_KEY environment variable is missing.",
                "explanation": None
            }
            
        if not GENAI_AVAILABLE or not self.client:
             return {
                "status": "error",
                "message": "google-genai SDK is missing or failed to initialize.",
                "explanation": None
            }

        try:
            prompt = EXPLANATION_PROMPT_TEMPLATE.format(
                extracted_data=json.dumps(extracted_data, indent=2),
                ml_assessment=json.dumps(ml_assessment, indent=2),
                xai_assessment=json.dumps(xai_assessment, indent=2)
            )
            
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt
            )
            
            return {
                "status": "success",
                "message": "Explanation generated successfully.",
                "explanation": response.text
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"LLM generation failed: {str(e)}",
                "explanation": None
            }

    def chat_with_report(self, message: str, report_context: dict, history: list) -> dict:
        if not self.api_key:
            return {
                "status": "unavailable",
                "response": "Chatbot not configured. GEMINI_API_KEY environment variable is missing."
            }
            
        if not GENAI_AVAILABLE or not self.client:
             return {
                "status": "error",
                "response": "google-genai SDK is missing or failed to initialize."
            }

        try:
            # Build conversation context manually for broad compatibility
            context_prompt = CHAT_SYSTEM_PROMPT.format(
                report_context=json.dumps(report_context, indent=2)
            )
            
            full_prompt = context_prompt + "\n\nCONVERSATION HISTORY:\n"
            for msg in history:
                role = "User" if msg.get("role") == "user" else "Assistant"
                full_prompt += f"{role}: {msg.get('content')}\n"
                
            full_prompt += f"User: {message}\nAssistant:"
            
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=full_prompt
            )
            
            return {
                "status": "success",
                "response": response.text
            }
            
        except Exception as e:
            return {
                "status": "error",
                "response": f"Failed to generate response: {str(e)}"
            }

llm_service_instance = LLMService()

def run_llm_explanation(extracted_data: list, ml_assessment: dict, xai_assessment: dict) -> dict:
    return llm_service_instance.generate_explanation(extracted_data, ml_assessment, xai_assessment)

def run_chat(message: str, report_context: dict, history: list) -> dict:
    return llm_service_instance.chat_with_report(message, report_context, history)
