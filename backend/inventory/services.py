"""
Point d'entrée UNIQUE de toute écriture de stock (_docs/15, étape 0).

Règles garanties ici :
- verrouillage de la ligne StockLevel (select_for_update, RÈGLE 5 du doc 04) ;
- calcul et enregistrement de stock_before / stock_after sur chaque
  mouvement (traçabilité, R73-R74 du doc 14) ;
- refus de tout stock négatif ;
- rattachement du mouvement à son document source (vente, transfert,
  réception...) via source_type / source_uuid ;
- audit de l'opération lorsqu'une requête est fournie (RÈGLE 7 du doc 04).

Toute modification de StockLevel.quantity DOIT passer par apply_movement
ou revert_movement. Les écritures directes (level.quantity = ...) sont
interdites ailleurs dans le code.
"""

from django.db import models, transaction
from rest_framework.exceptions import ValidationError

from audit.utils import log_action
from products.models import StockLevel

from .models import InventoryMovement, StockReservation, Warehouse
from .validators import assert_hierarchy

# Types qui diminuent le stock (quantity positive en entrée).
OUT_TYPES = {'out', 'sale_out', 'transfer_out', 'loss', 'breakage'}


def _delta_for(movement_type, quantity):
    """Signe appliqué au stock selon le type de mouvement.

    Types sortants (out, sale_out, transfer_out, loss, breakage) :
        -quantity
    adjustment / inventory : quantity est déjà un delta signé (new - old)
    Autres types entrants : +quantity
    """
    if movement_type in OUT_TYPES:
        return -quantity
    return quantity


def resolve_warehouse(store, warehouse=None):
    """Retourne l'entrepôt à utiliser : celui fourni, sinon l'entrepôt
    par défaut du magasin (pas de friction pour les petits commerces).
    """
    if warehouse is not None:
        return warehouse
    if store is None:
        return None
    default = Warehouse.objects.filter(store=store, is_default=True).first()
    if default is None:
        default = Warehouse.objects.filter(store=store, is_active=True).first()
    return default


def _apply_delta(product, store, delta, warehouse=None, variant=None, lot=None):
    """Verrouille le StockLevel et applique le delta. Refuse le négatif.

    Retourne (stock_before, stock_after). Doit être appelé dans une
    transaction atomique. La granularité est (product, variant,
    warehouse, lot) — étape 4.2.
    """
    level, _ = StockLevel.objects.select_for_update().get_or_create(
        product=product, store=store, warehouse=warehouse,
        variant=variant, lot=lot,
        defaults={'quantity': 0},
    )
    before = level.quantity
    after = before + delta
    if after < 0:
        raise ValidationError(
            f"Stock insuffisant pour « {product.name} » : "
            f"{before} disponible(s), {-delta} demandé(s)."
        )
    level.quantity = after
    level.save(update_fields=['quantity', 'updated_at'])
    return before, after


def apply_movement(*, company, store, product, movement_type, quantity,
                   warehouse=None, variant=None, lot=None,
                   user=None, note='', reason='',
                   source=None, request=None):
    """Crée un InventoryMovement et applique son effet sur le stock.

    Paramètres :
      warehouse     entrepôt cible ; si absent, l'entrepôt par défaut du
                    magasin est utilisé (R52, doc 07).
      variant / lot granularité produit (étape 4) ; la variante et le lot
                    doivent appartenir au produit (R59).
      source        objet lié (Sale, Transfer, PurchaseReceipt...) dont on
                    retient la classe et l'uuid pour la traçabilité.
      request       requête courante, pour l'audit (optionnel : webhooks,
                    tâches Celery).
    Retourne le mouvement créé.
    """
    if store is None:
        raise ValidationError("Un magasin est requis pour un mouvement de stock.")
    if product.company_id != company.id:
        raise ValidationError("Ce produit n'appartient pas à cette entreprise.")
    store = assert_hierarchy(
        company, store=store, warehouse=warehouse,
        product=product, variant=variant, lot=lot,
    )
    warehouse = resolve_warehouse(store, warehouse)

    with transaction.atomic():
        before, after = _apply_delta(
            product, store, _delta_for(movement_type, quantity), warehouse,
            variant=variant, lot=lot,
        )
        movement = InventoryMovement.objects.create(
            company=company,
            store=store,
            warehouse=warehouse,
            product=product,
            variant=variant,
            lot=lot,
            type=movement_type,
            quantity=quantity,
            note=note or None,
            stock_before=before,
            stock_after=after,
            created_by=user,
            reason=reason or '',
            source_type=source.__class__.__name__ if source is not None else '',
            source_uuid=getattr(source, 'uuid', None),
        )

    if request is not None:
        log_action(request, movement_type, 'InventoryMovement', movement.uuid, {
            'product': product.name,
            'quantity': quantity,
            'store': store.name,
            'warehouse': warehouse.name if warehouse else None,
            'stock_before': before,
            'stock_after': after,
            'reason': reason,
        })
    return movement


