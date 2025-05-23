from django.urls import re_path
from .consumer import *
from .group_chat_consumer import GroupChatConsumer
from .private_message_consumer import DirectChatConsumer

wsPattern = [
    # General messages
    re_path(r'ws/students-dashboard/hub-room/(?P<room_name>[a-zA-Z0-9]+)/$', ChatConsumer.as_asgi()),
    re_path(r'ws/teachers-dashboard/hub-room/(?P<room_name>[a-zA-Z0-9]+)/$', ChatConsumer.as_asgi()),


    #Replies
    re_path(r'ws/students-dashboard/hub-room/(?P<room_name>[a-zA-Z0-9]+)/(?P<message_id>[a-zA-Z0-9]+)/$', ChatConsumer.as_asgi()),
    re_path(r'ws/teachers-dashboard/hub-room/(?P<room_name>[a-zA-Z0-9]+)/(?P<message_id>[a-zA-Z0-9]+)/$', ChatConsumer.as_asgi()),

    re_path(r'ws/direct-chat/(?P<user_id>[^/]+)/(?P<recipient_id>[^/]+)/$', DirectChatConsumer.as_asgi()),
    re_path(r'ws/group_chat/(?P<group_id>\w+)/(?P<user_id>\w+)/$', GroupChatConsumer.as_asgi()),

    


    
]
   
