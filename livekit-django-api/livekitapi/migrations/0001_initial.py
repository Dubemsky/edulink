# Generated by Django 5.0 on 2023-12-30 18:42

import django.db.models.deletion
import guardian.mixins
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="LivekitRoom",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("description", models.CharField(max_length=20)),
                ("slug", models.SlugField(blank=True, max_length=10)),
                ("created", models.DateTimeField(auto_now_add=True)),
                (
                    "is_open",
                    models.BooleanField(
                        default=True,
                        help_text="If set to True, people with the URL can join",
                    ),
                ),
                (
                    "is_recording",
                    models.BooleanField(
                        default=False, help_text="Room is currently being recorded"
                    ),
                ),
                ("started", models.DateTimeField(blank=True, null=True)),
                ("ended", models.DateTimeField(blank=True, null=True)),
                ("scheduledStart", models.DateTimeField(blank=True, null=True)),
                ("scheduledEnd", models.DateTimeField(blank=True, null=True)),
                (
                    "shareWithNextcloudGroup",
                    models.CharField(
                        help_text="ID of the nextcloud entitiy to use for sharing, Group, Talk or Otherwise",
                        max_length=20,
                    ),
                ),
                (
                    "owner",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "permissions": (
                    ("join_room", "Join Room"),
                    ("start_stop_recording", "Start/Stop Recording"),
                ),
            },
            bases=(guardian.mixins.PermissionRequiredMixin, models.Model),
        ),
    ]
