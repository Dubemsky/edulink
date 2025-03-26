# Create this file at: brainbox/myapp/management/commands/deactivate_unverified.py

import logging
from django.core.management.base import BaseCommand
from django.utils import timezone
from myapp.firebase import deactivate_unverified_accounts

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Deactivates user accounts that have not verified their email within the verification period'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('Starting deactivation of unverified accounts...'))
        
        try:
            # Call the function to deactivate unverified accounts
            deactivate_unverified_accounts()
            self.stdout.write(self.style.SUCCESS('Successfully processed unverified accounts'))
        except Exception as e:
            logger.error(f"Error deactivating unverified accounts: {e}")
            self.stdout.write(self.style.ERROR(f'Error deactivating unverified accounts: {e}'))