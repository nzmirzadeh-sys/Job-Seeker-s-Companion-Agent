from django.conf import settings
from django.db import models

RUBRIC_VERSION = "interview-rubric/1"


class InterviewSession(models.Model):
    """A session of AI-powered interview practice for a specific job."""

    STATUS_CHOICES = [
        ("in_progress", "In Progress"),
        ("done", "Done"),
        ("cancelled", "Cancelled"),
    ]
    INTERVIEW_TYPES = [
        ("technical", "Technical"),
        ("behavioral", "Behavioral"),
        ("general", "General"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="interview_sessions"
    )
    job_posting = models.ForeignKey(
        "jobs.JobPosting",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="interview_sessions",
    )
    interview_type = models.CharField(
        max_length=16, choices=INTERVIEW_TYPES, default="technical"
    )
    rubric_version = models.CharField(max_length=32, default=RUBRIC_VERSION)
    max_questions = models.PositiveSmallIntegerField(default=3)
    job_analysis = models.JSONField(help_text="JobAnalysis snapshot from Stage 1")
    persona = models.CharField(
        max_length=100, default="مدیر فنی سخت‌گیر", help_text="Interviewer persona"
    )
    questions = models.JSONField(default=list, help_text="List of questions asked")
    answers = models.JSONField(default=list, help_text="List of user answers")
    feedback_history = models.JSONField(default=list, help_text="List of feedback for each answer")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="in_progress")
    summary = models.JSONField(null=True, blank=True, help_text="Final interview summary")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "جلسه مصاحبه"
        verbose_name_plural = "جلسات مصاحبه"

    def __str__(self):
        return f"{self.user.username} - {self.persona} ({self.status})"
