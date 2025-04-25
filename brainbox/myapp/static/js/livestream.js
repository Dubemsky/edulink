/**
 * Modular Livestream Integration for EduLink
 * 
 * This file contains the namespaced implementation of livestreaming functionality
 * using Agora RTM and RTC SDKs, designed to avoid conflicts with other site features.
 */

// Livestream module encapsulation to avoid global variable conflicts
const LivestreamModule = {
    // Module configuration and state
    config: {
      appId: null,
      channel: null,
      token: null
    },
    
    // Module state variables
    state: {
      agoraRtcClient: null,
      localTracks: null,
      screenTracks: null,
      remoteUsers: {},
      isLive: false,
      currentRoomId: null,
      currentStreamId: null,
      currentChannelName: null,
      userRole: 'audience', // 'host' or 'audience'
      videoEnabled: true,
      streamTimerInterval: null,
      audioEnabled: true,
      isScreenSharing :false,
    },
    
    // Element IDs (make sure these match your HTML)
    elements: {
      streamContainerId: 'livestream-container',
      localVideoId: 'local-video',
      remoteVideoClass: 'remote-video',
      viewerCountId: 'viewer-count',
      streamStatusId: 'stream-status',
      streamTimerId: 'stream-timer'
    },
    
    // Module initialization
    init: function() {
      // Get the current room ID from the DOM
      const roomIdElement = document.getElementById('room-id-data');
      if (roomIdElement) {
        this.state.currentRoomId = roomIdElement.dataset.roomId;
        console.log("Livestream Module: Room ID set to", this.state.currentRoomId);
      } else {
        console.warn("Livestream Module: Room ID Element not found in the DOM");
      }
      
      // Set up main functionality based on user role
      if (document.getElementById('goLiveModal')) {
        this.initHostFeatures();
      }
      
      return this; // For chaining
    },
    
    // Initialize host features (for teachers)
    initHostFeatures: function() {
      this.initLivestreamModal();
      this.initScheduleModal();
      this.loadScheduledLivestreams();
      
      console.log("Livestream Module: Host features initialized");
    },
    
    // Initialize the Go Live modal
    initLivestreamModal: function() {
      const modal = document.getElementById('goLiveModal');
      if (!modal) {
        console.warn("Livestream Module: Go Live Modal not found in the DOM");
        return;
      }
      
      const self = this; // Store reference to 'this' for use in event handlers
      
      // Handle modal open event
      modal.addEventListener('show.bs.modal', function() {
        console.log("Livestream Module: Modal show event triggered");
        self.resetLivestreamForm();
        self.initDeviceSelectors();
        self.startCameraPreview();
      });
      
      // Handle modal close event
      modal.addEventListener('hidden.bs.modal', function() {
        console.log("Livestream Module: Modal hidden event triggered");
        self.stopCameraPreview();
      });
      
      // Set up toggle buttons
      const toggleCameraBtn = document.getElementById('toggleCameraBtn');
      if (toggleCameraBtn) {
        toggleCameraBtn.addEventListener('click', function() {
          self.toggleCameraPreview();
        });
      }
      
      const toggleMicBtn = document.getElementById('toggleMicBtn');
      if (toggleMicBtn) {
        toggleMicBtn.addEventListener('click', function() {
          self.toggleMicPreview();
        });
      }
      
      // Set up start livestream button
      const startLivestreamBtn = document.getElementById('startLivestreamBtn');
      if (startLivestreamBtn) {
        startLivestreamBtn.addEventListener('click', function() {
          self.handleStartLivestream();
        });
      }
    },
    
    // Initialize the Schedule Livestream modal
    initScheduleModal: function() {
      const scheduleBtn = document.getElementById('scheduleLivestreamBtn');
      const self = this;
      
      if (scheduleBtn) {
        scheduleBtn.addEventListener('click', function() {
          // Close the manage livestreams modal
          const manageModal = bootstrap.Modal.getInstance(document.getElementById('manageLivestreamModal'));
          if (manageModal) {
            manageModal.hide();
          }
          
          // Open the schedule form modal
          const scheduleFormModal = new bootstrap.Modal(document.getElementById('scheduleLivestreamFormModal'));
          scheduleFormModal.show();
        });
      }
      
      // Set minimum date for the date picker
      const dateInput = document.getElementById('livestreamDate');
      if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.min = today;
        dateInput.value = today;
      }
      
      // Set up create button
      const createLivestreamBtn = document.getElementById('createLivestreamBtn');
      if (createLivestreamBtn) {
        createLivestreamBtn.addEventListener('click', function() {
          self.handleScheduleLivestream();
        });
      }
    },
    
    // Reset the livestream form
    resetLivestreamForm: function() {
      const titleInput = document.getElementById('liveTitleInput');
      if (titleInput) {
        titleInput.value = '';
      }
      
      const notifyCheckbox = document.getElementById('notifyStudentsLive');
      if (notifyCheckbox) {
        notifyCheckbox.checked = true;
      }
      
      const errorAlert = document.getElementById('liveErrorAlert');
      if (errorAlert) {
        errorAlert.style.display = 'none';
      }
      
      // Reset state
      this.state.cameraEnabled = true;
      this.state.micEnabled = true;
    },
    
    // Initialize device selectors
    initDeviceSelectors: async function() {
      try {
        // Get available media devices
        const devices = await this.getMediaDevices();
        
        if (devices.error) {
          this.showDeviceError('Failed to access camera and microphone: ' + devices.error);
          return;
        }
        
        // Store available devices
        this.availableCameras = devices.videoDevices;
        this.availableMicrophones = devices.audioDevices;
        
        // Populate camera dropdown
        const cameraSelect = document.getElementById('cameraSelect');
        if (cameraSelect) {
          // Clear existing options
          cameraSelect.innerHTML = '';
          
          if (this.availableCameras.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No cameras available';
            cameraSelect.appendChild(option);
            cameraSelect.disabled = true;
          } else {
            // Add cameras
            this.availableCameras.forEach((camera, index) => {
              const option = document.createElement('option');
              option.value = camera.deviceId;
              option.textContent = camera.label || `Camera ${index + 1}`;
              cameraSelect.appendChild(option);
            });
            
            cameraSelect.disabled = false;
            
            // Set default camera
            if (this.availableCameras.length > 0) {
              this.selectedCameraId = this.availableCameras[0].deviceId;
              cameraSelect.value = this.selectedCameraId;
            }
            
            // Handle camera change
            const self = this;
            cameraSelect.addEventListener('change', function() {
              self.selectedCameraId = this.value;
              self.updateCameraPreview();
            });
          }
        }
        
        // Populate microphone dropdown
        const micSelect = document.getElementById('micSelect');
        if (micSelect) {
          // Clear existing options
          micSelect.innerHTML = '';
          
          if (this.availableMicrophones.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No microphones available';
            micSelect.appendChild(option);
            micSelect.disabled = true;
          } else {
            // Add microphones
            this.availableMicrophones.forEach((mic, index) => {
              const option = document.createElement('option');
              option.value = mic.deviceId;
              option.textContent = mic.label || `Microphone ${index + 1}`;
              micSelect.appendChild(option);
            });
            
            micSelect.disabled = false;
            
            // Set default microphone
            if (this.availableMicrophones.length > 0) {
              this.selectedMicrophoneId = this.availableMicrophones[0].deviceId;
              micSelect.value = this.selectedMicrophoneId;
            }
          }
        }
      } catch (error) {
        console.error('Error initializing device selectors:', error);
        this.showDeviceError('Failed to initialize device selectors');
      }
    },
    
    // Start camera preview
    startCameraPreview: async function() {
      if (this.isPreviewActive) {
        return;
      }
      
      const previewContainer = document.getElementById('localPreview');
      const cameraOffMessage = document.getElementById('camera-off-message');
      
      if (!previewContainer) {
        console.warn("Preview container not found in the DOM");
        return;
      }
      
      try {
        // Create constraints
        const constraints = {
          audio: true,
          video: this.selectedCameraId ? { deviceId: { exact: this.selectedCameraId } } : true
        };
        
        // Get user media
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Store the stream
        this.cameraPreview = stream;
        
        // Display the preview
        previewContainer.srcObject = stream;
        previewContainer.style.display = 'block';
        
        if (cameraOffMessage) {
          cameraOffMessage.style.display = 'none';
        }
        
        this.isPreviewActive = true;
        
        // Update toggle buttons
        this.updateToggleButtons();
      } catch (error) {
        console.error('Error starting camera preview:', error);
        
        // Show camera off message
        if (previewContainer) previewContainer.style.display = 'none';
        if (cameraOffMessage) cameraOffMessage.style.display = 'block';
        
        this.showDeviceError('Failed to access camera: ' + error.message);
      }
    },
    
    // Stop camera preview
    stopCameraPreview: function() {
      if (!this.isPreviewActive || !this.cameraPreview) {
        return;
      }
      
      try {
        // Stop all tracks
        this.cameraPreview.getTracks().forEach(track => {
          track.stop();
        });
        
        // Reset preview
        const previewContainer = document.getElementById('localPreview');
        if (previewContainer) {
          previewContainer.srcObject = null;
        }
        
        this.isPreviewActive = false;
        this.cameraPreview = null;
      } catch (error) {
        console.error('Error stopping camera preview:', error);
      }
    },
    
    // Update camera preview with new device
    updateCameraPreview: async function() {
      if (!this.isPreviewActive) {
        return;
      }
      
      // Stop current preview
      this.stopCameraPreview();
      
      // Start new preview
      await this.startCameraPreview();
    },
    
    // Toggle camera preview on/off
    toggleCameraPreview: function() {
      if (!this.isPreviewActive || !this.cameraPreview) {
        return;
      }
      
      try {
        const previewContainer = document.getElementById('localPreview');
        const cameraOffMessage = document.getElementById('camera-off-message');
        const toggleButton = document.getElementById('toggleCameraBtn');
        
        // Get video tracks
        const videoTracks = this.cameraPreview.getVideoTracks();
        
        if (videoTracks.length > 0) {
          // Toggle enabled state
          this.state.cameraEnabled = !this.state.cameraEnabled;
          
          // Update tracks
          videoTracks.forEach(track => {
            track.enabled = this.state.cameraEnabled;
          });
          
          // Update UI
          if (this.state.cameraEnabled) {
            if (previewContainer) previewContainer.style.display = 'block';
            if (cameraOffMessage) cameraOffMessage.style.display = 'none';
            if (toggleButton) toggleButton.innerHTML = '<i class="bi bi-camera-video"></i> Toggle Camera';
          } else {
            if (previewContainer) previewContainer.style.display = 'none';
            if (cameraOffMessage) cameraOffMessage.style.display = 'block';
            if (toggleButton) toggleButton.innerHTML = '<i class="bi bi-camera-video-off"></i> Toggle Camera';
          }
        }
      } catch (error) {
        console.error('Error toggling camera:', error);
      }
    },
    
    // Toggle microphone preview on/off
    toggleMicPreview: function() {
      if (!this.isPreviewActive || !this.cameraPreview) {
        return;
      }
      
      try {
        const toggleButton = document.getElementById('toggleMicBtn');
        
        // Get audio tracks
        const audioTracks = this.cameraPreview.getAudioTracks();
        
        if (audioTracks.length > 0) {
          // Toggle enabled state
          this.state.micEnabled = !this.state.micEnabled;
          
          // Update tracks
          audioTracks.forEach(track => {
            track.enabled = this.state.micEnabled;
          });
          
          // Update UI
          if (toggleButton) {
            toggleButton.innerHTML = this.state.micEnabled ? 
              '<i class="bi bi-mic"></i> Toggle Mic' : 
              '<i class="bi bi-mic-mute"></i> Toggle Mic';
          }
        }
      } catch (error) {
        console.error('Error toggling microphone:', error);
      }
    },
    
    // Update toggle buttons state
    updateToggleButtons: function() {
      const cameraButton = document.getElementById('toggleCameraBtn');
      const micButton = document.getElementById('toggleMicBtn');
      
      if (cameraButton) {
        cameraButton.innerHTML = this.state.cameraEnabled ? 
          '<i class="bi bi-camera-video"></i> Toggle Camera' : 
          '<i class="bi bi-camera-video-off"></i> Toggle Camera';
      }
      
      if (micButton) {
        micButton.innerHTML = this.state.micEnabled ? 
          '<i class="bi bi-mic"></i> Toggle Mic' : 
          '<i class="bi bi-mic-mute"></i> Toggle Mic';
      }
    },
    
    // Handle start livestream button click
    handleStartLivestream: async function() {
      // Validate form
      const titleInput = document.getElementById('liveTitleInput');
      const title = titleInput ? titleInput.value.trim() : '';
      
      if (!title) {
        this.showDeviceError('Please enter a title for your livestream');
        return;
      }
      
      if (!this.state.currentRoomId) {
        this.showDeviceError('Room ID is not available');
        return;
      }
      
      // Get notification setting
      const notifyCheckbox = document.getElementById('notifyStudentsLive');
      const notifyStudents = notifyCheckbox ? notifyCheckbox.checked : true;
      
      // Disable the button to prevent multiple clicks
      const startButton = document.getElementById('startLivestreamBtn');
      if (startButton) {
        startButton.disabled = true;
        startButton.innerHTML = '<i class="bi bi-hourglass-split"></i> Starting...';
      }
      
      try {
        // Stop preview
        this.stopCameraPreview();
        
        // Close the modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('goLiveModal'));
        if (modal) {
          modal.hide();
        }
        
        // Start the livestream
        await this.startLivestream(this.state.currentRoomId, title, notifyStudents);
        
        // Show success message
        this.showToast('You are now live! Your students can join your stream.', 'success');
      } catch (error) {
        console.error('Error starting livestream:', error);
        this.showDeviceError('Failed to start livestream: ' + error.message);
      } finally {
        // Re-enable the button
        if (startButton) {
          startButton.disabled = false;
          startButton.innerHTML = '<i class="bi bi-broadcast"></i> Start Livestream';
        }
      }
    },
    
    // Start a livestream (for teachers)
    startLivestream: async function(roomId, title, notifyStudents = true) {
      if (this.state.isLive) {
        console.warn('Already streaming. Please end the current stream first.');
        return false;
      }
      
      try {
        this.showLoading('Initializing livestream...');
        
        // Get the teacher's user ID
        const teacherId = this.getCurrentUserId();
        
        // Request livestream details from the server
        const response = await fetch('/start-livestream/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': this.getCsrfToken()
          },
          body: JSON.stringify({
            teacher_id: teacherId,
            room_id: roomId,
            title: title,
            notify_students: notifyStudents
          })
        });
        
        const data = await response.json();
        
        if (!data.success) {
          this.hideLoading();
          this.showDeviceError(data.error || 'Failed to start livestream.');
          return false;
        }
        
        // Store the stream details
        this.state.currentRoomId = roomId;
        this.state.currentStreamId = data.stream_id;
        
        // Create the streaming interface before initializing
        this.createStreamingInterface();
        
        // Initialize the Agora client
        const initialized = await this.initAgoraClient(
          data.app_id,
          data.channel_name,
          data.token,
          0, // Use 0 for the host
          'host'
        );
        
        if (!initialized) {
          this.hideLoading();
          return false;
        }
        
        this.hideLoading();
        this.showToast('You are now live!');
        
        return true;
      } catch (error) {
        console.error('Error starting livestream:', error);
        this.hideLoading();
        this.showDeviceError('Failed to start livestream. Please try again.');
        return false;
      }
    },
    
    // Initialize the Agora client
    initAgoraClient: async function(appId, channelName, token, uid, role) {
      try {
        console.log('Initializing Agora client:', { appId, channelName, uid, role });
        
        // Initialize the RTC client
        this.state.agoraRtcClient = AgoraRTC.createClient({ mode: 'live', codec: 'h264' });
        
        // Set the client role
        this.state.userRole = role;
        await this.state.agoraRtcClient.setClientRole(role === 'host' ? 'host' : 'audience');
        
        // Initialize event listeners
        this.setupEventListeners();
        
        // Join the channel
        await this.state.agoraRtcClient.join(appId, channelName, token, uid || null);
        console.log('Successfully joined channel:', channelName);
        
        this.state.currentChannelName = channelName;
        
        if (role === 'host') {
          // Create and publish local stream for host
          await this.initLocalStream();
        }
        
        return true;
      } catch (error) {
        console.error('Error initializing Agora client:', error);
        this.showDeviceError('Failed to connect to the livestream. Please try again.');
        return false;
      }
    },
    
    // Initialize the local stream (for teacher/host)
    initLocalStream: async function() {
      try {
        console.log("Initializing local stream with Agora API...");
        
        // Create an Agora client
        if (!this.state.agoraRtcClient) {
          console.error("Agora client not initialized");
          return false;
        }
        
        // Create local tracks
        const [microphoneTrack, cameraTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
        
        // Store the local tracks
        this.state.localTracks = {
          audioTrack: microphoneTrack,
          videoTrack: cameraTrack
        };
        
        // Display local video track
        const localVideoContainer = document.getElementById('local-stream-container');
        if (localVideoContainer) {
          // Play video in the container
          this.state.localTracks.videoTrack.play('local-stream-container');
          console.log("Local video track playing successfully");
        } else {
          console.error("Local stream container not found, creating interface");
          this.createStreamingInterface();
          
          // Try playing again after a short delay
          setTimeout(() => {
            const newContainer = document.getElementById('local-stream-container');
            if (newContainer) {
              this.state.localTracks.videoTrack.play('local-stream-container');
              console.log("Playing in newly created container");
            }
          }, 500);
        }
        
        // Publish the local tracks
        await this.state.agoraRtcClient.publish(Object.values(this.state.localTracks));
        console.log("Local tracks published successfully");
        
        this.state.isLive = true;
        this.updateStreamStatus('live');
        this.startStreamTimer();
        
        return true;
      } catch (error) {
        console.error('Error initializing local stream:', error);
        this.showDeviceError('Failed to initialize camera and microphone: ' + error.message);
        return false;
      }
    },
    
    // Set up event listeners for the Agora client
    setupEventListeners: function() {
      if (!this.state.agoraRtcClient) return;
      
      const self = this;
      
      // User published event (someone started sharing their stream)
      this.state.agoraRtcClient.on('user-published', async function(user, mediaType) {
        // Subscribe to the user
        await self.state.agoraRtcClient.subscribe(user, mediaType);
        console.log("Subscribed to user:", user.uid, "mediaType:", mediaType);
        
        // Handle user streams
        if (mediaType === 'video') {
          // Get the remote stream container
          const remoteContainer = document.getElementById(self.elements.streamContainerId);
          if (remoteContainer && self.state.userRole === 'audience') {
            // Store the remote user
            self.state.remoteUsers[user.uid] = user;
            
            // Create a div for the remote stream
            const remoteDiv = document.createElement('div');
            remoteDiv.id = 'remote-stream-' + user.uid;
            remoteDiv.className = self.elements.remoteVideoClass;
            remoteContainer.appendChild(remoteDiv);
            
            // Play the remote stream
            user.videoTrack.play('remote-stream-' + user.uid);
            console.log('Playing remote video in container');
            
            // Update the stream status
            self.updateStreamStatus('watching');
          }
        }
        
        if (mediaType === 'audio') {
          // Play the audio
          user.audioTrack.play();
        }
      });
      
      // Handle user leaving
      this.state.agoraRtcClient.on('user-left', function(user) {
        console.log("User left:", user.uid);
        
        // Remove from remote users
        if (self.state.remoteUsers[user.uid]) {
          delete self.state.remoteUsers[user.uid];
          
          // Remove the remote stream container
          const remoteDiv = document.getElementById('remote-stream-' + user.uid);
          if (remoteDiv) {
            remoteDiv.parentNode.removeChild(remoteDiv);
          }
        }
        
        if (self.state.userRole === 'audience') {
          // If the host left and you're a viewer
          self.updateStreamStatus('ended');
          self.stopStreamTimer();
          self.showToast('The host has ended the livestream.');
        }
      });
      
      // Client disconnected
      this.state.agoraRtcClient.on('exception', function(evt) {
        console.log('Exception:', evt.code, evt.msg);
      });
    },
    
    // Create streaming interface
    createStreamingInterface: function() {
      // Remove any existing streaming interface
      const existingInterface = document.getElementById('enhanced-streaming-interface');
      if (existingInterface) {
        existingInterface.remove();
      }
      
      // Create the main container
      const interfaceContainer = document.createElement('div');
      interfaceContainer.id = 'enhanced-streaming-interface';
      interfaceContainer.classList.add('enhanced-streaming-interface');
      
      // Create the interface HTML
      interfaceContainer.innerHTML = `
        <div class="streaming-header">
          <div class="streaming-status">
            <span class="streaming-indicator"></span>
            <span class="status-text">Live</span>
            <span class="streaming-timer" id="stream-timer">00:00</span>
          </div>
          <div class="streaming-viewers">
            <i class="bi bi-people-fill"></i>
            <span id="viewer-count">0</span> viewers
          </div>
        </div>
        
        <div class="streaming-body">
          <div class="video-section">
            <div class="local-stream-wrapper">
              <div id="local-stream-container" class="stream-container"></div>
              <div class="stream-label">You (Host)</div>
            </div>
            <div class="screen-share-wrapper" style="display: none;">
              <div id="screen-share-container" class="stream-container"></div>
              <div class="stream-label">Screen Share</div>
            </div>
          </div>
          
          <div class="interaction-section">
            <div class="chat-container">
              <div class="chat-header">
                <h3>Live Chat</h3>
              </div>
              <div class="chat-messages" id="live-chat-messages">
                <!-- Chat messages will be added here -->
                <div class="system-message">Welcome to the livestream! Chat with viewers here.</div>
              </div>
              <div class="chat-input-container">
                <input type="text" id="live-chat-input" placeholder="Type a message...">
                <button id="send-chat-button">
                  <i class="bi bi-send"></i>
                </button>
              </div>
            </div>
            
            <div class="questions-container">
              <div class="questions-header">
                <h3>Questions</h3>
              </div>
              <div class="questions-list" id="live-questions-list">
                <!-- Questions will be added here -->
                <div class="system-message">Questions from viewers will appear here.</div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="streaming-controls">
          <button id="toggle-camera-btn" class="control-button">
            <i class="bi bi-camera-video"></i>
          </button>
          <button id="toggle-mic-btn" class="control-button">
            <i class="bi bi-mic"></i>
          </button>
          <button id="toggle-screen-share-btn" class="control-button">
            <i class="bi bi-display"></i>
          </button>
          <button id="toggle-interaction-btn" class="control-button">
            <i class="bi bi-chat-dots"></i>
          </button>
          <button id="end-stream-btn" class="control-button end-stream">
            End Stream
          </button>
        </div>
      `;
      
      // Append the interface to the body
      document.body.appendChild(interfaceContainer);
      
      // Add event listeners to the control buttons
      const self = this;
      document.getElementById('toggle-camera-btn').addEventListener('click', function() {
        self.toggleCamera();
      });
      document.getElementById('toggle-mic-btn').addEventListener('click', function() {
        self.toggleMicrophone();
      });
      document.getElementById('toggle-screen-share-btn').addEventListener('click', function() {
        self.toggleScreenShare();
      });
      document.getElementById('toggle-interaction-btn').addEventListener('click', function() {
        self.toggleInteractionPanel();
      });
      document.getElementById('end-stream-btn').addEventListener('click', function() {
        self.endLivestream();
      });
      
      // Add event listener to chat input
      document.getElementById('send-chat-button').addEventListener('click', function() {
        self.sendChatMessage();
      });
      document.getElementById('live-chat-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          self.sendChatMessage();
        }
      });
      
      // Add the styles for the enhanced interface
      this.addEnhancedInterfaceStyles();
    },
    
    // Toggle camera on/off during livestream
    toggleCamera: function() {
      if (!this.state.localTracks || !this.state.localTracks.videoTrack) return;
      
      if (this.state.videoEnabled) {
        this.state.localTracks.videoTrack.setEnabled(false);
        document.getElementById('toggle-camera-btn').innerHTML = '<i class="bi bi-camera-video-off"></i>';
      } else {
        this.state.localTracks.videoTrack.setEnabled(true);
        document.getElementById('toggle-camera-btn').innerHTML = '<i class="bi bi-camera-video"></i>';
      }
      
      this.state.videoEnabled = !this.state.videoEnabled;
    },
    
    // Toggle microphone on/off during livestream
    toggleMicrophone: function() {
      if (!this.state.localTracks || !this.state.localTracks.audioTrack) return;
      
      if (this.state.audioEnabled) {
        this.state.localTracks.audioTrack.setEnabled(false);
        document.getElementById('toggle-mic-btn').innerHTML = '<i class="bi bi-mic-mute"></i>';
      } else {
        this.state.localTracks.audioTrack.setEnabled(true);
        document.getElementById('toggle-mic-btn').innerHTML = '<i class="bi bi-mic"></i>';
      }
      
      this.state.audioEnabled = !this.state.audioEnabled;
    },
    
    // Toggle screen share
    toggleScreenShare: async function () {
        if (!this.state.isLive) return;
      
        const screenShareBtn = document.getElementById('toggle-screen-share-btn');
        const screenShareWrapper = document.querySelector('.screen-share-wrapper');
      
        // If already screen sharing, stop it
        if (this.state.screenTracks) {
          // Stop and close screen video track
          for (const track of Object.values(this.state.screenTracks)) {
            if (track) {
              track.stop();
              track.close();
            }
          }
      
          // Unpublish screen track
          if (this.state.agoraRtcClient) {
            await this.state.agoraRtcClient.unpublish(Object.values(this.state.screenTracks));
          }
      
          this.state.screenTracks = null;
      
          // Optionally re-publish camera video after stopping screen share
          if (this.state.localTracks?.videoTrack) {
            await this.state.agoraRtcClient.publish(this.state.localTracks.videoTrack);
          }
      
          // Update UI
          screenShareBtn.innerHTML = '<i class="bi bi-display"></i>';
          screenShareWrapper.style.display = 'none';
          document.querySelector('.local-stream-wrapper').style.width = '100%';
          return;
        }
      
        try {
          // Unpublish camera video track before screen sharing
          if (this.state.localTracks?.videoTrack) {
            await this.state.agoraRtcClient.unpublish(this.state.localTracks.videoTrack);
          }
      
          // Create screen sharing video track
          const screenVideoTrack = await AgoraRTC.createScreenVideoTrack();
      
          this.state.screenTracks = { videoTrack: screenVideoTrack };
      
          // Play the screen track in local UI
          screenShareWrapper.style.display = 'block';
          screenVideoTrack.play('screen-share-container');
          document.querySelector('.local-stream-wrapper').style.width = '50%';
      
          // Publish the screen video track
          await this.state.agoraRtcClient.publish(screenVideoTrack);
      
          // Update UI
          screenShareBtn.innerHTML = '<i class="bi bi-display-fill"></i>';
      
          const self = this;
      
          // When user stops screen share from browser prompt
          screenVideoTrack.on('track-ended', async () => {
            screenVideoTrack.stop();
            screenVideoTrack.close();
      
            if (self.state.agoraRtcClient) {
              await self.state.agoraRtcClient.unpublish([screenVideoTrack]);
            }
      
            self.state.screenTracks = null;
      
            // Re-publish camera video track if needed
            if (self.state.localTracks?.videoTrack) {
              await self.state.agoraRtcClient.publish(self.state.localTracks.videoTrack);
            }
      
            // Reset UI
            screenShareBtn.innerHTML = '<i class="bi bi-display"></i>';
            screenShareWrapper.style.display = 'none';
            document.querySelector('.local-stream-wrapper').style.width = '100%';
          });
      
        } catch (error) {
          console.error('Error sharing screen:', error);
          this.showError('Failed to share screen: ' + error.message);
      
          // UI reset on error
          screenShareBtn.innerHTML = '<i class="bi bi-display"></i>';
          screenShareWrapper.style.display = 'none';
          document.querySelector('.local-stream-wrapper').style.width = '100%';
      
          // Re-publish camera track if screen share failed
          if (this.state.localTracks?.videoTrack) {
            await this.state.agoraRtcClient.publish(this.state.localTracks.videoTrack);
          }
        }
      },
      
    // Toggle interaction panel visibility
    toggleInteractionPanel: function() {
      const interactionSection = document.querySelector('.interaction-section');
      const videoSection = document.querySelector('.video-section');
      const button = document.getElementById('toggle-interaction-btn');
      
      if (interactionSection.style.display === 'none') {
        interactionSection.style.display = 'flex';
        videoSection.style.width = '70%';
        button.innerHTML = '<i class="bi bi-chat-dots-fill"></i>';
      } else {
        interactionSection.style.display = 'none';
        videoSection.style.width = '100%';
        button.innerHTML = '<i class="bi bi-chat-dots"></i>';
      }
    },
    
    // Send chat message
    sendChatMessage: function() {
      const chatInput = document.getElementById('live-chat-input');
      const message = chatInput.value.trim();
      
      if (!message) return;
      
      // Clear the input
      chatInput.value = '';
      
      // Add message to the chat
      this.addChatMessage('You (Host)', message, true);
      
      // Send the message via WebSocket if available
      this.sendLivestreamChatMessage(message);
    },
    
    // Send a chat message via WebSocket
    sendLivestreamChatMessage: function(message) {
      // Use existing socket if available - don't create a new one
      if (!window.socket || window.socket.readyState !== WebSocket.OPEN) {
        console.error("WebSocket is not open");
        return false;
      }
      
      const messageData = {
        type: 'livestream_chat',
        message: message,
        sender: this.getCurrentUserName(),
        sender_name: this.getCurrentUserName(),
        room_id: this.state.currentRoomId,
        room_url: this.state.currentRoomId,
        role:"teacher",
        stream_id: this.state.currentStreamId,
        timestamp: new Date().toISOString(),

      };
      
      window.socket.send(JSON.stringify(messageData));
      return true;
    },
    
    // Function to add a chat message to the UI
    addChatMessage: function(sender, message, isHost = false) {
      const chatMessages = document.getElementById('live-chat-messages');
      if (!chatMessages) return;
      
      const messageElement = document.createElement('div');
      messageElement.classList.add('chat-message');
      
      if (isHost) {
        messageElement.classList.add('host-message');
      }
      
      messageElement.innerHTML = `
        <div class="message-sender">${sender}</div>
        <div class="message-content">${message}</div>
      `;
      
      chatMessages.appendChild(messageElement);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    },
    
    // Function to add a question to the UI
    addQuestion: function(sender, question) {
      const questionsList = document.getElementById('live-questions-list');
      if (!questionsList) return;
      
      const questionElement = document.createElement('div');
      questionElement.classList.add('question-item');
      
      questionElement.innerHTML = `
        <div class="question-sender">${sender}</div>
        <div class="question-content">${question}</div>
        <div class="question-actions">
          <button class="answer-question-btn">Answer</button>
          <button class="dismiss-question-btn">Dismiss</button>
        </div>
      `;
      
      const self = this;
      // Add event listeners to the buttons
      questionElement.querySelector('.answer-question-btn').addEventListener('click', function() {
        // Highlight this question as being answered
        this.closest('.question-item').classList.add('being-answered');
        
        // Add a system message to the chat
        self.addChatMessage('System', `Now answering: "${question}"`, false);
      });
      
      questionElement.querySelector('.dismiss-question-btn').addEventListener('click', function() {
        // Remove this question from the list
        this.closest('.question-item').remove();
      });
      
      questionsList.appendChild(questionElement);
      questionsList.scrollTop = questionsList.scrollHeight;
    },
    
    // End livestream function
    endLivestream: async function() {
      if (!this.state.isLive || !this.state.currentStreamId) {
        console.warn('No active livestream to end.');
        return false;
      }
      
      try {
        this.showLoading('Ending livestream...');
        
        // Call the server to end the livestream
        const response = await fetch('/end-livestream/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': this.getCsrfToken()
          },
          body: JSON.stringify({
            stream_id: this.state.currentStreamId,
            teacher_id: this.getCurrentUserId()
          })
        });
        
        const data = await response.json();
        
        // Leave the Agora channel regardless of server response
        await this.leaveChannel();
        
        if (!data.success) {
          console.warn('Server reported error ending livestream:', data.error);
        }
        
        // Reset stream state
        this.state.isLive = false;
        this.stopStreamTimer();
        this.updateStreamStatus('ended');
        
        // Remove the enhanced streaming interface
        const interfaceContainer = document.getElementById('enhanced-streaming-interface');
        if (interfaceContainer) {
          interfaceContainer.remove();
        }
        
        this.hideLoading();
        this.showToast('Livestream ended successfully.', 'success');
        
        return true;
      } catch (error) {
        console.error('Error ending livestream:', error);
        
        // Try to leave the channel anyway
        await this.leaveChannel();
        
        // Remove the enhanced streaming interface
        const interfaceContainer = document.getElementById('enhanced-streaming-interface');
        if (interfaceContainer) {
          interfaceContainer.remove();
        }
        
        this.hideLoading();
        this.showError('Error ending livestream, but stream was stopped.');
        return false;
      }
    },
    
    // Leave the current channel
    leaveChannel: async function() {
      try {
        // Close and dispose of local tracks
        if (this.state.localTracks) {
          for (const track of Object.values(this.state.localTracks)) {
            if (track) {
              track.stop();
              track.close();
            }
          }
          this.state.localTracks = null;
        }
        
        // Close and dispose of screen sharing tracks
        if (this.state.screenTracks) {
          for (const track of Object.values(this.state.screenTracks)) {
            if (track) {
              track.stop();
              track.close();
            }
          }
          this.state.screenTracks = null;
        }
        
        // Leave the channel
        if (this.state.agoraRtcClient) {
          await this.state.agoraRtcClient.leave();
          console.log('Left the channel successfully');
        }
        
        // Reset state
        this.state.agoraRtcClient = null;
        this.state.isLive = false;
        this.state.currentChannelName = null;
        
        // Reset UI
        this.stopStreamTimer();
        this.updateStreamStatus('disconnected');
        
        return true;
      } catch (error) {
        console.error('Error leaving channel:', error);
        return false;
      }
    },
    
    // Schedule a livestream
    handleScheduleLivestream: async function() {
      const title = document.getElementById('livestreamTitle').value.trim();
      const description = document.getElementById('livestreamDescription').value.trim();
      const date = document.getElementById('livestreamDate').value;
      const time = document.getElementById('livestreamTime').value;
      const duration = document.getElementById('livestreamDuration').value;
      const notifyStudents = document.getElementById('notifyStudents').checked;
      
      if (!title) {
        document.getElementById('livestreamTitle').classList.add('is-invalid');
        return;
      }
      
      if (!date) {
        document.getElementById('livestreamDate').classList.add('is-invalid');
        return;
      }
      
      if (!time) {
        document.getElementById('livestreamTime').classList.add('is-invalid');
        return;
      }
      
      try {
        const createButton = document.getElementById('createLivestreamBtn');
        createButton.disabled = true;
        createButton.innerHTML = '<i class="bi bi-hourglass-split"></i> Scheduling...';
        
        const success = await this.scheduleLivestream(
          this.state.currentRoomId,
          title,
          description,
          date,
          time,
          duration,
          notifyStudents
        );
        
        if (success) {
          // Close the modal
          const modal = bootstrap.Modal.getInstance(document.getElementById('scheduleLivestreamFormModal'));
          if (modal) {
            modal.hide();
          }
          
          // Reload scheduled livestreams
          this.loadScheduledLivestreams();
          
          // Show success message
          this.showToast('Livestream scheduled successfully!', 'success');
        }
      } catch (error) {
        console.error('Error scheduling livestream:', error);
        
        document.getElementById('scheduleLivestreamError').textContent = 'Failed to schedule livestream. Please try again.';
        document.getElementById('scheduleLivestreamError').style.display = 'block';
      } finally {
        const createButton = document.getElementById('createLivestreamBtn');
        createButton.disabled = false;
        createButton.innerHTML = 'Schedule Livestream';
      }
    },
    
    // Schedule a livestream
    scheduleLivestream: async function(roomId, title, description, scheduledDate, scheduledTime, durationMinutes, notifyStudents) {
      try {
        // Format the datetime properly
        const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
        const isoDateTime = scheduledDateTime.toISOString();
        
        const response = await fetch('/schedule-livestream/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': this.getCsrfToken()
          },
          body: JSON.stringify({
            teacher_id: this.getCurrentUserId(),
            room_id: roomId,
            title: title,
            description: description,
            scheduled_time: isoDateTime,
            duration: durationMinutes,
            notify_students: notifyStudents
          })
        });
        
        const data = await response.json();
        
        if (!data.success) {
          this.showError(data.error || 'Failed to schedule livestream.');
          return false;
        }
        
        return true;
      } catch (error) {
        console.error('Error scheduling livestream:', error);
        this.showError('Failed to schedule livestream. Please try again.');
        return false;
      }
    },
    
    // Load scheduled livestreams
    loadScheduledLivestreams: async function() {
      if (!this.state.currentRoomId) {
        console.warn("No room ID available for loading scheduled livestreams");
        return;
      }
      
      try {
        // Show loading indicators
        const upcomingLoading = document.getElementById('upcoming-loading');
        const pastLoading = document.getElementById('past-loading');
        const noUpcomingStreams = document.getElementById('no-upcoming-streams');
        const noPastStreams = document.getElementById('no-past-streams');
        
        if (upcomingLoading) upcomingLoading.style.display = 'block';
        if (pastLoading) pastLoading.style.display = 'block';
        if (noUpcomingStreams) noUpcomingStreams.style.display = 'none';
        if (noPastStreams) noPastStreams.style.display = 'none';
        
        // Clear existing content
        const upcomingList = document.getElementById('upcomingStreamsList');
        const pastList = document.getElementById('pastStreamsList');
        
        if (upcomingList) {
          // Keep the loading indicator
          const loading = upcomingList.querySelector('#upcoming-loading');
          upcomingList.innerHTML = '';
          if (loading) upcomingList.appendChild(loading);
        }
        
        if (pastList) {
          // Keep the loading indicator
          const loading = pastList.querySelector('#past-loading');
          pastList.innerHTML = '';
          if (loading) pastList.appendChild(loading);
        }
        
        // Fetch scheduled livestreams
        const livestreams = await this.getScheduledLivestreams(this.state.currentRoomId);
        
        // Hide loading indicators
        if (upcomingLoading) upcomingLoading.style.display = 'none';
        if (pastLoading) pastLoading.style.display = 'none';
        
        // Process upcoming livestreams
        if (upcomingList) {
          if (livestreams.upcoming && livestreams.upcoming.length > 0) {
            livestreams.upcoming.forEach(stream => {
              upcomingList.appendChild(this.createLivestreamCard(stream, 'upcoming'));
            });
          } else {
            if (noUpcomingStreams) noUpcomingStreams.style.display = 'block';
          }
        }
        
        // Process past livestreams
        if (pastList) {
          if (livestreams.past && livestreams.past.length > 0) {
            livestreams.past.forEach(stream => {
              pastList.appendChild(this.createLivestreamCard(stream, 'past'));
            });
          } else {
            if (noPastStreams) noPastStreams.style.display = 'block';
          }
        }
      } catch (error) {
        console.error('Error loading scheduled livestreams:', error);
        
        // Hide loading indicators
        const upcomingLoading = document.getElementById('upcoming-loading');
        const pastLoading = document.getElementById('past-loading');
        const noUpcomingStreams = document.getElementById('no-upcoming-streams');
        const noPastStreams = document.getElementById('no-past-streams');
        
        if (upcomingLoading) upcomingLoading.style.display = 'none';
        if (pastLoading) pastLoading.style.display = 'none';
        
        // Show error message
        if (noUpcomingStreams) {
          noUpcomingStreams.style.display = 'block';
          noUpcomingStreams.innerHTML = '<p>Error loading livestreams. Please try again.</p>';
        }
        
        if (noPastStreams) {
          noPastStreams.style.display = 'block';
          noPastStreams.innerHTML = '<p>Error loading livestreams. Please try again.</p>';
        }
      }
    },
    
    // Create a livestream card UI element
    createLivestreamCard: function(stream, type) {
      const card = document.createElement('div');
      card.className = 'livestream-card';
      
      // Format date and time
      const streamDate = new Date(stream.scheduled_time);
      const formattedDate = streamDate.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      const formattedTime = streamDate.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // Card header with title and status
      let statusClass = type === 'upcoming' ? 'upcoming' : 'past';
      let statusText = type === 'upcoming' ? 'Upcoming' : 'Ended';
      
      // If it's an upcoming stream but it's already started
      if (type === 'upcoming' && stream.is_live) {
        statusClass = 'live';
        statusText = 'Live Now';
      }
      
      // Create the card content
      card.innerHTML = `
        <div class="livestream-header">
          <div>
            <h3 class="livestream-title">${stream.title}</h3>
            <p class="livestream-meta">
              <i class="bi bi-calendar"></i> ${formattedDate} at ${formattedTime}
              ${stream.duration ? `<span class="mx-2">|</span> <i class="bi bi-clock"></i> ${stream.duration} min` : ''}
            </p>
          </div>
          <span class="livestream-status ${statusClass}">${statusText}</span>
        </div>
        
        ${stream.description ? `<p class="livestream-description">${stream.description}</p>` : ''}
        
        <div class="livestream-footer">
          <div>
            ${type === 'upcoming' && !stream.is_live ? this.createCountdownHTML(streamDate) : ''}
          </div>
          <div class="livestream-actions">
            ${type === 'upcoming' && !stream.is_live ? 
              `<button class="btn btn-sm btn-outline-secondary edit-stream-btn" data-stream-id="${stream.id}">
                 <i class="bi bi-pencil"></i>
               </button>
               <button class="btn btn-sm btn-outline-danger cancel-stream-btn" data-stream-id="${stream.id}">
                 <i class="bi bi-x-circle"></i>
               </button>` : ''}
            ${type === 'upcoming' && stream.is_live ? 
              `<button class="btn btn-sm btn-danger join-stream-btn" data-stream-id="${stream.id}">
                 <i class="bi bi-broadcast"></i> Join Live
               </button>` : ''}
          </div>
        </div>
      `;
      
      // Add event listeners
      const self = this;
      if (type === 'upcoming' && !stream.is_live) {
        card.querySelector('.edit-stream-btn')?.addEventListener('click', function() {
          // Handle edit action
          self.editScheduledStream(stream.id);
        });
        
        card.querySelector('.cancel-stream-btn')?.addEventListener('click', function() {
          // Handle cancel action
          self.cancelScheduledStream(stream.id);
        });
      }
      
      if (type === 'upcoming' && stream.is_live) {
        card.querySelector('.join-stream-btn')?.addEventListener('click', function() {
          // Handle join action
          self.joinLivestream(stream.id);
        });
      }
      
      return card;
    },
    
    // Create countdown HTML
    createCountdownHTML: function(targetDate) {
      const now = new Date();
      const diffTime = targetDate - now;
      
      if (diffTime <= 0) return '';
      
      // Calculate days, hours, minutes
      const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
      
      return `
        <div class="countdown-timer">
          ${days > 0 ? `
            <div class="countdown-segment">
              <span class="countdown-number">${days}</span>
              <span class="countdown-label">days</span>
            </div>
          ` : ''}
          <div class="countdown-segment">
            <span class="countdown-number">${hours}</span>
            <span class="countdown-label">hours</span>
          </div>
          <div class="countdown-segment">
            <span class="countdown-number">${minutes}</span>
            <span class="countdown-label">mins</span>
          </div>
        </div>
      `;
    },
    
    // Edit a scheduled livestream
    editScheduledStream: function(scheduleId) {
      // This would typically open a modal for editing
      console.log('Edit scheduled stream:', scheduleId);
      this.showToast('Edit feature coming soon', 'info');
    },
    
    // Cancel a scheduled livestream
    cancelScheduledStream: async function(scheduleId) {
      if (!confirm('Are you sure you want to cancel this scheduled livestream?')) {
        return;
      }
      
      try {
        const response = await fetch('/cancel-scheduled-stream/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': this.getCsrfToken()
          },
          body: JSON.stringify({
            schedule_id: scheduleId,
            teacher_id: this.getCurrentUserId()
          })
        });
        
        const data = await response.json();
        
        if (!data.success) {
          this.showToast(data.error || 'Failed to cancel scheduled livestream.', 'error');
          return false;
        }
        
        this.showToast('Scheduled livestream canceled successfully.', 'success');
        this.loadScheduledLivestreams(); // Reload the list
        return true;
      } catch (error) {
        console.error('Error canceling scheduled livestream:', error);
        this.showToast('Failed to cancel livestream. Please try again.', 'error');
        return false;
      }
    },
    
    // Get scheduled livestreams for a room
    getScheduledLivestreams: async function(roomId) {
      try {
        const response = await fetch(`/get-scheduled-streams/?room_id=${roomId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        const data = await response.json();
        
        if (!data.success) {
          console.error('Failed to fetch scheduled livestreams:', data.error);
          return {
            upcoming: [],
            past: []
          };
        }
        
        return {
          upcoming: data.upcoming_streams || [],
          past: data.past_streams || []
        };
      } catch (error) {
        console.error('Error fetching scheduled livestreams:', error);
        return {
          upcoming: [],
          past: []
        };
      }
    },
    
    // Timer functionality
    startStreamTimer: function() {
      this.streamDuration = 0;
      this.updateTimerDisplay();
      
      this.state.streamTimerInterval = setInterval(() => {
        this.streamDuration += 1;
        this.updateTimerDisplay();
      }, 1000);
    },
    
    stopStreamTimer: function() {
      if (this.state.streamTimerInterval) {
        clearInterval(this.state.streamTimerInterval);
        this.state.streamTimerInterval = null;
      }
    },
    
    updateTimerDisplay: function() {
      const timerElement = document.getElementById(this.elements.streamTimerId);
      if (!timerElement) return;
      
      const hours = Math.floor(this.streamDuration / 3600);
      const minutes = Math.floor((this.streamDuration % 3600) / 60);
      const seconds = this.streamDuration % 60;
      
      const formattedTime = 
        (hours > 0 ? hours + ':' : '') + 
        (minutes < 10 ? '0' : '') + minutes + ':' + 
        (seconds < 10 ? '0' : '') + seconds;
      
      timerElement.textContent = formattedTime;
    },
    
    // Helper function to update stream status
    updateStreamStatus: function(status) {
      const statusElement = document.getElementById(this.elements.streamStatusId);
      if (!statusElement) return;
      
      statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
      
      // Update status classes
      statusElement.className = 'stream-status';
      statusElement.classList.add('status-' + status);
    },
    
    // UI helpers
    showLoading: function(message = 'Loading...') {
      // Create or update loading element
      let loadingElement = document.getElementById('agora-loading');
      
      if (!loadingElement) {
        loadingElement = document.createElement('div');
        loadingElement.id = 'agora-loading';
        loadingElement.className = 'agora-loading-overlay';
        document.body.appendChild(loadingElement);
      }
      
      loadingElement.innerHTML = `
        <div class="agora-loading-spinner"></div>
        <div class="agora-loading-message">${message}</div>
      `;
      
      loadingElement.style.display = 'flex';
    },
    
    hideLoading: function() {
      const loadingElement = document.getElementById('agora-loading');
      if (loadingElement) {
        loadingElement.style.display = 'none';
      }
    },
    
    showError: function(message) {
      const errorAlert = document.getElementById('liveErrorAlert');
      if (errorAlert) {
        errorAlert.textContent = message;
        errorAlert.style.display = 'block';
        
        setTimeout(() => {
          errorAlert.style.display = 'none';
        }, 5000);
      } else {
        this.showToast(message, 'error');
      }
    },
    
    showDeviceError: function(message) {
      const errorAlert = document.getElementById('liveErrorAlert');
      if (errorAlert) {
        errorAlert.textContent = message;
        errorAlert.style.display = 'block';
      } else {
        this.showToast(message, 'error');
      }
    },
    
    showToast: function(message, type = 'info') {
      // Create a toast container if it doesn't exist
      let toastContainer = document.getElementById('toast-container');
      
      if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
      }
      
      // Create a unique ID for this toast
      const toastId = 'toast-' + Date.now();
      
      // Create the toast element
      const toast = document.createElement('div');
      toast.id = toastId;
      toast.className = `toast toast-${type}`;
      toast.innerHTML = `
        <div class="toast-content">
          <i class="bi ${type === 'success' ? 'bi-check-circle' : 
                         type === 'error' ? 'bi-exclamation-circle' : 
                         'bi-info-circle'}"></i>
          <span>${message}</span>
        </div>
        <button type="button" class="toast-close" onclick="document.getElementById('${toastId}').remove();">
          <i class="bi bi-x"></i>
        </button>
      `;
      
      // Add to the container
      toastContainer.appendChild(toast);
      
      // Show the toast with animation
      setTimeout(() => {
        toast.classList.add('show');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
          toast.classList.remove('show');
          setTimeout(() => {
            toast.remove();
          }, 300);
        }, 5000);
      }, 10);
    },
    
    // Add CSS styles to the page
    addEnhancedInterfaceStyles: function() {
      const styleId = 'enhanced-streaming-styles';
      
      // Only add styles once
      if (document.getElementById(styleId)) return;
      
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .enhanced-streaming-interface {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.6);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .streaming-status {
          display: flex;
          align-items: center;
        }
        
        .streaming-indicator {
          width: 12px;
          height: 12px;
          background-color: #f44336;
          border-radius: 50%;
          margin-right: 8px;
          animation: pulse 1.5s infinite;
        }
        
        .status-text {
          font-weight: 600;
          margin-right: 15px;
        }
        
        .streaming-timer {
          font-family: monospace;
          font-size: 1.1rem;
        }
        
        .streaming-viewers {
          display: flex;
          align-items: center;
          font-size: 0.9rem;
        }
        
        .streaming-viewers i {
          margin-right: 5px;
        }
        
        .streaming-body {
          flex: 1;
          display: flex;
          overflow: hidden;
        }
        
        .video-section {
          width: 70%;
          height: 100%;
          display: flex;
          flex-wrap: wrap;
          overflow: hidden;
          background-color: #0f0f0f;
        }
        
        .local-stream-wrapper, .screen-share-wrapper {
          position: relative;
          height: 100%;
          width: 100%;
          overflow: hidden;
          transition: width 0.3s ease;
        }
        
        .stream-container {
          width: 100%;
          height: 100%;
          background-color: #2a2a2a;
          overflow: hidden;
        }
        
        .stream-label {
          position: absolute;
          bottom: 10px;
          left: 10px;
          background-color: rgba(0, 0, 0, 0.6);
          color: white;
          padding: 5px 10px;
          border-radius: 4px;
          font-size: 0.8rem;
        }
        
        .interaction-section {
          width: 30%;
          height: 100%;
          display: flex;
          flex-direction: column;
          border-left: 1px solid rgba(255, 255, 255, 0.1);
          background-color: #212121;
        }
        
        .chat-container, .questions-container {
          display: flex;
          flex-direction: column;
          height: 50%;
          overflow: hidden;
        }
        
        .chat-container {
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .chat-header, .questions-header {
          padding: 10px 15px;
          background-color: rgba(0, 0, 0, 0.3);
        }
        
        .chat-header h3, .questions-header h3 {
          margin: 0;
          font-size: 1rem;
        }
        
        .chat-messages, .questions-list {
          flex: 1;
          overflow-y: auto;
          padding: 10px;
        }
        
        .chat-input-container {
          display: flex;
          padding: 10px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .chat-input-container input {
          flex: 1;
          background-color: rgba(255, 255, 255, 0.1);
          border: none;
          border-radius: 4px;
          color: white;
          padding: 8px 12px;
          margin-right: 10px;
        }
        
        .chat-input-container button {
          background-color: #4285f4;
          color: white;
          border: none;
          border-radius: 4px;
          width: 36px;
          height: 36px;
          cursor: pointer;
        }
        
        .chat-message {
          margin-bottom: 10px;
          background-color: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
          padding: 8px 12px;
        }
        
        .chat-message.host-message {
          background-color: rgba(66, 133, 244, 0.2);
        }
        
        .message-sender {
          font-weight: 600;
          font-size: 0.85rem;
          margin-bottom: 4px;
        }
        
        .message-content {
          word-break: break-word;
        }
        
        .system-message {
          color: #a0a0a0;
          font-style: italic;
          text-align: center;
          padding: 15px;
        }
        
        .question-item {
          margin-bottom: 15px;
          background-color: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
          padding: 10px;
          transition: background-color 0.3s ease;
        }
        
        .question-item.being-answered {
          background-color: rgba(76, 175, 80, 0.2);
        }
        
        .question-sender {
          font-weight: 600;
          font-size: 0.85rem;
          margin-bottom: 5px;
        }
        
        .question-content {
          margin-bottom: 10px;
        }
        
        .question-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
        
        .answer-question-btn, .dismiss-question-btn {
          padding: 4px 8px;
          border: none;
          border-radius: 4px;
          font-size: 0.8rem;
          cursor: pointer;
        }
        
        .answer-question-btn {
          background-color: #4CAF50;
          color: white;
        }
        
        .dismiss-question-btn {
          background-color: #f44336;
          color: white;
        }
        
        .streaming-controls {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 15px;
          background-color: rgba(0, 0, 0, 0.6);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .control-button {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background-color: rgba(255, 255, 255, 0.1);
          border: none;
          color: white;
          font-size: 1.2rem;
          margin: 0 10px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .control-button:hover {
          background-color: rgba(255, 255, 255, 0.2);
        }
        
        .control-button.end-stream {
          background-color: #f44336;
          color: white;
          border-radius: 25px;
          width: auto;
          padding: 0 20px;
        }
        
        .control-button.end-stream:hover {
          background-color: #d32f2f;
        }
        
        /* Loading overlay */
        .agora-loading-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.7);
          z-index: 9999;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }
        
        .agora-loading-spinner {
          border: 4px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top: 4px solid white;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin-bottom: 15px;
        }
        
        .agora-loading-message {
          color: white;
          font-size: 18px;
        }
        
        /* Toast notifications */
        .toast-container {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 9999;
        }
        
        .toast {
          background-color: #333;
          color: white;
          padding: 12px 20px;
          border-radius: 4px;
          margin-top: 10px;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
          display: flex;
          justify-content: space-between;
          align-items: center;
          min-width: 250px;
          max-width: 350px;
          transition: opacity 0.3s, transform 0.3s;
          opacity: 0;
          transform: translateY(20px);
        }
        
        .toast.show {
          opacity: 1;
          transform: translateY(0);
        }
        
        .toast-success {
          background-color: #4CAF50;
        }
        
        .toast-error {
          background-color: #f44336;
        }
        
        .toast-info {
          background-color: #2196F3;
        }
        
        .toast-content {
          display: flex;
          align-items: center;
        }
        
        .toast-content i {
          margin-right: 10px;
        }
        
        .toast-close {
          background: none;
          border: none;
          color: white;
          opacity: 0.7;
          cursor: pointer;
        }
        
        .toast-close:hover {
          opacity: 1;
        }
        
        /* Animations */
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        /* Additional styles for preview */
        #local-stream-container {
          width: 100% !important;
          height: 100% !important;
          display: block !important;
          position: relative !important;
          overflow: hidden !important;
          background-color: #333 !important;
        }
        
        .agora_video_player {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
      `;
      
      document.head.appendChild(style);
    },
    
    // Helper methods for accessing data and auth tokens
    getCurrentUserId: function() {
      const teacherNameElement = document.getElementById('teacher-name');
      if (teacherNameElement) {
        return teacherNameElement.dataset.teacherName;
      }
      
      console.warn('Could not determine current user ID');
      return null;
    },
    
    getCurrentUserName: function() {
      const teacherNameElement = document.getElementById('teacher-name');
      if (teacherNameElement) {
        return teacherNameElement.dataset.teacherName;
      }
      
      console.warn('Could not determine current user name');
      return 'Teacher';
    },
    
    getCsrfToken: function() {
      const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1];
      
      return cookieValue || '';
    },
    
    // Helper to get media devices
    getMediaDevices: async function() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        console.error("Media devices API not supported in this browser");
        return {
          videoDevices: [],
          audioDevices: [],
          error: 'Media devices API not supported in this browser'
        };
      }
      
      try {
        // Request permissions
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        
        // Enumerate devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        // Filter by type
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        const audioDevices = devices.filter(device => device.kind === 'audioinput');
        
        return {
          videoDevices,
          audioDevices
        };
      } catch (error) {
        console.error('Error accessing media devices:', error);
        return {
          videoDevices: [],
          audioDevices: [],
          error: error.message || 'Error accessing camera and microphone'
        };
      }
    }
  };
  
  // Initialize module when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if we're on a page with livestream functionality
    if (document.getElementById('goLiveModal') || document.getElementById('scheduleLivestreamFormModal')) {
      // Initialize the module but don't start everything yet
      // Individual features will be initialized when needed
      LivestreamModule.init();
      
      // Add the enhanced interface styles
      LivestreamModule.addEnhancedInterfaceStyles();
      
      console.log("Livestream Module initialized successfully");
    }
  });
  
  // Add the remaining CSS styles for the livestream interface
  function addStreamingStyles() {
    const styleId = 'agora-streaming-styles';
    
    // Only add styles once
    if (document.getElementById(styleId)) return;
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Livestream Interface Styles */
      .enhanced-streaming-interface {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #1a1a1a;
        color: white;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      
      .streaming-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 20px;
        background-color: rgba(0, 0, 0, 0.6);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .streaming-status {
        display: flex;
        align-items: center;
      }
      
      .streaming-indicator {
        width: 12px;
        height: 12px;
        background-color: #f44336;
        border-radius: 50%;
        margin-right: 8px;
        animation: pulse 1.5s infinite;
      }
      
      .status-text {
        font-weight: 600;
        margin-right: 15px;
      }
      
      .streaming-timer {
        font-family: monospace;
        font-size: 1.1rem;
      }
      
      .streaming-viewers {
        display: flex;
        align-items: center;
        font-size: 0.9rem;
      }
      
      .streaming-viewers i {
        margin-right: 5px;
      }
      
      .streaming-body {
        flex: 1;
        display: flex;
        overflow: hidden;
      }
      
      .video-section {
        width: 70%;
        height: 100%;
        display: flex;
        flex-wrap: wrap;
        overflow: hidden;
        background-color: #0f0f0f;
      }
      
      .local-stream-wrapper, .screen-share-wrapper {
        position: relative;
        height: 100%;
        width: 100%;
        overflow: hidden;
        transition: width 0.3s ease;
      }
      
      .local-stream-wrapper.with-screen-share {
        width: 50%;
      }
      
      .stream-container {
        width: 100%;
        height: 100%;
        background-color: #2a2a2a;
        overflow: hidden;
      }
      
      .stream-label {
        position: absolute;
        bottom: 10px;
        left: 10px;
        background-color: rgba(0, 0, 0, 0.6);
        color: white;
        padding: 5px 10px;
        border-radius: 4px;
        font-size: 0.8rem;
      }
      
      .interaction-section {
        width: 30%;
        height: 100%;
        display: flex;
        flex-direction: column;
        border-left: 1px solid rgba(255, 255, 255, 0.1);
        background-color: #212121;
      }
      
      .chat-container, .questions-container {
        display: flex;
        flex-direction: column;
        height: 50%;
        overflow: hidden;
      }
      
      .chat-container {
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .chat-header, .questions-header {
        padding: 10px 15px;
        background-color: rgba(0, 0, 0, 0.3);
      }
      
      .chat-header h3, .questions-header h3 {
        margin: 0;
        font-size: 1rem;
      }
      
      .chat-messages, .questions-list {
        flex: 1;
        overflow-y: auto;
        padding: 10px;
      }
      
      .chat-input-container {
        display: flex;
        padding: 10px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .chat-input-container input {
        flex: 1;
        background-color: rgba(255, 255, 255, 0.1);
        border: none;
        border-radius: 4px;
        color: white;
        padding: 8px 12px;
        margin-right: 10px;
      }
      
      .chat-input-container button {
        background-color: #4285f4;
        color: white;
        border: none;
        border-radius: 4px;
        width: 36px;
        height: 36px;
        cursor: pointer;
      }
      
      .chat-message {
        margin-bottom: 10px;
        background-color: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
        padding: 8px 12px;
      }
      
      .chat-message.host-message {
        background-color: rgba(66, 133, 244, 0.2);
      }
      
      .message-sender {
        font-weight: 600;
        font-size: 0.85rem;
        margin-bottom: 4px;
      }
      
      .message-content {
        word-break: break-word;
      }
      
      .system-message {
        color: #a0a0a0;
        font-style: italic;
        text-align: center;
        padding: 15px;
      }
      
      .question-item {
        margin-bottom: 15px;
        background-color: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
        padding: 10px;
        transition: background-color 0.3s ease;
      }
      
      .question-item.being-answered {
        background-color: rgba(76, 175, 80, 0.2);
      }
      
      .question-sender {
        font-weight: 600;
        font-size: 0.85rem;
        margin-bottom: 5px;
      }
      
      .question-content {
        margin-bottom: 10px;
      }
      
      .question-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
      
      .answer-question-btn, .dismiss-question-btn {
        padding: 4px 8px;
        border: none;
        border-radius: 4px;
        font-size: 0.8rem;
        cursor: pointer;
      }
      
      .answer-question-btn {
        background-color: #4CAF50;
        color: white;
      }
      
      .dismiss-question-btn {
        background-color: #f44336;
        color: white;
      }
      
      .streaming-controls {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 15px;
        background-color: rgba(0, 0, 0, 0.6);
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .control-button {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background-color: rgba(255, 255, 255, 0.1);
        border: none;
        color: white;
        font-size: 1.2rem;
        margin: 0 10px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .control-button:hover {
        background-color: rgba(255, 255, 255, 0.2);
      }
      
      .control-button.end-stream {
        background-color: #f44336;
        color: white;
        border-radius: 25px;
        width: auto;
        padding: 0 20px;
      }
      
      .control-button.end-stream:hover {
        background-color: #d32f2f;
      }
      
      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
      }
    `;
    
    document.head.appendChild(style);
    console.log("Livestream styles added to document");
  }
  
  // Call the function to add styles
  document.addEventListener('DOMContentLoaded', function() {
    addStreamingStyles();
  });