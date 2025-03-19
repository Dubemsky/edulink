# community_page.py
from django.shortcuts import render
from django.http import JsonResponse
from .firebase import *
import json
from django.views.decorators.csrf import csrf_exempt
from .profile_page_updates import get_user_by_name

# Main community page views
def community_page(request):
    current_student_name = request.session.get("students_name")
    student_name = get_student_user_id(request)
    details = get_user_by_name(student_name)
    user_id = details.get('uid')
    print(f"This is for {student_name} {user_id}")
    if request.method == 'GET':
        # When loading the page, fetch all users for initial display
        users_ref = db.collection('users_profile')
        users = users_ref.stream()
        
        users_list = []
        for user in users:
            user_data = user.to_dict()
            user_doc_id = user.id
            
            users_list.append({
                "id": user_doc_id,
                "name": user_data.get('name'),
                "role": user_data.get('role'),
                "bio": user_data.get('bio'),
                "followers": user_data.get('followers', 0),
                "followings": user_data.get('followings', 0),
                "created_at": user_data.get('created_at'),
                "profile_picture": user_data.get('profile_picture'),
                "websites": user_data.get('websites'),
            })
            
        return render(request, "myapp/students/community_page.html", {
            "initial_users": users_list,
            "current_student_name": current_student_name,
            "user_id": user_id,
        })

    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            filter_type = data.get('type', 'all').lower()
            
            users_ref = db.collection('users_profile')
            query = users_ref

            # 🔎 Filter based on button pressed
            if filter_type in ['students', 'student']:
                query = users_ref.where('role', '==', 'student')
            elif filter_type in ['teachers', 'lecturer']:
                query = users_ref.where('role', 'in', ['teacher', 'lecturer'])
            # For 'all', we use the default query without filters
            
            users = query.stream()
            
            users_list = []
            for user in users:
                user_data = user.to_dict()
                user_doc_id = user.id

                users_list.append({
                    "id": user_doc_id,
                    "name": user_data.get('name'),
                    "role": user_data.get('role'),
                    "bio": user_data.get('bio'),
                    "followers": user_data.get('followers', 0),
                    "followings": user_data.get('followings', 0),
                    "created_at": user_data.get('created_at'),
                    "profile_picture": user_data.get('profile_picture'),
                    "websites": user_data.get('websites'),
                })

            return JsonResponse({"success": True, "users": users_list, "user_id":user_id})

        except Exception as e:
            print(f"Error: {e}")
            return JsonResponse({"success": False, "error": "Failed to retrieve users"}, status=500)

    return JsonResponse({"success": False, "error": "Invalid request method"}, status=405)

def teachers_community_page(request):
    current_teacher_name = request.session.get("teachers_name")
    teacher_name = get_teacher_user_id(request)
    details = get_user_by_name(teacher_name)
    user_id = details.get('uid') 
    
    if request.method == 'GET':
        # When loading the page, fetch all users for initial display
        users_ref = db.collection('users_profile')
        users = users_ref.stream()
        
        users_list = []
        for user in users:
            user_data = user.to_dict()
            user_doc_id = user.id
            
            users_list.append({
                "id": user_doc_id,
                "name": user_data.get('name'),
                "role": user_data.get('role'),
                "bio": user_data.get('bio'),
                "followers": user_data.get('followers', 0),
                "followings": user_data.get('followings', 0),
                "created_at": user_data.get('created_at'),
                "profile_picture": user_data.get('profile_picture'),
                "websites": user_data.get('websites'),
            })
            
        return render(request, "myapp/teachers/teachers_community_page.html", {
            "initial_users": users_list,
            "current_teacher_name": current_teacher_name,
            "user_id":user_id
        })

    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            filter_type = data.get('type', 'all').lower()
            
            users_ref = db.collection('users_profile')
            query = users_ref

            # 🔎 Filter based on button pressed
            if filter_type in ['students', 'student']:
                query = users_ref.where('role', '==', 'student')
            elif filter_type in ['teachers', 'lecturer']:
                query = users_ref.where('role', 'in', ['teacher', 'lecturer'])
            # For 'all', we use the default query without filters
            
            users = query.stream()
            
            users_list = []
            for user in users:
                user_data = user.to_dict()
                user_doc_id = user.id

                users_list.append({
                    "id": user_doc_id,
                    "name": user_data.get('name'),
                    "role": user_data.get('role'),
                    "bio": user_data.get('bio'),
                    "followers": user_data.get('followers', 0),
                    "followings": user_data.get('followings', 0),
                    "created_at": user_data.get('created_at'),
                    "profile_picture": user_data.get('profile_picture'),
                    "websites": user_data.get('websites'),
                })

            return JsonResponse({"success": True, "users": users_list,"user_id":user_id})

        except Exception as e:
            print(f"Error: {e}")
            return JsonResponse({"success": False, "error": "Failed to retrieve users"}, status=500)

    return JsonResponse({"success": False, "error": "Invalid request method"}, status=405)






