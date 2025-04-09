# Add these views to your views.py file or create a new file

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
from .firebase import *
from .profile_page_updates import get_user_by_name
from .group_chat_model import (
    create_group_chat,
    get_user_group_chats,
    send_group_message,
    get_group_chat_messages,
    add_group_chat_member,
    remove_group_chat_member
)

def get_current_user_id(request):
    """Helper function to get the current user ID based on their role"""
    user_role = request.session.get("role")
    
    if user_role == "teacher":
        current_user_name = get_teacher_user_id(request)
    elif user_role == "student":
        current_user_name = get_student_user_id(request)
    else:
        return None
        
    if current_user_name:
        details = get_user_by_name(current_user_name)
        if details:
            return details.get('uid')
    
    return None

@csrf_exempt
def get_group_chats(request):
    """
    Get all group chats for the current user
    """
    try:
        # Get the current user ID
        current_user_id = get_current_user_id(request)
        
        if not current_user_id:
            return JsonResponse({
                'success': False,
                'error': 'Unable to determine current user'
            }, status=401)
            
        # Get the user's group chats
        group_chats = get_user_group_chats(current_user_id)
        
        return JsonResponse({
            'success': True,
            'group_chats': group_chats
        })
        
    except Exception as e:
        print(f"Error in get_group_chats: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def create_new_group_chat(request):
    """
    Create a new group chat
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST method is allowed'}, status=405)
    
    try:
        # Parse the request data
        data = json.loads(request.body)
        group_name = data.get('name')
        member_ids = data.get('members', [])
        
        if not group_name:
            return JsonResponse({
                'success': False,
                'error': 'Group name is required'
            }, status=400)
            
        # Get the current user ID
        current_user_id = get_current_user_id(request)
        
        if not current_user_id:
            return JsonResponse({
                'success': False,
                'error': 'Unable to determine current user'
            }, status=401)
            
        # Create the group chat
        result = create_group_chat(group_name, current_user_id, member_ids)
        
        if result['success']:
            return JsonResponse({
                'success': True,
                'group_chat_id': result.get('group_chat_id'),
                'message': result.get('message')
            })
        else:
            return JsonResponse({
                'success': False,
                'error': result.get('message')
            }, status=500)
            
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON'
        }, status=400)
        
    except Exception as e:
        print(f"Error in create_new_group_chat: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def group_chat_messages(request, group_chat_id):
    """
    Get messages for a group chat or send a new message
    """
    # Get the current user ID
    current_user_id = get_current_user_id(request)
    
    if not current_user_id:
        return JsonResponse({
            'success': False,
            'error': 'Unable to determine current user'
        }, status=401)
    
    if request.method == 'GET':
        # Get messages for the group chat
        result = get_group_chat_messages(group_chat_id, current_user_id)
        
        if result['success']:
            return JsonResponse({
                'success': True,
                'messages': result.get('messages', []),
                'group_info': result.get('group_info', {})
            })
        else:
            return JsonResponse({
                'success': False,
                'error': result.get('message')
            }, status=500)
            
    elif request.method == 'POST':
        try:
            # Parse the request data
            data = json.loads(request.body)
            message_text = data.get('message')
            
            if not message_text:
                return JsonResponse({
                    'success': False,
                    'error': 'Message text is required'
                }, status=400)
                
            # Send the message
            result = send_group_message(group_chat_id, current_user_id, message_text)
            
            if result['success']:
                return JsonResponse({
                    'success': True,
                    'message_id': result.get('message_id'),
                    'message': 'Message sent successfully'
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': result.get('message')
                }, status=500)
                
        except json.JSONDecodeError:
            return JsonResponse({
                'success': False,
                'error': 'Invalid JSON'
            }, status=400)
            
        except Exception as e:
            print(f"Error sending group message: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': str(e)
            }, status=500)
    
    return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=405)

@csrf_exempt
def group_chat_member(request, group_chat_id):
    """
    Add or remove a member from a group chat
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST method is allowed'}, status=405)
    
    try:
        # Parse the request data
        data = json.loads(request.body)
        action = data.get('action')
        member_id = data.get('member_id')
        
        if not action or not member_id:
            return JsonResponse({
                'success': False,
                'error': 'Action and member ID are required'
            }, status=400)
            
        # Get the current user ID
        current_user_id = get_current_user_id(request)
        
        if not current_user_id:
            return JsonResponse({
                'success': False,
                'error': 'Unable to determine current user'
            }, status=401)
            
        if action == 'add':
            # Add a member to the group chat
            result = add_group_chat_member(group_chat_id, current_user_id, member_id)
        elif action == 'remove':
            # Remove a member from the group chat
            result = remove_group_chat_member(group_chat_id, current_user_id, member_id)
        else:
            return JsonResponse({
                'success': False,
                'error': 'Invalid action. Must be "add" or "remove"'
            }, status=400)
            
        if result['success']:
            return JsonResponse({
                'success': True,
                'message': result.get('message')
            })
        else:
            return JsonResponse({
                'success': False,
                'error': result.get('message')
            }, status=500)
            
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON'
        }, status=400)
        
    except Exception as e:
        print(f"Error managing group chat member: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def get_mutual_connections(request):
    """
    Get users who are mutual connections with the current user
    (users who the current user follows and who follow the current user)
    """
    try:
        # Get the current user ID
        current_user_id = get_current_user_id(request)
        
        if not current_user_id:
            return JsonResponse({
                'success': False,
                'error': 'Unable to determine current user'
            }, status=401)
            
        # Get the list of users the current user is following
        from .community_page import get_user_following
        following_ids = get_user_following(current_user_id)
        
        # For each user in the following list, check if they follow the current user back
        mutual_connections = []
        
        for user_id in following_ids:
            # Get the users that this user is following
            their_following_ids = get_user_following(user_id)
            
            # If the current user is in their following list, they are a mutual connection
            if current_user_id in their_following_ids:
                # Get user details from Firestore
                users_ref = db.collection('users_profile')
                user_doc = users_ref.document(user_id).get()
                
                if user_doc.exists:
                    user_data = user_doc.to_dict()
                    mutual_connections.append({
                        'id': user_id,
                        'name': user_data.get('name'),
                        'role': user_data.get('role'),
                        'profile_picture': user_data.get('profile_picture')
                    })
        
        return JsonResponse({
            'success': True,
            'connections': mutual_connections
        })
        
    except Exception as e:
        print(f"Error in get_mutual_connections: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)