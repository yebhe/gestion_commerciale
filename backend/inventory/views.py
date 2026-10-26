from django.db import models
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from audit.utils import log_action
from users.permissions import HasPermission
from companies.models import Store
from products.models import Product, StockLevel
from .models import InventoryMovement, Transfer, Warehouse
from .serializers import (
    InventoryMovementSerializer, InventorySessionLineSerializer,
    InventorySessionSerializer, TransferSerializer, WarehouseSerializer,
)
from .services import apply_movement, revert_movement, resolve_warehouse
from . import transfer_workflow


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
        'stock': 'inventory.view',
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
        warehouse_uuid = self.request.query_params.get('warehouse')
        if warehouse_uuid:
            queryset = queryset.filter(warehouse__uuid=warehouse_uuid)
        is_transfer = self.request.query_params.get('is_transfer')
        if is_transfer == 'true':
            queryset = queryset.filter(type__in=('transfer_in', 'transfer_out'))
        elif is_transfer == 'false':
            queryset = queryset.exclude(type__in=('transfer_in', 'transfer_out'))
        return queryset

    def perform_create(self, serializer):
        if getattr(self.request, 'store', None):
            serializer.save(company=self.request.company, store=self.request.store)
        else:
            serializer.save(company=self.request.company)

    def perform_destroy(self, instance):
        revert_movement(
            instance,
            user=self.request.user,
            request=self.request,
            note='Annulation depuis l\'historique des mouvements',
        )

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

        from_warehouse = None
        from_warehouse_uuid = request.data.get('from_warehouse')
        if from_warehouse_uuid:
            from_warehouse = Warehouse.objects.filter(
                uuid=from_warehouse_uuid, store=from_store,
            ).first()
            if not from_warehouse:
                return Response(
                    {'error': 'Entrepôt source introuvable dans ce magasin.'},
                    status=status.HTTP_404_NOT_FOUND,
                )
        from_warehouse = resolve_warehouse(from_store, from_warehouse)

        to_warehouse = None
        to_warehouse_uuid = request.data.get('to_warehouse')
        if to_warehouse_uuid:
            to_warehouse = Warehouse.objects.filter(
                uuid=to_warehouse_uuid, store=to_store,
            ).first()
            if not to_warehouse:
                return Response(
                    {'error': 'Entrepôt destination introuvable dans ce magasin.'},
                    status=status.HTTP_404_NOT_FOUND,
                )
        to_warehouse = resolve_warehouse(to_store, to_warehouse)

        note = f"Transfert: {from_store.name} → {to_store.name}"

        level = StockLevel.objects.filter(
            product=product, store=from_store, warehouse=from_warehouse,
        ).first()
        available = level.quantity if level else 0
        if quantity > available:
            return Response(
                {'error': f'Stock insuffisant : {available} disponible(s), {quantity} demandé(s).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        out_movement = apply_movement(
            company=company, store=from_store, warehouse=from_warehouse,
            product=product, movement_type='transfer_out', quantity=quantity,
            note=note, reason='transfer', user=request.user,
        )
        in_movement = apply_movement(
            company=company, store=to_store, warehouse=to_warehouse,
            product=product, movement_type='transfer_in', quantity=quantity,
            note=note, reason='transfer', user=request.user,
        )

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

    @action(detail=False, methods=['get'], url_path='stock')
    def stock(self, request):
        """Lignes de stock agrégées au niveau demandé (R10-R11) :
        ?store=<uuid> ou ?warehouse=<uuid> ou ?product=<uuid>.
        Sans filtre : agrégat par magasin de l'entreprise.
        """
        from django.db.models import Sum
        from django.utils import timezone
        from .models import StockReservation
        company = request.company
        levels = StockLevel.objects.filter(product__company=company)

        store_uuid = request.query_params.get('store')
        warehouse_uuid = request.query_params.get('warehouse')
        product_uuid = request.query_params.get('product')
        variant_uuid = request.query_params.get('variant')
        lot_uuid = request.query_params.get('lot')
        if getattr(request, 'store', None):
            levels = levels.filter(store=request.store)
        if store_uuid:
            levels = levels.filter(store__uuid=store_uuid)
        if warehouse_uuid:
            levels = levels.filter(warehouse__uuid=warehouse_uuid)
        if product_uuid:
            levels = levels.filter(product__uuid=product_uuid)
        if variant_uuid:
            levels = levels.filter(variant__uuid=variant_uuid)
        if lot_uuid:
            levels = levels.filter(lot__uuid=lot_uuid)

        # Réservations actives non expirées (étape 5.2, R65-R66).
        reservations = StockReservation.objects.filter(
            company=company, status='active',
        ).filter(
            models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=timezone.now())
        )
        if getattr(request, 'store', None):
            reservations = reservations.filter(store=request.store)
        if store_uuid:
            reservations = reservations.filter(store__uuid=store_uuid)
        if warehouse_uuid:
            reservations = reservations.filter(warehouse__uuid=warehouse_uuid)
        if product_uuid:
            reservations = reservations.filter(product__uuid=product_uuid)
        if variant_uuid:
            reservations = reservations.filter(variant__uuid=variant_uuid)
        if lot_uuid:
            reservations = reservations.filter(lot__uuid=lot_uuid)

        if warehouse_uuid:
            reserved_map = {
                (str(r['warehouse__uuid']), str(r['product__uuid'])): r['reserved']
                for r in reservations.values('warehouse__uuid', 'product__uuid')
                .annotate(reserved=Sum('quantity'))
            }
            rows = levels.values(
                'warehouse__uuid', 'warehouse__name', 'warehouse__code',
                'product__uuid', 'product__name',
            ).annotate(quantity=Sum('quantity'))
            data = []
            for r in rows:
                reserved = reserved_map.get(
                    (str(r['warehouse__uuid']), str(r['product__uuid'])), 0)
                data.append({
                    'warehouse': {'uuid': str(r['warehouse__uuid']),
                                  'name': r['warehouse__name'],
                                  'code': r['warehouse__code']},
                    'product': {'uuid': str(r['product__uuid']),
                                'name': r['product__name']},
                    'quantity': r['quantity'],
                    'reserved': reserved,
                    'available': r['quantity'] - reserved,
                })
        else:
            reserved_map = {
                (str(r['store__uuid']), str(r['product__uuid'])): r['reserved']
                for r in reservations.values('store__uuid', 'product__uuid')
                .annotate(reserved=Sum('quantity'))
            }
            rows = levels.values(
                'store__uuid', 'store__name',
                'product__uuid', 'product__name',
            ).annotate(quantity=Sum('quantity'))
            data = []
            for r in rows:
                reserved = reserved_map.get(
                    (str(r['store__uuid']), str(r['product__uuid'])), 0)
                data.append({
                    'store': {'uuid': str(r['store__uuid']),
                              'name': r['store__name']},
                    'product': {'uuid': str(r['product__uuid']),
                                'name': r['product__name']},
                    'quantity': r['quantity'],
                    'reserved': reserved,
                    'available': r['quantity'] - reserved,
                })

        # Transit (3.4, R39-R40) : quantités expédiées non encore reçues,
        # rattachées au magasin destination.
        transit_qs = Transfer.objects.filter(
            company=company, status='in_transit',
        )
        if store_uuid:
            transit_qs = transit_qs.filter(to_store__uuid=store_uuid)
        if warehouse_uuid:
            transit_qs = transit_qs.filter(to_warehouse__uuid=warehouse_uuid)
        if product_uuid:
            transit_qs = transit_qs.filter(items__product__uuid=product_uuid)
        transit_rows = transit_qs.values(
            'to_store__uuid', 'to_store__name',
            'to_warehouse__uuid', 'to_warehouse__name',
            'items__product__uuid', 'items__product__name',
        ).annotate(in_transit=Sum('items__quantity_shipped'))
        transit = [
            {
                'store': {'uuid': str(r['to_store__uuid']),
                          'name': r['to_store__name']},
                'warehouse': {'uuid': str(r['to_warehouse__uuid']),
                              'name': r['to_warehouse__name']},
                'product': {'uuid': str(r['items__product__uuid']),
                            'name': r['items__product__name']},
                'in_transit': r['in_transit'],
            } for r in transit_rows if r['in_transit']
        ]
        return Response({'stock': data, 'in_transit': transit})


