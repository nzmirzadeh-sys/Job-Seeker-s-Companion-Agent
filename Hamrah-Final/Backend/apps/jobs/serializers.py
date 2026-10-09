from rest_framework import serializers

from apps.jobs.models import JobPosting, Match


class JobPostingSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobPosting
        fields = (
            "id",
            "title",
            "company",
            "city",
            "level",
            "required_skills",
            "optional_skills",
            "job_types",
            "salary_min",
            "salary_max",
            "description",
            "url",
            "source",
            "created_at",
        )


class MatchSerializer(serializers.ModelSerializer):
    job = JobPostingSerializer(read_only=True)

    class Meta:
        model = Match
        fields = (
            "id",
            "job",
            "score",
            "breakdown",
            "reasons",
            "missing_skills",
            "status",
            "feedback",
            "updated_at",
        )
