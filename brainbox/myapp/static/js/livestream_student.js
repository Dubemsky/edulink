/**
 * Student Livestream Integration for EduLink
 * This module enables students to join teacher livestreams
 */

// Main module to handle student livestream viewing
const StudentLivestream = {
    // Configuration
    config: {
      appId: null,
      channel: null,
      token: null
    },
    
    // State management
    state: {
      agoraClient: null,
      remoteUsers: {},
      isJoined: false,
      currentStreamId: null,
      currentChannelName: null,
      currentRoomId: null
    },
    
    // Initialize the module
    init: function() {
      console.log("Initializing student livestream module...");
      
      // Get current room ID from the DOM
      const roomIdElement = document.getElementById('room-id-data');
      if (roomIdElement) {
        this.state.currentRoomId = roomIdElement.dataset.roomId;
      }
      
      // Set up notifications for active livestreams
      this.checkForActiveLivestreams();
      
      // Create or update livestream view modal
      this.createLivestreamModal();
      
      // Set up WebSocket listener for livestream notifications
      this.setupWebSocketListener();
      
      // If a modal toggle button exists, add listener
      const liveStreamButton = document.querySelector('.livestreams-button');
      if (liveStreamButton) {
        liveStreamButton.addEventListener('click', () => {
          this.loadUpcomingLivestreams();
        });
      }
      
      // Add listener to the upcoming livestreams modal
      const upcomingModal = document.getElementById('upcomingLivestreamsModal');
      if (upcomingModal) {
        upcomingModal.addEventListener('show.bs.modal', () => {
          this.loadUpcomingLivestreams();
        });
      }
      
      return this;
    },
    
    // Create the livestream viewing modal
    createLivestreamModal: function() {
      // Check if modal already exists
      if (document.getElementById('livestreamViewModal')) {
        return;
      }
      
      // Create modal HTML
      const modalHTML = `
        <div class="modal fade" id="livestreamViewModal" tabindex="-1" aria-labelledby="livestreamViewModalLabel" aria-hidden="true">
          <div class="modal-dialog modal-xl">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="livestreamViewModalLabel">
                  <i class="bi bi-broadcast"></i> <span id="livestream-title">Teacher's Livestream</span>
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <div class="row">
                  <div class="col-md-8">
                    <div id="livestream-video-container" class="livestream-video-container">
                      <div class="stream-placeholder">
                        <i class="bi bi-camera-video-off"></i>
                        <p>Waiting for teacher's stream to start...</p>
                      </div>
                    </div>
                    <div class="stream-info mt-2">
                      <span class="badge bg-danger live-badge">LIVE</span>
                      <span class="viewer-count ms-2"><i class="bi bi-people-fill"></i> <span id="viewer-count">0</span> viewers</span>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div class="livestream-chat">
                      <div class="chat-header">
                        <h6>Live Chat</h6>
                      </div>
                      <div id="livestream-chat-messages" class="chat-messages">
                        <div class="system-message">
                          Welcome to the livestream chat! Be respectful and engage with your teacher.
                        </div>
                      </div>
                      <div class="chat-input-area">
                        <input type="text" id="livestream-chat-input" placeholder="Type your message...">
                        <button id="livestream-chat-send">
                          <i class="bi bi-send"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Leave Stream</button>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Add modal to the page
      document.body.insertAdjacentHTML('beforeend', modalHTML);
      
      // Add styles
      this.addLivestreamStyles();
      
      // Set up modal event handlers
      const modal = document.getElementById('livestreamViewModal');
      if (modal) {
        // When modal is closed, leave the livestream
        modal.addEventListener('hidden.bs.modal', () => {
          this.leaveLivestream();
        });
        
        // Set up chat input handler
        const chatInput = document.getElementById('livestream-chat-input');
        const chatSendBtn = document.getElementById('livestream-chat-send');
        
        if (chatInput && chatSendBtn) {
          // Send on button click
          chatSendBtn.addEventListener('click', () => {
            this.sendChatMessage();
          });
          
          // Send on Enter key
          chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
              this.sendChatMessage();
            }
          });
        }
      }
    },
    
    // Add required styles
    addLivestreamStyles: function() {
      if (document.getElementById('livestream-styles')) return;
      
      const style = document.createElement('style');
      style.id = 'livestream-styles';
      style.textContent = `
        .livestream-video-container {
          position: relative;
          width: 100%;
          height: 400px;
          background-color: #111;
          border-radius: 6px;
          overflow: hidden;
        }
        
        .stream-placeholder {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #666;
        }
        
        .stream-placeholder i {
          font-size: 3rem;
          margin-bottom: 1rem;
        }
        
        .livestream-chat {
          height: 400px;
          display: flex;
          flex-direction: column;
          border: 1px solid #dee2e6;
          border-radius: 6px;
          overflow: hidden;
        }
        
        .chat-header {
          padding: 10px;
          background-color: #f8f9fa;
          border-bottom: 1px solid #dee2e6;
        }
        
        .chat-header h6 {
          margin: 0;
        }
        
        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 10px;
          background-color: white;
        }
        
        .chat-message {
          margin-bottom: 10px;
          padding: 8px 12px;
          border-radius: 6px;
          background-color: #f1f3f5;
        }
        
        .chat-message.own-message {
          background-color: #d1ecf1;
          margin-left: 20px;
        }
        
        .chat-message.teacher-message {
          background-color: #f8d7da;
        }
        
        .message-sender {
          font-weight: bold;
          margin-bottom: 3px;
          font-size: 0.85rem;
        }
        
        .message-content {
          word-break: break-word;
        }
        
        .system-message {
          text-align: center;
          color: #6c757d;
          font-style: italic;
          margin: 10px 0;
          font-size: 0.85rem;
        }
        
        .chat-input-area {
          display: flex;
          padding: 10px;
          background-color: #f8f9fa;
          border-top: 1px solid #dee2e6;
        }
        
        .chat-input-area input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #ced4da;
          border-radius: 4px 0 0 4px;
        }
        
        .chat-input-area button {
          background-color: #007bff;
          color: white;
          border: none;
          border-radius: 0 4px 4px 0;
          padding: 0 15px;
        }
        
        .live-badge {
          animation: pulse 1.5s infinite;
        }
        
        .viewer-count {
          color: #6c757d;
          font-size: 0.9rem;
        }
        
        .livestream-notification {
          position: fixed;
          bottom: 20px;
          left: 20px;
          width: 300px;
          background-color: white;
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          padding: 15px;
          z-index: 1050;
          border-left: 4px solid #dc3545;
          animation: slideIn 0.3s ease;
        }
        
        .livestream-notification-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        
        .livestream-notification-title {
          font-weight: bold;
          color: #dc3545;
        }
        
        .livestream-notification-close {
          background: none;
          border: none;
          font-size: 1.2rem;
          cursor: pointer;
        }
        
        .livestream-card {
          margin-bottom: 15px;
          border: 1px solid #dee2e6;
          border-radius: 6px;
          padding: 15px;
          transition: transform 0.2s;
        }
        
        .livestream-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        
        .livestream-card.live {
          border-color: #dc3545;
        }
        
        .livestream-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 10px;
        }
        
        .livestream-title {
          font-weight: bold;
          margin-bottom: 5px;
        }
        
        .livestream-meta {
          color: #6c757d;
          font-size: 0.85rem;
        }
        
        .livestream-status {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: bold;
        }
        
        .status-live {
          background-color: #dc3545;
          color: white;
          animation: pulse 1.5s infinite;
        }
        
        .status-upcoming {
          background-color: #007bff;
          color: white;
        }
        
        .countdown-timer {
          display: flex;
          margin-top: 10px;
        }
        
        .countdown-segment {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-right: 10px;
        }
        
        .countdown-number {
          font-size: 1.2rem;
          font-weight: bold;
          background-color: #f8f9fa;
          padding: 5px 8px;
          border-radius: 4px;
          min-width: 36px;
          text-align: center;
        }
        
        .countdown-label {
          font-size: 0.7rem;
          color: #6c757d;
          margin-top: 3px;
        }
        
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }
        
        @keyframes slideIn {
          from { transform: translateX(-50px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      
      document.head.appendChild(style);
    },
    
    // Check if there are any active livestreams in the current room
    checkForActiveLivestreams: function() {
      if (!this.state.currentRoomId) return;
      
      fetch(`/get-active-streams/?room_id=${this.state.currentRoomId}`)
        .then(response => response.json())
        .then(data => {
          if (data.success && data.streams && data.streams.length > 0) {
            // There is an active livestream
            const stream = data.streams[0]; // Get the first stream
            this.showLivestreamNotification(stream);
          }
        })
        .catch(error => {
          console.error("Error checking for active livestreams:", error);
        });
    },
    
    // Show a notification for active livestreams
    showLivestreamNotification: function(streamData) {
      // Don't show notification if already viewing a livestream
      if (this.state.isJoined) return;
      
      // Remove any existing notification
      const existingNotification = document.querySelector('.livestream-notification');
      if (existingNotification) {
        existingNotification.remove();
      }
      
      // Create notification
      const notification = document.createElement('div');
      notification.className = 'livestream-notification';
      notification.innerHTML = `
        <div class="livestream-notification-header">
          <div class="livestream-notification-title">
            <i class="bi bi-broadcast"></i> Live Now
          </div>
          <button class="livestream-notification-close">
            <i class="bi bi-x"></i>
          </button>
        </div>
        <div>
          <p><strong>${streamData.title || "Teacher's Livestream"}</strong></p>
          <p>Your teacher is currently livestreaming.</p>
        </div>
        <button class="btn btn-danger btn-sm w-100 mt-2 join-stream-btn">
          <i class="bi bi-play-fill"></i> Join Livestream
        </button>
      `;
      
      // Add event listeners
      notification.querySelector('.livestream-notification-close').addEventListener('click', () => {
        notification.remove();
      });
      
      notification.querySelector('.join-stream-btn').addEventListener('click', () => {
        notification.remove();
        this.joinLivestream(streamData.stream_id);
      });
      
      // Add to page
      document.body.appendChild(notification);
      
      // Auto remove after 30 seconds
      setTimeout(() => {
        if (document.body.contains(notification)) {
          notification.remove();
        }
      }, 30000);
    },
    
    // Join a livestream
    joinLivestream: async function(streamId) {
      try {
        // Show loading indicator
        this.showLoading("Joining livestream...");
        
        // Get user details
        const username = document.getElementById('room-id-data')?.dataset.username;
        
        if (!username) {
          this.hideLoading();
          this.showToast("Error: Could not identify user", "error");
          return;
        }
        
        // Request to join
        const response = await fetch('/join-livestream/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': this.getCsrfToken()
          },
          body: JSON.stringify({
            stream_id: streamId,
            user_id: username
          })
        });
        
        const data = await response.json();
        
        if (!data.success) {
          this.hideLoading();
          this.showToast(data.error || "Failed to join livestream", "error");
          return;
        }
        
        // Store stream info
        this.state.currentStreamId = streamId;
        
        // Update UI
        document.getElementById('livestream-title').textContent = data.stream_details.title || "Teacher's Livestream";
        
        // Initialize Agora client
        await this.initAgoraClient(data.app_id, data.channel_name, data.token, data.uid);
        
        // Show the modal
        const modal = document.getElementById('livestreamViewModal');
        if (modal) {
          const bsModal = new bootstrap.Modal(modal);
          bsModal.show();
        }
        
        this.hideLoading();
        this.showToast("You've joined the livestream", "success");
        
        // Notify about joining via websocket
        this.sendJoinNotification(streamId, username);
        
      } catch (error) {
        console.error("Error joining livestream:", error);
        this.hideLoading();
        this.showToast("Failed to connect to livestream", "error");
      }
    },
    
    // Initialize Agora client
    initAgoraClient: async function(appId, channelName, token, uid) {
      try {
        console.log("Initializing Agora client");
        
        // Create client
        this.state.agoraClient = AgoraRTC.createClient({ mode: 'live', codec: 'h264' });
        
        // Set role (students are audience)
        await this.state.agoraClient.setClientRole('audience');
        
        // Register event handlers
        this.registerAgoraEvents();
        
        // Join channel
        await this.state.agoraClient.join(appId, channelName, token, uid);
        
        // Update state
        this.state.isJoined = true;
        this.state.currentChannelName = channelName;
        
        console.log("Successfully joined Agora channel:", channelName);
        return true;
        
      } catch (error) {
        console.error("Error initializing Agora client:", error);
        throw error;
      }
    },
    
    // Register event handlers for Agora client
    registerAgoraEvents: function() {
      if (!this.state.agoraClient) return;
      
      // When teacher publishes video/audio tracks
      this.state.agoraClient.on('user-published', async (user, mediaType) => {
        await this.state.agoraClient.subscribe(user, mediaType);
        console.log("Subscribed to teacher's stream:", mediaType);
        
        if (mediaType === 'video') {
          // Store remote user
          this.state.remoteUsers[user.uid] = user;
          
          // Create container for video
          const videoContainer = document.getElementById('livestream-video-container');
          
          // Remove placeholder if exists
          const placeholder = videoContainer.querySelector('.stream-placeholder');
          if (placeholder) {
            placeholder.remove();
          }
          
          // Create div for remote video if needed
          let remoteDiv = document.getElementById(`remote-video-${user.uid}`);
          if (!remoteDiv) {
            remoteDiv = document.createElement('div');
            remoteDiv.id = `remote-video-${user.uid}`;
            remoteDiv.style.width = '100%';
            remoteDiv.style.height = '100%';
            videoContainer.appendChild(remoteDiv);
          }
          
          // Play the video in the container
          user.videoTrack.play(remoteDiv.id);
        }
        
        if (mediaType === 'audio') {
          // Play audio
          user.audioTrack.play();
        }
      });
      
      // When teacher stops publishing tracks
      this.state.agoraClient.on('user-unpublished', (user, mediaType) => {
        console.log("Teacher unpublished:", mediaType);
        
        if (mediaType === 'video') {
          // Check if we have other video tracks
          const videoContainer = document.getElementById('livestream-video-container');
          
          // If no video, show placeholder
          if (Object.keys(this.state.remoteUsers).length === 0) {
            videoContainer.innerHTML = `
              <div class="stream-placeholder">
                <i class="bi bi-camera-video-off"></i>
                <p>Teacher's video is currently off...</p>
              </div>
            `;
          }
        }
      });
      
      // When a user leaves (teacher ends stream)
      this.state.agoraClient.on('user-left', (user) => {
        console.log("User left:", user.uid);
        
        // Remove from remoteUsers
        if (this.state.remoteUsers[user.uid]) {
          delete this.state.remoteUsers[user.uid];
        }
        
        // Show placeholder
        const videoContainer = document.getElementById('livestream-video-container');
        videoContainer.innerHTML = `
          <div class="stream-placeholder">
            <i class="bi bi-camera-video-off"></i>
            <p>Waiting for teacher's video...</p>
          </div>
        `;
        
        // Add system message
        this.addChatMessage("System", "Teacher's stream has been disconnected.");
      });
    },
    
    // Leave the livestream
    leaveLivestream: async function() {
      if (!this.state.isJoined) return;
      
      try {
        // Leave Agora channel
        if (this.state.agoraClient) {
          await this.state.agoraClient.leave();
        }
        
        // Notify server
        await fetch('/leave-livestream/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': this.getCsrfToken()
          },
          body: JSON.stringify({
            stream_id: this.state.currentStreamId,
            user_id: document.getElementById('room-id-data')?.dataset.username
          })
        });
        
        // Reset state
        this.state.isJoined = false;
        this.state.currentStreamId = null;
        this.state.currentChannelName = null;
        this.state.remoteUsers = {};
        this.state.agoraClient = null;
        
        console.log("Left livestream successfully");
        
      } catch (error) {
        console.error("Error leaving livestream:", error);
      }
    },
    
    // Send join notification through WebSocket
    sendJoinNotification: function(streamId, username) {
      if (!window.socket || window.socket.readyState !== WebSocket.OPEN) {
        console.warn("WebSocket not available for join notification");
        return;
      }
      
      const notification = {
        type: 'livestream_join',
        stream_id: streamId,
        room_id: this.state.currentRoomId,
        username: username,
        timestamp: new Date().toISOString()
      };
      
      window.socket.send(JSON.stringify(notification));
    },
    
    // Send chat message
    sendChatMessage: function() {
      const chatInput = document.getElementById('livestream-chat-input');
      if (!chatInput) return;
      
      const message = chatInput.value.trim();
      if (!message) return;
      
      const username = document.getElementById('room-id-data')?.dataset.username;
      if (!username) return;
      
      // Clear input
      chatInput.value = '';
      
      // Add message to chat UI
      this.addChatMessage(username, message, true);
      
      // Send message via WebSocket
      if (window.socket && window.socket.readyState === WebSocket.OPEN) {
        const chatMessage = {
          type: 'livestream_chat',
          stream_id: this.state.currentStreamId,
          room_id: this.state.currentRoomId,
          sender: username,
          sender_name: username,
          message: message,
          timestamp: new Date().toISOString()
        };
        
        window.socket.send(JSON.stringify(chatMessage));
      }
    },
    
    // Add chat message to UI
    addChatMessage: function(sender, message, isOwnMessage = false) {
      const chatMessages = document.getElementById('livestream-chat-messages');
      if (!chatMessages) return;
      
      const messageElement = document.createElement('div');
      messageElement.className = 'chat-message';
      
      // Add appropriate class based on sender
      if (isOwnMessage) {
        messageElement.classList.add('own-message');
      } else if (sender === "System") {
        messageElement.classList.add('system-message');
        messageElement.textContent = message;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return;
      } else if (sender === this.state.currentStreamId) {
        messageElement.classList.add('teacher-message');
      }
      
      // Create message structure
      messageElement.innerHTML = `
        <div class="message-sender">${sender}</div>
        <div class="message-content">${message}</div>
      `;
      
      // Add to chat and scroll to bottom
      chatMessages.appendChild(messageElement);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    },
    
    // Setup WebSocket listener for livestream events
    setupWebSocketListener: function() {
      if (!window.socket) return;
      
      const originalOnMessage = window.socket.onmessage;
      
      window.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle livestream-specific messages
          if (data.type && data.type.startsWith('livestream_')) {
            this.handleWebSocketMessage(data);
          }
          
          // Call original handler
          if (originalOnMessage) {
            originalOnMessage(event);
          }
        } catch (error) {
          console.error("Error in WebSocket message handling:", error);
          
          // Still call original handler
          if (originalOnMessage) {
            originalOnMessage(event);
          }
        }
      };
    },
    
    // Handle WebSocket messages related to livestreams
    handleWebSocketMessage: function(data) {
      switch (data.type) {
        case 'livestream_started':
        case 'livestream_start':
          // Show notification for new livestream
          this.checkForActiveLivestreams();
          break;
          
        case 'livestream_ended':
        case 'livestream_end':
          // If we're in this stream, show message and prepare to exit
          if (this.state.isJoined && this.state.currentStreamId === data.stream_id) {
            this.addChatMessage("System", "The livestream has ended.");
            this.showToast("The teacher has ended the livestream", "info");
            
            // Give users time to read message before modal closes
            setTimeout(() => {
              const modal = document.getElementById('livestreamViewModal');
              if (modal) {
                const bsModal = bootstrap.Modal.getInstance(modal);
                if (bsModal) {
                  bsModal.hide();
                }
              }
            }, 3000);
          }
          break;
          
        case 'livestream_chat':
          // Only handle if we're in this stream and it's not our message
          if (this.state.isJoined && 
              this.state.currentStreamId === data.stream_id &&
              data.sender !== document.getElementById('room-id-data')?.dataset.username) {
            
            // Add the message to chat
            this.addChatMessage(data.sender_name || data.sender, data.message);
          }
          break;
          
        case 'livestream_join':
          // Someone joined the livestream
          if (this.state.isJoined && this.state.currentStreamId === data.stream_id) {
            // Update viewer count
            const viewerCount = document.getElementById('viewer-count');
            if (viewerCount && data.viewer_count) {
              viewerCount.textContent = data.viewer_count;
            }
            
            // Add system message
            if (data.username && data.username !== document.getElementById('room-id-data')?.dataset.username) {
              this.addChatMessage("System", `${data.username} joined the livestream`);
            }
          }
          break;
      }
    },
    
    // Load upcoming livestreams
    loadUpcomingLivestreams: function() {
      if (!this.state.currentRoomId) return;
      
      const listContainer = document.getElementById('studentLivestreamsList');
      const loadingIndicator = document.getElementById('student-livestreams-loading');
      const noStreamsMessage = document.getElementById('no-student-livestreams');
      
      if (!listContainer) return;
      
      // Show loading
      if (loadingIndicator) loadingIndicator.style.display = 'block';
      if (noStreamsMessage) noStreamsMessage.style.display = 'none';
      
      // Clear existing content
      listContainer.innerHTML = '';
      
      // Fetch both active and scheduled streams
      Promise.all([
        fetch(`/get-active-streams/?room_id=${this.state.currentRoomId}`).then(r => r.json()),
        fetch(`/get-scheduled-streams/?room_id=${this.state.currentRoomId}`).then(r => r.json())
      ])
      .then(([activeData, scheduledData]) => {
        // Hide loading
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        
        const activeStreams = activeData.success ? activeData.streams : [];
        const upcomingStreams = scheduledData.success ? scheduledData.upcoming_streams : [];
        
        // Combine active and upcoming
        const allStreams = [
          ...activeStreams.map(stream => ({...stream, status: 'live'})),
          ...upcomingStreams
        ];
        
        if (allStreams.length === 0) {
          // No streams available
          if (noStreamsMessage) noStreamsMessage.style.display = 'block';
          return;
        }
        
        // Create cards for each stream
        allStreams.forEach(stream => {
          listContainer.appendChild(this.createLivestreamCard(stream));
        });
      })
      .catch(error => {
        console.error("Error loading livestreams:", error);
        
        // Hide loading, show error
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        
        listContainer.innerHTML = `
          <div class="alert alert-danger">
            Error loading livestreams. Please try again later.
          </div>
        `;
      });
    },
    
    // Create a card for a livestream
    createLivestreamCard: function(stream) {
      const card = document.createElement('div');
      card.className = 'livestream-card';
      if (stream.status === 'live') {
        card.classList.add('live');
      }
      
      // Format date/time
      const streamDate = new Date(stream.scheduled_time || stream.started_at);
      const formattedDate = streamDate.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      const formattedTime = streamDate.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // Create card HTML
      card.innerHTML = `
        <div class="livestream-header">
          <div>
            <h5 class="livestream-title">${stream.title || 'Untitled Livestream'}</h5>
            <p class="livestream-meta">
              <i class="bi bi-calendar"></i> ${formattedDate} at ${formattedTime}
              ${stream.duration_minutes ? `<span class="mx-2">|</span> <i class="bi bi-clock"></i> ${stream.duration_minutes} min` : ''}
            </p>
          </div>
          <div class="livestream-status status-${stream.status === 'live' ? 'live' : 'upcoming'}">
            ${stream.status === 'live' ? 'LIVE NOW' : 'UPCOMING'}
          </div>
        </div>
        
        ${stream.description ? `<p class="mb-3">${stream.description}</p>` : ''}
        
        <div class="d-flex justify-content-between align-items-center mt-3">
          <div>
            ${stream.status !== 'live' ? this.createCountdownTimer(streamDate) : ''}
          </div>
          <div>
            ${stream.status === 'live' ? 
              `<button class="btn btn-danger btn-sm join-livestream-btn" data-stream-id="${stream.stream_id || stream.id}">
                <i class="bi bi-play-fill"></i> Join Now
              </button>` : 
              `<button class="btn btn-outline-primary btn-sm remind-btn" data-stream-id="${stream.id}">
                <i class="bi bi-bell"></i> Remind Me
              </button>`
            }
          </div>
        </div>
      `;
      
      // Add event listeners
      if (stream.status === 'live') {
        const joinBtn = card.querySelector('.join-livestream-btn');
        if (joinBtn) {
          joinBtn.addEventListener('click', () => {
            const streamId = joinBtn.getAttribute('data-stream-id');
            this.joinLivestream(streamId);
          });
        }
      } else {
        const remindBtn = card.querySelector('.remind-btn');
        if (remindBtn) {
          remindBtn.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const streamId = btn.getAttribute('data-stream-id');
            
            // Set reminder (just visual for now)
            this.setReminder(streamId);
            
            // Update button
            btn.innerHTML = '<i class="bi bi-bell-fill"></i> Reminder Set';
            btn.disabled = true;
            
            // Show toast
            this.showToast("You'll be reminded when this livestream starts", "success");
          });
        }
      }
      
      return card;
    },
    
    // Create countdown timer for upcoming streams
    createCountdownTimer: function(targetDate) {
      const now = new Date();
      const diffTime = targetDate - now;
      
      if (diffTime <= 0) {
        return '<span class="badge bg-secondary">Starting soon</span>';
      }
      
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
    
    // Set a reminder for a stream (basic implementation)
    setReminder: function(streamId) {
      // In a real app, this would send to the server
      // For now, just store in localStorage
      const reminders = JSON.parse(localStorage.getItem('livestreamReminders') || '{}');
      reminders[streamId] = true;
      localStorage.setItem('livestreamReminders', JSON.stringify(reminders));
    },
    
    // Helper functions for UI
    showLoading: function(message) {
      // Create loading overlay if it doesn't exist
      let loadingOverlay = document.getElementById('livestream-loading-overlay');
      if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'livestream-loading-overlay';
        loadingOverlay.className = 'position-fixed w-100 h-100 top-0 start-0 d-flex flex-column align-items-center justify-content-center';
        loadingOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        loadingOverlay.style.zIndex = '9999';
        loadingOverlay.style.color = 'white';
        
        loadingOverlay.innerHTML = `
          <div class="spinner-border text-light mb-3" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p id="loading-message">${message || 'Loading...'}</p>
        `;
        
        document.body.appendChild(loadingOverlay);
      } else {
        // Update message if overlay exists
        const msgEl = loadingOverlay.querySelector('#loading-message');
        if (msgEl) msgEl.textContent = message || 'Loading...';
        
        loadingOverlay.style.display = 'flex';
      }
    },
    
    hideLoading: function() {
      const loadingOverlay = document.getElementById('livestream-loading-overlay');
      if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
      }
    },
    
    showToast: function(message, type = 'info') {
      // Create toast container if needed
      let toastContainer = document.getElementById('toast-container');
      if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'position-fixed bottom-0 end-0 p-3';
        toastContainer.style.zIndex = '9999';
        document.body.appendChild(toastContainer);
      }
      
      // Create toast
      const toastId = 'toast-' + Date.now();
      const toast = document.createElement('div');
      toast.id = toastId;
      toast.className = `toast show`;
      toast.setAttribute('role', 'alert');
      toast.setAttribute('aria-live', 'assertive');
      toast.setAttribute('aria-atomic', 'true');
      
      // Set background color based on type
      let bgClass = 'bg-primary text-white';
      if (type === 'success') bgClass = 'bg-success text-white';
      if (type === 'error') bgClass = 'bg-danger text-white';
      if (type === 'warning') bgClass = 'bg-warning text-dark';
      if (type === 'info') bgClass = 'bg-info text-dark';
      
      toast.classList.add(...bgClass.split(' '));
      
      toast.innerHTML = `
        <div class="toast-header">
          <strong class="me-auto">Livestream</strong>
          <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
          ${message}
        </div>
      `;
      
      // Add to container
      toastContainer.appendChild(toast);
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        if (document.body.contains(toast)) {
          toast.remove();
        }
      }, 5000);
    },
    
    // Get CSRF token from cookies
    getCsrfToken: function() {
      let csrfToken = null;
      
      if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
          const cookie = cookies[i].trim();
          if (cookie.substring(0, 10) === 'csrftoken=') {
            csrfToken = decodeURIComponent(cookie.substring(10));
            break;
          }
        }
      }
      
      return csrfToken;
    },

