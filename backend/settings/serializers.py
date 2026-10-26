import re

from rest_framework import serializers

from .models import CompanySettings, StoreSettings


class CompanySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanySettings
        fields = ['mode', 'background_color', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

    def validate_background_color(self, value):
        if not re.match(r'^#[0-9a-fA-F]{6}$', value or ''):
            raise serializers.ValidationError(
                "La couleur doit être au format hexadécimal (#RRGGBB)."
            )
        return value.lower()


class StoreSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = StoreSettings
        fields = ['background_color', 'uses_locations', 'uses_lots',
                  'uses_variants', 'uses_purchase_orders',
                  'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

    def validate_background_color(self, value):
        if not value:
            return ''
        if not re.match(r'^#[0-9a-fA-F]{6}$', value or ''):
            raise serializers.ValidationError(
                "La couleur doit être au format hexadécimal (#RRGGBB) ou vide."
            )
        return value.lower()


class ResolvedThemeSerializer(serializers.Serializer):
    """
    Résout le thème effectif selon la hiérarchie :
    magasin > entreprise > global.
    """
    background_color = serializers.CharField(read_only=True)
    scope = serializers.CharField(read_only=True)
    store_uuid = serializers.UUIDField(read_only=True, allow_null=True)
    company_uuid = serializers.UUIDField(read_only=True, allow_null=True)
