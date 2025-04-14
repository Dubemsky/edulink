/**
 * Agora Livestreaming Integration for EduLink
 * 
 * This file handles the client-side implementation of livestreaming functionality
 * using Agora RTM and RTC SDKs.
 */

// Global variables
let agoraRtcClient = null;
let localStream = null;
let remoteStreams = {};
let isLive = false;
let currentRoomId = null;
let currentStreamId = null;
let currentChannelName = null;
let userRole = 'audience'; // 'host' or 'audience'
let videoEnabled = true;
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
        console.log('Initializing Agora client:', { appId, channelName, uid, role });
        
        // Initialize the RTC client
        agoraRtcClient = AgoraRTC.createClient({ mode: 'live', codec: 'h264' });
        
        // Set the client role
        userRole = role;
        await agoraRtcClient.setClientRole(role);
        
        // Initialize event listeners
        setupEventListeners();
        
        // Join the channel
        await agoraRtcClient.join(appId, channelName, token, uid);
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
        // Create a local stream
        localStream = AgoraRTC.createStream({
            audio: true,
            video: true,
            screen: false
        });
        
        // Initialize the local stream
        await localStream.init();
        
        // Play the local stream
        const localVideoContainer = document.getElementById(localVideoId);
        if (localVideoContainer) {
            localStream.play(localVideoId);
            console.log('Local stream playing in element:', localVideoId);
        } else {
            console.error('Local video container not found:', localVideoId);
        }
        
        // Publish the local stream to the channel
        await agoraRtcClient.publish(localStream);
        console.log('Local stream published successfully');
        
        isLive = true;
        updateStreamStatus('live');
        startStreamTimer();
        
        return true;
    } catch (error) {
        console.error('Error initializing local stream:', error);
        showError('Failed to initialize camera and microphone.');
        return false;
    }
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
        
        // Update UI to show that streaming is active
        document.getElementById('goLiveModal').classList.remove('show');
        document.body.classList.remove('modal-open');
        document.getElementsByClassName('modal-backdrop')[0]?.remove();
        
        // Show streaming controls
        showStreamingControls();
        
        return true;
    } catch (error) {
        console.error('Error starting livestream:', error);
        hideLoading();
        showError('Failed to start livestream. Please try again.');
        return false;
    }
}

// End a livestream (for teachers)
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
        
        // Hide streaming controls
        hideStreamingControls();
        
        hideLoading();
        showMessage('Livestream ended successfully.');
        
        return true;
    } catch (error) {
        console.error('Error ending livestream:', error);
        
        // Try to leave the channel anyway
        await leaveChannel();
        
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
        // Stop and close local stream if it exists
        if (localStream) {
            localStream.stop();
            localStream.close();
            localStream = null;
        }
        
        // Stop and clear all remote streams
        Object.values(remoteStreams).forEach(stream => {
            stream.stop();
        });
        remoteStreams = {};
        
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

// Toggle camera on/off
function toggleCamera() {
    if (!localStream) return;
    
    if (videoEnabled) {
        localStream.muteVideo();
        document.getElementById('toggleCameraBtn').innerHTML = '<i class="bi bi-camera-video-off"></i> Enable Camera';
    } else {
        localStream.unmuteVideo();
        document.getElementById('toggleCameraBtn').innerHTML = '<i class="bi bi-camera-video"></i> Disable Camera';
    }
    
    videoEnabled = !videoEnabled;
}

// Toggle microphone on/off
function toggleMicrophone() {
    if (!localStream) return;
    
    if (audioEnabled) {
        localStream.muteAudio();
        document.getElementById('toggleMicBtn').innerHTML = '<i class="bi bi-mic-mute"></i> Unmute Mic';
    } else {
        localStream.unmuteAudio();
        document.getElementById('toggleMicBtn').innerHTML = '<i class="bi bi-mic"></i> Mute Mic';
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

// Timer functions
let streamTimerInterval = null;
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