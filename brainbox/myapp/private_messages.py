# private_messages.py

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
from .firebase import *
from datetime import datetime
from .community_page import *

def get_current_user_id(request):
    """
    Get the current user's ID based on session information
    """
    # Try to get student name from session
    current_student_name = request.session.get("students_name")
    if current_student_name:
        return get_user_id_by_name(current_student_name)
    
    # Try to get teacher name from session
    current_teacher_name = request.session.get("teachers_name")
    if current_teacher_name:
        return get_user_id_by_name(current_teacher_name)
    
    # No user found
    return None

def create_conversation_id(user_id1, user_id2):
    """
    Create a unique conversation ID for two users
    Always use the same order for consistency
    """
    return f"conversation_{'_'.join(sorted([user_id1, user_id2]))}"

@csrf_exempt
def get_messages(request):
    """
    Get messages between the current user and the specified user
    """
    if request.method != 'GET':
        return JsonResponse({'success': False, 'error': 'Only GET method is allowed'}, status=405)
    
    # Get the current user's ID
    current_user_id = get_current_user_id(request)
    if not current_user_id:
        return JsonResponse({
            'success': False,
            'error': 'User not authenticated'
        }, status=401)
    
    # Get the recipient ID from query parameters
    recipient_id = request.GET.get('recipient_id')
    if not recipient_id:
        return JsonResponse({
            'success': False,
            'error': 'Recipient ID is required'
        }, status=400)
    
    try:
        # Get the conversation ID
        conversation_id = create_conversation_id(current_user_id, recipient_id)
        
        # Get messages from the conversation
        messages_ref = db.collection('private_messages').document(conversation_id).collection('messages')
        messages = messages_ref.order_by('timestamp').stream()
        
        # Format messages for the client
        message_list = []
        for message in messages:
            message_data = message.to_dict()
            
            # Only include messages that the current user sent or received
            if message_data.get('sender_id') == current_user_id or message_data.get('recipient_id') == current_user_id:
                message_list.append({
                    'id': message.id,
                    'sender_id': message_data.get('sender_id'),
                    'recipient_id': message_data.get('recipient_id'),
                    'content': message_data.get('content'),
                    'timestamp': message_data.get('timestamp'),
                    'read': message_data.get('read', False)
                })
        
        return JsonResponse({
            'success': True,
            'messages': message_list
        })
    
    except Exception as e:
        print(f"Error getting messages: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def send_message(request):
    """
    Send a message from the current user to another user
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST method is allowed'}, status=405)
    
    # Get the current user's ID
    current_user_id = get_current_user_id(request)
    if not current_user_id:
        return JsonResponse({
            'success': False,
            'error': 'User not authenticated'
        }, status=401)
    
    try:
        # Parse the request data
        data = json.loads(request.body)
        recipient_id = data.get('recipient_id')
        message_content = data.get('message')
        
        if not recipient_id or not message_content:
            return JsonResponse({
                'success': False,
                'error': 'Recipient ID and message are required'
            }, status=400)
        
        # Create a message object
        message = {
            'sender_id': current_user_id,
            'recipient_id': recipient_id,
            'content': message_content,
            'timestamp': firestore.SERVER_TIMESTAMP,
            'read': False
        }
        
        # Get the conversation ID
        conversation_id = create_conversation_id(current_user_id, recipient_id)
        
        # Add the message to Firestore
        message_ref = db.collection('private_messages').document(conversation_id).collection('messages').document()
        message_ref.set(message)
        
        # Update the conversation metadata
        conversation_ref = db.collection('private_messages').document(conversation_id)
        conversation_ref.set({
            'participants': [current_user_id, recipient_id],
            'last_message': message_content,
            'last_message_time': firestore.SERVER_TIMESTAMP,
            'last_sender_id': current_user_id,
            'unread_count_' + recipient_id: firestore.Increment(1)
        }, merge=True)
        
        return JsonResponse({
            'success': True,
            'message_id': message_ref.id
        })
    
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON'
        }, status=400)
        
    except Exception as e:
        print(f"Error sending message: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def mark_messages_read(request):
    """
    Mark messages as read by the current user
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST method is allowed'}, status=405)
    
    # Get the current user's ID
    current_user_id = get_current_user_id(request)
    if not current_user_id:
        return JsonResponse({
            'success': False,
            'error': 'User not authenticated'
        }, status=401)
    
    try:
        # Parse the request data
        data = json.loads(request.body)
        sender_id = data.get('sender_id')
        
        if not sender_id:
            return JsonResponse({
                'success': False,
                'error': 'Sender ID is required'
            }, status=400)
        
        # Get the conversation ID
        conversation_id = create_conversation_id(current_user_id, sender_id)
        
        # Get all unread messages sent by the sender to the current user
        messages_ref = db.collection('private_messages').document(conversation_id).collection('messages')
        unread_messages = messages_ref.where('sender_id', '==', sender_id).where('recipient_id', '==', current_user_id).where('read', '==', False).stream()
        
        # Mark each message as read
        batch = db.batch()
        for message in unread_messages:
            message_ref = messages_ref.document(message.id)
            batch.update(message_ref, {'read': True})
        
        # Execute the batch
        batch.commit()
        
        # Reset unread count for this conversation
        conversation_ref = db.collection('private_messages').document(conversation_id)
        conversation_ref.update({
            f'unread_count_{current_user_id}': 0
        })
        
        return JsonResponse({
            'success': True
        })
    
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON'
        }, status=400)
        
    except Exception as e:
        print(f"Error marking messages as read: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def get_conversations(request):
    """
    Get all conversations for the current user
    """
    if request.method != 'GET':
        return JsonResponse({'success': False, 'error': 'Only GET method is allowed'}, status=405)
    
    # Get the current user's ID
    current_user_id = get_current_user_id(request)
    if not current_user_id:
        return JsonResponse({
            'success': False,
            'error': 'User not authenticated'
        }, status=401)
    
    try:
        # Get all conversations where the current user is a participant
        conversations_ref = db.collection('private_messages')
        conversations = conversations_ref.where('participants', 'array_contains', current_user_id).stream()
        
        # Format conversations for the client
        conversation_list = []
        for conversation in conversations:
            conversation_data = conversation.to_dict()
            
            # Get the other participant's ID
            participants = conversation_data.get('participants', [])
            other_participant_id = next((p for p in participants if p != current_user_id), None)
            
            if other_participant_id:
                # Get the other participant's details
                user_ref = db.collection('users_profile').document(other_participant_id)
                user = user_ref.get()
                user_data = user.to_dict() if user.exists else {}
                
                # Add conversation to list
                conversation_list.append({
                    'id': conversation.id,
                    'user_id': other_participant_id,
                    'name': user_data.get('name', 'Unknown User'),
                    'role': user_data.get('role', ''),
                    'profile_picture': user_data.get('profile_picture'),
                    'last_message': conversation_data.get('last_message', ''),
                    'last_message_time': conversation_data.get('last_message_time'),
                    'unread_count': conversation_data.get(f'unread_count_{current_user_id}', 0)
                })
        
        # Sort conversations by last message time (newest first)
        conversation_list.sort(key=lambda x: x.get('last_message_time', 0), reverse=True)
        
        return JsonResponse({
            'success': True,
            'conversations': conversation_list
        })
    
    except Exception as e:
        print(f"Error getting conversations: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)