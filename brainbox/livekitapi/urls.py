from django.urls import path
from . import views
from .views_api import *

urlpatterns = [
    path('room/<slug:slug>', views.view_room),
    path('room/<slug:slug>/start_recording', views.start_recording_room),
    path('room/<slug:slug>/stop_recording', views.stop_recording_room),

    path('create-room/', create_room, name='create_room'),
]
