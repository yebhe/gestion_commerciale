from rest_framework import serializers

from companies.models import Store
from companies.serializers import StoreSerializer
from .models import Category, Product, StockLevel


class CategorySerializer(serializers.ModelSerializer):
    store = serializers.SlugRelatedField(
        slug_field='uuid', queryset=Store.objects.all(),
        required=False, allow_null=True,
    )

    class Meta:
        model = Category
        fields = ['uuid', 'store', 'name', 'created_at', 'updated_at', 'is_deleted']
        read_only_fields = ['uuid', 'created_at', 'updated_at', 'is_deleted']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.store:
            data['store'] = StoreSerializer(instance.store).data
        else:
            data['store'] = None
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


class ProductSerializer(serializers.ModelSerializer):
    store = serializers.SlugRelatedField(
        slug_field='uuid', queryset=Store.objects.all(),
        required=True,
    )
    category = serializers.SlugRelatedField(
        slug_field='uuid', queryset=Category.objects.all(),
        required=False, allow_null=True,
    )
    stock_by_store = serializers.SerializerMethodField()
    stock_quantity = serializers.IntegerField(write_only=True, required=False, default=0)

    class Meta:
        model = Product
        fields = [
            'uuid', 'store', 'category', 'name', 'description', 'barcode',
            'purchase_price', 'selling_price', 'stock_quantity', 'stock_by_store', 'image',
            'created_at', 'updated_at', 'is_deleted',
        ]
        read_only_fields = ['uuid', 'created_at', 'updated_at', 'is_deleted', 'stock_by_store']

    def get_stock_quantity(self, instance):
        return instance.stock_quantity

    def get_stock_by_store(self, instance):
        return [
            {'store': StoreSerializer(sl.store).data, 'quantity': sl.quantity}
            for sl in instance.stock_levels.select_related('store')
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['stock_quantity'] = instance.stock_quantity
        if instance.store:
            data['store'] = StoreSerializer(instance.store).data
        else:
            data['store'] = None
        if instance.category:
            data['category'] = CategorySerializer(instance.category).data
        else:
            data['category'] = None
        return data

    def create(self, validated_data):
        initial_stock = validated_data.pop('stock_quantity', 0)
        product = Product.objects.create(**validated_data)
        if initial_stock and initial_stock > 0 and product.store:
            StockLevel.objects.create(
                product=product, store=product.store, quantity=initial_stock
            )
        return product

    def update(self, instance, validated_data):
        new_stock = validated_data.pop('stock_quantity', None)
        instance = super().update(instance, validated_data)
        if new_stock is not None and instance.store:
            level, _ = StockLevel.objects.get_or_create(
                product=instance, store=instance.store,
                defaults={'quantity': 0},
            )
            if level.quantity != new_stock:
                level.quantity = max(0, new_stock)
                level.save(update_fields=['quantity'])
        return instance

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

        category = data.get('category')
        if category and category.company_id != company.id:
            raise serializers.ValidationError({
                'category': "Cette catégorie n'appartient pas à cette entreprise."
            })

        for field in ['purchase_price', 'selling_price']:
            value = data.get(field)
            if value is not None and value < 0:
                raise serializers.ValidationError({
                    field: "Le prix ne peut pas être négatif."
                })

        return data
