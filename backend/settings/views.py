from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.permissions import HasPermission

from .models import CompanySettings, StoreSettings
from .serializers import CompanySettingsSerializer, StoreSettingsSerializer


class CompanySettingsView(generics.RetrieveUpdateAPIView):
    """
    Récupère ou met à jour les paramètres (apparence) de l'entreprise courante.
    GET retourne le thème effectif selon le fallback :
    magasin > entreprise > global.
    """
    serializer_class = CompanySettingsSerializer
    permission_classes = (IsAuthenticated, HasPermission)
    permission_map = {
        'GET': None,
        'PUT': 'settings.update',
        'PATCH': 'settings.update',
    }

    def get_object(self):
        company = getattr(self.request, 'company', None)
        if not company:
            raise generics.PermissionDenied("Aucune entreprise sélectionnée.")
        settings, _ = CompanySettings.objects.get_or_create(company=company)
        return settings

    def _resolve_theme(self, request, company):
        """Hiérarchie : store > company > global."""
        global_color = '#12151a'
        store_uuid = request.query_params.get('store') or request.query_params.get('store_uuid')

        # 1. Store
        if store_uuid:
            from companies.models import Store
            try:
                store = Store.objects.select_related('settings').get(uuid=store_uuid, company=company)
                if store.settings.background_color:
                    return {
                        'background_color': store.settings.background_color,
                        'scope': 'store',
                        'store_uuid': store.uuid,
                        'company_uuid': company.uuid,
                    }
            except (Store.DoesNotExist, StoreSettings.DoesNotExist):
                pass

        # 2. Company
        company_settings, _ = CompanySettings.objects.get_or_create(company=company)
        if company_settings.background_color:
            return {
                'background_color': company_settings.background_color,
                'scope': 'company',
                'store_uuid': None,
                'company_uuid': company.uuid,
            }

        # 3. Global
        return {
            'background_color': global_color,
            'scope': 'global',
            'store_uuid': None,
            'company_uuid': None,
        }

    def get(self, request, *args, **kwargs):
        company = getattr(request, 'company', None)
        if not company:
            raise generics.PermissionDenied("Aucune entreprise sélectionnée.")
        theme = self._resolve_theme(request, company)
        return Response(theme)
