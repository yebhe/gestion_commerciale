from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['action', 'object_type', 'object_id', 'user', 'company', 'created_at']
    search_fields = ['action', 'object_type', 'object_id', 'company__name']
    list_filter = ['company', 'action', 'object_type']
    readonly_fields = ['uuid', 'company', 'user', 'action', 'object_type', 'object_id', 'metadata', 'created_at']

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
