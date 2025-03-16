import re
import logging
from .firebase import *
from django.shortcuts import render, redirect

# Initialize the logger which is used to track app behaviors
logger = logging.getLogger(__name__)

"""
---------------------- SIGNUP/SIGN-IN  SECTIONS -----------------------
"""

def first_page(request):
    return render(request, 'myapp/login/first_page.html')


def login_page(request):
    if request.method == 'POST':
        email = request.POST.get('email')
        password = request.POST.get('password')

        # Verify that the user is a student
        if get_users_role(email) != "student":
            error_message = "Error! Try again."
            return render(request, "myapp/login/login.html", {"error": error_message})

        # Authenticate user credentials
        auth_result = authenticate_user(email, password)
        if auth_result["success"]:
            request.session['students_name'] = get_user_display_name(email)
            request.session['role'] = 'student'
            return redirect('/students-dashboard/')  # Directly using the URL path
        else:
            error_message = auth_result["error"]
            return render(request, "myapp/login/login.html", {"error": error_message})

    return render(request, "myapp/login/login.html")


def login_page_teachers(request):
    if request.method == 'POST':
        email = request.POST.get('email')
        password = request.POST.get('password')

        if get_users_role(email) != "lecturer":
            error_message = "Error! Try again!"
            return render(request, "myapp/login/login_teachers.html", {"error": error_message})

        # Authenticate teacher credentials
        auth_result = authenticate_user(email, password)
        if auth_result["success"]:
            request.session['teachers_name'] = get_user_display_name(email)
            request.session['role'] = 'teacher'
            return redirect('/teachers-dashboard/')  # Directly using the URL path
        else:
            error_message = auth_result["error"]
            return render(request, "myapp/login/login_teachers.html", {"error": error_message})

    return render(request, "myapp/login/login_teachers.html")


def signup_page(request):
    error_message = None
    role = request.GET.get('role')

    if request.method == 'POST':
        username = request.POST.get('username')
        email = request.POST.get('email')
        password = request.POST.get('password')
        confirm_password = request.POST.get('confirm_password')

        # Validate email domain and password strength using regular expression (regex)
        if not email.endswith('@mytudublin.ie'):
            error_message = "Email must be from the domain @mytudublin.ie."
        elif password != confirm_password:
            error_message = "Passwords do not match."
        elif len(password) < 6:
            error_message = "Password must be at least 6 characters long."
        elif not re.search(r'[A-Z]', password):
            error_message = "Password must contain at least one uppercase letter."
        elif not re.search(r'\d', password):
            error_message = "Password must contain at least one number."
        elif not re.search(r'[!@#$%^&*]', password):
            error_message = "Password must contain at least one special character."
        else:
            try:
                # Add new student to the database
                if add_students_to_database(email, password, username, role):
                    return render(request, "myapp/login/success.html")
                else:
                    error_message = "Username already exists. Please use a different email."
            except Exception as e:
                logger.error(f"Error during user signup: {e}")
                error_message = "Something went wrong, please try again."

    return render(request, "myapp/login/signup.html", {'error_message': error_message, 'role': role})


def success_page(request):
    return render(request, "myapp/login/success.html")
