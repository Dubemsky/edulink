// Livestream functionality for students
document.addEventListener('DOMContentLoaded', function() {
    // Constants
    const STUDENT_USERNAME = document.getElementById("room-id-data")?.dataset?.username;

    console.log(" Hi dahfoeidhfaiod")
    
    // DOM Elements
    const upcomingLivestreamsModal = document.getElementById('upcomingLivestreamsModal');
    const studentLivestreamsList = document.getElementById('studentLivestreamsList');
    const loadingIndicator = document.getElementById('student-livestreams-loading');
    const noStreamsMessage = document.getElementById('no-student-livestreams');
    
    // Add "Upcoming Livestreams" button to the navigation menu
    addLivestreamsMenuButton();
    
    // Check for livestream notifications
    loadLivestreamNotifications();
    
    // When livestreams modal is shown, load livestreams
    if (upcomingLivestreamsModal) {
        upcomingLivestreamsModal.addEventListener('show.bs.modal', function() {
            loadStudentLivestreams();
        });
    }
    
    // Function to add Livestreams button to navigation
    function addLivestreamsMenuButton() {
        const navMenu = document.querySelector('#navmenu ul');
        if (!navMenu) return;
        
        // Create the menu item
        const menuItem = document.createElement('li');
        const menuLink = document.createElement('a');
        menuLink.style.cursor = 'pointer';
        menuLink.innerHTML = '<i class="bi bi-broadcast"></i> Upcoming Livestreams';
        menuLink.setAttribute('data-bs-toggle', 'modal');
        menuLink.setAttribute('data-bs-target', '#upcomingLivestreamsModal');
        
        // Append to nav menu (after analytics but before dashboard)
        menuItem.appendChild(menuLink);
        navMenu.insertBefore(menuItem, navMenu.lastElementChild);
    }
    
    // Load student's livestreams
    function loadStudentLivestreams() {
        if (!studentLivestreamsList || !STUDENT_USERNAME) return;
        
        // Show loading indicator
        loadingIndicator.style.display = 'block';
        noStreamsMessage.style.display = 'none';
        
        // Clear existing content (except loading indicator and no streams message)
        Array.from(studentLivestreamsList.children).forEach(child => {
            if (child !== loadingIndicator && child !== noStreamsMessage) {
                child.remove();
            }
        });
        
        // Fetch upcoming livestreams
        fetch(`/get-student-livestreams/?username=${encodeURIComponent(STUDENT_USERNAME)}`)
            .then(response => response.json())
            .then(data => {
                // Hide loading indicator
                loadingIndicator.style.display = 'none';
                
                if (data.success && data.livestreams && data.livestreams.length > 0) {
                    // Render each livestream
                    data.livestreams.forEach(livestream => {
                        const livestreamCard = createStudentLivestreamCard(livestream);
                        studentLivestreamsList.appendChild(livestreamCard);
                    });
                } else {
                    // Show no streams message
                    noStreamsMessage.style.display = 'block';
                }
            })
            .catch(error => {
                console.error('Error loading livestreams:', error);
                loadingIndicator.style.display = 'none';
                noStreamsMessage.style.display = 'block';
                noStreamsMessage.innerHTML = '<p>Error loading livestreams. Please try again.</p>';
            });
    }
    
    // Create livestream card element for student view
    function createStudentLivestreamCard(livestream) {
        const card = document.createElement('div');
        card.className = 'livestream-card';
        card.dataset.livestreamId = livestream.id;
        
        // Format date and time
        const scheduledDate = new Date(`${livestream.scheduled_date}T${livestream.scheduled_time}`);
        const formattedDate = scheduledDate.toLocaleDateString('en-US', { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric'
        });
        const formattedTime = scheduledDate.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit'
        });
        
        // Calculate time until livestream
        const now = new Date();
        const timeUntil = scheduledDate - now;
        const daysUntil = Math.floor(timeUntil / (1000 * 60 * 60 * 24));
        
        let timeUntilText;
        if (daysUntil > 1) {
            timeUntilText = `${daysUntil} days from now`;
        } else if (daysUntil === 1) {
            timeUntilText = `Tomorrow`;
        } else {
            timeUntilText = `Today`;
        }
        
        // Create livestream card content
        card.innerHTML = `
            <div class="livestream-header">
                <div>
                    <h3 class="livestream-title">${livestream.title}</h3>
                    <div class="livestream-meta">
                        <i class="bi bi-person-video3"></i> ${livestream.teacher_name}
                    </div>
                </div>
                <span class="livestream-status upcoming">Upcoming</span>
            </div>
            ${livestream.description ? `<div class="livestream-description">${livestream.description}</div>` : ''}
            <div class="livestream-details">
                <div><i class="bi bi-calendar"></i> ${formattedDate} (${timeUntilText})</div>
                <div><i class="bi bi-clock"></i> ${formattedTime}</div>
                <div><i class="bi bi-hourglass-split"></i> ${livestream.duration} minutes</div>
            </div>
        `;
        
        // Add countdown timer
        const countdownContainer = document.createElement('div');
        countdownContainer.className = 'countdown-timer';
        card.appendChild(countdownContainer);
        
        // Initialize countdown
        updateCountdown(countdownContainer, scheduledDate);
        const countdownInterval = setInterval(() => {
            const shouldContinue = updateCountdown(countdownContainer, scheduledDate);
            if (!shouldContinue) {
                clearInterval(countdownInterval);
            }
        }, 1000);
        
        // Add "Add to Calendar" button
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'livestream-actions mt-3';
        card.appendChild(actionsContainer);
        
        return card;
    }
    
    // Update countdown timer
    function updateCountdown(container, targetDate) {
        const now = new Date();
        const difference = targetDate - now;
        
        // If the target date has passed
        if (difference <= 0) {
            container.innerHTML = '<div class="alert alert-info">Starting now...</div>';
            return false;
        }
        
        // Calculate remaining time
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        
        // Create or update the countdown display
        container.innerHTML = '';
        
        // Create header for countdown
        const countdownHeader = document.createElement('div');
        countdownHeader.className = 'countdown-header';
        countdownHeader.innerHTML = '<strong>Time until livestream:</strong>';
        container.appendChild(countdownHeader);
        
        // Create countdown display
        const countdownDisplay = document.createElement('div');
        countdownDisplay.className = 'd-flex mt-2';
        
        // Only show days if more than 0
        if (days > 0) {
            const daysSegment = document.createElement('div');
            daysSegment.className = 'countdown-segment';
            daysSegment.innerHTML = `
                <span class="countdown-number">${days}</span>
                <span class="countdown-label">days</span>
            `;
            countdownDisplay.appendChild(daysSegment);
        }
        
        // Create segments for hours, minutes, seconds
        const hoursSegment = document.createElement('div');
        hoursSegment.className = 'countdown-segment';
        hoursSegment.innerHTML = `
            <span class="countdown-number">${hours.toString().padStart(2, '0')}</span>
            <span class="countdown-label">hours</span>
        `;
        
        const minutesSegment = document.createElement('div');
        minutesSegment.className = 'countdown-segment';
        minutesSegment.innerHTML = `
            <span class="countdown-number">${minutes.toString().padStart(2, '0')}</span>
            <span class="countdown-label">mins</span>
        `;
        
        const secondsSegment = document.createElement('div');
        secondsSegment.className = 'countdown-segment';
        secondsSegment.innerHTML = `
            <span class="countdown-number">${seconds.toString().padStart(2, '0')}</span>
            <span class="countdown-label">secs</span>
        `;
        
        countdownDisplay.appendChild(hoursSegment);
        countdownDisplay.appendChild(minutesSegment);
        countdownDisplay.appendChild(secondsSegment);
        
        container.appendChild(countdownDisplay);
        
        return true;
    }
    
    // Load livestream notifications
    function loadLivestreamNotifications() {
        if (!STUDENT_USERNAME) return;
        
        // We'll use the existing notification system to display livestream notifications
        // Check if we should show the notifications based on local storage
        const notificationsChecked = localStorage.getItem('livestream_notifications_checked');
        const now = new Date().getTime();
        
        // Check notifications at most once every 5 minutes
        if (notificationsChecked && now - parseInt(notificationsChecked) < 5 * 60 * 1000) {
            return;
        }
        
        // Update checked timestamp
        localStorage.setItem('livestream_notifications_checked', now.toString());
        
        // Get notifications from the backend
        fetch(`/get-notifications-by-username/?username=${encodeURIComponent(STUDENT_USERNAME)}`)
            .then(response => response.json())
            .then(data => {
                if (data && data.length > 0) {
                    // Filter for unread livestream notifications
                    const livestreamNotifications = data.filter(notification => 
                        notification.type === 'livestream' && !notification.read
                    );
                    
                    if (livestreamNotifications.length > 0) {
                        // Show notifications
                        displayLivestreamNotifications(livestreamNotifications);
                    }
                }
            })
            .catch(error => {
                console.error('Error loading notifications:', error);
            });
    }
    
    // Display livestream notifications
    function displayLivestreamNotifications(notifications) {
        // Get the template
        const template = document.getElementById('livestreamNotificationTemplate');
        if (!template) return;
        
        // Create container for notifications if it doesn't exist
        let notificationsContainer = document.getElementById('livestream-notifications-container');
        if (!notificationsContainer) {
            notificationsContainer = document.createElement('div');
            notificationsContainer.id = 'livestream-notifications-container';
            notificationsContainer.style.position = 'fixed';
            notificationsContainer.style.top = '80px';
            notificationsContainer.style.right = '20px';
            notificationsContainer.style.width = '350px';
            notificationsContainer.style.zIndex = '1040';
            document.body.appendChild(notificationsContainer);
        }
        
        // Display each notification
        notifications.forEach((notification, index) => {
            setTimeout(() => {
                // Clone the template
                const notificationElement = document.importNode(template.content, true).firstElementChild;
                
                // Update content
                notificationElement.querySelector('.notification-message').textContent = notification.message;
                
                // Add event listeners
                const closeButton = notificationElement.querySelector('.livestream-notification-close');
                if (closeButton) {
                    closeButton.addEventListener('click', function() {
                        notificationElement.style.opacity = '0';
                        setTimeout(() => {
                            notificationElement.remove();
                            markNotificationAsRead(notification.notification_id);
                        }, 300);
                    });
                }
                
                // View details button
                const viewButton = notificationElement.querySelector('.view-livestream-btn');
                if (viewButton) {
                    viewButton.addEventListener('click', function() {
                        // Open livestreams modal
                        const modal = new bootstrap.Modal(document.getElementById('upcomingLivestreamsModal'));
                        modal.show();
                        
                        // Mark notification as read
                        markNotificationAsRead(notification.notification_id);
                        
                        // Close notification
                        notificationElement.style.opacity = '0';
                        setTimeout(() => {
                            notificationElement.remove();
                        }, 300);
                    });
                }
                
                // Remind later button
                const remindButton = notificationElement.querySelector('.remind-later-btn');
                if (remindButton) {
                    remindButton.addEventListener('click', function() {
                        // Just hide the notification without marking as read
                        notificationElement.style.opacity = '0';
                        setTimeout(() => {
                            notificationElement.remove();
                        }, 300);
                    });
                }
                
                // Add to container
                notificationsContainer.appendChild(notificationElement);
                
                // Fade in
                setTimeout(() => {
                    notificationElement.style.opacity = '1';
                }, 10);
            }, index * 500); // Stagger notifications by 500ms
        });
    }
    
    // Mark notification as read
    function markNotificationAsRead(notificationId) {
        fetch('/mark-notification-read/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                notification_id: notificationId
            })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Notification marked as read:', data);
        })
        .catch(error => {
            console.error('Error marking notification as read:', error);
        });
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
});