from .views import *
from .analitics import *
from .summarise import *
from django.urls import path
from .group_chat import *
from .livestream import *
from .views_teachers import *
from .views_students import *
from .community_page import *
from .private_messages import *
from . profile_page_updates import *

urlpatterns = [

    # Login/Signup paths for both teachers and students
    path('', first_page, name='first_page'), 
    path('login/', login_page, name='login_page'), 
    path('signup/', signup_page, name='signup_page'), 
    path('success/', success_page, name='success_page'),
    path('login-teachers/', login_page_teachers, name='login_page_teachers'), 

    # Students sections paths
    path('join-hub/', join_hub, name='join_hub'),
    path('edulink-community/', community_page, name='community_page'),
    path('students-dashboard/', students_homepage, name='students_homepage'),
    path('student-analytics/<str:room_id>/', get_student_analytics, name='student_analytics'),
    path('students-dashboard/join-hubs',students_join_hub_page,name='students_join_hub_page'),
    path('students-dashboard/student-profile',student_profile_page,name='student_profile_page'),
    path('students-dashboard/hub-room/<str:id>/', current_student_hub_room, name='current_student_hub_room'),
    path('students-dashboard/student-profile/my_profile',student_profile_page_my_profile,name='student_profile_page_my_profile'),
    path('students-dashboard/hub-room/<str:id>/<str:message_id>/', hub_room_message_student_replies, name='hub_room_message_replies'),


    
    path('students-dashboard/student-profile/my_profile/students_profile_update', students_profile_update, name='students_profile_update'),
    path('students-dashboard/student-profile/security-settings',student_profile_page_securty_settings,name='student_profile_page_securty_settings'),
    path('students-dashboard/student-profile/activity-contribution',student_profile_page_activity_contribution,name='student_profile_page_activity_contribution'),




    # Teachers section paths
    path('teachers-dashboard/', teachers_homepage, name='teachers_homepage'),
    path('teachers-create-hub/', teachers_create_hub, name='teachers_create_hub'),
    path('room-analytics/<str:room_id>/', get_room_analytics, name='room-analitics'),
    path('teacher/profile/update/', teachers_profile_update, name='teacher_profile_update'),
    path('teachers-dashboard/teachers-profile', teachers_profile_page,name='teachers_profile_page'),
    path('teachers-dashboard/hub-room/<str:id>/', current_teacher_hub_room, name='current_teacher_hub_room'),
    path('teachers-dashboard/teachers-community-page',teachers_community_page, name='teachers_community_page'),
    path('teachers-dashboard/teachers-profile/my_profile',teacher_profile_page_my_profile,name='teacher_profile_page_my_profile'),
    path('teachers-dashboard/teachers-profile/my_profile/teachers_profile_update', teachers_profile_update, name='teachers_profile_update'),
    path('teachers-dashboard/hub-room/<str:id>/<str:message_id>/', hub_room_message_teacher_replies, name='hub_room_message_teacher_replies'),
    path('teachers-dashboard/teachers-profile/security-settings',teacher_profile_page_securty_settings,name='teacher_profile_page_securty_settings'),
    path('teachers-dashboard/teachers-profile/activity-contribution',teacher_profile_page_activity_contribution,name='teacher_profile_page_activity_contribution'),


    # Livestreaming
    path('start-livestream/', start_livestream, name='start_livestream'),
    path('end-livestream/', end_livestream, name='end_livestream'),
    path('join-livestream/', join_livestream, name='join_livestream'),
    path('get-active-streams/', get_active_streams, name='get_active_streams'),
    path('schedule-livestream/', schedule_livestream, name='schedule_livestream'),
    path('get-scheduled-streams/', get_scheduled_streams, name='get_scheduled_streams'),
    path('cancel-scheduled-stream/', cancel_scheduled_stream, name='cancel_scheduled_stream'),
    path('livestream-message/', livestream_message, name='livestream_message'),
    path('get-livestream-messages/', get_livestream_messages, name='get_livestream_messages'),
    path('get-stream-recordings/', get_stream_recordings, name='get-stream-recordings'),
    # Screen sharing endpoints
    path('start-screen-share/', start_screen_share, name='start_screen_share'),
    path('stop-screen-share/', stop_screen_share, name='stop_screen_share'),

    
    # Student livestream endpoints
    path('leave-livestream/', leave_livestream, name='leave_livestream'),
    path('get-stream-viewers/', get_stream_viewers, name='get_stream_viewers'),

    # Other sections paths
    path('delete-message/', delete_message, name='delete_message'),
    path('vote-reply/', vote_reply, name='vote_reply'),
    path('poll-voting/', poll_voting, name='poll_voting'),
    path('get_messages/',get_messages, name='get_messages'),
    path('send_message/', send_message, name='send_message'),
    path('search_users/', search_users, name='search_users'),
    path('follow_user/',follow_user_view,name='follow_user'), 
    path('log-tab-click/', log_tab_click, name='log_tab_click'),
    path('get-user-votes/', get_user_votes, name='get_user_votes'),
    path('get_following/', get_following_list, name='get_following'),
    path('unfollow_user/', unfollow_user_view, name='unfollow_user'),
    path('get_suggestions/', get_suggestions, name='get_suggestions'),
    path('check-poll-votes/', check_poll_votes, name='check_poll_votes'),
    path('summarize-replies/',summarize_replies, name='summarize_replies'),
    path('bookmark-questions/',bookmark_questions,name="bookmark_questions"),
    path('get_conversations/', get_conversations, name='get_conversations'),
    path('start_direct_chat/', start_direct_chat, name='start_direct_chat'),
    path('mark_messages_read/', mark_messages_read, name='mark_messages_read'),
    path('get-filtered-content/',get_filtered_content, name='get_filtered_content'),
    path('send-invite/', send_invite, name='send_invite'),
    path('search-students/', search_students, name='search_students'),
    path('respond-to-invite/', respond_to_invite, name='respond_to_invite'),
    path('check-bookmark-status/', check_bookmark_status, name='check_bookmark_status'),
    path('mark-notification-read/', mark_notification_read, name='mark_notification_read'),
    path('remove-bookmark-queston/',remove_bookmark_questions,name="remove_bookmark_questions"),
    path('accept_connection_request/', accept_connection_request, name='accept_connection_request'),
    path('decline_connection_request/', decline_connection_request, name='decline_connection_request'),
    path('get_followers/', get_followers, name='get_followers'),
    path('get_following/', get_following_connections, name='get_following_connections'),
    path('get_mutual_connections/', get_mutual_connections, name='get_mutual_connections'),
    # Add to urls.py (make sure this is added to the URL patterns)
    path('respond-to-invitation/', respond_to_invitation, name='respond_to_invitation'),




    # Group chat
    path('get-mutual-connections/', get_mutual_connections, name='get_mutual_connections'),
    path('create-group-chat/', create_group_chat, name='create_group_chat'),
    path('get-group-chats/', get_group_chats, name='get_group_chats'),
    path('send-group-message/', send_group_message, name='send_group_message'),
    path('get-group-messages/<str:group_id>/', get_group_messages, name='get_group_messages'),
    path('add-to-group/', add_to_group, name='add_to_group'),
    path('leave-group/', leave_group, name='leave_group'),



    # Emai verification
    path('verify-email/<str:token>/', verify_email, name='verify_email'),
    path('resend-verification-email/', resend_verification_email, name='resend_verification_email'),
    path('change-password/', change_password, name='change_password'),

]
