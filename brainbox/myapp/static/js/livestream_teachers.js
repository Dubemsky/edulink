/**
 * EduLink Teacher Livestreaming Functionality
 * 
 * This file contains the frontend implementation for teachers to start and manage livestreams.
 */

// Global variables
let availableCameras = [];
let availableMicrophones = [];
let cameraPreview = null;
let isPreviewActive = false;
let selectedCameraId = null;
let selectedMicrophoneId = null;
let currentRoomId = null;
let cameraEnabled = true;
let micEnabled = true;

console.log("Livestream Teachers JS loaded - Initial declarations complete");

// Initialize when the document is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM Content Loaded event triggered");
    
    // Get the current room ID
    const roomIdElement = document.getElementById('room-id-data');
    console.log("Room ID Element:", roomIdElement);
    
    if (roomIdElement) {
        currentRoomId = roomIdElement.dataset.roomId;
        console.log("Current Room ID set to:", currentRoomId);
    } else {
        console.warn("Room ID Element not found in the DOM");
    }
    
    // Set up the Go Live modal
    console.log("Initializing Go Live modal");
    initLivestreamModal();
    
    // Set up the Schedule Livestream modal
    console.log("Initializing Schedule Livestream modal");
    initScheduleModal();
    
    // Load scheduled livestreams
    console.log("Loading scheduled livestreams");
    loadScheduledLivestreams();
});

// Initialize the Go Live modal
function initLivestreamModal() {
    const modal = document.getElementById('goLiveModal');
    console.log("Go Live Modal element:", modal);
    
    if (!modal) {
        console.warn("Go Live Modal not found in the DOM");
        return;
    }
    
    // Handle modal open event
    console.log("Setting up modal open event listener");
    modal.addEventListener('show.bs.modal', function (event) {
        console.log("Modal show event triggered");
        // Reset form
        resetLivestreamForm();
        
        // Initialize camera and microphone dropdowns
        initDeviceSelectors();
        
        // Start camera preview
        startCameraPreview();
    });
    
    // Handle modal close event
    console.log("Setting up modal close event listener");
    modal.addEventListener('hidden.bs.modal', function (event) {
        console.log("Modal hidden event triggered");
        // Stop camera preview
        stopCameraPreview();
    });
    
    // Set up toggle buttons
    const toggleCameraBtn = document.getElementById('toggleCameraBtn');
    console.log("Toggle Camera Button:", toggleCameraBtn);
    
    if (toggleCameraBtn) {
        toggleCameraBtn.addEventListener('click', function() {
            console.log("Toggle Camera clicked");
            toggleCameraPreview();
        });
    } else {
        console.warn("Toggle Camera Button not found in the DOM");
    }
    
    const toggleMicBtn = document.getElementById('toggleMicBtn');
    console.log("Toggle Mic Button:", toggleMicBtn);
    
    if (toggleMicBtn) {
        toggleMicBtn.addEventListener('click', function() {
            console.log("Toggle Mic clicked");
            toggleMicPreview();
        });
    } else {
        console.warn("Toggle Mic Button not found in the DOM");
    }
    
    // Set up start livestream button
    const startLivestreamBtn = document.getElementById('startLivestreamBtn');
    console.log("Start Livestream Button:", startLivestreamBtn);
    
    if (startLivestreamBtn) {
        startLivestreamBtn.addEventListener('click', function() {
            console.log("Start Livestream clicked");
            handleStartLivestream();
        });
    } else {
        console.warn("Start Livestream Button not found in the DOM");
    }
    
    console.log("Go Live Modal initialization complete");
}

// Initialize the Schedule Livestream modal
function initScheduleModal() {
    console.log("Initializing Schedule Modal");
    
    const scheduleBtn = document.getElementById('scheduleLivestreamBtn');
    console.log("Schedule Livestream Button:", scheduleBtn);
    
    if (scheduleBtn) {
        scheduleBtn.addEventListener('click', function() {
            console.log("Schedule Livestream Button clicked");
            // Close the manage livestreams modal
            const manageModal = bootstrap.Modal.getInstance(document.getElementById('manageLivestreamModal'));
            console.log("Manage Modal instance:", manageModal);
            
            if (manageModal) {
                manageModal.hide();
            }
            
            // Open the schedule form modal
            const scheduleFormModal = new bootstrap.Modal(document.getElementById('scheduleLivestreamFormModal'));
            console.log("Schedule Form Modal instance:", scheduleFormModal);
            scheduleFormModal.show();
        });
    } else {
        console.warn("Schedule Livestream Button not found in the DOM");
    }
    
    // Set minimum date for the date picker
    const dateInput = document.getElementById('livestreamDate');
    console.log("Date Input element:", dateInput);
    
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.min = today;
        dateInput.value = today;
    } else {
        console.warn("Date Input not found in the DOM");
    }
    
    // Set up create button
    const createLivestreamBtn = document.getElementById('createLivestreamBtn');
    console.log("Create Livestream Button:", createLivestreamBtn);
    
    if (createLivestreamBtn) {
        createLivestreamBtn.addEventListener('click', function() {
            console.log("Create Livestream Button clicked");
            handleScheduleLivestream();
        });
    } else {
        console.warn("Create Livestream Button not found in the DOM");
    }
    
    console.log("Schedule Modal initialization complete");
}

