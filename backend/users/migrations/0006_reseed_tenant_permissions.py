from django.db import migrations


OLD_CODES = [
    'companies.manage', 'stores.manage', 'employees.manage', 'roles.manage',
    'permissions.manage', 'products.manage', 'categories.manage',
    'suppliers.manage', 'customers.manage', 'stock.manage', 'pos.use',
    'receipts.print', 'reports.view', 'notifications.manage',
    'subscriptions.manage',
]

# Permissions tenant définies dans _docs/06_ROLES_ET_PERMISSIONS.txt (section 3)
TENANT_PERMISSIONS = [
    ('can_manage_company', "Gérer l'entreprise", "Modifier les informations et paramètres de l'entreprise."),
    ('can_manage_stores', 'Gérer les magasins', 'Créer, modifier, supprimer les magasins.'),
    ('can_manage_users', 'Gérer les employés', "Gérer les comptes utilisateurs de l'entreprise."),
    ('can_manage_roles', 'Gérer les rôles', 'Créer et modifier les rôles et leurs permissions.'),
    ('can_manage_settings', 'Gérer les paramètres', "Gérer les paramètres de l'entreprise."),
    ('can_manage_subscription', "Gérer l'abonnement", "Gérer le plan et l'abonnement SaaS."),
    ('can_view_reports', 'Consulter les rapports', 'Consulter les rapports généraux.'),
    ('can_manage_products', 'Gérer les produits', 'Créer, modifier, supprimer les produits.'),
    ('can_manage_inventory', 'Gérer le stock', "Gérer les mouvements et l'inventaire du stock."),
    ('can_manage_sales', 'Gérer les ventes', 'Créer et gérer les ventes.'),
    ('can_manage_customers', 'Gérer les clients', 'Créer, modifier, supprimer les clients.'),
    ('can_manage_suppliers', 'Gérer les fournisseurs', 'Créer, modifier, supprimer les fournisseurs.'),
    ('can_create_sales', 'Effectuer des ventes', 'Créer des ventes à la caisse (POS).'),
    ('can_view_products', 'Consulter les produits', 'Consulter la liste des produits.'),
    ('can_view_customers', 'Consulter les clients', 'Consulter la liste des clients.'),
    ('can_create_customers', 'Créer des clients', 'Ajouter de nouveaux clients.'),
    ('can_print_receipts', 'Imprimer les reçus', 'Imprimer les reçus de vente.'),
    ('can_view_inventory_reports', "Consulter les rapports d'inventaire", "Consulter les rapports de stock/inventaire."),
    ('can_view_financial_reports', 'Consulter les rapports financiers', 'Consulter les rapports financiers.'),
    ('can_export_reports', 'Exporter les rapports', 'Exporter les rapports (CSV, PDF, etc.).'),
    ('can_view_sales', 'Consulter les ventes', 'Consulter la liste des ventes.'),
]


def create_tenant_permissions(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    Permission.objects.filter(code__in=OLD_CODES).delete()
    for code, name, description in TENANT_PERMISSIONS:
        Permission.objects.update_or_create(
            code=code, defaults={'name': name, 'description': description}
        )


def reverse_tenant_permissions(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    codes = [code for code, _, _ in TENANT_PERMISSIONS]
    Permission.objects.filter(code__in=codes).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0005_role_permissions_extended_fields'),
    ]

    operations = [
        migrations.RunPython(create_tenant_permissions, reverse_tenant_permissions),
    ]
