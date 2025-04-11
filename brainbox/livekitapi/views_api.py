from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from .models import LivekitRoom

@login_required
def create_room(request):
    """API endpoint to create a new LiveKit room from the teacher interface"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)
    
    try:
        # Parse the request data
        import json
        data = json.loads(request.body)
        
        room_name = data.get('room_name', f'room-{timezone.now().timestamp()}')
        description = data.get('description', 'Created from teacher interface')
        
        # Create a new room
        room = LivekitRoom()
        room.description = description
        room.owner = request.user
        room.shareWithNextcloudGroup = "default-group"  # This might need to be configured
        room.save()
        
        # Return the room details
        return JsonResponse({
            'success': True,
            'room': {
                'id': room.id,
                'slug': room.slug,
                'description': room.description,
                'is_open': room.is_open,
            }
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
def end_stream(request, slug):
    """API endpoint to end a livestream"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)
    
    try:
        # Get the room
        room = LivekitRoom.objects.get(slug=slug)
        
        # Check if the user is allowed to end this stream
        if not room.user_can_record(request.user):
            return JsonResponse({'success': False, 'error': 'Permission denied'}, status=403)
        
        # If the room is recording, stop it
        if room.is_recording:
            room.stop_recording(request.user)
        
        # Set the room as ended
        room.ended = timezone.now()
        room.save()
        
        return JsonResponse({'success': True})
    except LivekitRoom.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Room not found'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)