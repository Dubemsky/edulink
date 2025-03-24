document.addEventListener('DOMContentLoaded', function() {
  // Add event listeners for the livestream management tabs
  const manageLivestreamsModal = document.getElementById('manageLivestreamsModal');
  if (manageLivestreamsModal) {
    manageLivestreamsModal.addEventListener('show.bs.modal', loadTeacherLivestreams);
    
    // Add event listeners for tab changes
    const upcomingTab = document.getElementById('upcoming-tab');
    const liveTab = document.getElementById('live-tab');
    const pastTab = document.getElementById('past-tab');
    
    if (upcomingTab) {
      upcomingTab.addEventListener('shown.bs.tab', function() {
        loadUpcomingLivestreams();
      });
    }
    
    if (liveTab) {
      liveTab.addEventListener('shown.bs.tab', function() {
        loadLiveLivestreams();
      });
    }
    
    if (pastTab) {
      pastTab.addEventListener('shown.bs.tab', function() {
        loadPastLivestreams();
      });
    }
  }
  
  // Add event listener for edit form submission
  const saveLivestreamChangesBtn = document.getElementById('saveLivestreamChangesBtn');
  if (saveLivestreamChangesBtn) {
    saveLivestreamChangesBtn.addEventListener('click', saveEditedLivestream);
  }
});

// Function to load all livestreams when the manage modal is opened
function loadTeacherLivestreams() {
  // Load upcoming livestreams by default
  loadUpcomingLivestreams();
}

// Function to load upcoming livestreams
function loadUpcomingLivestreams() {
  const roomId = document.getElementById('room-id-data').dataset.roomId;
  const container = document.getElementById('upcoming-livestreams-list');
  const noLivestreamsMessage = document.getElementById('no-upcoming-livestreams');
  
  // Show loading spinner
  container.innerHTML = '<div class="loading-spinner">Loading your scheduled livestreams...</div>';
  
  // Make API request to get upcoming livestreams
  fetch(`/get-teacher-livestreams/?room_id=${roomId}&status=scheduled`)
    .then(response => response.json())
    .then(data => {
      if (data.success && data.livestreams && data.livestreams.length > 0) {
        // Clear the container
        container.innerHTML = '';
        
        // Hide the "no livestreams" message
        noLivestreamsMessage.style.display = 'none';
        
        // Sort livestreams by date (closest first)
        const sortedLivestreams = data.livestreams.sort((a, b) => {
          return new Date(a.scheduled_time) - new Date(b.scheduled_time);
        });
        
        // Create elements for each upcoming livestream
        sortedLivestreams.forEach(livestream => {
          const livestreamEl = createTeacherLivestreamItem(livestream, 'upcoming');
          container.appendChild(livestreamEl);
        });
      } else {
        // No upcoming livestreams
        container.innerHTML = '';
        noLivestreamsMessage.style.display = 'block';
      }
    })
    .catch(error => {
      console.error('Error:', error);
      container.innerHTML = '<div class="error-message">Error loading livestreams. Please try again.</div>';
    });
}

// Function to load active (live) livestreams
function loadLiveLivestreams() {
  const roomId = document.getElementById('room-id-data').dataset.roomId;
  const container = document.getElementById('live-livestreams-list');
  const noLivestreamsMessage = document.getElementById('no-live-livestreams');
  
  // Show loading spinner
  container.innerHTML = '<div class="loading-spinner">Checking for active livestreams...</div>';
  
  // Make API request to get live livestreams
  fetch(`/get-teacher-livestreams/?room_id=${roomId}&status=live`)
    .then(response => response.json())
    .then(data => {
      if (data.success && data.livestreams && data.livestreams.length > 0) {
        // Clear the container
        container.innerHTML = '';
        
        // Hide the "no livestreams" message
        noLivestreamsMessage.style.display = 'none';
        
        // Create elements for each live livestream
        data.livestreams.forEach(livestream => {
          const livestreamEl = createTeacherLivestreamItem(livestream, 'live');
          container.appendChild(livestreamEl);
        });
      } else {
        // No live livestreams
        container.innerHTML = '';
        noLivestreamsMessage.style.display = 'block';
      }
    })
    .catch(error => {
      console.error('Error:', error);
      container.innerHTML = '<div class="error-message">Error checking for active livestreams. Please try again.</div>';
    });
}

