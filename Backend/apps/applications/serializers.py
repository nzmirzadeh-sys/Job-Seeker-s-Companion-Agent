from rest_framework import serializers
from django.utils import timezone

from apps.applications.models import ApplicationSuggestion, JobApplication
from apps.jobs.models import JobPosting


class JobApplicationSerializer(serializers.ModelSerializer):
    job_posting = serializers.PrimaryKeyRelatedField(
        queryset=JobPosting.objects.all(), required=False, allow_null=True
    )
    required_skills = serializers.ListField(
        child=serializers.CharField(max_length=120, allow_blank=False),
        required=False,
        max_length=30,
    )

    class Meta:
        model = JobApplication
        fields = (
            "id",
            "company",
            "job_title",
            "job_posting",
            "applied_on",
            "status",
            "outcome_reason",
            "required_skills",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_applied_on(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError("Application date cannot be in the future.")
        return value


class ApplicationSuggestionSerializer(serializers.ModelSerializer):
    requires_user_confirmation = serializers.SerializerMethodField()

    class Meta:
        model = ApplicationSuggestion
        fields = (
            "id",
            "suggestion",
            "evidence",
            "confidence",
            "requires_user_confirmation",
            "status",
            "created_at",
        )
        read_only_fields = fields

    @staticmethod
    def get_requires_user_confirmation(_instance):
        return True
