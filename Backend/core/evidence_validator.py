"""Evidence Validator Agent.

Boundary: resume content (or free text) + the user's Career Memory -> a claim by
claim verdict. The agent is intentionally deterministic: it never calls an LLM, so
its verdicts are reproducible and cannot be talked into approving a claim.

Verdicts
--------
verified             backed by confirmed Career Memory data
needs_clarification  the fact exists in memory but is unconfirmed / only partially matched
unsupported          nothing in Career Memory backs the claim
contradicted         the user explicitly rejected this fact in Career Memory

Hard rule: only ``verified`` claims are safe to publish. ``can_publish`` is False as
soon as one claim is ``unsupported`` or ``contradicted``.
"""
from __future__ import annotations

import re
from typing import Any

from core.career_schemas import CareerMemorySnapshot
from core.memory_service import MemoryService

VERIFIED = "verified"
NEEDS_CLARIFICATION = "needs_clarification"
UNSUPPORTED = "unsupported"
CONTRADICTED = "contradicted"

_FA_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
_NUMBER_RE = re.compile(
    r"(\d+(?:[.,]\d+)?)\s*(%|percent|درصد|سال|years?|yrs?|پروژه|projects?|نفر|persons?|people|members?|تیم|teams?)",
    re.IGNORECASE,
)


def _norm(value: Any) -> str:
    return MemoryService._norm(str(value or "")).translate(_FA_DIGITS)


def _loosely_equal(a: Any, b: Any) -> bool:
    """Equal after normalisation, or one contains the other (min 3 chars)."""
    x, y = _norm(a), _norm(b)
    if not x or not y:
        return False
    if x == y:
        return True
    short, long_ = (x, y) if len(x) <= len(y) else (y, x)
    return len(short) >= 3 and short in long_


def _mentions(text: str, needle: str) -> bool:
    """Whole-token mention of ``needle`` in ``text`` (so 'C' doesn't match 'Docker')."""
    n = _norm(needle)
    if not n:
        return False
    pattern = r"(?<![\w+#.])" + re.escape(n) + r"(?![\w+#])"
    return re.search(pattern, _norm(text)) is not None


