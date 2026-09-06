from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction

from audit.utils import log_action
from users.permissions import HasPermission
from companies.models import Store
from products.models import Product, StockLevel
from .models import InventoryMovement
from .serializers import InventoryMovementSerializer, adjust_stock_level


class InventoryMovementViewSet(viewsets.ModelViewSet):
    """CRUD mouvements de stock, piloté par les permissions inventory.* (_docs/08)."""
    serializer_class = InventoryMovementSerializer
    permission_classes = (HasPermission,)
    lookup_field = 'uuid'
    permission_map = {
        'list': 'inventory.view',
        'retrieve': 'inventory.view_history',
        'create': 'inventory.stock_entry',
        'update': 'inventory.adjust',
        'partial_update': 'inventory.adjust',
        'destroy': 'inventory.adjust',
        'transfer': 'inventory.stock_transfer',
    }
    search_fields = ['product__name', 'product__barcode', 'store__name']
    filterset_fields = ['product', 'type']

    def get_queryset(self):
        queryset = InventoryMovement.objects.filter(company=self.request.company)
        if getattr(self.request, 'store', None):
            queryset = queryset.filter(store=self.request.store)
        store_uuid = self.request.query_params.get('store')
        if store_uuid:
            queryset = queryset.filter(store__uuid=store_uuid)
        is_transfer = self.request.query_params.get('is_transfer')
        if is_transfer == 'true':
            queryset = queryset.filter(note__istartswith='Transfert')
        elif is_transfer == 'false':
            queryset = queryset.exclude(note__istartswith='Transfert')
        return queryset

    def perform_create(self, serializer):
        if getattr(self.request, 'store', None):
            serializer.save(company=self.request.company, store=self.request.store)
        else:
            serializer.save(company=self.request.company)

    def perform_destroy(self, instance):
        store = instance.store
        movement_uuid = instance.uuid
        metadata = {
            'product': instance.product.name, 'type': instance.type,
            'quantity': instance.quantity, 'store': store.name if store else None,
        }
        if store is None:
            instance.delete()
            log_action(self.request, 'cancel', 'InventoryMovement', movement_uuid, metadata)
            return
        qty = instance.quantity
        with transaction.atomic():
            if instance.type == 'in':
                adjust_stock_level(instance.product, store, -qty)
            elif instance.type == 'out':
                adjust_stock_level(instance.product, store, qty)
            elif instance.type == 'adjustment':
                adjust_stock_level(instance.product, store, -qty)
            instance.delete()
        log_action(self.request, 'cancel', 'InventoryMovement', movement_uuid, metadata)

    @action(detail=False, methods=['post'], permission_classes=[HasPermission],
            url_path='transfer')
    def transfer(self, request):
        required = ['product', 'quantity', 'from_store', 'to_store']
        for field in required:
            if not request.data.get(field):
                return Response(
                    {'error': f'Le champ "{field}" est requis.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        product_uuid = request.data['product']
        from_store_uuid = request.data['from_store']
        to_store_uuid = request.data['to_store']
        quantity = int(request.data['quantity'])

        if from_store_uuid == to_store_uuid:
            return Response(
                {'error': 'Les magasins source et destination doivent être différents.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if quantity <= 0:
            return Response(
                {'error': 'La quantité doit être supérieure à zéro.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        company = getattr(request, 'company', None)
        if not company:
            return Response(
                {'error': 'Aucune entreprise sélectionnée.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            product = Product.objects.get(uuid=product_uuid, company=company)
            from_store = Store.objects.get(uuid=from_store_uuid, company=company)
            to_store = Store.objects.get(uuid=to_store_uuid, company=company)
        except (Product.DoesNotExist, Store.DoesNotExist):
            return Response(
                {'error': 'Produit ou magasin introuvable.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        note = f"Transfert: {from_store.name} → {to_store.name}"

        with transaction.atomic():
            level = StockLevel.objects.select_for_update().filter(product=product, store=from_store).first()
            available = level.quantity if level else 0
            if quantity > available:
                return Response(
                    {'error': f'Stock insuffisant : {available} disponible(s), {quantity} demandé(s).'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            out_movement = InventoryMovement.objects.create(
                company=company, store=from_store, product=product,
                type='out', quantity=quantity, note=note,
            )
            adjust_stock_level(product, from_store, -quantity)

            in_movement = InventoryMovement.objects.create(
                company=company, store=to_store, product=product,
                type='in', quantity=quantity, note=note,
            )
            adjust_stock_level(product, to_store, quantity)

        log_action(request, 'transfer', 'Product', product.uuid, {
            'product': product.name, 'quantity': quantity,
            'from_store': from_store.name, 'to_store': to_store.name,
        })

        return Response(
            {
                'message': 'Transfert effectué avec succès.',
                'out_movement': InventoryMovementSerializer(out_movement, context={'request': request}).data,
                'in_movement': InventoryMovementSerializer(in_movement, context={'request': request}).data,
            },
            status=status.HTTP_201_CREATED,
        )
