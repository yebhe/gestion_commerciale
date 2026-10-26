import uuid

from django.conf import settings
from django.db import models

from companies.models import Company, Store
from customers.models import Customer
from products.models import Product


class Sale(models.Model):
    PAYMENT_METHOD_CHOICES = [
        ('cash', 'Espèces'),
        ('mobile_money', 'Mobile Money'),
        ('card', 'Carte'),
        ('credit', 'Crédit'),
    ]
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('completed', 'Terminée'),
        ('cancelled', 'Annulée'),
        ('refunded', 'Remboursée'),
    ]

    id = models.BigAutoField(primary_key=True)
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='sales')
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='sales')
    customer = models.ForeignKey(
        Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name='sales'
    )
    cashier = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='sales'
    )
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, default='cash')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='completed')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'sales'
        ordering = ['-created_at']

    def __str__(self):
        return f"Vente {self.uuid} ({self.total_amount})"


class SaleItem(models.Model):
    id = models.BigAutoField(primary_key=True)
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='sale_items')
    # Variante / lot vendus (étape 4.2) : null = produit générique.
    variant = models.ForeignKey(
        'products.ProductVariant', on_delete=models.PROTECT,
        related_name='sale_items', null=True, blank=True)
    lot = models.ForeignKey(
        'products.Lot', on_delete=models.PROTECT,
        related_name='sale_items', null=True, blank=True)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        db_table = 'sale_items'

    def __str__(self):
        return f"{self.product.name} x{self.quantity}"


class MobileMoneyPayment(models.Model):
    """
    Suivi d'une opération de paiement Mobile Money initiée via Chap Chap Pay
    (https://chapchappay.com/guide/) pour une vente donnée. Le statut est
    mis à jour par le webhook `notify_url` de Chap Chap Pay.
    """
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('success', 'Réussi'),
        ('failed', 'Échoué'),
        ('canceled', 'Annulé'),
        ('expired', 'Expiré'),
        ('error', 'Erreur'),
    ]

    id = models.BigAutoField(primary_key=True)
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    sale = models.OneToOneField(Sale, on_delete=models.CASCADE, related_name='mobile_money_payment')
    operation_id = models.CharField(max_length=100, unique=True)
    payment_url = models.URLField(max_length=500, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    raw_response = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'mobile_money_payments'
        ordering = ['-created_at']

    def __str__(self):
        return f"Paiement {self.operation_id} ({self.status})"


class Receipt(models.Model):
    id = models.BigAutoField(primary_key=True)
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    sale = models.OneToOneField(Sale, on_delete=models.CASCADE, related_name='receipt')
    receipt_number = models.CharField(max_length=50, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'receipts'

    def __str__(self):
        return self.receipt_number


class POSSession(models.Model):
    """
    Session de caisse (ouverture / fermeture) pour le module POS.
    (_docs/13_FONCTIONNALITE_HORS_LIGNE.txt, section "POS")
    """
    STATUS_CHOICES = [
        ('open', 'Ouverte'),
        ('closed', 'Fermée'),
    ]

    id = models.BigAutoField(primary_key=True)
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='pos_sessions')
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='pos_sessions')
    cashier = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='pos_sessions'
    )
    opening_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    closing_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='open')
    opened_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'pos_sessions'
        ordering = ['-opened_at']

    def __str__(self):
        return f"Session {self.uuid} ({self.status})"
