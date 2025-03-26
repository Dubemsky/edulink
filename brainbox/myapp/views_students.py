import logging
from .firebase import *
from django.db.models import Q
from .hub_functionality import *
from django.shortcuts import render
from .profile_page_updates import (
    get_user_by_name,
    store_image_in_firebase
)
from .user_activity import *
from django.http import JsonResponse
from django.shortcuts import redirect
from urllib.parse import urlparse
from django.views.decorators.csrf import csrf_exempt
from .models import *
from .messages import *


from django.contrib import messages
from django.http import HttpResponseRedirect, Http404
from django.urls import reverse
from django.core.exceptions import PermissionDenied
from .email_verification import *



logger = logging.getLogger(__name__)




"""
-----------------------------------------------------------------------
---------------------- STUDENTS SECTIONS ------------------------------
-----------------------------------------------------------------------

"""




from datetime import datetime, timedelta

def calculate_days_remaining(verification_initiated):
    if not verification_initiated:
        return 14  # Default to 14 days if missing

    try:
        initiation_date = datetime.strptime(verification_initiated, "%Y-%m-%d %H:%M:%S")
        expiration_date = initiation_date + timedelta(days=14)
        remaining_days = (expiration_date - datetime.now()).days
        return max(remaining_days, 0)
    except ValueError:
        return 14  # Fallback in case of parsing error



def get_verification_status(user_id):
    """
    Fetches the verification status of a student from Firestore based on their user ID.
    
    Args:
        user_id (str): The unique identifier of the user.
    
    Returns:
        dict: Verification status details or None if not found.
    """
    try:
        user_ref = db.collection('users_profile').document(user_id)
        user_doc = user_ref.get()
        
        if user_doc.exists:
            user_data = user_doc.to_dict()
            verification_status = user_data.get('verified', 'unknown')
            verification_initiated = user_data.get('verification_initiated')
            
            days_remaining = None
            if verification_initiated:
                initiated_date = datetime.strptime(verification_initiated, "%Y-%m-%d %H:%M:%S")
                days_remaining = max(0, 14 - (datetime.now() - initiated_date).days)
            
            return {
                'status': verification_status,
                'days_remaining': days_remaining
            }
        else:
            print(f"User with ID {user_id} not found.")
            return None
    except Exception as e:
        print(f"Error fetching verification status: {e}")
        return None
    

def students_homepage(request):
    current_student = request.session.get("students_name")
    student_name = get_student_user_id(request)
    details = get_user_by_name(student_name)
    user_id = details.get('uid')

    students_hubs = []
    notifications = []
    number_of_nofications = 0
    verification_status = {'status': 'pending', 'days_remaining': None}

    if current_student:
        # Get the hubs students joined based on their name.
        students_hubs_queryset = Students_joined_hub.objects.filter(student=current_student)

        # Create a list with additional data for each hub
        for hub_entry in students_hubs_queryset:
            hub_data = {
                'hub': hub_entry.hub,
                'hub_owner': hub_entry.hub_owner,
                'room_url': hub_entry.hub.room_url,
                'member_count': get_hub_member_count(hub_entry.hub.room_url)
            }
            students_hubs.append(hub_data)

        # Fetch notifications
        notifications = get_notifications_by_username(current_student)
        number_of_nofications = len(notifications)

        # Retrieve verification status from Firestore
        if user_id:
            verification_status = get_verification_status(user_id) or {'status': 'pending', 'days_remaining': None}

    return render(request, "myapp/students/students_homepage.html", {
        "students_hubs": students_hubs, 
        "number_of_hubs": len(students_hubs),
        "notifications": notifications,
        "number_of_nofications": number_of_nofications,
        "username": current_student,
        "user_id": user_id,
        "verification_status": verification_status
    })




