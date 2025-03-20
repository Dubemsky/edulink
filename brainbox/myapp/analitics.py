import json
from datetime import datetime, timedelta
from collections import Counter, defaultdict
from .firebase import db
from .hub_functionality import get_members_by_hub_url
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .views_hub_room import *




# Add to analitics.py

@csrf_exempt
def get_student_analytics(request, room_id):
    try:
        # Get student username from the request or session
        student_username = request.session.get("students_name")

        print(f" this is for {student_username} in room {room_id}")
        if not student_username:
            student_username = request.session.get("students_name")
            
        if not student_username:
            return JsonResponse({
                "success": False,
                "error": "No username provided"
            }, status=400)
            
        # Get all messages for this room (all users)
        messages_ref = db.collection('hub_messages').where('room_id', '==', room_id)
        messages = list(messages_ref.stream())
        
        # Get all replies for this room (all users)
        replies_ref = db.collection('hub_message_reply').where('room_id', '==', room_id)
        replies = list(replies_ref.stream())
        
        # Transform to dicts
        message_data = [msg.to_dict() for msg in messages]
        reply_data = [reply.to_dict() for reply in replies]
        
        # Filter for this student only
        student_messages = [msg for msg in message_data if msg.get('sender') == student_username]
        student_replies = [reply for reply in reply_data if reply.get('sender') == student_username]
        
        # Filter for teacher messages
        teacher_messages = [msg for msg in message_data if msg.get('role', '').lower() == 'teacher']
        
        # ------------------- PERSONAL ENGAGEMENT METRICS -------------------
        
        # Basic counts
        total_messages = len(message_data)
        total_replies = len(reply_data)
        student_message_count = len(student_messages)
        student_reply_count = len(student_replies)
        
        # Message/Reply ratio
        message_reply_ratio = student_message_count / max(student_reply_count, 1)
        
        # Calculate participation percentage
        participation_percentage = 0
        if (total_messages + total_replies) > 0:
            participation_percentage = ((student_message_count + student_reply_count) / (total_messages + total_replies)) * 100
        
        # Active days calculation
        active_days = set()
        for msg in student_messages + student_replies:
            timestamp = msg.get('timestamp', '')
            if isinstance(timestamp, str):
                try:
                    date_obj = datetime.strptime(timestamp, '%Y-%m-%d %H:%M:%S')
                    active_days.add(date_obj.strftime('%Y-%m-%d'))
                except (ValueError, TypeError):
                    pass
        
        # Most active times (hour of day)
        hour_activity = Counter()
        for msg in student_messages + student_replies:
            timestamp = msg.get('timestamp', '')
            if isinstance(timestamp, str):
                try:
                    date_obj = datetime.strptime(timestamp, '%Y-%m-%d %H:%M:%S')
                    hour_activity[date_obj.hour] += 1
                except (ValueError, TypeError):
                    pass
                    
        # Format for chart - hours of day
        active_times = [
            {"hour": hour, "count": count}
            for hour, count in sorted(hour_activity.items())
        ]
        
        # ------------------- CONTENT ANALYTICS -------------------
        
        # Message types the student has used
        message_types = Counter()
        for msg in student_messages:
            if msg.get('is_poll'):
                message_types['poll'] += 1
            elif msg.get('image_url'):
                message_types['image'] += 1
            elif msg.get('file_url'):
                message_types['file'] += 1
            elif msg.get('video_url'):
                message_types['video'] += 1
            else:
                message_types['text'] += 1
        
        # Average message length
        total_length = 0
        message_count = 0
        for msg in student_messages:
            content = msg.get('content')
            if isinstance(content, str):
                total_length += len(content)
                message_count += 1
        
        avg_message_length = total_length / max(message_count, 1)
        
        # Question rate - simple estimation by looking for question marks
        question_count = 0
        for msg in student_messages:
            content = msg.get('content')
            if isinstance(content, str) and '?' in content:
                question_count += 1
                
        question_rate = (question_count / max(student_message_count, 1)) * 100
        
        # ------------------- SOCIAL INTERACTION METRICS -------------------
        
        # Response rate - how many of student's messages got replies
        messages_with_replies = 0
        for msg in student_messages:
            msg_id = msg.get('message_id')
            if any(reply.get('question_id') == msg_id for reply in reply_data):
                messages_with_replies += 1
                
        response_rate = (messages_with_replies / max(student_message_count, 1)) * 100
        
        # Get reactions/votes given by this student
        upvotes_given = 0
        downvotes_given = 0
        user_votes_ref = db.collection('user_votes').where('username', '==', student_username)
        user_votes = list(user_votes_ref.stream())
        
        for vote in user_votes:
            vote_data = vote.to_dict()
            if vote_data.get('vote_type') == 'up':
                upvotes_given += 1
            elif vote_data.get('vote_type') == 'down':
                downvotes_given += 1
        
        # Get reactions received on student's messages and replies
        upvotes_received = sum(msg.get('upvotes', 0) for msg in student_messages)
        upvotes_received += sum(reply.get('upvotes', 0) for reply in student_replies)
        
        downvotes_received = sum(msg.get('downvotes', 0) for msg in student_messages)
        downvotes_received += sum(reply.get('downvotes', 0) for reply in student_replies)
        
        # Net contribution score
        net_contribution_score = upvotes_received - downvotes_received
        
        # Teacher interaction rate
        teacher_interactions = 0
        for reply in student_replies:
            question_id = reply.get('question_id')
            if any(msg.get('message_id') == question_id and msg.get('role', '').lower() == 'teacher' for msg in message_data):
                teacher_interactions += 1
        
        # Also count replies to student messages from teachers
        for msg in student_messages:
            msg_id = msg.get('message_id')
            if any(reply.get('question_id') == msg_id and reply.get('role', '').lower() == 'teacher' for reply in reply_data):
                teacher_interactions += 1
                
        teacher_interaction_rate = (teacher_interactions / max(len(teacher_messages), 1)) * 100
        
        # ------------------- LEARNING BEHAVIOR METRICS -------------------
        
        # Resource engagement - count file interactions
        resource_engagement = sum(1 for msg in student_messages if msg.get('file_url'))
        
        # Bookmark activity
        bookmarks = get_bookmarked_messages(student_username, room_id)
        bookmark_count = len(bookmarks)
        
        # Poll participation
        poll_votes_ref = db.collection('poll_votes').where('username', '==', student_username)
        poll_votes = list(poll_votes_ref.stream())
        poll_vote_count = len(poll_votes)
        
        # Poll participation rate
        total_polls = sum(1 for msg in message_data if msg.get('is_poll'))
        poll_participation_rate = (poll_vote_count / max(total_polls, 1)) * 100
        
        # Reading vs writing ratio - approximation
        # We consider "reading" as viewing messages + bookmarking + voting
        viewing_activity = upvotes_given + downvotes_given + bookmark_count
        writing_activity = student_message_count + student_reply_count
        
        reading_writing_ratio = viewing_activity / max(writing_activity, 1)
        
        # ------------------- PROGRESS INDICATORS -------------------
        
        # Time-based analysis (student activity per day)
        message_dates = []
        for msg in student_messages + student_replies:
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
        
        # Calculate trend line (simple linear regression)
        trend_analysis = {}
        if len(activity_timeline) > 1:
            dates = [datetime.strptime(d['date'], '%Y-%m-%d').timestamp() for d in activity_timeline]
            counts = [d['count'] for d in activity_timeline]
            
            # Normalize dates for better numerical stability
            min_date = min(dates)
            dates_norm = [d - min_date for d in dates]
            
            # Simple linear regression
            n = len(dates_norm)
            sum_x = sum(dates_norm)
            sum_y = sum(counts)
            sum_xy = sum(x * y for x, y in zip(dates_norm, counts))
            sum_xx = sum(x * x for x in dates_norm)
            
            # Slope
            slope = (n * sum_xy - sum_x * sum_y) / max((n * sum_xx - sum_x * sum_x), 0.001)
            
            # Intercept
            intercept = (sum_y - slope * sum_x) / n
            
            trend_analysis = {
                "slope": slope,
                "trend": "increasing" if slope > 0.01 else "decreasing" if slope < -0.01 else "stable",
                "activity_change_rate": slope * 86400  # Approximate daily change rate
            }
        
        # Consistency score - ratio of active days to total days in date range
        consistency_score = 0
        if activity_timeline:
            try:
                first_date = min(datetime.strptime(d['date'], '%Y-%m-%d') for d in activity_timeline)
                last_date = max(datetime.strptime(d['date'], '%Y-%m-%d') for d in activity_timeline)
                total_days = (last_date - first_date).days + 1
                consistency_score = (len(active_days) / max(total_days, 1)) * 100
            except ValueError:
                pass
        
        # Find top messages/replies by votes
        student_messages_with_votes = []
        for msg in student_messages:
            content = msg.get('content', '')
            if isinstance(content, bytes):
                try:
                    content = content.decode('utf-8')
                except:
                    content = "Encrypted content"
                    
            student_messages_with_votes.append({
                'content': content,
                'votes': msg.get('upvotes', 0) - msg.get('downvotes', 0),
                'type': 'message',
                'timestamp': msg.get('timestamp', '')
            })
            
        student_replies_with_votes = []
        for reply in student_replies:
            content = reply.get('reply_content', '')
            if isinstance(content, bytes):
                try:
                    content = content.decode('utf-8')
                except:
                    content = "Encrypted content"
                    
            student_replies_with_votes.append({
                'content': content,
                'votes': reply.get('upvotes', 0) - reply.get('downvotes', 0),
                'type': 'reply',
                'timestamp': reply.get('timestamp', '')
            })
        
        # Combine and sort by vote count
        all_student_content = student_messages_with_votes + student_replies_with_votes
        all_student_content.sort(key=lambda x: x['votes'], reverse=True)
        
        # Get top 5 messages/replies
        top_content_list = all_student_content[:5]
        
        # ------------------- ACTIONABLE INSIGHTS -------------------
        
        # Generate engagement insights
        insights = []
        
        # Participation insights
        if participation_percentage < 5:
            insights.append({
                'type': 'participation',
                'message': 'Your participation is quite low. Consider contributing more to discussions.',
                'importance': 'high'
            })
        elif participation_percentage < 15:
            insights.append({
                'type': 'participation',
                'message': 'Your participation is below average. Try to engage more often.',
                'importance': 'medium'
            })
            
        # Content type diversity
        if len(message_types) <= 1 and student_message_count > 5:
            insights.append({
                'type': 'content',
                'message': 'You\'re mostly using one type of content. Try diversifying with images, files, or polls.',
                'importance': 'medium'
            })
            
        # Poll participation
        if poll_participation_rate < 50 and total_polls > 0:
            insights.append({
                'type': 'polls',
                'message': 'You\'ve participated in less than half of the polls. Polls are a good way to engage.',
                'importance': 'low'
            })
            
        # Reading vs writing balance
        if reading_writing_ratio < 0.5:
            insights.append({
                'type': 'engagement',
                'message': 'You\'re posting content more than engaging with others. Try to read and respond to more messages.',
                'importance': 'medium'
            })
        elif reading_writing_ratio > 5:
            insights.append({
                'type': 'engagement',
                'message': 'You\'re mostly observing rather than contributing. Consider sharing your thoughts more often.',
                'importance': 'medium'
            })
            
        # Consistency insight
        if consistency_score < 30 and len(active_days) > 3:
            insights.append({
                'type': 'consistency',
                'message': 'Your participation is inconsistent. Regular engagement helps with learning.',
                'importance': 'medium'
            })
        
        # Compile analytics data
        analytics = {
            "personal_engagement": {
                "messages_sent": student_message_count,
                "replies_sent": student_reply_count,
                "message_reply_ratio": round(message_reply_ratio, 2),
                "total_contributions": student_message_count + student_reply_count,
                "participation_percentage": round(participation_percentage, 2),
                "active_days": len(active_days),
                "active_times": active_times
            },
            "content_analytics": {
                "message_types": dict(message_types),
                "avg_message_length": round(avg_message_length, 2),
                "question_rate": round(question_rate, 2)
            },
            "social_interaction": {
                "response_rate": round(response_rate, 2),
                "upvotes_given": upvotes_given,
                "downvotes_given": downvotes_given,
                "upvotes_received": upvotes_received,
                "downvotes_received": downvotes_received,
                "net_contribution_score": net_contribution_score,
                "teacher_interaction_rate": round(teacher_interaction_rate, 2)
            },
            "learning_behavior": {
                "resource_engagement": resource_engagement,
                "bookmarks_count": bookmark_count,
                "poll_votes_count": poll_vote_count,
                "poll_participation_rate": round(poll_participation_rate, 2),
                "reading_writing_ratio": round(reading_writing_ratio, 2)
            },
            "progress_indicators": {
                "activity_timeline": activity_timeline,
                "trend_analysis": trend_analysis,
                "consistency_score": round(consistency_score, 2),
                "top_content": top_content_list
            },
            "actionable_insights": insights,
            "room_totals": {
                "total_messages": total_messages,
                "total_replies": total_replies,
                "total_polls": total_polls
            }
        }
        print(f"\n\nThese is what i am passing still {analytics}\n\n")
        
        return JsonResponse({
            "success": True,
            "analytics": analytics
        })
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error generating student analytics: {e}")
        print(error_details)
        return JsonResponse({
            "success": False,
            "error": str(e)
        }, status=500)














