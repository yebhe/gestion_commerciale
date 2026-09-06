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
        if store is None:
            return 0
        level = self.stock_levels.filter(store=store).first()
        return level.quantity if level else 0


class StockLevel(models.Model):
    id = models.BigAutoField(primary_key=True)
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='stock_levels')
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='stock_levels')
    quantity = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'stock_levels'
        unique_together = ('product', 'store')

    def __str__(self):
        return f"{self.product.name} @ {self.store.name}: {self.quantity}"
