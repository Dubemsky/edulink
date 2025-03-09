# community_page.py
from django.shortcuts import render
from django.http import JsonResponse
from .firebase import *
import json
from django.views.decorators.csrf import csrf_exempt

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


@csrf_exempt
def follow_user(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            user_id = data.get('userId')
            action = data.get('action')  # 'follow' or 'unfollow'
            
            # Get the current user's name from the session
            current_user_name = request.session.get("students_name") or request.session.get("teachers_name")
            if not current_user_name:
                return JsonResponse({"success": False, "error": "User not logged in"}, status=401)
            
            # Get current user's profile
            current_user = None
            users = db.collection('users_profile').stream()
            for user in users:
                if user.to_dict().get('name') == current_user_name:
                    current_user = {"id": user.id, "data": user.to_dict()}
                    break
            
            if not current_user:
                return JsonResponse({"success": False, "error": "Current user profile not found"}, status=404)
            
            # Get target user's profile
            target_user_ref = db.collection('users_profile').document(user_id)
            target_user_doc = target_user_ref.get()
            
            if not target_user_doc.exists:
                return JsonResponse({"success": False, "error": "Target user not found"}, status=404)
            
            target_user_data = target_user_doc.to_dict()
            
            # Handle follow/unfollow action
            if action == 'follow':
                # Update follower count for target user
                current_followers = target_user_data.get('followers', 0)
                target_user_ref.update({'followers': current_followers + 1})
                
                # Update following count for current user
                current_following = current_user['data'].get('followings', 0)
                db.collection('users_profile').document(current_user['id']).update({'followings': current_following + 1})
                
                # Add to following collection
                follow_data = {
                    'follower_id': current_user['id'],
                    'follower_name': current_user_name,
                    'following_id': user_id,
                    'following_name': target_user_data.get('name'),
                    'created_at': datetime.now()
                }
                db.collection('user_follows').add(follow_data)
                
                # Create notification for target user
                notification_data = {
                    'user_id': user_id,
                    'username': target_user_data.get('name'),
                    'message': f"{current_user_name} started following you",
                    'type': 'follow',
                    'sender_id': current_user['id'],
                    'sender_name': current_user_name,
                    'created_at': datetime.now(),
                    'read': False
                }
                db.collection('notifications').add(notification_data)
                
                return JsonResponse({"success": True, "message": "Successfully followed user"})
                
            elif action == 'unfollow':
                # Update follower count for target user
                current_followers = target_user_data.get('followers', 0)
                target_user_ref.update({'followers': max(0, current_followers - 1)})
                
                # Update following count for current user
                current_following = current_user['data'].get('followings', 0)
                db.collection('users_profile').document(current_user['id']).update({'followings': max(0, current_following - 1)})
                
                # Remove from following collection
                follows_ref = db.collection('user_follows')
                query = follows_ref.where('follower_id', '==', current_user['id']).where('following_id', '==', user_id)
                for follow in query.stream():
                    follow.reference.delete()
                
                return JsonResponse({"success": True, "message": "Successfully unfollowed user"})
            
            else:
                return JsonResponse({"success": False, "error": "Invalid action"}, status=400)
            
        except Exception as e:
            print(f"Error: {e}")
            return JsonResponse({"success": False, "error": str(e)}, status=500)
    
    return JsonResponse({"success": False, "error": "Invalid request method"}, status=405)

@csrf_exempt
def get_following(request):
    if request.method == 'GET':
        try:
            # Get the current user's name from the session
            current_user_name = request.session.get("students_name") or request.session.get("teachers_name")
            if not current_user_name:
                return JsonResponse({"success": False, "error": "User not logged in"}, status=401)
            
            # Get current user's profile
            current_user_id = None
            users = db.collection('users_profile').stream()
            for user in users:
                if user.to_dict().get('name') == current_user_name:
                    current_user_id = user.id
                    break
            
            if not current_user_id:
                return JsonResponse({"success": False, "error": "Current user profile not found"}, status=404)
            
            # Get users that the current user is following
            follows_ref = db.collection('user_follows')
            query = follows_ref.where('follower_id', '==', current_user_id)
            
            following_ids = []
            for follow in query.stream():
                follow_data = follow.to_dict()
                following_ids.append(follow_data.get('following_id'))
            
            return JsonResponse({"success": True, "following": following_ids})
            
        except Exception as e:
            print(f"Error: {e}")
            return JsonResponse({"success": False, "error": str(e)}, status=500)
    
    return JsonResponse({"success": False, "error": "Invalid request method"}, status=405)