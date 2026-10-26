from rest_framework.routers import DefaultRouter

from .views import (
    InventoryMovementViewSet, InventorySessionViewSet,
    TransferViewSet, WarehouseViewSet,
)

router = DefaultRouter()
router.register('warehouses', WarehouseViewSet, basename='warehouse')
router.register('transfers', TransferViewSet, basename='transfer')
router.register('sessions', InventorySessionViewSet, basename='inventory-session')
router.register('', InventoryMovementViewSet, basename='inventory-movement')

urlpatterns = router.urls
