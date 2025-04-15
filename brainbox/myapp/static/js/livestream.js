/**
 * Agora Livestreaming Integration for EduLink
 * 
 * This file handles the client-side implementation of livestreaming functionality
 * using Agora RTM and RTC SDKs.
 */

// Global variables
// Global variables
let agoraRtcClient = null;
let localTracks = null;
let screenTracks = null;
let remoteUsers = {};
let isLive = false;
let currentRoomId = null;
let currentStreamId = null;
let currentChannelName = null;
let userRole = 'audience'; // 'host' or 'audience'
let videoEnabled = true;
let streamTimerInterval = null;
let audioEnabled = true;

// DOM element IDs (ensure these match your HTML)
const streamContainerId = 'livestream-container';
const localVideoId = 'local-video';
const remoteVideoClass = 'remote-video';
const viewerCountId = 'viewer-count';
const streamStatusId = 'stream-status';
const streamTimerId = 'stream-timer';

// Initialize the Agora client
async function initAgoraClient(appId, channelName, token, uid, role) {
    try {
        console.log('Initializing Agora client with 4.x API:', { appId, channelName, uid, role });
        
        // Initialize the RTC client with the new API
        agoraRtcClient = AgoraRTC.createClient({ mode: 'live', codec: 'h264' });
        
        // Set the client role
        userRole = role;
        await agoraRtcClient.setClientRole(role === 'host' ? 'host' : 'audience');
        
        // Initialize event listeners
        setupEventListeners();
        
        // Join the channel
        await agoraRtcClient.join(appId, channelName, token, uid || null);
        console.log('Successfully joined channel:', channelName);
        
        currentChannelName = channelName;
        
        if (role === 'host') {
            // Create and publish local stream for host
            await initLocalStream();
        }
        
        return true;
    } catch (error) {
        console.error('Error initializing Agora client:', error);
        showError('Failed to connect to the livestream. Please try again.');
        return false;
    }
}




