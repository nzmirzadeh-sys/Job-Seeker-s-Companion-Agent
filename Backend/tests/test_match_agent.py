"""Pure deterministic Stage 3 tests; no Django or network required."""
import unittest

from core.career_schemas import CareerMemorySnapshot
from core.match_agent import MatchDecisionAgent
from core.schemas import JobAnalysis


def claim(value, source="stated in job"):
    return {"value": value, "explicit": True, "source_text": source}


def skill(name, source="Required: " + "x"):
    return {"name": name, "category": "framework", "explicit": True, "source_text": source}


def job(**overrides):
    base = {
        "title": claim("Senior React Developer", "Senior React Developer"),
        "company": claim("Acme"), "seniority": claim("Senior"),
        "employment_type": claim("Remote"), "location": claim("Remote"),
        "education": None, "salary": None,
        "years_experience": {"min_years": 3, "max_years": None, "source_text": "3+ years"},
        "required_skills": [skill("React"), skill("JavaScript")],
        "preferred_skills": [skill("TypeScript", "TypeScript is a plus")],
        "responsibilities": [], "qualifications": [], "certifications": [], "languages": [], "other_requirements": [],
    }
    base.update(overrides)
    return JobAnalysis.model_validate(base)


def memory(skills=None, experiences=None, education=None, goals=None, preferences=None, constraints=None):
    return CareerMemorySnapshot.model_validate({
        "identity": {},
        "skills": skills or [], "experiences": experiences or [], "education": education or [],
        "projects": [], "goals": goals or [], "preferences": preferences or [], "constraints": constraints or [],
    })


