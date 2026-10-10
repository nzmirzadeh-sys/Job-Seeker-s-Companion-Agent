"""Resume Writer Agent: truth-first drafting, LLM guardrails and API."""
import json
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.jobs.models import JobPosting
from apps.resumes.models import Resume
from core.career_schemas import CareerMemorySnapshot, EvidenceItem
from core.llm import LLMRateLimitError, LLMResult
from core.memory_service import MemoryService
from core.resume_writer import ResumeWriterAgent, ResumeWriterError


class FakeProvider:
    def __init__(self, payload=None, error=None):
        self.payload, self.error = payload, error

    def chat(self, system, user, json_mode=False, response_schema=None):
        if self.error:
            raise self.error
        return LLMResult(json.dumps(self.payload, ensure_ascii=False), "fake", "fake-model")


def seed(user):
    m = MemoryService(user)
    m.update_identity(full_name="سارا احمدی", headline="توسعه‌دهندهٔ بک‌اند", email="s@example.com", location="تهران")
    for name in ("Python", "Django", "SQL"):
        m.add_skill(name, "tool", "advanced", None, EvidenceItem(source="user_statement", quote=name))
        m.confirm_skill(name)
    m.add_skill("Kubernetes", "tool")  # unverified
    m.add_skill("PHP", "language")
    m.reject_skill("PHP")
    m.add_experience("Backend Developer", "Acme", 3, "ساخت APIهای Django")
    m.add_project("Karvia", "dev", ["Django"], "پلتفرم کاریابی")
    m.add_education("کارشناسی", "نرم‌افزار", "دانشگاه تهران", 1400)
    return m


class WriterCoreTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="rw1", password="pw")
        self.snapshot = seed(self.user).snapshot()

    def agent(self, provider=None):
        return ResumeWriterAgent(self.snapshot, provider=provider)

    def test_generate_only_confirmed_skills_and_reports_excluded(self):
        result = self.agent().write(polish=False)
        names = [s["name"] for s in result["content"]["skills"]]
        self.assertEqual(sorted(names), ["Django", "Python", "SQL"])
        reasons = {e["name"]: e["reason"] for e in result["excluded_skills"]}
        self.assertEqual(reasons, {"Kubernetes": "needs_clarification", "PHP": "contradicted"})
        self.assertEqual(result["mode"], "generate")
        self.assertFalse(result["llm_used"])
        self.assertTrue(result["validation"]["can_publish"])
        self.assertEqual(result["content"]["full_name"], "سارا احمدی")
        self.assertIn("3 سال", result["content"]["experiences"][0]["description"])

    def test_job_targeting_orders_skills(self):
        job = {"title": "Data Engineer", "required_skills": ["SQL"], "optional_skills": ["Django"], "description": ""}
        result = self.agent().write(job=job, polish=False)
        self.assertEqual([s["name"] for s in result["content"]["skills"]][:2], ["SQL", "Django"])
        self.assertEqual(result["job"]["title"], "Data Engineer")

    def test_free_text_job_uses_mentioned_skills(self):
        job = {"title": "", "description": "We need strong Python and Go developers for backend work in our team."}
        result = self.agent().write(job=job, polish=False)
        self.assertEqual(result["content"]["skills"][0]["name"], "Python")

    def test_empty_memory_raises(self):
        empty = ResumeWriterAgent(CareerMemorySnapshot())
        with self.assertRaises(ResumeWriterError) as ctx:
            empty.write(polish=False)
        self.assertEqual(ctx.exception.code, "no_source")

    def test_improve_removes_unsupported_skills_and_keeps_prose(self):
        base = {
            "summary": "خلاصهٔ خودم",
            "skills": [{"name": "Python"}, {"name": "Rust"}, {"name": "PHP"}],
            "experiences": [{"title": "Backend Developer", "company": "Acme", "description": "کار من"}],
        }
        result = self.agent().write(base_content=base, polish=False)
        names = [s["name"] for s in result["content"]["skills"]]
        self.assertIn("Python", names)
        self.assertIn("Django", names)  # confirmed memory skill added
        self.assertNotIn("Rust", names)
        self.assertNotIn("PHP", names)
        self.assertEqual(result["content"]["summary"], "خلاصهٔ خودم")
        self.assertEqual(result["content"]["experiences"][0]["description"], "کار من")
        excluded = {e["name"]: e["reason"] for e in result["excluded_skills"]}
        self.assertEqual(excluded["Rust"], "unsupported")
        self.assertEqual(excluded["PHP"], "contradicted")

    def test_polish_accepts_safe_rewrite(self):
        payload = {"summary": "توسعه‌دهندهٔ بک‌اند با تمرکز بر Python و Django.",
                   "experiences": [{"index": 0, "description": "طراحی و پیاده‌سازی APIهای Django."}], "projects": []}
        result = self.agent(FakeProvider(payload)).write(polish=True)
        self.assertTrue(result["llm_used"])
        self.assertIn("تمرکز", result["content"]["summary"])
        self.assertEqual(result["rejected_rewrites"], [])

    def test_polish_rejects_invented_numbers_and_unconfirmed_skills(self):
        payload = {"summary": "توسعه‌دهنده با ۱۰ سال تجربه",
                   "experiences": [{"index": 0, "description": "ساخت APIهای Django روی Kubernetes"}],
                   "projects": [{"index": 0, "description": "پلتفرم کاریابی"}]}
        result = self.agent(FakeProvider(payload)).write(polish=True)
        rejected = {r["field"]: r["reason"] for r in result["rejected_rewrites"]}
        self.assertEqual(rejected["summary"], "new_numbers")
        self.assertEqual(rejected["experiences[0]"], "unconfirmed_skill")
        self.assertNotIn("10", result["content"]["summary"])
        self.assertNotIn("Kubernetes", result["content"]["experiences"][0]["description"])
        self.assertTrue(result["validation"]["can_publish"])

    def test_llm_failure_degrades_to_deterministic_draft(self):
        result = self.agent(FakeProvider(error=LLMRateLimitError("x"))).write(polish=True)
        self.assertFalse(result["llm_used"])
        self.assertTrue(result["warnings"])
        self.assertTrue(result["content"]["skills"])

    def test_llm_not_configured_degrades(self):
        with patch("core.llm.settings.OPENROUTER_API_KEY", ""):
            result = self.agent().write(polish=True)
        self.assertFalse(result["llm_used"])
        self.assertTrue(result["content"]["skills"])


