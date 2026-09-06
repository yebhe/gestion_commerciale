from rest_framework import permissions


class HasPermission(permissions.BasePermission):
    """
    Permission custom pour vérifier si l'utilisateur a un code de permission
    spécifique, dans le contexte de l'entreprise courante (request.company).

    Chaîne de vérification (_docs/06_ROLES_ET_PERMISSIONS.txt, section 7 ;
    _docs/08_SYSTEM_ PERMISSIONS_CENTRAL.txt) :
    1. utilisateur actif
    2. entreprise active
    3. rôle/membership actif
    4. permissions nécessaires

    Le code de permission requis peut être défini sur la vue de trois façons :
    - `required_permission` : un code unique pour toute la vue (APIView) ;
    - `permission_map` : un dict {action_drf: code} pour un ViewSet, où
      `action_drf` est l'action DRF courante (list, retrieve, create,
      update, partial_update, destroy, ou un nom d'action custom) ;
    - `permission_map` peut aussi utiliser des méthodes HTTP (GET, POST,
      PUT, PATCH, DELETE) comme clés, pour les vues génériques (APIView /
      generics) qui n'ont pas d'attribut `action`.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if not request.user.is_active:
            return False

        # SUPER_ADMIN : accès global sans appartenance à une compagnie.
        if getattr(request.user, 'is_superuser', False):
            return True

        if not request.company or not request.company.is_active:
            return False

        membership = request.user.memberships.filter(
            company=request.company, is_active=True
        ).first()
        if not membership:
            return False
        request.membership = membership

        # Isolation à deux niveaux (_docs/08_SYSTEM_ PERMISSIONS_CENTRAL.txt,
        # section 2) : un rôle STORE n'a accès qu'à son magasin assigné, un
        # rôle COMPANY a accès à tous les magasins de l'entreprise.
        request.scope = membership.role.scope
        if membership.role.scope == membership.role.SCOPE_STORE:
            if not membership.store:
                return False
            request.store = membership.store
        else:
            request.store = None

        required_permission = self._resolve_required_permission(request, view)
        if not required_permission:
            return True  # Si aucune permission n'est requise, on autorise

        if isinstance(required_permission, (list, tuple)):
            return membership.role.permissions.filter(code__in=required_permission).exists()
        return membership.role.permissions.filter(code=required_permission).exists()

    def _resolve_required_permission(self, request, view):
        permission_map = getattr(view, 'permission_map', None)
        if permission_map is not None:
            action = getattr(view, 'action', None)
            if action and action in permission_map:
                return permission_map[action]
            return permission_map.get(request.method)

        return getattr(view, 'required_permission', None)


class IsCompanyMember(permissions.BasePermission):
    """
    Vérifie que l'utilisateur est membre actif de l'entreprise courante
    (request.company), avec utilisateur et entreprise actifs.
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if not request.user.is_active:
            return False

        # SUPER_ADMIN : accès global sans appartenance à une compagnie.
        if getattr(request.user, 'is_superuser', False):
            return True

        if not request.company or not request.company.is_active:
            return False

        return request.user.memberships.filter(
            company=request.company, is_active=True
        ).exists()


class IsSuperAdmin(permissions.BasePermission):
    """
    Rôle plateforme SUPER_ADMIN (_docs/06_ROLES_ET_PERMISSIONS.txt, section 2).
    Codé en dur, comme explicitement autorisé par la documentation.
    """

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_active
            and request.user.is_superuser
        )


class IsSupportAdmin(permissions.BasePermission):
    """
    Rôle plateforme SUPPORT_ADMIN (_docs/06_ROLES_ET_PERMISSIONS.txt, section 2).
    Le SUPER_ADMIN hérite implicitement des accès SUPPORT_ADMIN.
    """

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_active
            and (request.user.is_superuser or request.user.is_support_admin)
        )
