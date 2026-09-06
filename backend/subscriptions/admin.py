from django.contrib import admin

from .models import Plan, Subscription


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ['name', 'price']
    search_fields = ['name']


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ['company', 'plan', 'status', 'starts_at', 'expires_at']
    search_fields = ['company__name']
    list_filter = ['status', 'plan']
    readonly_fields = ['uuid']
