from .models import AuditLog


def log_action(request, action, object_type, object_id, metadata=None):
    """Enregistre une entrée d'audit pour une action sensible.

    À utiliser dans les vues/serializers pour les opérations critiques
    (RÈGLE 7, _docs/04_REGLES_CRITIQUES.txt) : suppression, ajustement de
    stock, remboursement/annulation de vente, etc.
    """
    company = getattr(request, 'company', None)
    if not company:
        return None
    user = getattr(request, 'user', None)
    return AuditLog.objects.create(
        company=company,
        user=user if user and user.is_authenticated else None,
        action=action,
        object_type=object_type,
        object_id=str(object_id),
        metadata=metadata or {},
    )
