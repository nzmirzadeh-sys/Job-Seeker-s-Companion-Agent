"""Canonical schemas for the Job Analyzer Agent.

JobAnalysis is the ONE job-analysis schema in this repository. It is the JSON
schema requested from the model, so it deliberately has no defaults: every
field must be emitted (unknown = null / []). Provider-side schema enforcement
is optional; local
`model_validate_json` is the authoritative gate.

JobAnalysisResult is an envelope (verifier output + provenance), not a second
job schema. A future Match / Decision Agent should consume `result.job`.

A second, older family of schemas (AnalyzedJob & friends, defined at the bottom
of this file) is kept ONLY for backward compatibility with
core.job_analyzer_legacy.analyze_job_description. New code must use JobAnalysis.

(The Django model apps.jobs.models.JobPosting is the job *feed* record used by
the existing match engine; it carries no evidence and is intentionally separate.)
"""
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

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


# ===========================================================================
# Legacy job-analysis schemas (kept for backward compatibility)
# Used by core.job_analyzer_legacy.analyze_job_description. Prefer JobAnalysis.
# ===========================================================================
class SkillRequirement(BaseModel):
    """Represents a single skill requirement with evidence."""
    name: str = Field(..., description="Name of the skill")
    source_text: Optional[str] = Field(None, description="Original text from job description")
    explicit: bool = Field(True, description="Whether explicitly mentioned or inferred")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Python",
                "source_text": "Experience with Python is required.",
                "explicit": True
            }
        }


# Alias for backward compatibility
SkillItem = SkillRequirement


class ExperienceRequirement(BaseModel):
    """Represents experience requirements."""
    min_years: Optional[int] = Field(None, description="Minimum years of experience")
    max_years: Optional[int] = Field(None, description="Maximum years of experience")
    source_text: Optional[str] = Field(None, description="Original text from job description")

    class Config:
        json_schema_extra = {
            "example": {
                "min_years": 3,
                "max_years": 7,
                "source_text": "3-7 years of experience required"
            }
        }


class EducationRequirement(BaseModel):
    """Represents education requirements."""
    level: Optional[str] = Field(None, description="e.g., 'Bachelor', 'Master', 'PhD'")
    field: Optional[str] = Field(None, description="e.g., 'Computer Science'")
    source_text: Optional[str] = Field(None, description="Original text from job description")

    class Config:
        json_schema_extra = {
            "example": {
                "level": "Bachelor",
                "field": "Computer Science",
                "source_text": "Bachelor's degree in Computer Science required"
            }
        }


class SalaryInfo(BaseModel):
    """Represents salary information."""
    min: Optional[float] = Field(None, description="Minimum salary")
    max: Optional[float] = Field(None, description="Maximum salary")
    currency: Optional[str] = Field(None, description="Currency code (e.g., USD, EUR, IRR)")
    source_text: Optional[str] = Field(None, description="Original text from job description")

    class Config:
        json_schema_extra = {
            "example": {
                "min": 50000,
                "max": 70000,
                "currency": "USD",
                "source_text": "$50,000 - $70,000 per year"
            }
        }


