from django.contrib import admin

from .models import CompanySettings, StoreSettings


@admin.register(CompanySettings)
class CompanySettingsAdmin(admin.ModelAdmin):
    list_display = ['company', 'background_color', 'updated_at']
    search_fields = ['company__name']
    list_filter = ['updated_at']


@admin.register(StoreSettings)
class StoreSettingsAdmin(admin.ModelAdmin):
    list_display = ['store', 'background_color', 'updated_at']
    search_fields = ['store__name', 'store__company__name']
    list_filter = ['updated_at']
