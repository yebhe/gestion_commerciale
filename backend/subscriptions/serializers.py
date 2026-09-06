from rest_framework import serializers

from .models import Plan, Subscription


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = ['id', 'name', 'price']


class SubscriptionSerializer(serializers.ModelSerializer):
    plan_name = serializers.ReadOnlyField(source='plan.name')

    class Meta:
        model = Subscription
        fields = [
            'uuid', 'company', 'plan', 'plan_name', 'status',
            'starts_at', 'expires_at',
        ]
        read_only_fields = ['uuid']
