# brainbox/myapp/livekit_integration.py

from livekitapi.models import LivekitRoom
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User
from django.http import JsonResponse
import uuid

def create_livestream_room(request_data, user):
    """
    Create a new LiveKit room for a teacher's livestream
    """
    try:
        # Generate a unique room name based on request data
        hub_name = request_data.get('hub_name', '')
        room_name = f"live-{hub_name}-{uuid.uuid4().hex[:8]}"
        
        # Create or get a LiveKit room
        room = LivekitRoom(
            description=f"Livestream for {hub_name}",
            slug=room_name[:10],  # LiveKit model has max 10 chars for slug
            owner=user,
            started=timezone.now(),
            scheduledEnd=timezone.now() + timezone.timedelta(hours=2),
            shareWithNextcloudGroup="default"  # This might need to be adjusted
        )
        room.save()
        
        # Generate a link for the teacher
        room_link = room.get_link_for_user(user)
        
        return {
            'success': True,
            'room': {
                'name': room.slug,
                'url': room_link,
                'room_id': room.id
            }
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def end_livestream_room(room_id, user):
    """
    End an active livestream room
    """
    try:
        room = get_object_or_404(LivekitRoom, id=room_id)
        
        # Check if user has permission to end this room
        if room.owner != user:
            return {'success': False, 'error': 'Permission denied'}
        
        # Mark the room as ended
        room.ended = timezone.now()
        room.save()
        
        # Stop recording if it's active
        if room.is_recording:
            room.stop_recording(user)
            
        return {'success': True}
    except Exception as e:
        return {'success': False, 'error': str(e)}