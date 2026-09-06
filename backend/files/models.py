import uuid

from django.db import models

from companies.models import Company, Store


class CompanyFile(models.Model):
    id = models.BigAutoField(primary_key=True)
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='files')
    store = models.ForeignKey(
        Store, on_delete=models.SET_NULL, related_name='files', null=True, blank=True
    )
    path = models.FileField(upload_to='companies/files/')
    mime_type = models.CharField(max_length=100, blank=True, null=True)
    size = models.PositiveBigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'company_files'
        ordering = ['-created_at']

    def __str__(self):
        return str(self.path)