// Initialize the local stream (for teacher/host)
async function initLocalStream() {
    try {
        console.log("Initializing local stream with Agora 4.x API...");
        
        // Create an Agora client with the new API
        if (!agoraRtcClient) {
            console.error("Agora client not initialized");
            return false;
        }
        
        // Create local tracks (this replaces createStream in the new API)
        const [microphoneTrack, cameraTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
        
        // Store the local tracks
        localTracks = {
            audioTrack: microphoneTrack,
            videoTrack: cameraTrack
        };
        
        // Display local video track
        const localVideoContainer = document.getElementById('local-stream-container');
        if (localVideoContainer) {
            // Play video in the container
            localTracks.videoTrack.play('local-stream-container');
            console.log("Local video track playing successfully");
        } else {
            console.error("Local stream container not found, creating interface");
            createStreamingInterface();
            
            // Try playing again after a short delay
            setTimeout(() => {
                const newContainer = document.getElementById('local-stream-container');
                if (newContainer) {
                    localTracks.videoTrack.play('local-stream-container');
                    console.log("Playing in newly created container");
                }
            }, 500);
        }
        
        // Publish the local tracks
        await agoraRtcClient.publish(Object.values(localTracks));
        console.log("Local tracks published successfully");
        
        isLive = true;
        updateStreamStatus('live');
        startStreamTimer();
        
        return true;
    } catch (error) {
        console.error('Error initializing local stream:', error);
        showError('Failed to initialize camera and microphone: ' + error.message);
        return false;
    }
}



function createStreamingInterface() {
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
    document.getElementById('toggle-camera-btn').addEventListener('click', toggleCamera);
    document.getElementById('toggle-mic-btn').addEventListener('click', toggleMicrophone);
    document.getElementById('toggle-screen-share-btn').addEventListener('click', toggleScreenShare);
    document.getElementById('toggle-interaction-btn').addEventListener('click', toggleInteractionPanel);
    document.getElementById('end-stream-btn').addEventListener('click', endLivestream);
    
    // Add event listener to chat input
    document.getElementById('send-chat-button').addEventListener('click', sendChatMessage);
    document.getElementById('live-chat-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });
    
    // Add the styles for the enhanced interface
    addEnhancedInterfaceStyles();
}



async function toggleScreenShare() {
    if (!isLive) return;
    
    const screenShareBtn = document.getElementById('toggle-screen-share-btn');
    const screenShareWrapper = document.querySelector('.screen-share-wrapper');
    
    // If we're already sharing screen, stop sharing
    if (screenTracks) {
        // Stop the screen tracks
        for (const track of Object.values(screenTracks)) {
            if (track) {
                track.stop();
                track.close();
            }
        }
        
        // Unpublish screen tracks
        if (agoraRtcClient) {
            await agoraRtcClient.unpublish(Object.values(screenTracks));
        }
        
        screenTracks = null;
        
        // Update UI
        screenShareBtn.innerHTML = '<i class="bi bi-display"></i>';
        screenShareWrapper.style.display = 'none';
        
        // Adjust the layout
        document.querySelector('.local-stream-wrapper').style.width = '100%';
        
        return;
    }
    
    try {
        // Create screen sharing tracks
        screenTracks = {
            videoTrack: await AgoraRTC.createScreenVideoTrack()
        };
        
        // Play the screen sharing track locally
        screenShareWrapper.style.display = 'block';
        screenTracks.videoTrack.play('screen-share-container');
        
        // Adjust the layout
        document.querySelector('.local-stream-wrapper').style.width = '50%';
        
        // Publish the screen sharing track
        await agoraRtcClient.publish(Object.values(screenTracks));
        
        // Update the button UI
        screenShareBtn.innerHTML = '<i class="bi bi-display-fill"></i>';
        
        // Handle screen share stopped event
        screenTracks.videoTrack.on('track-ended', async () => {
            // Stop and close screen track
            screenTracks.videoTrack.stop();
            screenTracks.videoTrack.close();
            
            // Unpublish screen track
            if (agoraRtcClient) {
                await agoraRtcClient.unpublish([screenTracks.videoTrack]);
            }
            
            screenTracks = null;
            
            // Update UI
            screenShareBtn.innerHTML = '<i class="bi bi-display"></i>';
            screenShareWrapper.style.display = 'none';
            document.querySelector('.local-stream-wrapper').style.width = '100%';
        });
        
    } catch (error) {
        console.error('Error sharing screen:', error);
        showError('Failed to share screen: ' + error.message);
        
        // Reset UI if there was an error
        screenShareBtn.innerHTML = '<i class="bi bi-display"></i>';
        screenShareWrapper.style.display = 'none';
        document.querySelector('.local-stream-wrapper').style.width = '100%';
    }
}

function toggleInteractionPanel() {
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
}




function sendChatMessage() {
    const chatInput = document.getElementById('live-chat-input');
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    // Clear the input
    chatInput.value = '';
    
    // Add message to the chat
    addChatMessage('You (Host)', message, true);
    
    // Send the message to viewers (implementation depends on your backend)
    // This is a placeholder - you'll need to integrate with your actual backend
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'livestream_chat',
            message: message,
            sender: currentUserName,
            role: 'teacher',
            room_id: currentRoomId,
            timestamp: new Date().toISOString()
        }));
    }
}

// Function to add a chat message to the UI
function addChatMessage(sender, message, isHost = false) {
    const chatMessages = document.getElementById('live-chat-messages');
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
}

// Function to add a question to the UI
function addQuestion(sender, question) {
    const questionsList = document.getElementById('live-questions-list');
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
    
    // Add event listeners to the buttons
    questionElement.querySelector('.answer-question-btn').addEventListener('click', function() {
        // Highlight this question as being answered
        this.closest('.question-item').classList.add('being-answered');
        
        // Add a system message to the chat
        addChatMessage('System', `Now answering: "${question}"`, false);
    });
    
    questionElement.querySelector('.dismiss-question-btn').addEventListener('click', function() {
        // Remove this question from the list
        this.closest('.question-item').remove();
    });
    
    questionsList.appendChild(questionElement);
    questionsList.scrollTop = questionsList.scrollHeight;
}




