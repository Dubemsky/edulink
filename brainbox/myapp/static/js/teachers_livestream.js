// Livestream Management for Teachers
document.addEventListener('DOMContentLoaded', function() {
    // Constants
    const ROOM_ID = document.getElementById("room-id-data")?.dataset?.roomId;
    const TEACHER_NAME = document.getElementById('teacher-name')?.dataset?.teacherName;
    // DOM Elements
    const manageLivestreamModal = document.getElementById('manageLivestreamModal');
    const scheduleLivestreamBtn = document.getElementById('scheduleLivestreamBtn');
    const scheduleLivestreamFormModal = document.getElementById('scheduleLivestreamFormModal');
    const createLivestreamBtn = document.getElementById('createLivestreamBtn');
    const scheduleLivestreamForm = document.getElementById('scheduleLivestreamForm');
    const scheduleLivestreamError = document.getElementById('scheduleLivestreamError');
    
    // Show schedule form when Schedule Livestream button is clicked
    if (scheduleLivestreamBtn) {
        scheduleLivestreamBtn.addEventListener('click', function() {
            const manageLivestreamModalInstance = bootstrap.Modal.getInstance(manageLivestreamModal);
            if (manageLivestreamModalInstance) {
                manageLivestreamModalInstance.hide();
            }
            
            // Reset form
            scheduleLivestreamForm.reset();
            scheduleLivestreamError.style.display = 'none';
            
            // Set minimum date to today
            const today = new Date();
            const formattedDate = today.toISOString().split('T')[0];
            document.getElementById('livestreamDate').min = formattedDate;
            
            // Show form modal
            const scheduleModal = new bootstrap.Modal(scheduleLivestreamFormModal);
            scheduleModal.show();
        });
    }
    
    // Create livestream when form is submitted
    if (createLivestreamBtn) {
        createLivestreamBtn.addEventListener('click', function() {
            // Validate form
            const form = scheduleLivestreamForm;
            if (!form.checkValidity()) {
                event.preventDefault();
                event.stopPropagation();
                form.classList.add('was-validated');
                return;
            }
            
            // Get form values
            const title = document.getElementById('livestreamTitle').value.trim();
            const description = document.getElementById('livestreamDescription').value.trim();
            const date = document.getElementById('livestreamDate').value;
            const time = document.getElementById('livestreamTime').value;
            const duration = parseInt(document.getElementById('livestreamDuration').value);
            const notifyStudents = document.getElementById('notifyStudents').checked;
            
            // Validate date/time is in the future
            const livestreamDateTime = new Date(`${date}T${time}`);
            const now = new Date();
            
            if (livestreamDateTime <= now) {
                scheduleLivestreamError.textContent = 'Livestream date and time must be in the future.';
                scheduleLivestreamError.style.display = 'block';
                return;
            }
            
            // Create livestream data
            const livestreamData = {
                title: title,
                description: description,
                scheduled_date: date,
                scheduled_time: time,
                duration: duration,
                room_id: ROOM_ID,
                teacher_name: TEACHER_NAME,
                notify_students: notifyStudents,
                status: 'scheduled'
            };
            
            // Check if this is an update
            if (createLivestreamBtn.dataset.mode === 'edit') {
                livestreamData.livestream_id = createLivestreamBtn.dataset.livestreamId;
            }
            
            // Disable button and show loading state
            createLivestreamBtn.disabled = true;
            createLivestreamBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Scheduling...';
            
            // Send data to server
            scheduleLivestream(livestreamData);
        });
    }
    
    // Load livestreams when modal is shown
    if (manageLivestreamModal) {
        manageLivestreamModal.addEventListener('show.bs.modal', function() {
            loadUpcomingLivestreams();
            
            // Load past livestreams if tab is active or when clicked
            const pastTab = document.getElementById('past-tab');
            if (pastTab) {
                pastTab.addEventListener('shown.bs.tab', loadPastLivestreams);
                
                // If past tab is active, load past livestreams
                if (pastTab.classList.contains('active')) {
                    loadPastLivestreams();
                }
            }
        });
    }
    
    // Schedule a new livestream
    function scheduleLivestream(livestreamData) {
        fetch('/schedule-livestream/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify(livestreamData)
        })
        .then(response => response.json())
        .then(data => {
            createLivestreamBtn.disabled = false;
            createLivestreamBtn.innerHTML = 'Schedule Livestream';
            
            if (data.success) {
                // Close form modal
                const scheduleFormModal = bootstrap.Modal.getInstance(scheduleLivestreamFormModal);
                if (scheduleFormModal) {
                    scheduleFormModal.hide();
                }
                
                // Show success message
                showToast('Livestream scheduled successfully!', 'success');
                
                // Reopen manage modal and reload upcoming livestreams
                const manageLivestreamModalInstance = new bootstrap.Modal(manageLivestreamModal);
                manageLivestreamModalInstance.show();
                loadUpcomingLivestreams();
            } else {
                // Show error message
                scheduleLivestreamError.textContent = data.error || 'Failed to schedule livestream. Please try again.';
                scheduleLivestreamError.style.display = 'block';
            }
        })
        .catch(error => {
            console.error('Error scheduling livestream:', error);
            createLivestreamBtn.disabled = false;
            createLivestreamBtn.innerHTML = 'Schedule Livestream';
            scheduleLivestreamError.textContent = 'Network error. Please check your connection and try again.';
            scheduleLivestreamError.style.display = 'block';
        });
    }
    
    // Load upcoming livestreams
    function loadUpcomingLivestreams() {
        const upcomingStreamsList = document.getElementById('upcomingStreamsList');
        const loadingIndicator = document.getElementById('upcoming-loading');
        const noStreamsMessage = document.getElementById('no-upcoming-streams');
        
        if (!upcomingStreamsList) return;
        
        // Show loading indicator
        loadingIndicator.style.display = 'block';
        noStreamsMessage.style.display = 'none';
        
        // Clear existing content (except loading indicator)
        Array.from(upcomingStreamsList.children).forEach(child => {
            if (child !== loadingIndicator && child !== noStreamsMessage) {
                child.remove();
            }
        });
        
        // Fetch upcoming livestreams
        fetch(`/get-livestreams/?room_id=${ROOM_ID}&status=upcoming`)
            .then(response => response.json())
            .then(data => {
                // Hide loading indicator
                loadingIndicator.style.display = 'none';
                
                if (data.success && data.livestreams && data.livestreams.length > 0) {
                    // Render each livestream
                    data.livestreams.forEach(livestream => {
                        const livestreamCard = createLivestreamCard(livestream, 'upcoming');
                        upcomingStreamsList.appendChild(livestreamCard);
                    });
                } else {
                    // Show no streams message
                    noStreamsMessage.style.display = 'block';
                }
            })
            .catch(error => {
                console.error('Error loading upcoming livestreams:', error);
                loadingIndicator.style.display = 'none';
                noStreamsMessage.style.display = 'block';
                noStreamsMessage.innerHTML = '<p>Error loading livestreams. Please try again.</p>';
            });
    }
    
    // Load past livestreams
    function loadPastLivestreams() {
        const pastStreamsList = document.getElementById('pastStreamsList');
        const loadingIndicator = document.getElementById('past-loading');
        const noStreamsMessage = document.getElementById('no-past-streams');
        
        if (!pastStreamsList) return;
        
        // Show loading indicator
        loadingIndicator.style.display = 'block';
        noStreamsMessage.style.display = 'none';
        
        // Clear existing content (except loading indicator)
        Array.from(pastStreamsList.children).forEach(child => {
            if (child !== loadingIndicator && child !== noStreamsMessage) {
                child.remove();
            }
        });
        
        // Fetch past livestreams
        fetch(`/get-livestreams/?room_id=${ROOM_ID}&status=past`)
            .then(response => response.json())
            .then(data => {
                // Hide loading indicator
                loadingIndicator.style.display = 'none';
                
                if (data.success && data.livestreams && data.livestreams.length > 0) {
                    // Render each livestream
                    data.livestreams.forEach(livestream => {
                        const livestreamCard = createLivestreamCard(livestream, 'past');
                        pastStreamsList.appendChild(livestreamCard);
                    });
                } else {
                    // Show no streams message
                    noStreamsMessage.style.display = 'block';
                }
            })
            .catch(error => {
                console.error('Error loading past livestreams:', error);
                loadingIndicator.style.display = 'none';
                noStreamsMessage.style.display = 'block';
                noStreamsMessage.innerHTML = '<p>Error loading livestreams. Please try again.</p>';
            });
    }
    
    // Create livestream card element
    function createLivestreamCard(livestream, type) {
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
        
        // Calculate status and actions based on type
        let statusClass = type === 'upcoming' ? 'upcoming' : 'past';
        let statusText = type === 'upcoming' ? 'Upcoming' : 'Completed';
        
        // Check if livestream is currently live
        const now = new Date();
        const endTime = new Date(scheduledDate.getTime() + (livestream.duration * 60000));
        
        if (type === 'upcoming' && scheduledDate <= now && now <= endTime) {
            statusClass = 'live';
            statusText = 'LIVE NOW';
        }
        
        // Create livestream card content
        card.innerHTML = `
            <div class="livestream-header">
                <div>
                    <h3 class="livestream-title">${livestream.title}</h3>
                    <div class="livestream-meta">
                        <i class="bi bi-calendar"></i> ${formattedDate} • <i class="bi bi-clock"></i> ${formattedTime}
                        • <i class="bi bi-hourglass-split"></i> ${livestream.duration} min
                    </div>
                </div>
            </div>
            ${livestream.description ? `<div class="livestream-description">${livestream.description}</div>` : ''}
            <div class="livestream-footer">
                <span class="livestream-status ${statusClass}">${statusText}</span>
                <div class="livestream-actions">
                    ${type === 'upcoming' ? 
                        `<button class="btn btn-sm btn-outline-primary edit-livestream-btn" data-livestream-id="${livestream.id}">
                            <i class="bi bi-pencil"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-outline-danger cancel-livestream-btn" data-livestream-id="${livestream.id}">
                            <i class="bi bi-x-circle"></i> Cancel
                        </button>` : 
                        `<button class="btn btn-sm btn-outline-secondary view-recording-btn" data-livestream-id="${livestream.id}" ${!livestream.recording_url ? 'disabled' : ''}>
                            <i class="bi bi-play-circle"></i> ${livestream.recording_url ? 'View Recording' : 'No Recording'}
                        </button>`
                    }
                </div>
            </div>
        `;
        
        // Add countdown timer for upcoming streams
        if (type === 'upcoming' && scheduledDate > now) {
            const countdownContainer = document.createElement('div');
            countdownContainer.className = 'countdown-timer';
            card.querySelector('.livestream-footer').appendChild(countdownContainer);
            
            // Initialize countdown
            updateCountdown(countdownContainer, scheduledDate);
            const countdownInterval = setInterval(() => {
                const shouldContinue = updateCountdown(countdownContainer, scheduledDate);
                if (!shouldContinue) {
                    clearInterval(countdownInterval);
                    
                    // Refresh the livestream list to update statuses
                    loadUpcomingLivestreams();
                }
            }, 1000);
        }
        
        // Add event listeners for edit and cancel buttons
        if (type === 'upcoming') {
            card.querySelector('.edit-livestream-btn')?.addEventListener('click', function() {
                editLivestream(livestream.id);
            });
            
            card.querySelector('.cancel-livestream-btn')?.addEventListener('click', function() {
                cancelLivestream(livestream.id);
            });
        } else if (type === 'past' && livestream.recording_url) {
            card.querySelector('.view-recording-btn')?.addEventListener('click', function() {
                viewRecording(livestream.recording_url);
            });
        }
        
        return card;
    }
    
    // Update countdown timer
    function updateCountdown(container, targetDate) {
        const now = new Date();
        const difference = targetDate - now;
        
        // If the target date has passed, return false to stop the countdown
        if (difference <= 0) {
            container.innerHTML = '<span>Starting now...</span>';
            return false;
        }
        
        // Calculate remaining time
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        
        // Create or update the countdown display
        container.innerHTML = '';
        
        // Only show days if more than 0
        if (days > 0) {
            const daysSegment = document.createElement('div');
            daysSegment.className = 'countdown-segment';
            daysSegment.innerHTML = `
                <span class="countdown-number">${days}</span>
                <span class="countdown-label">days</span>
            `;
            container.appendChild(daysSegment);
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
        
        container.appendChild(hoursSegment);
        container.appendChild(minutesSegment);
        container.appendChild(secondsSegment);
        
        return true;
    }
    
    // Edit livestream function
    function editLivestream(livestreamId) {
        // Fetch livestream data and show edit form
        fetch(`/get-livestream-details/?livestream_id=${livestreamId}`)
            .then(response => response.json())
            .then(data => {
                if (data.success && data.livestream) {
                    const livestream = data.livestream;
                    
                    // Hide manage livestream modal
                    const manageLivestreamModalInstance = bootstrap.Modal.getInstance(manageLivestreamModal);
                    if (manageLivestreamModalInstance) {
                        manageLivestreamModalInstance.hide();
                    }
                    
                    // Populate form with livestream data
                    document.getElementById('livestreamTitle').value = livestream.title;
                    document.getElementById('livestreamDescription').value = livestream.description || '';
                    document.getElementById('livestreamDate').value = livestream.scheduled_date;
                    document.getElementById('livestreamTime').value = livestream.scheduled_time;
                    document.getElementById('livestreamDuration').value = livestream.duration;
                    document.getElementById('notifyStudents').checked = false; // Don't notify again by default
                    
                    // Update form for editing mode
                    createLivestreamBtn.textContent = 'Update Livestream';
                    createLivestreamBtn.dataset.mode = 'edit';
                    createLivestreamBtn.dataset.livestreamId = livestreamId;
                    
                    // Update modal title
                    document.getElementById('scheduleLivestreamFormModalLabel').textContent = 'Edit Livestream';
                    
                    // Show form modal
                    const scheduleModal = new bootstrap.Modal(scheduleLivestreamFormModal);
                    scheduleModal.show();
                } else {
                    showToast('Could not load livestream details. Please try again.', 'error');
                }
            })
            .catch(error => {
                console.error('Error fetching livestream details:', error);
                showToast('Network error. Please check your connection and try again.', 'error');
            });
    }
    
    // Cancel livestream function
    function cancelLivestream(livestreamId) {
        if (confirm('Are you sure you want to cancel this livestream? This action cannot be undone.')) {
            fetch('/cancel-livestream/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({
                    livestream_id: livestreamId
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showToast('Livestream cancelled successfully', 'success');
                    loadUpcomingLivestreams(); // Reload the list
                } else {
                    showToast(data.error || 'Failed to cancel livestream', 'error');
                }
            })
            .catch(error => {
                console.error('Error cancelling livestream:', error);
                showToast('Network error. Please check your connection and try again.', 'error');
            });
        }
    }
    
    // View recording function
    function viewRecording(recordingUrl) {
        // Open recording in new tab
        window.open(recordingUrl, '_blank');
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
    
    // Helper function to show toast notifications
    function showToast(message, type = 'info') {
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