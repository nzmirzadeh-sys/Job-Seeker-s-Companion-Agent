"""Gap Priority Analysis - Feature B.

Analyzes missing skills in the user's job feed and prioritizes them by impact.
This module NEVER writes to the database - it's read-only analysis.
"""
from __future__ import annotations

from typing import Any, Dict, List

from core.career_schemas import CareerMemorySnapshot
from core.match_agent import MatchDecisionAgent, canon
from core.schemas import JobAnalysis


class GapPriorityAnalyzer:
    """Analyzes and prioritizes skill gaps based on job feed impact.

    Hard rule: This class never writes to the database. It only analyzes data.
    """

    def __init__(self, match_agent: MatchDecisionAgent | None = None):
        self._match_agent = match_agent or MatchDecisionAgent()

    def analyze_for_user(self, user, snapshot: CareerMemorySnapshot) -> List[Dict[str, Any]]:
        """Run :meth:`analyze` on the user's PERSONAL feed (never on all job postings)."""
        from apps.jobs.feed import get_feed_job_analyses

        return self.analyze(snapshot, get_feed_job_analyses(user))

    def analyze(
        self, snapshot: CareerMemorySnapshot, job_feed: List[JobAnalysis]
    ) -> List[Dict[str, Any]]:
        """Rank missing skills by their REAL effect on Match Agent decisions.

        A skill is not ranked by how many postings merely list it as missing. For
        every missing skill we re-run the Match Agent (via
        ``simulate_single_skill_impact``) with that skill added and count the
        postings whose ``overall_decision`` actually improves. A posting that is
        still rejected for another reason (city, level, hard constraint, other
        missing skills) therefore does NOT count for that skill.

        Args:
            snapshot: User's current CareerMemorySnapshot
            job_feed: List of JobAnalysis objects from the user's feed

        Returns:
            List of gaps sorted by real impact. Each item has: skill, jobs_unlocked
            (postings whose decision improves), jobs_mentioning (postings listing it
            as missing), score_gain, impact_score (0-100: share of the feed
            this skill upgrades), sample_job_titles, sample_jobs.
        """
        # 1. Candidate skills = skills the Match Agent reports as missing, grouped by
        #    canonical name. Postings that are already strong_match cannot improve.
        candidates: Dict[str, Dict[str, Any]] = {}
        for job in job_feed:
            result = self._match_agent.analyze(job, snapshot)
            if result.overall_decision == "strong_match":
                continue
            for skill in list(result.missing_required_skills) + list(result.missing_preferred_skills):
                entry = candidates.setdefault(canon(skill), {"skill": skill, "jobs": []})
                if not any(j is job for j in entry["jobs"]):
                    entry["jobs"].append(job)

        # 2. Measure the real impact of each candidate with the Match Agent.
        #    Adding one skill can only change postings that list it as missing, so
        #    simulating on exactly those postings is equivalent to using the whole feed.
        total_jobs = max(1, len(job_feed))
        gaps: List[Dict[str, Any]] = []
        for entry in candidates.values():
            skill, jobs = entry["skill"], entry["jobs"]
            impact = self.simulate_single_skill_impact(snapshot, jobs, skill)
            upgraded = impact["upgraded_jobs"]
            unlocked = impact["upgraded_jobs_count"]
            if upgraded:
                sample_titles = list(dict.fromkeys(self._title(u["job_analysis"]) for u in upgraded))
            else:
                sample_titles = list(dict.fromkeys(self._title(j.model_dump(mode="json")) for j in jobs))[:5]
            gaps.append(
                {
                    "skill": skill,
                    "jobs_unlocked": unlocked,
                    "jobs_mentioning": len(jobs),
                    "score_gain": impact["total_score_gain"],
                    "impact_score": min(100, round(100 * unlocked / total_jobs)),
                    "sample_job_titles": sample_titles,
                    "sample_jobs": [
                        {
                            "title": self._title(u["job_analysis"]),
                            "company": self._company(u["job_analysis"]),
                            "current_status": u["previous_status"],
                            "new_status": u["new_status"],
                            "job_analysis": u["job_analysis"],
                        }
                        for u in upgraded[:3]
                    ],
                }
            )

        # 3. Real unlocks first, then total score gain, then how widespread the gap is.
        gaps.sort(
            key=lambda g: (-g["jobs_unlocked"], -g["score_gain"], -g["jobs_mentioning"], g["skill"].lower())
        )
        return gaps

    @staticmethod
    def _title(job_dump: Dict[str, Any]) -> str:
        return ((job_dump.get("title") or {}).get("value")) or "Unknown"

    @staticmethod
    def _company(job_dump: Dict[str, Any]) -> str:
        return ((job_dump.get("company") or {}).get("value")) or "Unknown"

    def simulate_single_skill_impact(
        self, snapshot: CareerMemorySnapshot, job_feed: List[JobAnalysis], skill_name: str
    ) -> Dict[str, Any]:
        """Simulate the impact of adding a single specific skill.

        This is a targeted version of whatif_simulator for gap analysis.
        """
        from core.whatif_simulator import WhatIfSimulator

        simulator = WhatIfSimulator(match_agent=self._match_agent)
        result = simulator.simulate(
            snapshot, job_feed, {"skills": [skill_name]}
        )

        # Exactly one skill was added, so every upgrade is caused by it - including
        # postings where it is only a preferred skill or matches via an alias.
        upgraded_jobs = result["upgraded_jobs"]

        return {
            "skill": skill_name,
            "before_count": result["before_count"],
            "after_count": result["after_count"],
            "delta": result["delta"],
            "upgraded_jobs_count": len(upgraded_jobs),
            "total_score_gain": sum(j["new_score"] - j["previous_score"] for j in upgraded_jobs),
            "upgraded_jobs": upgraded_jobs[:5],  # Top 5 (all are counted above)
        }
