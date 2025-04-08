"""
LiveKit integration for BrainBox application.
This module handles the setup, authentication, and room management for the LiveKit service.
"""

import os
import time
import json
from typing import Dict, List, Optional
import hmac
import base64
import requests
from urllib.parse import quote
from firebase_admin import firestore
from .firebase import db

# LiveKit configuration
# These would be set in your environment variables or settings file
LIVEKIT_API_KEY = "APIRsaxCuofVw7K"
LIVEKIT_API_SECRET = "ZnrqffqzbGqyHdGqGGjTfL2I1fOGMMKSIK7Htqb11NDC"

# Change WebSocket URL to HTTP URL for server API
LIVEKIT_API_URL = "https://edulink-oxkw0h5q.livekit.cloud"
# Keep the original WebSocket URL for client connections
LIVEKIT_WS_URL = "wss://edulink-oxkw0h5q.livekit.cloud"

# Debug LiveKit credentials - print to console
print("LiveKit Configuration:")
print(f"API Key: {LIVEKIT_API_KEY}")
print(f"API Secret: {LIVEKIT_API_SECRET[:4]}...{LIVEKIT_API_SECRET[-4:]}")  # Print only part of secret for security
print(f"API URL: {LIVEKIT_API_URL}")

def generate_access_token(room_name: str, participant_name: str, is_publisher: bool = False, ttl_seconds: int = 3600) -> str:
    """
    Generate a LiveKit access token for a participant.
    
    Args:
        room_name: Name of the LiveKit room.
        participant_name: Name/identity of the participant.
        is_publisher: Whether the user can publish audio/video (teacher) or just subscribe (student).
        ttl_seconds: Time-to-live for the token in seconds.
    
    Returns:
        A JWT token string that can be used to connect to LiveKit.
    """
    import jwt
    from datetime import datetime, timedelta
    
    # Set up claims for the JWT
    now = int(datetime.now().timestamp())
    exp = now + ttl_seconds
    
    # Define video permissions based on role
    video_permissions = {
        "room_join": True,
        "room_name": room_name,
        "can_publish": is_publisher,
        "can_subscribe": True,
        "can_publish_data": True
    }
    
    claims = {
        "sub": participant_name,
        "name": participant_name,
        "iss": LIVEKIT_API_KEY,
        "nbf": now,
        "exp": exp,
        "video": video_permissions
    }
    
    # Generate the JWT
    token = jwt.encode(claims, LIVEKIT_API_SECRET, algorithm='HS256')
    
    # Ensure the token is a string (PyJWT >=2.0.0 returns a string, <2.0.0 returns bytes)
    if isinstance(token, bytes):
        token = token.decode('utf-8')
    
    return token

def create_livekit_room(room_name: str) -> Dict:
    """
    Create a new room in LiveKit.
    
    Args:
        room_name: Name for the LiveKit room.
    
    Returns:
        Dict containing the API response.
    """
    # Generate API access token with appropriate permissions
    import jwt
    from datetime import datetime, timedelta
    
    # Set up claims for the API JWT
    now = int(datetime.now().timestamp())
    exp = now + 60  # Short expiration for API calls
    
    claims = {
        "iss": LIVEKIT_API_KEY,
        "nbf": now,
        "exp": exp,
        "video": {
            # Give admin level access for all operations
            "room_create": True,
            "room_list": True,
            "room_record": True,
            "room_admin": True
        }
    }
    
    # Generate the JWT
    token = jwt.encode(claims, LIVEKIT_API_SECRET, algorithm='HS256')
    
    # Ensure the token is a string (PyJWT >=2.0.0 returns a string, <2.0.0 returns bytes)
    if isinstance(token, bytes):
        token = token.decode('utf-8')
    
    # Debug info
    print("\n=== LiveKit Room Creation Debug ===")
    print(f"Room Name: {room_name}")
    print(f"Claims: {claims}")
    print(f"Token: {token[:10]}...{token[-10:]}")  # Only show part of token for security
    
    # Prepare API request
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Prepare request body
    data = {
        "name": room_name,
        "empty_timeout": 300,  # Close room after 5 minutes of inactivity
        "max_participants": 100
    }
    
    # Make API request
    path = f"/twirp/livekit.RoomService/CreateRoom"
    url = f"{LIVEKIT_API_URL}{path}"
    print(f"Request URL: {url}")
    print(f"Request Headers: {headers}")
    print(f"Request Data: {data}")
    
    response = requests.post(url, headers=headers, json=data)
    
    print(f"Response Status: {response.status_code}")
    print(f"Response Text: {response.text}")
    
    if response.status_code != 200:
        raise Exception(f"Failed to create LiveKit room: {response.text}")
    
    return response.json()

