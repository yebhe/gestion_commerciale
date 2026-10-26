# Étape 1.2 du plan 15 : stock_levels.warehouse + UNIQUE(product, warehouse)

import django.db.models.deletion
from django.db import migrations, models


def attach_stock_levels_to_default_warehouse(apps, schema_editor):
    """Rattache chaque stock_level à l'entrepôt par défaut de son magasin."""
    Warehouse = apps.get_model('inventory', 'Warehouse')
    StockLevel = apps.get_model('products', 'StockLevel')

    defaults = {
        w.store_id: w.id
        for w in Warehouse.objects.filter(is_default=True)
    }
    for level in StockLevel.objects.filter(warehouse__isnull=True):
        warehouse_id = defaults.get(level.store_id)
        if warehouse_id:
            level.warehouse_id = warehouse_id
            level.save(update_fields=['warehouse'])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0006_warehouses'),
        ('products', '0006_category_deleted_at_category_is_deleted_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='stocklevel',
            name='warehouse',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='stock_levels', to='inventory.warehouse'),
        ),
        migrations.RunPython(attach_stock_levels_to_default_warehouse, noop),
        migrations.AlterUniqueTogether(
            name='stocklevel',
            unique_together={('product', 'warehouse')},
        ),
    ]
