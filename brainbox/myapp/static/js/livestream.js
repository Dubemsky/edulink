// Livestream management code

document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM Content Loaded - Setting up livestream management");
  
  // Check if room ID data element exists
  const roomIdElement = document.getElementById('room-id-data');
  if (!roomIdElement) {
    console.error("Error: room-id-data element not found!");
    // Try to create the room-id-data element from URL
    createRoomIdFromUrl();
  }
  
  // Initialize the modals and attach event listeners
  initializeModals();
  
  // Add listeners for livestream management tabs
  setupTabListeners();
  
  // Add listener for the Schedule button within the modal
  setupScheduleButton();
  
  // Add event listener for edit form submission
  setupEditForm();
  
  // Add listener for the "Streams" tab in the sidebar
  setupStreamsTab();
  
  // Add debug button for development (comment out for production)
  // addDebugButton();
});

function createRoomIdFromUrl() {
  // Attempt to find room ID from URL if element is missing
  const pathParts = window.location.pathname.split('/');
  let roomId = null;
  
  for (let i = 0; i < pathParts.length; i++) {
    if (pathParts[i] === 'hub-room' && i+1 < pathParts.length) {
      roomId = pathParts[i+1];
      break;
    }
  }
  
  if (roomId) {
    console.log("Found room ID from URL:", roomId);
    
    // Create the room-id-data element if it's missing
    const roomIdData = document.createElement('div');
    roomIdData.id = 'room-id-data';
    roomIdData.dataset.roomId = roomId;
    roomIdData.style.display = 'none';
    document.body.appendChild(roomIdData);
  } else {
    console.error("Could not determine room ID from URL");
    showToast("Error: Could not determine room ID. Please refresh the page.", "error");
  }
}

function initializeModals() {
  // Ensure Bootstrap is available
  if (typeof bootstrap === 'undefined') {
    console.error('Bootstrap is not loaded. Modal initialization failed.');
    return;
  }

  // Debug: Log all modal elements in the document
  const allModals = document.querySelectorAll('.modal');
  console.log('All modals found:', Array.from(allModals).map(modal => modal.id));

  // Modal initialization configuration
  const modals = [
    {id: 'manageLivestreamsModal', onShow: loadTeacherLivestreams},
    {id: 'scheduleLivestreamModal', onShow: setupScheduleButton}
  ];
  
  // Modal initialization
  modals.forEach(modalInfo => {
    // Try multiple methods to find the modal
    let modalElement = document.getElementById(modalInfo.id);
    
    // If not found by ID, try querying the document
    if (!modalElement) {
      modalElement = document.querySelector(`#${modalInfo.id}`);
    }
    
    // If still not found, try partial matching
    if (!modalElement) {
      modalElement = document.querySelector(`[id*="${modalInfo.id}"]`);
    }
    
    if (!modalElement) {
      console.warn(`Warning: Could not find modal with ID ${modalInfo.id}`);
      
      // Additional debug: log all modal IDs
      const allModalIds = Array.from(document.querySelectorAll('.modal')).map(m => m.id);
      console.warn('Available modal IDs:', allModalIds);
      
      return;
    }

    try {
      // Create or get existing modal instance
      const modalInstance = bootstrap.Modal.getInstance(modalElement) || 
                             new bootstrap.Modal(modalElement);
      
      // Store the modal instance on the element
      modalElement._bsModal = modalInstance;

      // Add shown event listener if callback provided
      if (modalInfo.onShow) {
        modalElement.addEventListener('shown.bs.modal', modalInfo.onShow);
      }

      // Clean up backdrops when modal is hidden
      modalElement.addEventListener('hidden.bs.modal', function() {
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
          backdrop.remove();
        });
        document.body.classList.remove('modal-open');
      });

      console.log(`Successfully initialized modal: ${modalElement.id}`);
    } catch (error) {
      console.error(`Error initializing modal ${modalInfo.id}:`, error);
    }
  });

  // Modal button handling
  const modalButtons = [
    {selector: 'a[data-bs-target="#manageLivestreamsModal"]', modalId: 'manageLivestreamsModal'},
    {selector: 'button[data-bs-target="#manageLivestreamsModal"]', modalId: 'manageLivestreamsModal'},
    {selector: 'a[data-bs-target="#scheduleLivestreamModal"]', modalId: 'scheduleLivestreamModal'},
    {selector: 'button[data-bs-target="#scheduleLivestreamModal"]', modalId: 'scheduleLivestreamModal'}
  ];

  modalButtons.forEach(buttonInfo => {
    const buttons = document.querySelectorAll(buttonInfo.selector);
    
    buttons.forEach(button => {
      if (button) {
        console.log(`Found button for ${buttonInfo.modalId}, adding direct click handler`);
        
        button.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();

          // Try multiple methods to find the modal
          let modalElement = document.getElementById(buttonInfo.modalId);
          
          // If not found by ID, try querying the document
          if (!modalElement) {
            modalElement = document.querySelector(`#${buttonInfo.modalId}`);
          }
          
          if (!modalElement) {
            console.error(`Modal element ${buttonInfo.modalId} not found`);
            
            // Debug: log all modal IDs
            const allModalIds = Array.from(document.querySelectorAll('.modal')).map(m => m.id);
            console.error('Available modal IDs:', allModalIds);
            
            return;
          }

          try {
            // Use existing modal instance or create a new one
            const modalInstance = bootstrap.Modal.getInstance(modalElement) || 
                                  new bootstrap.Modal(modalElement);
            
            // Show the modal
            modalInstance.show();

            // If it's the manage livestreams modal, load livestreams
            if (buttonInfo.modalId === 'manageLivestreamsModal' && typeof loadTeacherLivestreams === 'function') {
              loadTeacherLivestreams();
            }
          } catch (error) {
            console.error(`Error showing modal ${buttonInfo.modalId}:`, error);
          }
        });
      }
    });
  });

  // Setup schedule button functionality
  const scheduleLivestreamBtn = document.getElementById('scheduleLivestreamBtn');
  if (scheduleLivestreamBtn) {
    scheduleLivestreamBtn.addEventListener('click', function() {
      setupScheduleButton();
    });
  } else {
    console.warn('Could not find scheduleLivestreamBtn');
  }

  // Fallback: Log all modals and their attributes
  console.log('All modals in document:', 
    Array.from(document.querySelectorAll('.modal')).map(modal => ({
      id: modal.id,
      classList: Array.from(modal.classList),
      attributes: Array.from(modal.attributes).map(attr => attr.name)
    }))
  );
}




