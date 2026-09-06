import uuid

from django.db import models
from django.utils.text import slugify


class Company(models.Model):
    SUBSCRIPTION_STATUS_CHOICES = [
        ('trial', 'Essai'),
        ('active', 'Active'),
        ('suspended', 'Suspendue'),
        ('cancelled', 'Annulée'),
    ]

    id = models.BigAutoField(primary_key=True)
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    logo = models.ImageField(upload_to='companies/logos/', blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    address = models.CharField(max_length=255, blank=True, null=True)
    subscription_status = models.CharField(
        max_length=20, choices=SUBSCRIPTION_STATUS_CHOICES, default='trial'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'companies'
        ordering = ['name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name)
            slug = base_slug
            index = 1
            while Company.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                index += 1
                slug = f"{base_slug}-{index}"
            self.slug = slug
        super().save(*args, **kwargs)

    @property
    def is_active(self):
        """Entreprise active = abonnement en essai ou actif (ni suspendue ni annulée)."""
        return self.subscription_status in ('trial', 'active')


class Store(models.Model):
    id = models.BigAutoField(primary_key=True)
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='stores')
    name = models.CharField(max_length=200)
    logo = models.ImageField(upload_to='stores/logos/', blank=True, null=True)
    address = models.CharField(max_length=255, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'stores'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.company.name})"
