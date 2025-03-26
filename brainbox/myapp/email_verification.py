import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from .firebase import *

# Add these functions to your firebase.py file

def send_verification_email(email, display_name, verification_token):
    try:
        # Zoho mail SMTP settings
        smtp_server = "smtp.zoho.eu"
        smtp_port = 587
        sender_email = "edulink-admin@zohomail.eu"
        sender_password = "nf0MSp3aNsrT"  # Replace with actual password or use environment variable


        
        # Create the verification link
        verification_link = f"http://127.0.0.1:8000/verify-email/{verification_token}/"
        # Create message
        msg = MIMEMultipart()
        msg['From'] = sender_email
        msg['To'] = email
        msg['Subject'] = "Verify your EduLink account"
        
        # Create HTML body with verification link
        html = f"""
        <html>
          <head></head>
          <body>
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
              <div style="text-align: center; margin-bottom: 20px;">
                <h1 style="color: #3a7bd5;">EduLink</h1>
              </div>
              <div>
                <p>Hello {display_name},</p>
                <p>Thank you for registering with EduLink. To complete your registration and activate your account, please verify your email address by clicking the button below:</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="{verification_link}" style="background-color: #3a7bd5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email Address</a>
                </div>
                <p>This verification link will expire in 14 days. If you do not verify your email within this time, your account will be deactivated.</p>
                <p>If you did not create an account with EduLink, please ignore this email.</p>
                <p>Best regards,<br>The EduLink Team</p>
              </div>
            </div>
          </body>
        </html>
        """
        
        msg.attach(MIMEText(html, 'html'))
        
        # Connect to SMTP server and send email
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.send_message(msg)
            
        print(f"Verification email sent to {email}")
        return True
        
    except Exception as e:
        print(f"Error sending verification email: {e}")
        return False


def generate_email_verification_token(user_id):
    """
    Generate an email verification token and store it in Firestore
    
    Args:
        user_id: The ID of the user to generate token for
        
    Returns:
        str: The generated verification token
    """
    import uuid
    import hashlib
    
    # Generate a unique token
    token = hashlib.sha256(f"{user_id}:{uuid.uuid4()}".encode()).hexdigest()
    
    # Set expiration date (14 days from now)
    expiration_date = datetime.now() + timedelta(days=14)
    expiration_timestamp = int(expiration_date.timestamp())
    
    # Store the token in Firestore
    verification_ref = db.collection('email_verifications')
    verification_ref.document(token).set({
        'user_id': user_id,
        'created_at': firestore.SERVER_TIMESTAMP,
        'expires_at': expiration_timestamp,
        'used': False
    })
    
    return token


def verify_email_token(token):
    """
    Verify an email verification token
    
    Args:
        token: The token to verify
        
    Returns:
        dict: Result of verification with user_id if successful
    """
    try:
        # Get the verification document
        verification_ref = db.collection('email_verifications').document(token)
        verification = verification_ref.get()
        
        if not verification.exists:
            return {'success': False, 'error': 'Invalid verification token.'}
        
        verification_data = verification.to_dict()
        
        # Check if token is already used
        if verification_data.get('used', False):
            return {'success': False, 'error': 'This verification link has already been used.'}
        
        # Check if token is expired
        current_time = datetime.now().timestamp()
        if current_time > verification_data.get('expires_at', 0):
            return {'success': False, 'error': 'This verification link has expired.'}
        
        # Mark token as used
        verification_ref.update({'used': True})
        
        # Update user's verification status in Firestore
        user_id = verification_data.get('user_id')
        users_ref = db.collection('users_profile')
        users_ref.document(user_id).update({'verified': True})
        
        # Get the user's email to mark it as verified in Firebase Auth
        user_doc = users_ref.document(user_id).get()
        if user_doc.exists:
            try:
                # Find the user in Firebase Auth to get their email
                auth_users = auth.list_users().users
                for user in auth_users:
                    user_data = user.__dict__
                    if user.uid == user_id:
                        # Update the user's email verification status in Firebase Auth
                        auth.update_user(user_id, email_verified=True)
                        break
            except Exception as auth_error:
                print(f"Error updating Firebase Auth email verification: {auth_error}")
        
        return {'success': True, 'user_id': user_id}
        
    except Exception as e:
        print(f"Error verifying email token: {e}")
        return {'success': False, 'error': f"An error occurred: {str(e)}"}


def check_account_verification_status(user_id):
    """
    Check if a user's email is verified and if the account is still within the verification period
    
    Args:
        user_id: The ID of the user to check
    
    Returns:
        dict: Status information including verification status and days remaining
    """
    try:
        # Get user profile from Firestore
        users_ref = db.collection('users_profile')
        user_doc = users_ref.document(user_id).get()
        
        if not user_doc.exists:
            return {'is_verified': False, 'status': 'unknown', 'days_remaining': 0}
        
        user_data = user_doc.to_dict()
        verified = user_data.get('verified')
        
        print(f"User verification status: {verified} {type(verified)}")
        
        # If user is already verified, return verified status
        if verified == True:
            return {'is_verified': True, 'status': 'verified', 'days_remaining': 0}
        
        # Check verification_initiated timestamp
        verification_initiated_str = user_data.get('verification_initiated')
        
        if not verification_initiated_str:
            return {'is_verified': False, 'status': 'unknown', 'days_remaining': 0}
        
        try:
            # Parse verification initiated date from string format
            verification_initiated = datetime.strptime(verification_initiated_str, "%Y-%m-%d %H:%M:%S")
        except Exception as parse_error:
            print(f"Error parsing verification_initiated: {parse_error}")
            return {'is_verified': False, 'status': 'unknown', 'days_remaining': 0}
        
        # Calculate verification deadline (14 days after verification initiated)
        verification_deadline = verification_initiated + timedelta(days=14)
        days_remaining = (verification_deadline - datetime.now()).days
        
        if days_remaining < 0:
            # Account verification period has expired
            return {'is_verified': False, 'status': 'expired', 'days_remaining': 0}
        else:
            # Account still within verification period
            return {'is_verified': False, 'status': 'pending', 'days_remaining': days_remaining}
    
    except Exception as e:
        print(f"Error checking verification status: {e}")
        return {'is_verified': False, 'status': 'error', 'days_remaining': 0}


