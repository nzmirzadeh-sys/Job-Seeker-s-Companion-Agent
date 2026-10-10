"""Evidence Validator Agent: core behaviour + API (auth, isolation, sources)."""
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.resumes.models import Resume
from core.career_schemas import EvidenceItem
from core.evidence_validator import (
    CONTRADICTED, NEEDS_CLARIFICATION, UNSUPPORTED, VERIFIED, EvidenceValidatorAgent,
)
from core.memory_service import MemoryService


def seed(user):
    m = MemoryService(user)
    m.add_skill("Python", "language", "advanced", 4, EvidenceItem(source="user_statement", quote="۴ سال با پایتون کار کردم"))
    m.confirm_skill("Python")
    m.add_skill("Docker", "tool")  # unverified
    m.add_skill("PHP", "language")
    m.reject_skill("PHP")
    m.add_experience("Backend Developer", "Acme", 3, "تیم ۵ نفره را همراهی کردم و ۳۷% سرعت را بالا بردم")
    m.add_project("Karvia", "dev", ["Django"], "یک پلتفرم کاریابی")
    m.add_education("کارشناسی", "نرم‌افزار", "دانشگاه تهران", 1400)
    return m


class ValidatorCoreTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="ev1", password="pw")
        self.agent = EvidenceValidatorAgent(seed(self.user).snapshot())

    def status_of(self, report, text):
        return next(c["status"] for c in report["claims"] if c["claim_text"] == text)

    def test_skill_verdicts(self):
        report = self.agent.validate_content({"skills": [{"name": "python"}, {"name": "Docker"}, {"name": "PHP"}, {"name": "Rust"}]})
        self.assertEqual(self.status_of(report, "python"), VERIFIED)
        self.assertEqual(self.status_of(report, "Docker"), NEEDS_CLARIFICATION)
        self.assertEqual(self.status_of(report, "PHP"), CONTRADICTED)
        self.assertEqual(self.status_of(report, "Rust"), UNSUPPORTED)
        self.assertFalse(report["can_publish"])

    def test_experience_education_project(self):
        report = self.agent.validate_content({
            "experiences": [
                {"title": "Backend Developer", "company": "Acme"},
                {"title": "Backend Developer", "company": "Ghost Inc"},
                {"title": "CTO", "company": "Fake Co"},
            ],
            "educations": [{"degree": "کارشناسی", "school": "دانشگاه تهران"}, {"degree": "دکتری", "school": "MIT"}],
            "projects": [{"name": "Karvia"}, {"name": "Imaginary"}],
        })
        by = {c["claim_text"]: c["status"] for c in report["claims"]}
        self.assertEqual(by["Backend Developer @ Acme"], VERIFIED)
        self.assertEqual(by["Backend Developer @ Ghost Inc"], NEEDS_CLARIFICATION)
        self.assertEqual(by["CTO @ Fake Co"], UNSUPPORTED)
        self.assertEqual(by["کارشناسی — دانشگاه تهران"], VERIFIED)
        self.assertEqual(by["دکتری — MIT"], UNSUPPORTED)
        self.assertEqual(by["Karvia"], VERIFIED)
        self.assertEqual(by["Imaginary"], UNSUPPORTED)

    def test_numeric_claims(self):
        report = self.agent.validate_content({"summary": "۳۷% بهبود و ۹۹% رشد با ۴ سال تجربه"})
        by = {c["claim_text"]: c["status"] for c in report["claims"]}
        self.assertEqual(by["37%"], VERIFIED)
        self.assertEqual(by["99%"], UNSUPPORTED)
        self.assertEqual(by["4 سال"], VERIFIED)

    def test_text_mentions_rejected_skill(self):
        report = self.agent.validate_text("I also write PHP daily")
        self.assertEqual(report["summary"][CONTRADICTED], 1)
        self.assertFalse(report["can_publish"])

    def test_short_skill_names_do_not_false_match(self):
        report = self.agent.validate_text("I use Docker to ship PHPUnit tests")
        self.assertEqual(report["summary"][CONTRADICTED], 0)

    def test_empty_content_is_publishable(self):
        report = self.agent.validate_content({})
        self.assertEqual(report["summary"]["total"], 0)
        self.assertTrue(report["can_publish"])
        self.assertEqual(report["overall_score"], 1.0)


class ValidatorAPITests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="ev-api", password="pw")
        self.other = User.objects.create_user(username="ev-other", password="pw")
        seed(self.user)
        self.client = APIClient()

    def test_requires_auth(self):
        r = self.client.post("/api/evidence/validate/", {"text": "x"}, format="json")
        self.assertIn(r.status_code, (401, 403))

    def test_requires_exactly_one_source(self):
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.post("/api/evidence/validate/", {}, format="json").status_code, 400)
        r = self.client.post("/api/evidence/validate/", {"text": "x", "content": {"a": 1}}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_validate_content_and_text(self):
        self.client.force_authenticate(self.user)
        r = self.client.post("/api/evidence/validate/", {"content": {"skills": [{"name": "Python"}]}}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data["can_publish"])
        self.assertEqual(r.data["source"], "content")
        r = self.client.post("/api/evidence/validate/", {"text": "۹۹% رشد"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["summary"][UNSUPPORTED], 1)

    def test_validate_saved_resume_and_isolation(self):
        resume = Resume.objects.create(user=self.user, version=1, content={"skills": [{"name": "Python"}, {"name": "Go"}]})
        self.client.force_authenticate(self.user)
        r = self.client.post("/api/evidence/validate/", {"resume_id": resume.id}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["resume_id"], resume.id)
        self.assertEqual(r.data["summary"][UNSUPPORTED], 1)
        # another user cannot validate this resume, nor see this user's memory
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.post("/api/evidence/validate/", {"resume_id": resume.id}, format="json").status_code, 404)
        r = self.client.post("/api/evidence/validate/", {"content": {"skills": [{"name": "Python"}]}}, format="json")
        self.assertEqual(r.data["claims"][0]["status"], UNSUPPORTED)