class WriterAPITests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="rw-api", password="pw")
        self.other = User.objects.create_user(username="rw-other", password="pw")
        seed(self.user)
        self.client = APIClient()
        self.job = JobPosting.objects.create(title="Backend Dev", company="X", required_skills=["Django", "SQL"], description="")

    def post(self, body):
        with patch("core.llm.settings.OPENROUTER_API_KEY", ""):
            return self.client.post("/api/resume-writer/generate/", body, format="json")

    def test_requires_auth(self):
        self.assertIn(self.post({}).status_code, (401, 403))

    def test_generate_preview_does_not_save(self):
        self.client.force_authenticate(self.user)
        r = self.post({"job_id": self.job.id})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["job"]["title"], "Backend Dev")
        self.assertEqual(Resume.objects.filter(user=self.user).count(), 0)

    def test_generate_and_save_creates_new_active_version(self):
        self.client.force_authenticate(self.user)
        Resume.objects.create(user=self.user, version=1, content={"summary": "old"}, active=True)
        r = self.post({"save": True, "title": "نسخهٔ نوشته‌شده"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["resume"]["version"], 2)
        self.assertEqual(r.data["resume"]["title"], "نسخهٔ نوشته‌شده")
        self.assertEqual(Resume.objects.filter(user=self.user, active=True).count(), 1)

    def test_improve_existing_and_isolation(self):
        resume = Resume.objects.create(user=self.user, version=1, content={"summary": "s", "skills": [{"name": "Rust"}]})
        self.client.force_authenticate(self.user)
        r = self.post({"resume_id": resume.id})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["mode"], "improve")
        self.client.force_authenticate(self.other)
        self.assertEqual(self.post({"resume_id": resume.id}).status_code, 404)

    def test_empty_memory_is_422_and_other_user_memory_not_used(self):
        self.client.force_authenticate(self.other)
        r = self.post({})
        self.assertEqual(r.status_code, 422)
        self.assertEqual(r.data["error"]["code"], "no_source")

    def test_bad_inputs(self):
        self.client.force_authenticate(self.user)
        self.assertEqual(self.post({"job_id": 999999}).status_code, 404)
        self.assertEqual(self.post({"job_id": "abc"}).status_code, 400)
        self.assertEqual(self.post({"job_description": "short"}).status_code, 400)
