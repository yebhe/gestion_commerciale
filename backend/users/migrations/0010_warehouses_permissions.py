# Étape 1.7 du plan 15 : permissions warehouses.* ajoutées au catalogue
# central et attribuées aux rôles système existants.

from django.db import migrations


WAREHOUSE_PERMISSIONS = [
    ('warehouses.view', 'Consulter les entrepôts'),
    ('warehouses.create', 'Créer des entrepôts'),
    ('warehouses.update', 'Modifier les entrepôts'),
    ('warehouses.delete', 'Supprimer des entrepôts'),
]

# Rôles système recevant chaque permission (plan 1.7) :
# Owner / Company Admin : tout ; Manager / Stock Manager : view/create/update.
ROLE_GRANTS = {
    'Owner': [code for code, _ in WAREHOUSE_PERMISSIONS],
    'Company Admin': [code for code, _ in WAREHOUSE_PERMISSIONS],
    'Manager': ['warehouses.view', 'warehouses.create', 'warehouses.update'],
    'Stock Manager': ['warehouses.view', 'warehouses.create', 'warehouses.update'],
}


def seed_warehouse_permissions(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    Role = apps.get_model('users', 'Role')

    for code, name in WAREHOUSE_PERMISSIONS:
        Permission.objects.update_or_create(code=code, defaults={'name': name})

    for role_name, codes in ROLE_GRANTS.items():
        permissions = Permission.objects.filter(code__in=codes)
        for role in Role.objects.filter(name=role_name, is_system=True):
            role.permissions.add(*permissions)


def remove_warehouse_permissions(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    Permission.objects.filter(
        code__in=[code for code, _ in WAREHOUSE_PERMISSIONS],
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0009_new_permissions_uuid_isolation'),
    ]

    operations = [
        migrations.RunPython(seed_warehouse_permissions, remove_warehouse_permissions),
    ]
