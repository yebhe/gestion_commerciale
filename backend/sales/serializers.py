from django.db import transaction
from rest_framework import serializers

from companies.models import Store
from companies.serializers import StoreSerializer
from customers.models import Customer
from customers.serializers import CustomerSerializer
from products.models import Lot, Product, ProductVariant, StockLevel
from products.serializers import ProductSerializer
from inventory.services import apply_movement, reserve_stock, store_available
from .models import Sale, SaleItem, Receipt, MobileMoneyPayment, POSSession


class SaleItemSerializer(serializers.ModelSerializer):
    product = serializers.SlugRelatedField(
        slug_field='uuid', queryset=Product.objects.all(),
    )
    variant = serializers.SlugRelatedField(
        slug_field='uuid', queryset=ProductVariant.objects.all(),
        required=False, allow_null=True,
    )
    lot = serializers.SlugRelatedField(
        slug_field='uuid', queryset=Lot.objects.all(),
        required=False, allow_null=True,
    )

    class Meta:
        model = SaleItem
        fields = ['id', 'product', 'variant', 'lot', 'quantity',
                  'unit_price', 'discount']

    def validate_quantity(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("La quantité doit être supérieure à zéro.")
        return value

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['product'] = ProductSerializer(instance.product).data if instance.product else None
        data['variant'] = (
            {'uuid': str(instance.variant.uuid),
             'attributes': instance.variant.attributes,
             'sku': instance.variant.sku}
            if instance.variant else None
        )
        data['lot'] = (
            {'uuid': str(instance.lot.uuid), 'number': instance.lot.number}
            if instance.lot else None
        )
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

    def validate(self, data):
        # R59 : variante et lot doivent appartenir au produit de la ligne.
        product = data.get('product') or getattr(self.instance, 'product', None)
        variant = data.get('variant')
        lot = data.get('lot')
        if variant is not None and product is not None \
                and variant.product_id != product.id:
            raise serializers.ValidationError({
                'variant': "Cette variante n'appartient pas au produit."
            })
        if lot is not None and product is not None \
                and lot.product_id != product.id:
            raise serializers.ValidationError({
                'lot': "Ce lot n'appartient pas au produit."
            })
        if (variant is not None and lot is not None
                and lot.variant_id is not None
                and lot.variant_id != variant.id):
            raise serializers.ValidationError({
                'lot': "Ce lot n'est pas rattaché à la variante indiquée."
            })
        return data


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
                    # Disponible = physique - réservé (étape 5, R65-R66).
                    available = store_available(product=product, store=store)
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
                    available = store_available(product=product, store=store)
                    if qty > available:
                        raise serializers.ValidationError({
                            'items': f"Stock insuffisant pour « {product.name} » : "
                                     f"{available} disponible(s), {qty} demandé(s)."
                        })

            sale = Sale.objects.create(**validated_data)
            total = 0
            request = self.context.get('request')
            is_pending = sale.status == 'pending'
            for item_data in items_data:
                item = SaleItem.objects.create(sale=sale, **item_data)
                total += item.quantity * item.unit_price - item.discount
                if store:
                    if is_pending:
                        # Vente en attente (Mobile Money) : le stock est
                        # réservé, pas sorti (étape 5.3). Consommé au succès
                        # du webhook, libéré à l'échec.
                        reserve_stock(
                            company=sale.company,
                            store=store,
                            product=item.product,
                            variant=item.variant,
                            lot=item.lot,
                            quantity=item.quantity,
                            source=sale,
                            user=getattr(request, 'user', None),
                        )
                    else:
                        apply_movement(
                            company=sale.company,
                            store=store,
                            product=item.product,
                            variant=item.variant,
                            lot=item.lot,
                            movement_type='out',
                            quantity=item.quantity,
                            user=getattr(request, 'user', None),
                            note=f"Vente {sale.uuid}",
                            reason='sale',
                            source=sale,
                        )
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
