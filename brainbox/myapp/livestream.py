"""
Livestreaming functionality for EduLink using Agora and Firebase.
"""
import json
import time
import random
import string
import requests
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from django.contrib.auth.decorators import login_required

from .firebase import db, auth, firestore  # Import Firebase components

# Agora configuration - replace with your Agora app details
AGORA_APP_ID = "87aeb278aa8848bab0b629a91e053db2"
AGORA_APP_CERTIFICATE = "56facf85182849ada0e83568ec6465b3"
AGORA_REST_API_URL = "https://api.agora.io/v1"

def generate_rtc_token(channel_name, uid, role, expire_time_in_seconds=3600):
    """
    Generate a token for Agora RTC using their REST API.
    """
    try:
        import agora_token_builder
        # Token expiration time
        expiration_time_in_seconds = int(time.time()) + expire_time_in_seconds
        
        # Generate the token
        token = agora_token_builder.RtcTokenBuilder.buildTokenWithUid(
            AGORA_APP_ID,
            AGORA_APP_CERTIFICATE,
            channel_name,
            uid,
            role,
            expiration_time_in_seconds
        )
        
        return token
    except Exception as e:
        print(f"Error generating Agora token: {e}")
        return None

def generate_stream_id():
    """Generate a unique stream ID."""
    timestamp = int(time.time())
    random_chars = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
    return f"stream_{timestamp}_{random_chars}"

@csrf_exempt
def start_livestream(request):
    """
    Start a new livestream. This endpoint handles the teacher's request to go live.
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST method is allowed'})
    
    try:
        data = json.loads(request.body)
        teacher_id = data.get('teacher_id')
        room_id = data.get('room_id')
        title = data.get('title', 'Untitled Livestream')
        notify_students = data.get('notify_students', True)
        
        if not teacher_id or not room_id:
            return JsonResponse({'success': False, 'error': 'Missing required fields'})
        
        # Generate a unique stream ID/channel name
        stream_id = generate_stream_id()
        channel_name = f"{room_id}_{stream_id}"
        
        # Generate Agora token
        import agora_token_builder
        token = generate_rtc_token(
            channel_name=channel_name,
            uid=0,  # Use 0 for the host
            role=agora_token_builder.RtcTokenBuilder.RolePublisher
        )
        
        if not token:
            return JsonResponse({'success': False, 'error': 'Failed to generate streaming token'})
        
        # Store stream data in Firebase
        stream_ref = db.collection('livestreams').document(stream_id)
        stream_data = {
            'stream_id': stream_id,
            'channel_name': channel_name,
            'room_id': room_id,
            'teacher_id': teacher_id,
            'title': title,
            'status': 'live',
            'started_at': firestore.SERVER_TIMESTAMP,
            'viewer_count': 0,
            'token': token,  # Store token for validation purposes
        }
        stream_ref.set(stream_data)
        
        # Update the room to indicate there's an active livestream
        room_ref = db.collection('hub_rooms').document(room_id)
        room_ref.update({
            'has_active_livestream': True,
            'active_stream_id': stream_id
        })
        
        # If notification is enabled, store notifications for all students in the room
        if notify_students:
            # Get all students in the room
            students_query = db.collection('room_members').where('room_id', '==', room_id).stream()
            
            for student_doc in students_query:
                student_data = student_doc.to_dict()
                student_id = student_data.get('user_id')
                
                if student_id and student_id != teacher_id:  # Don't notify the teacher
                    notification_ref = db.collection('notifications').document()
                    notification_ref.set({
                        'user_id': student_id,
                        'type': 'livestream_started',
                        'room_id': room_id,
                        'stream_id': stream_id,
                        'title': title,
                        'sender_id': teacher_id,
                        'read': False,
                        'created_at': firestore.SERVER_TIMESTAMP
                    })
        
        # Return success response with necessary data for the client
        return JsonResponse({
            'success': True,
            'stream_id': stream_id,
            'channel_name': channel_name,
            'token': token,
            'app_id': AGORA_APP_ID
        })
        
    except Exception as e:
        print(f"Error starting livestream: {e}")
        return JsonResponse({'success': False, 'error': str(e)})

@csrf_exempt
def end_livestream(request):
    """
    End an active livestream.
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST method is allowed'})
    
    try:
        data = json.loads(request.body)
        stream_id = data.get('stream_id')
        teacher_id = data.get('teacher_id')
        
        if not stream_id or not teacher_id:
            return JsonResponse({'success': False, 'error': 'Missing required fields'})
        
        # Verify the teacher owns this stream
        stream_ref = db.collection('livestreams').document(stream_id)
        stream_doc = stream_ref.get()
        
        if not stream_doc.exists:
            return JsonResponse({'success': False, 'error': 'Stream not found'})
        
        stream_data = stream_doc.to_dict()
        
        if stream_data.get('teacher_id') != teacher_id:
            return JsonResponse({'success': False, 'error': 'Unauthorized to end this stream'})
        
        # Update stream status
        stream_ref.update({
            'status': 'ended',
            'ended_at': firestore.SERVER_TIMESTAMP,
            'duration': firestore.Increment(1)  # This will be updated with correct duration on client side
        })
        
        # Update the room to indicate there's no active livestream
        room_id = stream_data.get('room_id')
        if room_id:
            room_ref = db.collection('hub_rooms').document(room_id)
            room_ref.update({
                'has_active_livestream': False,
                'active_stream_id': None
            })
        
        return JsonResponse({'success': True})
        
    except Exception as e:
        print(f"Error ending livestream: {e}")
        return JsonResponse({'success': False, 'error': str(e)})

