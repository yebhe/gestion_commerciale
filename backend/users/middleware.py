from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


class TenantMiddleware:
    """
    Résout request.company à partir du claim `company_id` du JWT.

    Le company_id n'est JAMAIS accepté depuis le corps de la requête ou un
    header custom (RÈGLE 3) : il provient uniquement du token JWT signé,
    et est revalidé contre les Membership de l'utilisateur authentifié.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.jwt_authenticator = JWTAuthentication()

    def __call__(self, request):
        request.company = None

        try:
            auth_result = self.jwt_authenticator.authenticate(request)
        except (InvalidToken, TokenError):
            auth_result = None

        if auth_result is not None:
            user, validated_token = auth_result
            company_id = validated_token.get('company_id')

            if company_id and user.is_active:
                membership = (
                    user.memberships
                    .filter(company_id=company_id, is_active=True)
                    .select_related('company')
                    .first()
                )
                if membership and membership.company.is_active:
                    request.company = membership.company

        return self.get_response(request)
