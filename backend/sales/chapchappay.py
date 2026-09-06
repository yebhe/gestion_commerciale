"""
Client pour l'API Chap Chap Pay (passerelle de paiement Mobile Money agréée
par la Banque Centrale de la République de Guinée) : https://chapchappay.com/guide/

Intègre le service E-Commerce (génération d'un lien de paiement) documenté
publiquement. Les identifiants (clé API, clé d'encryptage HMAC) sont lus
depuis les variables d'environnement (settings.CHAPCHAPPAY_*) et ne doivent
jamais être codés en dur dans le dépôt.
"""
import hashlib
import hmac

import requests
from django.conf import settings

CHAPCHAPPAY_BASE_URL = 'https://chapchappay.com/api'


class ChapChapPayError(Exception):
    """Erreur lors d'un appel à l'API Chap Chap Pay."""


def create_ecommerce_operation(amount, order_id=None, notify_url=None, description=None):
    """
    Crée une opération de paiement E-Commerce et retourne la réponse JSON de
    Chap Chap Pay, contenant notamment `payment_url` (à présenter au client
    pour qu'il complète le paiement) et `operation_id`.
    """
    api_key = settings.CHAPCHAPPAY_API_KEY
    if not api_key:
        raise ChapChapPayError("Clé API Chap Chap Pay non configurée (CHAPCHAPPAY_API_KEY).")

    payload = {'amount': int(amount)}
    if order_id:
        payload['order_id'] = str(order_id)
    if notify_url:
        payload['notify_url'] = notify_url
    if description:
        payload['description'] = description

    try:
        response = requests.post(
            f'{CHAPCHAPPAY_BASE_URL}/ecommerce/create',
            json=payload,
            headers={'CCP-Api-Key': api_key},
            timeout=15,
        )
    except requests.RequestException as exc:
        raise ChapChapPayError(f"Impossible de contacter Chap Chap Pay : {exc}") from exc

    if response.status_code >= 400:
        raise ChapChapPayError(
            f"Chap Chap Pay a refusé la demande (HTTP {response.status_code}) : {response.text[:300]}"
        )

    try:
        return response.json()
    except ValueError as exc:
        raise ChapChapPayError("Réponse Chap Chap Pay invalide (JSON attendu).") from exc


def verify_webhook_signature(raw_body: bytes, signature: str) -> bool:
    """
    Vérifie la signature HMAC-SHA256 d'un webhook Chap Chap Pay (en-tête
    CCP-HMAC-Signature) avec la clé d'encryptage du compte, afin de garantir
    l'authenticité de la notification (_docs guide, section Sécurité).
    """
    secret = settings.CHAPCHAPPAY_HMAC_KEY
    if not secret or not signature:
        return False
    computed = hmac.new(secret.encode('utf-8'), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed, signature)
