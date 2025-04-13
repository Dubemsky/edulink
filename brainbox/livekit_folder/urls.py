from django.urls import path
from .views import *

urlpatterns = [
path('create-room/', create_livestream_room, name='livekit_create_room'),
    path('get-token/', get_join_token, name='livekit_get_token'),
    path('room-participants/', get_room_participants, name='livekit_room_participants'),
    path('active-rooms/', get_active_rooms, name='livekit_active_rooms'),

    # Make sure this path is correctly defined and visible
    path('teacher-livestream/<str:room_id>/', teacher_livestream, name='teacher_livestream'),
]


