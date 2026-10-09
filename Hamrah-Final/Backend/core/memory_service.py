"""User-isolated application service for Career Memory.

Agents must access career facts through this service instead of querying Django
models directly. The service never returns records belonging to another user.
"""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from apps.career_memory.models import (
    CareerGoal, CareerMemoryRecord, Constraint, Education, Experience, MemoryEvidence,
    Preference, Project, Skill,
)
from core.career_schemas import CareerMemorySnapshot, EvidenceItem, SkillProfile

User = get_user_model()


class MemoryServiceError(Exception):
    MESSAGES = {
        "invalid_user": "Invalid user.",
        "skill_not_found": "Skill not found.",
    }

    def __init__(self, code: str):
        self.code = code
        self.message = self.MESSAGES.get(code, "Career memory operation failed.")
        super().__init__(self.message)

    def public(self):
        return {"code": self.code, "message": self.message}


class MemoryService:
    def __init__(self, user):
        if not isinstance(user, User) or user.is_anonymous:
            raise MemoryServiceError("invalid_user")
        self.user = user
        self._record = None

    @property
    def record(self):
        if self._record is None:
            self._record, _ = CareerMemoryRecord.objects.get_or_create(user=self.user)
        return self._record

    def get_skills(self, status: str | None = None):
        qs = self.record.skills.all()
        if status:
            qs = qs.filter(status=status)
        return list(qs)

    def get_verified_skills(self):
        return self.get_skills(status="confirmed")

    def find_skill(self, name: str):
        needle = (name or "").strip()
        if not needle:
            return None
        for skill in self.record.skills.all():
            if self._norm(skill.name) == self._norm(needle):
                return skill
        return None

    @staticmethod
    def _norm(value: str) -> str:
        import re
        text = str(value or "").strip().lower().replace("ي", "ی").replace("ك", "ک")
        text = re.sub(r"[\u200c\s]+", " ", text)
        aliases = {
            "js": "javascript", "reactjs": "react", "react.js": "react", "nodejs": "node",
            "node.js": "node", "ts": "typescript", "next.js": "nextjs", "next": "nextjs",
            "پایتون": "python", "جاوااسکریپت": "javascript", "تایپ اسکریپت": "typescript",
            "ری اکت": "react", "نود جی اس": "node",
        }
        return aliases.get(text, text)

    def _evidence(self, content_type: str, object_id: int, evidence: EvidenceItem):
        MemoryEvidence.objects.create(
            memory=self.record,
            content_type=content_type,
            object_id=object_id,
            source=evidence.source,
            quote=evidence.quote,
            confidence=evidence.confidence,
            recorded_at=timezone.now(),
        )

    @transaction.atomic
    def add_skill(self, name: str, category: str = "other", level: str = "unknown",
                  years_of_experience: float | None = None, evidence: EvidenceItem | None = None):
        existing = self.find_skill(name)
        if existing:
            changed = False
            if category and not existing.category:
                existing.category = category; changed = True
            if level != "unknown" and existing.level == "unknown":
                existing.level = level; changed = True
            if years_of_experience is not None and existing.years_of_experience is None:
                existing.years_of_experience = years_of_experience; changed = True
            if existing.status == "unverified":
                existing.status = "needs_clarification"; changed = True
            if changed:
                existing.save()
            if evidence:
                self._evidence("skill", existing.id, evidence)
            return existing
        skill = Skill.objects.create(
            memory=self.record,
            name=name.strip(),
            category=category or "other",
            level=level or "unknown",
            years_of_experience=years_of_experience,
            status="unverified",
        )
        if evidence:
            self._evidence("skill", skill.id, evidence)
        return skill

    def confirm_skill(self, name: str, level: str | None = None, years_of_experience: float | None = None,
                      quote: str | None = None):
        skill = self.find_skill(name)
        if skill is None:
            raise MemoryServiceError("skill_not_found")
        if level:
            skill.level = level
        if years_of_experience is not None:
            skill.years_of_experience = years_of_experience
        skill.status = "confirmed"
        skill.save()
        self._evidence("skill", skill.id, EvidenceItem(source="user_confirmation", quote=quote, confidence="certain"))
        return skill

    def reject_skill(self, name: str, quote: str | None = None):
        skill = self.find_skill(name)
        if skill is None:
            raise MemoryServiceError("skill_not_found")
        skill.status = "rejected"
        skill.save()
        self._evidence("skill", skill.id, EvidenceItem(source="user_confirmation", quote=quote, confidence="certain"))
        return skill

    def add_experience(self, title: str, company: str = "", years: float | None = None,
                       description: str = "", evidence: EvidenceItem | None = None):
        obj = Experience.objects.create(memory=self.record, title=title, company=company, years=years, description=description)
        if evidence: self._evidence("experience", obj.id, evidence)
        return obj

    def add_project(self, name: str, role: str = "", technologies=None, description: str = "", evidence: EvidenceItem | None = None):
        obj = Project.objects.create(memory=self.record, name=name, role=role, technologies=technologies or [], description=description)
        if evidence: self._evidence("project", obj.id, evidence)
        return obj

    def add_education(self, degree: str, field: str = "", school: str = "", graduation_year: int | None = None,
                      evidence: EvidenceItem | None = None):
        obj = Education.objects.create(memory=self.record, degree=degree, field=field, school=school, graduation_year=graduation_year)
        if evidence: self._evidence("education", obj.id, evidence)
        return obj

    def add_goal(self, role: str, industry: str = "", direction: str = "", priority: str = "unknown",
                 evidence: EvidenceItem | None = None):
        obj = CareerGoal.objects.create(memory=self.record, role=role, industry=industry, direction=direction, priority=priority)
        if evidence: self._evidence("goal", obj.id, evidence)
        return obj

    def add_preference(self, category: str, value: str, priority: str = "preferred", evidence: EvidenceItem | None = None):
        obj = Preference.objects.create(memory=self.record, category=category, value=value, priority=priority)
        if evidence: self._evidence("preference", obj.id, evidence)
        return obj

    def add_constraint(self, category: str, value: str, hard: bool = False, evidence: EvidenceItem | None = None):
        obj = Constraint.objects.create(memory=self.record, category=category, value=value, hard=hard)
        if evidence: self._evidence("constraint", obj.id, evidence)
        return obj

    def update_identity(self, **fields):
        allowed = {"full_name", "headline", "summary", "email", "phone", "location", "websites"}
        changed = []
        for key, value in fields.items():
            if key in allowed and value not in (None, ""):
                setattr(self.record, key, value); changed.append(key)
        if changed:
            self.record.save(update_fields=changed + ["updated_at"])
        return self.get_identity()

    def get_identity(self):
        r = self.record
        return {
            "full_name": r.full_name, "headline": r.headline, "summary": r.summary,
            "email": r.email, "phone": r.phone, "location": r.location, "websites": r.websites or [],
        }

    def snapshot(self) -> CareerMemorySnapshot:
        def ev(content_type, object_id):
            return [
                EvidenceItem(source=e.source, quote=e.quote, confidence=e.confidence, recorded_at=e.recorded_at.isoformat())
                for e in self.record.evidence_items.filter(content_type=content_type, object_id=object_id).order_by("recorded_at")
            ]
        return CareerMemorySnapshot(
            identity=self.get_identity(),
            skills=[SkillProfile(name=s.name, category=s.category or None, level=s.level, years_of_experience=s.years_of_experience,
                                 status=s.status, evidence=ev("skill", s.id)) for s in self.record.skills.all()],
            experiences=[{"title": x.title, "company": x.company or None, "years": x.years, "description": x.description or None, "evidence": ev("experience", x.id)} for x in self.record.experiences.all()],
            projects=[{"name": x.name, "role": x.role or None, "technologies": x.technologies or [], "description": x.description or None, "evidence": ev("project", x.id)} for x in self.record.projects.all()],
            education=[{"degree": x.degree, "field": x.field or None, "school": x.school or None, "graduation_year": x.graduation_year, "evidence": ev("education", x.id)} for x in self.record.education_records.all()],
            goals=[{"role": x.role, "industry": x.industry or None, "direction": x.direction or None, "priority": x.priority, "evidence": ev("goal", x.id)} for x in self.record.goals.all()],
            preferences=[{"category": x.category, "value": x.value, "priority": x.priority, "evidence": ev("preference", x.id)} for x in self.record.preferences.all()],
            constraints=[{"category": x.category, "value": x.value, "hard": x.hard, "evidence": ev("constraint", x.id)} for x in self.record.constraints.all()],
        )
