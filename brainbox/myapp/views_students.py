import logging
from .firebase import *
from django.db.models import Q
from .hub_functionality import *
from django.shortcuts import render
from .profile_page_updates import *
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import datetime
from .messages import *

logger = logging.getLogger(__name__)


"""
-----------------------------------------------------------------------
---------------------- STUDENTS SECTIONS ------------------------------
-----------------------------------------------------------------------

"""


def students_homepage(request):
    current_student=request.session.get("students_name")
    
    if current_student:
        # Get the hubs students joined based on their name.
        students_hubs = Students_joined_hub.objects.filter(student=current_student)
        notifications =get_notifications_by_username(current_student)
        print(f"\n\n{current_student} {notifications}\n\n")
        
    return render(request, "myapp/students/students_homepage.html",{"students_hubs":students_hubs, "notifications":notifications})



def students_join_hub_page(request):
    

    if request.method == 'POST':
        search_query = request.POST.get('room_name', '').strip()
        
        """
        Using advance query seach to find hubs based on hub name or teachers name. 
        Filtering it making sure its only the public ones that are visible
        Query Docs : https://docs.djangoproject.com/en/5.1/topics/db/queries/
        
        """
        hubs = Teachers_created_hub.objects.filter(
            Q(hub_name__icontains=search_query) | 
            Q(hub_owner__icontains=search_query)
        ).filter(hub_privacy_setting='public')
        
        # Find the number of available hubs
        number_of_hubs = len(hubs)
        
        return render(request, "myapp/students/join_hub_page.html", {
            "teachers_hubs":hubs,
            "number_of_hubs":number_of_hubs
        })


    
    teachers_hubs = Teachers_created_hub.objects.filter(hub_privacy_setting='public')
    number_of_hubs=len(teachers_hubs)
    


    return render(request, "myapp/students/join_hub_page.html", {
        "teachers_hubs":teachers_hubs,
        "number_of_hubs":number_of_hubs

        })



"""
    @csrf_exempt is a Django decorator used to mark a view to exempt 
    it from CSRF (Cross-Site Request Forgery) protection
    References : https://stackoverflow.com/questions/11610306/how-to-exempt-csrf-protection-on-direct-to-template

"""
@csrf_exempt
def join_hub(request):
    if request.method == 'POST':
        try:
            # Parse JSON body from the request
            data = json.loads(request.body)
            hub_name = data.get('hub_name')
            hub_owner = data.get('hub_owner')
            current_student_name = request.session.get("students_name")


            # Check if the student is logged in
            if not current_student_name:
                return JsonResponse({'success': False, 'error': 'Student not logged in.'})

            logger.debug(f"Student Name: {current_student_name} joining {hub_name}")  # Debugging

            # Get the hub from Teachers_created_hub table 
            try:
                hub = Teachers_created_hub.objects.get(hub_name=hub_name, hub_owner=hub_owner)
            except Teachers_created_hub.DoesNotExist:
                return JsonResponse({'success': False, 'error': 'Hub not found.'})

            # Check if the student is already in the hub with the same teacher (hub_owner)
            existing_join = Students_joined_hub.objects.filter(
                student=current_student_name, 
                hub=hub, 
                hub_owner=hub_owner
            ).exists()

            if existing_join:
                return JsonResponse({'success': False, 'error': f'You are a member of {hub_name} room '})


            # Create and save the relationship if the student is not already in the hub
            Students_joined_hub.objects.create(student=current_student_name, hub=hub, hub_owner=hub_owner)

            # Return success response
            return JsonResponse({'success': True, 'message': f'You successfully joined {hub_name}'})

        except Exception as e:
            logger.debug(f"Error: {str(e)}")  # Debugging
            return JsonResponse({'success': False, 'error': str(e)})

    return JsonResponse({'success': False, 'error': 'Invalid method'})




""" STUDENTS PROFILE PAGES"""

def student_profile_page(request):
    return render(request,"myapp/students/students_profile.html")




def student_profile_page_my_profile(request):
    student_name=get_student_user_id(request)
    details=get_user_by_name(student_name)
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
            print("I have returned this to the profile page for students")
            return render(request, 'myapp/students/profile/student_profile_my_profile.html', profile_data) # Render the template with the data
        else:
            # User profile not found, render with default data
            return render(request, 'myapp/students/profile/student_profile_my_profile.html', {
                'name': student_name,
                'followers': 0,
                'followings': 0,
                'profile_picture': 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png',
                'websites': [],
                'bio': '',
                'created_at': "None",
            })

    except Exception as e:
        print(f"Error fetching user profile: {e}")
        # Handle error (render with default data or show an error page)
        return render(request, 'myapp/students/profile/student_profile_my_profile.html', {
                'name': student_name,
                'followers': 0,
                'followings': 0,
                'profile_picture': 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png',
                'websites': [],
                'bio': '',
                'created_at': "None",
            })






def student_profile_page_securty_settings(request):
    return render(request,"myapp/students/profile/student_profile_securty_settings.html")

def student_profile_page_activity_contribution(request):
    return render(request,"myapp/students/profile/student_profile_activity_contribution.html")