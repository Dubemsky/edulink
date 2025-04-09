"""
Livestream management functionality for the EduLink platform.
This module handles:
- Scheduling livestreams
- Retrieving livestream information
- Cancelling livestreams
- Sending notifications to students about livestreams
"""

from datetime import datetime
import json
import pytz
from django.http import JsonResponse
from django.views.decorators.http import require_POST, require_GET
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from django.db import connection
from .firebase import db, auth, format_timestamp
from .encryption import encryption_manager

# Collection names
LIVESTREAMS_COLLECTION = 'livestreams'
NOTIFICATIONS_COLLECTION = 'notifications'
USERS_COLLECTION = 'users_profile'

# Import connection at the top
# Missing import in your code - add if not already present elsewhere
# from django.db import connection

def get_room_members(room_id):
    """
    Get all student members of a specific room (hub) from PostgreSQL database.
    The room_id parameter is the room_url in your model which matches the 
    Firebase room ID.
    """
    try:
        with connection.cursor() as cursor:
            # Query to get all students who are members of the specified hub
            cursor.execute("""
                SELECT student FROM myapp_students_joined_hub 
                WHERE hub_url = %s
            """, [room_id])
            
            # Fetch all student usernames
            members = [row[0] for row in cursor.fetchall()]
            print(f"Found {len(members)} student members for room {room_id}")
            return members
            
    except Exception as e:
        print(f"Error fetching room members from PostgreSQL: {str(e)}")
        return []