// Set up event listeners for the Agora client
function setupEventListeners() {
    if (!agoraRtcClient) return;
    
    // User published event (someone started sharing their stream)
    agoraRtcClient.on('stream-added', function(evt) {
        const stream = evt.stream;
        console.log('New stream added:', stream.getId());
        
        // Subscribe to the stream
        agoraRtcClient.subscribe(stream, function(err) {
            console.error('Failed to subscribe to stream:', err);
        });
    });
    
    // After successfully subscribing to a remote stream
    agoraRtcClient.on('stream-subscribed', function(evt) {
        const remoteStream = evt.stream;
        const streamId = remoteStream.getId();
        console.log('Successfully subscribed to remote stream:', streamId);
        
        // Store the remote stream
        remoteStreams[streamId] = remoteStream;
        
        // Create container for remote stream if host
        if (userRole === 'audience') {
            const container = document.getElementById(streamContainerId);
            if (container) {
                // Create a div for the remote stream
                const remoteDiv = document.createElement('div');
                remoteDiv.id = 'remote-stream-' + streamId;
                remoteDiv.className = remoteVideoClass;
                container.appendChild(remoteDiv);
                
                // Play the remote stream
                remoteStream.play('remote-stream-' + streamId);
                console.log('Playing remote stream in container');
                
                // Update the stream status
                updateStreamStatus('watching');
            } else {
                console.error('Remote stream container not found:', streamContainerId);
            }
        }
    });
    
    // Remote stream was removed
    agoraRtcClient.on('stream-removed', function(evt) {
        const remoteStream = evt.stream;
        const streamId = remoteStream.getId();
        console.log('Remote stream removed:', streamId);
        
        // Stop and remove the remote stream
        if (remoteStreams[streamId]) {
            remoteStreams[streamId].stop();
            delete remoteStreams[streamId];
            
            const remoteDiv = document.getElementById('remote-stream-' + streamId);
            if (remoteDiv) {
                remoteDiv.parentNode.removeChild(remoteDiv);
            }
        }
        
        if (userRole === 'audience') {
            // If the host left and you're a viewer
            updateStreamStatus('ended');
            stopStreamTimer();
        }
    });
    
    // Handle peer leaving
    agoraRtcClient.on('peer-leave', function(evt) {
        const uid = evt.uid;
        console.log('Peer left the channel:', uid);
        
        if (userRole === 'audience') {
            // If the host left
            updateStreamStatus('ended');
            stopStreamTimer();
            showMessage('The host has ended the livestream.');
        }
    });
    
    // Client disconnected
    agoraRtcClient.on('client-banned', function(evt) {
        console.log('Client was banned from the channel');
        leaveChannel();
        showError('You were disconnected from the livestream.');
    });
    
    // Exception handler
    agoraRtcClient.on('exception', function(evt) {
        console.log('Exception:', evt.code, evt.msg);
    });
}


function addEnhancedInterfaceStyles() {
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

    const additionalStyles = `
    #local-stream-container {
        width: 100% !important;
        height: 100% !important;
        display: block !important;
        position: relative !important;
        overflow: hidden !important;
        background-color: #333 !important;
    }
    
    .local-stream-wrapper {
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 300px;
    }
    
    .agora_video_player {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
    }
`;

    // Append the additional styles
    style.textContent += additionalStyles;
    
    document.head.appendChild(style);
}

// Variables to track state
let screenStream = null;


// Add this function to help diagnose camera issues
function debugCameraAccess() {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            console.log("Camera access successful:", stream);
            
            // Create a temporary video element to test
            const videoElement = document.createElement('video');
            videoElement.srcObject = stream;
            videoElement.autoplay = true;
            videoElement.style.width = '320px';
            videoElement.style.height = '240px';
            videoElement.style.border = '3px solid red';
            videoElement.style.position = 'fixed';
            videoElement.style.bottom = '10px';
            videoElement.style.left = '10px';
            videoElement.style.zIndex = '9999';
            
            document.body.appendChild(videoElement);
            
            console.log("Debug video element added to page");
        })
        .catch(error => {
            console.error("Camera access failed:", error);
            alert("Camera access failed: " + error.message);
        });
}
// Start a livestream (for teachers)
async function startLivestream(roomId, title, notifyStudents = true) {
    if (isLive) {
        console.warn('Already streaming. Please end the current stream first.');
        return false;
    }
    
    try {
        showLoading('Initializing livestream...');
        
        // Get the teacher's user ID from the session
        const teacherId = getCurrentUserId();
        
        // Request livestream details from the server
        const response = await fetch('/start-livestream/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
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
            hideLoading();
            showError(data.error || 'Failed to start livestream.');
            return false;
        }
        
        // Store the stream details
        currentRoomId = roomId;
        currentStreamId = data.stream_id;
        
        // Create the enhanced streaming interface before initializing
        createStreamingInterface();
        
        // Initialize the Agora client
        const initialized = await initAgoraClient(
            data.app_id,
            data.channel_name,
            data.token,
            0, // Use 0 for the host
            'host'
        );
        
        if (!initialized) {
            hideLoading();
            return false;
        }
        
        hideLoading();
        showMessage('You are now live!');
        
        // Close the modal if open
        const goLiveModal = document.getElementById('goLiveModal');
        if (goLiveModal) {
            const bsModal = bootstrap.Modal.getInstance(goLiveModal);
            if (bsModal) {
                bsModal.hide();
            }
        }
        
        return true;
    } catch (error) {
        console.error('Error starting livestream:', error);
        hideLoading();
        showError('Failed to start livestream. Please try again.');
        return false;
    }
}

