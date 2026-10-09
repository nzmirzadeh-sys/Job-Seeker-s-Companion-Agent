from django.http import HttpResponse
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.resumes.models import Resume
from apps.resumes.pdf import resume_to_html, resume_to_pdf_bytes
from apps.resumes.serializers import ResumeListSerializer, ResumeSerializer
from apps.resumes.truth_guard import ResumeTruthGuard
from core.memory_service import MemoryService, MemoryServiceError


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def resumes_collection(request):
    if request.method == "GET":
        queryset = Resume.objects.filter(user=request.user)
        return Response(ResumeListSerializer(queryset, many=True).data)

    data = request.data or {}
    last = (
        Resume.objects.filter(user=request.user).order_by("-version").first()
    )
    version = (last.version + 1) if last else 1
    resume = Resume.objects.create(
        user=request.user,
        version=version,
        title=data.get("title") or "رزومهٔ من",
        content=data.get("content") or {},
        active=True,
    )
    Resume.objects.filter(user=request.user).exclude(id=resume.id).update(active=False)
    return Response(ResumeSerializer(resume).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def resume_detail(request, resume_id):
    resume = Resume.objects.filter(user=request.user, id=resume_id).first()
    if resume is None:
        return Response({"detail": "not found"}, status=404)

    if request.method == "GET":
        return Response(ResumeSerializer(resume).data)

    if request.method == "PATCH":
        data = request.data or {}
        if "title" in data:
            resume.title = data["title"]
        if "content" in data:
            resume.content = data["content"]
        if "active" in data:
            resume.active = bool(data["active"])
        resume.save()
        return Response(ResumeSerializer(resume).data)

    resume.delete()
    return Response(status=204)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def resume_pdf(request, resume_id):
    resume = Resume.objects.filter(user=request.user, id=resume_id).first()
    if resume is None:
        return Response({"detail": "not found"}, status=404)
    pdf_bytes, mode = resume_to_pdf_bytes(resume)
    if pdf_bytes:
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = (
            'attachment; filename="resume-v' + str(resume.version) + '.pdf"'
        )
        return response
    html = resume_to_html(resume)
    response = HttpResponse(html, content_type="text/html; charset=utf-8")
    response["X-Resume-PDF-Mode"] = "html"
    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def resume_truth_report(request, resume_id):
    """Get a truth report for a resume, showing which claims are verified vs unsupported.

    Response:
    {
        "resume_id": 7,
        "truth_report": [...],
        "overall_truth_score": 0.72,
        "verified_claims": 8,
        "unsupported_claims": 3,
        "needs_clarification_claims": 2
    }
    """
    resume = Resume.objects.filter(user=request.user, id=resume_id).first()
    if resume is None:
        return Response({"detail": "not found"}, status=404)

    try:
        service = MemoryService(request.user)
        snapshot = service.snapshot()

        guard = ResumeTruthGuard(snapshot)
        result = guard.verify_resume_content(resume.content)

        result["resume_id"] = resume.id
        return Response(result)
    except MemoryServiceError as exc:
        return Response({"error": exc.public()}, status=401)
    except Exception as exc:
        return Response(
            {"error": {"code": "truth_report_failed", "message": "Truth report generation failed.", "retryable": False}},
            status=500
        )
