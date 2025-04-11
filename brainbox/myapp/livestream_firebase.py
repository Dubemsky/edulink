import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from datetime import datetime

# Function to store livestream data in Firebase
@csrf_exempt
@login_required
def store_livestream_firebase(request):
    """Store livestream information in Firebase"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)
    
    try:
        # Parse data from request
        data = json.loads(request.body)
        
        # Required fields
        required_fields = ['slug', 'title', 'room_id', 'teacher']
        for field in required_fields:
            if field not in data:
                return JsonResponse({
                    'success': False, 
                    'error': f'Missing required field: {field}'
                }, status=400)
        
        # Get Firestore database from the existing setup
        from .firebase import db
        
        # Store the data in Firestore
        livestream_ref = db.collection('livestreams').document(data['slug'])
        
        # Prepare the data for Firestore
        livestream_data = {
            'slug': data['slug'],
            'title': data['title'],
            'room_id': data['room_id'],
            'teacher': data['teacher'],
            'status': 'active',
            'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'viewers': 0,
        }
        
        # Add the data to Firestore
        livestream_ref.set(livestream_data)
        
        # Send notifications to students if needed
        if data.get('notify_students', False):
            send_livestream_notifications(data['room_id'], data['teacher'], data['title'], data['slug'])
        
        return JsonResponse({'success': True})
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

# Function to update livestream status in Firebase
@csrf_exempt
@login_required
def update_livestream_status(request):
    """Update the status of a livestream in Firebase"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)
    
    try:
        # Parse data from request
        data = json.loads(request.body)
        
        # Required fields
        if 'slug' not in data or 'status' not in data:
            return JsonResponse({
                'success': False, 
                'error': 'Missing required fields: slug and status'
            }, status=400)
        
        # Get Firestore database
        from .firebase import db
        
        # Get the livestream document
        livestream_ref = db.collection('livestreams').document(data['slug'])
        livestream_doc = livestream_ref.get()
        
        if not livestream_doc.exists:
            return JsonResponse({
                'success': False, 
                'error': 'Livestream not found'
            }, status=404)
        
        # Update the status
        livestream_ref.update({
            'status': data['status'],
            'ended_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S') if data['status'] == 'ended' else None
        })
        
        # Send notifications about stream ending if needed
        if data['status'] == 'ended':
            notify_stream_ended(data['slug'])
        
        return JsonResponse({'success': True})
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

# Function to check livestream status in Firebase
def check_livestream_status(request):
    """Check the status of a livestream in Firebase"""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)
    
    try:
        # Get slug from query parameters
        slug = request.GET.get('slug')
        
        if not slug:
            return JsonResponse({
                'success': False, 
                'error': 'Missing required parameter: slug'
            }, status=400)
        
        # Get Firestore database
        from .firebase import db
        
        # Get the livestream document
        livestream_ref = db.collection('livestreams').document(slug)
        livestream_doc = livestream_ref.get()
        
        if not livestream_doc.exists:
            return JsonResponse({
                'success': False, 
                'error': 'Livestream not found'
            }, status=404)
        
        # Return the status
        livestream_data = livestream_doc.to_dict()
        
        return JsonResponse({
            'success': True,
            'status': livestream_data.get('status', 'unknown'),
            'title': livestream_data.get('title', ''),
            'teacher': livestream_data.get('teacher', ''),
            'viewers': livestream_data.get('viewers', 0),
            'created_at': livestream_data.get('created_at', '')
        })
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

# Get active livestreams for a room
def get_room_livestreams(request):
    """Get active livestreams for a specific room"""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)
    
    try:
        # Get room_id from query parameters
        room_id = request.GET.get('room_id')
        
        if not room_id:
            return JsonResponse({
                'success': False, 
                'error': 'Missing required parameter: room_id'
            }, status=400)
        
        # Get Firestore database
        from .firebase import db
        
        # Query active livestreams for this room
        livestreams_ref = db.collection('livestreams').where('room_id', '==', room_id).where('status', '==', 'active')
        
        # Get the livestreams
        livestreams = []
        for doc in livestreams_ref.stream():
            livestream_data = doc.to_dict()
            livestreams.append({
                'slug': livestream_data.get('slug', ''),
                'title': livestream_data.get('title', ''),
                'teacher': livestream_data.get('teacher', ''),
                'created_at': livestream_data.get('created_at', ''),
                'viewers': livestream_data.get('viewers', 0)
            })
        
        return JsonResponse({
            'success': True,
            'livestreams': livestreams
        })
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

