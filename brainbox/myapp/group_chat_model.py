# Add these models to your models.py file or create a new file

from firebase_admin import firestore
from datetime import datetime

# Reference to Firestore database
db = firestore.client()

def create_group_chat(name, creator_id, member_ids):
    """
    Create a new group chat in Firestore.
    
    Args:
        name: The name of the group chat
        creator_id: The ID of the user creating the group chat
        member_ids: List of user IDs to add as members (should include creator_id)
        
    Returns:
        dict: Result with success status, group chat ID, and message
    """
    try:
        # Validate inputs
        if not name or not creator_id or not member_ids:
            return {
                'success': False,
                'message': 'Missing required information for creating group chat'
            }
            
        # Ensure creator is in the members list
        if creator_id not in member_ids:
            member_ids.append(creator_id)
            
        # Create the group chat document
        group_chats_ref = db.collection('group_chats')
        
        new_group_chat = {
            'name': name,
            'creator_id': creator_id,
            'members': member_ids,
            'created_at': firestore.SERVER_TIMESTAMP,
            'updated_at': firestore.SERVER_TIMESTAMP,
            'last_message': None,
            'last_message_time': None
        }
        
        # Add to Firestore and get the new document ID
        new_doc_ref = group_chats_ref.add(new_group_chat)[0]
        group_chat_id = new_doc_ref.id
        
        # Create the members collection for this group chat
        members_ref = group_chats_ref.document(group_chat_id).collection('members')
        
        # Add each member to the members collection
        for member_id in member_ids:
            members_ref.document(member_id).set({
                'user_id': member_id,
                'joined_at': firestore.SERVER_TIMESTAMP,
                'last_read': firestore.SERVER_TIMESTAMP,
                'is_admin': (member_id == creator_id)  # Creator is admin by default
            })
        
        return {
            'success': True,
            'group_chat_id': group_chat_id,
            'message': 'Group chat created successfully'
        }
        
    except Exception as e:
        print(f"Error creating group chat: {e}")
        return {
            'success': False,
            'message': f"Error creating group chat: {str(e)}"
        }

def get_user_group_chats(user_id):
    """
    Get all group chats that a user is a member of.
    
    Args:
        user_id: The ID of the user
        
    Returns:
        list: List of group chat objects with member details
    """
    try:
        # Reference to group_chats collection
        group_chats_ref = db.collection('group_chats')
        
        # Get all group chats
        all_group_chats = group_chats_ref.stream()
        
        # Filter to those where the user is a member
        user_group_chats = []
        
        for chat in all_group_chats:
            chat_data = chat.to_dict()
            
            # Check if the user is a member
            if user_id in chat_data.get('members', []):
                # Get the user's last read timestamp for this chat
                member_ref = group_chats_ref.document(chat.id).collection('members').document(user_id).get()
                last_read = None
                
                if member_ref.exists:
                    member_data = member_ref.to_dict()
                    last_read = member_data.get('last_read')
                
                # Format timestamps
                created_at = chat_data.get('created_at')
                if created_at:
                    created_at = created_at.timestamp() * 1000  # Convert to milliseconds for JS
                
                updated_at = chat_data.get('updated_at')
                if updated_at:
                    updated_at = updated_at.timestamp() * 1000
                
                last_message_time = chat_data.get('last_message_time')
                if last_message_time:
                    last_message_time = last_message_time.timestamp() * 1000
                
                if last_read:
                    last_read = last_read.timestamp() * 1000
                
                # Format the group chat data
                group_chat = {
                    'id': chat.id,
                    'name': chat_data.get('name'),
                    'creator_id': chat_data.get('creator_id'),
                    'created_at': created_at,
                    'updated_at': updated_at,
                    'last_message': chat_data.get('last_message'),
                    'last_message_time': last_message_time,
                    'members': chat_data.get('members', []),
                    'last_read': last_read
                }
                
                # Add to the list
                user_group_chats.append(group_chat)
        
        return user_group_chats
        
    except Exception as e:
        print(f"Error getting user group chats: {e}")
        return []

