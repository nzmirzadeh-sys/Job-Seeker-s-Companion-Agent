from django.db import models


class JobPosting(models.Model):
    """A job ad, either seeded for the demo or fetched by the demo scraper."""

    SOURCES = [("seed", "داده اولیه"), ("scrape", "اسکرپ")]

    title = models.CharField(max_length=200)
    company = models.CharField(max_length=200)
    city = models.CharField(max_length=80, blank=True)
    level = models.CharField(max_length=16, blank=True)  # intern/junior/mid/senior
    required_skills = models.JSONField(default=list)
    optional_skills = models.JSONField(default=list, blank=True)
    job_types = models.JSONField(default=list, blank=True)  # onsite/remote/hybrid
    salary_min = models.IntegerField(null=True, blank=True)
    salary_max = models.IntegerField(null=True, blank=True)
    description = models.TextField(blank=True)
    url = models.CharField(max_length=400, blank=True)
    source = models.CharField(max_length=10, choices=SOURCES, default="seed")
    source_ref = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "آگهی شغلی"
        verbose_name_plural = "آگهی‌های شغلی"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} @ {self.company}"


class Match(models.Model):
    """Per-user score & status for a job posting."""

    STATUS = [
        ("new", "جدید"),
        ("saved", "ذخیره"),
        ("dismissed", "ردشده"),
        ("applied", "درخواست داده"),
    ]

    user = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="matches"
    )
    job = models.ForeignKey(
        JobPosting, on_delete=models.CASCADE, related_name="matches"
    )
    score = models.IntegerField(default=0)  # 0..100
    breakdown = models.JSONField(default=dict, blank=True)
    reasons = models.JSONField(default=list, blank=True)
    missing_skills = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=12, choices=STATUS, default="new")
    feedback = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "تناسب آگهی"
        verbose_name_plural = "تناسب آگهی‌ها"
        unique_together = ("user", "job")
        ordering = ["-score"]

    def __str__(self):
        return f"{self.user}×{self.job} = {self.score}"
