# Étape 1 du plan 15 : entrepôts (R1-R11, R49-R58)
# - table warehouses
# - inventory_movements.warehouse + nouveaux types
# - création de l'entrepôt "Principal" pour chaque magasin existant
# - rattachement des mouvements existants à l'entrepôt par défaut
# - mapping des anciens types de mouvement vers les nouveaux

import uuid

import django.db.models.deletion
from django.db import migrations, models


def create_default_warehouses(apps, schema_editor):
    # NB : le rattachement des stock_levels est fait dans
    # products.0007 (la colonne warehouse n'existe pas encore ici).
    Store = apps.get_model('companies', 'Store')
    Warehouse = apps.get_model('inventory', 'Warehouse')
    InventoryMovement = apps.get_model('inventory', 'InventoryMovement')

    for store in Store.objects.select_related('company').all():
        warehouse, _ = Warehouse.objects.get_or_create(
            store=store,
            code='MAIN',
            defaults={
                'company': store.company,
                'name': 'Principal',
                'type': 'main',
                'is_default': True,
                'is_active': True,
            },
        )
        InventoryMovement.objects.filter(store=store, warehouse__isnull=True).update(
            warehouse=warehouse,
        )


def map_legacy_movement_types(apps, schema_editor):
    InventoryMovement = apps.get_model('inventory', 'InventoryMovement')
    # 'in' + note "Transfert" -> transfer_in ; 'out' + note "Transfert" -> transfer_out
    InventoryMovement.objects.filter(
        type='in', note__istartswith='Transfert',
    ).update(type='transfer_in')
    InventoryMovement.objects.filter(
        type='out', note__istartswith='Transfert',
    ).update(type='transfer_out')
    # 'in' + reason 'sale_cancel' -> sale_cancel_in
    InventoryMovement.objects.filter(
        type='in', reason='sale_cancel',
    ).update(type='sale_cancel_in')
    # 'out' + reason 'sale' -> sale_out
    InventoryMovement.objects.filter(
        type='out', reason='sale',
    ).update(type='sale_out')
    # 'in' restant -> purchase_in ; 'out' restant -> sale_out
    InventoryMovement.objects.filter(type='in').update(type='purchase_in')
    InventoryMovement.objects.filter(type='out').update(type='sale_out')


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('companies', '0001_initial'),
        ('inventory', '0005_movement_traceability'),
    ]

    operations = [
        migrations.CreateModel(
            name='Warehouse',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('uuid', models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ('name', models.CharField(max_length=200)),
                ('code', models.CharField(max_length=50)),
                ('type', models.CharField(choices=[
                    ('main', 'Principal'), ('secondary', 'Secondaire'),
                    ('regional', 'Régional'), ('reserve', 'Réserve'),
                    ('zone', 'Zone'), ('logistics', 'Logistique'),
                ], default='main', max_length=20)),
                ('is_default', models.BooleanField(default=False)),
                ('is_active', models.BooleanField(default=True)),
                ('address', models.CharField(blank=True, max_length=255, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('company', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='warehouses', to='companies.company')),
                ('store', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='warehouses', to='companies.store')),
            ],
            options={
                'db_table': 'warehouses',
                'ordering': ['store', 'name'],
            },
        ),
        migrations.AddField(
            model_name='inventorymovement',
            name='warehouse',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='inventory_movements', to='inventory.warehouse'),
        ),
        migrations.AlterField(
            model_name='inventorymovement',
            name='type',
            field=models.CharField(choices=[
                ('purchase_in', 'Entrée achat'), ('sale_out', 'Sortie vente'),
                ('sale_cancel_in', 'Annulation vente'),
                ('transfer_out', 'Transfert sortant'),
                ('transfer_in', 'Transfert entrant'),
                ('adjustment', 'Ajustement'), ('inventory', 'Inventaire'),
                ('loss', 'Perte'), ('breakage', 'Casse'),
                ('return_in', 'Retour client'), ('initial', 'Stock initial'),
                ('in', 'Entrée'), ('out', 'Sortie'),
            ], max_length=20),
        ),
        migrations.AddConstraint(
            model_name='warehouse',
            constraint=models.UniqueConstraint(
                fields=('store', 'name'), name='uniq_warehouse_name_per_store'),
        ),
        migrations.AddConstraint(
            model_name='warehouse',
            constraint=models.UniqueConstraint(
                fields=('store', 'code'), name='uniq_warehouse_code_per_store'),
        ),
        migrations.AddConstraint(
            model_name='warehouse',
            constraint=models.UniqueConstraint(
                condition=models.Q(is_default=True), fields=('store',),
                name='uniq_default_warehouse_per_store'),
        ),
        migrations.RunPython(create_default_warehouses, noop),
        migrations.RunPython(map_legacy_movement_types, noop),
    ]
