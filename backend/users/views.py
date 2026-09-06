from rest_framework import generics, status, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import User, Permission, Role, Membership
from .permissions import IsSuperAdmin, HasPermission
from .serializers import (
    RegisterSerializer,
    CustomTokenObtainPairSerializer,
    UserSerializer,
    PermissionSerializer,
    RoleSerializer,
    MembershipSerializer,
    EmployeeCreateSerializer,
    MembershipUpdateSerializer,
    SwitchCompanySerializer,
)


class AllPermissionsView(generics.ListAPIView):
    """
    Liste de toutes les permissions système disponibles, pour l'interface
    d'assignation de permissions aux rôles (roles.assign_permissions,
    _docs/08_SYSTEM_ PERMISSIONS_CENTRAL.txt). Accessible à tout utilisateur
    authentifié ayant roles.view.
    """
    serializer_class = PermissionSerializer
    permission_classes = (HasPermission,)
    permission_map = {'GET': 'roles.view'}
    queryset = Permission.objects.all().order_by('code')
    pagination_class = None


class RegisterView(generics.CreateAPIView):
    """
    Création d'une nouvelle franchise (Company + Owner). Réservé au
    SUPER_ADMIN plateforme — pas d'auto-inscription publique. Le
    SUPER_ADMIN est lui-même créé via `python manage.py createsuperuser`.
    """
    queryset = User.objects.all()
    permission_classes = (IsSuperAdmin,)
    serializer_class = RegisterSerializer


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = (IsAuthenticated,)
    
    def get_object(self):
        return self.request.user


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_permissions(request):
    """
    Récupérer le rôle et les permissions de l'utilisateur pour l'entreprise
    courante (request.company). Le nom du rôle permet au frontend de router
    vers le bon tableau de bord parmi les 5 rôles tenant standards
    (_docs/06_ROLES_ET_PERMISSIONS.txt) : Owner, Manager, Cashier,
    Stock Manager, Accountant.
    """
    if not request.user.is_active:
        return Response({'role': None, 'permissions': []})

    # SUPER_ADMIN : accès global sans compagnie ni membership.
    if request.user.is_superuser:
        permissions = Permission.objects.all()
        serializer = PermissionSerializer(permissions, many=True)
        return Response({
            'role': {'name': 'Super Admin', 'is_system': False},
            'permissions': serializer.data,
        })

    if not request.company or not request.company.is_active:
        return Response({'role': None, 'permissions': []})

    membership = request.user.memberships.filter(
        company=request.company, is_active=True
    ).first()
    if not membership:
        return Response({'role': None, 'permissions': []})

    permissions = membership.role.permissions.all()
    serializer = PermissionSerializer(permissions, many=True)
    return Response({
        'role': {
            'name': membership.role.name,
            'is_system': membership.role.is_system,
            'scope': membership.role.scope,
        },
        'store': {
            'uuid': str(membership.store.uuid),
            'name': membership.store.name,
        } if membership.store else None,
        'permissions': serializer.data,
    })


class SwitchCompanyView(APIView):
    """
    Ré-émet un JWT avec le claim `company_id` pointant vers une autre
    entreprise dont l'utilisateur est membre (vérifié côté serveur).
    """
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        serializer = SwitchCompanySerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        membership = serializer.membership

        refresh = RefreshToken.for_user(request.user)
        refresh['email'] = request.user.email
        refresh['uuid'] = str(request.user.uuid)
        refresh['company_id'] = membership.company_id
        refresh['company_uuid'] = str(membership.company.uuid)

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        })


class RoleViewSet(viewsets.ModelViewSet):
    """
    CRUD des rôles d'une entreprise, piloté par les permissions roles.*
    (_docs/08_SYSTEM_ PERMISSIONS_CENTRAL.txt). L'attribution des
    permissions à un rôle se fait via l'action `assign-permissions`,
    protégée par roles.assign_permissions.
    """
    serializer_class = RoleSerializer
    permission_classes = (HasPermission,)
    lookup_field = 'uuid'
    search_fields = ['name', 'description']
    pagination_class = None
    permission_map = {
        'list': 'roles.view',
        'retrieve': 'roles.view',
        'create': 'roles.create',
        'update': 'roles.update',
        'partial_update': 'roles.update',
        'destroy': 'roles.delete',
        'assign_permissions': 'roles.assign_permissions',
    }

    def get_queryset(self):
        queryset = Role.objects.filter(company=self.request.company)
        if getattr(self.request, 'store', None):
            queryset = queryset.filter(scope=Role.SCOPE_STORE)
        return queryset

    def perform_create(self, serializer):
        serializer.save(company=self.request.company)

    def perform_update(self, serializer):
        if serializer.instance.is_system:
            raise ValidationError("Les rôles système ne peuvent pas être modifiés.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.is_system:
            raise ValidationError("Les rôles système ne peuvent pas être supprimés.")
        instance.delete()

    @action(detail=True, methods=['post'], url_path='assign-permissions')
    def assign_permissions(self, request, uuid=None):
        role = self.get_object()
        if role.is_system:
            raise ValidationError("Les rôles système ne peuvent pas être modifiés.")

        codes = request.data.get('permission_codes', [])
        permissions = Permission.objects.filter(code__in=codes)
        role.permissions.set(permissions)
        return Response(RoleSerializer(role).data)


class EmployeeViewSet(viewsets.ModelViewSet):
    """
    Gestion des employés (Membership) d'une entreprise courante, pilotée
    par les permissions users.* (_docs/08_SYSTEM_ PERMISSIONS_CENTRAL.txt).
    La suppression désactive le membership plutôt que de le supprimer.
    """
    lookup_field = 'uuid'
    search_fields = ['user__email', 'user__first_name', 'user__last_name', 'role__name']
    permission_classes = (HasPermission,)
    permission_map = {
        'list': 'users.view',
        'retrieve': 'users.view',
        'create': 'users.create',
        'update': 'users.assign_roles',
        'partial_update': 'users.assign_roles',
        'destroy': 'users.delete',
    }

    def get_queryset(self):
        queryset = Membership.objects.filter(
            company=self.request.company, is_active=True
        ).select_related('user', 'role', 'store').order_by('user__email', 'id')
        if getattr(self.request, 'store', None):
            queryset = queryset.filter(store=self.request.store)
        return queryset

    def get_serializer_class(self):
        if self.action == 'create':
            return EmployeeCreateSerializer
        if self.action in ('update', 'partial_update'):
            return MembershipUpdateSerializer
        return MembershipSerializer

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])
