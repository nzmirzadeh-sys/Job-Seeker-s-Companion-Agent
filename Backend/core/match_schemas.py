"""Typed output contracts for Stage 3 Match / Decision Agent."""
from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field

Decision = Literal[
    "strong_match", "good_match", "partial_match", "weak_match",
    "not_recommended", "needs_more_information",
]
FitStatus = Literal["match", "partial", "conflict", "unknown", "not_applicable"]
SkillMatchStatus = Literal["confirmed_match", "uncertain_match", "missing", "rejected"]


class FitDimension(BaseModel):
    score: int
    max_score: int
    status: FitStatus
    explanation: str


class SkillMatchDetail(BaseModel):
    skill: str
    importance: Literal["required", "preferred"]
    status: SkillMatchStatus
    user_status: str | None = None
    evidence: list[dict] = Field(default_factory=list)
    explanation: str


class ConstraintEvaluation(BaseModel):
    category: str
    value: str
    hard: bool
    status: Literal["satisfied", "violated", "unknown", "not_applicable"]
    explanation: str
    evidence: list[dict] = Field(default_factory=list)


class MatchExplanation(BaseModel):
    """Optional LLM wording. It may explain facts but cannot change scoring."""
    strengths: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    reasoning: str = ""
    recommendation: str = ""


class MatchResult(BaseModel):
    overall_decision: Decision
    overall_score: int
    technical_fit: FitDimension
    experience_fit: FitDimension
    education_fit: FitDimension
    career_goal_fit: FitDimension
    preference_fit: FitDimension
    constraint_fit: FitDimension
    skill_matches: list[SkillMatchDetail] = Field(default_factory=list)
    matching_skills: list[str] = Field(default_factory=list)
    missing_required_skills: list[str] = Field(default_factory=list)
    missing_preferred_skills: list[str] = Field(default_factory=list)
    uncertain_matches: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    constraints: list[ConstraintEvaluation] = Field(default_factory=list)
    reasoning: str
    recommendation: str
    methodology_version: str = "match-decision/1"
    llm_explanation_used: bool = False
