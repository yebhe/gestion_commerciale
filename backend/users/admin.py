import json

from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import Membership, Permission, Role, User
from .role_templates import ROLE_TEMPLATES
from companies.models import Store


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ['email']
    list_display = ['email', 'first_name', 'last_name', 'is_active', 'is_staff', 'is_superuser', 'is_support_admin']
    list_filter = ['is_active', 'is_staff', 'is_superuser', 'is_support_admin']
    search_fields = ['email', 'first_name', 'last_name']
    readonly_fields = ['uuid', 'last_login', 'date_joined']
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Informations personnelles', {'fields': ('first_name', 'last_name', 'phone', 'avatar')}),
        ('Rôles plateforme', {'fields': ('is_active', 'is_staff', 'is_superuser', 'is_support_admin', 'groups', 'user_permissions')}),
        ('Dates', {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'first_name', 'last_name', 'password1', 'password2'),
        }),
    )


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ['code', 'name']
    search_fields = ['code', 'name']


class MembershipInline(admin.TabularInline):
    model = Membership
    extra = 0
    fields = ['user', 'store', 'is_default', 'is_active', 'joined_at']
    readonly_fields = ['joined_at']
    autocomplete_fields = ['user']

    def get_formset(self, request, obj=None, **kwargs):
        formset = super().get_formset(request, obj, **kwargs)
        if obj and obj.company_id:
            formset.form.base_fields['store'].queryset = Store.objects.filter(company_id=obj.company_id)
        else:
            formset.form.base_fields['store'].queryset = Store.objects.none()
        return formset


class RoleAdminForm(forms.ModelForm):
    system_template = forms.ChoiceField(
        choices=[('', '---------')] + [(name, name) for name in sorted(ROLE_TEMPLATES.keys())],
        required=False,
        label="Modèle de rôle système",
        help_text="Sélectionnez Owner, Manager, Cashier, Stock Manager ou Accountant pour remplir automatiquement le nom, la description et les permissions.",
    )

    class Meta:
        model = Role
        fields = ['company', 'system_template', 'name', 'description', 'is_system', 'scope', 'permissions']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['name'].required = False
        instance = kwargs.get('instance')
        if instance and instance.is_system and instance.name in ROLE_TEMPLATES:
            self.fields['system_template'].initial = instance.name

        permission_ids_by_code = {p.code: str(p.pk) for p in Permission.objects.all()}
        templates_data = {}
        for name, config in ROLE_TEMPLATES.items():
            templates_data[name] = {
                'description': config['description'],
                'scope': config.get('scope', 'COMPANY'),
                'permissions': [
                    permission_ids_by_code[c]
                    for c in config['permissions']
                    if c in permission_ids_by_code
                ],
            }
        self.fields['system_template'].widget.attrs['data-role-templates'] = json.dumps(templates_data)

    def clean(self):
        cleaned_data = super().clean()
        template = cleaned_data.get('system_template')
        company = cleaned_data.get('company')
        name = cleaned_data.get('name')

        if template:
            if name and name != template:
                self.add_error('name', f"Le nom doit correspondre au modèle sélectionné ({template}).")
            if company:
                existing = Role.objects.filter(company=company, name=template)
                if self.instance and self.instance.pk:
                    existing = existing.exclude(pk=self.instance.pk)
                if existing.exists():
                    self.add_error('system_template', f"Le rôle '{template}' existe déjà pour cette entreprise.")
            cleaned_data['name'] = template
            cleaned_data['description'] = ROLE_TEMPLATES[template]['description']
            cleaned_data['is_system'] = True
            cleaned_data['scope'] = ROLE_TEMPLATES[template].get('scope', 'COMPANY')
            cleaned_data['permissions'] = Permission.objects.filter(
                code__in=ROLE_TEMPLATES[template]['permissions']
            )
        else:
            if not name:
                self.add_error('name', "Le nom est obligatoire pour un rôle personnalisé.")
            if cleaned_data.get('is_system'):
                self.add_error(
                    'is_system',
                    "Un rôle système doit correspondre à un modèle prédéfini. Sélectionnez un modèle ou décochez ce champ.",
                )
            cleaned_data['is_system'] = False

        return cleaned_data


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    form = RoleAdminForm
    list_display = ['name', 'company', 'scope', 'is_system']
    list_filter = ['scope', 'is_system', 'company']
    search_fields = ['name', 'company__name']
    filter_horizontal = ['permissions']
    inlines = [MembershipInline]
    fieldsets = (
        (None, {
            'fields': ('company', 'system_template', 'name', 'description', 'is_system', 'scope', 'permissions'),
        }),
    )

    class Media:
        js = [
            'admin/js/SelectBox.js',
            'admin/js/SelectFilter2.js',
            'users/admin/role_template_autofill.js',
        ]

    def save_model(self, request, obj, form, change):
        template = form.cleaned_data.get('system_template')
        if template:
            obj.name = template
            obj.description = ROLE_TEMPLATES[template]['description']
            obj.is_system = True
            obj.scope = ROLE_TEMPLATES[template].get('scope', 'COMPANY')
        super().save_model(request, obj, form, change)

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        template = form.cleaned_data.get('system_template')
        if template:
            perms = Permission.objects.filter(code__in=ROLE_TEMPLATES[template]['permissions'])
            form.instance.permissions.set(perms)


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ['user', 'company', 'role', 'store', 'is_default', 'is_active', 'joined_at']
    list_filter = ['is_active', 'is_default', 'company']
    search_fields = ['user__email', 'company__name']
    readonly_fields = ['uuid', 'joined_at']
    autocomplete_fields = ['user']

    class Media:
        js = ['users/admin/membership_company_filter.js']

    def get_urls(self):
        from django.urls import path
        from django.http import JsonResponse
        from django.contrib.admin.views.decorators import staff_member_required

        urls = super().get_urls()
        custom_urls = [
            path(
                'filter-by-company/',
                self.admin_site.admin_view(self.filter_by_company),
                name='users_membership_filter_by_company',
            ),
        ]
        return custom_urls + urls

    def filter_by_company(self, request):
        from django.http import JsonResponse
        company_id = request.GET.get('company_id')
        roles = []
        stores = []
        if company_id:
            roles = [
                {'value': str(r.pk), 'label': str(r)}
                for r in Role.objects.filter(company_id=company_id)
            ]
            stores = [
                {'value': str(s.pk), 'label': str(s)}
                for s in Store.objects.filter(company_id=company_id)
            ]
        return JsonResponse({'roles': roles, 'stores': stores})

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        if obj and obj.company_id:
            company = obj.company_id
        else:
            # En ajout : l'entreprise vient du POST (validation) ou du GET.
            company = (
                request.POST.get('company')
                or request.GET.get('company')
                or None
            )
        if company:
            form.base_fields['role'].queryset = Role.objects.filter(company_id=company)
            form.base_fields['store'].queryset = Store.objects.filter(company_id=company)
        else:
            form.base_fields['role'].queryset = Role.objects.none()
            form.base_fields['store'].queryset = Store.objects.none()
        return form
