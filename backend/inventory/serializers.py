from django.db import transaction
from rest_framework import serializers

from audit.utils import log_action
from companies.models import Store
from companies.serializers import StoreSerializer
from products.models import Product, StockLevel
from products.serializers import ProductSerializer
from .models import InventoryMovement


def adjust_stock_level(product, store, delta):
    if store is None:
        return
    with transaction.atomic():
        level, _ = StockLevel.objects.select_for_update().get_or_create(
            product=product, store=store,
            defaults={'quantity': 0},
        )
        level.quantity = max(0, level.quantity + delta)
        level.save(update_fields=['quantity'])


class InventoryMovementSerializer(serializers.ModelSerializer):
    store = serializers.SlugRelatedField(
        slug_field='uuid', queryset=Store.objects.all(),
        required=False, allow_null=True,
    )
    product = serializers.SlugRelatedField(
        slug_field='uuid', queryset=Product.objects.all(),
    )
    new_quantity = serializers.IntegerField(required=False, allow_null=True)
    quantity = serializers.IntegerField(required=False)

    class Meta:
        model = InventoryMovement
        fields = ['uuid', 'store', 'product', 'type', 'quantity', 'new_quantity', 'note', 'created_at']
        read_only_fields = ['uuid', 'created_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['store'] = StoreSerializer(instance.store).data if instance.store else None
        data['product'] = ProductSerializer(instance.product).data if instance.product else None
        return data

    def validate_quantity(self, value):
        movement_type = self.initial_data.get('type')
        if movement_type == 'adjustment':
            return value if value is not None else 0
        if value is None or value <= 0:
            raise serializers.ValidationError("La quantité doit être supérieure à zéro.")
        return value

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

        product = data.get('product')
        if product and product.company_id != company.id:
            raise serializers.ValidationError({
                'product': "Ce produit n'appartient pas à cette entreprise."
            })

        movement_type = data.get('type')
        quantity = data.get('quantity', 0)
        if movement_type == 'out' and product and store:
            level = StockLevel.objects.filter(product=product, store=store).first()
            available = level.quantity if level else 0
            if quantity > available:
                raise serializers.ValidationError({
                    'quantity': f"Stock insuffisant : {available} disponible(s), {quantity} demandé(s)."
                })

        if movement_type == 'adjustment':
            new_qty = data.get('new_quantity')
            if new_qty is None:
                raise serializers.ValidationError({
                    'new_quantity': "Veuillez saisir la nouvelle quantité."
                })
            if new_qty < 0:
                raise serializers.ValidationError({
                    'new_quantity': "La quantité ne peut pas être négative."
                })

        return data

    def create(self, validated_data):
        new_quantity = validated_data.pop('new_quantity', None)
        with transaction.atomic():
            if validated_data.get('type') == 'adjustment' and new_quantity is not None:
                store = validated_data.get('store')
                product = validated_data.get('product')
                level, _ = StockLevel.objects.select_for_update().get_or_create(
                    product=product, store=store, defaults={'quantity': 0},
                )
                old_qty = level.quantity
                validated_data['quantity'] = new_quantity - old_qty
            movement = InventoryMovement.objects.create(**validated_data)
            store = movement.store
            qty = movement.quantity
            if movement.type == 'in':
                adjust_stock_level(movement.product, store, qty)
            elif movement.type == 'out':
                adjust_stock_level(movement.product, store, -qty)
            elif movement.type == 'adjustment':
                adjust_stock_level(movement.product, store, qty)
                request = self.context.get('request')
                if request:
                    log_action(request, 'adjust', 'Product', movement.product.uuid, {
                        'product': movement.product.name, 'delta': qty,
                        'new_quantity': new_quantity, 'store': store.name if store else None,
                    })
        return movement

    def update(self, instance, validated_data):
        with transaction.atomic():
            old_store = instance.store
            old_qty = instance.quantity
            old_type = instance.type
            if old_type == 'in':
                adjust_stock_level(instance.product, old_store, -old_qty)
            elif old_type == 'out':
                adjust_stock_level(instance.product, old_store, old_qty)
            elif old_type == 'adjustment':
                adjust_stock_level(instance.product, old_store, -old_qty)

            instance = super().update(instance, validated_data)
            new_store = instance.store
            if instance.type == 'in':
                adjust_stock_level(instance.product, new_store, instance.quantity)
            elif instance.type == 'out':
                adjust_stock_level(instance.product, new_store, -instance.quantity)
            elif instance.type == 'adjustment':
                adjust_stock_level(instance.product, new_store, instance.quantity)
        return instance
