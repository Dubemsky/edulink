# brainbox/myapp/views_teachers.py or new file

from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
import json
from .livekit_integration import create_livestream_room, end_livestream_room
import jwt
import time
import uuid
from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.conf import settings

@login_required
def teacher_livestream_view(request, room_id):
    """View for the teacher livestream interface"""
    
    # Create a room name based on the hub room ID
    room_name = f"live-{room_id}"
    
    # Create a LiveKit token for the teacher
    token = generate_livekit_token(room_name, request.user.username, is_admin=True)
    
    # LiveKit WebSocket URL
    livekit_ws_url = f"wss://{settings.LIVEKIT_INSTANCE}"
    
    # Prepare context for the template
    context = {
        'room_name': room_name,
        'token': token,
        'ws_url': livekit_ws_url,
        'slug': room_name,  # Using room_name as the slug for simplicity
        'teacher_name': request.user.username,
        'title': f"Live Class: {room_name}"  # Default title
    }
    
    # Render the livestream template
    return render(request, 'myapp/teacher_livestream.html', context)

def generate_livekit_token(room_name, identity, is_admin=False):
    """Generate a LiveKit token for a participant"""
    
    # Get API key and secret from settings
    api_key = settings.LIVEKIT_API_KEY
    api_secret = settings.LIVEKIT_API_SECRET
    
    # Token expiration time (1 hour)
    exp = int(time.time()) + 3600
    
    # Create claims for the token
    claims = {
        'iss': api_key,
        'sub': identity,
        'exp': exp,
        'nbf': int(time.time()),
        'jti': str(uuid.uuid4()),
        'video': {
            'room': room_name,
            'roomJoin': True,
            'canPublish': True,
            'canSubscribe': True,
            'canPublishData': True
        }
    }
    
    # Add admin permissions if needed
    if is_admin:
        claims['video'].update({
            'roomAdmin': True,
            'roomCreate': True,
            'canPublishSources': ['camera', 'microphone', 'screen_share', 'screen_share_audio']
        })
    
    # Generate the token
    token = jwt.encode(claims, api_secret, algorithm='HS256')
    
    # Some jwt libraries return bytes, ensure we return a string
    if isinstance(token, bytes):
        token = token.decode('utf-8')
    
    return token

@login_required
@require_POST
def end_teacher_livestream(request):
    """Handle ending a livestream"""
    try:
        data = json.loads(request.body)
        room_id = data.get('room_id')
        
        if not room_id:
            return JsonResponse({'success': False, 'error': 'Room ID is required'})
        
        result = end_livestream_room(room_id, request.user)
        return JsonResponse(result)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})
    