# Enhancement 1: Improved follow_user function with better error handling and logging

def follow_user(follower_id, user_to_follow_id):
    """
    Create a follow relationship between two users in Firestore.
    
    Args:
        follower_id: The ID of the user who is following
        user_to_follow_id: The ID of the user being followed
        
    Returns:
        dict: Result with success status and message
    """
    try:
        # Validate inputs
        if not follower_id or not user_to_follow_id:
            print("I cant find it")
            return {
                'success': False,
                'message': 'Missing user IDs for follow operation'
            }
            
        # Prevent following yourself
        if follower_id == user_to_follow_id:
            return {
                'success': False,
                'message': 'You cannot follow yourself'
            }
            
        # Reference to users_profile collection
        users_ref = db.collection('users_profile')
        
        # Reference to a collection to track follow relationships
        follows_ref = db.collection('user_follows')
        
        # Create the follow relationship document ID
        follow_doc_id = f"{follower_id}_follows_{user_to_follow_id}"
        
        # Check if already following
        follow_doc = follows_ref.document(follow_doc_id).get()
        if follow_doc.exists:
            print(f"User {follower_id} is already following {user_to_follow_id}")
            return {
                'success': True,
                'message': 'Already following this user'
            }
            
        # Get follower and following user documents to verify they exist
        follower_doc = users_ref.document(follower_id).get()
        following_doc = users_ref.document(user_to_follow_id).get()
        
        if not follower_doc.exists:
            return {
                'success': False,
                'message': f"Your user profile (ID: {follower_id}) was not found"
            }
            
        if not following_doc.exists:
            return {
                'success': False,
                'message': f"The user you are trying to follow (ID: {user_to_follow_id}) was not found"
            }
            
        # Create the follow relationship with a timestamp
        follows_ref.document(follow_doc_id).set({
            'follower_id': follower_id,
            'following_id': user_to_follow_id,
            'created_at': firestore.SERVER_TIMESTAMP
        })
        
        # Update follower's following count
        follower_data = follower_doc.to_dict()
        current_followings = follower_data.get('followings', 0)
        users_ref.document(follower_id).update({
            'followings': current_followings + 1
        })
        
        # Update the followed user's followers count
        following_data = following_doc.to_dict()
        current_followers = following_data.get('followers', 0)
        users_ref.document(user_to_follow_id).update({
            'followers': current_followers + 1
        })
        
        print(f"User {follower_id} is now following {user_to_follow_id}")
        return {
            'success': True,
            'message': 'Successfully followed user'
        }
        
    except Exception as e:
        print(f"Error following user: {e}")
        return {
            'success': False,
            'message': f"Error following user: {str(e)}"
        }

# Enhancement 2: Improved unfollow_user function with better error handling and logging

