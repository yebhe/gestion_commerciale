from django.urls import path

from .views import InventoryReportView, ReportExportView, SalesReportView

urlpatterns = [
    path('sales/', SalesReportView.as_view(), name='report-sales'),
    path('inventory/', InventoryReportView.as_view(), name='report-inventory'),
    path('export/', ReportExportView.as_view(), name='report-export'),
]
