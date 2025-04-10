// student_livestream.js - Implementation for student livestream viewing

document.addEventListener('DOMContentLoaded', function() {
    // Constants
    const ROOM_ID = document.getElementById("room-id-data")?.dataset?.roomId;
    const STUDENT_NAME = document.getElementById('student-name')?.dataset?.studentName;
    
    if (!ROOM_ID || !STUDENT_NAME) {
      console.error('Missing required room or student information');
      return;
    }
    
    // Variables
    let livekitRoom;
    let localParticipant;
    let teacherParticipant;
    let teacherVideoTrack;
    let teacherScreenTrack;
    
    // DOM Elements
    const joinLivestreamBtn = document.getElementById('joinLivestreamBtn');
    const leaveLivestreamBtn = document.getElementById('leaveLivestreamBtn');
    
    // Load the LiveKit SDK
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
    
    // Check for active livestreams in this room
    async function checkForLivestreams() {
      try {
        const response = await fetch(`/get-livestreams/?room_id=${ROOM_ID}&status=upcoming`);
        const data = await response.json();
        
        if (data.success && data.livestreams && data.livestreams.length > 0) {
          // Check if any of the livestreams are currently live
          const liveStreams = data.livestreams.filter(stream => stream.status === 'live');
          
          if (liveStreams.length > 0) {
            // Enable the join button and update UI
            showLivestreamAvailable(liveStreams[0]);
          } else {
            hideLivestreamAvailable();
          }
        } else {
          hideLivestreamAvailable();
        }
      } catch (error) {
        console.error('Error checking for livestreams:', error);
      }
    }
    
    // Show UI indicating a livestream is available
    function showLivestreamAvailable(livestream) {
      // Create or update livestream notification
      let notification = document.getElementById('livestream-notification');
      
      if (!notification) {
        notification = document.createElement('div');
        notification.id = 'livestream-notification';
        notification.className = 'livestream-notification';
        
        // Add it to the page, right at the top of the chat section
        const chatSection = document.querySelector('.chat-section');
        if (chatSection) {
          chatSection.insertBefore(notification, chatSection.firstChild);
        }
      }
      
      notification.innerHTML = `
        <div class="livestream-notification-header">
          <div class="livestream-notification-title">
            <i class="bi bi-broadcast"></i> Livestream in Progress
          </div>
          <button class="livestream-notification-close" aria-label="Close">
            <i class="bi bi-x"></i>
          </button>
        </div>
        <div class="livestream-notification-content">
          <strong>${livestream.title}</strong> by ${livestream.teacher_name}
          <div class="livestream-notification-time">Started at ${livestream.scheduled_time}</div>
        </div>
        <button id="joinLivestreamBtn" class="btn btn-danger btn-sm mt-2">
          <i class="bi bi-play-fill"></i> Join Livestream
        </button>
      `;
      
      // Store livestream data
      notification.dataset.livestreamId = livestream.id;
      notification.dataset.livekitRoom = livestream.livekit_room || `live-${ROOM_ID}`;
      
      // Add event listeners
      notification.querySelector('.livestream-notification-close').addEventListener('click', function() {
        notification.style.display = 'none';
      });
      
      notification.querySelector('#joinLivestreamBtn').addEventListener('click', function() {
        joinLivestream(notification.dataset.livekitRoom, notification.dataset.livestreamId);
      });
    }
    
    // Hide livestream notification
    function hideLivestreamAvailable() {
      const notification = document.getElementById('livestream-notification');
      if (notification) {
        notification.remove();
      }
    }
    
    // Join a livestream
    async function joinLivestream(roomName, livestreamId) {
      try {
        // Show loading state
        const joinBtn = document.getElementById('joinLivestreamBtn');
        if (joinBtn) {
          joinBtn.disabled = true;
          joinBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Joining...';
        }
        
        // Load SDK if needed
        await loadLivekitSDK();
        
        // Get token to join the room
        const tokenResponse = await fetch('/livekit/get-token/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
          },
          body: JSON.stringify({
            room_name: roomName,
            participant_name: STUDENT_NAME,
            participant_identity: `student-${STUDENT_NAME}`,
            is_teacher: false
          })
        });
        
        const tokenData = await tokenResponse.json();
        
        if (!tokenData.success) {
          throw new Error(tokenData.error || 'Failed to generate access token');
        }
        
        // Create room and connect
        await connectToLivekitRoom(tokenData.token, roomName, livestreamId);
        
        // Show livestream view
        showLivestreamView(livestreamId, roomName);
        
      } catch (error) {
        console.error('Error joining livestream:', error);
        showToast('Failed to join livestream: ' + error.message, 'error');
        
        // Reset join button
        const joinBtn = document.getElementById('joinLivestreamBtn');
        if (joinBtn) {
          joinBtn.disabled = false;
          joinBtn.innerHTML = '<i class="bi bi-play-fill"></i> Join Livestream';
        }
      }
    }
    
    // Connect to LiveKit room
    async function connectToLivekitRoom(token, roomName, livestreamId) {
      try {
        const { Room, RoomEvent, RemoteParticipant, RemoteTrackPublication, Track } = window.LivekitClient;
        
        // Create a new room
        livekitRoom = new Room({
          adaptiveStream: true,
          dynacast: true
        });
        
        // Set up event listeners
        livekitRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          console.log('Track subscribed:', track.kind, 'from', participant.identity);
          
          // Handle teacher tracks
          if (participant.identity.startsWith('teacher-')) {
            if (track.kind === Track.Kind.Video) {
              if (publication.source === Track.Source.Camera) {
                teacherVideoTrack = track;
                attachTeacherVideo(track);
              } else if (publication.source === Track.Source.ScreenShare) {
                teacherScreenTrack = track;
                attachTeacherScreenShare(track);
              }
            }
          }
        });
        
        livekitRoom.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
          console.log('Track unsubscribed:', track.kind, 'from', participant.identity);
          
          // Handle teacher leaving tracks
          if (participant.identity.startsWith('teacher-')) {
            if (track.kind === Track.Kind.Video) {
              if (publication.source === Track.Source.Camera) {
                teacherVideoTrack = null;
                // Show teacher offline state
                showTeacherOffline();
              } else if (publication.source === Track.Source.ScreenShare) {
                teacherScreenTrack = null;
                hideTeacherScreenShare();
              }
            }
          }
        });
        
        livekitRoom.on(RoomEvent.ParticipantConnected, (participant) => {
          console.log('Participant connected:', participant.identity);
          
          if (participant.identity.startsWith('teacher-')) {
            teacherParticipant = participant;
          }
        });
        
        livekitRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
          console.log('Participant disconnected:', participant.identity);
          
          if (participant.identity.startsWith('teacher-')) {
            teacherParticipant = null;
            showTeacherOffline();
            hideTeacherScreenShare();
          }
        });
        
        livekitRoom.on(RoomEvent.Disconnected, () => {
          console.log('Disconnected from room');
          cleanupLivestream();
        });
        
        livekitRoom.on(RoomEvent.DataReceived, (data, participant) => {
          try {
            const decodedData = JSON.parse(new TextDecoder().decode(data));
            
            if (decodedData.type === 'chat') {
              // Add the received message to the chat
              addChatMessage(
                decodedData.sender,
                decodedData.message,
                new Date(decodedData.timestamp),
                decodedData.role || 'student',
                participant.identity === localParticipant?.identity
              );
            }
          } catch (error) {
            console.error('Error processing received data:', error);
          }
        });
        
        // Connect to the room
        await livekitRoom.connect('https://edulink-oxkw0h5q.livekit.cloud', token);
        console.log('Connected to LiveKit room:', roomName);
        
        // Get the local participant
        localParticipant = livekitRoom.localParticipant;
        
        // Store livestream ID for later
        sessionStorage.setItem('active_livestream_id', livestreamId);
        sessionStorage.setItem('active_livestream_room', roomName);
        
        return livekitRoom;
        
      } catch (error) {
        console.error('Error connecting to LiveKit room:', error);
        throw new Error('Failed to connect to livestream. Please try again.');
      }
    }
    
    // Show livestream view
    function showLivestreamView(livestreamId, roomName) {
      // Hide notification if it exists
      hideLivestreamAvailable();
      
      // Create livestream interface container if it doesn't exist
      let livestreamContainer = document.getElementById('student-livestream-container');
      if (!livestreamContainer) {
        livestreamContainer = document.createElement('div');
        livestreamContainer.id = 'student-livestream-container';
        livestreamContainer.className = 'student-livestream-container';
        document.body.appendChild(livestreamContainer);
      }
      
      // Create livestream interface
      livestreamContainer.innerHTML = `
        <div class="livestream-header">
          <div class="livestream-title">
            <i class="bi bi-broadcast"></i>
            <span>LIVE</span>
            <span class="live-indicator">LIVE</span>
          </div>
          <div class="livestream-controls">
            <button id="chatToggleBtn" class="btn btn-sm btn-outline-secondary">
              <i class="bi bi-chat-dots"></i> Chat
              <span id="unread-count" class="badge bg-danger rounded-pill d-none">0</span>
            </button>
            <button id="leaveLivestreamBtn" class="btn btn-sm btn-danger">
              <i class="bi bi-x-circle"></i> Leave Stream
            </button>
          </div>
        </div>
        <div class="livestream-body">
          <div class="video-container">
            <div id="teacherVideoContainer" class="teacher-video-container">
              <video id="teacherVideo" class="teacher-video" autoplay playsinline></video>
              <div class="teacher-offline-overlay">
                <i class="bi bi-camera-video-off"></i>
                <span>Teacher's camera is off</span>
              </div>
              <div class="video-label">Teacher</div>
            </div>
            <div id="screenShareContainer" class="screen-share-container" style="display: none;">
              <video id="screenShareVideo" class="screen-share-video" autoplay playsinline></video>
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
      addStudentLivestreamStyles();
      
      // Show the livestream container
      livestreamContainer.style.display = 'block';
      
      // Set up event listeners
      document.getElementById('chatToggleBtn').addEventListener('click', toggleChat);
      document.getElementById('closeChatBtn').addEventListener('click', toggleChat);
      document.getElementById('leaveLivestreamBtn').addEventListener('click', leaveLivestream);
      
      // Initialize chat features
      initializeChat();
      
      // Show teacher as offline initially
      showTeacherOffline();
      
      // If we already have teacher tracks, attach them
      if (teacherVideoTrack) {
        attachTeacherVideo(teacherVideoTrack);
      }
      
      if (teacherScreenTrack) {
        attachTeacherScreenShare(teacherScreenTrack);
      }
    }
    
    // Attach teacher's video to the DOM
    function attachTeacherVideo(track) {
      const teacherVideo = document.getElementById('teacherVideo');
      if (teacherVideo) {
        track.attach(teacherVideo);
        document.querySelector('.teacher-offline-overlay').style.display = 'none';
      }
    }
    
    // Show teacher offline state
    function showTeacherOffline() {
      const teacherOfflineOverlay = document.querySelector('.teacher-offline-overlay');
      if (teacherOfflineOverlay) {
        teacherOfflineOverlay.style.display = 'flex';
      }
    }
    
    // Attach teacher's screen share to the DOM
    function attachTeacherScreenShare(track) {
      const screenShareVideo = document.getElementById('screenShareVideo');
      const screenShareContainer = document.getElementById('screenShareContainer');
      
      if (screenShareVideo && screenShareContainer) {
        track.attach(screenShareVideo);
        screenShareContainer.style.display = 'block';
        
        // Adjust the teacher video position
        const teacherVideoContainer = document.getElementById('teacherVideoContainer');
        if (teacherVideoContainer) {
          teacherVideoContainer.classList.add('with-screen-share');
        }
      }
    }
    
    // Hide teacher's screen share
    function hideTeacherScreenShare() {
      const screenShareContainer = document.getElementById('screenShareContainer');
      if (screenShareContainer) {
        screenShareContainer.style.display = 'none';
        
        // Reset teacher video position
        const teacherVideoContainer = document.getElementById('teacherVideoContainer');
        if (teacherVideoContainer) {
          teacherVideoContainer.classList.remove('with-screen-share');
        }
      }
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
            sender: STUDENT_NAME,
            message: message,
            timestamp: new Date().toISOString(),
            role: 'student'
          });
          
          localParticipant.publishData(new TextEncoder().encode(chatData));
          
          // Add the message to the chat display
          addChatMessage(STUDENT_NAME, message, new Date(), 'student', true);
          
          // Clear the input field
          chatInput.value = '';
        }
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
      
      // Increment unread count if chat is not visible
      if (!document.getElementById('chatContainer').classList.contains('visible') && !isFromMe) {
        const unreadCount = document.getElementById('unread-count');
        const currentCount = parseInt(unreadCount.textContent) || 0;
        unreadCount.textContent = currentCount + 1;
        unreadCount.classList.remove('d-none');
      }
    }
    
    // Leave the livestream
    function leaveLivestream() {
      try {
        // Disconnect from LiveKit room
        if (livekitRoom) {
          livekitRoom.disconnect();
          livekitRoom = null;
        }
        
        // Clear session storage
        sessionStorage.removeItem('active_livestream_id');
        sessionStorage.removeItem('active_livestream_room');
        
        // Remove livestream interface
        cleanupLivestream();
        
        // Check for active livestreams again after a short delay
        setTimeout(checkForLivestreams, 1000);
        
      } catch (error) {
        console.error('Error leaving livestream:', error);
      }
    }
    
    // Cleanup livestream UI
    function cleanupLivestream() {
      // Reset variables
      teacherParticipant = null;
      teacherVideoTrack = null;
      teacherScreenTrack = null;
      
      // Remove livestream container
      const livestreamContainer = document.getElementById('student-livestream-container');
      if (livestreamContainer) {
        livestreamContainer.remove();
      }
    }
    
    // Add styles for the student livestream interface
    function addStudentLivestreamStyles() {
      if (document.getElementById('student-livestream-styles')) return;
      
      const styleElement = document.createElement('style');
      styleElement.id = 'student-livestream-styles';
      styleElement.textContent = `
        .student-livestream-container {
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
        
        .teacher-video-container {
          position: relative;
          width: 80%;
          max-width: 1200px;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
          aspect-ratio: 16 / 9;
          transition: all 0.3s ease;
        }
        
        .teacher-video-container.with-screen-share {
          position: absolute;
          bottom: 20px;
          right: 20px;
          width: 25%;
          max-width: 320px;
          z-index: 10;
        }
        
        .teacher-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          background-color: #333;
        }
        
        .teacher-offline-overlay {
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
        
        .teacher-offline-overlay i {
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
          position: relative;
          width: 80%;
          max-width: 1200px;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
          aspect-ratio: 16 / 9;
          margin-bottom: 20px;
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
        
        .livestream-notification {
          background-color: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 12px 16px;
          margin-bottom: 16px;
          border-radius: 4px;
          position: relative;
        }
  
        .livestream-notification-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
  
        .livestream-notification-title {
          font-weight: 600;
          color: #212529;
        }
  
        .livestream-notification-close {
          background: none;
          border: none;
          font-size: 1.2rem;
          color: #6c757d;
          cursor: pointer;
        }
  
        .livestream-notification-time {
          font-weight: 500;
          color: #dc3545;
        }
        
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.6; }
          100% { opacity: 1; }
        }
      `;
      
      document.head.appendChild(styleElement);
    }
    
    // Check for active session or livestream on page load
    function checkForActiveSession() {
      const livestreamId = sessionStorage.getItem('active_livestream_id');
      const roomName = sessionStorage.getItem('active_livestream_room');
      
      if (livestreamId && roomName) {
        // Try to reconnect to active session
        loadLivekitSDK()
          .then(() => {
            // Get a fresh token
            return fetch('/livekit/get-token/', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
              },
              body: JSON.stringify({
                room_name: roomName,
                participant_name: STUDENT_NAME,
                participant_identity: `student-${STUDENT_NAME}`,
                is_teacher: false
              })
            });
          })
          .then(response => response.json())
          .then(tokenData => {
            if (tokenData.success) {
              return connectToLivekitRoom(tokenData.token, roomName, livestreamId);
            } else {
              throw new Error('Failed to get token');
            }
          })
          .then(() => {
            showLivestreamView(livestreamId, roomName);
          })
          .catch(error => {
            console.error('Failed to reconnect to livestream:', error);
            // Clear session storage if reconnection fails
            sessionStorage.removeItem('active_livestream_id');
            sessionStorage.removeItem('active_livestream_room');
            
            // Check for active livestreams instead
            checkForLivestreams();
          });
      } else {
        // Check for active livestreams
        checkForLivestreams();
        
        // Set up polling to check for new livestreams
        setInterval(checkForLivestreams, 30000); // Check every 30 seconds
      }
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
    
    // Check for active sessions or livestreams on page load
    document.addEventListener('DOMContentLoaded', function() {
      checkForActiveSession();
    });
  });