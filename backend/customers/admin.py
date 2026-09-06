from django.contrib import admin

from .models import Customer


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ['name', 'company', 'phone', 'email', 'created_at']
    search_fields = ['name', 'phone', 'email', 'company__name']
    list_filter = ['company']
    readonly_fields = ['uuid', 'created_at']
