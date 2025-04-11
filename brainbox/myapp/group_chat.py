# group_chat.py
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
from .firebase import *
from .community_page import get_user_following
from .private_messages import get_current_user_id, is_following, is_mutually_connected

@csrf_exempt
def get_mutual_connections(request):
    """
    Get all users that both follow the current user and are followed by the current user
    
    Returns:
        JsonResponse with list of mutually connected users
    """
    try:
        # Get the current user's ID
        current_user_id = get_current_user_id(request)
        if not current_user_id:
            return JsonResponse({
                'success': False,
                'error': 'User not authenticated'
            }, status=401)
        
        # Get the list of users the current user is following
        following_ids = get_user_following(current_user_id)
        
        # Get the list of users who follow the current user
        followers_ref = db.collection('user_follows')
        followers_query = followers_ref.where('following_id', '==', current_user_id)
        followers_docs = followers_query.stream()
        
        # Extract the follower IDs
        follower_ids = []
        for doc in followers_docs:
            follower_data = doc.to_dict()
            follower_ids.append(follower_data.get('follower_id'))
        
        # Find the intersection of followers and following (mutual connections)
        mutual_connection_ids = list(set(following_ids) & set(follower_ids))
        
        # Get the details for each mutual connection
        users_ref = db.collection('users_profile')
        mutual_connections = []
        
        for user_id in mutual_connection_ids:
            user_doc = users_ref.document(user_id).get()
            if user_doc.exists:
                user_data = user_doc.to_dict()
                mutual_connections.append({
                    'id': user_id,
                    'name': user_data.get('name'),
                    'role': user_data.get('role'),
                    'profile_picture': user_data.get('profile_picture')
                })
        
        return JsonResponse({
            'success': True,
            'connections': mutual_connections
        })
    
    except Exception as e:
        print(f"Error getting mutual connections: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def create_group_chat(request):
    """
    Create a new group chat with the provided name and members
    
    Expects:
        - name: Group chat name
        - members: List of user IDs to include (must be mutual connections)
    
    Returns:
        JsonResponse with the created group chat ID
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
        group_name = data.get('name')
        member_ids = data.get('members', [])
        
        if not group_name:
            return JsonResponse({
                'success': False,
                'error': 'Group name is required'
            }, status=400)
        
        if len(member_ids) < 2:
            return JsonResponse({
                'success': False,
                'error': 'At least 2 members are required to create a group'
            }, status=400)
        
        # Verify that all members are mutually connected with the current user
        for member_id in member_ids:
            if not is_mutually_connected(current_user_id, member_id):
                return JsonResponse({
                    'success': False,
                    'error': f'User with ID {member_id} is not mutually connected with you'
                }, status=400)
        
        # Add the current user to the members list if not already included
        if current_user_id not in member_ids:
            member_ids.append(current_user_id)
        
        # Create the group chat in Firestore
        group_chat_data = {
            'name': group_name,
            'creator_id': current_user_id,
            'members': member_ids,
            'created_at': firestore.SERVER_TIMESTAMP,
            'updated_at': firestore.SERVER_TIMESTAMP,
            'last_message': None,
            'last_message_time': firestore.SERVER_TIMESTAMP
        }
        
        # Add to group_chats collection
        group_chat_ref = db.collection('group_chats').document()
        group_chat_ref.set(group_chat_data)
        group_chat_id = group_chat_ref.id
        
        # For each member, add a reference to this group in their user_group_chats collection
        for member_id in member_ids:
            member_group_data = {
                'group_id': group_chat_id,
                'joined_at': firestore.SERVER_TIMESTAMP,
                'unread_count': 0 if member_id == current_user_id else 1  # Creator starts with 0 unread
            }
            db.collection('user_group_chats').document(f"{member_id}_{group_chat_id}").set(member_group_data)
            
            # Add a notification for each member (except the creator)
            if member_id != current_user_id:
                # Get creator's name
                creator_doc = db.collection('users_profile').document(current_user_id).get()
                creator_name = creator_doc.to_dict().get('name', 'A user') if creator_doc.exists else 'A user'
                
                notification_data = {
                    'type': 'group_chat_invite',
                    'group_id': group_chat_id,
                    'message': f"{creator_name} added you to the group '{group_name}'",
                    'username': member_id,
                    'timestamp': firestore.SERVER_TIMESTAMP,
                    'read': False
                }
                db.collection('notifications').add(notification_data)
        
        # Add a system message to the group chat
        system_message = {
            'group_id': group_chat_id,
            'sender_id': 'system',
            'content': f"Group '{group_name}' created by {current_user_id}",
            'timestamp': firestore.SERVER_TIMESTAMP,
            'type': 'system'
        }
        db.collection('group_chat_messages').add(system_message)
        
        return JsonResponse({
            'success': True,
            'group_id': group_chat_id,
            'name': group_name,
            'members': member_ids
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
    Get all group chats that the current user is a member of
    
    Returns:
        JsonResponse with list of group chats
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
        # Query user_group_chats to find groups this user is a member of
        user_groups_ref = db.collection('user_group_chats')
        query = user_groups_ref.where('user_id', '==', current_user_id)
        user_groups = list(query.stream())
        
        # Get the group_ids
        group_ids = [doc.to_dict().get('group_id') for doc in user_groups]
        
        # Fetch details for each group
        groups_ref = db.collection('group_chats')
        group_chats = []
        
        for group_id in group_ids:
            group_doc = groups_ref.document(group_id).get()
            if group_doc.exists:
                group_data = group_doc.to_dict()
                
                # Get member names for display
                member_ids = group_data.get('members', [])
                
                # Get member details
                users_ref = db.collection('users_profile')
                members = []
                
                # This would be inefficient for large groups, consider paginating
                for member_id in member_ids[:3]:  # Only get first 3 for preview
                    user_doc = users_ref.document(member_id).get()
                    if user_doc.exists:
                        user_data = user_doc.to_dict()
                        members.append({
                            'id': member_id,
                            'name': user_data.get('name')
                        })
                
                # Get unread count for this user
                user_group_doc = db.collection('user_group_chats').document(f"{current_user_id}_{group_id}").get()
                unread_count = 0
                if user_group_doc.exists:
                    unread_count = user_group_doc.to_dict().get('unread_count', 0)
                
                # Format the group chat data
                group_chats.append({
                    'id': group_id,
                    'name': group_data.get('name'),
                    'last_message': group_data.get('last_message'),
                    'last_message_time': group_data.get('last_message_time'),
                    'members': members,
                    'member_count': len(member_ids),
                    'unread_count': unread_count,
                    'created_at': group_data.get('created_at')
                })
        
        # Sort by last message time (newest first)
        group_chats.sort(key=lambda x: x.get('last_message_time', 0), reverse=True)
        
        return JsonResponse({
            'success': True,
            'group_chats': group_chats
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
    
    Expects:
        - group_id: ID of the group chat
        - message: Message content
    
    Returns:
        JsonResponse with the sent message ID
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
        
        # Verify that the user is a member of the group
        group_doc = db.collection('group_chats').document(group_id).get()
        if not group_doc.exists:
            return JsonResponse({
                'success': False,
                'error': 'Group chat not found'
            }, status=404)
            
        group_data = group_doc.to_dict()
        members = group_data.get('members', [])
        
        if current_user_id not in members:
            return JsonResponse({
                'success': False,
                'error': 'You are not a member of this group chat'
            }, status=403)
        
        # Create the message
        message_data = {
            'group_id': group_id,
            'sender_id': current_user_id,
            'content': message_content,
            'timestamp': firestore.SERVER_TIMESTAMP,
            'type': 'text',
            'read_by': [current_user_id]  # Sender has automatically read the message
        }
        
        # Add the message
        message_ref = db.collection('group_chat_messages').add(message_data)
        message_id = message_ref[1].id
        
        # Update the group chat with the last message info
        db.collection('group_chats').document(group_id).update({
            'last_message': message_content,
            'last_message_time': firestore.SERVER_TIMESTAMP,
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        # Update unread count for other members
        for member_id in members:
            if member_id != current_user_id:
                db.collection('user_group_chats').document(f"{member_id}_{group_id}").update({
                    'unread_count': firestore.Increment(1)
                })
        
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
    
    Args:
        group_id: ID of the group chat
    
    Returns:
        JsonResponse with list of messages
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
        # Verify that the user is a member of the group
        group_doc = db.collection('group_chats').document(group_id).get()
        if not group_doc.exists:
            return JsonResponse({
                'success': False,
                'error': 'Group chat not found'
            }, status=404)
            
        group_data = group_doc.to_dict()
        members = group_data.get('members', [])
        
        if current_user_id not in members:
            return JsonResponse({
                'success': False,
                'error': 'You are not a member of this group chat'
            }, status=403)
        
        # Get the messages for the group
        messages_ref = db.collection('group_chat_messages')
        query = messages_ref.where('group_id', '==', group_id).order_by('timestamp')
        messages = query.stream()
        
        # Format the messages
        message_list = []
        for message in messages:
            message_data = message.to_dict()
            sender_id = message_data.get('sender_id')
            
            # Get sender details
            sender_name = 'Unknown User'
            sender_profile_picture = None
            
            if sender_id == 'system':
                sender_name = 'System'
            else:
                sender_doc = db.collection('users_profile').document(sender_id).get()
                if sender_doc.exists:
                    sender_data = sender_doc.to_dict()
                    sender_name = sender_data.get('name', 'Unknown User')
                    sender_profile_picture = sender_data.get('profile_picture')
            
            # Format the message
            message_list.append({
                'id': message.id,
                'sender_id': sender_id,
                'sender_name': sender_name,
                'sender_profile_picture': sender_profile_picture,
                'content': message_data.get('content'),
                'timestamp': message_data.get('timestamp'),
                'type': message_data.get('type', 'text'),
                'read_by': message_data.get('read_by', [])
            })
        
        # Mark messages as read for this user
        batch = db.batch()
        for message in messages:
            message_data = message.to_dict()
            read_by = message_data.get('read_by', [])
            
            if current_user_id not in read_by:
                message_ref = messages_ref.document(message.id)
                read_by.append(current_user_id)
                batch.update(message_ref, {'read_by': read_by})
        
        # Commit the batch update
        batch.commit()
        
        # Reset unread count for this user
        db.collection('user_group_chats').document(f"{current_user_id}_{group_id}").update({
            'unread_count': 0
        })
        
        return JsonResponse({
            'success': True,
            'messages': message_list,
            'group': {
                'id': group_id,
                'name': group_data.get('name'),
                'members': members
            }
        })
        
    except Exception as e:
        print(f"Error getting group messages: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def add_to_group(request):
    """
    Add user(s) to a group chat
    
    Expects:
        - group_id: ID of the group chat
        - users: List of user IDs to add
    
    Returns:
        JsonResponse with success status
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
        user_ids = data.get('users', [])
        
        if not group_id or not user_ids:
            return JsonResponse({
                'success': False,
                'error': 'Group ID and users are required'
            }, status=400)
        
        # Verify that the current user is a member of the group
        group_doc = db.collection('group_chats').document(group_id).get()
        if not group_doc.exists:
            return JsonResponse({
                'success': False,
                'error': 'Group chat not found'
            }, status=404)
            
        group_data = group_doc.to_dict()
        members = group_data.get('members', [])
        group_name = group_data.get('name')
        
        if current_user_id not in members:
            return JsonResponse({
                'success': False,
                'error': 'You are not a member of this group chat'
            }, status=403)
        
        # Check if the users are already members
        existing_members = set(members)
        new_members = []
        
        for user_id in user_ids:
            if user_id not in existing_members:
                new_members.append(user_id)
        
        if not new_members:
            return JsonResponse({
                'success': True,
                'message': 'All users are already members of the group'
            })
        
        # Get current user's name
        current_user_doc = db.collection('users_profile').document(current_user_id).get()
        current_user_name = 'A user'
        if current_user_doc.exists:
            current_user_name = current_user_doc.to_dict().get('name', 'A user')
        
        # Add new members to the group
        updated_members = list(existing_members) + new_members
        db.collection('group_chats').document(group_id).update({
            'members': updated_members,
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        # Add user_group_chats entries for new members
        batch = db.batch()
        for user_id in new_members:
            member_group_data = {
                'group_id': group_id,
                'joined_at': firestore.SERVER_TIMESTAMP,
                'unread_count': 1  # Start with 1 unread message (the system message)
            }
            batch.set(db.collection('user_group_chats').document(f"{user_id}_{group_id}"), member_group_data)
            
            # Add a notification for the new member
            notification_data = {
                'type': 'group_chat_invite',
                'group_id': group_id,
                'message': f"{current_user_name} added you to the group '{group_name}'",
                'username': user_id,
                'timestamp': firestore.SERVER_TIMESTAMP,
                'read': False
            }
            db.collection('notifications').add(notification_data)
        
        # Commit the batch update
        batch.commit()
        
        # Add a system message about new members
        new_member_names = []
        for user_id in new_members:
            user_doc = db.collection('users_profile').document(user_id).get()
            if user_doc.exists:
                user_name = user_doc.to_dict().get('name', 'Unknown User')
                new_member_names.append(user_name)
        
        member_names_str = ', '.join(new_member_names)
        system_message = {
            'group_id': group_id,
            'sender_id': 'system',
            'content': f"{current_user_name} added {member_names_str} to the group",
            'timestamp': firestore.SERVER_TIMESTAMP,
            'type': 'system',
            'read_by': [current_user_id]  # Only the current user has read this message
        }
        db.collection('group_chat_messages').add(system_message)
        
        # Update the group chat with the last message info
        db.collection('group_chats').document(group_id).update({
            'last_message': system_message['content'],
            'last_message_time': firestore.SERVER_TIMESTAMP
        })
        
        # Update unread count for other existing members
        for member_id in existing_members:
            if member_id != current_user_id:
                db.collection('user_group_chats').document(f"{member_id}_{group_id}").update({
                    'unread_count': firestore.Increment(1)
                })
        
        return JsonResponse({
            'success': True,
            'added_users': new_members
        })
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON'
        }, status=400)
        
    except Exception as e:
        print(f"Error adding users to group chat: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def leave_group(request):
    """
    Leave a group chat
    
    Expects:
        - group_id: ID of the group chat
    
    Returns:
        JsonResponse with success status
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
        
        # Verify that the user is a member of the group
        group_doc = db.collection('group_chats').document(group_id).get()
        if not group_doc.exists:
            return JsonResponse({
                'success': False,
                'error': 'Group chat not found'
            }, status=404)
            
        group_data = group_doc.to_dict()
        members = group_data.get('members', [])
        group_name = group_data.get('name')
        
        if current_user_id not in members:
            return JsonResponse({
                'success': False,
                'error': 'You are not a member of this group chat'
            }, status=403)
        
        # Get current user's name
        current_user_doc = db.collection('users_profile').document(current_user_id).get()
        current_user_name = 'Unknown User'
        if current_user_doc.exists:
            current_user_name = current_user_doc.to_dict().get('name', 'Unknown User')
        
        # Remove the user from the group members
        updated_members = [m for m in members if m != current_user_id]
        
        # Check if this was the last member
        if not updated_members:
            # Delete the group entirely
            db.collection('group_chats').document(group_id).delete()
            
            # Delete all group messages
            messages_ref = db.collection('group_chat_messages').where('group_id', '==', group_id)
            batch = db.batch()
            for message in messages_ref.stream():
                batch.delete(message.reference)
            batch.commit()
            
            # Delete the user_group_chat entry
            db.collection('user_group_chats').document(f"{current_user_id}_{group_id}").delete()
            
            return JsonResponse({
                'success': True,
                'message': 'You were the last member. Group has been deleted.'
            })
        
        # Update the group members
        db.collection('group_chats').document(group_id).update({
            'members': updated_members,
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        # Delete the user_group_chat entry
        db.collection('user_group_chats').document(f"{current_user_id}_{group_id}").delete()
        
        # Add a system message about the user leaving
        system_message = {
            'group_id': group_id,
            'sender_id': 'system',
            'content': f"{current_user_name} left the group",
            'timestamp': firestore.SERVER_TIMESTAMP,
            'type': 'system',
            'read_by': []  # No one has read this message yet
        }
        db.collection('group_chat_messages').add(system_message)
        
        # Update the group chat with the last message info
        db.collection('group_chats').document(group_id).update({
            'last_message': system_message['content'],
            'last_message_time': firestore.SERVER_TIMESTAMP
        })
        
        # Update unread count for remaining members
        for member_id in updated_members:
            db.collection('user_group_chats').document(f"{member_id}_{group_id}").update({
                'unread_count': firestore.Increment(1)
            })
        
        return JsonResponse({
            'success': True,
            'message': f"You have left the group '{group_name}'"
        })
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON'
        }, status=400)
        
    except Exception as e:
        print(f"Error leaving group chat: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)
                