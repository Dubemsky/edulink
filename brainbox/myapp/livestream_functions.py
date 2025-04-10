# brainbox/myapp/views_teachers.py or new file

from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
import json
from .livekit_integration import create_livestream_room, end_livestream_room

@login_required
@require_POST
def start_teacher_livestream(request):
    """Handle the 'Go Live' button click from teacher dashboard"""
    try:
        data = json.loads(request.body)
        
        # Get hub information from request
        hub_name = data.get('hub_name', '')
        if not hub_name:
            return JsonResponse({'success': False, 'error': 'Hub name is required'})
        
        # Create a LiveKit room for streaming
        result = create_livestream_room(data, request.user)
        
        return JsonResponse(result)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

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