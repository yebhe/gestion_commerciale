from django.db import migrations


NEW_PERMISSIONS = [
    ('files.update', 'Modifier les métadonnées d\'un fichier'),
    ('company.transfer_ownership', 'Transférer la propriété de l\'entreprise'),
    ('company.delete', 'Supprimer l\'entreprise'),
    ('subscription.view', 'Consulter l\'abonnement SaaS'),
    ('subscription.update', 'Modifier l\'abonnement SaaS'),
    ('subscription.change_plan', 'Changer de plan d\'abonnement'),
    ('subscription.cancel', 'Annuler l\'abonnement SaaS'),
    ('billing.view', 'Consulter la facturation SaaS'),
    ('billing.download_invoice', 'Télécharger une facture SaaS'),
    ('billing.manage_payment_method', 'Gérer les moyens de paiement SaaS'),
]


def seed_new_permissions(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    Role = apps.get_model('users', 'Role')

    for code, name in NEW_PERMISSIONS:
        Permission.objects.update_or_create(code=code, defaults={'name': name})

    # Ajouter les nouvelles permissions au Owner (accès complet)
    new_codes = [code for code, _ in NEW_PERMISSIONS]
    new_perms = Permission.objects.filter(code__in=new_codes)
    for role in Role.objects.filter(name='Owner', is_system=True):
        role.permissions.add(*new_perms)


def reverse_seed(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    codes = [code for code, _ in NEW_PERMISSIONS]
    Permission.objects.filter(code__in=codes).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0008_role_scope_and_stores_permissions'),
    ]

    operations = [
        migrations.RunPython(seed_new_permissions, reverse_seed),
    ]
