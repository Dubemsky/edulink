# django-livekit-api

`livekitapi` is a Django app to manage livekit conference rooms.

Detailed documentation is in the "docs" directory.

## Quick start

1. Add "livekitapi" and "guardian" to your INSTALLED_APPS setting like this:

```
    INSTALLED_APPS = [
        ...,
        "livekitapi",
        "guardian",
    ]
```

2. Configure livekit info. You can use `django-environ`:

```
LIVEKIT_API_KEY=deadbeef
LIVEKIT_API_SECRET=secret
LIVEKIT_INSTANCE=meet-asdf.livekit.cloud
```

2. Include the livekitapi URLconf in your project urls.py like this:

```
path('', include('livekitapi.urls')),
```

3. Run ``python manage.py migrate`` to create the livekitapi models.

4. Start the development server and visit http://127.0.0.1:8000/admin/
   to create a room (you'll need the Admin app enabled).

5. Visit http://127.0.0.1:8000/rooms/roomid to participate in an existing conference room.


For more details, refer to the provided example `settings.py` in the `livekitapi_example` project.


## Permissions

`django-livekit` uses `guardian` for authorization. There are two distinct
permissions you can give your users or groups:

* `livekitapi.JOIN_ROOM_PERM` - this is only effective is the room has set `is_open` to False.
* `livekitapi.START_STOP_RECORDING_PERM` - to be able to toggle room recording. By default, the room's `owner` has these permissions set.

# Livekit control Server

The python livekit api doesn't allow to control the egress server (as far as I know).
You can use the small `livekit-minio`
[utility](https://github.com/kalikaneko/livekit-record-minio) for this. That
repo also has a second utility for sharing the resulting file with a Nextcloud
chat, please refer to the
[README](https://github.com/kalikaneko/livekit-record-minio).