def revert_movement(movement, *, user=None, request=None, note=''):
    """Annule l'effet d'un mouvement sur le stock puis le supprime.

    Refuse d'annuler un mouvement rattaché à un document source
    (vente, transfert...) : c'est le document qu'il faut annuler,
    sinon le stock serait restauré deux fois.
    """
    if movement.source_type:
        raise ValidationError(
            "Ce mouvement est lié à un document "
            f"({movement.source_type}). Annulez le document, pas le mouvement."
        )

    with transaction.atomic():
        _apply_delta(movement.product, movement.store,
                     -_delta_for(movement.type, movement.quantity),
                     movement.warehouse,
                     variant=movement.variant, lot=movement.lot)
        movement.delete()

    if request is not None:
        log_action(request, 'cancel', 'InventoryMovement', movement.uuid, {
            'product': movement.product.name,
            'type': movement.type,
            'quantity': movement.quantity,
            'store': movement.store.name if movement.store else None,
            'note': note,
        })


def adjust_movement(movement, *, new_type, new_quantity, new_store,
                    new_warehouse=None, new_note=None, user=None,
                    request=None):
    """Met à jour un mouvement manuel en annulant puis ré-appliquant
    son effet sur le stock. Met à jour stock_before/stock_after.
    """
    if movement.source_type:
        raise ValidationError(
            "Ce mouvement est lié à un document "
            f"({movement.source_type}) et ne peut pas être modifié."
        )

    warehouse = resolve_warehouse(new_store, new_warehouse)

    with transaction.atomic():
        _apply_delta(movement.product, movement.store,
                     -_delta_for(movement.type, movement.quantity),
                     movement.warehouse,
                     variant=movement.variant, lot=movement.lot)
        before, after = _apply_delta(
            movement.product, new_store, _delta_for(new_type, new_quantity),
            warehouse,
            variant=movement.variant, lot=movement.lot,
        )
        movement.type = new_type
        movement.quantity = new_quantity
        movement.store = new_store
        movement.warehouse = warehouse
        if new_note is not None:
            movement.note = new_note
        movement.stock_before = before
        movement.stock_after = after
        movement.save(update_fields=[
            'type', 'quantity', 'store', 'warehouse', 'note',
            'stock_before', 'stock_after',
        ])
    return movement


# ------------------------------------------------------------------
# Réservations (_docs/15, étape 5, R64-R66)
# disponible = physique - réservé, calculé par entrepôt puis agrégé
# par magasin. Les contrôles de stock utilisent `available`.
# ------------------------------------------------------------------

def _reservation_filter(*, product, store, warehouse=None, variant=None, lot=None):
    """Filtre les réservations actives correspondant à la granularité."""
    qs = StockReservation.objects.filter(
        product=product, store=store, status='active',
        variant=variant, lot=lot,
    )
    if warehouse is not None:
        qs = qs.filter(warehouse=warehouse)
    return qs


def reserved_quantity(*, product, store, warehouse=None, variant=None, lot=None):
    """Quantité réservée (réservations actives, non expirées)."""
    from django.db.models import Sum
    from django.utils import timezone
    qs = _reservation_filter(
        product=product, store=store, warehouse=warehouse,
        variant=variant, lot=lot,
    ).filter(
        models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=timezone.now())
    )
    return qs.aggregate(total=Sum('quantity'))['total'] or 0


