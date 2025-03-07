from .models import *

def get_members_by_hub_url(hub_url):
    members_list = Students_joined_hub.objects.filter(hub_url=hub_url)
    
    # Extract the student names
    members = [member.student for member in members_list]
    
    return members

