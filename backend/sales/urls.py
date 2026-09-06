from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import ChapChapPayWebhookView, SaleViewSet, POSSessionViewSet

router = DefaultRouter()
router.register('sessions', POSSessionViewSet, basename='pos-session')
router.register('', SaleViewSet, basename='sale')

urlpatterns = [
    path('webhooks/chapchappay/', ChapChapPayWebhookView.as_view(), name='chapchappay-webhook'),
] + router.urls
