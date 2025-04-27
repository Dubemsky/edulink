/**
 * Livestream WebSocket Integration Helper
 * 
 * This module simplifies the integration between livestream functionality and WebSockets.
 * It handles message routing, ensures backwards compatibility, and prevents duplicate messages.
 */

const LivestreamSocketHelper = {
    initialized: false,
    originalMessageHandler: null,
    messageCallbacks: {},
    
    /**
     * Initialize the WebSocket integration
     * @param {Object} options - Configuration options
     * @param {string} options.roomId - The room ID for WebSocket connection
     * @param {function} options.onChatMessage - Callback for chat messages
     * @param {function} options.onUserJoin - Callback for user join events
     * @param {function} options.onUserLeave - Callback for user leave events
     * @param {function} options.onStreamStart - Callback for stream start events
     * @param {function} options.onStreamEnd - Callback for stream end events
     */
    init: function(options = {}) {
      if (this.initialized) return;
      
      // Store callbacks
      this.messageCallbacks = {
        onChatMessage: options.onChatMessage,
        onUserJoin: options.onUserJoin,
        onUserLeave: options.onUserLeave,
        onStreamStart: options.onStreamStart,
        onStreamEnd: options.onStreamEnd
      };
      
      // Initialize WebSocket if needed
      this.initWebSocket(options.roomId);
      
      // Mark as initialized
      this.initialized = true;
      console.log('Livestream WebSocket Helper initialized');
    },
    
    /**
     * Initialize WebSocket connection if not already established
     * @param {string} roomId - The room ID for WebSocket connection
     */
    initWebSocket: function(roomId) {
      if (!roomId) {
        console.error('Room ID is required for WebSocket connection');
        return;
      }
      
      // Check if WebSocket connection already exists
      if (window.socket && window.socket.readyState === WebSocket.OPEN) {
        console.log('Using existing WebSocket connection');
        this.setupMessageHandler(window.socket);
        return;
      }
      
      // Create a new WebSocket connection
      if (!window.socket || window.socket.readyState !== WebSocket.CONNECTING) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/ws/hub/${roomId}/`;
        
        try {
          window.socket = new WebSocket(wsUrl);
          console.log('Creating new WebSocket connection:', wsUrl);
          
          // Setup basic event handlers
          window.socket.onopen = (event) => {
            console.log('WebSocket connection established');
          };
          
          window.socket.onerror = (error) => {
            console.error('WebSocket connection error:', error);
          };
          
          window.socket.onclose = (event) => {
            console.log('WebSocket connection closed. Code:', event.code, 'Reason:', event.reason);
            
            // Try to reconnect after 5 seconds if closed unexpectedly
            if (event.code !== 1000) { // 1000 is normal closure
              setTimeout(() => {
                console.log('Attempting to reconnect WebSocket...');
                this.initWebSocket(roomId);
              }, 5000);
            }
          };
          
          // Setup message handler
          this.setupMessageHandler(window.socket);
        } catch (error) {
          console.error('Error creating WebSocket connection:', error);
        }
      }
    },
    
    /**
     * Set up WebSocket message handler
     * @param {WebSocket} socket - The WebSocket instance
     */
    setupMessageHandler: function(socket) {
      // Save original onmessage handler if present
      if (socket.onmessage && !this.originalMessageHandler) {
        this.originalMessageHandler = socket.onmessage;
      }
      
      // Create enhanced message handler
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Check if this is a livestream message
          if (this.isLivestreamMessage(data)) {
            this.routeLivestreamMessage(data);
            return; // Don't pass to original handler
          }
          
          // For non-livestream messages, call the original handler
          if (this.originalMessageHandler) {
            this.originalMessageHandler(event);
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
          
          // On error, still try to call original handler
          if (this.originalMessageHandler) {
            this.originalMessageHandler(event);
          }
        }
      };
    },
    
    /**
     * Check if a message is a livestream message
     * @param {Object} data - The message data
     * @returns {boolean} - True if livestream message, false otherwise
     */
    isLivestreamMessage: function(data) {
      return (
        data.message_type === 'livestream_chat' ||
        data.type === 'livestream_chat' ||
        data.type === 'livestream_join' ||
        data.type === 'livestream_leave' ||
        data.type === 'livestream_start' ||
        data.type === 'livestream_end'
      );
    },
    
    /**
     * Route livestream message to appropriate handler
     * @param {Object} data - The message data
     */
    routeLivestreamMessage: function(data) {
      // Normalize message format (different backend services might format differently)
      const message = this.normalizeMessageFormat(data);
      
      // Route to appropriate handler based on message type
      const messageType = message.type || (message.message && message.message.type);
      
      switch (messageType) {
        case 'livestream_chat':
          if (this.messageCallbacks.onChatMessage) {
            this.messageCallbacks.onChatMessage(message);
          }
          break;
        case 'livestream_join':
          if (this.messageCallbacks.onUserJoin) {
            this.messageCallbacks.onUserJoin(message);
          }
          break;
        case 'livestream_leave':
          if (this.messageCallbacks.onUserLeave) {
            this.messageCallbacks.onUserLeave(message);
          }
          break;
        case 'livestream_start':
          if (this.messageCallbacks.onStreamStart) {
            this.messageCallbacks.onStreamStart(message);
          }
          break;
        case 'livestream_end':
          if (this.messageCallbacks.onStreamEnd) {
            this.messageCallbacks.onStreamEnd(message);
          }
          break;
        default:
          console.log('Unknown livestream message type:', messageType);
      }
    },
    
    /**
     * Normalize message format for consistent handling
     * @param {Object} data - The message data
     * @returns {Object} - Normalized message
     */
    normalizeMessageFormat: function(data) {
      // Create a copy to avoid modifying the original
      const message = JSON.parse(JSON.stringify(data));
      
      // Handle different message structures
      if (message.message_type === 'livestream_chat' && message.message) {
        // Ensure message has type field
        message.type = 'livestream_chat';
        
        // Ensure message.message has required fields
        if (typeof message.message === 'object') {
          // Set content if not present but message is
          if (!message.message.content && message.message.message) {
            message.message.content = message.message.message;
          }
          
          // Ensure sender fields
          if (!message.message.sender_name && message.message.sender) {
            message.message.sender_name = message.message.sender;
          }
          if (!message.message.sender_id && message.message.sender) {
            message.message.sender_id = message.message.sender;
          }
        }
      }
      
      return message;
    },
    
    /**
     * Send a message through WebSocket
     * @param {Object} message - The message to send
     * @returns {boolean} - True if sent successfully, false otherwise
     */
    sendMessage: function(message) {
      if (!window.socket || window.socket.readyState !== WebSocket.OPEN) {
        console.error('WebSocket is not open');
        return false;
      }
      
      try {
        // Add message_type if not present
        if (!message.message_type && message.type) {
          message.message_type = message.type;
        }
        
        window.socket.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        return false;
      }
    },
    
    /**
     * Send a chat message
     * @param {Object} options - Message options
     * @param {string} options.roomId - The room ID
     * @param {string} options.streamId - The stream ID
     * @param {string} options.sender - The sender ID/name
     * @param {string} options.content - The message content
     * @param {string} options.role - The role of the sender (teacher/student)
     * @returns {boolean} - True if sent successfully, false otherwise
     */
    sendChatMessage: function(options) {
      const message = {
        type: 'livestream_chat',
        message_type: 'livestream_chat',
        sender: options.sender,
        sender_id: options.sender,
        sender_name: options.sender,
        room_id: options.roomId,
        room_url: options.roomId,
        role: options.role || 'student',
        stream_id: options.streamId,
        message: options.content,
        timestamp: new Date().toISOString()
      };
      
      return this.sendMessage(message);
    },
    
    /**
     * Send a join notification
     * @param {Object} options - Message options
     * @param {string} options.roomId - The room ID
     * @param {string} options.streamId - The stream ID
     * @param {string} options.sender - The sender ID/name
     * @returns {boolean} - True if sent successfully, false otherwise
     */
    sendJoinNotification: function(options) {
      const message = {
        type: 'livestream_join',
        message_type: 'livestream_chat',
        sender: options.sender,
        sender_id: options.sender,
        sender_name: options.sender,
        room_id: options.roomId,
        stream_id: options.streamId
      };
      
      return this.sendMessage(message);
    },
    
    /**
     * Send a leave notification
     * @param {Object} options - Message options
     * @param {string} options.roomId - The room ID
     * @param {string} options.streamId - The stream ID
     * @param {string} options.sender - The sender ID/name
     * @returns {boolean} - True if sent successfully, false otherwise
     */
    sendLeaveNotification: function(options) {
      const message = {
        type: 'livestream_leave',
        message_type: 'livestream_chat',
        sender: options.sender,
        sender_id: options.sender,
        sender_name: options.sender,
        room_id: options.roomId,
        stream_id: options.streamId
      };
      
      return this.sendMessage(message);
    }
  };
  
  // Example integration with StudentLivestream:
  /*
  // In StudentLivestream.init():
  LivestreamSocketHelper.init({
    roomId: this.roomId,
    onChatMessage: (data) => {
      // Process chat message and update UI
      const messageData = data.message || data;
      this.addChatMessage({
        sender_id: messageData.sender_id || messageData.sender,
        sender_name: messageData.sender_name || messageData.sender,
        content: messageData.content || messageData.message,
        role: messageData.role
      });
    },
    onUserJoin: (data) => {
      // Handle user joining the stream
      const username = data.sender_name || data.sender;
      this.addSystemChatMessage(`${username} joined the livestream`);
      this.updateViewerCount();
    }
  });
  
  // For sending messages:
  LivestreamSocketHelper.sendChatMessage({
    roomId: this.roomId,
    streamId: this.activeStreamId,
    sender: this.username,
    content: message
  });
  */