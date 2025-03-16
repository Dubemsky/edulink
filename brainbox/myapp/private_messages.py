# Enhanced messages.py with LinkedIn-style direct messaging functionality
from .firebase import *
from datetime import datetime
import pytz
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
from .community_page import get_user_following, get_user_id_by_name
from .encryption import encryption_manager

def create_direct_chat(sender_id, recipient_id):
    """
    Create a direct chat room between two users.
    
    Args:
        sender_id: The ID of the user initiating the chat
        recipient_id: The ID of the recipient
        
    Returns:
        str: The chat room ID if successful, None otherwise
    """
    try:
        # Generate a unique room ID by combining user IDs (lexicographically sorted)
        user_ids = sorted([sender_id, recipient_id])
        room_id = f"direct_chat_{user_ids[0]}_{user_ids[1]}"
        
        # Check if chat already exists
        chat_ref = db.collection('direct_chats').document(room_id)
        chat_doc = chat_ref.get()
        
        if not chat_doc.exists:
            # Create the chat room
            chat_ref.set({
                'participants': [sender_id, recipient_id],
                'created_at': firestore.SERVER_TIMESTAMP,
                'last_message': None,
                'last_message_time': None,
                'unread_counts': {
                    sender_id: 0,
                    recipient_id: 0
                }
            })
            print(f"Created new direct chat: {room_id}")
        else:
            print(f"Chat already exists: {room_id}")
            
        return room_id
    except Exception as e:
        print(f"Error creating direct chat: {e}")
        return None

