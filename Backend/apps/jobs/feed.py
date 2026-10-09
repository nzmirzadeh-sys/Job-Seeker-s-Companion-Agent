"""Single source of truth for "which jobs are in this user's personal feed".

The ``feed`` endpoint (apps/jobs/views.py) ranks job postings for a user with the
rule-based ``score_job`` engine and hides postings the user dismissed. Read-only
consumers (What-If Simulator, Gap Priority) must run on exactly that set, not on
``JobPosting.objects.all()``. This module resolves it WITHOUT writing anything:
no ``Match`` rows are created/updated and no ``Profile`` is created.
"""
from __future__ import annotations

from typing import List

from apps.accounts.models import Profile
from apps.jobs.analysis import job_analysis_from_posting
from apps.jobs.matching import score_job
from apps.jobs.models import JobPosting, Match
from apps.jobs.serializers import JobPostingSerializer

FEED_MAX_LIMIT = 50  # same hard cap the feed endpoint applies to ``limit``


def profile_to_dict(profile: Profile | None) -> dict:
    """Profile -> dict consumed by ``score_job``. ``None`` means an empty profile."""
    if profile is None:
        return {"skills": [], "level": "junior", "experience_years": 0,
                "city": "", "remote_only": False, "target_role": ""}
    return {
        "skills": profile.skills or [],
        "level": profile.level,
        "experience_years": profile.experience_years,
        "city": profile.city,
        "remote_only": profile.remote_only,
        "target_role": profile.target_role,
    }


def get_feed_postings(user, limit: int = FEED_MAX_LIMIT, offset: int = 0) -> List[JobPosting]:
    """Return the postings in ``user``'s personal feed, best match first. Read-only.

    Mirrors the feed endpoint: dismissed postings are excluded, the rest are ordered
    by descending ``score_job`` score (ties: oldest posting first, as the endpoint's
    ``-updated_at`` ordering yields), then sliced by ``offset``/``limit``.
    """
    limit = max(1, min(int(limit), FEED_MAX_LIMIT))
    offset = max(0, int(offset))
    profile_dict = profile_to_dict(Profile.objects.filter(user=user).first())
    dismissed = Match.objects.filter(user=user, status="dismissed").values_list("job_id", flat=True)
    postings = list(JobPosting.objects.exclude(id__in=list(dismissed)))  # default order: newest first
    postings.reverse()  # oldest first, so the stable sort below keeps the endpoint's tie order
    scored = [(score_job(profile_dict, JobPostingSerializer(p).data)["score"], p) for p in postings]
    scored.sort(key=lambda pair: -pair[0])
    return [p for _, p in scored][offset: offset + limit]


def get_feed_job_analyses(user, limit: int = FEED_MAX_LIMIT):
    """The user's personal feed as ``JobAnalysis`` objects (what Match Agent consumes)."""
    return [job_analysis_from_posting(p) for p in get_feed_postings(user, limit=limit)]
