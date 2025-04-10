# django_integration.py

from django.shortcuts import render
from django.http import JsonResponse, HttpResponse
from django.views.decorators.http import require_POST, require_GET
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
import json
import requests
import time
from datetime import datetime

# Import the LiveKit functions
from livekit_folder.views import create_livestream_room, get_join_token
from myapp.livestream import schedule_livestream, get_livestreams, cancel_livestream

def teachers_view_hub_room(request, room_id):
    """
    Render the hub room view for teachers with livestream functionality.
    """
    context = {
        'room_id': room_id,
        'current_teachers_name': request.session.get("teachers_name", "Unknown Teacher")
    }
    
    # Add the LiveKit client script to the context
    context['livekit_client_js'] = 'https://cdn.jsdelivr.net/npm/livekit-client/dist/livekit-client.umd.js'
    
    return render(request, 'myapp/teachers/teachers_view_hub_room.html', context)

def students_view_hub_room(request, room_id):
    """
    Render the hub room view for students with livestream viewer functionality.
    """
    context = {
        'room_id': room_id,
        'current_students_name': request.session.get("students_name", "Unknown Student")
    }
    
    # Add the LiveKit client script to the context
    context['livekit_client_js'] = 'https://cdn.jsdelivr.net/npm/livekit-client/dist/livekit-client.umd.js'
    
    return render(request, 'myapp/students/students_view_hub_room.html', context)

@require_POST
@csrf_exempt
def handle_livestream_creation(request):
    """
    Handle creating a LiveKit room and scheduling a livestream in one endpoint.
    """
    try:
        # Parse request data
        data = json.loads(request.body)
        
        # Step 1: Create LiveKit room
        livekit_response = create_livestream_room(request)
        livekit_data = json.loads(livekit_response.content)
        
        if not livekit_data.get('success'):
            return JsonResponse({
                'success': False,
                'error': livekit_data.get('error', 'Failed to create LiveKit room')
            })
        
        # Add LiveKit room info to the schedule data
        data['livekit_room'] = livekit_data['room']['name']
        
        # Step 2: Schedule the livestream in the database
        request._body = json.dumps(data).encode('utf-8')  # Update request body with LiveKit info
        livestream_response = schedule_livestream(request)
        livestream_data = json.loads(livestream_response.content)
        
        if not livestream_data.get('success'):
            return JsonResponse({
                'success': False,
                'error': livestream_data.get('error', 'Failed to schedule livestream')
            })
        
        # Return combined success response
        return JsonResponse({
            'success': True,
            'livestream_id': livestream_data.get('livestream_id'),
            'livekit_room': livekit_data['room']['name'],
            'message': 'Livestream created successfully'
        })
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

@require_GET
def check_active_livestreams(request):
    """
    Check if there are any active livestreams for a specific room.
    """
    try:
        room_id = request.GET.get('room_id')
        
        if not room_id:
            return JsonResponse({'success': False, 'error': 'Room ID is required'})
        
        # Get all livestreams for the room
        livestreams_response = get_livestreams(request)
        livestreams_data = json.loads(livestreams_response.content)
        
        # Check for active livestreams (status = 'live')
        active_livestreams = []
        if livestreams_data.get('success') and livestreams_data.get('livestreams'):
            active_livestreams = [
                stream for stream in livestreams_data['livestreams']
                if stream.get('status') == 'live'
            ]
        
        return JsonResponse({
            'success': True,
            'has_active_livestreams': len(active_livestreams) > 0,
            'active_livestreams': active_livestreams
        })
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

@require_POST
@csrf_exempt
def end_livestream(request):
    """
    End an active livestream.
    """
    try:
        data = json.loads(request.body)
        livestream_id = data.get('livestream_id')
        
        if not livestream_id:
            return JsonResponse({'success': False, 'error': 'Livestream ID is required'})
        
        # Cancel the livestream in the database
        cancel_response = cancel_livestream(request)
        cancel_data = json.loads(cancel_response.content)
        
        return JsonResponse({
            'success': cancel_data.get('success', False),
            'message': cancel_data.get('message', 'Unknown error'),
            'error': cancel_data.get('error')
        })
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

