"""
Livestreaming functionality for EduLink using Agora and Firebase.
"""
import json
import time
from datetime import datetime,timedelta
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





@csrf_exempt
def get_stream_recordings(request):
    """
    Get all recordings for a specific room.
    """
    room_id = request.GET.get('room_id')
    
    if not room_id:
        return JsonResponse({'success': False, 'error': 'Room ID is required'})
    
    try:
        # Query Firebase for recordings in this room
        recordings_query = db.collection('stream_recordings').where('room_id', '==', room_id).order_by('created_at', direction=firestore.Query.DESCENDING).stream()
        
        recordings = []
        for recording_doc in recordings_query:
            recording_data = recording_doc.to_dict()
            # Add the document ID
            recording_data['id'] = recording_doc.id
            recordings.append(recording_data)
        
        return JsonResponse({
            'success': True,
            'recordings': recordings
        })
        
    except Exception as e:
        print(f"Error getting stream recordings: {e}")
        return JsonResponse({'success': False, 'error': str(e)})
    



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
    Includes cloud recording functionality to save streams for later viewing.
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST method is allowed'})
    
    try:
        data = json.loads(request.body)
        teacher_id = data.get('teacher_id')
        room_id = data.get('room_id')
        title = data.get('title', 'Untitled Livestream')
        notify_students = data.get('notify_students', True)
        enable_recording = data.get('enable_recording', True)  # Default to recording enabled
        
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
        
        # Generate a unique recording UID that will be consistent across acquire and start operations
        recording_uid = int(time.time()) % 100000 + random.randint(1, 1000)
        
        # Prepare stream data for Firebase
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
            'is_recording': enable_recording,  # Flag to indicate if recording is enabled
        }
        
        # If recording is enabled, initialize recording data
        if enable_recording:
            try:
                # Store recording info in stream data
                stream_data.update({
                    'recording_uid': recording_uid,
                    'recording_status': 'initializing'
                })
                
                # We'll initialize the recording in the background after creating the stream
                # This prevents delays in stream startup
            except Exception as e:
                print(f"Error initializing recording data: {e}")
                # Continue without recording if there's an error
                stream_data['is_recording'] = False
        
        # Store stream data in Firebase
        stream_ref = db.collection('livestreams').document(stream_id)
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
        
        # Start cloud recording if enabled (in a background thread to avoid delays)
        if enable_recording:
            import threading
            
            def start_recording_task(task_recording_uid):
                try:
                    # Use Agora Cloud Recording API to start recording
                    from .livestream_cloud_recording import acquire_recording_resource, start_cloud_recording
                    
                    # Use the passed recording_uid
                    current_recording_uid = task_recording_uid
                    
                    # Acquire resource - pass the recording_uid we stored in stream_data
                    acquire_res = acquire_recording_resource(channel_name, current_recording_uid)

                    print(f"\n\n{acquire_res}\n\n")
                    if not acquire_res.get('success'):
                        print(f"Failed to acquire recording resource: {acquire_res.get('error')}")
                        stream_ref.update({
                            'is_recording': False,
                            'recording_status': 'failed',
                            'recording_error': acquire_res.get('error')
                        })
                        return
                    
                    resource_id = acquire_res.get('resource_id')
                    # Make sure we use the UID returned by acquire_recording_resource
                    actual_recording_uid = int(acquire_res.get('uid'))
                    
                    # Update the recording UID in the stream_data if it's different
                    if current_recording_uid != actual_recording_uid:
                        stream_ref.update({
                            'recording_uid': actual_recording_uid
                        })
                        current_recording_uid = actual_recording_uid
                    
                    # Start recording with the correct UID
                    recording_res = start_cloud_recording(
                        room_id = room_id,
                        channel_name=channel_name,
                        token=token,
                        recording_uid=current_recording_uid,
                        resource_id=resource_id
                    )
                    if recording_res.get('success'):
                        # Update stream with recording info
                        stream_ref.update({
                            'recording_id': recording_res.get('recording_id'),
                            'resource_id': resource_id,
                            'recording_status': 'active'
                        })
                        print(f"Cloud recording started for stream {stream_id}")
                    else:
                        # Update stream with recording error
                        stream_ref.update({
                            'is_recording': False,
                            'recording_status': 'failed',
                            'recording_error': recording_res.get('error')
                        })
                        print(f"Failed to start cloud recording: {recording_res.get('error')}")
                except Exception as e:
                    print(f"Error in recording task: {e}")
                    stream_ref.update({
                        'is_recording': False,
                        'recording_status': 'failed',
                        'recording_error': str(e)
                    })
            
            # Start recording in background thread, passing the recording_uid as an argument
            recording_thread = threading.Thread(target=start_recording_task, args=(recording_uid,))
            recording_thread.start()
        
        # Send notifications to students
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
                            'username': student_id.upper(),
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
            'app_id': AGORA_APP_ID,
            'is_recording': enable_recording
        })
        
    except Exception as e:
        print(f"Error starting livestream: {e}")
        return JsonResponse({'success': False, 'error': str(e)})



