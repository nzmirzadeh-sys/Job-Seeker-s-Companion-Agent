"""Focused Stage 2 MemoryService tests; requires Django runtime."""
from django.test import TestCase
from apps.accounts.models import User
from core.career_schemas import EvidenceItem
from core.memory_service import MemoryService


class MemoryServiceIsolationTests(TestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(username="memory-u1", password="pw")
        self.user2 = User.objects.create_user(username="memory-u2", password="pw")

    def test_isolation(self):
        first = MemoryService(self.user1)
        second = MemoryService(self.user2)
        first.add_skill("Python", category="language")
        self.assertEqual([s.name for s in first.get_skills()], ["Python"])
        self.assertEqual(second.get_skills(), [])

    def test_confirmation_and_rejection(self):
        service = MemoryService(self.user1)
        service.add_skill("React", category="framework")
        self.assertEqual(service.find_skill("react").status, "unverified")
        service.confirm_skill("React", level="advanced")
        self.assertEqual(service.find_skill("REACT").status, "confirmed")
        service.reject_skill("React")
        self.assertEqual(service.find_skill("React").status, "rejected")

    def test_evidence_is_attached_to_snapshot(self):
        service = MemoryService(self.user1)
        service.add_skill(
            "Python",
            evidence=EvidenceItem(source="user_statement", quote="Python", confidence="high"),
        )
        snap = service.snapshot()
        self.assertEqual(snap.skills[0].evidence[0].source, "user_statement")
        self.assertEqual(snap.skills[0].evidence[0].quote, "Python")
