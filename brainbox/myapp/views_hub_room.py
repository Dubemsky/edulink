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
from .encryption import encryption_manager

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
                'content': message['content'],  # Content already decrypted in get_messages_by_room
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
                'poll_options': message.get('poll_options'),  # Poll options already decrypted in get_messages_by_room
                'top_reply_content': next(
                    (
                        q['top_reply']['reply_content']  # Reply content already decrypted in get_questions_with_top_replies
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
    # Replies are decrypted in get_message_reply_room
    reply_data = get_message_reply_room(id, message_id, sort_by)

    # Structure the data into a list of dictionaries
    structured_replies = []
    
    for reply in reply_data:
        structured_replies.append({
            'question_id': reply.get('question_id'),
            'upvotes': reply.get('upvotes', 0),
            'downvotes': reply.get('downvotes', 0),
            'sender': reply.get('sender'),
            'reply_content': reply.get('reply_content'),  # Already decrypted
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
            'reply_content': reply.get('reply_content'),  # Already decrypted
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
                'content': message['content'],  # Content already decrypted in get_messages_by_room
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
                'poll_options': message.get('poll_options'),  # Poll options already decrypted in get_messages_by_room
                'top_reply_content': next(
                    (
                        q['top_reply']['reply_content']  # Reply content already decrypted in get_questions_with_top_replies
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
        privacy_setting = hub.hub_privacy_setting
        print(f"These are the details {hub} : {privacy_setting}\n\n")
        members = get_members_by_hub_url(id)

        # Send the message list as a response for the frontend to use in the AJAX request
        return render(request, "myapp/teachers/teachers_view_hub_room.html", {
            'hub': hub,
            'privacy_setting' : privacy_setting,
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
        encrypted_content = doc.to_dict().get("content")
        if encrypted_content:
            return encryption_manager.decrypt(encrypted_content)
    
    return None  # Return None if document doesn't exist or no content



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
                print(f"Error 1 in poll voting:")
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

                print(f" These are the option {poll_options}")


                # Find the selected option and increment its vote count
                option_found = False
                for option in poll_options:
                    
                    if encryption_manager.decrypt(option.get('option') ) == selected_option:
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





def get_filtered_content(request):
    """API endpoint to get filtered content for the hub resources based on filter type"""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=405)
    
    try:
        # Get the room ID and filter type from query parameters
        room_id = request.GET.get('room_id')
        filter_type = request.GET.get('filter_type', 'text')  # Default to 'text' instead of 'all'
        
        if not room_id:
            return JsonResponse({'success': False, 'error': 'Room ID is required'}, status=400)
        
        # Reference to the messages collection
        messages_ref = db.collection('hub_messages')
        
        # Apply filters based on filter_type
        if filter_type == 'text':
            # For 'text', get messages with message_type 'text'
            query = messages_ref.where('room_id', '==', room_id).where('message_type', '==', 'text')
            docs = query.stream()
        elif filter_type == 'docs':
            # Filter for documents (files)
            query = messages_ref.where('room_id', '==', room_id).where('message_type', '==', 'file')
            docs = query.stream()
        elif filter_type == 'media':
            # For media, we need to make multiple queries since we can't do OR conditions in Firestore
            image_query = messages_ref.where('room_id', '==', room_id).where('message_type', '==', 'image')
            video_query = messages_ref.where('room_id', '==', room_id).where('message_type', '==', 'video')
            
            # Execute both queries
            image_docs = list(image_query.stream())
            video_docs = list(video_query.stream())
            
            # Combine results
            docs = image_docs + video_docs
        elif filter_type == 'polls':
            # Filter for polls
            query = messages_ref.where('room_id', '==', room_id).where('is_poll', '==', True)
            docs = query.stream()
        else:
            # Default case for unknown filter types - return text messages
            query = messages_ref.where('room_id', '==', room_id).where('message_type', '==', 'text')
            docs = query.stream()
        
        # Process the results
        messages = []
        for doc in docs:
            message = doc.to_dict()
            
            # Remove embedding field to reduce payload size
            if 'embedding' in message:
                del message['embedding']
            
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
            
            # Format timestamp
            timestamp = message.get('timestamp', None)
            if isinstance(timestamp, str):  
                timestamp = datetime.strptime(timestamp, '%Y-%m-%d %H:%M:%S')
                message['timestamp'] = timestamp.strftime('%H:%M')
            else:
                message['timestamp'] = "Unknown"
            
            messages.append(message)
        
        return JsonResponse({
            'success': True,
            'messages': messages,
            'filter_type': filter_type
        }, safe=False)
        
    except Exception as e:
        print(f"Error getting filtered content: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)






## Voting section for reply

@csrf_exempt
def vote_reply(request):
    if request.method == "POST":
        print(" \n\n\nI am here")
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

# Add to views_hub_room.py



# Add to views_hub_room.py
@csrf_exempt
def respond_to_invitation(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            notification_id = data.get("notification_id")
            response = data.get("response")  # "accept" or "reject"
            
            if not notification_id or not response:
                return JsonResponse({"success": False, "error": "Missing required parameters"}, status=400)
            
            # Get the current student from session
            student_name = request.session.get("students_name")
            if not student_name:
                return JsonResponse({"success": False, "error": "Not logged in as a student"}, status=401)
            
            # Get the notification details
            notification_ref = db.collection("notifications").document(notification_id)
            notification = notification_ref.get()
            
            if not notification.exists:
                return JsonResponse({"success": False, "error": "Notification not found"}, status=404)
                
            notification_data = notification.to_dict()
            
            # Verify this notification is for the current student
            if notification_data.get("username") != student_name:
                return JsonResponse({"success": False, "error": "This notification is not for you"}, status=403)
                
            # Get room details
            room_id = notification_data.get("room_id")
            room_name = notification_data.get("room_name")
            
            if response == "accept":
                try:
                    # Get the room details
                    room = Teachers_created_hub.objects.get(room_url=room_id)
                    
                    # Check if student is already a member
                    if Students_joined_hub.objects.filter(student=student_name, hub=room).exists():
                        # Mark notification as read even if already a member
                        notification_ref.delete()
                        return JsonResponse({
                            "success": True, 
                            "message": "You are already a member of this room",
                            "room_url": f"/students-dashboard/hub-room/{room_id}/"
                        })
                    
                    # Add student to the room
                    new_member = Students_joined_hub(
                        student=student_name,
                        hub=room,
                        hub_owner=room.hub_owner,
                        hub_url=room_id
                    )
                    new_member.save()
                    
                    # Delete the notification
                    notification_ref.delete()
                    
                    return JsonResponse({
                        "success": True,
                        "message": f"You have joined {room_name}",
                        "room_url": f"/students-dashboard/hub-room/{room_id}/"
                    })
                    
                except Teachers_created_hub.DoesNotExist:
                    return JsonResponse({"success": False, "error": "Room not found"}, status=404)
                except Exception as e:
                    print(f"Error accepting invite: {e}")
                    return JsonResponse({"success": False, "error": str(e)}, status=500)
                    
            elif response == "reject":
                # Delete the notification
                notification_ref.delete()
                
                return JsonResponse({
                    "success": True,
                    "message": f"You have declined the invitation to {room_name}"
                })
                
            else:
                return JsonResponse({"success": False, "error": "Invalid response"}, status=400)
                
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "error": "Invalid JSON"}, status=400)
        except Exception as e:
            print(f"Error responding to invite: {e}")
            return JsonResponse({"success": False, "error": str(e)}, status=500)
            
    return JsonResponse({"success": False, "error": "Invalid request method"}, status=405)

# Updated backend function to support inviting by name

@csrf_exempt
def send_invite(request):
    if request.method == "POST":
        print("\n\n===== SENDING INVITE =====")
        try:
            data = json.loads(request.body)
            student_name = data.get("student_name")
            student_email = data.get("student_email")  # This is optional now
            room_id = data.get("room_id")
            teacher_name = request.session.get("teachers_name")
            
            print(f"Student name: {student_name}")
            print(f"Student email: {student_email}")
            print(f"Room ID: {room_id}")
            print(f"Teacher name from session: {teacher_name}")
            
            if not all([student_name, room_id, teacher_name]):
                missing = []
                if not student_name: missing.append("student_name")
                if not room_id: missing.append("room_id")
                if not teacher_name: missing.append("teacher_name")
                print(f"Missing required parameters: {', '.join(missing)}")
                return JsonResponse({"success": False, "error": f"Missing required parameters: {', '.join(missing)}"}, status=400)
                
            # Get the room details
            try:
                room = Teachers_created_hub.objects.get(room_url=room_id)
                room_name = room.hub_name
                print(f"Found room: {room_name}")
            except Teachers_created_hub.DoesNotExist:
                print(f"Room not found with ID: {room_id}")
                return JsonResponse({"success": False, "error": "Room not found"}, status=404)
            
            # Find the student by name in Firebase
            print(f"Searching for student with name: {student_name}")
            students_ref = db.collection("users_profile")
            
            # First try exact match by name
            query = students_ref.where("name", "==", student_name).where("role", "==", "student").limit(1)
            students = list(query.stream())
            
            # If no exact match, try case-insensitive search if needed
            if not students and student_email:
                # Try to find by email as fallback
                query = students_ref.where("email", "==", student_email).where("role", "==", "student").limit(1)
                students = list(query.stream())
            
            if not students:
                # If still no match, try a more flexible search - get all students and filter
                print(f"No exact match found, trying flexible search")
                all_students_query = students_ref.where("role", "==", "student").stream()
                
                # Filter for partial name matches (case insensitive)
                student_name_lower = student_name.lower()
                matching_students = []
                
                for doc in all_students_query:
                    student_data = doc.to_dict()
                    if student_data.get("name", "").lower() == student_name_lower:
                        matching_students.append((doc, student_data))
                    elif student_name_lower in student_data.get("name", "").lower():
                        # Add as a fallback match
                        matching_students.append((doc, student_data))
                
                if matching_students:
                    # Use the first (best) match
                    students = [matching_students[0][0]]
            
            if not students:
                print(f"No student found with name: {student_name}")
                return JsonResponse({"success": False, "error": f"Student '{student_name}' not found"}, status=404)
                
            student_data = students[0].to_dict()
            student_name = student_data.get("name")
            print(f"Found student: {student_name}")
            
            # Check if the student is already a member of the room
            if Students_joined_hub.objects.filter(student=student_name, hub_url=room_id).exists():
                print(f"Student {student_name} is already a member of room {room_name}")
                return JsonResponse({"success": False, "error": f"{student_name} is already a member of this room"}, status=400)
            
            # Create notification in Firestore
            notification_data = {
                "username": student_name,
                "message": f"{teacher_name} invited you to join {room_name}",
                "type": "room_invite",
                "room_id": room_id,
                "room_name": room_name,
                "sender": teacher_name,
                "timestamp": datetime.utcnow(),
                "status": "pending",  # pending, accepted, or rejected
            }
            
            print(f"Creating notification for student: {student_name}")
            
            # Add notification to Firestore
            notification_ref = db.collection("notifications").add(notification_data)
            notification_id = notification_ref[1].id
            print(f"Created notification with ID: {notification_id}")
            print("===== INVITE SENT =====\n\n")
            
            return JsonResponse({
                "success": True, 
                "message": f"Invite sent to {student_name}",
                "notification_id": notification_id
            })
            
        except json.JSONDecodeError:
            print("Error: Invalid JSON")
            return JsonResponse({"success": False, "error": "Invalid JSON"}, status=400)
        except Exception as e:
            print(f"Error sending invite: {e}")
           
            return JsonResponse({"success": False, "error": str(e)}, status=500)

    print("Invalid request method for send_invite")
    return JsonResponse({"success": False, "error": "Invalid request method"}, status=405)

# Updated search_students function to better support name-based searches

@csrf_exempt
def search_students(request):
    if request.method == "POST":
        try:
            print("\n\n===== SEARCHING STUDENTS =====")
            data = json.loads(request.body)
            search_term = data.get("search_term", "").strip()
            room_id = data.get("room_id")
            
            print(f"Search term: {search_term}")
            print(f"Room ID: {room_id}")
            
            if not search_term:
                print("Error: Search term is required")
                return JsonResponse({"success": False, "error": "Search term is required"}, status=400)
                
            # Get existing room members to exclude them
            existing_members = set(get_members_by_hub_url(room_id))
            print(f"Existing members: {existing_members}")
            
            # Search for students in Firebase
            students_ref = db.collection("users_profile")
            
            # Convert search term to lowercase for case-insensitive comparison
            search_term_lower = search_term.lower()
            
            # Get all students and filter manually for more flexible matching
            query = students_ref.where("role", "==", "student").stream()
            
            # Filter students whose name contains the search term
            # and who are not already members of the room
            results = []
            for student in query:
                student_data = student.to_dict()
                student_name = student_data.get("name", "")
                student_email = student_data.get("email", "")
                
                # Skip if no name available
                if not student_name:
                    continue
                    
                # For debugging
                print(f"Checking student: {student_name}")
                
                # Check if this student matches our search term
                if (search_term_lower in student_name.lower()) and student_name not in existing_members:
                    print(f"Match found: {student_name}")
                    results.append({
                        "id": student.id,
                        "name": student_name,
                        "email": student_email,
                        "profile_picture": student_data.get("profile_picture", 
                            "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png")
                    })
            
            # Sort results by relevance - exact matches first, then partial matches
            # This prioritizes exact name matches
            results.sort(key=lambda x: 0 if x["name"].lower() == search_term_lower else 1)
            
            # Limit to 10 results for performance
            results = results[:10]
            
            print(f"Final results count: {len(results)}")
            print("===== SEARCH COMPLETE =====\n\n")
            
            return JsonResponse({
                "success": True,
                "students": results,
                "count": len(results)
            })
            
        except json.JSONDecodeError:
            print("Error: Invalid JSON")
            return JsonResponse({"success": False, "error": "Invalid JSON"}, status=400)
        except Exception as e:
            print(f"Error searching students: {e}")
            return JsonResponse({"success": False, "error": str(e)}, status=500)
            
    return JsonResponse({"success": False, "error": "Invalid request method"}, status=405)


# Add to views_hub_room.py

# Add this to views_hub_room.py
@csrf_exempt
def delete_message(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            message_id = data.get('message_id')
            room_id = data.get('room_id')
            username = data.get('username')
            
            if not all([message_id, room_id, username]):
                return JsonResponse({'success': False, 'error': 'Missing required parameters'}, status=400)
                
            # Get the message from Firebase
            message_ref = db.collection('hub_messages').document(message_id)
            message_doc = message_ref.get()
            
            if not message_doc.exists:
                return JsonResponse({'success': False, 'error': 'Message not found'}, status=404)
                
            message_data = message_doc.to_dict()
            
            # Check if the user is the sender of the message
            # if message_data.get('sender') != username:
            #     return JsonResponse({
            #         'success': False, 
            #         'error': 'You can only delete your own messages'
            #     }, status=403)
                
            # Delete message from Firestore
            message_ref.delete()
            
            # Also delete any replies to this message
            replies_ref = db.collection('hub_message_reply')
            replies_query = replies_ref.where('question_id', '==', message_id)
            
            for reply_doc in replies_query.stream():
                reply_doc.reference.delete()
                
            # Also delete any bookmarks for this message
            bookmarks_ref = db.collection('bookmarked_questions')
            bookmarks_query = bookmarks_ref.where('question_id', '==', message_id)
            
            for bookmark_doc in bookmarks_query.stream():
                bookmark_doc.reference.delete()
                
            # Also delete any poll votes for this message (if it's a poll)
            if message_data.get('is_poll'):
                poll_votes_ref = db.collection('poll_votes')
                poll_votes_query = poll_votes_ref.where('poll_id', '==', message_id)
                
                for vote_doc in poll_votes_query.stream():
                    vote_doc.reference.delete()
            
            return JsonResponse({
                'success': True, 
                'message': 'Message and associated data deleted successfully'
            })
                
        except Exception as e:
            print(f"Error deleting message: {e}")
            return JsonResponse({'success': False, 'error': str(e)}, status=500)
            
    return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=405)

@csrf_exempt
def respond_to_invite(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            notification_id = data.get("notification_id")
            response = data.get("response")  # "accept" or "reject"
            student_name = request.session.get("students_name")
            
            if not all([notification_id, response, student_name]):
                return JsonResponse({"success": False, "error": "Missing required parameters"}, status=400)
            
            # Get the notification details
            notification_ref = db.collection("notifications").document(notification_id)
            notification = notification_ref.get()
            
            if not notification.exists:
                return JsonResponse({"success": False, "error": "Notification not found"}, status=404)
                
            notification_data = notification.to_dict()
            
            # Verify this notification is for the current student
            if notification_data.get("username") != student_name:
                return JsonResponse({"success": False, "error": "This notification is not for you"}, status=403)
                
            # Verify this is a room invite notification
            if notification_data.get("type") != "room_invite":
                return JsonResponse({"success": False, "error": "This is not a room invite notification"}, status=400)
                
            # Get room details
            room_id = notification_data.get("room_id")
            room_name = notification_data.get("room_name")
            sender = notification_data.get("sender")
            
            if response == "accept":
                # Add student to the room
                try:
                    # Get the room details
                    room = Teachers_created_hub.objects.get(room_url=room_id)
                    
                    # Check if student is already a member
                    if Students_joined_hub.objects.filter(student=student_name, hub=room).exists():
                        return JsonResponse({"success": False, "error": "You are already a member of this room"}, status=400)
                    
                    # Add student to the room
                    new_member = Students_joined_hub(
                        student=student_name,
                        hub=room,
                        hub_owner=room.hub_owner,
                        hub_url=room_id
                    )
                    new_member.save()
                    
                    # Update notification status
                    notification_ref.update({
                        "status": "accepted",
                        "response_time": datetime.utcnow()
                    })
                    
                    return JsonResponse({
                        "success": True,
                        "message": f"You have joined {room_name}",
                        "room_id": room_id
                    })
                    
                except Teachers_created_hub.DoesNotExist:
                    return JsonResponse({"success": False, "error": "Room not found"}, status=404)
                except Exception as e:
                    print(f"Error accepting invite: {e}")
                    return JsonResponse({"success": False, "error": str(e)}, status=500)
                    
            elif response == "reject":
                # Update notification status
                notification_ref.update({
                    "status": "rejected",
                    "response_time": datetime.utcnow()
                })
                
                return JsonResponse({
                    "success": True,
                    "message": f"You have declined the invitation to {room_name}"
                })
                
            else:
                return JsonResponse({"success": False, "error": "Invalid response"}, status=400)
                
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "error": "Invalid JSON"}, status=400)
        except Exception as e:
            print(f"Error responding to invite: {e}")
            return JsonResponse({"success": False, "error": str(e)}, status=500)
            
    return JsonResponse({"success": False, "error": "Invalid request method"}, status=405)