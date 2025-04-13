import json
from datetime import datetime
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .messages import *
from django.core.files.base import ContentFile
from .firebase import *
import base64

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_name = self.scope['url_route']['kwargs']['room_name']
        self.room_group_name = f"hub_room_{self.room_name}"

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )



    async def receive(self, text_data):
        try:
            try:
                data_json = json.loads(text_data)
            except json.JSONDecodeError as e:
                await self.send(json.dumps({"error": "Invalid JSON format"}))
                return

            required_fields = {"message", "role", "room_url", "sender"}
            missing_fields = required_fields - data_json.keys()
            print(f"\n\n\nMissing fields: {missing_fields}")

            if missing_fields:
                await self.send(json.dumps({
                    "error": f"Missing required fields: {', '.join(missing_fields)}"
                }))
                return
            attached_message = data_json.get("message", "No message provided")
            print(f"This is the attached message that im always sending {attached_message}")

            if data_json.get("file"):
                file_name = data_json.get("file_name", "Unknown")
                file_type = data_json.get("file_type", "Unknown")
                is_image = data_json.get("is_image", False)
                is_poll = data_json.get("is_poll",False)
                is_video = data_json.get("is_video", False)
                sender = data_json.get("sender")
                file_data = data_json.get("file")


                if is_image:
                    print("\n\nThis is an image")
                    file_size = len(file_data)
                    print(f"File Size (in bytes): {file_size}")

                    try:
                        # Convert base64 string to file
                        image_data = base64.b64decode(file_data)
                        image_file = ContentFile(image_data, name=file_name)
                        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                        firebase_filename = f"hub_images/{sender}/{timestamp}_{file_name}"

                        # Upload to Firebase Storage
                        blob = storage.bucket().blob(firebase_filename)
                        blob.upload_from_file(image_file, content_type=file_type)
                        blob.make_public()
                        image_url = blob.public_url
                        
                        data_json["message_type"] = "image"
                        data_json["image_url"] = image_url
                        saved_message = await self.create_message(data_json, False, None,attached_message) 

                        if saved_message:
                            saved_message["image_url"] = image_url 

                            await self.channel_layer.group_send(
                                self.room_group_name,
                                {
                                    'type': 'send_message',
                                    'message': saved_message,
                                    'is_reply': False,
                                }
                            )
                        else:
                            print("❌ Error: Image message could not be saved.")

                    except Exception as upload_error:
                        print(f"Image upload error: {upload_error}")
                        await self.send(json.dumps({"error": "Image upload failed"}))


                elif is_poll:
                    data_json["message_type"] = "poll"
                    data_json["is_poll"] = True
                    saved_message = await self.create_message(data_json, False, None,attached_message) 
                    if saved_message: 
                        saved_message["is_poll"] = True
                        await self.channel_layer.group_send(
                            self.room_group_name,
                            {
                                'type': 'send_message',
                                'message': saved_message,
                                'is_reply': False,
                            }
                        )
                    else:
                        print("❌ Error: Image message could not be saved.")
                    


                elif is_video:
                    print("\n\nThis is a video")
                    file_size = len(data_json.get("file", ""))
                    print(f"File Size (in bytes): {file_size}")

                    try:
                        video_data = base64.b64decode(file_data)
                        video_file = ContentFile(video_data, name=file_name)
                        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                        firebase_filename = f"hub_videos/{sender}/{timestamp}_{file_name}"

                        blob = storage.bucket().blob(firebase_filename)
                        blob.upload_from_file(video_file, content_type=file_type)
                        blob.make_public()
                        video_url = blob.public_url

                        data_json["message_type"] = "video" #Change the message type
                        data_json["video_url"] = video_url #change the URL key

                        saved_message = await self.create_message(data_json, False, None, attached_message)

                        if saved_message:
                            saved_message["video_url"] = video_url

                            await self.channel_layer.group_send(
                                self.room_group_name,
                                {
                                    'type': 'send_message',
                                    'message': saved_message,
                                    'is_reply': False,
                                }
                            )
                        else:
                            print("❌ Error: Video message could not be saved.")

                    except Exception as upload_error:
                        print(f"Video upload error: {upload_error}")
                        await self.send(json.dumps({"error": "Video upload failed"}))
                    
                else: # this is for other files.
                    print("\n\nThis is a file")
                    file_size = len(data_json.get("file", ""))
                    print(f"File Size (in bytes): {file_size}")

                    try:
                        file_data_decoded = base64.b64decode(file_data)
                        file_content = ContentFile(file_data_decoded, name=file_name)
                        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                        firebase_filename = f"hub_files/{sender}/{timestamp}_{file_name}"

                        blob = storage.bucket().blob(firebase_filename)
                        blob.upload_from_file(file_content, content_type=file_type)
                        blob.make_public()
                        file_url = blob.public_url

                        data_json["message_type"] = "file"
                        data_json["file_url"] = file_url

                        saved_message = await self.create_message(data_json, False, None, attached_message)

                        if saved_message:
                            saved_message["file_url"] = file_url


                            await self.channel_layer.group_send(
                                self.room_group_name,
                                {
                                    'type': 'send_message',
                                    'message': saved_message,
                                    'is_reply': False,
                                }
                            )
                        else:
                            print("❌ Error: File message could not be saved.")

                    except Exception as upload_error:
                        print(f"File upload error: {upload_error}")
                        await self.send(json.dumps({"error": "File upload failed"}))


            else:
                # This is a text message
                is_reply = data_json.get("reply", False)
                question_id = data_json.get("question_id") if is_reply else None

                # Create and save the message
                saved_message = await self.create_message(data_json, is_reply, question_id,attached_message)
                if saved_message:
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'send_message',
                            'message': saved_message,
                            'is_reply': is_reply,
                        }
                    )
                else:
                    print("❌ Error: Message could not be saved.")

        except Exception as e:
            print(f"❌ General error processing message: {e}")


    async def send_message(self, event):
        await self.send(json.dumps({
            "message": event["message"],
            "message_type": "reply" if event.get("is_reply", False) else "message"
        }))

        
    @database_sync_to_async
    def create_message(self, data, is_reply, question_id, attached_message):
        try:
            if is_reply and question_id:
                message_id = add_message_reply(
                    data['role'], data['room_url'], data['sender'], attached_message,
                    data.get('message_type', "text"), data.get('upvotes', 0), data.get('downvotes', 0), question_id
                )

                return {
                    "reply_id": message_id,
                    "role": data["role"],
                    "room_url": data["room_url"],
                    "sender": data["sender"],
                    "message": attached_message,  # Use attached_message
                    "created_at": datetime.now().isoformat(),
                    "message_type": data.get('message_type', "text"),
                    "upvotes": data.get('upvotes', 0),
                    "downvotes": data.get('downvotes', 0),
                    "question_id": question_id
                }

            else: # This is a question 
                if 'image_url' in data:
                    message_id = add_message(
                        data['role'], data['room_url'], data['sender'],
                        attached_message, data.get('message_type', "text"), image_url=data['image_url']
                    )

                elif 'file_url' in data:
                    message_id = add_message(
                        data['role'], data['room_url'], data['sender'],
                        attached_message, data.get('message_type', "text"), file_url=data['file_url']
                    )
                elif 'video_url' in data:
                    message_id = add_message(
                        data['role'], data['room_url'], data['sender'],
                        attached_message, data.get('message_type', "text"), video_url=data['video_url']
                    )
                elif 'is_poll' in data:
                    message_id = add_message(
                        data['role'], data['room_url'], data['sender'],
                        attached_message, data.get('message_type', "poll"), poll_options=data.get('poll_options', [])
                    )

                    # Returning the poll options along with other message details
                    return {
                        "message_id": message_id,
                        "role": data["role"],
                        "room_url": data["room_url"],
                        "sender": data["sender"],
                        "message": attached_message,
                        "created_at": datetime.now().isoformat(),
                        "message_type": data.get('message_type', "poll"),
                        "poll_options": data.get('poll_options', [])  
                    }

                else:
                    message_id = add_message(
                        data['role'], data['room_url'], data['sender'],
                        attached_message, data.get('message_type', "text")
                    )

                return {
                    "message_id": message_id,
                    "role": data["role"],
                    "room_url": data["room_url"],
                    "sender": data["sender"],
                    "message": attached_message,  # Consistent usage
                    "created_at": datetime.now().isoformat(),
                    "message_type": data.get('message_type', "text"),
                }

        except Exception as e:
            print(f"❌ Error creating message: {e}")
            return None
