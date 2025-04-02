# Add these views to your views_hub_room.py or create a new livestream_views.py file

import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from datetime import datetime
import pytz
import uuid
from .livestream import *
from django.shortcuts import redirect


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
            
        print(f"Found {len(livestreams)} livestreams for teacher {teacher_name}, room {room_id}")
        
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
def start_livestream_view(request):
    """API endpoint to start a scheduled livestream"""
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
        
        # Update the livestream status to 'live'
        success = update_livestream_status(livestream_id, 'live')
        
        if not success:
            return JsonResponse({'success': False, 'error': 'Failed to start livestream'}, status=500)
        
        # Generate a unique room name for the livestream
        # This will be used with LiveKit later
        livestream_room = f"livestream-{uuid.uuid4().hex[:8]}"
        
        # For now, we'll just redirect to a placeholder page
        # Later this will be the actual LiveKit integration
        livestream_url = f"/livestream/{livestream_id}/{livestream_room}/"
        
        return JsonResponse({
            'success': True,
            'message': 'Livestream started successfully',
            'livestream_url': livestream_url
        })
        
    except Exception as e:
        print(f"Error starting livestream: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
    


def livestream_room_view(request, livestream_id, room_name):
    """View for the livestream room"""
    try:
        # Get the current user's name and role
        current_teacher_name = request.session.get("teachers_name")
        current_student_name = request.session.get("students_name")
        
        # Determine if the user is a teacher or student
        is_teacher = current_teacher_name is not None
        is_student = current_student_name is not None
        
        if not is_teacher and not is_student:
            # User is not authenticated
            return redirect('first_page')
        
        # Get livestream details from Firebase
        livestream_ref = db.collection('scheduled_livestreams').document(livestream_id)
        livestream_doc = livestream_ref.get()
        
        if not livestream_doc.exists:
            # Livestream not found
            if is_teacher:
                return redirect('teachers_homepage')
            else:
                return redirect('students_homepage')
        
        livestream_data = livestream_doc.to_dict()
        
        # Check permissions
        if is_teacher and livestream_data.get('teacher') != current_teacher_name:
            # Only the teacher who scheduled the livestream can access it as teacher
            return redirect('teachers_homepage')
        
        # For students, we'll need to check if they're members of the room
        # This would be added in a more complete implementation
        
        # Prepare context for the template
        context = {
            'livestream': {
                'id': livestream_id,
                'title': livestream_data.get('title', 'Untitled Livestream'),
                'description': livestream_data.get('description', ''),
                'teacher': livestream_data.get('teacher', ''),
                'room_id': livestream_data.get('room_id', ''),
                'scheduled_time': livestream_data.get('scheduled_time', ''),
                'status': livestream_data.get('status', 'scheduled')
            },
            'room_name': room_name,
            'is_teacher': is_teacher,
            'user_name': current_teacher_name if is_teacher else current_student_name
        }
        
        # Render the appropriate template based on user role
        if is_teacher:
            return render(request, 'myapp/teachers/teacher_livestream_room.html', context)
        else:
            return render(request, 'myapp/students/student_livestream_room.html', context)
        
    except Exception as e:
        print(f"Error accessing livestream room: {e}")
        # Handle error and redirect
        if request.session.get("teachers_name"):
            return redirect('teachers_homepage')
        else:
            return redirect('students_homepage')