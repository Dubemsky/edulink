import logging
from .hub_functionality import *
from django.http import JsonResponse
from django.shortcuts import render
from .profile_page_updates import *
from .firebase import *
from .user_activity import *
from .messages import *
from django.shortcuts import render, redirect
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger


logger = logging.getLogger(__name__)

"""
-----------------------------------------------------------------------
---------------------- TEACHERS SECTIONS ------------------------------
-----------------------------------------------------------------------

"""

def get_teacher_user_id(request):
    """Helper function to get the teacher name from the session"""
    return request.session.get("teachers_name")


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
            hub_image = request.FILES.get('hubImage',"none")

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
            hub = Teachers_created_hub.objects.create(
                hub_owner=current_teacher,
                hub_name=hub_name,
                hub_description=description,
                hub_image=hub_image,
                hub_privacy_setting=privacy_setting,
            )
            
            # Track activity for hub creation
            try:
                # Get teacher Firebase UID
                teacher_details = get_user_by_name(current_teacher)
                if teacher_details and teacher_details.get('uid'):
                    user_id = teacher_details.get('uid')
                    track_user_activity(
                        user_id=user_id,
                        activity_type='hub_activity',
                        content=f"Created a new hub: {hub_name}",
                        hub_id=hub.id,
                        hub_name=hub_name,
                        action="created hub"
                    )
            except Exception as e:
                # Log error but continue - activity tracking is non-critical
                logger.error(f"Error tracking hub creation activity: {e}")

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


""" TEACHERS PROFILE PAGES """

def teachers_profile_page(request):
    return render(request,"myapp/teachers/teachers_profile.html")


def teacher_profile_page_my_profile(request):
    teacher_name = get_teacher_user_id(request)
    details = get_user_by_name(teacher_name)
    
    if not teacher_name or not details:
        return redirect('first_page')
        
    user_id = details.get('uid') 
    notification = request.GET.get('notification', None)
    notification_type = request.GET.get('type', 'success')
    
    # Handle profile picture upload
    if request.method == 'POST' and 'profile_pic' in request.FILES:
        profile_pic = request.FILES['profile_pic']
        store_image_in_firebase(profile_pic, teacher_name, user_id)
        return redirect('teacher_profile_page_my_profile')

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
                'email': details.get('email', ''),
                'subject': user_data.get('subject', ''),
                'years_experience': user_data.get('years_experience', ''),
                'school': user_data.get('school', ''),
                'followers': user_data.get('followers', 0),
                'followings': user_data.get('followings', 0),
                'profile_picture': user_data.get('profile_picture', 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'),
                'websites': user_data.get('websites', []),
                'qualifications': user_data.get('qualifications', []),
                'bio': user_data.get('bio', ''),
                'created_at': format_timestamp(details.get('created_at')) if details.get('created_at') else "January 1, 2023",
                'hub_count': hub_count,
                'active_tab': 'my_profile',
                'student_count': total_students,
            }
            
            return render(request, 'myapp/teachers/profile/teachers_profile_my_profile.html', profile_data)
        else:
            # User profile not found, render with default data
            return render(request, 'myapp/teachers/profile/teachers_profile_my_profile.html', {
                'name': teacher_name,
                'email': details.get('email', ''),
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
                'email': details.get('email', ''),
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
                'active_tab': 'my_profile',
            })


