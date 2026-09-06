from django.db import migrations, models


STORES_PERMISSIONS = [
    ('stores.view', 'Consulter les magasins'),
    ('stores.create', 'Créer des magasins'),
    ('stores.update', 'Modifier les magasins'),
    ('stores.delete', 'Supprimer des magasins'),
    ('stores.assign_users', 'Assigner des employés à un magasin'),
]


def seed_stores_permissions_and_scope(apps, schema_editor):
    from users.role_templates import ROLE_TEMPLATES

    Permission = apps.get_model('users', 'Permission')
    Role = apps.get_model('users', 'Role')

    for code, name in STORES_PERMISSIONS:
        Permission.objects.update_or_create(code=code, defaults={'name': name})

    # Renseigne le scope des rôles système existants à partir des templates,
    # et réattribue les permissions stores.* au Owner (accès complet).
    for role_name, config in ROLE_TEMPLATES.items():
        scope = config.get('scope', 'COMPANY')
        Role.objects.filter(name=role_name, is_system=True).update(scope=scope)

    owner_permissions = Permission.objects.filter(code__in=[c for c, _ in STORES_PERMISSIONS])
    for role in Role.objects.filter(name='Owner', is_system=True):
        role.permissions.add(*owner_permissions)


def reverse_seed(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    codes = [code for code, _ in STORES_PERMISSIONS]
    Permission.objects.filter(code__in=codes).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0007_central_permissions_catalog'),
    ]

    operations = [
        migrations.AddField(
            model_name='role',
            name='scope',
            field=models.CharField(
                choices=[
                    ('COMPANY', "Entreprise (tous les magasins)"),
                    ('STORE', "Magasin (un seul magasin)"),
                ],
                default='COMPANY',
                help_text=(
                    "COMPANY : accès à toute l'entreprise (tous les magasins). "
                    "STORE : accès restreint au magasin assigné au membership "
                    "(_docs/08_SYSTEM_ PERMISSIONS_CENTRAL.txt, section 2)."
                ),
                max_length=10,
            ),
        ),
        migrations.RunPython(seed_stores_permissions_and_scope, reverse_seed),
    ]
