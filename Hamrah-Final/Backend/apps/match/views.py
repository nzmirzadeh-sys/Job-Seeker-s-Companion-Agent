"""POST /api/match/analyze/

Accepts either an existing JobAnalysis (`job_analysis`, the Stage 1 shape) or a raw
`description` that is first run through the Job Analyzer Agent. The matching itself
is deterministic. The result is returned and NOT persisted. Career Memory is read
only, through MemoryService, for the requesting user.
"""
from pydantic import ValidationError
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.jobs.models import JobPosting
from core.memory_service import MemoryService, MemoryServiceError
from core.job_analyzer import JobAnalyzerAgent, JobAnalyzerError
from core.match_agent import MatchDecisionAgent
from core.schemas import JobAnalysis
from core.llm import get_provider


def _job_analysis_from_posting(job: JobPosting) -> JobAnalysis:
    """Explicit adapter for legacy feed records. Does not call an LLM."""
    src = job.description or None
    claim = lambda value: {"value": value, "explicit": True, "source_text": src}
    return JobAnalysis(
        title=claim(job.title), company=claim(job.company), seniority=claim(job.level) if job.level else None,
        employment_type=claim(", ".join(job.job_types)) if job.job_types else None,
        location=claim(job.city) if job.city else None, education=None,
        salary=(
            {"min_amount": job.salary_min, "max_amount": job.salary_max, "currency": None, "period": None, "source_text": src}
            if job.salary_min is not None or job.salary_max is not None else None
        ),
        years_experience=None,
        required_skills=[{"name": s, "category": "other", "explicit": True, "source_text": src} for s in job.required_skills or []],
        preferred_skills=[{"name": s, "category": "other", "explicit": True, "source_text": src} for s in job.optional_skills or []],
        responsibilities=[], qualifications=[], certifications=[], languages=[], other_requirements=[],
    )

_JOB_STATUS = {
    "empty_input": 400, "input_too_short": 400, "input_too_long": 400,
    "llm_rate_limited": 429,
}


def _err(code, message, status, retryable=False):
    return Response({"error": code, "message": message, "retryable": retryable}, status=status)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def analyze_match(request):
    data = request.data or {}
    job_payload = data.get("job_analysis")
    description = data.get("description")
    job_id = data.get("job_id")
    warnings: list[str] = []

    if job_payload is not None:
        try:
            job = JobAnalysis.model_validate((job_payload or {}).get("job", job_payload))
        except ValidationError:
            # field paths and types only; never echo the payload
            return _err("invalid_job_analysis", "The job analysis does not match the expected shape.", 400)
        source = "provided"
    elif description:
        try:
            run = JobAnalyzerAgent().analyze(str(description))
        except JobAnalyzerError as exc:
            pub = exc.public()
            return _err(pub["code"], pub["message"], _JOB_STATUS.get(pub["code"], 503), pub["retryable"])
        job = run.job
        warnings.extend(run.warnings)
        source = "analyzed"
    elif job_id:
        posting = JobPosting.objects.filter(id=int(job_id)).first()
        if posting is None:
            return Response({"error": {"code": "job_not_found", "message": "Job not found.", "retryable": False}}, status=404)
        job = _job_analysis_from_posting(posting)
        source = "job_posting"
    else:
        return _err("job_required", "Provide job_analysis, description, or job_id.", 400)

    try:
        service = MemoryService(request.user)
        snapshot = service.snapshot()
        provider = None
        explain_with_llm = bool(data.get("explain_with_llm"))
        if explain_with_llm:
            try:
                provider = get_provider()
            except Exception:
                provider = None
        result = MatchDecisionAgent(provider=provider, enable_llm_explanation=explain_with_llm).analyze(job, snapshot)
    except (MemoryServiceError, Exception):
        return _err("match_failed", "The match could not be computed.", 500)

    payload = result.model_dump(mode="json")
    payload["warnings"] = list(payload.get("warnings") or []) + warnings
    return Response({"match_result": payload, "job_source": source})
