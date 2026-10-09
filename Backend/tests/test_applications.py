from datetime import date, timedelta

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.applications.models import ApplicationSuggestion, JobApplication
from apps.career_memory.models import CareerMemoryRecord, Skill
from apps.jobs.models import JobPosting


class JobApplicationAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="applicant", password="test-pass")
        self.other = User.objects.create_user(username="other", password="test-pass")
        self.client.force_authenticate(self.user)

    def create_application(self, **overrides):
        payload = {
            "company": "Example Co",
            "job_title": "Data Analyst",
            "applied_on": date.today().isoformat(),
            "required_skills": ["SQL"],
            "status": "APPLIED",
        }
        payload.update(overrides)
        return self.client.post("/api/applications/", payload, format="json")

    def add_outcome(self, user=None, **overrides):
        values = {
            "user": user or self.user,
            "company": "Example Co",
            "job_title": "Data Analyst",
            "status": JobApplication.Status.REJECTED,
            "required_skills": ["SQL", "Excel"],
        }
        values.update(overrides)
        return JobApplication.objects.create(**values)

    def add_supported_history(self):
        self.add_outcome(status=JobApplication.Status.OFFER)
        self.add_outcome()
        self.add_outcome()

    def test_authentication_is_required(self):
        self.client.force_authenticate(user=None)
        response = self.client.get("/api/applications/")
        self.assertIn(response.status_code, (401, 403))

    def test_create_and_list_are_scoped_to_authenticated_user(self):
        response = self.create_application()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], "APPLIED")
        self.assertEqual(response.data["company"], "Example Co")
        self.add_outcome(user=self.other)

        listed = self.client.get("/api/applications/")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.data["count"], 1)
        self.assertEqual(len(listed.data["results"]), 1)

    def test_application_can_reference_job_posting_and_its_requirements(self):
        posting = JobPosting.objects.create(
            title="Data Analyst",
            company="Example Co",
            required_skills=["SQL"],
        )
        response = self.create_application(job_posting=posting.id)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["job_posting"], posting.id)

    def test_update_status_retrieve_and_delete(self):
        application = self.create_application().data
        detail_url = f"/api/applications/{application['id']}/"

        updated = self.client.patch(
            detail_url,
            {"status": "INTERVIEW", "outcome_reason": "Technical interview"},
            format="json",
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["status"], "INTERVIEW")
        self.assertEqual(self.client.get(detail_url).status_code, 200)
        self.assertEqual(self.client.delete(detail_url).status_code, 204)

    def test_other_users_application_is_not_accessible(self):
        application = self.create_application().data
        self.client.force_authenticate(self.other)
        response = self.client.get(f"/api/applications/{application['id']}/")
        self.assertEqual(response.status_code, 404)

    def test_invalid_status_and_future_application_date_are_rejected(self):
        invalid_status = self.create_application(status="HIRED")
        self.assertEqual(invalid_status.status_code, 400)

        future_date = self.create_application(
            applied_on=(date.today() + timedelta(days=1)).isoformat()
        )
        self.assertEqual(future_date.status_code, 400)

    def test_empty_history_reports_insufficient_data(self):
        response = self.client.post("/api/applications/suggestions/", {}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["insufficient_data"])
        self.assertEqual(response.data["results"], [])

    def test_too_few_outcomes_do_not_generate_suggestion(self):
        self.add_outcome()
        self.add_outcome()
        response = self.client.post("/api/applications/suggestions/", {}, format="json")
        self.assertTrue(response.data["insufficient_data"])
        self.assertEqual(response.data["results"], [])

    def test_suggestion_uses_only_supported_evidence(self):
        self.add_supported_history()
        self.add_outcome(status=JobApplication.Status.NO_RESPONSE)

        response = self.client.post("/api/applications/suggestions/", {}, format="json")
        self.assertFalse(response.data["insufficient_data"])
        suggestion = response.data["results"][0]
        self.assertEqual(suggestion["evidence"]["comparable_applications"], 3)
        self.assertEqual(suggestion["confidence"], "low")
        self.assertTrue(suggestion["requires_user_confirmation"])
        self.assertIn(
            "SQL was recorded as a listed requirement in 3 of 3 comparable applications.",
            suggestion["evidence"]["supporting_observations"],
        )
        self.assertIn("do not establish why", suggestion["evidence"]["supporting_observations"][0])

    def test_linked_posting_requirements_are_used_when_application_skills_are_empty(self):
        posting = JobPosting.objects.create(
            title="Data Analyst",
            company="Example Co",
            required_skills=["SQL"],
        )
        for status in (
            JobApplication.Status.OFFER,
            JobApplication.Status.REJECTED,
            JobApplication.Status.REJECTED,
        ):
            self.add_outcome(
                status=status,
                job_posting=posting,
                required_skills=[],
            )

        response = self.client.post("/api/applications/suggestions/", {}, format="json")
        self.assertFalse(response.data["insufficient_data"])
        self.assertIn(
            "SQL was recorded as a listed requirement in 3 of 3 comparable applications.",
            response.data["results"][0]["evidence"]["supporting_observations"],
        )

    def test_suggestion_deduplicates_identical_user_observations(self):
        self.add_supported_history()
        first = self.client.post("/api/applications/suggestions/", {}, format="json")
        second = self.client.post("/api/applications/suggestions/", {}, format="json")
        self.assertEqual(first.data["results"][0]["id"], second.data["results"][0]["id"])
        self.assertEqual(ApplicationSuggestion.objects.filter(user=self.user).count(), 1)

    def test_acceptance_requires_confirmation_and_does_not_change_career_memory(self):
        self.add_supported_history()
        generated = self.client.post(
            "/api/applications/suggestions/", {}, format="json"
        ).data["results"][0]
        decision = self.client.post(
            f"/api/applications/suggestions/{generated['id']}/decision/",
            {"decision": "accepted"},
            format="json",
        )

        self.assertEqual(decision.status_code, 200)
        self.assertEqual(decision.data["status"], "accepted")
        self.assertFalse(decision.data["career_memory_updated"])
        self.assertEqual(CareerMemoryRecord.objects.count(), 0)
        self.assertEqual(Skill.objects.count(), 0)

    def test_rejection_and_invalid_decision_do_not_change_career_memory(self):
        self.add_supported_history()
        generated = self.client.post(
            "/api/applications/suggestions/", {}, format="json"
        ).data["results"][0]
        suggestion_url = (
            f"/api/applications/suggestions/{generated['id']}/decision/"
        )
        invalid = self.client.post(
            suggestion_url, {"decision": "maybe"}, format="json"
        )
        rejected = self.client.post(
            suggestion_url, {"decision": "rejected"}, format="json"
        )
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(rejected.status_code, 200)
        self.assertEqual(rejected.data["status"], "rejected")
        self.assertEqual(CareerMemoryRecord.objects.count(), 0)

    def test_suggestion_decisions_are_user_owned_and_one_time(self):
        self.add_supported_history()
        generated = self.client.post(
            "/api/applications/suggestions/", {}, format="json"
        ).data["results"][0]
        url = f"/api/applications/suggestions/{generated['id']}/decision/"

        self.client.force_authenticate(self.other)
        self.assertEqual(
            self.client.post(url, {"decision": "accepted"}, format="json").status_code,
            404,
        )
        self.client.force_authenticate(self.user)
        self.assertEqual(
            self.client.post(url, {"decision": "accepted"}, format="json").status_code,
            200,
        )
        self.assertEqual(
            self.client.post(url, {"decision": "rejected"}, format="json").status_code,
            400,
        )

    def test_requirements_must_recur_before_suggesting(self):
        self.add_outcome(required_skills=["SQL"])
        self.add_outcome(required_skills=["Python"])
        self.add_outcome(required_skills=["Excel"])
        response = self.client.post("/api/applications/suggestions/", {}, format="json")
        self.assertTrue(response.data["insufficient_data"])
        self.assertEqual(response.data["results"], [])
