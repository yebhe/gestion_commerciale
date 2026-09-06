from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView,
    CustomTokenObtainPairView,
    ProfileView,
    user_permissions,
    SwitchCompanyView,
    RoleViewSet,
    EmployeeViewSet,
    AllPermissionsView,
)

router = DefaultRouter()
router.register('roles', RoleViewSet, basename='role')
router.register('employees', EmployeeViewSet, basename='employee')

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', CustomTokenObtainPairView.as_view(), name='login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('permissions/', user_permissions, name='user_permissions'),
    path('all-permissions/', AllPermissionsView.as_view(), name='all_permissions'),
    path('switch-company/', SwitchCompanyView.as_view(), name='switch_company'),
    path('', include(router.urls)),
]
