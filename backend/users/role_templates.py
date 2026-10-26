"""
Rôles tenant standards, définis dans _docs/06_ROLES_ET_PERMISSIONS.txt
(section 3), avec les permissions du catalogue central
_docs/08_SYSTEM_ PERMISSIONS_CENTRAL.txt. Créés automatiquement pour
chaque nouvelle entreprise.
"""

# Toutes les permissions du catalogue central (utilisé par le rôle Owner,
# qui a un accès complet, cf. _docs/08_SYSTEM_ PERMISSIONS_CENTRAL.txt,
# section "Owner").
ALL_PERMISSIONS = [
    'company.view', 'company.update', 'company.manage_settings',
    'company.transfer_ownership', 'company.delete',
    'stores.view', 'stores.create', 'stores.update', 'stores.delete', 'stores.assign_users',
    'users.view', 'users.create', 'users.update', 'users.delete', 'users.assign_roles',
    'roles.view', 'roles.create', 'roles.update', 'roles.delete', 'roles.assign_permissions',
    'products.view', 'products.create', 'products.update', 'products.delete', 'products.change_price',
    'categories.view', 'categories.create', 'categories.update', 'categories.delete',
    'suppliers.view', 'suppliers.create', 'suppliers.update', 'suppliers.delete',
    'customers.view', 'customers.create', 'customers.update', 'customers.delete',
    'inventory.view', 'inventory.adjust', 'inventory.stock_entry', 'inventory.stock_transfer', 'inventory.view_history',
    'inventory.transfer_validate', 'inventory.transfer_ship', 'inventory.transfer_receive', 'inventory.transfer_cancel',
    'inventory.inventory_validate',
    'warehouses.view', 'warehouses.create', 'warehouses.update', 'warehouses.delete',
    'lots.view', 'lots.create', 'lots.update',
    'sales.view', 'sales.create', 'sales.cancel', 'sales.refund',
    'pos.access', 'pos.open_session', 'pos.close_session', 'pos.print_receipt', 'pos.reprint_receipt', 'pos.apply_discount',
    'reports.view', 'reports.sales', 'reports.inventory', 'reports.export',
    'settings.view', 'settings.update',
    'payments.view', 'payments.create', 'payments.refund',
    'files.view', 'files.upload', 'files.update', 'files.delete',
    'notifications.view', 'notifications.manage',
    'audit.view',
    'subscription.view', 'subscription.update', 'subscription.change_plan', 'subscription.cancel',
    'billing.view', 'billing.download_invoice', 'billing.manage_payment_method',
]

ROLE_TEMPLATES = {
    'Owner': {
        'description': "Propriétaire : accès complet à l'entreprise.",
        'scope': 'COMPANY',
        'permissions': ALL_PERMISSIONS,
    },
    'Company Admin': {
        'description': "Administrateur de confiance nommé par le Owner, gère l'entreprise sans en être propriétaire.",
        'scope': 'COMPANY',
        'permissions': [
            'company.view', 'company.update', 'company.manage_settings',
            'stores.view', 'stores.create', 'stores.update', 'stores.delete', 'stores.assign_users',
            'users.view', 'users.create', 'users.update', 'users.delete', 'users.assign_roles',
            'roles.view', 'roles.create', 'roles.update', 'roles.delete', 'roles.assign_permissions',
            'reports.view', 'reports.sales', 'reports.inventory', 'reports.export',
            'settings.view', 'settings.update',
        ],
    },
    'Manager': {
        'description': "Gérant : gestion opérationnelle d'un magasin unique.",
        'scope': 'STORE',
        'permissions': [
            'products.view', 'products.create', 'products.update', 'products.delete', 'products.change_price',
            'categories.view', 'categories.create', 'categories.update', 'categories.delete',
            'inventory.view', 'inventory.adjust', 'inventory.stock_entry', 'inventory.stock_transfer', 'inventory.view_history',
            'inventory.transfer_validate', 'inventory.transfer_ship', 'inventory.transfer_receive', 'inventory.transfer_cancel',
            'inventory.inventory_validate',
            'warehouses.view', 'warehouses.create', 'warehouses.update',
            'lots.view', 'lots.create', 'lots.update',
            'sales.view', 'sales.create', 'sales.cancel', 'sales.refund',
            'customers.view', 'customers.create', 'customers.update', 'customers.delete',
            'suppliers.view', 'suppliers.create', 'suppliers.update', 'suppliers.delete',
            'reports.view', 'reports.sales', 'reports.inventory',
        ],
    },
    'Cashier': {
        'description': "Caissier : ventes et encaissement d'un magasin unique.",
        'scope': 'STORE',
        'permissions': [
            'pos.access', 'pos.open_session', 'pos.close_session',
            'pos.print_receipt', 'pos.reprint_receipt',
            'sales.create',
            'products.view',
            'customers.view',
        ],
    },
    'Stock Manager': {
        'description': "Gestionnaire de stock : inventaire et fournisseurs d'un magasin unique.",
        'scope': 'STORE',
        'permissions': [
            'products.view', 'products.update',
            'inventory.view', 'inventory.adjust', 'inventory.stock_entry',
            'inventory.stock_transfer', 'inventory.view_history',
            'inventory.transfer_ship', 'inventory.transfer_receive', 'inventory.transfer_cancel',
            'inventory.inventory_validate',
            'warehouses.view', 'warehouses.create', 'warehouses.update',
            'lots.view', 'lots.create', 'lots.update',
            'suppliers.view', 'suppliers.create', 'suppliers.update',
        ],
    },
    'Accountant': {
        'description': 'Comptable : rapports financiers (entreprise ou magasin selon assignation).',
        'scope': 'COMPANY',
        'permissions': [
            'reports.view', 'reports.sales', 'reports.inventory', 'reports.export',
            'sales.view',
            'payments.view', 'payments.create', 'payments.refund',
        ],
    },
}


def create_default_roles(company):
    """Crée les rôles templates pour une entreprise et retourne {nom: Role}."""
    from .models import Permission, Role

    roles = {}
    for name, config in ROLE_TEMPLATES.items():
        role = Role.objects.create(
            company=company,
            name=name,
            description=config['description'],
            is_system=True,
            scope=config.get('scope', Role.SCOPE_COMPANY),
        )
        role.permissions.set(Permission.objects.filter(code__in=config['permissions']))
        roles[name] = role
    return roles
