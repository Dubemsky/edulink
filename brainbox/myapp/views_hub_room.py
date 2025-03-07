import json
from .models import *
from .firebase import *
from .messages import *
from .suggestions import *
from .hub_functionality import *
from django.shortcuts import render
import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

"""
-----------------------------------------------------------------------
---------------------- HUB-ROOM SECTIONS ------------------------------
-----------------------------------------------------------------------
"""
logger = logging.getLogger(__name__)

@csrf_exempt
def get_suggestions(request):
    logger.debug("I am here")

    query = request.GET.get('query', '').strip()
    room_id = request.GET.get('room_id', '').strip()

    if not query or not room_id:
        logger.error("No query or room_id provided.")
        return JsonResponse({'error': 'No query or room_id provided'}, status=400)

    try:
        suggestions = get_similar_questions_for_room(query, room_id)

        print(f"These are the suggestions {suggestions}")

        if not suggestions:
            logger.info(f"No suggestions found for query: {query} in room: {room_id}")
            return JsonResponse({'suggestions': []})

        # Limit to 4 suggestions
        if len(suggestions) > 4:
            suggestions = suggestions[:4]

        suggestions_to_return = [{'message_id': suggestion.get('message_id'), 'question': suggestion['question']} for suggestion in suggestions]

        response_data = {'suggestions': suggestions_to_return}

        if len(suggestions) < 4:
            response_data['count'] = len(suggestions)
            logger.info(f"Fewer than 4 suggestions, returning count: {len(suggestions)}")
        else:
            logger.info(f"Returning top 4 suggestions: {suggestions_to_return}")

        print(f"\n\n\n\nI am here now {response_data}\n\n")
        return JsonResponse(response_data)

    except IndexError as e:
        logger.error(f"IndexError fetching suggestions for query: {query} in room: {room_id} - {str(e)}")
        return JsonResponse({'error': 'Internal Server Error: list index out of range'}, status=500)

    except Exception as e:
        logger.error(f"Error fetching suggestions for query: {query} in room: {room_id} - {str(e)}")
        return JsonResponse({'error': 'Internal Server Error'}, status=500)





