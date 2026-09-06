from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import MyCompaniesView, PlatformCompanyListView, CompanyDetailView, StoreViewSet

router = DefaultRouter()
router.register('stores', StoreViewSet, basename='store')

urlpatterns = [
    path('my/', MyCompaniesView.as_view(), name='my-companies'),
    path('all/', PlatformCompanyListView.as_view(), name='platform-companies'),
    path('current/', CompanyDetailView.as_view(), name='current-company'),
    path('', include(router.urls)),
]
