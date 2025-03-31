from .firebase import *
from datetime import datetime
import pytz
from .encryption import encryption_manager
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
from .community_page import get_user_following, get_user_id_by_name

def create_group_chat(creator_id, group_name, member_ids):
    print(" I am here now dubem good job")
    """
    Create a new group chat with the specified members.
    
    Args:
        creator_id: The ID of the user creating the group
        group_name: The name of the group chat
        member_ids: List of user IDs to add to the group
    
    Returns:
        dict: Response with success status and group_id if successful
    """
    try:
        # Ensure creator is included in members
        if creator_id not in member_ids:
            member_ids.append(creator_id)
        
        now_utc = datetime.now(pytz.utc).strftime('%Y-%m-%d %H:%M:%S')
        
        # Create group document
        group_data = {
            'group_name': group_name,
            'creator_id': creator_id,
            'members': member_ids,
            'created_at': now_utc,
            'updated_at': now_utc,
            'last_message': None,
            'last_message_time': now_utc
        }
        
        # Add to Firestore
        groups_ref = db.collection('group_chats')
        group_ref = groups_ref.add(group_data)
        group_id = group_ref[1].id
        
        # Update group with its ID
        groups_ref.document(group_id).update({
            'group_id': group_id
        })
        
        # Create member entries for each user
        for member_id in member_ids:
            create_group_member(group_id, member_id, is_admin=(member_id == creator_id))
        
        # Add a system message about group creation
        system_message = f"Group \"{group_name}\" created by {get_username(creator_id)}"
        add_group_message(group_id, "system", system_message)
        
        return {
            'success': True,
            'group_id': group_id
        }
        
    except Exception as e:
        print(f"Error creating group chat: {e}")
        return {
            'success': False,
            'error': str(e)
        }

