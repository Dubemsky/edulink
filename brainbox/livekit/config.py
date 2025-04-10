import os
from django.conf import settings

# LiveKit Server Configuration
LIVEKIT_API_URL = "wss://edulink-oxkw0h5q.livekit.cloud"
LIVEKIT_API_KEY = "APIRsaxCuofVw7K"
LIVEKIT_API_SECRET = "ZnrqffqzbGqyHdGqGGjTfL2I1fOGMMKSIK7Htqb11NDC"

# Room Configuration Defaults
DEFAULT_ROOM_SETTINGS = {
    'empty_timeout': 5 * 60,  # Auto-close room after 5 minutes of inactivity
    'max_participants': 50,   # Maximum participants per room
}

# Token Configuration
DEFAULT_TOKEN_TTL = 6 * 60 * 60  # 6 hours