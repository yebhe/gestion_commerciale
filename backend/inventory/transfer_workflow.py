"""Machine à états des transferts (_docs/15, étape 3.3).

    draft -> requested -> validated -> prepared -> shipped
          -> in_transit -> received
    Tout état non terminal -> cancelled (demandeur/valideur)
    requested -> rejected (valideur)

Effets sur le stock :
  - shipped   : transfer_out sur la source, quantity_shipped figée,
                statut -> in_transit.
  - received  : transfer_in sur la destination avec quantity_received ;
                écart (shipped - received) -> mouvement loss sur la
                destination, reason='transfer_discrepancy' (R36).
  - cancelled après shipped : transfer_in de retour sur la source
                (le stock ne disparaît jamais, R24).
"""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import Transfer
from .services import (
    apply_movement, consume_reservations, release_reservations, reserve_stock,
)

# Transitions autorisées : statut -> {action: statut cible}
TRANSITIONS = {
    'draft': {'request': 'requested', 'cancel': 'cancelled'},
    'requested': {'validate': 'validated', 'reject': 'rejected', 'cancel': 'cancelled'},
    'validated': {'prepare': 'prepared', 'cancel': 'cancelled'},
    'prepared': {'ship': 'in_transit', 'cancel': 'cancelled'},
    'shipped': {'receive': 'received', 'cancel': 'cancelled'},
    'in_transit': {'receive': 'received', 'cancel': 'cancelled'},
    'received': {},
    'cancelled': {},
    'rejected': {},
}

TERMINAL_STATUSES = {'received', 'cancelled', 'rejected'}


def _check_transition(transfer, action):
    allowed = TRANSITIONS.get(transfer.status, {})
    if action not in allowed:
        raise ValidationError(
            f"Action « {action} » impossible depuis le statut "
            f"« {transfer.get_status_display()} »."
        )
    return allowed[action]


def request_transfer(transfer, *, user):
    """draft -> requested : réserve le stock sur la source (étape 5.3)."""
    new_status = _check_transition(transfer, 'request')
    with transaction.atomic():
        for item in transfer.items.select_related('product', 'variant', 'lot'):
            reserve_stock(
                company=transfer.company,
                store=transfer.from_store,
                warehouse=transfer.from_warehouse,
                product=item.product,
                variant=item.variant,
                lot=item.lot,
                quantity=item.quantity_requested,
                source=transfer,
                user=user,
            )
        transfer.status = new_status
        transfer.requested_by = user
        transfer.requested_at = timezone.now()
        transfer.save(update_fields=['status', 'requested_by', 'requested_at', 'updated_at'])
    return transfer


def validate_transfer(transfer, *, user):
    """requested -> validated."""
    new_status = _check_transition(transfer, 'validate')
    transfer.status = new_status
    transfer.validated_by = user
    transfer.validated_at = timezone.now()
    transfer.save(update_fields=['status', 'validated_by', 'validated_at', 'updated_at'])
    return transfer


def reject_transfer(transfer, *, user, reason=''):
    """requested -> rejected : libère les réservations (étape 5.3)."""
    new_status = _check_transition(transfer, 'reject')
    with transaction.atomic():
        release_reservations(transfer)
        transfer.status = new_status
        transfer.validated_by = user
        transfer.validated_at = timezone.now()
        if reason:
            transfer.reason = reason
        transfer.save(update_fields=['status', 'validated_by', 'validated_at', 'reason', 'updated_at'])
    return transfer


def prepare_transfer(transfer, *, user):
    """validated -> prepared."""
    new_status = _check_transition(transfer, 'prepare')
    transfer.status = new_status
    transfer.save(update_fields=['status', 'updated_at'])
    return transfer


def ship_transfer(transfer, *, user, request=None):
    """prepared -> in_transit : sort le stock de la source (transfer_out),
    fige quantity_shipped sur chaque ligne."""
    new_status = _check_transition(transfer, 'ship')
    with transaction.atomic():
        for item in transfer.items.select_related('product', 'variant', 'lot'):
            qty = item.quantity_shipped or item.quantity_requested
            apply_movement(
                company=transfer.company,
                store=transfer.from_store,
                warehouse=transfer.from_warehouse,
                product=item.product,
                variant=item.variant,
                lot=item.lot,
                movement_type='transfer_out',
                quantity=qty,
                user=user,
                note=f"Transfert {transfer.number}",
                reason='transfer',
                source=transfer,
                request=request,
            )
            item.quantity_shipped = qty
            item.save(update_fields=['quantity_shipped'])
        # Le stock sort réellement : les réservations sont consommées (5.3).
        consume_reservations(transfer)
        transfer.status = new_status
        transfer.shipped_by = user
        transfer.shipped_at = timezone.now()
        transfer.save(update_fields=['status', 'shipped_by', 'shipped_at', 'updated_at'])
    return transfer