def send_direct_message(sender_id, recipient_id, content, message_type="text", file_url=None):
    """
    Send a direct message between users with encryption.
    
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
        room_id = create_direct_chat(sender_id, recipient_id)
        if not room_id:
            return {
                'success': False,
                'error': 'Failed to create or find chat room'
            }
        
        # Encrypt the message content
        encrypted_content = encryption_manager.encrypt(content)
        
        # Create message
        now_utc = datetime.now(pytz.utc)
        timestamp = now_utc.strftime('%Y-%m-%d %H:%M:%S')
        
        message_data = {
            'sender_id': sender_id,
            'recipient_id': recipient_id,
            'content': encrypted_content,  # Store encrypted content
            'message_type': message_type,
            'timestamp': timestamp,
            'read': False
        }
        
        if message_type == "file":
            message_data['file_url'] = file_url
        
        # Add message to database
        messages_ref = db.collection('direct_messages')
        message_doc = messages_ref.add(message_data)
        message_id = message_doc[1].id
        
        # Update chat room with last message info (also encrypted)
        chat_ref = db.collection('direct_chats').document(room_id)
        
        # Get current chat data to update unread count
        chat_data = chat_ref.get().to_dict() or {}
        unread_counts = chat_data.get('unread_counts', {})
        
        # Increment recipient's unread count
        current_count = unread_counts.get(recipient_id, 0)
        unread_counts[recipient_id] = current_count + 1
        
        # Update the chat
        chat_ref.update({
            'last_message': encrypted_content,
            'last_message_time': timestamp,
            'last_message_sender': sender_id,
            'unread_counts': unread_counts
        })
        
        print(f"Sent direct message: {message_id}")
        return {
            'success': True,
            'message_id': message_id,
            'room_id': room_id,
            'timestamp': timestamp
        }
    except Exception as e:
        print(f"Error sending direct message: {e}")
        return {
            'success': False,
            'error': str(e)
        }

def get_direct_chats(user_id):
    """
    Get all direct chats for a user with LinkedIn-style organization.
    
    Args:
        user_id: The ID of the user
        
    Returns:
        dict: Dictionary with primary_inbox and message_requests, plus unread counts
    """
    try:
        # Query for chats where user is a participant
        chats_ref = db.collection('direct_chats')
        chats_query = chats_ref.where('participants', 'array_contains', user_id)
        
        chats = list(chats_query.stream())
        
        # Get all users the current user is following
        following_ids = get_user_following(user_id)
        
        # Prepare result lists
        primary_inbox = []
        message_requests = []
        
        # Unread counts
        primary_unread_count = 0
        requests_unread_count = 0
        
        for chat in chats:
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
            
            # Get the user's unread count for this chat
            unread_counts = chat_data.get('unread_counts', {})
            unread_count = unread_counts.get(user_id, 0)
            
            # Decrypt the last message if it exists
            encrypted_last_message = chat_data.get('last_message')
            last_message = None
            if encrypted_last_message:
                try:
                    last_message = encryption_manager.decrypt(encrypted_last_message)
                except:
                    last_message = "Unable to decrypt message"
            
            # Prepare the chat data
            chat_info = {
                'chat_id': chat_id,
                'other_user_id': other_user_id,
                'other_user_name': other_user_data.get('name', 'Unknown User'),
                'other_user_profile_pic': other_user_data.get('profile_picture', ''),
                'other_user_role': other_user_data.get('role', 'Unknown'),
                'last_message': last_message,
                'last_message_time': chat_data.get('last_message_time'),
                'last_message_sender': chat_data.get('last_message_sender'),
                'unread_count': unread_count,
                'online_status': is_user_online(other_user_id)
            }
            
            # Check if this is mutual follow or if the other user is verified
            # LinkedIn-style: Primary inbox includes connections and verified users
            is_mutual = other_user_id in following_ids and user_id in get_user_following(other_user_id)
            is_verified = other_user_data.get('verified', False)
            
            if is_mutual or is_verified:
                primary_inbox.append(chat_info)
                primary_unread_count += unread_count
            else:
                message_requests.append(chat_info)
                requests_unread_count += unread_count
        
        # Sort by last message time (newest first)
        primary_inbox = sorted(
            primary_inbox, 
            key=lambda x: x.get('last_message_time', '1970-01-01 00:00:00'), 
            reverse=True
        )
        
        message_requests = sorted(
            message_requests, 
            key=lambda x: x.get('last_message_time', '1970-01-01 00:00:00'), 
            reverse=True
        )
        
        return {
            'primary_inbox': primary_inbox,
            'message_requests': message_requests,
            'unread_counts': {
                'primary': primary_unread_count,
                'requests': requests_unread_count,
                'total': primary_unread_count + requests_unread_count
            }
        }
    except Exception as e:
        print(f"Error getting direct chats: {e}")
        return {
            'primary_inbox': [],
            'message_requests': [],
            'unread_counts': {
                'primary': 0,
                'requests': 0,
                'total': 0
            }
        }

def get_direct_chat_messages(chat_id, limit=50):
    """
    Get messages for a specific direct chat with decryption.
    
    Args:
        chat_id: The ID of the chat
        limit: Maximum number of messages to return
        
    Returns:
        list: List of decrypted messages
    """
    try:
        # Parse the user IDs from the chat_id
        parts = chat_id.split('_')
        if len(parts) < 3:
            print(f"Invalid chat_id format: {chat_id}")
            return []
            
        user1_id = parts[1]
        user2_id = parts[2]
        
        # Query for messages between these users
        messages_ref = db.collection('direct_messages')
        
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
            
            # Decrypt the message content
            encrypted_content = msg_data.get('content')
            if encrypted_content:
                try:
                    msg_data['content'] = encryption_manager.decrypt(encrypted_content)
                except:
                    msg_data['content'] = "Unable to decrypt message"
            
            messages_list.append(msg_data)
        
        # Sort by timestamp
        messages_list.sort(key=lambda x: x.get('timestamp', '1970-01-01 00:00:00'))
        
        # Return the most recent messages up to the limit
        return messages_list[-limit:] if limit > 0 else messages_list
    except Exception as e:
        print(f"Error getting direct chat messages: {e}")
        return []

def mark_direct_chat_as_read(chat_id, user_id):
    """
    Mark all messages in a direct chat as read for a specific user.
    
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
        
        # Start a transaction to ensure atomic updates
        transaction = db.transaction()
        
        @firestore.transactional
        def update_in_transaction(transaction, chat_ref, messages_ref, other_user_id, user_id):
            # Get current chat data
            chat_doc = chat_ref.get(transaction=transaction)
            if not chat_doc.exists:
                return False
            
            chat_data = chat_doc.to_dict()
            
            # Reset unread count for this user
            unread_counts = chat_data.get('unread_counts', {})
            unread_counts[user_id] = 0
            
            # Update the chat document
            transaction.update(chat_ref, {'unread_counts': unread_counts})
            
            # Query for unread messages from the other user
            query = messages_ref.where('sender_id', '==', other_user_id).where('recipient_id', '==', user_id).where('read', '==', False)
            
            unread_messages = query.stream()
            
            # Mark all as read
            count = 0
            for msg in unread_messages:
                msg_ref = messages_ref.document(msg.id)
                transaction.update(msg_ref, {'read': True})
                count += 1
            
            print(f"Marked {count} messages as read")
            return True
        
        # Get references
        chat_ref = db.collection('direct_chats').document(chat_id)
        messages_ref = db.collection('direct_messages')
        
        # Execute the transaction
        success = update_in_transaction(transaction, chat_ref, messages_ref, other_user_id, user_id)
        return success
    except Exception as e:
        print(f"Error marking messages as read: {e}")
        return False

