from rest_framework import viewsets

from users.permissions import HasPermission
from .models import CompanyFile
from .serializers import CompanyFileSerializer


class CompanyFileViewSet(viewsets.ModelViewSet):
    """CRUD fichiers, piloté par les permissions files.* (_docs/08)."""
    serializer_class = CompanyFileSerializer
    permission_classes = (HasPermission,)
    lookup_field = 'uuid'
    search_fields = ['path', 'mime_type']
    permission_map = {
        'list': 'files.view',
        'retrieve': 'files.view',
        'create': 'files.upload',
        'update': 'files.update',
        'partial_update': 'files.update',
        'destroy': 'files.delete',
    }

    def get_queryset(self):
        queryset = CompanyFile.objects.filter(company=self.request.company)
        if getattr(self.request, 'store', None):
            queryset = queryset.filter(store=self.request.store)
        store_uuid = self.request.query_params.get('store')
        if store_uuid:
            queryset = queryset.filter(store__uuid=store_uuid)
        return queryset

    def perform_create(self, serializer):
        uploaded_file = serializer.validated_data.get('path')
        extra = {
            'company': self.request.company,
            'mime_type': getattr(uploaded_file, 'content_type', ''),
            'size': getattr(uploaded_file, 'size', 0),
        }
        if getattr(self.request, 'store', None):
            extra['store'] = self.request.store
        serializer.save(**extra)

    def perform_update(self, serializer):
        if getattr(self.request, 'store', None):
            serializer.save(store=self.request.store)
        else:
            serializer.save()