// Reset the livestream form
function resetLivestreamForm() {
    console.log("Resetting livestream form");
    
    const titleInput = document.getElementById('liveTitleInput');
    if (titleInput) {
        titleInput.value = '';
    } else {
        console.warn("Live Title Input not found in the DOM");
    }
    
    const notifyCheckbox = document.getElementById('notifyStudentsLive');
    if (notifyCheckbox) {
        notifyCheckbox.checked = true;
    } else {
        console.warn("Notify Students Checkbox not found in the DOM");
    }
    
    const errorAlert = document.getElementById('liveErrorAlert');
    if (errorAlert) {
        errorAlert.style.display = 'none';
    } else {
        console.warn("Live Error Alert not found in the DOM");
    }
    
    // Reset device selection
    selectedCameraId = null;
    selectedMicrophoneId = null;
    
    // Reset preview state
    cameraEnabled = true;
    micEnabled = true;
    
    console.log("Livestream form reset complete");
}

// Initialize device selectors with available cameras and microphones
async function initDeviceSelectors() {
    console.log("Initializing device selectors");
    
    try {
        // Get available media devices
        console.log("Getting available media devices");
        const devices = await getMediaDevices();
        console.log("Retrieved devices:", devices);
        
        if (devices.error) {
            console.error("Error getting media devices:", devices.error);
            showDeviceError('Failed to access camera and microphone: ' + devices.error);
            return;
        }
        
        availableCameras = devices.videoDevices;
        availableMicrophones = devices.audioDevices;
        
        console.log("Available cameras:", availableCameras.length);
        console.log("Available microphones:", availableMicrophones.length);
        
        // Populate camera dropdown
        const cameraSelect = document.getElementById('cameraSelect');
        console.log("Camera Select element:", cameraSelect);
        
        if (cameraSelect) {
            // Clear existing options
            cameraSelect.innerHTML = '';
            
            if (availableCameras.length === 0) {
                console.log("No cameras available");
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'No cameras available';
                cameraSelect.appendChild(option);
                cameraSelect.disabled = true;
            } else {
                // Add cameras
                availableCameras.forEach((camera) => {
                    const option = document.createElement('option');
                    option.value = camera.deviceId;
                    option.textContent = camera.label || `Camera ${availableCameras.indexOf(camera) + 1}`;
                    cameraSelect.appendChild(option);
                });
                
                cameraSelect.disabled = false;
                
                // Set default camera
                if (availableCameras.length > 0) {
                    selectedCameraId = availableCameras[0].deviceId;
                    cameraSelect.value = selectedCameraId;
                    console.log("Default camera set to:", selectedCameraId);
                }
                
                // Handle camera change
                cameraSelect.addEventListener('change', function() {
                    console.log("Camera selection changed to:", this.value);
                    selectedCameraId = this.value;
                    updateCameraPreview();
                });
            }
        } else {
            console.warn("Camera Select not found in the DOM");
        }
        
        // Populate microphone dropdown
        const micSelect = document.getElementById('micSelect');
        console.log("Mic Select element:", micSelect);
        
        if (micSelect) {
            // Clear existing options
            micSelect.innerHTML = '';
            
            if (availableMicrophones.length === 0) {
                console.log("No microphones available");
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'No microphones available';
                micSelect.appendChild(option);
                micSelect.disabled = true;
            } else {
                // Add microphones
                availableMicrophones.forEach((mic) => {
                    const option = document.createElement('option');
                    option.value = mic.deviceId;
                    option.textContent = mic.label || `Microphone ${availableMicrophones.indexOf(mic) + 1}`;
                    micSelect.appendChild(option);
                });
                
                micSelect.disabled = false;
                
                // Set default microphone
                if (availableMicrophones.length > 0) {
                    selectedMicrophoneId = availableMicrophones[0].deviceId;
                    micSelect.value = selectedMicrophoneId;
                    console.log("Default microphone set to:", selectedMicrophoneId);
                }
            }
        } else {
            console.warn("Mic Select not found in the DOM");
        }
        
        console.log("Device selectors initialization complete");
    } catch (error) {
        console.error('Error initializing device selectors:', error);
        showDeviceError('Failed to initialize device selectors');
    }
}