class MatchAgentTests(unittest.TestCase):
    def test_confirmed_exact_and_case_insensitive_match(self):
        m = memory(skills=[
            {"name": "react.js", "category": "framework", "level": "advanced", "status": "confirmed", "evidence": []},
            {"name": "JAVASCRIPT", "category": "language", "level": "advanced", "status": "confirmed", "evidence": []},
        ], experiences=[{"title": "Developer", "years": 5}])
        r = MatchDecisionAgent().analyze(job(), m)
        self.assertIn("React", r.matching_skills)
        self.assertIn("JavaScript", r.matching_skills)
        self.assertNotIn("React", r.missing_required_skills)

    def test_unverified_is_uncertain_not_confirmed(self):
        m = memory(skills=[{"name": "React", "status": "unverified", "level": "unknown", "evidence": []}], experiences=[{"title": "Developer", "years": 5}])
        r = MatchDecisionAgent().analyze(job(), m)
        self.assertIn("React", r.uncertain_matches)
        self.assertNotIn("React", r.matching_skills)

    def test_rejected_is_not_positive(self):
        m = memory(skills=[{"name": "React", "status": "rejected", "level": "unknown", "evidence": []}], experiences=[{"title": "Developer", "years": 5}])
        r = MatchDecisionAgent().analyze(job(), m)
        self.assertNotIn("React", r.matching_skills)
        self.assertIn("React", r.missing_required_skills)
        self.assertTrue(any("رد شده" in d.explanation for d in r.skill_matches if d.skill == "React"))

    def test_unknown_skill_is_missing_evidence_not_claim_of_not_knowing(self):
        m = memory(experiences=[{"title": "Developer", "years": 5}])
        r = MatchDecisionAgent().analyze(job(), m)
        self.assertIn("JavaScript", r.missing_required_skills)
        self.assertNotIn("JavaScript", r.uncertain_matches)
        detail = next(d for d in r.skill_matches if d.skill == "JavaScript")
        self.assertIn("شواهد confirmed", detail.explanation)

    def test_insufficient_experience_reduces_score(self):
        m = memory(skills=[{"name": "React", "status": "confirmed", "level": "advanced", "evidence": []}], experiences=[{"title": "Developer", "years": 1}])
        r = MatchDecisionAgent().analyze(job(), m)
        self.assertEqual(r.experience_fit.status, "conflict")
        self.assertLess(r.experience_fit.score, r.experience_fit.max_score)


    def test_matching_education_scores_full_dimension(self):
        m = memory(education=[{"degree": "BSc", "field": "Computer Science"}])
        j = job(education=claim("BSc in Computer Science"))
        r = MatchDecisionAgent().analyze(j, m)
        self.assertEqual(r.education_fit.status, "match")
        self.assertEqual(r.education_fit.score, r.education_fit.max_score)

    def test_non_matching_education_is_conflict(self):
        m = memory(education=[{"degree": "MSc", "field": "Biology"}])
        j = job(education=claim("BSc in Computer Science"))
        r = MatchDecisionAgent().analyze(j, m)
        self.assertEqual(r.education_fit.status, "conflict")

    def test_goal_alignment(self):
        m = memory(goals=[{"role": "React Developer", "priority": "primary"}])
        r = MatchDecisionAgent().analyze(job(), m)
        self.assertEqual(r.career_goal_fit.status, "match")

    def test_conflicting_location_preference_reduces_preference_fit(self):
        m = memory(preferences=[{"category": "location", "value": "Berlin", "priority": "strong"}])
        j = job(location=claim("Paris"))
        r = MatchDecisionAgent().analyze(j, m)
        self.assertEqual(r.preference_fit.status, "conflict")

    def test_hard_constraint_violation_overrides_score(self):
        m = memory(skills=[
            {"name": "React", "status": "confirmed", "level": "advanced", "evidence": []},
            {"name": "JavaScript", "status": "confirmed", "level": "advanced", "evidence": []},
        ], experiences=[{"title": "Developer", "years": 6}], constraints=[{"category": "employment_type", "value": "onsite", "hard": True, "evidence": []}])
        r = MatchDecisionAgent().analyze(job(), m)
        self.assertEqual(r.overall_decision, "not_recommended")
        self.assertTrue(any(c.status == "violated" and c.hard for c in r.constraints))

    def test_hard_constraint_unknown_requests_more_information(self):
        m = memory(skills=[
            {"name": "React", "status": "confirmed", "level": "advanced", "evidence": []},
            {"name": "JavaScript", "status": "confirmed", "level": "advanced", "evidence": []},
        ], experiences=[{"title": "Developer", "years": 6}], constraints=[{"category": "work_authorization", "value": "authorized", "hard": True, "evidence": []}])
        r = MatchDecisionAgent().analyze(job(), m)
        self.assertEqual(r.overall_decision, "needs_more_information")


    def test_missing_required_skill_high_score_becomes_needs_more_information(self):
        m = memory(
            skills=[{"name": "React", "status": "confirmed", "level": "advanced", "evidence": []}],
            experiences=[{"title": "Developer", "years": 6}],
            education=[{"degree": "BSc", "field": "Computer Science"}],
            goals=[{"role": "React Developer", "priority": "primary"}],
            preferences=[{"category": "work_mode", "value": "remote", "priority": "strong"}],
            constraints=[{"category": "employment_type", "value": "Remote", "hard": False}],
        )
        j = job(preferred_skills=[], education=claim("BSc in Computer Science"))
        r = MatchDecisionAgent().analyze(j, m)
        self.assertIn("JavaScript", r.missing_required_skills)
        self.assertEqual(r.overall_decision, "needs_more_information")

    def test_optional_llm_explanation_never_changes_score_or_decision(self):
        class FakeProvider:
            def chat(self, system, user, json_mode=False, response_schema=None):
                class R: text='{"strengths":["rewrite"],"gaps":[],"risks":[],"reasoning":"narrated","recommendation":"narrated"}'; provider='fake'; model='fake-1'
                return R()
        m = memory(skills=[{"name": "React", "status": "confirmed", "level": "advanced", "evidence": []}], experiences=[{"title": "Developer", "years": 5}])
        base = MatchDecisionAgent().analyze(job(), m)
        narrated = MatchDecisionAgent(provider=FakeProvider(), enable_llm_explanation=True).analyze(job(), m)
        self.assertEqual((base.overall_score, base.overall_decision), (narrated.overall_score, narrated.overall_decision))
        self.assertTrue(narrated.llm_explanation_used)

    def test_score_is_deterministic_integer(self):
        m = memory(skills=[{"name": "React", "status": "confirmed", "level": "advanced", "evidence": []}], experiences=[{"title": "Developer", "years": 5}])
        r1 = MatchDecisionAgent().analyze(job(), m)
        r2 = MatchDecisionAgent().analyze(job(), m)
        self.assertEqual((r1.overall_score, r1.overall_decision), (r2.overall_score, r2.overall_decision))
        self.assertIsInstance(r1.overall_score, int)
        self.assertGreaterEqual(r1.overall_score, 0)
        self.assertLessEqual(r1.overall_score, 100)


if __name__ == "__main__":
    unittest.main()
