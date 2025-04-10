from livekit import api
from .config import LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_API_URL, DEFAULT_TOKEN_TTL

def create_room(room_name, empty_timeout=None, max_participants=None):
    """
    Create a new LiveKit room or get an existing one
    
    Args:
        room_name: Unique name of the room
        empty_timeout: Time in seconds to keep the room alive after the last participant leaves
        max_participants: Maximum number of participants allowed in the room
    
    Returns:
        dict: Room information
    """
    livekit_api = api.LivekitAPI(
        url=LIVEKIT_API_URL,
        api_key=LIVEKIT_API_KEY,
        api_secret=LIVEKIT_API_SECRET
    )
    
    try:
        # Try to get the room first
        room = livekit_api.room.get(room_name)
        return room
    except Exception:
        # Create room if it doesn't exist
        room_options = {
            'name': room_name,
            'empty_timeout': empty_timeout,
            'max_participants': max_participants,
        }
        
        # Filter out None values
        room_options = {k: v for k, v in room_options.items() if v is not None}
        
        return livekit_api.room.create_or_update(**room_options)

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
    
    # Create the token with appropriate permissions
    token = api.AccessToken(
        api_key=LIVEKIT_API_KEY,
        api_secret=LIVEKIT_API_SECRET,
        identity=participant_identity,
        ttl=DEFAULT_TOKEN_TTL
    )
    
    # Add permissions to the token
    token.add_grant(
        room_join=True,
        room=room_name,
        room_list=is_teacher,  # Teachers can list rooms
        can_publish=True,  # Allow publishing audio/video
        can_subscribe=True,  # Allow subscribing to others' audio/video
        can_publish_data=True  # Allow publishing data
    )
    
    # Return the signed token
    return token.to_jwt()

def list_rooms():
    """
    List all active LiveKit rooms
    
    Returns:
        list: List of room information
    """
    livekit_api = api.LivekitAPI(
        url=LIVEKIT_API_URL,
        api_key=LIVEKIT_API_KEY,
        api_secret=LIVEKIT_API_SECRET
    )
    
    return livekit_api.room.list()

def list_participants(room_name):
    """
    List all participants in a LiveKit room
    
    Args:
        room_name: Name of the room
    
    Returns:
        list: List of participant information
    """
    livekit_api = api.LivekitAPI(
        url=LIVEKIT_API_URL,
        api_key=LIVEKIT_API_KEY,
        api_secret=LIVEKIT_API_SECRET
    )
    
    return livekit_api.room.list_participants(room_name)