"""LLM provider layer.

Three implementations behind one protocol:

1. GeminiProvider — uses Google's Gemini API via the official SDK.
2. OpenAICompatibleProvider — talks to any OpenAI-compatible chat completions
   endpoint (OpenAI, OpenRouter, local vLLM/Ollama, ...) using httpx.
3. RuleBasedProvider — deterministic fallback used when no API key is set or
   the remote provider fails, so the demo never breaks.

The agent layer only depends on the protocol.
"""
from __future__ import annotations

import json
import re

from config import settings


class LLMResult:
    def __init__(self, text: str, provider: str, model: str):
        self.text = text
        self.provider = provider
        self.model = model


class LLMError(Exception):
    pass


class BaseProvider:
    name = "base"

    def chat(self, system: str, user: str, json_mode: bool = False) -> LLMResult:
        raise NotImplementedError


class GeminiProvider(BaseProvider):
    """Google Gemini API provider using the official google-generativeai SDK."""
    
    name = "gemini"

    def __init__(self, api_key: str, model: str, timeout: float):
        self.api_key = api_key
        self.model = model
        self.timeout = timeout
        self._client = None

    def _get_client(self):
        """Lazy-load the Gemini client."""
        if self._client is None:
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.api_key)
                self._client = genai
            except ImportError:
                raise LLMError(
                    "google-generativeai is not installed. "
                    "Install it with: pip install google-generativeai"
                )
        return self._client

    def chat(self, system: str, user: str, json_mode: bool = False) -> LLMResult:
        try:
            genai = self._get_client()
            
            # Combine system and user messages
            # Gemini doesn't have a separate system role in all models,
            # so we prepend system as part of the prompt
            combined_prompt = f"{system}\n\n{user}"
            
            model = genai.GenerativeModel(self.model)
            
            generation_config = {
                "temperature": 0.3,
            }
            
            if json_mode:
                generation_config["response_mime_type"] = "application/json"
            
            response = model.generate_content(
                combined_prompt,
                generation_config=generation_config,
                request_options={"timeout": self.timeout},
            )
            
            if not response.text:
                raise LLMError("Gemini returned empty response")
            
            return LLMResult(text=response.text, provider=self.name, model=self.model)
            
        except Exception as exc:
            if isinstance(exc, LLMError):
                raise
            raise LLMError(f"Gemini API error: {str(exc)}") from exc


class OpenAICompatibleProvider(BaseProvider):
    name = "openai-compatible"

    def __init__(self, api_key: str, base_url: str, model: str, timeout: float):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    def chat(self, system: str, user: str, json_mode: bool = False) -> LLMResult:
        import httpx

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.3,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        headers = {
            "Authorization": "Bearer " + self.api_key,
            "Content-Type": "application/json",
        }
        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(
                    self.base_url + "/chat/completions",
                    json=payload,
                    headers=headers,
                )
                resp.raise_for_status()
                data = resp.json()
            text = data["choices"][0]["message"]["content"]
            return LLMResult(text=text, provider=self.name, model=self.model)
        except Exception as exc:  # network, auth, schema errors
            raise LLMError(str(exc)) from exc


