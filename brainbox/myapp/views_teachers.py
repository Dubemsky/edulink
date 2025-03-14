import logging
from .hub_functionality import *
from django.http import JsonResponse
from django.shortcuts import render
from.profile_page_updates import *
from .firebase import *
import datetime
from .messages import *
from django.shortcuts import render, redirect



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
        number_of_nofications = len(notifications)

    return render(request, "myapp/teachers/teachers_homepage.html", {
        "teachers_hubs": teachers_hubs,
        "number_of_hubs" : len(teachers_hubs),
        "notifications": notifications,
        "number_of_notifications": number_of_nofications,
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
    teacher_name = get_teacher_user_id(request)
    details = get_user_by_name(teacher_name)
    user_id = details.get('uid') 
    notification = request.GET.get('notification', None)
    notification_type = request.GET.get('type', 'success')

    try:
        users_ref = db.collection('users_profile')
        user_doc = users_ref.document(user_id).get()
        
        if user_doc.exists:
            user_data = user_doc.to_dict()
            
            # Get hub count for teacher stats
            hub_count = Teachers_created_hub.objects.filter(hub_owner=teacher_name).count()
            
            # Calculate total students across all hubs
            total_students = 0
            for hub in Teachers_created_hub.objects.filter(hub_owner=teacher_name):
                total_students += get_hub_member_count(hub.room_url)
            
            # Prepare data to send to the template
            profile_data = {
                'name': user_data.get('name', ''),
                'email': user_data.get('email', ''),
                'subject': user_data.get('subject', ''),
                'years_experience': user_data.get('years_experience', ''),
                'followers': user_data.get('followers', 0),
                'followings': user_data.get('followings', 0),
                'profile_picture': user_data.get('profile_picture', 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'),
                'websites': user_data.get('websites', []),
                'qualifications': user_data.get('qualifications', []),
                'bio': user_data.get('bio', ''),
                'created_at': user_data.get('created_at', "January 1, 2023"),
                'hub_count': hub_count,
                'active_tab': 'my_profile',
                'student_count': 0,
            }

            
            return render(request, 'myapp/teachers/profile/teachers_profile_my_profile.html', profile_data)
        else:
            # User profile not found, render with default data
            return render(request, 'myapp/teachers/profile/teachers_profile_my_profile.html', {
                'name': teacher_name,
                'followers': 0,
                'followings': 0,
                'profile_picture': 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png',
                'websites': [],
                'qualifications': [],
                'bio': '',
                'subject': '',
                'years_experience': '',
                'school': '',
                'created_at': "January 1, 2023",
                'hub_count': 0,
                'active_tab': 'my_profile',
                'student_count': 0,
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
                'qualifications': [],
                'bio': '',
                'subject': '',
                'years_experience': '',
                'school': '',
                'created_at': "January 1, 2023",
                'hub_count': 0,
                'student_count': 0,
            })




def teacher_profile_update(request):
    """Handle teacher profile updates, including basic info, bio, websites, and qualifications"""
    if request.method != "POST":
        return JsonResponse({"success": False, "error": "Invalid request method"}, status=405)
    
    # Get the current teacher's user ID
    teacher_name = get_teacher_user_id(request)
    if not teacher_name:
        return JsonResponse({"success": False, "error": "Not authenticated"}, status=401)
    
    # Get user details from Firebase
    details = get_user_by_name(teacher_name)
    user_id = details.get('uid')
    if not user_id:
        return JsonResponse({"success": False, "error": "User not found"}, status=404)
    
    users_ref = db.collection('users_profile')
    user_doc_ref = users_ref.document(user_id)
    
    try:
        # Determine the type of update
        update_type = request.POST.get('type', 'profile')
        
        if update_type == 'profile':
            # Handle basic profile information update
            update_data = {
                'name': request.POST.get('name', ''),
                'subject': request.POST.get('subject', ''),
                'years_experience': request.POST.get('years_experience', ''),
                'school': request.POST.get('school', ''),
                'bio': request.POST.get('bio', ''),
                'last_updated': datetime.datetime.now()
            }
            
            # Handle qualifications
            qualifications = []
            degrees = request.POST.getlist('qualification_degree[]', [])
            institutions = request.POST.getlist('qualification_institution[]', [])
            years = request.POST.getlist('qualification_year[]', [])
            
            # Only add qualifications that have at least a degree specified
            for i in range(len(degrees)):
                if degrees[i].strip():
                    qualification = {
                        'degree': degrees[i],
                        'institution': institutions[i] if i < len(institutions) else '',
                        'year': years[i] if i < len(years) else ''
                    }
                    qualifications.append(qualification)
            
            update_data['qualifications'] = qualifications
            
            # Handle websites
            websites = []
            website_names = request.POST.getlist('website_name[]', [])
            website_urls = request.POST.getlist('website_url[]', [])
            
            # Only add websites that have a URL specified
            for i in range(len(website_urls)):
                if website_urls[i].strip():
                    website = {
                        'name': website_names[i] if i < len(website_names) and website_names[i].strip() else website_urls[i],
                        'url': website_urls[i]
                    }
                    websites.append(website)
            
            update_data['websites'] = websites
            
            # Update the document in Firebase
            user_doc_ref.update(update_data)
            
            return redirect('teacher_profile_page_my_profile')
            
        elif update_type == 'pic':
            # Handle profile picture update
            profile_pic = request.FILES.get('profile_pic')
            if profile_pic:
                # Upload the image to Firebase Storage and get the URL
                storage_path = f"profile_pictures/{user_id}/{profile_pic.name}"
                blob = storage.blob(storage_path)
                blob.upload_from_file(profile_pic)
                
                # Make the image publicly accessible
                blob.make_public()
                
                # Get the public URL
                pic_url = blob.public_url
                
                # Update the profile picture URL in the user document
                user_doc_ref.update({
                    'profile_picture': pic_url,
                    'last_updated': datetime.datetime.now()
                })
                
                return JsonResponse({"success": True, "url": pic_url})
            else:
                return JsonResponse({"success": False, "error": "No image file provided"}, status=400)
        
        else:
            return JsonResponse({"success": False, "error": "Invalid update type"}, status=400)
    
    except Exception as e:
        print(f"Error updating teacher profile: {e}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)


def teacher_profile_update_pic(request):
    """Handle teacher profile picture updates"""
    if request.method != "POST":
        return JsonResponse({"success": False, "error": "Invalid request method"}, status=405)
    
    # Get the current teacher's user ID
    teacher_name = get_teacher_user_id(request)
    if not teacher_name:
        return JsonResponse({"success": False, "error": "Not authenticated"}, status=401)
    
    # Get user details from Firebase
    details = get_user_by_name(teacher_name)
    user_id = details.get('uid')
    if not user_id:
        return JsonResponse({"success": False, "error": "User not found"}, status=404)
    
    try:
        profile_pic = request.FILES.get('profile_pic')
        if not profile_pic:
            return JsonResponse({"success": False, "error": "No image file provided"}, status=400)
        
        # Create a reference to the Firebase storage bucket
        bucket = storage.bucket()
        
        # Create a unique filename
        timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        file_extension = profile_pic.name.split('.')[-1]
        filename = f"{user_id}_{timestamp}.{file_extension}"
        
        # Create a blob and upload the file
        blob = bucket.blob(f"profile_pictures/{filename}")
        blob.upload_from_file(profile_pic, content_type=profile_pic.content_type)
        
        # Make the blob publicly accessible
        blob.make_public()
        
        # Get the public URL
        pic_url = blob.public_url
        
        # Update the user's profile in Firestore
        db.collection('users_profile').document(user_id).update({
            'profile_picture': pic_url,
            'last_updated': datetime.datetime.now()
        })
        
        # Redirect back to the profile page with a success message
        return redirect('teacher_profile_page_my_profile')
    
    except Exception as e:
        print(f"Error updating profile picture: {e}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)


















def teacher_profile_page_securty_settings(request):
    return render(request,"myapp/teachers/profile/teachers_profile_securty_settings.html")

def teacher_profile_page_activity_contribution(request):
    return render(request,"myapp/teachers/profile/teachers_profile_activity_contribution.html")