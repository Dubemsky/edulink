// Livestream functionality for teachers
document.addEventListener('DOMContentLoaded', function() {
    // Constants
    const ROOM_ID = document.getElementById("room-id-data")?.dataset?.roomId;
    const TEACHER_NAME = document.getElementById('teacher-name')?.dataset?.teacherName;
    
    if (!ROOM_ID || !TEACHER_NAME) {
      console.error('Missing required room or teacher information');
      return;
    }
    
    // DOM Elements
    const goLiveModal = document.getElementById('goLiveModal');
    const cameraSelect = document.getElementById('cameraSelect');
    const micSelect = document.getElementById('micSelect');
    const localPreview = document.getElementById('localPreview');
    const toggleCameraBtn = document.getElementById('toggleCameraBtn');
    const toggleMicBtn = document.getElementById('toggleMicBtn');
    const startLivestreamBtn = document.getElementById('startLivestreamBtn');
    const liveErrorAlert = document.getElementById('liveErrorAlert');
    const cameraOffMessage = document.getElementById('camera-off-message');
    
    // Variables to store media state
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
    
    // Fetch available media devices
    async function getMediaDevices() {
      try {
        // Clear previous options
        cameraSelect.innerHTML = '<option value="">Select camera...</option>';
        micSelect.innerHTML = '<option value="">Select microphone...</option>';
        
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
        
        // Update UI to reflect initial state
        updateMediaControls();
        
        // Hide error if previously shown
        hideError();
      } catch (error) {
        console.error('Error starting video preview:', error);
        showError('Could not start camera preview. Please check your permissions and try again.');
        
        // Show camera off state
        cameraOffMessage.style.display = 'block';
      }
    }
    
    // Stop video preview
    function stopVideoPreview() {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
      }
      
      localPreview.srcObject = null;
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
      cameraOffMessage.style.display = cameraEnabled ? 'none' : 'block';
      
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
      // Update camera button
      if (toggleCameraBtn) {
        toggleCameraBtn.innerHTML = cameraEnabled ? 
          '<i class="bi bi-camera-video"></i> Camera On' : 
          '<i class="bi bi-camera-video-off"></i> Camera Off';
        
        toggleCameraBtn.classList.toggle('btn-outline-secondary', cameraEnabled);
        toggleCameraBtn.classList.toggle('btn-outline-danger', !cameraEnabled);
      }
      
      // Update mic button
      if (toggleMicBtn) {
        toggleMicBtn.innerHTML = micEnabled ? 
          '<i class="bi bi-mic"></i> Mic On' : 
          '<i class="bi bi-mic-mute"></i> Mic Off';
        
        toggleMicBtn.classList.toggle('btn-outline-secondary', micEnabled);
        toggleMicBtn.classList.toggle('btn-outline-danger', !micEnabled);
      }
    }
    
    // Start the livestream
    async function startLivestream() {
      if (!mediaStream) {
        showError('Media stream not available. Please check your camera and microphone.');
        return;
      }
      
      // Get title from input
      const liveTitle = document.getElementById('liveTitleInput').value.trim();
      if (!liveTitle) {
        showError('Please enter a title for your livestream.');
        return;
      }
      
      // Get notification setting
      const notifyStudents = document.getElementById('notifyStudentsLive').checked;
      
      try {
        // Disable button and show loading state
        startLivestreamBtn.disabled = true;
        startLivestreamBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Starting...';
        
        // Step 1: Create a LiveKit room
        const roomResponse = await fetch('/livekit/create-room/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
          },
          body: JSON.stringify({
            room_name: `${ROOM_ID}-live`,
            empty_timeout: 300, // 5 minutes
            max_participants: 100
          })
        });
        
        const roomData = await roomResponse.json();
        
        if (!roomData.success) {
          throw new Error(roomData.error || 'Failed to create livestream room');
        }
        
        // Step 2: Get token to join the room
        const tokenResponse = await fetch('/livekit/get-token/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
          },
          body: JSON.stringify({
            room_name: roomData.room.name,
            participant_name: TEACHER_NAME,
            participant_identity: `teacher-${TEACHER_NAME}`,
            is_teacher: true
          })
        });
        
        const tokenData = await tokenResponse.json();
        
        if (!tokenData.success) {
          throw new Error(tokenData.error || 'Failed to generate access token');
        }
        
        // Step 3: Create a livestream record in the database
        const livestreamResponse = await fetch('/schedule-livestream/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
          },
          body: JSON.stringify({
            title: liveTitle,
            room_id: ROOM_ID,
            teacher_name: TEACHER_NAME,
            notify_students: notifyStudents,
            scheduled_date: new Date().toISOString().split('T')[0],
            scheduled_time: new Date().toTimeString().slice(0, 5),
            duration: 60,
            is_live: true,
            livekit_room: roomData.room.name,
            status: 'live'
          })
        });
        
        const livestreamData = await livestreamResponse.json();
        
        if (!livestreamData.success) {
          throw new Error(livestreamData.error || 'Failed to create livestream record');
        }
        
        // Step 4: Open the livestream interface in a new window
        // Ideally we'd use LiveKit client library to create a new interface,
        // but for this implementation we'll just store the token and room info
        sessionStorage.setItem('livekit_token', tokenData.token);
        sessionStorage.setItem('livekit_room', roomData.room.name);
        sessionStorage.setItem('livestream_id', livestreamData.livestream_id);
        
        // Hide the modal
        const modal = bootstrap.Modal.getInstance(goLiveModal);
        modal.hide();
        
        // Open livestream interface
        openLivestreamInterface(tokenData.token, roomData.room.name, livestreamData.livestream_id);
        
      } catch (error) {
        console.error('Error starting livestream:', error);
        showError(error.message || 'Failed to start livestream. Please try again.');
        
        // Reset button state
        startLivestreamBtn.disabled = false;
        startLivestreamBtn.innerHTML = '<i class="bi bi-broadcast"></i> Start Livestream';
      }
    }
    
    // Open livestream interface (this would be replaced with actual LiveKit integration)
    function openLivestreamInterface(token, room, livestreamId) {
      // For now, just show a notification that livestream is starting
      const toastHTML = `
        <div class="toast-container position-fixed bottom-0 end-0 p-3">
          <div class="toast" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header bg-success text-white">
              <i class="bi bi-broadcast me-2"></i>
              <strong class="me-auto">Livestream Started</strong>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
              Your livestream has started! Students can now join and view your broadcast.
              <div class="mt-2">
                <button class="btn btn-sm btn-outline-danger end-livestream-btn">End Livestream</button>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Add toast to document
      const toastContainer = document.createElement('div');
      toastContainer.innerHTML = toastHTML;
      document.body.appendChild(toastContainer.firstChild);
      
      // Initialize and show the toast
      const toastElement = document.querySelector('.toast');
      const toast = new bootstrap.Toast(toastElement, { autohide: false });
      toast.show();
      
      // Add event listener to end livestream button
      document.querySelector('.end-livestream-btn').addEventListener('click', function() {
        endLivestream(livestreamId, room);
        toast.hide();
      });
      
      // In a full implementation, we would connect to LiveKit here with the token
      console.log('Livestream started with token:', token);
      console.log('Room name:', room);
      console.log('Livestream ID:', livestreamId);
    }
    
    // End the livestream
    async function endLivestream(livestreamId, roomName) {
      try {
        // Call API to cancel the livestream
        const response = await fetch('/cancel-livestream/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
          },
          body: JSON.stringify({
            livestream_id: livestreamId
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          showToast('Livestream ended successfully', 'success');
        } else {
          showToast(data.error || 'Failed to end livestream', 'error');
        }
        
        // Clear session storage
        sessionStorage.removeItem('livekit_token');
        sessionStorage.removeItem('livekit_room');
        sessionStorage.removeItem('livestream_id');
        
      } catch (error) {
        console.error('Error ending livestream:', error);
        showToast('Network error while ending livestream', 'error');
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
    
    // Event listeners for media controls
    if (toggleCameraBtn) {
      toggleCameraBtn.addEventListener('click', toggleCamera);
    }
    
    if (toggleMicBtn) {
      toggleMicBtn.addEventListener('click', toggleMic);
    }
    
    // Event listener for device selection changes
    if (cameraSelect) {
      cameraSelect.addEventListener('change', startVideoPreview);
    }
    
    if (micSelect) {
      micSelect.addEventListener('change', startVideoPreview);
    }
    
    // Event listener for start livestream button
    if (startLivestreamBtn) {
      startLivestreamBtn.addEventListener('click', startLivestream);
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
    
    // Helper function to show toast notification
    function showToast(message, type = 'info') {
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
  });