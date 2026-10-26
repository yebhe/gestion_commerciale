# Traçabilité des mouvements de stock (_docs/14, R73-R74 ; _docs/15, étape 0)

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('inventory', '0004_protect_movement_product'),
    ]

    operations = [
        migrations.AddField(
            model_name='inventorymovement',
            name='stock_before',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='inventorymovement',
            name='stock_after',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='inventorymovement',
            name='created_by',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='inventory_movements',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='inventorymovement',
            name='reason',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='inventorymovement',
            name='source_type',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
        migrations.AddField(
            model_name='inventorymovement',
            name='source_uuid',
            field=models.UUIDField(blank=True, null=True),
        ),
    ]
