from django.contrib import admin

from .models import Company, Store


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'subscription_status', 'email', 'created_at']
    search_fields = ['name', 'slug', 'email']
    readonly_fields = ['uuid', 'created_at', 'updated_at']


@admin.register(Store)
class StoreAdmin(admin.ModelAdmin):
    list_display = ['name', 'company', 'phone', 'created_at']
    search_fields = ['name', 'company__name']
    list_filter = ['company']
    readonly_fields = ['uuid', 'created_at']
