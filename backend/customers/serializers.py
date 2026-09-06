from rest_framework import serializers

from companies.models import Store
from companies.serializers import StoreSerializer
from .models import Customer


class CustomerSerializer(serializers.ModelSerializer):
    store = serializers.SlugRelatedField(
        slug_field='uuid', queryset=Store.objects.all(),
        required=False, allow_null=True,
    )

    class Meta:
        model = Customer
        fields = ['uuid', 'store', 'name', 'phone', 'email', 'created_at', 'updated_at', 'is_deleted']
        read_only_fields = ['uuid', 'created_at', 'updated_at', 'is_deleted']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['store'] = StoreSerializer(instance.store).data if instance.store else None
        return data

    def validate(self, data):
        request = self.context.get('request')
        company = getattr(request, 'company', None)
        if not company:
            raise serializers.ValidationError("Aucune entreprise sélectionnée.")

        store = data.get('store')
        if store and store.company_id != company.id:
            raise serializers.ValidationError({
                'store': "Ce magasin n'appartient pas à cette entreprise."
            })

        scoped_store = getattr(request, 'store', None)
        if scoped_store and store and store.id != scoped_store.id:
            raise serializers.ValidationError({
                'store': "Vous ne pouvez gérer que votre magasin assigné."
            })

        return data
