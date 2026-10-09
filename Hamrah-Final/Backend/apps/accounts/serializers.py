from rest_framework import serializers

from apps.accounts.models import Profile


class ProfileSerializer(serializers.ModelSerializer):
    skills = serializers.ListField(child=serializers.CharField(), required=False)
    preferred_job_types = serializers.ListField(
        child=serializers.CharField(), required=False
    )

    class Meta:
        model = Profile
        fields = (
            "full_name",
            "headline",
            "skills",
            "experience_years",
            "level",
            "target_role",
            "city",
            "remote_only",
            "preferred_job_types",
            "min_salary",
            "education",
            "languages",
            "links",
            "completed",
        )
        read_only_fields = ("completed",)

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        has_core = bool(instance.full_name or instance.headline)
        has_skills = bool(instance.skills)
        instance.completed = has_core and has_skills
        instance.save(update_fields=["completed"])
        return instance
