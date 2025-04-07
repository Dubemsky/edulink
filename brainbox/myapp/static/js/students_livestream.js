// students_livestream.js - Specific functionality for students joining livestreams

// Check for new livestreams and upcoming sessions
document.addEventListener('DOMContentLoaded', function() {
  // Initialize livestream notification checking
  initLivestreamNotifications();
  
  // Load upcoming livestreams in the panel if on the room page
  const streamsTab = document.getElementById('streams');
  if (streamsTab) {
    // Load livestreams when the Streams tab is clicked
    document.getElementById('streamsBtn').addEventListener('click', function() {
      loadUpcomingLivestreamsInTab();
    });
  }
  
  // Check if we're on a page with the livestreams modal
  const upcomingLivestreamsModal = document.getElementById('upcomingLivestreamsModal');
  if (upcomingLivestreamsModal) {
    upcomingLivestreamsModal.addEventListener('shown.bs.modal', function() {
      loadUpcomingLivestreamsInModal();
    });
  }
});

// Initialize livestream notification checking
function initLivestreamNotifications() {
  // Get the room ID
  const roomIdElement = document.getElementById('room-id-data');
  if (!roomIdElement) return;
  
  const roomId = roomIdElement.dataset.roomId;
  if (!roomId) return;
  
  // Check for new livestreams initially
  checkForNewLivestreams(roomId);
  
  // Set up periodic checking
  setInterval(() => {
    checkForNewLivestreams(roomId);
  }, 60000); // Check every minute
}

// Check for new livestreams
function checkForNewLivestreams(roomId) {
  // Get the last check time
  const lastCheck = localStorage.getItem(`lastLivestreamCheck_${roomId}`) || '0';
  
  // Make API request
  fetch(`/check-new-livestreams-view/?room_id=${roomId}&last_check=${lastCheck}`)
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        if (data.new_count > 0) {
          // Show notification badge
          const badge = document.getElementById('livestreams-notification-badge');
          if (badge) {
            badge.textContent = data.new_count;
            badge.style.display = 'flex';
          }
          
          // Also send browser notification if permission is granted
          sendLivestreamNotification(data.new_count);
        }
        
        // Update last check time
        localStorage.setItem(`lastLivestreamCheck_${roomId}`, Date.now().toString());
      }
    })
    .catch(error => {
      console.error('Error checking for new livestreams:', error);
    });
}

// Send browser notification for new livestreams
function sendLivestreamNotification(count) {
  // Check if browser notifications are supported
  if (!('Notification' in window)) return;
  
  // Check if permission is already granted
  if (Notification.permission === 'granted') {
    const message = count === 1 
      ? 'A new livestream has been scheduled!'
      : `${count} new livestreams have been scheduled!`;
      
    const notification = new Notification('EduLink Livestream', {
      body: message,
      icon: '/static/img/edulink-logo.png'
    });
    
    // Close the notification after 5 seconds
    setTimeout(() => {
      notification.close();
    }, 5000);
    
    // Click to open the livestreams modal
    notification.onclick = function() {
      window.focus();
      const modal = document.getElementById('upcomingLivestreamsModal');
      if (modal) {
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
      }
    };
  } else if (Notification.permission !== 'denied') {
    // Request permission
    Notification.requestPermission();
  }
}

// Load upcoming livestreams in the Streams tab
function loadUpcomingLivestreamsInTab() {
  const container = document.querySelector('#streams .streams-list');
  if (!container) return;
  
  const roomIdElement = document.getElementById('room-id-data');
  if (!roomIdElement) return;
  
  const roomId = roomIdElement.dataset.roomId;
  
  // Show loading state
  container.innerHTML = '<li class="loading">Loading livestreams...</li>';
  
  // Clear the notification badge when viewing livestreams
  const badge = document.getElementById('livestreams-notification-badge');
  if (badge) {
    badge.style.display = 'none';
  }
  
  // Fetch upcoming livestreams
  fetch(`/get-upcoming-livestreams/?room_id=${roomId}`)
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        if (data.livestreams && data.livestreams.length > 0) {
          // Sort livestreams (live ones first, then by scheduled time)
          const sortedLivestreams = data.livestreams.sort((a, b) => {
            // Live streams first
            if (a.status === 'live' && b.status !== 'live') return -1;
            if (a.status !== 'live' && b.status === 'live') return 1;
            
            // Then by scheduled time
            return new Date(a.scheduled_time) - new Date(b.scheduled_time);
          });
          
          // Clear container
          container.innerHTML = '';
          
          // Add each livestream
          sortedLivestreams.forEach(livestream => {
            const livestreamEl = createLivestreamListItem(livestream);
            container.appendChild(livestreamEl);
          });
        } else {
          container.innerHTML = '<li class="no-streams">No upcoming livestreams scheduled.</li>';
        }
      } else {
        container.innerHTML = '<li class="error">Error loading livestreams. Please try again.</li>';
      }
    })
    .catch(error => {
      console.error('Error fetching livestreams:', error);
      container.innerHTML = '<li class="error">Error loading livestreams. Please try again.</li>';
    });
}

