// teacher_livestream.js - Complete implementation for teacher livestreaming



// Add this to your teachers_livestream.js or create a new file

document.addEventListener('DOMContentLoaded', function() {
  // Get the GO LIVE button
  const startLivestreamBtn = document.getElementById('startLivestreamBtn');
  
  if (startLivestreamBtn) {
      startLivestreamBtn.addEventListener('click', function() {
          // Get form data
          const liveTitleInput = document.getElementById('liveTitleInput');
          const title = liveTitleInput.value.trim();
          const hubName = "{{ hub }}"; // This would be from your template context
          
          if (!title) {
              alert('Please enter a title for your livestream');
              return;
          }
          
          // Disable button to prevent multiple clicks
          startLivestreamBtn.disabled = true;
          startLivestreamBtn.innerHTML = '<i class="bi bi-hourglass"></i> Starting...';
          
          // Send request to start livestream
          fetch('/start-teacher-livestream/', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'X-CSRFToken': getCookie('csrftoken')
              },
              body: JSON.stringify({
                  hub_name: hubName,
                  title: title,
                  notify_students: document.getElementById('notifyStudentsLive').checked
              })
          })
          .then(response => response.json())
          .then(data => {
              if (data.success) {
                  // Store room info in sessionStorage
                  sessionStorage.setItem('liveRoomId', data.room.room_id);
                  sessionStorage.setItem('liveRoomName', data.room.name);
                  
                  // Redirect to the livestream room or open in a new window
                  window.open(data.room.url, '_blank');
                  
                  // Update UI to show we're live
                  document.getElementById('goLiveModal').classList.remove('show');
                  // Add a "currently live" indicator to the page
                  const liveIndicator = document.createElement('div');
                  liveIndicator.className = 'live-indicator';
                  liveIndicator.innerHTML = '<i class="bi bi-broadcast"></i> LIVE NOW';
                  document.querySelector('.page-title').appendChild(liveIndicator);
              } else {
                  // Show error
                  const errorAlert = document.getElementById('liveErrorAlert');
                  errorAlert.textContent = data.error || 'Failed to start livestream';
                  errorAlert.style.display = 'block';
              }
              
              // Re-enable button
              startLivestreamBtn.disabled = false;
              startLivestreamBtn.innerHTML = '<i class="bi bi-broadcast"></i> Start Livestream';
          })
          .catch(error => {
              console.error('Error starting livestream:', error);
              // Re-enable button
              startLivestreamBtn.disabled = false;
              startLivestreamBtn.innerHTML = '<i class="bi bi-broadcast"></i> Start Livestream';
              
              // Show error
              const errorAlert = document.getElementById('liveErrorAlert');
              errorAlert.textContent = 'Network error, please try again';
              errorAlert.style.display = 'block';
          });
      });
  }
  
  // Helper function to get CSRF token from cookies
  function getCookie(name) {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop().split(';').shift();
  }
});

// Add this to the above JavaScript file

// Function to end livestream
function endLivestream() {
  const roomId = sessionStorage.getItem('liveRoomId');
  
  if (!roomId) {
      console.error('No active livestream found');
      return;
  }
  
  if (!confirm('Are you sure you want to end this livestream?')) {
      return;
  }
  
  fetch('/end-teacher-livestream/', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken')
      },
      body: JSON.stringify({
          room_id: roomId
      })
  })
  .then(response => response.json())
  .then(data => {
      if (data.success) {
          // Clear the session storage
          sessionStorage.removeItem('liveRoomId');
          sessionStorage.removeItem('liveRoomName');
          
          // Update UI
          const liveIndicator = document.querySelector('.live-indicator');
          if (liveIndicator) {
              liveIndicator.remove();
          }
          
          // Show ended message
          alert('Livestream ended successfully');
      } else {
          alert('Failed to end livestream: ' + (data.error || 'Unknown error'));
      }
  })
  .catch(error => {
      console.error('Error ending livestream:', error);
      alert('Network error while ending livestream');
  });
}

