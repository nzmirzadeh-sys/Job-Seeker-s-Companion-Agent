"""Tests for What-If Simulator and Gap Priority - Feature B."""
import unittest

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Profile, User
from apps.jobs.feed import get_feed_postings
from apps.jobs.models import JobPosting, Match
from core.career_schemas import CareerMemorySnapshot
from core.whatif_simulator import WhatIfSimulator
from core.gap_priority import GapPriorityAnalyzer
from core.match_agent import MatchDecisionAgent
from core.schemas import JobAnalysis


def claim(value, source="stated in job"):
    return {"value": value, "explicit": True, "source_text": source}


def skill(name, source="Required: " + "x"):
    return {"name": name, "category": "framework", "explicit": True, "source_text": source}


def job_analysis(**overrides):
    base = {
        "title": claim("Backend Developer"),
        "company": claim("TechCorp"),
        "seniority": claim("Mid"),
        "employment_type": claim("Remote"),
        "location": claim("Remote"),
        "education": None,
        "salary": None,
        "years_experience": None,
        "required_skills": [skill("Python"), skill("SQL")],
        "preferred_skills": [skill("Docker")],
        "responsibilities": [],
        "qualifications": [],
        "certifications": [],
        "languages": [],
        "other_requirements": [],
    }
    base.update(overrides)
    return JobAnalysis.model_validate(base)


def career_snapshot(**overrides):
    base = {
        "identity": {},
        "skills": [
            {"name": "Python", "category": "language", "level": "advanced", "status": "confirmed", "evidence": []},
        ],
        "experiences": [{"title": "Developer", "years": 3}],
        "education": [],
        "projects": [],
        "goals": [],
        "preferences": [],
        "constraints": [],
    }
    base.update(overrides)
    return CareerMemorySnapshot.model_validate(base)


