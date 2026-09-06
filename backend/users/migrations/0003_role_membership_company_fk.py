from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('companies', '0001_initial'),
        ('users', '0002_alter_user_managers_remove_user_username'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='role',
            unique_together=set(),
        ),
        migrations.AlterUniqueTogether(
            name='membership',
            unique_together=set(),
        ),
        migrations.RemoveField(
            model_name='role',
            name='company_id',
        ),
        migrations.RemoveField(
            model_name='membership',
            name='company_id',
        ),
        migrations.AddField(
            model_name='role',
            name='company',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='roles',
                to='companies.company',
                default=None,
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='membership',
            name='company',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='memberships',
                to='companies.company',
                default=None,
            ),
            preserve_default=False,
        ),
        migrations.AlterUniqueTogether(
            name='role',
            unique_together={('company', 'name')},
        ),
        migrations.AlterUniqueTogether(
            name='membership',
            unique_together={('user', 'company')},
        ),
    ]