def unfollow_user(follower_id, user_to_unfollow_id):
    """
    Remove a follow relationship between two users in Firestore.
    
    Args:
        follower_id: The ID of the user who is unfollowing
        user_to_unfollow_id: The ID of the user being unfollowed
        
    Returns:
        dict: Result with success status and message
    """
    try:
        # Validate inputs
        if not follower_id or not user_to_unfollow_id:
            return {
                'success': False,
                'message': 'Missing user IDs for unfollow operation'
            }
            
        # Prevent unfollowing yourself (redundant but good practice)
        if follower_id == user_to_unfollow_id:
            return {
                'success': False,
                'message': 'You cannot unfollow yourself'
            }
            
        # Reference to users_profile collection
        users_ref = db.collection('users_profile')
        
        # Reference to follows collection
        follows_ref = db.collection('user_follows')
        
        # Follow relationship document ID
        follow_doc_id = f"{follower_id}_follows_{user_to_unfollow_id}"
        
        # Check if the relationship exists
        follow_doc = follows_ref.document(follow_doc_id).get()
        if not follow_doc.exists:
            print(f"User {follower_id} is not following {user_to_unfollow_id}")
            return {
                'success': True,
                'message': 'Already not following this user'
            }
            
        # Delete the follow relationship
        follows_ref.document(follow_doc_id).delete()
        
        # Check if both users still exist to update their counts
        follower_doc = users_ref.document(follower_id).get()
        following_doc = users_ref.document(user_to_unfollow_id).get()
        
        if follower_doc.exists:
            # Update the following count for the follower
            follower_data = follower_doc.to_dict()
            current_followings = follower_data.get('followings', 0)
            users_ref.document(follower_id).update({
                'followings': max(0, current_followings - 1)
            })
        
        if following_doc.exists:
            # Update the followers count for the user being unfollowed
            following_data = following_doc.to_dict()
            current_followers = following_data.get('followers', 0)
            users_ref.document(user_to_unfollow_id).update({
                'followers': max(0, current_followers - 1)
            })
        
        print(f"User {follower_id} has unfollowed {user_to_unfollow_id}")
        return {
            'success': True,
            'message': 'Successfully unfollowed user'
        }
        
    except Exception as e:
        print(f"Error unfollowing user: {e}")
        return {
            'success': False,
            'message': f"Error unfollowing user: {str(e)}"
        }


def get_user_id_by_name(username):
    """
    Get a user's ID from their display name (username)
    """
    try:
        # First try to find the user in Firebase Auth by display name
        users = auth.list_users().users
        
        for user in users:
            if user.display_name == username:
                return user.uid
        
        # If not found in Auth, try looking in Firestore
        users_ref = db.collection('users_profile')
        query = users_ref.where('name', '==', username).limit(1)
        results = query.stream()
        
        for doc in results:
            return doc.id
        
        # If still not found, return None
        return None
    
    except Exception as e:
        print(f"Error getting user ID for {username}: {e}")
        return None








def get_user_following(user_id):
    """
    Get a list of user IDs that a user is following.
    
    Args:
        user_id: The ID of the user
        
    Returns:
        List of user IDs that the user is following
    """
    try:
        # Reference to follows collection
        follows_ref = db.collection('user_follows')
        
        # Query for all documents where this user is the follower
        query = follows_ref.where('follower_id', '==', user_id)
        results = query.stream()
        
        # Extract the IDs of users being followed
        following_ids = []
        for doc in results:
            data = doc.to_dict()
            following_ids.append(data.get('following_id'))
            
        return following_ids
        
    except Exception as e:
        print(f"Error getting following list: {e}")
        return []








