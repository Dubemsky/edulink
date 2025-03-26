
"""
References:
ChatGpt
Docs: https://firebase.google.com/docs/admin/setup#python
Video: https://www.youtube.com/watch?v=8wa4AHGKUJM&list=PLhPDb5zFmGR2VfXiN2y-1V0qdRik7Cc0K
"""



import json
import requests
import json
import requests
import firebase_admin
from firebase_admin import credentials, auth,firestore, storage
from firebase_admin.exceptions import FirebaseError
from datetime import datetime
from google.cloud import storage as google_storage 
from django.core.files.uploadedfile import InMemoryUploadedFile  # Import for handling uploaded files
from django.utils.timezone import now

cred = credentials.Certificate(r"C:\Users\chidu\Downloads\edulink-8db1f-firebase-adminsdk-7zzrp-1c64f2a16f.json")

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred, {
        'storageBucket': 'edulink-8db1f.firebasestorage.app' 
    })

try:
    client = google_storage.Client.from_service_account_json(r"C:\Users\chidu\Downloads\edulink-8db1f-firebase-adminsdk-7zzrp-1c64f2a16f.json")
    buckets = client.list_buckets()

    print("Available Buckets:")
    for bucket in buckets:
        print(bucket.name)
    default_bucket = storage.bucket()

except Exception as e:
    print(f"An error occurred: {e}")


db = firestore.client()    




def store_image_in_firebase(image: InMemoryUploadedFile, student_name: str, user_id: str):
    try:
        filename = f"profile_pictures/{student_name}/{datetime.now().strftime('%Y%m%d%H%M%S')}_{image.name}"
        blob = storage.bucket().blob(filename)  # Use the default bucket
        blob.upload_from_file(image, content_type=image.content_type)
        blob.make_public()
        download_url = blob.public_url

        # Update the user's profile in Firestore with the profile_picture URL
        users_ref = db.collection('users_profile')
        users_ref.document(user_id).update({'profile_picture': download_url})

        print(f"Image uploaded successfully! Download URL: {download_url}")
        return True  

    except Exception as e:
        print(f"Error uploading image: {e}")
        return False 


def add_user_website(user_id, website):
    """
    Adds a website to the user's 'websites' list in Firestore.

    Args:
        user_id: The unique ID of the user.
        website: The website URL to add.

    Returns:
        True if the update is successful, False otherwise.
    """
    try:
        users_ref = db.collection('users_profile')
        user_doc = users_ref.document(user_id).get()
        if user_doc.exists:
            user_data = user_doc.to_dict()
            current_websites = user_data.get('websites') # Get existing websites
            if current_websites is None:
              current_websites = [] # Create an empty list if websites is None
            current_websites.append(website)
            users_ref.document(user_id).update({'websites': current_websites})
            print(f"Website '{website}' added for user {user_id}.")
            return True
        else:
            print(f"User with ID {user_id} not found.")
            return False
    except Exception as e:
        print(f"Error adding website: {e}")
        return False



def update_user_bio(user_id, bio):
    """
    Updates the 'bio' field in the user's profile in Firestore.

    Args:
        user_id: The unique ID of the user.
        bio: The bio text.

    Returns:
        True if the update is successful, False otherwise.
    """
    try:
        users_ref = db.collection('users_profile')
        users_ref.document(user_id).update({'bio': bio})
        print(f"Bio for user {user_id} updated successfully.")
        return True
    except Exception as e:
        print(f"Error updating bio: {e}")
        return False




# Utility function for Firebase authentication
def authenticate_user(email, password):
    # Firebase Auth REST API endpoint
    firebase_url = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword"
    api_key = "AIzaSyD8fktQCKj1AlnFJ85lD4n60ZC5zT7VMkI"
    payload = {
        "email": email,
        "password": password,
        "returnSecureToken": True
    }

    # Send a POST request to Firebase to authenticate
    try:
        response = requests.post(f"{firebase_url}?key={api_key}", json=payload)
        response_data = response.json()

        if "idToken" in response_data:

            # Successful login
            return {
                "success": True,
                "idToken": response_data["idToken"],  # Return the ID token
            }
        else:
            # Handle errors if authentication failed
            error_message = response_data.get("error", {}).get("message", "Authentication failed.")
            return {
                "success": False,
                "error": error_message
            }

    except requests.RequestException:
        return {"success": False, "error": "An error occurred while connecting to Firebase."}


def verify_id_token(id_token):
    try:
        # Verify the token and get the decoded token
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token  
    except Exception as e:
        print(f"Token verification failed: {e}")
        return None



def users_unique_name(display_name):
    try:
        users = auth.list_users().users
        for user in users:
            if user.display_name == display_name:
                return False
        return True  
    except Exception as e:
        print(f"Error  {e}")
        return False 
    


