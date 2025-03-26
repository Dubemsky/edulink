# group_chat.py

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
from .firebase import *
from datetime import datetime
from .private_messages import get_current_user_id

@csrf_exempt
def create_group_chat(request):
    """
    Create a new group chat with multiple participants
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
        group_name = data.get('name', '').strip()
        participant_ids = data.get('participants', [])
        
        # Validate inputs
        if not group_name:
            return JsonResponse({
                'success': False,
                'error': 'Group name is required'
            }, status=400)
        
        if not participant_ids or len(participant_ids) < 1:
            return JsonResponse({
                'success': False,
                'error': 'At least one participant is required'
            }, status=400)
        
        # Add creator to participants if not already included
        if current_user_id not in participant_ids:
            participant_ids.append(current_user_id)
        
        # Create the group chat document
        group_chats_ref = db.collection('group_chats')
        new_group = {
            'name': group_name,
            'creator_id': current_user_id,
            'participants': participant_ids,
            'created_at': firestore.SERVER_TIMESTAMP,
            'updated_at': firestore.SERVER_TIMESTAMP,
            'last_message': "Group created",
            'last_message_time': firestore.SERVER_TIMESTAMP,
            'last_sender_id': current_user_id
        }
        
        # Initialize unread counts for each participant
        for user_id in participant_ids:
            if user_id != current_user_id:  # Creator has read all messages
                new_group[f'unread_count_{user_id}'] = 1  # Start with 1 for the system message
            else:
                new_group[f'unread_count_{user_id}'] = 0
        
        # Add the document to Firestore
        group_chat_ref = group_chats_ref.add(new_group)
        group_id = group_chat_ref[1].id
        
        # Add a system message about group creation
        messages_ref = db.collection('group_chats').document(group_id).collection('messages')
        system_message = {
            'sender_id': current_user_id,
            'content': f"Group '{group_name}' created",
            'timestamp': firestore.SERVER_TIMESTAMP,
            'read_by': [current_user_id],  # Creator has read this message
            'type': 'system'
        }
        messages_ref.add(system_message)
        
        return JsonResponse({
            'success': True,
            'group_id': group_id,
            'message': 'Group chat created successfully'
        })
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON'
        }, status=400)
        
    except Exception as e:
        print(f"Error creating group chat: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def get_group_chats(request):
    """
    Get all group chats for the current user
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
        # Get all group chats where the current user is a participant
        group_chats_ref = db.collection('group_chats')
        group_chats = group_chats_ref.where('participants', 'array_contains', current_user_id).stream()
        
        # Format group chats for the client
        group_chat_list = []
        
        for chat in group_chats:
            chat_data = chat.to_dict()
            
            # Get participant details
            participants = []
            for participant_id in chat_data.get('participants', []):
                if participant_id != current_user_id:  # Skip current user
                    # Get user details
                    user_ref = db.collection('users_profile').document(participant_id)
                    user = user_ref.get()
                    if user.exists:
                        user_data = user.to_dict()
                        participants.append({
                            'id': participant_id,
                            'name': user_data.get('name', 'Unknown User'),
                            'profile_picture': user_data.get('profile_picture')
                        })
            
            group_chat_list.append({
                'id': chat.id,
                'name': chat_data.get('name', 'Unnamed Group'),
                'participants': participants,
                'participant_count': len(chat_data.get('participants', [])),
                'creator_id': chat_data.get('creator_id'),
                'last_message': chat_data.get('last_message', ''),
                'last_message_time': chat_data.get('last_message_time'),
                'unread_count': chat_data.get(f'unread_count_{current_user_id}', 0),
                'created_at': chat_data.get('created_at')
            })
        
        # Sort by last message time (newest first)
        group_chat_list.sort(key=lambda x: x.get('last_message_time', 0), reverse=True)
        
        return JsonResponse({
            'success': True,
            'group_chats': group_chat_list
        })
    
    except Exception as e:
        print(f"Error getting group chats: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def send_group_message(request):
    """
    Send a message to a group chat
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
        group_id = data.get('group_id')
        message_content = data.get('message')
        
        if not group_id or not message_content:
            return JsonResponse({
                'success': False,
                'error': 'Group ID and message are required'
            }, status=400)
        
        # Check if the group exists and the user is a participant
        group_ref = db.collection('group_chats').document(group_id)
        group = group_ref.get()
        
        if not group.exists:
            return JsonResponse({
                'success': False,
                'error': 'Group chat not found'
            }, status=404)
        
        group_data = group.to_dict()
        if current_user_id not in group_data.get('participants', []):
            return JsonResponse({
                'success': False,
                'error': 'You are not a participant in this group chat'
            }, status=403)
        
        # Create a message object
        message = {
            'sender_id': current_user_id,
            'content': message_content,
            'timestamp': firestore.SERVER_TIMESTAMP,
            'read_by': [current_user_id],  # Sender has read the message
            'type': 'text'
        }
        
        # Add the message to Firestore
        message_ref = group_ref.collection('messages').add(message)
        message_id = message_ref[1].id
        
        # Update group chat metadata
        update_data = {
            'last_message': message_content,
            'last_message_time': firestore.SERVER_TIMESTAMP,
            'last_sender_id': current_user_id,
            'updated_at': firestore.SERVER_TIMESTAMP
        }
        
        # Increment unread count for all participants except sender
        for participant_id in group_data.get('participants', []):
            if participant_id != current_user_id:
                update_data[f'unread_count_{participant_id}'] = firestore.Increment(1)
        
        group_ref.update(update_data)
        
        return JsonResponse({
            'success': True,
            'message_id': message_id
        })
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON'
        }, status=400)
        
    except Exception as e:
        print(f"Error sending group message: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def get_group_messages(request, group_id):
    """
    Get messages for a specific group chat
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
        # Check if the group exists and the user is a participant
        group_ref = db.collection('group_chats').document(group_id)
        group = group_ref.get()
        
        if not group.exists:
            return JsonResponse({
                'success': False,
                'error': 'Group chat not found'
            }, status=404)
        
        group_data = group.to_dict()
        if current_user_id not in group_data.get('participants', []):
            return JsonResponse({
                'success': False,
                'error': 'You are not a participant in this group chat'
            }, status=403)
        
        # Get messages from the group chat
        messages_ref = group_ref.collection('messages')
        messages = messages_ref.order_by('timestamp').stream()
        
        # Format messages for the client
        message_list = []
        for message in messages:
            message_data = message.to_dict()
            
            # Get sender details
            sender_id = message_data.get('sender_id')
            sender_name = "Unknown"
            sender_picture = None
            
            if sender_id:
                user_ref = db.collection('users_profile').document(sender_id)
                user = user_ref.get()
                if user.exists:
                    user_data = user.to_dict()
                    sender_name = user_data.get('name', 'Unknown')
                    sender_picture = user_data.get('profile_picture')
            
            message_list.append({
                'id': message.id,
                'sender_id': sender_id,
                'sender_name': sender_name,
                'sender_picture': sender_picture,
                'content': message_data.get('content'),
                'timestamp': message_data.get('timestamp'),
                'type': message_data.get('type', 'text'),
                'is_read': current_user_id in message_data.get('read_by', [])
            })
        
        return JsonResponse({
            'success': True,
            'messages': message_list,
            'group_info': {
                'id': group.id,
                'name': group_data.get('name'),
                'participant_count': len(group_data.get('participants', [])),
                'creator_id': group_data.get('creator_id')
            }
        })
        
    except Exception as e:
        print(f"Error getting group messages: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def mark_group_messages_read(request):
    """
    Mark all messages in a group chat as read by the current user
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
        group_id = data.get('group_id')
        
        if not group_id:
            return JsonResponse({
                'success': False,
                'error': 'Group ID is required'
            }, status=400)
        
        # Check if the group exists and the user is a participant
        group_ref = db.collection('group_chats').document(group_id)
        group = group_ref.get()
        
        if not group.exists:
            return JsonResponse({
                'success': False,
                'error': 'Group chat not found'
            }, status=404)
        
        group_data = group.to_dict()
        if current_user_id not in group_data.get('participants', []):
            return JsonResponse({
                'success': False,
                'error': 'You are not a participant in this group chat'
            }, status=403)
        
        # Get unread messages (where the current user is not in read_by)
        messages_ref = group_ref.collection('messages')
        batch = db.batch()
        
        # Find messages that the current user hasn't read yet
        unread_messages = messages_ref.where('read_by', 'array_contains', current_user_id).stream()
        
        # Mark each message as read in a batch
        for message in unread_messages:
            message_ref = messages_ref.document(message.id)
            message_data = message.to_dict()
            read_by = message_data.get('read_by', [])
            
            if current_user_id not in read_by:
                read_by.append(current_user_id)
                batch.update(message_ref, {'read_by': read_by})
        
        # Commit the batch
        batch.commit()
        
        # Reset the unread count for the current user
        group_ref.update({
            f'unread_count_{current_user_id}': 0
        })
        
        return JsonResponse({
            'success': True,
            'message': 'All messages marked as read'
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
def add_group_participant(request):
    """
    Add a participant to a group chat
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
        group_id = data.get('group_id')
        user_id = data.get('user_id')
        
        if not group_id or not user_id:
            return JsonResponse({
                'success': False,
                'error': 'Group ID and user ID are required'
            }, status=400)
        
        # Check if the group exists
        group_ref = db.collection('group_chats').document(group_id)
        group = group_ref.get()
        
        if not group.exists:
            return JsonResponse({
                'success': False,
                'error': 'Group chat not found'
            }, status=404)
        
        group_data = group.to_dict()
        
        # Check if the current user is the creator (only creator can add participants)
        if group_data.get('creator_id') != current_user_id:
            return JsonResponse({
                'success': False,
                'error': 'Only the group creator can add participants'
            }, status=403)
        
        # Check if the user already exists in the group
        participants = group_data.get('participants', [])
        if user_id in participants:
            return JsonResponse({
                'success': False,
                'error': 'User is already a participant in this group'
            }, status=400)
        
        # Add the user to the group
        participants.append(user_id)
        
        # Get user details for the system message
        user_ref = db.collection('users_profile').document(user_id)
        user = user_ref.get()
        user_name = 'Unknown User'
        
        if user.exists:
            user_data = user.to_dict()
            user_name = user_data.get('name', 'Unknown User')
        
        # Update the group document
        update_data = {
            'participants': participants,
            'updated_at': firestore.SERVER_TIMESTAMP,
            f'unread_count_{user_id}': 1  # Start with 1 for the system message
        }
        
        group_ref.update(update_data)
        
        # Add a system message about the new participant
        messages_ref = group_ref.collection('messages')
        system_message = {
            'sender_id': current_user_id,
            'content': f"{user_name} was added to the group",
            'timestamp': firestore.SERVER_TIMESTAMP,
            'read_by': [current_user_id],  # Creator has read this message
            'type': 'system'
        }
        messages_ref.add(system_message)
        
        return JsonResponse({
            'success': True,
            'message': 'Participant added successfully'
        })
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON'
        }, status=400)
        
    except Exception as e:
        print(f"Error adding participant: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def remove_group_participant(request):
    """
    Remove a participant from a group chat
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
        group_id = data.get('group_id')
        user_id = data.get('user_id')
        
        if not group_id or not user_id:
            return JsonResponse({
                'success': False,
                'error': 'Group ID and user ID are required'
            }, status=400)
        
        # Check if the group exists
        group_ref = db.collection('group_chats').document(group_id)
        group = group_ref.get()
        
        if not group.exists:
            return JsonResponse({
                'success': False,
                'error': 'Group chat not found'
            }, status=404)
        
        group_data = group.to_dict()
        
        # Check if the current user is the creator or removing themselves
        if group_data.get('creator_id') != current_user_id and current_user_id != user_id:
            return JsonResponse({
                'success': False,
                'error': 'Only the group creator can remove other participants'
            }, status=403)
        
        # Check if the user exists in the group
        participants = group_data.get('participants', [])
        if user_id not in participants:
            return JsonResponse({
                'success': False,
                'error': 'User is not a participant in this group'
            }, status=400)
        
        # Remove the user from the group
        participants.remove(user_id)
        
        # Get user details for the system message
        user_ref = db.collection('users_profile').document(user_id)
        user = user_ref.get()
        user_name = 'Unknown User'
        
        if user.exists:
            user_data = user.to_dict()
            user_name = user_data.get('name', 'Unknown User')
        
        # Update the group document
        update_data = {
            'participants': participants,
            'updated_at': firestore.SERVER_TIMESTAMP
        }
        
        # If creator is leaving, assign a new creator if there are other participants
        if user_id == group_data.get('creator_id') and participants:
            update_data['creator_id'] = participants[0]
        
        group_ref.update(update_data)
        
        # Delete unread count field for the removed user
        group_ref.update({
            f'unread_count_{user_id}': firestore.DELETE_FIELD
        })
        
        # Add a system message about the participant removal
        messages_ref = group_ref.collection('messages')
        
        # Different message if user left themselves vs. was removed
        message_content = f"{user_name} left the group" if current_user_id == user_id else f"{user_name} was removed from the group"
        
        system_message = {
            'sender_id': current_user_id,
            'content': message_content,
            'timestamp': firestore.SERVER_TIMESTAMP,
            'read_by': [current_user_id],  # Current user has read this message
            'type': 'system'
        }
        messages_ref.add(system_message)
        
        # If all participants have left, consider deleting the group
        if not participants:
            # For now, we'll keep the empty group in the database
            # You could implement a cleanup function to delete empty groups after some time
            pass
        
        return JsonResponse({
            'success': True,
            'message': 'Participant removed successfully'
        })
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON'
        }, status=400)
        
    except Exception as e:
        print(f"Error removing participant: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def update_group_info(request):
    """
    Update group chat information (name, avatar, etc.)
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
        group_id = data.get('group_id')
        group_name = data.get('name')
        group_avatar = data.get('avatar')
        
        if not group_id:
            return JsonResponse({
                'success': False,
                'error': 'Group ID is required'
            }, status=400)
        
        # Check if at least one field to update is provided
        if not group_name and not group_avatar:
            return JsonResponse({
                'success': False,
                'error': 'At least one field to update is required'
            }, status=400)
        
        # Check if the group exists
        group_ref = db.collection('group_chats').document(group_id)
        group = group_ref.get()
        
        if not group.exists:
            return JsonResponse({
                'success': False,
                'error': 'Group chat not found'
            }, status=404)
        
        group_data = group.to_dict()
        
        # Check if the current user is the creator
        if group_data.get('creator_id') != current_user_id:
            return JsonResponse({
                'success': False,
                'error': 'Only the group creator can update group information'
            }, status=403)
        
        # Prepare update data
        update_data = {
            'updated_at': firestore.SERVER_TIMESTAMP
        }
        
        if group_name:
            update_data['name'] = group_name
        
        if group_avatar:
            update_data['avatar'] = group_avatar
        
        # Update the group document
        group_ref.update(update_data)
        
        # Add a system message about the update
        messages_ref = group_ref.collection('messages')
        message_content = "Group information updated"
        
        if group_name and group_name != group_data.get('name'):
            message_content = f"Group name changed to '{group_name}'"
        
        system_message = {
            'sender_id': current_user_id,
            'content': message_content,
            'timestamp': firestore.SERVER_TIMESTAMP,
            'read_by': [current_user_id],  # Current user has read this message
            'type': 'system'
        }
        messages_ref.add(system_message)
        
        return JsonResponse({
            'success': True,
            'message': 'Group information updated successfully'
        })
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON'
        }, status=400)
        
    except Exception as e:
        print(f"Error updating group info: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)