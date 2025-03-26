# private_messages.py

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
from .firebase import *
from datetime import datetime
from .community_page import *

def get_connection_status(user1_id, user2_id):
    """
    Get the connection status between two users based on follow relationships
    
    Args:
        user1_id: First user ID
        user2_id: Second user ID
        
    Returns:
        str: Connection status ('connected', 'pending', None if no connection)
    """
    try:
        # Check both directions of follow relationship
        follows_ref = db.collection('user_follows')
        
        # Check if user1 follows user2
        follow1_id = f"{user1_id}_follows_{user2_id}"
        follow1 = follows_ref.document(follow1_id).get()
        
        # Check if user2 follows user1
        follow2_id = f"{user2_id}_follows_{user1_id}"
        follow2 = follows_ref.document(follow2_id).get()
        
        # Both users follow each other - they are connected
        if follow1.exists and follow2.exists:
            return 'connected'
        
        # One-way follow relationship - pending connection
        elif follow1.exists or follow2.exists:
            return 'pending'
        
        # No follow relationship found
        return None
        
    except Exception as e:
        print(f"Error getting connection status: {e}")
        return None

def is_mutually_connected(user1_id, user2_id):
    """
    Check if two users are mutually connected (both follow each other)
    
    Args:
        user1_id: First user ID
        user2_id: Second user ID
        
    Returns:
        bool: True if users are mutually connected, False otherwise
    """
    try:
        # Check for following relationship in both directions
        follows_ref = db.collection('user_follows')
        follow1_id = f"{user1_id}_follows_{user2_id}"
        follow2_id = f"{user2_id}_follows_{user1_id}"
        
        follow1 = follows_ref.document(follow1_id).get()
        follow2 = follows_ref.document(follow2_id).get()
        
        # Both users follow each other
        if follow1.exists and follow2.exists:
            return True
            
        return False
        
    except Exception as e:
        print(f"Error checking mutual connection: {e}")
        return False

