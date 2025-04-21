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
    Updated to handle cases where the hub_rooms document doesn't exist yet.
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
            role=1
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
        
        # Check if hub_rooms document exists, create if it doesn't
        room_ref = db.collection('hub_rooms').document(room_id)
        room_doc = room_ref.get()
        
        if room_doc.exists:
            # Update existing document
            room_ref.update({
                'has_active_livestream': True,
                'active_stream_id': stream_id
            })
        else:
            # Create new document with livestream info
            room_ref.set({
                'room_id': room_id,
                'has_active_livestream': True,
                'active_stream_id': stream_id,
                'created_at': firestore.SERVER_TIMESTAMP
            })
        
        if notify_students:
            from .models import Students_joined_hub, Teachers_created_hub
            try:
                # Get the hub using room_id
                hub = Teachers_created_hub.objects.get(room_url=room_id)
                
                # Get all students in this room 
                students = Students_joined_hub.objects.filter(hub=hub)
                
                for student in students:
                    student_id = student.student
                    
                    if student_id != teacher_id:  # Only notify students, not the teacher
                        notification_ref = db.collection('notifications').document()
                        notification_ref.set({
                            'user_id': student_id,
                            'username': student_id,
                            'type': 'livestream_started',
                            'room_id': room_id,
                            'stream_id': stream_id,
                            'title': title,
                            'sender_id': teacher_id,
                            'read': False,
                            'created_at': firestore.SERVER_TIMESTAMP,
                            'message': f"Livestream started: {title}"
                        })
            except Teachers_created_hub.DoesNotExist:
                print(f"Error: Hub with room_url {room_id} does not exist")
            except Exception as e:
                print(f"Error sending livestream notifications: {e}")
        
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
    End an active livestream. Updated to handle cases where the hub_rooms document doesn't exist.
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
            room_doc = room_ref.get()
            
            if room_doc.exists:
                # Only update if document exists
                room_ref.update({
                    'has_active_livestream': False,
                    'active_stream_id': None
                })
            # If document doesn't exist, no need to update it
        
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
def leave_livestream(request):
    """
    Handle when a viewer leaves a livestream.
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST method is allowed'})
    
    try:
        data = json.loads(request.body)
        stream_id = data.get('stream_id')
        user_id = data.get('user_id')
        
        if not stream_id or not user_id:
            return JsonResponse({'success': False, 'error': 'Missing required fields'})
        
        # Check if stream exists
        stream_ref = db.collection('livestreams').document(stream_id)
        stream_doc = stream_ref.get()
        
        if not stream_doc.exists:
            return JsonResponse({'success': False, 'error': 'Stream not found'})
        
        # Find the viewer record
        viewers_query = db.collection('livestream_viewers') \
                         .where('stream_id', '==', stream_id) \
                         .where('user_id', '==', user_id) \
                         .limit(1) \
                         .stream()
        
        viewer_docs = list(viewers_query)
        
        if viewer_docs:
            # Update the viewer record with left_at timestamp
            viewer_ref = db.collection('livestream_viewers').document(viewer_docs[0].id)
            viewer_ref.update({
                'left_at': firestore.SERVER_TIMESTAMP,
                'is_active': False
            })
            
            # Decrement viewer count
            stream_ref.update({
                'viewer_count': firestore.Increment(-1)
            })
            
            return JsonResponse({'success': True})
        else:
            return JsonResponse({'success': False, 'error': 'Viewer record not found'})
        
    except Exception as e:
        print(f"Error leaving livestream: {e}")
        return JsonResponse({'success': False, 'error': str(e)})

@csrf_exempt
def get_stream_viewers(request):
    """
    Get all active viewers for a specific livestream.
    """
    stream_id = request.GET.get('stream_id')
    
    if not stream_id:
        return JsonResponse({'success': False, 'error': 'Stream ID is required'})
    
    try:
        # Verify the stream exists
        stream_ref = db.collection('livestreams').document(stream_id)
        stream_doc = stream_ref.get()
        
        if not stream_doc.exists:
            return JsonResponse({'success': False, 'error': 'Stream not found'})
        
        # Query Firebase for active viewers in this stream
        viewers_query = db.collection('livestream_viewers') \
                         .where('stream_id', '==', stream_id) \
                         .where('is_active', '==', True) \
                         .stream()
        
        viewers = []
        for viewer_doc in viewers_query:
            viewer_data = viewer_doc.to_dict()
            
            # Add the user details if needed (you might want to fetch user profiles here)
            # For example, if you have user profiles in Firebase or Django models
            try:
                # This assumes you have a User model in Django that can be queried by user_id
                from django.contrib.auth import get_user_model
                User = get_user_model()
                user = User.objects.get(username=viewer_data.get('user_id'))
                
                # Add basic user info to viewer data
                viewer_data['display_name'] = f"{user.first_name} {user.last_name}"
                viewer_data['profile_pic'] = user.profile.profile_pic.url if hasattr(user, 'profile') and user.profile.profile_pic else None
            except Exception as e:
                # If user details can't be fetched, continue with base data
                print(f"Error fetching user details: {e}")
                viewer_data['display_name'] = viewer_data.get('user_id')
                viewer_data['profile_pic'] = None
            
            viewers.append(viewer_data)
        
        # Get the stream details
        stream_data = stream_doc.to_dict()
        # Remove sensitive data
        if 'token' in stream_data:
            del stream_data['token']
        
        return JsonResponse({
            'success': True,
            'stream': stream_data,
            'viewers': viewers,
            'viewer_count': len(viewers)
        })
        
    except Exception as e:
        print(f"Error getting stream viewers: {e}")
        return JsonResponse({'success': False, 'error': str(e)})

@csrf_exempt
def schedule_livestream(request):
    """
    Schedule a future livestream. Updated to use Django models for notifications.
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
        
        # Notify students if enabled, using Django models
        if notify_students:
            from .models import Students_joined_hub, Teachers_created_hub
            try:
                # Get the hub using room_id
                hub = Teachers_created_hub.objects.get(room_url=room_id)
                
                # Get all students in this room using the Django model
                students = Students_joined_hub.objects.filter(hub=hub)
                
                for student in students:
                    student_id = student.student
                    
                    # Skip if this is the teacher
                    if student_id != teacher_id:
                        notification_ref = db.collection('notifications').document()
                        notification_ref.set({
                            'user_id': student_id,
                            'username': student_id,
                            'type': 'livestream_scheduled',
                            'room_id': room_id,
                            'schedule_id': schedule_id,
                            'title': title,
                            'scheduled_time': scheduled_time,
                            'sender_id': teacher_id,
                            'read': False,
                            'created_at': firestore.SERVER_TIMESTAMP,
                            'message': f"Livestream scheduled: {title} on {scheduled_time}"
                        })
            except Teachers_created_hub.DoesNotExist:
                print(f"Error: Hub with room_url {room_id} does not exist")
            except Exception as e:
                print(f"Error sending livestream notifications: {e}")
        
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
    Cancel a scheduled livestream. Updated to use Django models for notifications.
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
        
        # Get the room_id before updating the status
        room_id = schedule_data.get('room_id')
        title = schedule_data.get('title', 'Unnamed Stream')
        
        # Update status to cancelled
        schedule_ref.update({
            'status': 'cancelled',
            'cancelled_at': firestore.SERVER_TIMESTAMP
        })
        
        # Notify students about cancellation using Django models
        from .models import Students_joined_hub, Teachers_created_hub
        try:
            # Get the hub using room_id
            hub = Teachers_created_hub.objects.get(room_url=room_id)
            
            # Get all students in this room using the Django model
            students = Students_joined_hub.objects.filter(hub=hub)
            
            for student in students:
                student_id = student.student
                
                # Skip if this is the teacher
                if student_id != teacher_id:
                    notification_ref = db.collection('notifications').document()
                    notification_ref.set({
                        'user_id': student_id,
                        'username': student_id,
                        'type': 'livestream_cancelled',
                        'room_id': room_id,
                        'schedule_id': schedule_id,
                        'title': title,
                        'sender_id': teacher_id,
                        'read': False,
                        'created_at': firestore.SERVER_TIMESTAMP,
                        'message': f"Livestream cancelled: {title}"
                    })
        except Teachers_created_hub.DoesNotExist:
            print(f"Error: Hub with room_url {room_id} does not exist")
        except Exception as e:
            print(f"Error sending livestream cancellation notifications: {e}")
        
        return JsonResponse({'success': True})
        
    except Exception as e:
        print(f"Error cancelling scheduled stream: {e}")
        return JsonResponse({'success': False, 'error': str(e)})
    

