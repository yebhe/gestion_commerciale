# Étape 6.4 du plan 15 : permission de validation des sessions d'inventaire.

from django.db import migrations


PERMISSIONS = [
    ('inventory.inventory_validate', 'Valider une session d\'inventaire'),
]

ROLE_GRANTS = {
    'Owner': [code for code, _ in PERMISSIONS],
    'Manager': [code for code, _ in PERMISSIONS],
    'Stock Manager': [code for code, _ in PERMISSIONS],
}


def seed(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    Role = apps.get_model('users', 'Role')
    for code, name in PERMISSIONS:
        Permission.objects.get_or_create(code=code, defaults={'name': name})
    for role_name, codes in ROLE_GRANTS.items():
        perms = Permission.objects.filter(code__in=codes)
        for role in Role.objects.filter(name=role_name, is_system=True):
            role.permissions.add(*perms)


def unseed(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    Permission.objects.filter(
        code__in=[code for code, _ in PERMISSIONS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0012_lots_permissions'),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
