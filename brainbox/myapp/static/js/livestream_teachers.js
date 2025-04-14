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

// Initialize when the document is ready
document.addEventListener('DOMContentLoaded', function() {
    // Get the current room ID
    const roomIdElement = document.getElementById('room-id-data');
    if (roomIdElement) {
        currentRoomId = roomIdElement.dataset.roomId;
    }
    
    // Set up the Go Live modal
    initLivestreamModal();
    
    // Set up the Schedule Livestream modal
    initScheduleModal();
    
    // Load scheduled livestreams
    loadScheduledLivestreams();
});

// Initialize the Go Live modal
function initLivestreamModal() {
    const modal = document.getElementById('goLiveModal');
    if (!modal) return;
    
    // Handle modal open event
    modal.addEventListener('show.bs.modal', function (event) {
        // Reset form
        resetLivestreamForm();
        
        // Initialize camera and microphone dropdowns
        initDeviceSelectors();
        
        // Start camera preview
        startCameraPreview();
    });
    
    // Handle modal close event
    modal.addEventListener('hidden.bs.modal', function (event) {
        // Stop camera preview
        stopCameraPreview();
    });
    
    // Set up toggle buttons
    const toggleCameraBtn = document.getElementById('toggleCameraBtn');
    if (toggleCameraBtn) {
        toggleCameraBtn.addEventListener('click', toggleCameraPreview);
    }
    
    const toggleMicBtn = document.getElementById('toggleMicBtn');
    if (toggleMicBtn) {
        toggleMicBtn.addEventListener('click', toggleMicPreview);
    }
    
    // Set up start livestream button
    const startLivestreamBtn = document.getElementById('startLivestreamBtn');
    if (startLivestreamBtn) {
        startLivestreamBtn.addEventListener('click', handleStartLivestream);
    }
}

// Initialize the Schedule Livestream modal
function initScheduleModal() {
    const scheduleBtn = document.getElementById('scheduleLivestreamBtn');
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
        createLivestreamBtn.addEventListener('click', handleScheduleLivestream);
    }
}

// Reset the livestream form
function resetLivestreamForm() {
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
    
    // Reset device selection
    selectedCameraId = null;
    selectedMicrophoneId = null;
    
    // Reset preview state
    cameraEnabled = true;
    micEnabled = true;
}

// Initialize device selectors with available cameras and microphones
async function initDeviceSelectors() {
    try {
        // Get available media devices
        const devices = await getMediaDevices();
        
        if (devices.error) {
            showDeviceError('Failed to access camera and microphone: ' + devices.error);
            return;
        }
        
        availableCameras = devices.videoDevices;
        availableMicrophones = devices.audioDevices;
        
        // Populate camera dropdown
        const cameraSelect = document.getElementById('cameraSelect');
        if (cameraSelect) {
            // Clear existing options
            cameraSelect.innerHTML = '';
            
            if (availableCameras.length === 0) {
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
                }
                
                // Handle camera change
                cameraSelect.addEventListener('change', function() {
                    selectedCameraId = this.value;
                    updateCameraPreview();
                });
            }
        }
        
        // Populate microphone dropdown
        const micSelect = document.getElementById('micSelect');
        if (micSelect) {
            // Clear existing options
            micSelect.innerHTML = '';
            
            if (availableMicrophones.length === 0) {
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
                }
            }
        }
    } catch (error) {
        console.error('Error initializing device selectors:', error);
        showDeviceError('Failed to initialize device selectors');
    }
}

