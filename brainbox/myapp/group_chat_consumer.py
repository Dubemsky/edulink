import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from firebase_admin import firestore
from datetime import datetime

class GroupChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Get the group ID from the URL route
        self.group_id = self.scope['url_route']['kwargs']['group_id']
        self.user_id = self.scope['url_route']['kwargs']['user_id']
        
        # Ensure the user is a member of the group
        is_member = await self.is_group_member(self.user_id, self.group_id)
        if not is_member:
            # Close the connection if the user is not a member
            await self.close()
            return
        
        # Create a unique channel group name for this group chat
        self.room_group_name = f"group_chat_{self.group_id}"
        
        # Join the room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        # Accept the WebSocket connection
        await self.accept()
        
        # Load previous messages
        previous_messages = await self.get_group_history()
        if previous_messages:
            await self.send(text_data=json.dumps({
                'type': 'history',
                'messages': previous_messages
            }))
    
    async def disconnect(self, close_code):
        # Leave the room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
    
    async def receive(self, text_data):
        # Parse the received message
        data = json.loads(text_data)
        message_type = data.get('type', 'message')
        
        if message_type == 'message':
            # Extract message content
            message_content = data.get('message', '')
            
            # Store the message in Firestore
            message_id = await self.save_message_to_firestore(
                self.user_id,
                self.group_id,
                message_content
            )
            
            # Get sender details
            sender_details = await self.get_user_details(self.user_id)
            
            # Broadcast the message to the group
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': message_content,
                    'sender_id': self.user_id,
                    'sender_name': sender_details.get('name', 'Unknown User'),
                    'sender_profile_picture': sender_details.get('profile_picture'),
                    'message_id': message_id,
                    'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    'message_type': 'text'
                }
            )
    
    async def chat_message(self, event):
        # Send the message to the WebSocket
        await self.send(text_data=json.dumps({
            'type': 'message',
            'message': event['message'],
            'sender_id': event['sender_id'],
            'sender_name': event['sender_name'],
            'sender_profile_picture': event.get('sender_profile_picture'),
            'message_id': event['message_id'],
            'timestamp': event['timestamp'],
            'message_type': event.get('message_type', 'text')
        }))
    
    @database_sync_to_async
    def is_group_member(self, user_id, group_id):
        """Check if the user is a member of the group."""
        try:
            # Get Firestore client
            db = firestore.client()
            
            # Get the group document
            group_ref = db.collection('group_chats').document(group_id)
            group_doc = group_ref.get()
            
            if group_doc.exists:
                members = group_doc.to_dict().get('members', [])
                return user_id in members
            
            return False
        except Exception as e:
            print(f"Error checking group membership: {e}")
            return False
    
    @database_sync_to_async
    def get_user_details(self, user_id):
        """Get user details from Firestore."""
        try:
            # Get Firestore client
            db = firestore.client()
            
            # Get the user document
            user_ref = db.collection('users_profile').document(user_id)
            user_doc = user_ref.get()
            
            if user_doc.exists:
                return user_doc.to_dict()
            
            return {}
        except Exception as e:
            print(f"Error getting user details: {e}")
            return {}
    
    @database_sync_to_async
    def save_message_to_firestore(self, sender_id, group_id, content):
        """Store a group message in Firestore."""
        try:
            # Get Firestore client
            db = firestore.client()
            
            # Create a message object
            message = {
                'group_id': group_id,
                'sender_id': sender_id,
                'content': content,
                'timestamp': firestore.SERVER_TIMESTAMP,
                'type': 'text',
                'read_by': [sender_id]  # Sender has automatically read the message
            }
            
            # Add the message to Firestore
            message_ref = db.collection('group_chat_messages').add(message)
            message_id = message_ref[1].id
            
            # Update the group chat with the last message info
            db.collection('group_chats').document(group_id).update({
                'last_message': content,
                'last_message_time': firestore.SERVER_TIMESTAMP,
                'updated_at': firestore.SERVER_TIMESTAMP
            })
            
            # Get all group members
            group_ref = db.collection('group_chats').document(group_id)
            group_doc = group_ref.get()
            members = []
            
            if group_doc.exists:
                members = group_doc.to_dict().get('members', [])
            
            # Update unread count for other members
            for member_id in members:
                if member_id != sender_id:
                    db.collection('user_group_chats').document(f"{member_id}_{group_id}").update({
                        'unread_count': firestore.Increment(1)
                    })
            
            return message_id
        except Exception as e:
            print(f"Error saving group message: {e}")
            return None
    
    @database_sync_to_async
    def get_group_history(self):
        """Get message history for the group chat."""
        try:
            # Get Firestore client
            db = firestore.client()
            
            # Query the group messages
            messages_ref = db.collection('group_chat_messages')
            query = messages_ref.where('group_id', '==', self.group_id).order_by('timestamp')
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
                
                # Convert timestamp to string if it's a Firestore timestamp
                timestamp = message_data.get('timestamp')
                if hasattr(timestamp, 'strftime'):
                    timestamp_str = timestamp.strftime('%Y-%m-%d %H:%M:%S')
                else:
                    timestamp_str = str(timestamp)
                
                # Add the message to the list
                message_list.append({
                    'id': message.id,
                    'sender_id': sender_id,
                    'sender_name': sender_name,
                    'sender_profile_picture': sender_profile_picture,
                    'content': message_data.get('content'),
                    'timestamp': timestamp_str,
                    'type': message_data.get('type', 'text')
                })
            
            # Mark all messages as read by this user
            batch = db.batch()
            for message in messages:
                message_data = message.to_dict()
                read_by = message_data.get('read_by', [])
                
                if self.user_id not in read_by:
                    message_ref = messages_ref.document(message.id)
                    read_by.append(self.user_id)
                    batch.update(message_ref, {'read_by': read_by})
            
            # Commit the batch update
            batch.commit()
            
            # Reset unread count for this user
            db.collection('user_group_chats').document(f"{self.user_id}_{self.group_id}").update({
                'unread_count': 0
            })
            
            return message_list
        except Exception as e:
            print(f"Error getting group history: {e}")
            return []