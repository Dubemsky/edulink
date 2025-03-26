from .views import *
from .analitics import *
from .summarise import *
from .group_chat import *
from django.urls import path
from .views_teachers import *
from .views_students import *
from .community_page import *
from .livestream_view import *
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
   

    # Other sections paths
    
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

    path('get_group_chats/', get_group_chats, name='get_group_chats'),
    path('create_group_chat/', create_group_chat, name='create_group_chat'),
    path('send_group_message/', send_group_message, name='send_group_message'),
    path('update_group_info/', update_group_info, name='update_group_info'),
  
    path('send-invite/', send_invite, name='send_invite'),
    path('search-students/', search_students, name='search_students'),
    path('respond-to-invite/', respond_to_invite, name='respond_to_invite'),

    path('check-bookmark-status/', check_bookmark_status, name='check_bookmark_status'),
    path('mark-notification-read/', mark_notification_read, name='mark_notification_read'),
        path('get_group_messages/<str:group_id>/', get_group_messages, name='get_group_messages'),
    path('mark_group_messages_read/', mark_group_messages_read, name='mark_group_messages_read'),
    path('remove_group_participant/', remove_group_participant, name='remove_group_participant'),
    path('remove-bookmark-queston/',remove_bookmark_questions,name="remove_bookmark_questions"),
    path('accept_connection_request/', accept_connection_request, name='accept_connection_request'),
    path('decline_connection_request/', decline_connection_request, name='decline_connection_request'),

    # Add these URL patterns to your urls.py file

# Livestream related URLs
    path('schedule-livestream/', schedule_livestream_view, name='schedule_livestream'),
    path('get-upcoming-livestreams/', get_upcoming_livestreams_view, name='get_upcoming_livestreams'),
    path('cancel-livestream/', cancel_livestream_view, name='cancel_livestream'),
    path('start-livestream/', start_livestream_view, name='start_livestream'),
    path('livestream/<str:livestream_id>/<str:room_name>/', livestream_room_view, name='livestream_room'),
    path('get-teacher-livestreams/', get_teacher_livestreams_view, name='get_teacher_livestreams'),
    path('get-livestream-details/<str:livestream_id>/', get_livestream_details_view, name='get_livestream_details'),
    path('update-livestream/', update_livestream_view, name='update_livestream'),






# Emai verification
    path('verify-email/<str:token>/', verify_email, name='verify_email'),
    path('resend-verification-email/', resend_verification_email, name='resend_verification_email'),
    path('change-password/', change_password, name='change_password'),




]






"""
HTTP POST /students-dashboard/mark_messages_read/ 404 [0.02, 127.0.0.1:56427]
HTTP POST /students-dashboard/mark_messages_read/ 404 [0.01, 127.0.0.1:56485]
HTTP POST /edulink-community/mark_messages_read/ 404 [0.02, 127.0.0.1:56563]
HTTP POST /teachers-dashboard/mark_messages_read/ 404 [0.01, 127.0.0.1:56667]
HTTP POST /students-dashboard/mark_messages_read/ 404 [0.02, 127.0.0.1:56485]
HTTP POST /teachers-dashboard/mark_messages_read/ 404 [0.02, 127.0.0.1:57014]


"""



