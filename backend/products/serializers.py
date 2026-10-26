from rest_framework import serializers

from companies.models import Store
from companies.serializers import StoreSerializer
from inventory.services import apply_movement
from suppliers.models import Supplier
from .models import Category, Lot, Product, ProductVariant, StockLevel


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
    stock_by_warehouse = serializers.SerializerMethodField()
    stock_quantity = serializers.IntegerField(write_only=True, required=False, default=0)

    class Meta:
        model = Product
        fields = [
            'uuid', 'store', 'category', 'name', 'description', 'barcode',
            'purchase_price', 'selling_price', 'stock_quantity', 'stock_by_store',
            'stock_by_warehouse', 'image',
            'created_at', 'updated_at', 'is_deleted',
        ]
        read_only_fields = ['uuid', 'created_at', 'updated_at', 'is_deleted',
                            'stock_by_store', 'stock_by_warehouse']

    def get_stock_quantity(self, instance):
        return instance.stock_quantity

    def get_stock_by_store(self, instance):
        # Agrégat par magasin : somme des entrepôts (R11).
        from django.db.models import Sum
        rows = (
            instance.stock_levels.values('store')
            .annotate(quantity=Sum('quantity'))
        )
        stores = {s.id: s for s in Store.objects.filter(
            id__in=[r['store'] for r in rows])}
        return [
            {'store': StoreSerializer(stores[r['store']]).data,
             'quantity': r['quantity']}
            for r in rows if r['store'] in stores
        ]

    def get_stock_by_warehouse(self, instance):
        return [
            {
                'store': {'uuid': str(sl.store.uuid)} if sl.store else None,
                'warehouse': {
                    'uuid': str(sl.warehouse.uuid),
                    'name': sl.warehouse.name,
                    'code': sl.warehouse.code,
                    'is_default': sl.warehouse.is_default,
                } if sl.warehouse else None,
                'variant': {'uuid': str(sl.variant.uuid)} if sl.variant else None,
                'lot': {'uuid': str(sl.lot.uuid)} if sl.lot else None,
                'quantity': sl.quantity,
            }
            for sl in instance.stock_levels.select_related(
                'warehouse', 'store', 'variant', 'lot')
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
            request = self.context.get('request')
            apply_movement(
                company=product.company,
                store=product.store,
                product=product,
                movement_type='initial',
                quantity=initial_stock,
                user=getattr(request, 'user', None),
                reason='initial',
                request=request,
            )
        return product

    def update(self, instance, validated_data):
        new_stock = validated_data.pop('stock_quantity', None)
        instance = super().update(instance, validated_data)
        if new_stock is not None and instance.store:
            from inventory.services import resolve_warehouse
            warehouse = resolve_warehouse(instance.store)
            level, _ = StockLevel.objects.get_or_create(
                product=instance, store=instance.store, warehouse=warehouse,
                defaults={'quantity': 0},
            )
            if level.quantity != new_stock:
                request = self.context.get('request')
                apply_movement(
                    company=instance.company,
                    store=instance.store,
                    warehouse=warehouse,
                    product=instance,
                    movement_type='adjustment',
                    quantity=new_stock - level.quantity,
                    user=getattr(request, 'user', None),
                    reason='product_update',
                    request=request,
                )
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


class ProductVariantSerializer(serializers.ModelSerializer):
    """Variante d'un produit (_docs/15, étape 4.4). Le produit est
    fourni par l'URL imbriquée /products/{uuid}/variants/."""

    class Meta:
        model = ProductVariant
        fields = ['uuid', 'product', 'sku', 'barcode', 'attributes',
                  'selling_price', 'is_active',
                  'created_at', 'updated_at', 'is_deleted']
        read_only_fields = ['uuid', 'product', 'created_at', 'updated_at',
                            'is_deleted']

    def validate_selling_price(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Le prix ne peut pas être négatif.")
        return value

    def validate_attributes(self, value):
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError(
                "Les attributs doivent être un objet JSON "
                "(ex: {\"couleur\": \"Noir\"})."
            )
        return value


class LotSerializer(serializers.ModelSerializer):
    """Lot d'un produit (_docs/15, étape 4.4). Le produit vient de
    l'URL imbriquée /products/{uuid}/lots/ ; number unique par produit."""

    variant = serializers.SlugRelatedField(
        slug_field='uuid', queryset=ProductVariant.objects.all(),
        required=False, allow_null=True,
    )
    supplier = serializers.SlugRelatedField(
        slug_field='uuid', queryset=Supplier.objects.all(),
        required=False, allow_null=True,
    )

    class Meta:
        model = Lot
        fields = ['uuid', 'product', 'variant', 'number', 'expiry_date',
                  'received_at', 'supplier',
                  'created_at', 'updated_at', 'is_deleted']
        read_only_fields = ['uuid', 'product', 'received_at', 'created_at',
                            'updated_at', 'is_deleted']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['variant'] = (
            ProductVariantSerializer(instance.variant).data
            if instance.variant else None
        )
        data['supplier'] = (
            {'uuid': str(instance.supplier.uuid), 'name': instance.supplier.name}
            if instance.supplier else None
        )
        return data

    def validate(self, data):
        request = self.context.get('request')
        company = getattr(request, 'company', None)
        product = self.context.get('product')

        variant = data.get('variant')
        if variant is not None:
            if product is not None and variant.product_id != product.id:
                raise serializers.ValidationError({
                    'variant': "Cette variante n'appartient pas au produit."
                })
            if company is not None and variant.company_id != company.id:
                raise serializers.ValidationError({
                    'variant': "Cette variante n'appartient pas à cette entreprise."
                })

        supplier = data.get('supplier')
        if supplier is not None and company is not None \
                and supplier.company_id != company.id:
            raise serializers.ValidationError({
                'supplier': "Ce fournisseur n'appartient pas à cette entreprise."
            })

        # Unicité (product, number) — message clair plutôt qu'un 500.
        number = data.get('number')
        if number and product is not None:
            qs = Lot.objects.filter(product=product, number=number,
                                    is_deleted=False)
            if self.instance is not None:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({
                    'number': "Un lot avec ce numéro existe déjà pour ce produit."
                })
        return data
