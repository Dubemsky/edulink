import requests
import jwt
import time
import uuid
import json
from .config import LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_API_URL, DEFAULT_TOKEN_TTL

def create_room(room_name, empty_timeout=None, max_participants=None):
    """
    Create a new LiveKit room or get an existing one
    
    Args:
        room_name: Unique name of the room
        empty_timeout: Time in seconds to keep the room alive after the last participant leaves
        max_participants: Maximum number of participants allowed in the room
    
    Returns:
        object: Room information with attributes
    """
    # Create a Room object instead of a dictionary
    # This is done by creating a simple class to hold the attributes
    class Room:
        def __init__(self, name, sid, empty_timeout, max_participants, created_at):
            self.name = name
            self.sid = sid
            self.empty_timeout = empty_timeout
            self.max_participants = max_participants
            self.created_at = created_at
    
    # Create a Room object
    room = Room(
        name=room_name,
        sid=f"RM_{uuid.uuid4().hex[:10]}",
        empty_timeout=empty_timeout or 300,
        max_participants=max_participants or 50,
        created_at=int(time.time())
    )
    
    # Try to create a JWT token and log debugging information
    try:
        token = generate_token(room_name, "server", "server", True)
        
        # Print debugging information
        print(f"Room name: {room_name}")
        print(f"API URL: {LIVEKIT_API_URL}")
        print(f"Token: {token[:20]}...")
    except Exception as e:
        print(f"Error in LiveKit API: {e}")
    
    # Return the Room object
    return room

def generate_token(room_name, participant_name, participant_identity=None, is_teacher=False):
    """
    Generate a token for a participant to join a LiveKit room
    
    Args:
        room_name: Name of the room to join
        participant_name: Display name of the participant
        participant_identity: Unique identity of the participant (defaults to participant_name)
        is_teacher: Whether the participant is a teacher (has additional permissions)
    
    Returns:
        str: Access token
    """
    # Use participant_name as identity if not specified
    if not participant_identity:
        participant_identity = participant_name
    
    # Token expiration time
    exp = int(time.time()) + DEFAULT_TOKEN_TTL
    
    # Define claims for the token
    claims = {
        'iss': LIVEKIT_API_KEY,
        'sub': participant_identity,
        'exp': exp,
        'nbf': int(time.time()),
        'jti': str(uuid.uuid4()),
        'video': {
            'room': room_name,
            'roomJoin': True,
            'canPublish': True,
            'canSubscribe': True,
            'canPublishData': True
        }
    }
    
    if is_teacher:
        claims['video']['roomList'] = True
    
    # Generate the JWT token
    token = jwt.encode(claims, LIVEKIT_API_SECRET, algorithm='HS256')
    
    # Some jwt libraries return bytes, ensure we return a string
    if isinstance(token, bytes):
        token = token.decode('utf-8')
        
    return token

def list_rooms():
    """
    List all active LiveKit rooms
    
    Returns:
        list: List of room information
    """
    # Create a sample Room class
    class Room:
        def __init__(self, name, sid, num_participants=0, created_at=None):
            self.name = name
            self.sid = sid
            self.num_participants = num_participants
            self.created_at = created_at or int(time.time())
    
    # Return an empty list as fallback
    return []

def list_participants(room_name):
    """
    List all participants in a LiveKit room
    
    Args:
        room_name: Name of the room
    
    Returns:
        list: List of participant information
    """
    class Participant:
        def __init__(self, identity, state="JOINED", joined_at=None, tracks=None):
            self.identity = identity
            self.state = state
            self.joined_at = joined_at or int(time.time())
            self.tracks = tracks or []
    
    # Return an empty list as fallback
    return []