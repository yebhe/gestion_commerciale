import uuid

from django.db import models

from companies.models import Company, Store


def product_image_upload_path(instance, filename):
    """
    Isole les photos produit par entreprise et magasin :
    companies/<company_id>/stores/<store_id ou "shared">/products/<filename>.
    """
    store_segment = f"stores/{instance.store_id}" if instance.store_id else 'shared'
    return f"companies/{instance.company_id}/{store_segment}/products/{filename}"


class Category(models.Model):
    id = models.BigAutoField(primary_key=True)
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='categories')
    store = models.ForeignKey(
        Store, on_delete=models.SET_NULL, related_name='categories', null=True, blank=True
    )
    name = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'categories'
        ordering = ['name']
        verbose_name_plural = 'categories'

    def __str__(self):
        return self.name


class Product(models.Model):
    id = models.BigAutoField(primary_key=True)
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='products')
    store = models.ForeignKey(
        Store, on_delete=models.CASCADE, related_name='products', null=True, blank=True
    )
    category = models.ForeignKey(
        Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='products'
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    barcode = models.CharField(max_length=64, blank=True, null=True, db_index=True)
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    selling_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    image = models.ImageField(upload_to=product_image_upload_path, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'products'
        ordering = ['name']

    def __str__(self):
        return self.name

    @property
    def stock_quantity(self):
        total = 0
        for level in self.stock_levels.all():
            total += level.quantity
        return total

    def stock_for_store(self, store):
        """Stock total du produit dans un magasin = somme de ses entrepôts (R11)."""
        if store is None:
            return 0
        from django.db.models import Sum
        return self.stock_levels.filter(store=store).aggregate(
            total=Sum('quantity'),
        )['total'] or 0

    def stock_for_warehouse(self, warehouse):
        if warehouse is None:
            return 0
        level = self.stock_levels.filter(warehouse=warehouse).first()
        return level.quantity if level else 0


class ProductVariant(models.Model):
    """Variante d'un produit (_docs/15, étape 4.1, R59-R63).

    Ex : {"couleur": "Noir", "taille": "M"}. Appartient au produit,
    donc au magasin/tenant du produit (R59).
    """

    id = models.BigAutoField(primary_key=True)
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='product_variants')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='variants')
    sku = models.CharField(max_length=100, blank=True, null=True)
    barcode = models.CharField(max_length=64, blank=True, null=True, db_index=True)
    attributes = models.JSONField(default=dict, blank=True)
    # Prix de vente spécifique ; sinon celui du produit (4.1).
    selling_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'product_variants'
        ordering = ['product', 'id']

    def __str__(self):
        attrs = ', '.join(f'{k}: {v}' for k, v in (self.attributes or {}).items())
        return f"{self.product.name} ({attrs or self.sku or self.uuid})"


class Lot(models.Model):
    """Lot / batch d'un produit (_docs/15, étape 4.1).

    number unique par produit ; variant nullable pour les lots
    rattachés à une variante précise.
    """

    id = models.BigAutoField(primary_key=True)
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='lots')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='lots')
    variant = models.ForeignKey(
        ProductVariant, on_delete=models.CASCADE,
        related_name='lots', null=True, blank=True)
    number = models.CharField(max_length=100)
    expiry_date = models.DateField(null=True, blank=True)
    received_at = models.DateTimeField(auto_now_add=True)
    supplier = models.ForeignKey(
        'suppliers.Supplier', on_delete=models.SET_NULL,
        related_name='lots', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'lots'
        ordering = ['-received_at']
        constraints = [
            models.UniqueConstraint(
                fields=['product', 'number'], name='uniq_lot_number_per_product'),
        ]

    def __str__(self):
        return f"{self.product.name} — lot {self.number}"


class StockLevel(models.Model):
    id = models.BigAutoField(primary_key=True)
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='stock_levels')
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='stock_levels')
    # Entrepôt porteur du stock (R1-R11). store reste dénormalisé
    # (= warehouse.store) pour les agrégats rapides par magasin.
    warehouse = models.ForeignKey(
        'inventory.Warehouse', on_delete=models.CASCADE,
        related_name='stock_levels', null=True, blank=True,
    )
    # Variante / lot (étape 4.2) : null = stock « générique » du produit.
    variant = models.ForeignKey(
        ProductVariant, on_delete=models.CASCADE,
        related_name='stock_levels', null=True, blank=True)
    lot = models.ForeignKey(
        Lot, on_delete=models.CASCADE,
        related_name='stock_levels', null=True, blank=True)
    quantity = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'stock_levels'
        # 4.2 : la granularité du stock est (produit, variante, entrepôt,
        # lot). Les FK nullables rendent les doublons NULL tolérés par la
        # contrainte — le regroupement applicatif (get_or_create dans
        # services._apply_delta) garantit l'unicité logique.
        unique_together = ('product', 'variant', 'warehouse', 'lot')

    def __str__(self):
        return f"{self.product.name} @ {self.store.name}: {self.quantity}"