// Update the endLivestream function to work with the enhanced interface
async function endLivestream() {
    if (!isLive || !currentStreamId) {
        console.warn('No active livestream to end.');
        return false;
    }
    
    try {
        showLoading('Ending livestream...');
        
        // Call the server to end the livestream
        const response = await fetch('/end-livestream/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({
                stream_id: currentStreamId,
                teacher_id: getCurrentUserId()
            })
        });
        
        const data = await response.json();
        
        // Leave the Agora channel regardless of server response
        await leaveChannel();
        
        if (!data.success) {
            console.warn('Server reported error ending livestream:', data.error);
        }
        
        // Reset stream state
        isLive = false;
        stopStreamTimer();
        updateStreamStatus('ended');
        
        // Remove the enhanced streaming interface
        const interfaceContainer = document.getElementById('enhanced-streaming-interface');
        if (interfaceContainer) {
            interfaceContainer.remove();
        }
        
        hideLoading();
        showMessage('Livestream ended successfully.');
        
        return true;
    } catch (error) {
        console.error('Error ending livestream:', error);
        
        // Try to leave the channel anyway
        await leaveChannel();
        
        // Remove the enhanced streaming interface
        const interfaceContainer = document.getElementById('enhanced-streaming-interface');
        if (interfaceContainer) {
            interfaceContainer.remove();
        }
        
        hideLoading();
        showError('Error ending livestream, but stream was stopped.');
        return false;
    }
}

// Join a livestream (for students)
async function joinLivestream(streamId) {
    if (agoraRtcClient) {
        console.warn('Already connected to a stream. Please leave first.');
        return false;
    }
    
    try {
        showLoading('Joining livestream...');
        
        // Request joining details from the server
        const response = await fetch('/join-livestream/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({
                stream_id: streamId,
                user_id: getCurrentUserId()
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            hideLoading();
            showError(data.error || 'Failed to join livestream.');
            return false;
        }
        
        // Store the stream details
        currentStreamId = streamId;
        
        // Initialize the Agora client as audience
        const initialized = await initAgoraClient(
            data.app_id,
            data.channel_name,
            data.token,
            data.uid,
            'audience'
        );
        
        if (!initialized) {
            hideLoading();
            return false;
        }
        
        hideLoading();
        showMessage('Joined livestream successfully!');
        
        // Show viewing UI
        showViewingControls(data.stream_details);
        
        return true;
    } catch (error) {
        console.error('Error joining livestream:', error);
        hideLoading();
        showError('Failed to join livestream. Please try again.');
        return false;
    }
}

// Leave the current channel
async function leaveChannel() {
    try {
        // Close and dispose of local tracks
        if (localTracks) {
            for (const track of Object.values(localTracks)) {
                if (track) {
                    track.stop();
                    track.close();
                }
            }
            localTracks = null;
        }
        
        // Close and dispose of screen sharing tracks
        if (screenTracks) {
            for (const track of Object.values(screenTracks)) {
                if (track) {
                    track.stop();
                    track.close();
                }
            }
            screenTracks = null;
        }
        
        // Leave the channel
        if (agoraRtcClient) {
            await agoraRtcClient.leave();
            console.log('Left the channel successfully');
        }
        
        // Reset state
        agoraRtcClient = null;
        isLive = false;
        currentChannelName = null;
        
        // Reset UI
        stopStreamTimer();
        updateStreamStatus('disconnected');
        
        return true;
    } catch (error) {
        console.error('Error leaving channel:', error);
        return false;
    }
}

// Function to process incoming chat messages during livestream
function processLivestreamMessage(data) {
    if (!isLive) return;
    
    // Check if this is a chat message for the livestream
    if (data.type === 'livestream_chat') {
        // Add the message to the chat
        addChatMessage(data.sender, data.message, data.sender === getCurrentUserId());
    }
    // Check if this is a question for the livestream
    else if (data.type === 'livestream_question') {
        // Add the question to the questions list
        addQuestion(data.sender, data.question);
    }
}

// Update the socket event handler to support livestream messages
if (socket) {
    const originalOnMessage = socket.onmessage;
    socket.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            
            // Handle livestream-specific messages
            if (data.type && (data.type.startsWith('livestream_'))) {
                processLivestreamMessage(data);
            }
            // Pass to the original handler for regular messages
            else if (originalOnMessage) {
                originalOnMessage(event);
            }
        } catch (error) {
            console.error('Error processing message:', error);
            if (originalOnMessage) {
                originalOnMessage(event);
            }
        }
    };
}







