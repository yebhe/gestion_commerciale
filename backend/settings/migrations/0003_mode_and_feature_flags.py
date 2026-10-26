# Étape 16.1 du plan 15 : mode simple/avancé + feature flags par magasin.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('settings', '0002_storesettings'),
    ]

    operations = [
        migrations.AddField(
            model_name='companysettings',
            name='mode',
            field=models.CharField(
                choices=[('simple', 'Simple'), ('advanced', 'Avancé')],
                default='simple', max_length=20),
        ),
        migrations.AddField(
            model_name='storesettings',
            name='uses_locations',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='storesettings',
            name='uses_lots',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='storesettings',
            name='uses_variants',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='storesettings',
            name='uses_purchase_orders',
            field=models.BooleanField(default=False),
        ),
    ]