class EvidenceValidatorAgent:
    name = "evidence_validator"

    def __init__(self, snapshot: CareerMemorySnapshot):
        self.snapshot = snapshot

    # ------------------------------------------------------------------ helpers
    def _find_skill(self, name: str):
        for skill in self.snapshot.skills:
            if _norm(skill.name) == _norm(name):
                return skill
        return None

    @staticmethod
    def _claim(section, claim_text, claim_type, status, suggestion=None, evidence_ref=None, context=""):
        return {
            "section": section,
            "claim_text": claim_text,
            "claim_type": claim_type,
            "status": status,
            "evidence_ref": evidence_ref,
            "suggestion": suggestion,
            "context": context,
        }

    # ------------------------------------------------------------------ skills
    def _check_skill(self, name: str, section: str = "skills"):
        skill = self._find_skill(name)
        if skill is None:
            return self._claim(
                section, name, "skill", UNSUPPORTED,
                "این مهارت در Career Memory نیست. اگر واقعاً داری، آن را در صفحهٔ «تحلیل سوابق» اضافه و تأیید کن؛ وگرنه از رزومه حذفش کن.",
            )
        ref = {
            "type": "skill",
            "name": skill.name,
            "memory_status": skill.status,
            "evidence_count": len(skill.evidence),
        }
        if skill.status == "confirmed":
            return self._claim(section, name, "skill", VERIFIED, evidence_ref=ref)
        if skill.status == "rejected":
            return self._claim(
                section, name, "skill", CONTRADICTED,
                "این مهارت را قبلاً رد کرده‌ای؛ نباید در رزومه باشد.", evidence_ref=ref,
            )
        return self._claim(
            section, name, "skill", NEEDS_CLARIFICATION,
            "این مهارت هنوز تأیید نشده است. آن را در «تحلیل سوابق» تأیید یا رد کن.", evidence_ref=ref,
        )

    # -------------------------------------------------------------- experiences
    def _check_experience(self, exp: dict):
        title, company = str(exp.get("title") or "").strip(), str(exp.get("company") or "").strip()
        label = " @ ".join(p for p in (title, company) if p)
        if not label:
            return None
        best_title = best_company = None
        for mem in self.snapshot.experiences:
            t = bool(title) and _loosely_equal(title, mem.title)
            c = bool(company) and _loosely_equal(company, mem.company)
            if (t and c) or (t and not company) or (c and not title):
                return self._claim(
                    "experiences", label, "experience", VERIFIED,
                    evidence_ref={"type": "experience", "title": mem.title, "company": mem.company},
                    context=title,
                )
            best_title = best_title or (mem if t else None)
            best_company = best_company or (mem if c else None)
        partial = best_title or best_company
        if partial is not None:
            return self._claim(
                "experiences", label, "experience", NEEDS_CLARIFICATION,
                "فقط بخشی از این سابقه (عنوان یا شرکت) با Career Memory می‌خواند؛ جزئیاتش را تأیید کن.",
                evidence_ref={"type": "experience", "title": partial.title, "company": partial.company},
                context=title,
            )
        return self._claim(
            "experiences", label, "experience", UNSUPPORTED,
            "این سابقه در Career Memory نیست. آن را در «تحلیل سوابق» بنویس تا ثبت شود.",
            context=title,
        )

    # ---------------------------------------------------------------- education
    def _check_education(self, edu: dict):
        degree, school = str(edu.get("degree") or "").strip(), str(edu.get("school") or "").strip()
        label = " — ".join(p for p in (degree, school) if p)
        if not label:
            return None
        for mem in self.snapshot.education:
            d = bool(degree) and (_loosely_equal(degree, mem.degree) or _loosely_equal(degree, mem.field))
            s = bool(school) and _loosely_equal(school, mem.school)
            if (d and s) or (d and not school) or (s and not degree):
                return self._claim(
                    "educations", label, "education", VERIFIED,
                    evidence_ref={"type": "education", "degree": mem.degree, "school": mem.school},
                )
            if d or s:
                return self._claim(
                    "educations", label, "education", NEEDS_CLARIFICATION,
                    "فقط بخشی از این سابقهٔ تحصیلی با Career Memory می‌خواند.",
                    evidence_ref={"type": "education", "degree": mem.degree, "school": mem.school},
                )
        return self._claim(
            "educations", label, "education", UNSUPPORTED,
            "این مدرک/دانشگاه در Career Memory نیست.",
        )

    # ----------------------------------------------------------------- projects
    def _check_project(self, proj: dict):
        name = str(proj.get("name") or "").strip()
        if not name:
            return None
        for mem in self.snapshot.projects:
            if _loosely_equal(name, mem.name):
                return self._claim(
                    "projects", name, "project", VERIFIED,
                    evidence_ref={"type": "project", "name": mem.name}, context=name,
                )
        return self._claim(
            "projects", name, "project", UNSUPPORTED,
            "این پروژه در Career Memory نیست.", context=name,
        )

    # ------------------------------------------------------ numeric / text claims
    def _memory_text_blobs(self) -> list[tuple[str, dict]]:
        blobs: list[tuple[str, dict]] = []
        for skill in self.snapshot.skills:
            for ev in skill.evidence:
                if ev.quote:
                    blobs.append((ev.quote, {"type": "skill", "skill_name": skill.name}))
            if skill.years_of_experience:
                y = skill.years_of_experience
                blobs.append((f"{y:g} years {y:g} سال {skill.name}", {"type": "skill", "skill_name": skill.name}))
        for exp in self.snapshot.experiences:
            if exp.description:
                blobs.append((exp.description, {"type": "experience", "title": exp.title, "company": exp.company}))
            if exp.years:
                blobs.append((f"{exp.years:g} years {exp.years:g} سال", {"type": "experience", "title": exp.title, "company": exp.company}))
        for proj in self.snapshot.projects:
            if proj.description:
                blobs.append((proj.description, {"type": "project", "name": proj.name}))
        return blobs

    def _check_text(self, text: str, section: str, context: str = "") -> list[dict]:
        """Numeric claims (37%, 3 years, 5 projects…) + mentions of rejected skills."""
        out: list[dict] = []
        if not text or not str(text).strip():
            return out
        normalized = str(text).translate(_FA_DIGITS)
        blobs = self._memory_text_blobs()
        seen: set[str] = set()
        for match in _NUMBER_RE.finditer(normalized):
            claim = match.group(0).strip()
            key = _norm(claim)
            if key in seen:
                continue
            seen.add(key)
            number = match.group(1)
            evidence = None
            for blob, ref in blobs:
                blob_n = blob.translate(_FA_DIGITS)
                exact = _norm(claim) in _norm(blob_n)
                same_number_and_unit = (
                    re.search(r"(?<!\d)" + re.escape(number) + r"(?!\d)", blob_n) is not None
                    and match.group(2).lower() in blob_n.lower()
                )
                if exact or same_number_and_unit:
                    evidence = ref
                    break
            ctype = "percentage" if match.group(2) in ("%", "درصد") or match.group(2).lower() == "percent" else "quantitative"
            if evidence:
                out.append(self._claim(section, claim, ctype, VERIFIED, evidence_ref=evidence, context=context))
            else:
                out.append(self._claim(
                    section, claim, ctype, UNSUPPORTED,
                    "این ادعای عددی هیچ شاهدی در Career Memory ندارد. شاهد بیاور یا عدد را بردار.",
                    context=context,
                ))
        for skill in self.snapshot.skills:
            if skill.status == "rejected" and _mentions(str(text), skill.name):
                out.append(self._claim(
                    section, skill.name, "skill", CONTRADICTED,
                    "این مهارت را قبلاً رد کرده‌ای ولی در متن آمده است.",
                    evidence_ref={"type": "skill", "name": skill.name, "memory_status": "rejected"},
                    context=context,
                ))
        return out

    # ------------------------------------------------------------------ public
    def validate_content(self, content: dict[str, Any]) -> dict[str, Any]:
        content = content if isinstance(content, dict) else {}
        claims: list[dict] = []

        for item in content.get("skills") or []:
            name = item.get("name") if isinstance(item, dict) else item
            if str(name or "").strip():
                claims.append(self._check_skill(str(name).strip()))

        for exp in content.get("experiences") or []:
            if not isinstance(exp, dict):
                continue
            checked = self._check_experience(exp)
            if checked:
                claims.append(checked)
            claims.extend(self._check_text(exp.get("description", ""), "experiences", exp.get("title", "")))

        for edu in content.get("educations") or []:
            if isinstance(edu, dict):
                checked = self._check_education(edu)
                if checked:
                    claims.append(checked)

        for proj in content.get("projects") or []:
            if not isinstance(proj, dict):
                continue
            checked = self._check_project(proj)
            if checked:
                claims.append(checked)
            claims.extend(self._check_text(proj.get("description", ""), "projects", proj.get("name", "")))

        claims.extend(self._check_text(content.get("summary", ""), "summary"))
        return self._report(claims)

    def validate_text(self, text: str) -> dict[str, Any]:
        return self._report(self._check_text(text, "text"))

    @staticmethod
    def _report(claims: list[dict]) -> dict[str, Any]:
        for index, claim in enumerate(claims, start=1):
            claim["id"] = index
        counts = {VERIFIED: 0, NEEDS_CLARIFICATION: 0, UNSUPPORTED: 0, CONTRADICTED: 0}
        for claim in claims:
            counts[claim["status"]] += 1
        total = len(claims)
        score = round(counts[VERIFIED] / total, 2) if total else 1.0
        return {
            "claims": claims,
            "summary": {**counts, "total": total},
            "overall_score": score,
            "can_publish": counts[UNSUPPORTED] == 0 and counts[CONTRADICTED] == 0,
            "agent": EvidenceValidatorAgent.name,
            "method": "deterministic",
        }
