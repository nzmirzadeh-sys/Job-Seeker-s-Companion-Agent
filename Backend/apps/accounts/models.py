from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    email = models.EmailField(blank=True)

    def __str__(self):
        return self.username


class Profile(models.Model):
    """Job seeker profile captured through onboarding chat + later edits."""

    EXPERIENCE_LEVELS = [
        ("intern", "کارآموز"),
        ("junior", "جونیور"),
        ("mid", "میان‌رده"),
        ("senior", "ارشد"),
    ]

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="profile"
    )
    full_name = models.CharField("نام و نام خانوادگی", max_length=120, blank=True)
    headline = models.CharField("تیتر حرفه‌ای", max_length=160, blank=True)
    skills = models.JSONField("مهارت‌ها", default=list, blank=True)
    experience_years = models.FloatField("سال تجربه", default=0)
    level = models.CharField("سطح", max_length=16, choices=EXPERIENCE_LEVELS, default="junior")
    target_role = models.CharField("نقش هدف", max_length=120, blank=True)
    city = models.CharField("شهر", max_length=80, blank=True)
    remote_only = models.BooleanField("فقط دورکاری", default=False)
    preferred_job_types = models.JSONField("نوع همکاری", default=list, blank=True)
    min_salary = models.IntegerField("حداقل حقوق (تومان)", null=True, blank=True)
    education = models.CharField("تحصیلات", max_length=120, blank=True)
    languages = models.JSONField("زبان‌ها", default=list, blank=True)
    links = models.JSONField("لینک‌ها", default=dict, blank=True)
    completed = models.BooleanField("تکمیل‌شده", default=False)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profile<{self.user.username}>"
