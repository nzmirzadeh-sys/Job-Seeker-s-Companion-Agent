"""Agent loop.

Builds a compact system+user prompt describing the user's state, asks the LLM
(or the rule-based provider) for a JSON action, executes the action with the
tool layer, and yields UI events. The chat endpoint streams these events to
the frontend over SSE.
"""
from __future__ import annotations

import json

from apps.agent import tools
from apps.accounts.models import Profile
from apps.resumes.models import Resume
from core.llm import LLMError, get_provider

MAX_STEPS = 3

SYSTEM_PROMPT = """تو «همراه کاریابی» هستی؛ ایجنت همراه جویندهٔ کار برای یک پلتفرم استخدام ایرانی.
وظایف تو:
۱) غربال آگهی‌های شغلی بر اساس پروفایل واقعی کاربر و توضیح دلیل تناسب یا عدم تناسب.
۲) ساخت و بهبود رزومهٔ استاندارد از روی پروفایل و بازخورد کاربر.
۳) به‌روزرسانی پروفایل وقتی کاربر اطلاعات جدیدی می‌دهد.

همیشه فقط یک JSON معتبر با این ساختار پاسخ بده:
{"action": "<action_name>", "reply": "<پاسخ فارسی کوتاه به کاربر>", ...args}

actionهای مجاز:
- "update_profile": {"patch": {فیلدهای پروفایل}}
- "search_jobs": {"query": "...", "top": 5}
- "score_job": {"job_id": 123}
- "create_resume": {"content": {"full_name":"...","headline":"...","email":"...","phone":"","city":"...","summary":"...","skills":[{"name":"..."}],"experiences":[],"projects":[],"educations":[],"languages":[{"name":"فارسی","level":"زبان مادری"}],"links":[]}}
- "edit_resume": {"resume_id": 123, "content": {...فیلدهایی که باید تغییر کنند}}
- "none": هیچ ابزاری لازم نیست

قواعد:
- reply همیشه فارسی، گرم و کوتاه (حداکثر ۳ جمله).
- اگر کاربر اطلاعاتی مثل مهارت، شهر، سطح یا نقش هدف داد، از update_profile استفاده کن.
- برای «آگهی مناسب پیدا کن» یا «غربال کن» از search_jobs استفاده کن.
- برای «رزومه بساز» از create_resume استفاده کن و حتماً content کامل با همه فیلدها از پروفایل کاربر بساز.
- برای «رزومه بهبود بده» از edit_resume با resume_id موجود استفاده کن.
- هیچ متن خارج از JSON ننویس."""


def _profile_state(user) -> dict:
    profile, _ = Profile.objects.get_or_create(user=user)
    return {
        "full_name": profile.full_name,
        "headline": profile.headline,
        "skills": profile.skills or [],
        "experience_years": profile.experience_years,
        "level": profile.level,
        "target_role": profile.target_role,
        "city": profile.city,
        "remote_only": profile.remote_only,
        "min_salary": profile.min_salary,
        "completed": profile.completed,
    }


def _resume_state(user) -> dict:
    active = Resume.objects.filter(user=user, active=True).first()
    if active is None:
        return {"has_resume": False, "versions": 0, "resume_id": None}
    return {
        "has_resume": True,
        "versions": Resume.objects.filter(user=user).count(),
        "resume_id": active.id,
        "active_version": active.version,
        "title": active.title,
    }


def build_user_payload(user, message: str, task_hint: str = "chat") -> str:
    profile_data = _profile_state(user)
    resume_data = _resume_state(user)
    # Include email from user model for resume generation
    state = {
        "task": task_hint,
        "profile": profile_data,
        "user_email": user.email or "",
        "resume": resume_data,
        "user_message": message,
    }
    return json.dumps(state, ensure_ascii=False)


