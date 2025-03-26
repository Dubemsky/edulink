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
        
        # Create a channel group name for this group chat
        self.group_channel_name = f"group_chat_{self.group_id}"
        
        # Check if the user is a participant in this group chat
        is_participant = await self.check_participant()
        
        if not is_participant:
            # Reject the connection if the user is not a participant
            await self.close()
            return
        
        # Join the group chat channel
        await self.channel_layer.group_add(
            self.group_channel_name,
            self.channel_name
        )
        
        # Accept the WebSocket connection
        await self.accept()
        
        # Load previous messages
        previous_messages = await self.get_conversation_history()
        if previous_messages:
            await self.send(text_data=json.dumps({
                'type': 'history',
                'messages': previous_messages
            }))
        
        # Send a system message that the user joined the chat
        await self.channel_layer.group_send(
            self.group_channel_name,
            {
                'type': 'user_joined',
                'user_id': self.user_id,
                'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }
        )
    
    async def disconnect(self, close_code):
        # Leave the group chat channel
        await self.channel_layer.group_discard(
            self.group_channel_name,
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
                sender_id=self.user_id,
                content=message_content
            )
            
            # Get user details for the message
            user_details = await self.get_user_details(self.user_id)
            
            # Broadcast the message to the group
            await self.channel_layer.group_send(
                self.group_channel_name,
                {
                    'type': 'chat_message',
                    'message': message_content,
                    'sender_id': self.user_id,
                    'sender_name': user_details.get('name', 'Unknown User'),
                    'sender_picture': user_details.get('profile_picture'),
                    'message_id': message_id,
                    'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                }
            )
        elif message_type == 'typing':
            # Broadcast typing status to the group
            await self.channel_layer.group_send(
                self.group_channel_name,
                {
                    'type': 'user_typing',
                    'user_id': self.user_id,
                    'is_typing': data.get('is_typing', False)
                }
            )
    
    async def chat_message(self, event):
        # Send the message to the WebSocket
        await self.send(text_data=json.dumps({
            'type': 'message',
            'message': event['message'],
            'sender_id': event['sender_id'],
            'sender_name': event['sender_name'],
            'sender_picture': event.get('sender_picture'),
            'message_id': event['message_id'],
            'timestamp': event['timestamp']
        }))
    
    async def user_joined(self, event):
        # Get user details
        user_details = await self.get_user_details(event['user_id'])
        
        # Send a notification that a user joined the chat
        await self.send(text_data=json.dumps({
            'type': 'user_joined',
            'user_id': event['user_id'],
            'user_name': user_details.get('name', 'Unknown User'),
            'timestamp': event['timestamp']
        }))
    
    async def user_typing(self, event):
        # Send a notification that a user is typing
        user_details = await self.get_user_details(event['user_id'])
        
        await self.send(text_data=json.dumps({
            'type': 'typing',
            'user_id': event['user_id'],
            'user_name': user_details.get('name', 'Unknown User'),
            'is_typing': event['is_typing']
        }))
    
    @database_sync_to_async
    def check_participant(self):
        # Check if the user is a participant in this group chat
        db = firestore.client()
        group_ref = db.collection('group_chats').document(self.group_id)
        group = group_ref.get()
        
        if not group.exists:
            return False
        
        group_data = group.to_dict()
        return self.user_id in group_data.get('participants', [])
    
    @database_sync_to_async
    def save_message_to_firestore(self, sender_id, content):
        # Get Firestore client
        db = firestore.client()
        
        # Create a message object
        message = {
            'sender_id': sender_id,
            'content': content,
            'timestamp': firestore.SERVER_TIMESTAMP,
            'read_by': [sender_id],  # Sender has read the message
            'type': 'text'
        }
        
        # Add the message to Firestore
        group_ref = db.collection('group_chats').document(self.group_id)
        message_ref = group_ref.collection('messages').document()
        message_ref.set(message)
        
        # Update the group chat metadata
        update_data = {
            'last_message': content,
            'last_message_time': firestore.SERVER_TIMESTAMP,
            'last_sender_id': sender_id,
            'updated_at': firestore.SERVER_TIMESTAMP
        }
        
        # Get the participants to update unread counts
        group = group_ref.get()
        if group.exists:
            group_data = group.to_dict()
            participants = group_data.get('participants', [])
            
            # Increment unread count for all participants except sender
            for participant_id in participants:
                if participant_id != sender_id:
                    update_data[f'unread_count_{participant_id}'] = firestore.Increment(1)
        
        group_ref.update(update_data)
        
        return message_ref.id
    
    @database_sync_to_async
    def get_conversation_history(self):
        # Get Firestore client
        db = firestore.client()
        
        # Get messages from the group chat
        group_ref = db.collection('group_chats').document(self.group_id)
        messages_ref = group_ref.collection('messages')
        messages = messages_ref.order_by('timestamp').stream()
        
        # Format messages for the client
        message_list = []
        for message in messages:
            message_data = message.to_dict()
            sender_id = message_data.get('sender_id')
            
            # Get sender details
            sender_name = "Unknown User"
            sender_picture = None
            
            if sender_id:
                user_ref = db.collection('users_profile').document(sender_id)
                user = user_ref.get()
                if user.exists:
                    user_data = user.to_dict()
                    sender_name = user_data.get('name', 'Unknown User')
                    sender_picture = user_data.get('profile_picture')
            
            # Convert Firestore timestamp to string if necessary
            timestamp = message_data.get('timestamp')
            if hasattr(timestamp, 'strftime'):
                timestamp_str = timestamp.strftime('%Y-%m-%d %H:%M:%S')
            else:
                timestamp_str = str(timestamp)
            
            message_list.append({
                'id': message.id,
                'sender_id': sender_id,
                'sender_name': sender_name,
                'sender_picture': sender_picture,
                'content': message_data.get('content'),
                'timestamp': timestamp_str,
                'type': message_data.get('type', 'text'),
                'is_read': self.user_id in message_data.get('read_by', [])
            })
        
        return message_list
    
    @database_sync_to_async
    def get_user_details(self, user_id):
        # Get user details from Firestore
        db = firestore.client()
        user_ref = db.collection('users_profile').document(user_id)
        user = user_ref.get()
        
        if user.exists:
            return user.to_dict()
        else:
            return {'name': 'Unknown User'}

    @database_sync_to_async
    def mark_messages_as_read(self):
        # Mark all messages in the group chat as read by this user
        db = firestore.client()
        group_ref = db.collection('group_chats').document(self.group_id)
        messages_ref = group_ref.collection('messages')
        
        # Find messages that this user hasn't read yet
        messages = messages_ref.stream()
        batch = db.batch()
        
        for message in messages:
            message_data = message.to_dict()
            read_by = message_data.get('read_by', [])
            
            if self.user_id not in read_by:
                read_by.append(self.user_id)
                batch.update(messages_ref.document(message.id), {'read_by': read_by})
        
        # Commit the batch
        batch.commit()
        
        # Reset the unread count for this user
        group_ref.update({
            f'unread_count_{self.user_id}': 0
        })