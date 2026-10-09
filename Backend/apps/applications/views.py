from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.applications.models import ApplicationSuggestion, JobApplication
from apps.applications.serializers import (
    ApplicationSuggestionSerializer,
    JobApplicationSerializer,
)
from apps.applications.services import ApplicationService


class ApplicationPagination(LimitOffsetPagination):
    default_limit = 20
    max_limit = 100


class ApplicationListCreateView(generics.ListCreateAPIView):
    serializer_class = JobApplicationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = ApplicationPagination

    def get_queryset(self):
        return JobApplication.objects.filter(user=self.request.user).select_related(
            "job_posting"
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ApplicationDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = JobApplicationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return JobApplication.objects.filter(user=self.request.user).select_related(
            "job_posting"
        )


class ApplicationSuggestionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        suggestions = ApplicationSuggestion.objects.filter(user=request.user)
        return Response(
            {
                "count": suggestions.count(),
                "results": ApplicationSuggestionSerializer(
                    suggestions, many=True
                ).data,
            }
        )

    def post(self, request):
        return Response(
            ApplicationService(request.user).generate_suggestions(),
            status=status.HTTP_200_OK,
        )


class ApplicationSuggestionDecisionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, suggestion_id):
        decision = (
            request.data.get("decision") if isinstance(request.data, dict) else None
        )
        if decision not in (
            ApplicationSuggestion.Status.ACCEPTED,
            ApplicationSuggestion.Status.REJECTED,
        ):
            return Response(
                {"decision": ["Choose 'accepted' or 'rejected'."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        get_object_or_404(
            ApplicationSuggestion, id=suggestion_id, user=request.user
        )
        updated = ApplicationSuggestion.objects.filter(
            id=suggestion_id,
            user=request.user,
            status=ApplicationSuggestion.Status.PENDING,
        ).update(status=decision, updated_at=timezone.now())
        if not updated:
            return Response(
                {"detail": "This suggestion has already been decided."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {
                "id": suggestion_id,
                "status": decision,
                "career_memory_updated": False,
            }
        )
