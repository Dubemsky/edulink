import json
from django.http import JsonResponse
from django.views.decorators.http import require_POST, require_GET
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required

from .utils import create_room, generate_token, list_rooms, list_participants
from .config import DEFAULT_ROOM_SETTINGS

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
        
        # Create or get the room
        room = create_room(room_name, empty_timeout, max_participants)
        
        return JsonResponse({
            'success': True,
            'room': {
                'name': room.name,
                'sid': room.sid,
                'empty_timeout': room.empty_timeout,
                'max_participants': room.max_participants,
                'created_at': room.created_at,
            }
        })
    except Exception as e:
        print(f"This is the error that occured {e}\n\n")
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
        
        # Generate the token
        token = generate_token(room_name, participant_name, participant_identity, is_teacher)
        
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
        return JsonResponse({'success': False, 'error': str(e)})

@require_GET
@login_required
def get_room_participants(request):
    """Get all participants in a room"""
    try:
        room_name = request.GET.get('room_name')
        
        if not room_name:
            return JsonResponse({'success': False, 'error': 'Room name is required'})
        
        # Get participants
        participants = list_participants(room_name)
        
        return JsonResponse({
            'success': True,
            'room': room_name,
            'participants': [
                {
                    'identity': p.identity,
                    'state': p.state,
                    'joined_at': p.joined_at,
                    'is_publishing': len(p.tracks) > 0,
                }
                for p in participants
            ]
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

@require_GET
@login_required
def get_active_rooms(request):
    """Get all active LiveKit rooms"""
    try:
        # Only allow teachers to list all rooms
        if not hasattr(request.user, 'role') or request.user.role != 'teacher':
            return JsonResponse({'success': False, 'error': 'Unauthorized'})
        
        # Get rooms
        rooms = list_rooms()
        
        return JsonResponse({
            'success': True,
            'rooms': [
                {
                    'name': room.name,
                    'sid': room.sid,
                    'num_participants': room.num_participants,
                    'created_at': room.created_at,
                }
                for room in rooms
            ]
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})