def deactivate_unverified_accounts():
    """
    Function to deactivate accounts that haven't been verified within 14 days
    This should be run as a scheduled task (e.g., using cron or a cloud function)
    """
    try:
        # Get all user profiles from Firestore
        users_ref = db.collection('users_profile')
        users = users_ref.get()
        
        current_time = datetime.now()
        verification_period = timedelta(days=14)
        
        for user in users:
            user_data = user.to_dict()
            user_id = user.id
            
            # Skip verified users
            if user_data.get('verified', False):
                continue
            
            # Get user creation date
            created_at_str = user_data.get('created_at')
            if not created_at_str:
                continue
            
            try:
                # Parse creation date from string format
                created_at = datetime.strptime(created_at_str, "%Y-%m-%d %H:%M:%S")
            except:
                # Handle potential different timestamp format
                try:
                    created_at = datetime.fromtimestamp(user_data.get('created_at') / 1000)
                except:
                    continue
            
            # Check if verification period has passed
            if (current_time - created_at) > verification_period:
                # Deactivate account in Firebase Auth
                try:
                    auth.update_user(user_id, disabled=True)
                    # Update status in Firestore
                    users_ref.document(user_id).update({'status': 'deactivated'})
                    print(f"Deactivated unverified user: {user_id}")
                except Exception as auth_error:
                    print(f"Error deactivating user {user_id}: {auth_error}")
                    
    except Exception as e:
        print(f"Error in deactivation task: {e}")


def change_user_password(user_id, current_password, new_password):
    """
    Change a user's password
    
    Args:
        user_id: The ID of the user
        current_password: User's current password
        new_password: User's new password
        
    Returns:
        dict: Result of password change
    """
    try:
        # First, get the user's email from Firestore
        users_ref = db.collection('users_profile')
        user_doc = users_ref.document(user_id).get()
        
        if not user_doc.exists:
            return {'success': False, 'error': 'User not found.'}
        
        # Find the user's email from Firebase Auth
        user = None
        auth_users = auth.list_users().users
        for auth_user in auth_users:
            if auth_user.uid == user_id:
                user = auth_user
                break
        
        if not user or not user.email:
            return {'success': False, 'error': 'User email not found.'}
        
        # Verify current password
        auth_result = authenticate_user(user.email, current_password)
        if not auth_result["success"]:
            return {'success': False, 'error': 'Current password is incorrect.'}
        
        # Update password
        auth.update_user(user_id, password=new_password)
        
        return {'success': True, 'message': 'Password updated successfully.'}
        
    except Exception as e:
        print(f"Error changing password: {e}")
        return {'success': False, 'error': f"An error occurred: {str(e)}"}


# Modify the add_students_to_database function to include email verification
def add_students_to_database(email, password, username, role):
    email = email.lower()
    try:
        # Check if the user already exists
        user = auth.get_user_by_email(email)
        print(f"User already exists: {email}")
        return False  # User already exists

    except auth.UserNotFoundError:
        # Check if the display name is unique
        if not users_unique_name(username):
            print(f"Display name '{username}' is already taken. Please choose another.")
            return False  

        # Create the user if name is unique
        try:
            user = auth.create_user(
                email=email,
                password=password,
                display_name=username,
                email_verified=False  # Set initial email_verified to False
            )
            # Set custom claims (role)
            auth.set_custom_user_claims(user.uid, {'role': role})

            # Create a dictionary for the new user
            new_user_data = {
                'uid': user.uid,
                'username': username,
                'role': role,
                'created_at': format_timestamp(user.user_metadata.creation_timestamp)
            }

            # Add the new user to Firestore collection with verified=False
            add_users_to_collection([new_user_data])  # Pass the user data as a list
            
            # Generate and send verification email
            verification_token = generate_email_verification_token(user.uid)
            send_verification_email(email, username, verification_token)

            return True

        except Exception as create_error:
            print(f"Error creating user: {email}, {str(create_error)}")
            return False  

    except FirebaseError as e:
        print(f"Error checking user: {email}, {str(e)}")
        return False


# Update the add_users_to_collection function to include verified field
def add_users_to_collection(users_list):
    # Reference to the 'users_profile' collection
    users_ref = db.collection('users_profile')
    
    # Iterate over each user in the list and add them to Firestore
    for user in users_list:
        try:
            # Ensure the user has all the required fields
            user_id = user.get('uid')
            name = user.get('username', '').upper()  # Default to empty string if 'username' is missing
            role = user.get('role', 'default')  # Default to 'default' role if missing
            created_at = user.get('created_at', firestore.SERVER_TIMESTAMP)  # Use timestamp if missing

            if not user_id:
                print("Error: Missing user ID")
                continue  # Skip this user if no ID is provided

            # Create the user profile document
            user_profile = {
                'name': name,
                'followers': 0, 
                'followings': 0,  
                'profile_picture': 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png',
                'websites': None, 
                'bio': None,  
                'created_at': created_at, 
                'role': role,
                'verified': False,  # Set default verification status to false
                'status': 'active'  # Set default status to active
            }

            # Add the new user profile document to Firestore
            users_ref.document(user_id).set(user_profile)
            print(f"User profile for {name} added successfully.")
            
        except Exception as e:
            print(e)