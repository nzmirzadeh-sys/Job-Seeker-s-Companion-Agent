"""API-level flow used by the Career Intelligence page: analyze -> hidden skill -> confirm."""
import json
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from core.llm import LLMResult


class FakeProvider:
    def chat(self, system, user, json_mode=False, response_schema=None):
        payload = {
            "reply": "ثبت شد",
            "new_skills": [{
                "name": "Signal Processing", "category": "other", "level": "intermediate",
                "evidence": [{"source": "user_statement", "quote": "نویز سنسور را فیلتر کردم", "confidence": "high"}],
            }],
            "clarification_questions": ["چند سال؟"],
        }
        return LLMResult(json.dumps(payload, ensure_ascii=False), "fake", "fake-model")


class CareerAPIFlowTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="career-flow", password="pw")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def analyze(self):
        with patch("core.career_intelligence.get_provider", return_value=FakeProvider()):
            return self.client.post(
                "/api/career/analyze/", {"message": "در یک پروژه نویز سنسور را فیلتر کردم"}, format="json"
            )

    def test_hidden_skill_is_returned_as_plain_json_and_not_persisted(self):
        r = self.analyze()
        self.assertEqual(r.status_code, 200)
        hidden = r.data["persisted"]["hidden_skills"]
        self.assertEqual(hidden[0]["name"], "Signal Processing")
        self.assertEqual(hidden[0]["status"], "pending_confirmation")
        self.assertEqual(hidden[0]["evidence"][0]["quote"], "نویز سنسور را فیلتر کردم")
        self.assertEqual(self.client.get("/api/career/skills/").data["results"], [])

    def test_accept_hidden_skill_then_confirm(self):
        self.analyze()
        r = self.client.post("/api/career/hidden-skill/confirm/", {"skill_name": "Signal Processing", "accept": True}, format="json")
        self.assertEqual(r.status_code, 200)
        r = self.client.post("/api/career/skills/", {"name": "Signal Processing", "action": "confirm"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["status"], "confirmed")
        memory = self.client.get("/api/career/memory/").data
        self.assertEqual([s["name"] for s in memory["verified_skills"]], ["Signal Processing"])

    def test_reject_hidden_skill_persists_nothing(self):
        self.analyze()
        r = self.client.post("/api/career/hidden-skill/confirm/", {"skill_name": "Signal Processing", "accept": False}, format="json")
        self.assertEqual(r.data["status"], "rejected")
        self.assertEqual(self.client.get("/api/career/skills/").data["results"], [])

    def test_llm_not_configured_is_503(self):
        with patch("core.llm.settings.OPENROUTER_API_KEY", ""):
            r = self.client.post("/api/career/analyze/", {"message": "من پایتون بلدم و سه سال کار کردم"}, format="json")
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.data["error"]["code"], "llm_not_configured")

    def test_what_if_and_gap_priority_work_for_new_user(self):
        r = self.client.post("/api/career/what-if/", {"hypothetical": {"skills": ["SQL"]}}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIn("before_count", r.data)
        self.assertEqual(self.client.get("/api/career/gap-priority/").status_code, 200)
