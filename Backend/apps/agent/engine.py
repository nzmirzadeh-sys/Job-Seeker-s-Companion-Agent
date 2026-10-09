"""Agent loop.

Builds a compact system+user prompt describing the user's state, asks the LLM
(or the rule-based provider) for a JSON action, executes the action with the
tool layer, and yields UI events. The chat endpoint streams these events to
the frontend over SSE.
"""
from __future__ import annotations

import json
import logging

from apps.agent import tools
from apps.accounts.models import Profile
from apps.resumes.models import Resume
from core.llm import LLMError, get_provider

MAX_STEPS = 3
logger = logging.getLogger(__name__)

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
- "create_resume": {"content": {...}}
- "edit_resume": {"resume_id": 123, "content": {...}}
- "none": هیچ ابزاری لازم نیست

قواعد:
- reply همیشه فارسی، گرم و کوتاه (حداکثر ۳ جمله).
- اگر کاربر اطلاعاتی مثل مهارت، شهر، سطح یا نقش هدف داد، از update_profile استفاده کن.
- برای «آگهی مناسب پیدا کن» یا «غربال کن» از search_jobs استفاده کن.
- برای «رزومه بساز/بهبود بده» از create_resume یا edit_resume استفاده کن.
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
    state = {
        "task": task_hint,
        "profile": _profile_state(user),
        "resume": _resume_state(user),
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
            return tools.tool_create_resume(user, args.get("content"))
        if action == "edit_resume":
            return tools.tool_edit_resume(
                user, int(args.get("resume_id") or 0), args.get("content") or {}
            )
        if action == "analyze_job":
            return tools.tool_analyze_job(user, str(args.get("description") or ""))
        if action == "match_job":
            return tools.tool_match_job(user, args.get("job_analysis"), bool(args.get("explain_with_llm")))
        if action == "none":
            return {}
        return {"error": "unknown action: " + str(action)}
    except Exception:
        # Never return exception text to the client (may contain internals/secrets).
        logger.exception("agent action failed: %s", action)
        return {"error": "action failed"}


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
        # Deterministic dispatch: a raw job description must not pass through
        # the routing LLM (it is untrusted data and could steer routing).
        action, args = "analyze_job", {"description": message}
    else:
        try:
            provider = get_provider()
            user_payload = build_user_payload(user, message, task_hint)
            llm_result = provider.chat(SYSTEM_PROMPT, user_payload, json_mode=True)
            action, args, reply_text = parse_action(llm_result.text)
        except LLMError:
            # Report provider failure to the user; do not switch to another model.
            action, args, reply_text = "none", {}, (
                "الان امکان اتصال به سرویس هوش مصنوعی وجود ندارد. لطفاً بعداً دوباره تلاش کنید."
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
        elif action == "analyze_job":
            err = tool_result.get("error")
            if err:
                code = err.get("code", "error") if isinstance(err, dict) else "error"
                reply_text = "تحلیل آگهی انجام نشد (" + code + "). لطفاً دوباره تلاش کن."
            else:
                job = tool_result["job_analysis"]["job"]
                reply_text = (
                    "آگهی تحلیل شد: " + str(len(job["required_skills"]))
                    + " مهارت الزامی و " + str(len(job["preferred_skills"])) + " مهارت مزیت شناسایی شد."
                )
        else:
            reply_text = "انجام شد."

    yield {"type": "assistant", "text": reply_text}

    if action == "update_profile":
        yield {"type": "profile_updated"}
    if action in ("create_resume", "edit_resume"):
        yield {"type": "resume_updated"}
