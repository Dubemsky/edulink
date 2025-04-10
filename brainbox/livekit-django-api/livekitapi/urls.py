from django.urls import path
from . import views

urlpatterns = [
    path('room/<slug:slug>', views.view_room),
    path('room/<slug:slug>/start_recording', views.start_recording_room),
    path('room/<slug:slug>/stop_recording', views.stop_recording_room),
]
