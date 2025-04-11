from django.contrib.auth.models import User, Group
from django.core.exceptions import PermissionDenied
from django.test import TestCase
from django.utils import timezone

from guardian.shortcuts import assign_perm

from livekitapi.models import LivekitRoom
from livekitapi.models import JOIN_ROOM_PERM


def create_test_user(username='testuser', password='testpassword', email='testuser@example.com'):
    user = User.objects.create_user(username=username, password=password, email=email)
    return user

def create_test_another_user(username='testuser2', password='testpassword', email='testuser2@example.com'):
    user = User.objects.create_user(username=username, password=password, email=email)
    return user

def create_test_superuser(username='admin', password='testpassword', email='admin@example.com'):
    user = User.objects.create_superuser(username=username, password=password, email=email)
    return user


class LimitedSlotsTestCase(TestCase):

    def setUp(self):
        create_test_superuser()
        self.user = create_test_user()

        one_hour_ago = timezone.now() - timezone.timedelta(hours=1)
        one_hour_later = timezone.now() + timezone.timedelta(hours=1)
        LivekitRoom.create_scheduled(one_hour_ago, one_hour_later, owner=self.user)

    def test_can_create_below_default_limit(self):
        one_hour_ago = timezone.now() - timezone.timedelta(hours=1)
        one_hour_later = timezone.now() + timezone.timedelta(hours=1)
        LivekitRoom.create_scheduled(one_hour_ago, one_hour_later, description="test", owner=self.user)

    def test_create_raises_above_default_limit(self):
        one_hour_ago = timezone.now() - timezone.timedelta(hours=1)
        one_hour_later = timezone.now() + timezone.timedelta(hours=1)
        LivekitRoom.create_scheduled(one_hour_ago, one_hour_later, description="test", owner=self.user)
        with self.assertRaises(ValueError):
            LivekitRoom.create_scheduled(one_hour_ago, one_hour_later, description="test", owner=self.user)

    def test_create_raises_if_enough_already_started(self):
        now = timezone.now()
        one_hour_later = timezone.now() + timezone.timedelta(hours=1)
        LivekitRoom.objects.create(started=now)
        with self.assertRaises(ValueError):
            LivekitRoom.create_scheduled(now + timezone.timedelta(minutes=5), one_hour_later, description="test", owner=self.user)

    def test_create_ok_if_started_and_ended(self):
        now = timezone.now()
        one_hour_later = timezone.now() + timezone.timedelta(hours=1)
        five_min_ago = timezone.now() - timezone.timedelta(minutes=5)
        one_min_ago = timezone.now() - timezone.timedelta(minutes=1)
        LivekitRoom.objects.create(started=five_min_ago, ended=one_min_ago)
        LivekitRoom.create_scheduled(now + timezone.timedelta(minutes=5), one_hour_later, description="test", owner=self.user)

class RoomLinkTestCase(TestCase):

    def setUp(self):
        create_test_superuser()
        self.user = create_test_user()
        self.anotheruser = create_test_another_user()

        one_hour_ago = timezone.now() - timezone.timedelta(hours=1)
        one_hour_later = timezone.now() + timezone.timedelta(hours=1)
        LivekitRoom.create_scheduled(one_hour_ago, one_hour_later, owner=self.user)

    def test_can_get_link_when_room_is_open_by_default(self):
        room = LivekitRoom.objects.first()
        link = room.get_link_for_user(self.user)
        self.assertTrue(len(link) != 0)

    def test_permission_denied_if_room_not_open(self):
        room = LivekitRoom.objects.first()
        room.is_open = False
        room.save()

        with self.assertRaises(PermissionDenied):
            room.get_link_for_user(self.anotheruser)

    def test_can_get_link_if_permission_granted_to_user(self):
        room = LivekitRoom.objects.first()
        room.is_open = False
        room.save()
        with self.assertRaises(PermissionDenied):
            room.get_link_for_user(self.anotheruser)
        assign_perm(JOIN_ROOM_PERM, self.anotheruser, room)
        link = room.get_link_for_user(self.anotheruser)
        self.assertTrue(len(link) != 0)

    def test_can_get_link_if_permission_granted_to_group(self):
        room = LivekitRoom.objects.first()
        room.is_open = False
        room.save()

        roomGroup = Group.objects.create(name='roomies')
        assign_perm(JOIN_ROOM_PERM, roomGroup, room)

        with self.assertRaises(PermissionDenied):
            room.get_link_for_user(self.anotheruser)

        self.anotheruser.groups.add(roomGroup)
        link = room.get_link_for_user(self.anotheruser)
        self.assertTrue(len(link) != 0)
