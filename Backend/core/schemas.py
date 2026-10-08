"""
Pydantic schemas for structured job analysis.

These schemas define the contract for:
1. LLM output validation
2. API responses
3. Structured job representation
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator


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
    """

    # Basic Information
    title: Optional[str] = Field(None, description="Job title")
    company: Optional[str] = Field(None, description="Company name")
    seniority: Optional[str] = Field(None, description="Seniority level (e.g., entry, mid, senior)")
    employment_type: Optional[str] = Field(None, description="e.g., full-time, part-time, contract")
    location: Optional[str] = Field(None, description="Job location or 'remote'")

    # Skills Requirements
    required_skills: List[SkillRequirement] = Field(default_factory=list, description="Required skills")
    preferred_skills: List[SkillRequirement] = Field(default_factory=list, description="Preferred/optional skills")
    technologies: List[str] = Field(default_factory=list, description="Specific technologies mentioned")

    # Experience
    experience_requirements: ExperienceRequirement = Field(
        default_factory=ExperienceRequirement,
        description="Experience level requirements"
    )

    # Education
    education_requirements: List[EducationRequirement] = Field(
        default_factory=list,
        description="Education requirements"
    )

    # Certifications & Languages
    certifications: List[str] = Field(default_factory=list, description="Required certifications")
    languages: List[str] = Field(default_factory=list, description="Required languages")

    # Job Details
    responsibilities: List[str] = Field(default_factory=list, description="Main responsibilities")
    other_requirements: List[str] = Field(default_factory=list, description="Other explicit requirements")

    # Compensation
    salary: SalaryInfo = Field(default_factory=SalaryInfo, description="Salary information")

    # Metadata
    source_text: Optional[str] = Field(None, description="Original job description text")
    provider: Optional[str] = Field(None, description="LLM provider used for analysis")
    confidence: Optional[float] = Field(None, description="Confidence score of analysis (0-1)")

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
                }
            }
        }

    @validator('confidence')
    def validate_confidence(cls, v):
        if v is not None and not (0 <= v <= 1):
            raise ValueError('confidence must be between 0 and 1')
        return v


class JobAnalysisRequest(BaseModel):
    """Request payload for job analysis endpoint."""
    job_description: str = Field(..., min_length=10, description="Raw job description text")

    class Config:
        json_schema_extra = {
            "example": {
                "job_description": "We are looking for a Senior Python Developer..."
            }
        }


class JobAnalysisResponse(BaseModel):
    """Response payload from job analysis endpoint."""
    success: bool = Field(..., description="Whether analysis was successful")
    job: Optional[AnalyzedJob] = Field(None, description="Analyzed job data")
    error: Optional[str] = Field(None, description="Error message if analysis failed")
    warnings: List[str] = Field(default_factory=list, description="Non-critical issues during analysis")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "job": {},
                "error": None,
                "warnings": []
            }
        }
