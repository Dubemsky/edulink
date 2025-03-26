// Add this to an invite-students.js file or include in your existing JavaScript

document.addEventListener("DOMContentLoaded", function() {
    // Elements
    const studentEmailInput = document.getElementById("studentEmail");
    const studentButtonsDiv = document.getElementById("studentButtonsDiv");
    const sendInviteBtn = document.getElementById("sendInviteBtn");
    const roomId = document.getElementById("room-id-data").dataset.roomId;
    
    let selectedStudent = null;
    
    // Add event listener to the input for real-time searching
    if (studentEmailInput) {
        studentEmailInput.addEventListener("input", debounce(searchStudents, 500));
    }
    
    // Add event listener to the send invite button
    if (sendInviteBtn) {
        sendInviteBtn.addEventListener("click", sendInvite);
    }
    
    // Function to search for students
    function searchStudents() {
        const searchTerm = studentEmailInput.value.trim();
        
        // Clear previous results
        if (studentButtonsDiv) {
            studentButtonsDiv.innerHTML = "";
        }
        
        // If search term is empty, do nothing
        if (!searchTerm) {
            return;
        }
        
        // Show loading indicator
        if (studentButtonsDiv) {
            studentButtonsDiv.innerHTML = "<div class='searching-indicator'>Searching...</div>";
        }
        
        // Make AJAX request to search for students


        fetch("/search-students/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": getCookie("csrftoken")
            },
            body: JSON.stringify({
                search_term: searchTerm,
                room_id: roomId
            })
        })
        .then(response => response.json())
        .then(data => {
            // Clear loading indicator
            if (studentButtonsDiv) {
                studentButtonsDiv.innerHTML = "";
            }
            
            if (data.success) {
                if (data.students.length === 0) {
                    // No students found
                    studentButtonsDiv.innerHTML = "<div class='no-results'>No students found</div>";
                } else {
                    // Display student buttons
                    data.students.forEach(student => {
                        const studentButton = document.createElement("button");
                        studentButton.className = "student-button";
                        studentButton.dataset.id = student.id;
                        studentButton.dataset.name = student.name;
                        studentButton.dataset.email = student.email;
                        
                        // Create button content with profile picture and name
                        studentButton.innerHTML = `
                            <img src="${student.profile_picture}" alt="${student.name}" class="student-profile-pic">
                            <div class="student-info">
                                <div class="student-name">${student.name}</div>
                                <div class="student-email">${student.email}</div>
                            </div>
                        `;
                        
                        // Add click event to select the student
                        studentButton.addEventListener("click", function() {
                            // Remove active class from all buttons
                            document.querySelectorAll(".student-button").forEach(btn => {
                                btn.classList.remove("active");
                            });
                            
                            // Add active class to this button
                            this.classList.add("active");
                            
                            // Set selected student
                            selectedStudent = {
                                id: this.dataset.id,
                                name: this.dataset.name,
                                email: this.dataset.email
                            };
                            
                            // Update input field with selected student email
                            studentEmailInput.value = this.dataset.email;
                        });
                        
                        // Add button to container
                        studentButtonsDiv.appendChild(studentButton);
                    });
                }
            } else {
                // Error occurred
                studentButtonsDiv.innerHTML = `<div class='error'>${data.error || "Error searching for students"}</div>`;
            }
        })
        .catch(error => {
            console.error("Error searching for students:", error);
            if (studentButtonsDiv) {
                studentButtonsDiv.innerHTML = "<div class='error'>Error searching for students</div>";
            }
        });
    }
    
    // Function to send invite
    function sendInvite() {
        // Check if student email is provided or a student is selected
        const studentEmail = studentEmailInput.value.trim();
        
        if (!studentEmail) {
            showToast("Please enter a student email or select a student", "error");
            return;
        }
        
        // Show loading state
        sendInviteBtn.disabled = true;
        sendInviteBtn.innerHTML = "Sending...";
        showToast("You have sent an invite to ",studentEmail);
        // Make AJAX request to send invite
        fetch("/send-invite/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": getCookie("csrftoken")
            },
            body: JSON.stringify({
                student_email: studentEmail,
                room_id: roomId
            })
        })
        .then(response => response.json())
        .then(data => {
            // Reset button state
            sendInviteBtn.disabled = false;
            sendInviteBtn.innerHTML = "Send Invite";
            
            if (data.success) {
                // Show success message
                showToast(data.message, "success");
                
                // Clear form
                studentEmailInput.value = "";
                if (studentButtonsDiv) {
                    studentButtonsDiv.innerHTML = "";
                }
                selectedStudent = null;
                
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('inviteStudentModal'));
                if (modal) {
                    modal.hide();
                }
            } else {
                // Show error message
                showToast(data.error || "Error sending invite", "error");
            }
        })
        .catch(error => {
            console.error("Error sending invite:", error);
            
            // Reset button state
            // Reset button state
            sendInviteBtn.disabled = false;
            sendInviteBtn.innerHTML = "Send Invite";
            
            // Show error toast
            showToast("Error sending invite. Please try again.", "error");
        });
    }
    
    // Helper function to create debounce functionality for search
    function debounce(func, delay) {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }
    
    // Helper function to get CSRF token
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
    
    // Function to show toast notifications
    function showToast(message, type) {
        // Remove any existing toast
        const existingToast = document.getElementById('toast-notification');
        if (existingToast) {
            existingToast.remove();
        }
        
        // Create toast container if it doesn't exist
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.style.position = 'fixed';
            toastContainer.style.bottom = '20px';
            toastContainer.style.right = '20px';
            toastContainer.style.zIndex = '9999';
            document.body.appendChild(toastContainer);
        }
        
        // Create toast
        const toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.style.backgroundColor = type === 'error' ? '#f44336' : 
                                      type === 'success' ? '#4CAF50' : 
                                      type === 'info' ? '#2196F3' : '#333';
        toast.style.color = 'white';
        toast.style.padding = '16px';
        toast.style.borderRadius = '4px';
        toast.style.marginTop = '10px';
        toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        toast.style.minWidth = '250px';
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        toast.textContent = message;
        
        // Add toast to container
        toastContainer.appendChild(toast);
        
        // Fade in
        setTimeout(() => {
            toast.style.opacity = '1';
        }, 10);
        
        // Fade out after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }
});

