from rest_framework import serializers

from users.serializers import UserBasicSerializer
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    user = UserBasicSerializer(read_only=True)

    class Meta:
        model = AuditLog
        fields = ['uuid', 'user', 'action', 'object_type', 'object_id', 'metadata', 'created_at']
        read_only_fields = fields