def run_action(user, action: str, args: dict) -> dict:
    """Dispatch a parsed action to the tool layer. Returns a tool result dict."""
    args = args or {}
    try:
        if action == "update_profile":
            return tools.tool_update_profile(user, args.get("patch") or {})
        if action == "search_jobs":
            return tools.tool_search_jobs(
                user, query=args.get("query") or "", top=int(args.get("top") or 5)
            )
        if action == "score_job":
            return tools.tool_score_job(user, int(args.get("job_id") or 0))
        if action == "create_resume":
            # Support both "content" and "resume" keys from different providers
            content = args.get("content") or args.get("resume")
            return tools.tool_create_resume(user, content)
        if action == "edit_resume":
            resume_id = int(args.get("resume_id") or 0)
            # If no resume_id given, use the user's active resume
            if not resume_id:
                from apps.resumes.models import Resume as ResumeModel
                active = ResumeModel.objects.filter(user=user, active=True).first()
                if active:
                    resume_id = active.id
            return tools.tool_edit_resume(
                user, resume_id, args.get("content") or {}
            )
        # if action == "translate_resume":
        #     return tools.tool_translate_resume(user, int(args.get("resume_id") or 0))
        if action == "analyze_job":
            return tools.tool_analyze_job(user, str(args.get("description") or ""))
        if action == "none":
            return {}
        return {"error": "unknown action: " + str(action)}
    except Exception as exc:
        return {"error": str(exc)}


def parse_action(text: str) -> tuple[str, dict, str]:
    """Extract (action, args, reply) from an LLM response. Tolerates fences."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1:
        return "none", {}, cleaned[:400]
    try:
        data = json.loads(cleaned[start : end + 1])
    except Exception:
        return "none", {}, cleaned[:400]
    action = str(data.get("action") or "none")
    reply = str(data.get("reply") or "")
    args = {
        k: v for k, v in data.items() if k not in ("action", "reply")
    }
    return action, args, reply


def agent_turn(user, message: str, task_hint: str = "chat"):
    """Run one agent turn. Yields event dicts for SSE streaming.

    Events:
      {"type": "assistant", "text": ...}          final reply text
      {"type": "tool", "name": ..., "result": ...} tool execution info
      {"type": "profile_updated"} / {"type": "resume_updated"}
      {"type": "error", "text": ...}
    """
    reply_text = ""
    if task_hint == "analyze_job":
        action, args = "analyze_job", {"description": message}
    else:
        provider = get_provider()
        user_payload = build_user_payload(user, message, task_hint)
        try:
            llm_result = provider.chat(SYSTEM_PROMPT, user_payload, json_mode=True)
            action, args, reply_text = parse_action(llm_result.text)
        except LLMError as exc:
            action, args, reply_text = "none", {}, (
                "الان نمی‌توانم به مدل زبانی وصل شوم، اما می‌توانم آگهی‌ها را با موتور قاعده‌محور غربال کنم."
            )

    yield {"type": "status", "text": "در حال تحلیل…"}

    tool_result = run_action(user, action, args)
    if action != "none":
        yield {"type": "tool", "name": action, "result": tool_result}

    # If the reply is empty (bad model output), synthesize one from tool result
    if not reply_text:
        if action == "search_jobs" and tool_result.get("results"):
            top = tool_result["results"][0]
            reply_text = (
                "بهترین آگهی: " + top["title"] + " در " + top["company"]
                + " با امتیاز " + str(top["score"]) + " از ۱۰۰."
            )
        elif action == "update_profile":
            reply_text = "پروفایلت را به‌روزرسانی کردم ✓"
        elif action in ("create_resume", "edit_resume"):
            reply_text = "رزومه‌ات آماده شد ✓ می‌توانی پیش‌نمایش و PDF بگیری."
        # elif action == "translate_resume":
        #     reply_text = "رزومه به زبان انگلیسی استاندارد ترجمه و آماده شد ✓ نسخهٔ انگلیسی فعال است."
        elif action == "analyze_job":
            if tool_result.get("error"):
                reply_text = "تحلیل آگهی با خطا مواجه شد."
            else:
                job = (tool_result.get("job_analysis") or {})
                req_cnt = len(job.get("required_skills", []))
                reply_text = f"آگهی تحلیل شد: {req_cnt} مهارت الزامی استخراج و راستی‌آزمایی شد."
        else:
            reply_text = "انجام شد."

    yield {"type": "assistant", "text": reply_text}

    if action == "update_profile":
        yield {"type": "profile_updated"}
    if action in ("create_resume", "edit_resume"):
        yield {"type": "resume_updated"}
