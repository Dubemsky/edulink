import json
import requests
import traceback
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt



# Get the summarization service URL from settings, or use a default
# You can add SUMMARIZATION_SERVICE_URL to your Django settings
# In your Django settings.py
SUMMARIZATION_SERVICE_URL = ' https://9170-35-221-60-204.ngrok-free.app/summarize'


@csrf_exempt
def summarize_replies(request):
    """
    Django view to handle the summarization request.
    Accepts POST requests with reply text, sends them to the Flask service,
    and returns the summarized content.
    """
    # Check if this is a POST request
    if request.method != 'POST':
        print(f"[ERROR] Invalid request method: {request.method}")
        return JsonResponse({
            'success': False, 
            'error': 'Invalid request method - please use POST'
        }, status=405)
    
    try:
        # Parse the request body
        print(f"[INFO] Processing summarization request")
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError as e:
            return JsonResponse({
                'success': False,
                'error': f'Invalid JSON format: {str(e)}'
            }, status=400)
        
        # Get replies array
        replies = data.get('replies', [])
        
        # Filter out empty replies and join them
        replies = [reply.strip() for reply in replies if reply.strip()]
        combined_text = ' '.join(replies)
        
        # Get word count
        word_count = len(combined_text.split())
        print(f"[DEBUG] Combined text has {word_count} words")
        
        # Validate minimum word count
        if word_count < 50:
            print(f"[WARNING] Insufficient content: only {word_count} words")
            return JsonResponse({
                'success': False,
                'error': f'Not enough content to create a meaningful summary (only {word_count} words). Need at least 50 words.'
            }, status=400)
      
        try:
            # Make the request to the Flask service
            response = requests.post(
                SUMMARIZATION_SERVICE_URL,
                json={'text': combined_text},
                timeout=60,  # 60 second timeout
                headers={'Content-Type': 'application/json'}
            )
            
            print(f"[DEBUG] Service response status: {response.status_code}")
        except requests.ConnectionError as e:
            print(f"[ERROR] Connection error: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': f'Could not connect to the summarization service: {str(e)}'
            }, status=503)
        except requests.Timeout:
            print(f"[ERROR] Request timed out")
            return JsonResponse({
                'success': False,
                'error': 'The summarization service took too long to respond. Please try again with less content.'
            }, status=504)
        except Exception as e:
            print(f"[ERROR] Request exception: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': f'Error connecting to summarization service: {str(e)}'
            }, status=500)
        
        # Process the response from the Flask service
        if response.status_code == 200:
            try:
                # Parse JSON response
                result = response.json()
                print(f"[DEBUG] Service returned: {result.keys()}")
                
                # Get the summary
                summary = result.get('summary', '')
                
                # Validate summary quality
                if not summary:
                    print(f"[WARNING] Empty summary returned")
                    return JsonResponse({
                        'success': False,
                        'error': 'The summarization service returned an empty summary.'
                    }, status=500)
                    
                if summary == combined_text:
                    print(f"[WARNING] Summary identical to input")
                    return JsonResponse({
                        'success': False,
                        'error': 'Could not generate a meaningful summary that differs from the original text.'
                    }, status=500)
                
                # Return the summary
                print(f"[INFO] Successfully generated summary with {len(summary.split())} words")
                return JsonResponse({
                    'success': True,
                    'summary': summary,
                    'word_count': word_count,
                    'summary_word_count': len(summary.split())
                })
                
            except json.JSONDecodeError:
                print(f"[ERROR] Invalid JSON in service response")
                return JsonResponse({
                    'success': False,
                    'error': 'The summarization service returned an invalid response.'
                }, status=500)
        else:
            # Handle error response
            print(f"[ERROR] Service returned error: {response.status_code}")
            try:
                error_content = response.json()
                print(f"[ERROR] Error content: {error_content}")
            except:
                error_content = response.text[:200]
                print(f"[ERROR] Raw error content: {error_content}")
                
            return JsonResponse({
                'success': False,
                'error': f'Summarization service error (Status: {response.status_code})'
            }, status=500)
            
    except Exception as e:
        # Catch-all for any other errors
        print(f"[ERROR] Unexpected error: {str(e)}")
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        return JsonResponse({
            'success': False,
            'error': f'An unexpected error occurred: {str(e)}'
        }, status=500)