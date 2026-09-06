import uuid

from django.db import models

from companies.models import Company, Store
from products.models import Product


class InventoryMovement(models.Model):
    TYPE_CHOICES = [
        ('in', 'Entrée'),
        ('out', 'Sortie'),
        ('adjustment', 'Ajustement'),
    ]

    id = models.BigAutoField(primary_key=True)
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='inventory_movements')
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='inventory_movements')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='inventory_movements')
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    quantity = models.IntegerField()
    note = models.CharField(max_length=300, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'inventory_movements'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.product.name} ({self.type} {self.quantity})"
