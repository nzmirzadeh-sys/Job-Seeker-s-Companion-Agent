"""Stage 3 Match / Decision Agent.

The score is deterministic and auditable. A language model may optionally
rewrite the explanation, but it never decides the score or decision.
"""
from __future__ import annotations

import json
import re
from typing import Any

from core.career_schemas import CareerMemorySnapshot, SkillProfile
from typing import Protocol

class ExplanationProvider(Protocol):
    def chat(self, system: str, user: str, json_mode: bool = False, response_schema=None): ...
from core.match_schemas import (
    ConstraintEvaluation, FitDimension, MatchExplanation, MatchResult, SkillMatchDetail,
)
from core.schemas import JobAnalysis, JobAnalysisResult

FA_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")
ALIASES = {
    "js": "javascript", "reactjs": "react", "react js": "react", "ts": "typescript",
    "nodejs": "node", "node js": "node", "next js": "nextjs", "next": "nextjs",
    "vue.js": "vue", "css3": "css", "html5": "html", "restful": "rest api",
    "پایتون": "python", "جاوااسکریپت": "javascript", "تایپ اسکریپت": "typescript", "ری اکت": "react",
    "نود جی اس": "node", "نکست جی اس": "nextjs",
}

WEIGHTS = {"technical": 40, "experience": 15, "education": 10, "goal": 10, "preference": 10, "constraint": 15}


