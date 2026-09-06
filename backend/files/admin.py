from django.contrib import admin

from .models import CompanyFile


@admin.register(CompanyFile)
class CompanyFileAdmin(admin.ModelAdmin):
    list_display = ['path', 'company', 'mime_type', 'size', 'created_at']
    search_fields = ['company__name']
    list_filter = ['company']
    readonly_fields = ['uuid', 'created_at']
