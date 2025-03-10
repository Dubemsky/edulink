import json
from datetime import datetime, timedelta
from collections import Counter, defaultdict
from .firebase import db
from .hub_functionality import get_members_by_hub_url
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
def get_room_analytics(request, **kwargs):
    """
    Fetches analytics data for a specific room.
    Returns various metrics like message counts, user engagement, etc.
    
    This function accepts any URL parameter through kwargs to be compatible
    with various URL routing configurations.
    """
    try:
        # Extract room_id from any of the possible kwargs
        room_id = None
        for key, value in kwargs.items():
            room_id = value
            break
            
        if not room_id:
            return JsonResponse({
                "success": False,
                "error": "No room ID provided"
            }, status=400)
        # Get all messages for this room
        messages_ref = db.collection('hub_messages').where('room_id', '==', room_id)
        messages = list(messages_ref.stream())
        
        # Get all replies for this room
        replies_ref = db.collection('hub_message_reply').where('room_id', '==', room_id)
        replies = list(replies_ref.stream())
        
        # Transform to dicts
        message_data = [msg.to_dict() for msg in messages]
        reply_data = [reply.to_dict() for reply in replies]
        
        # Basic counts
        total_messages = len(message_data)
        total_replies = len(reply_data)
        
        # Message types
        message_types = Counter(msg.get('message_type', 'text') for msg in message_data)
        
        # Get unique senders (participants)
        message_senders = set(msg.get('sender') for msg in message_data if msg.get('sender'))
        reply_senders = set(reply.get('sender') for reply in reply_data if reply.get('sender'))
        all_participants = message_senders.union(reply_senders)
        
        # User engagement - who posts the most
        sender_message_counts = Counter(msg.get('sender') for msg in message_data if msg.get('sender'))
        sender_reply_counts = Counter(reply.get('sender') for reply in reply_data if reply.get('sender'))
        
        # Combined engagement (messages + replies)
        combined_counts = sender_message_counts.copy()
        for sender, count in sender_reply_counts.items():
            combined_counts[sender] += count
        
        # Convert to list of dicts for easy rendering in charts
        top_contributors = [
            {"name": sender, "messages": count} 
            for sender, count in combined_counts.most_common(5)
        ]
        
        # Time-based analysis (messages per day)
        message_dates = []
        for msg in message_data:
            timestamp = msg.get('timestamp')
            if isinstance(timestamp, (str, datetime)):
                try:
                    # Handle both string and datetime objects
                    date_str = ""
                    if isinstance(timestamp, str):
                        # Parse the timestamp string to datetime object
                        date_obj = datetime.strptime(timestamp, '%Y-%m-%d %H:%M:%S')
                        date_str = date_obj.strftime('%Y-%m-%d')
                    else:
                        # Already a datetime object
                        date_str = timestamp.strftime('%Y-%m-%d')
                    
                    message_dates.append(date_str)
                except ValueError:
                    # Skip invalid timestamps
                    continue
        
        # Count messages per day
        messages_per_day = Counter(message_dates)
        
        # Format for chart
        activity_timeline = [
            {"date": date, "count": count}
            for date, count in sorted(messages_per_day.items())
        ]
        
        # Poll statistics if any
        polls = [msg for msg in message_data if msg.get('is_poll', False)]
        poll_data = []
        
        for poll in polls:
            poll_options = poll.get('poll_options', [])
            if poll_options:
                poll_data.append({
                    "question": poll.get('content', 'Unnamed Poll'),
                    "options": [
                        {"option": opt.get('option', ''), "votes": opt.get('votes', 0)}
                        for opt in poll_options
                    ]
                })
        
        # Get reactions/votes data
        upvotes_total = sum(msg.get('upvotes', 0) for msg in message_data)
        upvotes_total += sum(reply.get('upvotes', 0) for reply in reply_data)
        
        downvotes_total = sum(msg.get('downvotes', 0) for msg in message_data)
        downvotes_total += sum(reply.get('downvotes', 0) for reply in reply_data)
        
        # Get members count safely
        try:
            members = get_members_by_hub_url(room_id)
            members_count = len(members) if members else 0
        except Exception as e:
            print(f"Error getting members: {e}")
            members_count = 0
        
        # Calculate participation percentage safely
        participation_percentage = 0
        if members_count > 0:
            participation_percentage = (len(all_participants) / members_count) * 100
        
        # Compile analytics data
        analytics = {
            "message_metrics": {
                "total_messages": total_messages,
                "total_replies": total_replies,
                "message_types": dict(message_types),
                "total_participants": len(all_participants),
                "total_reactions": {"upvotes": upvotes_total, "downvotes": downvotes_total}
            },
            "user_engagement": {
                "top_contributors": top_contributors,
                "participation_percentage": round(participation_percentage, 2)
            },
            "activity_timeline": activity_timeline,
            "polls": poll_data
        }
        
        return JsonResponse({
            "success": True,
            "analytics": analytics
        })
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error generating analytics: {e}")
        print(error_details)
        return JsonResponse({
            "success": False,
            "error": str(e)
        }, status=500)