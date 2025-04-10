from django.urls import path
from . import views

urlpatterns = [
    path('create-room/', views.create_livestream_room, name='livekit_create_room'),
    path('get-token/', views.get_join_token, name='livekit_get_token'),
    path('room-participants/', views.get_room_participants, name='livekit_room_participants'),
    path('active-rooms/', views.get_active_rooms, name='livekit_active_rooms'),
]