def send_group_message(group_chat_id, sender_id, message_text):
    """
    Send a message to a group chat.
    
    Args:
        group_chat_id: The ID of the group chat
        sender_id: The ID of the user sending the message
        message_text: The text content of the message
        
    Returns:
        dict: Result with success status and message
    """
    try:
        # Reference to the group chat
        group_chat_ref = db.collection('group_chats').document(group_chat_id)
        
        # Check if the group chat exists
        group_chat = group_chat_ref.get()
        if not group_chat.exists:
            return {
                'success': False,
                'message': 'Group chat not found'
            }
            
        # Check if the sender is a member
        group_chat_data = group_chat.to_dict()
        if sender_id not in group_chat_data.get('members', []):
            return {
                'success': False,
                'message': 'You are not a member of this group chat'
            }
            
        # Create the message
        messages_ref = group_chat_ref.collection('messages')
        
        new_message = {
            'sender_id': sender_id,
            'content': message_text,
            'timestamp': firestore.SERVER_TIMESTAMP,
            'read_by': [sender_id]  # Sender has read the message
        }
        
        # Add the message to Firestore
        message_ref = messages_ref.add(new_message)[0]
        
        # Update the group chat with the last message info
        group_chat_ref.update({
            'last_message': message_text,
            'last_message_time': firestore.SERVER_TIMESTAMP,
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        # Update the sender's last read timestamp
        member_ref = group_chat_ref.collection('members').document(sender_id)
        member_ref.update({
            'last_read': firestore.SERVER_TIMESTAMP
        })
        
        return {
            'success': True,
            'message_id': message_ref.id,
            'message': 'Message sent successfully'
        }
        
    except Exception as e:
        print(f"Error sending group message: {e}")
        return {
            'success': False,
            'message': f"Error sending message: {str(e)}"
        }

def get_group_chat_messages(group_chat_id, user_id, limit=50):
    """
    Get messages for a group chat.
    
    Args:
        group_chat_id: The ID of the group chat
        user_id: The ID of the user requesting the messages
        limit: Maximum number of messages to return (default 50)
        
    Returns:
        dict: Result with success status, messages, and group info
    """
    try:
        # Reference to the group chat
        group_chat_ref = db.collection('group_chats').document(group_chat_id)
        
        # Check if the group chat exists
        group_chat = group_chat_ref.get()
        if not group_chat.exists:
            return {
                'success': False,
                'message': 'Group chat not found'
            }
            
        # Check if the user is a member
        group_chat_data = group_chat.to_dict()
        if user_id not in group_chat_data.get('members', []):
            return {
                'success': False,
                'message': 'You are not a member of this group chat'
            }
            
        # Get the messages, ordered by timestamp
        messages_ref = group_chat_ref.collection('messages')
        messages_query = messages_ref.order_by('timestamp', direction=firestore.Query.DESCENDING).limit(limit)
        messages = messages_query.stream()
        
        # Format the messages
        formatted_messages = []
        for message in messages:
            message_data = message.to_dict()
            
            # Format timestamp
            timestamp = message_data.get('timestamp')
            if timestamp:
                timestamp = timestamp.timestamp() * 1000  # Convert to milliseconds for JS
            
            formatted_message = {
                'id': message.id,
                'sender_id': message_data.get('sender_id'),
                'content': message_data.get('content'),
                'timestamp': timestamp,
                'read_by': message_data.get('read_by', [])
            }
            
            formatted_messages.append(formatted_message)
        
        # Sort messages chronologically (oldest first)
        formatted_messages.reverse()
        
        # Mark messages as read for this user
        member_ref = group_chat_ref.collection('members').document(user_id)
        member_ref.update({
            'last_read': firestore.SERVER_TIMESTAMP
        })
        
        # Update read_by for unread messages
        for message in messages:
            message_data = message.to_dict()
            read_by = message_data.get('read_by', [])
            
            if user_id not in read_by:
                read_by.append(user_id)
                messages_ref.document(message.id).update({
                    'read_by': read_by
                })
        
        # Get group members with details
        members = []
        users_ref = db.collection('users_profile')
        
        for member_id in group_chat_data.get('members', []):
            user_doc = users_ref.document(member_id).get()
            if user_doc.exists:
                user_data = user_doc.to_dict()
                members.append({
                    'id': member_id,
                    'name': user_data.get('name'),
                    'role': user_data.get('role'),
                    'profile_picture': user_data.get('profile_picture')
                })
        
        # Return messages and group info
        return {
            'success': True,
            'messages': formatted_messages,
            'group_info': {
                'id': group_chat_id,
                'name': group_chat_data.get('name'),
                'creator_id': group_chat_data.get('creator_id'),
                'members': members
            }
        }
        
    except Exception as e:
        print(f"Error getting group chat messages: {e}")
        return {
            'success': False,
            'message': f"Error getting messages: {str(e)}"
        }

def add_group_chat_member(group_chat_id, user_id, new_member_id):
    """
    Add a new member to a group chat.
    
    Args:
        group_chat_id: The ID of the group chat
        user_id: The ID of the user performing the action (must be an admin)
        new_member_id: The ID of the user to add
        
    Returns:
        dict: Result with success status and message
    """
    try:
        # Reference to the group chat
        group_chat_ref = db.collection('group_chats').document(group_chat_id)
        
        # Check if the group chat exists
        group_chat = group_chat_ref.get()
        if not group_chat.exists:
            return {
                'success': False,
                'message': 'Group chat not found'
            }
            
        # Check if the user is an admin
        member_ref = group_chat_ref.collection('members').document(user_id).get()
        if not member_ref.exists or not member_ref.to_dict().get('is_admin', False):
            return {
                'success': False,
                'message': 'You do not have permission to add members'
            }
            
        # Check if the new member is already in the group
        group_chat_data = group_chat.to_dict()
        if new_member_id in group_chat_data.get('members', []):
            return {
                'success': False,
                'message': 'User is already a member of this group chat'
            }
            
        # Add the member to the members list
        new_members = group_chat_data.get('members', [])
        new_members.append(new_member_id)
        
        # Update the group chat
        group_chat_ref.update({
            'members': new_members,
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        # Add the member to the members collection
        members_ref = group_chat_ref.collection('members')
        members_ref.document(new_member_id).set({
            'user_id': new_member_id,
            'joined_at': firestore.SERVER_TIMESTAMP,
            'last_read': firestore.SERVER_TIMESTAMP,
            'is_admin': False  # New members are not admins by default
        })
        
        return {
            'success': True,
            'message': 'Member added successfully'
        }
        
    except Exception as e:
        print(f"Error adding group chat member: {e}")
        return {
            'success': False,
            'message': f"Error adding member: {str(e)}"
        }

def remove_group_chat_member(group_chat_id, user_id, member_id_to_remove):
    """
    Remove a member from a group chat.
    
    Args:
        group_chat_id: The ID of the group chat
        user_id: The ID of the user performing the action (must be an admin)
        member_id_to_remove: The ID of the user to remove
        
    Returns:
        dict: Result with success status and message
    """
    try:
        # Reference to the group chat
        group_chat_ref = db.collection('group_chats').document(group_chat_id)
        
        # Check if the group chat exists
        group_chat = group_chat_ref.get()
        if not group_chat.exists:
            return {
                'success': False,
                'message': 'Group chat not found'
            }
            
        # Check if the user is an admin or removing themselves
        if user_id != member_id_to_remove:
            member_ref = group_chat_ref.collection('members').document(user_id).get()
            if not member_ref.exists or not member_ref.to_dict().get('is_admin', False):
                return {
                    'success': False,
                    'message': 'You do not have permission to remove members'
                }
        
        # Check if the member is in the group
        group_chat_data = group_chat.to_dict()
        if member_id_to_remove not in group_chat_data.get('members', []):
            return {
                'success': False,
                'message': 'User is not a member of this group chat'
            }
            
        # Remove the member from the members list
        new_members = group_chat_data.get('members', [])
        new_members.remove(member_id_to_remove)
        
        # Update the group chat
        group_chat_ref.update({
            'members': new_members,
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        # Remove the member from the members collection
        members_ref = group_chat_ref.collection('members')
        members_ref.document(member_id_to_remove).delete()
        
        # If the group is now empty, delete it
        if not new_members:
            # Delete the group chat and all subcollections
            delete_group_chat(group_chat_id)
            return {
                'success': True,
                'message': 'You left the group chat and it was deleted (no members left)'
            }
            
        # If the creator is leaving, assign a new admin
        if member_id_to_remove == group_chat_data.get('creator_id') and new_members:
            # Assign the first remaining member as the new creator
            new_creator_id = new_members[0]
            
            # Update the group chat
            group_chat_ref.update({
                'creator_id': new_creator_id
            })
            
            # Make the new creator an admin
            members_ref.document(new_creator_id).update({
                'is_admin': True
            })
            
        return {
            'success': True,
            'message': 'Member removed successfully'
        }
        
    except Exception as e:
        print(f"Error removing group chat member: {e}")
        return {
            'success': False,
            'message': f"Error removing member: {str(e)}"
        }

def delete_group_chat(group_chat_id):
    """
    Delete a group chat and all its subcollections.
    
    Args:
        group_chat_id: The ID of the group chat to delete
        
    Returns:
        dict: Result with success status and message
    """
    try:
        # Reference to the group chat
        group_chat_ref = db.collection('group_chats').document(group_chat_id)
        
        # Delete members subcollection
        members_ref = group_chat_ref.collection('members')
        delete_collection(members_ref, 100)
        
        # Delete messages subcollection
        messages_ref = group_chat_ref.collection('messages')
        delete_collection(messages_ref, 100)
        
        # Delete the group chat document
        group_chat_ref.delete()
        
        return {
            'success': True,
            'message': 'Group chat deleted successfully'
        }
        
    except Exception as e:
        print(f"Error deleting group chat: {e}")
        return {
            'success': False,
            'message': f"Error deleting group chat: {str(e)}"
        }

def delete_collection(collection_ref, batch_size):
    """
    Helper function to delete a collection in batches.
    
    Args:
        collection_ref: Reference to the collection to delete
        batch_size: Number of documents to delete in each batch
    """
    docs = collection_ref.limit(batch_size).stream()
    deleted = 0
    
    for doc in docs:
        doc.reference.delete()
        deleted += 1
        
    if deleted >= batch_size:
        return delete_collection(collection_ref, batch_size)