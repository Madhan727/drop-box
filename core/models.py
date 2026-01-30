from django.db import models
import random
import string
from django.utils import timezone
from datetime import timedelta

def generate_drop_code():
    while True:
        code = ''.join(random.choices(string.digits, k=6))
        if not Drop.objects.filter(code=code).exists():
            return code

class Drop(models.Model):
    code = models.CharField(max_length=6, unique=True, default=generate_drop_code)
    global_context = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=7)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Drop {self.code}"

class DropFile(models.Model):
    drop = models.ForeignKey(Drop, on_delete=models.CASCADE, related_name='files')
    file = models.FileField(upload_to='drops/')
    relative_path = models.CharField(max_length=500) # e.g. "folder/subfolder/file.txt" or "file.txt"
    item_context = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.relative_path} in {self.drop.code}"
