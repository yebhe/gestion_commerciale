import uuid

from django.db import models

from companies.models import Company


class Plan(models.Model):
    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        db_table = 'plans'
        ordering = ['price']

    def __str__(self):
        return self.name


class Subscription(models.Model):
    STATUS_CHOICES = [
        ('trial', 'Essai'),
        ('active', 'Active'),
        ('suspended', 'Suspendue'),
        ('cancelled', 'Annulée'),
    ]

    id = models.BigAutoField(primary_key=True)
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='subscriptions')
    plan = models.ForeignKey(Plan, on_delete=models.CASCADE, related_name='subscriptions')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='trial')
    starts_at = models.DateTimeField()
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'subscriptions'
        ordering = ['-starts_at']

    def __str__(self):
        return f"{self.company.name} - {self.plan.name}"
