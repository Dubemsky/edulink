/**
 * Livestream WebSocket Integration for EduLink
 * 
 * This file handles the integration between the livestream module
 * and the existing WebSocket connections to avoid conflicts.
 */

// LivestreamSocketIntegration module
const LivestreamSocketIntegration = {
    originalMessageHandler: null,
    
    // Initialize the integration
    init: function() {
      // Only initialize once
      if (this.initialized) return;
      
      // Store reference to the existing socket if any
      this.existingSocket = window.socket;
      
      // Check if there's an existing socket
      if (window.socket && window.socket.onmessage) {
        // Save the original message handler
        this.originalMessageHandler = window.socket.onmessage;
        
        // Replace with our enhanced handler
        this.setupMessageHandler();
      }
      
      // Mark as initialized
      this.initialized = true;
      console.log("Livestream Socket Integration initialized");
    },
    
    // Set up the enhanced message handler
    setupMessageHandler: function() {
      const self = this;
      
      window.socket.onmessage = function(event) {
        try {
          const data = JSON.parse(event.data);
          
          // Check if this is a livestream message
          if (data.type && data.type.startsWith('livestream_')) {
            // Handle livestream-specific messages
            self.handleLivestreamMessage(data);
            return; // Don't pass to the original handler
          }
          
          // For non-livestream messages, call the original handler
          if (self.originalMessageHandler) {
            self.originalMessageHandler(event);
          }
        } catch (error) {
          console.error("Error in WebSocket message handler:", error);
          
          // On error, still try to call the original handler
          if (self.originalMessageHandler) {
            self.originalMessageHandler(event);
          }
        }
      };
    },
    
    // Handle livestream-specific messages
    handleLivestreamMessage: function(data) {
      // Process different livestream message types
      switch(data.type) {
        case 'livestream_chat':
          this.handleChatMessage(data);
          break;
        case 'livestream_question':
          this.handleQuestionMessage(data);
          break;
        case 'livestream_join':
          this.handleViewerJoin(data);
          break;
        case 'livestream_leave':
          this.handleViewerLeave(data);
          break;
        case 'livestream_start':
          this.handleStreamStart(data);
          break;
        case 'livestream_end':
          this.handleStreamEnd(data);
          break;
        default:
          console.log("Unknown livestream message type:", data.type);
      }
    },
    
    // Handler for chat messages
    handleChatMessage: function(data) {
      console.log("Received livestream chat message:", data);
      
      // If the LivestreamModule is active, update the UI
      if (window.LivestreamModule && window.LivestreamModule.state.isLive) {
        LivestreamModule.addChatMessage(data.sender_name || data.sender, data.message, false);
      }
    },
    
    // Handler for question messages
    handleQuestionMessage: function(data) {
      console.log("Received livestream question:", data);
      
      // If the LivestreamModule is active, update the UI
      if (window.LivestreamModule && window.LivestreamModule.state.isLive) {
        LivestreamModule.addQuestion(data.sender_name || data.sender, data.question || data.message);
      }
    },
    
    // Handler for viewer join events
    handleViewerJoin: function(data) {
      console.log("Viewer joined livestream:", data);
      
      // Update viewer count if available
      if (data.viewer_count) {
        this.updateViewerCount(data.viewer_count);
      }
      
      // Add system message to chat
      if (window.LivestreamModule && window.LivestreamModule.state.isLive) {
        const username = data.username || data.sender_name || "A user";
        LivestreamModule.addChatMessage("System", `${username} joined the livestream`, false);
      }
    },
    
    // Handler for viewer leave events
    handleViewerLeave: function(data) {
      console.log("Viewer left livestream:", data);
      
      // Update viewer count if available
      if (data.viewer_count) {
        this.updateViewerCount(data.viewer_count);
      }
    },
    
    // Handler for stream start events
    handleStreamStart: function(data) {
      console.log("Livestream started:", data);
      
      // For students, show notification
      if (data.teacher_id && data.teacher_id !== this.getCurrentUsername()) {
        this.showLivestreamNotification(data);
      }
    },
    
    // Handler for stream end events
    handleStreamEnd: function(data) {
      console.log("Livestream ended:", data);
      
      // If we're viewing this stream, show a message
      if (window.LivestreamModule && 
          window.LivestreamModule.state.isLive && 
          window.LivestreamModule.state.currentStreamId === data.stream_id) {
        
        LivestreamModule.showToast("The livestream has ended", "info");
        
        // Close livestream view if we're a viewer
        if (window.LivestreamModule.state.userRole === 'audience') {
          window.LivestreamModule.leaveChannel();
        }
      }
    },
    
    // Update viewer count in the UI
    updateViewerCount: function(count) {
      const viewerCountElement = document.getElementById('viewer-count');
      if (viewerCountElement) {
        viewerCountElement.textContent = count;
      }
    },
    
    // Show a notification for new livestreams
    showLivestreamNotification: function(streamData) {
      // Create notification if not already viewing
      if (!document.getElementById('livestream-notification')) {
        const notification = document.createElement('div');
        notification.id = 'livestream-notification';
        notification.className = 'livestream-notification';
        
        // Format time
        const startTime = new Date(streamData.started_at || new Date()).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        });
        
        notification.innerHTML = `
          <div class="livestream-notification-header">
            <div class="livestream-notification-title">
              <i class="bi bi-broadcast"></i> Live Now: ${streamData.title || 'New Livestream'}
            </div>
            <button class="livestream-notification-close" onclick="this.parentNode.parentNode.remove()">
              <i class="bi bi-x"></i>
            </button>
          </div>
          <p>${streamData.teacher_name || 'Your teacher'} is streaming now</p>
          <div class="livestream-notification-time">Started at ${startTime}</div>
          <button class="btn btn-danger btn-sm mt-2 join-stream-btn" 
                  onclick="window.LivestreamSocketIntegration.joinStream('${streamData.stream_id}')">
            <i class="bi bi-play-fill"></i> Join Livestream
          </button>
        `;
        
        // Add styles if not already added
        this.addNotificationStyles();
        
        // Add to the page
        document.body.appendChild(notification);
        
        // Auto-remove after 30 seconds
        setTimeout(() => {
          const notif = document.getElementById('livestream-notification');
          if (notif) notif.remove();
        }, 30000);
      }
    },
    
    // Join stream from notification
    joinStream: function(streamId) {
      // Remove the notification
      const notification = document.getElementById('livestream-notification');
      if (notification) notification.remove();
      
      // Initialize LivestreamModule if needed
      if (window.LivestreamModule) {
        // Join as audience
        window.LivestreamModule.joinLivestream(streamId);
      } else {
        console.error("LivestreamModule not available");
        alert("Cannot join livestream. Please refresh the page and try again.");
      }
    },
    
    // Add styles for notifications
    addNotificationStyles: function() {
      if (document.getElementById('livestream-notification-styles')) return;
      
      const style = document.createElement('style');
      style.id = 'livestream-notification-styles';
      style.textContent = `
        .livestream-notification {
          position: fixed;
          bottom: 20px;
          left: 20px;
          width: 300px;
          background-color: #fff;
          border-left: 4px solid #f44336;
          border-radius: 4px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          padding: 15px;
          z-index: 9990;
          animation: slideIn 0.3s ease;
        }
        
        .livestream-notification-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        
        .livestream-notification-title {
          font-weight: 600;
          color: #f44336;
        }
        
        .livestream-notification-title i {
          margin-right: 5px;
          animation: pulse 1.5s infinite;
        }
        
        .livestream-notification-close {
          background: none;
          border: none;
          font-size: 1.2rem;
          cursor: pointer;
          padding: 0;
          margin: 0;
          color: #666;
        }
        
        .livestream-notification-time {
          font-size: 0.8rem;
          color: #666;
          margin-top: 5px;
        }
        
        @keyframes slideIn {
          from { transform: translateX(-100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `;
      
      document.head.appendChild(style);
    },
    
    // Helper to get current username
    getCurrentUsername: function() {
      const teacherNameElement = document.getElementById('teacher-name');
      if (teacherNameElement) {
        return teacherNameElement.dataset.teacherName;
      }
      
      return null;
    }
  };
  
  // Initialize the integration when the page loads
  document.addEventListener('DOMContentLoaded', function() {
    LivestreamSocketIntegration.init();
  });