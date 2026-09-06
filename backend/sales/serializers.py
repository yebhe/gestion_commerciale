from django.db import transaction
from rest_framework import serializers

from companies.models import Store
from companies.serializers import StoreSerializer
from customers.models import Customer
from customers.serializers import CustomerSerializer
from products.models import Product, StockLevel
from products.serializers import ProductSerializer
from .models import Sale, SaleItem, Receipt, MobileMoneyPayment, POSSession


class SaleItemSerializer(serializers.ModelSerializer):
    product = serializers.SlugRelatedField(
        slug_field='uuid', queryset=Product.objects.all(),
    )

    class Meta:
        model = SaleItem
        fields = ['id', 'product', 'quantity', 'unit_price', 'discount']

    def validate_quantity(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("La quantité doit être supérieure à zéro.")
        return value

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['product'] = ProductSerializer(instance.product).data if instance.product else None
        return data

    def validate_product(self, product):
        request = self.context.get('request')
        company = getattr(request, 'company', None)
        if not company:
            raise serializers.ValidationError("Aucune entreprise sélectionnée.")
        if product.company_id != company.id:
            raise serializers.ValidationError(
                "Ce produit n'appartient pas à cette entreprise."
            )
        return product


class ReceiptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Receipt
        fields = ['uuid', 'receipt_number', 'created_at']
        read_only_fields = ['uuid', 'created_at']


class MobileMoneyPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = MobileMoneyPayment
        fields = ['uuid', 'operation_id', 'payment_url', 'status', 'created_at', 'updated_at']
        read_only_fields = fields


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True)
    receipt = ReceiptSerializer(read_only=True)
    mobile_money_payment = MobileMoneyPaymentSerializer(read_only=True)
    store = serializers.SlugRelatedField(
        slug_field='uuid', queryset=Store.objects.all(),
        required=True,
    )
    customer = serializers.SlugRelatedField(
        slug_field='uuid', queryset=Customer.objects.all(),
        required=False, allow_null=True,
    )

    class Meta:
        model = Sale
        fields = [
            'uuid', 'store', 'customer', 'cashier', 'total_amount',
            'payment_method', 'status', 'items', 'receipt',
            'mobile_money_payment', 'created_at',
        ]
        read_only_fields = ['uuid', 'cashier', 'created_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['store'] = StoreSerializer(instance.store).data if instance.store else None
        data['customer'] = CustomerSerializer(instance.customer).data if instance.customer else None
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

        customer = data.get('customer')
        if customer and customer.company_id != company.id:
            raise serializers.ValidationError({
                'customer': "Ce client n'appartient pas à cette entreprise."
            })

        items_data = data.get('items', [])
        if store:
            for item in items_data:
                product = item.get('product')
                qty = item.get('quantity', 0)
                if product:
                    level = StockLevel.objects.filter(product=product, store=store).first()
                    available = level.quantity if level else 0
                    if qty > available:
                        raise serializers.ValidationError({
                            'items': f"Stock insuffisant pour « {product.name} » : "
                                     f"{available} disponible(s), {qty} demandé(s)."
                        })

        return data

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        store = validated_data.get('store')
        with transaction.atomic():
            if store:
                for item_data in items_data:
                    product = item_data.get('product')
                    qty = item_data.get('quantity', 0)
                    level = StockLevel.objects.select_for_update().filter(
                        product=product, store=store,
                    ).first()
                    available = level.quantity if level else 0
                    if qty > available:
                        raise serializers.ValidationError({
                            'items': f"Stock insuffisant pour « {product.name} » : "
                                     f"{available} disponible(s), {qty} demandé(s)."
                        })

            sale = Sale.objects.create(**validated_data)
            total = 0
            for item_data in items_data:
                item = SaleItem.objects.create(sale=sale, **item_data)
                total += item.quantity * item.unit_price - item.discount
                if store:
                    level, _ = StockLevel.objects.select_for_update().get_or_create(
                        product=item.product, store=store,
                        defaults={'quantity': 0},
                    )
                    level.quantity = max(0, level.quantity - item.quantity)
                    level.save(update_fields=['quantity'])
            sale.total_amount = total
            sale.save(update_fields=['total_amount'])
            receipt_number = f"REC-{sale.uuid.hex[:12].upper()}"
            Receipt.objects.create(sale=sale, receipt_number=receipt_number)
        return sale

    def update(self, instance, validated_data):
        validated_data.pop('items', None)
        return super().update(instance, validated_data)


class POSSessionSerializer(serializers.ModelSerializer):
    store = serializers.SlugRelatedField(
        slug_field='uuid', queryset=Store.objects.all(),
        required=True,
    )

    class Meta:
        model = POSSession
        fields = [
            'uuid', 'store', 'cashier', 'opening_amount', 'closing_amount',
            'status', 'opened_at', 'closed_at', 'created_at', 'updated_at',
        ]
        read_only_fields = ['uuid', 'cashier', 'opened_at', 'closed_at', 'created_at', 'updated_at']

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
