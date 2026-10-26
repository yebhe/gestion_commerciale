import json

from django.conf import settings
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from audit.utils import log_action
from users.permissions import HasPermission
from django.db import transaction
from inventory.services import (
    apply_movement, consume_reservations, release_reservations,
)
from .chapchappay import ChapChapPayError, create_ecommerce_operation, verify_webhook_signature
from .models import MobileMoneyPayment, Sale, POSSession
from .serializers import SaleSerializer, POSSessionSerializer


class SaleViewSet(viewsets.ModelViewSet):
    """CRUD ventes, piloté par les permissions sales.* (_docs/08)."""
    serializer_class = SaleSerializer
    permission_classes = (HasPermission,)
    lookup_field = 'uuid'
    permission_map = {
        'list': 'sales.view',
        'retrieve': 'sales.view',
        'create': 'sales.create',
        'update': 'sales.refund',
        'partial_update': 'sales.refund',
        'destroy': 'sales.cancel',
        'initiate_mobile_money': 'sales.create',
    }
    search_fields = ['customer__name', 'cashier__email', 'cashier__first_name', 'cashier__last_name', 'receipt__receipt_number']
    filterset_fields = ['customer', 'status', 'payment_method']

    def get_queryset(self):
        queryset = Sale.objects.filter(company=self.request.company).prefetch_related('items', 'receipt')
        if getattr(self.request, 'store', None):
            queryset = queryset.filter(store=self.request.store)
        store_uuid = self.request.query_params.get('store')
        if store_uuid:
            queryset = queryset.filter(store__uuid=store_uuid)
        return queryset

    def perform_create(self, serializer):
        if getattr(self.request, 'store', None):
            serializer.save(company=self.request.company, cashier=self.request.user, store=self.request.store)
        else:
            serializer.save(company=self.request.company, cashier=self.request.user)

    def perform_update(self, serializer):
        old_status = serializer.instance.status
        sale = serializer.save()
        if old_status == 'completed' and sale.status in ('cancelled', 'refunded'):
            self._restore_stock(sale)
            log_action(self.request, sale.status, 'Sale', sale.uuid, {
                'total_amount': str(sale.total_amount), 'previous_status': old_status,
            })
        elif old_status == 'pending' and sale.status in ('cancelled', 'refunded'):
            # Vente en attente annulée : libère les réservations (étape 5.3).
            release_reservations(sale)

    def perform_destroy(self, instance):
        sale_uuid = instance.uuid
        total_amount = str(instance.total_amount)
        was_completed = instance.status == 'completed'
        if was_completed:
            self._restore_stock(instance, request=self.request)
        elif instance.status == 'pending':
            release_reservations(instance)
        instance.delete()
        if was_completed:
            log_action(self.request, 'cancel', 'Sale', sale_uuid, {'total_amount': total_amount})

    @action(detail=True, methods=['post'], url_path='mobile-money')
    def initiate_mobile_money(self, request, uuid=None):
        """
        Crée (ou réutilise) une opération de paiement Chap Chap Pay pour
        cette vente et retourne `payment_url` à présenter au client
        (_docs guide d'intégration : https://chapchappay.com/guide/).
        """
        sale = self.get_object()
        if sale.payment_method != 'mobile_money':
            return Response(
                {'detail': "Cette vente n'utilise pas le paiement Mobile Money."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing = getattr(sale, 'mobile_money_payment', None)
        if existing and existing.status == 'pending' and existing.payment_url:
            return Response(SaleSerializer(sale, context={'request': request}).data)

        notify_url = settings.CHAPCHAPPAY_NOTIFY_URL or None
        try:
            data = create_ecommerce_operation(
                amount=sale.total_amount,
                order_id=str(sale.uuid),
                notify_url=notify_url,
            )
        except ChapChapPayError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        MobileMoneyPayment.objects.update_or_create(
            sale=sale,
            defaults={
                'operation_id': data.get('operation_id'),
                'payment_url': data.get('payment_url'),
                'status': 'pending',
                'raw_response': data,
            },
        )
        return Response(SaleSerializer(sale, context={'request': request}).data)

    def _restore_stock(self, sale, request=None):
        store = sale.store
        if not store:
            return
        for item in sale.items.all():
            apply_movement(
                company=sale.company,
                store=store,
                product=item.product,
                variant=item.variant,
                lot=item.lot,
                movement_type='in',
                quantity=item.quantity,
                user=getattr(request, 'user', None),
                note=f"Annulation vente {sale.uuid}",
                reason='sale_cancel',
                source=sale,
                request=request,
            )

    def _deduct_stock(self, sale, request=None):
        """Sort le stock d'une vente en attente devenue payée (étape 5.3)."""
        store = sale.store
        if not store:
            return
        for item in sale.items.all():
            apply_movement(
                company=sale.company,
                store=store,
                product=item.product,
                variant=item.variant,
                lot=item.lot,
                movement_type='out',
                quantity=item.quantity,
                user=getattr(request, 'user', None),
                note=f"Vente {sale.uuid}",
                reason='sale',
                source=sale,
                request=request,
            )


@method_decorator(csrf_exempt, name='dispatch')
class ChapChapPayWebhookView(View):
    """
    Réception des notifications de paiement Chap Chap Pay (`notify_url`,
    _docs guide d'intégration : https://chapchappay.com/guide/#webhooks).
    Endpoint public (pas d'authentification JWT) mais protégé par la
    vérification de la signature HMAC (en-tête CCP-HMAC-Signature).
    """
    SUCCESS_STATUSES = {'success'}
    FAILURE_STATUSES = {'failed', 'canceled', 'expired', 'error'}

    def post(self, request, *args, **kwargs):
        signature = request.headers.get('CCP-HMAC-Signature', '')
        if not verify_webhook_signature(request.body, signature):
            return JsonResponse({'detail': 'Signature invalide.'}, status=401)

        try:
            payload = json.loads(request.body or b'{}')
        except ValueError:
            return JsonResponse({'detail': 'Payload JSON invalide.'}, status=400)

        operation_id = payload.get('operation_id')
        new_status = payload.get('status')
        if not operation_id or not new_status:
            return JsonResponse({'detail': 'operation_id et status requis.'}, status=400)

        payment = MobileMoneyPayment.objects.filter(operation_id=operation_id).select_related('sale').first()
        if not payment:
            return JsonResponse({'detail': 'Opération inconnue.'}, status=404)

        payment.status = new_status
        payment.raw_response = payload
        payment.save(update_fields=['status', 'raw_response', 'updated_at'])

        sale = payment.sale
        if new_status in self.SUCCESS_STATUSES and sale.status == 'pending':
            # Paiement confirmé : sortie de stock réelle + réservations
            # consommées (étape 5.3).
            with transaction.atomic():
                SaleViewSet()._deduct_stock(sale)
                consume_reservations(sale)
                sale.status = 'completed'
                sale.save(update_fields=['status'])
        elif new_status in self.FAILURE_STATUSES and sale.status == 'pending':
            # Échec : le stock n'a jamais été sorti, on libère les
            # réservations (étape 5.3).
            with transaction.atomic():
                release_reservations(sale)
                sale.status = 'cancelled'
                sale.save(update_fields=['status'])

        return JsonResponse({'detail': 'ok'})


class POSSessionViewSet(viewsets.ModelViewSet):
    """CRUD sessions de caisse POS, piloté par les permissions pos.* (_docs/08, _docs/13)."""
    serializer_class = POSSessionSerializer
    permission_classes = (HasPermission,)
    lookup_field = 'uuid'
    permission_map = {
        'list': 'pos.access',
        'retrieve': 'pos.access',
        'create': 'pos.open_session',
        'update': 'pos.close_session',
        'partial_update': 'pos.close_session',
        'destroy': 'pos.close_session',
        'close_session': 'pos.close_session',
    }
    filterset_fields = ['status', 'cashier']
    search_fields = ['cashier__email', 'cashier__first_name', 'cashier__last_name']

    def get_queryset(self):
        queryset = POSSession.objects.filter(company=self.request.company)
        if getattr(self.request, 'store', None):
            queryset = queryset.filter(store=self.request.store)
        store_uuid = self.request.query_params.get('store')
        if store_uuid:
            queryset = queryset.filter(store__uuid=store_uuid)
        return queryset

    def perform_create(self, serializer):
        if getattr(self.request, 'store', None):
            serializer.save(company=self.request.company, store=self.request.store, cashier=self.request.user)
        else:
            serializer.save(company=self.request.company, cashier=self.request.user)
        log_action(self.request, 'open', 'POSSession', serializer.instance.uuid, {
            'opening_amount': str(serializer.instance.opening_amount),
        })

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

    @action(detail=True, methods=['post'], url_path='close')
    def close_session(self, request, uuid=None):
        session = self.get_object()
        if session.status == 'closed':
            return Response(
                {'detail': 'Cette session est déjà fermée.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        closing_amount = request.data.get('closing_amount')
        if closing_amount is None:
            return Response(
                {'detail': 'Le montant de clôture est requis.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from django.utils import timezone
        session.closing_amount = closing_amount
        session.status = 'closed'
        session.closed_at = timezone.now()
        session.save(update_fields=['closing_amount', 'status', 'closed_at'])
        log_action(request, 'close', 'POSSession', session.uuid, {
            'closing_amount': str(closing_amount),
            'opening_amount': str(session.opening_amount),
        })
        return Response(POSSessionSerializer(session, context={'request': request}).data)
