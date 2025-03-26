from .firebase import *
from datetime import datetime
import pytz
from .faiss import *
import numpy as np
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .encryption import encryption_manager

def add_message(role, room_id, sender, content, message_type="text", file_url=None, video_url=None, image_url=None, poll_options=None):
    try:
        now_utc = datetime.now(pytz.utc).strftime('%Y-%m-%d %H:%M:%S')


        # Get embedding from original content before encryption
        embedding = get_remote_embedding(content)
        print(f"These are the embeddings {embedding}")

        # Encrypt the content
        encrypted_content = encryption_manager.encrypt(content)

        message_data = {
            'role': role,
            'room_id': room_id,
            'sender': sender,
            'content': encrypted_content,  # Store encrypted content
            "embedding": embedding,
            'message_type': message_type,
            'timestamp': now_utc
        }

        # Handle different message types with encryption where needed
        if message_type == "file":
            message_data['file_url'] = file_url
        elif message_type == "video":
            message_data['video_url'] = video_url
        elif message_type == "image": 
            message_data['image_url'] = image_url 
        elif message_type == "poll":
            message_data['is_poll'] = True
            # Encrypt each poll option
            encrypted_poll_options = []
            for option in poll_options:
                encrypted_poll_options.append({
                    'option': encryption_manager.encrypt(option),
                    'votes': 0
                })
            message_data['poll_options'] = encrypted_poll_options

        message_ref = db.collection('hub_messages').add(message_data)

        faiss_index.add(np.array([embedding], dtype=np.float32))  # Adding the embedding to FAISS

        message_id = message_ref[1].id

        print(f"✅ New {message_type} message added with ID: {message_id}")
        
        return message_id
    except Exception as e:
        print(f"❌ Error adding message: {e}")
        return None
    
def add_message_reply(role, room_id, sender, reply_content, message_type, upvotes, downvotes, question_id):
    now_utc = datetime.now(pytz.utc).strftime('%Y-%m-%d %H:%M:%S')

    # Encrypt the reply content
    encrypted_reply_content = encryption_manager.encrypt(reply_content)

    message_data = {
        'question_id': question_id,
        'room_id': room_id,
        'sender': sender,
        'role': role,
        'reply_content': encrypted_reply_content,  # Store encrypted reply content
        'message_type': message_type,
        'upvotes': upvotes,
        'downvotes': downvotes,
        'timestamp': now_utc
    }

    message_ref = db.collection('hub_message_reply').add(message_data)
    message_id = message_ref[1].id

    print(f"✅ New {message_type} reply added with ID: {message_id}")

    notifications_for_bookmarked_questions(question_id, room_id, sender)
    return message_id

def user_name(request):
    current_student = request.session.get("students_name")
    current_teacher = request.session.get("teachers_name")
    return [current_student, current_teacher]

def notifications_for_bookmarked_questions(question_id, room_id, sender):
    """
    Fetch users who bookmarked a question, print notifications, 
    then add them to Firebase, but don't notify the sender.
    """
    bookmarks_ref = db.collection("bookmarked_questions")
    bookmarked_users = bookmarks_ref.stream()
    for user_doc in bookmarked_users:
        user_data = user_doc.to_dict()

        if user_data.get("question_id") == question_id:
            username = user_data.get("username")

            # Check if the sender is the same as the bookmarked user
            if sender != username:  # This is the important change!
                notification_data = {
                    "question_id": question_id,
                    "message": encryption_manager.encrypt(f"{sender} replied on your bookmark. Click to view"),
                    "username": username,
                    "room_id": room_id,
                    "timestamp": datetime.utcnow(),
                }

                print(f"\n\n📢 New Notification for {username}: {notification_data}\n\n")

                notifications_ref = db.collection("notifications")
                notifications_ref.add(notification_data)

                print("Notification added to Firebase.")
            else:
                print(f"Skipping notification for {username} because it's the sender.")

def get_notifications_by_username(username):
    """
    Retrieve notifications for a specific user from Firebase, including livestreams.
    """
    notifications_ref = db.collection("notifications")
    query = notifications_ref.where("username", "==", username)
    notifications_list = []  # Use a list to store all notifications

    notifications = query.stream()

    for notification in notifications:
        notification_data = notification.to_dict()

        # Decrypt the message
        encrypted_message = notification_data.get("message")
        decrypted_message = encryption_manager.decrypt(encrypted_message)

        # Common notification structure
        notification_item = {
            "notification_id": notification.id,
            "question_id": notification_data.get("question_id"),
            "message": decrypted_message,
            "username": notification_data.get("username"),
            "room_id": notification_data.get("room_id"),
            "timestamp": notification_data.get("timestamp"),
            "type": notification_data.get("type"),
        }

        # Check if it's a livestream and add livestream-specific details
        if notification_data.get("type") == "livestream":
            s = str(notification_data.get("content"),)
            result = s.split(" for ")[0]
            
            notification_item.update({
                "livestream_id": notification_data.get("livestream_id"),
                "message": result,
                "timestamp": notification_data.get("created_at"),
                "read": notification_data.get("read"),
            })
            
        elif notification_data.get("type") == "room_invite":
            notification_item.update({
                "room_name": notification_data.get("room_name"),
                "sender": notification_data.get("sender"),
                "status": notification_data.get("status", "pending"),
            })

        # Append the notification data to the list
        notifications_list.append(notification_item)

    return notifications_list  # Return the list of notifications


@csrf_exempt
def mark_notification_read(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            notification_id = data.get('notification_id')
            print("I am here now")
            
            # Delete the notification from Firebase
            if notification_id:
                db.collection('notifications').document(notification_id).delete()
                return JsonResponse({'success': True, 'message': 'Notification marked as read'})
            else:
                return JsonResponse({'success': False, 'error': 'Notification ID is required'}, status=400)
                
        except Exception as e:
            print(f"Error marking notification as read: {e}")
            return JsonResponse({'success': False, 'error': str(e)}, status=500)
    
    return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=405)

