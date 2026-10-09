from django.urls import path

from apps.applications import views

urlpatterns = [
    path("", views.ApplicationListCreateView.as_view(), name="application-list"),
    path(
        "suggestions/",
        views.ApplicationSuggestionsView.as_view(),
        name="application-suggestions",
    ),
    path(
        "suggestions/<int:suggestion_id>/decision/",
        views.ApplicationSuggestionDecisionView.as_view(),
        name="application-suggestion-decision",
    ),
    path(
        "<int:pk>/",
        views.ApplicationDetailView.as_view(),
        name="application-detail",
    ),
]