# Send notifications about new livestreams to students in the room
def send_livestream_notifications(room_id, teacher_name, stream_title, stream_slug):
    """Send notifications to students about new livestream"""
    try:
        # Get Firestore database
        from .firebase import db
        
        # Get all students in the room
        # This assumes you have a collection of room memberships or similar
        # You'll need to adjust this based on your data model
        student_refs = db.collection('room_memberships').where('room_id', '==', room_id).where('role', '==', 'student')
        
        for student_doc in student_refs.stream():
            student_data = student_doc.to_dict()
            student_username = student_data.get('username')
            
            if not student_username:
                continue
            
            # Create notification
            notification_data = {
                'username': student_username,
                'type': 'livestream',
                'content': f"{teacher_name} started a livestream: {stream_title}",
                'livestream_id': stream_slug,
                'room_id': room_id,
                'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'read': False
            }
            
            # Add notification to Firebase
            db.collection('notifications').add(notification_data)
    
    except Exception as e:
        print(f"Error sending livestream notifications: {e}")

# Notify about stream ending
def notify_stream_ended(stream_slug):
    """Notify about stream ending"""
    try:
        # Get Firestore database
        from .firebase import db
        
        # Get the livestream
        livestream_ref = db.collection('livestreams').document(stream_slug)
        livestream_doc = livestream_ref.get()
        
        if not livestream_doc.exists:
            return
        
        livestream_data = livestream_doc.to_dict()
        room_id = livestream_data.get('room_id')
        teacher = livestream_data.get('teacher')
        
        # Simply update the status; we don't need to send new notifications
        # You could add additional logic here if needed
        
    except Exception as e:
        print(f"Error processing stream end: {e}")





# myapp/direct_firebase
from .firebase import db  # Import your Firebase db instance

@csrf_exempt
def store_livestream_direct(request):
    """Store livestream info in Firebase without requiring authentication"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)
    
    try:
        # Parse data from request
        data = json.loads(request.body)
        
        # Validate required fields
        required_fields = ['slug', 'title', 'room_id', 'teacher']
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            return JsonResponse({
                'success': False, 
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }, status=400)
        
        # Prepare the data for Firestore
        livestream_data = {
            'slug': data['slug'],
            'title': data['title'],
            'room_id': data['room_id'],
            'teacher': data['teacher'],
            'status': 'active',
            'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'viewers': 0,
        }
        
        # Add to Firestore
        livestream_ref = db.collection('livestreams').document(data['slug'])
        livestream_ref.set(livestream_data)
        
        return JsonResponse({'success': True})
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
    



@csrf_exempt
def update_livestream_status_direct(request):
    """Update livestream status without authentication"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)
    
    try:
        # Parse data from request
        data = json.loads(request.body)
        
        # Validate required fields
        if 'slug' not in data or 'status' not in data:
            return JsonResponse({
                'success': False, 
                'error': 'Missing required fields: slug and status'
            }, status=400)
        
        # Get the livestream document
        livestream_ref = db.collection('livestreams').document(data['slug'])
        livestream_doc = livestream_ref.get()
        
        if not livestream_doc.exists:
            return JsonResponse({
                'success': False, 
                'error': 'Livestream not found'
            }, status=404)
        
        # Update fields
        update_data = {
            'status': data['status']
        }
        
        # Add viewers if provided
        if 'viewers' in data:
            update_data['viewers'] = data['viewers']
            
        # Add ended_at timestamp if stream is ending
        if data['status'] == 'ended':
            update_data['ended_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
        # Update the document
        livestream_ref.update(update_data)
        
        return JsonResponse({'success': True})
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)}, status=500)