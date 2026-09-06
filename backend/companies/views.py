from rest_framework import generics, viewsets
from rest_framework.permissions import IsAuthenticated

from users.permissions import IsSuperAdmin, HasPermission
from .models import Company, Store
from .serializers import CompanySerializer, StoreSerializer


class MyCompaniesView(generics.ListAPIView):
    """Liste des entreprises dont l'utilisateur authentifié est membre."""
    serializer_class = CompanySerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        return Company.objects.filter(memberships__user=self.request.user)


class PlatformCompanyListView(generics.ListAPIView):
    """
    Liste de toutes les entreprises (franchises) de la plateforme.
    Réservé au SUPER_ADMIN (_docs/06_ROLES_ET_PERMISSIONS.txt, section 2 :
    can_manage_companies / can_view_global_reports).
    """
    serializer_class = CompanySerializer
    permission_classes = (IsSuperAdmin,)
    queryset = Company.objects.all()


class CompanyDetailView(generics.RetrieveUpdateAPIView):
    """
    Consultation/modification de l'entreprise courante (request.company),
    pilotée par les permissions company.* (_docs/08_SYSTEM_ PERMISSIONS_CENTRAL.txt).
    """
    serializer_class = CompanySerializer
    permission_classes = (HasPermission,)
    permission_map = {
        'GET': 'company.view',
        'PUT': 'company.update',
        'PATCH': 'company.manage_settings',
    }

    def get_object(self):
        return self.request.company


class StoreViewSet(viewsets.ModelViewSet):
    """
    CRUD magasins, piloté par les permissions stores.* (_docs/08_SYSTEM_
    PERMISSIONS_CENTRAL.txt). Un rôle scope STORE (Manager, Cashier,
    Stock Manager) ne voit et ne peut modifier que son magasin assigné,
    sans pouvoir en créer ou en supprimer.
    """
    serializer_class = StoreSerializer
    permission_classes = (HasPermission,)
    lookup_field = 'uuid'
    search_fields = ['name', 'address', 'phone']
    permission_map = {
        'list': 'stores.view',
        'retrieve': 'stores.view',
        'create': 'stores.create',
        'update': 'stores.update',
        'partial_update': 'stores.update',
        'destroy': 'stores.delete',
    }

    def get_queryset(self):
        queryset = Store.objects.filter(company=self.request.company)
        if getattr(self.request, 'store', None):
            queryset = queryset.filter(id=self.request.store.id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(company=self.request.company)
