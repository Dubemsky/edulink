# community_page.py
from django.shortcuts import render
from django.http import JsonResponse
from .firebase import *
import json
from django.views.decorators.csrf import csrf_exempt

# Main community page views
def community_page(request):
    current_student_name = request.session.get("students_name")
    
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
            "current_student_name": current_student_name
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

            return JsonResponse({"success": True, "users": users_list})

        except Exception as e:
            print(f"Error: {e}")
            return JsonResponse({"success": False, "error": "Failed to retrieve users"}, status=500)

    return JsonResponse({"success": False, "error": "Invalid request method"}, status=405)

def teachers_community_page(request):
    current_teacher_name = request.session.get("teachers_name")
    
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
            "current_teacher_name": current_teacher_name
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

            return JsonResponse({"success": True, "users": users_list})

        except Exception as e:
            print(f"Error: {e}")
            return JsonResponse({"success": False, "error": "Failed to retrieve users"}, status=500)

    return JsonResponse({"success": False, "error": "Invalid request method"}, status=405)

# Firebase functions for follow/unfollow operations
def follow_user(follower_id, user_to_follow_id):
    """
    Create a follow relationship between two users in Firestore.
    
    Args:
        follower_id: The ID of the user who is following
        user_to_follow_id: The ID of the user being followed
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Reference to users_profile collection
        users_ref = db.collection('users_profile')
        
        # Reference to a new collection to track follow relationships
        follows_ref = db.collection('user_follows')
        
        # Create the follow relationship document
        follow_doc_id = f"{follower_id}_follows_{user_to_follow_id}"
        
        # Check if already following
        follow_doc = follows_ref.document(follow_doc_id).get()
        if follow_doc.exists:
            print(f"User {follower_id} is already following {user_to_follow_id}")
            return True
            
        # Create the follow relationship
        follows_ref.document(follow_doc_id).set({
            'follower_id': follower_id,
            'following_id': user_to_follow_id,
            'created_at': firestore.SERVER_TIMESTAMP
        })
        
        # Get current follower and following counts
        follower_doc = users_ref.document(follower_id).get()
        following_doc = users_ref.document(user_to_follow_id).get()
        
        if not follower_doc.exists or not following_doc.exists:
            print("One of the users does not exist")
            return False
            
        follower_data = follower_doc.to_dict()
        following_data = following_doc.to_dict()
        
        # Update the following count for the follower
        current_followings = follower_data.get('followings', 0)
        users_ref.document(follower_id).update({
            'followings': current_followings + 1
        })
        
        # Update the followers count for the user being followed
        current_followers = following_data.get('followers', 0)
        users_ref.document(user_to_follow_id).update({
            'followers': current_followers + 1
        })
        
        print(f"User {follower_id} is now following {user_to_follow_id}")
        return True
        
    except Exception as e:
        print(f"Error following user: {e}")
        return False

def unfollow_user(follower_id, user_to_unfollow_id):
    """
    Remove a follow relationship between two users in Firestore.
    
    Args:
        follower_id: The ID of the user who is unfollowing
        user_to_unfollow_id: The ID of the user being unfollowed
        
    Returns:
        True if successful, False otherwise
    """
    try:
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
            return True  # Already not following, so consider it successful
            
        # Delete the follow relationship
        follows_ref.document(follow_doc_id).delete()
        
        # Get current follower and following counts
        follower_doc = users_ref.document(follower_id).get()
        following_doc = users_ref.document(user_to_unfollow_id).get()
        
        if not follower_doc.exists or not following_doc.exists:
            print("One of the users does not exist")
            return False
            
        follower_data = follower_doc.to_dict()
        following_data = following_doc.to_dict()
        
        # Update the following count for the follower (ensure it never goes below 0)
        current_followings = follower_data.get('followings', 0)
        users_ref.document(follower_id).update({
            'followings': max(0, current_followings - 1)
        })
        
        # Update the followers count for the user being unfollowed
        current_followers = following_data.get('followers', 0)
        users_ref.document(user_to_unfollow_id).update({
            'followers': max(0, current_followers - 1)
        })
        
        print(f"User {follower_id} has unfollowed {user_to_unfollow_id}")
        return True
        
    except Exception as e:
        print(f"Error unfollowing user: {e}")
        return False
    


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








def get_user_id_by_name(name):
    db = firestore.client()
    user_collection = db.collection("users_profile")
    query = user_collection.where("name", "==", name).stream()
    
    for user in query:
        return user.id  # Firestore document ID
    
    return None



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
        current_user_id = None
        
        # Check if user is a student
        current_student_name = get_student_user_id(request)
        if current_student_name:
            # For students, we need to check if this is the display name or the ID
            print(f"Current student name: {current_student_name}")
            
            
            current_user_id=get_user_id_by_name(current_student_name.upper())
            print(f"{current_student_name} : {current_user_id}")
            
            
        else:
            # Check if user is a teacher
            current_teacher_name = get_teacher_user_id(request)
            if current_teacher_name:
                current_user_id=get_user_id_by_name(current_teacher_name)
                print(f"{current_teacher_name} : {current_user_id}")
        
        if not current_user_id:
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
            
        # Execute follow action
        success = follow_user(current_user_id, user_id_to_follow)
            
        if success:
            print("It worked properly")
            return JsonResponse({
                'success': True,
                'message': 'Successfully followed user'
            })
        else:
            return JsonResponse({
                'success': False,
                'error': 'Failed to follow user'
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
        current_user_id = None
        
        # Check if user is a student
        current_student_name = get_student_user_id(request)
        if current_student_name:
            current_user_id = current_student_name
        else:
            # Check if user is a teacher
            current_teacher_name = get_teacher_user_id(request)
            if current_teacher_name:
                current_user_id = current_teacher_name
        
        if not current_user_id:
            return JsonResponse({
                'success': False,
                'error': 'Unable to determine current user'
            }, status=401)
            
        # Execute unfollow action
        success = unfollow_user(current_user_id, user_id_to_unfollow)
            
        if success:
            return JsonResponse({
                'success': True,
                'message': 'Successfully unfollowed user'
            })
        else:
            return JsonResponse({
                'success': False,
                'error': 'Failed to unfollow user'
            }, status=500)
            
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON'
        }, status=400)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def get_following_list(request):
    """
    Return a list of user IDs that the current user is following
    """
    try:
        # Get the current user ID (could be student or teacher)
        current_user_id = None
        
        # Check if user is a student
        current_student_name = get_student_user_id(request)
        if current_student_name:
            current_user_id = current_student_name
        else:
            # Check if user is a teacher
            current_teacher_name = get_teacher_user_id(request)
            if current_teacher_name:
                current_user_id = current_teacher_name
        
        if not current_user_id:
            return JsonResponse({
                'success': False,
                'error': 'Unable to determine current user'
            }, status=401)
            
        # Get the list of users being followed
        following_ids = get_user_following(current_user_id)
        
        return JsonResponse({
            'success': True,
            'following': following_ids
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)