"""Authenticated API for the text-only interview practice lifecycle."""
import json
import logging

from django.db import DatabaseError, transaction
from django.utils import timezone
from pydantic import ValidationError
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.interview.models import InterviewSession, RUBRIC_VERSION
from apps.jobs.analysis import job_analysis_from_posting
from apps.jobs.models import JobPosting
from core.interview_agent import (
    MAX_QUESTIONS,
    RUBRIC_CRITERIA,
    InterviewAgent,
    InterviewAgentError,
)
from core.interview_schemas import (
    InterviewGenerateQuestionRequest,
    InterviewProcessAnswerRequest,
)
from core.llm import LLMError, get_provider
from core.memory_service import MemoryService, MemoryServiceError
from core.schemas import JobAnalysis

logger = logging.getLogger(__name__)
MAX_ANSWER_LENGTH = 10000
ALLOWED_INTERVIEW_TYPES = set(RUBRIC_CRITERIA)


def _err(code, message, status_code, retryable=False):
    return Response(
        {"error": code, "message": message, "retryable": retryable},
        status=status_code,
    )


def _job_competencies(job_analysis):
    values = []
    for key in ("required_skills", "preferred_skills"):
        for item in job_analysis.get(key, []) or []:
            value = item.get("name") if isinstance(item, dict) else item
            if isinstance(value, str) and value.strip():
                values.append(value.strip())
    for key in ("responsibilities", "qualifications", "other_requirements"):
        for item in job_analysis.get(key, []) or []:
            value = item.get("value") if isinstance(item, dict) else item
            if isinstance(value, str) and value.strip():
                values.append(value.strip())
    return list(dict.fromkeys(values))


def _candidate_context(user, competencies):
    try:
        snapshot = MemoryService(user).snapshot().model_dump(mode="json")
    except (MemoryServiceError, DatabaseError):
        logger.warning("Interview memory unavailable for authenticated user")
        return {"skills": [], "experiences": [], "projects": []}, True

    normalized_competencies = [item.casefold() for item in competencies]
    skills = [
        skill
        for skill in snapshot["skills"]
        if skill.get("status") == "confirmed"
        and any(
            skill.get("name", "").casefold() in requirement
            or requirement in skill.get("name", "").casefold()
            for requirement in normalized_competencies
        )
    ][:10]
    def relevant(records):
        matching = []
        for record in records:
            searchable = json.dumps(record, ensure_ascii=False).casefold()
            if any(
                len(competency) >= 3 and competency in searchable
                for competency in normalized_competencies
            ):
                matching.append(record)
        return matching[:5]

    return {
        "skills": skills,
        "experiences": relevant(snapshot["experiences"]),
        "projects": relevant(snapshot["projects"]),
    }, False


def _session_data(session):
    questions = [
        {
            "competency": "",
            "purpose": question.get("rationale", ""),
            "assessment_criteria": [],
            **question,
        }
        for question in session.questions
    ]
    feedback_history = [
        {
            "criteria": [],
            "overall_score": None,
            "insufficient_evidence": True,
            "improvement_suggestions": [],
            "follow_up_question": None,
            "evaluation_version": "legacy-unscored",
            **feedback,
        }
        for feedback in session.feedback_history
    ]
    summary = session.summary
    if summary is not None:
        summary = {
            "competencies_covered": [],
            "strengths": [],
            "areas_needing_evidence": [],
            "next_steps": [],
            "evaluation_version": "legacy-unscored",
            **summary,
        }
    return {
        "id": session.id,
        "job_posting_id": session.job_posting_id,
        "job_title": _job_title(session.job_analysis),
        "job_analysis": session.job_analysis,
        "interview_type": session.interview_type,
        "rubric_version": session.rubric_version,
        "max_questions": session.max_questions,
        "persona": session.persona,
        "questions": questions,
        "answers": session.answers,
        "feedback_history": feedback_history,
        "status": session.status,
        "summary": summary,
        "question_number": min(len(session.answers) + 1, len(session.questions)),
        "created_at": session.created_at.isoformat(),
        "updated_at": session.updated_at.isoformat(),
        "completed_at": session.updated_at.isoformat() if session.status == "done" else None,
    }


