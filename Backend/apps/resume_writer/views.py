"""POST /api/resume-writer/generate/

Body:
    {
      "job_id": 12,                 optional - target a job posting from the feed
      "job_description": "...",     optional - target pasted job text (ignored if job_id given)
      "resume_id": 7,               optional - improve this saved resume instead of writing from memory
      "polish": true,               optional - allow LLM wording polish (default true)
      "save": false,                optional - store the result as a new resume version
      "title": "..."                optional - title used when saving
    }

Response: { mode, content, title, job, excluded_skills, llm_used, rejected_rewrites,
            warnings, validation, resume? }

Career Memory is read through MemoryService for request.user only. Without
``save`` nothing is written.
"""
from django.db import transaction
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.jobs.models import JobPosting
from apps.resumes.models import Resume
from apps.resumes.serializers import ResumeSerializer
from core.memory_service import MemoryService, MemoryServiceError
from core.resume_writer import ResumeWriterAgent, ResumeWriterError

MIN_JOB_TEXT = 40


def _err(code, message, status):
    return Response({"error": {"code": code, "message": message, "retryable": False}}, status=status)


@transaction.atomic
def _save_resume(user, title, content):
    last = Resume.objects.filter(user=user).order_by("-version").first()
    resume = Resume.objects.create(
        user=user, version=(last.version + 1) if last else 1,
        title=title or "رزومهٔ من", content=content, active=True,
    )
    Resume.objects.filter(user=user).exclude(id=resume.id).update(active=False)
    return resume


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generate(request):
    data = request.data if isinstance(request.data, dict) else {}

    job = None
    if data.get("job_id") not in (None, ""):
        try:
            posting = JobPosting.objects.filter(id=int(data["job_id"])).first()
        except (TypeError, ValueError):
            return _err("invalid_job_id", "job_id must be an integer.", 400)
        if posting is None:
            return _err("job_not_found", "Job not found.", 404)
        job = {
            "title": posting.title, "company": posting.company,
            "required_skills": posting.required_skills or [],
            "optional_skills": posting.optional_skills or [],
            "description": posting.description or "",
        }
    elif str(data.get("job_description") or "").strip():
        text = str(data["job_description"]).strip()
        if len(text) < MIN_JOB_TEXT:
            return _err("job_text_too_short", ResumeWriterError.MESSAGES["job_text_too_short"], 400)
        job = {"title": str(data.get("job_title") or "").strip()[:200], "description": text}

    base_content = None
    if data.get("resume_id") not in (None, ""):
        try:
            resume = Resume.objects.filter(user=request.user, id=int(data["resume_id"])).first()
        except (TypeError, ValueError):
            return _err("invalid_resume_id", "resume_id must be an integer.", 400)
        if resume is None:
            return _err("resume_not_found", "Resume not found.", 404)
        base_content = resume.content or {}

    try:
        agent = ResumeWriterAgent(MemoryService(request.user).snapshot())
        result = agent.write(job=job, base_content=base_content, polish=bool(data.get("polish", True)))
    except ResumeWriterError as exc:
        status = 422 if exc.code in ("no_source", "resume_empty") else 400
        return Response({"error": exc.public()}, status=status)
    except MemoryServiceError as exc:
        return Response({"error": exc.public()}, status=401)

    if data.get("save"):
        title = str(data.get("title") or result["title"])[:160]
        result["resume"] = ResumeSerializer(_save_resume(request.user, title, result["content"])).data
    return Response(result)