// Function to load past livestreams
function loadPastLivestreams() {
  const roomId = document.getElementById('room-id-data').dataset.roomId;
  const container = document.getElementById('past-livestreams-list');
  const noLivestreamsMessage = document.getElementById('no-past-livestreams');
  
  // Show loading spinner
  container.innerHTML = '<div class="loading-spinner">Loading your past livestreams...</div>';
  
  // Make API request to get past livestreams
  fetch(`/get-teacher-livestreams/?room_id=${roomId}&status=completed,cancelled`)
    .then(response => response.json())
    .then(data => {
      if (data.success && data.livestreams && data.livestreams.length > 0) {
        // Clear the container
        container.innerHTML = '';
        
        // Hide the "no livestreams" message
        noLivestreamsMessage.style.display = 'none';
        
        // Sort livestreams by date (most recent first)
        const sortedLivestreams = data.livestreams.sort((a, b) => {
          return new Date(b.scheduled_time) - new Date(a.scheduled_time);
        });
        
        // Create elements for each past livestream
        sortedLivestreams.forEach(livestream => {
          const livestreamEl = createTeacherLivestreamItem(livestream, 'past');
          container.appendChild(livestreamEl);
        });
      } else {
        // No past livestreams
        container.innerHTML = '';
        noLivestreamsMessage.style.display = 'block';
      }
    })
    .catch(error => {
      console.error('Error:', error);
      container.innerHTML = '<div class="error-message">Error loading past livestreams. Please try again.</div>';
    });
}

// Function to create a livestream item for teachers
function createTeacherLivestreamItem(livestream, type) {
  const item = document.createElement('div');
  item.className = 'livestream-item';
  item.dataset.id = livestream.id;
  
  // Format the scheduled time
  const scheduledDate = new Date(livestream.scheduled_time);
  const formattedDate = scheduledDate.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
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
  
  // Create HTML based on the type of livestream
  if (type === 'upcoming') {
    item.innerHTML = `
      <div class="livestream-header">
        <h5 class="livestream-title">${livestream.title}</h5>
        <span class="livestream-status ${isUpcomingSoon ? 'status-soon' : 'status-scheduled'}">
          ${isUpcomingSoon ? 'Starting Soon' : 'Scheduled'}
        </span>
      </div>
      <div class="livestream-details">
        <div class="livestream-datetime">
          <i class="bi bi-calendar-event"></i> ${formattedDate} at ${formattedTime}
        </div>
      </div>
      ${livestream.description ? `<p class="livestream-description">${livestream.description}</p>` : ''}
      <div class="livestream-actions">
        ${isUpcomingSoon ? `
          <button class="btn btn-primary btn-sm start-livestream-btn" data-id="${livestream.id}">
            <i class="bi bi-broadcast"></i> Start Now
          </button>
        ` : `
          <button class="btn btn-outline-primary btn-sm edit-livestream-btn" data-id="${livestream.id}">
            <i class="bi bi-pencil"></i> Edit
          </button>
        `}
        <button class="btn btn-outline-danger btn-sm cancel-livestream-btn" data-id="${livestream.id}">
          <i class="bi bi-x-circle"></i> Cancel
        </button>
      </div>
    `;
    
    // Add event listeners
    const startBtn = item.querySelector('.start-livestream-btn');
    if (startBtn) {
      startBtn.addEventListener('click', function() {
        startLivestream(livestream.id);
      });
    }
    
    const editBtn = item.querySelector('.edit-livestream-btn');
    if (editBtn) {
      editBtn.addEventListener('click', function() {
        openEditLivestreamModal(livestream);
      });
    }
    
    const cancelBtn = item.querySelector('.cancel-livestream-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function() {
        cancelLivestream(livestream.id);
      });
    }
  } else if (type === 'live') {
    item.innerHTML = `
      <div class="livestream-header">
        <h5 class="livestream-title"><span class="live-indicator"></span> ${livestream.title}</h5>
        <span class="livestream-status status-live">LIVE NOW</span>
      </div>
      <div class="livestream-details">
        <div class="livestream-datetime">
          <i class="bi bi-calendar-event"></i> Started at ${formattedTime}
        </div>
        <div class="livestream-viewers">
          <i class="bi bi-people-fill"></i> <span class="viewer-count">${livestream.viewer_count || 0}</span> viewers
        </div>
      </div>
      ${livestream.description ? `<p class="livestream-description">${livestream.description}</p>` : ''}
      <div class="livestream-actions">
        <button class="btn btn-primary btn-sm join-livestream-btn" data-id="${livestream.id}">
          <i class="bi bi-broadcast"></i> Join Your Stream
        </button>
        <button class="btn btn-danger btn-sm end-livestream-btn" data-id="${livestream.id}">
          <i class="bi bi-stop-circle"></i> End Stream
        </button>
      </div>
    `;
    
    // Add event listeners
    const joinBtn = item.querySelector('.join-livestream-btn');
    if (joinBtn) {
      joinBtn.addEventListener('click', function() {
        joinLivestream(livestream.id);
      });
    }
    
    const endBtn = item.querySelector('.end-livestream-btn');
    if (endBtn) {
      endBtn.addEventListener('click', function() {
        endLivestream(livestream.id);
      });
    }
  } else if (type === 'past') {
    const viewerCount = livestream.stats?.viewer_count || 0;
    const duration = livestream.stats?.duration_minutes || 0;
    const peakViewers = livestream.stats?.peak_viewers || 0;
    
    item.innerHTML = `
      <div class="livestream-header">
        <h5 class="livestream-title">${livestream.title}</h5>
        <span class="livestream-status ${livestream.status === 'completed' ? 'status-completed' : 'status-cancelled'}">
          ${livestream.status === 'completed' ? 'Completed' : 'Cancelled'}
        </span>
      </div>
      <div class="livestream-details">
        <div class="livestream-datetime">
          <i class="bi bi-calendar-event"></i> ${formattedDate} at ${formattedTime}
        </div>
      </div>
      ${livestream.description ? `<p class="livestream-description">${livestream.description}</p>` : ''}
      <div class="livestream-stats">
        <div class="livestream-stats-item">
          <i class="bi bi-people"></i> ${viewerCount} total viewers
        </div>
        <div class="livestream-stats-item">
          <i class="bi bi-person-up"></i> ${peakViewers} peak viewers
        </div>
        <div class="livestream-stats-item">
          <i class="bi bi-clock"></i> ${duration} minutes
        </div>
      </div>
      <div class="livestream-actions">
        ${livestream.recording_url ? `
          <a href="${livestream.recording_url}" class="btn btn-outline-primary btn-sm" target="_blank">
            <i class="bi bi-play-circle"></i> View Recording
          </a>
        ` : ''}
        <button class="btn btn-outline-secondary btn-sm duplicate-livestream-btn" data-id="${livestream.id}">
          <i class="bi bi-copy"></i> Reschedule Similar
        </button>
      </div>
    `;
    
    // Add event listeners
    const duplicateBtn = item.querySelector('.duplicate-livestream-btn');
    if (duplicateBtn) {
      duplicateBtn.addEventListener('click', function() {
        duplicateLivestream(livestream.id);
      });
    }
  }
  
  return item;
}

