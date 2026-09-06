import uuid

from django.db import models

from companies.models import Company, Store


class Supplier(models.Model):
    id = models.BigAutoField(primary_key=True)
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='suppliers')
    store = models.ForeignKey(
        Store, on_delete=models.SET_NULL, related_name='suppliers', null=True, blank=True
    )
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'suppliers'
        ordering = ['name']

    def __str__(self):
        return self.name
