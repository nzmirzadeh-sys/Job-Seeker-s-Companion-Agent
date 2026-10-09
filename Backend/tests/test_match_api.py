"""Stage 3 API and user-isolation integration tests; requires Django."""
from django.test import TestCase
from rest_framework.test import APIClient
from apps.accounts.models import User
from unittest.mock import patch


def analysis_payload(required=("React",)):
    return {
        "job_analysis": {
            "title": {"value": "React Developer", "explicit": True, "source_text": "React Developer"},
            "company": {"value": "Acme", "explicit": True, "source_text": "Acme"},
            "seniority": None, "employment_type": {"value": "Remote", "explicit": True, "source_text": "Remote"},
            "location": {"value": "Remote", "explicit": True, "source_text": "Remote"}, "education": None,
            "salary": None, "years_experience": {"min_years": 1, "max_years": None, "source_text": "1+ years"},
            "required_skills": [{"name": s, "category": "framework", "explicit": True, "source_text": "Required: " + s} for s in required],
            "preferred_skills": [], "responsibilities": [], "qualifications": [], "certifications": [], "languages": [], "other_requirements": [],
        }
    }


class MatchAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="u1", password="pw")
        self.other = User.objects.create_user(username="u2", password="pw")

    def test_requires_auth(self):
        response = self.client.post("/api/match/analyze/", analysis_payload(), format="json")
        self.assertIn(response.status_code, (401, 403))

    def test_authenticated_match_result(self):
        self.client.force_authenticate(self.user)
        from core.memory_service import MemoryService
        MemoryService(self.user).add_skill("React", category="framework")
        MemoryService(self.user).confirm_skill("React", level="advanced")
        response = self.client.post("/api/match/analyze/", analysis_payload(), format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("match_result", response.data)
        self.assertIn("overall_score", response.data["match_result"])

    def test_cross_user_memory_is_not_visible(self):
        from core.memory_service import MemoryService
        MemoryService(self.other).add_skill("SecretSkill", category="tool")
        self.client.force_authenticate(self.user)
        response = self.client.post("/api/match/analyze/", analysis_payload(required=("SecretSkill",)), format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["match_result"]["matching_skills"], [])
        self.assertIn("SecretSkill", response.data["match_result"]["missing_required_skills"])

    def test_requested_llm_explanation_requires_openrouter(self):
        self.client.force_authenticate(self.user)
        with patch("core.llm.settings.OPENROUTER_API_KEY", ""):
            response = self.client.post(
                "/api/match/analyze/",
                {**analysis_payload(), "explain_with_llm": True},
                format="json",
            )
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["error"], "llm_not_configured")
