// Load recordings when the streams tab is clicked
document.getElementById('streamsBtn').addEventListener('click', function() {
  loadStreamRecordings();
});

 

// Function to load stream recordings from the server
function loadStreamRecordings() {
  const recordingsListContainer = document.getElementById('recordings-list-container');
  const recordingsList = document.getElementById('recordings-list');
  const loadingSpinner = document.getElementById('recordings-loading');
  const noRecordingsMessage = document.getElementById('no-recordings');
  
  // Show loading spinner
  if (loadingSpinner) loadingSpinner.style.display = 'block';
  if (noRecordingsMessage) noRecordingsMessage.style.display = 'none';
  if (recordingsList) recordingsList.innerHTML = '';
  
  // Get the room ID
  const roomId = document.getElementById('room-id-data').dataset.roomId;
  
  // Fetch recordings from the server
  fetch(`/get-stream-recordings/?room_id=${roomId}`)
    .then(response => response.json())
    .then(data => {
      // Hide loading spinner
      if (loadingSpinner) loadingSpinner.style.display = 'none';
      
      if (data.success && data.recordings && data.recordings.length > 0) {
        // Display the recordings
        data.recordings.forEach(recording => {
          const recordingItem = createRecordingItem(recording);
          recordingsList.appendChild(recordingItem);
        });
      } else {
        // Show no recordings message
        if (noRecordingsMessage) noRecordingsMessage.style.display = 'block';
      }
    })
    .catch(error => {
      console.error('Error loading recordings:', error);
      // Hide loading spinner
      if (loadingSpinner) loadingSpinner.style.display = 'none';
      // Show error message
      if (noRecordingsMessage) {
        noRecordingsMessage.style.display = 'block';
        noRecordingsMessage.innerHTML = '<p>Error loading recordings. Please try again.</p>';
      }
    });
}

// Function to create a recording item
function createRecordingItem(recording) {
  const recordingItem = document.createElement('li');
  recordingItem.className = 'recording-item';
  
  // Format date
  const recordingDate = new Date(recording.created_at.seconds * 1000);
  const formattedDate = recordingDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  
  // Format duration
  const durationMinutes = Math.floor(recording.duration / 60);
  const durationSeconds = recording.duration % 60;
  const formattedDuration = `${durationMinutes}:${durationSeconds < 10 ? '0' : ''}${durationSeconds}`;
  
  // Create the item content
  recordingItem.innerHTML = `
    <div class="recording-details">
      <div class="recording-title">${recording.title}</div>
      <div class="recording-meta">
        <span><i class="bi bi-calendar"></i> ${formattedDate}</span>
        <span><i class="bi bi-clock"></i> ${formattedDuration}</span>
        <span><i class="bi bi-people"></i> ${recording.viewer_count} viewers</span>
      </div>
    </div>
    <div class="recording-actions">
      <button class="btn btn-sm btn-primary watch-recording-btn" data-recording-id="${recording.id}">
        <i class="bi bi-play-circle"></i> Watch
      </button>
    </div>
  `;
  
  // Add click event to the watch button
  const watchButton = recordingItem.querySelector('.watch-recording-btn');
  watchButton.addEventListener('click', function() {
    openRecordingPlayer(recording);
  });
  
  return recordingItem;
}

// Function to open the recording player
function openRecordingPlayer(recording) {
  // Create the player modal if it doesn't exist
  let playerModal = document.getElementById('recordingPlayerModal');
  if (!playerModal) {
    playerModal = document.createElement('div');
    playerModal.id = 'recordingPlayerModal';
    playerModal.className = 'modal fade';
    playerModal.setAttribute('tabindex', '-1');
    playerModal.setAttribute('aria-labelledby', 'recordingPlayerModalLabel');
    playerModal.setAttribute('aria-hidden', 'true');
    
    playerModal.innerHTML = `
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="recordingPlayerModalLabel">Stream Recording</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div id="recording-player-container">
              <div id="recording-player"></div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(playerModal);
  }
  
  // Update the modal title with the recording title
  const modalTitle = playerModal.querySelector('.modal-title');
  modalTitle.textContent = recording.title;
  
  // Initialize the player with the recording URL
  const playerContainer = playerModal.querySelector('#recording-player');
  playerContainer.innerHTML = '';
  
  // Check if recording files exist
  if (recording.recording_files && recording.recording_files.length > 0) {
    const recordingUrl = recording.recording_files[0].url;
    
    // Create video element
    const videoElement = document.createElement('video');
    videoElement.controls = true;
    videoElement.autoplay = false;
    videoElement.className = 'video-js vjs-default-skin';
    videoElement.style.width = '100%';
    videoElement.style.height = 'auto';
    
    // Add source
    const sourceElement = document.createElement('source');
    sourceElement.src = recordingUrl;
    sourceElement.type = 'application/x-mpegURL'; // For m3u8 files
    
    videoElement.appendChild(sourceElement);
    playerContainer.appendChild(videoElement);
    
    // If using VideoJS (optional enhancement)
    if (window.videojs) {
      videojs(videoElement);
    }
  } else {
    playerContainer.innerHTML = '<div class="alert alert-warning">Recording file not available</div>';
  }
  
  // Show the modal
  const bsModal = new bootstrap.Modal(playerModal);
  bsModal.show();
}