def receive_transfer(transfer, *, user, quantities=None, request=None):
    """in_transit -> received : entre le stock sur la destination
    (transfer_in) avec quantity_received ; l'écart éventuel devient un
    mouvement loss (reason='transfer_discrepancy', R36).

    quantities : dict {item_id: qty} optionnel ; par défaut = shipped.
    """
    new_status = _check_transition(transfer, 'receive')
    with transaction.atomic():
        for item in transfer.items.select_related('product', 'variant', 'lot'):
            qty = item.quantity_shipped
            if quantities and str(item.id) in quantities:
                qty = int(quantities[str(item.id)])
                if qty < 0 or qty > item.quantity_shipped:
                    raise ValidationError(
                        f"Quantité reçue invalide pour « {item.product.name} » "
                        f"(expédié : {item.quantity_shipped})."
                    )
            if qty > 0:
                apply_movement(
                    company=transfer.company,
                    store=transfer.to_store,
                    warehouse=transfer.to_warehouse,
                    product=item.product,
                    variant=item.variant,
                    lot=item.lot,
                    movement_type='transfer_in',
                    quantity=qty,
                    user=user,
                    note=f"Réception {transfer.number}",
                    reason='transfer',
                    source=transfer,
                    request=request,
                )
            gap = item.quantity_shipped - qty
            if gap > 0:
                # L'écart est une perte en transit : la marchandise a quitté
                # la source à l'expédition mais n'est jamais arrivée. On
                # enregistre le mouvement loss SANS effet sur le stock de la
                # destination (elle n'a jamais reçu ces unités) — sinon on
                # décompterait deux fois (R36 : conservation hors pertes).
                from products.models import StockLevel
                from .models import InventoryMovement
                level = StockLevel.objects.filter(
                    product=item.product, store=transfer.to_store,
                    warehouse=transfer.to_warehouse,
                    variant=item.variant, lot=item.lot,
                ).first()
                current = level.quantity if level else 0
                InventoryMovement.objects.create(
                    company=transfer.company,
                    store=transfer.to_store,
                    warehouse=transfer.to_warehouse,
                    product=item.product,
                    variant=item.variant,
                    lot=item.lot,
                    type='loss',
                    quantity=gap,
                    note=f"Écart transfert {transfer.number}",
                    stock_before=current,
                    stock_after=current,
                    created_by=user,
                    reason='transfer_discrepancy',
                    source_type='Transfer',
                    source_uuid=transfer.uuid,
                )
            item.quantity_received = qty
            item.save(update_fields=['quantity_received'])
        transfer.status = new_status
        transfer.received_by = user
        transfer.received_at = timezone.now()
        transfer.save(update_fields=['status', 'received_by', 'received_at', 'updated_at'])
    return transfer


def cancel_transfer(transfer, *, user, request=None):
    """Annule un transfert non terminé. Si le stock a déjà été expédié,
    il est retourné à la source via transfer_in (R24)."""
    new_status = _check_transition(transfer, 'cancel')
    with transaction.atomic():
        # Annulation avant expédition : libère les réservations (5.3).
        if transfer.status not in ('shipped', 'in_transit'):
            release_reservations(transfer)
        if transfer.status in ('shipped', 'in_transit'):
            for item in transfer.items.select_related('product', 'variant', 'lot'):
                if item.quantity_shipped > 0:
                    apply_movement(
                        company=transfer.company,
                        store=transfer.from_store,
                        warehouse=transfer.from_warehouse,
                        product=item.product,
                        variant=item.variant,
                        lot=item.lot,
                        movement_type='transfer_in',
                        quantity=item.quantity_shipped,
                        user=user,
                        note=f"Retour transfert annulé {transfer.number}",
                        reason='transfer_cancel',
                        source=transfer,
                        request=request,
                    )
        transfer.status = new_status
        transfer.save(update_fields=['status', 'updated_at'])
    return transfer


def run_immediate(transfer, *, user, request=None):
    """Mode simple (3.5) : requested -> validated -> shipped -> received
    dans UNE transaction atomique."""
    with transaction.atomic():
        request_transfer(transfer, user=user)
        validate_transfer(transfer, user=user)
        prepare_transfer(transfer, user=user)
        ship_transfer(transfer, user=user, request=request)
        receive_transfer(transfer, user=user, request=request)
    return transfer