// Update the websocket messaging to handle livestream events

// Add this to your existing socket connection/message handler code
function setupWebSocketForLivestream() {
    // Use existing socket if available or create a new one
    let socket = window.socket;
    
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        const roomId = currentRoomId || document.getElementById('room-id-data').dataset.roomId;
        const userRole = 'teacher'; // Assuming this is in the teacher view
        const socketURL = `ws://${window.location.host}/ws/${userRole}s-dashboard/hub-room/${roomId}/`;
        
        socket = new WebSocket(socketURL);
        window.socket = socket;
        
        socket.onopen = function() {
            console.log("WebSocket connection established for livestream");
        };
        
        socket.onerror = function(error) {
            console.error("WebSocket error:", error);
        };
        
        socket.onclose = function(event) {
            console.log("WebSocket closed:", event);
        };
    }
    
    // Set up the message handler to handle livestream messages
    const originalOnMessage = socket.onmessage;
    socket.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            
            // Check if this is a livestream message
            if (data.type === 'livestream_chat' && isLive) {
                // Handle chat message in the livestream UI
                console.log("Received livestream chat:", data);
                addChatMessage(data.sender, data.message, data.sender === getCurrentUserId());
                return;
            } else if (data.type === 'livestream_question' && isLive) {
                // Handle question in the livestream UI
                console.log("Received livestream question:", data);
                addQuestion(data.sender, data.message);
                return;
            } else if (data.type === 'livestream_join' && isLive) {
                // Handle viewer join event
                console.log("Viewer joined livestream:", data);
                updateViewerCount(data.viewer_count);
                // Optionally show a notification
                const chatMessages = document.getElementById('live-chat-messages');
                if (chatMessages) {
                    const notification = document.createElement('div');
                    notification.classList.add('system-message');
                    notification.textContent = `${data.username} joined the livestream`;
                    chatMessages.appendChild(notification);
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
                return;
            } else if (data.type === 'livestream_leave' && isLive) {
                // Handle viewer leave event
                console.log("Viewer left livestream:", data);
                updateViewerCount(data.viewer_count);
                return;
            }
            
            // If not a livestream message, pass to the original handler
            if (originalOnMessage) {
                originalOnMessage(event);
            }
        } catch (error) {
            console.error("Error processing WebSocket message:", error);
            // Still try to call the original handler
            if (originalOnMessage) {
                originalOnMessage(event);
            }
        }
    };
    
    return socket;
}

// Function to send a chat message via WebSocket
function sendLivestreamChatMessage(message) {
    if (!window.socket || window.socket.readyState !== WebSocket.OPEN) {
        console.error("WebSocket is not open");
        return false;
    }
    
    const messageData = {
        type: 'livestream_chat',
        message: message,
        sender: getCurrentUserId(),
        sender_name: getCurrentUsername(),
        room_id: currentRoomId,
        stream_id: currentStreamId,
        timestamp: new Date().toISOString()
    };
    
    window.socket.send(JSON.stringify(messageData));
    return true;
}

// Function to update the viewer count display
function updateViewerCount(count) {
    const viewerCountElement = document.getElementById('viewer-count');
    if (viewerCountElement) {
        viewerCountElement.textContent = count;
    }
}

// Initialize WebSocket when starting livestream
function initializeLivestreamCommunication() {
    setupWebSocketForLivestream();
    
    // Set up chat message sending
    const sendChatButton = document.getElementById('send-chat-button');
    const chatInput = document.getElementById('live-chat-input');
    
    if (sendChatButton && chatInput) {
        sendChatButton.addEventListener('click', function() {
            const message = chatInput.value.trim();
            if (message) {
                sendLivestreamChatMessage(message);
                // Also add to local UI
                addChatMessage('You (Host)', message, true);
                chatInput.value = '';
            }
        });
        
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const message = chatInput.value.trim();
                if (message) {
                    sendLivestreamChatMessage(message);
                    // Also add to local UI
                    addChatMessage('You (Host)', message, true);
                    chatInput.value = '';
                }
            }
        });
    }
}



function toggleCamera() {
    if (!localTracks || !localTracks.videoTrack) return;
    
    if (videoEnabled) {
        localTracks.videoTrack.setEnabled(false);
        document.getElementById('toggle-camera-btn').innerHTML = '<i class="bi bi-camera-video-off"></i>';
    } else {
        localTracks.videoTrack.setEnabled(true);
        document.getElementById('toggle-camera-btn').innerHTML = '<i class="bi bi-camera-video"></i>';
    }
    
    videoEnabled = !videoEnabled;
}

