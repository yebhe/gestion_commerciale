from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
import uuid

from companies.models import Company, Store


class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('L\'email est obligatoire')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    id = models.BigAutoField(primary_key=True)
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    avatar = models.ImageField(upload_to='users/avatars/', blank=True, null=True)
    username = None  # Désactiver username

    # Rôles plateforme (SUPER_ADMIN = is_superuser natif Django).
    # Exception documentée (_docs/06_ROLES_ET_PERMISSIONS.txt) : ces rôles
    # plateforme peuvent être codés en dur, contrairement aux rôles tenant.
    is_support_admin = models.BooleanField(default=False)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']
    
    objects = CustomUserManager()
    
    class Meta:
        db_table = 'users'
    
    def __str__(self):
        return f"{self.email}"


class Permission(models.Model):
    id = models.BigAutoField(primary_key=True)
    code = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    
    class Meta:
        db_table = 'permissions'
    
    def __str__(self):
        return f"{self.code}"


class Role(models.Model):
    SCOPE_COMPANY = 'COMPANY'
    SCOPE_STORE = 'STORE'
    SCOPE_CHOICES = [
        (SCOPE_COMPANY, "Entreprise (tous les magasins)"),
        (SCOPE_STORE, "Magasin (un seul magasin)"),
    ]

    id = models.BigAutoField(primary_key=True)
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='roles')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    is_system = models.BooleanField(
        default=False,
        help_text="Rôle template créé automatiquement (Owner, Manager, Cashier...).",
    )
    scope = models.CharField(
        max_length=10,
        choices=SCOPE_CHOICES,
        default=SCOPE_COMPANY,
        help_text=(
            "COMPANY : accès à toute l'entreprise (tous les magasins). "
            "STORE : accès restreint au magasin assigné au membership "
            "(_docs/08_SYSTEM_ PERMISSIONS_CENTRAL.txt, section 2)."
        ),
    )
    permissions = models.ManyToManyField(Permission, related_name='roles')
    
    class Meta:
        db_table = 'roles'
        unique_together = ['company', 'name']
    
    def __str__(self):
        return f"{self.name} ({self.company.name})"


class Membership(models.Model):
    id = models.BigAutoField(primary_key=True)
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='memberships')
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='memberships')
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='memberships')
    store = models.ForeignKey(
        Store, on_delete=models.SET_NULL, related_name='memberships',
        null=True, blank=True,
    )
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    joined_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'memberships'
        unique_together = ['user', 'company']
    
    def __str__(self):
        return f"{self.user.email} - {self.company.name}"
