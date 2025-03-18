from django.http import JsonResponse
from .firebase import *
from django.shortcuts import render
from firebase_admin import credentials, auth


def get_user_by_name(name):
    """
    Fetches a user's details from Firebase Authentication by their display name.
    
    Args:
        name: The display name of the user to find.
        
    Returns:
        Dictionary with user details or None if not found.
    """
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
    """
    Unified function to handle all student profile updates including:
    - Profile picture
    - Bio and basic information
    - Websites
    
    Returns JsonResponse with success/error information.
    """
    if request.method == 'POST':
        update_type = request.POST.get('type')
        student_name = get_student_user_id(request)
        
        if not student_name:
            return JsonResponse({"success": False, "error": "User not logged in"}, status=401)

        details = get_user_by_name(student_name)
        if not details:
            return JsonResponse({"success": False, "error": "User not found"}, status=404)
            
        user_id = details.get('uid')
        print(f"Profile update for {student_name} (ID: {user_id}), type: {update_type}")
        
        # Handle profile picture update
        if update_type == 'profile_pic':
            profile_picture = request.FILES.get('profile_picture')
            if not profile_picture:
                return JsonResponse({"success": False, "error": "No profile picture uploaded"}, status=400)
                
            image_url = store_image_in_firebase(profile_picture, student_name, user_id)
            if image_url:
                return JsonResponse({"success": True, "image_url": image_url})
            else:
                return JsonResponse({"success": False, "error": "Failed to upload image"}, status=500)
        
        # Handle bio update
        elif update_type == 'bio':
            bio = request.POST.get('bio', '')
            grade = request.POST.get('grade', '')
            
            # Create updates dictionary
            updates = {}
            if bio is not None:  # Allow empty bio
                updates['bio'] = bio
            if grade:  # Only update grade if provided
                updates['grade'] = grade
                
            # Apply updates if we have any
            if updates:
                success = update_user_profile(user_id, updates)
                if not success:
                    return JsonResponse({"success": False, "error": "Failed to update profile"}, status=500)
            
            # Handle websites
            websites = request.POST.getlist('website_url[]')
            if websites is not None:  # Could be empty list which is valid
                filtered_websites = [url for url in websites if url]  # Remove empty URLs
                success = update_user_websites(user_id, filtered_websites)
                if not success:
                    return JsonResponse({"success": False, "error": "Failed to update websites"}, status=500)
            
            return JsonResponse({"success": True})
        
        # Handle website updates
        elif update_type == 'website':
            website = request.POST.get('website')
            if not website:
                return JsonResponse({"success": False, "error": "No website provided"}, status=400)
                
            success = add_user_website(user_id, website)
            if success:
                return JsonResponse({"success": True})
            else:
                return JsonResponse({"success": False, "error": "Failed to add website"}, status=500)
        
        return JsonResponse({"success": False, "error": "Invalid update type"}, status=400)

    return JsonResponse({"success": False, "error": "Invalid request method"}, status=405)


def add_user_website(user_id, website_url):
    """
    Adds a new website to the user's websites list in Firestore.
    
    Args:
        user_id: The unique ID of the user.
        website_url: URL to add.
        
    Returns:
        True if successful, False otherwise.
    """
    try:
        # First get the current list of websites
        users_ref = db.collection('users_profile')
        user_doc = users_ref.document(user_id).get()
        
        if user_doc.exists:
            user_data = user_doc.to_dict()
            websites = user_data.get('websites', [])
            
            # Check if website already exists
            if website_url not in websites:
                websites.append(website_url)
                users_ref.document(user_id).update({'websites': websites})
                
            return True
        else:
            # If user document doesn't exist, create it with the website
            users_ref.document(user_id).set({
                'websites': [website_url]
            }, merge=True)
            return True
            
    except Exception as e:
        print(f"Error adding website: {e}")
        return False


def update_user_bio(user_id, bio):
    """
    Updates the user's bio in Firestore.
    
    Args:
        user_id: The unique ID of the user.
        bio: Text to set as bio.
        
    Returns:
        True if successful, False otherwise.
    """
    try:
        users_ref = db.collection('users_profile')
        users_ref.document(user_id).update({'bio': bio})
        return True
    except Exception as e:
        print(f"Error updating bio: {e}")
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


def teachers_profile_update(request):
    """
    Handler for teacher profile updates - similar to student updates
    """
    if request.method == 'POST':
        update_type = request.POST.get('type')
        teacher_name = get_teacher_user_id(request)

        if not teacher_name:
            return JsonResponse({"success": False, "error": "User not logged in"}, status=401)

        details = get_user_by_name(teacher_name)
        if not details:
            return JsonResponse({"success": False, "error": "User not found"}, status=404)
            
        user_id = details.get('uid')
        print(f"Teacher profile update for {teacher_name} (ID: {user_id}), type: {update_type}")
        
        # Handle profile picture update
        if update_type == 'profile_pic':
            profile_picture = request.FILES.get('profile_picture')
            if not profile_picture:
                return JsonResponse({"success": False, "error": "No profile picture uploaded"}, status=400)
                
            image_url = store_image_in_firebase(profile_picture, teacher_name, user_id)
            if image_url:
                return JsonResponse({"success": True, "image_url": image_url})
            else:
                return JsonResponse({"success": False, "error": "Failed to upload image"}, status=500)
        
        # Handle bio update
        elif update_type == 'bio':
            bio = request.POST.get('bio', '')
            
            success = update_user_bio(user_id, bio)
            if success:
                return JsonResponse({"success": True})
            else:
                return JsonResponse({"success": False, "error": "Failed to update bio"}, status=500)
        
        # Handle website updates
        elif update_type == 'website':
            website = request.POST.get('website')
            if not website:
                return JsonResponse({"success": False, "error": "No website provided"}, status=400)
                
            success = add_user_website(user_id, website)
            if success:
                return JsonResponse({"success": True})
            else:
                return JsonResponse({"success": False, "error": "Failed to add website"}, status=500)
        
        return JsonResponse({"success": False, "error": "Invalid update type"}, status=400)

    return JsonResponse({"success": False, "error": "Invalid request method"}, status=405)


def store_image_in_firebase(image_file, username, user_id):
    """
    Uploads an image to Firebase Storage and updates the user's profile with the image URL.
    
    Args:
        image_file: The uploaded image file
        username: The username of the user uploading the image
        user_id: The unique ID of the user
        
    Returns:
        The URL of the uploaded image or None if failed
    """
    try:
        # Get Firebase storage bucket
        bucket = storage.bucket()
        
        # Generate a unique file path for the image
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        file_path = f"profile_pictures/{user_id}/{username}_{timestamp}"
        
        # Create a blob and upload the file
        blob = bucket.blob(file_path)
        
        # Set content type based on the file extension
        content_type = image_file.content_type
        blob.content_type = content_type
        
        # Upload the file
        blob.upload_from_file(image_file, content_type=content_type)
        
        # Set the blob to public to generate a public URL
        blob.make_public()
        
        # Get the public URL
        image_url = blob.public_url
        
        # Update the user's profile in Firestore with the image URL
        users_ref = db.collection('users_profile')
        users_ref.document(user_id).update({
            'profile_picture': image_url
        })
        
        return image_url
    except Exception as e:
        print(f"Error storing image in Firebase: {e}")
        return None


def get_student_user_id(request):
    """
    Helper function to get the student name from the session
    """
    return request.session.get("students_name")


def get_teacher_user_id(request):
    """
    Helper function to get the teacher name from the session
    """
    return request.session.get("teachers_name")