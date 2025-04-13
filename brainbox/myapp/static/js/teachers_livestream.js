/**
 * Essential Teachers Livestream JS
 * Handles LiveKit streaming for the teacher interface
 */

document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const goLiveModal = document.getElementById('goLiveModal');
  const startLivestreamBtn = document.getElementById('startLivestreamBtn');
  const liveTitleInput = document.getElementById('liveTitleInput');
  const notifyStudentsLive = document.getElementById('notifyStudentsLive');
  const cameraSelect = document.getElementById('cameraSelect');
  const micSelect = document.getElementById('micSelect');
  const localPreview = document.getElementById('localPreview');
  const toggleCameraBtn = document.getElementById('toggleCameraBtn');
  const toggleMicBtn = document.getElementById('toggleMicBtn');
  const liveErrorAlert = document.getElementById('liveErrorAlert');
  
  // Room data
  const roomId = document.getElementById('room-id-data')?.dataset?.roomId;
  const teacherName = document.getElementById('teacher-name')?.dataset?.teacherName;
  
  // Media state
  let mediaStream = null;
  let cameraEnabled = true;
  let micEnabled = true;
  
  // Initialize when the modal is shown
  if (goLiveModal) {
    goLiveModal.addEventListener('show.bs.modal', function() {
      // Get available cameras and microphones
      getMediaDevices();
      
      // Initialize video preview
      startVideoPreview();
    });
    
    // Clean up when modal is hidden
    goLiveModal.addEventListener('hidden.bs.modal', function() {
      stopVideoPreview();
    });
  }
  
  // Button event listeners
  if (toggleCameraBtn) {
    toggleCameraBtn.addEventListener('click', toggleCamera);
  }
  
  if (toggleMicBtn) {
    toggleMicBtn.addEventListener('click', toggleMic);
  }
  
  if (startLivestreamBtn) {
    startLivestreamBtn.addEventListener('click', startLivestream);
  }
  
  // Check for active livestream on page load
  document.addEventListener('DOMContentLoaded', function() {
    checkForActiveLivestream();
  });
  
  // Fetch available media devices
  async function getMediaDevices() {
    try {
      // Clear previous options
      cameraSelect.innerHTML = '<option value="">Select camera...</option>';
      micSelect.innerHTML = '<option value="">Select microphone...</option>';
      
      // Request permissions
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      
      // Get devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      // Add camera options
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      videoDevices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `Camera ${cameraSelect.length}`;
        cameraSelect.appendChild(option);
      });
      
      // Add microphone options
      const audioDevices = devices.filter(device => device.kind === 'audioinput');
      audioDevices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `Microphone ${micSelect.length}`;
        micSelect.appendChild(option);
      });
      
      // Select first devices by default
      if (videoDevices.length > 0) {
        cameraSelect.value = videoDevices[0].deviceId;
      }
      
      if (audioDevices.length > 0) {
        micSelect.value = audioDevices[0].deviceId;
      }
      
      hideError();
    } catch (error) {
      console.error('Error getting media devices:', error);
      showError('Could not access media devices. Please ensure you have granted camera and microphone permissions.');
    }
  }
  
  // Start video preview with selected devices
  async function startVideoPreview() {
    try {
      // Stop any existing preview
      stopVideoPreview();
      
      // Get selected devices
      const videoDeviceId = cameraSelect.value;
      const audioDeviceId = micSelect.value;
      
      // Configure constraints
      const constraints = {
        audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
        video: videoDeviceId ? { 
          deviceId: { exact: videoDeviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } : true
      };
      
      // Get media stream
      mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Set up video preview
      localPreview.srcObject = mediaStream;
      
      // Update UI
      updateMediaControls();
      
      // Hide errors
      hideError();
      document.getElementById('camera-off-message').style.display = 'none';
    } catch (error) {
      console.error('Error starting video preview:', error);
      showError('Could not start camera preview. Please check your permissions and try again.');
      document.getElementById('camera-off-message').style.display = 'block';
    }
  }
  
  // Stop video preview
  function stopVideoPreview() {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }
    
    if (localPreview) {
      localPreview.srcObject = null;
    }
  }
  
  // Toggle camera on/off
  function toggleCamera() {
    if (!mediaStream) return;
    
    const videoTracks = mediaStream.getVideoTracks();
    if (videoTracks.length === 0) return;
    
    cameraEnabled = !cameraEnabled;
    
    videoTracks.forEach(track => {
      track.enabled = cameraEnabled;
    });
    
    // Show/hide camera off message
    document.getElementById('camera-off-message').style.display = cameraEnabled ? 'none' : 'block';
    
    // Update button UI
    updateMediaControls();
  }
  
  // Toggle microphone on/off
  function toggleMic() {
    if (!mediaStream) return;
    
    const audioTracks = mediaStream.getAudioTracks();
    if (audioTracks.length === 0) return;
    
    micEnabled = !micEnabled;
    
    audioTracks.forEach(track => {
      track.enabled = micEnabled;
    });
    
    // Update button UI
    updateMediaControls();
  }
  
  // Update media control button appearance
  function updateMediaControls() {
    if (toggleCameraBtn) {
      toggleCameraBtn.innerHTML = cameraEnabled ? 
        '<i class="bi bi-camera-video"></i> Camera On' : 
        '<i class="bi bi-camera-video-off"></i> Camera Off';
      
      toggleCameraBtn.classList.toggle('btn-outline-secondary', cameraEnabled);
      toggleCameraBtn.classList.toggle('btn-outline-danger', !cameraEnabled);
    }
    
    if (toggleMicBtn) {
      toggleMicBtn.innerHTML = micEnabled ? 
        '<i class="bi bi-mic"></i> Mic On' : 
        '<i class="bi bi-mic-mute"></i> Mic Off';
      
      toggleMicBtn.classList.toggle('btn-outline-secondary', micEnabled);
      toggleMicBtn.classList.toggle('btn-outline-danger', !micEnabled);
    }
  }
  
  // Start the livestream
  // In teachers_livestream.js - update the startLivestream function