class WhatIfSimulatorTests(unittest.TestCase):
    def test_hard_rule_simulator_never_writes_to_database(self):
        """Hard rule: WhatIfSimulator never writes to Career Memory or database.

        This is enforced by design - the simulator only clones data in memory
        and never calls any persistence methods. This test documents the constraint.
        """
        simulator = WhatIfSimulator()

        # Verify no persistence methods exist
        self.assertFalse(hasattr(simulator, "persist"))
        self.assertFalse(hasattr(simulator, "save"))
        self.assertFalse(hasattr(simulator, "write_to_db"))

        # Verify the simulator only has read/analysis methods
        self.assertTrue(hasattr(simulator, "simulate"))
        self.assertTrue(hasattr(simulator, "_clone_snapshot"))
        self.assertTrue(hasattr(simulator, "_apply_hypothetical_patch"))

    def test_hard_rule_simulation_does_not_modify_original_snapshot(self):
        """Hard rule: Simulation must not modify the original CareerMemorySnapshot."""
        snapshot = career_snapshot()
        original_skill_count = len(snapshot.skills)

        simulator = WhatIfSimulator()
        job_feed = [job_analysis()]

        result = simulator.simulate(
            snapshot,
            job_feed,
            {"skills": ["SQL", "Docker"]},
        )

        # Original snapshot should be unchanged
        self.assertEqual(len(snapshot.skills), original_skill_count)
        self.assertEqual(snapshot.skills[0].name, "Python")
        self.assertNotIn("SQL", [s.name for s in snapshot.skills])

    def test_happy_path_simulation_with_skill_addition(self):
        """Happy path: Simulate adding SQL skill and see impact."""
        snapshot = career_snapshot()
        job_feed = [
            job_analysis(required_skills=[skill("Python"), skill("SQL")]),
            job_analysis(required_skills=[skill("Python")]),
        ]

        simulator = WhatIfSimulator()
        result = simulator.simulate(snapshot, job_feed, {"skills": ["SQL"]})

        # Should have results
        self.assertIn("before_count", result)
        self.assertIn("after_count", result)
        self.assertIn("delta", result)
        self.assertIn("upgraded_jobs", result)

        # At least one job should be upgraded
        self.assertGreater(len(result["upgraded_jobs"]), 0)

    def test_happy_path_simulation_with_certification(self):
        """Happy path: Simulate adding a certification."""
        snapshot = career_snapshot()
        job_feed = [job_analysis()]

        simulator = WhatIfSimulator()
        result = simulator.simulate(snapshot, job_feed, {"certifications": ["AWS Certified"]})

        # Should have results
        self.assertIn("before_count", result)
        self.assertIn("after_count", result)

    def test_happy_path_gap_priority_analysis(self):
        """Happy path: Analyze skill gaps and prioritize by impact."""
        snapshot = career_snapshot()
        job_feed = [
            job_analysis(required_skills=[skill("Python"), skill("SQL")]),
            job_analysis(required_skills=[skill("Python"), skill("Docker")]),
            job_analysis(required_skills=[skill("Python"), skill("SQL"), skill("Docker")]),
        ]

        analyzer = GapPriorityAnalyzer()
        result = analyzer.analyze(snapshot, job_feed)

        # Should return prioritized gaps
        self.assertIsInstance(result, list)
        self.assertGreater(len(result), 0)

        # Each gap should have required fields
        for gap in result:
            self.assertIn("skill", gap)
            self.assertIn("jobs_unlocked", gap)
            self.assertIn("sample_job_titles", gap)
            self.assertIn("impact_score", gap)

        # Should be sorted by impact_score (descending)
        if len(result) > 1:
            self.assertGreaterEqual(result[0]["impact_score"], result[1]["impact_score"])

    def test_happy_path_single_skill_impact_simulation(self):
        """Happy path: Simulate impact of a single specific skill."""
        snapshot = career_snapshot()
        job_feed = [job_analysis(required_skills=[skill("Python"), skill("SQL")])]

        analyzer = GapPriorityAnalyzer()
        result = analyzer.simulate_single_skill_impact(snapshot, job_feed, "SQL")

        # Should have results
        self.assertIn("skill", result)
        self.assertEqual(result["skill"], "SQL")
        self.assertIn("before_count", result)
        self.assertIn("after_count", result)
        self.assertIn("delta", result)
        self.assertIn("upgraded_jobs_count", result)

    def test_gap_priority_excludes_user_skills(self):
        """Gap priority should not include skills the user already has."""
        snapshot = career_snapshot(skills=[
            {"name": "Python", "category": "language", "level": "advanced", "status": "confirmed", "evidence": []},
            {"name": "SQL", "category": "database", "level": "intermediate", "status": "confirmed", "evidence": []},
        ])
        job_feed = [
            job_analysis(required_skills=[skill("Python"), skill("SQL")]),
            job_analysis(required_skills=[skill("Python"), skill("Docker")]),
        ]

        analyzer = GapPriorityAnalyzer()
        result = analyzer.analyze(snapshot, job_feed)

        # Python and SQL should not be in the gaps
        gap_skills = [gap["skill"] for gap in result]
        self.assertNotIn("Python", gap_skills)
        self.assertNotIn("SQL", gap_skills)
        # Docker should be in the gaps
        self.assertIn("Docker", gap_skills)


# ---------------------------------------------------------------------------
# Bug 1 regression: What-If / Gap Priority must run on the user's PERSONAL feed
# ---------------------------------------------------------------------------
class SpyMatchAgent(MatchDecisionAgent):
    """Records which postings (by company, unique per posting) the agent was asked about."""

    def __init__(self):
        super().__init__()
        self.seen_companies = set()

    def analyze(self, job_analysis, memory):
        self.seen_companies.add(job_analysis.company.value)
        return super().analyze(job_analysis, memory)


def make_posting(company, title="Backend Developer", skills=("python",), city="Tehran", level="junior"):
    return JobPosting.objects.create(
        title=title, company=company, city=city, level=level,
        required_skills=list(skills), optional_skills=[], job_types=["onsite"], description="d",
    )


def make_user(name):
    user = User.objects.create_user(username=name, password="pw")
    Profile.objects.create(
        user=user, skills=["python"], level="junior", city="Tehran",
        target_role="backend developer", remote_only=False,
    )
    return user


