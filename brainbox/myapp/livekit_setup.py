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
LIVEKIT_API_URL ="wss://edulink-oxkw0h5q.livekit.cloud"



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
    
    return token

def create_livekit_room(room_name: str) -> Dict:
    """
    Create a new room in LiveKit.
    
    Args:
        room_name: Name for the LiveKit room.
    
    Returns:
        Dict containing the API response.
    """
    # Generate API key signature for authentication
    timestamp = int(time.time())
    path = f"/twirp/livekit.RoomService/CreateRoom"
    
    # Create message to sign
    message = f"{path}{timestamp}"
    signature = hmac.new(
        LIVEKIT_API_SECRET.encode(),
        message.encode(),
        'sha256'
    ).digest()
    signature_b64 = base64.b64encode(signature).decode()
    
    # Prepare API request
    headers = {
        "Authorization": f"Bearer {LIVEKIT_API_KEY}:{signature_b64}:{timestamp}",
        "Content-Type": "application/json"
    }
    
    # Prepare request body
    data = {
        "name": room_name,
        "empty_timeout": 300,  # Close room after 5 minutes of inactivity
        "max_participants": 100
    }
    
    # Make API request
    url = f"{LIVEKIT_API_URL}{path}"
    response = requests.post(url, headers=headers, json=data)
    
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
    
    # Generate API key signature for authentication
    timestamp = int(time.time())
    path = f"/twirp/livekit.RoomService/StartRoomRecording"
    
    # Create message to sign
    message = f"{path}{timestamp}"
    signature = hmac.new(
        LIVEKIT_API_SECRET.encode(),
        message.encode(),
        'sha256'
    ).digest()
    signature_b64 = base64.b64encode(signature).decode()
    
    # Prepare API request
    headers = {
        "Authorization": f"Bearer {LIVEKIT_API_KEY}:{signature_b64}:{timestamp}",
        "Content-Type": "application/json"
    }
    
    # Prepare request body
    data = {
        "room_name": room_name,
        "options": recording_options
    }
    
    # Make API request
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
    # Generate API key signature for authentication
    timestamp = int(time.time())
    path = f"/twirp/livekit.RoomService/StopRoomRecording"
    
    # Create message to sign
    message = f"{path}{timestamp}"
    signature = hmac.new(
        LIVEKIT_API_SECRET.encode(),
        message.encode(),
        'sha256'
    ).digest()
    signature_b64 = base64.b64encode(signature).decode()
    
    # Prepare API request
    headers = {
        "Authorization": f"Bearer {LIVEKIT_API_KEY}:{signature_b64}:{timestamp}",
        "Content-Type": "application/json"
    }
    
    # Prepare request body
    data = {
        "recording_id": recording_id
    }
    
    # Make API request
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
    # Generate API key signature for authentication
    timestamp = int(time.time())
    path = f"/twirp/livekit.RoomService/ListParticipants"
    
    # Create message to sign
    message = f"{path}{timestamp}"
    signature = hmac.new(
        LIVEKIT_API_SECRET.encode(),
        message.encode(),
        'sha256'
    ).digest()
    signature_b64 = base64.b64encode(signature).decode()
    
    # Prepare API request
    headers = {
        "Authorization": f"Bearer {LIVEKIT_API_KEY}:{signature_b64}:{timestamp}",
        "Content-Type": "application/json"
    }
    
    # Prepare request body
    data = {
        "room": room_name
    }
    
    # Make API request
    url = f"{LIVEKIT_API_URL}{path}"
    response = requests.post(url, headers=headers, json=data)
    
    if response.status_code != 200:
        raise Exception(f"Failed to get participants: {response.text}")
    
    return response.json().get("participants", [])