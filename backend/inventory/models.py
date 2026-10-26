import uuid

from django.conf import settings
from django.db import models

from companies.models import Company, Store
from products.models import Product


class Warehouse(models.Model):
    """Entrepôt rattaché à un magasin (_docs/14, R1-R11, R49-R58)."""

    TYPE_CHOICES = [
        ('main', 'Principal'),
        ('secondary', 'Secondaire'),
        ('regional', 'Régional'),
        ('reserve', 'Réserve'),
        ('zone', 'Zone'),
        ('logistics', 'Logistique'),
    ]

    id = models.BigAutoField(primary_key=True)
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='warehouses')
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='warehouses')
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=50)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='main')
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    address = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'warehouses'
        ordering = ['store', 'name']
        constraints = [
            models.UniqueConstraint(fields=['store', 'name'], name='uniq_warehouse_name_per_store'),
            models.UniqueConstraint(fields=['store', 'code'], name='uniq_warehouse_code_per_store'),
            # Un seul entrepôt par défaut par magasin (R52).
            models.UniqueConstraint(
                fields=['store'], condition=models.Q(is_default=True),
                name='uniq_default_warehouse_per_store',
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.store.name})"


class InventoryMovement(models.Model):
    TYPE_CHOICES = [
        ('purchase_in', 'Entrée achat'),
        ('sale_out', 'Sortie vente'),
        ('sale_cancel_in', 'Annulation vente'),
        ('transfer_out', 'Transfert sortant'),
        ('transfer_in', 'Transfert entrant'),
        ('adjustment', 'Ajustement'),
        ('inventory', 'Inventaire'),
        ('loss', 'Perte'),
        ('breakage', 'Casse'),
        ('return_in', 'Retour client'),
        ('initial', 'Stock initial'),
        # Anciens types conservés pour compatibilité des données migrées.
        ('in', 'Entrée'),
        ('out', 'Sortie'),
    ]

    id = models.BigAutoField(primary_key=True)
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='inventory_movements')
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='inventory_movements')
    warehouse = models.ForeignKey(
        Warehouse, on_delete=models.PROTECT, related_name='inventory_movements',
        null=True, blank=True,
    )
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='inventory_movements')
    # Variante / lot (étape 4.2) : null = mouvement sur le produit générique.
    variant = models.ForeignKey(
        'products.ProductVariant', on_delete=models.PROTECT,
        related_name='inventory_movements', null=True, blank=True)
    lot = models.ForeignKey(
        'products.Lot', on_delete=models.PROTECT,
        related_name='inventory_movements', null=True, blank=True)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    quantity = models.IntegerField()
    note = models.CharField(max_length=300, blank=True, null=True)
    # Traçabilité (_docs/14, R73-R74) : état du stock avant/après,
    # auteur, motif et document source (Sale, Transfer...).
    stock_before = models.IntegerField(null=True, blank=True)
    stock_after = models.IntegerField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        related_name='inventory_movements', null=True, blank=True,
    )
    reason = models.CharField(max_length=100, blank=True, default='')
    source_type = models.CharField(max_length=50, blank=True, default='')
    source_uuid = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'inventory_movements'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.product.name} ({self.type} {self.quantity})"


class Transfer(models.Model):
    """Transfert de stock avec workflow de statuts (_docs/15, étape 3)."""

    TYPE_CHOICES = [
        ('intra_warehouse', 'Intra-entrepôt'),
        ('inter_warehouse', 'Inter-entrepôts'),
        ('inter_store', 'Inter-magasins'),
    ]

    STATUS_CHOICES = [
        ('draft', 'Brouillon'),
        ('requested', 'Demandé'),
        ('validated', 'Validé'),
        ('prepared', 'Préparé'),
        ('shipped', 'Expédié'),
        ('in_transit', 'En transit'),
        ('received', 'Reçu'),
        ('cancelled', 'Annulé'),
        ('rejected', 'Rejeté'),
    ]

    id = models.BigAutoField(primary_key=True)
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='transfers')
    number = models.CharField(max_length=30, unique=True, editable=False)
    transfer_type = models.CharField(max_length=20, choices=TYPE_CHOICES, editable=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')

    from_store = models.ForeignKey(Store, on_delete=models.PROTECT, related_name='transfers_out')
    to_store = models.ForeignKey(Store, on_delete=models.PROTECT, related_name='transfers_in')
    from_warehouse = models.ForeignKey(
        Warehouse, on_delete=models.PROTECT, related_name='transfers_out')
    to_warehouse = models.ForeignKey(
        Warehouse, on_delete=models.PROTECT, related_name='transfers_in')
    # Emplacements : réservés pour l'étape 2 (locations).
    from_location = models.CharField(max_length=100, blank=True, null=True)
    to_location = models.CharField(max_length=100, blank=True, null=True)

    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        related_name='transfers_requested', null=True, blank=True)
    validated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        related_name='transfers_validated', null=True, blank=True)
    shipped_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        related_name='transfers_shipped', null=True, blank=True)
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        related_name='transfers_received', null=True, blank=True)

    requested_at = models.DateTimeField(null=True, blank=True)
    validated_at = models.DateTimeField(null=True, blank=True)
    shipped_at = models.DateTimeField(null=True, blank=True)
    received_at = models.DateTimeField(null=True, blank=True)

    note = models.CharField(max_length=300, blank=True, default='')
    reason = models.CharField(max_length=100, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'transfers'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.number} ({self.get_status_display()})"

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = self._generate_number()
        super().save(*args, **kwargs)

    def _generate_number(self):
        """TR-YYYY-NNNNNN séquentiel par année."""
        from django.utils import timezone
        year = timezone.now().year
        prefix = f'TR-{year}-'
        last = (
            Transfer.objects.filter(number__startswith=prefix)
            .order_by('-number').values_list('number', flat=True).first()
        )
        seq = int(last.split('-')[-1]) + 1 if last else 1
        return f'{prefix}{seq:06d}'


