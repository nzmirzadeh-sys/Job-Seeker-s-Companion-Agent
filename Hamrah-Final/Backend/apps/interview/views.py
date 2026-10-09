"""API endpoints for AI Interview Simulator.

POST /api/interview/start/ - Start a new interview session
POST /api/interview/answer/ - Submit an answer and get feedback + next question
GET  /api/interview/<id>/ - Retrieve a session by ID
"""
from pydantic import ValidationError
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.interview.models import InterviewSession
from apps.jobs.models import JobPosting
from core.interview_agent import InterviewAgent, InterviewAgentError, MAX_QUESTIONS
from core.interview_schemas import (
    InterviewGenerateQuestionRequest,
    InterviewProcessAnswerRequest,
)
from core.memory_service import MemoryService, MemoryServiceError
from core.llm import get_provider


def _job_analysis_from_posting(job: JobPosting) -> dict:
    """Convert JobPosting to JobAnalysis dict (same pattern as match views)."""
    src = job.description or None
    claim = lambda value: {"value": value, "explicit": True, "source_text": src}
    return {
        "title": claim(job.title),
        "company": claim(job.company),
        "seniority": claim(job.level) if job.level else None,
        "employment_type": claim(", ".join(job.job_types)) if job.job_types else None,
        "location": claim(job.city) if job.city else None,
        "education": None,
        "salary": (
            {
                "min_amount": job.salary_min,
                "max_amount": job.salary_max,
                "currency": None,
                "period": None,
                "source_text": src,
            }
            if job.salary_min is not None or job.salary_max is not None
            else None
        ),
        "years_experience": None,
        "required_skills": [
            {"name": s, "category": "other", "explicit": True, "source_text": src}
            for s in job.required_skills or []
        ],
        "preferred_skills": [
            {"name": s, "category": "other", "explicit": True, "source_text": src}
            for s in job.optional_skills or []
        ],
        "responsibilities": [],
        "qualifications": [],
        "certifications": [],
        "languages": [],
        "other_requirements": [],
    }


