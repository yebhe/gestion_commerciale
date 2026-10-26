from django.db import models


class CompanySettings(models.Model):
    MODE_CHOICES = [
        ('simple', 'Simple'),
        ('advanced', 'Avancé'),
    ]

    company = models.OneToOneField(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name='settings',
    )
    # Mode simple : un entrepôt par magasin, pas d'emplacements,
    # transferts immédiats, pas de variantes/lots, achats = réception
    # directe (_docs/15, étape 16.1).
    mode = models.CharField(max_length=20, choices=MODE_CHOICES, default='simple')
    background_color = models.CharField(
        max_length=7,
        default='#f9fafb',
        help_text="Couleur de fond choisie par l'utilisateur (format hex, ex: #3b82f6).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'company_settings'
        verbose_name = 'Paramètres entreprise'
        verbose_name_plural = 'Paramètres entreprises'

    def __str__(self):
        return f"Paramètres de {self.company.name}"


class StoreSettings(models.Model):
    store = models.OneToOneField(
        'companies.Store',
        on_delete=models.CASCADE,
        related_name='settings',
    )
    background_color = models.CharField(
        max_length=7,
        blank=True,
        default='',
        help_text="Couleur de fond choisie pour ce magasin (format hex, ex: #3b82f6). Vide = hérite de l'entreprise.",
    )
    # Feature flags par magasin (_docs/15, étape 16.1) : activables
    # individuellement même en mode simple.
    uses_locations = models.BooleanField(default=False)
    uses_lots = models.BooleanField(default=False)
    uses_variants = models.BooleanField(default=False)
    uses_purchase_orders = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'store_settings'
        verbose_name = 'Paramètres magasin'
        verbose_name_plural = 'Paramètres magasins'

    def __str__(self):
        return f"Paramètres de {self.store.name}"