class RuleBasedProvider(BaseProvider):
    """Deterministic offline "model".

    Understands a few intents and produces the same JSON contracts the agent
    expects, so downstream behavior is identical to the LLM path.
    """

    name = "rule-based"

    def chat(self, system: str, user: str, json_mode: bool = False) -> LLMResult:
        text = self._respond(user)
        return LLMResult(text=text, provider=self.name, model="rules-v1")

    # ------------------------------------------------------------------
    def _respond(self, user: str) -> str:
        lowered = user.lower()

        if '"task": "onboarding"' in lowered or '"task": "profile"' in lowered:
            patch = self._extract_profile_patch(user)
            if patch:
                return json.dumps(
                    {
                        "action": "update_profile",
                        "reply": "عالی! این اطلاعات را به پروفایلت اضافه کردم ✓ حالا می‌توانیم برویم سراغ آگهی‌ها.",
                        "patch": patch,
                    },
                    ensure_ascii=False,
                )
            return json.dumps(
                {
                    "action": "none",
                    "reply": "بگو چه نقشی می‌خواهی، چه مهارت‌هایی داری و کجا زندگی می‌کنی تا پروفایلت را کامل کنم.",
                },
                ensure_ascii=False,
            )

        if '"task": "resume"' in lowered:
            return json.dumps(
                {
                    "action": "create_resume",
                    "reply": "یک نسخهٔ رزومه از روی پروفایل شما ساختم.",
                    "resume": self._build_resume_from_profile(user),
                },
                ensure_ascii=False,
            )

        if '"task": "explain"' in lowered:
            return json.dumps(
                {
                    "action": "none",
                    "reply": self._explain_reply(user),
                },
                ensure_ascii=False,
            )

        return json.dumps(
            {
                "action": "none",
                "reply": "می‌توانم آگهی‌ها را غربال کنم یا رزومه‌ات را بسازم. کدام را می‌خواهی؟",
            },
            ensure_ascii=False,
        )

    def _extract_profile_patch(self, user: str) -> dict:
        """Extract simple profile facts from the user's Persian message so the
        rule-based onboarding actually captures what the user typed."""
        import re as _re

        m = _re.search(r'"user_message":\s*"([^"]*)"', user)
        text = m.group(1) if m else ""
        lowered = text.lower()
        patch: dict = {}

        # skills — a small catalogue of common tech keywords
        catalogue = [
            "html", "css", "javascript", "js", "typescript", "ts", "react",
            "next.js", "nextjs", "vue", "nuxt", "angular", "node", "git",
            "sass", "redux", "tailwind", "figma", "python", "django",
        ]
        found = [c for c in catalogue if c in lowered]
        if found:
            patch["skills"] = sorted(set(found))

        # experience years — "۲ سال" / "2 years" / "دو سال"
        years = _re.search(r"([0-9۰-۹]+)\s*(سال|year)", lowered)
        if years:
            try:
                patch["experience_years"] = int(years.group(1).translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")))
            except ValueError:
                pass

        # cities
        for city, en in (("تهران", "تهران"), ("مشهد", "مشهد"), ("اصفهان", "اصفهان"), ("شیراز", "شیراز"), ("تبریز", "تبریز"), ("کرج", "کرج")):
            if city in text:
                patch["city"] = en
                break
        if "دورکار" in text or "remote" in lowered:
            patch["remote_only"] = True

        # target role
        if "کارآموز" in text or "intern" in lowered:
            patch["level"] = "intern"
            patch["target_role"] = patch.get("target_role") or "فرانت‌اند"
        elif "جونیور" in text or "junior" in lowered:
            patch["level"] = "junior"
        if "فرانت" in text or "frontend" in lowered or "react" in lowered:
            patch["target_role"] = patch.get("target_role") or "فرانت‌اند"
        elif "بک" in text and "اند" in text:
            patch["target_role"] = "بک‌اند"

        if patch:
            patch["completed"] = bool(patch.get("skills"))
        return patch

    def _build_resume_from_profile(self, user: str) -> dict:
        import re as _re

        def grab(key):
            m = _re.search(r'"' + key + r'":\s*"([^"]*)"', user)
            return m.group(1) if m else ""

        full_name = grab("full_name") or "جویندهٔ کار"
        headline = grab("headline") or grab("target_role") or "توسعه‌دهندهٔ فرانت‌اند"
        skills_raw = _re.search(r'"skills":\s*(\[[^\]]*\])', user)
        skills = []
        if skills_raw:
            try:
                skills = json.loads(skills_raw.group(1))
            except Exception:
                skills = []
        return {
            "full_name": full_name,
            "headline": headline,
            "summary": (
                full_name
                + "، "
                + headline
                + " با علاقهٔ جدی به ساختن محصولات واقعی. این رزومه با کمک ایجنت کاریابی آماده شده است."
            ),
            "skills": [{"name": s} for s in skills],
            "experiences": [],
            "projects": [],
            "educations": [],
        }

    def _explain_reply(self, user: str) -> str:
        import re as _re

        m = _re.search(r'"reasons":\s*(\[[^\]]*\])', user)
        if m:
            try:
                reasons = json.loads(m.group(1))
                return "دلایل تناسب: " + "؛ ".join(reasons)
            except Exception:
                pass
        return "برای این آگهی دلایل تناسب در فایل نتیجه ثبت شده است."


def get_provider() -> BaseProvider:
    """Factory used across the app.
    
    Priority:
    1. GEMINI_API_KEY → GeminiProvider
    2. OPENAI_API_KEY → OpenAICompatibleProvider
    3. None → RuleBasedProvider (fallback)
    """
    if settings.GEMINI_API_KEY:
        return GeminiProvider(
            api_key=settings.GEMINI_API_KEY,
            model=settings.GEMINI_MODEL,
            timeout=settings.GEMINI_TIMEOUT,
        )
    if settings.OPENAI_API_KEY:
        return OpenAICompatibleProvider(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_BASE_URL,
            model=settings.OPENAI_MODEL,
            timeout=settings.LLM_TIMEOUT,
        )
    return RuleBasedProvider()
