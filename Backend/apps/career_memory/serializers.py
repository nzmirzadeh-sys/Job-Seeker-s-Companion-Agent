from rest_framework import serializers
from .models import Skill


class SkillSerializer(serializers.ModelSerializer):
    evidence = serializers.SerializerMethodField()

    class Meta:
        model = Skill
        fields = ["id", "name", "category", "level", "years_of_experience", "status", "evidence"]

    def get_evidence(self, obj):
        qs = obj.memory.evidence_items.filter(content_type="skill", object_id=obj.id).order_by("recorded_at")
        return [
            {"source": e.source, "quote": e.quote, "confidence": e.confidence, "timestamp": e.recorded_at.isoformat()}
            for e in qs
        ]