// Student notification handling for responding to invites
document.addEventListener("DOMContentLoaded", function() {
    // Add event handlers to notification buttons if they exist
    setupInviteResponseHandlers();
    
    // Function to set up event handlers for invite response buttons
    function setupInviteResponseHandlers() {
        // Find all invite response buttons
        document.querySelectorAll('.invite-response-btn').forEach(button => {
            button.addEventListener('click', handleInviteResponse);
        });
    }
    
    // Handle invite response (accept or reject)
    function handleInviteResponse(event) {
        event.preventDefault();
        
        const button = event.currentTarget;
        const notificationId = button.dataset.notificationId;
        const response = button.dataset.response; // "accept" or "reject"
        
        // Disable buttons to prevent multiple clicks
        const notificationCard = button.closest('.notification-card');
        const buttons = notificationCard.querySelectorAll('button');
        buttons.forEach(btn => btn.disabled = true);
        
        // Show loading state
        button.innerHTML = response === 'accept' ? 'Accepting...' : 'Rejecting...';
        
        // Send response to server
        fetch('/respond-to-invite/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                notification_id: notificationId,
                response: response
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Show success message
                showToast(data.message, 'success');
                
                // Remove the notification card with animation
                notificationCard.style.opacity = '0';
                notificationCard.style.height = '0';
                setTimeout(() => {
                    notificationCard.remove();
                    
                    // If accepted, redirect to the room
                    if (response === 'accept' && data.room_id) {
                        window.location.href = `/students-dashboard/hub-room/${data.room_id}/`;
                    }
                    
                    // Update notification count
                    updateNotificationCount();
                }, 300);
            } else {
                // Show error message
                showToast(data.error || 'Error processing your response', 'error');
                
                // Reset button state
                buttons.forEach(btn => btn.disabled = false);
                button.innerHTML = response === 'accept' ? 'Accept' : 'Reject';
            }
        })
        .catch(error => {
            console.error('Error responding to invite:', error);
            
            // Show error message
            showToast('Error processing your response. Please try again.', 'error');
            
            // Reset button state
            buttons.forEach(btn => btn.disabled = false);
            button.innerHTML = response === 'accept' ? 'Accept' : 'Reject';
        });
    }
    
    // Update notification count in UI
    function updateNotificationCount() {
        const countElement = document.getElementById('notificationCount');
        if (countElement) {
            const currentCount = parseInt(countElement.textContent) || 0;
            if (currentCount > 0) {
                countElement.textContent = currentCount - 1;
                
                // If no more notifications, hide the badge
                if (currentCount === 1) {
                    countElement.style.display = 'none';
                }
            }
        }
    }
    
    // Helper function to get CSRF token
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
    
    // Function to show toast notifications
    function showToast(message, type) {
        // Implementation is the same as in the teacher's script
        // Remove any existing toast
        const existingToast = document.getElementById('toast-notification');
        if (existingToast) {
            existingToast.remove();
        }
        
        // Create toast container if it doesn't exist
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.style.position = 'fixed';
            toastContainer.style.bottom = '20px';
            toastContainer.style.right = '20px';
            toastContainer.style.zIndex = '9999';
            document.body.appendChild(toastContainer);
        }
        
        // Create toast
        const toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.style.backgroundColor = type === 'error' ? '#f44336' : 
                                      type === 'success' ? '#4CAF50' : 
                                      type === 'info' ? '#2196F3' : '#333';
        toast.style.color = 'white';
        toast.style.padding = '16px';
        toast.style.borderRadius = '4px';
        toast.style.marginTop = '10px';
        toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        toast.style.minWidth = '250px';
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        toast.textContent = message;
        
        // Add toast to container
        toastContainer.appendChild(toast);
        
        // Fade in
        setTimeout(() => {
            toast.style.opacity = '1';
        }, 10);
        
        // Fade out after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }
});