from django.contrib import admin
from guardian.admin import GuardedModelAdmin

from livekitapi.models import LivekitRoom

@admin.register(LivekitRoom)
class LivekitRoomAdmin(GuardedModelAdmin):
    pass

