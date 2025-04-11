from django.http import HttpResponse
import jwt
import time
import uuid

def direct_room(request, slug):
    """Debug endpoint that directly returns HTML for the room"""
    # LiveKit credentials
    api_key = "APIRsaxCuofVw7K"
    api_secret = "ZnrqffqzbGqyHdGqGGjTfL2I1fOGMMKSIK7Htqb11NDC"
    livekit_instance = "edulink-oxkw0h5q.livekit.cloud"
    
    # Generate token
    user_identity = f"viewer-{uuid.uuid4()}"
    exp = int(time.time()) + 3600
    
    claims = {
        'iss': api_key,
        'sub': user_identity,
        'exp': exp,
        'nbf': int(time.time()),
        'jti': str(uuid.uuid4()),
        'video': {
            'room': slug,
            'roomJoin': True,
            'canPublish': False,
            'canSubscribe': True,
        }
    }
    
    token = jwt.encode(claims, api_secret, algorithm='HS256')
    if isinstance(token, bytes):
        token = token.decode('utf-8')
    
    # Direct URL for iframe
    room_url = f"https://{livekit_instance}/custom?liveKitUrl=wss://{livekit_instance}&token={token}"
    
    # Return a simple HTML page with the iframe
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>LiveKit Room: {slug}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body, html {{ margin: 0; padding: 0; height: 100%; overflow: hidden; }}
            iframe {{ width: 100%; height: 100vh; border: none; }}
        </style>
    </head>
    <body>
        <iframe src="{room_url}" allow="camera; microphone; fullscreen; speaker; display-capture"></iframe>

        <p>This is it {room_url}</p>
    </body>
    </html>
    """

    print(room_url)
    
    return HttpResponse(html)