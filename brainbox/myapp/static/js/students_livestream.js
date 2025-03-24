document.addEventListener('DOMContentLoaded', function() {
  // Check for new livestreams when the page loads
  checkNewLivestreams();
  
  // Add click handler to the livestreams nav button to load livestreams in the modal
  const livestreamsNavButton = document.querySelector('a[data-bs-target="#upcomingLivestreamsModal"]');
  livestreamsNavButton.addEventListener('click', function() {
    // Clear the notification badge
    const badge = document.getElementById('livestreams-notification-badge');
    badge.style.display = 'none';
    badge.textContent = '0';
    
    // Update the last viewed timestamp
    localStorage.setItem('last-livestream-check', Date.now());
    
    // Load upcoming livestreams in the modal
    loadModalLivestreams();
  });
});

// Function to check for new livestreams
function checkNewLivestreams() {
  const roomId = document.getElementById('room-id-data').dataset.roomId;
  const lastCheck = localStorage.getItem('last-livestream-check') || 0;
  
  // Make an API request to check for new livestreams
  fetch(`/check-new-livestreams/?room_id=${roomId}&last_check=${lastCheck}`)
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        const newCount = data.new_count || 0;
        const badge = document.getElementById('livestreams-notification-badge');
        
        if (newCount > 0) {
          badge.textContent = newCount;
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      }
    })
    .catch(error => {
      console.error('Error checking for new livestreams:', error);
    });
}

// Function to load upcoming livestreams in the modal
function loadModalLivestreams() {
  const roomId = document.getElementById('room-id-data').dataset.roomId;
  const livestreamsContainer = document.getElementById('modal-upcoming-livestreams');
  const noLivestreamsMessage = document.getElementById('modal-no-livestreams');
  
  // Show loading spinner
  livestreamsContainer.innerHTML = '<div class="loading-spinner">Loading livestreams...</div>';
  
  // Make an API request to get upcoming livestreams
  fetch(`/get-upcoming-livestreams/?room_id=${roomId}`)
    .then(response => response.json())
    .then(data => {
      if (data.success && data.livestreams && data.livestreams.length > 0) {
        // Clear the container
        livestreamsContainer.innerHTML = '';
        
        // Hide the "no livestreams" message
        noLivestreamsMessage.style.display = 'none';
        
        // Create elements for each upcoming livestream
        data.livestreams.forEach(livestream => {
          const livestreamCard = createLivestreamCard(livestream);
          livestreamsContainer.appendChild(livestreamCard);
        });
      } else {
        // No upcoming livestreams
        livestreamsContainer.innerHTML = '';
        noLivestreamsMessage.style.display = 'block';
      }
    })
    .catch(error => {
      console.error('Error:', error);
      livestreamsContainer.innerHTML = '<div class="error-message">Error loading livestreams. Please try again.</div>';
    });
}

// Function to create a simplified livestream card that opens the modal
function createLivestreamCard(livestream) {
  const card = document.createElement('div');
  card.className = 'livestream-card';
  card.dataset.id = livestream.id;
  
  // Format the scheduled time
  const scheduledDate = new Date(livestream.scheduled_time);
  const formattedDate = scheduledDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
  const formattedTime = scheduledDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  // Calculate if it's upcoming soon (within 30 minutes)
  const now = new Date();
  const timeDiff = scheduledDate - now;
  const isUpcomingSoon = timeDiff > 0 && timeDiff < 30 * 60 * 1000;
  
  // Calculate if it's live now (scheduled time is in the past but within the last hour)
  const isLiveNow = timeDiff <= 0 && timeDiff > -60 * 60 * 1000;
  
  // Create card content
  card.innerHTML = `
    <div class="livestream-card-content">
      <div class="livestream-card-title">${livestream.title}</div>
      <div class="livestream-card-info">
        <i class="bi bi-calendar-event"></i> ${formattedDate} at ${formattedTime}
      </div>
    </div>
    <span class="livestream-card-status ${isLiveNow ? 'status-live' : (isUpcomingSoon ? 'status-soon' : 'status-scheduled')}">
      ${isLiveNow ? 'LIVE NOW' : (isUpcomingSoon ? 'Starting Soon' : 'Scheduled')}
    </span>
  `;
  
  // Add click event to open the details modal
  card.addEventListener('click', function() {
    // Hide the livestreams modal first
    const upcomingModal = bootstrap.Modal.getInstance(document.getElementById('upcomingLivestreamsModal'));
    upcomingModal.hide();
    
    // Then show the details modal
    setTimeout(() => {
      showLivestreamDetails(livestream);
    }, 500);
  });
  
  return card;
}

