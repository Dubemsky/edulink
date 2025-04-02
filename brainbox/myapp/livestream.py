from .firebase import *
from .views_hub_room import *

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