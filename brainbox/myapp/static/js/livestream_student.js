/**
 * EduLink Student Livestream Module
 * Handles the student-side livestream functionality including:
 * - Detection of active streams
 * - Joining active streams
 * - Livestream chat integration (with real-time WebSocket)
 * - Screen sharing view
 */

const StudentLivestream = {
  // Configuration
  roomId: null,
  username: null,
  checkInterval: 30000, // Check for active streams every 30 seconds
  streamCheckTimer: null,
  activeStreamId: null,
  agoraClient: null,
  localTracks: {
    audioTrack: null,
    videoTrack: null
  },
  remoteUsers: {},
  
  // Initialization
  init: function() {
    // Get room ID and username from the page
    const roomData = document.getElementById('room-id-data');
    if (!roomData) return;
    
    this.roomId = roomData.dataset.roomId;
    this.username = roomData.dataset.username;
    
    if (!this.roomId || !this.username) {
      console.error('Missing room ID or username for livestream module');
      return;
    }
    
    console.log('Initializing student livestream module for room:', this.roomId);
    
    // Initialize UI components
    this.initUI();
    
    // Initialize WebSocket integration for real-time messages
    this.initWebSocketIntegration();
    
    // Start checking for active streams
    this.checkForActiveStreams();
    this.streamCheckTimer = setInterval(() => this.checkForActiveStreams(), this.checkInterval);
    
    // Initialize event listeners
    this.initEventListeners();
  },
  
  // Initialize WebSocket integration for real-time communication
  initWebSocketIntegration: function() {
    // Check if a WebSocket connection already exists
    if (window.socket && window.socket.readyState === WebSocket.OPEN) {
      console.log('Using existing WebSocket connection for livestream chat');
      this.setupWebSocketListeners(window.socket);
      return;
    }
    
    // Create a new WebSocket connection if none exists or if it's closed
    if (!window.socket || window.socket.readyState !== WebSocket.CONNECTING) {
      // Get current protocol (ws:// or wss://) and host
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      
      // Create WebSocket connection for the room
      const wsUrl = `${protocol}//${host}/ws/hub/${this.roomId}/`;
      
      try {
        console.log('Creating new WebSocket connection for livestream chat:', wsUrl);
        window.socket = new WebSocket(wsUrl);
        
        // Setup connection event handlers
        window.socket.onopen = (event) => {
          console.log('WebSocket connection established for livestream chat');
        };
        
        window.socket.onerror = (error) => {
          console.error('WebSocket connection error:', error);
        };
        
        // Set up message listeners
        this.setupWebSocketListeners(window.socket);
      } catch (error) {
        console.error('Error creating WebSocket connection:', error);
      }
    }
  },
  
  // Set up WebSocket message listeners for livestream messages
  setupWebSocketListeners: function(socket) {
    // Save original onmessage handler if it exists
    const originalOnMessage = socket.onmessage;
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Check if this is a livestream chat message
        if (data.message_type === 'livestream_chat') {
          console.log('Received livestream chat message:', data);
          
          // Process the message for livestream chat
          if (this.activeStreamId && data.message && 
              (data.message.stream_id === this.activeStreamId || 
               data.message.livestream_id === this.activeStreamId)) {
            
            // Format message for display
            const messageData = {
              sender_id: data.message.sender_id || data.message.sender || 'Unknown',
              sender_name: data.message.sender_name || data.message.sender || 'Unknown',
              content: data.message.content || data.message.message,
              role: data.message.role || (data.message.sender_id && 
                     data.message.sender_id.startsWith('t') ? 'teacher' : 'student')
            };
            
            // Add the message to the chat UI
            this.addChatMessage(messageData);
            
            // Scroll chat to bottom
            const chatContainer = document.getElementById('livestream-chat-messages');
            if (chatContainer) {
              chatContainer.scrollTop = chatContainer.scrollHeight;
            }
          }
        } else if (originalOnMessage) {
          // For non-livestream messages, call the original handler
          originalOnMessage(event);
        }
      } catch (e) {
        console.error('Error processing WebSocket message:', e);
        
        // Call original handler if parsing fails
        if (originalOnMessage) {
          originalOnMessage(event);
        }
      }
    };
  },
  
  // Initialize UI components
  initUI: function() {
    // Add join livestream button to the header if it doesn't exist
    const navMenu = document.querySelector('nav.navmenu ul');
    if (navMenu && !document.getElementById('join-livestream-btn')) {
      const liveButton = document.createElement('li');
      liveButton.innerHTML = `
        <a href="#" id="join-livestream-btn" style="display: none;">
          <i class="bi bi-broadcast"></i> Join Live <span class="badge bg-danger">LIVE</span>
        </a>
      `;
      navMenu.prepend(liveButton);
    }
    
    // Ensure we have the livestream view modal
    if (!document.getElementById('livestreamViewModal')) {
      console.warn('Livestream view modal not found in the DOM, functionality may be limited');
    }
  },
  
  // Initialize event listeners
  initEventListeners: function() {
    // Join livestream button click
    const joinBtn = document.getElementById('join-livestream-btn');
    if (joinBtn) {
      joinBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.joinActiveStream();
      });
    }
    
    // Send chat message in livestream
    const chatSendBtn = document.getElementById('livestream-chat-send');
    const chatInput = document.getElementById('livestream-chat-input');
    
    if (chatSendBtn && chatInput) {
      chatSendBtn.addEventListener('click', () => {
        const message = chatInput.value.trim();
        if (message) {
          this.sendChatMessage(message);
          chatInput.value = '';
        }
      });
      
      chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const message = chatInput.value.trim();
          if (message) {
            this.sendChatMessage(message);
            chatInput.value = '';
          }
        }
      });
    }
    
    // Handle modal events
    const livestreamModal = document.getElementById('livestreamViewModal');
    if (livestreamModal) {
      livestreamModal.addEventListener('hidden.bs.modal', () => {
        this.leaveStream();
      });
    }
  },
  
  // Check if there are any active livestreams in the current room
  checkForActiveStreams: function() {
    fetch(`/get-active-streams/?room_id=${this.roomId}`)
      .then(response => response.json())
      .then(data => {
        if (data.success && data.streams && data.streams.length > 0) {
          // We have at least one active stream
          const activeStream = data.streams[0]; // Take the first active stream
          
          // Update UI to show livestream is available
          this.showLivestreamAvailable(activeStream);
          
          // Store active stream ID
          this.activeStreamId = activeStream.stream_id;
          
          // Update the live indicator
          document.getElementById('live-indicator')?.classList.remove('d-none');
          
          // Show notification if this is a new stream and not already viewing
          if (!document.querySelector('.livestream-notification') && 
              !document.getElementById('livestreamViewModal').classList.contains('show')) {
            this.showLivestreamNotification(activeStream);
          }
        } else {
          // No active streams, update UI
          this.hideLivestreamAvailable();
          this.activeStreamId = null;
          
          // Hide live indicator
          document.getElementById('live-indicator')?.classList.add('d-none');
        }
        
        // Update counts in the livestream modal tabs
        if (data.streams) {
          const countElement = document.getElementById('active-streams-count');
          if (countElement) {
            countElement.textContent = data.streams.length;
          }
        }
      })
      .catch(error => {
        console.error('Error checking for active streams:', error);
      });
      
    // Also update upcoming streams count
    this.checkUpcomingStreams();
  },
  
  // Check for upcoming scheduled livestreams
  checkUpcomingStreams: function() {
    fetch(`/get-scheduled-streams/?room_id=${this.roomId}`)
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Update counts in the livestream modal tabs
          if (data.upcoming_streams) {
            const countElement = document.getElementById('upcoming-streams-count');
            if (countElement) {
              countElement.textContent = data.upcoming_streams.length;
            }
            
            // Update the upcoming livestreams list
            this.updateUpcomingStreamsList(data.upcoming_streams);
          }
          
          // Update past streams list
          if (data.past_streams) {
            this.updatePastStreamsList(data.past_streams);
          }
        }
      })
      .catch(error => {
        console.error('Error checking for scheduled streams:', error);
      });
  },
  
  // Update the UI to show livestream is available
  showLivestreamAvailable: function(streamData) {
    const joinBtn = document.getElementById('join-livestream-btn');
    if (joinBtn) {
      joinBtn.style.display = 'inline-flex';
      joinBtn.setAttribute('data-stream-id', streamData.stream_id);
    }
    
    // Update active streams list in the modal
    this.updateActiveStreamsList([streamData]);
  },
  
  // Update the UI to hide livestream option when not available
  hideLivestreamAvailable: function() {
    const joinBtn = document.getElementById('join-livestream-btn');
    if (joinBtn) {
      joinBtn.style.display = 'none';
      joinBtn.removeAttribute('data-stream-id');
    }
    
    // Update active streams list in the modal to show no streams
    this.updateActiveStreamsList([]);
    
    // Hide any notifications
    document.querySelectorAll('.livestream-notification').forEach(notification => {
      notification.remove();
    });
  },
  
  // Show a notification that a livestream is active
  showLivestreamNotification: function(streamData) {
    // Get the notification template
    const template = document.getElementById('livestreamNotificationTemplate');
    if (!template) return;
    
    // Create a clone of the template content
    const notification = document.importNode(template.content, true).firstElementChild;
    
    // Update notification content with stream data
    notification.querySelector('.notification-title').textContent = streamData.title || "Teacher's Livestream";
    
    // Set up event listeners
    notification.querySelector('.livestream-notification-close').addEventListener('click', () => {
      notification.remove();
    });
    
    notification.querySelector('.join-stream-btn').addEventListener('click', () => {
      notification.remove();
      this.joinActiveStream(streamData.stream_id);
    });
    
    // Add the notification to the page
    document.body.appendChild(notification);
    
    // Auto-remove after 15 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 15000);
  },
  
  // Join the active livestream
  joinActiveStream: function(streamId = null) {
    // Use provided stream ID or the stored active stream ID
    const targetStreamId = streamId || this.activeStreamId;
    if (!targetStreamId) {
      console.error('No active stream ID available');
      return;
    }
    
    // Show the livestream modal
    const modal = document.getElementById('livestreamViewModal');
    if (modal) {
      const modalInstance = new bootstrap.Modal(modal);
      modalInstance.show();
      
      // Set loading state
      const videoContainer = document.getElementById('livestream-video-container');
      if (videoContainer) {
        videoContainer.innerHTML = `
          <div class="stream-loading">
            <div class="spinner-border text-light" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-3">Connecting to livestream...</p>
          </div>
        `;
      }
      
      // Join the stream
      this.connectToStream(targetStreamId);
    }
  },
  
  // Connect to the stream using Agora SDK
  connectToStream: function(streamId) {
    // Clear chat messages first
    const chatContainer = document.getElementById('livestream-chat-messages');
    if (chatContainer) {
      chatContainer.innerHTML = `
        <div class="system-message">
          Connecting to livestream chat...
        </div>
      `;
    }
    
    // Request stream token and details from server
    fetch('/join-livestream/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': this.getCsrfToken()
      },
      body: JSON.stringify({
        stream_id: streamId,
        user_id: this.username
      })
    })
    .then(response => response.json())
    .then(async data => {
      if (data.success) {
        // Update UI with stream details
        const titleElement = document.getElementById('livestream-title');
        if (titleElement) {
          titleElement.textContent = data.stream_details.title || "Teacher's Livestream";
        }
        
        // Initialize Agora client
        await this.initializeAgoraClient(data.app_id, data.channel_name, data.token, data.uid);
        
        // Start stream duration timer
        this.startStreamTimer(data.stream_details.started_at);
        
        // Load chat messages
        this.loadStreamChat(streamId);
        
        // Add system message
        this.addSystemChatMessage('You have joined the livestream');
        
        // Make sure WebSocket connection is active for real-time chat
        this.initWebSocketIntegration();
        
        // Send join notification via WebSocket
        this.sendJoinNotification(streamId);
      } else {
        console.error('Failed to join livestream:', data.error);
        this.addSystemChatMessage('Failed to connect to the livestream: ' + data.error);
        const videoContainer = document.getElementById('livestream-video-container');
        if (videoContainer) {
          videoContainer.innerHTML = `
            <div class="stream-error">
              <i class="bi bi-exclamation-triangle"></i>
              <p>Failed to connect to the livestream</p>
              <p class="text-muted">${data.error}</p>
            </div>
          `;
        }
      }
    })
    .catch(error => {
      console.error('Error joining livestream:', error);
      this.addSystemChatMessage('Error connecting to the livestream');
      const videoContainer = document.getElementById('livestream-video-container');
      if (videoContainer) {
        videoContainer.innerHTML = `
          <div class="stream-error">
            <i class="bi bi-exclamation-triangle"></i>
            <p>Failed to connect to the livestream</p>
            <p class="text-muted">Network error</p>
          </div>
        `;
      }
    });
  },
  
  // Send join notification (optional)
  sendJoinNotification: function(streamId) {
    if (window.socket && window.socket.readyState === WebSocket.OPEN) {
      const joinData = {
        type: 'livestream_join',
        sender: this.username,
        sender_id: this.username,
        sender_name: this.username,
        room_id: this.roomId,
        stream_id: streamId,
        message_type: "livestream_chat"
      };
      
      try {
        window.socket.send(JSON.stringify(joinData));
      } catch (error) {
        console.error('Error sending join notification:', error);
      }
    }
  },
  
  // Initialize the Agora client
  initializeAgoraClient: async function(appId, channelName, token, uid) {
    try {
      // Create an Agora client
      this.agoraClient = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
      
      // Set client role as audience (view only)
      await this.agoraClient.setClientRole('audience');
      
      // Event listeners for remote users joining
      this.agoraClient.on('user-published', async (user, mediaType) => {
        await this.agoraClient.subscribe(user, mediaType);
        this.handleUserPublished(user, mediaType);
      });
      
      this.agoraClient.on('user-unpublished', async (user, mediaType) => {
        this.handleUserUnpublished(user, mediaType);
      });
      
      // Event listener for stream-status to detect screen sharing
      this.agoraClient.on('stream-type-changed', (uid, streamType) => {
        console.log('Stream type changed for user', uid, 'to', streamType);
      });
      
      // Join the channel
      await this.agoraClient.join(appId, channelName, token, uid);
      console.log('Successfully joined Agora channel:', channelName);
      
      // Add system message
      this.addSystemChatMessage('Connected to livestream');
      
      return true;
    } catch (error) {
      console.error('Error initializing Agora client:', error);
      this.addSystemChatMessage('Failed to initialize video: ' + error.message);
      return false;
    }
  },
  
  // Handle remote user publishing audio/video
  handleUserPublished: async function(user, mediaType) {
    // Store the remote user
    this.remoteUsers[user.uid] = user;
    
    if (mediaType === 'video') {
      // Play the remote video
      const videoContainer = document.getElementById('livestream-video-container');
      if (videoContainer) {
        videoContainer.innerHTML = '';
        
        const playerContainer = document.createElement('div');
        playerContainer.id = `player-${user.uid}`;
        playerContainer.className = 'remote-player';
        videoContainer.appendChild(playerContainer);
        
        user.videoTrack.play(`player-${user.uid}`);
        
        // Update viewer count
        this.updateViewerCount();
      }
    }
    
    if (mediaType === 'audio') {
      user.audioTrack.play();
    }
    
    // Add system message
    this.addSystemChatMessage('Teacher is now streaming');
  },
  
  // Handle remote user unpublishing audio/video
  handleUserUnpublished: function(user, mediaType) {
    if (mediaType === 'video') {
      const playerElement = document.getElementById(`player-${user.uid}`);
      if (playerElement) {
        playerElement.remove();
      }
      
      // If no more video, show placeholder
      const videoContainer = document.getElementById('livestream-video-container');
      if (videoContainer && videoContainer.childElementCount === 0) {
        videoContainer.innerHTML = `
          <div class="stream-placeholder">
            <i class="bi bi-camera-video-off"></i>
            <p>Waiting for teacher's stream to resume...</p>
          </div>
        `;
      }
      
      // Add system message
      this.addSystemChatMessage('Teacher\'s video stream ended');
    }
    
    // Remove from remoteUsers
    delete this.remoteUsers[user.uid];
  },
  
  // Start the stream duration timer
  startStreamTimer: function(startTime) {
    const timerElement = document.getElementById('stream-duration');
    if (!timerElement) return;
    
    // Calculate initial duration
    const startTimestamp = new Date(startTime).getTime();
    const updateTimer = () => {
      const now = Date.now();
      const duration = Math.floor((now - startTimestamp) / 1000);
      
      const hours = Math.floor(duration / 3600);
      const minutes = Math.floor((duration % 3600) / 60);
      const seconds = duration % 60;
      
      timerElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };
    
    // Initial update
    updateTimer();
    
    // Set interval to update every second
    this.streamTimer = setInterval(updateTimer, 1000);
  },
  
  // Load initial chat messages for a stream
  loadStreamChat: function(streamId) {
    fetch(`/get-livestream-messages/?stream_id=${streamId}`)
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          const chatContainer = document.getElementById('livestream-chat-messages');
          if (chatContainer) {
            chatContainer.innerHTML = '';
            
            if (data.messages.length === 0) {
              this.addSystemChatMessage('No messages yet. Be the first to chat!');
            } else {
              // Add messages to chat
              data.messages.forEach(message => {
                // Ensure the message is in the expected format
                const formattedMessage = {
                  sender_id: message.sender_id || message.sender || 'Unknown',
                  sender_name: message.sender_name || message.sender || message.sender_id || 'Unknown',
                  content: message.content || message.message || '',
                  role: message.role || (message.sender_id && message.sender_id.startsWith('t') ? 'teacher' : 'student')
                };
                
                this.addChatMessage(formattedMessage);
              });
              
              // Scroll to bottom
              chatContainer.scrollTop = chatContainer.scrollHeight;
            }
          }
        } else {
          console.error('Failed to load chat messages:', data.error);
          this.addSystemChatMessage('Failed to load chat messages');
        }
      })
      .catch(error => {
        console.error('Error loading chat messages:', error);
        this.addSystemChatMessage('Error loading chat messages');
      });
  },
  
  // Send a chat message
  sendChatMessage: function(message) {
    if (!this.activeStreamId) {
      console.error('No active stream ID for chat message');
      return;
    }
    
    // Use WebSocket if available for real-time messaging
    if (window.socket && window.socket.readyState === WebSocket.OPEN) {
      const messageData = {
        type: 'livestream_chat',
        message: message,
        sender: this.username,
        sender_id: this.username,
        sender_name: this.username,
        room_id: this.roomId,
        room_url: this.roomId,
        role: "student",
        stream_id: this.activeStreamId,
        timestamp: new Date().toISOString(),
        message_type: "livestream_chat" // Flag for backend to identify
      };
      
      try {
        window.socket.send(JSON.stringify(messageData));
        
        // Show the message in the UI immediately (it will come back through WebSocket too)
        this.addChatMessage({
          sender_id: this.username,
          sender_name: 'You',
          content: message,
          role: 'student'
        });
        
        // Scroll to bottom
        const chatContainer = document.getElementById('livestream-chat-messages');
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        
        return true;
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        // Fall back to fetch API if WebSocket fails
      }
    }
    
    // Fallback: use fetch API if WebSocket is not available
    fetch('/livestream-message/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': this.getCsrfToken()
      },
      body: JSON.stringify({
        type: 'livestream_chat',
        sender_id: this.username,
        room_id: this.roomId,
        stream_id: this.activeStreamId,
        content: message,
        message_type: "livestream_chat"
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Message sent successfully, add to chat
        this.addChatMessage({
          sender_id: this.username,
          sender_name: 'You',
          content: message,
          role: 'student'
        });
        
        // Scroll chat to bottom
        const chatContainer = document.getElementById('livestream-chat-messages');
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      } else {
        console.error('Failed to send chat message:', data.error);
        this.addSystemChatMessage('Failed to send message: ' + (data.error || 'Unknown error'));
      }
    })
    .catch(error => {
      console.error('Error sending chat message:', error);
      this.addSystemChatMessage('Error sending message. Please try again.');
    });
  },

  // Add a chat message to the container
  addChatMessage: function(message) {
    const chatContainer = document.getElementById('livestream-chat-messages');
    if (!chatContainer) return;
    
    // Check if this is a duplicate message (sometimes WebSockets can send duplicates)
    const messageContent = message.content || message.message || '';
    const senderName = message.sender_name || message.sender || message.sender_id || 'Unknown';
    
    // Generate a simple "signature" for this message to check for duplicates
    const msgSignature = `${senderName}:${messageContent}:${Date.now()}`;
    
    // Check recent messages (last 5 seconds) for duplicates
    if (this.recentMessages && this.recentMessages.includes(msgSignature)) {
      return; // Skip duplicate message
    }
    
    // Store this message signature to avoid duplicates
    this.recentMessages = this.recentMessages || [];
    this.recentMessages.push(msgSignature);
    
    // Limit the size of recent messages array (keep last 10)
    if (this.recentMessages.length > 10) {
      this.recentMessages.shift();
    }
    
    // Create and add the message element
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';
    
    // Check if this is the current user's message
    if (message.sender_id === this.username || message.sender === this.username) {
      messageElement.classList.add('own-message');
    }
    
    // Check if this is from the teacher
    if ((message.sender_id && message.sender_id.startsWith('t')) || 
        (message.sender && message.sender.startsWith('t')) || 
        (message.role === 'teacher')) {
      messageElement.classList.add('teacher-message');
    }
    
    // Format the message
    messageElement.innerHTML = `
      <div class="message-sender">${senderName === this.username ? 'You' : senderName}</div>
      <div class="message-content">${messageContent}</div>
    `;
    
    chatContainer.appendChild(messageElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  },
  
  // Add a system message to the chat
  addSystemChatMessage: function(message) {
    const chatContainer = document.getElementById('livestream-chat-messages');
    if (!chatContainer) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = 'system-message';
    messageElement.textContent = message;
    
    chatContainer.appendChild(messageElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  },
  
  // Leave the stream and clean up resources
  leaveStream: function() {
    // Leave Agora channel if connected
    if (this.agoraClient) {
      this.agoraClient.leave().then(() => {
        console.log('Left Agora channel successfully');
      }).catch(error => {
        console.error('Error leaving Agora channel:', error);
      });
      
      this.agoraClient = null;
    }
    
    // Clear remote users
    this.remoteUsers = {};
    
    // Clear stream timer
    if (this.streamTimer) {
      clearInterval(this.streamTimer);
      this.streamTimer = null;
    }
    
    // Send leave notification via WebSocket
    if (window.socket && window.socket.readyState === WebSocket.OPEN && this.activeStreamId) {
      const leaveData = {
        type: 'livestream_leave',
        sender: this.username,
        sender_id: this.username,
        room_id: this.roomId,
        stream_id: this.activeStreamId,
        message_type: "livestream_chat"
      };
      
      try {
        window.socket.send(JSON.stringify(leaveData));
      } catch (error) {
        console.error('Error sending leave notification:', error);
      }
    }
    
    // Reset video container
    const videoContainer = document.getElementById('livestream-video-container');
    if (videoContainer) {
      videoContainer.innerHTML = `
        <div class="stream-placeholder">
          <i class="bi bi-camera-video-off"></i>
          <p>Waiting for teacher's stream to start...</p>
        </div>
      `;
    }
    
    // Clear chat messages
    const chatContainer = document.getElementById('livestream-chat-messages');
    if (chatContainer) {
      chatContainer.innerHTML = `
        <div class="system-message">
          Welcome to the livestream chat! Be respectful and engage with your teacher.
        </div>
      `;
    }
    
    // Notify server that we left the stream
    if (this.activeStreamId) {
      fetch('/leave-livestream/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': this.getCsrfToken()
        },
        body: JSON.stringify({
          stream_id: this.activeStreamId,
          user_id: this.username
        })
      })
      .then(response => response.json())
      .then(data => {
        console.log('Left livestream:', data);
      })
      .catch(error => {
        console.error('Error leaving livestream:', error);
      });
    }
  },
  
  // Update active streams list in the modal
  updateActiveStreamsList: function(streams) {
    const listContainer = document.getElementById('activeLivestreamsList');
    const loadingElement = document.getElementById('active-streams-loading');
    const noStreamsMessage = document.getElementById('no-active-streams');
    
    if (!listContainer) return;
    
    // Remove loading indicator
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }
    
    // Remove existing stream cards (except loading and no-streams message)
    listContainer.querySelectorAll('.livestream-card').forEach(card => {
      card.remove();
    });
    
    if (streams.length === 0) {
      // Show no streams message
      if (noStreamsMessage) {
        noStreamsMessage.style.display = 'block';
      }
      return;
    }
    
    // Hide no streams message
    if (noStreamsMessage) {
      noStreamsMessage.style.display = 'none';
    }
    
    // Create stream cards
    streams.forEach(stream => {
      const streamCard = this.createStreamCard(stream, 'live');
      listContainer.appendChild(streamCard);
    });
  },
  
  // Update upcoming streams list in the modal
  updateUpcomingStreamsList: function(streams) {
    const listContainer = document.getElementById('upcomingLivestreamsList');
    const loadingElement = document.getElementById('upcoming-streams-loading');
    const noStreamsMessage = document.getElementById('no-upcoming-streams');
    
    if (!listContainer) return;
    
    // Remove loading indicator
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }
    
    // Remove existing stream cards (except loading and no-streams message)
    listContainer.querySelectorAll('.livestream-card').forEach(card => {
      card.remove();
    });
    
    if (streams.length === 0) {
      // Show no streams message
      if (noStreamsMessage) {
        noStreamsMessage.style.display = 'block';
      }
      return;
    }
    
    // Hide no streams message
    if (noStreamsMessage) {
      noStreamsMessage.style.display = 'none';
    }
    
    // Create stream cards
    streams.forEach(stream => {
      const streamCard = this.createStreamCard(stream, 'upcoming');
      listContainer.appendChild(streamCard);
    });
  },
  
  // Update past streams list in the modal
  updatePastStreamsList: function(streams) {
    const listContainer = document.getElementById('pastLivestreamsList');
    const loadingElement = document.getElementById('past-streams-loading');
    const noStreamsMessage = document.getElementById('no-past-streams');
    
    if (!listContainer) return;
    
    // Remove loading indicator
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }
    
    // Remove existing stream cards (except loading and no-streams message)
    listContainer.querySelectorAll('.livestream-card').forEach(card => {
      card.remove();
    });
    
    if (streams.length === 0) {
      // Show no streams message
      if (noStreamsMessage) {
        noStreamsMessage.style.display = 'block';
      }
      return;
    }
    
    // Hide no streams message
    if (noStreamsMessage) {
      noStreamsMessage.style.display = 'none';
    }
    
    // Create stream cards for past streams
    streams.forEach(stream => {
      const streamCard = this.createStreamCard(stream, 'past');
      listContainer.appendChild(streamCard);
    });
  },
  
  // Create a stream card for display in the modal
  createStreamCard: function(stream, type) {
    // Get the stream card template
    const template = document.getElementById('livestreamCardTemplate');
    if (!template) {
      console.error('Livestream card template not found');
      return document.createElement('div');
    }
    
    // Clone the template content
    const card = document.importNode(template.content, true).firstElementChild;
    
    // Set stream ID
    card.setAttribute('data-stream-id', stream.stream_id || stream.id || stream.schedule_id);
    
    if (type === 'live') {
      card.classList.add('live');
    }
    
    // Update card content based on stream data
    const title = card.querySelector('.livestream-title');
    if (title) {
      title.textContent = stream.title || "Untitled Livestream";
    }
    
    // Format date and time
    let streamDate, streamTime;
    if (type === 'live') {
      const startedAt = new Date(stream.started_at);
      streamDate = startedAt.toLocaleDateString();
      streamTime = startedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      const scheduledTime = new Date(stream.scheduled_time);
      streamDate = scheduledTime.toLocaleDateString();
      streamTime = scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Update date and time
    const dateElement = card.querySelector('.stream-date');
    const timeElement = card.querySelector('.stream-time');
    
    if (dateElement) dateElement.textContent = streamDate;
    if (timeElement) timeElement.textContent = streamTime;
    
    // Update duration if available
    const durationElement = card.querySelector('.stream-duration');
    if (durationElement) {
      durationElement.textContent = stream.duration_minutes || '60';
    }
    
    // Update description if available
    const descriptionElement = card.querySelector('.stream-description');
    if (descriptionElement) {
      descriptionElement.textContent = stream.description || "No description available";
    }
    
    // Update status
    const statusElement = card.querySelector('.livestream-status');
    if (statusElement) {
      if (type === 'live') {
        statusElement.textContent = 'LIVE NOW';
        statusElement.className = 'livestream-status status-live';
      } else if (type === 'upcoming') {
        statusElement.textContent = 'UPCOMING';
        statusElement.className = 'livestream-status status-upcoming';
      } else {
        statusElement.textContent = 'COMPLETED';
        statusElement.className = 'livestream-status status-completed';
      }
    }
    
    // Add actions based on type
    const actionsContainer = card.querySelector('.stream-actions');
    if (actionsContainer) {
      if (type === 'live') {
        actionsContainer.innerHTML = `
          <button class="btn btn-danger btn-sm join-stream-btn">
            <i class="bi bi-play-fill"></i> Join Stream
          </button>
        `;
        
        // Add event listener to join button
        const joinButton = actionsContainer.querySelector('.join-stream-btn');
        if (joinButton) {
          joinButton.addEventListener('click', () => {
            const streamId = card.getAttribute('data-stream-id');
            this.joinActiveStream(streamId);
            
            // Close the modal if opened from there
            const modal = document.getElementById('upcomingLivestreamsModal');
            if (modal) {
              const modalInstance = bootstrap.Modal.getInstance(modal);
              if (modalInstance) {
                modalInstance.hide();
              }
            }
          });
        }
      } else if (type === 'upcoming') {
        // Add countdown for upcoming streams
        const countdownContainer = card.querySelector('.countdown-container');
        if (countdownContainer) {
          const scheduledTime = new Date(stream.scheduled_time).getTime();
          
          // Create countdown timer
          countdownContainer.innerHTML = `
            <div class="countdown-timer">
              <div class="countdown-segment">
                <span class="countdown-number" id="days-${stream.id || stream.schedule_id}">00</span>
                <span class="countdown-label">Days</span>
              </div>
              <div class="countdown-segment">
                <span class="countdown-number" id="hours-${stream.id || stream.schedule_id}">00</span>
                <span class="countdown-label">Hours</span>
              </div>
              <div class="countdown-segment">
                <span class="countdown-number" id="mins-${stream.id || stream.schedule_id}">00</span>
                <span class="countdown-label">Mins</span>
              </div>
            </div>
          `;
          
          // Start countdown timer
          this.startCountdown(stream.id || stream.schedule_id, scheduledTime);
        }
        
        // Add "Reminder" button
        actionsContainer.innerHTML = `
          <button class="btn btn-primary btn-sm set-reminder-btn">
            <i class="bi bi-bell"></i> Set Reminder
          </button>
        `;
        
        // Add event listener to reminder button
        const reminderButton = actionsContainer.querySelector('.set-reminder-btn');
        if (reminderButton) {
          reminderButton.addEventListener('click', () => {
            this.setStreamReminder(stream.id || stream.schedule_id);
          });
        }
      } else {
        // Past stream actions
        actionsContainer.innerHTML = `
          <span class="text-muted">Stream has ended</span>
        `;
      }
    }
    
    return card;
  },
  
  // Start countdown timer for upcoming streams
  startCountdown: function(streamId, targetTime) {
    const updateCountdown = () => {
      const now = new Date().getTime();
      const distance = targetTime - now;
      
      // Time calculations
      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      
      // Update UI
      const daysElement = document.getElementById(`days-${streamId}`);
      const hoursElement = document.getElementById(`hours-${streamId}`);
      const minsElement = document.getElementById(`mins-${streamId}`);
      
      if (daysElement && hoursElement && minsElement) {
        daysElement.textContent = days.toString().padStart(2, '0');
        hoursElement.textContent = hours.toString().padStart(2, '0');
        minsElement.textContent = minutes.toString().padStart(2, '0');
      }
      
      // If the countdown is over, update UI
      if (distance < 0) {
        clearInterval(countdownInterval);
        
        if (daysElement && hoursElement && minsElement) {
          daysElement.textContent = '00';
          hoursElement.textContent = '00';
          minsElement.textContent = '00';
        }
        
        // Force refresh the stream list to check if it's now live
        this.checkForActiveStreams();
      }
    };
    
    // Run immediately
    updateCountdown();
    
    // Update every minute
    const countdownInterval = setInterval(updateCountdown, 60000);
    
    // Store the interval to clear it later if needed
    this.countdownIntervals = this.countdownIntervals || {};
    this.countdownIntervals[streamId] = countdownInterval;
  },
  
  // Set a reminder for an upcoming stream
  setStreamReminder: function(streamId) {
    // Toggle the reminder status
    // In a real implementation, this would store the reminder in the database
    // For now, we'll just show a notification
    
    alert('Reminder set for this livestream!');
    
    // Update UI to show reminder is set
    const reminderButtons = document.querySelectorAll(`.livestream-card[data-stream-id="${streamId}"] .set-reminder-btn`);
    reminderButtons.forEach(button => {
      button.innerHTML = '<i class="bi bi-bell-fill"></i> Reminder Set';
      button.classList.remove('btn-primary');
      button.classList.add('btn-success');
    });
  },
  
  // Update viewer count
  updateViewerCount: function() {
    if (!this.activeStreamId) return;
    
    fetch(`/get-stream-viewers/?stream_id=${this.activeStreamId}`)
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          const viewerCountElement = document.getElementById('viewer-count');
          if (viewerCountElement) {
            viewerCountElement.textContent = data.viewer_count || '0';
          }
        }
      })
      .catch(error => {
        console.error('Error fetching viewer count:', error);
      });
  },
  
  // Helper function to get CSRF token
  getCsrfToken: function() {
    return document.cookie.split('; ')
      .find(row => row.startsWith('csrftoken='))
      ?.split('=')[1];
  }
};