"""What-If Simulator - Feature B.

Simulates the impact of adding hypothetical skills/certifications on job match results.
This module NEVER writes to Career Memory or the database - it's read-only simulation.
"""
from __future__ import annotations

import copy
from typing import Any, Dict, List

from core.career_schemas import CareerMemorySnapshot, SkillProfile
from core.match_agent import MatchDecisionAgent
from core.schemas import JobAnalysis


class WhatIfSimulator:
    """Simulates career changes without persisting them.

    Hard rule: This class never writes to the database. It only clones data in memory
    and runs the MatchAgent on the modified snapshot.
    """

    def __init__(self, match_agent: MatchDecisionAgent | None = None):
        self._match_agent = match_agent or MatchDecisionAgent()

    def _clone_snapshot(self, snapshot: CareerMemorySnapshot) -> CareerMemorySnapshot:
        """Create a deep copy of the snapshot to modify in memory."""
        return CareerMemorySnapshot.model_validate(snapshot.model_dump(mode="json"))

    def _apply_hypothetical_patch(
        self, snapshot: CareerMemorySnapshot, patch: Dict[str, Any]
    ) -> CareerMemorySnapshot:
        """Apply hypothetical changes to a cloned snapshot.

        This modifies the in-memory copy only - never touches the database.
        """
        cloned = self._clone_snapshot(snapshot)

        # Add hypothetical skills
        if "skills" in patch:
            existing_names = {s.name.lower() for s in cloned.skills}
            for skill_name in patch["skills"]:
                if skill_name.lower() not in existing_names:
                    cloned.skills.append(
                        SkillProfile(
                            name=skill_name,
                            category="hypothetical",
                            level="intermediate",
                            status="confirmed",  # Assume user would have evidence if they learned it
                            years_of_experience=None,
                            evidence=[],
                        )
                    )

        # Add hypothetical languages (if schema supports it in the future)
        if "languages" in patch:
            # For now, languages could be stored as skills with category="language"
            for lang in patch["languages"]:
                existing_names = {s.name.lower() for s in cloned.skills}
                if lang.lower() not in existing_names:
                    cloned.skills.append(
                        SkillProfile(
                            name=lang,
                            category="language",
                            level="intermediate",
                            status="confirmed",
                            years_of_experience=None,
                            evidence=[],
                        )
                    )

        # Add hypothetical certifications (could be stored as skills or separate field)
        if "certifications" in patch:
            for cert in patch["certifications"]:
                existing_names = {s.name.lower() for s in cloned.skills}
                if cert.lower() not in existing_names:
                    cloned.skills.append(
                        SkillProfile(
                            name=cert,
                            category="certification",
                            level="intermediate",
                            status="confirmed",
                            years_of_experience=None,
                            evidence=[],
                        )
                    )

        return cloned

    def simulate(
        self,
        current_snapshot: CareerMemorySnapshot,
        job_feed: List[JobAnalysis],
        hypothetical_patch: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Simulate the impact of hypothetical changes on the job feed.

        Args:
            current_snapshot: User's current CareerMemorySnapshot
            job_feed: List of JobAnalysis objects from the user's feed
            hypothetical_patch: Dict with optional keys: skills, languages, certifications

        Returns:
            Dict with before/after counts, delta, and list of upgraded jobs
        """
        # Count current match statuses
        before_counts = self._count_matches(current_snapshot, job_feed)

        # Apply hypothetical patch
        hypothetical_snapshot = self._apply_hypothetical_patch(current_snapshot, hypothetical_patch)

        # Count hypothetical match statuses
        after_counts = self._count_matches(hypothetical_snapshot, job_feed)

        # Identify upgraded jobs
        upgraded_jobs = self._find_upgraded_jobs(
            current_snapshot, hypothetical_snapshot, job_feed
        )

        # Calculate delta
        delta = {
            key: after_counts[key] - before_counts[key]
            for key in before_counts
        }

        return {
            "before_count": before_counts,
            "after_count": after_counts,
            "delta": delta,
            "upgraded_jobs": upgraded_jobs,
        }

    def simulate_for_user(
        self,
        user,
        current_snapshot: CareerMemorySnapshot,
        hypothetical_patch: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Simulate on the user's PERSONAL feed (never on all job postings).

        The feed is resolved by ``apps.jobs.feed.get_feed_job_analyses`` - the same
        source the jobs feed endpoint uses - and is read-only.
        """
        from apps.jobs.feed import get_feed_job_analyses

        return self.simulate(current_snapshot, get_feed_job_analyses(user), hypothetical_patch)

    def _count_matches(
        self, snapshot: CareerMemorySnapshot, job_feed: List[JobAnalysis]
    ) -> Dict[str, int]:
        """Count how many jobs fall into each match category."""
        counts = {
            "strong_match": 0,
            "good_match": 0,
            "partial_match": 0,
            "weak_match": 0,
            "not_recommended": 0,
            "needs_more_information": 0,
        }

        for job in job_feed:
            result = self._match_agent.analyze(job, snapshot)
            decision = result.overall_decision
            if decision in counts:
                counts[decision] += 1

        return counts

    def _find_upgraded_jobs(
        self,
        current_snapshot: CareerMemorySnapshot,
        hypothetical_snapshot: CareerMemorySnapshot,
        job_feed: List[JobAnalysis],
    ) -> List[Dict[str, Any]]:
        """Find jobs that improved their match status after applying the patch."""
        upgraded = []

        # Define upgrade hierarchy (higher index = better)
        status_order = [
            "not_recommended",
            "weak_match",
            "partial_match",
            "needs_more_information",
            "good_match",
            "strong_match",
        ]
        status_rank = {status: i for i, status in enumerate(status_order)}

        for job in job_feed:
            current_result = self._match_agent.analyze(job, current_snapshot)
            hypothetical_result = self._match_agent.analyze(job, hypothetical_snapshot)

            current_rank = status_rank.get(current_result.overall_decision, 0)
            hypothetical_rank = status_rank.get(hypothetical_result.overall_decision, 0)

            if hypothetical_rank > current_rank:
                upgraded.append(
                    {
                        "job_analysis": job.model_dump(mode="json"),
                        "previous_status": current_result.overall_decision,
                        "new_status": hypothetical_result.overall_decision,
                        "previous_score": current_result.overall_score,
                        "new_score": hypothetical_result.overall_score,
                        "reason": self._generate_upgrade_reason(
                            current_result, hypothetical_result
                        ),
                    }
                )

        # Sort by score improvement (descending)
        upgraded.sort(
            key=lambda x: x["new_score"] - x["previous_score"], reverse=True
        )

        return upgraded

    def _generate_upgrade_reason(
        self, current_result, hypothetical_result
    ) -> str:
        """Generate a human-readable reason for the upgrade."""
        # Check if new skills matched
        new_matches = set(hypothetical_result.matching_skills) - set(
            current_result.matching_skills
        )
        if new_matches:
            return f"مهارت‌های جدید ({', '.join(new_matches)}) الزامات آگهی را پوشش می‌دهند."

        # Check if experience fit improved
        if hypothetical_result.experience_fit.score > current_result.experience_fit.score:
            return "شرط سابقه کاری بهتر تطبیق پیدا کرد."

        # Check if education fit improved
        if hypothetical_result.education_fit.score > current_result.education_fit.score:
            return "شرط تحصیلی بهتر تطبیق پیدا کرد."

        return "بهبود کلی در تناسب شغلی."