def students_join_hub_page(request):
    student_name = get_student_user_id(request)
    details = get_user_by_name(student_name)
    user_id = details.get('uid')
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

        
        return render(request, "myapp/students/join_hub_page.html", {
            "teachers_hubs":hubs,
            "number_of_hubs":number_of_hubs,
            "user_id":user_id,

        })

    teachers_hubs = Teachers_created_hub.objects.filter(hub_privacy_setting='public')
    number_of_hubs=len(teachers_hubs)
    return render(request, "myapp/students/join_hub_page.html", {
        "teachers_hubs":teachers_hubs,
        "number_of_hubs":number_of_hubs,
        "user_id":user_id,

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
            student_name = get_student_user_id(request)
            details = get_user_by_name(student_name)
            user_id = details.get('uid')

            # Check if the student is logged in
            if not current_student_name:
                return JsonResponse({'success': False, 'error': 'Student not logged in.'})

            logger.debug(f"Student Name: {current_student_name} joining {hub_name}")

            # Get the hub from Teachers_created_hub table 
            try:
                hub = Teachers_created_hub.objects.get(hub_name=hub_name, hub_owner=hub_owner)
            except Teachers_created_hub.DoesNotExist:
                return JsonResponse({'success': False, 'error': 'Hub not found.'})

            # Check if the student is already in the hub
            existing_join = Students_joined_hub.objects.filter(
                student=current_student_name, 
                hub=hub, 
                hub_owner=hub_owner
            ).exists()

            if existing_join:
                return JsonResponse({'success': False, 'error': f'You are a member of {hub_name} room '})

            # Create and save the relationship
            hub_join = Students_joined_hub.objects.create(student=current_student_name, hub=hub, hub_owner=hub_owner)
            
            # Track the activity
            try:
                # Simple way to track activity
                track_hub_join(current_student_name, hub_name, hub.id)
            except Exception as activity_error:
                # Log error but continue - activity tracking is non-critical
                logger.error(f"Error tracking hub join activity: {activity_error}")

            # Return success response
            return JsonResponse({'success': True, 'message': f'You successfully joined {hub_name}',"user_id":user_id,})

        except Exception as e:
            logger.error(f"Error joining hub: {str(e)}")
            return JsonResponse({'success': False, 'error': str(e)})

    return JsonResponse({'success': False, 'error': 'Invalid method'})


""" STUDENTS PROFILE PAGES """

def student_profile_page(request):
    return render(request,"myapp/students/students_profile.html")


def student_profile_page_my_profile(request):
    """
    View for student profile page with improved followers/followings support
    """
    student_name = get_student_user_id(request)
    details = get_user_by_name(student_name)
    user_id = details.get('uid')
    if not student_name or not details:
        # Handle case where user is not found
        return render(request, 'myapp/students/profile/student_profile_my_profile.html', {
            'error': 'User not found. Please log in again.',
            'student': {'name': ''},
            'active_tab': 'my_profile'
        })
    
    user_id = details.get('uid')
    
    # Handle profile picture upload
    if request.method == 'POST' and 'profile_pic' in request.FILES:
        profile_pic = request.FILES['profile_pic']
        store_image_in_firebase(profile_pic, student_name, user_id)
        return redirect('student_profile_page_my_profile')
    
    # GET request - fetch and display profile data
    try:
        # Get user profile from Firebase
        users_ref = db.collection('users_profile')
        user_doc = users_ref.document(user_id).get()
        
        if user_doc.exists:
            user_data = user_doc.to_dict()
            
            # Get hub count
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
            
            # Get followers and followings count
            followers = user_data.get('followers', 0)
            followings = user_data.get('followings', 0)
            
            # Prepare context data
            context = {
                'student': {
                    'name': user_data.get('name', ''),
                    'email': details.get('email', ''),
                    'student_id': user_id,
                    'grade': user_data.get('grade', ''),
                    'followers': followers,
                    'followings': followings,
                    'bio': user_data.get('bio', ''),
                    'websites': websites_data,
                    'joined_date': user_data.get('created_at', "None"),
                    'hubs_count': hub_count,
                },
                'profile_picture': user_data.get('profile_picture', 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'),
                'active_tab': 'my_profile'
            }
            
            return render(request, 'myapp/students/profile/student_profile_my_profile.html', context)
        else:
            # Handle case where user profile doesn't exist in Firestore
            # Initialize with default values including followers/followings
            context = {
                'student': {
                    'name': student_name,
                    'email': details.get('email', ''),
                    'student_id': user_id,
                    'grade': '',
                    'followers': 0,
                    'followings': 0,
                    'bio': '',
                    'websites': [],
                    'joined_date': "None",
                    'hubs_count': 0,
                },
                'profile_picture': 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png',
                'active_tab': 'my_profile'
            }
            
            # Create the user profile document with default values
            users_ref.document(user_id).set({
                'name': student_name,
                'followers': 0,
                'followings': 0,
                'created_at': details.get('created_at', None)
            }, merge=True)
            
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
                'followers': 0,
                'followings': 0,
                'bio': '',
                'websites': [],
                'joined_date': "",
                'hubs_count': 0,
            },
            'profile_picture': 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png',
            'active_tab': 'my_profile'
        }
        
        return render(request, 'myapp/students/profile/student_profile_my_profile.html', context)





def student_profile_page_securty_settings(request):
    """
    View function to display and manage security settings
    """
    student_name = get_student_user_id(request)
    
    if not student_name:
        return redirect('first_page')
    
    # Get user details
    details = get_user_by_name(student_name)
    if not details or not details.get('uid'):
        messages.error(request, 'User not found. Please log in again.')
        return redirect('first_page')
    
    user_id = details.get('uid')
    
    # Get verification status
    verification_status = check_account_verification_status(user_id)
    
    # Default privacy settings (can be loaded from database in the future)
    privacy = {
        'profile_visibility': 'public',
        'activity_visibility': 'public',
        'show_online_status': True
    }
    
    # Default notification settings
    notifications = {
        'email_notifications': True,
        'question_replies': True,
        'hub_updates': True,
        'upvotes_mentions': True
    }
    
    context = {
        'verification_status': verification_status,
        'privacy': privacy,
        'notifications': notifications,
        'active_tab': 'security'
    }

    print(f"This is the content of the ting {student_name} {context}")
    
    return render(request, "myapp/students/profile/student_profile_securty_settings.html", context)


def verify_email(request, token):
    """
    View function to handle email verification links
    """
    if not token:
        messages.error(request, 'Invalid verification link.')
        return redirect('first_page')
    
    # Verify the token
    verify_result = verify_email_token(token)
    
    if verify_result['success']:
        messages.success(request, 'Your email has been successfully verified. You can now fully access your account.')
        # Redirect to login if not logged in, or to dashboard if logged in
        if request.session.get('students_name'):
            return redirect('students_homepage')
        else:
            return redirect('login_page')
    else:
        messages.error(request, verify_result['error'])
        return redirect('first_page')


def resend_verification_email(request):
    """
    View function to resend verification email
    """
    if request.method != 'POST':
        raise Http404('Only POST requests are allowed')
    
    student_name = get_student_user_id(request)
    
    if not student_name:
        messages.error(request, 'You must be logged in to request a verification email.')
        return redirect('first_page')
    
    # Get user details
    details = get_user_by_name(student_name)
    if not details or not details.get('uid'):
        messages.error(request, 'User not found. Please log in again.')
        return redirect('first_page')
    
    user_id = details.get('uid')
    email = details.get('email')
    
    # Generate new verification token
    verification_token = generate_email_verification_token(user_id)
    
    # Send verification email
    if send_verification_email(email, student_name, verification_token):
        messages.success(request, 'Verification email has been sent. Please check your inbox.')
    else:
        messages.error(request, 'Failed to send verification email. Please try again later.')
    
    # Redirect back to security settings
    return HttpResponseRedirect(reverse('student_profile_page_securty_settings'))




def change_password(request):
    """
    View function to handle password change requests
    """
    if request.method != 'POST':
        raise Http404('Only POST requests are allowed')
    
    student_name = get_student_user_id(request)
    
    if not student_name:
        messages.error(request, 'You must be logged in to change your password.')
        return redirect('first_page')
    
    # Get user details
    details = get_user_by_name(student_name)
    if not details or not details.get('uid'):
        messages.error(request, 'User not found. Please log in again.')
        return redirect('first_page')
    
    user_id = details.get('uid')
    
    # Get form data
    current_password = request.POST.get('current_password')
    new_password = request.POST.get('new_password')
    confirm_password = request.POST.get('confirm_password')
    
    # Validate form data
    if not current_password or not new_password or not confirm_password:
        messages.error(request, 'All password fields are required.')
        return HttpResponseRedirect(reverse('student_profile_page_securty_settings'))
    
    if new_password != confirm_password:
        messages.error(request, 'New passwords do not match.')
        return HttpResponseRedirect(reverse('student_profile_page_securty_settings'))
    
    # Basic password strength validation
    if len(new_password) < 8:
        messages.error(request, 'Password must be at least 8 characters long.')
        return HttpResponseRedirect(reverse('student_profile_page_securty_settings'))
    
    if not any(char.isdigit() for char in new_password):
        messages.error(request, 'Password must include at least one number.')
        return HttpResponseRedirect(reverse('student_profile_page_securty_settings'))
    
    if not any(char in '!@#$%^&*(),.?":{}|<>' for char in new_password):
        messages.error(request, 'Password must include at least one special character.')
        return HttpResponseRedirect(reverse('student_profile_page_securty_settings'))
    
    # Change the password
    result = change_user_password(user_id, current_password, new_password)
    
    if result['success']:
        messages.success(request, 'Your password has been updated successfully.')
    else:
        messages.error(request, result['error'])
    
    # Redirect back to security settings
    return HttpResponseRedirect(reverse('student_profile_page_securty_settings'))



def student_profile_page_activity_contribution(request):
    """
    View function to display the student's activity and contributions
    
    Shows:
    - Activity overview stats
    - Recent activity timeline
    - Followers/following stats
    """
    from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
    import datetime
    
    student_name = get_student_user_id(request)
    
    if not student_name:
        # Handle case where user is not logged in
        return redirect('first_page')
    
    # Get the filter parameter, default to 'all'
    activity_filter = request.GET.get('filter', 'all')
    
    # Get user details
    details = get_user_by_name(student_name)
    if not details or not details.get('uid'):
        return render(request, 'myapp/students/profile/student_profile_activity_contribution.html', {
            'error': 'User not found',
            'activities': [],
            'stats': {},
            'filter': activity_filter,
            'active_tab': 'activity'
        })
    
    user_id = details.get('uid')
    
    # Get user profile data including followers/following
    try:
        users_ref = db.collection('users_profile')
        user_doc = users_ref.document(user_id).get()
        if user_doc.exists:
            user_data = user_doc.to_dict()
            followers = user_data.get('followers', 0)
            followings = user_data.get('followings', 0)
        else:
            followers = 0
            followings = 0
    except Exception as e:
        print(f"Error fetching user profile: {e}")
        followers = 0
        followings = 0
    
    # Get hub count
    try:
        hub_count = Students_joined_hub.objects.filter(student=student_name).count()
    except Exception as e:
        print(f"Error fetching hub count: {e}")
        hub_count = 0
    
    # Initialize empty list for activities
    activities = []
    
    # Dummy counts for now - you'll need to connect these to your actual models
    questions_count = 0
    answers_count = 0
    posts_count = 0
    
    # Build stats dictionary
    stats = {
        'questions_count': questions_count,
        'answers_count': answers_count,
        'posts_count': posts_count,
        'hubs_count': hub_count
    }
    
    # Get activities from Firestore if available
    try:
        activities_ref = db.collection('user_activities')
        query = activities_ref.where('user_id', '==', user_id).order_by('created_at', direction='DESCENDING')
        
        # Apply filter if not 'all'
        if activity_filter == 'questions':
            query = query.where('type', '==', 'question')
        elif activity_filter == 'answers':
            query = query.where('type', '==', 'answer')
        elif activity_filter == 'posts':
            query = query.where('type', '==', 'post')
        elif activity_filter == 'hubs':
            query = query.where('type', '==', 'hub_joined')
        
        activity_docs = query.stream()  # Use stream() instead of get() for more efficient iteration
        
        # Process activity documents
        for doc in activity_docs:
            activity_data = doc.to_dict()
            # Add document ID to the data
            activity_data['id'] = doc.id
            
            # Format timestamps for display
            if 'created_at' in activity_data and activity_data['created_at']:
                if isinstance(activity_data['created_at'], (int, float)):
                    # Convert timestamp to datetime if stored as timestamp
                    activity_data['created_at'] = datetime.datetime.fromtimestamp(activity_data['created_at'])
            
            activities.append(activity_data)
    except Exception as e:
        print(f"Error fetching activities from Firestore: {e}")
    
    # If no activities found in Firestore, add recent hub joins from Django model
    if not activities and (activity_filter == 'all' or activity_filter == 'hubs'):
        try:
            hub_joins = Students_joined_hub.objects.filter(student=student_name).order_by('-id')[:10]
            
            for join in hub_joins:
                # For safety, check if the join has all needed attributes before adding
                try:
                    activities.append({
                        'id': f"hub_{join.id}",
                        'type': 'hub_joined',
                        'user_id': user_id,
                        'hub_id': join.hub.id if hasattr(join.hub, 'id') else '',
                        'hub_name': join.hub.hub_name if hasattr(join.hub, 'hub_name') else 'Unknown Hub',
                        'created_at': datetime.datetime.now(),  # Fallback to current time if no timestamp
                        'content': f"Joined a hub"
                    })
                except Exception as inner_e:
                    print(f"Error processing hub join: {inner_e}")
                    continue
        except Exception as e:
            print(f"Error fetching hub joins from database: {e}")
    
    # Paginate the activities
    page = request.GET.get('page', 1)
    paginator = Paginator(activities, 10)  # 10 activities per page
    
    try:
        paginated_activities = paginator.page(page)
    except PageNotAnInteger:
        paginated_activities = paginator.page(1)
    except EmptyPage:
        paginated_activities = paginator.page(paginator.num_pages)
    
    # Prepare context with student data
    context = {
        'student': {
            'name': student_name,
            'followers': followers,
            'followings': followings,
            'hubs_count': hub_count,
        },
        'activities': paginated_activities,
        'stats': stats,
        'filter': activity_filter,
        'active_tab': 'activity'
    }
    
    return render(request, 'myapp/students/profile/student_profile_activity_contribution.html', context)











def get_student_user_id(request):
    """
    Helper function to get the student name from the session
    """
    return request.session.get("students_name")