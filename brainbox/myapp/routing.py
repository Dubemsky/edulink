from django.urls import re_path
from .consumer import *

wsPattern = [
    # General messages
    re_path(r'ws/students-dashboard/hub-room/(?P<room_name>[a-zA-Z0-9]+)/$', ChatConsumer.as_asgi()),
    re_path(r'ws/teachers-dashboard/hub-room/(?P<room_name>[a-zA-Z0-9]+)/$', ChatConsumer.as_asgi()),

    #Replies
    re_path(r'ws/students-dashboard/hub-room/(?P<room_name>[a-zA-Z0-9]+)/(?P<message_id>[a-zA-Z0-9]+)/$', ChatConsumer.as_asgi()),
    re_path(r'ws/teachers-dashboard/hub-room/(?P<room_name>[a-zA-Z0-9]+)/(?P<message_id>[a-zA-Z0-9]+)/$', ChatConsumer.as_asgi()),
]
