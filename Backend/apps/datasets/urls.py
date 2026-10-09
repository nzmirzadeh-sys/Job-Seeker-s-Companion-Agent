from rest_framework.routers import SimpleRouter

from apps.datasets.views import DatasetViewSet

router = SimpleRouter()
router.register("", DatasetViewSet, basename="dataset")

urlpatterns = router.urls