def format_timestamp(timestamp_ms):
    # Convert milliseconds to seconds
    timestamp_s = timestamp_ms / 1000
    
    # Create a datetime object
    dt_object = datetime.fromtimestamp(timestamp_s)
    
    # Format the datetime object to "YYYY-MM-DD HH:MM:SS"
    formatted_date = dt_object.strftime("%Y-%m-%d %H:%M:%S")
    
    return formatted_date




def add_students_to_database(email, password, username, role):
    email = email.lower()
    try:
        user = auth.get_user_by_email(email)
        print(f"User already exists: {email}")
        return False  # User already exists

    except auth.UserNotFoundError:
        if not users_unique_name(username):
            print(f"Display name '{username}' is already taken. Please choose another.")
            return False  

        try:
            user = auth.create_user(
                email=email,
                password=password,
                display_name=username
            )
            auth.set_custom_user_claims(user.uid, {'role': role})

            new_user_data = {
                'uid': user.uid,
                'username': username,
                'role': role,
                'created_at': format_timestamp(user.user_metadata.creation_timestamp),
                'verified': "pending",  # New students also set to 'pending'
                'verification_initiated': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }

            add_users_to_collection([new_user_data])
            return True

        except Exception as create_error:
            print(f"Error creating user: {email}, {str(create_error)}")
            return False  

    except FirebaseError as e:
        print(f"Error checking user: {email}, {str(e)}")
        return False


    

def get_users_role(email):
    try:
        user = auth.get_user_by_email(email)
        if user:
            user_details = user.__dict__
            # Return user details along with role
            if '_data' in user_details:
                custom_attributes_str = user_details['_data'].get('customAttributes')
                if custom_attributes_str:
                    custom_attributes = json.loads(custom_attributes_str)
                    # Extract the role
                    role = custom_attributes.get('role')
                
            return role
    except auth.UserNotFoundError:
        print(f"User with email {email} not found.")
    except Exception as e:
        print(f"Error: {e}")



def get_user_display_name(email):
    try:
        # Fetch user details by email
        user = auth.get_user_by_email(email)
        # Return the display name
        return user.display_name
    except auth.UserNotFoundError:
        print(f"User with email {email} not found.")
        return None
    except Exception as e:
        print(f"Error retrieving display name for {email}: {e}")
        return None


def get_available_students(student_name):
    role='student'
    """
    Fetch all users from Firebase with the specified role (default is 'student') and 
    optionally filter by student name.

    Args:
        role (str): The role to filter users by (default is 'student').
        student_name (str, optional): The name of the student to filter by (default is None).

    Returns:
        list: A list of users who match the specified role and name.
    """
    try:
        # Fetch all users from Firebase
        users = auth.list_users().users
        available_students = []

        for user in users:
            # Retrieve custom claims for the user
            if hasattr(user, '_data') and 'customAttributes' in user._data:
                custom_attributes_str = user._data['customAttributes']
                custom_attributes = json.loads(custom_attributes_str)
                
                # Check if the user's role matches the requested role
                if custom_attributes.get('role') == role:
                    # If student_name is provided, check if it matches the user's display name
                    if student_name:
                        if student_name.lower() in user.display_name.lower(): 
                            available_students.append({
                                'email': user.email,
                                'display_name': user.display_name,
                            })
                    else:
                        # If no student_name is provided, include all students with the correct role
                        available_students.append({
                            'email': user.email,
                            'display_name': user.display_name,
                        })

        # Return the list of available students
        return available_students

    except Exception as e:
        print(f"Error fetching available students: {e}")
        return []  # Return an empty list if there is an error
    

def get_student_user_id(request):
    current_student_name = request.session.get("students_name")
    return current_student_name


def get_teacher_user_id(request):
    current_teacher_name = request.session.get("teachers_name")
    return current_teacher_name



def get_username(user_id):
    """Fetches the username from users_profile collection based on user ID."""
    try:
        user_ref = db.collection("users_profile").document(user_id)
        user_doc = user_ref.get()
        if user_doc.exists:
            return user_doc.to_dict().get("name", "No name found")
        else:
            return "User not found"
    except Exception as e:
        return f"Error retrieving user: {e}"
    


    
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
                'role': role 
            }

            # Add the new user profile document to Firestore
            users_ref.document(user_id).set(user_profile)
            print(f"User profile for {name} added successfully.")

        except Exception as e:
            print(f"Error adding user profile for {user.get('username', 'unknown')}: {str(e)}")