// Function to show livestream details in the modal
function showLivestreamDetails(livestream) {
  // Get modal elements
  const modalElement = document.getElementById('livestreamDetailsModal');
  const modal = new bootstrap.Modal(modalElement);
  const modalTitle = document.getElementById('livestreamDetailsModalLabel');
  const modalContent = document.getElementById('livestreamDetailsContent');
  const modalFooter = document.getElementById('livestreamDetailsFooter');
  
  // Format the scheduled time
  const scheduledDate = new Date(livestream.scheduled_time);
  const formattedDate = scheduledDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const formattedTime = scheduledDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  // Calculate if it's upcoming soon (within 30 minutes)
  const now = new Date();
  const timeDiff = scheduledDate - now;
  const isUpcomingSoon = timeDiff > 0 && timeDiff < 30 * 60 * 1000;
  
  // Calculate if it's live now (scheduled time is in the past but within the last hour)
  const isLiveNow = timeDiff <= 0 && timeDiff > -60 * 60 * 1000;
  
  // Set modal title
  modalTitle.textContent = 'Livestream Details';
  
  // Create content for the modal
  modalContent.innerHTML = `
    <div class="livestream-details-content">
      <div class="livestream-details-header">
        <div class="livestream-details-title">${livestream.title}</div>
        <div class="livestream-details-teacher">
          <i class="bi bi-person-circle me-2"></i> ${livestream.teacher}
        </div>
        <div class="livestream-details-status livestream-card-status ${isLiveNow ? 'status-live' : (isUpcomingSoon ? 'status-soon' : 'status-scheduled')}">
          ${isLiveNow ? 'LIVE NOW' : (isUpcomingSoon ? 'Starting Soon' : 'Scheduled')}
        </div>
      </div>
      
      <div class="livestream-details-time">
        <i class="bi bi-calendar-event-fill"></i>
        <div>
          <div><strong>${formattedDate}</strong></div>
          <div>${formattedTime}</div>
        </div>
      </div>
      
      ${livestream.description ? `
        <div class="livestream-details-description">
          <div class="livestream-details-description-title">Description</div>
          <div class="livestream-details-description-content">${livestream.description}</div>
        </div>
      ` : ''}
    </div>
  `;
  
  // Set footer buttons based on livestream status
  if (isLiveNow) {
    modalFooter.innerHTML = `
      <button type="button" class="btn btn-primary join-livestream-btn" data-id="${livestream.id}">
        <i class="bi bi-broadcast me-2"></i> Join Livestream
      </button>
    `;
    
    // Add event listener to join button
    modalFooter.querySelector('.join-livestream-btn').addEventListener('click', function() {
      joinLivestream(livestream.id);
    });
  } else {
    modalFooter.innerHTML = `
      <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
      <button type="button" class="btn btn-outline-primary reminder-btn ${localStorage.getItem(`reminder-${livestream.id}`) === 'true' ? 'active' : ''}" data-id="${livestream.id}">
        <i class="bi bi-bell me-2"></i> ${localStorage.getItem(`reminder-${livestream.id}`) === 'true' ? 'Reminder Set' : 'Set Reminder'}
      </button>
    `;
    
    // Add event listener to reminder button
    modalFooter.querySelector('.reminder-btn').addEventListener('click', function() {
      this.classList.toggle('active');
      if (this.classList.contains('active')) {
        this.innerHTML = '<i class="bi bi-bell me-2"></i> Reminder Set';
        setReminder(livestream.id, true);
      } else {
        this.innerHTML = '<i class="bi bi-bell me-2"></i> Set Reminder';
        setReminder(livestream.id, false);
      }
    });
  }
  
  // Show the modal
  modal.show();
}

// Function to join a livestream
function joinLivestream(livestreamId) {
  // Make an API request to join the livestream
  fetch(`/join-livestream/${livestreamId}/`)
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Redirect to the livestream room
        window.location.href = data.livestream_url;
      } else {
        showToast(data.error || "Failed to join livestream", "error");
      }
    })
    .catch(error => {
      console.error('Error:', error);
      showToast("An error occurred. Please try again.", "error");
    });
}

// Function to set or remove a reminder for a livestream
function setReminder(livestreamId, setReminder) {
  // Store the reminder status in localStorage
  localStorage.setItem(`reminder-${livestreamId}`, setReminder);
  
  // Make an API request to set or remove a reminder
  fetch('/set-livestream-reminder/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCookie('csrftoken')
    },
    body: JSON.stringify({
      livestream_id: livestreamId,
      set_reminder: setReminder
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showToast(setReminder ? "Reminder set" : "Reminder removed", setReminder ? "success" : "info");
    } else {
      showToast(data.error || "Failed to update reminder", "error");
    }
  })
  .catch(error => {
    console.error('Error:', error);
    showToast("An error occurred. Please try again.", "error");
  });
}

// Utility function to show toast notifications
function showToast(message, type) {
  // Check if there's an existing toast container
  let toastContainer = document.getElementById('toast-container');
  
  // Create one if it doesn't exist
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.position = 'fixed';
    toastContainer.style.bottom = '20px';
    toastContainer.style.right = '20px';
    toastContainer.style.zIndex = '9999';
    document.body.appendChild(toastContainer);
  }
  
  // Create the toast element
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
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
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// Utility function to get CSRF token from cookies
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