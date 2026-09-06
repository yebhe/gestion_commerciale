from django.test import TestCase

from companies.models import Company
from users.models import Permission, Role


class RoleAdminFormTests(TestCase):
    """Régression : le formulaire admin des rôles doit permettre de choisir
    un modèle système (Owner, Manager, Cashier...) sans saisir manuellement
    le nom, tout en restant cohérent pour les rôles personnalisés.
    """

    def setUp(self):
        self.company = Company.objects.create(name='Test Company')
        # Crée quelques permissions requises par les templates.
        Permission.objects.get_or_create(
            code='pos.access', defaults={'name': 'Accéder à la caisse'}
        )
        Permission.objects.get_or_create(
            code='sales.create', defaults={'name': 'Créer des ventes'}
        )
        Permission.objects.get_or_create(
            code='products.view', defaults={'name': 'Consulter les produits'}
        )
        Permission.objects.get_or_create(
            code='company.view', defaults={'name': "Consulter l'entreprise"}
        )

    def test_create_system_role_from_template_without_name(self):
        from users.admin import RoleAdminForm

        form = RoleAdminForm(
            data={
                'company': self.company.pk,
                'system_template': 'Cashier',
                'name': '',
                'description': '',
                'is_system': 'on',
                'permissions': [],
            },
            files=None,
        )
        self.assertTrue(form.is_valid(), form.errors)
        role = form.save()
        self.assertEqual(role.name, 'Cashier')
        self.assertTrue(role.is_system)

    def test_custom_role_requires_name(self):
        from users.admin import RoleAdminForm

        form = RoleAdminForm(
            data={
                'company': self.company.pk,
                'system_template': '',
                'name': '',
                'description': '',
                'is_system': '',
                'permissions': [],
            },
            files=None,
        )
        self.assertFalse(form.is_valid())
        self.assertIn('name', form.errors)

    def test_system_role_requires_template(self):
        from users.admin import RoleAdminForm

        form = RoleAdminForm(
            data={
                'company': self.company.pk,
                'system_template': '',
                'name': 'Custom System',
                'description': '',
                'is_system': 'on',
                'permissions': [],
            },
            files=None,
        )
        self.assertFalse(form.is_valid())
        self.assertIn('is_system', form.errors)

    def test_duplicate_system_role_for_company(self):
        from users.admin import RoleAdminForm

        Role.objects.create(company=self.company, name='Cashier', is_system=True)

        form = RoleAdminForm(
            data={
                'company': self.company.pk,
                'system_template': 'Cashier',
                'name': '',
                'description': '',
                'is_system': 'on',
                'permissions': [],
            },
            files=None,
        )
        self.assertFalse(form.is_valid())
        self.assertIn('system_template', form.errors)
