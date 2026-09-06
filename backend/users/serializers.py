from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.password_validation import validate_password
from companies.models import Company, Store
from companies.serializers import StoreSerializer
from .models import User, Permission, Role, Membership
from .role_templates import create_default_roles


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ['id', 'code', 'name', 'description']


class RoleSerializer(serializers.ModelSerializer):
    permissions = PermissionSerializer(many=True, read_only=True)
    
    class Meta:
        model = Role
        fields = ['id', 'uuid', 'company_id', 'name', 'description', 'is_system', 'scope', 'permissions']


class UserBasicSerializer(serializers.ModelSerializer):
    """Représentation légère d'un User, sans les memberships (évite la récursion)."""

    class Meta:
        model = User
        fields = ['id', 'uuid', 'email', 'first_name', 'last_name', 'phone', 'avatar', 'is_active']


class MembershipSerializer(serializers.ModelSerializer):
    role = RoleSerializer(read_only=True)
    user = UserBasicSerializer(read_only=True)
    store = StoreSerializer(read_only=True)

    class Meta:
        model = Membership
        fields = [
            'id', 'uuid', 'user', 'company_id', 'role', 'store',
            'is_default', 'is_active', 'joined_at',
        ]


class EmployeeCreateSerializer(serializers.Serializer):
    """
    Création d'un employé (users.create, _docs/08_SYSTEM_ PERMISSIONS_CENTRAL.txt) :
    crée le User et son Membership dans l'entreprise courante en une seule
    opération.
    """
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    role = serializers.SlugRelatedField(slug_field='uuid', queryset=Role.objects.all())
    store = serializers.SlugRelatedField(
        slug_field='uuid', queryset=Store.objects.all(), required=False, allow_null=True
    )

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Un utilisateur avec cet email existe déjà.")
        return value

    def validate_role(self, role):
        request = self.context['request']
        if role.company_id != request.company.id:
            raise serializers.ValidationError("Ce rôle n'appartient pas à cette entreprise.")
        return role

    def validate_store(self, store):
        request = self.context['request']
        if store and store.company_id != request.company.id:
            raise serializers.ValidationError("Ce magasin n'appartient pas à cette entreprise.")
        return store

    def validate(self, data):
        role = data.get('role')
        store = data.get('store')
        if role and role.scope == Role.SCOPE_STORE and not store:
            raise serializers.ValidationError({
                'store': "Un magasin est requis pour ce rôle (scope magasin)."
            })
        return data

    @transaction.atomic
    def create(self, validated_data):
        request = self.context['request']
        role = validated_data.pop('role')
        store = validated_data.pop('store', None)
        password = validated_data.pop('password')

        user = User.objects.create_user(password=password, **validated_data)
        return Membership.objects.create(
            user=user, company=request.company, role=role, store=store,
        )

    def to_representation(self, instance):
        return MembershipSerializer(instance).data


class MembershipUpdateSerializer(serializers.ModelSerializer):
    """Modification du rôle/magasin/statut d'un employé (users.assign_roles)."""

    role = serializers.SlugRelatedField(slug_field='uuid', queryset=Role.objects.all())
    store = serializers.SlugRelatedField(
        slug_field='uuid', queryset=Store.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Membership
        fields = ['role', 'store', 'is_active']

    def validate_role(self, role):
        request = self.context['request']
        if role.company_id != request.company.id:
            raise serializers.ValidationError("Ce rôle n'appartient pas à cette entreprise.")
        return role

    def validate_store(self, store):
        request = self.context['request']
        if store and store.company_id != request.company.id:
            raise serializers.ValidationError("Ce magasin n'appartient pas à cette entreprise.")
        return store

    def validate(self, data):
        role = data.get('role', getattr(self.instance, 'role', None))
        store = data.get('store', getattr(self.instance, 'store', None))
        if role and role.scope == Role.SCOPE_STORE and not store:
            raise serializers.ValidationError({
                'store': "Un magasin est requis pour ce rôle (scope magasin)."
            })
        return data

    def to_representation(self, instance):
        return MembershipSerializer(instance).data


class UserSerializer(serializers.ModelSerializer):
    memberships = MembershipSerializer(many=True, read_only=True)
    
    class Meta:
        model = User
        fields = [
            'id', 'uuid', 'email', 'first_name', 'last_name', 'phone',
            'avatar', 'is_active', 'is_superuser', 'is_support_admin',
            'memberships',
        ]
        read_only_fields = ['id', 'uuid', 'is_superuser', 'is_support_admin']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, min_length=6)
    password_confirm = serializers.CharField(write_only=True, required=True)
    company_name = serializers.CharField(write_only=True, required=True, max_length=200)
    
    class Meta:
        model = User
        fields = ['email', 'password', 'password_confirm', 'first_name', 'last_name', 'phone', 'company_name']
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Les mots de passe ne correspondent pas."})
        
        # Validation basique du mot de passe
        if len(attrs['password']) < 6:
            raise serializers.ValidationError({"password": "Le mot de passe doit contenir au moins 6 caractères."})
        
        return attrs
    
    @transaction.atomic
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        company_name = validated_data.pop('company_name')

        user = User.objects.create_user(**validated_data)

        company = Company.objects.create(name=company_name)

        roles = create_default_roles(company)

        Membership.objects.create(
            user=user,
            company=company,
            role=roles['Owner'],
            is_default=True,
        )

        return user


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['email'] = user.email
        token['uuid'] = str(user.uuid)

        membership = (
            user.memberships
            .filter(is_active=True)
            .select_related('company')
            .order_by('-is_default', 'id')
            .first()
        )
        if membership:
            token['company_id'] = membership.company_id
            token['company_uuid'] = str(membership.company.uuid)

        return token
    
    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = UserSerializer(self.user).data
        return data


class SwitchCompanySerializer(serializers.Serializer):
    company_uuid = serializers.UUIDField()

    def validate_company_uuid(self, value):
        request = self.context['request']
        membership = (
            Membership.objects
            .filter(user=request.user, company__uuid=value, is_active=True)
            .select_related('company')
            .first()
        )
        if not membership:
            raise serializers.ValidationError(
                "Vous n'êtes pas membre de cette entreprise."
            )
        self.membership = membership
        return value
