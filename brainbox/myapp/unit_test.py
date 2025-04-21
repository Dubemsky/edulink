import json
from unittest.mock import patch
from django.test import TestCase, Client
from django.urls import reverse
from .models import *


class HubRoomTestCase(TestCase):
    """
    Test cases specifically for hub room creation and joining functionality
    """
    
    def setUp(self):
        """Set up test data and client"""
        self.client = Client()
        
        # Create test teacher and student
        self.teacher_name = "test_teacher"
        self.student_name = "test_student"
        
        # Create a sample hub
        self.test_hub = Teachers_created_hub.objects.create(
            hub_name="Test Hub",
            hub_owner=self.teacher_name,
            hub_privacy_setting="public",
            room_url="test-hub-123"
        )
        
        # Set up sessions
        session = self.client.session
        session["teachers_name"] = self.teacher_name
        session.save()
    
    @patch('myapp.views_students.get_user_by_name')
    def test_student_join_hub(self, mock_get_user):
        """Test student successfully joining a hub"""
        # Mock user details
        mock_get_user.return_value = {
            'uid': 'student123',
            'email': 'test@example.com'
        }
        
        # Set student session
        session = self.client.session
        session['students_name'] = self.student_name
        session.save()
        
        # Prepare data for joining hub
        data = {
            'hub_name': self.test_hub.hub_name,
            'hub_owner': self.test_hub.hub_owner
        }
        
        # Test join_hub view
        response = self.client.post(
            reverse('join_hub'),
            json.dumps(data),
            content_type='application/json'
        )
        
        # Check response
        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content)
        self.assertTrue(response_data['success'])
        self.assertIn(f"successfully joined {self.test_hub.hub_name}", response_data['message'])
        
        # Verify student is in the hub
        student_in_hub = Students_joined_hub.objects.filter(
            student=self.student_name,
            hub=self.test_hub
        ).exists()
        self.assertTrue(student_in_hub)
    
    @patch('myapp.views_students.get_user_by_name')
    def test_student_already_in_hub(self, mock_get_user):
        """Test student trying to join a hub they're already in"""
        # Mock user details
        mock_get_user.return_value = {
            'uid': 'student123',
            'email': 'test@example.com'
        }
        
        # Add student to hub first
        Students_joined_hub.objects.create(
            student=self.student_name,
            hub=self.test_hub,
            hub_owner=self.test_hub.hub_owner,
            hub_url=self.test_hub.room_url
        )
        
        # Set student session
        session = self.client.session
        session['students_name'] = self.student_name
        session.save()
        
        # Prepare data for joining hub
        data = {
            'hub_name': self.test_hub.hub_name,
            'hub_owner': self.test_hub.hub_owner
        }
        
        # Test join_hub view again
        response = self.client.post(
            reverse('join_hub'),
            json.dumps(data),
            content_type='application/json'
        )
        
        # Check response
        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content)
        self.assertFalse(response_data['success'])
        self.assertIn('You are a member', response_data['error'])
    
    @patch('myapp.views_students.get_user_by_name')
    def test_student_join_nonexistent_hub(self, mock_get_user):
        """Test student trying to join a hub that doesn't exist"""
        # Mock user details
        mock_get_user.return_value = {
            'uid': 'student123',
            'email': 'test@example.com'
        }
        
        # Set student session
        session = self.client.session
        session['students_name'] = self.student_name
        session.save()
        
        # Prepare data for joining non-existent hub
        data = {
            'hub_name': "Non Existent Hub",
            'hub_owner': "unknown_teacher"
        }
        
        # Test join_hub view
        response = self.client.post(
            reverse('join_hub'),
            json.dumps(data),
            content_type='application/json'
        )
        
        # Check response
        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content)
        self.assertFalse(response_data['success'])
        self.assertEqual('Hub not found.', response_data['error'])