class WarehouseViewSet(viewsets.ModelViewSet):
    """CRUD entrepôts, piloté par les permissions warehouses.* (_docs/08)."""
    serializer_class = WarehouseSerializer
    permission_classes = (HasPermission,)
    lookup_field = 'uuid'
    permission_map = {
        'list': 'warehouses.view',
        'retrieve': 'warehouses.view',
        'create': 'warehouses.create',
        'update': 'warehouses.update',
        'partial_update': 'warehouses.update',
        'destroy': 'warehouses.delete',
    }
    filterset_fields = ['store', 'is_active', 'is_default', 'type']
    search_fields = ['name', 'code']

    def get_queryset(self):
        queryset = Warehouse.objects.filter(company=self.request.company)
        if getattr(self.request, 'store', None):
            queryset = queryset.filter(store=self.request.store)
        store_uuid = self.request.query_params.get('store')
        if store_uuid:
            queryset = queryset.filter(store__uuid=store_uuid)
        return queryset

    def perform_create(self, serializer):
        store = serializer.validated_data.get('store')
        serializer.save(company=self.request.company, store=store)
        log_action(self.request, 'create', 'Warehouse', serializer.instance.uuid, {
            'name': serializer.instance.name, 'store': store.name if store else None,
        })

    def perform_destroy(self, instance):
        from rest_framework.exceptions import ValidationError
        if instance.is_default:
            raise ValidationError("Impossible de supprimer l'entrepôt par défaut.")
        if instance.stock_levels.exists() or instance.inventory_movements.exists():
            raise ValidationError("Cet entrepôt contient du stock ou des mouvements.")
        log_action(self.request, 'delete', 'Warehouse', instance.uuid, {
            'name': instance.name,
        })
        instance.delete()