@csrf_exempt
def end_livestream(request):
    """
    End an active livestream. Updated to handle cases where the hub_rooms document doesn't exist.
    Saves recording information for playback in hub resources.
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
        
        # Check if recording was just started (less than 10 seconds ago)
        if stream_data.get('is_recording') and stream_data.get('recording_status') == 'active':
            start_time = stream_data.get('started_at')
            current_time = datetime.now()
            
            if start_time and hasattr(start_time, 'seconds'):
                start_datetime = datetime.fromtimestamp(start_time.seconds)
                time_diff = (current_time - start_datetime).total_seconds()
                
                if time_diff < 10:  # Less than 10 seconds since recording started
                    print(f"Recording just started {time_diff} seconds ago, adding delay before stopping")
                    time.sleep(5)  # Add a short delay to let recording initialize
        
        # Stop cloud recording if it's active
        if stream_data.get('is_recording') and stream_data.get('recording_status') == 'active':
            try:
                from .livestream_cloud_recording import stop_cloud_recording
                
                recording_id = stream_data.get('recording_id')
                resource_id = stream_data.get('resource_id')
                recording_uid = stream_data.get('recording_uid')
                channel_name = stream_data.get('channel_name')
                
                if recording_id and resource_id and recording_uid:
                    # Stop the recording
                    recording_res = stop_cloud_recording(
                        channel_name=channel_name,
                        resource_id=resource_id,
                        recording_id=recording_id,
                        recording_uid=recording_uid
                    )
                    
                    if recording_res.get('success'):
                        print(f"Cloud recording stopped for stream {stream_id}")
                        
                        # Calculate stream duration
                        start_time = stream_data.get('started_at')
                        if start_time:
                            try:
                                # Convert Firestore timestamps to Python datetime
                                if hasattr(start_time, 'datetime'):
                                    start_datetime = start_time.datetime
                                elif hasattr(start_time, 'seconds'):
                                    start_datetime = datetime.fromtimestamp(start_time.seconds)
                                else:
                                    start_datetime = datetime.now() - timedelta(hours=1)  # Fallback
                                    
                                current_time = datetime.now()
                                duration_seconds = int((current_time - start_datetime).total_seconds())
                            except Exception as e:
                                print(f"Error calculating duration: {e}")
                                duration_seconds = 3600  # Default to 1 hour if calculation fails
                        else:
                            duration_seconds = 3600  # Default to 1 hour
                        
                        # Process recording files for better playback
                        recording_files = recording_res.get('recording_files', [])
                        processed_files = []
                        
                        # Handle empty file list (might still be processing)
                        if not recording_files or (isinstance(recording_files, str) and recording_files == ''):
                            print("Warning: No recording files available yet. Files may still be processing.")
                            # Create a placeholder file entry with status
                            processed_files = [{
                                'status': 'processing',
                                'duration': duration_seconds,
                                'filesize_mb': 0,
                                'url': None,
                                'thumbnail_url': None,
                                'fileName': 'recording_processing.mp4',
                                'message': 'Recording is still being processed. Check back later.'
                            }]
                        else:
                            # Process files as before
                            for file_info in recording_files:
                                # Add additional metadata
                                file_info['duration'] = duration_seconds
                                file_info['filesize_mb'] = file_info.get('fileSize', 0) / (1024 * 1024) if 'fileSize' in file_info else 0
                                
                                # Generate a thumbnail URL if this is a video file
                                if file_info.get('fileName', '').endswith('.m3u8'):
                                    # Placeholder for thumbnail generation
                                    file_info['thumbnail_url'] = file_info.get('url', '').replace('.m3u8', '_thumbnail.jpg')
                                
                                processed_files.append(file_info)
                        
                        # Create recording entry in Firebase with more metadata
                        recording_ref = db.collection('stream_recordings').document()
                        recording_data = {
                            'recording_id': recording_id,
                            'stream_id': stream_id,
                            'room_id': stream_data.get('room_id'),
                            'teacher_id': teacher_id,
                            'teacher_name': stream_data.get('teacher_name', teacher_id),
                            'title': stream_data.get('title'),
                            'description': stream_data.get('description', f"Recording of {stream_data.get('title')}"),
                            'started_at': stream_data.get('started_at'),
                            'ended_at': firestore.SERVER_TIMESTAMP,
                            'duration': duration_seconds,
                            'viewer_count': stream_data.get('viewer_count', 0),
                            'created_at': firestore.SERVER_TIMESTAMP,
                            'status': 'completed',
                            'recording_files': processed_files,
                            'thumbnail_url': processed_files[0].get('thumbnail_url') if processed_files else None,
                            'playback_url': processed_files[0].get('url') if processed_files else None,
                            'file_format': 'HLS',  # HLS format for adaptive streaming
                            'is_deleted': False,
                            'views': 0
                        }
                        recording_ref.set(recording_data)
                        
                        # Update the stream with recording status
                        stream_ref.update({
                            'recording_status': 'completed',
                            'recording_saved': True,
                            'recording_ref': recording_ref.id,
                            'recording_url': processed_files[0].get('url') if processed_files else None
                        })
                        
                        # Also update the hub room with latest recording info
                        room_id = stream_data.get('room_id')
                        if room_id:
                            room_ref = db.collection('hub_rooms').document(room_id)
                            room_doc = room_ref.get()
                            
                            if room_doc.exists:
                                # Add to recordings array and update latest recording
                                room_ref.update({
                                    'recordings': firestore.ArrayUnion([recording_ref.id]),
                                    'latest_recording': {
                                        'id': recording_ref.id,
                                        'title': stream_data.get('title'),
                                        'created_at': firestore.SERVER_TIMESTAMP
                                    }
                                })
                    else:
                        print(f"Failed to stop cloud recording: {recording_res.get('error')}")
                        stream_ref.update({
                            'recording_status': 'failed',
                            'recording_error': recording_res.get('error')
                        })
                else:
                    print("Missing recording information, cannot stop recording")
                    stream_ref.update({
                        'recording_status': 'incomplete',
                        'recording_error': 'Missing recording information'
                    })
            except Exception as e:
                print(f"Error stopping cloud recording: {e}")
                stream_ref.update({
                    'recording_status': 'error',
                    'recording_error': str(e)
                })
        
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
                    'active_stream_id': None,
                    'last_livestream_at': firestore.SERVER_TIMESTAMP
                })
            # If document doesn't exist, no need to update it
        
        # Return success response with recording info if applicable
        response_data = {
            'success': True,
            'recording_saved': False,
            'recording_playback_url': None
        }
        
        # Add recording info if available
        if stream_data.get('is_recording', False) and stream_data.get('recording_status') == 'active':
            response_data['recording_saved'] = True
            if 'recording_ref' in stream_data:
                response_data['recording_id'] = stream_data.get('recording_ref')
            if 'recording_url' in stream_data:
                response_data['recording_playback_url'] = stream_data.get('recording_url')
        
        return JsonResponse(response_data)
        
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
            role=2
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
        message_type = data.get('type', 'chat')  # Default to 'chat' if type not specified
        sender_id = data.get('sender_id')
        room_id = data.get('room_id')
        stream_id = data.get('stream_id')
        content = data.get('content')
        
        if not all([sender_id, room_id, stream_id, content]):
            return JsonResponse({'success': False, 'error': 'Missing required fields'})
        
        # Verify the stream exists and is active
        stream_ref = db.collection('livestreams').document(stream_id)
        stream_doc = stream_ref.get()
        
        if not stream_doc.exists:
            return JsonResponse({'success': False, 'error': 'Stream not found'})
            
        stream_data = stream_doc.to_dict()
        if stream_data.get('status') != 'live':
            return JsonResponse({'success': False, 'error': 'Stream is not active'})
        
        # Create a message record in Firebase - this uses SERVER_TIMESTAMP (not JSON serializable)
        message_ref = db.collection('livestream_messages').document()
        message_data = {
            'type': message_type,
            'sender_id': sender_id,
            'room_id': room_id,
            'stream_id': stream_id,
            'content': content,  # No encryption
            'created_at': firestore.SERVER_TIMESTAMP,
            'sender_name': data.get('sender_name', sender_id),
            'role': data.get('role', 'user')
        }
        message_ref.set(message_data)
        
        # Create a response-safe copy without Sentinel value for JSON response
        # Use a current timestamp string instead of the Firestore SERVER_TIMESTAMP
        current_time = timezone.now().strftime('%Y-%m-%d %H:%M:%S')
        response_data = {
            'type': message_type,
            'sender_id': sender_id,
            'room_id': room_id,
            'stream_id': stream_id,
            'content': content,
            'created_at': current_time,
            'message_id': message_ref.id,
            'sender_name': data.get('sender_name', sender_id),
            'role': data.get('role', 'user')
        }
        
        return JsonResponse({
            'success': True,
            'message': response_data  # Return the JSON-serializable version
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
            
            # Convert Firestore timestamp to string if it exists
            if 'created_at' in message_data and message_data['created_at']:
                # Check if it's a Firestore timestamp object
                if hasattr(message_data['created_at'], 'strftime'):
                    message_data['created_at'] = message_data['created_at'].strftime('%Y-%m-%d %H:%M:%S')
                # If it's already a string, leave it as is
                
            # Make sure we also include the content as 'message' for compatibility with frontend
            if 'content' in message_data and 'message' not in message_data:
                message_data['message'] = message_data['content']
                
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