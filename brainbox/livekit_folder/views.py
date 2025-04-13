# livekit_folder/views.py

import json
import jwt
import time
import uuid
from django.http import JsonResponse
from django.views.decorators.http import require_POST, require_GET
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
import requests
from django.shortcuts import render

from .config import (
    LIVEKIT_API_KEY, 
    LIVEKIT_API_SECRET, 
    LIVEKIT_API_URL, 
    DEFAULT_ROOM_SETTINGS,
    DEFAULT_TOKEN_TTL
)

@require_POST
@csrf_exempt
def create_livestream_room(request):
    """Create a new LiveKit room for livestreaming"""
    try:
        data = json.loads(request.body)
        room_name = data.get('room_name')
        
        if not room_name:
            return JsonResponse({'success': False, 'error': 'Room name is required'})
        
        # Add prefix to distinguish livestream rooms
        if not room_name.startswith('live-'):
            room_name = f"live-{room_name}"
        
        empty_timeout = data.get('empty_timeout', DEFAULT_ROOM_SETTINGS['empty_timeout'])
        max_participants = data.get('max_participants', DEFAULT_ROOM_SETTINGS['max_participants'])
        
        # Create JWT token for API access
        at = int(time.time())
        exp = at + 60  # Token valid for 1 minute
        
        # In the create_livestream_room function:
        api_token = jwt.encode({
            'iss': LIVEKIT_API_KEY,  # Make sure this matches your key exactly
            'exp': exp,
            'nbf': at,
            'video': {
                'room_create': True,
            }
        }, LIVEKIT_API_SECRET, algorithm='HS256')
        
        # Create the room using LiveKit API
        headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }
        
        room_data = {
            "name": room_name,
            "empty_timeout": empty_timeout,
            "max_participants": max_participants,
        }
        
        # Try to create a room, if it exists, the API will return the existing room
        response = requests.post(
            f"{LIVEKIT_API_URL}/twirp/livekit.RoomService/CreateRoom",
            headers=headers,
            json=room_data
        )
        
        if response.status_code != 200:
            print(f"LiveKit API error: {response.text}")
            return JsonResponse({'success': False, 'error': f"LiveKit API error: {response.text}"})
        
        room_response = response.json()
        
        return JsonResponse({
            'success': True,
            'room': {
                'name': room_response.get('name'),
                'sid': room_response.get('sid'),
                'empty_timeout': room_response.get('empty_timeout'),
                'max_participants': room_response.get('max_participants'),
                'created_at': int(time.time()),
            }
        })
    except Exception as e:
        print(f"Error creating LiveKit room: {e}")
        return JsonResponse({'success': False, 'error': str(e)})

@require_POST
@csrf_exempt
def get_join_token(request):
    """Get a token to join a LiveKit room"""
    try:
        data = json.loads(request.body)
        room_name = data.get('room_name')
        participant_name = data.get('participant_name')
        participant_identity = data.get('participant_identity', participant_name)
        is_teacher = data.get('is_teacher', False)
        
        if not room_name or not participant_name:
            return JsonResponse({
                'success': False, 
                'error': 'Room name and participant name are required'
            })
        
        # Token expiration time
        exp = int(time.time()) + DEFAULT_TOKEN_TTL
        
        # Define claims for the token
        claims = {
            'iss': LIVEKIT_API_KEY,
            'sub': participant_identity,
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
        
        # Add additional permissions for teachers
        if is_teacher:
            claims['video'].update({
                'roomCreate': True,
                'roomList': True,
                'roomAdmin': True,
                'roomRecord': True
            })
        
        # Generate the JWT token
        token = jwt.encode(claims, LIVEKIT_API_SECRET, algorithm='HS256')
        
        # Some jwt libraries return bytes, ensure we return a string
        if isinstance(token, bytes):
            token = token.decode('utf-8')
        
        return JsonResponse({
            'success': True,
            'token': token,
            'room': room_name,
            'participant': {
                'name': participant_name,
                'identity': participant_identity,
                'is_teacher': is_teacher
            }
        })
    except Exception as e:
        print(f"Error generating LiveKit token: {e}")
        return JsonResponse({'success': False, 'error': str(e)})

@require_GET
@login_required
def get_room_participants(request):
    """Get all participants in a room"""
    try:
        room_name = request.GET.get('room_name')
        
        if not room_name:
            return JsonResponse({'success': False, 'error': 'Room name is required'})
        
        # Create JWT token for API access
        at = int(time.time())
        exp = at + 60  # Token valid for 1 minute
        
        api_token = jwt.encode({
            'iss': LIVEKIT_API_KEY,
            'exp': exp,
            'nbf': at,
            'video': {
                'room_admin': True,
            }
        }, LIVEKIT_API_SECRET, algorithm='HS256')
        
        # Get participants from LiveKit API
        headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }
        
        response = requests.post(
            f"{LIVEKIT_API_URL}/twirp/livekit.RoomService/ListParticipants",
            headers=headers,
            json={"room": room_name}
        )
        
        if response.status_code != 200:
            print(f"LiveKit API error: {response.text}")
            return JsonResponse({'success': False, 'error': f"LiveKit API error: {response.text}"})
        
        participants_response = response.json()
        
        participants = []
        for participant in participants_response.get('participants', []):
            participants.append({
                'identity': participant.get('identity'),
                'name': participant.get('name'),
                'state': participant.get('state'),
                'joined_at': participant.get('joined_at'),
                'is_publishing': bool(participant.get('tracks', [])),
            })
        
        return JsonResponse({
            'success': True,
            'room': room_name,
            'participants': participants
        })
    except Exception as e:
        print(f"Error getting room participants: {e}")
        return JsonResponse({'success': False, 'error': str(e)})