def _err(code, message, status, retryable=False):
    return Response({"error": code, "message": message, "retryable": retryable}, status=status)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def start_interview(request):
    """Start a new interview session.

    Request body:
    {
        "job_id": int (optional, use existing JobPosting),
        "job_analysis": dict (optional, use JobAnalysis directly),
        "persona": str (optional, default: "مدیر فنی سخت‌گیر")
    }

    Response:
    {
        "session_id": int,
        "question": {...},
        "question_number": 1,
        "max_questions": 3
    }
    """
    data = request.data or {}
    job_id = data.get("job_id")
    job_analysis = data.get("job_analysis")
    persona = data.get("persona", "مدیر فنی سخت‌گیر")

    # Get job analysis
    if job_analysis:
        job_analysis_data = job_analysis
    elif job_id:
        posting = JobPosting.objects.filter(id=int(job_id)).first()
        if posting is None:
            return _err("job_not_found", "Job not found.", 404)
        job_analysis_data = _job_analysis_from_posting(posting)
    else:
        return _err("job_required", "Provide job_id or job_analysis.", 400)

    # Get user's career snapshot
    try:
        service = MemoryService(request.user)
        snapshot = service.snapshot()
    except MemoryServiceError:
        return _err("memory_error", "Could not load career memory.", 500)

    # Create session
    session = InterviewSession.objects.create(
        user=request.user,
        job_analysis=job_analysis_data,
        persona=persona,
        status="in_progress",
    )

    # Generate first question
    try:
        provider = get_provider()
        agent = InterviewAgent(provider=provider)
    except Exception:
        agent = InterviewAgent(provider=None)

    try:
        request_data = InterviewGenerateQuestionRequest(
            job_analysis=job_analysis_data,
            career_snapshot=snapshot.model_dump(mode="json"),
            persona=persona,
            question_number=1,
            max_questions=MAX_QUESTIONS,
            previous_answers=[],
        )
        response = agent.generate_question(request_data)
    except InterviewAgentError as exc:
        session.delete()
        pub = exc.public()
        return _err(pub["code"], pub["message"], 503, pub["retryable"])

    # Save first question
    session.questions = [response.question.model_dump(mode="json")]
    session.save()

    return Response(
        {
            "session_id": session.id,
            "question": response.question.model_dump(mode="json"),
            "question_number": 1,
            "max_questions": MAX_QUESTIONS,
            "is_final": response.is_final,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def submit_answer(request):
    """Submit an answer and get feedback + next question.

    Request body:
    {
        "session_id": int,
        "answer": str
    }

    Response:
    {
        "feedback": {...},
        "next_question": {...} | null,
        "is_complete": bool,
        "summary": {...} | null,
        "question_number": int
    }
    """
    data = request.data or {}
    session_id = data.get("session_id")
    answer = data.get("answer")

    if not session_id:
        return _err("session_required", "session_id is required.", 400)
    if not answer:
        return _err("answer_required", "answer is required.", 400)

    session = InterviewSession.objects.filter(id=int(session_id), user=request.user).first()
    if session is None:
        return _err("session_not_found", "Interview session not found.", 404)
    if session.status != "in_progress":
        return _err("session_not_active", "This session is not active.", 400)

    # Get user's career snapshot
    try:
        service = MemoryService(request.user)
        snapshot = service.snapshot()
    except MemoryServiceError:
        return _err("memory_error", "Could not load career memory.", 500)

    question_number = len(session.answers) + 1
    current_question = session.questions[-1]

    # Process answer
    try:
        provider = get_provider()
        agent = InterviewAgent(provider=provider)
    except Exception:
        agent = InterviewAgent(provider=None)

    try:
        request_data = InterviewProcessAnswerRequest(
            job_analysis=session.job_analysis,
            career_snapshot=snapshot.model_dump(mode="json"),
            persona=session.persona,
            question=current_question.get("question", ""),
            answer=answer,
            question_number=question_number,
            max_questions=MAX_QUESTIONS,
            previous_answers=[
                {"question": q.get("question", ""), "answer": a}
                for q, a in zip(session.questions, session.answers)
            ],
        )
        response = agent.process_answer(request_data)
    except InterviewAgentError as exc:
        pub = exc.public()
        return _err(pub["code"], pub["message"], 503, pub["retryable"])

    # Update session
    session.answers = session.answers + [answer]
    session.feedback_history = session.feedback_history + [response.feedback.model_dump(mode="json")]

    if response.is_complete:
        session.status = "done"
        session.summary = response.summary.model_dump(mode="json") if response.summary else None
        session.save()
    else:
        session.questions = session.questions + [response.next_question.model_dump(mode="json")]
        session.save()

    return Response(
        {
            "feedback": response.feedback.model_dump(mode="json"),
            "next_question": response.next_question.model_dump(mode="json") if response.next_question else None,
            "is_complete": response.is_complete,
            "summary": response.summary.model_dump(mode="json") if response.summary else None,
            "question_number": question_number,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_session(request, session_id):
    """Retrieve an interview session by ID.

    Response:
    {
        "id": int,
        "user": int,
        "job_analysis": {...},
        "persona": str,
        "questions": [...],
        "answers": [...],
        "feedback_history": [...],
        "status": str,
        "summary": {...} | null,
        "created_at": str,
        "updated_at": str
    }
    """
    session = InterviewSession.objects.filter(id=int(session_id), user=request.user).first()
    if session is None:
        return _err("session_not_found", "Interview session not found.", 404)

    return Response(
        {
            "id": session.id,
            "user": session.user.id,
            "job_analysis": session.job_analysis,
            "persona": session.persona,
            "questions": session.questions,
            "answers": session.answers,
            "feedback_history": session.feedback_history,
            "status": session.status,
            "summary": session.summary,
            "created_at": session.created_at.isoformat(),
            "updated_at": session.updated_at.isoformat(),
        }
    )
