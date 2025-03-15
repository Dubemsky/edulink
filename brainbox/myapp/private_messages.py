# Enhanced messages.py with private messaging functionality
from .firebase import *
from datetime import datetime
import pytz
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
from .community_page import get_user_following, get_user_id_by_name

def create_private_chat(sender_id, recipient_id):
    """
    Create a private chat room between two users.
    
    Args:
        sender_id: The ID of the user initiating the chat
        recipient_id: The ID of the recipient
        
    Returns:
        str: The chat room ID if successful, None otherwise
    """
    try:
        # Generate a unique room ID by combining user IDs (lexicographically sorted)
        user_ids = sorted([sender_id, recipient_id])
        room_id = f"private_chat_{user_ids[0]}_{user_ids[1]}"
        
        # Check if chat already exists
        chat_ref = db.collection('private_chats').document(room_id)
        chat_doc = chat_ref.get()
        
        if not chat_doc.exists:
            # Create the chat room
            chat_ref.set({
                'participants': [sender_id, recipient_id],
                'created_at': firestore.SERVER_TIMESTAMP,
                'last_message': None,
                'last_message_time': None
            })
            print(f"Created new private chat: {room_id}")
        else:
            print(f"Chat already exists: {room_id}")
            
        return room_id
    except Exception as e:
        print(f"Error creating private chat: {e}")
        return None

def send_private_message(sender_id, recipient_id, content, message_type="text", file_url=None):
    """
    Send a private message between users.
    
    Args:
        sender_id: The ID of the message sender
        recipient_id: The ID of the message recipient
        content: The message content
        message_type: Type of message (text, file, etc.)
        file_url: URL of file if message_type is "file"
        
    Returns:
        dict: Result with success status and message ID if successful
    """
    try:
        # Get or create chat room
        room_id = create_private_chat(sender_id, recipient_id)
        if not room_id:
            return {
                'success': False,
                'error': 'Failed to create or find chat room'
            }
        
        # Create message
        now_utc = datetime.now(pytz.utc)
        timestamp = now_utc.strftime('%Y-%m-%d %H:%M:%S')
        
        message_data = {
            'sender_id': sender_id,
            'recipient_id': recipient_id,
            'content': content,
            'message_type': message_type,
            'timestamp': timestamp,
            'read': False
        }
        
        if message_type == "file":
            message_data['file_url'] = file_url
        
        # Add message to database
        messages_ref = db.collection('private_messages')
        message_doc = messages_ref.add(message_data)
        message_id = message_doc[1].id
        
        # Update chat room with last message info
        chat_ref = db.collection('private_chats').document(room_id)
        chat_ref.update({
            'last_message': content,
            'last_message_time': timestamp,
            'last_message_sender': sender_id
        })
        
        print(f"Sent private message: {message_id}")
        return {
            'success': True,
            'message_id': message_id,
            'room_id': room_id
        }
    except Exception as e:
        print(f"Error sending private message: {e}")
        return {
            'success': False,
            'error': str(e)
        }



def get_private_chats(user_id):
    """
    Get all private chats for a user.
    
    Args:
        user_id: The ID of the user
        
    Returns:
        list: List of chat rooms with basic info
    """
    try:
        # Query for chats where user is a participant
        chats_ref = db.collection('private_chats')
        
        # We need two queries since Firestore doesn't support OR queries
        chats1 = chats_ref.where('participants', 'array_contains', user_id).stream()
        
        chats_list = []
        for chat in chats1:
            chat_data = chat.to_dict()
            chat_id = chat.id
            
            # Find the other participant
            participants = chat_data.get('participants', [])
            other_user_id = next((pid for pid in participants if pid != user_id), None)
            
            if not other_user_id:
                continue
                
            # Get the other user's info
            other_user_ref = db.collection('users_profile').document(other_user_id).get()
            if not other_user_ref.exists:
                continue
                
            other_user_data = other_user_ref.to_dict()
            
            # Check if this is mutual follow (for primary inbox vs message requests)
            following_ids = get_user_following(user_id)
            mutual_follow = other_user_id in following_ids and user_id in get_user_following(other_user_id)
            
            # Add to chats list
            chats_list.append({
                'chat_id': chat_id,
                'other_user_id': other_user_id,
                'other_user_name': other_user_data.get('name', 'Unknown User'),
                'other_user_profile_pic': other_user_data.get('profile_picture', ''),
                'other_user_role': other_user_data.get('role', 'Unknown'),
                'last_message': chat_data.get('last_message'),
                'last_message_time': chat_data.get('last_message_time'),
                'last_message_sender': chat_data.get('last_message_sender'),
                'mutual_follow': mutual_follow
            })
        
        # Sort by last message time (newest first)
        return sorted(
            chats_list, 
            key=lambda x: x.get('last_message_time', '1970-01-01 00:00:00'), 
            reverse=True
        )
    except Exception as e:
        print(f"Error getting private chats: {e}")
        return []