function setupTabListeners() {
  // Add event listeners for the livestream management tabs
  const manageLivestreamsModal = document.getElementById('manageLivestreamsModal');
  if (manageLivestreamsModal) {
    console.log("Found manageLivestreamsModal, setting up tab event listeners");
    
    // Add event listeners for tab changes
    const upcomingTab = document.getElementById('upcoming-tab');
    const liveTab = document.getElementById('live-tab');
    const pastTab = document.getElementById('past-tab');
    
    if (upcomingTab) {
      upcomingTab.addEventListener('click', function() {
        console.log("Upcoming tab clicked");
        loadUpcomingLivestreams();
      });
    }
    
    if (liveTab) {
      liveTab.addEventListener('click', function() {
        console.log("Live tab clicked");
        loadLiveLivestreams();
      });
    }
    
    if (pastTab) {
      pastTab.addEventListener('click', function() {
        console.log("Past tab clicked");
        loadPastLivestreams();
      });
    }
    
    // Also trigger load when modal is shown
    manageLivestreamsModal.addEventListener('shown.bs.modal', function() {
      console.log("Modal fully shown, loading livestreams");
      loadUpcomingLivestreams();
    });
  }
}

function setupScheduleButton() {
  const scheduleLivestreamBtn = document.getElementById('scheduleLivestreamBtn');
  if (scheduleLivestreamBtn) {
    scheduleLivestreamBtn.addEventListener('click', function() {
      // Get form values
      const title = document.getElementById('livestreamTitle').value.trim();
      const description = document.getElementById('livestreamDescription').value.trim();
      const dateTime = document.getElementById('livestreamDateTime').value;
      
      // Get the room ID
      const roomIdElement = document.getElementById('room-id-data');
      if (!roomIdElement) {
        showToast("Error: Room ID not found. Please refresh the page.", "error");
        return;
      }
      
      const roomId = roomIdElement.dataset.roomId;
      if (!roomId) {
        showToast("Error: Room ID is empty. Please refresh the page.", "error");
        return;
      }
      
      // Validate inputs
      if (!title) {
        showToast("Please enter a title for your livestream", "error");
        return;
      }
      
      if (!dateTime) {
        showToast("Please select a date and time for your livestream", "error");
        return;
      }
      
      // Disable the button during submission
      scheduleLivestreamBtn.disabled = true;
      scheduleLivestreamBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Scheduling...';
      
      console.log("Scheduling livestream with data:", {
        title, description, dateTime, roomId
      });
      
      // Submit the data
      fetch('/schedule-livestream/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({
          title: title,
          description: description,
          scheduled_time: dateTime,
          room_id: roomId
        })
      })
      .then(response => {
        console.log("API response status:", response.status);
        return response.json();
      })
      .then(data => {
        console.log("API response data:", data);
        scheduleLivestreamBtn.disabled = false;
        scheduleLivestreamBtn.textContent = 'Schedule Livestream';
        
        if (data.success) {
          // Close the modal
          const scheduleLivestreamModal = document.getElementById('scheduleLivestreamModal');
          if (scheduleLivestreamModal && scheduleLivestreamModal._bsModal) {
            scheduleLivestreamModal._bsModal.hide();
          } else if (scheduleLivestreamModal) {
            const modal = bootstrap.Modal.getInstance(scheduleLivestreamModal);
            if (modal) modal.hide();
          }
          
          // Show success message
          showToast("Livestream scheduled successfully", "success");
          
          // Refresh the livestreams lists
          loadUpcomingLivestreams();
          
          // Also refresh the Streams tab content if visible
          if (document.getElementById('streams').style.display === 'block') {
            loadStreamsTabLivestreams();
          }
        } else {
          showToast(data.error || "Failed to schedule livestream", "error");
        }
      })
      .catch(error => {
        console.error('Error:', error);
        scheduleLivestreamBtn.disabled = false;
        scheduleLivestreamBtn.textContent = 'Schedule Livestream';
        showToast("An error occurred. Please try again.", "error");
      });
    });
  } else {
    console.warn("Warning: Could not find scheduleLivestreamBtn");
  }
}





function setupEditForm() {
  const saveLivestreamChangesBtn = document.getElementById('saveLivestreamChangesBtn');
  if (saveLivestreamChangesBtn) {
    saveLivestreamChangesBtn.addEventListener('click', saveEditedLivestream);
  }
}

function setupStreamsTab() {
  const streamsTabBtn = document.getElementById('streamsBtn');
  if (streamsTabBtn) {
    streamsTabBtn.addEventListener('click', function() {
      console.log("Streams tab clicked");
      loadStreamsTabLivestreams();
    });
  }
}

