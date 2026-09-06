# Generated manually

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('settings', '0001_initial'),
        ('companies', '0003_store'),
    ]

    operations = [
        migrations.CreateModel(
            name='StoreSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('background_color', models.CharField(blank=True, default='', help_text="Couleur de fond choisie pour ce magasin (format hex, ex: #3b82f6). Vide = hérite de l'entreprise.", max_length=7)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('store', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='settings', to='companies.store')),
            ],
            options={
                'verbose_name': 'Paramètres magasin',
                'verbose_name_plural': 'Paramètres magasins',
                'db_table': 'store_settings',
            },
        ),
    ]