// Start camera preview
async function startCameraPreview() {
    console.log("Starting camera preview, isPreviewActive:", isPreviewActive);
    
    if (isPreviewActive) {
        console.log("Preview already active, returning");
        return;
    }
    
    const previewContainer = document.getElementById('localPreview');
    const cameraOffMessage = document.getElementById('camera-off-message');
    
    console.log("Preview container:", previewContainer);
    console.log("Camera off message element:", cameraOffMessage);
    
    if (!previewContainer) {
        console.warn("Preview container not found in the DOM");
        return;
    }
    
    try {
        // Create constraints
        const constraints = {
            audio: true,
            video: selectedCameraId ? { deviceId: { exact: selectedCameraId } } : true
        };
        
        console.log("Media constraints:", constraints);
        
        // Get user media
        console.log("Requesting user media");
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log("Media stream obtained:", stream);
        
        // Store the stream
        cameraPreview = stream;
        
        // Display the preview
        previewContainer.srcObject = stream;
        previewContainer.style.display = 'block';
        
        if (cameraOffMessage) {
            cameraOffMessage.style.display = 'none';
        }
        
        isPreviewActive = true;
        
        // Update toggle buttons
        updateToggleButtons();
        console.log("Camera preview started successfully");
    } catch (error) {
        console.error('Error starting camera preview:', error);
        
        // Show camera off message
        if (previewContainer) previewContainer.style.display = 'none';
        if (cameraOffMessage) cameraOffMessage.style.display = 'block';
        
        showDeviceError('Failed to access camera: ' + error.message);
    }
}

// Stop camera preview
function stopCameraPreview() {
    console.log("Stopping camera preview, isPreviewActive:", isPreviewActive, "cameraPreview:", cameraPreview);
    
    if (!isPreviewActive || !cameraPreview) {
        console.log("No active preview to stop");
        return;
    }
    
    try {
        // Stop all tracks
        console.log("Stopping all tracks in the stream");
        cameraPreview.getTracks().forEach(track => {
            console.log("Stopping track:", track.kind);
            track.stop();
        });
        
        // Reset preview
        const previewContainer = document.getElementById('localPreview');
        console.log("Preview container for cleanup:", previewContainer);
        
        if (previewContainer) {
            previewContainer.srcObject = null;
        }
        
        isPreviewActive = false;
        cameraPreview = null;
        console.log("Camera preview stopped successfully");
    } catch (error) {
        console.error('Error stopping camera preview:', error);
    }
}

// Update camera preview with new device
async function updateCameraPreview() {
    console.log("Updating camera preview with new device, isPreviewActive:", isPreviewActive);
    
    if (!isPreviewActive) {
        console.log("No active preview to update");
        return;
    }
    
    // Stop current preview
    console.log("Stopping current preview before updating");
    stopCameraPreview();
    
    // Start new preview
    console.log("Starting new preview with updated device");
    await startCameraPreview();
}

