import json
import requests
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
def summarize_replies(request):
    if request.method != 'POST':
        return JsonResponse({
            'success': False, 
            'error': 'Invalid request method'
        }, status=405)
    
    try:
        # Parse JSON body
        data = json.loads(request.body)
        replies = data.get('replies', [])
        
        # Filter out empty replies and join them
        replies = [reply.strip() for reply in replies if reply.strip()]
        combined_text = ' '.join(replies)
        
        # Validate minimum word count
        word_count = len(combined_text.split())
        if word_count < 70:  # Increased minimum word requirement
            return JsonResponse({
                'success': False,
                'error': f'Not enough content to summarize (only {word_count} words). Minimum 70 words required.'
            }, status=400)
        
        # Make request to Flask summarization service
        SUMMARIZATION_SERVICE_URL = 'http://172.28.0.12:5000/summarize'  # Update with your Flask service URL
        
        response = requests.post(
            SUMMARIZATION_SERVICE_URL,
            json={'text': combined_text},
            timeout=30  # 30 second timeout
        )
        
        if response.status_code == 200:
            summary = response.json().get('summary', '')
            
            # Additional validation of summary
            if not summary or summary == combined_text:
                return JsonResponse({
                    'success': False,
                    'error': 'Could not generate a meaningful summary'
                }, status=500)
            
            # Return successful response with summary
            return JsonResponse({
                'success': True,
                'summary': summary,
                'word_count': word_count
            })
        else:
            return JsonResponse({
                'success': False,
                'error': f'Summarization service error (Status: {response.status_code})'
            }, status=response.status_code)
            
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON format'
        }, status=400)
        
    except requests.RequestException as e:
        return JsonResponse({
            'success': False,
            'error': f'Connection error: {str(e)}'
        }, status=500)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Unexpected error: {str(e)}'
        }, status=500)