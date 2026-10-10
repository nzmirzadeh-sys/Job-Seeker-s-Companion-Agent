from django.urls import path

from .views import validate

urlpatterns = [path("validate/", validate, name="evidence_validate")]