def available_quantity(*, product, store, warehouse=None, variant=None, lot=None):
    """Stock disponible = physique - réservé (R65-R66)."""
    level = StockLevel.objects.filter(
        product=product, store=store, warehouse=warehouse,
        variant=variant, lot=lot,
    ).first()
    physical = level.quantity if level else 0
    return physical - reserved_quantity(
        product=product, store=store, warehouse=warehouse,
        variant=variant, lot=lot,
    )


def store_available(*, product, store):
    """Disponible agrégé au niveau magasin (tous entrepôts, R66)."""
    from django.db.models import Sum
    from django.utils import timezone
    physical = StockLevel.objects.filter(
        product=product, store=store,
    ).aggregate(total=Sum('quantity'))['total'] or 0
    reserved = StockReservation.objects.filter(
        product=product, store=store, status='active',
    ).filter(
        models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=timezone.now())
    ).aggregate(total=Sum('quantity'))['total'] or 0
    return physical - reserved


def reserve_stock(*, company, store, product, quantity,
                  warehouse=None, variant=None, lot=None,
                  source=None, expires_at=None, user=None):
    """Crée une réservation active après vérification du disponible."""
    if quantity <= 0:
        raise ValidationError("La quantité réservée doit être positive.")
    store = assert_hierarchy(
        company, store=store, warehouse=warehouse,
        product=product, variant=variant, lot=lot,
    )
    warehouse = resolve_warehouse(store, warehouse)
    with transaction.atomic():
        available = available_quantity(
            product=product, store=store, warehouse=warehouse,
            variant=variant, lot=lot,
        )
        if quantity > available:
            raise ValidationError(
                f"Stock disponible insuffisant pour « {product.name} » : "
                f"{available} disponible(s), {quantity} demandé(s)."
            )
        return StockReservation.objects.create(
            company=company, store=store, warehouse=warehouse,
            product=product, variant=variant, lot=lot,
            quantity=quantity,
            source_type=source.__class__.__name__ if source is not None else '',
            source_uuid=getattr(source, 'uuid', None),
            expires_at=expires_at,
            created_by=user,
        )


def _update_reservations(source, new_status):
    """Passe les réservations actives d'une source à un statut terminal."""
    if source is None:
        return 0
    return StockReservation.objects.filter(
        source_type=source.__class__.__name__,
        source_uuid=getattr(source, 'uuid', None),
        status='active',
    ).update(status=new_status)


def consume_reservations(source):
    """Consomme les réservations d'une source (vente payée, transfert expédié)."""
    return _update_reservations(source, 'consumed')


def release_reservations(source):
    """Libère les réservations d'une source (échec paiement, transfert annulé)."""
    return _update_reservations(source, 'released')


def expire_reservations():
    """Passe en 'expired' les réservations actives dont expires_at est dépassé."""
    from django.utils import timezone
    return StockReservation.objects.filter(
        status='active', expires_at__lt=timezone.now(),
    ).update(status='expired')


# ------------------------------------------------------------------
# Sessions d'inventaire (étape 6, R67-R70)
# ------------------------------------------------------------------

def _session_scope_filter(session):
    """Filtre StockLevel du périmètre de la session (R68-R69)."""
    qs = StockLevel.objects.filter(store=session.store)
    if session.warehouse_id and session.scope in ('warehouse', 'location', 'product'):
        qs = qs.filter(warehouse=session.warehouse)
    if session.scope == 'location' and session.location:
        qs = qs.filter(location=session.location)
    if session.scope == 'product' and session.product_id:
        qs = qs.filter(product=session.product)
    if session.scope == 'lot' and session.lot_id:
        qs = qs.filter(lot=session.lot)
    return qs


def open_inventory_session(*, company, store, scope='store', warehouse=None,
                           location=None, product=None, lot=None,
                           note='', user=None):
    """Crée une session et génère ses lignes dans le scope (R68-R69).
    expected_quantity est figé à l'ouverture."""
    from .models import InventorySession, InventorySessionLine

    store = assert_hierarchy(
        company, store=store, warehouse=warehouse,
        product=product, lot=lot,
    )
    if scope == 'warehouse' and warehouse is None:
        warehouse = resolve_warehouse(store)
    if scope == 'product' and product is None:
        raise ValidationError("Une session scope=product exige un produit.")
    if scope == 'lot' and lot is None:
        raise ValidationError("Une session scope=lot exige un lot.")

    with transaction.atomic():
        session = InventorySession.objects.create(
            company=company, store=store, warehouse=warehouse,
            location=location or None, scope=scope,
            product=product, lot=lot, note=note, opened_by=user,
        )
        lines = [
            InventorySessionLine(
                session=session, product=sl.product, variant=sl.variant,
                lot=sl.lot, warehouse=sl.warehouse,
                location=getattr(sl, 'location', None),
                expected_quantity=sl.quantity,
            )
            for sl in _session_scope_filter(session).select_related(
                'product', 'variant', 'lot', 'warehouse')
        ]
        InventorySessionLine.objects.bulk_create(lines)
    return session