class StockReservation(models.Model):
    """Réservation de stock (_docs/15, étape 5.1, R64-R66).

    Une réservation bloque une quantité sans la sortir du stock :
    disponible = physique - réservé. Utilisée par les ventes
    Mobile Money en attente et les demandes de transfert.
    """

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('consumed', 'Consommée'),
        ('released', 'Libérée'),
        ('expired', 'Expirée'),
    ]

    id = models.BigAutoField(primary_key=True)
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='stock_reservations')
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='stock_reservations')
    warehouse = models.ForeignKey(
        Warehouse, on_delete=models.PROTECT, related_name='stock_reservations',
        null=True, blank=True)
    location = models.CharField(max_length=100, blank=True, null=True)
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='stock_reservations')
    variant = models.ForeignKey(
        'products.ProductVariant', on_delete=models.PROTECT,
        related_name='stock_reservations', null=True, blank=True)
    lot = models.ForeignKey(
        'products.Lot', on_delete=models.PROTECT,
        related_name='stock_reservations', null=True, blank=True)
    quantity = models.PositiveIntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    # Document source : Sale pending, Transfer requested...
    source_type = models.CharField(max_length=50, blank=True, default='')
    source_uuid = models.UUIDField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        related_name='stock_reservations', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'stock_reservations'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['product', 'store', 'warehouse', 'status']),
        ]

    def __str__(self):
        return f"Réservation {self.product.name} x{self.quantity} ({self.status})"


class TransferItem(models.Model):
    """Ligne de produit d'un transfert (_docs/15, étape 3.1)."""

    id = models.BigAutoField(primary_key=True)
    transfer = models.ForeignKey(Transfer, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='transfer_items')
    # Variante / lot transférés (étape 4.2) : null = produit générique.
    variant = models.ForeignKey(
        'products.ProductVariant', on_delete=models.PROTECT,
        related_name='transfer_items', null=True, blank=True)
    lot = models.ForeignKey(
        'products.Lot', on_delete=models.PROTECT,
        related_name='transfer_items', null=True, blank=True)
    quantity_requested = models.PositiveIntegerField()
    quantity_shipped = models.PositiveIntegerField(default=0)
    quantity_received = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'transfer_items'

    def __str__(self):
        return f"{self.product.name} x{self.quantity_requested}"


class InventorySession(models.Model):
    """Session d'inventaire (_docs/15, étape 6.1, R67-R70).

    Un comptage physique borné à un périmètre (scope) : magasin,
    entrepôt, emplacement, produit ou lot. Les lignes sont générées
    à l'ouverture dans le scope uniquement (R68-R69) ; la validation
    crée un mouvement type=inventory par ligne en écart (R70).
    """

    SCOPE_CHOICES = [
        ('store', 'Magasin'),
        ('warehouse', 'Entrepôt'),
        ('location', 'Emplacement'),
        ('product', 'Produit'),
        ('lot', 'Lot'),
    ]
    STATUS_CHOICES = [
        ('open', 'Ouverte'),
        ('counting', 'Comptage en cours'),
        ('validated', 'Validée'),
        ('cancelled', 'Annulée'),
    ]

    id = models.BigAutoField(primary_key=True)
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='inventory_sessions')
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='inventory_sessions')
    warehouse = models.ForeignKey(
        Warehouse, on_delete=models.PROTECT, related_name='inventory_sessions',
        null=True, blank=True)
    location = models.CharField(max_length=100, blank=True, null=True)
    scope = models.CharField(max_length=20, choices=SCOPE_CHOICES, default='store')
    product = models.ForeignKey(
        Product, on_delete=models.PROTECT, related_name='inventory_sessions',
        null=True, blank=True)
    lot = models.ForeignKey(
        'products.Lot', on_delete=models.PROTECT, related_name='inventory_sessions',
        null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    note = models.TextField(blank=True, default='')
    opened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        related_name='inventory_sessions_opened', null=True, blank=True)
    validated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        related_name='inventory_sessions_validated', null=True, blank=True)
    opened_at = models.DateTimeField(auto_now_add=True)
    validated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inventory_sessions'
        ordering = ['-opened_at']

    def __str__(self):
        return f"Inventaire {self.scope} @ {self.store.name} ({self.status})"


class InventorySessionLine(models.Model):
    """Ligne de comptage d'une session (_docs/15, étape 6.1).

    expected_quantity est figée à l'ouverture de la session ;
    difference = counted - expected, calculée à la saisie.
    """

    id = models.BigAutoField(primary_key=True)
    session = models.ForeignKey(
        InventorySession, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='inventory_lines')
    variant = models.ForeignKey(
        'products.ProductVariant', on_delete=models.PROTECT,
        related_name='inventory_lines', null=True, blank=True)
    lot = models.ForeignKey(
        'products.Lot', on_delete=models.PROTECT,
        related_name='inventory_lines', null=True, blank=True)
    warehouse = models.ForeignKey(
        Warehouse, on_delete=models.PROTECT, related_name='inventory_lines',
        null=True, blank=True)
    location = models.CharField(max_length=100, blank=True, null=True)
    expected_quantity = models.IntegerField(default=0)
    counted_quantity = models.IntegerField(null=True, blank=True)
    difference = models.IntegerField(default=0)
    counted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        related_name='inventory_lines_counted', null=True, blank=True)
    counted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'inventory_session_lines'
        ordering = ['product__name']

    def __str__(self):
        return f"{self.product.name} : {self.counted_quantity}/{self.expected_quantity}"