# Helper function to check if one user is following another
def is_following(follower_id, followed_id):
    """
    Check if a user is following another user
    
    Args:
        follower_id: ID of the user who might be following
        followed_id: ID of the user who might be followed
        
    Returns:
        bool: True if follower is following followed, False otherwise
    """
    try:
        follows_ref = db.collection('user_follows')
        follow_doc_id = f"{follower_id}_follows_{followed_id}"
        
        return follows_ref.document(follow_doc_id).get().exists
    except Exception as e:
        print(f"Error checking if {follower_id} follows {followed_id}: {e}")
        return False

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
        
        # Check if the users have a mutual connection (both follow each other)
        mutual_connection = is_mutually_connected(current_user_id, recipient_id)
        
        # If current user doesn't already follow the recipient, create a follow relationship
        # This replaces the connection request functionality
        if not mutual_connection:
            # Check if user already follows recipient
            follows_ref = db.collection('user_follows')
            follow_doc_id = f"{current_user_id}_follows_{recipient_id}"
            follow_doc = follows_ref.document(follow_doc_id).get()
            
            if not follow_doc.exists:
                # Follow the recipient (create the one-way connection)
                follow_user(current_user_id, recipient_id)
        
        # Update conversation metadata
        conversation_ref = db.collection('private_messages').document(conversation_id)
        
        conversation_data = {
            'participants': [current_user_id, recipient_id],
            'last_message': message_content,
            'last_message_time': firestore.SERVER_TIMESTAMP,
            'last_sender_id': current_user_id,
            'unread_count_' + recipient_id: firestore.Increment(1)
        }
        
        # Add connection_status field to conversation metadata
        if mutual_connection:
            conversation_data['connection_status'] = 'connected'
        else:
            conversation_data['connection_status'] = 'pending'
            conversation_data['connection_initiator'] = current_user_id
        
        conversation_ref.set(conversation_data, merge=True)
        
        return JsonResponse({
            'success': True,
            'message_id': message_ref.id,
            'connection_status': 'connected' if mutual_connection else 'pending'
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
    Mark messages as read by the current user.
    """
    print("🔹 Received request to mark messages as read.")  # Debugging

    if request.method != 'POST':
        print("❌ Error: Invalid request method (Only POST allowed).")
        return JsonResponse({'success': False, 'error': 'Only POST method is allowed'}, status=405)

    # Get current user
    current_user_id = get_current_user_id(request)
    print(f"✅ Current user ID: {current_user_id}")

    if not current_user_id:
        print("❌ Error: User not authenticated.")
        return JsonResponse({'success': False, 'error': 'User not authenticated'}, status=401)

    try:
        data = json.loads(request.body)
        print(f"📩 Received data: {data}")  # Debugging

        sender_id = data.get('sender_id')

        if not sender_id:
            print("❌ Error: Sender ID is missing.")
            return JsonResponse({'success': False, 'error': 'Sender ID is required'}, status=400)

        # Generate conversation ID
        conversation_id = create_conversation_id(current_user_id, sender_id)
        print(f"🔹 Generated conversation_id: {conversation_id}")

        # Check if conversation exists
        conversation_ref = db.collection('private_messages').document(conversation_id)
        conversation = conversation_ref.get()

        if not conversation.exists:
            print(f"❌ Error: Conversation {conversation_id} does not exist.")
            return JsonResponse({'success': True, 'message': 'No messages to update'})

        print("✅ Conversation found, proceeding to check unread messages.")

        # Get all unread messages
        messages_ref = db.collection('private_messages').document(conversation_id).collection('messages')
        unread_messages = messages_ref.where('sender_id', '==', sender_id) \
                                      .where('recipient_id', '==', current_user_id) \
                                      .where('read', '==', False) \
                                      .stream()

        messages_list = list(unread_messages)
        print(f"📌 Found {len(messages_list)} unread messages.")

        # Batch update unread messages in chunks of 500
        for i in range(0, len(messages_list), 500):
            batch = db.batch()
            for message in messages_list[i : i + 500]:
                message_ref = messages_ref.document(message.id)
                batch.update(message_ref, {'read': True})
            batch.commit()
            print(f"✅ Batch {i // 500 + 1} committed.")

        # Reset unread count
        conversation_ref.set({f'unread_count_{current_user_id}': 0}, merge=True)
        print(f"✅ Unread count reset for user {current_user_id}.")

        print("🎉 Successfully marked messages as read!")
        return JsonResponse({'success': True})

    except json.JSONDecodeError:
        print("❌ Error: Invalid JSON format in request body.")
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)

    except Exception as e:
        print(f"🚨 Unexpected Error: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
def get_conversations(request):
    """
    Get all conversations for the current user, categorized as connections or requests
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
        
        # Format conversations for the client, separated into connections and requests
        connection_list = []
        request_list = []
        
        # Get list of users that the current user is following
        following_ids = get_user_following(current_user_id)
        
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
                
                # Check if the other participant also follows the current user
                follows_user = is_following(other_participant_id, current_user_id)
                
                # Determine if this is a connection or request
                is_connected = other_participant_id in following_ids and follows_user
                
                # Create conversation object
                conversation_obj = {
                    'id': conversation.id,
                    'user_id': other_participant_id,
                    'name': user_data.get('name', 'Unknown User'),
                    'role': user_data.get('role', ''),
                    'profile_picture': user_data.get('profile_picture'),
                    'last_message': conversation_data.get('last_message', ''),
                    'last_message_time': conversation_data.get('last_message_time'),
                    'unread_count': conversation_data.get(f'unread_count_{current_user_id}', 0),
                    'connection_status': 'connected' if is_connected else 'pending',
                }
                
                # Place in the appropriate list based on connection status
                if is_connected:
                    connection_list.append(conversation_obj)
                else:
                    request_list.append(conversation_obj)
        
        # Sort conversations by last message time (newest first)
        connection_list.sort(key=lambda x: x.get('last_message_time', 0), reverse=True)
        request_list.sort(key=lambda x: x.get('last_message_time', 0), reverse=True)
        
        return JsonResponse({
            'success': True,
            'connections': connection_list,
            'requests': request_list
        })
    
    except Exception as e:
        print(f"Error getting conversations: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def start_direct_chat(request):
    """
    Create or get a chat room between the current user and another user
    """
    print("Received request to start direct chat")
    if request.method != 'POST':
        print("Error: Only POST method is allowed")
        return JsonResponse({'success': False, 'error': 'Only POST method is allowed'}, status=405)
    
    # Get the current user's ID
    current_user_id = get_current_user_id(request)
    print(f"Current user ID: {current_user_id}")
    
    if not current_user_id:
        print("Error: User not authenticated")
        return JsonResponse({
            'success': False,
            'error': 'User not authenticated'
        }, status=401)
    
    try:
        # Parse the request data
        data = json.loads(request.body)
        print(f"Received data: {data}")
        
        recipient_id = data.get('recipient_id')
        print(f"Recipient ID: {recipient_id}")
        
        if not recipient_id:
            print("Error: Recipient ID is required")
            return JsonResponse({
                'success': False,
                'error': 'Recipient ID is required'
            }, status=400)
        
        # Create a unique conversation ID
        conversation_id = create_conversation_id(current_user_id, recipient_id)
        print(f"Generated conversation ID: {conversation_id}")
        
        # Check if the conversation already exists
        conversation_ref = db.collection('private_messages').document(conversation_id)
        conversation = conversation_ref.get()
        print(f"Conversation exists: {conversation.exists}")
        
        # If the conversation doesn't exist, create it
        if not conversation.exists:
            print("Creating new conversation")
            
            # Get user details
            current_user_ref = db.collection('users_profile').document(current_user_id)
            recipient_ref = db.collection('users_profile').document(recipient_id)
            
            current_user = current_user_ref.get()
            recipient = recipient_ref.get()
            
            print(f"Current user exists: {current_user.exists}")
            print(f"Recipient exists: {recipient.exists}")
            
            if not current_user.exists or not recipient.exists:
                return JsonResponse({
                    'success': False,
                    'error': 'User not found'
                }, status=404)
            
            # Create the conversation
            conversation_ref.set({
                'participants': [current_user_id, recipient_id],
                'created_at': firestore.SERVER_TIMESTAMP,
                'last_message': None,
                'last_message_time': firestore.SERVER_TIMESTAMP,
                'unread_count_' + current_user_id: 0,
                'unread_count_' + recipient_id: 0
            })
            print("Conversation successfully created")
        
        print("Returning chat ID response")
        return JsonResponse({
            'success': True,
            'chat_id': conversation_id
        })
    
    
    except json.JSONDecodeError:
        print("Error: Invalid JSON in request body")
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON'
        }, status=400)
        
    except Exception as e:
        print(f"Error starting direct chat: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def accept_connection_request(request):
    """
    Accept a connection request from another user by following them back
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
        sender_id = data.get('sender_id')  # ID of the user who sent the request
        
        if not sender_id:
            return JsonResponse({
                'success': False,
                'error': 'Sender ID is required'
            }, status=400)
        
        # Follow the user (this creates the connection in user_follows)
        result = follow_user(current_user_id, sender_id)
        
        if not result['success']:
            return JsonResponse({
                'success': False,
                'error': result['message']
            }, status=500)
            
        # Update the conversation status
        conversation_id = create_conversation_id(current_user_id, sender_id)
        conversation_ref = db.collection('private_messages').document(conversation_id)
        
        conversation_ref.update({
            'connection_status': 'connected',
            'connection_accepted_at': firestore.SERVER_TIMESTAMP
        })
        
        return JsonResponse({
            'success': True,
            'message': 'Connection request accepted'
        })
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON'
        }, status=400)
        
    except Exception as e:
        print(f"Error accepting connection request: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def decline_connection_request(request):
    """
    Decline a connection request from another user
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
        sender_id = data.get('sender_id')  # ID of the user who sent the request
        
        if not sender_id:
            return JsonResponse({
                'success': False,
                'error': 'Sender ID is required'
            }, status=400)
        
        # For declining, we don't need to change user_follows
        # We just update the conversation to show it was declined
        
        # Update the conversation status
        conversation_id = create_conversation_id(current_user_id, sender_id)
        conversation_ref = db.collection('private_messages').document(conversation_id)
        
        conversation_ref.update({
            'connection_status': 'declined',
            'connection_declined_at': firestore.SERVER_TIMESTAMP
        })
        
        return JsonResponse({
            'success': True,
            'message': 'Connection request declined'
        })
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON'
        }, status=400)
        
    except Exception as e:
        print(f"Error declining connection request: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)