@csrf_exempt
def join_livestream(request):
    """
    Join an existing livestream as a viewer.
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST method is allowed'})
    
    try:
        data = json.loads(request.body)
        stream_id = data.get('stream_id')
        user_id = data.get('user_id')
        
        if not stream_id or not user_id:
            return JsonResponse({'success': False, 'error': 'Missing required fields'})
        
        # Check if stream exists and is active
        stream_ref = db.collection('livestreams').document(stream_id)
        stream_doc = stream_ref.get()
        
        if not stream_doc.exists:
            return JsonResponse({'success': False, 'error': 'Stream not found'})
        
        stream_data = stream_doc.to_dict()
        
        if stream_data.get('status') != 'live':
            return JsonResponse({'success': False, 'error': 'Stream is not active'})
        
        # Generate a viewer token
        import agora_token_builder
        channel_name = stream_data.get('channel_name')
        
        # Generate a unique UID for this viewer
        viewer_uid = int(time.time()) % 100000 + random.randint(1, 1000)
        
        token = generate_rtc_token(
            channel_name=channel_name,
            uid=viewer_uid,
            role=agora_token_builder.RtcTokenBuilder.RoleSubscriber
        )
        
        if not token:
            return JsonResponse({'success': False, 'error': 'Failed to generate viewer token'})
        
        # Track viewer in Firebase
        viewer_ref = db.collection('livestream_viewers').document()
        viewer_ref.set({
            'stream_id': stream_id,
            'user_id': user_id,
            'joined_at': firestore.SERVER_TIMESTAMP,
            'uid': viewer_uid
        })
        
        # Increment viewer count
        stream_ref.update({
            'viewer_count': firestore.Increment(1)
        })
        
        # Return necessary data for the client to join
        return JsonResponse({
            'success': True,
            'channel_name': channel_name,
            'token': token,
            'uid': viewer_uid,
            'app_id': AGORA_APP_ID,
            'stream_details': {
                'title': stream_data.get('title'),
                'teacher_id': stream_data.get('teacher_id'),
                'started_at': stream_data.get('started_at')
            }
        })
        
    except Exception as e:
        print(f"Error joining livestream: {e}")
        return JsonResponse({'success': False, 'error': str(e)})

@csrf_exempt
def get_active_streams(request):
    """
    Get all active livestreams for a specific room.
    """
    room_id = request.GET.get('room_id')
    
    if not room_id:
        return JsonResponse({'success': False, 'error': 'Room ID is required'})
    
    try:
        # Query Firebase for active streams in this room
        streams_query = db.collection('livestreams').where('room_id', '==', room_id).where('status', '==', 'live').stream()
        
        active_streams = []
        for stream_doc in streams_query:
            stream_data = stream_doc.to_dict()
            # Remove sensitive data
            if 'token' in stream_data:
                del stream_data['token']
            
            active_streams.append(stream_data)
        
        return JsonResponse({
            'success': True,
            'streams': active_streams
        })
        
    except Exception as e:
        print(f"Error getting active streams: {e}")
        return JsonResponse({'success': False, 'error': str(e)})

@csrf_exempt
def schedule_livestream(request):
    """
    Schedule a future livestream.
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST method is allowed'})
    
    try:
        data = json.loads(request.body)
        teacher_id = data.get('teacher_id')
        room_id = data.get('room_id')
        title = data.get('title')
        description = data.get('description', '')
        scheduled_time = data.get('scheduled_time')  # Expected as ISO string
        duration_minutes = data.get('duration', 60)
        notify_students = data.get('notify_students', True)
        
        if not all([teacher_id, room_id, title, scheduled_time]):
            return JsonResponse({'success': False, 'error': 'Missing required fields'})
        
        # Generate a unique ID for the scheduled stream
        schedule_id = f"scheduled_{int(time.time())}_{random.randint(1000, 9999)}"
        
        # Store in Firebase
        schedule_ref = db.collection('scheduled_livestreams').document(schedule_id)
        schedule_data = {
            'id': schedule_id,
            'room_id': room_id,
            'teacher_id': teacher_id,
            'title': title,
            'description': description,
            'scheduled_time': scheduled_time,
            'duration_minutes': duration_minutes,
            'created_at': firestore.SERVER_TIMESTAMP,
            'status': 'scheduled'
        }
        schedule_ref.set(schedule_data)
        
        # Notify students if enabled
        if notify_students:
            # Get all students in the room
            students_query = db.collection('room_members').where('room_id', '==', room_id).stream()
            
            for student_doc in students_query:
                student_data = student_doc.to_dict()
                student_id = student_data.get('user_id')
                
                if student_id and student_id != teacher_id:
                    notification_ref = db.collection('notifications').document()
                    notification_ref.set({
                        'user_id': student_id,
                        'type': 'livestream_scheduled',
                        'room_id': room_id,
                        'schedule_id': schedule_id,
                        'title': title,
                        'scheduled_time': scheduled_time,
                        'sender_id': teacher_id,
                        'read': False,
                        'created_at': firestore.SERVER_TIMESTAMP
                    })
        
        return JsonResponse({
            'success': True,
            'schedule_id': schedule_id
        })
        
    except Exception as e:
        print(f"Error scheduling livestream: {e}")
        return JsonResponse({'success': False, 'error': str(e)})

