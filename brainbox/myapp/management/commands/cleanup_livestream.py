from django.core.management.base import BaseCommand
from django.utils import timezone
from myapp.livestream import cleanup_expired_livestreams

class Command(BaseCommand):
    help = 'Updates expired livestreams by changing their status from scheduled to expired'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting expired livestream cleanup...'))
        
        count = cleanup_expired_livestreams()
        
        self.stdout.write(self.style.SUCCESS(
            f'Successfully cleaned up {count} expired livestreams. '
            f'Completed at {timezone.now().strftime("%Y-%m-%d %H:%M:%S")}'
        ))


        