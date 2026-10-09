from django.contrib import admin

from .models import (
    CareerGoal,
    CareerMemoryRecord,
    Constraint,
    Education,
    Experience,
    MemoryEvidence,
    Preference,
    Project,
    Skill,
)


@admin.register(CareerMemoryRecord)
class CareerMemoryRecordAdmin(admin.ModelAdmin):
    list_display = ("user", "full_name", "headline", "updated_at")
    search_fields = ("user__username", "full_name", "headline")


for model in (Skill, Experience, Project, Education, CareerGoal, Preference, Constraint, MemoryEvidence):
    admin.site.register(model)