class PersonalFeedTests(TestCase):
    def test_simulator_runs_on_users_feed_not_first_50_of_all_postings(self):
        """5 great-fit postings are OLD; 50 newer postings are irrelevant to the user.

        ``JobPosting.objects.all()[:50]`` (newest first) would see only the 50 irrelevant
        ones and miss every posting that is actually relevant. The user's feed ranks by
        fit, so it must contain the 5 relevant ones.
        """
        user = make_user("feeduser")
        for i in range(5):
            make_posting(f"Fit-{i}")
        for i in range(50):
            make_posting(f"Noise-{i}", title="Sales Manager", skills=("excel", "negotiation"), city="Shiraz", level="senior")

        spy = SpyMatchAgent()
        from core.memory_service import MemoryService

        snapshot = MemoryService(user).snapshot()
        result = WhatIfSimulator(match_agent=spy).simulate_for_user(user, snapshot, {"skills": ["SQL"]})

        for i in range(5):
            self.assertIn(f"Fit-{i}", spy.seen_companies)
        self.assertEqual(sum(result["before_count"].values()), 50)

        # Exactly the same set the feed endpoint shows to this user.
        client = APIClient()
        client.force_authenticate(user)
        feed = client.get("/api/jobs/feed/?limit=50").json()["results"]
        self.assertEqual(spy.seen_companies, {row["job"]["company"] for row in feed})

    def test_dismissed_posting_is_not_in_that_users_simulation(self):
        mine, other = make_user("mine"), make_user("other")
        keep1, keep2, hidden = make_posting("Keep-1"), make_posting("Keep-2"), make_posting("Hidden")
        Match.objects.create(user=mine, job=hidden, status="dismissed")

        self.assertEqual({p.company for p in get_feed_postings(mine)}, {"Keep-1", "Keep-2"})
        self.assertEqual({p.company for p in get_feed_postings(other)}, {"Keep-1", "Keep-2", "Hidden"})

        client_mine, client_other = APIClient(), APIClient()
        client_mine.force_authenticate(mine)
        client_other.force_authenticate(other)
        body = {"hypothetical": {"skills": ["SQL"]}}
        n_mine = sum(client_mine.post("/api/career/what-if/", body, format="json").json()["before_count"].values())
        n_other = sum(client_other.post("/api/career/what-if/", body, format="json").json()["before_count"].values())
        self.assertEqual((n_mine, n_other), (2, 3))

    def test_what_if_and_gap_priority_endpoints_do_not_write(self):
        user = make_user("readonly")
        make_posting("A", skills=("python", "sql"))
        make_posting("B", skills=("python", "docker"))
        client = APIClient()
        client.force_authenticate(user)
        client.get("/api/career/memory/")  # let Career Memory initialise before measuring
        before = (Match.objects.count(), JobPosting.objects.count(), Profile.objects.count())

        self.assertEqual(client.post("/api/career/what-if/", {"hypothetical": {"skills": ["SQL"]}}, format="json").status_code, 200)
        self.assertEqual(client.get("/api/career/gap-priority/").status_code, 200)

        self.assertEqual(before, (Match.objects.count(), JobPosting.objects.count(), Profile.objects.count()))

    def test_feed_helper_matches_feed_endpoint_order(self):
        user = make_user("parity")
        make_posting("Low", title="Sales Manager", skills=("excel",), city="Shiraz", level="senior")
        make_posting("High")
        make_posting("Mid", title="Data Analyst", skills=("python",), city="Tehran", level="junior")
        client = APIClient()
        client.force_authenticate(user)
        endpoint = [row["job"]["company"] for row in client.get("/api/jobs/feed/").json()["results"]]
        self.assertEqual([p.company for p in get_feed_postings(user)], endpoint)


# ---------------------------------------------------------------------------
# Bug 2 regression: Gap Priority ranks by REAL decision change, not by name counts
# ---------------------------------------------------------------------------
STATUS_RANK = ["not_recommended", "weak_match", "partial_match", "needs_more_information", "good_match", "strong_match"]


