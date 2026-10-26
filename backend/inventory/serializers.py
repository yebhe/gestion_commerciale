from rest_framework import serializers

from companies.models import Store
from companies.serializers import StoreSerializer
from products.models import Lot, Product, ProductVariant, StockLevel
from products.serializers import ProductSerializer
from .models import InventoryMovement, Transfer, TransferItem, Warehouse
from .services import apply_movement, adjust_movement, resolve_warehouse
from .validators import assert_hierarchy


class WarehouseSerializer(serializers.ModelSerializer):
    store = serializers.SlugRelatedField(
        slug_field='uuid', queryset=Store.objects.all(),
    )

    class Meta:
        model = Warehouse
        fields = ['uuid', 'store', 'name', 'code', 'type', 'is_default',
                  'is_active', 'address', 'created_at', 'updated_at']
        read_only_fields = ['uuid', 'created_at', 'updated_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['store'] = StoreSerializer(instance.store).data if instance.store else None
        return data

    def validate(self, data):
        request = self.context.get('request')
        company = getattr(request, 'company', None)
        store = data.get('store') or getattr(self.instance, 'store', None)
        assert_hierarchy(company, store=store)
        if data.get('is_default') and store:
            conflict = Warehouse.objects.filter(
                store=store, is_default=True,
            )
            if self.instance:
                conflict = conflict.exclude(pk=self.instance.pk)
            if conflict.exists():
                raise serializers.ValidationError({
                    'is_default': "Ce magasin a déjà un entrepôt par défaut."
                })
        return data


class InventoryMovementSerializer(serializers.ModelSerializer):
    store = serializers.SlugRelatedField(
        slug_field='uuid', queryset=Store.objects.all(),
        required=False, allow_null=True,
    )
    warehouse = serializers.SlugRelatedField(
        slug_field='uuid', queryset=Warehouse.objects.all(),
        required=False, allow_null=True,
    )
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
    new_quantity = serializers.IntegerField(required=False, allow_null=True)
    quantity = serializers.IntegerField(required=False)

    class Meta:
        model = InventoryMovement
        fields = ['uuid', 'store', 'warehouse', 'product', 'variant', 'lot',
                  'type', 'quantity',
                  'new_quantity', 'note', 'stock_before', 'stock_after',
                  'reason', 'source_type', 'source_uuid', 'created_at']
        read_only_fields = ['uuid', 'stock_before', 'stock_after', 'reason',
                            'source_type', 'source_uuid', 'created_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['store'] = StoreSerializer(instance.store).data if instance.store else None
        data['warehouse'] = WarehouseSerializer(instance.warehouse).data if instance.warehouse else None
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

        warehouse = data.get('warehouse')
        if warehouse:
            try:
                assert_hierarchy(company, store=store, warehouse=warehouse)
            except Exception:
                raise serializers.ValidationError({
                    'warehouse': "Cet entrepôt n'appartient pas au magasin indiqué."
                })

        product = data.get('product')
        if product and product.company_id != company.id:
            raise serializers.ValidationError({
                'product': "Ce produit n'appartient pas à cette entreprise."
            })

        # R59 : variante et lot doivent appartenir au produit.
        variant = data.get('variant')
        lot = data.get('lot')
        try:
            assert_hierarchy(company, product=product, variant=variant, lot=lot)
        except Exception as exc:
            raise serializers.ValidationError(
                exc.detail if hasattr(exc, 'detail') else str(exc))

        movement_type = data.get('type')
        quantity = data.get('quantity', 0)
        if movement_type in ('out', 'sale_out', 'transfer_out', 'loss', 'breakage') and product and store:
            wh = resolve_warehouse(store, warehouse)
            level = StockLevel.objects.filter(
                product=product, store=store, warehouse=wh,
                variant=variant, lot=lot,
            ).first()
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
        request = self.context.get('request')
        company = validated_data.get('company') or getattr(request, 'company', None)
        store = validated_data.get('store')
        product = validated_data.get('product')
        movement_type = validated_data.get('type')
        quantity = validated_data.get('quantity', 0)

        warehouse = resolve_warehouse(store, validated_data.get('warehouse'))
        variant = validated_data.get('variant')
        lot = validated_data.get('lot')

        # Un ajustement saisit la quantité cible : il passe par une
        # session scope=product validée immédiatement (étape 6.3) —
        # même mécanisme et même traçabilité qu'un inventaire.
        if movement_type == 'adjustment' and new_quantity is not None:
            from .services import quick_adjust
            return quick_adjust(
                company=company, store=store, product=product,
                new_quantity=new_quantity, warehouse=warehouse,
                variant=variant, lot=lot,
                user=getattr(request, 'user', None), request=request,
            )

        return apply_movement(
            company=company,
            store=store,
            warehouse=warehouse,
            product=product,
            variant=variant,
            lot=lot,
            movement_type=movement_type,
            quantity=quantity,
            user=getattr(request, 'user', None),
            note=validated_data.get('note') or '',
            reason='adjustment' if movement_type == 'adjustment' else 'manual',
            request=request,
        )

    def update(self, instance, validated_data):
        validated_data.pop('new_quantity', None)
        request = self.context.get('request')
        return adjust_movement(
            instance,
            new_type=validated_data.get('type', instance.type),
            new_quantity=validated_data.get('quantity', instance.quantity),
            new_store=validated_data.get('store', instance.store),
            new_warehouse=validated_data.get('warehouse', instance.warehouse),
            new_note=validated_data.get('note', instance.note),
            user=getattr(request, 'user', None),
            request=request,
        )


class TransferItemSerializer(serializers.ModelSerializer):
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
        model = TransferItem
        fields = ['id', 'product', 'variant', 'lot',
                  'quantity_requested', 'quantity_shipped', 'quantity_received']
        read_only_fields = ['id', 'quantity_shipped', 'quantity_received']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['product'] = {
            'uuid': str(instance.product.uuid),
            'name': instance.product.name,
            'barcode': instance.product.barcode,
        }
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


class TransferSerializer(serializers.ModelSerializer):
    items = TransferItemSerializer(many=True)
    from_store = serializers.SlugRelatedField(
        slug_field='uuid', queryset=Store.objects.all())
    to_store = serializers.SlugRelatedField(
        slug_field='uuid', queryset=Store.objects.all())
    from_warehouse = serializers.SlugRelatedField(
        slug_field='uuid', queryset=Warehouse.objects.all(),
        required=False, allow_null=True)
    to_warehouse = serializers.SlugRelatedField(
        slug_field='uuid', queryset=Warehouse.objects.all(),
        required=False, allow_null=True)
    immediate = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = Transfer
        fields = ['uuid', 'number', 'transfer_type', 'status',
                  'from_store', 'to_store', 'from_warehouse', 'to_warehouse',
                  'from_location', 'to_location',
                  'requested_by', 'validated_by', 'shipped_by', 'received_by',
                  'requested_at', 'validated_at', 'shipped_at', 'received_at',
                  'note', 'reason', 'items', 'immediate',
                  'created_at', 'updated_at']
        read_only_fields = ['uuid', 'number', 'transfer_type', 'status',
                            'requested_by', 'validated_by', 'shipped_by',
                            'received_by', 'requested_at', 'validated_at',
                            'shipped_at', 'received_at',
                            'created_at', 'updated_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['from_store'] = StoreSerializer(instance.from_store).data
        data['to_store'] = StoreSerializer(instance.to_store).data
        data['from_warehouse'] = WarehouseSerializer(instance.from_warehouse).data if instance.from_warehouse else None
        data['to_warehouse'] = WarehouseSerializer(instance.to_warehouse).data if instance.to_warehouse else None
        for field in ('requested_by', 'validated_by', 'shipped_by', 'received_by'):
            user = getattr(instance, field)
            data[field] = {'uuid': str(user.uuid), 'email': user.email} if user else None
        return data

    def validate(self, data):
        request = self.context.get('request')
        company = getattr(request, 'company', None)
        if not company:
            raise serializers.ValidationError("Aucune entreprise sélectionnée.")

        from_store = data.get('from_store')
        to_store = data.get('to_store')
        for label, store in (('from_store', from_store), ('to_store', to_store)):
            if store and store.company_id != company.id:
                raise serializers.ValidationError({
                    label: "Ce magasin n'appartient pas à cette entreprise."
                })

        from_wh = resolve_warehouse(from_store, data.get('from_warehouse'))
        to_wh = resolve_warehouse(to_store, data.get('to_warehouse'))
        if not from_wh or not to_wh:
            raise serializers.ValidationError(
                "Chaque magasin doit avoir au moins un entrepôt actif."
            )
        if from_wh.store_id != from_store.id:
            raise serializers.ValidationError({
                'from_warehouse': "Cet entrepôt n'appartient pas au magasin source."
            })
        if to_wh.store_id != to_store.id:
            raise serializers.ValidationError({
                'to_warehouse': "Cet entrepôt n'appartient pas au magasin destination."
            })
        data['from_warehouse'] = from_wh
        data['to_warehouse'] = to_wh

        # Type déduit automatiquement (3.2) — le client ne peut pas le forcer.
        if from_wh.id == to_wh.id:
            if data.get('from_location') == data.get('to_location'):
                raise serializers.ValidationError(
                    "Un transfert intra-entrepôt exige des emplacements différents."
                )
            data['transfer_type'] = 'intra_warehouse'
        elif from_store.id == to_store.id:
            data['transfer_type'] = 'inter_warehouse'
        else:
            data['transfer_type'] = 'inter_store'

        items = data.get('items') or []
        if not items:
            raise serializers.ValidationError({'items': "Au moins un produit est requis."})
        for item in items:
            product = item['product']
            if product.company_id != company.id:
                raise serializers.ValidationError({
                    'items': f"Le produit « {product.name} » n'appartient pas à cette entreprise."
                })
            if item.get('quantity_requested', 0) <= 0:
                raise serializers.ValidationError({
                    'items': "La quantité demandée doit être supérieure à zéro."
                })
        return data

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        immediate = validated_data.pop('immediate', False)
        request = self.context.get('request')
        validated_data['company'] = getattr(request, 'company', None)
        transfer = Transfer.objects.create(**validated_data)
        TransferItem.objects.bulk_create([
            TransferItem(transfer=transfer, **item) for item in items_data
        ])
        if immediate:
            from .transfer_workflow import run_immediate
            run_immediate(transfer, user=request.user, request=request)
            transfer.refresh_from_db()
        return transfer


class InventorySessionLineSerializer(serializers.ModelSerializer):
    """Ligne de comptage (étape 6.1) : seul counted_quantity est saisissable."""

    class Meta:
        from .models import InventorySessionLine
        model = InventorySessionLine
        fields = ['id', 'product', 'variant', 'lot', 'warehouse', 'location',
                  'expected_quantity', 'counted_quantity', 'difference',
                  'counted_at']
        read_only_fields = ['id', 'product', 'variant', 'lot', 'warehouse',
                            'location', 'expected_quantity', 'difference',
                            'counted_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['product'] = {
            'uuid': str(instance.product.uuid), 'name': instance.product.name,
            'barcode': instance.product.barcode,
        }
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
        data['warehouse'] = (
            {'uuid': str(instance.warehouse.uuid), 'name': instance.warehouse.name}
            if instance.warehouse else None
        )
        return data


class InventorySessionSerializer(serializers.ModelSerializer):
    """Session d'inventaire (étape 6.1). La création génère les lignes
    dans le scope via open_inventory_session (R68-R69)."""

    store = serializers.SlugRelatedField(
        slug_field='uuid', queryset=Store.objects.all(),
    )
    warehouse = serializers.SlugRelatedField(
        slug_field='uuid', queryset=Warehouse.objects.all(),
        required=False, allow_null=True,
    )
    product = serializers.SlugRelatedField(
        slug_field='uuid', queryset=Product.objects.all(),
        required=False, allow_null=True,
    )
    lot = serializers.SlugRelatedField(
        slug_field='uuid', queryset=Lot.objects.all(),
        required=False, allow_null=True,
    )
    lines = InventorySessionLineSerializer(many=True, read_only=True)

    class Meta:
        from .models import InventorySession
        model = InventorySession
        fields = ['uuid', 'store', 'warehouse', 'location', 'scope',
                  'product', 'lot', 'status', 'note', 'opened_at',
                  'validated_at', 'lines']
        read_only_fields = ['uuid', 'status', 'opened_at', 'validated_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['store'] = StoreSerializer(instance.store).data if instance.store else None
        data['warehouse'] = (
            {'uuid': str(instance.warehouse.uuid), 'name': instance.warehouse.name}
            if instance.warehouse else None
        )
        data['product'] = (
            {'uuid': str(instance.product.uuid), 'name': instance.product.name}
            if instance.product else None
        )
        data['lot'] = (
            {'uuid': str(instance.lot.uuid), 'number': instance.lot.number}
            if instance.lot else None
        )
        data['opened_by'] = (
            str(instance.opened_by) if instance.opened_by else None
        )
        data['validated_by'] = (
            str(instance.validated_by) if instance.validated_by else None
        )
        return data

    def create(self, validated_data):
        from .services import open_inventory_session
        request = self.context.get('request')
        return open_inventory_session(
            company=getattr(request, 'company', None),
            user=getattr(request, 'user', None),
            **validated_data,
        )