function toggleMicrophone() {
    if (!localTracks || !localTracks.audioTrack) return;
    
    if (audioEnabled) {
        localTracks.audioTrack.setEnabled(false);
        document.getElementById('toggle-mic-btn').innerHTML = '<i class="bi bi-mic-mute"></i>';
    } else {
        localTracks.audioTrack.setEnabled(true);
        document.getElementById('toggle-mic-btn').innerHTML = '<i class="bi bi-mic"></i>';
    }
    
    audioEnabled = !audioEnabled;
}

// Get available media devices
async function getMediaDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        console.error('Media devices API not supported in this browser');
        return {
            videoDevices: [],
            audioDevices: []
        };
    }
    
    try {
        // Get permission to access devices
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        
        // Enumerate all media devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        // Filter devices by type
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        const audioDevices = devices.filter(device => device.kind === 'audioinput');
        
        return {
            videoDevices,
            audioDevices
        };
    } catch (error) {
        console.error('Error enumerating media devices:', error);
        return {
            videoDevices: [],
            audioDevices: [],
            error: error.message
        };
    }
}

// Update the camera device
async function updateCameraDevice(deviceId) {
    if (!localStream) return false;
    
    try {
        // Stop the current video track
        localStream.getVideoTrack().stop();
        
        // Create a new video track with the selected device
        const videoTrack = await AgoraRTC.createCameraVideoTrack({
            cameraId: deviceId
        });
        
        // Replace the video track in the local stream
        await localStream.replaceTrack(videoTrack);
        
        return true;
    } catch (error) {
        console.error('Error updating camera device:', error);
        return false;
    }
}

// Update the microphone device
async function updateMicrophoneDevice(deviceId) {
    if (!localStream) return false;
    
    try {
        // Stop the current audio track
        localStream.getAudioTrack().stop();
        
        // Create a new audio track with the selected device
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
            microphoneId: deviceId
        });
        
        // Replace the audio track in the local stream
        await localStream.replaceTrack(audioTrack);
        
        return true;
    } catch (error) {
        console.error('Error updating microphone device:', error);
        return false;
    }
}

// Get scheduled livestreams for a room
async function getScheduledLivestreams(roomId) {
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
}

// Schedule a livestream
async function scheduleLivestream(roomId, title, description, scheduledDate, scheduledTime, durationMinutes, notifyStudents) {
    try {
        // Format the datetime properly
        const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
        const isoDateTime = scheduledDateTime.toISOString();
        
        const response = await fetch('/schedule-livestream/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({
                teacher_id: getCurrentUserId(),
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
            showError(data.error || 'Failed to schedule livestream.');
            return false;
        }
        
        showMessage('Livestream scheduled successfully for ' + formatDateTime(scheduledDateTime));
        return true;
    } catch (error) {
        console.error('Error scheduling livestream:', error);
        showError('Failed to schedule livestream. Please try again.');
        return false;
    }
}

// Cancel a scheduled livestream
async function cancelScheduledLivestream(scheduleId) {
    try {
        const response = await fetch('/cancel-scheduled-stream/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({
                schedule_id: scheduleId,
                teacher_id: getCurrentUserId()
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            showError(data.error || 'Failed to cancel scheduled livestream.');
            return false;
        }
        
        showMessage('Scheduled livestream canceled successfully.');
        return true;
    } catch (error) {
        console.error('Error canceling scheduled livestream:', error);
        showError('Failed to cancel livestream. Please try again.');
        return false;
    }
}

let streamDuration = 0;

function startStreamTimer() {
    streamDuration = 0;
    updateTimerDisplay();
    
    streamTimerInterval = setInterval(() => {
        streamDuration += 1;
        updateTimerDisplay();
    }, 1000);
}

function stopStreamTimer() {
    if (streamTimerInterval) {
        clearInterval(streamTimerInterval);
        streamTimerInterval = null;
    }
}

function updateTimerDisplay() {
    const timerElement = document.getElementById(streamTimerId);
    if (!timerElement) return;
    
    const hours = Math.floor(streamDuration / 3600);
    const minutes = Math.floor((streamDuration % 3600) / 60);
    const seconds = streamDuration % 60;
    
    const formattedTime = 
        (hours > 0 ? hours + ':' : '') + 
        (minutes < 10 ? '0' : '') + minutes + ':' + 
        (seconds < 10 ? '0' : '') + seconds;
    
    timerElement.textContent = formattedTime;
}

