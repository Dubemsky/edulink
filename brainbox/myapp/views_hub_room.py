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
    # Get sort parameter from request query parameters, default to 'recent'
    sort_by = request.GET.get('sort', 'recent')
    
    # Validate sort parameter
    if sort_by not in ['recent', 'top']:
        sort_by = 'recent'  # Default to recent if invalid parameter
    
    # Fetch the reply data with the sort preference
    reply_data = get_message_reply_room(id, message_id, sort_by)

    # Structure the data into a list of dictionaries
    structured_replies = []
    
    for reply in reply_data:
        structured_replies.append({
            'question_id': reply.get('question_id'),
            'upvotes': reply.get('upvotes', 0),
            'downvotes': reply.get('downvotes', 0),
            'sender': reply.get('sender'),
            'reply_content': reply.get('reply_content'),
            'role': reply.get('role'),
            'room_id': reply.get('room_id'),
            'timestamp': reply.get('timestamp'),
            'created_at': reply.get('created_at') or reply.get('timestamp'),
            'reply_id': reply.get('message_id')
        })
    return JsonResponse(structured_replies, safe=False)

def hub_room_message_teacher_replies(request, id, message_id):
    # Get sort parameter from request query parameters, default to 'recent'
    sort_by = request.GET.get('sort', 'recent')
    
    # Validate sort parameter
    if sort_by not in ['recent', 'top']:
        sort_by = 'recent'  # Default to recent if invalid parameter
    
    # Fetch the reply data with the sort preference
    reply_data = get_message_reply_room(id, message_id, sort_by)

    # Structure the data into a list of dictionaries
    structured_replies = []
    
    for reply in reply_data:
        structured_replies.append({
            'question_id': reply.get('question_id'),
            'upvotes': reply.get('upvotes', 0),
            'downvotes': reply.get('downvotes', 0),
            'sender': reply.get('sender'),
            'reply_content': reply.get('reply_content'),
            'role': reply.get('role'),
            'room_id': reply.get('room_id'),
            'timestamp': reply.get('timestamp'),
            'created_at': reply.get('created_at') or reply.get('timestamp'),
            'reply_id': reply.get('message_id')
        })

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
        
        if not all([username, question_id, room_id]):
            return JsonResponse({'error': 'Missing required parameters'}, status=400)
            
        content = get_question_content(question_id)  # Get question content

        # Check if already bookmarked
        bookmarks_ref = db.collection('bookmarked_questions')
        query = bookmarks_ref.where('username', '==', username) \
                           .where('question_id', '==', question_id)
        
        existing_bookmarks = list(query.stream())
        
        if existing_bookmarks:
            print(f"User {username} already has bookmarked question {question_id}")
            return JsonResponse({'message': 'Already bookmarked!'})

        # Add bookmark to Firestore
        bookmark_data = {
            'username': username,
            'question_id': question_id,
            'message': content,
            'room_id': room_id,
        }
        
        bookmarks_ref.add(bookmark_data)
        
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
def check_bookmark_status(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            username = data.get('username')
            question_id = data.get('questionId')
            room_id = data.get('roomId')
            
            if not all([username, question_id]):
                return JsonResponse({'error': 'Missing required parameters'}, status=400)
            
            # Check if the bookmark exists
            query = db.collection('bookmarked_questions') \
                .where('username', '==', username) \
                .where('question_id', '==', question_id) \
                .limit(1)
            
            results = list(query.stream())
            is_bookmarked = len(results) > 0
            
            return JsonResponse({
                'is_bookmarked': is_bookmarked,
                'message': 'Bookmark status checked successfully'
            })
            
        except Exception as e:
            print(f"Error checking bookmark status: {e}")
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Invalid request method'}, status=405)





# Poll voting system
@csrf_exempt
def poll_voting(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            message_id = data.get('message_id')
            selected_option = data.get('selected_option')
            username = data.get('username')
            
            if not all([message_id, selected_option, username]):
                return JsonResponse({'success': False, 'error': 'Missing required fields'}, status=400)
                
            # Reference to the poll message
            poll_message_ref = db.collection('hub_messages').document(message_id)
            
            # Check if the user has already voted in this poll
            poll_votes_ref = db.collection('poll_votes')
            user_vote_query = poll_votes_ref.where('poll_id', '==', message_id).where('username', '==', username).limit(1)
            
            user_votes = list(user_vote_query.stream())
            if user_votes:
                # User has already voted
                user_vote_data = user_votes[0].to_dict()
                return JsonResponse({
                    'success': False, 
                    'error': 'already_voted',
                    'user_vote': user_vote_data.get('selected_option')
                })
            
            # User hasn't voted yet, proceed with voting
            poll_message = poll_message_ref.get().to_dict()
            
            if poll_message and poll_message.get('is_poll'):
                poll_options = poll_message.get('poll_options', [])
                
                # Find the selected option and increment its vote count
                option_found = False
                for option in poll_options:
                    if option.get('option') == selected_option:
                        option_found = True
                        # Increment the vote count
                        current_votes = option.get('votes', 0)
                        option['votes'] = current_votes + 1
                        break
                
                if not option_found:
                    return JsonResponse({
                        'success': False, 
                        'error': 'Option not found'
                    }, status=400)
                
                # Start a transaction to update both poll and user vote record
                transaction = db.transaction()
                
                @firestore.transactional
                def update_poll_in_transaction(transaction, poll_ref, poll_options):
                    # Update the poll options in the message
                    transaction.update(poll_ref, {'poll_options': poll_options})
                    
                    # Create a record of the user's vote
                    vote_ref = poll_votes_ref.document()
                    transaction.set(vote_ref, {
                        'poll_id': message_id,
                        'username': username,
                        'selected_option': selected_option,
                    })
                    
                    return poll_options
                
                # Execute the transaction
                updated_options = update_poll_in_transaction(transaction, poll_message_ref, poll_options)
                
                return JsonResponse({
                    'success': True, 
                    'poll_options': updated_options
                })
            else:
                return JsonResponse({
                    'success': False, 
                    'error': 'Poll message not found'
                }, status=404)
                
        except Exception as e:
            print(f"Error in poll voting: {e}")
            return JsonResponse({
                'success': False, 
                'error': str(e)
            }, status=500)
    else:
        return JsonResponse({
            'success': False, 
            'error': 'Invalid request method'
        }, status=405)



@csrf_exempt
def check_poll_votes(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            username = data.get('username')
            poll_ids = data.get('poll_ids', [])
            
            if not username or not poll_ids:
                return JsonResponse({'success': False, 'error': 'Missing required parameters'}, status=400)
            
            # Reference to poll votes collection
            poll_votes_ref = db.collection('poll_votes')
            
            # Query for votes by this user in any of the specified polls
            user_votes = {}
            
            for poll_id in poll_ids:
                query = poll_votes_ref.where('poll_id', '==', poll_id).where('username', '==', username).limit(1)
                results = list(query.stream())
                
                if results:
                    vote_data = results[0].to_dict()
                    user_votes[poll_id] = {
                        'option': vote_data.get('selected_option'),
                        'timestamp': vote_data.get('timestamp')
                    }
            
            return JsonResponse({
                'success': True,
                'votes': user_votes
            })
            
        except Exception as e:
            print(f"Error checking poll votes: {e}")
            return JsonResponse({'success': False, 'error': str(e)}, status=500)
    
    return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=405)











## Voting section for reply

@csrf_exempt
def vote_reply(request):
    if request.method == "POST":
        try:
            # Get data from the request
            data = json.loads(request.body)
            reply_id = data.get("reply_id")
            vote_type = data.get("vote_type")  # "up" or "down" or null (for remove)
            username = data.get("username")
            action = data.get("action", "add")  # "add", "remove", or "change"
            old_vote = data.get("old_vote")  # Previous vote type when changing votes
            
            if not reply_id or not username:
                return JsonResponse({"success": False, "error": "Missing required parameters"}, status=400)
            
            # Reference to the reply document
            reply_ref = db.collection('hub_message_reply').document(reply_id)
            reply_doc = reply_ref.get()
            
            if not reply_doc.exists:
                return JsonResponse({"success": False, "error": "Reply not found"}, status=404)
            
            # Get current vote data
            reply_data = reply_doc.to_dict()
            upvotes = reply_data.get('upvotes', 0)
            downvotes = reply_data.get('downvotes', 0)
            
            # Reference to the user's vote document
            vote_id = f"{username}_{reply_id}"
            user_vote_ref = db.collection('user_votes').document(vote_id)
            user_vote_doc = user_vote_ref.get()
            
            # Transaction to update both the user_votes and hub_message_reply collections
            transaction = db.transaction()
            
            @firestore.transactional
            def update_in_transaction(transaction, reply_ref, user_vote_ref, user_vote_doc):
                nonlocal upvotes, downvotes
                
                # Handle different action types
                if action == "add":
                    # Adding a new vote
                    if vote_type == "up":
                        upvotes += 1
                    else:  # vote_type == "down"
                        downvotes += 1
                    
                    # Store the user's vote
                    transaction.set(user_vote_ref, {
                        'username': username,
                        'reply_id': reply_id,
                        'vote_type': vote_type
                    })
                    
                elif action == "remove":
                    # Removing an existing vote
                    if user_vote_doc.exists:
                        current_vote = user_vote_doc.to_dict().get('vote_type')
                        if current_vote == "up":
                            upvotes = max(0, upvotes - 1)  # Ensure we don't go below 0
                        else:  # current_vote == "down"
                            downvotes = max(0, downvotes - 1)
                        
                    # Delete the user's vote record
                    transaction.delete(user_vote_ref)
                    
                elif action == "change":
                    # Changing from one vote type to another
                    if old_vote == "up" and vote_type == "down":
                        # Changing from upvote to downvote
                        upvotes = max(0, upvotes - 1)
                        downvotes += 1
                    elif old_vote == "down" and vote_type == "up":
                        # Changing from downvote to upvote
                        downvotes = max(0, downvotes - 1)
                        upvotes += 1
                    
                    # Update the user's vote
                    transaction.set(user_vote_ref, {
                        'username': username,
                        'reply_id': reply_id,
                        'vote_type': vote_type
                    })
                
                # Update the reply with new vote counts
                transaction.update(reply_ref, {
                    'upvotes': upvotes,
                    'downvotes': downvotes
                })
                
                return upvotes - downvotes  # Return the new net vote count
            
            # Execute the transaction
            new_net_count = update_in_transaction(transaction, reply_ref, user_vote_ref, user_vote_doc)
            
            # Return success response with the new vote count
            return JsonResponse({
                "success": True,
                "message": "Vote updated successfully",
                "newCount": new_net_count
            })
            
        except Exception as e:
            print(f"Error updating vote: {e}")
            return JsonResponse({"success": False, "error": str(e)}, status=500)
    
    return JsonResponse({"success": False, "error": "Invalid request method"}, status=405)

@csrf_exempt
def get_user_votes(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            username = data.get("username")
            reply_ids = data.get("reply_ids", [])
            
            if not username or not reply_ids:
                return JsonResponse({"success": False, "error": "Missing required parameters"}, status=400)
            
            votes = {}
            
            # Fetch all votes for this user and these replies
            for reply_id in reply_ids:
                vote_id = f"{username}_{reply_id}"
                user_vote_doc = db.collection('user_votes').document(vote_id).get()
                
                if user_vote_doc.exists:
                    vote_data = user_vote_doc.to_dict()
                    votes[reply_id] = vote_data.get('vote_type')
            
            return JsonResponse({
                "success": True,
                "votes": votes
            })
            
        except Exception as e:
            print(f"Error fetching user votes: {e}")
            return JsonResponse({"success": False, "error": str(e)}, status=500)
    
    return JsonResponse({"success": False, "error": "Invalid request method"}, status=405)



def teacher_invite_student(request):
    pass