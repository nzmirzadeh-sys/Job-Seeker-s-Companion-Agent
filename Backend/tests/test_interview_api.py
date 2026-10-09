import json

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.interview.models import InterviewSession
from apps.jobs.models import JobPosting
from core.llm import LLMRateLimitError
from tests.test_interview_agent import FakeProvider


class InterviewAPITests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="interview-user", password="test-pass")
        self.other = User.objects.create_user(username="interview-other", password="test-pass")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.job = JobPosting.objects.create(
            title="Data Analyst",
            company="Example Co",
            required_skills=["SQL", "Excel", "Python"],
        )

    def fake_provider(self):
        from unittest.mock import patch

        patcher = patch("apps.interview.views.get_provider", return_value=FakeProvider())
        patcher.start()
        self.addCleanup(patcher.stop)

    def start_session(self, *, job_id=None, **payload):
        self.fake_provider()
        request = {
            "job_id": job_id or self.job.id,
            "interview_type": "technical",
            "max_questions": 3,
        }
        request.update(payload)
        return self.client.post("/api/interview/start/", request, format="json")

    def answer(self, session_id, answer="I used SQL to query and validate the data.", number=1):
        self.fake_provider()
        return self.client.post(
            "/api/interview/answer/",
            {
                "session_id": session_id,
                "answer": answer,
                "expected_question_number": number,
            },
            format="json",
        )

    def finish_session(self, client=None):
        client = client or self.client
        self.fake_provider()
        started = client.post(
            "/api/interview/start/",
            {"job_id": self.job.id, "interview_type": "technical", "max_questions": 3},
            format="json",
        )
        self.assertEqual(started.status_code, 201)
        session_id = started.data["session_id"]
        for number in range(1, 4):
            self.fake_provider()
            response = client.post(
                "/api/interview/answer/",
                {
                    "session_id": session_id,
                    "answer": f"I used SQL to analyze data in example {number}.",
                    "expected_question_number": number,
                },
                format="json",
            )
            self.assertEqual(response.status_code, 200, response.data)
        return session_id

    def test_start_requires_authentication(self):
        self.client.force_authenticate(None)
        response = self.client.post(
            "/api/interview/start/",
            {"job_id": self.job.id},
            format="json",
        )
        self.assertIn(response.status_code, (401, 403))

    def test_start_validates_job_type_limit_and_job_requirements(self):
        invalid_type = self.start_session(interview_type="panel")
        self.assertEqual(invalid_type.status_code, 400)
        invalid_limit = self.start_session(max_questions=4)
        self.assertEqual(invalid_limit.status_code, 400)
        no_requirements = JobPosting.objects.create(
            title="Unstructured role", company="Example"
        )
        response = self.start_session(job_id=no_requirements.id)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "job_needs_analysis")

    def test_start_uses_job_posting_and_selected_type(self):
        response = self.start_session(interview_type="behavioral")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["interview_type"], "behavioral")
        self.assertEqual(response.data["max_questions"], 3)
        self.assertEqual(response.data["question"]["competency"], "SQL")
        session = InterviewSession.objects.get(pk=response.data["session_id"])
        self.assertEqual(session.job_posting_id, self.job.id)
        self.assertEqual(session.interview_type, "behavioral")
        self.assertEqual(session.questions[0]["assessment_criteria"][0], "personal_contribution")

    def test_provider_failures_are_explicit_and_do_not_create_sessions(self):
        from unittest.mock import patch

        provider = FakeProvider()
        provider.chat = lambda *args, **kwargs: (_ for _ in ()).throw(
            LLMRateLimitError("private provider detail")
        )
        with patch("apps.interview.views.get_provider", return_value=provider):
            response = self.client.post(
                "/api/interview/start/",
                {"job_id": self.job.id},
                format="json",
            )
        self.assertEqual(response.status_code, 429)
        self.assertNotIn("private provider detail", json.dumps(response.data))
        self.assertEqual(InterviewSession.objects.filter(user=self.user).count(), 0)

    def test_interview_requires_openrouter_configuration(self):
        from unittest.mock import patch

        with patch("core.llm.settings.OPENROUTER_API_KEY", ""):
            response = self.client.post(
                "/api/interview/start/",
                {"job_id": self.job.id},
                format="json",
            )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["error"], "llm_not_configured")
        self.assertEqual(InterviewSession.objects.filter(user=self.user).count(), 0)

    def test_answer_evaluation_persists_structured_criteria_and_progresses(self):
        started = self.start_session()
        session_id = started.data["session_id"]
        response = self.answer(session_id)

        self.assertEqual(response.status_code, 200, response.data)
        feedback = response.data["feedback"]
        self.assertEqual(
            feedback["competency"], started.data["question"]["competency"]
        )
        self.assertEqual(feedback["overall_score"], 3)
        self.assertFalse(feedback["insufficient_evidence"])
        self.assertEqual(len(feedback["criteria"]), 4)
        self.assertTrue(all("I used SQL" in item["evidence"][0] for item in feedback["criteria"]))
        self.assertEqual(response.data["remaining_questions"], 2)
        session = InterviewSession.objects.get(pk=session_id)
        self.assertEqual(len(session.answers), 1)
        self.assertEqual(len(session.questions), 2)

    def test_rejects_invalid_answer_and_stale_duplicate_question(self):
        session_id = self.start_session().data["session_id"]
        blank = self.answer(session_id, answer=" ")
        self.assertEqual(blank.status_code, 400)
        too_long = self.answer(session_id, answer="x" * 10001)
        self.assertEqual(too_long.status_code, 400)
        first = self.answer(session_id)
        self.assertEqual(first.status_code, 200)
        stale = self.answer(session_id, number=1)
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(InterviewSession.objects.get(pk=session_id).answers.__len__(), 1)

    def test_session_history_retrieval_and_user_ownership(self):
        session_id = self.start_session().data["session_id"]
        details = self.client.get(f"/api/interview/{session_id}/")
        history = self.client.get("/api/interview/history/?limit=10&offset=0")
        self.assertEqual(details.status_code, 200)
        self.assertNotIn("user", details.data)
        self.assertEqual(history.data["count"], 1)
        self.assertEqual(history.data["results"][0]["id"], session_id)

        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(f"/api/interview/{session_id}/").status_code, 404)
        self.assertEqual(self.client.post(
            "/api/interview/answer/",
            {"session_id": session_id, "answer": "private answer"},
            format="json",
        ).status_code, 404)

    def test_legacy_session_json_remains_readable_with_safe_defaults(self):
        session = InterviewSession.objects.create(
            user=self.user,
            job_analysis={"title": "Legacy Analyst"},
            questions=[
                {
                    "question": "How did you analyze the data?",
                    "difficulty": "easy",
                    "rationale": "Legacy rationale",
                }
            ],
            answers=["I used SQL."],
            feedback_history=[
                {
                    "feedback": "Legacy feedback",
                    "strengths": [],
                    "weaknesses": [],
                    "better_answer_hint": "Legacy hint",
                }
            ],
            status="done",
            summary={"overall_feedback": "Legacy summary"},
            rubric_version="interview-legacy/0",
        )

        response = self.client.get(f"/api/interview/reports/{session.id}/")

        self.assertEqual(response.status_code, 200)
        question = response.data["report"]["questions_and_evaluations"][0]["question"]
        evaluation = response.data["report"]["questions_and_evaluations"][0]["evaluation"]
        self.assertEqual(question["question"], "How did you analyze the data?")
        self.assertEqual(question["purpose"], "Legacy rationale")
        self.assertEqual(evaluation["evaluation_version"], "legacy-unscored")
        self.assertIsNone(evaluation["overall_score"])
        self.assertEqual(response.data["summary"]["overall_feedback"], "Legacy summary")

    def test_completed_session_report_and_invalid_transition(self):
        session_id = self.finish_session()
        session = InterviewSession.objects.get(pk=session_id)
        self.assertEqual(session.status, "done")
        self.assertEqual(len(session.questions), 3)
        self.assertEqual(len(session.answers), 3)
        self.assertTrue(session.summary["next_steps"] == [])
        self.assertEqual(
            session.summary["competencies_covered"],
            [question["competency"] for question in session.questions],
        )
        completed = self.answer(session_id, number=4)
        self.assertEqual(completed.status_code, 400)
        report = self.client.get(f"/api/interview/reports/{session_id}/")
        self.assertEqual(report.status_code, 200)
        self.assertEqual(len(report.data["report"]["questions_and_evaluations"]), 3)
        self.assertTrue(report.data["report"]["progress"]["baseline_only"])

    def test_report_ownership_and_incomplete_report_protection(self):
        session_id = self.start_session().data["session_id"]
        self.assertEqual(
            self.client.get(f"/api/interview/reports/{session_id}/").status_code,
            400,
        )
        self.client.force_authenticate(self.other)
        self.assertEqual(
            self.client.get(f"/api/interview/reports/{session_id}/").status_code,
            404,
        )
        self.assertEqual(
            self.client.get("/api/interview/history/").data["count"],
            0,
        )

    def test_progress_uses_only_completed_sessions_of_authenticated_user(self):
        self.finish_session()
        single = self.client.get("/api/interview/progress/?interview_type=technical")
        self.assertTrue(single.data["baseline_only"])
        self.assertFalse(single.data["trend_available"])

        self.finish_session()
        multiple = self.client.get("/api/interview/progress/?interview_type=technical")
        self.assertEqual(multiple.data["comparable_sessions"], 2)
        self.assertTrue(multiple.data["trend_available"])
        self.assertTrue(multiple.data["competencies"])

        self.client.force_authenticate(self.other)
        self.assertEqual(
            self.client.get("/api/interview/progress/").data["comparable_sessions"],
            0,
        )

    def test_memory_skills_are_not_changed_by_interview_answers(self):
        from apps.career_memory.models import CareerMemoryRecord, Skill

        session_id = self.start_session().data["session_id"]
        self.answer(session_id)
        self.assertEqual(CareerMemoryRecord.objects.filter(user=self.user).count(), 1)
        self.assertEqual(Skill.objects.filter(memory__user=self.user).count(), 0)