def get_chat_messages(chat_id, limit=50):
    """
    Get messages for a specific chat.
    
    Args:
        chat_id: The ID of the chat
        limit: Maximum number of messages to return
        
    Returns:
        list: List of messages
    """
    try:
        # Parse the user IDs from the chat_id
        parts = chat_id.split('_')
        if len(parts) < 3:
            return []
            
        user1_id = parts[1]
        user2_id = parts[2]
        
        # Query for messages between these users
        messages_ref = db.collection('private_messages')
        
        # We need multiple queries to get all messages between the users
        query1 = messages_ref.where('sender_id', '==', user1_id).where('recipient_id', '==', user2_id)
        query2 = messages_ref.where('sender_id', '==', user2_id).where('recipient_id', '==', user1_id)
        
        messages1 = list(query1.stream())
        messages2 = list(query2.stream())
        
        # Combine and convert to dict
        messages_list = []
        for msg in messages1 + messages2:
            msg_data = msg.to_dict()
            msg_data['id'] = msg.id
            messages_list.append(msg_data)
        
        # Sort by timestamp
        messages_list.sort(key=lambda x: x.get('timestamp', '1970-01-01 00:00:00'))
        
        # Return the most recent messages up to the limit
        return messages_list[-limit:] if limit > 0 else messages_list
    except Exception as e:
        print(f"Error getting chat messages: {e}")
        return []

