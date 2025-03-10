import logging
from .hub_functionality import *
from django.http import JsonResponse
from django.shortcuts import render
from.profile_page_updates import *
from .firebase import *
import datetime
from .messages import *


logger = logging.getLogger(__name__)

"""
-----------------------------------------------------------------------
---------------------- TEACHERS SECTIONS ------------------------------
-----------------------------------------------------------------------

"""

def teachers_homepage(request):
    current_teacher = request.session.get("teachers_name")
    
    if current_teacher:
        # Retrieve all hubs where teachers name is the current teacher
        teachers_hubs_queryset = Teachers_created_hub.objects.filter(hub_owner=current_teacher)
        
        # Create a list with additional data for each hub
        teachers_hubs = []
        for hub in teachers_hubs_queryset:
            hub_data = {
                'hub_name': hub.hub_name,
                'hub_privacy_setting': hub.hub_privacy_setting,
                'room_url': hub.room_url,
                'hub_description': hub.hub_description,
                'member_count': get_hub_member_count(hub.room_url)
            }
            teachers_hubs.append(hub_data)
            
        notifications = get_notifications_by_username(current_teacher)
        
    return render(request, "myapp/teachers/teachers_homepage.html", {
        "teachers_hubs": teachers_hubs,
        "notifications": notifications,
        "username": current_teacher
    })


"""
This route handles teachers creating hubs
Retrieve hub details which are passed from the front end
"""
def teachers_create_hub(request):
    if request.method == "POST":
        # Ensures the teacher is logged in
        current_teacher = request.session.get("teachers_name")
        if not current_teacher:
            return JsonResponse({
                "success": False,
                "error": "You must be logged in to create a hub."
            }, status=403)

        try:
            # Parse form data
            hub_name = request.POST.get('hubName', '').upper()
            description = request.POST.get('description', '')
            privacy_setting = request.POST.get('privacySetting', 'public')
            hub_image = request.FILES.get('hubImage')

            # Debugging 
            logger.debug(f"""Owner: {current_teacher}
                      NAME: {hub_name}
                      Description: {description}
                      Image: {hub_image}
                      Privacy: {privacy_setting}""")

            # Check for duplicate hub names for the teacher
            if Teachers_created_hub.objects.filter(hub_owner=current_teacher, hub_name=hub_name).exists():
                return JsonResponse({
                    'success': False,
                    'error': 'A hub with this name already exists. Please choose a different name.'
                }, status=400)

            # Create the new hub
            Teachers_created_hub.objects.create(
                hub_owner=current_teacher,
                hub_name=hub_name,
                hub_description=description,
                hub_image=hub_image,
                hub_privacy_setting=privacy_setting,
            )

            return JsonResponse({
                "success": True,
                "message": "Hub created successfully!",
            })

        except Exception as e:
            logger.debug(f"Error creating hub: {e}")
            return JsonResponse({
                "success": False,
                "error": "An unexpected error occurred. Please try again later."
            }, status=500)

    return JsonResponse({
        "success": False,
        "error": "Invalid request method. Please use POST."
    }, status=405)



""" TEACHERS PROFILE PAGES"""

def teachers_profile_page(request):
    return render(request,"myapp/teachers/teachers_profile.html")



def teacher_profile_page_my_profile(request):
    teacher_name=get_teacher_user_id(request)
    details=get_user_by_name(teacher_name)
    user_id= details.get('uid') 

    try:
        users_ref = db.collection('users_profile')
        user_doc = users_ref.document(user_id).get()  # Get the user's document
        if user_doc.exists:
            user_data = user_doc.to_dict()  # Convert document data to a dictionary

            # Prepare data to send to the template
            profile_data = {
                'name': user_data.get('name', ''),
                'followers': user_data.get('followers', 0),
                'followings': user_data.get('followings', 0),
                'profile_picture': user_data.get('profile_picture', 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'), # Default profile picture
                'websites': user_data.get('websites', []),
                'bio': user_data.get('bio', ''),
                'created_at': user_data.get('created_at', "None"), # Format date
            }
            print("I have returned this to the profile page for teachers")
            return render(request, 'myapp/teachers/profile/teachers_profile_my_profile.html', profile_data) # Render the template with the data
        else:
            # User profile not found, render with default data
            return render(request, 'myapp/teachers/profile/teachers_profile_my_profile.html', {
                'name': teacher_name,
                'followers': 0,
                'followings': 0,
                'profile_picture': 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png',
                'websites': [],
                'bio': '',
                'created_at': user_data.get('created_at', "None"),
            })

    except Exception as e:
        print(f"Error fetching user profile: {e}")
        # Handle error (render with default data or show an error page)
        return render(request, 'myapp/teachers/profile/teachers_profile_my_profile.html', {
                'name': teacher_name,
                'followers': 0,
                'followings': 0,
                'profile_picture': 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png',
                'websites': [],
                'bio': '',
                'created_at': "None",
            })






def teacher_profile_page_securty_settings(request):
    return render(request,"myapp/teachers/profile/teachers_profile_securty_settings.html")

def teacher_profile_page_activity_contribution(request):
    return render(request,"myapp/teachers/profile/teachers_profile_activity_contribution.html")