"""
Validation de la cohérence hiérarchique (_docs/14, règles 84-90) :

    LOCATION -> WAREHOUSE -> STORE -> TENANT (company)

Le backend doit empêcher :
- une location d'un entrepôt A utilisée avec l'entrepôt B   (R88) ;
- un entrepôt du store A utilisé dans une opération du store B (R89) ;
- un entrepôt du tenant A utilisé dans une opération du tenant B (R90).

Les paramètres warehouse / location sont optionnels tant que les modèles
correspondants ne sont pas introduits (étape 1/2 du plan 15) : la fonction
est déjà en place et les vérifications s'activent dès que les objets
sont fournis.
"""

from rest_framework.exceptions import ValidationError


def assert_hierarchy(company, *, store=None, warehouse=None, location=None,
                     product=None, variant=None, lot=None):
    """Lève ValidationError si la chaîne location -> warehouse -> store ->
    company est incohérente. Retourne le store effectif (celui du
    warehouse si store n'est pas fourni).

    Étape 4 (R59) : une variante et un lot appartiennent au produit —
    variant.product / lot.product doivent correspondre au produit de
    l'opération, et lot.variant à la variante si les deux sont fournis.
    """
    if company is None:
        raise ValidationError("Aucune entreprise sélectionnée.")

    if variant is not None:
        if product is not None and variant.product_id != product.id:
            raise ValidationError(
                "Cette variante n'appartient pas au produit indiqué."
            )
        if variant.company_id != company.id:
            raise ValidationError(
                "Cette variante n'appartient pas à cette entreprise."
            )

    if lot is not None:
        if product is not None and lot.product_id != product.id:
            raise ValidationError(
                "Ce lot n'appartient pas au produit indiqué."
            )
        if lot.company_id != company.id:
            raise ValidationError(
                "Ce lot n'appartient pas à cette entreprise."
            )
        if (variant is not None and lot.variant_id is not None
                and lot.variant_id != variant.id):
            raise ValidationError(
                "Ce lot n'est pas rattaché à la variante indiquée."
            )

    if location is not None:
        loc_warehouse = getattr(location, 'warehouse', None)
        if loc_warehouse is None:
            raise ValidationError("Cet emplacement n'est rattaché à aucun entrepôt.")
        if warehouse is not None and loc_warehouse.id != warehouse.id:
            raise ValidationError(
                "Cet emplacement n'appartient pas à l'entrepôt indiqué."
            )
        warehouse = loc_warehouse

    if warehouse is not None:
        wh_store = getattr(warehouse, 'store', None)
        if wh_store is None:
            raise ValidationError("Cet entrepôt n'est rattaché à aucun magasin.")
        if store is not None and wh_store.id != store.id:
            raise ValidationError(
                "Cet entrepôt n'appartient pas au magasin indiqué."
            )
        store = wh_store

    if store is not None and store.company_id != company.id:
        raise ValidationError(
            "Ce magasin n'appartient pas à cette entreprise."
        )

    return store
