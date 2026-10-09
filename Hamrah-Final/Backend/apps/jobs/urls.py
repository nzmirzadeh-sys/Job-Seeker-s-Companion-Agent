from django.urls import path

from apps.jobs import views

urlpatterns = [
    path("feed/", views.feed, name="jobs_feed"),
    path("<int:job_id>/match/", views.match_details, name="job_match"),
    path("<int:job_id>/feedback/", views.feedback, name="job_feedback"),
    path("scrape/", views.scrape_view, name="jobs_scrape"),
]