// Function to open the edit livestream modal
function openEditLivestreamModal(livestream) {
  // Hide the manage livestreams modal
  const manageModal = bootstrap.Modal.getInstance(document.getElementById('manageLivestreamsModal'));
  manageModal.hide();
  
  // Get edit modal elements
  const editModal = new bootstrap.Modal(document.getElementById('editLivestreamModal'));
  const livestreamIdInput = document.getElementById('edit-livestream-id');
  const titleInput = document.getElementById('edit-livestreamTitle');
  const descriptionInput = document.getElementById('edit-livestreamDescription');
  const dateTimeInput = document.getElementById('edit-livestreamDateTime');
  
  // Format the date for the datetime-local input
  const scheduledDate = new Date(livestream.scheduled_time);
  const year = scheduledDate.getFullYear();
  const month = String(scheduledDate.getMonth() + 1).padStart(2, '0');
  const day = String(scheduledDate.getDate()).padStart(2, '0');
  const hours = String(scheduledDate.getHours()).padStart(2, '0');
  const minutes = String(scheduledDate.getMinutes()).padStart(2, '0');
  const formattedDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
  
  // Set the form values
  livestreamIdInput.value = livestream.id;
  titleInput.value = livestream.title;
  descriptionInput.value = livestream.description || '';
  dateTimeInput.value = formattedDateTime;
  
  // Show the edit modal
  setTimeout(() => {
    editModal.show();
  }, 500);
}

// Function to save edited livestream
function saveEditedLivestream() {
  const livestreamId = document.getElementById('edit-livestream-id').value;
  const title = document.getElementById('edit-livestreamTitle').value.trim();
  const description = document.getElementById('edit-livestreamDescription').value.trim();
  const dateTime = document.getElementById('edit-livestreamDateTime').value;
  
  // Validate inputs
  if (!title) {
    showToast("Please enter a title for your livestream", "error");
    return;
  }
  
  if (!dateTime) {
    showToast("Please select a date and time for your livestream", "error");
    return;
  }
  
  // Disable the save button during submission
  const saveBtn = document.getElementById('saveLivestreamChangesBtn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
  
  // Make an API request to update the livestream
  fetch('/update-livestream/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCookie('csrftoken')
    },
    body: JSON.stringify({
      livestream_id: livestreamId,
      title: title,
      description: description,
      scheduled_time: dateTime
    })
  })
  .then(response => response.json())
  .then(data => {
    saveBtn.disabled = false;
    saveBtn.innerHTML = 'Save Changes';
    
    if (data.success) {
      // Close the edit modal
      const editModal = bootstrap.Modal.getInstance(document.getElementById('editLivestreamModal'));
      editModal.hide();
      
      // Show success message
      showToast("Livestream updated successfully", "success");
      
      // Reopen the manage modal and refresh the list
      setTimeout(() => {
        const manageModal = new bootstrap.Modal(document.getElementById('manageLivestreamsModal'));
        manageModal.show();
        
        // Reload the upcoming livestreams list
        loadUpcomingLivestreams();
      }, 500);
    } else {
      showToast(data.error || "Failed to update livestream", "error");
    }
  })
  .catch(error => {
    console.error('Error:', error);
    saveBtn.disabled = false;
    saveBtn.innerHTML = 'Save Changes';
    showToast("An error occurred. Please try again.", "error");
  });
}