def start_recording(room_name: str, recording_options=None) -> Dict:
    """
    Start recording a LiveKit room session.
    
    Args:
        room_name: Name of the LiveKit room.
        recording_options: Additional recording options.
    
    Returns:
        Dict containing the recording information.
    """
    if recording_options is None:
        recording_options = {
            "output": {
                "fileType": "mp4",
                "filepath": f"recordings/{room_name}/{int(time.time())}_recording.mp4"
            },
            "preset": "H264_720P_30"
        }
    
    # Generate API access token with appropriate permissions
    import jwt
    from datetime import datetime, timedelta
    
    # Set up claims for the API JWT
    now = int(datetime.now().timestamp())
    exp = now + 60  # Short expiration for API calls
    
    claims = {
        "iss": LIVEKIT_API_KEY,
        "nbf": now,
        "exp": exp,
        "video": {
            "room": room_name,
            "room_record": True,  # Can record the room
            "room_admin": True    # Admin access
        }
    }
    
    # Generate the JWT
    token = jwt.encode(claims, LIVEKIT_API_SECRET, algorithm='HS256')
    
    # Ensure the token is a string (PyJWT >=2.0.0 returns a string, <2.0.0 returns bytes)
    if isinstance(token, bytes):
        token = token.decode('utf-8')
    
    # Prepare API request
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Prepare request body
    data = {
        "room_name": room_name,
        "options": recording_options
    }
    
    # Make API request
    path = f"/twirp/livekit.RoomService/StartRoomRecording"
    url = f"{LIVEKIT_API_URL}{path}"
    response = requests.post(url, headers=headers, json=data)
    
    if response.status_code != 200:
        raise Exception(f"Failed to start recording: {response.text}")
    
    return response.json()

def stop_recording(recording_id: str) -> Dict:
    """
    Stop an active recording.
    
    Args:
        recording_id: ID of the active recording.
    
    Returns:
        Dict containing the API response.
    """
    # Generate API access token with appropriate permissions
    import jwt
    from datetime import datetime, timedelta
    
    # Set up claims for the API JWT
    now = int(datetime.now().timestamp())
    exp = now + 60  # Short expiration for API calls
    
    claims = {
        "iss": LIVEKIT_API_KEY,
        "nbf": now,
        "exp": exp,
        "video": {
            "room_record": True,  # Can control recordings
            "room_admin": True    # Admin access
        }
    }
    
    # Generate the JWT
    token = jwt.encode(claims, LIVEKIT_API_SECRET, algorithm='HS256')
    
    # Ensure the token is a string (PyJWT >=2.0.0 returns a string, <2.0.0 returns bytes)
    if isinstance(token, bytes):
        token = token.decode('utf-8')
    
    # Prepare API request
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Prepare request body
    data = {
        "recording_id": recording_id
    }
    
    # Make API request
    path = f"/twirp/livekit.RoomService/StopRoomRecording"
    url = f"{LIVEKIT_API_URL}{path}"
    response = requests.post(url, headers=headers, json=data)
    
    if response.status_code != 200:
        raise Exception(f"Failed to stop recording: {response.text}")
    
    return response.json()

def update_livestream_recording_url(livestream_id: str, recording_url: str) -> bool:
    """
    Update the recording URL in Firestore for a completed livestream.
    
    Args:
        livestream_id: ID of the livestream document in Firestore.
        recording_url: URL to the recorded video.
    
    Returns:
        True if the update was successful, False otherwise.
    """
    try:
        # Update the livestream document in Firestore
        livestream_ref = db.collection('scheduled_livestreams').document(livestream_id)
        livestream_ref.update({
            'recording_url': recording_url,
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        return True
    except Exception as e:
        print(f"Error updating livestream recording URL: {e}")
        return False

def complete_livestream(livestream_id: str, viewer_count: int = 0, duration_seconds: int = 0, recording_url: str = None) -> bool:
    """
    Mark a livestream as completed in Firestore and add analytics data.
    
    Args:
        livestream_id: ID of the livestream document in Firestore.
        viewer_count: Number of unique viewers that joined the stream.
        duration_seconds: Duration of the livestream in seconds.
        recording_url: URL to the recorded video.
    
    Returns:
        True if the update was successful, False otherwise.
    """
    try:
        # Update the livestream document in Firestore
        livestream_ref = db.collection('scheduled_livestreams').document(livestream_id)
        
        update_data = {
            'status': 'completed',
            'ended_at': firestore.SERVER_TIMESTAMP,
            'viewer_count': viewer_count,
            'duration_seconds': duration_seconds,
            'updated_at': firestore.SERVER_TIMESTAMP
        }
        
        if recording_url:
            update_data['recording_url'] = recording_url
        
        livestream_ref.update(update_data)
        
        return True
    except Exception as e:
        print(f"Error completing livestream: {e}")
        return False
        
def get_active_participants(room_name: str) -> List[Dict]:
    """
    Get a list of active participants in a LiveKit room.
    
    Args:
        room_name: Name of the LiveKit room.
    
    Returns:
        List of participant information dictionaries.
    """
    # Generate API access token with appropriate permissions
    import jwt
    from datetime import datetime, timedelta
    
    # Set up claims for the API JWT
    now = int(datetime.now().timestamp())
    exp = now + 60  # Short expiration for API calls
    
    claims = {
        "iss": LIVEKIT_API_KEY,
        "nbf": now,
        "exp": exp,
        "video": {
            "room": room_name,
            "room_list": True,  # Can list room participants
            "room_admin": True  # Admin access
        }
    }
    
    # Generate the JWT
    token = jwt.encode(claims, LIVEKIT_API_SECRET, algorithm='HS256')
    
    # Ensure the token is a string (PyJWT >=2.0.0 returns a string, <2.0.0 returns bytes)
    if isinstance(token, bytes):
        token = token.decode('utf-8')
    
    # Prepare API request
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Prepare request body
    data = {
        "room": room_name
    }
    
    # Make API request
    path = f"/twirp/livekit.RoomService/ListParticipants"
    url = f"{LIVEKIT_API_URL}{path}"
    response = requests.post(url, headers=headers, json=data)
    
    if response.status_code != 200:
        raise Exception(f"Failed to get participants: {response.text}")
    
    return response.json().get("participants", [])