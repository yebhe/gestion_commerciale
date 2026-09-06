from rest_framework import serializers

from .models import Company, Store


class CompanySerializer(serializers.ModelSerializer):
    is_active = serializers.ReadOnlyField()

    class Meta:
        model = Company
        fields = [
            'uuid', 'name', 'slug', 'logo', 'phone', 'email',
            'address', 'subscription_status', 'is_active', 'created_at',
        ]
        read_only_fields = ['uuid', 'slug', 'subscription_status', 'created_at']


class StoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = Store
        fields = ['uuid', 'name', 'logo', 'address', 'phone', 'created_at']
        read_only_fields = ['uuid', 'created_at']
