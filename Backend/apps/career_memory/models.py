from django.conf import settings
from django.db import models


class CareerMemoryRecord(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="career_memory"
    )
    full_name = models.CharField(max_length=255, blank=True)
    headline = models.CharField(max_length=300, blank=True)
    summary = models.TextField(blank=True, null=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    location = models.CharField(max_length=120, blank=True)
    websites = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]


class Skill(models.Model):
    STATUS = [
        ("unverified", "Unverified"),
        ("needs_clarification", "Needs clarification"),
        ("confirmed", "Confirmed"),
        ("rejected", "Rejected"),
        ("pending_confirmation", "Pending confirmation"),
    ]
    LEVELS = [
        ("beginner", "Beginner"),
        ("intermediate", "Intermediate"),
        ("advanced", "Advanced"),
        ("expert", "Expert"),
        ("unknown", "Unknown"),
    ]
    memory = models.ForeignKey(CareerMemoryRecord, on_delete=models.CASCADE, related_name="skills")
    name = models.CharField(max_length=120)
    category = models.CharField(max_length=30, blank=True)
    level = models.CharField(max_length=20, choices=LEVELS, default="unknown")
    years_of_experience = models.FloatField(null=True, blank=True)
    status = models.CharField(max_length=30, choices=STATUS, default="unverified")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["memory", "name"], name="uniq_memory_skill_name")]
        ordering = ["name"]


class Experience(models.Model):
    memory = models.ForeignKey(CareerMemoryRecord, on_delete=models.CASCADE, related_name="experiences")
    title = models.CharField(max_length=200)
    company = models.CharField(max_length=200, blank=True)
    years = models.FloatField(null=True, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Project(models.Model):
    memory = models.ForeignKey(CareerMemoryRecord, on_delete=models.CASCADE, related_name="projects")
    name = models.CharField(max_length=200)
    role = models.CharField(max_length=200, blank=True)
    technologies = models.JSONField(default=list, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Education(models.Model):
    memory = models.ForeignKey(CareerMemoryRecord, on_delete=models.CASCADE, related_name="education_records")
    degree = models.CharField(max_length=200)
    field = models.CharField(max_length=200, blank=True)
    school = models.CharField(max_length=200, blank=True)
    graduation_year = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class CareerGoal(models.Model):
    PRIORITIES = [("primary", "Primary"), ("secondary", "Secondary"), ("unknown", "Unknown")]
    memory = models.ForeignKey(CareerMemoryRecord, on_delete=models.CASCADE, related_name="goals")
    role = models.CharField(max_length=200)
    industry = models.CharField(max_length=200, blank=True)
    direction = models.CharField(max_length=300, blank=True)
    priority = models.CharField(max_length=20, choices=PRIORITIES, default="unknown")
    created_at = models.DateTimeField(auto_now_add=True)


class Preference(models.Model):
    PRIORITIES = [("preferred", "Preferred"), ("strong", "Strong"), ("unknown", "Unknown")]
    memory = models.ForeignKey(CareerMemoryRecord, on_delete=models.CASCADE, related_name="preferences")
    category = models.CharField(max_length=80)
    value = models.CharField(max_length=300)
    priority = models.CharField(max_length=20, choices=PRIORITIES, default="preferred")
    created_at = models.DateTimeField(auto_now_add=True)


class Constraint(models.Model):
    memory = models.ForeignKey(CareerMemoryRecord, on_delete=models.CASCADE, related_name="constraints")
    category = models.CharField(max_length=80)
    value = models.CharField(max_length=300)
    hard = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)


class MemoryEvidence(models.Model):
    SOURCE_CHOICES = [
        ("user_statement", "User statement"),
        ("user_confirmation", "User confirmation"),
        ("imported_resume", "Imported resume"),
        ("system", "System"),
    ]
    CONFIDENCE_CHOICES = [("certain", "Certain"), ("high", "High"), ("medium", "Medium"), ("low", "Low")]
    memory = models.ForeignKey(CareerMemoryRecord, on_delete=models.CASCADE, related_name="evidence_items")
    content_type = models.CharField(max_length=50)
    object_id = models.PositiveBigIntegerField()
    source = models.CharField(max_length=30, choices=SOURCE_CHOICES, default="user_statement")
    quote = models.TextField(blank=True, null=True)
    confidence = models.CharField(max_length=10, choices=CONFIDENCE_CHOICES, default="high")
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["memory", "content_type", "object_id"]),
        ]
