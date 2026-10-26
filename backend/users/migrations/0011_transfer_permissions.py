# Étape 3.8 du plan 15 : permissions du workflow de transfert.

from django.db import migrations


TRANSFER_PERMISSIONS = [
    ('inventory.transfer_validate', 'Valider ou rejeter un transfert'),
    ('inventory.transfer_ship', 'Préparer et expédier un transfert'),
    ('inventory.transfer_receive', 'Recevoir un transfert'),
    ('inventory.transfer_cancel', 'Annuler un transfert'),
]

ROLE_GRANTS = {
    'Owner': [code for code, _ in TRANSFER_PERMISSIONS],
    'Company Admin': [code for code, _ in TRANSFER_PERMISSIONS],
    # Manager : tout ; Stock Manager : tout sauf validate (3.8).
    'Manager': [code for code, _ in TRANSFER_PERMISSIONS],
    'Stock Manager': [
        'inventory.transfer_ship', 'inventory.transfer_receive',
        'inventory.transfer_cancel',
    ],
}


def seed(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    Role = apps.get_model('users', 'Role')
    for code, name in TRANSFER_PERMISSIONS:
        Permission.objects.get_or_create(code=code, defaults={'name': name})
    for role_name, codes in ROLE_GRANTS.items():
        perms = Permission.objects.filter(code__in=codes)
        for role in Role.objects.filter(name=role_name, is_system=True):
            role.permissions.add(*perms)


def unseed(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    Permission.objects.filter(
        code__in=[code for code, _ in TRANSFER_PERMISSIONS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0010_warehouses_permissions'),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
