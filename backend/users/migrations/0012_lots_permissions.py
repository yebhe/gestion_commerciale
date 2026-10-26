# Étape 4.4 du plan 15 : permissions de gestion des lots.

from django.db import migrations


LOT_PERMISSIONS = [
    ('lots.view', 'Voir les lots'),
    ('lots.create', 'Créer un lot'),
    ('lots.update', 'Modifier ou supprimer un lot'),
]

ROLE_GRANTS = {
    'Owner': [code for code, _ in LOT_PERMISSIONS],
    'Company Admin': [code for code, _ in LOT_PERMISSIONS],
    'Manager': [code for code, _ in LOT_PERMISSIONS],
    'Stock Manager': [code for code, _ in LOT_PERMISSIONS],
}


def seed(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    Role = apps.get_model('users', 'Role')
    for code, name in LOT_PERMISSIONS:
        Permission.objects.get_or_create(code=code, defaults={'name': name})
    for role_name, codes in ROLE_GRANTS.items():
        perms = Permission.objects.filter(code__in=codes)
        for role in Role.objects.filter(name=role_name, is_system=True):
            role.permissions.add(*perms)


def unseed(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    Permission.objects.filter(
        code__in=[code for code, _ in LOT_PERMISSIONS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0011_transfer_permissions'),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