class AnalyzedJob(BaseModel):
    """
    Complete structured representation of a job posting.
    
    This schema preserves evidence by distinguishing between:
    - Explicitly stated requirements
    - Inferred or normalized information
    - Warnings about removed or downgraded claims
    """

    title: Optional[str] = Field(None, description="Job title")
    company: Optional[str] = Field(None, description="Company name")
    seniority: Optional[str] = Field(None, description="Seniority level (e.g., entry, mid, senior)")
    employment_type: Optional[str] = Field(None, description="e.g., full-time, part-time, contract")
    location: Optional[str] = Field(None, description="Job location or 'remote'")

    required_skills: List[SkillRequirement] = Field(default_factory=list, description="Required skills")
    preferred_skills: List[SkillRequirement] = Field(default_factory=list, description="Preferred/optional skills")
    technologies: List[str] = Field(default_factory=list, description="Specific technologies mentioned")
    tools: List[str] = Field(default_factory=list, description="Specific tools mentioned")

    experience_requirements: Optional[ExperienceRequirement] = Field(
        default=None,
        description="Experience level requirements"
    )

    education_requirements: List[EducationRequirement] = Field(
        default_factory=list,
        description="Education requirements"
    )

    certifications: List[str] = Field(default_factory=list, description="Required certifications")
    languages: List[str] = Field(default_factory=list, description="Required languages")

    responsibilities: List[str] = Field(default_factory=list, description="Main responsibilities")
    other_requirements: List[str] = Field(default_factory=list, description="Other explicit requirements")

    salary: Optional[SalaryInfo] = Field(default=None, description="Salary information")

    warnings: List[str] = Field(default_factory=list, description="Non-critical issues during verification")
    source_text: Optional[str] = Field(None, description="Original job description text")
    provider: Optional[str] = Field(None, description="LLM provider used for analysis")
    model: Optional[str] = Field(None, description="Model name used for analysis")

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Senior Python Developer",
                "company": "TechCorp",
                "seniority": "senior",
                "employment_type": "full-time",
                "location": "remote",
                "required_skills": [
                    {
                        "name": "Python",
                        "source_text": "Expert-level Python is required",
                        "explicit": True
                    }
                ],
                "preferred_skills": [
                    {
                        "name": "FastAPI",
                        "source_text": "Experience with modern web frameworks preferred",
                        "explicit": False
                    }
                ],
                "technologies": ["Python", "PostgreSQL", "Docker"],
                "tools": ["Git", "Jira"],
                "experience_requirements": {
                    "min_years": 7,
                    "max_years": None,
                    "source_text": "7+ years of experience"
                },
                "education_requirements": [
                    {
                        "level": "Bachelor",
                        "field": "Computer Science",
                        "source_text": "Bachelor's degree in CS or related field"
                    }
                ],
                "certifications": [],
                "languages": ["English"],
                "responsibilities": ["Design and implement backend services"],
                "other_requirements": [],
                "salary": {
                    "min": 100000,
                    "max": 150000,
                    "currency": "USD",
                    "source_text": "$100k-$150k annually"
                },
                "warnings": [],
                "provider": "openrouter",
                "model": "configured-model"
            }
        }

    @field_validator('required_skills', 'preferred_skills', mode='before')
    @classmethod
    def ensure_skills(cls, v):
        if not v:
            return []
        res = []
        for item in v:
            if isinstance(item, str):
                res.append({"name": item, "source_text": item, "explicit": True})
            elif isinstance(item, dict):
                res.append(item)
            elif isinstance(item, SkillRequirement):
                res.append(item)
        return res

    @field_validator('education_requirements', mode='before')
    @classmethod
    def ensure_education(cls, v):
        if not v:
            return []
        res = []
        for item in v:
            if isinstance(item, str):
                res.append({"level": None, "field": item, "source_text": item})
            elif isinstance(item, dict):
                res.append(item)
            elif isinstance(item, EducationRequirement):
                res.append(item)
        return res

    @field_validator('experience_requirements', mode='before')
    @classmethod
    def ensure_experience_requirements(cls, v):
        if v is None:
            return ExperienceRequirement()
        if isinstance(v, dict):
            return v
        return v


class JobAnalysisRequest(BaseModel):
    """Request payload for job analysis endpoint."""
    description: str = Field(..., min_length=10, description="Raw job description text")

    class Config:
        json_schema_extra = {
            "example": {
                "description": "We are looking for a Senior Python Developer..."
            }
        }


class JobAnalysisResponse(BaseModel):
    """Response payload from job analysis endpoint."""
    job_analysis: Optional[AnalyzedJob] = Field(None, description="Analyzed job data")
    error: Optional[dict] = Field(None, description="Error info if analysis failed")

    class Config:
        json_schema_extra = {
            "example": {
                "job_analysis": {},
                "error": None
            }
        }