@csrf_exempt
def get_scheduled_streams(request):
    """
    Get scheduled livestreams for a room.
    """
    room_id = request.GET.get('room_id')
    
    if not room_id:
        return JsonResponse({'success': False, 'error': 'Room ID is required'})
    
    try:
        # Query Firebase for scheduled streams in this room
        current_time = timezone.now().isoformat()
        
        # Get upcoming streams (scheduled time is after current time)
        upcoming_query = db.collection('scheduled_livestreams') \
                           .where('room_id', '==', room_id) \
                           .where('status', '==', 'scheduled') \
                           .where('scheduled_time', '>=', current_time) \
                           .stream()
        
        # Get past streams (scheduled time is before current time or status is completed)
        past_query = db.collection('scheduled_livestreams') \
                       .where('room_id', '==', room_id) \
                       .where('status', 'in', ['completed', 'cancelled']) \
                       .stream()
        
        upcoming_streams = []
        past_streams = []
        
        for stream_doc in upcoming_query:
            upcoming_streams.append(stream_doc.to_dict())
            
        for stream_doc in past_query:
            past_streams.append(stream_doc.to_dict())
        
        return JsonResponse({
            'success': True,
            'upcoming_streams': upcoming_streams,
            'past_streams': past_streams
        })
        
    except Exception as e:
        print(f"Error getting scheduled streams: {e}")
        return JsonResponse({'success': False, 'error': str(e)})

@csrf_exempt
def cancel_scheduled_stream(request):
    """
    Cancel a scheduled livestream.
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST method is allowed'})
    
    try:
        data = json.loads(request.body)
        schedule_id = data.get('schedule_id')
        teacher_id = data.get('teacher_id')
        
        if not schedule_id or not teacher_id:
            return JsonResponse({'success': False, 'error': 'Missing required fields'})
        
        # Verify the teacher owns this scheduled stream
        schedule_ref = db.collection('scheduled_livestreams').document(schedule_id)
        schedule_doc = schedule_ref.get()
        
        if not schedule_doc.exists:
            return JsonResponse({'success': False, 'error': 'Scheduled stream not found'})
        
        schedule_data = schedule_doc.to_dict()
        
        if schedule_data.get('teacher_id') != teacher_id:
            return JsonResponse({'success': False, 'error': 'Unauthorized to cancel this stream'})
        
        # Update status to cancelled
        schedule_ref.update({
            'status': 'cancelled',
            'cancelled_at': firestore.SERVER_TIMESTAMP
        })
        
        return JsonResponse({'success': True})
        
    except Exception as e:
        print(f"Error cancelling scheduled stream: {e}")
        return JsonResponse({'success': False, 'error': str(e)})
    