"""
URL configuration for JobMatchAI.

Public endpoints (AllowAny by default in settings):
    GET  /api/health/
    POST /api/auth/register/  { username, email?, password }
    POST /api/auth/token/     { username, password }
    POST /api/auth/token/refresh/

Protected (JWT Bearer in Authorization header):
    GET/PUT  /api/profile/
    GET      /api/jobs/feed/           (?limit=&offset=)
    GET      /api/jobs/feed/status/
    POST     /api/jobs/<id>/feedback/  { relevant: bool, reason: str }
    GET      /api/jobs/<id>/match/
    GET      /api/jobs/<id>/details/
    POST     /api/jobs/scrape/         (demo scraper)
    GET/POST /api/resumes/
    GET/PATCH/DELETE /api/resumes/<id>/
    POST     /api/resumes/<id>/pdf/
    GET/POST /api/chat/messages/
    POST     /api/chat/                (SSE agent stream)
    POST     /api/agent/feedback/
"""
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path

from config import agent_views


def health(_request):
    return JsonResponse({"status": "ok"})


api = [
    path("health/", health, name="health"),
    # ---- auth ----
    path(
        "auth/register/",
        agent_views.RegisterView.as_view(),
        name="register",
    ),
    path("auth/token/", agent_views.CustomTokenObtainPairView.as_view(), name="token"),
    path(
        "auth/token/refresh/",
        agent_views.RefreshViewWithProfile.as_view(),
        name="token_refresh",
    ),
    # ---- accounts ----
    path("accounts/", include("apps.accounts.urls")),
    # ---- jobs ----
    path("jobs/", include("apps.jobs.urls")),
    # ---- job applications and outcome learning ----
    path("applications/", include("apps.applications.urls")),
    # ---- resumes ----
    path("resumes/", include("apps.resumes.urls")),
    # ---- agent / chat ----
    path("chat/", include("apps.agent.urls")),
    # ---- datasets (CSV/JSON uploads) ----
    path("datasets/", include("apps.datasets.urls")),
    # ---- career memory / match / interview ----
    path("career/", include("apps.career_memory.urls")),
    path("match/", include("apps.match.urls")),
    # ---- interview ----
    path("interview/", include("apps.interview.urls")),
    # ---- specialised agents ----
    path("resume-writer/", include("apps.resume_writer.urls")),
    path("evidence/", include("apps.evidence_validator.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(api)),
]