// Load upcoming livestreams in the modal
function loadUpcomingLivestreamsInModal() {
  const container = document.getElementById('modal-upcoming-livestreams');
  const noLivestreamsMessage = document.getElementById('modal-no-livestreams');
  
  if (!container) return;
  
  const roomIdElement = document.getElementById('room-id-data');
  if (!roomIdElement) return;
  
  const roomId = roomIdElement.dataset.roomId;
  
  // Show loading state
  container.innerHTML = '<div class="loading-spinner">Loading livestreams...</div>';
  
  // Clear the notification badge when viewing livestreams
  const badge = document.getElementById('livestreams-notification-badge');
  if (badge) {
    badge.style.display = 'none';
  }
  
  // Fetch upcoming livestreams
  fetch(`/get-upcoming-livestreams/?room_id=${roomId}`)
    .then(response => response.json())
    .then(data => {
      container.innerHTML = '';
      
      if (data.success) {
        if (data.livestreams && data.livestreams.length > 0) {
          // Sort livestreams (live ones first, then by scheduled time)
          const sortedLivestreams = data.livestreams.sort((a, b) => {
            // Live streams first
            if (a.status === 'live' && b.status !== 'live') return -1;
            if (a.status !== 'live' && b.status === 'live') return 1;
            
            // Then by scheduled time
            return new Date(a.scheduled_time) - new Date(b.scheduled_time);
          });
          
          // Hide the "no livestreams" message
          if (noLivestreamsMessage) {
            noLivestreamsMessage.style.display = 'none';
          }
          
          // Add each livestream
          sortedLivestreams.forEach(livestream => {
            const livestreamEl = createStudentLivestreamItem(livestream);
            container.appendChild(livestreamEl);
          });
        } else if (noLivestreamsMessage) {
          // Show the "no livestreams" message
          noLivestreamsMessage.style.display = 'block';
        } else {
          container.innerHTML = '<div class="no-livestreams">No upcoming livestreams scheduled.</div>';
        }
      } else {
        container.innerHTML = '<div class="error-message">Error loading livestreams. Please try again.</div>';
      }
    })
    .catch(error => {
      console.error('Error fetching livestreams:', error);
      container.innerHTML = '<div class="error-message">Error loading livestreams. Please try again.</div>';
    });
}

// Create a livestream list item for the Streams tab
function createLivestreamListItem(livestream) {
  const li = document.createElement('li');
  li.className = 'livestream-item';
  
  // Format date/time
  const date = new Date(livestream.scheduled_time);
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  // Check if livestream is live or starting soon
  const now = new Date();
  const isLive = livestream.status === 'live';
  const isStartingSoon = !isLive && (date - now) < 30 * 60 * 1000; // Within 30 minutes
  
  // Create the HTML
  li.innerHTML = `
    <div class="livestream-header">
      <h5 class="livestream-title">${livestream.title || 'Untitled Livestream'}</h5>
      <span class="livestream-status ${isLive ? 'status-live' : isStartingSoon ? 'status-soon' : 'status-scheduled'}">
        ${isLive ? 'LIVE NOW' : isStartingSoon ? 'Starting Soon' : 'Scheduled'}
      </span>
    </div>
    <div class="livestream-details">
      <i class="bi bi-person-video3"></i> ${livestream.teacher} &#8226;
      <i class="bi bi-calendar-event"></i> ${formattedDate} at ${formattedTime}
    </div>
    ${livestream.description ? `<p class="livestream-description">${livestream.description}</p>` : ''}
    <div class="livestream-actions">
      ${isLive ? `
        <button class="btn btn-danger btn-sm join-livestream-btn" data-id="${livestream.id}">
          <i class="bi bi-broadcast"></i> Join Now
        </button>
      ` : `
        <button class="btn btn-outline-secondary btn-sm view-details-btn" data-id="${livestream.id}">
          <i class="bi bi-info-circle"></i> Details
        </button>
      `}
    </div>
  `;
  
  // Add event listeners
  setTimeout(() => {
    const joinBtn = li.querySelector('.join-livestream-btn');
    if (joinBtn) {
      joinBtn.addEventListener('click', function() {
        studentJoinLivestream(livestream.id);
      });
    }
    
    const detailsBtn = li.querySelector('.view-details-btn');
    if (detailsBtn) {
      detailsBtn.addEventListener('click', function() {
        showLivestreamDetails(livestream, isLive);
      });
    }
  }, 0);
  
  return li;
}