// In static/js/teachers_livestream.js
// Update the startLivestream function

async function startLivestream() {
  if (!mediaStream) {
    showError('Media stream not available. Please check your camera and microphone.');
    return;
  }
  
  // Get title from input
  const liveTitle = liveTitleInput.value.trim();
  if (!liveTitle) {
    showError('Please enter a title for your livestream.');
    return;
  }
  
  // Get notification setting
  const notifyStudents = notifyStudentsLive.checked;
  
  try {
    // Disable button and show loading state
    startLivestreamBtn.disabled = true;
    startLivestreamBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Starting...';
    
    // Now use the direct URL generator endpoint instead
    const response = await fetch('/livekitapi/get-livekit-url/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken')
      },
      body: JSON.stringify({
        room_name: `live-${roomId}`,
        user_name: teacherName,
        description: liveTitle
      })
    });
    
    // Check for success response
    if (!response.ok) {
      const text = await response.text();
      console.error('Server error:', text);
      throw new Error(`Server error: ${response.status}`);
    }
    
    const roomData = await response.json();
    
    if (!roomData.success) {
      throw new Error(roomData.error || 'Failed to create livestream room');
    }
    
    console.log('LiveKit direct URL created:', roomData);
    
    // Hide the modal
    const modal = bootstrap.Modal.getInstance(goLiveModal);
    modal.hide();
    
    // CHANGE: Instead of opening in new window, redirect to the teacher livestream view
    // The correct URL structure for teacher livestream
    const teacherLivestreamUrl = `/livekit_folder/teacher-livestream/${roomId}/`;
    window.location.href = teacherLivestreamUrl;
    
    // Store livestream info in Firebase in the background
    uploadStreamInfoToFirebase(roomData.room.slug, liveTitle, roomId);
    
  } catch (error) {
    console.error('Error starting livestream:', error);
    showError(error.message || 'Failed to start livestream. Please try again.');
    
    // Reset button state
    startLivestreamBtn.disabled = false;
    startLivestreamBtn.innerHTML = '<i class="bi bi-broadcast"></i> Start Livestream';
  }
}
  

  // New function to upload stream info to Firebase
  // In teachers_livestream.js
