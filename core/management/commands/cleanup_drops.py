from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import Drop
import shutil
import os

class Command(BaseCommand):
    help = 'Deletes expired drops and their files'

    def handle(self, *args, **options):
        now = timezone.now()
        expired_drops = Drop.objects.filter(expires_at__lt=now)
        count = expired_drops.count()

        for drop in expired_drops:
            # Files are automatically deleted from DB on cascade, but we need to ensure local files are gone.
            # Django's FileField cleanup is sometimes tricky.
            # Best way: Iterate files, delete storage. Or since we may not have subfolders per drop in media root in this simple setup?
            # Actually, `upload_to='drops/'` puts them all in one folder.
            # We should probably check if we can just delete the file objects.
            
            # Better approach for folder cleanliness: 
            # Ideally each drop should have its own folder if we want easy cleanup.
            # But currently `upload_to='drops/'` mixes them.
            # We will rely on Django's file storage cleanup or manual file deletion.
            
            for f in drop.files.all():
                try:
                    if f.file:
                        f.file.delete(save=False) # Deletes from disk
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"Error deleting file {f.id}: {e}"))
            
            drop.delete()

        self.stdout.write(self.style.SUCCESS(f'Deleted {count} expired drops.'))