class GapPriorityRealImpactTests(unittest.TestCase):
    def _decoy_scenario(self):
        # User: Python only. Two postings need just Python+SQL -> adding SQL really upgrades them.
        sql_jobs = [job_analysis(required_skills=[skill("Python"), skill("SQL")], preferred_skills=[]) for _ in range(2)]
        # Four postings list Kubernetes as missing but ALSO need Helm/Istio/Terraform, so even with
        # Kubernetes added they stay in the same decision bucket.
        decoys = [
            job_analysis(required_skills=[skill(n) for n in ("Python", "Kubernetes", "Helm", "Istio", "Terraform")], preferred_skills=[])
            for _ in range(4)
        ]
        return career_snapshot(), sql_jobs + decoys

    def test_scenario_really_distinguishes_the_two_skills(self):
        """Guard the fixture itself: SQL changes decisions, Kubernetes does not."""
        snapshot, feed = self._decoy_scenario()
        agent = MatchDecisionAgent()
        rank = lambda job, snap: STATUS_RANK.index(agent.analyze(job, snap).overall_decision)
        for patch, expected_changes in (("SQL", 2), ("Kubernetes", 0)):
            patched = WhatIfSimulator(agent)._apply_hypothetical_patch(snapshot, {"skills": [patch]})
            changed = sum(1 for j in feed if rank(j, patched) > rank(j, snapshot))
            self.assertEqual(changed, expected_changes, patch)

    def test_skill_that_changes_decisions_outranks_skill_that_is_only_missing_more_often(self):
        snapshot, feed = self._decoy_scenario()
        gaps = GapPriorityAnalyzer().analyze(snapshot, feed)
        by_skill = {g["skill"]: g for g in gaps}

        # Name counting would rank Kubernetes first (missing in 4 postings vs 2 for SQL).
        self.assertGreater(by_skill["Kubernetes"]["jobs_mentioning"], by_skill["SQL"]["jobs_mentioning"])

        self.assertEqual(by_skill["SQL"]["jobs_unlocked"], 2)
        self.assertEqual(by_skill["Kubernetes"]["jobs_unlocked"], 0)
        self.assertGreater(by_skill["SQL"]["impact_score"], by_skill["Kubernetes"]["impact_score"])
        self.assertEqual(gaps[0]["skill"], "SQL")
        self.assertLess(gaps.index(by_skill["SQL"]), gaps.index(by_skill["Kubernetes"]))
        # Sample jobs show a real before -> after change.
        self.assertTrue(all(STATUS_RANK.index(j["new_status"]) > STATUS_RANK.index(j["current_status"]) for j in by_skill["SQL"]["sample_jobs"]))

    def test_posting_rejected_for_a_hard_constraint_does_not_count_as_unlocked(self):
        """The posting misses SQL, but a violated hard location constraint rejects it anyway."""
        snapshot = career_snapshot(constraints=[{"category": "location", "value": "Berlin", "hard": True, "evidence": []}])
        exp = {"min_years": 1, "max_years": None, "source_text": "1+ years"}
        blocked = [
            job_analysis(location=claim("Tehran"), years_experience=exp, required_skills=[skill("Python"), skill("Docker")], preferred_skills=[])
            for _ in range(3)
        ]
        open_ = [job_analysis(location=claim("Berlin"), years_experience=exp, required_skills=[skill("Python"), skill("SQL")], preferred_skills=[])]
        agent = MatchDecisionAgent()
        self.assertEqual({agent.analyze(j, snapshot).overall_decision for j in blocked}, {"not_recommended"})

        gaps = GapPriorityAnalyzer().analyze(snapshot, blocked + open_)
        by_skill = {g["skill"]: g for g in gaps}
        # Docker is missing in 3 postings (more than SQL's 1) but unlocks none of them.
        self.assertEqual(by_skill["Docker"]["jobs_mentioning"], 3)
        self.assertEqual(by_skill["Docker"]["jobs_unlocked"], 0)
        self.assertEqual(by_skill["Docker"]["score_gain"], 0)
        # SQL really lifts the one posting that is not blocked.
        self.assertEqual(by_skill["SQL"]["jobs_unlocked"], 1)
        self.assertEqual(gaps[0]["skill"], "SQL")

    def test_aliases_are_grouped_into_one_gap(self):
        snapshot = career_snapshot()
        feed = [
            job_analysis(required_skills=[skill("Python"), skill("React")], preferred_skills=[]),
            job_analysis(required_skills=[skill("Python"), skill("ReactJS")], preferred_skills=[]),
        ]
        gaps = GapPriorityAnalyzer().analyze(snapshot, feed)
        self.assertEqual(len(gaps), 1)
        self.assertEqual(gaps[0]["jobs_mentioning"], 2)


if __name__ == "__main__":
    unittest.main()
