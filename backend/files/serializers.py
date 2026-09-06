from rest_framework import serializers

from companies.models import Store
from companies.serializers import StoreSerializer
from .models import CompanyFile
from .utils import scan_file_for_viruses


class CompanyFileSerializer(serializers.ModelSerializer):
    store = serializers.SlugRelatedField(
        slug_field='uuid', queryset=Store.objects.all(),
        required=False, allow_null=True,
    )

    class Meta:
        model = CompanyFile
        fields = ['uuid', 'store', 'path', 'mime_type', 'size', 'created_at']
        read_only_fields = ['uuid', 'mime_type', 'size', 'created_at']

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

        uploaded_file = data.get('path')
        if uploaded_file and hasattr(uploaded_file, 'read'):
            scan_file_for_viruses(uploaded_file)

        return data