// Enhanced function to load livestreams for the Streams tab
function loadStreamsTabLivestreams() {
  console.log("Loading livestreams for Streams tab");
  
  const roomIdElement = document.getElementById('room-id-data');
  if (!roomIdElement) {
    console.error("room-id-data element not found");
    return;
  }
  
  const roomId = roomIdElement.dataset.roomId;
  if (!roomId) {
    console.error("Room ID is empty");
    return;
  }
  
  // Look for container in multiple possible locations
  let container = null;
  
  // First try in the streams tab
  container = document.querySelector('#streams #upcoming-livestreams-list');
  
  // If not found, try without the streams ID qualifier
  if (!container) {
    container = document.getElementById('upcoming-livestreams-list');
  }
  
  // If still not found, try a more general selector
  if (!container) {
    container = document.querySelector('#streams .livestreams-list');
  }
  
  // As a last resort, try to find any element in the streams tab where we can put content
  if (!container) {
    container = document.querySelector('#streams-container');
    if (!container) {
      container = document.getElementById('streams');
    }
    
    if (container) {
      // Create a container element since it doesn't exist
      const newContainer = document.createElement('div');
      newContainer.id = 'upcoming-livestreams-list';
      newContainer.className = 'livestreams-list';
      container.appendChild(newContainer);
      container = newContainer;
    }
  }
  
  if (!container) {
    console.error("Livestream container not found in Streams tab");
    return;
  }
  
  console.log("Found container for livestreams:", container);
  
  // Show loading spinner
  container.innerHTML = '<div class="loading-spinner">Loading your scheduled livestreams...</div>';
  
  // Make API request to get upcoming livestreams
  fetch(`/get-upcoming-livestreams/?room_id=${roomId}`)
    .then(response => response.json())
    .then(data => {
      console.log("API response for Streams tab:", data);
      
      // Clear the container
      container.innerHTML = '';
      
      if (data.success && data.livestreams && data.livestreams.length > 0) {
        // Sort livestreams by date (closest first)
        const sortedLivestreams = data.livestreams.sort((a, b) => {
          return new Date(a.scheduled_time) - new Date(b.scheduled_time);
        });
        
        // Create elements for each upcoming livestream
        sortedLivestreams.forEach(livestream => {
          const livestreamEl = createStreamTabLivestreamItem(livestream);
          container.appendChild(livestreamEl);
        });
      } else {
        // No upcoming livestreams
        container.innerHTML = '<div class="no-livestreams">No scheduled livestreams available.</div>';
      }
    })
    .catch(error => {
      console.error('Error fetching livestreams for Streams tab:', error);
      container.innerHTML = '<div class="error-message">Error loading livestreams. Please try again.</div>';
    });
}

