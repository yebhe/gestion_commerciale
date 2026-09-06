from rest_framework import viewsets, status
from rest_framework.response import Response
from django.utils import timezone

from audit.utils import log_action
from users.permissions import HasPermission
from .models import Supplier
from .serializers import SupplierSerializer


class SupplierViewSet(viewsets.ModelViewSet):
    """CRUD fournisseurs, piloté par les permissions suppliers.* (_docs/08)."""
    serializer_class = SupplierSerializer
    permission_classes = (HasPermission,)
    lookup_field = 'uuid'
    permission_map = {
        'list': 'suppliers.view',
        'retrieve': 'suppliers.view',
        'create': 'suppliers.create',
        'update': 'suppliers.update',
        'partial_update': 'suppliers.update',
        'destroy': 'suppliers.delete',
    }
    search_fields = ['name', 'phone', 'email']

    def get_queryset(self):
        queryset = Supplier.objects.filter(company=self.request.company, is_deleted=False)
        if getattr(self.request, 'store', None):
            queryset = queryset.filter(store=self.request.store)
        store_uuid = self.request.query_params.get('store')
        if store_uuid:
            queryset = queryset.filter(store__uuid=store_uuid)
        return queryset

    def perform_create(self, serializer):
        if getattr(self.request, 'store', None):
            serializer.save(company=self.request.company, store=self.request.store)
        else:
            serializer.save(company=self.request.company)

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.save(update_fields=['is_deleted', 'deleted_at'])
        log_action(self.request, 'delete', 'Supplier', instance.uuid, {'name': instance.name})

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        client_updated_at = request.data.get('updated_at')
        if client_updated_at and instance.updated_at:
            from django.utils.dateparse import parse_datetime
            client_dt = parse_datetime(client_updated_at)
            if client_dt and client_dt != instance.updated_at:
                return Response(
                    {'detail': 'Conflit : la ressource a été modifiée par un autre utilisateur.',
                     'server_updated_at': instance.updated_at.isoformat(),
                     'client_updated_at': client_updated_at},
                    status=status.HTTP_409_CONFLICT,
                )
        return super().update(request, *args, partial=partial, **kwargs)