def get_messages_by_room(room_id):
    try:
        messages_ref = db.collection('hub_messages')
        # Query messages for the specified room, ordered by timestamp
        query = messages_ref.where('room_id', '==', room_id).order_by('timestamp')
        docs = query.stream()

        messages = []
        for doc in docs:
            message = doc.to_dict()

            # Add the document ID to the message dictionary
            message['message_id'] = doc.id

            # Decrypt the content
            encrypted_content = message.get('content')
            if encrypted_content:
                message['content'] = encryption_manager.decrypt(encrypted_content)
            
            # Decrypt poll options if present
            if message.get('is_poll') and message.get('poll_options'):
                decrypted_poll_options = []
                for option in message.get('poll_options', []):
                    decrypted_option = {
                        'option': encryption_manager.decrypt(option.get('option')),
                        'votes': option.get('votes', 0)
                    }
                    decrypted_poll_options.append(decrypted_option)
                message['poll_options'] = decrypted_poll_options

            timestamp = message.get('timestamp', None)
            if isinstance(timestamp, str):  
                timestamp = datetime.strptime(timestamp, '%Y-%m-%d %H:%M:%S')
                message['timestamp'] = timestamp.strftime('%H:%M')
            else:
                message['timestamp'] = "Unknown"

            messages.append(message)

        return messages

    except Exception as e:
        print(f"Error retrieving messages: {e}")
        return []
    
def get_questions_with_top_replies(room_id):
    try:
        # Step 1: Get all questions for the specified room
        messages_ref = db.collection('hub_messages').where('room_id', '==', room_id).order_by('timestamp')
        questions = list(messages_ref.stream())

        if not questions:
            return []

        # Step 2: Fetch all replies for the room in one go to reduce Firestore calls
        replies_ref = db.collection('hub_message_reply').where('room_id', '==', room_id)
        all_replies = list(replies_ref.stream())

        # Group replies by question_id for quick lookup
        replies_by_question = {}
        for reply in all_replies:
            reply_data = reply.to_dict()
            question_id = reply_data.get('question_id')
            if question_id:
                replies_by_question.setdefault(question_id, []).append(reply_data)

        questions_with_replies = []

        for question in questions:
            question_data = question.to_dict()
            question_id = question.id

            # Decrypt the question content
            encrypted_content = question_data.get('content')
            decrypted_content = encryption_manager.decrypt(encrypted_content) if encrypted_content else 'No content'

            # Step 3: Find the top reply for this question (if any)
            top_reply = None
            if question_id in replies_by_question:
                top_reply = max(
                    replies_by_question[question_id],
                    key=lambda r: r.get('upvotes', 0) - r.get('downvotes', 0),
                    default=None
                )

                if top_reply:
                    # Decrypt the reply content
                    encrypted_reply = top_reply.get('reply_content')
                    if encrypted_reply:
                        top_reply['reply_content'] = encryption_manager.decrypt(encrypted_reply)
                    
                    top_reply['net_votes'] = top_reply.get('upvotes', 0) - top_reply.get('downvotes', 0)

            # Step 4: Append question with top reply
            questions_with_replies.append({
                'question_id': question_id,
                'question_text': decrypted_content,
                'created_at': question_data.get('timestamp'),
                'top_reply': top_reply  # None if no replies
            })

        return questions_with_replies

    except Exception as e:
        print(f"Error retrieving questions and replies: {e}")
        return []

def get_message_reply_room(room_id, question_id, sort_by='recent'):
    """
    Retrieve all replies for a specific room and question from Firestore,
    ordered by either 'recent' (timestamp, newest first) or 'top' (net votes).
    
    Args:
        room_id: The ID of the room
        question_id: The ID of the question
        sort_by: Sorting method - 'recent' (default) or 'top'
    """
    try:
        replies_ref = db.collection('hub_message_reply')

        query = (replies_ref
                 .where('room_id', '==', room_id)
                 .where('question_id', '==', question_id)
        )

        results = query.stream()

        # Store all replies
        reply_list = []
        for reply in results:
            reply_data = reply.to_dict()
            reply_data['message_id'] = reply.id
            
            # Decrypt the reply content
            encrypted_reply = reply_data.get('reply_content')
            if encrypted_reply:
                reply_data['reply_content'] = encryption_manager.decrypt(encrypted_reply)
            
            # Ensure upvotes and downvotes are properly initialized
            upvotes = reply_data.get('upvotes', 0)
            downvotes = reply_data.get('downvotes', 0)
            reply_data['net_votes'] = upvotes - downvotes
            
            # Ensure timestamp is available (use created_at if timestamp missing)
            if 'timestamp' not in reply_data and 'created_at' in reply_data:
                reply_data['timestamp'] = reply_data['created_at']
            elif 'timestamp' not in reply_data:
                # If no timestamp found, use a default distant past time
                reply_data['timestamp'] = "1970-01-01T00:00:00Z"
                
            reply_list.append(reply_data)

        # Sort replies based on sort_by parameter
        if sort_by == 'recent':
            # Sort by timestamp in descending order (newest first)
            sorted_replies = sorted(reply_list, 
                                    key=lambda x: x.get('timestamp', "1970-01-01T00:00:00Z"), 
                                    reverse=True)
        else:  # sort_by == 'top'
            # Sort by net_votes in descending order
            sorted_replies = sorted(reply_list, 
                                    key=lambda x: x.get('net_votes', 0), 
                                    reverse=True)

        return sorted_replies

    except Exception as e:
        print(f"Error retrieving message replies: {e}")
        return []