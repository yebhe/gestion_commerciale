from django.urls import path

from . import views


app_name = 'settings'

urlpatterns = [
    path('', views.CompanySettingsView.as_view(), name='company-settings'),
]
