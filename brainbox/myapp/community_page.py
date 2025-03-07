from django.shortcuts import render
from .hub_functionality import *
from django.http import JsonResponse
from.profile_page_updates import *
from .firebase import *


"""
Initialize the logger which is used to track my apps behaviours
It is used for debugging
"""


def community_page(request):
    if request.method == 'GET':
        return render(request,"myapp/students/community_page.html")

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

            print(f"\nThis is the users list {users_list}\n\n")

            return JsonResponse({"success": True,"users": users_list})

        except Exception as e:
            print(f"Error: {e}")
            return JsonResponse({"error": "Failed to retrieve users"}, status=500)

    return JsonResponse({"error": "Invalid request method"}, status=405)


def teachers_community_page(request):
    if request.method == 'GET':
        return render(request, 'myapp/teachers/teachers_community_page.html')  # Render your template

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
            
            users = query.stream()
            
            users_list = []

            for user in users:
                user_data = user.to_dict()
                user_doc_id = user.id

    

                users_list.append({
                    "id": user_doc_id,
                    "name": user_data.get('name'),
                    "role": user_data.get('role'),
                    "followers": user_data.get('followers', 0),
                    "followings": user_data.get('followings', 0),
                    "created_at": user_data.get('created_at'),
                    "profile_picture": user_data.get('profile_picture'),
                    "websites": user_data.get('websites'),
                    
                })

            print(f"\nThis is the users list {users_list}\n\n")

            return JsonResponse({"success": True,})

        except Exception as e:
            print(f"Error: {e}")
            return JsonResponse({"error": "Failed to retrieve users"}, status=500)

    return JsonResponse({"error": "Invalid request method"}, status=405)