def log_tab_click(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            tab_name = data.get('tab_name')
            room_id = data.get('roomId')
            username = data.get('username')

            print(f"Tab clicked: {tab_name} by {username} in room {room_id}")

            if tab_name == "bookmarked":
                # Fetch bookmarked messages
                bookmarks = get_bookmarked_messages(username, room_id)
                print(f"Passing {bookmarks} for {username}")
                return JsonResponse({"status": "success", "bookmarked_messages": bookmarks})

            return JsonResponse({"status": "success", "message": "Tab click logged"})
        except Exception as e:
            return JsonResponse({"status": "error", "message": str(e)})
    
    return JsonResponse({"status": "error", "message": "Invalid request method"})




def current_student_hub_room(request, id):
    try:
        # Initialize members list
        members = []
        
        try:
            members = get_members_by_hub_url(id)  
        except Exception as e:
            print(f"Error retrieving members: {e}")
        
        # Fetch messages from Firebase (or other sources if needed)
        firebase_messages = get_messages_by_room(id)

        # Get questions with their top replies
        questions_with_top_replies = get_questions_with_top_replies(id)
        print(f"Questions with Top Replies: {questions_with_top_replies}")

        current_student_name = request.session.get("students_name")

        # Prepare the messages list with necessary details
        messages_list = [
    {
        'content': message['content'],  # Original message content
        'sender': message['sender'],
        'room_id': message['room_id'],
        'role': message.get('role', 'unknown'),
        'created_at': message['timestamp'],
        'is_current_user': message['sender'] == current_student_name,
        'message_id': message['message_id'],
        'image_url': message.get('image_url'),
        'file_url': message.get('file_url'),
        'video_url': message.get('video_url'),
        'is_poll': message.get('is_poll'),
        'poll_options': message.get('poll_options'),
        'top_reply_content': next(
            (
                q['top_reply']['reply_content'] 
                for q in questions_with_top_replies 
                if q['question_id'] == message['message_id'] and q['top_reply']
            ),
            'No replies yet.'
        ),
        'top_reply_upvotes': next(
            (
                q['top_reply']['upvotes'] 
                for q in questions_with_top_replies 
                if q['question_id'] == message['message_id'] and q['top_reply']
            ),
            0
        ),
        'top_reply_downvotes': next(
            (
                q['top_reply']['downvotes'] 
                for q in questions_with_top_replies 
                if q['question_id'] == message['message_id'] and q['top_reply']
            ),
            0
        )
    }
    for message in firebase_messages
]
        print(f"This is my list {messages_list}")

        # Retrieve the hub details using the provided room_url
        hub = Teachers_created_hub.objects.get(room_url=id)

        # Pass the hub, members, and messages to the template
        return render(request, "myapp/students/students_view_hub_room.html", {
            'hub': hub,
            'room_id': id,
            'members': members,
            'messages': messages_list,
            'current_student_name': current_student_name
        })

    except Teachers_created_hub.DoesNotExist:
        print(f"No hub found with URL: {id}")
        return render(request, 'myapp/students/students_homepage.html', {'error': 'Hub not found'})
    
    except Exception as e:
        # Catch any unexpected errors
        print(f"Error: {e}")
        return render(request, 'myapp/students/students_homepage.html', {'error': 'An error occurred'})


    

def hub_room_message_student_replies(request, id, message_id):
    # Fetch the reply data from the database or whatever source you are using
    reply_data = get_message_reply_room(id, message_id)

    # Structure the data into a list of dictionaries
    structured_replies = []
    
    for reply in reply_data:
        structured_replies.append({
            'question_id': reply.get('question_id'),
            'upvotes': reply.get('upvotes'),
            'downvotes': reply.get('downvotes'),
            'sender': reply.get('sender'),
            'reply_content': reply.get('reply_content'),
            'role': reply.get('role'),
            'room_id': reply.get('room_id'),
            'timestamp': reply.get('timestamp'),
            'reply_id': reply.get('message_id')
        })
    print(f"🔹 Structured Reply Data: {structured_replies}")
    return JsonResponse(structured_replies, safe=False)








def hub_room_message_teacher_replies(request,id, message_id):
    # Fetch the reply data from the database or whatever source you are using
    reply_data = get_message_reply_room(id, message_id)

    # Structure the data into a list of dictionaries
    structured_replies = []
    
    for reply in reply_data:
        structured_replies.append({
            'question_id': reply.get('question_id'),
            'upvotes': reply.get('upvotes'),
            'downvotes': reply.get('downvotes'),
            'sender': reply.get('sender'),
            'reply_content': reply.get('reply_content'),
            'role': reply.get('role'),
            'room_id': reply.get('room_id'),
            'timestamp': reply.get('timestamp'),
            'reply_id': reply.get('message_id')
        })

    print(f"🔹 Structured Reply Data: {structured_replies}")
    return JsonResponse(structured_replies, safe=False)



def current_teacher_hub_room(request, id):
    try:
        # Get the current teacher name from the session
        current_teacher = request.session.get("teachers_name")
        
        firebase_messages = get_messages_by_room(id)
        
        # Retrieve messages asynchronously from Firebase
        questions_with_top_replies = get_questions_with_top_replies(id)
        
        # Prepare the messages list for rendering
        messages_list = [
    {
        'content': message['content'],  # Original message content
        'sender': message['sender'],
        'room_id': message['room_id'],
        'role': message.get('role', 'unknown'),
        'created_at': message['timestamp'],
        'is_current_user': message['sender'] == current_teacher,
        'message_id': message['message_id'],
        'image_url': message.get('image_url'),
        'file_url': message.get('file_url'),
        'video_url': message.get('video_url'),
        'is_poll': message.get('is_poll'),
        'poll_options': message.get('poll_options'),
        'top_reply_content': next(
            (
                q['top_reply']['reply_content'] 
                for q in questions_with_top_replies 
                if q['question_id'] == message['message_id'] and q['top_reply']
            ),
            'No replies yet.'
        ),
        'top_reply_upvotes': next(
            (
                q['top_reply']['upvotes'] 
                for q in questions_with_top_replies 
                if q['question_id'] == message['message_id'] and q['top_reply']
            ),
            0
        ),
        'top_reply_downvotes': next(
            (
                q['top_reply']['downvotes'] 
                for q in questions_with_top_replies 
                if q['question_id'] == message['message_id'] and q['top_reply']
            ),
            0
        )
    }
    for message in firebase_messages
]
        print(messages_list)

        # Render the hub page
        hub = Teachers_created_hub.objects.get(room_url=id)
        members = get_members_by_hub_url(id)

        # Send the message list as a response for the frontend to use in the AJAX request
        return render(request, "myapp/teachers/teachers_view_hub_room.html", {
            'hub': hub,
            'room_id': id,
            'members': members,
            'messages': messages_list,  # Initial set of messages for the page
            'current_teachers_name': current_teacher
        })
    
    except Exception as e:
        print(f"Error: {e}")
        return render(request, 'myapp/teachers/teachers_homepage.html', {'error_message': 'An error occurred.'})



def get_question_content(question_id):
    doc_ref = db.collection("hub_messages").document(question_id)
    # Fetch the document
    doc = doc_ref.get()
    if doc.exists:
        return doc.to_dict().get("content")  
    
    return None  #



@csrf_exempt
def bookmark_questions(request):
    try:
        data = json.loads(request.body)
        username = data.get('username')
        question_id = data.get('questionId')
        room_id = data.get('roomId')
        content = get_question_content(question_id)  # Get question content

        # Check if already bookmarked
        query = db.collection('bookmarked_questions') \
            .where('username', '==', username) \
            .where('question_id', '==', question_id) \
            .limit(1).stream()

        if list(query):
            return JsonResponse({'message': 'Already bookmarked!'})

        # Add bookmark to Firestore
        doc_ref = db.collection('bookmarked_questions').document()
        doc_ref.set({
            'username': username,
            'question_id': question_id,
            'message': content,
            'room_id': room_id,
        })

        print(f"User {username} bookmarked question {question_id} in room {room_id}")
        return JsonResponse({'message': 'Bookmark saved successfully!'})

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON data'}, status=400)
    except Exception as e:
        print(f"Error bookmarking: {e}")
        return JsonResponse({'error': 'Failed to save bookmark'}, status=500)

@csrf_exempt
def remove_bookmark_questions(request):
    try:
        data = json.loads(request.body)
        username = data.get('username')
        question_id = data.get('questionId')
        room_id = data.get('roomId')

        # Remove bookmark from Firestore
        query = db.collection('bookmarked_questions') \
            .where('username', '==', username) \
            .where('question_id', '==', question_id) \
            .where('room_id', '==', room_id).stream()

        for doc in query:
            doc.reference.delete()

        return JsonResponse({'message': 'Bookmark removed successfully!'})

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON data'}, status=400)
    except Exception as e:
        print(f"Error removing bookmark: {e}")
        return JsonResponse({'error': 'Failed to remove bookmark'}, status=500)


@csrf_exempt
def poll_voting(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            message_id = data.get('message_id')
            selected_option = data.get('selected_option')

            poll_message_ref = db.collection('hub_messages').document(message_id)
            poll_message = poll_message_ref.get().to_dict()

            if poll_message and poll_message.get('is_poll'):
                poll_options = poll_message.get('poll_options', [])
                for option in poll_options:
                    if option.get('option') == selected_option:
                        # 3. Update the Votes
                        current_votes = option.get('votes', 0)
                        option['votes'] = current_votes + 1

                        # Update Firebase
                        poll_message_ref.update({'poll_options': poll_options})

                        return JsonResponse({'success': True, 'poll_options': poll_options})

                return JsonResponse({'success': False, 'error': 'Option not found'}, status=400)
            else:
                return JsonResponse({'success': False, 'error': 'Poll message not found'}, status=404)

        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=500)
    else:
        return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=405)