def _job_title(job_analysis):
    title = job_analysis.get("title")
    if isinstance(title, dict):
        return title.get("value") or "Untitled role"
    return title or "Untitled role"


def _session_summary(session):
    return {
        "id": session.id,
        "job_posting_id": session.job_posting_id,
        "job_title": _job_title(session.job_analysis),
        "interview_type": session.interview_type,
        "rubric_version": session.rubric_version,
        "status": session.status,
        "question_count": len(session.questions),
        "answered_count": len(session.answers),
        "created_at": session.created_at.isoformat(),
        "updated_at": session.updated_at.isoformat(),
        "summary": session.summary,
    }


def _progress_for(user, requested_type=None):
    sessions = list(
        InterviewSession.objects.filter(user=user, status="done")
        .order_by("created_at")
    )
    compatible = [
        session
        for session in sessions
        if session.rubric_version == RUBRIC_VERSION
        and (requested_type is None or session.interview_type == requested_type)
    ]
    competencies = {}
    for session in compatible:
        for index, feedback in enumerate(session.feedback_history):
            if index >= len(session.questions):
                continue
            competency = session.questions[index].get("competency") or "Unspecified"
            score = feedback.get("overall_score")
            if isinstance(score, (int, float)):
                competencies.setdefault(competency, []).append(
                    {"session_id": session.id, "date": session.updated_at.isoformat(), "score": score}
                )
    return {
        "baseline_only": len(compatible) < 2,
        "trend_available": len(compatible) >= 2,
        "detail": (
            "One or no comparable completed session is available; this is a baseline, not a trend."
            if len(compatible) < 2
            else "Scores are descriptive practice observations, not a statistically validated measure."
        ),
        "interview_type": requested_type,
        "rubric_version": RUBRIC_VERSION,
        "comparable_sessions": len(compatible),
        "incompatible_sessions_excluded": len(sessions) - len(compatible),
        "competencies": [
            {
                "competency": competency,
                "observations": observations,
                "change": (
                    observations[-1]["score"] - observations[0]["score"]
                    if len(observations) > 1
                    else None
                ),
            }
            for competency, observations in competencies.items()
        ],
    }


def _provider_for_interview():
    try:
        provider = get_provider("openrouter")
    except LLMError as exc:
        raise InterviewAgent._map_provider_error(exc) from exc
    if getattr(provider, "name", None) == "rule-based":
        raise InterviewAgentError("llm_not_configured")
    return provider


