from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import Profile
from apps.jobs.matching import score_job
from apps.jobs.feed import profile_to_dict
from apps.jobs.models import JobPosting, Match
from apps.jobs.serializers import JobPostingSerializer, MatchSerializer
from apps.jobs.scraper import scrape_jobs


def profile_dict_for(user):
    profile, _ = Profile.objects.get_or_create(user=user)
    return profile_to_dict(profile)


def apply_result(match, result):
    match.score = result["score"]
    match.breakdown = result["breakdown"]
    match.reasons = result["reasons"]
    match.missing_skills = result["missing_skills"]
    match.save()


def rescore_all(user):
    count = 0
    prof = profile_dict_for(user)
    for job in JobPosting.objects.all():
        match, _ = Match.objects.get_or_create(user=user, job=job)
        result = score_job(prof, JobPostingSerializer(job).data)
        apply_result(match, result)
        count = count + 1
    return count


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def feed(request):
    rescore_all(request.user)
    queryset = (
        Match.objects.filter(user=request.user)
        .exclude(status="dismissed")
        .select_related("job")
        .order_by("-score", "-updated_at")
    )
    try:
        limit = int(request.GET.get("limit", "20"))
    except ValueError:
        limit = 20
    limit = max(1, min(limit, 50))
    try:
        offset = int(request.GET.get("offset", "0"))
    except ValueError:
        offset = 0
    offset = max(0, offset)
    rows = list(queryset[offset : offset + limit])
    return Response({
        "count": queryset.count(),
        "results": MatchSerializer(rows, many=True).data,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def match_details(request, job_id):
    job = JobPosting.objects.filter(id=job_id).first()
    if job is None:
        return Response({"detail": "not found"}, status=404)
    prof = profile_dict_for(request.user)
    result = score_job(prof, JobPostingSerializer(job).data)
    result["job"] = JobPostingSerializer(job).data
    return Response(result)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def feedback(request, job_id):
    job = JobPosting.objects.filter(id=job_id).first()
    if job is None:
        return Response({"detail": "not found"}, status=404)
    data = request.data or {}
    relevant = bool(data.get("relevant"))
    reason = str(data.get("reason") or "")[:500]
    match, _ = Match.objects.get_or_create(user=request.user, job=job)
    match.feedback = reason
    match.status = "saved" if relevant else "dismissed"
    match.save()
    rescore_all(request.user)
    return Response({"ok": True, "status": match.status})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def scrape_view(request):
    jobs, note = scrape_jobs()
    created = []
    for item in jobs:
        ref = item.get("source_ref") or ("manual:" + str(item.get("company", "")))
        obj, was_created = JobPosting.objects.get_or_create(
            source="scrape",
            source_ref=ref,
            defaults={
                "title": item.get("title") or "",
                "company": item.get("company") or "",
                "city": item.get("city") or "",
                "level": item.get("level") or "mid",
                "required_skills": item.get("required_skills") or [],
                "optional_skills": item.get("optional_skills") or [],
                "job_types": item.get("job_types") or [],
                "description": item.get("description") or "",
                "url": item.get("url") or "",
            },
        )
        if was_created:
            created.append(JobPostingSerializer(obj).data)
    rescore_all(request.user)
    return Response({
        "note": note,
        "created_count": len(created),
        "created": created,
    })
