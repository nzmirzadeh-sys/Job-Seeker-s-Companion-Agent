"""POST /api/evidence/validate/

Body (exactly one source):
    { "resume_id": 7 }                 validate a saved resume of the signed-in user
    { "content": { ...resume json } }  validate an unsaved resume draft
    { "text": "..." }                  validate free text (numeric claims, rejected skills)

The agent is deterministic, read-only and user-isolated: Career Memory is read through
MemoryService for request.user and nothing is written.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.resumes.models import Resume
from core.evidence_validator import EvidenceValidatorAgent
from core.memory_service import MemoryService, MemoryServiceError

MAX_TEXT_CHARS = 20000


def _err(code, message, status):
    return Response({"error": {"code": code, "message": message, "retryable": False}}, status=status)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def validate(request):
    data = request.data if isinstance(request.data, dict) else {}
    sources = [k for k in ("resume_id", "content", "text") if data.get(k) not in (None, "", {})]
    if len(sources) != 1:
        return _err("invalid_source", "Provide exactly one of resume_id, content or text.", 400)

    try:
        agent = EvidenceValidatorAgent(MemoryService(request.user).snapshot())
    except MemoryServiceError as exc:
        return Response({"error": exc.public()}, status=401)

    source = sources[0]
    if source == "resume_id":
        try:
            resume_id = int(data["resume_id"])
        except (TypeError, ValueError):
            return _err("invalid_resume_id", "resume_id must be an integer.", 400)
        resume = Resume.objects.filter(user=request.user, id=resume_id).first()
        if resume is None:
            return _err("resume_not_found", "Resume not found.", 404)
        report = agent.validate_content(resume.content or {})
        report["resume_id"] = resume.id
        report["resume_title"] = resume.title
    elif source == "content":
        if not isinstance(data["content"], dict):
            return _err("invalid_content", "content must be an object.", 400)
        report = agent.validate_content(data["content"])
    else:
        text = str(data["text"])
        if len(text) > MAX_TEXT_CHARS:
            return _err("text_too_long", "The text is too long.", 413)
        report = agent.validate_text(text)
    report["source"] = source
    return Response(report)
