"""Domain schemas for Career Intelligence and Career Memory.

These Pydantic models are transport/domain contracts. Django models remain the
persistence layer; MemoryService is the only component that should bridge the
agent and the database.
"""
from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field, field_validator

SkillStatus = Literal["unverified", "needs_clarification", "confirmed", "rejected", "pending_confirmation"]
SkillLevel = Literal["beginner", "intermediate", "advanced", "expert", "unknown"]
EvidenceConfidence = Literal["certain", "high", "medium", "low"]


def _clean(v: Any):
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


class EvidenceItem(BaseModel):
    source: str
    quote: str | None = None
    confidence: EvidenceConfidence = "high"
    recorded_at: str | None = None

    _clean_quote = field_validator("quote", mode="after")(_clean)


class SkillProfile(BaseModel):
    name: str
    category: str | None = None
    level: SkillLevel = "unknown"
    years_of_experience: float | None = None
    status: SkillStatus = "unverified"
    evidence: list[EvidenceItem] = Field(default_factory=list)

    @field_validator("name", mode="after")
    @classmethod
    def _name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("skill name cannot be blank")
        return v


class ExperienceProfile(BaseModel):
    title: str
    company: str | None = None
    years: float | None = None
    description: str | None = None
    evidence: list[EvidenceItem] = Field(default_factory=list)


class ProjectProfile(BaseModel):
    name: str
    role: str | None = None
    technologies: list[str] = Field(default_factory=list)
    description: str | None = None
    evidence: list[EvidenceItem] = Field(default_factory=list)


class EducationProfile(BaseModel):
    degree: str
    field: str | None = None
    school: str | None = None
    graduation_year: int | None = None
    evidence: list[EvidenceItem] = Field(default_factory=list)


class CareerGoalProfile(BaseModel):
    role: str
    industry: str | None = None
    direction: str | None = None
    priority: Literal["primary", "secondary", "unknown"] = "unknown"
    evidence: list[EvidenceItem] = Field(default_factory=list)


class PreferenceProfile(BaseModel):
    category: str
    value: str
    priority: Literal["preferred", "strong", "unknown"] = "preferred"
    evidence: list[EvidenceItem] = Field(default_factory=list)


class ConstraintProfile(BaseModel):
    category: str
    value: str
    hard: bool = False
    evidence: list[EvidenceItem] = Field(default_factory=list)


class CareerMemorySnapshot(BaseModel):
    identity: dict[str, Any] = Field(default_factory=dict)
    skills: list[SkillProfile] = Field(default_factory=list)
    experiences: list[ExperienceProfile] = Field(default_factory=list)
    projects: list[ProjectProfile] = Field(default_factory=list)
    education: list[EducationProfile] = Field(default_factory=list)
    goals: list[CareerGoalProfile] = Field(default_factory=list)
    preferences: list[PreferenceProfile] = Field(default_factory=list)
    constraints: list[ConstraintProfile] = Field(default_factory=list)


class SkillCandidate(BaseModel):
    name: str
    category: str = "other"
    level: SkillLevel = "unknown"
    years_of_experience: float | None = None
    status: SkillStatus = "unverified"
    evidence: list[EvidenceItem] = Field(default_factory=list)


class ExperienceCandidate(BaseModel):
    title: str
    company: str | None = None
    years: float | None = None
    description: str | None = None
    evidence: list[EvidenceItem] = Field(default_factory=list)


class GoalCandidate(BaseModel):
    role: str
    industry: str | None = None
    direction: str | None = None
    priority: Literal["primary", "secondary", "unknown"] = "unknown"
    evidence: list[EvidenceItem] = Field(default_factory=list)


class PreferenceCandidate(BaseModel):
    category: str
    value: str
    priority: Literal["preferred", "strong", "unknown"] = "preferred"
    evidence: list[EvidenceItem] = Field(default_factory=list)


class ConstraintCandidate(BaseModel):
    category: str
    value: str
    hard: bool = False
    evidence: list[EvidenceItem] = Field(default_factory=list)


class CareerIntelligenceResult(BaseModel):
    """LLM output plus explicit provenance.

    The model may suggest facts; MemoryService stores them as unverified unless
    the user explicitly confirms them.
    """

    identity_updates: dict[str, Any] = Field(default_factory=dict)
    new_skills: list[SkillCandidate] = Field(default_factory=list)
    new_experiences: list[ExperienceCandidate] = Field(default_factory=list)
    new_goals: list[GoalCandidate] = Field(default_factory=list)
    new_preferences: list[PreferenceCandidate] = Field(default_factory=list)
    new_constraints: list[ConstraintCandidate] = Field(default_factory=list)
    clarification_questions: list[str] = Field(default_factory=list)
    reply: str = ""
    evidence_items: list[EvidenceItem] = Field(default_factory=list)
    provider: str | None = None
    model: str | None = None