// Check if there's an active livestream on page load
document.addEventListener('DOMContentLoaded', function() {
  const roomId = sessionStorage.getItem('liveRoomId');
  
  if (roomId) {
      // Add a "currently live" indicator to the page
      const liveIndicator = document.createElement('div');
      liveIndicator.className = 'live-indicator';
      liveIndicator.innerHTML = '<i class="bi bi-broadcast"></i> LIVE NOW <button id="endLiveBtn" class="btn btn-sm btn-danger ml-2">End</button>';
      document.querySelector('.page-title').appendChild(liveIndicator);
      
      // Add event listener to end button
      document.getElementById('endLiveBtn').addEventListener('click', endLivestream);
  }
});







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
    
    // LiveKit SDK globals
    let livekitRoom;
    let localParticipant;
    let localTracks = {
      audio: null,
      video: null,
      screenShare: null
    };
    
    // Variables to store media state
    let mediaStream = null;
    let cameraEnabled = true;
    let micEnabled = true;
    let isLivestreaming = false;
    
    // Load the LiveKit SDK if not already loaded
    function loadLivekitSDK() {
      return new Promise((resolve, reject) => {
        if (window.LivekitClient) {
          resolve(window.LivekitClient);
          return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/livekit-client/dist/livekit-client.umd.js';
        script.async = true;
        script.onload = () => resolve(window.LivekitClient);
        script.onerror = () => reject(new Error('Failed to load LiveKit SDK'));
        document.head.appendChild(script);
      });
    }
    
    // Initialize when the modal is shown
    if (goLiveModal) {
      goLiveModal.addEventListener('show.bs.modal', function() {
        // Load the LiveKit SDK
        loadLivekitSDK()
          .then(() => {
            console.log('LiveKit SDK loaded successfully');
            // Get available cameras and microphones
            getMediaDevices();
            
            // Initialize video preview
            startVideoPreview();
          })
          .catch(error => {
            console.error('Error loading LiveKit SDK:', error);
            showError('Failed to load livestreaming capabilities. Please refresh the page and try again.');
          });
      });
      
      // Clean up when modal is hidden
      goLiveModal.addEventListener('hidden.bs.modal', function() {
        stopVideoPreview();
      });
    }
    
    // Set up event listeners for media controls
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
    
    // Check for active livestream when the page loads
    document.addEventListener('DOMContentLoaded', function() {
      checkForActiveLivestream();
    });
    
    // Fetch available media devices
    async function getMediaDevices() {
      try {
        // Clear previous options
        cameraSelect.innerHTML = '<option value="">Select camera...</option>';
        micSelect.innerHTML = '<option value="">Select microphone...</option>';
        
        // Request permissions to access devices
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
        
        // Update UI to reflect initial state
        updateMediaControls();
        
        // Hide error if previously shown
        hideError();
        cameraOffMessage.style.display = 'none';
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
        
        console.log('LiveKit room created:', roomData);
        
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
        
        console.log('LiveKit token generated:', tokenData);
        
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
        
        console.log('Livestream record created:', livestreamData);
        
        // Step 4: Connect to LiveKit room
        await connectToLivekitRoom(tokenData.token, roomData.room.name, livestreamData.livestream_id);
        
        // Hide the modal
        const modal = bootstrap.Modal.getInstance(goLiveModal);
        modal.hide();
        
        // Show livestream interface
        showLivestreamInterface(livestreamData.livestream_id, roomData.room.name);
        
      } catch (error) {
        console.error('Error starting livestream:', error);
        showError(error.message || 'Failed to start livestream. Please try again.');
        
        // Reset button state
        startLivestreamBtn.disabled = false;
        startLivestreamBtn.innerHTML = '<i class="bi bi-broadcast"></i> Start Livestream';
      }
    }
    
    // Connect to LiveKit room
    async function connectToLivekitRoom(token, roomName, livestreamId) {
      try {
        await loadLivekitSDK();
        const { Room, RoomEvent, LocalParticipant, RemoteParticipant, Track } = window.LivekitClient;
        
        // Create a new room
        livekitRoom = new Room({
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: {
            resolution: { width: 1280, height: 720 },
            facingMode: 'user'
          }
        });
        
        // Set up event listeners
        livekitRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          console.log('Track subscribed:', track.kind, 'from', participant.identity);
        });
        
        livekitRoom.on(RoomEvent.TrackPublished, (publication, participant) => {
          console.log('Track published:', publication.trackSid, 'by', participant.identity);
        });
        
        livekitRoom.on(RoomEvent.ParticipantConnected, (participant) => {
          console.log('Participant connected:', participant.identity);
        });
        
        livekitRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
          console.log('Participant disconnected:', participant.identity);
        });
        
        livekitRoom.on(RoomEvent.Disconnected, () => {
          console.log('Disconnected from room');
          isLivestreaming = false;
        });
        
        // Connect to the room
        await livekitRoom.connect(`https://edulink-oxkw0h5q.livekit.cloud`, token);
        console.log('Connected to LiveKit room:', roomName);
        
        // Get the local participant
        localParticipant = livekitRoom.localParticipant;
        
        // Publish audio and video tracks from the current mediaStream
        if (mediaStream) {
          const videoTrack = mediaStream.getVideoTracks()[0];
          const audioTrack = mediaStream.getAudioTracks()[0];
          
          if (videoTrack) {
            localTracks.video = await localParticipant.publishTrack(videoTrack, {
              name: 'camera',
              simulcast: true
            });
          }
          
          if (audioTrack) {
            localTracks.audio = await localParticipant.publishTrack(audioTrack, {
              name: 'microphone'
            });
          }
        }
        
        isLivestreaming = true;
        
        // Store session information
        sessionStorage.setItem('livekit_token', token);
        sessionStorage.setItem('livekit_room', roomName);
        sessionStorage.setItem('livestream_id', livestreamId);
        
        return livekitRoom;
      } catch (error) {
        console.error('Error connecting to LiveKit room:', error);
        throw new Error('Failed to connect to streaming service. Please try again.');
      }
    }
    
    // Share screen during livestream
    async function shareScreen() {
      if (!livekitRoom || !localParticipant) {
        showToast('Not connected to livestream', 'error');
        return;
      }
      
      try {
        // Check if already sharing screen
        if (localTracks.screenShare) {
          // Stop screen sharing
          await localParticipant.unpublishTrack(localTracks.screenShare.track);
          localTracks.screenShare = null;
          
          showToast('Screen sharing stopped', 'info');
          updateScreenShareButton(false);
          return;
        }
        
        // Request screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        // Get video track from screen capture
        const screenTrack = screenStream.getVideoTracks()[0];
        
        if (!screenTrack) {
          throw new Error('No screen video track available');
        }
        
        // Listen for when user stops sharing via browser UI
        screenTrack.addEventListener('ended', () => {
          if (localTracks.screenShare) {
            localParticipant.unpublishTrack(localTracks.screenShare.track);
            localTracks.screenShare = null;
            updateScreenShareButton(false);
          }
        });
        
        // Publish screen track
        localTracks.screenShare = await localParticipant.publishTrack(screenTrack, {
          name: 'screen',
          screenShare: true
        });
        
        showToast('Screen sharing started', 'success');
        updateScreenShareButton(true);
        
      } catch (error) {
        console.error('Error sharing screen:', error);
        
        if (error.name === 'NotAllowedError') {
          showToast('Screen sharing was cancelled', 'info');
        } else {
          showToast('Failed to share screen: ' + error.message, 'error');
        }
        
        updateScreenShareButton(false);
      }
    }
    
    // Update screen share button state
    function updateScreenShareButton(isSharing) {
      const screenShareBtn = document.getElementById('screenShareBtn');
      if (!screenShareBtn) return;
      
      if (isSharing) {
        screenShareBtn.innerHTML = '<i class="bi bi-display-stop"></i> Stop Sharing';
        screenShareBtn.classList.remove('btn-outline-primary');
        screenShareBtn.classList.add('btn-danger');
      } else {
        screenShareBtn.innerHTML = '<i class="bi bi-display"></i> Share Screen';
        screenShareBtn.classList.remove('btn-danger');
        screenShareBtn.classList.add('btn-outline-primary');
      }
    }
    
    // Show livestream interface
    function showLivestreamInterface(livestreamId, roomName) {
      // Create livestream interface container if it doesn't exist
      let livestreamContainer = document.getElementById('livestream-container');
      if (!livestreamContainer) {
        livestreamContainer = document.createElement('div');
        livestreamContainer.id = 'livestream-container';
        livestreamContainer.className = 'livestream-container';
        document.body.appendChild(livestreamContainer);
      }
      
      // Create livestream interface
      livestreamContainer.innerHTML = `
        <div class="livestream-header">
          <div class="livestream-title">
            <i class="bi bi-broadcast"></i>
            <span>LIVE: ${document.getElementById('liveTitleInput').value}</span>
            <span class="live-indicator">LIVE</span>
          </div>
          <div class="livestream-controls">
            <button id="toggleCameraLiveBtn" class="btn btn-sm btn-outline-secondary">
              <i class="bi bi-camera-video"></i> Camera
            </button>
            <button id="toggleMicLiveBtn" class="btn btn-sm btn-outline-secondary">
              <i class="bi bi-mic"></i> Mic
            </button>
            <button id="screenShareBtn" class="btn btn-sm btn-outline-primary">
              <i class="bi bi-display"></i> Share Screen
            </button>
            <button id="chatToggleBtn" class="btn btn-sm btn-outline-secondary">
              <i class="bi bi-chat-dots"></i> Chat
              <span id="unread-count" class="badge bg-danger rounded-pill d-none">0</span>
            </button>
            <button id="endLivestreamBtn" class="btn btn-sm btn-danger">
              <i class="bi bi-x-circle"></i> End Stream
            </button>
          </div>
        </div>
        <div class="livestream-body">
          <div class="video-container">
            <div id="localVideoContainer" class="local-video-container">
              <video id="localVideo" class="local-video" autoplay muted></video>
              <div class="camera-off-overlay" style="display: none;">
                <i class="bi bi-camera-video-off"></i>
                <span>Camera Off</span>
              </div>
              <div class="video-label">You (${TEACHER_NAME})</div>
            </div>
            <div id="screenShareContainer" class="screen-share-container" style="display: none;">
              <video id="screenShareVideo" class="screen-share-video" autoplay></video>
              <div class="video-label">Screen Share</div>
            </div>
          </div>
          <div id="chatContainer" class="chat-container">
            <div class="chat-header">
              <h4>Live Chat</h4>
              <button id="closeChatBtn" class="btn btn-sm btn-link">
                <i class="bi bi-x"></i>
              </button>
            </div>
            <div id="chatMessages" class="chat-messages"></div>
            <div class="chat-input-container">
              <input type="text" id="chatInput" class="form-control" placeholder="Type a message...">
              <button id="sendChatBtn" class="btn btn-primary">
                <i class="bi bi-send"></i>
              </button>
            </div>
          </div>
        </div>
      `;
      
      // Add styles for the livestream interface
      addLivestreamStyles();
      
      // Show the livestream container
      livestreamContainer.style.display = 'block';
      
      // Set up local video display
      const localVideo = document.getElementById('localVideo');
      if (localVideo && mediaStream) {
        localVideo.srcObject = mediaStream;
      }
      
      // Set up event listeners for livestream controls
      document.getElementById('toggleCameraLiveBtn').addEventListener('click', toggleCameraLive);
      document.getElementById('toggleMicLiveBtn').addEventListener('click', toggleMicLive);
      document.getElementById('screenShareBtn').addEventListener('click', shareScreen);
      document.getElementById('chatToggleBtn').addEventListener('click', toggleChat);
      document.getElementById('closeChatBtn').addEventListener('click', toggleChat);
      document.getElementById('endLivestreamBtn').addEventListener('click', () => {
        endLivestream(livestreamId, roomName);
      });
      
      // Initialize chat features
      initializeChat();
      
      // Update control button states
      updateLiveControls();
    }
    
    // Toggle camera during livestream
    function toggleCameraLive() {
      if (!livekitRoom || !localParticipant) return;
      
      cameraEnabled = !cameraEnabled;
      
      // Update local video preview
      if (mediaStream) {
        const videoTracks = mediaStream.getVideoTracks();
        videoTracks.forEach(track => {
          track.enabled = cameraEnabled;
        });
      }
      
      // Update camera overlay
      const cameraOffOverlay = document.querySelector('.camera-off-overlay');
      if (cameraOffOverlay) {
        cameraOffOverlay.style.display = cameraEnabled ? 'none' : 'flex';
      }
      
      // Update control button state
      updateLiveControls();
    }
    
    // Toggle microphone during livestream
    function toggleMicLive() {
      if (!livekitRoom || !localParticipant) return;
      
      micEnabled = !micEnabled;
      
      // Update local audio track
      if (mediaStream) {
        const audioTracks = mediaStream.getAudioTracks();
        audioTracks.forEach(track => {
          track.enabled = micEnabled;
        });
      }
      
      // Update control button state
      updateLiveControls();
    }
    
    // Toggle chat visibility
    function toggleChat() {
      const chatContainer = document.getElementById('chatContainer');
      const unreadCount = document.getElementById('unread-count');
      
      if (chatContainer) {
        const isVisible = chatContainer.classList.toggle('visible');
        
        if (isVisible) {
          // Clear unread count when opening chat
          unreadCount.textContent = '0';
          unreadCount.classList.add('d-none');
          
          // Focus chat input
          document.getElementById('chatInput')?.focus();
        }
      }
    }
    
    // Initialize chat functionality
    function initializeChat() {
      const chatInput = document.getElementById('chatInput');
      const sendChatBtn = document.getElementById('sendChatBtn');
      const chatMessages = document.getElementById('chatMessages');
      
      if (!chatInput || !sendChatBtn || !chatMessages) return;
      
      // Send chat message when clicking send button
      sendChatBtn.addEventListener('click', sendChatMessage);
      
      // Send chat message when pressing Enter in the input field
      chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          sendChatMessage();
        }
      });
      
      // Function to send a chat message
      function sendChatMessage() {
        const message = chatInput.value.trim();
        if (!message) return;
        
        // Send the message using LiveKit data channel
        if (livekitRoom && localParticipant) {
          const chatData = JSON.stringify({
            type: 'chat',
            sender: TEACHER_NAME,
            message: message,
            timestamp: new Date().toISOString(),
            role: 'teacher'
          });
          
          localParticipant.publishData(new TextEncoder().encode(chatData));
          
          // Add the message to the chat display
          addChatMessage(TEACHER_NAME, message, new Date(), 'teacher', true);
          
          // Clear the input field
          chatInput.value = '';
        }
      }
      
      // Set up data message handling for chat
      if (livekitRoom) {
        livekitRoom.on('dataReceived', (data, participant) => {
          try {
            const decodedData = JSON.parse(new TextDecoder().decode(data));
            
            if (decodedData.type === 'chat') {
              // Add the received message to the chat
              addChatMessage(
                decodedData.sender,
                decodedData.message,
                new Date(decodedData.timestamp),
                decodedData.role || 'student',
                false
              );
              
              // Increment unread count if chat is not visible
              if (!document.getElementById('chatContainer').classList.contains('visible')) {
                const unreadCount = document.getElementById('unread-count');
                const currentCount = parseInt(unreadCount.textContent) || 0;
                unreadCount.textContent = currentCount + 1;
                unreadCount.classList.remove('d-none');
              }
            }
          } catch (error) {
            console.error('Error processing received data:', error);
          }
        });
      }
    }
    
    // Add a chat message to the display
    function addChatMessage(sender, message, timestamp, role, isFromMe) {
      const chatMessages = document.getElementById('chatMessages');
      if (!chatMessages) return;
      
      const messageElement = document.createElement('div');
      messageElement.className = `chat-message ${isFromMe ? 'from-me' : ''} ${role === 'teacher' ? 'teacher-message' : ''}`;
      
      const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      messageElement.innerHTML = `
        <div class="message-header">
          <span class="message-sender">${isFromMe ? 'You' : sender}</span>
          <span class="message-time">${timeString}</span>
        </div>
        <div class="message-content">${message}</div>
      `;
      
      chatMessages.appendChild(messageElement);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Update livestream control buttons
    function updateLiveControls() {
      // Update camera button
      const cameraBtn = document.getElementById('toggleCameraLiveBtn');
      if (cameraBtn) {
        cameraBtn.innerHTML = cameraEnabled ? 
          '<i class="bi bi-camera-video"></i> Camera' : 
          '<i class="bi bi-camera-video-off"></i> Camera Off';
        
        cameraBtn.classList.toggle('btn-outline-secondary', cameraEnabled);
        cameraBtn.classList.toggle('btn-outline-danger', !cameraEnabled);
      }
      
      // Update mic button
      const micBtn = document.getElementById('toggleMicLiveBtn');
      if (micBtn) {
        micBtn.innerHTML = micEnabled ? 
          '<i class="bi bi-mic"></i> Mic' : 
          '<i class="bi bi-mic-mute"></i> Mic Off';
        
        micBtn.classList.toggle('btn-outline-secondary', micEnabled);
        micBtn.classList.toggle('btn-outline-danger', !micEnabled);
      }
    }
    
    // End the livestream
    async function endLivestream(livestreamId, roomName) {
      try {
        // Show confirmation dialog
        if (!confirm('Are you sure you want to end this livestream? This cannot be undone.')) {
          return;
        }
        
        // Disconnect from LiveKit room
        if (livekitRoom) {
          await livekitRoom.disconnect();
          livekitRoom = null;
        }
        
        // Stop all media tracks
        if (mediaStream) {
          mediaStream.getTracks().forEach(track => track.stop());
          mediaStream = null;
        }
        
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
        
        // Remove livestream interface
        const livestreamContainer = document.getElementById('livestream-container');
        if (livestreamContainer) {
          livestreamContainer.remove();
        }
        
        // Reset livestreaming state
        isLivestreaming = false;
        
      } catch (error) {
        console.error('Error ending livestream:', error);
        showToast('Network error while ending livestream', 'error');
      }
    }
    
    // Check for active livestream on page load
    function checkForActiveLivestream() {
      const token = sessionStorage.getItem('livekit_token');
      const roomName = sessionStorage.getItem('livekit_room');
      const livestreamId = sessionStorage.getItem('livestream_id');
      
      if (token && roomName && livestreamId) {
        // Reconnect to active livestream
        loadLivekitSDK()
          .then(() => {
            connectToLivekitRoom(token, roomName, livestreamId)
              .then(() => {
                showLivestreamInterface(livestreamId, roomName);
                showToast('Reconnected to your livestream', 'success');
              })
              .catch(error => {
                console.error('Failed to reconnect to livestream:', error);
                // Clear session storage if reconnection fails
                sessionStorage.removeItem('livekit_token');
                sessionStorage.removeItem('livekit_room');
                sessionStorage.removeItem('livestream_id');
              });
          })
          .catch(error => {
            console.error('Failed to load LiveKit SDK:', error);
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
    
    // Add styles for the livestream interface
    function addLivestreamStyles() {
      if (document.getElementById('livestream-styles')) return;
      
      const styleElement = document.createElement('style');
      styleElement.id = 'livestream-styles';
      styleElement.textContent = `
        .livestream-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.95);
          z-index: 9999;
          display: flex;
          flex-direction: column;
          color: white;
        }
        
        .livestream-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 20px;
          background-color: rgba(0, 0, 0, 0.8);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .livestream-title {
          display: flex;
          align-items: center;
          font-size: 1.2rem;
          font-weight: 500;
        }
        
        .livestream-title i {
          color: #ff4a4a;
          margin-right: 8px;
        }
        
        .live-indicator {
          margin-left: 12px;
          padding: 2px 8px;
          background-color: #ff4a4a;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: bold;
          animation: pulse 1.5s infinite;
        }
        
        .livestream-controls {
          display: flex;
          gap: 8px;
        }
        
        .livestream-body {
          display: flex;
          flex: 1;
          overflow: hidden;
        }
        
        .video-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          background-color: #1a1a1a;
        }
        
        .local-video-container {
          position: relative;
          width: 80%;
          max-width: 1200px;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        }
        
        .local-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          background-color: #333;
        }
        
        .camera-off-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.7);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: white;
        }
        
        .camera-off-overlay i {
          font-size: 48px;
          margin-bottom: 12px;
        }
        
        .video-label {
          position: absolute;
          bottom: 16px;
          left: 16px;
          background-color: rgba(0, 0, 0, 0.6);
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 0.9rem;
        }
        
        .screen-share-container {
          position: absolute;
          top: 24px;
          right: 24px;
          width: 25%;
          max-width: 320px;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        }
        
        .screen-share-video {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background-color: #333;
        }
        
        .chat-container {
          width: 320px;
          background-color: rgba(30, 30, 30, 0.9);
          border-left: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          flex-direction: column;
          transform: translateX(100%);
          transition: transform 0.3s ease;
        }
        
        .chat-container.visible {
          transform: translateX(0);
        }
        
        .chat-header {
          padding: 12px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .chat-header h4 {
          margin: 0;
          font-size: 1.1rem;
        }
        
        .chat-messages {
          flex: 1;
          padding: 16px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .chat-message {
          padding: 8px 12px;
          background-color: rgba(80, 80, 80, 0.5);
          border-radius: 8px;
          max-width: 85%;
          align-self: flex-start;
        }
        
        .chat-message.from-me {
          background-color: rgba(0, 123, 255, 0.5);
          align-self: flex-end;
        }
        
        .chat-message.teacher-message:not(.from-me) {
          background-color: rgba(220, 53, 69, 0.4);
        }
        
        .message-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
          font-size: 0.8rem;
        }
        
        .message-sender {
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }
        
        .message-time {
          color: rgba(255, 255, 255, 0.6);
        }
        
        .message-content {
          word-break: break-word;
        }
        
        .chat-input-container {
          display: flex;
          padding: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          gap: 8px;
        }
        
        .chat-input-container input {
          flex: 1;
          background-color: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
        }
        
        .chat-input-container input::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }
        
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.6; }
          100% { opacity: 1; }
        }
      `;
      
      document.head.appendChild(styleElement);
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
})