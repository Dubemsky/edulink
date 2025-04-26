import time
import requests
import json
import base64
import random
from .livestream import AGORA_APP_ID, AGORA_APP_CERTIFICATE, AGORA_REST_API_URL

def acquire_recording_resource(channel_name, recording_uid=None):
    """
    Acquire resource ID for cloud recording
    """
    url = f"{AGORA_REST_API_URL}/apps/{AGORA_APP_ID}/cloud_recording/acquire"
    
    # Set up Basic Auth credentials
    customer_id = "f507bc99b4234fbf9d675741fecb2f1b"  # This is typically the same as your APP ID
    customer_secret = "bff02f44bee04ddc85fd053d5c0bb433"  # This is NOT the same as your App Certificate
    
    # Create the Authorization header (Basic Auth)
    credentials = f"{customer_id}:{customer_secret}"
    encoded_credentials = base64.b64encode(credentials.encode('utf-8')).decode('utf-8')
    headers = {
        "Authorization": f"Basic {encoded_credentials}",
        "Content-Type": "application/json"
    }
    
    # Use the provided recording_uid if available, otherwise generate one
    if recording_uid is None:
        uid = str(random.randint(1000000, 9999999))
    else:
        uid = str(recording_uid)
    
    payload = {
        "cname": channel_name,
        "uid": uid,
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
                'resource_id': response_data.get('resourceId'),
                'uid': uid  # Return the UID that was used
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

def start_cloud_recording(channel_name, token, recording_uid, resource_id=None):
    """
    Start Agora Cloud Recording
    """
    # Acquire resource ID if not provided
    if not resource_id:
        print("This is the issue\n No resource id")
        acquire_res = acquire_recording_resource(channel_name, recording_uid)
        if not acquire_res.get('success'):
            return acquire_res
        resource_id = acquire_res.get('resource_id')
        # Use the same UID that was used for acquiring the resource
        recording_uid = acquire_res.get('uid')
    
    # Start recording
    url = f"{AGORA_REST_API_URL}/apps/{AGORA_APP_ID}/cloud_recording/resourceid/{resource_id}/mode/mix/start"
    
    # Set up Basic Auth credentials
    customer_id = "f507bc99b4234fbf9d675741fecb2f1b"
    customer_secret = "bff02f44bee04ddc85fd053d5c0bb433"
    
    # Create the Authorization header (Basic Auth)
    credentials = f"{customer_id}:{customer_secret}"
    encoded_credentials = base64.b64encode(credentials.encode('utf-8')).decode('utf-8')
    headers = {
        "Authorization": f"Basic {encoded_credentials}",
        "Content-Type": "application/json"
    }
    
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
                "vendor": 2,  # Amazon S3
                "region": 0,  # US East (N. Virginia)
                "bucket": "edulinkbucket1",
                "accessKey": "", # Find it in downloads/projects/api_tutorials> 
                "secretKey": "", 
            }
        }
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        response_data = response.json()
        
        # Add debugging
        print(f"\n\nStart recording response status: {response.status_code}")
        print(f"Start recording response data: {response_data}\n\n")
        
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
    
    # Set up Basic Auth credentials
    customer_id = "f507bc99b4234fbf9d675741fecb2f1b" 
    customer_secret = "bff02f44bee04ddc85fd053d5c0bb433"
    
    # Create the Authorization header (Basic Auth)
    credentials = f"{customer_id}:{customer_secret}"
    encoded_credentials = base64.b64encode(credentials.encode('utf-8')).decode('utf-8')
    headers = {
        "Authorization": f"Basic {encoded_credentials}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "cname": channel_name,
        "uid": str(recording_uid),
        "clientRequest": {}
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        response_data = response.json()
        
        # Add debugging
        print(f"\n\nStop recording response status: {response.status_code}")
        print(f"Stop recording response data: {response_data}\n\n")
        
        if response.status_code == 200:
            # Even with 200 status, check if there was a specific error code
            if 'code' in response_data and response_data['code'] != 0:
                error_reason = response_data.get('reason', 'Unknown error')
                print(f"API returned error code {response_data['code']}: {error_reason}")
                
                # For some specific error codes, we can still consider it a "success"
                # Code 49 often means the recording was already stopped
                if response_data['code'] == 49:
                    return {
                        'success': True,
                        'recording_files': [],
                        'warning': f"Recording may have already been stopped: {error_reason}"
                    }
                
                return {
                    'success': False,
                    'error': f"Error code {response_data['code']}: {error_reason}"
                }
            
            # Check if we received a proper file list
            file_list = response_data.get('serverResponse', {}).get('fileList', [])
            if file_list == '':  # Empty string means no files yet
                print("Warning: Recording stopped but no files were generated yet")
                return {
                    'success': True,
                    'recording_files': [],
                    'warning': "Recording stopped but no files were generated yet. Files may still be uploading."
                }
            
            return {
                'success': True,
                'recording_files': file_list
            }
        else:
            error_msg = response_data.get('reason', response_data.get('message', 'Unknown error'))
            error_code = response_data.get('code', 'Unknown code')
            return {
                'success': False,
                'error': f"Error code {error_code}: {error_msg}"
            }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }