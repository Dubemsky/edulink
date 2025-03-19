import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from firebase_admin import firestore
from datetime import datetime

class DirectChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Get the user IDs from the URL route
        self.user_id = self.scope['url_route']['kwargs']['user_id']
        self.recipient_id = self.scope['url_route']['kwargs']['recipient_id']
        print(f"\n\nThis is the user_id {self.user_id}\nOther id {self.recipient_id}\n" )

        
        # Create a unique conversation ID (always in the same order for consistency)
        user_ids = sorted([self.user_id, self.recipient_id])
        self.conversation_id = f"conversation_{'_'.join(user_ids)}"
        
        # Join the conversation group
        await self.channel_layer.group_add(
            self.conversation_id,
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
    
    async def disconnect(self, close_code):
        # Leave the conversation group
        await self.channel_layer.group_discard(
            self.conversation_id,
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
                recipient_id=self.recipient_id,
                content=message_content
            )
            
            # Broadcast the message to the group
            await self.channel_layer.group_send(
                self.conversation_id,
                {
                    'type': 'chat_message',
                    'message': message_content,
                    'sender_id': self.user_id,
                    'recipient_id': self.recipient_id,
                    'message_id': message_id,
                    'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                }
            )
    
    async def chat_message(self, event):
        # Send the message to the WebSocket
        await self.send(text_data=json.dumps({
            'type': 'message',
            'message': event['message'],
            'sender_id': event['sender_id'],
            'recipient_id': event['recipient_id'],
            'message_id': event['message_id'],
            'timestamp': event['timestamp']
        }))
    
    @database_sync_to_async
    def save_message_to_firestore(self, sender_id, recipient_id, content):
        # Get Firestore client
        db = firestore.client()
        
        # Create a message object
        message = {
            'sender_id': sender_id,
            'recipient_id': recipient_id,
            'content': content,
            'timestamp': firestore.SERVER_TIMESTAMP,
            'read': False
        }
        
        # Get the conversation ID
        conversation_id = f"conversation_{'_'.join(sorted([sender_id, recipient_id]))}"
        
        # Add the message to Firestore
        message_ref = db.collection('private_messages').document(conversation_id).collection('messages').document()
        message_ref.set(message)
        
        # Update the conversation metadata
        conversation_ref = db.collection('private_messages').document(conversation_id)
        conversation_ref.set({
            'participants': [sender_id, recipient_id],
            'last_message': content,
            'last_message_time': firestore.SERVER_TIMESTAMP,
            'last_sender_id': sender_id,
            'unread_count_' + recipient_id: firestore.Increment(1)
        }, merge=True)
        
        return message_ref.id
    
    @database_sync_to_async
    def get_conversation_history(self):
        # Get Firestore client
        db = firestore.client()
        
        # Get messages from the conversation
        messages_ref = db.collection('private_messages').document(self.conversation_id).collection('messages')
        messages = messages_ref.order_by('timestamp').stream()
        
        # Format messages for the client
        message_list = []
        for message in messages:
            message_data = message.to_dict()
            
            # Convert Firestore timestamp to string if necessary
            timestamp = message_data.get('timestamp')
            if hasattr(timestamp, 'strftime'):
                timestamp_str = timestamp.strftime('%Y-%m-%d %H:%M:%S')
            else:
                timestamp_str = str(timestamp)
            
            message_list.append({
                'id': message.id,
                'sender_id': message_data.get('sender_id'),
                'recipient_id': message_data.get('recipient_id'),
                'content': message_data.get('content'),
                'timestamp': timestamp_str,
                'read': message_data.get('read', False)
            })
        
        return message_list