class TransferViewSet(viewsets.ModelViewSet):
    """Transferts avec workflow de statuts (_docs/15, étape 3)."""
    serializer_class = TransferSerializer
    permission_classes = (HasPermission,)
    lookup_field = 'uuid'
    http_method_names = ['get', 'post', 'delete', 'head', 'options']
    permission_map = {
        'list': 'inventory.view',
        'retrieve': 'inventory.view',
        'create': 'inventory.stock_transfer',
        'destroy': 'inventory.transfer_cancel',
        'request_action': 'inventory.stock_transfer',
        'validate': 'inventory.transfer_validate',
        'reject': 'inventory.transfer_validate',
        'prepare': 'inventory.transfer_ship',
        'ship': 'inventory.transfer_ship',
        'receive': 'inventory.transfer_receive',
        'cancel': 'inventory.transfer_cancel',
    }
    filterset_fields = ['status', 'transfer_type']
    search_fields = ['number', 'items__product__name']

    def get_queryset(self):
        qs = Transfer.objects.filter(
            company=self.request.company,
        ).prefetch_related('items__product')
        if getattr(self.request, 'store', None):
            store = self.request.store
            qs = qs.filter(models.Q(from_store=store) | models.Q(to_store=store))
        store_uuid = self.request.query_params.get('store')
        if store_uuid:
            qs = qs.filter(
                models.Q(from_store__uuid=store_uuid)
                | models.Q(to_store__uuid=store_uuid))
        warehouse_uuid = self.request.query_params.get('warehouse')
        if warehouse_uuid:
            qs = qs.filter(
                models.Q(from_warehouse__uuid=warehouse_uuid)
                | models.Q(to_warehouse__uuid=warehouse_uuid))
        return qs.distinct()

    def perform_destroy(self, instance):
        from rest_framework.exceptions import ValidationError
        if instance.status not in ('draft', 'requested'):
            raise ValidationError(
                "Seul un brouillon ou une demande peut être supprimé ; "
                "utilisez l'action annuler sinon."
            )
        instance.delete()

    def _run(self, request, transfer, fn, **kwargs):
        try:
            fn(transfer, user=request.user, request=request, **kwargs)
        except Exception as exc:
            from rest_framework.exceptions import ValidationError
            if isinstance(exc, ValidationError):
                raise
            raise ValidationError(str(exc))
        return Response(
            TransferSerializer(transfer, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='request')
    def request_action(self, request, uuid=None):
        return self._run(request, self.get_object(), transfer_workflow.request_transfer)

    @action(detail=True, methods=['post'])
    def validate(self, request, uuid=None):
        return self._run(request, self.get_object(), transfer_workflow.validate_transfer)

    @action(detail=True, methods=['post'])
    def reject(self, request, uuid=None):
        return self._run(
            request, self.get_object(), transfer_workflow.reject_transfer,
            reason=request.data.get('reason', ''),
        )

    @action(detail=True, methods=['post'])
    def prepare(self, request, uuid=None):
        return self._run(request, self.get_object(), transfer_workflow.prepare_transfer)

    @action(detail=True, methods=['post'])
    def ship(self, request, uuid=None):
        return self._run(request, self.get_object(), transfer_workflow.ship_transfer)

    @action(detail=True, methods=['post'])
    def receive(self, request, uuid=None):
        return self._run(
            request, self.get_object(), transfer_workflow.receive_transfer,
            quantities=request.data.get('quantities'),
        )

    @action(detail=True, methods=['post'])
    def cancel(self, request, uuid=None):
        return self._run(request, self.get_object(), transfer_workflow.cancel_transfer)


class InventorySessionViewSet(viewsets.ModelViewSet):
    """Sessions d'inventaire (_docs/15, étape 6, R67-R70).

    - create : ouvre une session et génère les lignes dans le scope ;
    - POST {uuid}/count {line, counted_quantity} : saisie d'un comptage ;
    - POST {uuid}/validate : crée les mouvements type=inventory (R70) ;
    - POST {uuid}/cancel : annule une session non validée.
    """
    serializer_class = InventorySessionSerializer
    permission_classes = (HasPermission,)
    lookup_field = 'uuid'
    http_method_names = ['get', 'post', 'delete', 'head', 'options']
    permission_map = {
        'list': 'inventory.view',
        'retrieve': 'inventory.view',
        'create': 'inventory.adjust',
        'destroy': 'inventory.adjust',
        'count': 'inventory.adjust',
        'validate': 'inventory.inventory_validate',
        'cancel': 'inventory.adjust',
    }
    filterset_fields = ['status', 'scope']
    search_fields = ['lines__product__name', 'note']

    def get_queryset(self):
        from .models import InventorySession
        qs = InventorySession.objects.filter(
            company=self.request.company,
        ).prefetch_related('lines__product', 'lines__variant',
                           'lines__lot', 'lines__warehouse')
        if getattr(self.request, 'store', None):
            qs = qs.filter(store=self.request.store)
        store_uuid = self.request.query_params.get('store')
        if store_uuid:
            qs = qs.filter(store__uuid=store_uuid)
        warehouse_uuid = self.request.query_params.get('warehouse')
        if warehouse_uuid:
            qs = qs.filter(warehouse__uuid=warehouse_uuid)
        return qs

    def perform_destroy(self, instance):
        from . import services
        services.cancel_inventory_session(instance)
        instance.delete()

    @action(detail=True, methods=['post'])
    def count(self, request, uuid=None):
        """Saisie du comptage d'une ligne : {line: <id>, counted_quantity: n}."""
        from .models import InventorySessionLine
        from . import services
        session = self.get_object()
        line_id = request.data.get('line')
        counted = request.data.get('counted_quantity')
        try:
            counted = int(counted)
        except (TypeError, ValueError):
            return Response(
                {'counted_quantity': "Quantité entière requise."},
                status=status.HTTP_400_BAD_REQUEST)
        line = InventorySessionLine.objects.filter(
            pk=line_id, session=session).first()
        if line is None:
            return Response({'line': "Ligne introuvable dans cette session."},
                            status=status.HTTP_404_NOT_FOUND)
        try:
            services.record_count(line, counted, user=request.user)
        except Exception as exc:
            from rest_framework.exceptions import ValidationError
            if isinstance(exc, ValidationError):
                raise
            raise ValidationError(str(exc))
        return Response(
            InventorySessionLineSerializer(line).data)

    @action(detail=True, methods=['post'])
    def validate(self, request, uuid=None):
        from . import services
        session = self.get_object()
        try:
            services.validate_inventory_session(
                session, user=request.user, request=request)
        except Exception as exc:
            from rest_framework.exceptions import ValidationError
            if isinstance(exc, ValidationError):
                raise
            raise ValidationError(str(exc))
        return Response(
            InventorySessionSerializer(session, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, uuid=None):
        from . import services
        session = self.get_object()
        try:
            services.cancel_inventory_session(session)
        except Exception as exc:
            from rest_framework.exceptions import ValidationError
            if isinstance(exc, ValidationError):
                raise
            raise ValidationError(str(exc))
        return Response(
            InventorySessionSerializer(session, context={'request': request}).data)