def teachers_profile_update(request):
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
                'last_updated': int(time.time())
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
            users_ref = db.collection('users_profile')
            users_ref.document(user_id).update(update_data)
            
            # Track activity
            try:
                track_user_activity(
                    user_id=user_id,
                    activity_type='content_creation',
                    content="Updated profile information",
                    content_title="Profile Update",
                    content_type="profile"
                )
            except Exception as activity_error:
                print(f"Error tracking profile update activity: {activity_error}")
            
            return redirect('teacher_profile_page_my_profile')
            
        elif update_type == 'pic':
            # Handle profile picture update
            profile_pic = request.FILES.get('profile_pic')
            if profile_pic:
                # Upload to Firebase Storage using the utility function
                image_url = store_image_in_firebase(profile_pic, teacher_name, user_id)
                if image_url:
                    return JsonResponse({"success": True, "url": image_url})
                else:
                    return JsonResponse({"success": False, "error": "Failed to upload image"}, status=500)
            else:
                return JsonResponse({"success": False, "error": "No image file provided"}, status=400)
        
        else:
            return JsonResponse({"success": False, "error": "Invalid update type"}, status=400)
    
    except Exception as e:
        print(f"Error updating teacher profile: {e}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)


def teacher_profile_page_securty_settings(request):
    """View function for teacher security settings page"""
    teacher_name = get_teacher_user_id(request)
    details = get_user_by_name(teacher_name)
    
    if not teacher_name or not details:
        return redirect('first_page')
        
    user_id = details.get('uid')
    
    try:
        # Get user profile from Firebase
        users_ref = db.collection('users_profile')
        user_doc = users_ref.document(user_id).get()
        
        if user_doc.exists:
            user_data = user_doc.to_dict()
            followers = user_data.get('followers', 0)
            followings = user_data.get('followings', 0)
            
            # Get hub count
            hub_count = Teachers_created_hub.objects.filter(hub_owner=teacher_name).count()
            
            # Prepare context data
            context = {
                'name': teacher_name,
                'followers': followers,
                'followings': followings,
                'profile_picture': user_data.get('profile_picture', 'https://via.placeholder.com/150'),
                'hub_count': hub_count,
                'active_tab': 'security'
            }
            
            return render(request, "myapp/teachers/profile/teachers_profile_securty_settings.html", context)
        else:
            # Default context if user profile not found
            context = {
                'name': teacher_name,
                'followers': 0,
                'followings': 0,
                'profile_picture': 'https://via.placeholder.com/150',
                'hub_count': 0,
                'active_tab': 'security'
            }
            return render(request, "myapp/teachers/profile/teachers_profile_securty_settings.html", context)
    
    except Exception as e:
        print(f"Error fetching user profile: {e}")
        # Default context for error case
        context = {
            'name': teacher_name,
            'followers': 0,
            'followings': 0,
            'profile_picture': 'https://via.placeholder.com/150',
            'hub_count': 0,
            'active_tab': 'security',
            'error': 'An error occurred while loading your profile.'
        }
        return render(request, "myapp/teachers/profile/teachers_profile_securty_settings.html", context)


def teacher_profile_page_activity_contribution(request):
    """
    View function to display the teacher's activity and analytics
    
    Shows:
    - Activity timeline
    - Analytics data
    - Followers/following stats
    """
    from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
    import datetime
    
    teacher_name = get_teacher_user_id(request)
    
    if not teacher_name:
        # Handle case where user is not logged in
        return redirect('first_page')
    
    # Get the filter parameter, default to 'all'
    activity_filter = request.GET.get('filter', 'all')
    
    # Get user details
    details = get_user_by_name(teacher_name)
    if not details or not details.get('uid'):
        return render(request, 'myapp/teachers/profile/teachers_profile_activity_contribution.html', {
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
        hub_count = Teachers_created_hub.objects.filter(hub_owner=teacher_name).count()
    except Exception as e:
        print(f"Error fetching hub count: {e}")
        hub_count = 0
    
    # Calculate total students across all hubs
    total_students = 0
    try:
        for hub in Teachers_created_hub.objects.filter(hub_owner=teacher_name):
            total_students += get_hub_member_count(hub.room_url)
    except Exception as e:
        print(f"Error calculating total students: {e}")
    
    # Initialize empty list for activities
    activities = []
    
    # Build stats dictionary with some dummy data for now
    # In a real implementation, you would calculate these from actual data
    stats = {
        'total_students': total_students,
        'student_growth': 5,  # Example value
        'student_growth_pct': 60,  # For progress bar width
        'engagement_score': 85,  # Example value
        'engagement_score_pct': 85,  # For progress bar width
        'engagement_change': 2,  # Example value
        'response_time': 8,  # Example value in hours
        'response_time_pct': 70,  # For progress bar width
    }
    
    # Get activities from Firestore
    try:
        activities_ref = db.collection('user_activities')
        query = activities_ref.where('user_id', '==', user_id).order_by('created_at', direction='DESCENDING')
        
        # Apply filter if not 'all'
        if activity_filter == 'hubs':
            query = query.where('type', '==', 'hub_activity')
        elif activity_filter == 'responses':
            query = query.where('type', '==', 'response')
        elif activity_filter == 'content':
            query = query.where('type', '==', 'content_creation')
        elif activity_filter == 'social':
            query = query.where('type', 'in', ['follow', 'followed'])
        
        activity_docs = query.stream()  # Use stream() for more efficient iteration
        
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
    
    # If no activities found, add some hub activities from Django model as fallback
    if not activities and (activity_filter == 'all' or activity_filter == 'hubs'):
        try:
            hubs = Teachers_created_hub.objects.filter(hub_owner=teacher_name).order_by('-id')[:5]
            
            for i, hub in enumerate(hubs):
                # Create dummy timestamps spaced a few days apart
                timestamp = datetime.datetime.now() - datetime.timedelta(days=i*3)
                
                activities.append({
                    'id': f"hub_created_{hub.id}",
                    'type': 'hub_activity',
                    'user_id': user_id,
                    'hub_id': hub.id,
                    'hub_name': hub.hub_name,
                    'action': 'created hub',
                    'created_at': timestamp,
                    'content': f"Created hub: {hub.hub_name}"
                })
        except Exception as e:
            print(f"Error creating fallback hub activities: {e}")
    
    # Paginate the activities
    page = request.GET.get('page', 1)
    paginator = Paginator(activities, 10)  # 10 activities per page
    
    try:
        paginated_activities = paginator.page(page)
    except PageNotAnInteger:
        paginated_activities = paginator.page(1)
    except EmptyPage:
        paginated_activities = paginator.page(paginator.num_pages)
    
    # Prepare context with teacher data
    context = {
        'name': teacher_name,
        'followers': followers,
        'followings': followings,
        'hub_count': hub_count,
        'activities': paginated_activities,
        'stats': stats,
        'filter': activity_filter,
        'active_tab': 'activity'
    }
    
    return render(request, 'myapp/teachers/profile/teachers_profile_activity_contribution.html', context)