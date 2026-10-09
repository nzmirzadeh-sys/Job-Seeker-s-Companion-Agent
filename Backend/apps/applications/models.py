from django.conf import settings
from django.db import models
from django.utils import timezone


class JobApplication(models.Model):
    class Status(models.TextChoices):
        APPLIED = "APPLIED", "Applied"
        SCREENING = "SCREENING", "Screening"
        INTERVIEW = "INTERVIEW", "Interview"
        OFFER = "OFFER", "Offer"
        REJECTED = "REJECTED", "Rejected"
        WITHDRAWN = "WITHDRAWN", "Withdrawn"
        NO_RESPONSE = "NO_RESPONSE", "No response"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="job_applications",
    )
    company = models.CharField(max_length=200)
    job_title = models.CharField(max_length=200)
    job_posting = models.ForeignKey(
        "jobs.JobPosting",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="applications",
    )
    applied_on = models.DateField(default=timezone.localdate)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.APPLIED
    )
    outcome_reason = models.TextField(blank=True)
    required_skills = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-applied_on", "-created_at"]

    def __str__(self):
        return f"{self.job_title} at {self.company}"


class ApplicationSuggestion(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        REJECTED = "rejected", "Rejected"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="application_suggestions",
    )
    suggestion = models.CharField(max_length=800)
    evidence = models.JSONField(default=dict)
    confidence = models.CharField(max_length=10, default="low")
    fingerprint = models.CharField(max_length=64)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "fingerprint"],
                name="uniq_application_suggestion_user_fingerprint",
            )
        ]

    def __str__(self):
        return f"Suggestion for {self.user}"
