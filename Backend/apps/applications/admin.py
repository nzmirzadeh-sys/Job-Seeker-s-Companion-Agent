from django.contrib import admin

from apps.applications.models import ApplicationSuggestion, JobApplication


@admin.register(JobApplication)
class JobApplicationAdmin(admin.ModelAdmin):
    list_display = ("job_title", "company", "user", "status", "applied_on")
    list_filter = ("status", "applied_on")
    search_fields = ("job_title", "company", "user__username")


@admin.register(ApplicationSuggestion)
class ApplicationSuggestionAdmin(admin.ModelAdmin):
    list_display = ("user", "status", "confidence", "created_at")
    list_filter = ("status", "confidence")
