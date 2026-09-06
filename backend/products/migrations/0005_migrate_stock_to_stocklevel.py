from django.db import migrations


def migrate_stock_to_stocklevel(apps, schema_editor):
    Product = apps.get_model('products', 'Product')
    StockLevel = apps.get_model('products', 'StockLevel')
    for product in Product.objects.all():
        if product.stock_quantity > 0 and product.store_id:
            StockLevel.objects.get_or_create(
                product=product,
                store_id=product.store_id,
                defaults={'quantity': product.stock_quantity},
            )


def reverse_migration(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0004_remove_product_stock_quantity_stocklevel'),
    ]

    operations = [
        migrations.RunPython(migrate_stock_to_stocklevel, reverse_migration),
        migrations.RemoveField(
            model_name='product',
            name='stock_quantity',
        ),
    ]
