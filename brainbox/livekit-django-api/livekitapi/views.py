from django.core.exceptions import PermissionDenied
from django.http import HttpResponse
from django.http import JsonResponse
from django.shortcuts import render, get_object_or_404

from .models import LivekitRoom

def view_room(request, slug):

    room = get_object_or_404(LivekitRoom, slug=slug)

    try:
        link = room.get_link_for_user(request.user)
        can_record = room.user_can_record(request.user)
    except PermissionDenied:
        return HttpResponse('permission denied', 401)

    if not room.is_live():
        return HttpResponse('room not live', 404)

    context = {
        'roomURL': link,
        'can_record': can_record,
        # TODO: this needs either pull or a ws for pushing notifications...
        'is_recording': room.is_recording,
    }

    return render(request, 'livekitapi/room.html', context)

def start_recording_room(request, slug):
    room = get_object_or_404(LivekitRoom, slug=slug)
    if not room.user_can_record(request.user):
        return HttpResponse('unauthorized', 401)
    room.start_recording(request.user)
    data = {'ok': True, 'msg': 'ok'}
    return JsonResponse(data)

def stop_recording_room(request, slug):
    room = get_object_or_404(LivekitRoom, slug=slug)
    if not room.user_can_record(request.user):
        return HttpResponse('unauthorized', 401)
    room.stop_recording(request.user)
    data = {'ok': True, 'msg': 'ok'}
    return JsonResponse(data)