updateLiveIndicator: function(isLive) {
    const liveIndicator = document.getElementById('live-indicator');
    if (liveIndicator) {
      if (isLive) {
        liveIndicator.classList.remove('d-none');
      } else {
        liveIndicator.classList.add('d-none');
      }
    }
  },
  
  // Load all livestream lists for the modal
  loadAllLivestreams: function() {
    this.loadActiveLivestreams();
    this.loadUpcomingLivestreams();
    this.loadPastLivestreams();
  },
  
  // Load active livestreams for the modal
  loadActiveLivestreams: function() {
    const listContainer = document.getElementById('activeLivestreamsList');
    const loadingIndicator = document.getElementById('active-streams-loading');
    const noStreamsMessage = document.getElementById('no-active-streams');
    const countBadge = document.getElementById('active-streams-count');
    
    if (!listContainer) return;
    
    // Show loading
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    if (noStreamsMessage) noStreamsMessage.style.display = 'none';
    
    // Clear existing content
    listContainer.innerHTML = '';
    if (loadingIndicator) listContainer.appendChild(loadingIndicator);
    
    // Fetch active streams
    fetch(`/get-active-streams/?room_id=${this.state.currentRoomId}`)
      .then(response => response.json())
      .then(data => {
        // Hide loading
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        
        const activeStreams = data.success ? data.streams : [];
        
        // Update live indicator
        this.updateLiveIndicator(activeStreams.length > 0);
        
        // Update count badge
        if (countBadge) countBadge.textContent = activeStreams.length;
        
        if (activeStreams.length === 0) {
          // No active streams
          if (noStreamsMessage) noStreamsMessage.style.display = 'block';
          return;
        }
        
        // Create cards for active streams
        activeStreams.forEach(stream => {
          const card = this.createLivestreamCard({
            ...stream,
            status: 'live'
          });
          listContainer.appendChild(card);
        });
      })
      .catch(error => {
        console.error("Error loading active livestreams:", error);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        listContainer.innerHTML = `
          <div class="alert alert-danger">
            Error loading livestreams. Please try again later.
          </div>
        `;
      });
  },
  
  // Load upcoming livestreams for the modal
  loadUpcomingLivestreams: function() {
    const listContainer = document.getElementById('upcomingLivestreamsList');
    const loadingIndicator = document.getElementById('upcoming-streams-loading');
    const noStreamsMessage = document.getElementById('no-upcoming-streams');
    const countBadge = document.getElementById('upcoming-streams-count');
    
    if (!listContainer) return;
    
    // Show loading
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    if (noStreamsMessage) noStreamsMessage.style.display = 'none';
    
    // Clear existing content
    listContainer.innerHTML = '';
    if (loadingIndicator) listContainer.appendChild(loadingIndicator);
    
    // Fetch upcoming streams
    fetch(`/get-scheduled-streams/?room_id=${this.state.currentRoomId}`)
      .then(response => response.json())
      .then(data => {
        // Hide loading
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        
        const upcomingStreams = data.success ? data.upcoming_streams : [];
        
        // Update count badge
        if (countBadge) countBadge.textContent = upcomingStreams.length;
        
        if (upcomingStreams.length === 0) {
          // No upcoming streams
          if (noStreamsMessage) noStreamsMessage.style.display = 'block';
          return;
        }
        
        // Create cards for upcoming streams
        upcomingStreams.forEach(stream => {
          const card = this.createLivestreamCard({
            ...stream,
            status: 'upcoming'
          });
          listContainer.appendChild(card);
        });
      })
      .catch(error => {
        console.error("Error loading upcoming livestreams:", error);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        listContainer.innerHTML = `
          <div class="alert alert-danger">
            Error loading livestreams. Please try again later.
          </div>
        `;
      });
  },
  
  // Load past livestreams for the modal
  loadPastLivestreams: function() {
    const listContainer = document.getElementById('pastLivestreamsList');
    const loadingIndicator = document.getElementById('past-streams-loading');
    const noStreamsMessage = document.getElementById('no-past-streams');
    
    if (!listContainer) return;
    
    // Show loading
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    if (noStreamsMessage) noStreamsMessage.style.display = 'none';
    
    // Clear existing content
    listContainer.innerHTML = '';
    if (loadingIndicator) listContainer.appendChild(loadingIndicator);
    
    // Fetch past streams
    fetch(`/get-scheduled-streams/?room_id=${this.state.currentRoomId}`)
      .then(response => response.json())
      .then(data => {
        // Hide loading
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        
        const pastStreams = data.success ? data.past_streams : [];
        
        if (pastStreams.length === 0) {
          // No past streams
          if (noStreamsMessage) noStreamsMessage.style.display = 'block';
          return;
        }
        
        // Create cards for past streams
        pastStreams.forEach(stream => {
          const card = this.createLivestreamCard({
            ...stream,
            status: 'past'
          });
          listContainer.appendChild(card);
        });
      })
      .catch(error => {
        console.error("Error loading past livestreams:", error);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        listContainer.innerHTML = `
          <div class="alert alert-danger">
            Error loading livestreams. Please try again later.
          </div>
        `;
      });
  },
  
  // Set up event handlers for the upcomingLivestreamsModal
  setupLivestreamModal: function() {
    const modal = document.getElementById('upcomingLivestreamsModal');
    
    if (modal) {
      // Load streams when the modal is shown
      modal.addEventListener('show.bs.modal', () => {
        this.loadAllLivestreams();
      });
      
      // Set up tab event listeners
      const tabs = modal.querySelectorAll('[data-bs-toggle="tab"]');
      tabs.forEach(tab => {
        tab.addEventListener('shown.bs.tab', (event) => {
          const targetId = event.target.getAttribute('data-bs-target');
          
          if (targetId === '#active-streams') {
            this.loadActiveLivestreams();
          } else if (targetId === '#upcoming-streams') {
            this.loadUpcomingLivestreams();
          } else if (targetId === '#past-streams') {
            this.loadPastLivestreams();
          }
        });
      });
    }
  },
  
  // Initialize
  init: function() {
    console.log("Initializing student livestream module...");
    
    // Get current room ID from the DOM
    const roomIdElement = document.getElementById('room-id-data');
    if (roomIdElement) {
      this.state.currentRoomId = roomIdElement.dataset.roomId;
    }
    
    // Add CSS styles
    this.addLivestreamStyles();
    
    // Set up notifications for active livestreams
    this.checkForActiveLivestreams();
    
    // Set up WebSocket listener for livestream notifications
    this.setupWebSocketListener();
    
    // Set up livestream modal events
    this.setupLivestreamModal();
    
    // Check for active livestreams to update indicator
    this.updateLiveIndicator(false);
    this.loadActiveLivestreams();
    
    return this;
  }
  };

