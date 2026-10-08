from rest_framework import serializers

from apps.resumes.models import Resume


class ResumeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resume
        fields = (
            "id",
            "version",
            "title",
            "content",
            "active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "version", "created_at", "updated_at")


class ResumeListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resume
        fields = ("id", "version", "title", "active", "updated_at")
