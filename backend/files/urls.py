from rest_framework.routers import DefaultRouter

from .views import CompanyFileViewSet

router = DefaultRouter()
router.register('', CompanyFileViewSet, basename='company-file')

urlpatterns = router.urls