def mark_messages_as_read(chat_id, user_id):
    """
    Mark all messages in a chat as read for a specific user.
    
    Args:
        chat_id: The ID of the chat
        user_id: The ID of the user marking messages as read
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Parse the user IDs from the chat_id
        parts = chat_id.split('_')
        if len(parts) < 3:
            return False
            
        user1_id = parts[1]
        user2_id = parts[2]
        
        # The other user ID is the one that's not the current user
        other_user_id = user2_id if user_id == user1_id else user1_id
        
        # Query for unread messages from the other user
        messages_ref = db.collection('private_messages')
        query = messages_ref.where('sender_id', '==', other_user_id).where('recipient_id', '==', user_id).where('read', '==', False)
        
        unread_messages = query.stream()
        batch = db.batch()
        
        # Mark all as read
        count = 0
        for msg in unread_messages:
            msg_ref = messages_ref.document(msg.id)
            batch.update(msg_ref, {'read': True})
            count += 1
        
        if count > 0:
            batch.commit()
            print(f"Marked {count} messages as read")
            
        return True
    except Exception as e:
        print(f"Error marking messages as read: {e}")
        return False

    



# API Endpoints for messaging system

@csrf_exempt
def start_private_chat(request):
    """
    API endpoint to start or get a private chat with another user
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST method is allowed'}, status=405)
    
    try:
        # Parse the request data
        data = json.loads(request.body)
        recipient_user_id = data.get('recipient_id')
        
        if not recipient_user_id:
            return JsonResponse({
                'success': False,
                'error': 'Recipient ID is required'
            }, status=400)
        
        # Get the current user ID (could be student or teacher)
        current_user_id = None
        
        # Check if user is a student
        current_student_name = get_student_user_id(request)
        if current_student_name:
            current_user_id = get_user_id_by_name(current_student_name)
        else:
            # Check if user is a teacher
            current_teacher_name = get_teacher_user_id(request)
            if current_teacher_name:
                current_user_id = get_user_id_by_name(current_teacher_name)
        
        if not current_user_id:
            return JsonResponse({
                'success': False,
                'error': 'Unable to determine current user'
            }, status=401)
        
        # Create or get chat room
        room_id = create_private_chat(current_user_id, recipient_user_id)
        
        if not room_id:
            return JsonResponse({
                'success': False,
                'error': 'Failed to create chat room'
            }, status=500)
            
        return JsonResponse({
            'success': True,
            'room_id': room_id
        })
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON'
        }, status=400)
        
    except Exception as e:
        print(f"Error in start_private_chat: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def send_message(request):
    """
    API endpoint to send a message to another user
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST method is allowed'}, status=405)
    
    try:
        # Parse the request data
        data = json.loads(request.body)
        recipient_id = data.get('recipient_id')
        content = data.get('content')
        message_type = data.get('type', 'text')
        file_url = data.get('file_url')
        
        if not recipient_id or not content:
            return JsonResponse({
                'success': False,
                'error': 'Recipient ID and content are required'
            }, status=400)
        
        # Get the current user ID
        current_user_id = None
        
        # Check if user is a student
        current_student_name = get_student_user_id(request)
        if current_student_name:
            current_user_id = get_user_id_by_name(current_student_name)
        else:
            # Check if user is a teacher
            current_teacher_name = get_teacher_user_id(request)
            if current_teacher_name:
                current_user_id = get_user_id_by_name(current_teacher_name)
        
        if not current_user_id:
            return JsonResponse({
                'success': False,
                'error': 'Unable to determine current user'
            }, status=401)
        
        # Send the message
        result = send_private_message(
            current_user_id, 
            recipient_id, 
            content, 
            message_type, 
            file_url
        )
        
        if result['success']:
            return JsonResponse({
                'success': True,
                'message_id': result['message_id'],
                'room_id': result['room_id']
            })
        else:
            return JsonResponse({
                'success': False,
                'error': result.get('error', 'Failed to send message')
            }, status=500)
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON'
        }, status=400)
        
    except Exception as e:
        print(f"Error in send_message: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def get_chats(request):
    """
    API endpoint to get all chats for the current user
    """
    try:
        # Get the current user ID
        current_user_id = None
        
        # Check if user is a student
        current_student_name = get_student_user_id(request)
        if current_student_name:
            current_user_id = get_user_id_by_name(current_student_name)
        else:
            # Check if user is a teacher
            current_teacher_name = get_teacher_user_id(request)
            if current_teacher_name:
                current_user_id = get_user_id_by_name(current_teacher_name)
        
        if not current_user_id:
            return JsonResponse({
                'success': False,
                'error': 'Unable to determine current user'
            }, status=401)
        
        # Get the user's chats
        chats = get_private_chats(current_user_id)
        
        # Split into primary inbox and message requests
        primary_inbox = [chat for chat in chats if chat['mutual_follow']]
        message_requests = [chat for chat in chats if not chat['mutual_follow']]
        
        return JsonResponse({
            'success': True,
            'primary_inbox': primary_inbox,
            'message_requests': message_requests
        })
        
    except Exception as e:
        print(f"Error in get_chats: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def get_chat_history(request):
    """
    API endpoint to get message history for a specific chat
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST method is allowed'}, status=405)
    
    try:
        # Parse the request data
        data = json.loads(request.body)
        chat_id = data.get('chat_id')
        limit = int(data.get('limit', 50))
        
        if not chat_id:
            return JsonResponse({
                'success': False,
                'error': 'Chat ID is required'
            }, status=400)
        
        # Get the current user ID
        current_user_id = None
        
        # Check if user is a student
        current_student_name = get_student_user_id(request)
        if current_student_name:
            current_user_id = get_user_id_by_name(current_student_name)
        else:
            # Check if user is a teacher
            current_teacher_name = get_teacher_user_id(request)
            if current_teacher_name:
                current_user_id = get_user_id_by_name(current_teacher_name)
        
        if not current_user_id:
            return JsonResponse({
                'success': False,
                'error': 'Unable to determine current user'
            }, status=401)
        
        # Get the chat messages
        messages = get_chat_messages(chat_id, limit)
        
        # Mark messages as read
        mark_messages_as_read(chat_id, current_user_id)
        
        return JsonResponse({
            'success': True,
            'messages': messages,
            'current_user_id': current_user_id
        })
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON'
        }, status=400)
        
    except Exception as e:
        print(f"Error in get_chat_history: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

# Helper functions
def get_student_user_id(request):
    return request.session.get("students_name")

def get_teacher_user_id(request):
    return request.session.get("teachers_name")

def get_unread_message_count(user_id):
    """
    Get the count of unread messages for a user
    
    Args:
        user_id: The ID of the user
        
    Returns:
        dict: Counts of unread messages in primary inbox and message requests
    """
    try:
        # Query for unread messages where user is the recipient
        messages_ref = db.collection('private_messages')
        unread_query = messages_ref.where('recipient_id', '==', user_id).where('read', '==', False)
        
        unread_messages = list(unread_query.stream())
        if not unread_messages:
            return {
                'primary_inbox': 0,
                'message_requests': 0,
                'total': 0
            }
        
        # Get list of users the current user is following
        following_ids = get_user_following(user_id)
        
        # Count messages from mutual follows vs others
        primary_count = 0
        requests_count = 0
        
        for msg in unread_messages:
            msg_data = msg.to_dict()
            sender_id = msg_data.get('sender_id')
            
            # Check if sender is someone the user follows and if they follow back
            if sender_id in following_ids and user_id in get_user_following(sender_id):
                primary_count += 1
            else:
                requests_count += 1
        
        return {
            'primary_inbox': primary_count,
            'message_requests': requests_count,
            'total': primary_count + requests_count
        }
        
    except Exception as e:
        print(f"Error getting unread message count: {e}")
        return {
            'primary_inbox': 0,
            'message_requests': 0,
            'total': 0
        }