@csrf_exempt
def follow_user_view(request):
    """
    Handle follow requests from both students and teachers
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST method is allowed'}, status=405)
    
    try:
        # Parse the request data
        data = json.loads(request.body)
        user_id_to_follow = data.get('userId')
        
        if not user_id_to_follow:
            return JsonResponse({
                'success': False,
                'error': 'User ID is required'
            }, status=400)
        
        print(f"Received follow request for user ID: {user_id_to_follow}")
        
        # Get the current user ID (could be student or teacher)

        user_role = request.session.get("role")

        if user_role == "teacher":


            current_user_name = get_teacher_user_id(request)
            details=get_user_by_name(current_user_name)
            current_user_id= details.get('uid')
            print(f"Current student: {current_user_name} -> ID: {current_user_id}")

        elif user_role == "student":


            current_user_name = get_student_user_id(request)
            details=get_user_by_name(current_user_name)
            current_user_id= details.get('uid')
            print(f"Current student: {current_user_name} -> ID: {current_user_id}")

        
        else :
            return JsonResponse({
                'success': False,
                'error': 'Unable to determine current user'
            }, status=401)
        
        # Verify both users exist in Firestore
        users_ref = db.collection('users_profile')
        follower_exists = users_ref.document(current_user_id).get().exists
        following_exists = users_ref.document(user_id_to_follow).get().exists
        
        if not follower_exists:
            print(f'Your user profile (ID: {current_user_id}) was not found in the database')
            return JsonResponse({
                'success': False,
                'error': f'Your user profile (ID: {current_user_id}) was not found in the database'
            }, status=404)
            
        if not following_exists:
            print(f'The user you are trying to follow (ID: {user_id_to_follow}) was not found in the database')
            return JsonResponse({
                'success': False,
                'error': f'The user you are trying to follow (ID: {user_id_to_follow}) was not found in the database'
            }, status=404)
        
        # Prevent following yourself
        if current_user_id == user_id_to_follow:
            return JsonResponse({
                'success': False,
                'error': 'You cannot follow yourself'
            }, status=400)
            
        # Execute follow action with improved error handling
        result = follow_user(current_user_id, user_id_to_follow)
            
        if result['success']:
            return JsonResponse({
                'success': True,
                'message': result.get('message', 'Successfully followed user')
            })
        else:
            return JsonResponse({
                'success': False,
                'error': result.get('message', 'Failed to follow user')
            }, status=500)
            
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON'
        }, status=400)
        
    except Exception as e:
        print(f"Unexpected error in follow_user_view: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)
    


@csrf_exempt
def unfollow_user_view(request):
    """
    Handle unfollow requests from both students and teachers
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST method is allowed'}, status=405)
    
    try:
        # Parse the request data
        data = json.loads(request.body)
        user_id_to_unfollow = data.get('userId')
        
        if not user_id_to_unfollow:
            return JsonResponse({
                'success': False,
                'error': 'User ID is required'
            }, status=400)
        
        # Get the current user ID (could be student or teacher)
        user_role = request.session.get("role")

        if user_role == "teacher":
            current_user_name = get_teacher_user_id(request)
            details=get_user_by_name(current_user_name)
            current_user_id= details.get('uid')
            print(f"Current student: {current_user_name} -> ID: {current_user_id}")

        elif user_role == "student":
            current_user_name = get_student_user_id(request)
            details=get_user_by_name(current_user_name)
            current_user_id= details.get('uid')
            print(f"Current student: {current_user_name} -> ID: {current_user_id}")
        
        if not current_user_id:
            return JsonResponse({
                'success': False,
                'error': 'Unable to determine current user'
            }, status=401)
        
        # Prevent unfollowing yourself
        if current_user_id == user_id_to_unfollow:
            return JsonResponse({
                'success': False,
                'error': 'You cannot unfollow yourself'
            }, status=400)
            
        # Execute unfollow action with improved error handling
        result = unfollow_user(current_user_id, user_id_to_unfollow)
            
        if result['success']:
            return JsonResponse({
                'success': True,
                'message': result.get('message', 'Successfully unfollowed user')
            })
        else:
            return JsonResponse({
                'success': False,
                'error': result.get('message', 'Failed to unfollow user')
            }, status=500)
            
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON'
        }, status=400)
        
    except Exception as e:
        print(f"Unexpected error in unfollow_user_view: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def get_following_list(request):
    """
    Return a list of users that the current user is following with their details
    """
    try:
        # Get the current user ID (could be student or teacher)
        current_user_id = None
        
        user_role = request.session.get("role")

        if user_role == "teacher":

            current_user_name = get_teacher_user_id(request)
            details=get_user_by_name(current_user_name)
            current_user_id= details.get('uid')
            

            print(f"User name is {current_user_name} and their id {current_user_id}")
        elif user_role == "student":


            current_user_name = get_student_user_id(request)
            details=get_user_by_name(current_user_name)
            current_user_id= details.get('uid')
            print(f"User name is {current_user_name} and their id {current_user_id}")


        else:
            print("I am here userrole isnt right")
            return JsonResponse({
                'success': False,
                'error': 'Unable to determine current user'
            }, status=401)
        
        
        print(f"\n\nThis is the userid {current_user_id}")
        # Get the list of users being followed
        following_ids = get_user_following(current_user_id)
        
        
        # Get details for each followed user
        users_ref = db.collection('users_profile')
        following_details = []
        
        for user_id in following_ids:
            user_doc = users_ref.document(user_id).get()
            if user_doc.exists:
                user_data = user_doc.to_dict()
                following_details.append({
                    "id": user_id,
                    "name": user_data.get('name'),
                    "role": user_data.get('role'),
                    "profile_picture": user_data.get('profile_picture')
                })
        
        print(f"\n\nThis is the folowing list\n\n{following_details}\n\n")
        return JsonResponse({
            'success': True,
            'following': following_details  # Now includes user details
        })
        
    except Exception as e:
        print(f"Error in get_following_list: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)
    



# Add this search function to your community_page.py file

@csrf_exempt
def search_users(request):
    """
    Search for users by name in the community
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST method is allowed'}, status=405)
    
    try:
        # Parse the request data
        data = json.loads(request.body)
        search_term = data.get('search_term', '').strip()
        filter_type = data.get('filter_type', 'all').lower()
        
        if not search_term:
            return JsonResponse({
                'success': False,
                'error': 'Search term is required'
            }, status=400)
        
        # Reference to users collection
        users_ref = db.collection('users_profile')
        
        # Apply filter if specified
        if filter_type in ['students', 'student']:
            query = users_ref.where('role', '==', 'student')
        elif filter_type in ['teachers', 'lecturer']:
            query = users_ref.where('role', 'in', ['teacher', 'lecturer'])
        else:
            # For 'all', we use the default query without filters
            query = users_ref
        
        # Get all users for the current filter (Firestore doesn't support 
        # case-insensitive search or partial matches in queries)
        users = query.stream()
        
        # Perform client-side filtering for the search term
        users_list = []
        search_term_lower = search_term.upper()
        
        for user in users:
            user_data = user.to_dict()
            user_name = user_data.get('name', '')
            
            # Check if search term is in the name (case-insensitive)
            if search_term_lower in user_name.lower():
                user_doc_id = user.id
                
                users_list.append({
                    "id": user_doc_id,
                    "name": user_data.get('name'),
                    "role": user_data.get('role'),
                    "bio": user_data.get('bio'),
                    "followers": user_data.get('followers', 0),
                    "followings": user_data.get('followings', 0),
                    "created_at": user_data.get('created_at'),
                    "profile_picture": user_data.get('profile_picture'),
                    "websites": user_data.get('websites'),
                })
        
        return JsonResponse({
            "success": True, 
            "users": users_list,
            "search_term": search_term,
            "filter_type": filter_type,
            "count": len(users_list)
        })
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON'
        }, status=400)
        
    except Exception as e:
        print(f"Error in search_users: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)
