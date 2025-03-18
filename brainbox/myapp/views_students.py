import logging
from .firebase import *
from django.db.models import Q
from .hub_functionality import *
from django.shortcuts import render
from .profile_page_updates import *
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import *
from .messages import *

logger = logging.getLogger(__name__)


"""
-----------------------------------------------------------------------
---------------------- STUDENTS SECTIONS ------------------------------
-----------------------------------------------------------------------

"""


def students_homepage(request):
    current_student = request.session.get("students_name")
    
    if current_student:
        # Get the hubs students joined based on their name.
        students_hubs_queryset = Students_joined_hub.objects.filter(student=current_student)
        
        # Create a list with additional data for each hub
        students_hubs = []
        for hub_entry in students_hubs_queryset:
            hub_data = {
                'hub': hub_entry.hub,
                'hub_owner': hub_entry.hub_owner,
                'room_url': hub_entry.hub.room_url,
                'member_count': get_hub_member_count(hub_entry.hub.room_url)
            }
            students_hubs.append(hub_data)

       

            
        notifications = get_notifications_by_username(current_student)
        number_of_nofications = len(notifications)
        
    return render(request, "myapp/students/students_homepage.html", {
        "students_hubs": students_hubs, 
        "number_of_hubs":len(students_hubs),
        "notifications": notifications,
        "number_of_nofications": number_of_nofications,
        "username": current_student
    })