// Update the uploadStreamInfoToFirebase function

async function uploadStreamInfoToFirebase(streamSlug, title, roomId) {
  try {
    // Get current timestamp
    const currentTime = new Date().toISOString();
    
    // Create livestream data object
    const livestreamData = {
      slug: streamSlug,
      title: title,
      room_id: roomId,
      teacher: teacherName,
      created_at: currentTime,
      status: 'active',
      viewers: 0
    };
    
    // Send data to our backend to store in Firebase - use the direct endpoint
    const response = await fetch('/store-livestream-direct/', {  // Note the changed URL
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken')
      },
      body: JSON.stringify(livestreamData)
    });
    
    const data = await response.json();
    if (data.success) {
      console.log('Livestream info stored in Firebase successfully');
    } else {
      console.error('Error storing livestream in Firebase:', data.error);
    }
  } catch (error) {
    console.error('Error uploading to Firebase:', error);
  }
}
  
  // Function to show a "Currently Live" indicator
  function showLiveIndicator(title, slug) {
    // Remove any existing indicator
    const existingIndicator = document.querySelector('.live-stream-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }
    
    // Create the indicator
    const indicator = document.createElement('div');
    indicator.className = 'live-stream-indicator';
    indicator.innerHTML = `
      <div class="live-status">
        <span class="live-dot"></span>
        <span class="live-text">LIVE NOW: ${title}</span>
      </div>
      <div class="live-actions">
        <button class="live-view-btn" onclick="window.open('/livekitapi/room/${slug}/', '_blank')">
          <i class="bi bi-display"></i> View
        </button>
        <button class="live-end-btn" onclick="endLivestream('${slug}')">
          <i class="bi bi-x-circle"></i> End
        </button>
      </div>
    `;
    
    // Add styles for the indicator
    const style = document.createElement('style');
    style.textContent = `
      .live-stream-indicator {
        position: fixed;
        top: 70px;
        right: 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background-color: rgba(33, 37, 41, 0.9);
        color: white;
        padding: 10px 15px;
        border-radius: 8px;
        z-index: 1000;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        min-width: 300px;
      }
      
      .live-status {
        display: flex;
        align-items: center;
      }
      
      .live-dot {
        width: 12px;
        height: 12px;
        background-color: #dc3545;
        border-radius: 50%;
        margin-right: 8px;
        animation: pulse 1.5s infinite;
      }
      
      .live-text {
        font-weight: 600;
      }
      
      .live-actions {
        display: flex;
        gap: 8px;
      }
      
      .live-view-btn, .live-end-btn {
        border: none;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 0.875rem;
        cursor: pointer;
      }
      
      .live-view-btn {
        background-color: #007bff;
        color: white;
      }
      
      .live-end-btn {
        background-color: #dc3545;
        color: white;
      }
      
      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(indicator);
  }
  
  // End a livestream
  async function endLivestream(slug) {
    if (!confirm('Are you sure you want to end this livestream?')) {
      return;
    }
    
    try {
      const response = await fetch(`/livekitapi/room/${slug}/stop_recording`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken')
        }
      });
      
      const data = await response.json();
      
      if (data.ok) {
        // Update Firebase status
        await updateFirebaseStreamStatus(slug, 'ended');
        
        // Remove the live indicator
        const indicator = document.querySelector('.live-stream-indicator');
        if (indicator) {
          indicator.remove();
        }
        
        // Clear session storage
        sessionStorage.removeItem('current_livestream_slug');
        sessionStorage.removeItem('current_livestream_title');
        
        showToast('Livestream ended successfully', 'success');
      } else {
        showToast(data.error || 'Failed to end livestream', 'error');
      }
    } catch (error) {
      console.error('Error ending livestream:', error);
      showToast('Error ending livestream. Please try again.', 'error');
    }
  }
  
  // New function to update Firebase stream status
  // Update this function in teachers_livestream.js
async function updateFirebaseStreamStatus(slug, status) {
  try {
    const response = await fetch('/update-livestream-status-direct/', {  // Note the changed URL
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken')
      },
      body: JSON.stringify({
        slug: slug,
        status: status
      })
    });
    
    const data = await response.json();
    if (!data.success) {
      console.error('Error updating Firebase status:', data.error);
    }
    return data.success;
  } catch (error) {
    console.error('Error updating Firebase:', error);
    return false;
  }
}
  
  // Check for active livestream on page load
  function checkForActiveLivestream() {
    const livestreamSlug = sessionStorage.getItem('current_livestream_slug');
    const livestreamTitle = sessionStorage.getItem('current_livestream_title');
    
    if (livestreamSlug && livestreamTitle) {
      // Check if the stream is still active in Firebase
      fetch(`/check-livestream-status/?slug=${livestreamSlug}`)
        .then(response => response.json())
        .then(data => {
          if (data.success && data.status === 'active') {
            // Show the live indicator
            showLiveIndicator(livestreamTitle, livestreamSlug);
          } else {
            // Clear session storage if stream is no longer active
            sessionStorage.removeItem('current_livestream_slug');
            sessionStorage.removeItem('current_livestream_title');
          }
        })
        .catch(error => {
          console.error('Error checking livestream status:', error);
        });
    }
  }
  
  // Show error message
  function showError(message) {
    if (liveErrorAlert) {
      liveErrorAlert.textContent = message;
      liveErrorAlert.style.display = 'block';
    }
  }
  
  // Hide error message
  function hideError() {
    if (liveErrorAlert) {
      liveErrorAlert.style.display = 'none';
    }
  }
  
  // Show toast notification
  function showToast(message, type) {
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
  
  // Helper function to get cookies (for CSRF token)
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

// Make endLivestream globally accessible
window.endLivestream = async function(slug) {
  if (!confirm('Are you sure you want to end this livestream?')) {
    return;
  }
  
  try {
    // First update Firebase
    await updateFirebaseStreamStatus(slug, 'ended');
    
    // Then stop the recording in LiveKit
    const response = await fetch(`/livekitapi/room/${slug}/stop_recording`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken')
      }
    });
    
    const data = await response.json();
    
    if (data.ok) {
      // Remove the live indicator
      const indicator = document.querySelector('.live-stream-indicator');
      if (indicator) {
        indicator.remove();
      }
      
      // Clear session storage
      sessionStorage.removeItem('current_livestream_slug');
      sessionStorage.removeItem('current_livestream_title');
      
      // Show toast notification
      showToast('Livestream ended successfully', 'success');
    } else {
      showToast(data.error || 'Failed to end livestream', 'error');
    }
  } catch (error) {
    console.error('Error ending livestream:', error);
    showToast('Error ending livestream. Please try again.', 'error');
  }
};

// Global function to update Firebase stream status
async function updateFirebaseStreamStatus(slug, status) {
  try {
    const response = await fetch('/update-livestream-status/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken')
      },
      body: JSON.stringify({
        slug: slug,
        status: status
      })
    });
    
    const data = await response.json();
    if (!data.success) {
      console.error('Error updating Firebase status:', data.error);
    }
    return data.success;
  } catch (error) {
    console.error('Error updating Firebase:', error);
    return false;
  }
}

// Global helper function to get cookies
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

// Global helper function to show toast notifications
function showToast(message, type) {
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