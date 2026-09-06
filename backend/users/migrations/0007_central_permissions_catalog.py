from django.db import migrations


OLD_TENANT_CODES = [
    'can_manage_company', 'can_manage_stores', 'can_manage_users',
    'can_manage_roles', 'can_manage_settings', 'can_manage_subscription',
    'can_view_reports', 'can_manage_products', 'can_manage_inventory',
    'can_manage_sales', 'can_manage_customers', 'can_manage_suppliers',
    'can_create_sales', 'can_view_products', 'can_view_customers',
    'can_create_customers', 'can_print_receipts', 'can_view_inventory_reports',
    'can_view_financial_reports', 'can_export_reports', 'can_view_sales',
]

# Catalogue central des permissions, _docs/08_SYSTEM_ PERMISSIONS_CENTRAL.txt.
# Toute l'application (menus, widgets, boutons, routes, API) est pilotée par
# ces permissions. Les rôles ne sont que des groupes de permissions.
CENTRAL_PERMISSIONS = [
    ('company.view', "Consulter l'entreprise"),
    ('company.update', "Modifier l'entreprise"),
    ('company.manage_settings', "Gérer les paramètres de l'entreprise"),

    ('users.view', 'Consulter les employés'),
    ('users.create', 'Créer des employés'),
    ('users.update', 'Modifier les employés'),
    ('users.delete', 'Supprimer des employés'),
    ('users.assign_roles', 'Attribuer des rôles aux employés'),

    ('roles.view', 'Consulter les rôles'),
    ('roles.create', 'Créer des rôles'),
    ('roles.update', 'Modifier les rôles'),
    ('roles.delete', 'Supprimer des rôles'),
    ('roles.assign_permissions', 'Attribuer des permissions aux rôles'),

    ('products.view', 'Consulter les produits'),
    ('products.create', 'Créer des produits'),
    ('products.update', 'Modifier les produits'),
    ('products.delete', 'Supprimer des produits'),
    ('products.change_price', 'Modifier le prix des produits'),

    ('categories.view', 'Consulter les catégories'),
    ('categories.create', 'Créer des catégories'),
    ('categories.update', 'Modifier des catégories'),
    ('categories.delete', 'Supprimer des catégories'),

    ('suppliers.view', 'Consulter les fournisseurs'),
    ('suppliers.create', 'Créer des fournisseurs'),
    ('suppliers.update', 'Modifier les fournisseurs'),
    ('suppliers.delete', 'Supprimer des fournisseurs'),

    ('customers.view', 'Consulter les clients'),
    ('customers.create', 'Créer des clients'),
    ('customers.update', 'Modifier les clients'),
    ('customers.delete', 'Supprimer des clients'),

    ('inventory.view', 'Consulter le stock'),
    ('inventory.adjust', 'Ajuster le stock'),
    ('inventory.stock_entry', 'Enregistrer une entrée de stock'),
    ('inventory.stock_transfer', 'Transférer du stock entre magasins'),
    ('inventory.view_history', "Consulter l'historique du stock"),

    ('sales.view', 'Consulter les ventes'),
    ('sales.create', 'Créer des ventes'),
    ('sales.cancel', 'Annuler des ventes'),
    ('sales.refund', 'Rembourser des ventes'),

    ('pos.access', 'Accéder à la caisse (POS)'),
    ('pos.open_session', 'Ouvrir une session de caisse'),
    ('pos.close_session', 'Fermer une session de caisse'),
    ('pos.print_receipt', 'Imprimer un reçu'),
    ('pos.reprint_receipt', 'Réimprimer un reçu'),
    ('pos.apply_discount', 'Appliquer une remise en caisse'),

    ('reports.view', 'Consulter les rapports'),
    ('reports.sales', 'Consulter les rapports de ventes'),
    ('reports.inventory', 'Consulter les rapports de stock'),
    ('reports.export', 'Exporter les rapports'),

    ('settings.view', 'Consulter les paramètres'),
    ('settings.update', 'Modifier les paramètres'),

    ('payments.view', 'Consulter les paiements'),
    ('payments.create', 'Créer des paiements'),
    ('payments.refund', 'Rembourser des paiements'),

    ('files.view', 'Consulter les fichiers'),
    ('files.upload', 'Téléverser des fichiers'),
    ('files.delete', 'Supprimer des fichiers'),

    ('notifications.view', 'Consulter les notifications'),
    ('notifications.manage', 'Gérer les notifications'),

    ('audit.view', "Consulter le journal d'audit"),
]


def create_central_permissions(apps, schema_editor):
    from users.role_templates import ROLE_TEMPLATES

    Permission = apps.get_model('users', 'Permission')
    Role = apps.get_model('users', 'Role')

    Permission.objects.filter(code__in=OLD_TENANT_CODES).delete()
    for code, name in CENTRAL_PERMISSIONS:
        Permission.objects.update_or_create(code=code, defaults={'name': name})

    # Ré-attribue les nouvelles permissions aux rôles système existants
    # (entreprises déjà créées) pour qu'elles ne perdent pas leurs accès.
    for role_name, config in ROLE_TEMPLATES.items():
        codes = config['permissions']
        permissions = Permission.objects.filter(code__in=codes)
        for role in Role.objects.filter(name=role_name, is_system=True):
            role.permissions.set(permissions)


def reverse_central_permissions(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    codes = [code for code, _ in CENTRAL_PERMISSIONS]
    Permission.objects.filter(code__in=codes).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0006_reseed_tenant_permissions'),
    ]

    operations = [
        migrations.RunPython(create_central_permissions, reverse_central_permissions),
    ]
