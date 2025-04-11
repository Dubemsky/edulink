from django.urls import path
from . import views
from .views_api import *
from .livekit_direct import *
from .debug import *


urlpatterns = [
    # Make sure this exact pattern exists
    path('room/<str:slug>/', views.view_room, name='view_room'),
    
    # Your other patterns...
    path('room/<str:slug>/start_recording', views.start_recording_room),
    path('room/<str:slug>/stop_recording', views.stop_recording_room),
    path('create-room/', create_room, name='create_room'),
    path('get-livekit-url/', get_livekit_url, name='get_livekit_url'),
    path('debug-room/<str:slug>/', direct_room, name='debug_room'),
]