// Start camera preview
async function startCameraPreview() {
    if (isPreviewActive) return;
    
    const previewContainer = document.getElementById('localPreview');
    const cameraOffMessage = document.getElementById('camera-off-message');
    
    if (!previewContainer) return;
    
    try {
        // Create constraints
        const constraints = {
            audio: true,
            video: selectedCameraId ? { deviceId: { exact: selectedCameraId } } : true
        };
        
        // Get user media
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Store the stream
        cameraPreview = stream;
        
        // Display the preview
        previewContainer.srcObject = stream;
        previewContainer.style.display = 'block';
        if (cameraOffMessage) cameraOffMessage.style.display = 'none';
        
        isPreviewActive = true;
        
        // Update toggle buttons
        updateToggleButtons();
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
    if (!isPreviewActive || !cameraPreview) return;
    
    try {
        // Stop all tracks
        cameraPreview.getTracks().forEach(track => track.stop());
        
        // Reset preview
        const previewContainer = document.getElementById('localPreview');
        if (previewContainer) {
            previewContainer.srcObject = null;
        }
        
        isPreviewActive = false;
        cameraPreview = null;
    } catch (error) {
        console.error('Error stopping camera preview:', error);
    }
}

// Update camera preview with new device
async function updateCameraPreview() {
    if (!isPreviewActive) return;
    
    // Stop current preview
    stopCameraPreview();
    
    // Start new preview
    await startCameraPreview();
}

// Toggle camera preview on/off
function toggleCameraPreview() {
    if (!isPreviewActive || !cameraPreview) return;
    
    try {
        const previewContainer = document.getElementById('localPreview');
        const cameraOffMessage = document.getElementById('camera-off-message');
        const toggleButton = document.getElementById('toggleCameraBtn');
        
        // Get video tracks
        const videoTracks = cameraPreview.getVideoTracks();
        
        if (videoTracks.length > 0) {
            // Toggle enabled state
            cameraEnabled = !cameraEnabled;
            
            // Update tracks
            videoTracks.forEach(track => {
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
    if (!isPreviewActive || !cameraPreview) return;
    
    try {
        const toggleButton = document.getElementById('toggleMicBtn');
        
        // Get audio tracks
        const audioTracks = cameraPreview.getAudioTracks();
        
        if (audioTracks.length > 0) {
            // Toggle enabled state
            micEnabled = !micEnabled;
            
            // Update tracks
            audioTracks.forEach(track => {
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
    const cameraButton = document.getElementById('toggleCameraBtn');
    const micButton = document.getElementById('toggleMicBtn');
    
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
async function handleStartLivestream() {
    // Validate form
    const titleInput = document.getElementById('liveTitleInput');
    const title = titleInput ? titleInput.value.trim() : '';
    
    if (!title) {
        showDeviceError('Please enter a title for your livestream');
        return;
    }
    
    if (!currentRoomId) {
        showDeviceError('Room ID is not available');
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
        stopCameraPreview();
        
        // Close the modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('goLiveModal'));
        if (modal) {
            modal.hide();
        }
        
        // Start the livestream
        await startLivestream(currentRoomId, title, notifyStudents);
        
        // Show success message
        showToast('You are now live! Your students can join your stream.', 'success');
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

// Handle schedule livestream button click
async function handleScheduleLivestream() {
    // Get form values
    const titleInput = document.getElementById('livestreamTitle');
    const descriptionInput = document.getElementById('livestreamDescription');
    const dateInput = document.getElementById('livestreamDate');
    const timeInput = document.getElementById('livestreamTime');
    const durationInput = document.getElementById('livestreamDuration');
    const notifyCheckbox = document.getElementById('notifyStudents');
    
    // Validate inputs
    if (!titleInput || !titleInput.value.trim()) {
        showScheduleError('Please enter a title for your livestream');
        return;
    }
    
    if (!dateInput || !dateInput.value) {
        showScheduleError('Please select a date for your livestream');
        return;
    }
    
    if (!timeInput || !timeInput.value) {
        showScheduleError('Please select a time for your livestream');
        return;
    }
    
    if (!durationInput || !durationInput.value || durationInput.value < 15) {
        showScheduleError('Please specify a duration of at least 15 minutes');
        return;
    }
    
    // Prepare data
    const title = titleInput.value.trim();
    const description = descriptionInput ? descriptionInput.value.trim() : '';
    const date = dateInput.value;
    const time = timeInput.value;
    const duration = parseInt(durationInput.value);
    const notifyStudents = notifyCheckbox ? notifyCheckbox.checked : true;
    
    // Disable the button to prevent multiple clicks
    const scheduleButton = document.getElementById('createLivestreamBtn');
    if (scheduleButton) {
        scheduleButton.disabled = true;
        scheduleButton.textContent = 'Scheduling...';
    }
    
    try {
        // Schedule the livestream
        const success = await scheduleLivestream(
            currentRoomId,
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
            loadScheduledLivestreams();
            
            // Open manage livestreams modal again
            setTimeout(() => {
                const manageModal = new bootstrap.Modal(document.getElementById('manageLivestreamModal'));
                manageModal.show();
            }, 500);
            
            // Show success message
            showToast('Livestream scheduled successfully!', 'success');
        }
    } catch (error) {
        console.error('Error scheduling livestream:', error);
        showScheduleError('Failed to schedule livestream: ' + error.message);
    } finally {
        // Re-enable the button
        if (scheduleButton) {
            scheduleButton.disabled = false;
            scheduleButton.textContent = 'Schedule Livestream';
        }
    }
}

// Load scheduled livestreams
async function loadScheduledLivestreams() {
    if (!currentRoomId) return;
    
    try {
        // Show loading indicators
        document.getElementById('upcoming-loading')?.style.display = 'block';
        document.getElementById('past-loading')?.style.display = 'block';
        document.getElementById('no-upcoming-streams')?.style.display = 'none';
        document.getElementById('no-past-streams')?.style.display = 'none';
        
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
        const livestreams = await getScheduledLivestreams(currentRoomId);
        
        // Hide loading indicators
        document.getElementById('upcoming-loading')?.style.display = 'none';
        document.getElementById('past-loading')?.style.display = 'none';
        
        // Process upcoming livestreams
        if (upcomingList) {
            if (livestreams.upcoming && livestreams.upcoming.length > 0) {
                livestreams.upcoming.forEach(stream => {
                    upcomingList.appendChild(createLivestreamCard(stream, 'upcoming'));
                });
            } else {
                document.getElementById('no-upcoming-streams')?.style.display = 'block';
            }
        }
        
        // Process past livestreams
        if (pastList) {
            if (livestreams.past && livestreams.past.length > 0) {
                livestreams.past.forEach(stream => {
                    pastList.appendChild(createLivestreamCard(stream, 'past'));
                });
            } else {
                document.getElementById('no-past-streams')?.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Error loading scheduled livestreams:', error);
        
        // Hide loading indicators
        document.getElementById('upcoming-loading')?.style.display = 'none';
        document.getElementById('past-loading')?.style.display = 'none';
        
        // Show error message
        document.getElementById('no-upcoming-streams')?.style.display = 'block';
        document.getElementById('no-past-streams')?.style.display = 'block';
        
        if (document.getElementById('no-upcoming-streams')) {
            document.getElementById('no-upcoming-streams').innerHTML = 
                '<p>Error loading livestreams. Please try again.</p>';
        }
        
        if (document.getElementById('no-past-streams')) {
            document.getElementById('no-past-streams').innerHTML = 
                '<p>Error loading livestreams. Please try again.</p>';
        }
    }
}

// Create a livestream card element
function createLivestreamCard(stream, type) {
    const card = document.createElement('div');
    card.className = 'livestream-card';
    card.dataset.streamId = stream.id || stream.schedule_id;
    
    // Parse the scheduled time
    const scheduledTime = new Date(stream.scheduled_time);
    const formattedDate = scheduledTime.toLocaleDateString(undefined, { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
    });
    const formattedTime = scheduledTime.toLocaleTimeString(undefined, { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    // Calculate if the stream is today
    const today = new Date();
    const isToday = 
        scheduledTime.getDate() === today.getDate() &&
        scheduledTime.getMonth() === today.getMonth() &&
        scheduledTime.getFullYear() === today.getFullYear();
    
    // Generate card content
    let cardContent = `
        <div class="livestream-header">
            <div>
                <h4 class="livestream-title">${stream.title || 'Untitled Livestream'}</h4>
                <div class="livestream-meta">
                    <span>${isToday ? 'Today' : formattedDate} at ${formattedTime}</span>
                    ${stream.duration_minutes ? `<span> · ${stream.duration_minutes} minutes</span>` : ''}
                </div>
            </div>
            <span class="livestream-status ${type}">${
                type === 'upcoming' ? 'Scheduled' : 
                (stream.status === 'cancelled' ? 'Cancelled' : 'Completed')
            }</span>
        </div>
    `;
    
    if (stream.description) {
        cardContent += `<div class="livestream-description">${stream.description}</div>`;
    }
    
    // Add countdown or actions based on type
    if (type === 'upcoming') {
        // Calculate time until the stream
        const now = new Date();
        const timeUntil = scheduledTime - now;
        
        // Only show the countdown if it's within 24 hours
        if (timeUntil > 0 && timeUntil < 24 * 60 * 60 * 1000) {
            const hours = Math.floor(timeUntil / (1000 * 60 * 60));
            const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
            
            cardContent += `
                <div class="countdown-timer">
                    Starts in: 
                    <div class="countdown-segment">
                        <div class="countdown-number">${hours}</div>
                        <div class="countdown-label">hr</div>
                    </div>
                    <div class="countdown-segment">
                        <div class="countdown-number">${minutes}</div>
                        <div class="countdown-label">min</div>
                    </div>
                </div>
            `;
        }
        
        // Add actions
        cardContent += `
            <div class="livestream-footer">
                <div></div>
                <div class="livestream-actions">
                    <button class="btn btn-sm btn-danger cancel-stream-btn" 
                            onclick="cancelScheduledStream('${stream.id || stream.schedule_id}')">
                        <i class="bi bi-x-circle"></i> Cancel
                    </button>
                </div>
            </div>
        `;
    } else {
        // Past livestream
        cardContent += `
            <div class="livestream-footer">
                <div></div>
                <div class="livestream-actions">
                    ${stream.status !== 'cancelled' ? `
                        <button class="btn btn-sm btn-outline-secondary view-details-btn">
                            <i class="bi bi-info-circle"></i> Details
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    card.innerHTML = cardContent;
    return card;
}

// Cancel a scheduled livestream
async function cancelScheduledStream(scheduleId) {
    if (!confirm('Are you sure you want to cancel this scheduled livestream?')) {
        return;
    }
    
    try {
        showToast('Cancelling scheduled livestream...', 'info');
        
        const success = await cancelScheduledLivestream(scheduleId);
        
        if (success) {
            // Reload scheduled livestreams
            loadScheduledLivestreams();
            
            showToast('Livestream cancelled successfully', 'success');
        } else {
            showToast('Failed to cancel livestream', 'error');
        }
    } catch (error) {
        console.error('Error cancelling scheduled livestream:', error);
        showToast('Error cancelling livestream: ' + error.message, 'error');
    }
}

// Show device error
function showDeviceError(message) {
    const errorAlert = document.getElementById('liveErrorAlert');
    if (errorAlert) {
        errorAlert.textContent = message;
        errorAlert.style.display = 'block';
    } else {
        alert(message);
    }
}

// Show schedule error
function showScheduleError(message) {
    const errorAlert = document.getElementById('scheduleLivestreamError');
    if (errorAlert) {
        errorAlert.textContent = message;
        errorAlert.style.display = 'block';
    } else {
        alert(message);
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    // Create a toast container if it doesn't exist
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
    
    // Make the toast visible
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 10);
    
    // Remove the toast after 5 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 5000);
}

// Helper to get media devices
async function getMediaDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
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