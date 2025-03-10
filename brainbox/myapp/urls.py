from .views import *
from .analitics import *
from django.urls import path
from .views_teachers import *
from .views_students import *
from .views_hub_room import *
from .community_page import *
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
    path('students-dashboard/join-hubs',students_join_hub_page,name='students_join_hub_page'),
    path('students-dashboard/student-profile',student_profile_page,name='student_profile_page'),


    path('room-analytics/<str:id>/',get_room_analytics, name='get_room_analytics'),


    path('students-dashboard/hub-room/<str:id>/', current_student_hub_room, name='current_student_hub_room'),
    path('students-dashboard/student-profile/my_profile',student_profile_page_my_profile,name='student_profile_page_my_profile'),
    path('students-dashboard/hub-room/<str:id>/<str:message_id>/', hub_room_message_student_replies, name='hub_room_message_replies'),
    path('students-dashboard/student-profile/my_profile/students_profile_update', students_profile_update, name='students_profile_update'),
    path('students-dashboard/student-profile/security-settings',student_profile_page_securty_settings,name='student_profile_page_securty_settings'),
    path('students-dashboard/student-profile/activity-contribution',student_profile_page_activity_contribution,name='student_profile_page_activity_contribution'),


    # Teachers section paths
    path('teachers-dashboard/', teachers_homepage, name='teachers_homepage'),
    path('teachers-create-hub/', teachers_create_hub, name='teachers_create_hub'),
    path('teacher_invite_student',teacher_invite_student,name='teacher_invite_student'),
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
    path('follow-user/', follow_user, name='follow_user'),
    path('get-following/', get_following, name='get_following'),
    path('log-tab-click/', log_tab_click, name='log_tab_click'),
    path('get-user-votes/', get_user_votes, name='get_user_votes'),
    path('get_suggestions/', get_suggestions, name='get_suggestions'),
    path('check-poll-votes/', check_poll_votes, name='check_poll_votes'),
    path('bookmark-questions/',bookmark_questions,name="bookmark_questions"),
    path('check-bookmark-status/', check_bookmark_status, name='check_bookmark_status'),
    path('mark-notification-read/', mark_notification_read, name='mark_notification_read'),
    path('remove-bookmark-queston/',remove_bookmark_questions,name="remove_bookmark_questions"),


]



