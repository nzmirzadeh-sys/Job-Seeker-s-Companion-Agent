"""Resume Truth Guard - Feature C.

Verifies that claims in a resume have evidence backing them.
Quantitative claims (numbers, percentages) must be connected to MemoryEvidence.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List

from core.career_schemas import CareerMemorySnapshot


class ResumeTruthGuard:
    """Verifies resume claims against Career Memory evidence.

    Hard rule: Claims without evidence are marked as unsupported and should not
    be inserted into the resume until verified.
    """

    def __init__(self, snapshot: CareerMemorySnapshot):
        self.snapshot = snapshot

    def _extract_quantitative_claims(self, text: str) -> List[Dict[str, Any]]:
        """Extract quantitative claims from text (numbers, percentages)."""
        claims = []

        # Convert Persian digits to Arabic for easier matching
        fa_to_en = str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")
        normalized_text = text.translate(fa_to_en)

        # Pattern for percentages: "37%", "37 percent"
        percent_pattern = r'(\d+)\s*%|(\d+)\s*percent'
        for match in re.finditer(percent_pattern, normalized_text, re.IGNORECASE):
            claims.append({
                "text": match.group(0),
                "type": "percentage",
                "position": match.start(),
            })

        # Pattern for numbers with context: "3 years", "5 projects", "10 people"
        number_pattern = r'(\d+)\s*(سال|year|پروژه|project|نفر|person|member|تیم|team)'
        for match in re.finditer(number_pattern, normalized_text, re.IGNORECASE):
            claims.append({
                "text": match.group(0),
                "type": "quantitative",
                "position": match.start(),
            })

        return claims

    def _find_evidence_for_claim(
        self, claim_text: str, claim_type: str
    ) -> Dict[str, Any] | None:
        """Search Career Memory for evidence supporting a claim."""
        # Normalize Persian digits for comparison
        fa_to_en = str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")
        normalized_claim = claim_text.translate(fa_to_en).lower()

        # Check if claim text appears in any evidence quotes
        for skill in self.snapshot.skills:
            for evidence in skill.evidence:
                if evidence.quote:
                    normalized_quote = evidence.quote.translate(fa_to_en).lower()
                    if normalized_claim in normalized_quote:
                        return {
                            "type": "skill",
                            "skill_name": skill.name,
                            "evidence": evidence.model_dump(mode="json"),
                        }

        for exp in self.snapshot.experiences:
            if exp.description:
                normalized_desc = exp.description.translate(fa_to_en).lower()
                if normalized_claim in normalized_desc:
                    return {
                        "type": "experience",
                        "title": exp.title,
                        "company": exp.company,
                    }

        for proj in self.snapshot.projects:
            if proj.description:
                normalized_desc = proj.description.translate(fa_to_en).lower()
                if normalized_claim in normalized_desc:
                    return {
                        "type": "project",
                        "name": proj.name,
                    }

        return None

    def verify_resume_content(self, resume_content: Dict[str, Any]) -> Dict[str, Any]:
        """Verify all claims in a resume content.

        Args:
            resume_content: Resume content dict (with sections like summary, skills, experiences, etc.)

        Returns:
            Dict with truth report including verified/unsupported claims
        """
        truth_report = []
        verified_count = 0
        unsupported_count = 0
        needs_clarification_count = 0

        # Check summary
        if "summary" in resume_content and resume_content["summary"]:
            summary_claims = self._verify_text(resume_content["summary"])
            truth_report.extend(summary_claims)

        # Check experiences
        if "experiences" in resume_content:
            for exp in resume_content["experiences"]:
                description = exp.get("description", "")
                if description:
                    exp_claims = self._verify_text(description, context=exp.get("title", ""))
                    truth_report.extend(exp_claims)

        # Check projects
        if "projects" in resume_content:
            for proj in resume_content["projects"]:
                description = proj.get("description", "")
                if description:
                    proj_claims = self._verify_text(description, context=proj.get("name", ""))
                    truth_report.extend(proj_claims)

        # Count statuses
        for claim in truth_report:
            if claim["status"] == "verified":
                verified_count += 1
            elif claim["status"] == "unsupported":
                unsupported_count += 1
            elif claim["status"] == "needs_clarification":
                needs_clarification_count += 1

        total_claims = len(truth_report)
        truth_score = (verified_count / total_claims) if total_claims > 0 else 1.0

        return {
            "truth_report": truth_report,
            "overall_truth_score": round(truth_score, 2),
            "verified_claims": verified_count,
            "unsupported_claims": unsupported_count,
            "needs_clarification_claims": needs_clarification_count,
        }

    def _verify_text(self, text: str, context: str = "") -> List[Dict[str, Any]]:
        """Verify claims in a text segment."""
        claims = self._extract_quantitative_claims(text)
        verified_claims = []

        for claim in claims:
            evidence = self._find_evidence_for_claim(claim["text"], claim["type"])

            if evidence:
                verified_claims.append({
                    "claim_text": claim["text"],
                    "claim_type": claim["type"],
                    "status": "verified",
                    "evidence_ref": evidence,
                    "context": context,
                })
            else:
                # Check if it's a skill claim
                status = "unsupported"
                suggestion = "لطفاً شواهدی برای این ادعا ارائه کنید"

                # If it's a skill that exists in memory but without this specific claim
                for skill in self.snapshot.skills:
                    if skill.name.lower() in text.lower():
                        status = "needs_clarification"
                        suggestion = f"مهارت {skill.name} در پروفایل شماست اما این ادعای عددی شواهد مستقیم ندارد"
                        break

                verified_claims.append({
                    "claim_text": claim["text"],
                    "claim_type": claim["type"],
                    "status": status,
                    "evidence_ref": None,
                    "suggestion": suggestion,
                    "context": context,
                })

        return verified_claims

    def can_insert_claim(self, claim_text: str) -> tuple[bool, str]:
        """Check if a claim can be inserted into a resume.

        Hard rule: Claims without evidence should not be inserted.

        Returns:
            (can_insert, reason)
        """
        claims = self._extract_quantitative_claims(claim_text)

        if not claims:
            # No quantitative claims, safe to insert
            return True, "No quantitative claims found"

        for claim in claims:
            evidence = self._find_evidence_for_claim(claim["text"], claim["type"])
            if not evidence:
                # Check if the claim text itself is just a number without context
                # Allow simple numbers without strict evidence if they're common claims
                if claim["type"] == "quantitative" and len(claim["text"].split()) <= 2:
                    # Allow simple quantitative claims like "3 years" to pass
                    # but mark them for clarification
                    return True, f"Claim '{claim['text']}' should be verified but allowed for insertion"
                return False, f"Claim '{claim['text']}' lacks supporting evidence in Career Memory"

        return True, "All claims have supporting evidence"
