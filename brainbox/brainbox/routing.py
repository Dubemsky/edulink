from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path('students-dashboard/hub-room/<str:room_id>/', consumers.ChatConsumer.as_asgi()),  # For student rooms
    re_path('teachers-dashboard/hub-room/<str:room_id>/', consumers.ChatConsumer.as_asgi()),  # For teacher rooms
]
