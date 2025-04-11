# livekitapi/livekit_direct.py

import jwt
import time
import uuid
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings

@csrf_exempt
def get_livekit_url(request):
    """Generate a LiveKit URL directly without using the database model"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)
    
    try:
        import json
        data = json.loads(request.body)
        
        room_name = data.get('room_name', f'room-{time.time()}')
        user_name = data.get('user_name', 'anonymous')
        
        # Use your LiveKit credentials from settings or hardcode for testing
        api_key = "APIRsaxCuofVw7K"  # Replace with your actual key if needed
        api_secret = "ZnrqffqzbGqyHdGqGGjTfL2I1fOGMMKSIK7Htqb11NDC"  # Replace with your actual secret if needed
        livekit_instance = "edulink-oxkw0h5q.livekit.cloud"  # Replace with your actual instance
        
        # Create token with admin permissions
        exp = int(time.time()) + 3600  # 1 hour expiration
        claims = {
            'iss': api_key,
            'sub': user_name,
            'exp': exp,
            'nbf': int(time.time()),
            'jti': str(uuid.uuid4()),
            'video': {
                'room': room_name,
                'roomJoin': True,
                'canPublish': True,
                'canSubscribe': True,
                'roomAdmin': True,
                'roomCreate': True
            }
        }
        
        token = jwt.encode(claims, api_secret, algorithm='HS256')
        if isinstance(token, bytes):
            token = token.decode('utf-8')
        
        ws_url = f"wss://{livekit_instance}"
        room_url = f"https://{livekit_instance}/custom?liveKitUrl={ws_url}&token={token}"
        
        return JsonResponse({
            'success': True,
            'room': {
                'slug': room_name,
                'url': room_url,
                'token': token,
                'ws_url': ws_url,
            }
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)}, status=500)