// Helper function to update stream status
function updateStreamStatus(status) {
    const statusElement = document.getElementById(streamStatusId);
    if (!statusElement) return;
    
    statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    
    // Update status classes
    statusElement.className = 'stream-status';
    statusElement.classList.add('status-' + status);
}

// UI helpers
function showLoading(message = 'Loading...') {
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
}

function hideLoading() {
    const loadingElement = document.getElementById('agora-loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

function showError(message) {
    const errorAlert = document.getElementById('liveErrorAlert');
    if (errorAlert) {
        errorAlert.textContent = message;
        errorAlert.style.display = 'block';
        
        setTimeout(() => {
            errorAlert.style.display = 'none';
        }, 5000);
    } else {
        alert(message);
    }
}

function showMessage(message) {
    // Create a toast notification
    const toastId = 'agora-toast-' + Date.now();
    const toastHtml = `
        <div id="${toastId}" class="agora-toast" style="display: none;">
            <div class="agora-toast-content">
                <i class="bi bi-info-circle"></i>
                <span>${message}</span>
            </div>
            <button type="button" class="agora-toast-close" onclick="document.getElementById('${toastId}').remove();">
                <i class="bi bi-x"></i>
            </button>
        </div>
    `;
    
    // Add to the document
    const toastContainer = document.getElementById('toast-container');
    if (toastContainer) {
        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    } else {
        const newContainer = document.createElement('div');
        newContainer.id = 'toast-container';
        newContainer.className = 'agora-toast-container';
        newContainer.innerHTML = toastHtml;
        document.body.appendChild(newContainer);
    }
    
    // Show the toast with animation
    const toast = document.getElementById(toastId);
    if (toast) {
        setTimeout(() => {
            toast.style.display = 'flex';
            setTimeout(() => {
                toast.classList.add('show');
            }, 10);
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => {
                    toast.remove();
                }, 300);
            }, 5000);
        }, 100);
    }
}

function showStreamingControls() {
    // Create streaming controls if they don't exist
    let controlsElement = document.getElementById('streaming-controls');
    
    if (!controlsElement) {
        controlsElement = document.createElement('div');
        controlsElement.id = 'streaming-controls';
        controlsElement.className = 'streaming-controls-container';
        
        controlsElement.innerHTML = `
            <div class="streaming-controls-header">
                <div class="streaming-status">
                    <span class="streaming-indicator"></span>
                    <span>Live</span>
                </div>
                <div class="streaming-timer" id="${streamTimerId}">00:00</div>
                <div class="streaming-viewer-count">
                    <i class="bi bi-people-fill"></i>
                    <span id="${viewerCountId}">0</span>
                </div>
            </div>
            <div class="streaming-controls-actions">
                <button id="stream-toggle-camera" onclick="toggleCamera()">
                    <i class="bi bi-camera-video"></i>
                </button>
                <button id="stream-toggle-mic" onclick="toggleMicrophone()">
                    <i class="bi bi-mic"></i>
                </button>
                <button id="stream-end-button" class="end-stream-btn" onclick="endLivestream()">
                    End Stream
                </button>
            </div>
        `;
        
        document.body.appendChild(controlsElement);
    }
    
    controlsElement.style.display = 'flex';
}

function hideStreamingControls() {
    const controlsElement = document.getElementById('streaming-controls');
    if (controlsElement) {
        controlsElement.style.display = 'none';
    }
}

function showViewingControls(streamDetails) {
    // Create viewing controls if they don't exist
    let viewingElement = document.getElementById('viewing-controls');
    
    if (!viewingElement) {
        viewingElement = document.createElement('div');
        viewingElement.id = 'viewing-controls';
        viewingElement.className = 'viewing-controls-container';
        
        const teacherName = streamDetails.teacher_id || 'Unknown';
        const startTime = streamDetails.started_at ? formatTime(new Date(streamDetails.started_at)) : 'Unknown';
        
        viewingElement.innerHTML = `
            <div class="viewing-controls-header">
                <div class="viewing-stream-info">
                    <h3>${streamDetails.title || 'Untitled Stream'}</h3>
                    <p>Teacher: ${teacherName}</p>
                    <p>Started: ${startTime}</p>
                </div>
                <div class="viewing-controls-status">
                    <span class="viewing-indicator"></span>
                    <span id="${streamStatusId}">Watching</span>
                </div>
            </div>
            <div class="viewing-controls-actions">
                <button id="leave-stream-button" class="leave-stream-btn" onclick="leaveChannel()">
                    Leave Stream
                </button>
            </div>
        `;
        
        document.body.appendChild(viewingElement);
    }
    
    viewingElement.style.display = 'flex';
}

