from rest_framework import viewsets

from users.permissions import HasPermission
from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Journal d'audit en lecture seule, permission audit.view (_docs/08)."""
    serializer_class = AuditLogSerializer
    permission_classes = (HasPermission,)
    lookup_field = 'uuid'
    search_fields = ['action', 'object_type', 'object_id', 'user__email', 'user__first_name', 'user__last_name']
    permission_map = {
        'list': 'audit.view',
        'retrieve': 'audit.view',
    }
    filterset_fields = ['action', 'object_type', 'user']

    def get_queryset(self):
        return AuditLog.objects.filter(company=self.request.company)
