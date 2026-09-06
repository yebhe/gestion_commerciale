from django.contrib import admin

from .models import InventoryMovement


@admin.register(InventoryMovement)
class InventoryMovementAdmin(admin.ModelAdmin):
    list_display = ['product', 'store', 'type', 'quantity', 'company', 'created_at']
    search_fields = ['product__name', 'company__name']
    list_filter = ['company', 'store', 'type']
    readonly_fields = ['uuid', 'created_at']
