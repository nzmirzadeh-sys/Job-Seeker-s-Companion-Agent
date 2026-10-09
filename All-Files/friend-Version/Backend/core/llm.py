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

    def _respond(self, user: str) -> str:
        lowered = user.lower()

        if '"task": "onboarding"' in lowered or '"task": "profile"' in lowered:
            patch = self._extract_profile_patch(user)
            if patch:
                # Build clear, warm acknowledgment of what was parsed
                ack_items = []
                if "target_role" in patch:
                    ack_items.append(f"نقش «{patch['target_role']}»")
                if "level" in patch:
                    level_names = {
                        "intern": "کارآموز",
                        "junior": "جونیور (Junior)",
                        "mid": "میان‌رده (Mid-level)",
                        "senior": "ارشد (Senior)",
                    }
                    ack_items.append(f"سطح «{level_names.get(patch['level'], patch['level'])}»")
                if "experience_years" in patch:
                    ey = patch["experience_years"]
                    ack_items.append(f"{ey} سال تجربه" if ey > 0 else "بدون سابقه کاری")
                if "city" in patch:
                    ack_items.append(f"شهر «{patch['city']}»")
                elif patch.get("remote_only"):
                    ack_items.append("اولویت دورکاری")
                if "skills" in patch and patch["skills"]:
                    ack_items.append(f"مهارت‌های «{'، '.join(patch['skills'][:4])}»")

                ack_str = " و ".join(ack_items) + " ثبت شد ✓" if ack_items else "اطلاعات با موفقیت ثبت شد ✓"

                # Check what is still needed
                missing = self._missing_fields(user, patch)
                if not missing:
                    reply = f"🎉 {ack_str}\nپروفایلت تکمیل شد! حالا می‌تونی بری سراغ آگهی‌های شغلی و پیشنهادهای متناسبت رو ببینی."
                else:
                    reply = f"{ack_str}\n{missing}"

                return json.dumps(
                    {
                        "action": "update_profile",
                        "reply": reply,
                        "patch": patch,
                    },
                    ensure_ascii=False,
                )

            # Nothing extracted — check if greeting or prompt for next step
            if any(w in lowered for w in ["سلام", "درود", "صبح بخیر", "عصر بخیر", "hi", "hello"]):
                missing = self._missing_fields(user, {})
                return json.dumps(
                    {
                        "action": "none",
                        "reply": "سلام! 👋 من همراه کاریابی تو هستم.\n" + (missing or "چه نقشی می‌خوای و در چه حوزه‌ای فعالیت می‌کنی؟"),
                    },
                    ensure_ascii=False,
                )

            missing = self._missing_fields(user, {})
            return json.dumps(
                {
                    "action": "none",
                    "reply": missing or "لطفاً بگو چه نقشی می‌خوای (مثلاً دیتا ساینس، فرانت‌اند) و کجا زندگی می‌کنی.",
                },
                ensure_ascii=False,
            )

        if '"task": "resume"' in lowered:
            # English translation feature commented out:
            # if any(w in lowered for w in ["انگلیسی", "english", "ترجمه"]):
            #     return json.dumps(
            #         {
            #             "action": "translate_resume",
            #             "reply": "رزومهٔ شما را به یک نسخهٔ استاندارد انگلیسی (English CV) ترجمه کردم ✓ می‌توانید پیش‌نمایش و فایل PDF آن را مشاهده کنید.",
            #         },
            #         ensure_ascii=False,
            #     )
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

        if "job_description_start" in lowered or "job analyzer" in lowered or "<job_description>" in lowered:
            return self._extract_job_analysis(user)

        return json.dumps(
            {
                "action": "none",
                "reply": "می‌توانم آگهی‌ها را غربال کنم یا رزومه‌ات را بسازم. کدام را می‌خواهی؟",
            },
            ensure_ascii=False,
        )

    def _missing_fields(self, user: str, new_patch: dict) -> str:
        """Check what profile fields are still empty and return a helpful conversational prompt."""
        import re as _re

        has_role = bool(new_patch.get("target_role"))
        has_skills = bool(new_patch.get("skills"))
        has_city = bool(new_patch.get("city") or new_patch.get("remote_only"))
        has_level = bool(new_patch.get("level"))
        has_exp = "experience_years" in new_patch

        # Also check existing profile fields in serialized payload
        profile_m = _re.search(r'"profile":\s*\{([^}]+)\}', user)
        if profile_m:
            profile_str = profile_m.group(1)
            if '"target_role": "' in profile_str:
                tr_m = _re.search(r'"target_role":\s*"([^"]*)"', profile_str)
                if tr_m and tr_m.group(1).strip():
                    has_role = True
            if '"skills": [' in profile_str:
                sk_m = _re.search(r'"skills":\s*\[([^\]]*)\]', profile_str)
                if sk_m and sk_m.group(1).strip() and sk_m.group(1).strip() != '""':
                    has_skills = True
            if '"city": "' in profile_str:
                ct_m = _re.search(r'"city":\s*"([^"]*)"', profile_str)
                if ct_m and ct_m.group(1).strip():
                    has_city = True
            if '"remote_only": true' in profile_str.lower():
                has_city = True
            if '"level": "' in profile_str:
                lv_m = _re.search(r'"level":\s*"([^"]*)"', profile_str)
                if lv_m and lv_m.group(1).strip():
                    has_level = True
            if '"experience_years":' in profile_str:
                ey_m = _re.search(r'"experience_years":\s*([0-9.]+)', profile_str)
                if ey_m:
                    has_exp = True

        # Role and city are the primary requirements for matching
        if has_role and has_city:
            return ""

        tips = []
        if not has_role:
            tips.append("چه نقشی می‌خوای؟ (مثلاً دیتا ساینس، فرانت‌اند، بک‌اند)")
        if not has_city:
            tips.append("کدام شهر زندگی می‌کنی؟ (یا دورکاری می‌خوای؟)")
        if not has_level and not has_exp:
            tips.append("سطح یا سابقه کارت چقدره؟ (مثلاً بدون سابقه، میدلول، یا سینیور)")
        elif not has_skills:
            tips.append("مهارت‌ها و ابزارهای اصلیت چیه؟")

        if not tips:
            return ""
        return "برای تکمیل پیشنهادها بگو: " + " | ".join(tips)

    def _extract_profile_patch(self, user: str) -> dict:
        """Extract profile facts from the user's message — handles Persian,
        English, typos, and conversational phrasing."""
        import re as _re

        m = _re.search(r'"user_message":\s*"([^"]*)"', user)
        text = m.group(1) if m else ""
        if not text.strip():
            return {}
        lowered = text.lower()
        # Normalize Persian characters
        norm_text = text.replace("ي", "ی").replace("ك", "ک").replace("\u200c", " ")
        norm_lowered = lowered.replace("ي", "ی").replace("ك", "ک").replace("\u200c", " ")
        patch: dict = {}

        # Starter skills for roles when user hasn't specified skills yet
        starter_skills_by_role = {
            "دیتا ساینس": ["Python", "Machine Learning", "Pandas", "SQL"],
            "یادگیری ماشین": ["Python", "PyTorch", "Machine Learning", "Docker"],
            "هوش مصنوعی": ["Python", "Deep Learning", "TensorFlow", "Machine Learning"],
            "مهندس داده": ["Python", "SQL", "Spark", "PostgreSQL"],
            "فرانت‌اند": ["React", "JavaScript", "HTML/CSS", "Tailwind CSS"],
            "بک‌اند": ["Python", "Django", "PostgreSQL", "REST API"],
            "فول‌استک": ["JavaScript", "React", "Node.js", "PostgreSQL"],
            "دواپس": ["Docker", "Linux", "Kubernetes", "CI/CD", "Git"],
            "طراح UI/UX": ["Figma", "UI/UX", "Design"],
            "موبایل": ["Flutter", "React Native"],
            "تست و QA": ["Test", "Postman", "Selenium"],
        }

        # ---- TARGET ROLE ----
        role_map = {
            "دیتا ساینس": [
                "دیتا ساینس", "دیتاساینس", "علم داده", "دانشمند داده",
                "data science", "data scientist", "data sience", "datasience", "datascience",
                "data sciense", "تحلیل داده", "data analyst", "دیتا آنالیست",
            ],
            "فرانت‌اند": [
                "فرانت", "front", "frontend", "front-end", "فرانتاند", "فرانت اند", "طراح وب",
            ],
            "بک‌اند": [
                "بک‌اند", "بکاند", "backend", "back-end", "back end", "بک اند",
            ],
            "فول‌استک": [
                "فول", "fullstack", "full-stack", "full stack", "فول استک", "فول‌استک",
            ],
            "دواپس": [
                "دواپس", "devops", "dev ops", "سیس ادمین", "sysadmin",
            ],
            "یادگیری ماشین": [
                "machine learning", "یادگیری ماشین", "ml engineer", "ماشین لرنینگ",
            ],
            "هوش مصنوعی": [
                "هوش مصنوعی", "artificial intelligence", "ai engineer", "ai",
            ],
            "موبایل": [
                "موبایل", "mobile", "اندروید", "android", "ios", "flutter", "react native", "فلاتر",
            ],
            "طراح UI/UX": [
                "ui", "ux", "ui/ux", "طراح محصول", "دیزاینر", "product design",
            ],
            "مدیر محصول": [
                "مدیر محصول", "product manager", "pm", "مدیریت محصول",
            ],
            "تست و QA": [
                "تست", "qa", "test", "quality", "تستر", "کنترل کیفیت",
            ],
            "مهندس داده": [
                "مهندس داده", "data engineer", "دیتا انجینیر", "پایپ لاین داده",
            ],
            "امنیت": [
                "امنیت", "security", "سایبر", "cyber", "امنیت شبکه",
            ],
            "مدیر پروژه": [
                "مدیر پروژه", "project manager", "اسکرام", "scrum",
            ],
        }
        for role, keywords in role_map.items():
            for kw in keywords:
                if kw in norm_lowered or kw in norm_text:
                    patch["target_role"] = role
                    break
            if "target_role" in patch:
                break

        # ---- LEVEL ----
        level_map = {
            "intern": [
                "کارآموز", "کار آموز", "intern", "internship", "اینترن", "آموزش پذیر",
            ],
            "junior": [
                "جونیور", "junior", "تازه‌کار", "تازه کار", "تازه‌وارد", "مبتدی", "ورودی", "تازه کارم",
            ],
            "mid": [
                "میدلول", "مید لول", "میدل", "mid", "middle", "mid-level", "midlevel",
                "میان‌رده", "میان رده", "سطحم میدلول", "سطهمم میدلول", "سطهم میدلول", "متوسط",
            ],
            "senior": [
                "سینیور", "senior", "ارشد", "سنیور", "حرفه‌ای", "پیشرفته", "با تجربه",
            ],
        }
        for level, keywords in level_map.items():
            for kw in keywords:
                if kw in norm_lowered or kw in norm_text:
                    patch["level"] = level
                    break
            if "level" in patch:
                break

        # ---- EXPERIENCE YEARS ----
        # Digits: "۲ سال" / "2 years" / "3 سال سابقه"
        years_m = _re.search(r'([0-9۰-۹]+)\s*(?:سال|year)', norm_lowered)
        if years_m:
            try:
                ystr = years_m.group(1).translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789"))
                patch["experience_years"] = int(ystr)
            except ValueError:
                pass
        # Zero experience phrasing: "سابقه هم ندارم", "سابقه ندارم", "بدون سابقه", "صفر", "تجربه ندارم"
        elif any(kw in norm_text for kw in (
            "ندارم", "نداشتم", "صفر", "بدون تجربه", "بدون سابقه", "سابقه ندارم",
            "سابقه هم ندارم", "سابقه‌ای ندارم", "کار نکردم", "تجربه‌ای ندارم",
            "تازه کارم", "دانشجو", "فارغ‌التحصیل", "هیچ سابقه‌ای", "۰ سال", "0 سال"
        )):
            patch["experience_years"] = 0
            if "level" not in patch:
                patch["level"] = "junior"
        # Word numbers: "یک سال", "دو سال", etc.
        word_nums = {"یک": 1, "دو": 2, "سه": 3, "چهار": 4, "پنج": 5, "شش": 6, "هفت": 7, "هشت": 8, "نه": 9, "ده": 10}
        if "experience_years" not in patch:
            for word, num in word_nums.items():
                if _re.search(word + r'\s*سال', norm_text):
                    patch["experience_years"] = num
                    break

        # ---- SKILLS ----
        catalogue = {
            "Python": ["python", "پایتون"],
            "Django": ["django", "جنگو"],
            "FastAPI": ["fastapi", "فست"],
            "Flask": ["flask", "فلاسک"],
            "JavaScript": ["javascript", "js", "جاوااسکریپت"],
            "TypeScript": ["typescript", "ts", "تایپ‌اسکریپت"],
            "React": ["react", "ریکت", "ری‌اکت"],
            "Next.js": ["next.js", "nextjs", "نکست"],
            "Vue.js": ["vue", "vue.js", "ویو"],
            "Angular": ["angular", "انگولار"],
            "Node.js": ["node", "node.js", "nodejs", "نود"],
            "HTML/CSS": ["html", "css"],
            "Tailwind CSS": ["tailwind", "تیلویند"],
            "PostgreSQL": ["postgresql", "postgres", "پستگرس"],
            "MySQL": ["mysql", "مای‌اس‌کیوال"],
            "MongoDB": ["mongodb", "mongo", "مونگو"],
            "Redis": ["redis", "ردیس"],
            "Docker": ["docker", "داکر"],
            "Kubernetes": ["kubernetes", "k8s", "کوبرنتیز"],
            "Git": ["git", "گیت"],
            "Linux": ["linux", "لینوکس"],
            "REST API": ["rest api", "rest", "restful"],
            "GraphQL": ["graphql"],
            "C#": ["c#", "سی‌شارپ", "سی شارپ"],
            ".NET": [".net", "دات‌نت", "dotnet"],
            "Java": ["java", "جاوا"],
            "Spring Boot": ["spring", "اسپرینگ"],
            "Go": ["golang", "گولنگ"],
            "PHP": ["php"],
            "Laravel": ["laravel", "لاراول"],
            "Ruby": ["ruby", "روبی"],
            "Rust": ["rust", "راست"],
            "Swift": ["swift", "سوئیفت"],
            "Kotlin": ["kotlin", "کاتلین"],
            "Flutter": ["flutter", "فلاتر"],
            "React Native": ["react native", "ری‌اکت نیتیو"],
            "Figma": ["figma", "فیگما"],
            "Machine Learning": ["machine learning", "یادگیری ماشین", "ml", "ماشین لرنینگ"],
            "Deep Learning": ["deep learning", "یادگیری عمیق", "دیپ لرنینگ"],
            "TensorFlow": ["tensorflow", "تنسورفلو"],
            "PyTorch": ["pytorch", "پای‌تورچ", "پایتورچ"],
            "Pandas": ["pandas", "پانداز"],
            "NumPy": ["numpy", "نامپای"],
            "Scikit-learn": ["scikit", "sklearn"],
            "Power BI": ["power bi", "پاور بی"],
            "Tableau": ["tableau", "تابلو"],
            "SQL": ["sql", "اس‌کیوال", "اس کیوال"],
            "Excel": ["excel", "اکسل"],
            "R": [" r ", "زبان r", "آر"],
            "Hadoop": ["hadoop", "هدوپ"],
            "Spark": ["spark", "اسپارک"],
            "AWS": ["aws", "آمازون"],
            "Azure": ["azure", "اژور"],
            "CI/CD": ["ci/cd", "cicd"],
            "Sass/SCSS": ["sass", "scss"],
            "Redux": ["redux", "ریداکس"],
            "Jira": ["jira", "جیرا"],
        }
        found_skills = []
        for canonical, aliases in catalogue.items():
            for alias in aliases:
                if alias in norm_lowered:
                    found_skills.append(canonical)
                    break

        # Check existing skills in user payload
        existing_skills = []
        sk_m = _re.search(r'"skills":\s*\[([^\]]*)\]', user)
        if sk_m:
            raw = sk_m.group(1)
            existing_skills = [s.strip().strip('"') for s in raw.split(',') if s.strip().strip('"')]

        if found_skills:
            merged = list(dict.fromkeys(existing_skills + found_skills))
            patch["skills"] = merged
        elif "target_role" in patch and not existing_skills:
            # Auto-assign sensible starter skills for the chosen role
            role = patch["target_role"]
            if role in starter_skills_by_role:
                patch["skills"] = starter_skills_by_role[role]

        # ---- CITY ----
        cities = [
            "تهران", "مشهد", "اصفهان", "شیراز", "تبریز", "کرج", "اهواز",
            "قم", "رشت", "کرمانشاه", "ارومیه", "زاهدان", "همدان", "کرمان",
            "یزد", "اردبیل", "بندرعباس", "اراک", "قزوین", "زنجان",
            "سنندج", "گرگان", "ساری", "بجنورد", "بوشهر", "بیرجند",
            "ایلام", "شهرکرد", "سمنان", "یاسوج", "خرم‌آباد",
            "شهرری", "شهر ری", "ری",
            "پاکدشت", "ملارد", "اسلامشهر", "شهریار", "ورامین", "پردیس", "دماوند",
        ]
        for city in cities:
            if city in norm_text:
                if city in ("شهرری", "شهر ری", "ری"):
                    patch["city"] = "شهرری"
                else:
                    patch["city"] = city
                break

        if "city" not in patch:
            if any(w in norm_text or w in norm_lowered for w in ("دورکار", "دورکاری", "remote", "ریموت", "انلاین", "آنلاین")):
                patch["remote_only"] = True

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