@require_GET
@login_required
def get_active_rooms(request):
    """Get all active LiveKit rooms"""
    try:
        # Create JWT token for API access
        at = int(time.time())
        exp = at + 60  # Token valid for 1 minute
        
        api_token = jwt.encode({
            'iss': LIVEKIT_API_KEY,
            'exp': exp,
            'nbf': at,
            'video': {
                'room_list': True,
            }
        }, LIVEKIT_API_SECRET, algorithm='HS256')
        
        # Get rooms from LiveKit API
        headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }
        
        response = requests.post(
            f"{LIVEKIT_API_URL}/twirp/livekit.RoomService/ListRooms",
            headers=headers,
            json={}
        )
        
        if response.status_code != 200:
            print(f"LiveKit API error: {response.text}")
            return JsonResponse({'success': False, 'error': f"LiveKit API error: {response.text}"})
        
        rooms_response = response.json()
        
        rooms = []
        for room in rooms_response.get('rooms', []):
            rooms.append({
                'name': room.get('name'),
                'sid': room.get('sid'),
                'num_participants': room.get('num_participants', 0),
                'created_at': room.get('created_at'),
            })
        
        return JsonResponse({
            'success': True,
            'rooms': rooms
        })
    except Exception as e:
        print(f"Error getting active rooms: {e}")
        return JsonResponse({'success': False, 'error': str(e)})
    


@login_required
def teacher_livestream(request, room_id):
    """View for teacher livestream room"""
    try:
        # Get LiveKit credentials from settings
        api_key = "APIRsaxCuofVw7K"
        api_secret = "ZnrqffqzbGqyHdGqGGjTfL2I1fOGMMKSIK7Htqb11NDC"
        livekit_instance = "edulink-oxkw0h5q.livekit.cloud"

        # Create a room name based on the hub room ID
        room_name = f"live-{room_id}"
        
        # Generate a token for the teacher with more permissions
        import jwt
        import time
        import uuid
        
        # Token expiration time (1 hour)
        exp = int(time.time()) + 3600
        
        # Create claims for the token with full teacher permissions
        claims = {
            'iss': api_key,
            'sub': request.user.username,
            'exp': exp,
            'nbf': int(time.time()),
            'jti': str(uuid.uuid4()),
            'video': {
                'room': room_name,
                'roomJoin': True,
                'canPublish': True,
                'canSubscribe': True,
                'canPublishData': True,
                'roomAdmin': True,
                'roomCreate': True,
                'canPublishSources': ['camera', 'microphone', 'screen_share', 'screen_share_audio']
            }
        }
        
        # Generate the token
        token = jwt.encode(claims, api_secret, algorithm='HS256')
        if isinstance(token, bytes):
            token = token.decode('utf-8')
        
        # Create WebSocket URL for LiveKit
        ws_url = f"wss://{livekit_instance}"
        
        # Return template with all necessary context
        return render(request, 'livekit_folder/teacher_livestream.html', {
            'room_name': room_name,
            'room_url': f"https://{livekit_instance}?token={token}",
            'token': token,
            'ws_url': ws_url,
            'teacher_name': request.user.username,
            'slug': room_name,
            'title': f"Live Class: {room_name}"
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse(f"Error setting up livestream: {str(e)}", status=500)