def record_count(line, counted_quantity, user=None):
    """Enregistre le comptage d'une ligne ; la session passe en 'counting'."""
    from django.utils import timezone
    session = line.session
    if session.status not in ('open', 'counting'):
        raise ValidationError("Cette session n'accepte plus de comptage.")
    if counted_quantity is None or counted_quantity < 0:
        raise ValidationError("La quantité comptée doit être positive ou nulle.")
    line.counted_quantity = counted_quantity
    line.difference = counted_quantity - line.expected_quantity
    line.counted_by = user
    line.counted_at = timezone.now()
    line.save(update_fields=[
        'counted_quantity', 'difference', 'counted_by', 'counted_at'])
    if session.status == 'open':
        session.status = 'counting'
        session.save(update_fields=['status', 'updated_at'])
    return line


def validate_inventory_session(session, user=None, request=None):
    """Valide : un mouvement type=inventory par ligne en écart, sur
    l'entrepôt/emplacement exact de la ligne (R70)."""
    from django.utils import timezone
    if session.status in ('validated', 'cancelled'):
        raise ValidationError("Cette session est déjà clôturée.")
    with transaction.atomic():
        for line in session.lines.select_related(
                'product', 'variant', 'lot', 'warehouse'):
            if line.counted_quantity is None or line.difference == 0:
                continue
            apply_movement(
                company=session.company, store=session.store,
                warehouse=line.warehouse, product=line.product,
                variant=line.variant, lot=line.lot,
                movement_type='inventory', quantity=line.difference,
                user=user, reason='inventory_count', source=session,
                request=request,
            )
        session.status = 'validated'
        session.validated_by = user
        session.validated_at = timezone.now()
        session.save(update_fields=[
            'status', 'validated_by', 'validated_at', 'updated_at'])
    return session


def cancel_inventory_session(session):
    """Annule une session non validée (aucun mouvement créé)."""
    if session.status == 'validated':
        raise ValidationError("Une session validée ne peut pas être annulée.")
    session.status = 'cancelled'
    session.save(update_fields=['status', 'updated_at'])
    return session


def quick_adjust(*, company, store, product, new_quantity, warehouse=None,
                 variant=None, lot=None, user=None, request=None):
    """Inventaire rapide d'un produit (étape 6.3) : session scope=product
    créée, comptée et validée immédiatement — même mécanisme et même
    traçabilité qu'un inventaire complet."""
    session = open_inventory_session(
        company=company, store=store, scope='product',
        warehouse=warehouse, product=product,
        note='Ajustement rapide', user=user,
    )
    # Ligne correspondant exactement à la cible (variante/lot).
    line = session.lines.filter(variant=variant, lot=lot).first()
    if line is None:
        from .models import InventorySessionLine
        wh = resolve_warehouse(store, warehouse)
        line = InventorySessionLine.objects.create(
            session=session, product=product, variant=variant, lot=lot,
            warehouse=wh, expected_quantity=0,
        )
    record_count(line, new_quantity, user=user)
    validate_inventory_session(session, user=user, request=request)
    # Mouvement créé par la validation (None si counted == expected).
    movement = InventoryMovement.objects.filter(
        source_type='InventorySession', source_uuid=session.uuid,
    ).first()
    if movement is None:
        # Aucun écart : on retourne un mouvement à delta nul pour
        # préserver le contrat de l'API d'ajustement.
        movement = apply_movement(
            company=company, store=store, product=product,
            warehouse=warehouse, variant=variant, lot=lot,
            movement_type='adjustment', quantity=0,
            user=user, reason='adjustment', source=session,
            request=request,
        )
    return movement
