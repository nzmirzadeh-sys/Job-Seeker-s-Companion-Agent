"""Stage 2 agent tests. Requires Django runtime for MemoryService; no network/Gemini call."""
import json
from django.test import TestCase, SimpleTestCase
from apps.accounts.models import User
from core.career_intelligence import CareerIntelligenceAgent, CareerIntelligenceError
from core.career_schemas import CareerIntelligenceResult
from core.llm import BaseProvider, LLMResult
from core.memory_service import MemoryService


class FakeProvider(BaseProvider):
    name = "fake"
    def __init__(self, payload): self.payload = payload
    def chat(self, system, user, json_mode=False, response_schema=None):
        return LLMResult(json.dumps(self.payload, ensure_ascii=False), "fake", "fake-1")


class CareerIntelligenceAgentTests(SimpleTestCase):
    def test_confirmed_output_is_downgraded(self):
        payload = {"new_skills": [{"name": "Python", "category": "language", "status": "confirmed", "level": "unknown", "evidence": []}]}
        result = CareerIntelligenceAgent(provider=FakeProvider(payload)).analyze("من با Python کار کرده‌ام")
        self.assertEqual(result.new_skills[0].status, "unverified")

    def test_unsupported_quote_is_removed(self):
        payload = {"new_skills": [{"name": "Python", "category": "language", "evidence": [{"source": "user_statement", "quote": "من Java کار کرده‌ام", "confidence": "high"}]}]}
        result = CareerIntelligenceAgent(provider=FakeProvider(payload)).analyze("من با Python کار کرده‌ام")
        self.assertEqual(result.new_skills[0].evidence, [])


class MemoryServiceTests(TestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(username="u1", password="pw")
        self.user2 = User.objects.create_user(username="u2", password="pw")

    def test_user_isolation(self):
        m1 = MemoryService(self.user1)
        m2 = MemoryService(self.user2)
        m1.add_skill("Python", category="language")
        self.assertEqual([x.name for x in m1.get_skills()], ["Python"])
        self.assertEqual(m2.get_skills(), [])

    def test_status_transition_confirm_reject(self):
        m = MemoryService(self.user1)
        m.add_skill("React", category="framework")
        self.assertEqual(m.find_skill("react").status, "unverified")
        m.confirm_skill("React", level="advanced")
        self.assertEqual(m.find_skill("REACT").status, "confirmed")
        m.reject_skill("React")
        self.assertEqual(m.find_skill("React").status, "rejected")

    def test_evidence_attaches_to_skill(self):
        from core.career_schemas import EvidenceItem
        m = MemoryService(self.user1)
        m.add_skill("Python", evidence=EvidenceItem(source="user_statement", quote="Python", confidence="high"))
        skill = m.find_skill("Python")
        snap = m.snapshot()
        self.assertEqual(snap.skills[0].name, skill.name)
        self.assertEqual(snap.skills[0].evidence[0].source, "user_statement")
