import jwt
import time
import uuid
from django.conf import settings
from django.http import JsonResponse

def create_livestream_token(room_id, user_identity, is_admin=False):
    """Create a LiveKit access token"""
    room_name = f"live-{room_id}"
    
    # Get settings
    api_key = settings.LIVEKIT_API_KEY
    api_secret = settings.LIVEKIT_API_SECRET
    
    # Create token with expiration (1 hour)
    exp = int(time.time()) + 3600
    
    # Create claims
    claims = {
        'iss': api_key,
        'sub': user_identity,
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
    
    # Add admin privileges if needed
    if is_admin:
        claims['video'].update({
            'roomAdmin': True,
            'roomCreate': True
        })
    
    # Generate token
    token = jwt.encode(claims, api_secret, algorithm='HS256')
    
    return {
        'token': token,
        'room': room_name
    }

def create_livestream_room(request):
    """API view to create a LiveKit room and return token"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)
    
    try:
        # Get data
        import json
        data = json.loads(request.body)
        room_id = data.get('room_id', '')
        user_identity = data.get('user_identity', request.user.username)
        
        # Create token
        result = create_livestream_token(room_id, user_identity, is_admin=True)
        
        # Return response with token and room info
        return JsonResponse({
            'success': True,
            'token': result['token'],
            'room': result['room'],
            'ws_url': getattr(settings, 'LIVEKIT_WS_URL', f"wss://{settings.LIVEKIT_INSTANCE}")
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

def end_livestream_room(request):
    """Placeholder for ending a LiveKit room"""
    return JsonResponse({
        'success': True,
        'message': 'Livestream ended'
    })