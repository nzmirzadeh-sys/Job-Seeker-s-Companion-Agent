from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.datasets.models import Dataset
from apps.datasets.serializers import DatasetSerializer


class DatasetViewSet(viewsets.ModelViewSet):
    serializer_class = DatasetSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return Dataset.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_destroy(self, instance):
        instance.file.delete(save=False)
        instance.delete()
