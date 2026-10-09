"""Canonical schemas for the Job Analyzer Agent.

JobAnalysis is the ONE job-analysis schema in this repository. It is also the
schema Gemini is asked to produce, so it deliberately has no defaults: every
field must be emitted (unknown = null / []). Pydantic validators here run
locally only; Gemini's schema generation ignores them, and local
`model_validate_json` is the authoritative gate.

JobAnalysisResult is an envelope (verifier output + provenance), not a second
job schema. A future Match / Decision Agent should consume `result.job`.

(The Django model apps.jobs.models.JobPosting is the job *feed* record used by
the existing match engine; it carries no evidence and is intentionally separate.)
"""
from typing import Literal

from pydantic import BaseModel, field_validator

ANALYZER_VERSION = "job-analyzer/1"

SkillCategory = Literal[
    "language", "framework", "library", "tool", "platform", "database",
    "cloud", "methodology", "soft_skill", "domain", "other",
]

# Categories whose name must literally appear in the source text.
TECHNICAL_CATEGORIES = frozenset(
    {"language", "framework", "library", "tool", "platform", "database", "cloud"}
)


def _clean_optional(v):
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


class _Evidenced(BaseModel):
    # Verbatim excerpt of the job description supporting the claim.
    source_text: str | None

    @field_validator("source_text", mode="after")
    @classmethod
    def _clean_source(cls, v):
        return _clean_optional(v)


class TextClaim(_Evidenced):
    value: str
    # True only if the value is literally stated; False if normalized/inferred.
    explicit: bool

    @field_validator("value", mode="after")
    @classmethod
    def _value_not_blank(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("blank value")
        return v


class SkillClaim(_Evidenced):
    name: str
    category: SkillCategory
    explicit: bool

    @field_validator("name", mode="after")
    @classmethod
    def _name_not_blank(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("blank name")
        return v


class SalaryClaim(_Evidenced):
    min_amount: float | None
    max_amount: float | None
    currency: str | None
    period: str | None  # e.g. "month", "year", "hour"


class YearsClaim(_Evidenced):
    min_years: float | None
    max_years: float | None


class JobAnalysis(BaseModel):
    title: TextClaim | None
    company: TextClaim | None
    seniority: TextClaim | None
    employment_type: TextClaim | None
    location: TextClaim | None
    education: TextClaim | None
    salary: SalaryClaim | None
    years_experience: YearsClaim | None
    required_skills: list[SkillClaim]
    preferred_skills: list[SkillClaim]
    responsibilities: list[TextClaim]
    qualifications: list[TextClaim]
    certifications: list[TextClaim]
    languages: list[TextClaim]
    other_requirements: list[TextClaim]

    def skill_names(self, importance: Literal["required", "preferred"] = "required") -> list[str]:
        """Convenience for downstream agents (e.g. a future Match Agent)."""
        items = self.required_skills if importance == "required" else self.preferred_skills
        return [s.name for s in items]


class JobAnalysisResult(BaseModel):
    job: JobAnalysis
    warnings: list[str] = []
    analyzer_version: str = ANALYZER_VERSION
    provider: str | None = None
    model: str | None = None
