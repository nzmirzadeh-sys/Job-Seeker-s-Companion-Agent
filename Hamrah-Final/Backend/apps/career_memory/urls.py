from django.urls import path
from .views import analyze_career, get_career_memory, skills_collection, what_if_simulation, gap_priority, confirm_hidden_skill

urlpatterns = [
    path("analyze/", analyze_career, name="career_analyze"),
    path("memory/", get_career_memory, name="career_memory"),
    path("skills/", skills_collection, name="career_skills"),
    path("what-if/", what_if_simulation, name="career_whatif"),
    path("gap-priority/", gap_priority, name="career_gap_priority"),
    path("hidden-skill/confirm/", confirm_hidden_skill, name="career_hidden_skill_confirm"),
]
