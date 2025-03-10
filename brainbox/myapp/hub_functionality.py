from .models import *

def get_members_by_hub_url(hub_url):
    members_list = Students_joined_hub.objects.filter(hub_url=hub_url)
    
    # Extract the student names
    members = [member.student for member in members_list]
    
    return members

def get_hub_member_count(hub_url):
    """
    Returns the number of members in a hub.
    """
    try:
        # Query Students_joined_hub model to count students who joined this hub
        from .models import Students_joined_hub
        student_count = Students_joined_hub.objects.filter(hub__room_url=hub_url).count()
        
        # Add 1 for the teacher who created the hub
        total_members = student_count + 1
        
        return total_members
    except Exception as e:
        print(f"Error counting hub members: {e}")
        return 0