@require_POST
@csrf_exempt
def schedule_livestream(request):
    """Schedule a new livestream or update an existing one."""
    try:
        data = json.loads(request.body)
        
        # Validate required fields
        required_fields = ['title', 'scheduled_date', 'scheduled_time', 'duration', 'room_id', 'teacher_name']
        for field in required_fields:
            if field not in data:
                return JsonResponse({'success': False, 'error': f'Missing required field: {field}'})
        
        # Check if this is an update (edit)
        livestream_id = data.get('livestream_id')
        is_update = livestream_id is not None
        
        # Format data for Firestore
        now = timezone.now()
        livestream_data = {
            'title': data['title'],
            'description': data.get('description', ''),
            'scheduled_date': data['scheduled_date'],
            'scheduled_time': data['scheduled_time'],
            'duration': data['duration'],
            'room_id': data['room_id'],
            'teacher_name': data['teacher_name'],
            'status': 'scheduled',
            'updated_at': now.strftime('%Y-%m-%d %H:%M:%S'),
        }
        
        # If creating a new livestream
        if not is_update:
            livestream_data['created_at'] = now.strftime('%Y-%m-%d %H:%M:%S')
            
            # Add to Firestore
            livestream_ref = db.collection(LIVESTREAMS_COLLECTION).add(livestream_data)
            livestream_id = livestream_ref[1].id
            
            # Send notifications to students if requested
            if data.get('notify_students', True):
                send_livestream_notifications(
                    livestream_id, 
                    data['room_id'], 
                    data['title'], 
                    data['scheduled_date'], 
                    data['scheduled_time'], 
                    data['teacher_name']
                )
                
            return JsonResponse({
                'success': True, 
                'message': 'Livestream scheduled successfully',
                'livestream_id': livestream_id
            })
        
        # If updating an existing livestream
        else:
            # Update in Firestore
            db.collection(LIVESTREAMS_COLLECTION).document(livestream_id).update(livestream_data)
            
            # Send notifications only if explicitly requested for updates
            if data.get('notify_students', False):
                send_livestream_notifications(
                    livestream_id, 
                    data['room_id'], 
                    data['title'], 
                    data['scheduled_date'], 
                    data['scheduled_time'], 
                    data['teacher_name'],
                    is_update=True
                )
                
            return JsonResponse({
                'success': True, 
                'message': 'Livestream updated successfully',
                'livestream_id': livestream_id
            })
            
    except Exception as e:
        print(f"Error scheduling livestream: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)})


@require_GET
def get_livestreams(request):
    """Get livestreams for a specific room."""
    try:
        room_id = request.GET.get('room_id')
        status = request.GET.get('status', 'upcoming')  # 'upcoming' or 'past'
        
        if not room_id:
            return JsonResponse({'success': False, 'error': 'Room ID is required'})
        
        # Get current time
        now = datetime.now()
        
        # Query all livestreams for this room
        livestreams_ref = db.collection(LIVESTREAMS_COLLECTION).where('room_id', '==', room_id)
        livestreams = list(livestreams_ref.stream())
        
        # Process the livestreams based on status
        result_livestreams = []
        for livestream_doc in livestreams:
            livestream = livestream_doc.to_dict()
            livestream['id'] = livestream_doc.id
            
            # Parse scheduled date and time
            scheduled_datetime = datetime.strptime(
                f"{livestream['scheduled_date']} {livestream['scheduled_time']}", 
                '%Y-%m-%d %H:%M'
            )
            
            # Calculate end time
            duration_minutes = int(livestream['duration'])
            end_time = scheduled_datetime.replace(tzinfo=pytz.UTC) + timezone.timedelta(minutes=duration_minutes)
            
            # Filter based on status
            if status == 'upcoming':
                # Include if end time is in the future and status is not 'cancelled'
                if end_time > now.replace(tzinfo=pytz.UTC) and livestream.get('status') != 'cancelled':
                    result_livestreams.append(livestream)
            else:  # past
                # Include if end time is in the past or status is 'cancelled'
                if end_time <= now.replace(tzinfo=pytz.UTC) or livestream.get('status') == 'cancelled':
                    result_livestreams.append(livestream)
        
        # Sort upcoming livestreams by scheduled date/time
        if status == 'upcoming':
            result_livestreams.sort(key=lambda x: f"{x['scheduled_date']} {x['scheduled_time']}")
        else:
            # Sort past livestreams by scheduled date/time in reverse (most recent first)
            result_livestreams.sort(key=lambda x: f"{x['scheduled_date']} {x['scheduled_time']}", reverse=True)
        
        return JsonResponse({
            'success': True,
            'livestreams': result_livestreams
        })
        
    except Exception as e:
        print(f"Error getting livestreams: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)})


@require_GET
def get_livestream_details(request):
    """Get details for a specific livestream."""
    try:
        livestream_id = request.GET.get('livestream_id')
        
        if not livestream_id:
            return JsonResponse({'success': False, 'error': 'Livestream ID is required'})
        
        # Get the livestream from Firestore
        livestream_doc = db.collection(LIVESTREAMS_COLLECTION).document(livestream_id).get()
        
        if not livestream_doc.exists:
            return JsonResponse({'success': False, 'error': 'Livestream not found'})
            
        livestream = livestream_doc.to_dict()
        livestream['id'] = livestream_doc.id
        
        return JsonResponse({
            'success': True,
            'livestream': livestream
        })
        
    except Exception as e:
        print(f"Error getting livestream details: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)})


@require_POST
@csrf_exempt
def cancel_livestream(request):
    """Cancel a scheduled livestream."""
    try:
        data = json.loads(request.body)
        livestream_id = data.get('livestream_id')
        
        if not livestream_id:
            return JsonResponse({'success': False, 'error': 'Livestream ID is required'})
        
        # Get the livestream from Firestore
        livestream_doc = db.collection(LIVESTREAMS_COLLECTION).document(livestream_id).get()
        
        if not livestream_doc.exists:
            return JsonResponse({'success': False, 'error': 'Livestream not found'})
            
        # Update the livestream status to 'cancelled'
        db.collection(LIVESTREAMS_COLLECTION).document(livestream_id).update({
            'status': 'cancelled',
            'cancelled_at': timezone.now().strftime('%Y-%m-%d %H:%M:%S')
        })
        
        # Send cancellation notifications to students who received initial notification
        send_livestream_cancellation_notifications(livestream_id, livestream_doc.to_dict())
        
        return JsonResponse({
            'success': True,
            'message': 'Livestream cancelled successfully'
        })
        
    except Exception as e:
        print(f"Error cancelling livestream: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)})


def create_livestream_notification(username, livestream_id, room_id, title, teacher_name, is_update=False):
    """Create and store a single livestream notification."""
    try:
        # Format message content
        action_type = "updated" if is_update else "scheduled"
        message = f"Livestream {action_type}: {title} by {teacher_name}"
        
        # Create notification data
        notification_data = {
            "type": "livestream",
            "livestream_id": livestream_id,
            "room_id": room_id,
            "username": username.lower(),  
            "message": encryption_manager.encrypt(message),
            "content": f"A livestream has been {action_type} by {teacher_name}",
            "created_at": timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
            "read": False
        }
        
        # Add to Firestore
        db.collection(NOTIFICATIONS_COLLECTION).add(notification_data)
        print(f"Notification created for user: {username}")
        
    except Exception as e:
        print(f"Error creating notification for {username}: {str(e)}")


def send_livestream_notifications(livestream_id, room_id, title, scheduled_date, scheduled_time, teacher_name, is_update=False):
    """Send notifications to students about a new or updated livestream."""
    try:
        # Get all students who are members of the room from PostgreSQL
        room_members = get_room_members(room_id)
        
        if not room_members:
            print(f"No members found for room: {room_id}")
            print("Attempting to notify all students instead.")
            
            # Fallback to getting all students if specific room members can't be found
            users_ref = db.collection(USERS_COLLECTION)
            members_query = users_ref.where('role', '==', 'student')
            
            # For each student, create a notification
            for user_doc in members_query.stream():
                user_data = user_doc.to_dict()
                username = user_data.get('name', '').lower()
                
                if not username:
                    continue
                
                create_livestream_notification(
                    username, livestream_id, room_id, title, teacher_name, is_update
                )
        else:
            # Send notifications to all room members
            for username in room_members:
                print(f"Creating notification for room member: {username}")
                create_livestream_notification(
                    username, livestream_id, room_id, title, teacher_name, is_update
                )
                
        print(f"Sent livestream notifications to members for room: {room_id}")
        
    except Exception as e:
        print(f"Error sending livestream notifications: {str(e)}")


def send_livestream_cancellation_notifications(livestream_id, livestream_data):
    """Send notifications to students about a cancelled livestream."""
    try:
        room_id = livestream_data.get('room_id')
        title = livestream_data.get('title')
        teacher_name = livestream_data.get('teacher_name')
        
        # Format message content
        message = f"Livestream cancelled: {title} by {teacher_name}"

        # Get all members of the room
        room_members = get_room_members(room_id)
        
        # Also get users who were previously notified about this livestream
        notifications_ref = db.collection(NOTIFICATIONS_COLLECTION)
        notifications_query = notifications_ref.where('livestream_id', '==', livestream_id)
        
        # Get unique usernames from existing notifications
        notified_users = set()
        for notification_doc in notifications_query.stream():
            notification_data = notification_doc.to_dict()
            username = notification_data.get('username')
            if username:
                notified_users.add(username)
        
        # Combine both lists (room members + previously notified users)
        all_users_to_notify = set(room_members) | notified_users
        
        # For each user to notify, create a cancellation notification
        for username in all_users_to_notify:
            # Create notification
            notification_data = {
                "type": "livestream_cancelled",
                "livestream_id": livestream_id,
                "room_id": room_id,
                "username": username.lower(),
                "message": encryption_manager.encrypt(message),
                "content": f"A livestream has been cancelled by {teacher_name}",
                "created_at": timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
                "read": False
            }
            
            # Add to Firestore
            db.collection(NOTIFICATIONS_COLLECTION).add(notification_data)
            
        print(f"Sent livestream cancellation notifications for livestream: {livestream_id}")
        
    except Exception as e:
        print(f"Error sending livestream cancellation notifications: {str(e)}")


@require_GET
def get_student_livestreams(request):
    """Get livestreams for a student based on the rooms they are a member of."""
    try:
        username = request.GET.get('username')
        room_id = request.GET.get('room_id')  # Optional parameter to filter by specific room
        
        if not username:
            return JsonResponse({'success': False, 'error': 'Username is required'})
        
        # Get current time
        now = datetime.now()
        
        # If a specific room_id is provided, use it directly
        if room_id:
            student_rooms = [room_id]
            print(f"Filtering livestreams for specific room: {room_id}")
        else:
            # Get all rooms the student is a member of
            try:
                with connection.cursor() as cursor:
                    cursor.execute("""
                        SELECT hub_url FROM myapp_students_joined_hub 
                        WHERE student = %s
                    """, [username])
                    
                    student_rooms = [row[0] for row in cursor.fetchall()]
                    print(f"Found {len(student_rooms)} rooms for student {username}")
            except Exception as e:
                print(f"Error getting student rooms: {str(e)}")
                student_rooms = []
            
        # Query all livestreams
        livestreams_ref = db.collection(LIVESTREAMS_COLLECTION)
        
        # Filter to only upcoming, non-cancelled livestreams that are relevant to this student
        upcoming_livestreams = []
        
        # If we have student_rooms to filter by
        if student_rooms:
            for room_id in student_rooms:
                room_livestreams = list(livestreams_ref.where('room_id', '==', room_id).stream())
                
                for livestream_doc in room_livestreams:
                    livestream = livestream_doc.to_dict()
                    livestream['id'] = livestream_doc.id
                    
                    # Parse scheduled date and time
                    scheduled_datetime = datetime.strptime(
                        f"{livestream['scheduled_date']} {livestream['scheduled_time']}", 
                        '%Y-%m-%d %H:%M'
                    )
                    
                    # Check if the livestream is upcoming and not cancelled
                    if livestream.get('status') != 'cancelled':
                        scheduled_datetime_utc = scheduled_datetime.replace(tzinfo=pytz.UTC)
                        
                        # Include if scheduled time is in the future
                        if scheduled_datetime_utc > now.replace(tzinfo=pytz.UTC):
                            upcoming_livestreams.append(livestream)
        else:
            # Fallback: no rooms found, show no livestreams
            print(f"No rooms found for student: {username}")
            upcoming_livestreams = []
        
        # Sort by scheduled date/time
        upcoming_livestreams.sort(key=lambda x: f"{x['scheduled_date']} {x['scheduled_time']}")
        
        return JsonResponse({
            'success': True,
            'livestreams': upcoming_livestreams
        })
        
    except Exception as e:
        print(f"Error getting student livestreams: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)})