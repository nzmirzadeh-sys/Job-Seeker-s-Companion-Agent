from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.career_intelligence import CareerIntelligenceAgent, CareerIntelligenceError
from core.memory_service import MemoryService, MemoryServiceError
from core.whatif_simulator import WhatIfSimulator
from core.gap_priority import GapPriorityAnalyzer
from .serializers import SkillSerializer


# Hidden skill suggestions storage (in-memory for demo; in production, use a proper model)
_hidden_skill_suggestions = {}  # {user_id: [skill_suggestions]}


_CAREER_STATUS = {
    "empty_input": 400, "input_too_short": 400, "input_too_long": 413,
    "llm_not_configured": 503, "llm_invalid_output": 502, "llm_error": 502,
}


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def analyze_career(request):
    message = str((request.data or {}).get("message") or "")
    try:
        service = MemoryService(request.user)
        agent = CareerIntelligenceAgent()
        result = agent.analyze(message, memory_service=service)
        persisted = agent.persist(result, service)
        # Hidden-skill evidence is a list of pydantic objects; make it plain JSON for clients.
        for hidden in persisted.get("hidden_skills", []):
            hidden["evidence"] = [
                e.model_dump(mode="json") if hasattr(e, "model_dump") else e
                for e in hidden.get("evidence") or []
            ]
        return Response({"career_intelligence": result.model_dump(mode="json"), "persisted": persisted})
    except CareerIntelligenceError as exc:
        return Response({"error": exc.public()}, status=_CAREER_STATUS.get(exc.code, 502))
    except MemoryServiceError as exc:
        return Response({"error": exc.public()}, status=401)
    except Exception:
        return Response({"error": {"code": "internal_error", "message": "Career analysis failed.", "retryable": False}}, status=500)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_career_memory(request):
    try:
        memory = MemoryService(request.user)
        snapshot = memory.snapshot()
        data = snapshot.model_dump(mode="json")
        data["verified_skills"] = [s for s in data["skills"] if s["status"] == "confirmed"]
        data["skills_needing_clarification"] = [s for s in data["skills"] if s["status"] in {"unverified", "needs_clarification"}]
        return Response(data)
    except MemoryServiceError as exc:
        return Response({"error": exc.public()}, status=401)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def skills_collection(request):
    try:
        service = MemoryService(request.user)
        if request.method == "GET":
            status = str((request.query_params.get("status") or "")).strip() or None
            return Response({"results": SkillSerializer(service.get_skills(status), many=True).data})
        body = request.data if isinstance(request.data, dict) else {}
        name = str(body.get("name") or "").strip()
        action = str(body.get("action") or "add").strip().lower()
        if not name:
            return Response({"error": {"code": "name_required", "message": "Skill name is required.", "retryable": False}}, status=400)
        if action == "confirm":
            skill = service.confirm_skill(name, level=body.get("level"), years_of_experience=body.get("years_of_experience"), quote=body.get("quote"))
        elif action == "reject":
            skill = service.reject_skill(name, quote=body.get("quote"))
        elif action == "add":
            from core.career_schemas import EvidenceItem
            evidence = None
            if body.get("source") or body.get("quote"):
                evidence = EvidenceItem(source=str(body.get("source") or "user_statement"), quote=body.get("quote"), confidence=str(body.get("confidence") or "high"))
            skill = service.add_skill(name, str(body.get("category") or "other"), str(body.get("level") or "unknown"), body.get("years_of_experience"), evidence)
        else:
            return Response({"error": {"code": "invalid_action", "message": "Invalid skill action.", "retryable": False}}, status=400)
        return Response({"skill": SkillSerializer(skill).data, "status": skill.status})
    except MemoryServiceError as exc:
        return Response({"error": exc.public()}, status=404 if exc.code == "skill_not_found" else 401)
    except (TypeError, ValueError):
        return Response({"error": {"code": "invalid_request", "message": "Invalid skill request.", "retryable": False}}, status=400)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def what_if_simulation(request):
    """Simulate the impact of adding hypothetical skills/certifications.

    Request body:
    {
        "hypothetical": {
            "skills": ["SQL", "Docker"],
            "languages": ["English"],
            "certifications": ["AWS Certified"]
        }
    }

    Response:
    {
        "before_count": {...},
        "after_count": {...},
        "delta": {...},
        "upgraded_jobs": [...]
    }
    """
    try:
        service = MemoryService(request.user)
        snapshot = service.snapshot()

        hypothetical = request.data.get("hypothetical", {})

        # Runs on the user's PERSONAL feed (same set the jobs feed endpoint shows), read-only.
        simulator = WhatIfSimulator()
        result = simulator.simulate_for_user(request.user, snapshot, hypothetical)

        return Response(result)
    except MemoryServiceError as exc:
        return Response({"error": exc.public()}, status=401)
    except Exception as exc:
        return Response(
            {"error": {"code": "simulation_failed", "message": "What-if simulation failed.", "retryable": False}},
            status=500
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def gap_priority(request):
    """Get prioritized list of missing skills ranked by impact.

    Response:
    {
        "prioritized_gaps": [
            {
                "skill": "SQL",
                "jobs_unlocked": 8,
                "sample_job_titles": [...],
                "impact_score": 85
            },
            ...
        ]
    }
    """
    try:
        service = MemoryService(request.user)
        snapshot = service.snapshot()

        # Runs on the user's PERSONAL feed (same set the jobs feed endpoint shows), read-only.
        analyzer = GapPriorityAnalyzer()
        result = analyzer.analyze_for_user(request.user, snapshot)

        return Response({"prioritized_gaps": result})
    except MemoryServiceError as exc:
        return Response({"error": exc.public()}, status=401)
    except Exception as exc:
        return Response(
            {"error": {"code": "analysis_failed", "message": "Gap priority analysis failed.", "retryable": False}},
            status=500
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def confirm_hidden_skill(request):
    """Confirm or reject a hidden skill suggestion.

    Request body:
    {
        "skill_name": "Signal Processing",
        "accept": true
    }

    Response:
    {
        "status": "confirmed" | "rejected",
        "skill": {...}
    }
    """
    try:
        skill_name = request.data.get("skill_name")
        accept = request.data.get("accept", True)

        if not skill_name:
            return Response(
                {"error": {"code": "skill_name_required", "message": "skill_name is required.", "retryable": False}},
                status=400
            )

        service = MemoryService(request.user)
        agent = CareerIntelligenceAgent()

        result = agent.confirm_hidden_skill(skill_name, service, accept=accept)

        return Response(result)
    except MemoryServiceError as exc:
        return Response({"error": exc.public()}, status=401)
    except Exception as exc:
        return Response(
            {"error": {"code": "confirmation_failed", "message": "Hidden skill confirmation failed.", "retryable": False}},
            status=500
        )