def norm(value: Any) -> str:
    text = str(value or "").translate(FA_DIGITS).strip().lower()
    text = text.replace("ي", "ی").replace("ك", "ک")
    text = re.sub(r"[\u200c\s]+", " ", text)
    text = re.sub(r"[.,;:()\[\]{}]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def canon(value: Any) -> str:
    v = norm(value)
    return ALIASES.get(v, v)


def tokens(value: Any) -> set[str]:
    return {t for t in canon(value).split() if len(t) > 1}


def contains_any(text: str, choices: list[str]) -> bool:
    n = norm(text)
    return any(canon(c) in n or n in canon(c) for c in choices if str(c).strip())


def _evidence(skill: SkillProfile) -> list[dict]:
    return [e.model_dump(mode="json") for e in skill.evidence]


def _job(value: Any) -> JobAnalysis:
    if isinstance(value, JobAnalysisResult):
        return value.job
    if isinstance(value, JobAnalysis):
        return value
    if isinstance(value, dict):
        raw = value.get("job") if "job" in value else value
        return JobAnalysis.model_validate(raw)
    raise TypeError("job_analysis must be JobAnalysis, JobAnalysisResult, or dict")


def _user_years(memory: CareerMemorySnapshot) -> float | None:
    values = [float(x.years) for x in memory.experiences if x.years is not None]
    values += [float(s.years_of_experience) for s in memory.skills if s.years_of_experience is not None]
    raw = memory.identity.get("experience_years")
    if raw is not None:
        try: values.append(float(raw))
        except (TypeError, ValueError): pass
    return max(values) if values else None


def _experience(job: JobAnalysis, memory: CareerMemorySnapshot) -> FitDimension:
    max_score = WEIGHTS["experience"]
    req = job.years_experience
    if req is None:
        return FitDimension(score=max_score // 2, max_score=max_score, status="not_applicable", explanation="آگهی حداقل/حداکثر سابقه مشخصی ارائه نکرده است.")
    user_years = _user_years(memory)
    if user_years is None:
        return FitDimension(score=max_score // 2, max_score=max_score, status="unknown", explanation="سابقه قابل‌استناد کاربر برای مقایسه مشخص نیست.")
    if req.min_years is not None and user_years < req.min_years:
        ratio = max(0.0, user_years / req.min_years) if req.min_years else 0.0
        score = round(max_score * min(0.5, ratio))
        return FitDimension(score=score, max_score=max_score, status="conflict", explanation=f"حداقل سابقه آگهی {req.min_years:g} سال است و سابقه مستند کاربر حدود {user_years:g} سال است.")
    if req.max_years is not None and user_years > req.max_years:
        return FitDimension(score=round(max_score * 0.8), max_score=max_score, status="partial", explanation=f"سابقه کاربر ({user_years:g} سال) از سقف اعلام‌شده آگهی ({req.max_years:g} سال) بیشتر است.")
    return FitDimension(score=max_score, max_score=max_score, status="match", explanation=f"سابقه کاربر ({user_years:g} سال) با شرط سابقه آگهی سازگار است.")


def _education(job: JobAnalysis, memory: CareerMemorySnapshot) -> FitDimension:
    max_score = WEIGHTS["education"]
    if job.education is None:
        return FitDimension(score=max_score // 2, max_score=max_score, status="not_applicable", explanation="مدرک تحصیلی مشخصی در آگهی ثبت نشده است.")
    if not memory.education:
        return FitDimension(score=max_score // 2, max_score=max_score, status="unknown", explanation="آموزش/مدرک ثبت‌شده‌ای در Career Memory برای تطبیق وجود ندارد.")
    requirement = norm(job.education.value)
    best = 0
    matched = False
    for edu in memory.education:
        text = norm(" ".join([edu.degree, edu.field or "", edu.school or ""]))
        overlap = len(tokens(requirement) & tokens(text))
        best = max(best, overlap)
        if overlap >= 2:
            matched = True
            break
    if matched:
        return FitDimension(score=max_score, max_score=max_score, status="match", explanation="حداقل بخشی از مدرک/رشته موردنیاز با تحصیلات ثبت‌شده تطبیق دارد.")
    return FitDimension(score=0 if best == 0 else max_score // 2, max_score=max_score, status="conflict" if best == 0 else "partial", explanation="تحصیلات ثبت‌شده با متن شرط تحصیلی آگهی تطابق روشن ندارد.")


def _goals(job: JobAnalysis, memory: CareerMemorySnapshot) -> FitDimension:
    max_score = WEIGHTS["goal"]
    goals = [g for g in memory.goals if g.role.strip()]
    if not goals:
        return FitDimension(score=max_score // 2, max_score=max_score, status="unknown", explanation="هدف شغلی ثبت‌شده‌ای برای مقایسه وجود ندارد.")
    title = job.title.value if job.title else ""
    matches = [g for g in goals if tokens(g.role) & tokens(title)]
    if matches:
        return FitDimension(score=max_score, max_score=max_score, status="match", explanation="عنوان آگهی با یکی از نقش‌های هدف Career Memory هم‌خوان است.")
    # A soft directional match: a word from any goal direction in title/company.
    direction_text = norm(" ".join([g.direction or "" for g in goals]))
    if direction_text and tokens(direction_text) & tokens(title):
        return FitDimension(score=round(max_score * 0.7), max_score=max_score, status="partial", explanation="جهت حرفه‌ای ثبت‌شده تا حدی با عنوان آگهی هم‌راستاست.")
    return FitDimension(score=0, max_score=max_score, status="conflict", explanation="عنوان آگهی با نقش هدف ثبت‌شده هم‌خوانی روشنی ندارد.")


def _preferences(job: JobAnalysis, memory: CareerMemorySnapshot) -> FitDimension:
    max_score = WEIGHTS["preference"]
    prefs = memory.preferences
    if not prefs:
        return FitDimension(score=max_score // 2, max_score=max_score, status="unknown", explanation="ترجیحات کاری ثبت‌شده‌ای برای مقایسه وجود ندارد.")
    score = max_score // 2
    statuses = []
    for p in prefs:
        cat = canon(p.category)
        value = canon(p.value)
        if cat in {"work mode", "work_mode", "remote", "work type", "work_type"}:
            job_work = " ".join([canon(job.employment_type.value if job.employment_type else ""), canon(job.location.value if job.location else "")])
            if value in {"remote", "دورکاری"}:
                if "remote" in job_work: score += 3; statuses.append("match")
                else: score -= 3; statuses.append("conflict")
            elif value in {"hybrid", "حضوری", "onsite", "on site"}:
                if contains_any(job_work, [value]): score += 2; statuses.append("match")
                else: statuses.append("unknown")
        elif cat in {"location", "city"}:
            job_loc = job.location.value if job.location else ""
            if job_loc and contains_any(job_loc, [value]): score += 2; statuses.append("match")
            elif job_loc: score -= 2; statuses.append("conflict")
            else: statuses.append("unknown")
        elif cat in {"employment type", "employment_type", "job type", "job_type"}:
            if job.employment_type and contains_any(job.employment_type.value, [value]): score += 2; statuses.append("match")
            else: statuses.append("unknown")
    score = max(0, min(max_score, score))
    status = "conflict" if "conflict" in statuses and score < max_score // 2 else ("match" if "match" in statuses else "unknown")
    return FitDimension(score=score, max_score=max_score, status=status, explanation="ترجیحات شغلی ثبت‌شده با شرایط آگهی مقایسه شد؛ موارد نامشخص به‌عنوان عدم‌اطمینان باقی ماندند.")


def _parse_money(value: str) -> tuple[float | None, str | None]:
    n = norm(value)
    k_match = re.search(r"(\d+(?:\.\d+)?)\s*k\b", n)
    if k_match:
        amount = float(k_match.group(1)) * 1000
    else:
        nums = re.findall(r"\d+(?:\.\d+)?", n.replace(",", ""))
        amount = float(nums[0]) if nums else None
    currency = None
    if any(x in n for x in ["usd", "dollar", "$", "دلار"]): currency = "usd"
    elif any(x in n for x in ["eur", "euro", "€"]): currency = "eur"
    elif any(x in n for x in ["irr", "toman", "تومان", "ریال"]): currency = "irr"
    return amount, currency


def _constraint_one(job: JobAnalysis, c, memory: CareerMemorySnapshot) -> ConstraintEvaluation:
    cat, val = canon(c.category), norm(c.value)
    evidence = [e.model_dump(mode="json") for e in c.evidence]
    if cat in {"salary", "minimum salary", "min_salary", "حقوق"}:
        if job.salary is None or job.salary.min_amount is None:
            return ConstraintEvaluation(category=c.category, value=c.value, hard=c.hard, status="unknown", explanation="آگهی حقوق قابل مقایسه‌ای ندارد.", evidence=evidence)
        req_amount, req_currency = _parse_money(c.value)
        job_currency = canon(job.salary.currency or "")
        if req_amount is None:
            return ConstraintEvaluation(category=c.category, value=c.value, hard=c.hard, status="unknown", explanation="حداقل حقوق کاربر قابل استخراج نیست.", evidence=evidence)
        if req_currency and job_currency and req_currency != job_currency:
            return ConstraintEvaluation(category=c.category, value=c.value, hard=c.hard, status="unknown", explanation="واحد پول محدودیت و آگهی متفاوت است.", evidence=evidence)
        satisfied = job.salary.max_amount is not None and job.salary.max_amount >= req_amount
        return ConstraintEvaluation(category=c.category, value=c.value, hard=c.hard, status="satisfied" if satisfied else "violated", explanation=("بازه حقوق آگهی حداقل شرط را پوشش می‌دهد." if satisfied else "حداقل حقوق موردنظر کاربر توسط آگهی پوشش داده نمی‌شود."), evidence=evidence)
    if cat in {"work authorization", "authorization", "مجوز کار"}:
        return ConstraintEvaluation(category=c.category, value=c.value, hard=c.hard, status="unknown", explanation="این شرط در JobAnalysis فعلی قابل راستی‌آزمایی نیست.", evidence=evidence)
    if cat in {"location", "city", "مکان"}:
        if not job.location:
            return ConstraintEvaluation(category=c.category, value=c.value, hard=c.hard, status="unknown", explanation="مکان آگهی مشخص نیست.", evidence=evidence)
        ok = contains_any(job.location.value, [c.value])
        return ConstraintEvaluation(category=c.category, value=c.value, hard=c.hard, status="satisfied" if ok else "violated", explanation=("مکان آگهی با محدودیت شما سازگار است." if ok else "مکان آگهی با محدودیت مکانی شما ناسازگار است."), evidence=evidence)
    if cat in {"employment type", "employment_type", "نوع همکاری"}:
        if not job.employment_type:
            return ConstraintEvaluation(category=c.category, value=c.value, hard=c.hard, status="unknown", explanation="نوع همکاری آگهی مشخص نیست.", evidence=evidence)
        ok = contains_any(job.employment_type.value, [c.value])
        return ConstraintEvaluation(category=c.category, value=c.value, hard=c.hard, status="satisfied" if ok else "violated", explanation=("نوع همکاری سازگار است." if ok else "نوع همکاری با محدودیت کاربر ناسازگار است."), evidence=evidence)
    if cat in {"degree", "education", "مدرک"}:
        if not job.education or not memory.education:
            return ConstraintEvaluation(category=c.category, value=c.value, hard=c.hard, status="unknown", explanation="مدرک موردنیاز یا مدرک کاربر برای مقایسه کامل نیست.", evidence=evidence)
        ok = contains_any(job.education.value, [c.value]) or any(contains_any(job.education.value, [e.degree, e.field or ""]) for e in memory.education)
        return ConstraintEvaluation(category=c.category, value=c.value, hard=c.hard, status="satisfied" if ok else "violated", explanation=("شرط تحصیلی سازگار به نظر می‌رسد." if ok else "شرط تحصیلی با اطلاعات موجود ناسازگار است."), evidence=evidence)
    return ConstraintEvaluation(category=c.category, value=c.value, hard=c.hard, status="unknown", explanation="این نوع محدودیت در JobAnalysis فعلی قابل ارزیابی قطعی نیست.", evidence=evidence)


def _constraints(job: JobAnalysis, memory: CareerMemorySnapshot) -> tuple[FitDimension, list[ConstraintEvaluation], bool, bool]:
    max_score = WEIGHTS["constraint"]
    if not memory.constraints:
        return FitDimension(score=max_score // 2, max_score=max_score, status="unknown", explanation="محدودیت صریحی در Career Memory ثبت نشده است."), [], False, False
    results = [_constraint_one(job, c, memory) for c in memory.constraints]
    hard_violated = any(x.hard and x.status == "violated" for x in results)
    hard_unknown = any(x.hard and x.status == "unknown" for x in results)
    sat = sum(1 for x in results if x.status == "satisfied")
    viol = sum(1 for x in results if x.status == "violated")
    unknown = sum(1 for x in results if x.status == "unknown")
    n = len(results)
    score = round(max_score * ((sat + 0.5 * unknown) / n)) if n else max_score // 2
    status = "conflict" if viol else ("unknown" if unknown else "match")
    explanation = "؛ ".join(x.explanation for x in results[:3])
    return FitDimension(score=score, max_score=max_score, status=status, explanation=explanation), results, hard_violated, hard_unknown


def _technical(job: JobAnalysis, memory: CareerMemorySnapshot) -> tuple[FitDimension, list[SkillMatchDetail], list[str], list[str], list[str]]:
    req = job.required_skills
    pref = job.preferred_skills
    if not req and not pref:
        return FitDimension(score=WEIGHTS["technical"] // 2, max_score=WEIGHTS["technical"], status="not_applicable", explanation="آگهی مهارت ساختاریافته‌ای برای تطبیق ارائه نکرده است."), [], [], [], []
    details = []
    confirmed = []
    missing_req = []
    missing_pref = []
    uncertain = []
    req_points = 0.0
    if req:
        per = (WEIGHTS["technical"] * 0.8) / len(req)
        for js in req:
            match = next((s for s in memory.skills if canon(s.name) == canon(js.name)), None)
            if match and match.status == "confirmed":
                req_points += per; confirmed.append(js.name)
                details.append(SkillMatchDetail(skill=js.name, importance="required", status="confirmed_match", user_status=match.status, evidence=_evidence(match), explanation=f"{js.name} در Career Memory با وضعیت confirmed ثبت شده است."))
            elif match and match.status in {"unverified", "needs_clarification"}:
                req_points += per * 0.5; uncertain.append(js.name)
                details.append(SkillMatchDetail(skill=js.name, importance="required", status="uncertain_match", user_status=match.status, evidence=_evidence(match), explanation=f"{js.name} وجود دارد اما وضعیت آن {match.status} است و match قطعی محسوب نمی‌شود."))
            else:
                missing_req.append(js.name)
                details.append(SkillMatchDetail(skill=js.name, importance="required", status="rejected" if match and match.status == "rejected" else "missing", user_status=match.status if match else None, evidence=_evidence(match) if match else [], explanation=(f"{js.name} توسط کاربر رد شده است." if match and match.status == "rejected" else f"{js.name} شواهد confirmed در Career Memory ندارد.")))
    if pref:
        per = (WEIGHTS["technical"] * 0.2) / len(pref)
        for js in pref:
            match = next((s for s in memory.skills if canon(s.name) == canon(js.name)), None)
            if match and match.status == "confirmed":
                req_points += per; confirmed.append(js.name)
                details.append(SkillMatchDetail(skill=js.name, importance="preferred", status="confirmed_match", user_status=match.status, evidence=_evidence(match), explanation=f"{js.name} به‌عنوان مهارت ترجیحی آگهی با شواهد confirmed وجود دارد."))
            elif match and match.status in {"unverified", "needs_clarification"}:
                req_points += per * 0.5; uncertain.append(js.name)
                details.append(SkillMatchDetail(skill=js.name, importance="preferred", status="uncertain_match", user_status=match.status, evidence=_evidence(match), explanation=f"{js.name} برای کاربر ثبت شده ولی هنوز تأیید قطعی نشده است."))
            else:
                missing_pref.append(js.name)
                details.append(SkillMatchDetail(skill=js.name, importance="preferred", status="missing", user_status=match.status if match else None, evidence=_evidence(match) if match else [], explanation=f"{js.name} در Career Memory شواهدی ندارد."))
    max_score = WEIGHTS["technical"]
    score = round(req_points)
    status = "conflict" if missing_req else ("partial" if uncertain or missing_pref else "match")
    return FitDimension(score=score, max_score=max_score, status=status, explanation="امتیاز مهارت فقط بر اساس وضعیت Career Memory محاسبه شده؛ unverified هرگز معادل confirmed نیست."), details, sorted(set(confirmed)), sorted(set(missing_req)), sorted(set(missing_pref)), sorted(set(uncertain))


def _decision(score: int, has_uncertainty: bool, hard_violated: bool, hard_unknown: bool) -> str:
    if hard_violated: return "not_recommended"
    if hard_unknown: return "needs_more_information"
    if has_uncertainty and score >= 70: return "needs_more_information"
    if score >= 85: return "strong_match"
    if score >= 70: return "good_match"
    if score >= 50: return "partial_match"
    if score >= 30: return "weak_match"
    return "not_recommended"


class MatchDecisionAgent:
    name = "match_decision"

    def __init__(self, provider: ExplanationProvider | None = None, enable_llm_explanation: bool = False):
        self._provider = provider
        self.enable_llm_explanation = enable_llm_explanation

    def _deterministic_text(self, result: MatchResult) -> tuple[list[str], list[str], list[str], str, str]:
        strengths = []
        gaps = []
        risks = []
        for label, dim in [("فنی", result.technical_fit), ("سابقه", result.experience_fit), ("تحصیلات", result.education_fit), ("هدف شغلی", result.career_goal_fit), ("ترجیحات", result.preference_fit), ("محدودیت‌ها", result.constraint_fit)]:
            if dim.status == "match": strengths.append(f"{label}: {dim.explanation}")
            elif dim.status == "conflict": gaps.append(f"{label}: {dim.explanation}")
            elif dim.status == "unknown": risks.append(f"{label}: اطلاعات کافی نیست.")
        if result.missing_required_skills: gaps.append("مهارت‌های الزامی بدون شواهد confirmed: " + "، ".join(result.missing_required_skills))
        if result.uncertain_matches: risks.append("مهارت‌های نیازمند تأیید: " + "، ".join(result.uncertain_matches))
        for c in result.constraints:
            if c.status == "violated": risks.append(f"محدودیت نقض‌شده: {c.category} = {c.value}")
            elif c.status == "unknown" and c.hard: risks.append(f"محدودیت سخت نامشخص: {c.category} = {c.value}")
        reasoning = f"امتیاز {result.overall_score}/100 از ترکیب وزن‌دار تناسب فنی، سابقه، تحصیلات، هدف شغلی، ترجیحات و محدودیت‌ها محاسبه شده است."
        recommendation = {
            "strong_match": "برای این فرصت اقدام کنید؛ شواهد موجود تناسب بالایی را نشان می‌دهد.",
            "good_match": "این فرصت ارزش بررسی و اقدام دارد، ولی جزئیات مشخص‌شده در شکاف‌ها را در نظر بگیرید.",
            "partial_match": "اقدام ممکن است منطقی باشد، به‌خصوص اگر برای شکاف‌های اصلی برنامه داشته باشید.",
            "weak_match": "این فرصت تطابق محدودی دارد و بهتر است فقط در صورت وجود انگیزه یا شرایط خاص پیگیری شود.",
            "not_recommended": "با توجه به شکاف‌ها یا محدودیت‌های ناسازگار، این فرصت توصیه نمی‌شود.",
            "needs_more_information": "پیش از تصمیم نهایی، اطلاعات/تأیید بیشتری درباره موارد نامشخص لازم است.",
        }[result.overall_decision]
        return strengths, gaps, risks, reasoning, recommendation

    def _apply_llm_explanation(self, result: MatchResult) -> MatchResult:
        if not self.enable_llm_explanation or self._provider is None:
            return result
        facts = result.model_dump(mode="json")
        prompt = (
            "<match_facts>\n" + json.dumps(facts, ensure_ascii=False) + "\n</match_facts>\n"
            "Rewrite only strengths, gaps, risks, reasoning and recommendation in Persian. "
            "Do not change the decision, score, lists of skills, constraints, or any factual item."
        )
        try:
            res = self._provider.chat(
                "You are an explanation writer. Never change the deterministic decision or invent facts. Return only the supplied schema.",
                prompt, json_mode=True, response_schema=MatchExplanation,
            )
            explanation = MatchExplanation.model_validate_json(res.text)
            result.strengths = explanation.strengths or result.strengths
            result.gaps = explanation.gaps or result.gaps
            result.risks = explanation.risks or result.risks
            result.reasoning = explanation.reasoning or result.reasoning
            result.recommendation = explanation.recommendation or result.recommendation
            result.llm_explanation_used = True
        except Exception:
            # Optional narration must never break deterministic matching.
            result.llm_explanation_used = False
        return result

    def analyze(self, job_analysis: Any, memory: CareerMemorySnapshot) -> MatchResult:
        job = _job(job_analysis)
        technical, details, matching, missing_req, missing_pref, uncertain = _technical(job, memory)
        experience = _experience(job, memory)
        education = _education(job, memory)
        goal = _goals(job, memory)
        preference = _preferences(job, memory)
        constraint, constraints, hard_violated, hard_unknown = _constraints(job, memory)
        weighted = (
            technical.score + experience.score + education.score + goal.score + preference.score + constraint.score
        )
        score = max(0, min(100, int(round(weighted))))
        has_uncertainty = bool(missing_req or uncertain or technical.status == "unknown" or experience.status == "unknown" or education.status == "unknown" or goal.status == "unknown" or preference.status == "unknown")
        decision = _decision(score, has_uncertainty, hard_violated, hard_unknown)
        result = MatchResult(
            overall_decision=decision,
            overall_score=score,
            technical_fit=technical,
            experience_fit=experience,
            education_fit=education,
            career_goal_fit=goal,
            preference_fit=preference,
            constraint_fit=constraint,
            skill_matches=details,
            matching_skills=matching,
            missing_required_skills=missing_req,
            missing_preferred_skills=missing_pref,
            uncertain_matches=uncertain,
            strengths=[], gaps=[], risks=[], constraints=constraints,
            reasoning="", recommendation="",
        )
        strengths, gaps, risks, reasoning, recommendation = self._deterministic_text(result)
        result.strengths, result.gaps, result.risks = strengths, gaps, risks
        result.reasoning, result.recommendation = reasoning, recommendation
        return self._apply_llm_explanation(result)
