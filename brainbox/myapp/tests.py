from django.test import TestCase

# Create your tests here.

import pytest
from unittest import mock
from django.urls import reverse
from firebase_admin import auth
from rest_framework import status

# Mock Firebase Authentication to avoid hitting live servers during tests
@pytest.fixture
def mock_firebase_auth():
    with mock.patch('firebase_admin.auth.verify_id_token') as mock_verify:
        yield mock_verify

@pytest.mark.django_db
def test_login_success(mock_firebase_auth, client):
    mock_firebase_auth.return_value = {
        'uid': 'testuser123',
        'email': 'testuser@example.com',
        'name': 'Test User'
    }

    url = reverse('login_page')  
    data = {
        'id_token': 'mock_token_for_test'  
    }

    response = client.post(url, data)  # Simulate POST request to the login route
    
    assert response.status_code == status.HTTP_200_OK  # Expect 200 OK on successful login
    assert 'Login successful' in response.content.decode()  # Verify success message in response

@pytest.mark.django_db
def test_login_invalid_token(mock_firebase_auth, client):
    """Test login with an invalid Firebase ID token"""
    # Simulate an invalid token by making the mock return an error
    mock_firebase_auth.side_effect = auth.InvalidIdTokenError("Invalid ID token")

    url = reverse('login_page')
    data = {
        'id_token': 'invalid_token_for_test'
    }

    response = client.post(url, data)  # Simulate POST request to the login route
    
    assert response.status_code == status.HTTP_401_UNAUTHORIZED  # Expect 401 Unauthorized
    assert 'Invalid credentials' in response.content.decode()  # Error message for invalid token

@pytest.mark.django_db
def test_login_missing_token(client):
    """Test login without providing an ID token"""
    url = reverse('login_page')
    data = {}  # No ID token

    response = client.post(url, data)
    
    assert response.status_code == status.HTTP_400_BAD_REQUEST  # Expect 400 Bad Request
    assert 'Missing ID token' in response.content.decode()  # Check error message
