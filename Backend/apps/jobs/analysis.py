"""Adapters from persisted job-feed records to the canonical JobAnalysis schema."""

from apps.jobs.models import JobPosting
from core.schemas import JobAnalysis

SKILL_CATEGORIES = {
    "language", "framework", "library", "tool", "platform", "database",
    "cloud", "methodology", "soft_skill", "domain", "other",
}


def job_analysis_from_posting(job: JobPosting) -> JobAnalysis:
    source = job.description or None

    def claim(value):
        return {"value": value, "explicit": True, "source_text": source}

    def skill_claim(value):
        if isinstance(value, dict):
            name = value.get("name")
            if not isinstance(name, str) or not name.strip():
                return None
            category = value.get("category", "other")
            if category not in SKILL_CATEGORIES:
                category = "other"
            return {
                "name": name.strip(),
                "category": category,
                "explicit": bool(value.get("explicit", True)),
                "source_text": value.get("source_text") or source,
            }
        if isinstance(value, str) and value.strip():
            return {
                "name": value.strip(),
                "category": "other",
                "explicit": True,
                "source_text": source,
            }
        return None

    return JobAnalysis.model_validate(
        {
            "title": claim(job.title) if job.title else None,
            "company": claim(job.company) if job.company else None,
            "seniority": claim(job.level) if job.level else None,
            "employment_type": claim(", ".join(job.job_types)) if job.job_types else None,
            "location": claim(job.city) if job.city else None,
            "education": None,
            "salary": (
                {
                    "min_amount": job.salary_min,
                    "max_amount": job.salary_max,
                    "currency": None,
                    "period": None,
                    "source_text": source,
                }
                if job.salary_min is not None or job.salary_max is not None
                else None
            ),
            "years_experience": None,
            "required_skills": [
                value
                for item in (job.required_skills or [])
                if (value := skill_claim(item)) is not None
            ],
            "preferred_skills": [
                value
                for item in (job.optional_skills or [])
                if (value := skill_claim(item)) is not None
            ],
            "responsibilities": [],
            "qualifications": [],
            "certifications": [],
            "languages": [],
            "other_requirements": [],
        }
    )
