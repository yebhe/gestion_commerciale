from django.db import migrations


DEFAULT_PERMISSIONS = [
    ('companies.manage', "Gérer l'entreprise"),
    ('stores.manage', 'Gérer les magasins'),
    ('employees.manage', 'Gérer les employés'),
    ('roles.manage', 'Gérer les rôles'),
    ('permissions.manage', 'Gérer les permissions'),
    ('products.manage', 'Gérer les produits'),
    ('categories.manage', 'Gérer les catégories'),
    ('suppliers.manage', 'Gérer les fournisseurs'),
    ('customers.manage', 'Gérer les clients'),
    ('stock.manage', 'Gérer le stock'),
    ('pos.use', 'Utiliser la caisse POS'),
    ('receipts.print', 'Imprimer les reçus'),
    ('reports.view', 'Consulter les rapports'),
    ('notifications.manage', 'Gérer les notifications'),
    ('subscriptions.manage', "Gérer l'abonnement"),
]


def create_permissions(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    for code, name in DEFAULT_PERMISSIONS:
        Permission.objects.get_or_create(code=code, defaults={'name': name})


def delete_permissions(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    codes = [code for code, _ in DEFAULT_PERMISSIONS]
    Permission.objects.filter(code__in=codes).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_role_membership_company_fk'),
    ]

    operations = [
        migrations.RunPython(create_permissions, delete_permissions),
    ]
