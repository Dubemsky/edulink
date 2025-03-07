from django.http import JsonResponse
from .firebase import *
from django.shortcuts import render
from firebase_admin import credentials, auth


def get_user_by_name(name):
    try:
        users = auth.list_users()  
        for user in users.users:
            if user.display_name == name:  
                return {
                    "email": user.email,
                    "phone_number": user.phone_number,
                    "uid": user.uid,
                    "created_at": user.user_metadata.creation_timestamp,
                    "last_signed_in": user.user_metadata.last_sign_in_timestamp
                }
        return None  
    except Exception as e:
        print(f"Error fetching user by name: {e}")
        return None



def students_profile_update(request):
    if request.method == 'POST':
        update_type = request.POST.get('type')
        student_name=get_student_user_id(request)

        details=get_user_by_name(student_name)
        user_id= details.get('uid') 
        print(user_id, student_name)
        
        if update_type == 'profile_pic':

            profile_picture = request.FILES.get('profile_picture')
            if profile_picture:
                image_url = store_image_in_firebase(profile_picture, student_name,user_id)
                if image_url:
                    # Returning the simulated URL as part of the response
                    return JsonResponse({"success": True, "image_url": image_url})
                else:
                    return JsonResponse({"success": False, "error": "Failed to upload image"})
            else:
                return JsonResponse({"error": "No profile picture uploaded"}, status=400)

        elif update_type == 'website':
            print("Updating website")
            website = request.POST.get('website')
            if website:
                print("Website received:", website)
                success = add_user_website(user_id, website)
                if success:
                    return JsonResponse({"success": True})
                else:
                    return JsonResponse({"success": False, "error": "Failed to add website"}, status=500)
            else:
                return JsonResponse({"error": "No website provided"}, status=400)
    
            

        elif update_type == 'bio':
            print("Updating bio")
            bio = request.POST.get('bio')
            if bio:
                print("Bio received:", bio)
                success = update_user_bio(user_id, bio)
                if success:
                    return JsonResponse({"success": True})
                else:
                    return JsonResponse({"success": False, "error": "Failed to update bio"}, status=500)
            else:
                return JsonResponse({"error": "No bio provided"}, status=400)

        return JsonResponse({"error": "Invalid update type"}, status=400)

    return JsonResponse({"error": "Invalid request method"}, status=405)


def teachers_profile_update(request):
    if request.method == 'POST':
        update_type = request.POST.get('type')
        teacher_name=get_teacher_user_id(request)

        details=get_user_by_name(teacher_name)
        user_id= details.get('uid') 
        print(f'Teachers name {teacher_name}, user id {user_id}')
        
        if update_type == 'profile_pic':

            profile_picture = request.FILES.get('profile_picture')
            if profile_picture:
                image_url = store_image_in_firebase(profile_picture, teacher_name,user_id)
                if image_url:
                    # Returning the simulated URL as part of the response
                    return JsonResponse({"success": True, "image_url": image_url})
                else:
                    return JsonResponse({"success": False, "error": "Failed to upload image"})
            else:
                return JsonResponse({"error": "No profile picture uploaded"}, status=400)



        elif update_type == 'website':
            print("Updating website")
            website = request.POST.get('website')
            if website:
                print("Website received:", website)
                success = add_user_website(user_id, website)
                if success:
                    return JsonResponse({"success": True})
                else:
                    return JsonResponse({"success": False, "error": "Failed to add website"}, status=500)
            else:
                return JsonResponse({"error": "No website provided"}, status=400)
    
            

        elif update_type == 'bio':
            print("Updating bio")
            bio = request.POST.get('bio')
            if bio:
                print("Bio received:", bio)
                success = update_user_bio(user_id, bio)
                if success:
                    return JsonResponse({"success": True})
                else:
                    return JsonResponse({"success": False, "error": "Failed to update bio"}, status=500)
            else:
                return JsonResponse({"error": "No bio provided"}, status=400)

        return JsonResponse({"error": "Invalid update type"}, status=400)

    return JsonResponse({"error": "Invalid request method"}, status=405)



