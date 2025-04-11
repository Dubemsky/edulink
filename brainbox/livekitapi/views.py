from django.core.exceptions import PermissionDenied
from django.http import HttpResponse
from django.http import JsonResponse
from django.shortcuts import render, get_object_or_404

from .models import LivekitRoom

# In livekitapi/views.py
def view_room(request, slug):
    """View handler for LiveKit room URLs"""
    try:
        # Get LiveKit credentials
        api_key = "APIRsaxCuofVw7K"
        api_secret = "ZnrqffqzbGqyHdGqGGjTfL2I1fOGMMKSIK7Htqb11NDC"
        livekit_instance = "edulink-oxkw0h5q.livekit.cloud"
        
        # Generate token for viewing
        import jwt
        import time
        import uuid
        
        user_identity = request.user.username if request.user.is_authenticated else f"viewer-{uuid.uuid4()}"
        
        # Token expiration (1 hour)
        exp = int(time.time()) + 3600
        
        # Create claims
        claims = {
            'iss': api_key,
            'sub': user_identity,
            'exp': exp,
            'nbf': int(time.time()),
            'jti': str(uuid.uuid4()),
            'video': {
                'room': slug,
                'roomJoin': True,
                'canPublish': False,
                'canSubscribe': True,
            }
        }
        
        # Generate token
        token = jwt.encode(claims, api_secret, algorithm='HS256')
        if isinstance(token, bytes):
            token = token.decode('utf-8')
        
        # Create room URL
        ws_url = f"wss://{livekit_instance}"
        room_url = f"https://{livekit_instance}/custom?liveKitUrl={ws_url}&token={token}"
        
        context = {
            'roomURL': room_url,
            'can_record': False,
            'is_recording': False,
        }
        
        return render(request, 'livekitapi/room.html', context)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return HttpResponse(f"Error loading room: {str(e)}", status=500)

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

