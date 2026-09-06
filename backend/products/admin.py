from django.contrib import admin

from .models import Category, Product, StockLevel


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'company', 'store', 'created_at']
    search_fields = ['name', 'company__name']
    list_filter = ['company']
    readonly_fields = ['uuid', 'created_at']


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'company', 'store', 'selling_price', 'stock_quantity']
    search_fields = ['name', 'barcode', 'company__name']
    list_filter = ['company', 'store', 'category']
    readonly_fields = ['uuid', 'created_at', 'updated_at']


@admin.register(StockLevel)
class StockLevelAdmin(admin.ModelAdmin):
    list_display = ['product', 'store', 'quantity']
    list_filter = ['store']
    search_fields = ['product__name', 'product__barcode']
    readonly_fields = ['uuid', 'created_at', 'updated_at']
