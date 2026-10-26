# Étape 3 du plan 15 : transferts avec statuts (R16-R48, R76-R83).

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('companies', '0001_initial'),
        ('products', '0007_stocklevel_warehouse'),
        ('inventory', '0006_warehouses'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Transfer',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('uuid', models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ('number', models.CharField(editable=False, max_length=30, unique=True)),
                ('transfer_type', models.CharField(
                    choices=[
                        ('intra_warehouse', 'Intra-entrepôt'),
                        ('inter_warehouse', 'Inter-entrepôts'),
                        ('inter_store', 'Inter-magasins'),
                    ], editable=False, max_length=20)),
                ('status', models.CharField(
                    choices=[
                        ('draft', 'Brouillon'), ('requested', 'Demandé'),
                        ('validated', 'Validé'), ('prepared', 'Préparé'),
                        ('shipped', 'Expédié'), ('in_transit', 'En transit'),
                        ('received', 'Reçu'), ('cancelled', 'Annulé'),
                        ('rejected', 'Rejeté'),
                    ], default='draft', max_length=20)),
                ('from_location', models.CharField(blank=True, max_length=100, null=True)),
                ('to_location', models.CharField(blank=True, max_length=100, null=True)),
                ('requested_at', models.DateTimeField(blank=True, null=True)),
                ('validated_at', models.DateTimeField(blank=True, null=True)),
                ('shipped_at', models.DateTimeField(blank=True, null=True)),
                ('received_at', models.DateTimeField(blank=True, null=True)),
                ('note', models.CharField(blank=True, default='', max_length=300)),
                ('reason', models.CharField(blank=True, default='', max_length=100)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('company', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='transfers', to='companies.company')),
                ('from_store', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='transfers_out', to='companies.store')),
                ('to_store', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='transfers_in', to='companies.store')),
                ('from_warehouse', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='transfers_out', to='inventory.warehouse')),
                ('to_warehouse', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='transfers_in', to='inventory.warehouse')),
                ('requested_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='transfers_requested', to=settings.AUTH_USER_MODEL)),
                ('validated_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='transfers_validated', to=settings.AUTH_USER_MODEL)),
                ('shipped_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='transfers_shipped', to=settings.AUTH_USER_MODEL)),
                ('received_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='transfers_received', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'transfers',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='TransferItem',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('variant', models.CharField(blank=True, max_length=100, null=True)),
                ('lot', models.CharField(blank=True, max_length=100, null=True)),
                ('quantity_requested', models.PositiveIntegerField()),
                ('quantity_shipped', models.PositiveIntegerField(default=0)),
                ('quantity_received', models.PositiveIntegerField(default=0)),
                ('product', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='transfer_items', to='products.product')),
                ('transfer', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='items', to='inventory.transfer')),
            ],
            options={
                'db_table': 'transfer_items',
            },
        ),
    ]
