import jwt
import time
import requests
from livekit import AccessToken, VideoGrants
import os

# Your LiveKit credentials
API_KEY = "APIcbCX5qYjr7zg"
API_SECRET = "NTeoX1IITeFTTQ71tPnF95SjxsIRo3kRulXN5boAqWX"
API_URL = "https://livestreaming-wo47lfci.livekit.cloud"

# Generate the token using the LiveKit Python SDK
now = int(time.time())

# Create a token with appropriate access grants (e.g., room_join)
token = AccessToken(API_KEY, API_SECRET) \
    .with_identity("identity") \
    .with_name("name") \
    .with_grants(VideoGrants(room_join=True, room="my-room")) \
    .to_jwt()

# If using older PyJWT version and token is bytes
if isinstance(token, bytes):
    token = token.decode('utf-8')

# Set up the headers for the request
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

# Make the POST request to the LiveKit API
response = requests.post(
    f"{API_URL}/twirp/livekit.RoomService/ListRooms",
    headers=headers,
    json={}  # Empty body for this request
)

# Print response details
print(f"Status: {response.status_code}")
print(f"Response: {response.text}")
print(f"Headers: {response.headers}")
