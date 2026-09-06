import csv
from datetime import datetime, timedelta

from django.db.models import Count, F, Sum
from django.db.models.functions import TruncDate
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from inventory.models import InventoryMovement
from products.models import Product, StockLevel
from sales.models import Sale, SaleItem
from users.permissions import HasPermission


def _parse_date(value, default):
    if not value:
        return default
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except ValueError:
        return default


def _resolve_period(request):
    """Période par défaut : les 30 derniers jours (bornes incluses)."""
    today = timezone.localdate()
    date_from = _parse_date(request.query_params.get('date_from'), today - timedelta(days=29))
    date_to = _parse_date(request.query_params.get('date_to'), today)
    return date_from, date_to


def _resolve_store(request):
    """
    Applique le scope STORE obligatoire et, pour le scope COMPANY, le filtre
    ?store=<uuid> optionnel (_docs/09_REGLES_CRUD.txt).
    """
    if getattr(request, 'store', None):
        return request.store
    store_uuid = request.query_params.get('store')
    if store_uuid:
        from companies.models import Store
        return Store.objects.filter(company=request.company, uuid=store_uuid).first()
    return None


class SalesReportView(APIView):
    """Rapport des ventes : chiffre d'affaires, panier moyen, top produits,
    répartition par jour / moyen de paiement / magasin (permission
    reports.sales, _docs/08_SYSTEM_ PERMISSIONS_CENTRAL.txt)."""
    permission_classes = (HasPermission,)
    required_permission = 'reports.sales'

    def get(self, request):
        date_from, date_to = _resolve_period(request)
        store = _resolve_store(request)

        sales = Sale.objects.filter(
            company=request.company, status='completed',
            created_at__date__gte=date_from, created_at__date__lte=date_to,
        )
        if store:
            sales = sales.filter(store=store)

        totals = sales.aggregate(revenue=Sum('total_amount'), count=Count('id'))
        revenue = totals['revenue'] or 0
        count = totals['count'] or 0
        average_ticket = (revenue / count) if count else 0

        revenue_by_day = list(
            sales.annotate(day=TruncDate('created_at'))
            .values('day')
            .annotate(revenue=Sum('total_amount'), count=Count('id'))
            .order_by('day')
        )

        by_payment_method = list(
            sales.values('payment_method')
            .annotate(revenue=Sum('total_amount'), count=Count('id'))
            .order_by('-revenue')
        )

        by_store = []
        if not store:
            by_store = list(
                sales.values('store__uuid', 'store__name')
                .annotate(revenue=Sum('total_amount'), count=Count('id'))
                .order_by('-revenue')
            )

        items = SaleItem.objects.filter(
            sale__company=request.company, sale__status='completed',
            sale__created_at__date__gte=date_from, sale__created_at__date__lte=date_to,
        )
        if store:
            items = items.filter(sale__store=store)

        top_products = list(
            items.values('product__uuid', 'product__name')
            .annotate(
                revenue=Sum(F('quantity') * F('unit_price') - F('discount')),
                total_quantity=Sum('quantity'),
            )
            .order_by('-revenue')[:10]
        )
        for p in top_products:
            p['quantity'] = p.pop('total_quantity')

        return Response({
            'date_from': date_from, 'date_to': date_to,
            'revenue': revenue, 'sales_count': count, 'average_ticket': round(average_ticket, 2),
            'revenue_by_day': revenue_by_day,
            'by_payment_method': by_payment_method,
            'by_store': by_store,
            'top_products': top_products,
        })


class InventoryReportView(APIView):
    """Rapport de stock : valeur du stock, produits en rupture/faible stock,
    résumé des mouvements sur la période (permission reports.inventory)."""
    permission_classes = (HasPermission,)
    required_permission = 'reports.inventory'

    def get(self, request):
        date_from, date_to = _resolve_period(request)
        store = _resolve_store(request)
        low_stock_threshold = int(request.query_params.get('threshold', 5))

        products = Product.objects.filter(company=request.company)
        levels = StockLevel.objects.filter(product__company=request.company)
        if store:
            levels = levels.filter(store=store)

        total_products = products.filter(store=store) if store else products
        total_products_count = total_products.count()

        stock_value = levels.aggregate(
            value=Sum(F('quantity') * F('product__purchase_price'))
        )['value'] or 0
        total_units = levels.aggregate(units=Sum('quantity'))['units'] or 0

        low_stock = list(
            levels.filter(quantity__lte=low_stock_threshold)
            .select_related('product', 'store')
            .order_by('quantity')
            .values('product__uuid', 'product__name', 'store__uuid', 'store__name', 'quantity')[:50]
        )

        movements = InventoryMovement.objects.filter(
            company=request.company,
            created_at__date__gte=date_from, created_at__date__lte=date_to,
        )
        if store:
            movements = movements.filter(store=store)

        movements_summary = list(
            movements.values('type')
            .annotate(count=Count('id'), quantity=Sum('quantity'))
            .order_by('type')
        )

        return Response({
            'date_from': date_from, 'date_to': date_to,
            'total_products': total_products_count,
            'total_units': total_units,
            'stock_value': stock_value,
            'low_stock_threshold': low_stock_threshold,
            'low_stock': low_stock,
            'movements_summary': movements_summary,
        })


class ReportExportView(APIView):
    """Export CSV des ventes ou du stock (permission reports.export)."""
    permission_classes = (HasPermission,)
    required_permission = 'reports.export'

    def get(self, request):
        report_type = request.query_params.get('type', 'sales')
        date_from, date_to = _resolve_period(request)
        store = _resolve_store(request)

        response = HttpResponse(content_type='text/csv')
        filename = f"rapport_{report_type}_{date_from}_{date_to}.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        writer = csv.writer(response)

        if report_type == 'inventory':
            writer.writerow(['Produit', 'Magasin', 'Quantité', 'Prix d\'achat', 'Valeur'])
            levels = StockLevel.objects.filter(
                product__company=request.company
            ).select_related('product', 'store')
            if store:
                levels = levels.filter(store=store)
            for level in levels:
                writer.writerow([
                    level.product.name, level.store.name, level.quantity,
                    level.product.purchase_price, level.quantity * level.product.purchase_price,
                ])
        else:
            writer.writerow(['Date', 'Magasin', 'Client', 'Moyen de paiement', 'Statut', 'Total'])
            sales = Sale.objects.filter(
                company=request.company,
                created_at__date__gte=date_from, created_at__date__lte=date_to,
            ).select_related('store', 'customer')
            if store:
                sales = sales.filter(store=store)
            for sale in sales:
                writer.writerow([
                    sale.created_at.strftime('%Y-%m-%d %H:%M'),
                    sale.store.name if sale.store else '',
                    sale.customer.name if sale.customer else '',
                    sale.payment_method, sale.status, sale.total_amount,
                ])

        return response
