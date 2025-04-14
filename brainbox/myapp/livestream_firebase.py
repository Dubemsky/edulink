"""
Firebase utilities for livestreaming functionality
"""

from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from datetime import datetime

def create_livestream_record(db, stream_id, teacher_id, room_id, title, channel_name, agora_token):
    """
    Create a new livestream record in Firebase
    """
    livestream_ref = db.collection('livestreams').document(stream_id)
    
    livestream_data = {
        'stream_id': stream_id,
        'teacher_id': teacher_id,
        'room_id': room_id,
        'title': title,
        'channel_name': channel_name,
        'status': 'live',
        'agora_token': agora_token,
        'viewer_count': 0,
        'started_at': firestore.SERVER_TIMESTAMP,
        'ended_at': None,
    }
    
    livestream_ref.set(livestream_data)
    
    # Update the hub room to indicate there's a livestream
    room_ref = db.collection('hub_rooms').document(room_id)
    room_ref.update({
        'has_active_livestream': True,
        'active_stream_id': stream_id
    })
    
    return livestream_data


def end_livestream(db, stream_id):
    """
    Mark a livestream as ended in Firebase
    """
    livestream_ref = db.collection('livestreams').document(stream_id)
    livestream_doc = livestream_ref.get()
    
    if not livestream_doc.exists:
        return False
        
    livestream_data = livestream_doc.to_dict()
    room_id = livestream_data.get('room_id')
    
    # Update the livestream record
    livestream_ref.update({
        'status': 'ended',
        'ended_at': firestore.SERVER_TIMESTAMP
    })
    
    # Update the hub room
    if room_id:
        room_ref = db.collection('hub_rooms').document(room_id)
        room_ref.update({
            'has_active_livestream': False,
            'active_stream_id': None
        })
    
    return True


def get_active_livestreams(db, room_id=None):
    """
    Get all active livestreams, optionally filtered by room_id
    """
    livestreams_ref = db.collection('livestreams')
    
    if room_id:
        query = livestreams_ref.where(filter=FieldFilter('room_id', '==', room_id))
        query = query.where(filter=FieldFilter('status', '==', 'live'))
    else:
        query = livestreams_ref.where(filter=FieldFilter('status', '==', 'live'))
    
    results = query.stream()
    livestreams = []
    
    for doc in results:
        livestream_data = doc.to_dict()
        # Remove sensitive information
        if 'agora_token' in livestream_data:
            del livestream_data['agora_token']
        livestreams.append(livestream_data)
    
    return livestreams


def create_scheduled_livestream(db, teacher_id, room_id, title, description, scheduled_time, duration_minutes, notify_students=True):
    """
    Create a scheduled livestream
    """
    schedule_ref = db.collection('scheduled_livestreams').document()
    schedule_id = schedule_ref.id
    
    schedule_data = {
        'schedule_id': schedule_id,
        'teacher_id': teacher_id,
        'room_id': room_id,
        'title': title,
        'description': description,
        'scheduled_time': scheduled_time,  # ISO string format
        'duration_minutes': duration_minutes,
        'status': 'scheduled',
        'created_at': firestore.SERVER_TIMESTAMP,
    }
    
    schedule_ref.set(schedule_data)
    
    if notify_students:
        notify_students_about_livestream(db, teacher_id, room_id, schedule_id, title, scheduled_time, 'scheduled')
    
    return schedule_id


def cancel_scheduled_livestream(db, schedule_id, teacher_id):
    """
    Cancel a scheduled livestream
    """
    schedule_ref = db.collection('scheduled_livestreams').document(schedule_id)
    schedule_doc = schedule_ref.get()
    
    if not schedule_doc.exists:
        return False
    
    schedule_data = schedule_doc.to_dict()
    
    # Verify the teacher owns this scheduled livestream
    if schedule_data.get('teacher_id') != teacher_id:
        return False
    
    # Update the status to cancelled
    schedule_ref.update({
        'status': 'cancelled',
        'cancelled_at': firestore.SERVER_TIMESTAMP
    })
    
    return True


def notify_students_about_livestream(db, teacher_id, room_id, stream_id, title, scheduled_time=None, notification_type='started'):
    """
    Create notifications for students about a livestream
    notification_type can be 'started', 'scheduled', or 'cancelled'
    """
    # Get all students in this room
    room_members_ref = db.collection('room_members')
    query = room_members_ref.where(filter=FieldFilter('room_id', '==', room_id))
    members = query.stream()
    
    for member_doc in members:
        member_data = member_doc.to_dict()
        student_id = member_data.get('user_id')
        
        # Skip if this is the teacher
        if student_id == teacher_id:
            continue
        
        # Create a notification
        notification_ref = db.collection('notifications').document()
        
        notification_data = {
            'user_id': student_id,
            'sender_id': teacher_id,
            'room_id': room_id,
            'stream_id': stream_id,
            'title': title,
            'created_at': firestore.SERVER_TIMESTAMP,
            'read': False,
        }
        
        if notification_type == 'started':
            notification_data['type'] = 'livestream_started'
            notification_data['message'] = f"Livestream started: {title}"
        elif notification_type == 'scheduled':
            notification_data['type'] = 'livestream_scheduled'
            notification_data['message'] = f"Livestream scheduled: {title}"
            notification_data['scheduled_time'] = scheduled_time
        elif notification_type == 'cancelled':
            notification_data['type'] = 'livestream_cancelled'
            notification_data['message'] = f"Livestream cancelled: {title}"
        
        notification_ref.set(notification_data)