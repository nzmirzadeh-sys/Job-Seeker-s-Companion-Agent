"""Agent tools — the actions the agent loop may take, with validation."""
from __future__ import annotations

import json

from apps.accounts.models import Profile
from apps.jobs.matching import score_job
from apps.jobs.models import JobPosting, Match
from apps.jobs.serializers import JobPostingSerializer
from apps.jobs.views import profile_dict_for, rescore_all
from apps.resumes.models import Resume

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
        if key not in PROFILE_FIELDS:
            continue
        # Allow 0 for numeric fields like experience_years
        if value is None or value == "" or value == [] or value == {}:
            continue
        expected = PROFILE_FIELDS[key]
        if isinstance(value, expected):
            setattr(profile, key, value)
            changed.append(key)
    if "skills" in changed:
        profile.skills = [str(s).strip() for s in profile.skills if str(s).strip()]
    # Profile is ready when we have target role and location
    profile.completed = bool(profile.target_role) and bool(profile.city or profile.remote_only)
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
    skills_list = [{"name": s} for s in (profile.skills or [])]
    # Build a meaningful summary from profile data
    parts = []
    if profile.full_name or profile.user.get_full_name():
        name = profile.full_name or profile.user.get_full_name()
        parts.append(name)
    if profile.target_role:
        parts.append(f"متخصص در حوزه {profile.target_role}")
    if profile.experience_years:
        parts.append(f"با {profile.experience_years} سال سابقه کاری")
    elif profile.level == "junior":
        parts.append("در مرحله شروع حرفه‌ای")
    if profile.city:
        parts.append(f"مقیم {profile.city}")
    if profile.skills:
        top_skills = (profile.skills or [])[:5]
        parts.append(f"مهارت‌های اصلی: {', '.join(top_skills)}")
    summary = "، ".join(parts) + "." if parts else ""

    return {
        "full_name": profile.full_name or profile.user.get_full_name() or profile.user.username,
        "headline": profile.headline or profile.target_role or "",
        "email": profile.user.email or "",
        "phone": "",
        "city": profile.city or "",
        "summary": summary,
        "skills": skills_list,
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
            # Allow overwriting with agent-provided content unless it's empty
            if value is None or value == "" or value == [] or value == {}:
                continue
            base[key] = value
    # Ensure required fields always have values from profile if agent didn't provide them
    if not base.get("full_name"):
        base["full_name"] = profile.user.username
    if not base.get("headline") and profile.target_role:
        base["headline"] = profile.target_role
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


# def tool_translate_resume(user, resume_id: int = 0) -> dict:
#     from apps.resumes.translation import translate_resume_to_english
#     if resume_id:
#         resume = Resume.objects.filter(user=user, id=resume_id).first()
#     else:
#         resume = Resume.objects.filter(user=user, active=True).first() or Resume.objects.filter(user=user).first()
#     if not resume:
#         return {"error": "no resume found"}
#     translated = translate_resume_to_english(resume.content)
#     last = Resume.objects.filter(user=user).order_by("-version").first()
#     version = (last.version + 1) if last else 1
#     new_resume = Resume.objects.create(
#         user=user,
#         version=version,
#         title=f"English CV (v{version})",
#         content=translated,
#         active=True,
#     )
#     Resume.objects.filter(user=user).exclude(id=new_resume.id).update(active=False)
#     return {"resume_id": new_resume.id, "version": new_resume.version}


def tool_set_active_resume(user, resume_id: int) -> dict:
    resume = Resume.objects.filter(user=user, id=resume_id).first()
    if resume is None:
        return {"error": "resume not found"}
    Resume.objects.filter(user=user).update(active=False)
    resume.active = True
    resume.save()
    return {"resume_id": resume.id, "active": True}


def tool_analyze_job(user, description: str) -> dict:
    """Invokes the Job Analyzer Agent and returns structured output."""
    try:
        from core.job_analyzer import analyze_job_description, JobAnalyzerError
        analyzed = analyze_job_description(description)
        return {"job_analysis": analyzed.model_dump(mode="json")}
    except Exception as exc:
        return {"error": str(exc)}
