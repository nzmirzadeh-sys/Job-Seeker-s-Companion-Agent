from django.contrib import admin
from .models import InterviewSession


@admin.register(InterviewSession)
class InterviewSessionAdmin(admin.ModelAdmin):
    list_display = ["user", "interview_type", "status", "created_at"]
    list_filter = ["interview_type", "status", "created_at"]
    search_fields = ["user__username", "persona"]
    readonly_fields = ["created_at", "updated_at"]
