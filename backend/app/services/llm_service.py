import os
import json

# ── Gemini (AI Summary) ──────────────────────────────────────────────────────
try:
    from google import genai
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False

# ── Groq via OpenAI-compatible SDK (chatbot only) ────────────────────────────
try:
    from openai import OpenAI as GroqOpenAI
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False
    print("[llm_service] openai package not found – chatbot will be unavailable. "
          "Add 'openai>=1.0.0' to requirements.txt and redeploy.")

from app.prompts.explanation_prompt import EXPLANATION_PROMPT_TEMPLATE, EXPLANATION_FALLBACK_PROMPT_TEMPLATE
from app.prompts.chat_prompt import CHAT_SYSTEM_PROMPT


# ─────────────────────────────────────────────────────────────────────────────
# Gemini service — AI Summary only (unchanged)
# ─────────────────────────────────────────────────────────────────────────────
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
            error_str = str(e).lower()
            is_transient = any(code in error_str for code in ("429", "503", "quota", "rate limit", "overloaded", "unavailable"))

            if is_transient and GROQ_AVAILABLE:
                # ── Groq fallback for transient Gemini errors ──────────────────
                groq_key = os.getenv("GROQ_API_KEY")
                groq_model = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
                if groq_key:
                    try:
                        fallback_client = GroqOpenAI(
                            api_key=groq_key,
                            base_url="https://api.groq.com/openai/v1"
                        )
                        fallback_prompt = EXPLANATION_FALLBACK_PROMPT_TEMPLATE.format(
                            extracted_data=json.dumps(extracted_data, indent=2),
                            ml_assessment=json.dumps(ml_assessment, indent=2),
                            xai_assessment=json.dumps(xai_assessment, indent=2)
                        )
                        completion = fallback_client.chat.completions.create(
                            model=groq_model,
                            messages=[{"role": "user", "content": fallback_prompt}],
                        )
                        print(f"[llm_service] Gemini transient error ({e}); AI Summary served by Groq fallback.")
                        return {
                            "status": "success",
                            "message": "Explanation generated (Groq fallback — Gemini temporarily unavailable).",
                            "explanation": completion.choices[0].message.content
                        }
                    except Exception as fallback_e:
                        print(f"[llm_service] Groq fallback also failed: {fallback_e}")
                        return {
                            "status": "error",
                            "message": f"Gemini unavailable and Groq fallback failed: {str(fallback_e)}",
                            "explanation": None
                        }

            return {
                "status": "error",
                "message": f"LLM generation failed: {str(e)}",
                "explanation": None
            }


# ─────────────────────────────────────────────────────────────────────────────
# Groq service — report-grounded chatbot only
# ─────────────────────────────────────────────────────────────────────────────
class GroqChatService:
    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY")
        self.model_name = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
        self.client = None

        if GROQ_AVAILABLE and self.api_key:
            try:
                self.client = GroqOpenAI(
                    api_key=self.api_key,
                    base_url="https://api.groq.com/openai/v1"
                )
                print(f"[llm_service] Groq chatbot ready (model: {self.model_name})")
            except Exception as e:
                print(f"[llm_service] Failed to initialize Groq client: {e}")
        else:
            if not self.api_key:
                print("[llm_service] GROQ_API_KEY not set – chatbot will be unavailable.")

    def chat_with_report(self, message: str, report_context: dict, history: list) -> dict:
        if not self.api_key:
            return {
                "status": "unavailable",
                "response": "Chatbot not configured. GROQ_API_KEY environment variable is missing."
            }

        if not GROQ_AVAILABLE or not self.client:
            return {
                "status": "error",
                "response": "Groq SDK (openai package) is missing or failed to initialize."
            }

        try:
            # System message grounds the model in the uploaded report
            system_content = CHAT_SYSTEM_PROMPT.format(
                report_context=json.dumps(report_context, indent=2)
            )

            # Build messages list: system + prior history + current user turn
            messages = [{"role": "system", "content": system_content}]
            for msg in history:
                role = msg.get("role", "user")  # "user" or "assistant"
                messages.append({"role": role, "content": msg.get("content", "")})
            messages.append({"role": "user", "content": message})

            completion = self.client.chat.completions.create(
                model=self.model_name,
                messages=messages,
            )

            return {
                "status": "success",
                "response": completion.choices[0].message.content
            }

        except Exception as e:
            return {
                "status": "error",
                "response": f"Failed to generate response: {str(e)}"
            }


# ─────────────────────────────────────────────────────────────────────────────
# Module-level singletons
# ─────────────────────────────────────────────────────────────────────────────
llm_service_instance = LLMService()
groq_chat_service_instance = GroqChatService()


def run_llm_explanation(extracted_data: list, ml_assessment: dict, xai_assessment: dict) -> dict:
    """AI Summary — powered by Gemini (unchanged)."""
    return llm_service_instance.generate_explanation(extracted_data, ml_assessment, xai_assessment)


def run_chat(message: str, report_context: dict, history: list) -> dict:
    """Report-grounded chatbot — powered by Groq."""
    return groq_chat_service_instance.chat_with_report(message, report_context, history)
