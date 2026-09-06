from django.db import models


class CompanySettings(models.Model):
    company = models.OneToOneField(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name='settings',
    )
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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'store_settings'
        verbose_name = 'Paramètres magasin'
        verbose_name_plural = 'Paramètres magasins'

    def __str__(self):
        return f"Paramètres de {self.store.name}"
