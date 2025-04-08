"""
Django views for LiveKit integration, handling token generation and room management.
"""


from .firebase import *
from .views_hub_room import *
import json
import logging
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import render, redirect
from .livekit_setup import *
from .firebase import db
from datetime import datetime
import pytz
import uuid

logger = logging.getLogger(__name__)








#Livestream view.py

def check_new_livestreams_view(request):
    """API endpoint to check for new livestreams since last check"""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=405)
    
    try:
        # Get the room ID and last check timestamp from query parameters
        room_id = request.GET.get('room_id')
        last_check = request.GET.get('last_check', '0')
        
        if not room_id:
            return JsonResponse({'success': False, 'error': 'Room ID is required'}, status=400)
        
        # Convert last_check to timestamp
        try:
            last_check_ts = float(last_check) / 1000  # Convert from milliseconds to seconds
        except ValueError:
            last_check_ts = 0
        
        # Convert to datetime
        last_check_dt = datetime.fromtimestamp(last_check_ts)
        
        # Query Firebase for livestreams created after last_check
        livestreams_ref = db.collection('scheduled_livestreams')
        query = livestreams_ref.where('room_id', '==', room_id).where('created_at', '>', last_check_dt)
        
        # Count the number of new livestreams
        new_count = len(list(query.stream()))
        
        return JsonResponse({
            'success': True,
            'new_count': new_count
        })
        
    except Exception as e:
        print(f"Error checking for new livestreams: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)




def get_teacher_livestreams_view(request):
    """API endpoint to get livestreams for a teacher based on status"""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=405)
    
    try:
        # Get the room ID and status from query parameters
        room_id = request.GET.get('room_id')
        status = request.GET.get('status', 'scheduled')
        
        if not room_id:
            return JsonResponse({'success': False, 'error': 'Room ID is required'}, status=400)
        
        # Get the current teacher from the session
        teacher_name = request.session.get("teachers_name")
        if not teacher_name:
            return JsonResponse({'success': False, 'error': 'Not authenticated as teacher'}, status=401)
        
        # Split the status parameter if it contains multiple values
        status_values = status.split(',')
        
        # Get livestreams from Firestore based on teacher, room, and status
        livestreams_ref = db.collection('scheduled_livestreams')
        
        # Build the query
        query = livestreams_ref.where('teacher', '==', teacher_name).where('room_id', '==', room_id)
        
        # If there's only one status value, we can use where
        if len(status_values) == 1:
            query = query.where('status', '==', status_values[0])
        
        # Execute the query
        results = query.stream()
        
        # Convert to list and filter by status if needed
        livestreams = []
        for doc in results:
            data = doc.to_dict()
            data['id'] = doc.id
            
            # Convert Firestore timestamp to string
            if 'created_at' in data and hasattr(data['created_at'], 'strftime'):
                data['created_at'] = data['created_at'].strftime('%Y-%m-%dT%H:%M:%SZ')
            
            # Filter by status if we have multiple values
            if len(status_values) > 1 and data.get('status') not in status_values:
                continue
                
            livestreams.append(data)
            
        print(f"Found {len(livestreams)} livestreams for teacher {teacher_name}, room {room_id}\n\n{livestreams}")
        
        return JsonResponse({
            'success': True,
            'livestreams': livestreams
        }, json_dumps_params={'default': str})  # Use default=str to handle any other non-serializable objects
        
    except Exception as e:
        print(f"Error getting teacher livestreams: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
    



def get_livestream_details_view(request, livestream_id):
    """API endpoint to get details for a specific livestream"""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=405)
    
    try:
        # Get the current teacher from the session
        teacher_name = request.session.get("teachers_name")
        if not teacher_name:
            return JsonResponse({'success': False, 'error': 'Not authenticated as teacher'}, status=401)
        
        # Get the livestream details from Firestore
        livestream_ref = db.collection('scheduled_livestreams').document(livestream_id)
        livestream_doc = livestream_ref.get()
        
        if not livestream_doc.exists:
            return JsonResponse({'success': False, 'error': 'Livestream not found'}, status=404)
        
        # Get the livestream data
        livestream_data = livestream_doc.to_dict()
        livestream_data['id'] = livestream_id
        
        # Verify the teacher has access to this livestream
        if livestream_data.get('teacher') != teacher_name:
            return JsonResponse({'success': False, 'error': 'You do not have access to this livestream'}, status=403)
        
        return JsonResponse({
            'success': True,
            'livestream': livestream_data
        })
        
    except Exception as e:
        print(f"Error getting livestream details: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


def update_livestream_view(request):
    """API endpoint to update a scheduled livestream"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=405)
    
    try:
        # Parse request data
        data = json.loads(request.body)
        livestream_id = data.get('livestream_id')
        title = data.get('title')
        description = data.get('description', '')
        scheduled_time = data.get('scheduled_time')
        
        # Validate required fields
        if not all([livestream_id, title, scheduled_time]):
            return JsonResponse({'success': False, 'error': 'Missing required fields'}, status=400)
        
        # Get current teacher name from session
        teacher_name = request.session.get("teachers_name")
        if not teacher_name:
            return JsonResponse({'success': False, 'error': 'Not authenticated as a teacher'}, status=401)
        
        # Get the livestream from Firestore
        livestream_ref = db.collection('scheduled_livestreams').document(livestream_id)
        livestream_doc = livestream_ref.get()
        
        if not livestream_doc.exists:
            return JsonResponse({'success': False, 'error': 'Livestream not found'}, status=404)
        
        # Get the livestream data
        livestream_data = livestream_doc.to_dict()
        
        # Verify the teacher has access to this livestream
        if livestream_data.get('teacher') != teacher_name:
            return JsonResponse({'success': False, 'error': 'You do not have access to this livestream'}, status=403)
        
        # Verify the livestream is still in scheduled status
        if livestream_data.get('status') != 'scheduled':
            return JsonResponse({'success': False, 'error': 'Cannot update a livestream that is already live or completed'}, status=400)
        
        # Format scheduled time as ISO string
        try:
            # Parse the datetime string
            dt = datetime.fromisoformat(scheduled_time.replace('Z', '+00:00'))
            # Convert to UTC and format as ISO string
            utc_time = dt.astimezone(pytz.UTC).isoformat()
        except ValueError:
            return JsonResponse({'success': False, 'error': 'Invalid date format'}, status=400)
        
        # Update the livestream
        livestream_ref.update({
            'title': title,
            'description': description,
            'scheduled_time': utc_time,
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        # Notify students about the updated livestream
        # This would ideally create notifications about the update
        
        return JsonResponse({
            'success': True,
            'message': 'Livestream updated successfully'
        })
        
    except Exception as e:
        print(f"Error updating livestream: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
    
    
@csrf_exempt
def schedule_livestream_view(request):
    """API endpoint to schedule a new livestream"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=405)
    
    try:
        # Parse request data
        data = json.loads(request.body)
        title = data.get('title')
        description = data.get('description', '')
        scheduled_time = data.get('scheduled_time')
        room_id = data.get('room_id')
        
        # Validate required fields
        if not all([title, scheduled_time, room_id]):
            return JsonResponse({'success': False, 'error': 'Missing required fields'}, status=400)
        
        # Get current teacher name from session
        teacher_name = request.session.get("teachers_name")
        if not teacher_name:
            return JsonResponse({'success': False, 'error': 'Not authenticated as a teacher'}, status=401)
        
        # Format scheduled time as ISO string
        try:
            # Parse the datetime string
            dt = datetime.fromisoformat(scheduled_time.replace('Z', '+00:00'))
            # Convert to UTC and format as ISO string
            utc_time = dt.astimezone(pytz.UTC).isoformat()
        except ValueError:
            return JsonResponse({'success': False, 'error': 'Invalid date format'}, status=400)
        
        # Schedule the livestream in Firebase
        livestream_id = schedule_livestream(teacher_name, room_id, title, description, utc_time)
        
        if not livestream_id:
            return JsonResponse({'success': False, 'error': 'Failed to schedule livestream'}, status=500)
        
        # Notify students about the scheduled livestream
        notify_students_about_livestream(livestream_id, room_id, teacher_name, title, utc_time)
        
        return JsonResponse({
            'success': True,
            'message': 'Livestream scheduled successfully',
            'livestream_id': livestream_id
        })
        
    except Exception as e:
        print(f"Error scheduling livestream: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

def get_upcoming_livestreams_view(request):
    """API endpoint to get upcoming livestreams for a room"""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=405)
    
    try:
        # Get the room ID from query parameters
        room_id = request.GET.get('room_id')
        
        if not room_id:
            return JsonResponse({'success': False, 'error': 'Room ID is required'}, status=400)
        
        # Get upcoming livestreams for the room
        livestreams = get_upcoming_livestreams_for_room(room_id)


        print(f"These are my livestreams {livestreams}")
        return JsonResponse({
            'success': True,
            'livestreams': livestreams
        })
        
    except Exception as e:
        print(f"Error getting upcoming livestreams: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
def cancel_livestream_view(request):
    """API endpoint to cancel a scheduled livestream"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=405)
    
    try:
        # Parse request data
        data = json.loads(request.body)
        livestream_id = data.get('livestream_id')
        
        if not livestream_id:
            return JsonResponse({'success': False, 'error': 'Livestream ID is required'}, status=400)
        
        # Get current teacher name from session
        teacher_name = request.session.get("teachers_name")
        if not teacher_name:
            return JsonResponse({'success': False, 'error': 'Not authenticated as a teacher'}, status=401)
        
        # Update the livestream status to 'cancelled'
        success = update_livestream_status(livestream_id, 'cancelled')
        
        if not success:
            return JsonResponse({'success': False, 'error': 'Failed to cancel livestream'}, status=500)
        
        return JsonResponse({
            'success': True,
            'message': 'Livestream cancelled successfully'
        })
        
    except Exception as e:
        print(f"Error cancelling livestream: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)






















@csrf_exempt
def generate_token_view(request):
    """
    Generate a LiveKit token for a participant.
    
    Expected POST parameters:
    - room_name: LiveKit room name
    - participant_name: Name of the participant
    - is_publisher: Boolean indicating if user can publish media (teacher)
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=405)
    
    try:
        data = json.loads(request.body)
        room_name = data.get('room_name')
        participant_name = data.get('participant_name')
        is_publisher = data.get('is_publisher', False)
        
        if not all([room_name, participant_name]):
            return JsonResponse({'success': False, 'error': 'Missing required fields'}, status=400)
        
        # Generate LiveKit token
        token = generate_access_token(room_name, participant_name, is_publisher)
        
        return JsonResponse({
            'success': True,
            'token': token
        })
    except Exception as e:
        logger.error(f"Error generating LiveKit token: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
def create_room_view(request):
    """
    Create a new LiveKit room.
    
    Expected POST parameters:
    - room_name: LiveKit room name
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=405)
    
    try:
        data = json.loads(request.body)
        room_name = data.get('room_name')
        
        if not room_name:
            return JsonResponse({'success': False, 'error': 'Room name is required'}, status=400)
        
        # Create LiveKit room
        room_data = create_livekit_room(room_name)
        
        return JsonResponse({
            'success': True,
            'room': room_data
        })
    except Exception as e:
        logger.error(f"Error creating LiveKit room: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
def start_livestream_view(request):
    """
    Start a livestream, creating the necessary LiveKit room and updating Firebase.
    
    Expected POST parameters:
    - livestream_id: ID of the livestream document in Firestore
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=405)
    
    try:
        data = json.loads(request.body)
        livestream_id = data.get('livestream_id')
        
        if not livestream_id:
            return JsonResponse({'success': False, 'error': 'Livestream ID is required'}, status=400)
        
        # Get current teacher name from session
        teacher_name = request.session.get("teachers_name")
        if not teacher_name:
            return JsonResponse({'success': False, 'error': 'Not authenticated as a teacher'}, status=401)
        
        # Get the livestream details from Firestore
        livestream_ref = db.collection('scheduled_livestreams').document(livestream_id)
        livestream_doc = livestream_ref.get()
        
        if not livestream_doc.exists:
            return JsonResponse({'success': False, 'error': 'Livestream not found'}, status=404)
        
        livestream_data = livestream_doc.to_dict()
        
        # Verify the teacher has access to this livestream
        if livestream_data.get('teacher') != teacher_name:
            return JsonResponse({'success': False, 'error': 'You do not have access to this livestream'}, status=403)
        
        # Create a unique room name for LiveKit
        room_name = f"livestream-{livestream_id}"
        
        # Create LiveKit room
        create_livekit_room(room_name)
        
        # Start recording the livestream
        recording_data = start_recording(room_name)
        recording_id = recording_data.get('recording_id')
        
        # Update the livestream status to 'live' in Firestore
        livestream_ref.update({
            'status': 'live',
            'room_name': room_name,
            'recording_id': recording_id,
            'started_at': firestore.SERVER_TIMESTAMP
        })
        
        # Update the livestream status (ensure it matches existing function)
        update_livestream_status(livestream_id, 'live')
        
        # Generate the teacher's token
        teacher_token = generate_access_token(room_name, teacher_name, is_publisher=True)
        
        return JsonResponse({
            'success': True,
            'message': 'Livestream started successfully',
            'room_name': room_name,
            'token': teacher_token,
            'recording_id': recording_id
        })
    except Exception as e:
        logger.error(f"Error starting livestream: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
def end_livestream_view(request):
    """
    End an active livestream and stop recording.
    
    Expected POST parameters:
    - livestream_id: ID of the livestream document in Firestore
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=405)
    
    try:
        data = json.loads(request.body)
        livestream_id = data.get('livestream_id')
        
        if not livestream_id:
            return JsonResponse({'success': False, 'error': 'Livestream ID is required'}, status=400)
        
        # Get current teacher name from session
        teacher_name = request.session.get("teachers_name")
        if not teacher_name:
            return JsonResponse({'success': False, 'error': 'Not authenticated as a teacher'}, status=401)
        
        # Get the livestream details from Firestore
        livestream_ref = db.collection('scheduled_livestreams').document(livestream_id)
        livestream_doc = livestream_ref.get()
        
        if not livestream_doc.exists:
            return JsonResponse({'success': False, 'error': 'Livestream not found'}, status=404)
        
        livestream_data = livestream_doc.to_dict()
        
        # Verify the teacher has access to this livestream
        if livestream_data.get('teacher') != teacher_name:
            return JsonResponse({'success': False, 'error': 'You do not have access to this livestream'}, status=403)
        
        # Stop recording
        recording_id = livestream_data.get('recording_id')
        if recording_id:
            recording_result = stop_recording(recording_id)
            recording_url = recording_result.get('recording_url')
            
            # Update recording URL in Firestore
            if recording_url:
                update_livestream_recording_url(livestream_id, recording_url)
        
        # Mark livestream as completed
        complete_livestream(
            livestream_id,
            viewer_count=livestream_data.get('viewer_count', 0),
            recording_url=recording_url if 'recording_url' in locals() else None
        )
        
        return JsonResponse({
            'success': True,
            'message': 'Livestream ended successfully'
        })
    except Exception as e:
        logger.error(f"Error ending livestream: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
def join_livestream_view(request):
    """
    Generate a token for a student to join a livestream.
    
    Expected POST parameters:
    - livestream_id: ID of the livestream document in Firestore
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=405)
    
    try:
        data = json.loads(request.body)
        livestream_id = data.get('livestream_id')
        
        if not livestream_id:
            return JsonResponse({'success': False, 'error': 'Livestream ID is required'}, status=400)
        
        # Get current student name from session
        student_name = request.session.get("students_name")
        if not student_name:
            return JsonResponse({'success': False, 'error': 'Not authenticated as a student'}, status=401)
        
        # Get the livestream details from Firestore
        livestream_ref = db.collection('scheduled_livestreams').document(livestream_id)
        livestream_doc = livestream_ref.get()
        
        if not livestream_doc.exists:
            return JsonResponse({'success': False, 'error': 'Livestream not found'}, status=404)
        
        livestream_data = livestream_doc.to_dict()
        
        # Verify the livestream is live
        if livestream_data.get('status') != 'live':
            return JsonResponse({'success': False, 'error': 'Livestream is not currently active'}, status=400)
        
        # Get the room name
        room_name = livestream_data.get('room_name')
        if not room_name:
            return JsonResponse({'success': False, 'error': 'Room name not found for this livestream'}, status=400)
        
        # Generate the student's token (not publisher)
        student_token = generate_access_token(room_name, student_name, is_publisher=False)
        
        # Update viewer count (increment atomically)
        db.collection('scheduled_livestreams').document(livestream_id).update({
            'viewers': firestore.Increment(1)
        })
        
        return JsonResponse({
            'success': True,
            'room_name': room_name,
            'token': student_token,
            'teacher': livestream_data.get('teacher'),
            'title': livestream_data.get('title')
        })
    except Exception as e:
        logger.error(f"Error joining livestream: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

def livestream_room_view(request, livestream_id, room_name):
    """
    Render the livestream room page for both teachers and students.
    """
    try:
        # Determine if user is teacher or student
        is_teacher = request.session.get("teachers_name") is not None
        is_student = request.session.get("students_name") is not None
        
        if not is_teacher and not is_student:
            return redirect('first_page')
        
        # Get livestream details from Firebase
        livestream_ref = db.collection('scheduled_livestreams').document(livestream_id)
        livestream_doc = livestream_ref.get()
        
        if not livestream_doc.exists:
            if is_teacher:
                return redirect('teachers_homepage')
            else:
                return redirect('students_homepage')
        
        livestream_data = livestream_doc.to_dict()
        
        # For teachers, verify they own the livestream
        if is_teacher:
            teacher_name = request.session.get("teachers_name")
            if livestream_data.get('teacher') != teacher_name:
                return redirect('teachers_homepage')
                
            # Generate teacher token (can publish)
            token = generate_access_token(room_name, teacher_name, is_publisher=True)
        else:
            # For students
            student_name = request.session.get("students_name")
            
            # Generate student token (cannot publish)
            token = generate_access_token(room_name, student_name, is_publisher=False)
            
            # Update viewer count if this is a new viewer
            # Note: In a production app, you might want to track unique viewers more carefully
            db.collection('scheduled_livestreams').document(livestream_id).update({
                'viewer_count': firestore.Increment(1)
            })
        
        # Prepare context for the template
        context = {
            'livestream': {
                'id': livestream_id,
                'title': livestream_data.get('title', 'Untitled Livestream'),
                'description': livestream_data.get('description', ''),
                'teacher': livestream_data.get('teacher', ''),
                'room_id': livestream_data.get('room_id', ''),
                'status': livestream_data.get('status', '')
            },
            'room_name': room_name,
            'token': token,
            'is_teacher': is_teacher,
            'user_name': request.session.get("teachers_name") if is_teacher else request.session.get("students_name")
        }
        
        # Render appropriate template
        if is_teacher:
            return render(request, 'myapp/teachers/teacher_livestream_room.html', context)
        else:
            return render(request, 'myapp/students/student_livestream_room.html', context)
            
    except Exception as e:
        logger.error(f"Error rendering livestream room: {e}")
        if request.session.get("teachers_name"):
            return redirect('teachers_homepage')
        else:
            return redirect('students_homepage')




def schedule_livestream(teacher, room_id, title, description, scheduled_time):
   
    try:
        # Reference to the scheduled livestreams collection
        livestreams_ref = db.collection('scheduled_livestreams')
        
        # Create a new document with the livestream data
        new_livestream = {
            'teacher': teacher,
            'room_id': room_id,
            'title': title,
            'description': description,
            'scheduled_time': scheduled_time,
            'status': 'scheduled',
            'created_at': firestore.SERVER_TIMESTAMP
        }
        
        # Add the document and get the reference
        doc_ref = livestreams_ref.add(new_livestream)
        
        # Return the document ID
        return doc_ref[1].id
    except Exception as e:
        print(f"Error scheduling livestream: {e}")
        return None

def get_upcoming_livestreams_for_room(room_id):
    """
    Get all upcoming livestreams for a specific room
    
    Args:
        room_id (str): Room ID to fetch livestreams for
        
    Returns:
        list: List of upcoming livestream dictionaries
    """
    try:
        # Reference to the scheduled livestreams collection
        livestreams_ref = db.collection('scheduled_livestreams')
        
        # Query for upcoming livestreams for this room
        query = livestreams_ref.where('room_id', '==', room_id).where('status', '==', 'scheduled')
        
        # Execute the query and convert to list of dictionaries
        livestreams = []
        for doc in query.stream():
            data = doc.to_dict()
            data['id'] = doc.id
            livestreams.append(data)
            
        return livestreams
    except Exception as e:
        print(f"Error fetching upcoming livestreams: {e}")
        return []

def update_livestream_status(livestream_id, new_status):
    """
    Update the status of a livestream
    
    Args:
        livestream_id (str): ID of the livestream to update
        new_status (str): New status value ('scheduled', 'live', 'completed', 'cancelled')
        
    Returns:
        bool: True if update was successful, False otherwise
    """
    try:
        # Reference to the specific livestream document
        livestream_ref = db.collection('scheduled_livestreams').document(livestream_id)
        
        # Update the status
        livestream_ref.update({'status': new_status})
        
        return True
    except Exception as e:
        print(f"Error updating livestream status: {e}")
        return False

def notify_students_about_livestream(livestream_id, room_id, teacher_name, title, scheduled_time):
    """
    Create notifications for students in the room about a new scheduled livestream
    
    Args:
        livestream_id (str): ID of the scheduled livestream
        room_id (str): Room ID for the livestream
        teacher_name (str): Name of the teacher scheduling the livestream
        title (str): Title of the livestream
        scheduled_time (str): When the livestream is scheduled
        
    Returns:
        bool: True if notifications were created successfully, False otherwise
    """
    try:
        # Get all students in the room
        students = get_members_by_hub_url(room_id)
        
        # Create a batch to add all notifications at once
        batch = db.batch()
        
        # Notifications collection reference
        notifications_ref = db.collection('notifications')
        
        # Create notifications for each student
        for student in students:
            # Create a new notification document
            notification_data = {
                'username': student,
                'type': 'livestream',
                'title': f"New Livestream: {title}",
                'content': f"{teacher_name} scheduled a new livestream for {scheduled_time}",
                'read': False,
                'created_at': firestore.SERVER_TIMESTAMP,
                'livestream_id': livestream_id,
                'room_id': room_id
            }
            
            # Add to batch
            new_doc_ref = notifications_ref.document()
            batch.set(new_doc_ref, notification_data)
        
        # Commit the batch
        batch.commit()
        
        return True
    except Exception as e:
        print(f"Error creating livestream notifications: {e}")
        return False