import json
import requests
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
def summarize_replies(request):
    if request.method == 'POST':
        try:
            # Parse JSON body
            data = json.loads(request.body)
            replies = data.get('replies', [])
            
            # Filter out empty or very short replies
            replies = [reply.strip() for reply in replies if reply.strip()]
            print("I am here now")
            
            # Validate input
            if not replies:
                return JsonResponse({
                    'success': False, 
                    'error': 'No valid replies provided'
                }, status=400)
            
            # Combine replies into a single text
            combined_text = ' '.join(replies)
            
            # Check total word count
            word_count = len(combined_text.split())
            if word_count < 50:
                print(f'Not enough content to summarize (only {word_count} words)')
                return JsonResponse({
                    'success': False, 
                    'error': f'Not enough content to summarize (only {word_count} words)'
                }, status=400)
            
            # External summarization service URL 
            # Replace with your actual deployed Flask app URL
            SUMMARIZATION_SERVICE_URL = 'http://172.28.0.12:5000/summarize'
            
            # Make request to external summarization service
            response = requests.post(
                SUMMARIZATION_SERVICE_URL, 
                json={'text': combined_text},
                timeout=30  # 30 seconds timeout
            )
            
            if response.status_code == 200:
                summary = response.json().get('summary', '')
                
                # Additional validation of summary
                if not summary:
                    return JsonResponse({
                        'success': False, 
                        'error': 'Generated summary is empty'
                    }, status=500)
                print(f"This is the summary {summary}")
                return JsonResponse({
                    'success': True, 
                    'summary': summary,
                    'word_count': word_count  # Optional: send back original word count
                })
            else:
                return JsonResponse({
                    'success': False, 
                    'error': f'Failed to generate summary (Status: {response.status_code})'
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
    
    return JsonResponse({
        'success': False, 
        'error': 'Invalid request method'
    }, status=405)