// Function to start a livestream
function startLivestream(livestreamId) {
  if (confirm('Are you ready to start this livestream? Students will be notified.')) {
    // Make an API request to start the livestream
    fetch('/start-livestream/', {
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
        // Hide the manage modal
        const manageModal = bootstrap.Modal.getInstance(document.getElementById('manageLivestreamsModal'));
        manageModal.hide();
        
        // Redirect to the livestream page
        window.location.href = data.livestream_url;
      } else {
        showToast(data.error || "Failed to start livestream", "error");
      }
    })
    .catch(error => {
      console.error('Error:', error);
      showToast("An error occurred. Please try again.", "error");
    });
  }
}

// Function to join an active livestream
function joinLivestream(livestreamId) {
  // Make an API request to get the livestream URL
  fetch(`/join-livestream/${livestreamId}/`)
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Hide the manage modal
        const manageModal = bootstrap.Modal.getInstance(document.getElementById('manageLivestreamsModal'));
        manageModal.hide();
        
        // Redirect to the livestream page
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

// Function to end a livestream
function endLivestream(livestreamId) {
  if (confirm('Are you sure you want to end this livestream? This will stop the stream for all viewers.')) {
    // Make an API request to end the livestream
    fetch('/end-livestream/', {
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
        // Show success message
        showToast("Livestream ended successfully", "success");
        
        // Reload the live livestreams list
        loadLiveLivestreams();
      } else {
        showToast(data.error || "Failed to end livestream", "error");
      }
    })
    .catch(error => {
      console.error('Error:', error);
      showToast("An error occurred. Please try again.", "error");
    });
  }
}

// Function to cancel a scheduled livestream
function cancelLivestream(livestreamId) {
  if (confirm('Are you sure you want to cancel this livestream? This cannot be undone.')) {
    // Make an API request to cancel the livestream
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
        // Show success message
        showToast("Livestream cancelled successfully", "success");
        
        // Reload the upcoming livestreams list
        loadUpcomingLivestreams();
      } else {
        showToast(data.error || "Failed to cancel livestream", "error");
      }
    })
    .catch(error => {
      console.error('Error:', error);
      showToast("An error occurred. Please try again.", "error");
    });
  }
}

// Function to duplicate a past livestream for rescheduling
function duplicateLivestream(livestreamId) {
  // Make an API request to get the livestream details
  fetch(`/get-livestream-details/${livestreamId}/`)
    .then(response => response.json())
    .then(data => {
      if (data.success && data.livestream) {
        // Hide the manage modal
        const manageModal = bootstrap.Modal.getInstance(document.getElementById('manageLivestreamsModal'));
        manageModal.hide();
        
        // Populate the schedule form with the details
        const livestream = data.livestream;
        
        const titleInput = document.getElementById('livestreamTitle');
        const descriptionInput = document.getElementById('livestreamDescription');
        const dateTimeInput = document.getElementById('livestreamDateTime');
        
        // Set default to today + 1 day, same time
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + 1);
        
        const year = scheduledDate.getFullYear();
        const month = String(scheduledDate.getMonth() + 1).padStart(2, '0');
        const day = String(scheduledDate.getDate()).padStart(2, '0');
        const hours = String(scheduledDate.getHours()).padStart(2, '0');
        const minutes = String(scheduledDate.getMinutes()).padStart(2, '0');
        
        if (titleInput) titleInput.value = `${livestream.title} (Rescheduled)`;
        if (descriptionInput) descriptionInput.value = livestream.description || '';
        if (dateTimeInput) dateTimeInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
        
        // Show the schedule modal
        setTimeout(() => {
          const scheduleModal = new bootstrap.Modal(document.getElementById('scheduleLivestreamModal'));
          scheduleModal.show();
        }, 500);
      } else {
        showToast(data.error || "Failed to get livestream details", "error");
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


