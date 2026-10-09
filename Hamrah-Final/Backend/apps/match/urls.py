from django.urls import path
from .views import analyze_match

urlpatterns = [path("analyze/", analyze_match, name="analyze_match")]
