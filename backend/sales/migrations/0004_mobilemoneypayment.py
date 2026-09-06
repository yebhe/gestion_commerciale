import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '0003_protect_saleitem_product'),
    ]

    operations = [
        migrations.CreateModel(
            name='MobileMoneyPayment',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('uuid', models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ('operation_id', models.CharField(max_length=100, unique=True)),
                ('payment_url', models.URLField(blank=True, max_length=500, null=True)),
                ('status', models.CharField(choices=[('pending', 'En attente'), ('success', 'Réussi'), ('failed', 'Échoué'), ('canceled', 'Annulé'), ('expired', 'Expiré'), ('error', 'Erreur')], default='pending', max_length=20)),
                ('raw_response', models.JSONField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('sale', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='mobile_money_payment', to='sales.sale')),
            ],
            options={
                'db_table': 'mobile_money_payments',
                'ordering': ['-created_at'],
            },
        ),
    ]