@csrf_exempt
def get_room_analytics(request, **kwargs):
    """
    Enhanced version of the room analytics function.
    Fetches comprehensive analytics data for a specific room.
    Returns various metrics like message counts, user engagement, temporal patterns, etc.
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
        
        # ------------------- BASIC COUNTS -------------------
        
        # Basic counts
        total_messages = len(message_data)
        total_replies = len(reply_data)
        
        # Message types
        message_types = Counter(msg.get('message_type', 'text') for msg in message_data)
        
        # Ensure the following common types are present even if count is 0
        for msg_type in ['text', 'image', 'file', 'video', 'poll']:
            if msg_type not in message_types:
                message_types[msg_type] = 0
        
        # ------------------- USER ENGAGEMENT -------------------
        
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
            for sender, count in combined_counts.most_common(10)  # Increased from 5 to 10
        ]
        
        # ------------------- TEMPORAL ANALYSIS -------------------
        
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
        
        # Format for chart and ensure dates are sorted
        activity_timeline = [
            {"date": date, "count": count}
            for date, count in sorted(messages_per_day.items())
        ]
        
        # ------------------- ADVANCED ENGAGEMENT METRICS -------------------
        
        # Calculate hourly activity distribution
        hour_activity = Counter()
        for msg in message_data:
            timestamp = msg.get('timestamp')
            if isinstance(timestamp, (str, datetime)):
                try:
                    date_obj = None
                    if isinstance(timestamp, str):
                        date_obj = datetime.strptime(timestamp, '%Y-%m-%d %H:%M:%S')
                    else:
                        date_obj = timestamp
                    
                    hour_activity[date_obj.hour] += 1
                except ValueError:
                    continue
        
        # Format for chart
        hourly_distribution = [
            {"hour": hour, "count": count}
            for hour, count in sorted(hour_activity.items())
        ]
        
        # Get response time metrics (time between message and first reply)
        response_times = []
        for msg in message_data:
            msg_id = msg.get('message_id')
            msg_time = None
            
            try:
                if isinstance(msg.get('timestamp'), str):
                    msg_time = datetime.strptime(msg.get('timestamp'), '%Y-%m-%d %H:%M:%S')
                elif isinstance(msg.get('timestamp'), datetime):
                    msg_time = msg.get('timestamp')
            except ValueError:
                continue
                
            if not msg_time:
                continue
                
            # Find replies to this message
            relevant_replies = [r for r in reply_data if r.get('question_id') == msg_id]
            if not relevant_replies:
                continue
                
            # Find the earliest reply
            earliest_reply_time = None
            for reply in relevant_replies:
                reply_time = None
                try:
                    if isinstance(reply.get('timestamp'), str):
                        reply_time = datetime.strptime(reply.get('timestamp'), '%Y-%m-%d %H:%M:%S')
                    elif isinstance(reply.get('timestamp'), datetime):
                        reply_time = reply.get('timestamp')
                except ValueError:
                    continue
                    
                if reply_time and (earliest_reply_time is None or reply_time < earliest_reply_time):
                    earliest_reply_time = reply_time
            
            if earliest_reply_time:
                # Calculate time difference in minutes
                time_diff = (earliest_reply_time - msg_time).total_seconds() / 60
                response_times.append(time_diff)
        
        # Calculate average response time (if data available)
        avg_response_time = None
        if response_times:
            avg_response_time = sum(response_times) / len(response_times)
        
        # ------------------- POLL ANALYSIS -------------------
        
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
        
        # ------------------- ENGAGEMENT QUALITY -------------------
        
        # Calculate interaction metrics
        
        # 1. Messages with replies percentage
        messages_with_replies = 0
        for msg in message_data:
            msg_id = msg.get('message_id')
            if any(reply.get('question_id') == msg_id for reply in reply_data):
                messages_with_replies += 1
        
        message_reply_ratio = (messages_with_replies / max(total_messages, 1)) * 100
        
        # 2. Reactions engagement
        upvotes_total = sum(msg.get('upvotes', 0) for msg in message_data)
        upvotes_total += sum(reply.get('upvotes', 0) for reply in reply_data)
        
        downvotes_total = sum(msg.get('downvotes', 0) for msg in message_data)
        downvotes_total += sum(reply.get('downvotes', 0) for reply in reply_data)
        
        # 3. Content richness (percentage of messages that aren't just text)
        non_text_messages = sum(1 for msg in message_data if 
                              msg.get('image_url') or 
                              msg.get('file_url') or 
                              msg.get('video_url') or 
                              msg.get('is_poll', False))
        
        content_richness = (non_text_messages / max(total_messages, 1)) * 100
        
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
            
        # Define the function to calculate inactive days
        def calculate_inactive_days(timeline):
            if not timeline or len(timeline) < 2:
                return 0
                
            # Sort dates
            dates = sorted([entry["date"] for entry in timeline])
            
            # Convert to datetime objects
            date_objects = []
            for date_str in dates:
                try:
                    date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                    date_objects.append(date_obj)
                except ValueError:
                    continue
            
            if len(date_objects) < 2:
                return 0
                
            # Calculate gaps
            total_inactive_days = 0
            for i in range(1, len(date_objects)):
                gap = (date_objects[i] - date_objects[i-1]).days - 1
                if gap > 0:
                    total_inactive_days += gap
                    
            return total_inactive_days
        
        # ------------------- COMPILE ANALYTICS -------------------
        
        # Calculate inactive days
        inactive_days = calculate_inactive_days(activity_timeline)
        
        # Compile analytics data
        analytics = {
            "message_metrics": {
                "total_messages": total_messages,
                "total_replies": total_replies,
                "message_types": dict(message_types),
                "total_participants": len(all_participants),
                "total_reactions": {"upvotes": upvotes_total, "downvotes": downvotes_total},
                "messages_with_replies_percent": round(message_reply_ratio, 2),
                "content_richness_percent": round(content_richness, 2)
            },
            "user_engagement": {
                "top_contributors": top_contributors,
                "participation_percentage": round(participation_percentage, 2),
                "user_count": members_count,
                "average_response_time_minutes": round(avg_response_time, 2) if avg_response_time is not None else None
            },
            "temporal_analysis": {
                "activity_timeline": activity_timeline,
                "hourly_distribution": hourly_distribution,
                "peak_activity_hour": hour_activity.most_common(1)[0][0] if hour_activity else None,
                "peak_activity_count": hour_activity.most_common(1)[0][1] if hour_activity else 0,
                "inactive_days": inactive_days
            },
            "polls": poll_data,
            "engagement_quality": {
                "message_reply_ratio": round(message_reply_ratio, 2),
                "reaction_per_message": round((upvotes_total + downvotes_total) / max(total_messages + total_replies, 1), 2),
                "content_richness": round(content_richness, 2),
                "sentiment_ratio": round(upvotes_total / max(downvotes_total, 1), 2) if downvotes_total > 0 else upvotes_total
            }
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