// Toggle camera preview on/off
function toggleCameraPreview() {
    console.log("Toggling camera preview, isPreviewActive:", isPreviewActive, "cameraPreview:", cameraPreview);
    
    if (!isPreviewActive || !cameraPreview) {
        console.log("No active preview to toggle");
        return;
    }
    
    try {
        const previewContainer = document.getElementById('localPreview');
        const cameraOffMessage = document.getElementById('camera-off-message');
        const toggleButton = document.getElementById('toggleCameraBtn');
        
        // Get video tracks
        const videoTracks = cameraPreview.getVideoTracks();
        console.log("Video tracks:", videoTracks);
        
        if (videoTracks.length > 0) {
            // Toggle enabled state
            cameraEnabled = !cameraEnabled;
            console.log("Camera enabled set to:", cameraEnabled);
            
            // Update tracks
            videoTracks.forEach(track => {
                console.log("Setting video track enabled to:", cameraEnabled);
                track.enabled = cameraEnabled;
            });
            
            // Update UI
            if (cameraEnabled) {
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
}

// Toggle microphone preview on/off
function toggleMicPreview() {
    console.log("Toggling microphone preview, isPreviewActive:", isPreviewActive, "cameraPreview:", cameraPreview);
    
    if (!isPreviewActive || !cameraPreview) {
        console.log("No active preview to toggle microphone");
        return;
    }
    
    try {
        const toggleButton = document.getElementById('toggleMicBtn');
        
        // Get audio tracks
        const audioTracks = cameraPreview.getAudioTracks();
        console.log("Audio tracks:", audioTracks);
        
        if (audioTracks.length > 0) {
            // Toggle enabled state
            micEnabled = !micEnabled;
            console.log("Microphone enabled set to:", micEnabled);
            
            // Update tracks
            audioTracks.forEach(track => {
                console.log("Setting audio track enabled to:", micEnabled);
                track.enabled = micEnabled;
            });
            
            // Update UI
            if (toggleButton) {
                toggleButton.innerHTML = micEnabled ? 
                    '<i class="bi bi-mic"></i> Toggle Mic' : 
                    '<i class="bi bi-mic-mute"></i> Toggle Mic';
            }
        }
    } catch (error) {
        console.error('Error toggling microphone:', error);
    }
}

// Update toggle buttons state
function updateToggleButtons() {
    console.log("Updating toggle buttons, cameraEnabled:", cameraEnabled, "micEnabled:", micEnabled);
    
    const cameraButton = document.getElementById('toggleCameraBtn');
    const micButton = document.getElementById('toggleMicBtn');
    
    console.log("Camera button:", cameraButton);
    console.log("Mic button:", micButton);
    
    if (cameraButton) {
        cameraButton.innerHTML = cameraEnabled ? 
            '<i class="bi bi-camera-video"></i> Toggle Camera' : 
            '<i class="bi bi-camera-video-off"></i> Toggle Camera';
    }
    
    if (micButton) {
        micButton.innerHTML = micEnabled ? 
            '<i class="bi bi-mic"></i> Toggle Mic' : 
            '<i class="bi bi-mic-mute"></i> Toggle Mic';
    }
}

// Handle start livestream button click
// Update handleStartLivestream function to work with the enhanced interface
async function handleStartLivestream() {
    console.log("Handle start livestream called");
    
    // Validate form
    const titleInput = document.getElementById('liveTitleInput');
    const title = titleInput ? titleInput.value.trim() : '';
    
    console.log("Live title input:", titleInput);
    console.log("Title value:", title);
    
    if (!title) {
        console.warn("No title provided");
        showDeviceError('Please enter a title for your livestream');
        return;
    }
    
    if (!currentRoomId) {
        console.warn("No room ID available");
        showDeviceError('Room ID is not available');
        return;
    }
    
    // Get notification setting
    const notifyCheckbox = document.getElementById('notifyStudentsLive');
    const notifyStudents = notifyCheckbox ? notifyCheckbox.checked : true;
    
    console.log("Notify students checkbox:", notifyCheckbox);
    console.log("Notify students:", notifyStudents);
    
    // Disable the button to prevent multiple clicks
    const startButton = document.getElementById('startLivestreamBtn');
    console.log("Start button:", startButton);
    
    if (startButton) {
        startButton.disabled = true;
        startButton.innerHTML = '<i class="bi bi-hourglass-split"></i> Starting...';
    }
    
    try {
        // Stop preview
        console.log("Stopping preview before starting livestream");
        stopCameraPreview();
        
        // Close the modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('goLiveModal'));
        console.log("Modal instance:", modal);
        
        if (modal) {
            modal.hide();
        }
        
        // Start the livestream
        console.log("Calling startLivestream with roomId:", currentRoomId, "title:", title, "notifyStudents:", notifyStudents);
        
        // Check if startLivestream function exists
        if (typeof startLivestream === 'function') {
            await startLivestream(currentRoomId, title, notifyStudents);
            
            // Show success message
            showToast('You are now live! Your students can join your stream.', 'success');
        } else {
            console.error("startLivestream function is not defined");
            showDeviceError('The livestream functionality is not properly loaded. Please refresh the page.');
        }
    } catch (error) {
        console.error('Error starting livestream:', error);
        showDeviceError('Failed to start livestream: ' + error.message);
    } finally {
        // Re-enable the button
        if (startButton) {
            startButton.disabled = false;
            startButton.innerHTML = '<i class="bi bi-broadcast"></i> Start Livestream';
        }
    }
}

// Load scheduled livestreams 
async function loadScheduledLivestreams() {
    console.log("Loading scheduled livestreams, currentRoomId:", currentRoomId);
    
    if (!currentRoomId) {
        console.warn("No room ID available for loading scheduled livestreams");
        return;
    }
    
    try {
        // Show loading indicators
        const upcomingLoading = document.getElementById('upcoming-loading');
        const pastLoading = document.getElementById('past-loading');
        const noUpcomingStreams = document.getElementById('no-upcoming-streams');
        const noPastStreams = document.getElementById('no-past-streams');
        
        console.log("Loading indicators:", {
            upcomingLoading, 
            pastLoading, 
            noUpcomingStreams, 
            noPastStreams
        });
        
        if (upcomingLoading) upcomingLoading.style.display = 'block';
        if (pastLoading) pastLoading.style.display = 'block';
        if (noUpcomingStreams) noUpcomingStreams.style.display = 'none';
        if (noPastStreams) noPastStreams.style.display = 'none';
        
        // Clear existing content
        const upcomingList = document.getElementById('upcomingStreamsList');
        const pastList = document.getElementById('pastStreamsList');
        
        console.log("Livestream lists:", {upcomingList, pastList});
        
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
        
        // Check if getScheduledLivestreams function exists
        if (typeof getScheduledLivestreams !== 'function') {
            console.error("getScheduledLivestreams function is not defined");
            throw new Error("The livestream functionality is not properly loaded");
        }
        
        // Fetch scheduled livestreams
        console.log("Fetching scheduled livestreams for roomId:", currentRoomId);
        const livestreams = await getScheduledLivestreams(currentRoomId);
        console.log("Received livestreams data:", livestreams);
        
        // Hide loading indicators
        if (upcomingLoading) upcomingLoading.style.display = 'none';
        if (pastLoading) pastLoading.style.display = 'none';
        
        // Process upcoming livestreams
        if (upcomingList) {
            if (livestreams.upcoming && livestreams.upcoming.length > 0) {
                console.log("Processing", livestreams.upcoming.length, "upcoming livestreams");
                livestreams.upcoming.forEach(stream => {
                    upcomingList.appendChild(createLivestreamCard(stream, 'upcoming'));
                });
            } else {
                console.log("No upcoming livestreams");
                if (noUpcomingStreams) noUpcomingStreams.style.display = 'block';
            }
        }
        
        // Process past livestreams
        if (pastList) {
            if (livestreams.past && livestreams.past.length > 0) {
                console.log("Processing", livestreams.past.length, "past livestreams");
                livestreams.past.forEach(stream => {
                    pastList.appendChild(createLivestreamCard(stream, 'past'));
                });
            } else {
                console.log("No past livestreams");
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
}

// Helper to get media devices
async function getMediaDevices() {
    console.log("Getting media devices");
    
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
        console.log("Requesting media permissions");
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        
        // Enumerate devices
        console.log("Enumerating devices");
        const devices = await navigator.mediaDevices.enumerateDevices();
        console.log("All devices:", devices);
        
        // Filter by type
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        const audioDevices = devices.filter(device => device.kind === 'audioinput');
        
        console.log("Video devices:", videoDevices);
        console.log("Audio devices:", audioDevices);
        
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

// Show device error
function showDeviceError(message) {
    console.error("Device error:", message);
    
    const errorAlert = document.getElementById('liveErrorAlert');
    console.log("Error alert element:", errorAlert);
    
    if (errorAlert) {
        errorAlert.textContent = message;
        errorAlert.style.display = 'block';
    } else {
        console.warn("Error alert element not found, falling back to alert()");
        alert(message);
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    console.log("Showing toast:", message, "type:", type);
    
    // Create a toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    
    if (!toastContainer) {
        console.log("Creating toast container");
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.position = 'fixed';
        toastContainer.style.bottom = '20px';
        toastContainer.style.right = '20px';
        toastContainer.style.zIndex = '9999';
        document.body.appendChild(toastContainer);
    }
    
    // Create a unique ID for this toast
    const toastId = 'toast-' + Date.now();
    
    // Create the toast element
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.style.backgroundColor = type === 'error' ? '#f44336' : 
                                  type === 'success' ? '#4CAF50' : 
                                  type === 'info' ? '#2196F3' : '#333';
    toast.style.color = 'white';
    toast.style.padding = '16px';
    toast.style.marginTop = '10px';
    toast.style.borderRadius = '4px';
    toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    toast.style.minWidth = '300px';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    toast.textContent = message;
    
    // Add the toast to the container
    toastContainer.appendChild(toast);
    console.log("Toast added to container");
    
    // Make the toast visible
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 10);
    
    // Remove the toast after 5 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.remove();
            console.log("Toast removed");
        }, 300);
    }, 5000);
}

console.log("Debug livestream_teachers.js script loaded completely");