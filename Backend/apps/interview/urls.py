from django.urls import path
from . import views

urlpatterns = [
    path("start/", views.start_interview, name="interview_start"),
    path("answer/", views.submit_answer, name="interview_answer"),
    path("history/", views.interview_history, name="interview_history"),
    path("progress/", views.interview_progress, name="interview_progress"),
    path("reports/<int:session_id>/", views.interview_report, name="interview_report"),
    path("<int:session_id>/", views.get_session, name="interview_get"),
]
