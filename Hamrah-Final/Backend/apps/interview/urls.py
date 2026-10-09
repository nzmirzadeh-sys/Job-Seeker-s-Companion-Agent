from django.urls import path
from . import views

urlpatterns = [
    path("start/", views.start_interview, name="interview_start"),
    path("answer/", views.submit_answer, name="interview_answer"),
    path("<int:session_id>/", views.get_session, name="interview_get"),
]
