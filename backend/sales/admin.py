from django.contrib import admin

from .models import Sale, SaleItem, Receipt


class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ['uuid', 'company', 'store', 'total_amount', 'status', 'created_at']
    search_fields = ['uuid', 'company__name']
    list_filter = ['company', 'store', 'status', 'payment_method']
    readonly_fields = ['uuid', 'created_at']
    inlines = [SaleItemInline]


@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = ['receipt_number', 'sale', 'created_at']
    search_fields = ['receipt_number']
    readonly_fields = ['uuid', 'created_at']