def students_join_hub_page(request):

    if request.method == 'POST':
        print("This is me")
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

        print(f"\n\n\n{hubs}")
        
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
    """
    View for student profile page that doesn't rely on base_profile.html
    """
    from django.shortcuts import redirect
    from urllib.parse import urlparse
    
    student_name = get_student_user_id(request)
    details = get_user_by_name(student_name)
    user_id = details.get('uid')
    
    if not user_id:
        # Handle case where user is not found
        return render(request, 'myapp/students/profile/student_profile_my_profile.html', {
            'error': 'User not found. Please log in again.',
            'student': {'name': ''}
        })
    
    # Handle profile form updates
    if request.method == 'POST':
        if 'profile_pic' in request.FILES:
            # Handle profile picture upload
            profile_pic = request.FILES['profile_pic']
            store_image_in_firebase(profile_pic, student_name, user_id)
            return redirect('student_profile_page_my_profile')
        
        elif request.POST.get('type') == 'profile':
            # Handle profile data updates
            bio = request.POST.get('bio')
            grade = request.POST.get('grade')
            
            # Process websites
            website_urls = request.POST.getlist('website_url[]')
            websites = [url for url in website_urls if url]
            
            # Update user profile in Firebase
            updates = {}
            if bio is not None:
                updates['bio'] = bio
            if grade:
                updates['grade'] = grade
            
            # Apply updates
            if updates:
                update_user_profile(user_id, updates)
            
            # Update websites
            if websites:
                update_user_websites(user_id, websites)
                
            return redirect('student_profile_page_my_profile')
    
    # GET request - fetch and display profile data
    try:
        # Get user profile from Firebase
        users_ref = db.collection('users_profile')
        user_doc = users_ref.document(user_id).get()
        
        if user_doc.exists:
            user_data = user_doc.to_dict()
            
            # Get hub count if needed
            try:
                hub_count = Students_joined_hub.objects.filter(student=student_name).count()
            except:
                hub_count = 0
            
            # Process websites data
            websites_data = []
            raw_websites = user_data.get('websites', [])
            
            if raw_websites:
                for website in raw_websites:
                    if website:  # Skip None values
                        try:
                            parsed_url = urlparse(website)
                            domain = parsed_url.netloc or parsed_url.path.split('/')[0]
                            websites_data.append({
                                'name': domain,
                                'url': website
                            })
                        except:
                            websites_data.append({
                                'name': website,
                                'url': website
                            })
            
            # Prepare context data
            context = {
                'student': {
                    'name': user_data.get('name', ''),
                    'email': details.get('email', ''),
                    'student_id': user_id,
                    'grade': user_data.get('grade', ''),
                    'followers': user_data.get('followers', 0),
                    'followings': user_data.get('followings', 0),
                    'bio': user_data.get('bio', ''),
                    'websites': websites_data,
                    'joined_date': user_data.get('created_at', "None"),
                    'hubs_count': hub_count,
                },
                'profile_picture': user_data.get('profile_picture', 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'),
            }
            
            return render(request, 'myapp/students/profile/student_profile_my_profile.html', context)
        else:
            # Handle case where user profile doesn't exist in Firestore
            context = {
                'student': {
                    'name': student_name,
                    'email': details.get('email', ''),
                    'student_id': user_id,
                    'grade': '',
                    'bio': '',
                    'websites': [],
                    'joined_date': "None",
                },
                'profile_picture': 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png',
            }
            
            return render(request, 'myapp/students/profile/student_profile_my_profile.html', context)
            
    except Exception as e:
        print(f"Error fetching user profile: {e}")
        # Handle error case
        context = {
            'error': f"An error occurred while loading your profile: {str(e)}",
            'student': {
                'name': student_name,
                'email': '',
                'student_id': '',
                'grade': '',
                'bio': '',
                'websites': [],
                'joined_date': "",
            },
            'profile_picture': 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png',
        }
        
        return render(request, 'myapp/students/profile/student_profile_my_profile.html', context)


    
def get_user_by_name(display_name):
    """
    Fetches user details by display name from Firebase Authentication.
    Returns a dictionary with user details or an empty dictionary if user not found.
    """
    try:
        # Get all users
        users = auth.list_users().users
        
        # Find the user with the matching display name
        for user in users:
            if user.display_name == display_name:
                # Create a dictionary with user details
                user_details = {
                    'uid': user.uid,
                    'email': user.email,
                    'display_name': user.display_name,
                    'created_at': format_timestamp(user.user_metadata.creation_timestamp) if hasattr(user.user_metadata, 'creation_timestamp') else None
                }
                
                # Get user's role from custom claims
                if hasattr(user, '_data') and 'customAttributes' in user._data:
                    custom_attributes_str = user._data['customAttributes']
                    custom_attributes = json.loads(custom_attributes_str)
                    user_details['role'] = custom_attributes.get('role')
                
                return user_details
        
        # Return empty dictionary if user not found
        return {}
    
    except Exception as e:
        print(f"Error retrieving user by name: {e}")
        return {}


def update_user_profile(user_id, profile_data):
    """
    Updates multiple fields in the user's profile in Firestore.

    Args:
        user_id: The unique ID of the user.
        profile_data: Dictionary containing fields to update.

    Returns:
        True if the update is successful, False otherwise.
    """
    try:
        users_ref = db.collection('users_profile')
        users_ref.document(user_id).update(profile_data)
        print(f"Profile for user {user_id} updated successfully.")
        return True
    except Exception as e:
        print(f"Error updating profile: {e}")
        return False


def update_user_websites(user_id, websites):
    """
    Replaces the user's 'websites' list in Firestore with a new list.

    Args:
        user_id: The unique ID of the user.
        websites: List of website URLs to set.

    Returns:
        True if the update is successful, False otherwise.
    """
    try:
        # Filter out empty website entries
        valid_websites = [website for website in websites if website]
        
        users_ref = db.collection('users_profile')
        users_ref.document(user_id).update({'websites': valid_websites})
        print(f"Websites for user {user_id} updated successfully with {len(valid_websites)} sites.")
        return True
    except Exception as e:
        print(f"Error updating websites: {e}")
        return False
        
    
def update_user_profile(user_id, profile_data):
    """
    Updates multiple fields in the user's profile in Firestore.

    Args:
        user_id: The unique ID of the user.
        profile_data: Dictionary containing fields to update.

    Returns:
        True if the update is successful, False otherwise.
    """
    try:
        users_ref = db.collection('users_profile')
        users_ref.document(user_id).update(profile_data)
        print(f"Profile for user {user_id} updated successfully.")
        return True
    except Exception as e:
        print(f"Error updating profile: {e}")
        return False


def update_user_websites(user_id, websites):
    """
    Replaces the user's 'websites' list in Firestore with a new list.

    Args:
        user_id: The unique ID of the user.
        websites: List of website URLs to set.

    Returns:
        True if the update is successful, False otherwise.
    """
    try:
        # Filter out empty website entries
        valid_websites = [website for website in websites if website]
        
        users_ref = db.collection('users_profile')
        users_ref.document(user_id).update({'websites': valid_websites})
        print(f"Websites for user {user_id} updated successfully.")
        return True
    except Exception as e:
        print(f"Error updating websites: {e}")
        return False


def update_profile_picture_view(request):
    """
    View function to handle profile picture uploads
    """
    if request.method == 'POST' and request.FILES.get('profile_picture'):
        try:
            # Get current user info
            student_name = get_student_user_id(request)
            details = get_user_by_name(student_name)
            user_id = details.get('uid')
            
            if not user_id:
                return JsonResponse({'success': False, 'error': 'User not found'})
                
            # Get the uploaded image
            profile_picture = request.FILES['profile_picture']
            
            # Upload to Firebase Storage
            result = store_image_in_firebase(profile_picture, student_name, user_id)
            
            if result:
                return JsonResponse({'success': True, 'message': 'Profile picture updated successfully'})
            else:
                return JsonResponse({'success': False, 'error': 'Failed to update profile picture'})
                
        except Exception as e:
            print(f"Error updating profile picture: {e}")
            return JsonResponse({'success': False, 'error': str(e)})
            
    return JsonResponse({'success': False, 'error': 'Invalid request'})



























def student_profile_page_securty_settings(request):
    return render(request,"myapp/students/profile/student_profile_securty_settings.html")

def student_profile_page_activity_contribution(request):
    return render(request,"myapp/students/profile/student_profile_activity_contribution.html")