def is_user_online(user_id):
    """
    Check if a user is currently online.
    For now, this is a placeholder implementation.
    
    Args:
        user_id: The ID of the user
        
    Returns:
        bool: True if user is online, False otherwise
    """
    try:
        # Check the user's last seen timestamp
        user_ref = db.collection('user_sessions').document(user_id).get()
        if not user_ref.exists:
            return False
            
        user_data = user_ref.to_dict()
        last_active = user_data.get('last_active')
        
        if not last_active:
            return False
            
        # Convert to datetime
        try:
            last_active_time = datetime.strptime(last_active, '%Y-%m-%d %H:%M:%S')
            # User is considered online if active in the last 5 minutes
            now = datetime.now(pytz.utc)
            diff = now - last_active_time.replace(tzinfo=pytz.utc)
            return diff.total_seconds() < 300  # 5 minutes
        except:
            return False
    except Exception as e:
        print(f"Error checking if user is online: {e}")
        return False

def update_user_online_status(user_id):
    """
    Update a user's online status.
    
    Args:
        user_id: The ID of the user
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        now_utc = datetime.now(pytz.utc).strftime('%Y-%m-%d %H:%M:%S')
        
        # Update or create the user session document
        user_ref = db.collection('user_sessions').document(user_id)
        user_ref.set({
            'last_active': now_utc,
            'user_id': user_id
        }, merge=True)
        
        return True
    except Exception as e:
        print(f"Error updating user online status: {e}")
        return False

# API Endpoints for direct messaging system

@csrf_exempt
def start_direct_chat_api(request):
    """
    API endpoint to start or get a direct chat with another user
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST method is allowed'}, status=405)
    
    try:
        # Parse the request data
        data = json.loads(request.body)
        recipient_id = data.get('recipient_id')
        
        if not recipient_id:
            return JsonResponse({
                'success': False,
                'error': 'Recipient ID is required'
            }, status=400)
        
        # Get the current user ID (could be student or teacher)
        current_user_id = get_current_user_id(request)
        
        if not current_user_id:
            return JsonResponse({
                'success': False,
                'error': 'Unable to determine current user'
            }, status=401)
        
        # Update the user's online status
        update_user_online_status(current_user_id)
        
        # Create or get chat room
        chat_id = create_direct_chat(current_user_id, recipient_id)
        
        if not chat_id:
            return JsonResponse({
                'success': False,
                'error': 'Failed to create chat room'
            }, status=500)
            
        return JsonResponse({
            'success': True,
            'chat_id': chat_id
        })
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON'
        }, status=400)
        
    except Exception as e:
        print(f"Error in start_direct_chat_api: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def send_direct_message_api(request):
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
        temp_id = data.get('temp_id')  # ID for optimistic UI updates
        
        if not recipient_id or not content:
            return JsonResponse({
                'success': False,
                'error': 'Recipient ID and content are required'
            }, status=400)
        
        # Get the current user ID
        current_user_id = get_current_user_id(request)
        
        if not current_user_id:
            return JsonResponse({
                'success': False,
                'error': 'Unable to determine current user'
            }, status=401)
        
        # Update the user's online status
        update_user_online_status(current_user_id)
        
        # Send the message
        result = send_direct_message(
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
                'room_id': result['room_id'],
                'timestamp': result['timestamp'],
                'temp_id': temp_id
            })
        else:
            return JsonResponse({
                'success': False,
                'error': result.get('error', 'Failed to send message'),
                'temp_id': temp_id
            }, status=500)
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON'
        }, status=400)
        
    except Exception as e:
        print(f"Error in send_direct_message_api: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def get_direct_chats_api(request):
    """
    API endpoint to get all direct chats for the current user
    """
    try:
        # Get the current user ID
        current_user_id = get_current_user_id(request)
        
        if not current_user_id:
            return JsonResponse({
                'success': False,
                'error': 'Unable to determine current user'
            }, status=401)
        
        # Update the user's online status
        update_user_online_status(current_user_id)
        
        # Get the user's chats
        chats_data = get_direct_chats(current_user_id)
        
        return JsonResponse({
            'success': True,
            'primary_inbox': chats_data['primary_inbox'],
            'message_requests': chats_data['message_requests'],
            'unread_counts': chats_data['unread_counts']
        })
        
    except Exception as e:
        print(f"Error in get_direct_chats_api: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def get_direct_chat_history_api(request):
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
        current_user_id = get_current_user_id(request)
        
        if not current_user_id:
            return JsonResponse({
                'success': False,
                'error': 'Unable to determine current user'
            }, status=401)
        
        # Update the user's online status
        update_user_online_status(current_user_id)
        
        # Get the chat messages
        messages = get_direct_chat_messages(chat_id, limit)
        
        # Mark messages as read
        mark_direct_chat_as_read(chat_id, current_user_id)
        
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
        print(f"Error in get_direct_chat_history_api: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def mark_chat_read_api(request):
    """
    API endpoint to mark all messages in a chat as read
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST method is allowed'}, status=405)
    
    try:
        # Parse the request data
        data = json.loads(request.body)
        chat_id = data.get('chat_id')
        
        if not chat_id:
            return JsonResponse({
                'success': False,
                'error': 'Chat ID is required'
            }, status=400)
        
        # Get the current user ID
        current_user_id = get_current_user_id(request)
        
        if not current_user_id:
            return JsonResponse({
                'success': False,
                'error': 'Unable to determine current user'
            }, status=401)
        
        # Update the user's online status
        update_user_online_status(current_user_id)
        
        # Mark messages as read
        success = mark_direct_chat_as_read(chat_id, current_user_id)
        
        return JsonResponse({
            'success': success
        })
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON'
        }, status=400)
        
    except Exception as e:
        print(f"Error in mark_chat_read_api: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def get_unread_counts_api(request):
    """
    API endpoint to get the count of unread messages for the current user
    """
    try:
        # Get the current user ID
        current_user_id = get_current_user_id(request)
        
        if not current_user_id:
            return JsonResponse({
                'success': False,
                'error': 'Unable to determine current user'
            }, status=401)
        
        # Get the user's chats data which includes unread counts
        chats_data = get_direct_chats(current_user_id)
        unread_counts = chats_data['unread_counts']
        
        return JsonResponse({
            'success': True,
            'counts': unread_counts
        })
        
    except Exception as e:
        print(f"Error in get_unread_counts_api: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt 
def search_users_api(request):
    """
    API endpoint to search for users to message
    """
    if request.method != 'GET':
        return JsonResponse({'success': False, 'error': 'Only GET method is allowed'}, status=405)
    
    try:
        # Get search query
        query = request.GET.get('query', '').strip().lower()
        
        if not query or len(query) < 2:
            return JsonResponse({
                'success': True,
                'users': []
            })
        
        # Get the current user ID
        current_user_id = get_current_user_id(request)
        
        if not current_user_id:
            return JsonResponse({
                'success': False,
                'error': 'Unable to determine current user'
            }, status=401)
        
        # Search for users by name
        users_ref = db.collection('users_profile')
        all_users = users_ref.stream()
        
        # Filter and format results
        matching_users = []
        
        for user in all_users:
            user_data = user.to_dict()
            user_id = user.id
            
            # Skip current user
            if user_id == current_user_id:
                continue
                
            name = user_data.get('name', '').lower()
            role = user_data.get('role', '').lower()
            
            # Check if query matches name or role
            if query in name or query in role:
                # Check if there's an existing chat with this user
                chat_id = None
                user_ids = sorted([current_user_id, user_id])
                possible_chat_id = f"direct_chat_{user_ids[0]}_{user_ids[1]}"
                
                chat_ref = db.collection('direct_chats').document(possible_chat_id)
                if chat_ref.get().exists:
                    chat_id = possible_chat_id
                
                matching_users.append({
                    'user_id': user_id,
                    'name': user_data.get('name', 'Unknown User'),
                    'role': user_data.get('role', 'Unknown'),
                    'profile_pic': user_data.get('profile_picture', ''),
                    'verified': user_data.get('verified', False),
                    'existing_chat_id': chat_id
                })
        
        # Limit to top 10 results
        matching_users = matching_users[:10]
        
        return JsonResponse({
            'success': True,
            'users': matching_users
        })
        
    except Exception as e:
        print(f"Error in search_users_api: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

# Helper functions
def get_current_user_id(request):
    """
    Get the current user ID from the session.
    Tries to get from both student and teacher sessions.
    
    Args:
        request: The request object
        
    Returns:
        str: User ID if found, None otherwise
    """
    # Check if user is a student
    current_student_name = request.session.get("students_name")
    if current_student_name:
        return get_user_id_by_name(current_student_name)
    
    # Check if user is a teacher
    current_teacher_name = request.session.get("teachers_name")
    if current_teacher_name:
        return get_user_id_by_name(current_teacher_name)
    
    return None


@csrf_exempt
def get_current_user_info(request):
    """
    API endpoint to get the current user information.
    Returns user ID, name, and other basic profile information.
    """
    try:
        # Check if user is a student
        current_student_name = request.session.get("students_name")
        if current_student_name:
            user_id = get_user_id_by_name(current_student_name)
            user_type = "student"
            user_name = current_student_name
        else:
            # Check if user is a teacher
            current_teacher_name = request.session.get("teachers_name")
            if current_teacher_name:
                user_id = get_user_id_by_name(current_teacher_name)
                user_type = "teacher"
                user_name = current_teacher_name
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'No active user session found'
                }, status=401)
        
        if not user_id:
            return JsonResponse({
                'success': False,
                'error': 'Unable to find user ID'
            }, status=404)
            
        # Get additional user info from database
        user_ref = db.collection('users_profile').document(user_id).get()
        if user_ref.exists:
            user_data = user_ref.to_dict()
            profile_pic = user_data.get('profile_picture', '')
            role = user_data.get('role', user_type)
        else:
            profile_pic = ''
            role = user_type
            
        return JsonResponse({
            'success': True,
            'user_id': user_id,
            'name': user_name,
            'profile_pic': profile_pic,
            'role': role,
            'user_type': user_type
        })
            
    except Exception as e:
        print(f"Error getting current user info: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)