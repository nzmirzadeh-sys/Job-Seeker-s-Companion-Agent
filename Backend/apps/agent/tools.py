"""Agent tools — the actions the agent loop may take, with validation."""
from __future__ import annotations

import json

from apps.accounts.models import Profile
from apps.jobs.matching import score_job
from apps.jobs.models import JobPosting, Match
from apps.jobs.serializers import JobPostingSerializer
from apps.jobs.views import profile_dict_for, rescore_all
from apps.resumes.models import Resume
from core.job_analyzer import JobAnalyzerAgent, JobAnalyzerError
from core.match_agent import MatchDecisionAgent
from core.llm import LLMNotConfiguredError, get_provider
from core.memory_service import MemoryService

PROFILE_FIELDS = {
    "full_name": str,
    "headline": str,
    "skills": list,
    "experience_years": (int, float),
    "level": str,
    "target_role": str,
    "city": str,
    "remote_only": bool,
    "preferred_job_types": list,
    "min_salary": int,
    "education": str,
    "languages": list,
}


def tool_update_profile(user, patch: dict) -> dict:
    profile, _ = Profile.objects.get_or_create(user=user)
    changed = []
    for key, value in (patch or {}).items():
        if key not in PROFILE_FIELDS or value in (None, "", [], {}):
            continue
        expected = PROFILE_FIELDS[key]
        if isinstance(value, expected):
            setattr(profile, key, value)
            changed.append(key)
    if "skills" in changed:
        profile.skills = [str(s).strip() for s in profile.skills if str(s).strip()]
    has_core = bool(profile.full_name or profile.headline)
    profile.completed = has_core and bool(profile.skills)
    profile.save()
    if changed:
        rescore_all(user)
    return {"updated": changed, "completed": profile.completed}


def tool_search_jobs(user, query: str = "", top: int = 5) -> dict:
    rescore_all(user)
    qs = (
        Match.objects.filter(user=user)
        .exclude(status="dismissed")
        .select_related("job")
        .order_by("-score")[: max(1, min(int(top), 10))]
    )
    results = []
    for m in qs:
        results.append(
            {
                "job_id": m.job_id,
                "title": m.job.title,
                "company": m.job.company,
                "city": m.job.city,
                "level": m.job.level,
                "score": m.score,
                "reasons": (m.reasons or [])[:3],
                "missing_skills": (m.missing_skills or [])[:4],
            }
        )
    return {"results": results, "query": query}


def tool_score_job(user, job_id: int) -> dict:
    job = JobPosting.objects.filter(id=job_id).first()
    if job is None:
        return {"error": "job not found"}
    result = score_job(profile_dict_for(user), JobPostingSerializer(job).data)
    return {
        "job_id": job.id,
        "title": job.title,
        "company": job.company,
        **result,
    }


def _default_resume_content(profile: Profile) -> dict:
    return {
        "full_name": profile.full_name or profile.user.get_full_name() or profile.user.username,
        "headline": profile.headline or profile.target_role or "",
        "email": profile.user.email or "",
        "phone": "",
        "city": profile.city or "",
        "summary": "",
        "skills": [{"name": s} for s in (profile.skills or [])],
        "experiences": [],
        "projects": [],
        "educations": (
            [{"degree": profile.education, "school": "", "start": "", "end": ""}]
            if profile.education
            else []
        ),
        "languages": [{"name": "فارسی", "level": "زبان مادری"}],
        "links": [],
    }


def tool_create_resume(user, content: dict | None = None) -> dict:
    profile, _ = Profile.objects.get_or_create(user=user)
    base = _default_resume_content(profile)
    if content:
        for key, value in content.items():
            if value in (None, "", [], {}):
                continue
            base[key] = value
    last = (
        Resume.objects.filter(user=user).order_by("-version").first()
    )
    version = (last.version + 1) if last else 1
    resume = Resume.objects.create(
        user=user, version=version, content=base, active=True, title="رزومهٔ من"
    )
    Resume.objects.filter(user=user).exclude(id=resume.id).update(active=False)
    return {"resume_id": resume.id, "version": resume.version}


def tool_edit_resume(user, resume_id: int, content: dict) -> dict:
    resume = Resume.objects.filter(user=user, id=resume_id).first()
    if resume is None:
        return {"error": "resume not found"}
    merged = dict(resume.content or {})
    for key, value in (content or {}).items():
        if value in (None, "", [], {}):
            continue
        merged[key] = value
    resume.content = merged
    resume.save()
    return {"resume_id": resume.id, "version": resume.version, "updated": list(content.keys())}


def tool_set_active_resume(user, resume_id: int) -> dict:
    resume = Resume.objects.filter(user=user, id=resume_id).first()
    if resume is None:
        return {"error": "resume not found"}
    Resume.objects.filter(user=user).update(active=False)
    resume.active = True
    resume.save()
    return {"resume_id": resume.id, "active": True}


def tool_analyze_job(user, description: str) -> dict:
    """ADAPTER ONLY. Invokes the Job Analyzer Agent; contains no analysis logic.

    `user` is accepted for tool-signature uniformity; Career Memory is not touched.
    """
    try:
        result = JobAnalyzerAgent().analyze(description)
    except JobAnalyzerError as exc:
        return {"error": exc.public()}
    return {"job_analysis": result.model_dump(mode="json")}


def tool_match_job(user, job_analysis: dict | None, explain_with_llm: bool = False) -> dict:
    """Adapter for Stage 3. Reads Career Memory through MemoryService only."""
    if not job_analysis:
        return {"error": {"code": "job_analysis_required", "message": "Job analysis is required.", "retryable": False}}
    try:
        memory = MemoryService(user)
        provider = get_provider() if explain_with_llm else None
        result = MatchDecisionAgent(provider=provider, enable_llm_explanation=explain_with_llm).analyze(job_analysis, memory.snapshot())
    except LLMNotConfiguredError:
        return {"error": {"code": "llm_not_configured", "message": "The OpenRouter service is not configured.", "retryable": True}}
    except Exception:
        return {"error": {"code": "match_error", "message": "Match analysis failed.", "retryable": False}}
    return {"match_result": result.model_dump(mode="json")}
