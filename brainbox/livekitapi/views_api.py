from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from .models import LivekitRoom

@csrf_exempt  # Added CSRF exemption for API calls
def create_room(request):
    """API endpoint to create a new LiveKit room from the teacher interface"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)
    
    try:
        # AUTHENTICATION CHECK BYPASSED FOR TESTING
        # Parse the request data
        import json
        data = json.loads(request.body)
        
        room_name = data.get('room_name', f'room-{timezone.now().timestamp()}')
        description = data.get('description', 'Created from teacher interface')
        
        # Create a new room
        room = LivekitRoom()
        room.description = description
        
        # If user is not authenticated, use a superuser as the owner
        if request.user.is_authenticated:
            room.owner = request.user
        else:
            # Find a superuser to be the owner
            from django.contrib.auth.models import User
            superuser = User.objects.filter(is_superuser=True).first()
            if not superuser:
                # If no superuser exists, create one (for development only)
                superuser = User.objects.create_superuser(
                    username='admin',
                    email='admin@example.com',
                    password='admin'
                )
            room.owner = superuser
        
        room.shareWithNextcloudGroup = "default-group"  # This might need to be configured
        room.save()
        
        # Return the room details
        return JsonResponse({
            'success': True,
            'room': {
                'id': room.id,
                'slug': room.slug,
                'description': room.description,
                'is_open': room.is_open,
            }
        })
    except Exception as e:
        import traceback
        traceback.print_exc()  # Print the full error for debugging
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
    



from django.shortcuts import render
from django.http import HttpResponse
import jwt
import time
import uuid
def view_room(request, slug):
    """View handler for LiveKit room URLs"""
    try:
        # Get LiveKit credentials
        api_key = "APIRsaxCuofVw7K"
        api_secret = "ZnrqffqzbGqyHdGqGGjTfL2I1fOGMMKSIK7Htqb11NDC"
        livekit_instance = "edulink-oxkw0h5q.livekit.cloud"
        
        # Generate token for viewing
        user_identity = request.user.username if request.user.is_authenticated else f"viewer-{uuid.uuid4()}"
        
        # Token expiration (1 hour)
        exp = int(time.time()) + 3600
        
        # Create claims
        claims = {
            'iss': api_key,
            'sub': user_identity,
            'exp': exp,
            'nbf': int(time.time()),
            'jti': str(uuid.uuid4()),
            'video': {
                'room': slug,
                'roomJoin': True,
                'canPublish': True,  # Allow publishing for teachers
                'canSubscribe': True,
            }
        }
        
        # Generate token
        token = jwt.encode(claims, api_secret, algorithm='HS256')
        if isinstance(token, bytes):
            token = token.decode('utf-8')
        
        # Create room URL for iframe
        room_url = f"https://{livekit_instance}/custom?liveKitUrl=wss://{livekit_instance}&token={token}"
        
        # Determine if this is a teacher or a student
        is_teacher = False
        if request.user.is_authenticated:
            # You could check for teacher status here based on your user model
            # For example: is_teacher = request.user.groups.filter(name='Teachers').exists()
            # For now, let's assume all authenticated users are teachers
            is_teacher = True
        
        context = {
            'roomURL': room_url,
            'ws_url': f"wss://{livekit_instance}",
            'token': token,
            'room_name': slug,
            'teacher_name': user_identity,
            'title': f"Live Session: {slug}",
            'can_record': False,
            'is_recording': False,
        }

        
        return render(request, 'myapp/teacher_livestream.html', context)
      
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return HttpResponse(f"Error loading room: {str(e)}", status=500)