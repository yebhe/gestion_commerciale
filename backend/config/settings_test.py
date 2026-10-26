"""Settings de test local : SQLite en mémoire, sans Docker.

Usage : python manage.py test --settings=config.settings_test
Réservé aux tests unitaires ; ne jamais utiliser en production.
"""

from .settings import *  # noqa: F401,F403

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Les tests n'ont pas besoin de Celery/Redis/MinIO/ClamAV.
CELERY_TASK_ALWAYS_EAGER = True
