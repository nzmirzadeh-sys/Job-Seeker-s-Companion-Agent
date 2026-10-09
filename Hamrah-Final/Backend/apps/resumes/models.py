from django.conf import settings
from django.db import models


class Resume(models.Model):
    """A versioned, structured resume (JSON) per user."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="resumes"
    )
    version = models.PositiveIntegerField(default=1)
    title = models.CharField(max_length=160, default="رزومهٔ من")
    content = models.JSONField(default=dict)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "رزومه"
        verbose_name_plural = "رزومه‌ها"
        ordering = ["-version"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "version"], name="uniq_resume_version_per_user"
            )
        ]

    def __str__(self):
        return f"Resume<{self.user.username} v{self.version}>"


class ResumeFeedback(models.Model):
    """Free-text feedback the job seeker gives about their own resume."""

    resume = models.ForeignKey(
        Resume, on_delete=models.CASCADE, related_name="feedbacks"
    )
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "بازخورد رزومه"
        verbose_name_plural = "بازخوردهای رزومه"
        ordering = ["-created_at"]