// Function to create a livestream item for the Streams tab
function createStreamTabLivestreamItem(livestream) {
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
  
  item.innerHTML = `
    <div class="livestream-header">
      <h5 class="livestream-title">${livestream.title || 'Untitled Livestream'}</h5>
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
        <button class="btn btn-outline-primary btn-sm manage-btn" data-bs-toggle="modal" data-bs-target="#manageLivestreamsModal">
          <i class="bi bi-list"></i> Manage
        </button>
      `}
    </div>
  `;
  
  // Add event listeners
  setTimeout(() => {
    const startBtn = item.querySelector('.start-livestream-btn');
    if (startBtn) {
      startBtn.addEventListener('click', function() {
        startLivestream(livestream.id);
      });
    }
    
    const manageBtn = item.querySelector('.manage-btn');
    if (manageBtn) {
      manageBtn.addEventListener('click', function() {
        // Make sure the upcoming tab is active when opening the manage modal
        document.getElementById('upcoming-tab').click();
      });
    }
  }, 0);
  
  return item;
}






















// Function to load active (live) livestreams
// Function to load upcoming livestreams
function loadUpcomingLivestreams() {
  console.log("loadUpcomingLivestreams called");

  const roomIdElement = document.getElementById('room-id-data');
  if (!roomIdElement) {
    console.error("room-id-data element not found");
    return;
  }

  const roomId = roomIdElement.dataset.roomId;
  if (!roomId) {
    console.error("Room ID is empty");
    return;
  }

  const container = document.getElementById('upcoming-livestreams-list');

  if (!container) {
    console.error("upcoming-livestreams-list container not found");
    return;
  }

  // Clear existing content
  container.innerHTML = '<div class="loading-spinner">Loading your scheduled livestreams...</div>';

  // Fetch upcoming livestreams
  fetch(`/get-teacher-livestreams/?room_id=${roomId}&status=scheduled`)
    .then(response => response.json())
    .then(data => {
      // Clear the loading spinner
      container.innerHTML = '';

      // Log the response data for debugging
      console.log(`I am here 5\n\n\n\n ${JSON.stringify(data, null, 2)}`);

      // Check if the data is in the expected format
      if (data.success && Array.isArray(data.livestreams)) {
        // Sort livestreams by scheduled time (closest first)
        const sortedLivestreams = data.livestreams.sort((a, b) => 
          new Date(a.scheduled_time) - new Date(b.scheduled_time)
        );
        
        // Iterate over the sorted livestreams and create elements for them
        sortedLivestreams.forEach(livestream => {
          // Pass only the necessary properties to the function
          const livestreamEl = createTeacherLivestreamItem({
            id: livestream.id,
            scheduled_time: livestream.scheduled_time,
            title: livestream.title,
            description: livestream.description
          }, 'upcoming');
    
          container.appendChild(livestreamEl);
        });
    }
    
      else {
        
        container.innerHTML = '<div class="no-livestreams">You haven\'t scheduled any upcoming livestreams.</div>';
        
      }
    })
    .catch(error => {
      console.error('Error fetching livestreams:', error);

      // Show error message in case of failure
      container.innerHTML = '<div class="error-message">Error loading livestreams. Please try again.</div>';
    });
}


// Function to load live livestreams
function loadLiveLivestreams() {
  console.log("loadLiveLivestreams called");

  const roomIdElement = document.getElementById('room-id-data');
  if (!roomIdElement) {
    console.error("room-id-data element not found");
    return;
  }

  const roomId = roomIdElement.dataset.roomId;
  if (!roomId) {
    console.error("Room ID is empty");
    return;
  }

  const container = document.getElementById('live-livestreams-list');

  if (!container) {
    console.error("live-livestreams-list container not found");
    return;
  }

  // Clear existing content
  container.innerHTML = '<div class="loading-spinner">Checking for active livestreams...</div>';

  // Fetch live livestreams
  fetch(`/get-teacher-livestreams/?room_id=${roomId}&status=live`)
    .then(response => response.json())
    .then(data => {
      // Clear the loading spinner
      container.innerHTML = '';
      console.log(`I am here 6\n\n\n\n ${JSON.stringify(data, null, 2)}`);
      if (data.success && Array.isArray(data.livestreams)) {
        // Sort livestreams by scheduled time (closest first)
        const sortedLivestreams = data.livestreams.sort((a, b) => 
          new Date(a.scheduled_time) - new Date(b.scheduled_time)
        );
        
        // Iterate over the sorted livestreams and create elements for them
        sortedLivestreams.forEach(livestream => {
          // Pass only the necessary properties to the function
          const livestreamEl = createTeacherLivestreamItem({
            id: livestream.id,
            scheduled_time: livestream.scheduled_time,
            title: livestream.title,
            description: livestream.description
          }, 'live');
    
          container.appendChild(livestreamEl);
        });
    }
    
      else {
        
        container.innerHTML = '<div class="no-livestreams">You haven\'t scheduled any upcoming livestreams.</div>';
        
      }
    })
    .catch(error => {
      console.error('Error fetching live livestreams:', error);
      container.innerHTML = '<div class="error-message">Error checking for active livestreams. Please try again.</div>';
    });
}

// Function to load past livestreams
function loadPastLivestreams() {
  console.log("loadPastLivestreams called");

  const roomIdElement = document.getElementById('room-id-data');
  if (!roomIdElement) {
    console.error("room-id-data element not found");
    return;
  }

  const roomId = roomIdElement.dataset.roomId;
  if (!roomId) {
    console.error("Room ID is empty");
    return;
  }

  const container = document.getElementById('past-livestreams-list');

  if (!container) {
    console.error("past-livestreams-list container not found");
    return;
  }

  // Clear existing content
  container.innerHTML = '<div class="loading-spinner">Loading your past livestreams...</div>';

  // Fetch past livestreams
  fetch(`/get-teacher-livestreams/?room_id=${roomId}&status=completed,cancelled`)
    .then(response => response.json())
    .then(data => {
      // Clear the loading spinner
      container.innerHTML = '';

      if (data.success && Array.isArray(data.livestreams)) {
        // Sort livestreams by scheduled time (closest first)
        const sortedLivestreams = data.livestreams.sort((a, b) => 
          new Date(a.scheduled_time) - new Date(b.scheduled_time)
        );
        
        // Iterate over the sorted livestreams and create elements for them
        sortedLivestreams.forEach(livestream => {
          // Pass only the necessary properties to the function
          const livestreamEl = createTeacherLivestreamItem({
            id: livestream.id,
            scheduled_time: livestream.scheduled_time,
            title: livestream.title,
            description: livestream.description
          }, 'past');
    
          container.appendChild(livestreamEl);
        });
    }
    
      else {
        
        container.innerHTML = '<div class="no-livestreams">You haven\'t scheduled any upcoming livestreams.</div>';
        
      }
    })
    .catch(error => {
      console.error('Error fetching past livestreams:', error);
      container.innerHTML = '<div class="error-message">Error loading past livestreams. Please try again.</div>';
    });
}

// Function to manage livestreams when the modal is opened
function loadTeacherLivestreams() {
  console.log("loadTeacherLivestreams called");
  
  // Load upcoming livestreams by default
  loadUpcomingLivestreams();
  
  // Attach event listeners to tabs
  const upcomingTab = document.getElementById('upcoming-tab');
  const liveTab = document.getElementById('live-tab');
  const pastTab = document.getElementById('past-tab');
  
  if (upcomingTab) {
    upcomingTab.addEventListener('click', loadUpcomingLivestreams);
  }
  
  if (liveTab) {
    liveTab.addEventListener('click', loadLiveLivestreams);
  }
  
  if (pastTab) {
    pastTab.addEventListener('click', loadPastLivestreams);
  }
}

function createTeacherLivestreamItem(livestream, type) {
  try {

    const item = document.createElement('div');
    item.className = 'livestream-item';
    item.dataset.id = livestream.id;

    let formattedDate = livestream.scheduled_time;
    let formattedTime = 'Time not available';
    let isUpcomingSoon = false;

    try {
      const scheduledDate = new Date(livestream.scheduled_time);
      if (!isNaN(scheduledDate.getTime())) {
        formattedDate = scheduledDate.toLocaleDateString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });

        formattedTime = scheduledDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        });

        const now = new Date();
        const timeDiff = scheduledDate - now;
        isUpcomingSoon = timeDiff > 0 && timeDiff < 30 * 60 * 1000;
      }
    } catch (error) {
      console.error("Error formatting date:", error);
    }

    const status = type === 'live' ? 'LIVE NOW' :
                   type === 'upcoming' ? (isUpcomingSoon ? 'Starting Soon' : 'Scheduled') :
                   'Completed';

    let html = `
      <div class="livestream-header">
        <h5 class="livestream-title">${livestream.title || 'Untitled Livestream'}</h5>
        <span class="livestream-status ${
          isUpcomingSoon ? 'status-soon' : 
          status === 'LIVE NOW' ? 'status-live' : 
          status === 'Scheduled' ? 'status-scheduled' : 
          'status-completed'
        }">${status}</span>
      </div>

      <div class="livestream-details">
        <div class="livestream-datetime">
          <i class="bi bi-calendar-event"></i> ${formattedDate} at ${formattedTime}
        </div>
      </div>
    `;

    if (livestream.description) {
      html += `<p class="livestream-description">${livestream.description}</p>`;
    }

    html += `<div class="livestream-actions">`;

    if (type === 'upcoming') {
      if (isUpcomingSoon) {
        console.log(`\n\n i am here updateing upcoming \n\n`)
        
        html += `
          <button class="btn btn-primary btn-sm start-livestream-btn" data-id="${livestream.id}">
            <i class="bi bi-broadcast"></i> Start Now
          </button>
        `;
      } else {
        console.log(`\n\n i am here updateing error occured upcoming \n\n`)
        html += `
          <button class="btn btn-outline-primary btn-sm edit-livestream-btn"
                  data-id="${livestream.id}" data-bs-toggle="modal" data-bs-target="#editLivestreamModal">
            <i class="bi bi-pencil"></i> Edit
          </button>
        `;
      }

      html += `
        <button class="btn btn-outline-danger btn-sm cancel-livestream-btn" data-id="${livestream.id}">
          <i class="bi bi-x-circle"></i> Cancel
        </button>
      `;
    } else if (type === 'live') {
      html += `
        <button class="btn btn-primary btn-sm join-livestream-btn" data-id="${livestream.id}">
          <i class="bi bi-broadcast"></i> Join Your Stream
        </button>
        <button class="btn btn-danger btn-sm end-livestream-btn" data-id="${livestream.id}">
          <i class="bi bi-stop-circle"></i> End Stream
        </button>
      `;
    } else if (type === 'past') {
      html += `
        <button class="btn btn-outline-secondary btn-sm duplicate-livestream-btn" data-id="${livestream.id}">
          <i class="bi bi-copy"></i> Reschedule
        </button>
      `;
    }

    html += `</div>`;
    item.innerHTML = html;

    setTimeout(() => {
      try {
        if (type === 'upcoming') {
          item.querySelector('.start-livestream-btn')?.addEventListener('click', () => {
            startLivestream(livestream.id);
          });

          item.querySelector('.edit-livestream-btn')?.addEventListener('click', () => {
            openEditLivestreamModal(livestream);
          });

          item.querySelector('.cancel-livestream-btn')?.addEventListener('click', () => {
            cancelLivestream(livestream.id);
          });
        } else if (type === 'live') {
          item.querySelector('.join-livestream-btn')?.addEventListener('click', () => {
            joinLivestream(livestream.id);
          });

          item.querySelector('.end-livestream-btn')?.addEventListener('click', () => {
            endLivestream(livestream.id);
          });
        } else if (type === 'past') {
          item.querySelector('.duplicate-livestream-btn')?.addEventListener('click', () => {
            duplicateLivestream(livestream.id);
          });
        }
      } catch (error) {
        console.error("Error attaching event listeners:", error);
      }
    }, 0);

    return item;
  } catch (error) {
    console.error("Error creating livestream item:", error);
    const errorItem = document.createElement('div');
    errorItem.className = 'livestream-item error';
    errorItem.innerHTML = `<div class="alert alert-danger">Error displaying livestream: ${error.message}</div>`;
    return errorItem;
  }
}






// Function to open the edit livestream modal
function openEditLivestreamModal(livestream) {
  console.log("Opening edit modal for livestream:", livestream);
  
  // Hide the manage livestreams modal
  const manageModal = document.getElementById('manageLivestreamsModal');
  if (manageModal && manageModal._bsModal) {
    manageModal._bsModal.hide();
  } else if (manageModal) {
    const modalInstance = bootstrap.Modal.getInstance(manageModal);
    if (modalInstance) modalInstance.hide();
  }
  
  // Get edit modal elements
  const editModal = document.getElementById('editLivestreamModal');
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
  titleInput.value = livestream.title || '';
  descriptionInput.value = livestream.description || '';
  dateTimeInput.value = formattedDateTime;
  
  // Show the edit modal
  if (editModal && editModal._bsModal) {
    editModal._bsModal.show();
  } else if (editModal) {
    const modal = new bootstrap.Modal(editModal);
    modal.show();
  }
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
      const editModal = document.getElementById('editLivestreamModal');
      if (editModal && editModal._bsModal) {
        editModal._bsModal.hide();
      } else if (editModal) {
        const modalInstance = bootstrap.Modal.getInstance(editModal);
        if (modalInstance) modalInstance.hide();
      }
      
      // Show success message
      showToast("Livestream updated successfully", "success");
      
      // Reopen the manage modal and refresh the list
      setTimeout(() => {
        const manageModal = document.getElementById('manageLivestreamsModal');
        if (manageModal && manageModal._bsModal) {
          manageModal._bsModal.show();
        } else if (manageModal) {
          const modal = new bootstrap.Modal(manageModal);
          modal.show();
        }
        
        // Reload the upcoming livestreams list
        loadUpcomingLivestreams();
        
        // Also refresh streams tab if visible
        if (document.getElementById('streams').style.display === 'block') {
          loadStreamsTabLivestreams();
        }
      }, 300);
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




// Function to duplicate a past livestream for rescheduling
function duplicateLivestream(livestreamId) {
  // Make an API request to get the livestream details
  fetch(`/get-livestream-details/${livestreamId}/`)
    .then(response => response.json())
    .then(data => {
      if (data.success && data.livestream) {
        // Hide the manage modal
        const manageModal = document.getElementById('manageLivestreamsModal');
        if (manageModal && manageModal._bsModal) {
          manageModal._bsModal.hide();
        } else if (manageModal) {
          const modalInstance = bootstrap.Modal.getInstance(manageModal);
          if (modalInstance) modalInstance.hide();
        }
        
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
          const scheduleModal = document.getElementById('scheduleLivestreamModal');
          if (scheduleModal && scheduleModal._bsModal) {
            scheduleModal._bsModal.show();
          } else if (scheduleModal) {
            const modal = new bootstrap.Modal(scheduleModal);
            modal.show();
          }
        }, 300);
      } else {
        showToast(data.error || "Failed to get livestream details", "error");
      }
    })
    .catch(error => {
      console.error('Error:', error);
      showToast("An error occurred. Please try again.", "error");
    });
}



// Call this function when the Streams tab is clicked
document.getElementById('streamsBtn')?.addEventListener('click', function() {
  setTimeout(debugDOMStructure, 500);
});

// Make sure tabs switch correctly
document.addEventListener('DOMContentLoaded', function() {
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      // Remove active class from all buttons
      tabButtons.forEach(btn => btn.classList.remove('active'));
      
      // Add active class to clicked button
      this.classList.add('active');
      
      // Get the tab to show
      const tabToShow = this.getAttribute('data-tab');
      
      // Hide all tab content
      document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
      });
      
      // Show the selected tab content
      document.getElementById(tabToShow).style.display = 'block';
      
      console.log(`Switched to tab: ${tabToShow}`);
      
      // Load content for the streams tab if selected
      if (tabToShow === 'streams') {
        setTimeout(() => {
          console.log("Loading livestreams after tab switch");
          loadStreamsTabLivestreams();
        }, 100);
      }
    });
  });
});



document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM loaded - Setting up livestream components");
  
  // Get the room ID (essential for API calls)
  const roomIdElement = document.getElementById('room-id-data');
  let roomId = null;
  
  if (roomIdElement) {
    roomId = roomIdElement.dataset.roomId;
    console.log("Room ID found:", roomId);
  } else {
    console.error("Room ID element not found! Attempting to extract from URL...");
    createRoomIdFromUrl();
  }
  
  // Initialize modal functionality
  setupModalHandlers();
  
  // Set up event listeners for manage livestreams modal
  setupManageLivestreamsModal();
});



// Improved setup for modal handlers
function setupModalHandlers() {
  // All modal open buttons
  const modalOpenButtons = document.querySelectorAll('[data-bs-toggle="modal"]');
  
  modalOpenButtons.forEach(button => {
    const modalId = button.getAttribute('data-bs-target');
    if (!modalId) return;
    
    const modalElement = document.querySelector(modalId);
    if (!modalElement) {
      console.warn(`Modal element not found: ${modalId}`);
      return;
    }
    
    // Ensure modal instances are properly created
    try {
      if (typeof bootstrap !== 'undefined') {
        // Only create new instances when needed
        if (!modalElement._bsModal) {
          modalElement._bsModal = new bootstrap.Modal(modalElement);
          console.log(`Modal initialized: ${modalId}`);
        }
      } else {
        console.error("Bootstrap is not defined. Cannot initialize modals.");
      }
    } catch (error) {
      console.error(`Error initializing modal ${modalId}:`, error);
    }
    
    // Use direct click listeners for more reliable behavior
    button.addEventListener('click', function(e) {
      e.preventDefault();
      console.log(`Button clicked for modal: ${modalId}`);
      
      if (modalElement._bsModal) {
        modalElement._bsModal.show();
      } else {
        try {
          // Fallback to creating a new instance
          const modalInstance = new bootstrap.Modal(modalElement);
          modalInstance.show();
        } catch (error) {
          console.error("Could not show modal:", error);
        }
      }
    });
  });
  
  // Clean up modal backdrops
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('hidden.bs.modal', function() {
      document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.remove();
      });
      document.body.classList.remove('modal-open');
    });
  });
}

// Specific setup for the Manage Livestreams modal
function setupManageLivestreamsModal() {
  console.log("Setting up Manage Livestreams modal");
  
  const manageLivestreamsModal = document.getElementById('manageLivestreamsModal');
  if (!manageLivestreamsModal) {
    console.error("Manage Livestreams modal not found!");
    return;
  }
  
  // Set up tab buttons
  const tabButtons = manageLivestreamsModal.querySelectorAll('.nav-link');
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      console.log(`Tab clicked: ${this.id}`);
      const tabId = this.getAttribute('data-bs-target');
      const tabPane = document.querySelector(tabId);
      
      if (tabPane) {
        // Load content based on tab
        if (this.id === 'upcoming-tab') {
          loadUpcomingLivestreams();
        } else if (this.id === 'live-tab') {
          loadLiveLivestreams();
        } else if (this.id === 'past-tab') {
          loadPastLivestreams();
        }
      }
    });
  });
  
  // Direct modal open and content loading
  const manageStreamsButton = document.querySelector('a[data-bs-target="#manageLivestreamsModal"]');
  if (manageStreamsButton) {
    manageStreamsButton.addEventListener('click', function(e) {
      e.preventDefault();
      
      console.log("Manage Livestreams button clicked");
      
      // Show the modal
      if (manageLivestreamsModal._bsModal) {
        manageLivestreamsModal._bsModal.show();
      } else {
        try {
          const modal = new bootstrap.Modal(manageLivestreamsModal);
          modal.show();
        } catch (error) {
          console.error("Error showing modal:", error);
        }
      }
      
      // Load the content
      setTimeout(() => {
        console.log("Loading livestreams content");
        loadUpcomingLivestreams();
      }, 300);
    });
  }
  
  // Load content when modal is shown
  manageLivestreamsModal.addEventListener('shown.bs.modal', function() {
    console.log("Modal shown event - loading livestreams");
    loadUpcomingLivestreams();
  });
}



// Toast notification function
function showToast(message, type) {
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

// Helper function to get cookies
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



























// Updates
// ===============================
// LiveKit Livestreaming Functions
// ===============================

// Function to start a livestream
function startLivestream(livestreamId) {
  if (confirm('Are you ready to start this livestream? Students will be notified.')) {
    // Show loading state
    const button = document.querySelector(`.start-livestream-btn[data-id="${livestreamId}"]`);
    if (button) {
      button.disabled = true;
      button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Starting...';
    }
    
    // Make API request to start the livestream
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
        // Show success message
        showToast("Livestream started successfully", "success");
        
        // Redirect to the livestream room
        window.location.href = `/livestream/${livestreamId}/${data.room_name}/`;
      } else {
        // Re-enable the button
        if (button) {
          button.disabled = false;
          button.innerHTML = '<i class="bi bi-broadcast"></i> Start Now';
        }
        
        // Show error message
        showToast(data.error || "Failed to start livestream", "error");
      }
    })
    .catch(error => {
      console.error('Error starting livestream:', error);
      
      // Re-enable the button
      if (button) {
        button.disabled = false;
        button.innerHTML = '<i class="bi bi-broadcast"></i> Start Now';
      }
      
      // Show error message
      showToast("An error occurred. Please try again.", "error");
    });
  }
}

// Function to join an active livestream (for teachers)
function joinLivestream(livestreamId) {
  // Show loading state
  const button = document.querySelector(`.join-livestream-btn[data-id="${livestreamId}"]`);
  if (button) {
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Joining...';
  }
  
  // Get the livestream document from Firestore
  fetch(`/get-livestream-details/${livestreamId}/`)
    .then(response => response.json())
    .then(data => {
      if (data.success && data.livestream) {
        // Redirect to the livestream room
        window.location.href = `/livestream/${livestreamId}/${data.livestream.room_name}/`;
      } else {
        // Re-enable the button
        if (button) {
          button.disabled = false;
          button.innerHTML = '<i class="bi bi-broadcast"></i> Join Your Stream';
        }
        
        // Show error message
        showToast(data.error || "Failed to join livestream", "error");
      }
    })
    .catch(error => {
      console.error('Error joining livestream:', error);
      
      // Re-enable the button
      if (button) {
        button.disabled = false;
        button.innerHTML = '<i class="bi bi-broadcast"></i> Join Your Stream';
      }
      
      // Show error message
      showToast("An error occurred. Please try again.", "error");
    });
}

// Function to end an active livestream (for teachers)
function endLivestream(livestreamId) {
  if (confirm('Are you sure you want to end this livestream? This will stop the stream for all viewers.')) {
    // Show loading state
    const button = document.querySelector(`.end-livestream-btn[data-id="${livestreamId}"]`);
    if (button) {
      button.disabled = true;
      button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Ending...';
    }
    
    // Make API request to end the livestream
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
        
        // Reload the tabs
        loadLiveLivestreams();
        loadPastLivestreams();
        
        // Also refresh the Streams tab if visible
        if (document.getElementById('streams') && 
            document.getElementById('streams').style.display === 'block') {
          loadStreamsTabLivestreams();
        }
      } else {
        // Re-enable the button
        if (button) {
          button.disabled = false;
          button.innerHTML = '<i class="bi bi-stop-circle"></i> End Stream';
        }
        
        // Show error message
        showToast(data.error || "Failed to end livestream", "error");
      }
    })
    .catch(error => {
      console.error('Error ending livestream:', error);
      
      // Re-enable the button
      if (button) {
        button.disabled = false;
        button.innerHTML = '<i class="bi bi-stop-circle"></i> End Stream';
      }
      
      // Show error message
      showToast("An error occurred. Please try again.", "error");
    });
  }
}

// Function for students to join a livestream
function studentJoinLivestream(livestreamId) {
  // Show loading state
  const button = document.querySelector(`.join-livestream-btn[data-id="${livestreamId}"]`);
  if (button) {
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Joining...';
  }
  
  // Make API request to join the livestream
  fetch('/join-livestream/', {
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
      // Redirect to the livestream room
      window.location.href = `/livestream/${livestreamId}/${data.room_name}/`;
    } else {
      // Re-enable the button
      if (button) {
        button.disabled = false;
        button.innerHTML = '<i class="bi bi-broadcast"></i> Join Livestream';
      }
      
      // Show error message
      showToast(data.error || "Failed to join livestream", "error");
    }
  })
  .catch(error => {
    console.error('Error joining livestream:', error);
    
    // Re-enable the button
    if (button) {
      button.disabled = false;
      button.innerHTML = '<i class="bi bi-broadcast"></i> Join Livestream';
    }
    
    // Show error message
    showToast("An error occurred. Please try again.", "error");
  });
}

// Create a livestream item for students
function createStudentLivestreamItem(livestream) {
  const item = document.createElement('div');
  item.className = 'livestream-card';
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
  const isLive = livestream.status === 'live';
  
  // Create the card content
  item.innerHTML = `
    <div class="livestream-card-content">
      <h5 class="livestream-card-title">${livestream.title || 'Untitled Livestream'}</h5>
      <div class="livestream-card-info">
        <i class="bi bi-person-video3"></i> ${livestream.teacher}
        <br>
        <i class="bi bi-calendar-event"></i> ${formattedDate} at ${formattedTime}
        ${livestream.description ? `<br><small>${livestream.description}</small>` : ''}
      </div>
    </div>
    <span class="livestream-card-status ${isLive ? 'status-live' : isUpcomingSoon ? 'status-soon' : 'status-scheduled'}">
      ${isLive ? 'LIVE NOW' : isUpcomingSoon ? 'Starting Soon' : 'Scheduled'}
    </span>
  `;
  
  // Add click event to open the livestream details modal
  item.addEventListener('click', () => {
    showLivestreamDetails(livestream, isLive);
  });
  
  return item;
}

// Function to show livestream details modal for students
function showLivestreamDetails(livestream, isLive) {
  const modal = document.getElementById('livestreamDetailsModal');
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
  
  // Populate the modal content
  modalContent.innerHTML = `
    <div class="livestream-details-content">
      <div class="livestream-details-header">
        <h4 class="livestream-details-title">${livestream.title || 'Untitled Livestream'}</h4>
        <div class="livestream-details-status ${isLive ? 'status-live' : 'status-scheduled'}">
          ${isLive ? 'LIVE NOW' : 'Scheduled'}
        </div>
        <div class="livestream-details-teacher">
          <i class="bi bi-person-video3"></i> 
          ${livestream.teacher}
        </div>
      </div>
      
      <div class="livestream-details-time">
        <i class="bi bi-calendar-event"></i>
        ${formattedDate} at ${formattedTime}
      </div>
      
      ${livestream.description ? `
        <div class="livestream-details-description">
          <h5 class="livestream-details-description-title">Description</h5>
          <div class="livestream-details-description-content">
            ${livestream.description}
          </div>
        </div>
      ` : ''}
    </div>
  `;
  
  // Update the footer buttons
  if (isLive) {
    modalFooter.innerHTML = `
      <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
      <button type="button" class="btn btn-danger join-livestream-btn" data-id="${livestream.id}">
        <i class="bi bi-broadcast"></i> Join Livestream
      </button>
    `;
    
    // Add click event to the join button
    const joinBtn = modalFooter.querySelector('.join-livestream-btn');
    joinBtn.addEventListener('click', () => {
      studentJoinLivestream(livestream.id);
    });
  } else {
    modalFooter.innerHTML = `
      <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
      <button type="button" class="btn btn-outline-secondary reminder-btn" id="reminderBtn">
        <i class="bi bi-bell"></i> Set Reminder
      </button>
    `;
    
    // Add click event to the reminder button
    const reminderBtn = document.getElementById('reminderBtn');
    if (reminderBtn) {
      reminderBtn.addEventListener('click', function() {
        toggleReminder(this, livestream.id);
      });
      
      // Check if reminder is already set
      checkReminderStatus(reminderBtn, livestream.id);
    }
  }
  
  // Show the modal
  const modalInstance = new bootstrap.Modal(modal);
  modalInstance.show();
}

// Function to check if a reminder is set for a livestream
function checkReminderStatus(button, livestreamId) {
  // Get reminders from localStorage
  const reminders = JSON.parse(localStorage.getItem('livestreamReminders') || '{}');
  
  if (reminders[livestreamId]) {
    button.classList.add('active');
    button.innerHTML = '<i class="bi bi-bell-fill"></i> Reminder Set';
  } else {
    button.classList.remove('active');
    button.innerHTML = '<i class="bi bi-bell"></i> Set Reminder';
  }
}

// Function to toggle reminder for a livestream
function toggleReminder(button, livestreamId) {
  // Get reminders from localStorage
  const reminders = JSON.parse(localStorage.getItem('livestreamReminders') || '{}');
  
  if (reminders[livestreamId]) {
    // Remove reminder
    delete reminders[livestreamId];
    button.classList.remove('active');
    button.innerHTML = '<i class="bi bi-bell"></i> Set Reminder';
    showToast('Reminder removed', 'info');
  } else {
    // Add reminder
    reminders[livestreamId] = true;
    button.classList.add('active');
    button.innerHTML = '<i class="bi bi-bell-fill"></i> Reminder Set';
    showToast('Reminder set for this livestream', 'success');
  }
  
  // Save to localStorage
  localStorage.setItem('livestreamReminders', JSON.stringify(reminders));
}

// Function to load upcoming livestreams for students
function loadUpcomingLivestreamsForStudents(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) {
    console.error(`Container not found: ${containerSelector}`);
    return;
  }
  
  const roomIdElement = document.getElementById('room-id-data');
  if (!roomIdElement) {
    console.error("Room ID data element not found");
    return;
  }
  
  const roomId = roomIdElement.dataset.roomId;
  if (!roomId) {
    console.error("Room ID is empty");
    return;
  }
  
  // Show loading spinner
  container.innerHTML = '<div class="loading-spinner">Loading livestreams...</div>';
  
  // Make API request
  fetch(`/get-upcoming-livestreams/?room_id=${roomId}`)
    .then(response => response.json())
    .then(data => {
      container.innerHTML = '';
      
      if (data.success && data.livestreams && data.livestreams.length > 0) {
        // Sort livestreams by date (live first, then upcoming)
        const sortedLivestreams = data.livestreams.sort((a, b) => {
          // Put live streams first
          if (a.status === 'live' && b.status !== 'live') return -1;
          if (a.status !== 'live' && b.status === 'live') return 1;
          
          // Then sort by scheduled time
          return new Date(a.scheduled_time) - new Date(b.scheduled_time);
        });
        
        // Create elements for each livestream
        sortedLivestreams.forEach(livestream => {
          const livestreamEl = createStudentLivestreamItem(livestream);
          container.appendChild(livestreamEl);
        });
      } else {
        // No upcoming livestreams
        container.innerHTML = '<div class="no-livestreams">No scheduled livestreams available.</div>';
      }
    })
    .catch(error => {
      console.error('Error fetching upcoming livestreams:', error);
      container.innerHTML = '<div class="error-message">Error loading livestreams. Please try again.</div>';
    });
}

// Check for new livestreams
function checkForNewLivestreams() {
  const roomIdElement = document.getElementById('room-id-data');
  if (!roomIdElement) return;
  
  const roomId = roomIdElement.dataset.roomId;
  if (!roomId) return;
  
  // Get the last check time from localStorage
  const lastCheck = localStorage.getItem(`lastLivestreamCheck_${roomId}`) || '0';
  
  // Make API request
  fetch(`/check-new-livestreams-view/?room_id=${roomId}&last_check=${lastCheck}`)
    .then(response => response.json())
    .then(data => {
      if (data.success && data.new_count > 0) {
        // Show notification
        const badge = document.getElementById('livestreams-notification-badge');
        if (badge) {
          badge.textContent = data.new_count;
          badge.style.display = 'flex';
        }
        
        // Update last check time
        localStorage.setItem(`lastLivestreamCheck_${roomId}`, Date.now().toString());
      }
    })
    .catch(error => {
      console.error('Error checking for new livestreams:', error);
    });
}

// Initialize student livestream functionality if on student page
document.addEventListener('DOMContentLoaded', function() {
  // Check if we're on the student view with the livestreams modal
  const upcomingLivestreamsModal = document.getElementById('upcomingLivestreamsModal');
  if (upcomingLivestreamsModal) {
    // Load livestreams when the modal is shown
    upcomingLivestreamsModal.addEventListener('shown.bs.modal', function() {
      loadUpcomingLivestreamsForStudents('#modal-upcoming-livestreams');
    });
    
    // Check for new livestreams periodically
    setInterval(checkForNewLivestreams, 60000); // Every minute
  }
});