def get_bookmarked_messages(username, room_id):
    try:
        # Reference to the 'bookmarks' collection in Firestore
        bookmarks_ref = db.collection("bookmarked_questions")  # Assuming the collection is 'bookmarked_questions'
        
        # Query Firestore for documents where the 'username' and 'room_id' match
        query = bookmarks_ref.where("username", "==", username).where("room_id", "==", room_id)
        results = query.stream()

        # Extract the relevant data from the query results and build the response
        bookmarked_messages = []
        for doc in results:
            data = doc.to_dict()
            bookmarked_messages.append({
                "message": data.get("message"),
                "question_id": data.get("question_id")
            })

        # Return the bookmarked messages or an empty list if none were found
        if bookmarked_messages:
            return bookmarked_messages
        else:
            return []  # No bookmarks found

    except Exception as e:
        # Log the error and return an empty list
        print(f"Error fetching bookmarks: {str(e)}")
        return []






# Teachers data
INFO={
    "t":["jelena.vasic@tudublin.ie","012207919","Jelena Vasic"],
    "t1":["lucas.rizzo@tudublin.ie","35312205765","Lucas Rizzo"],
    "t2":["robert.ross@tudublin.ie","35312205636","Robert Ross"],
    "t3":["marisa.llorens@tudublin.ie","35312205624","Marisa Llorens Salvador"],
    "t4":["bianca.schoenphelan@tudublin.ie","35312205637","Bianca Schoen Phelan"],
    "t5":["art.sloan@tudublin.ie","35312205638","Art Sloan"],
    "t6":["brendan.tierney@tudublin.ie","35312205639","Brendan Tierney"],
    "t7":["jonathan.mccarthy@tudublin.ie","35312205628","Jonathan McCarthy"],
    "t8":["susan.mckeever@tudublin.ie","35312205630","Susan McKeever"],
    "t9":["emma.x.murphy@tudublin.ie","35312205766","Emma Murphy"],
    "t10":["patricia.obyrne@tudublin.ie","35312205636","Patricia O'Byrne"],
    "t11":["sean.oleary@tudublin.ie","35312205632","Sean O'Leary"],
    "t12":["jack.oneill@tudublin.ie","35312205633","Jack O'Neill"],
    "t13":["dympna.osullivan@tudublin.ie","35314024852","Dympna O'Sullivan"],
    "t14":["aneel.rahim@tudublin.ie","35312205635","Aneel Rahim"],
    "t15":["svetlana.hensman@tudublin.ie","35312205614","Svetlana Hensman"],
    "t16":["brian.x.keegan@tudublin.ie","35312205615","Brian Keegan"],
    "t17":["ciaran.kelly@tudublin.ie","35312205616","Ciaran Kelly"],
    "t18":["paul.kelly2@tudublin.ie","35312205617","Paul Kelly"],
    "t19":["deir.lawless@tudublin.ie","35312205618","Deir Lawless"],
    "t20":["cindy.liu@tudublin.ie","35312205622","Cindy Liu"],
    "t21":["luca.longo@tudublin.ie","35312205625","Luca Longo"],
    "t22":["basel.magableh@tudublin.ie","35312205626","Basel Magableh"],
    "t23":["denis.manley@tudublin.ie","35312205627","Denis Manley"],
    "t24":["pierpaolo.dondio@tudublin.ie","35312205604"," Pierpaolo Dondio"],
    "t25":["bryan.duggan@tudublin.ie","35312205606","Bryan Duggan"],
    "t26":["cathy.ennis@tudublin.ie","35312205608","Jane Ferris"],
    "t27":["mark.foley@tudublin.ie","35312205609","Mark Foley"],
    "t28":["brian.x.gillespie@tudublin.ie","35312205610","Brian Gillespie"],
    "t29":["john.gilligan@tudublin.ie","35312205611","John Gilligan"],
    "t30":["damian.x.gordon@tudublin.ie","35312205612","Damian Gordon"],
    "t31":["edina.hatunicwebster@tudublin.ie","35312205613"," Edina HatunicWebster"],
    "t32":["diana.ferreira@tudublin.ie","35312205598","Diana Carvalho E Ferreira"],
    "t33":["ciaran.cawley@tudublin.ie","35312205599","Ciaran Cawley"],
    "t34":["michael.collins@tudublin.ie","35312205601","Michael Collins"],
    "t35":["martin.oconnor@tudublin.ie","01  2207954","Martin OConnor"],
    "t36":["ana.f.curley@tudublin.ie","35312205602","Ana Curley"],
    "t37":["damian.bourke@tudublin.ie","35312205594","Damian Bourke"],
    "t38":["paul.bourke@tudublin.ie","35312205595","Paul Bourke"],
    "t39":["bojan.bozic@tudublin.ie","35312205596","Bojan Božic"],
    "t40":["sarahjane.delany@tudublin.ie","35312205603","Sarah Jane Delany"],

}