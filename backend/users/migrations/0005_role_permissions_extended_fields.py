import uuid

import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('companies', '0003_store'),
        ('users', '0004_seed_permissions'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='avatar',
            field=models.ImageField(blank=True, null=True, upload_to='users/avatars/'),
        ),
        migrations.AddField(
            model_name='user',
            name='is_support_admin',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='permission',
            name='description',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='role',
            name='uuid',
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AddField(
            model_name='role',
            name='is_system',
            field=models.BooleanField(
                default=False,
                help_text='Rôle template créé automatiquement (Owner, Manager, Cashier...).',
            ),
        ),
        migrations.AddField(
            model_name='membership',
            name='uuid',
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AddField(
            model_name='membership',
            name='is_default',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='membership',
            name='is_active',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='membership',
            name='joined_at',
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='membership',
            name='store',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='memberships',
                to='companies.store',
            ),
        ),
    ]
