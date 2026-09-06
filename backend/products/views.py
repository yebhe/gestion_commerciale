from rest_framework import viewsets, status
from rest_framework.response import Response

from django.db.models import Q, ProtectedError
from django.utils import timezone

from audit.utils import log_action
from users.permissions import HasPermission
from .models import Category, Product
from .serializers import CategorySerializer, ProductSerializer


class CategoryViewSet(viewsets.ModelViewSet):
    """CRUD catégories, piloté par les permissions categories.* (_docs/08)."""
    serializer_class = CategorySerializer
    permission_classes = (HasPermission,)
    lookup_field = 'uuid'
    search_fields = ['name']
    permission_map = {
        'list': 'categories.view',
        'retrieve': 'categories.view',
        'create': 'categories.create',
        'update': 'categories.update',
        'partial_update': 'categories.update',
        'destroy': 'categories.delete',
    }

    def get_queryset(self):
        queryset = Category.objects.filter(company=self.request.company, is_deleted=False)
        if getattr(self.request, 'store', None):
            queryset = queryset.filter(store=self.request.store)
        store_uuid = self.request.query_params.get('store')
        if store_uuid:
            queryset = queryset.filter(
                Q(store__uuid=store_uuid) | Q(store__isnull=True)
            )
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
        log_action(self.request, 'delete', 'Category', instance.uuid, {'name': instance.name})

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


class ProductViewSet(viewsets.ModelViewSet):
    """CRUD produits, piloté par les permissions products.* (_docs/08)."""
    serializer_class = ProductSerializer
    permission_classes = (HasPermission,)
    lookup_field = 'uuid'
    permission_map = {
        'list': 'products.view',
        'retrieve': 'products.view',
        'create': 'products.create',
        'update': 'products.update',
        'partial_update': ['products.update', 'products.change_price'],
        'destroy': 'products.delete',
    }
    filterset_fields = ['category']
    search_fields = ['name', 'barcode']

    def get_queryset(self):
        queryset = Product.objects.filter(company=self.request.company, is_deleted=False)
        if getattr(self.request, 'store', None):
            queryset = queryset.filter(
                Q(store=self.request.store) | Q(stock_levels__store=self.request.store)
            ).distinct()
        store_uuid = self.request.query_params.get('store')
        if store_uuid:
            queryset = queryset.filter(
                Q(store__uuid=store_uuid) | Q(stock_levels__store__uuid=store_uuid)
            ).distinct()
        return queryset

    def perform_create(self, serializer):
        if getattr(self.request, 'store', None):
            serializer.save(company=self.request.company, store=self.request.store)
        else:
            serializer.save(company=self.request.company)

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

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        product_name = instance.name
        product_uuid = instance.uuid
        try:
            instance.is_deleted = True
            instance.deleted_at = timezone.now()
            instance.save(update_fields=['is_deleted', 'deleted_at'])
        except ProtectedError:
            return Response(
                {'error': "Ce produit possède un historique de ventes ou de mouvements de stock et ne peut pas être supprimé."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        log_action(request, 'delete', 'Product', product_uuid, {'name': product_name})
        return Response(status=status.HTTP_204_NO_CONTENT)
