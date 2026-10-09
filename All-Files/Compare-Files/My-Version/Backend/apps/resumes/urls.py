from django.urls import path

from apps.resumes import views

urlpatterns = [
    path("", views.resumes_collection, name="resumes"),
    path("<int:resume_id>/", views.resume_detail, name="resume_detail"),
    path("<int:resume_id>/pdf/", views.resume_pdf, name="resume_pdf"),
    path("<int:resume_id>/truth-report/", views.resume_truth_report, name="resume_truth_report"),
]
