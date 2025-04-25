import time
import requests
import json
from .livestream import AGORA_APP_ID, AGORA_APP_CERTIFICATE, AGORA_REST_API_URL
import random 

def start_cloud_recording(channel_name, token, recording_uid, resource_id=None):
    """
    Start Agora Cloud Recording
    """
    # Acquire resource ID if not provided
    if not resource_id:
        print("This is the issue\n No resource id")
        acquire_res = acquire_recording_resource(channel_name)
        if not acquire_res.get('success'):
            return acquire_res
        resource_id = acquire_res.get('resource_id')
    
    # Start recording
    url = f"{AGORA_REST_API_URL}/apps/{AGORA_APP_ID}/cloud_recording/resourceid/{resource_id}/mode/mix/start"
    
    payload = {
        "cname": channel_name,
        "uid": str(recording_uid),
        "clientRequest": {
            "token": token,
            "recordingConfig": {
                "channelType": 1,
                "streamTypes": 2,  # Audio and video
                "audioProfile": 1,
                "videoStreamType": 0,
                "maxIdleTime": 30,
                "transcodingConfig": {
                    "width": 1280,
                    "height": 720,
                    "fps": 30,
                    "bitrate": 2000,
                    "mixedVideoLayout": 1,
                    "backgroundColor": "#000000"
                }
            },
            "storageConfig": {
                "vendor": 1,  # Agora Cloud Storage
                "region": 1,  # US storage
                "bucket": "your-bucket-name",
                "accessKey": "your-access-key",
                "secretKey": "your-secret-key"
            }
        }
    }
    
    try:
        response = requests.post(url, json=payload)
        response_data = response.json()
        
        if response.status_code == 200:
            return {
                'success': True,
                'recording_id': response_data.get('sid'),
                'resource_id': resource_id
            }
        else:
            return {
                'success': False,
                'error': response_data.get('message', 'Unknown error')
            }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }
    




def stop_cloud_recording(channel_name, resource_id, recording_id, recording_uid):
    """
    Stop Agora Cloud Recording
    """
    url = f"{AGORA_REST_API_URL}/apps/{AGORA_APP_ID}/cloud_recording/resourceid/{resource_id}/sid/{recording_id}/mode/mix/stop"
    
    payload = {
        "cname": channel_name,
        "uid": str(recording_uid),
        "clientRequest": {}
    }
    
    try:
        response = requests.post(url, json=payload)
        response_data = response.json()
        
        if response.status_code == 200:
            return {
                'success': True,
                'recording_files': response_data.get('serverResponse', {}).get('fileList', [])
            }
        else:
            return {
                'success': False,
                'error': response_data.get('message', 'Unknown error')
            }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }




def acquire_recording_resource(channel_name):
    """
    Acquire resource ID for cloud recording
    """
    import base64
    import random
    
    url = f"{AGORA_REST_API_URL}/apps/{AGORA_APP_ID}/cloud_recording/acquire"
    
    # Set up Basic Auth credentials
    # Replace these with your actual Customer ID and Customer Secret
    customer_id = "f507bc99b4234fbf9d675741fecb2f1b"  # This is typically the same as your APP ID
    customer_secret = "bff02f44bee04ddc85fd053d5c0bb433"  # This is NOT the same as your App Certificate
    
    # Create the Authorization header (Basic Auth)
    credentials = f"{customer_id}:{customer_secret}"
    encoded_credentials = base64.b64encode(credentials.encode('utf-8')).decode('utf-8')
    headers = {
        "Authorization": f"Basic {encoded_credentials}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "cname": channel_name,
        "uid": str(random.randint(1000000, 9999999)),
        "clientRequest": {}
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        print(f"\n\n{response}\n")
        response_data = response.json()
        
        print(f"\n\nResponse status: {response.status_code}")
        print(f"Response data: {response_data}\n\n")
        
        if response.status_code == 200:
            return {
                'success': True,
                'resource_id': response_data.get('resourceId')
            }
        else:
            
            return {
                'success': False,
                'error': response_data.get('message', 'Unknown error')
            }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }