import string
from itertools import chain
import attrs
import requests

from django.db import models
from django.core.exceptions import PermissionDenied
from django.conf import settings
from django.contrib.auth.models import User
from django.utils import timezone
from django.utils.crypto import get_random_string

from guardian.mixins import PermissionRequiredMixin
from guardian.shortcuts import assign_perm
from random_username.generate import generate_username

from livekit import api as lkapi

# By default, avoid scheduling too many concurrent calls.
# This can be overridden in config with `LIVEKIT_MAX_ROOMS`.
LIVEKIT_DEFAULT_MAX_ROOMS = 2

LIVEKIT_DEFAULT_DURATION_HOURS = 2

LIVEKIT_DEFAULT_BASEURL = "https://meet.livekit.io/custom?liveKitUrl=wss://{instance}&token={token}"

JOIN_ROOM_PERM = 'join_room'
START_STOP_RECORDING_PERM = 'start_stop_recording'

# TODO: make this configurable in settings 
LIVEKIT_CONTROL_SERVER="http://localhost:3000"


@attrs.define
class LivekitConfig:
    key: str
    secret: str

    @classmethod
    def from_config(cls):
        api = settings.LIVEKIT_API_KEY
        secret = settings.LIVEKIT_SECRET

        if api is None or secret is None:
            raise ValueError("Need to configure LIVEKIT_API_KEY and LIVEKIT_API_SECRET")

        return cls(api, secret)


class CurrentSlotManager(models.Manager):
    def get_queryset(self):
        last_hour = timezone.now() - timezone.timedelta(hours=1)
        next_hour = timezone.now() + timezone.timedelta(hours=1)
        current_time = timezone.now()
        qs = super().get_queryset().all().filter(
            models.Q(scheduledStart__lte=current_time, scheduledEnd__gte=current_time) |
            models.Q(started__gte=last_hour, ended=None))
        return qs


class LivekitRoom(PermissionRequiredMixin, models.Model):

    description = models.CharField(max_length=20)
    slug = models.SlugField(max_length=10, blank=True)
    created = models.DateTimeField(auto_now_add=True)

    is_open = models.BooleanField(help_text="If set to True, people with the URL can join", default=True)
    is_recording = models.BooleanField(help_text="Room is currently being recorded", default=False)

    owner = models.ForeignKey(User, null=True, on_delete=models.CASCADE)

    # record actual start and end timestamps
    started = models.DateTimeField(blank=True, null=True)
    ended = models.DateTimeField(blank=True, null=True)

    # for requesting a scheduled event in the future
    scheduledStart = models.DateTimeField(blank=True, null=True)
    scheduledEnd = models.DateTimeField(blank=True, null=True)

    # this can be factored out for other sharing methods, but keeping it simple for now.
    # in reality this is a TALK ID at the moment.
    shareWithNextcloudGroup = models.CharField(max_length=20, help_text="ID of the nextcloud entitiy to use for sharing, Group, Talk or Otherwise")

    objects = models.Manager()
    current_slot_objects = CurrentSlotManager()

    def is_live(self):
        # has not started yet, or has already ended
        if self.started is None or self.ended is not None:
            return False

        # started too long ago
        if self.started < timezone.now() - timezone.timedelta(hours=LIVEKIT_DEFAULT_DURATION_HOURS):
            return False

        # otherwise is considered live
        return True

    @classmethod
    def create_scheduled(cls, scheduledStart, scheduledEnd, owner=None, description=None):
        if description is None:
            description = "new room"

        current_time = timezone.now()
        max_instances_allowed = getattr(settings, 'LIVEKIT_MAX_ROOMS', LIVEKIT_DEFAULT_MAX_ROOMS)

        # Check if there are already too many instances within the time range
        if cls.current_slot_objects.count() >= max_instances_allowed:
            raise ValueError(f"Maximum allowed rooms ({max_instances_allowed}) reached within the time range.")

        # Create a new instance and save it
        room = cls(
            scheduledStart=current_time,
            scheduledEnd=current_time + timezone.timedelta(hours=LIVEKIT_DEFAULT_DURATION_HOURS),
        )

        room.description = description
        room.owner = owner
        room.save()

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = get_random_string(10, string.ascii_lowercase)

        if not self.owner:
            self.owner = User.objects.filter(is_superuser=True).first()

        super(LivekitRoom, self).save()

        # by default, only the owner can start or stop recording in this room
        assign_perm(START_STOP_RECORDING_PERM, self.owner, self)
        assign_perm(JOIN_ROOM_PERM, self.owner, self)

        super(LivekitRoom, self).save()

    def user_can_join(self, user):
        if self.is_open:
            return True

        return user.has_perm(JOIN_ROOM_PERM, self)

    def user_can_record(self, user):
        return user.has_perm(START_STOP_RECORDING_PERM, self)

    def get_link_for_user(self, user):
        key = settings.LIVEKIT_API_KEY
        secret = settings.LIVEKIT_API_SECRET

        if not self.user_can_join(user):
            raise PermissionDenied('user {user} has no permission to access room {self}')

        if self.is_open and user.is_anonymous:
            identity = generate_username()[0]
        else:
            identity = user.username

        token = lkapi.AccessToken(key, secret) \
            .with_identity(identity) \
            .with_name(identity) \
            .with_grants(lkapi.VideoGrants(
                room_join=True,
                room=self.slug,
            )).to_jwt()

        link = LIVEKIT_DEFAULT_BASEURL.format(
            instance=settings.LIVEKIT_INSTANCE,
            token=token)

        return link

    def start_recording(self, user):
        if not user.has_perm(START_STOP_RECORDING_PERM, self):
            raise PermissionDenied('user {user} has no permission to record room {self}')
        if self.shareWithNextcloudGroup == "":
            raise ValueError("shareWithNextcloudGroup should not be empty")
        self.is_recording = True
        self.save()

        # TODO: catch errors
        print('should start recording')
        url = LIVEKIT_CONTROL_SERVER + f"/start?room={self.slug}&shareWith={self.shareWithNextcloudGroup}"
        requests.get(url)

    def stop_recording(self, user):
        if not user.has_perm(START_STOP_RECORDING_PERM, self):
            raise PermissionDenied('user {user} has no permission to record room {self}')
        if self.shareWithNextcloudGroup == "":
            raise ValueError("shareWithNextcloudGroup should not be empty")
        self.is_recording = False
        self.save()

        # TODO: catch errors
        print('should stop recording')
        url = LIVEKIT_CONTROL_SERVER + f"/stop?room={self.slug}"
        requests.get(url)

    def __repr__(self):
        return f'{self.slug}: {self.started}'

    def __str__(self):
        return f'{self.slug}: {self.started}'

    class Meta:
        permissions = (
            (JOIN_ROOM_PERM, 'Join Room'),
            (START_STOP_RECORDING_PERM, 'Start/Stop Recording')
        )
