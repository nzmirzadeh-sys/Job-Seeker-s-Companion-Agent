from django.conf import settings
from django.db import models


class Dataset(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="datasets",
    )
    name = models.CharField(max_length=120)
    file = models.FileField(upload_to="datasets/%Y/%m/")
    original_filename = models.CharField(max_length=255)
    file_format = models.CharField(max_length=8)
    file_size = models.PositiveBigIntegerField()
    row_count = models.PositiveIntegerField()
    columns = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name