def _agent_error(exc):
    public = exc.public()
    http_status = {
        "invalid_input": 400,
        "llm_rate_limited": 429,
        "llm_auth": 503,
        "llm_not_configured": 503,
        "llm_timeout": 503,
        "llm_unavailable": 503,
        "llm_invalid_output": 502,
        "llm_error": 503,
    }.get(public["code"], 503)
    return _err(public["code"], public["message"], http_status, public["retryable"])


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def start_interview(request):
    data = request.data if isinstance(request.data, dict) else {}
    interview_type = data.get("interview_type", "technical")
    if interview_type not in ALLOWED_INTERVIEW_TYPES:
        return _err("invalid_interview_type", "Choose technical, behavioral, or general.", 400)

    max_questions = data.get("max_questions", MAX_QUESTIONS)
    if isinstance(max_questions, bool) or not isinstance(max_questions, int) or not 1 <= max_questions <= MAX_QUESTIONS:
        return _err("invalid_question_limit", "max_questions must be between 1 and 3.", 400)

    persona = data.get("persona", "Interview practice")
    if not isinstance(persona, str) or not persona.strip() or len(persona) > 100:
        return _err("invalid_persona", "persona must contain 1–100 characters.", 400)

    job_posting = None
    if data.get("job_id") is not None:
        try:
            job_posting = JobPosting.objects.get(pk=int(data["job_id"]))
        except (ValueError, TypeError):
            return _err("invalid_job_id", "job_id must be an integer.", 400)
        except JobPosting.DoesNotExist:
            return _err("job_not_found", "Job not found.", 404)
    if data.get("job_analysis") is not None:
        payload = data["job_analysis"]
        if isinstance(payload, dict) and "job" in payload:
            payload = payload["job"]
        try:
            job = JobAnalysis.model_validate(payload)
        except (ValidationError, TypeError):
            return _err("invalid_job_analysis", "The job analysis does not match the canonical schema.", 400)
    elif job_posting is not None:
        job = job_analysis_from_posting(job_posting)
    else:
        return _err("job_required", "Select a job posting or provide canonical job analysis.", 400)

    job_analysis = job.model_dump(mode="json")
    competencies = _job_competencies(job_analysis)
    if not competencies:
        return _err(
            "job_needs_analysis",
            "This posting has no structured skills or responsibilities. Analyze a job description before interview practice.",
            400,
        )

    try:
        provider = _provider_for_interview()
        candidate_context, memory_unavailable = _candidate_context(
            request.user, competencies
        )
        agent = InterviewAgent(provider=provider)
        generated = agent.generate_question(
            InterviewGenerateQuestionRequest(
                job_analysis=job_analysis,
                career_snapshot=candidate_context,
                persona=persona.strip(),
                question_number=1,
                max_questions=max_questions,
                previous_answers=[],
                interview_type=interview_type,
                available_competencies=competencies,
                previous_questions=[],
            )
        )
    except InterviewAgentError as exc:
        return _agent_error(exc)

    session = InterviewSession.objects.create(
        user=request.user,
        job_posting=job_posting,
        job_analysis=job_analysis,
        interview_type=interview_type,
        rubric_version=RUBRIC_VERSION,
        max_questions=max_questions,
        persona=persona.strip(),
        questions=[generated.question.model_dump(mode="json")],
    )
    return Response(
        {
            "session_id": session.id,
            "question": generated.question.model_dump(mode="json"),
            "question_number": 1,
            "max_questions": max_questions,
            "remaining_questions": max_questions - 1,
            "is_final": max_questions == 1,
            "interview_type": interview_type,
            "rubric_version": RUBRIC_VERSION,
            "memory_unavailable": memory_unavailable,
        },
        status=201,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def submit_answer(request):
    data = request.data if isinstance(request.data, dict) else {}
    session_id = data.get("session_id")
    answer = data.get("answer")
    if isinstance(session_id, bool) or not str(session_id or "").isdigit():
        return _err("session_required", "session_id must be an integer.", 400)
    if not isinstance(answer, str) or not answer.strip():
        return _err("answer_required", "A non-empty text answer is required.", 400)
    if len(answer) > MAX_ANSWER_LENGTH:
        return _err("answer_too_long", "Answers must be 10,000 characters or fewer.", 400)

    session = InterviewSession.objects.filter(
        id=int(session_id), user=request.user
    ).first()
    if session is None:
        return _err("session_not_found", "Interview session not found.", 404)
    if session.status != "in_progress":
        return _err("session_not_active", "This session is not active.", 400)

    question_number = len(session.answers) + 1
    expected = data.get("expected_question_number")
    if expected is not None and expected != question_number:
        return _err("stale_answer", "The active question has changed. Reload the session.", 409)
    if question_number > len(session.questions) or question_number > MAX_QUESTIONS:
        return _err("no_active_question", "There is no unanswered question.", 400)

    question = session.questions[question_number - 1]
    competency = question.get("competency", "")
    competencies = _job_competencies(session.job_analysis)
    candidate_context, memory_unavailable = _candidate_context(
        request.user, competencies
    )
    previous_answers = [
        {"question": item.get("question", ""), "answer": old_answer}
        for item, old_answer in zip(session.questions, session.answers)
    ]
    try:
        agent = InterviewAgent(provider=_provider_for_interview())
        result = agent.process_answer(
            InterviewProcessAnswerRequest(
                job_analysis=session.job_analysis,
                career_snapshot=candidate_context,
                persona=session.persona,
                question=question.get("question", ""),
                answer=answer,
                question_number=question_number,
                max_questions=session.max_questions,
                previous_answers=previous_answers,
                interview_type=session.interview_type,
                competency=competency,
                assessment_criteria=question.get("assessment_criteria")
                or RUBRIC_CRITERIA[session.interview_type],
                previous_evaluations=[
                    {
                        "competency": session.questions[index].get(
                            "competency", ""
                        ),
                        **feedback,
                    }
                    for index, feedback in enumerate(session.feedback_history)
                    if index < len(session.questions)
                ],
                available_competencies=competencies,
            )
        )
    except InterviewAgentError as exc:
        return _agent_error(exc)

    with transaction.atomic():
        locked = InterviewSession.objects.select_for_update().filter(
            id=session.id, user=request.user
        ).first()
        if (
            locked is None
            or locked.status != "in_progress"
            or len(locked.answers) + 1 != question_number
        ):
            return _err("stale_answer", "This question has already been answered.", 409)

        feedback = result.feedback.model_dump(mode="json")
        feedback["competency"] = competency
        locked.answers = [*locked.answers, answer]
        locked.feedback_history = [*locked.feedback_history, feedback]
        if result.is_complete:
            locked.status = "done"
            locked.summary = (
                result.summary.model_dump(mode="json") if result.summary else None
            )
        elif result.next_question is not None:
            locked.questions = [
                *locked.questions,
                result.next_question.model_dump(mode="json"),
            ]
        else:
            return _err("invalid_agent_transition", "No next question was generated.", 502)
        locked.save()

    return Response(
        {
            "feedback": feedback,
            "next_question": (
                result.next_question.model_dump(mode="json")
                if result.next_question
                else None
            ),
            "is_complete": result.is_complete,
            "summary": locked.summary,
            "question_number": question_number,
            "remaining_questions": max(0, session.max_questions - question_number),
            "rubric_version": RUBRIC_VERSION,
            "memory_unavailable": memory_unavailable,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def interview_history(request):
    queryset = InterviewSession.objects.filter(user=request.user)
    count = queryset.count()
    try:
        limit = min(50, max(1, int(request.query_params.get("limit", 20))))
        offset = max(0, int(request.query_params.get("offset", 0)))
    except (TypeError, ValueError):
        return _err("invalid_pagination", "limit and offset must be integers.", 400)
    sessions = queryset[offset : offset + limit]
    return Response(
        {
            "count": count,
            "results": [_session_summary(session) for session in sessions],
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def interview_progress(request):
    interview_type = request.query_params.get("interview_type")
    if interview_type and interview_type not in ALLOWED_INTERVIEW_TYPES:
        return _err("invalid_interview_type", "Unknown interview type.", 400)
    return Response(_progress_for(request.user, interview_type))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def interview_report(request, session_id):
    session = InterviewSession.objects.filter(
        id=session_id, user=request.user
    ).first()
    if session is None:
        return _err("session_not_found", "Interview session not found.", 404)
    if session.status != "done":
        return _err("session_not_complete", "Complete this session before viewing its report.", 400)

    report = _session_data(session)
    report["report"] = {
        "summary": report["summary"],
        "questions_and_evaluations": [
            {
                "question": report["questions"][index],
                "answer": session.answers[index] if index < len(session.answers) else None,
                "evaluation": (
                    report["feedback_history"][index]
                    if index < len(report["feedback_history"])
                    else None
                ),
            }
            for index, question in enumerate(session.questions)
        ],
        "progress": _progress_for(request.user, session.interview_type),
    }
    return Response(report)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_session(request, session_id):
    session = InterviewSession.objects.filter(
        id=session_id, user=request.user
    ).first()
    if session is None:
        return _err("session_not_found", "Interview session not found.", 404)
    return Response(_session_data(session))