"""
Add these functions to your livestream.py file to handle the additional
messaging functionality for the livestream feature.
"""

@csrf_exempt
def livestream_message(request):
    """
    Handle livestream messages (chat and questions) between teachers and students.
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST method is allowed'})
    
    try:
        data = json.loads(request.body)
        message_type = data.get('type')  # 'chat' or 'question'
        sender_id = data.get('sender_id')
        room_id = data.get('room_id')
        stream_id = data.get('stream_id')
        content = data.get('content')
        
        if not all([message_type, sender_id, room_id, stream_id, content]):
            return JsonResponse({'success': False, 'error': 'Missing required fields'})
        
        # Verify the stream exists and is active
        stream_ref = db.collection('livestreams').document(stream_id)
        stream_doc = stream_ref.get()
        
        if not stream_doc.exists:
            return JsonResponse({'success': False, 'error': 'Stream not found'})
            
        stream_data = stream_doc.to_dict()
        if stream_data.get('status') != 'live':
            return JsonResponse({'success': False, 'error': 'Stream is not active'})
        
        # Create a message record in Firebase
        message_ref = db.collection('livestream_messages').document()
        message_data = {
            'type': message_type,
            'sender_id': sender_id,
            'room_id': room_id,
            'stream_id': stream_id,
            'content': content,
            'created_at': firestore.SERVER_TIMESTAMP
        }
        message_ref.set(message_data)
        
        # Add the message ID to the data
        message_data['message_id'] = message_ref.id
        
        return JsonResponse({
            'success': True,
            'message': message_data
        })
        
    except Exception as e:
        print(f"Error handling livestream message: {e}")
        return JsonResponse({'success': False, 'error': str(e)})

@csrf_exempt
def get_livestream_messages(request):
    """
    Get all messages for a specific livestream.
    """
    stream_id = request.GET.get('stream_id')
    last_message_id = request.GET.get('last_message_id')  # For pagination
    
    if not stream_id:
        return JsonResponse({'success': False, 'error': 'Stream ID is required'})
    
    try:
        # Query Firebase for messages in this stream
        messages_ref = db.collection('livestream_messages')
        query = messages_ref.where('stream_id', '==', stream_id).order_by('created_at')
        
        # Add pagination if last_message_id is provided
        if last_message_id:
            last_message = messages_ref.document(last_message_id).get()
            if last_message.exists:
                query = query.start_after(last_message)
        
        # Limit the number of messages to retrieve
        query = query.limit(50)
        
        # Execute the query
        messages = []
        for doc in query.stream():
            message_data = doc.to_dict()
            message_data['message_id'] = doc.id
            
            # Convert Firestore timestamp to string
            if 'created_at' in message_data and message_data['created_at']:
                message_data['created_at'] = message_data['created_at'].strftime('%Y-%m-%d %H:%M:%S')
                
            messages.append(message_data)
        
        return JsonResponse({
            'success': True,
            'messages': messages
        })
        
    except Exception as e:
        print(f"Error retrieving livestream messages: {e}")
        return JsonResponse({'success': False, 'error': str(e)})

@csrf_exempt
def start_screen_share(request):
    """
    Update the livestream record to indicate screen sharing has started.
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
            return JsonResponse({'success': False, 'error': 'Unauthorized to update this stream'})
        
        # Update stream to indicate screen sharing is active
        stream_ref.update({
            'is_screen_sharing': True
        })
        
        return JsonResponse({'success': True})
        
    except Exception as e:
        print(f"Error starting screen share: {e}")
        return JsonResponse({'success': False, 'error': str(e)})

@csrf_exempt
def stop_screen_share(request):
    """
    Update the livestream record to indicate screen sharing has stopped.
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
            return JsonResponse({'success': False, 'error': 'Unauthorized to update this stream'})
        
        # Update stream to indicate screen sharing is inactive
        stream_ref.update({
            'is_screen_sharing': False
        })
        
        return JsonResponse({'success': True})
        
    except Exception as e:
        print(f"Error stopping screen share: {e}")
        return JsonResponse({'success': False, 'error': str(e)})