def vote_reply(request):
    if request.method == "POST":
        try:
            # Get data from the request
            data = json.loads(request.body)
            reply_id = data.get("reply_id")
            vote_type = data.get("vote_type")  # "up" or "down"
            username = data.get("username")  # Get the username from the request

            # Check if the user has already voted
            user_vote_ref = db.collection('user_votes').document(f'{username}_{reply_id}')
            user_vote_doc = user_vote_ref.get()

            if user_vote_doc.exists:
                return JsonResponse({"error": "User has already voted on this reply"}, status=400)

            # Get the reply data
            reply_ref = db.collection('hub_message_reply').document(reply_id)
            reply_doc = reply_ref.get()

            if not reply_doc.exists:
                return JsonResponse({"error": "Reply not found"}, status=404)

            reply_data = reply_doc.to_dict()
            upvotes = reply_data.get('upvotes', 0)
            downvotes = reply_data.get('downvotes', 0)

            # Update the reply's vote count
            if vote_type == 'up':
                upvotes += 1
            elif vote_type == 'down':
                downvotes += 1
            else:
                return JsonResponse({"error": "Invalid vote type"}, status=400)

            # Update the reply's upvotes or downvotes in Firestore
            reply_ref.update({
                'upvotes': upvotes,
                'downvotes': downvotes
            })

            # Store the user's vote in the user_votes collection
            user_vote_ref.set({
                'username': username,
                'reply_id': reply_id,
                'vote_type': vote_type
            })

            # Return success response
            return JsonResponse({
                "message": f"Successfully {vote_type}voted the reply"
            })

        except FirebaseError as e:
            return JsonResponse({"error": f"Firebase error: {e}"}, status=500)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)




def teacher_invite_student(request):
    pass