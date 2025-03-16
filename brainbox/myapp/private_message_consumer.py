# direct_messaging_consumer.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from datetime import datetime
import pytz
from django.contrib.sessions.models import Session
import asyncio
from firebase_admin import firestore
from .encryption import encryption_manager
from .private_messages import *


class DirectChatConsumer(AsyncWebsocketConsumer):
    async def connect(self,request):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'chat_{self.room_id}'

        # Extract user IDs from the room ID
        parts = self.room_id.split('_')
        if len(parts) < 3 or parts[0] != 'direct':
            await self.close()
            return

        # Get current user from Django session
        self.user_id = await self.get_user_id_from_session(request)
        if not self.user_id:
            await self.close()
            return

        # Extract participant IDs and verify current user is a participant
        user1_id = parts[1]
        user2_id = parts[2]
        if self.user_id != user1_id and self.user_id != user2_id:
            await self.close()
            return

        # The other user ID is the recipient
        self.recipient_id = user2_id if self.user_id == user1_id else user1_id

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

        # Mark messages as read when connecting
        await self.mark_messages_as_read()

        # Update user's online status
        await self.update_user_online_status(self.user_id)

        # Start listening for real-time updates
        self.listen_task = asyncio.create_task(self.listen_for_updates())

    async def disconnect(self, close_code):
        # Cancel update listener
        if hasattr(self, 'listen_task') and not self.listen_task.done():
            self.listen_task.cancel()
            try:
                await self.listen_task
            except asyncio.CancelledError:
                pass

        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get('type')

            if message_type == 'chat_message':
                content = text_data_json.get('message')
                temp_id = text_data_json.get('temp_id')
                
                if not content:
                    return

                # Save message to database
                message_data = await self.save_message_to_db(content, temp_id)
                
                if not message_data['success']:
                    # Send error back to sender
                    await self.send(text_data=json.dumps({
                        'type': 'error',
                        'error': message_data['error'],
                        'temp_id': temp_id
                    }))
                    return

                # Send message to room group
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_message',
                        'message': {
                            'content': content,
                            'sender_id': self.user_id,
                            'timestamp': message_data['timestamp'],
                            'message_id': message_data['message_id'],
                            'temp_id': temp_id
                        }
                    }
                )

            elif message_type == 'mark_read':
                # Mark messages as read
                await self.mark_messages_as_read()
                
                # Notify other users that messages were read
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'messages_read',
                        'user_id': self.user_id
                    }
                )
                
            elif message_type == 'typing':
                # Forward typing indicator to other users
                is_typing = text_data_json.get('is_typing', False)
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'typing_indicator',
                        'user_id': self.user_id,
                        'is_typing': is_typing
                    }
                )

        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'error': 'Invalid JSON'
            }))
        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'error': str(e)
            }))

    # Receive message from room group
    async def chat_message(self, event):
        message = event['message']
        
        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': message
        }))

    # Receive typing indicator from room group
    async def typing_indicator(self, event):
        # Send typing indicator to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'typing_indicator',
            'user_id': event['user_id'],
            'is_typing': event['is_typing']
        }))

    # Receive messages read event
    async def messages_read(self, event):
        # Send messages read event to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'messages_read',
            'user_id': event['user_id']
        }))

    # Database helper methods
    @database_sync_to_async
    def get_user_id_from_session(self,request):
        from .firebase import get_teacher_user_id, get_student_user_id

        print("This is the current user")

        student_id = get_student_user_id(request)
        teacher_id = get_teacher_user_id(request)

        if student_id:
            print(student_id)
        elif teacher_id:
            print(teacher_id)

        try:

            if 'session' not in self.scope:
                print("No session in scope")
                return None
                
            session = self.scope['session']
            if not session:
                print("Empty session")
                return None
                
            # Try to get user ID from session
            return get_current_user_id(session)
        except Exception as e:
            print(f"Error getting user from session: {str(e)}")
            return None
        



async def connect(self,request):
    self.room_id = self.scope['url_route']['kwargs']['room_id']
    self.room_group_name = f'chat_{self.room_id}'

    # Get current user from Django session
    self.user_id = await self.get_user_id_from_session(request)
    if not self.user_id:
        print("No user_id found in session")
        await self.close()
        return

    # Extract participant IDs from the room ID
    parts = self.room_id.split('_')
    if len(parts) < 3 or parts[0] != 'direct':
        print("Invalid room ID format")
        await self.close()
        return

    # Verify current user is a participant
    user1_id = parts[1]
    user2_id = parts[2]
    if self.user_id != user1_id and self.user_id != user2_id:
        print("User not authorized for this chat")
        await self.close()
        return

    # The other user ID is the recipient
    self.recipient_id = user2_id if self.user_id == user1_id else user1_id

    # Join room group
    await self.channel_layer.group_add(
        self.room_group_name,
        self.channel_name
    )

    await self.accept()

    # Mark messages as read when connecting
    await self.mark_messages_as_read()

    # Update user's online status
    await self.update_user_online_status(self.user_id)

    # Start listening for real-time updates
    self.listen_task = asyncio.create_task(self.listen_for_updates())

    @database_sync_to_async
    def save_message_to_db(self, content, temp_id=None):
        """Save message to database"""
        try:
            # Send the message
            result = send_direct_message(
                self.user_id, 
                self.recipient_id, 
                content
            )
            
            if result['success']:
                return {
                    'success': True,
                    'message_id': result['message_id'],
                    'timestamp': result['timestamp']
                }
            else:
                return {
                    'success': False,
                    'error': result.get('error', 'Failed to send message')
                }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    @database_sync_to_async
    def mark_messages_as_read(self):
        """Mark all messages in this chat as read"""
        return mark_direct_chat_as_read(self.room_id, self.user_id)

    @database_sync_to_async
    def update_user_online_status(self, user_id):
        """Update user's online status"""
        return update_user_online_status(user_id)

    async def listen_for_updates(self):
        """Listen for real-time updates in the chat"""
        from firebase_admin import db
        import time
        
        try:
            # Firestore doesn't have async listeners in the Python SDK
            # So we periodically check for updates
            while True:
                await asyncio.sleep(3)  # Check every 3 seconds
                
                # Check for new messages
                new_messages = await self.check_for_new_messages()
                
                # Check for online status changes
                await self.check_online_status()
                
                # Update read status periodically
                await self.mark_messages_as_read()
        except asyncio.CancelledError:
            # Task was cancelled, clean up
            pass
        except Exception as e:
            # Log error but don't crash the task
            print(f"Error in message listener: {e}")
    
    @database_sync_to_async
    def check_for_new_messages(self):
        """Check for new messages in Firestore"""
        # This would be implemented with Firestore listeners in a production app
        # For simplicity, we're just using the WebSocket message handling
        return []
    
    @database_sync_to_async
    def check_online_status(self):
        """Check for online status changes of the other user"""
        is_online = is_user_online(self.recipient_id)
        
        # Send online status update
        asyncio.create_task(self.send(text_data=json.dumps({
            'type': 'online_status',
            'user_id': self.recipient_id,
            'is_online': is_online
        })))
        
        return is_online