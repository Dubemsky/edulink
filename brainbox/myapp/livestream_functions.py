# brainbox/myapp/views_teachers.py or new file

from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
import json
from .livekit_integration import create_livestream_room, end_livestream_room






from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.conf import settings

# Import the simplified functions that don't depend on livekitapi
from .livekit_integration import create_livestream_room, end_livestream_room

@login_required
def teacher_livestream_view(request, room_id):
    """View for teacher livestream interface"""
    
    # Get LiveKit credentials from settings
    livekit_ws_url = getattr(settings, 'LIVEKIT_WS_URL', f"wss://{settings.LIVEKIT_INSTANCE}")
    
    # Room name based on room ID
    room_name = f"live-{room_id}"
    
    # Generate token for the room
    from .livekit_integration import create_livestream_token
    token_data = create_livestream_token(room_id, request.user.username, is_admin=True)
    
    # Prepare the context for the template
    context = {
        'room_id': room_id,
        'room_name': room_name,
        'token': token_data['token'],
        'ws_url': livekit_ws_url,
        'teacher_name': request.user.username
    }
    
    # Render the livestream template
    return render(request, 'myapp/teacher_livestream.html', context)







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
    


