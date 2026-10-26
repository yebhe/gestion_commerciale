"""Signaux inventory (_docs/15, étape 1.4)."""

from django.db.models.signals import post_save
from django.dispatch import receiver

from companies.models import Store

from .models import Warehouse


@receiver(post_save, sender=Store)
def create_default_warehouse(sender, instance, created, **kwargs):
    """Tout nouveau magasin reçoit automatiquement son entrepôt
    « Principal » (code MAIN, is_default=True)."""
    if not created:
        return
    Warehouse.objects.get_or_create(
        store=instance,
        code='MAIN',
        defaults={
            'company': instance.company,
            'name': 'Principal',
            'type': 'main',
            'is_default': True,
            'is_active': True,
        },
    )
