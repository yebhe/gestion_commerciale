from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    CategoryViewSet, LotViewSet, ProductVariantViewSet, ProductViewSet,
)

router = DefaultRouter()
router.register('categories', CategoryViewSet, basename='category')
router.register('', ProductViewSet, basename='product')

variant_list = ProductVariantViewSet.as_view({'get': 'list', 'post': 'create'})
variant_detail = ProductVariantViewSet.as_view({
    'get': 'retrieve', 'put': 'update', 'patch': 'partial_update',
    'delete': 'destroy',
})
lot_list = LotViewSet.as_view({'get': 'list', 'post': 'create'})
lot_detail = LotViewSet.as_view({
    'get': 'retrieve', 'put': 'update', 'patch': 'partial_update',
    'delete': 'destroy',
})

urlpatterns = [
    # Routes imbriquées (étape 4.4) : /products/{uuid}/variants/ et /lots/
    path('<uuid:product_uuid>/variants/', variant_list,
         name='product-variant-list'),
    path('<uuid:product_uuid>/variants/<uuid:uuid>/', variant_detail,
         name='product-variant-detail'),
    path('<uuid:product_uuid>/lots/', lot_list, name='product-lot-list'),
    path('<uuid:product_uuid>/lots/<uuid:uuid>/', lot_detail,
         name='product-lot-detail'),
] + router.urls
