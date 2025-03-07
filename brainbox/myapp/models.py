from django.db import models
import uuid


"""
References: 
- Youtube Tutorial: https://www.youtube.com/watch?v=rI95wyHD_6k
- Models.py Docs : https://docs.djangoproject.com/en/5.1/topics/db/models/

Explained the fundamentals of django ORMs
"""

# Generating the room url and making alphanumeric  and returning the first 10 values
def generate_room_url():
    return str(uuid.uuid4()).replace("-", "")[:10]  

class Teachers_created_hub(models.Model):
    # Specifying the room types
    ROOM_TYPES = [
        ('public', 'Public'),
        ('private', 'Private'),
    ]

    hub_owner = models.CharField(max_length=50)
    hub_name = models.CharField(max_length=100) 
    hub_description = models.TextField(null=True, blank=True)  
    hub_image = models.CharField(max_length=50, null=True)
    hub_privacy_setting = models.CharField(max_length=50, choices=ROOM_TYPES, default='public')
    created_at = models.DateField(auto_now_add=True)
    room_url = models.CharField(max_length=10, default=generate_room_url, editable=False, unique=True)

    """
    Ensuring that each teacher can only create one hub with a specific name.
    
    """
    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['hub_owner', 'hub_name'], name='unique_hub_per_teacher')
        ]

    def __str__(self):
        return self.hub_name


class Students_joined_hub(models.Model):
    student = models.CharField(max_length=50)
    hub = models.ForeignKey(Teachers_created_hub, on_delete=models.CASCADE, related_name='members')  
    hub_owner = models.CharField(max_length=50, null=False, default='default_owner')
    hub_url = models.CharField(max_length=10, null=False)  # Remove the default here
    joined_at = models.DateField(auto_now_add=True)



    def save(self, *args, **kwargs):
        # Automatically assign the hub's room_url to the student's hub_url field
        if not self.hub_url:
            self.hub_url = self.hub.room_url  
        super().save(*args, **kwargs)

    def __str__(self):
        return self.student
    


class Student_Message(models.Model):
    content = models.TextField()  
    sender = models.CharField(max_length=50) 
    room_url = models.CharField(max_length=10,default='') 
    created_at = models.TimeField(auto_now_add=True)  

    def __str__(self):
        return f"{self.sender} in {self.room_url} at {self.created_at}"
    

class Teacher_Message(models.Model):
    content = models.TextField()  
    sender = models.CharField(max_length=50) 
    room_url = models.CharField(max_length=10, default='') 
    created_at = models.TimeField(auto_now_add=True)  

    def __str__(self):
        return f"{self.sender} in {self.room_url} at {self.created_at}"