def create_group_member(group_id, user_id, is_admin=False):
    """
    Add a member to a group chat.
    
    Args:
        group_id: The ID of the group
        user_id: The ID of the user to add
        is_admin: Whether the user should be an admin (default: False)
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Create member document
        member_data = {
            'group_id': group_id,
            'user_id': user_id,
            'joined_at': datetime.now(pytz.utc).strftime('%Y-%m-%d %H:%M:%S'),
            'is_admin': is_admin,
            'unread_count': 0
        }
        
        # Add to Firestore
        members_ref = db.collection('group_members')
        member_ref = members_ref.add(member_data)
        
        return True
        
    except Exception as e:
        print(f"Error adding group member: {e}")
        return False

def add_group_message(group_id, sender_id, content, message_type="text"):
    """
    Add a message to a group chat.
    
    Args:
        group_id: The ID of the group
        sender_id: The ID of the message sender
        content: The message content
        message_type: The type of message (default: "text")
        
    Returns:
        str: Message ID if successful, None otherwise
    """
    try:
        now_utc = datetime.now(pytz.utc).strftime('%Y-%m-%d %H:%M:%S')
        
        # Get sender name for system messages
        sender_name = "System"
        if sender_id != "system":
            sender_name = get_username(sender_id)
        
        # Encrypt the content for regular messages
        if sender_id != "system":
            encrypted_content = encryption_manager.encrypt(content)
        else:
            # System messages are not encrypted for simplicity
            encrypted_content = content
        
        # Create message document
        message_data = {
            'group_id': group_id,
            'sender_id': sender_id,
            'sender_name': sender_name,
            'content': encrypted_content,
            'is_system': sender_id == "system",
            'message_type': message_type,
            'timestamp': now_utc,
            'created_at': now_utc
        }
        
        # Add to Firestore
        messages_ref = db.collection('group_messages')
        message_ref = messages_ref.add(message_data)
        message_id = message_ref[1].id
        
        # Update group's last message
        groups_ref = db.collection('group_chats')
        groups_ref.document(group_id).update({
            'last_message': content if sender_id == "system" else encrypted_content,
            'last_message_time': now_utc,
            'last_sender_id': sender_id,
            'updated_at': now_utc
        })
        
        # Update unread count for all members except sender
        update_unread_counts(group_id, sender_id)
        
        return message_id
        
    except Exception as e:
        print(f"Error adding group message: {e}")
        return None

def update_unread_counts(group_id, sender_id):
    """
    Increment unread count for all group members except the sender.
    
    Args:
        group_id: The ID of the group
        sender_id: The ID of the message sender
    """
    try:
        # Get all members of the group
        members_ref = db.collection('group_members')
        members = members_ref.where('group_id', '==', group_id).stream()
        
        # Increment unread count for each member except sender
        for member in members:
            member_data = member.to_dict()
            member_id = member_data.get('user_id')
            
            if member_id != sender_id:
                # Increment unread count
                members_ref.document(member.id).update({
                    'unread_count': firestore.Increment(1)
                })
                
    except Exception as e:
        print(f"Error updating unread counts: {e}")

@csrf_exempt
def create_group_chat_view(request):
    """
    View for creating a new group chat.
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
        group_name = data.get('group_name')
        member_ids = data.get('member_ids', [])
        
        if not group_name:
            return JsonResponse({
                'success': False,
                'error': 'Group name is required'
            }, status=400)
        
        if not member_ids:
            return JsonResponse({
                'success': False,
                'error': 'At least one member is required'
            }, status=400)
        
        # Validate that all members are connected to the current user
        if not validate_members_connection(current_user_id, member_ids):
            return JsonResponse({
                'success': False,
                'error': 'You can only add users you are connected with'
            }, status=403)
        
        # Create the group chat
        result = create_group_chat(current_user_id, group_name, member_ids)
        
        return JsonResponse(result)
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON'
        }, status=400)
        
    except Exception as e:
        print(f"Error creating group chat: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

def validate_members_connection(user_id, member_ids):
    """
    Validate that all specified members are mutually connected with the user.
    
    Args:
        user_id: The ID of the current user
        member_ids: List of member user IDs to validate
        
    Returns:
        bool: True if all members are connected, False otherwise
    """
    try:
        # Get all users that the current user follows
        following_ids = get_user_following(user_id)
        
        # Check that all members are in the following list and also follow the user
        for member_id in member_ids:
            # Skip self
            if member_id == user_id:
                continue
                
            # Check if user follows this member
            if member_id not in following_ids:
                return False
                
            # Check if member follows the user back
            follows_ref = db.collection('user_follows')
            follow_doc_id = f"{member_id}_follows_{user_id}"
            
            if not follows_ref.document(follow_doc_id).get().exists:
                return False
        
        return True
        
    except Exception as e:
        print(f"Error validating member connections: {e}")
        return False

@csrf_exempt
def get_group_chats_view(request):
    """
    View for retrieving all group chats for the current user.
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
        # Get all group memberships for the current user
        members_ref = db.collection('group_members')
        memberships = members_ref.where('user_id', '==', current_user_id).stream()
        
        group_ids = []
        unread_counts = {}
        
        # Extract group IDs and unread counts
        for membership in memberships:
            membership_data = membership.to_dict()
            group_id = membership_data.get('group_id')
            
            if group_id:
                group_ids.append(group_id)
                unread_counts[group_id] = membership_data.get('unread_count', 0)
        
        # Get all group details
        groups = []
        if group_ids:
            groups_ref = db.collection('group_chats')
            
            # Process group IDs in batches (Firestore limits 'in' queries)
            batch_size = 10
            for i in range(0, len(group_ids), batch_size):
                batch_ids = group_ids[i:i+batch_size]
                
                # For each batch of IDs, get the group documents
                for group_id in batch_ids:
                    group_doc = groups_ref.document(group_id).get()
                    if group_doc.exists:
                        group_data = group_doc.to_dict()
                    
                        # Decrypt last message if it exists
                        last_message = group_data.get('last_message')
                        if last_message and group_data.get('last_sender_id') != 'system':
                            group_data['last_message'] = encryption_manager.decrypt(last_message)
                        
                        # Add unread count
                        group_data['unread_count'] = unread_counts.get(group_data.get('group_id'), 0)
                        
                        # Format for frontend
                        formatted_group = {
                            'group_id': group_data.get('group_id'),
                            'group_name': group_data.get('group_name'),
                            'creator_id': group_data.get('creator_id'),
                            'member_count': len(group_data.get('members', [])),
                            'last_message': group_data.get('last_message'),
                            'last_message_time': group_data.get('last_message_time'),
                            'unread_count': group_data.get('unread_count'),
                            'is_admin': is_group_admin(group_data.get('group_id'), current_user_id)
                        }
                        
                        groups.append(formatted_group)
        
        # Sort groups by last message time (newest first)
        groups.sort(key=lambda x: x.get('last_message_time', ''), reverse=True)
        
        return JsonResponse({
            'success': True,
            'groups': groups
        })
        
    except Exception as e:
        print(f"Error getting group chats: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

def is_group_admin(group_id, user_id):
    """
    Check if a user is an admin of a group.
    
    Args:
        group_id: The ID of the group
        user_id: The ID of the user
        
    Returns:
        bool: True if the user is an admin, False otherwise
    """
    try:
        members_ref = db.collection('group_members')
        query = members_ref.where('group_id', '==', group_id).where('user_id', '==', user_id)
        members = list(query.stream())
        
        if members:
            return members[0].to_dict().get('is_admin', False)
            
        return False
        
    except Exception as e:
        print(f"Error checking if user is group admin: {e}")
        return False

@csrf_exempt
def get_group_messages_view(request):
    """
    View for retrieving messages for a specific group chat.
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
    
    # Get the group ID from query parameters
    group_id = request.GET.get('group_id')
    if not group_id:
        return JsonResponse({
            'success': False,
            'error': 'Group ID is required'
        }, status=400)
    
    try:
        # Verify user is a member of the group
        if not is_group_member(group_id, current_user_id):
            return JsonResponse({
                'success': False,
                'error': 'You are not a member of this group'
            }, status=403)
        
        # Get messages for the group
        messages_ref = db.collection('group_messages')
        messages = messages_ref.where('group_id', '==', group_id).order_by('timestamp').stream()
        
        message_list = []
        for message in messages:
            message_data = message.to_dict()
            
            # Decrypt message content if it's not a system message
            if not message_data.get('is_system', False):
                encrypted_content = message_data.get('content')
                if encrypted_content:
                    message_data['content'] = encryption_manager.decrypt(encrypted_content)
            
            # Format for frontend
            formatted_message = {
                'id': message.id,
                'sender_id': message_data.get('sender_id'),
                'sender_name': message_data.get('sender_name'),
                'content': message_data.get('content'),
                'is_system': message_data.get('is_system', False),
                'message_type': message_data.get('message_type', 'text'),
                'timestamp': message_data.get('timestamp')
            }
            
            message_list.append(formatted_message)
        
        return JsonResponse({
            'success': True,
            'messages': message_list
        })
        
    except Exception as e:
        print(f"Error getting group messages: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

def is_group_member(group_id, user_id):
    """
    Check if a user is a member of a group.
    
    Args:
        group_id: The ID of the group
        user_id: The ID of the user
        
    Returns:
        bool: True if the user is a member, False otherwise
    """
    try:
        members_ref = db.collection('group_members')
        query = members_ref.where('group_id', '==', group_id).where('user_id', '==', user_id)
        members = list(query.stream())
        
        return len(members) > 0
        
    except Exception as e:
        print(f"Error checking if user is group member: {e}")
        return False

@csrf_exempt
def send_group_message_view(request):
    """
    View for sending a message to a group chat.
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
        message = data.get('message')
        
        if not group_id or not message:
            return JsonResponse({
                'success': False,
                'error': 'Group ID and message are required'
            }, status=400)
        
        # Verify user is a member of the group
        if not is_group_member(group_id, current_user_id):
            return JsonResponse({
                'success': False,
                'error': 'You are not a member of this group'
            }, status=403)
        
        # Send the message
        message_id = add_group_message(group_id, current_user_id, message)
        
        if message_id:
            return JsonResponse({
                'success': True,
                'message_id': message_id
            })
        else:
            return JsonResponse({
                'success': False,
                'error': 'Failed to send message'
            }, status=500)
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON'
        }, status=400)
        
    except Exception as e:
        print(f"Error sending group message: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def mark_group_messages_read_view(request):
    """
    View for marking all messages in a group chat as read.
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
        
        # Verify user is a member of the group
        if not is_group_member(group_id, current_user_id):
            return JsonResponse({
                'success': False,
                'error': 'You are not a member of this group'
            }, status=403)
        
        # Mark messages as read
        members_ref = db.collection('group_members')
        query = members_ref.where('group_id', '==', group_id).where('user_id', '==', current_user_id)
        members = list(query.stream())
        
        if members:
            members_ref.document(members[0].id).update({
                'unread_count': 0
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
        print(f"Error marking group messages as read: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def get_group_members_view(request):
    """
    View for retrieving all members of a group chat.
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
    
    # Get the group ID from query parameters
    group_id = request.GET.get('group_id')
    if not group_id:
        return JsonResponse({
            'success': False,
            'error': 'Group ID is required'
        }, status=400)
    
    try:
        # Verify user is a member of the group
        if not is_group_member(group_id, current_user_id):
            return JsonResponse({
                'success': False,
                'error': 'You are not a member of this group'
            }, status=403)
        
        # Get group details
        groups_ref = db.collection('group_chats')
        group = groups_ref.document(group_id).get()
        
        if not group.exists:
            return JsonResponse({
                'success': False,
                'error': 'Group not found'
            }, status=404)
        
        group_data = group.to_dict()
        member_ids = group_data.get('members', [])
        
        # Get member details
        members = []
        for member_id in member_ids:
            user_ref = db.collection('users_profile').document(member_id)
            user = user_ref.get()
            
            if user.exists:
                user_data = user.to_dict()
                
                # Check if user is admin
                is_admin = is_group_admin(group_id, member_id)
                
                members.append({
                    'user_id': member_id,
                    'name': user_data.get('name', 'Unknown User'),
                    'profile_picture': user_data.get('profile_picture'),
                    'role': user_data.get('role', ''),
                    'is_admin': is_admin
                })
        
        return JsonResponse({
            'success': True,
            'members': members
        })
        
    except Exception as e:
        print(f"Error getting group members: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def get_connected_users_view(request):
    """
    View for retrieving all users that the current user is mutually connected with.
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
        # Get users that the current user is following
        following_ids = get_user_following(current_user_id)
        
        # Filter to only include users who follow back
        connections = []
        for user_id in following_ids:
            # Check if this user follows the current user back
            follows_ref = db.collection('user_follows')
            follow_doc_id = f"{user_id}_follows_{current_user_id}"
            
            if follows_ref.document(follow_doc_id).get().exists:
                # Get user details
                user_ref = db.collection('users_profile').document(user_id)
                user = user_ref.get()
                
                if user.exists:
                    user_data = user.to_dict()
                    
                    connections.append({
                        'user_id': user_id,
                        'name': user_data.get('name', 'Unknown User'),
                        'profile_picture': user_data.get('profile_picture'),
                        'role': user_data.get('role', '')
                    })
        
        return JsonResponse({
            'success': True,
            'connections': connections
        })
        
    except Exception as e:
        print(f"Error getting connected users: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

def get_current_user_id(request):
    """
    Get the current user's ID based on session information.
    """
    try:
        # Get the user role
        user_role = request.session.get("role")
        
        if user_role == "teacher":
            # If teacher, get teacher name from session
            current_user_name = request.session.get("teachers_name")
            if current_user_name:
                # Get user details using the teacher's name
                details = get_user_by_name(current_user_name)
                if details and 'uid' in details:
                    return details.get('uid')
        
        elif user_role == "student":
            # If student, get student name from session
            current_user_name = request.session.get("students_name")
            if current_user_name:
                # Get user details using the student's name
                details = get_user_by_name(current_user_name)
                if details and 'uid' in details:
                    return details.get('uid')
        
        # If we reach here, we couldn't determine the user ID
        return None
        
    except Exception as e:
        print(f"Error getting current user ID: {e}")
        return None

def get_user_by_name(username):
    """
    Get user details by display name.
    This is imported from profile_page_updates, but included here as a fallback.
    """
    try:
        users = auth.list_users().users
        
        for user in users:
            if user.display_name == username:
                # Create a user object with uid
                return {
                    'uid': user.uid,
                    'display_name': user.display_name,
                    'email': user.email
                }
                
        return None
    except Exception as e:
        print(f"Error getting user by name: {e}")
        return None

def get_username(user_id):
    """
    Get username from user ID.
    """
    try:
        # First check in Firebase Auth
        try:
            user = auth.get_user(user_id)
            if user and user.display_name:
                return user.display_name
        except:
            pass
            
        # If not found in Auth, check in Firestore
        user_ref = db.collection('users_profile').document(user_id)
        user_doc = user_ref.get()
        
        if user_doc.exists:
            user_data = user_doc.to_dict()
            return user_data.get('name', 'Unknown User')
            
        return 'Unknown User'
        
    except Exception as e:
        print(f"Error getting username for {user_id}: {e}")
        return 'Unknown User'