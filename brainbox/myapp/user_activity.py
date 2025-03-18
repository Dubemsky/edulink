from .firebase import *
from .messages import *
import time
from .profile_page_updates import get_user_by_name
def track_user_activity(user_id, activity_type, content, **kwargs):
    """
    Helper function to track user activities in Firestore
    
    Args:
        user_id: The Firebase UID of the user
        activity_type: Type of activity (question, answer, post, hub_joined, follow, followed)
        content: Activity content or description
        **kwargs: Additional activity data (e.g., question_id, target_name, etc.)
    
    Returns:
        The ID of the created activity document or None if error
    """
    try:
        # Skip if no user_id
        if not user_id:
            print("Cannot track activity: No user_id provided")
            return None
            
        activities_ref = db.collection('user_activities')
        
        # Create activity data
        activity_data = {
            'user_id': user_id,
            'type': activity_type,
            'content': content,
            'created_at': int(time.time()),  # Current timestamp
        }
        
        # Add any additional keyword arguments
        activity_data.update(kwargs)
        
        # Add the activity to Firestore
        result = activities_ref.add(activity_data)
        print(f"Activity tracked: {activity_type} for user {user_id}")
        
        # Return the ID of the created document
        return result[1].id
    except Exception as e:
        print(f"Error tracking user activity: {e}")
        return None


def track_question_activity(user_id, question_id, question_title):
    """
    Track when a user asks a question
    """
    return track_user_activity(
        user_id=user_id,
        activity_type='question',
        content=question_title,
        question_id=question_id
    )


def track_answer_activity(user_id, answer_id, question_id, answer_text):
    """
    Track when a user answers a question
    """
    # Truncate the answer text if it's too long
    content = answer_text[:200] + '...' if len(answer_text) > 200 else answer_text
    
    return track_user_activity(
        user_id=user_id,
        activity_type='answer',
        content=content,
        answer_id=answer_id,
        question_id=question_id
    )


def track_post_activity(user_id, post_id, post_title, post_text):
    """
    Track when a user creates a post
    """
    # Use the title as content if available, otherwise use truncated text
    content = post_title if post_title else (post_text[:200] + '...' if len(post_text) > 200 else post_text)
    
    return track_user_activity(
        user_id=user_id,
        activity_type='post',
        content=content,
        post_id=post_id
    )


def track_hub_join_activity(user_id, hub_id, hub_name):
    """
    Track when a user joins a hub
    """
    return track_user_activity(
        user_id=user_id,
        activity_type='hub_joined',
        content=f"Joined {hub_name} hub",
        hub_id=hub_id,
        hub_name=hub_name
    )


def track_hub_join(student_name, hub_name, hub_id=None):
    """
    Simplified function to track when a student joins a hub
    
    Call this from your join_hub view
    """
    try:
        # Get student details
        details = get_user_by_name(student_name)
        if not details or not details.get('uid'):
            print(f"Cannot track hub join: User {student_name} not found")
            return None
            
        user_id = details.get('uid')
        
        # Track the activity
        return track_hub_join_activity(user_id, hub_id, hub_name)
    except Exception as e:
        print(f"Error tracking hub join: {e}")
        return None


def track_follow_activity(user_id, target_id, target_name):
    """
    Track when a user follows another user
    """
    return track_user_activity(
        user_id=user_id,
        activity_type='follow',
        content=f"Started following {target_name}",
        target_id=target_id,
        target_name=target_name
    )


def track_followed_activity(user_id, actor_id, actor_name):
    """
    Track when a user is followed by another user
    """
    return track_user_activity(
        user_id=user_id,
        activity_type='followed',
        content=f"{actor_name} started following you",
        actor_id=actor_id,
        actor_name=actor_name
    )


def get_user_activities(user_id, activity_type=None, limit=10):
    """
    Fetch user activities from Firestore
    
    Args:
        user_id: Firebase UID of the user
        activity_type: Optional filter for specific activity types
        limit: Maximum number of activities to return
        
    Returns:
        List of activity dictionaries
    """
    try:
        activities_ref = db.collection('user_activities')
        query = activities_ref.where('user_id', '==', user_id).order_by('created_at', direction='DESCENDING')
        
        if activity_type:
            query = query.where('type', '==', activity_type)
        
        if limit:
            query = query.limit(limit)
            
        activities = []
        for doc in query.get():
            activity_data = doc.to_dict()
            activity_data['id'] = doc.id
            activities.append(activity_data)
            
        return activities
    except Exception as e:
        print(f"Error getting user activities: {e}")
        return []