function hideViewingControls() {
    const viewingElement = document.getElementById('viewing-controls');
    if (viewingElement) {
        viewingElement.style.display = 'none';
    }
}

// Utility functions
function getCsrfToken() {
    const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1];
    
    return cookieValue || '';
}

function getCurrentUserId() {
    // This function should be implemented based on how user info is stored in your app
    // For example, you might get it from a global variable, a data attribute, or localStorage
    const teacherNameElement = document.getElementById('teacher-name');
    if (teacherNameElement) {
        return teacherNameElement.dataset.teacherName;
    }
    
    // Fallback
    console.warn('Could not determine current user ID');
    return null;
}

function formatDateTime(date) {
    if (!(date instanceof Date)) {
        date = new Date(date);
    }
    
    return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatTime(date) {
    if (!(date instanceof Date)) {
        date = new Date(date);
    }
    
    return date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Add CSS to the page
function addStreamingStyles() {
    const styleId = 'agora-streaming-styles';
    
    // Only add styles once
    if (document.getElementById(styleId)) return;
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        /* Agora Streaming Styles */
        .streaming-controls-container {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(0, 0, 0, 0.8);
            color: white;
            border-radius: 8px;
            padding: 10px 20px;
            z-index: 1000;
            display: flex;
            flex-direction: column;
            min-width: 300px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
        
        .streaming-controls-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .streaming-status {
            display: flex;
            align-items: center;
        }
        
        .streaming-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background-color: #f00;
            margin-right: 8px;
            animation: pulse 1.5s infinite;
        }
        
        .streaming-timer {
            font-weight: bold;
        }
        
        .streaming-viewer-count {
            display: flex;
            align-items: center;
        }
        
        .streaming-viewer-count i {
            margin-right: 5px;
        }
        
        .streaming-controls-actions {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .streaming-controls-actions button {
            background-color: #444;
            border: none;
            color: white;
            border-radius: 4px;
            padding: 8px 12px;
            margin: 0 5px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .streaming-controls-actions button:hover {
            background-color: #555;
        }
        
        .end-stream-btn {
            background-color: #d9534f !important;
        }
        
        .end-stream-btn:hover {
            background-color: #c9302c !important;
        }
        
        /* Viewing controls */
        .viewing-controls-container {
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: rgba(0, 0, 0, 0.8);
            color: white;
            border-radius: 8px;
            padding: 15px;
            z-index: 1000;
            display: flex;
            flex-direction: column;
            min-width: 250px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
        
        .viewing-controls-header {
            margin-bottom: 15px;
        }
        
        .viewing-stream-info h3 {
            margin: 0 0 10px 0;
            font-size: 18px;
        }
        
        .viewing-stream-info p {
            margin: 5px 0;
            font-size: 14px;
            opacity: 0.8;
        }
        
        .viewing-controls-status {
            display: flex;
            align-items: center;
            margin-top: 10px;
        }
        
        .viewing-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background-color: #5cb85c;
            margin-right: 8px;
            animation: pulse 1.5s infinite;
        }
        
        .leave-stream-btn {
            background-color: #d9534f;
            border: none;
            color: white;
            border-radius: 4px;
            padding: 8px 12px;
            width: 100%;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .leave-stream-btn:hover {
            background-color: #c9302c;
        }
        
        /* Status colors */
        .status-live {
            color: #f00;
        }
        
        .status-watching {
            color: #5cb85c;
        }
        
        .status-ended {
            color: #f0ad4e;
        }
        
        .status-disconnected {
            color: #d9534f;
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
        .agora-toast-container {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
        }
        
        .agora-toast {
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
        
        .agora-toast.show {
            opacity: 1;
            transform: translateY(0);
        }
        
        .agora-toast-content {
            display: flex;
            align-items: center;
        }
        
        .agora-toast-content i {
            margin-right: 10px;
        }
        
        .agora-toast-close {
            background: none;
            border: none;
            color: white;
            opacity: 0.7;
            cursor: pointer;
        }
        
        .agora-toast-close:hover {
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
    `;
    
    document.head.appendChild(style);
}

// Initialize streaming styles when this script loads
document.addEventListener('DOMContentLoaded', function() {
    addStreamingStyles();
});