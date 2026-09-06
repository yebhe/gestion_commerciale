from rest_framework import viewsets

from users.permissions import IsSuperAdmin
from .models import Plan, Subscription
from .serializers import PlanSerializer, SubscriptionSerializer


class PlanViewSet(viewsets.ModelViewSet):
    """Gestion des plans d'abonnement (rôle plateforme SUPER_ADMIN)."""
    serializer_class = PlanSerializer
    permission_classes = (IsSuperAdmin,)
    queryset = Plan.objects.all()


class SubscriptionViewSet(viewsets.ModelViewSet):
    """Gestion des abonnements des entreprises (rôle plateforme SUPER_ADMIN)."""
    serializer_class = SubscriptionSerializer
    permission_classes = (IsSuperAdmin,)
    filterset_fields = ['company', 'plan', 'status']
    queryset = Subscription.objects.select_related('company', 'plan').all()
