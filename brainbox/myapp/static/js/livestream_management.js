/**
 * Enhanced Livestream Management for EduLink
 * 
 * This code fixes the issue with displaying upcoming and past livestreams
 * in the Manage Livestreams modal.
 */

// Wait for document to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Grab references to important modal elements
    const manageLivestreamModal = document.getElementById('manageLivestreamModal');
    const upcomingStreamsList = document.getElementById('upcomingStreamsList');
    const pastStreamsList = document.getElementById('pastStreamsList');
    const noUpcomingStreams = document.getElementById('no-upcoming-streams');
    const noPastStreams = document.getElementById('no-past-streams');
    const upcomingLoading = document.getElementById('upcoming-loading');
    const pastLoading = document.getElementById('past-loading');
    
    // Add event listener to the modal to load streams when opened
    if (manageLivestreamModal) {
      manageLivestreamModal.addEventListener('shown.bs.modal', function() {
        console.log("Livestream management modal opened, loading streams...");
        loadScheduledLivestreams();
      });
    }
    
    // Get the room ID from the data attribute
    const roomId = document.getElementById('room-id-data')?.dataset.roomId;
    
    // Function to load scheduled livestreams
    function loadScheduledLivestreams() {
      if (!roomId) {
        console.error("Room ID not available for loading scheduled livestreams");
        showErrorMessage("Room ID not available. Please refresh the page.");
        return;
      }
      
      // Show loading indicators
      if (upcomingLoading) upcomingLoading.style.display = 'block';
      if (pastLoading) pastLoading.style.display = 'block';
      
      // Hide no streams messages
      if (noUpcomingStreams) noUpcomingStreams.style.display = 'none';
      if (noPastStreams) noPastStreams.style.display = 'none';
      
      // Clear existing content
      if (upcomingStreamsList) {
        upcomingStreamsList.innerHTML = '';
        if (upcomingLoading) upcomingStreamsList.appendChild(upcomingLoading);
      }
      
      if (pastStreamsList) {
        pastStreamsList.innerHTML = '';
        if (pastLoading) pastStreamsList.appendChild(pastLoading);
      }
      
      console.log("Fetching scheduled livestreams for room:", roomId);
      
      // Fetch all livestreams from the server
      fetch(`/get-scheduled-streams/?room_id=${roomId}`)
        .then(response => {
          console.log("Server responded with status:", response.status);
          if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          console.log("Received livestreams data:", data);
          
          // Hide loading indicators
          if (upcomingLoading) upcomingLoading.style.display = 'none';
          if (pastLoading) pastLoading.style.display = 'none';
          
          let upcomingStreams = [];
          let pastStreams = [];
          
          // Handle different data structures
          if (data.success === true) {
            // Format 1: API returns separate arrays for upcoming and past
            if (Array.isArray(data.upcoming_streams)) {
              upcomingStreams = data.upcoming_streams;
            }
            
            if (Array.isArray(data.past_streams)) {
              pastStreams = data.past_streams;
            }
            
            // Format 2: API returns a single array of streams
            if (Array.isArray(data.streams)) {
              // Sort streams into upcoming and past based on status or time
              data.streams.forEach(stream => {
                if (stream.status === 'ended' || (stream.ended_at && !stream.is_live)) {
                  pastStreams.push(stream);
                } else {
                  upcomingStreams.push(stream);
                }
              });
            }
          } else {
            // If the data isn't wrapped in a success object
            
            // Check if it's an array
            if (Array.isArray(data)) {
              // Sort streams into upcoming and past based on status or time
              data.forEach(stream => {
                if (stream.status === 'ended' || (stream.ended_at && !stream.is_live)) {
                  pastStreams.push(stream);
                } else {
                  upcomingStreams.push(stream);
                }
              });
            }
          }
          
          console.log("Processed streams:", {
            upcoming: upcomingStreams.length,
            past: pastStreams.length
          });
          
          // Process upcoming livestreams
          if (upcomingStreamsList) {
            if (upcomingStreams.length > 0) {
              console.log(`Rendering ${upcomingStreams.length} upcoming streams`);
              upcomingStreams.forEach(stream => {
                upcomingStreamsList.appendChild(createLivestreamCard(stream, 'upcoming'));
              });
            } else {
              if (noUpcomingStreams) {
                noUpcomingStreams.style.display = 'block';
              }
              console.log("No upcoming streams available");
            }
          }
          
          // Process past livestreams
          if (pastStreamsList) {
            if (pastStreams.length > 0) {
              console.log(`Rendering ${pastStreams.length} past streams`);
              pastStreams.forEach(stream => {
                pastStreamsList.appendChild(createLivestreamCard(stream, 'past'));
              });
            } else {
              if (noPastStreams) {
                noPastStreams.style.display = 'block';
              }
              console.log("No past streams available");
            }
          }
        })
        .catch(error => {
          console.error("Error fetching scheduled livestreams:", error);
          
          // Hide loading indicators
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
        });
    }
    
    // Function to create a livestream card UI element
    function createLivestreamCard(stream, type) {
      // Debug stream object
      console.log(`Creating ${type} livestream card for:`, stream);
      
      // Handle potential missing or malformatted stream data
      if (!stream) {
        console.error("Cannot create card for undefined stream");
        return document.createElement('div');
      }
      
      // Create card container
      const card = document.createElement('div');
      card.className = 'livestream-card';
      
      // Get stream ID - handle both 'id' and 'stream_id' formats
      const streamId = stream.id || stream.schedule_id || stream.stream_id || 'unknown';
      
      // Ensure stream.title exists
      const title = stream.title || 'Untitled Livestream';
      
      // Format date and time safely
      let formattedDate = 'Date not available';
      let formattedTime = 'Time not available';
      
      try {
        // For upcoming streams
        if (stream.scheduled_time) {
          const streamDate = new Date(stream.scheduled_time);
          formattedDate = streamDate.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
          });
          formattedTime = streamDate.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit'
          });
        } 
        // For past streams
        else if (stream.started_at) {
          const streamDate = new Date(stream.started_at);
          formattedDate = streamDate.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
          });
          formattedTime = streamDate.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit'
          });
        }
      } catch (error) {
        console.error("Error formatting date:", error);
      }
      
      // Set status text and class
      let statusClass = type === 'upcoming' ? 'upcoming' : 'past';
      let statusText = type === 'upcoming' ? 'Upcoming' : 'Ended';
      
      // If it's an upcoming stream but it's already started
      if (type === 'upcoming' && stream.is_live) {
        statusClass = 'live';
        statusText = 'Live Now';
      }
      
      // Duration formatting
      let durationStr = '';
      if (stream.duration_minutes) {
        durationStr = `<span class="mx-2">|</span> <i class="bi bi-clock"></i> ${stream.duration_minutes} min`;
      } else if (stream.duration) {
        durationStr = `<span class="mx-2">|</span> <i class="bi bi-clock"></i> ${stream.duration} min`;
      }
      
      // Create the card content
      card.innerHTML = `
        <div class="livestream-header">
          <div>
            <h3 class="livestream-title">${title}</h3>
            <p class="livestream-meta">
              <i class="bi bi-calendar"></i> ${formattedDate} at ${formattedTime}
              ${durationStr}
            </p>
          </div>
          <span class="livestream-status ${statusClass}">${statusText}</span>
        </div>
        
        ${stream.description ? `<p class="livestream-description">${stream.description}</p>` : ''}
        
        <div class="livestream-footer">
          <div>
            ${type === 'upcoming' && !stream.is_live ? createCountdownHTML(stream.scheduled_time) : ''}
          </div>
          <div class="livestream-actions">
            ${type === 'upcoming' && !stream.is_live ? 
              `<button class="btn btn-sm btn-outline-secondary edit-stream-btn" data-stream-id="${streamId}">
                 <i class="bi bi-pencil"></i>
               </button>
               <button class="btn btn-sm btn-outline-danger cancel-stream-btn" data-stream-id="${streamId}">
                 <i class="bi bi-x-circle"></i>
               </button>` : ''}
            ${type === 'upcoming' && stream.is_live ? 
              `<button class="btn btn-sm btn-danger join-stream-btn" data-stream-id="${streamId}">
                 <i class="bi bi-broadcast"></i> Join Live
               </button>` : ''}
          </div>
        </div>
      `;
      
      // Add event listeners
      if (type === 'upcoming' && !stream.is_live) {
        // Edit button
        const editBtn = card.querySelector('.edit-stream-btn');
        if (editBtn) {
          editBtn.addEventListener('click', function() {
            editScheduledStream(streamId);
          });
        }
        
        // Cancel button
        const cancelBtn = card.querySelector('.cancel-stream-btn');
        if (cancelBtn) {
          cancelBtn.addEventListener('click', function() {
            cancelScheduledStream(streamId);
          });
        }
      }
      
      if (type === 'upcoming' && stream.is_live) {
        // Join live button
        const joinBtn = card.querySelector('.join-stream-btn');
        if (joinBtn) {
          joinBtn.addEventListener('click', function() {
            joinLivestream(streamId);
          });
        }
      }
      
      return card;
    }
    
    // Function to create countdown HTML
    function createCountdownHTML(scheduledTime) {
      if (!scheduledTime) return '';
      
      try {
        const targetDate = new Date(scheduledTime);
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
      } catch (error) {
        console.error("Error creating countdown:", error);
        return '';
      }
    }
    
    // Stub functions for event handlers
    function editScheduledStream(scheduleId) {
      console.log('Edit scheduled stream:', scheduleId);
      // Implement edit functionality or call LivestreamModule.editScheduledStream
      if (window.LivestreamModule && typeof window.LivestreamModule.editScheduledStream === 'function') {
        window.LivestreamModule.editScheduledStream(scheduleId);
      } else {
        showToast('Edit feature coming soon', 'info');
      }
    }
    
    function cancelScheduledStream(scheduleId) {
      console.log('Cancel scheduled stream:', scheduleId);
      if (!confirm('Are you sure you want to cancel this scheduled livestream?')) {
        return;
      }
      
      const teacherId = document.getElementById('teacher-name')?.dataset?.teacherName;
      
      // Call the server endpoint directly or use LivestreamModule
      if (window.LivestreamModule && typeof window.LivestreamModule.cancelScheduledStream === 'function') {
        window.LivestreamModule.cancelScheduledStream(scheduleId);
      } else {
        // Direct implementation
        fetch('/cancel-scheduled-stream/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
          },
          body: JSON.stringify({
            schedule_id: scheduleId,
            teacher_id: teacherId
          })
        })
        .then(response => response.json())
        .then(data => {
          if (!data.success) {
            showToast(data.error || 'Failed to cancel scheduled livestream.', 'error');
            return false;
          }
          
          showToast('Scheduled livestream canceled successfully.', 'success');
          // Reload the streams list
          loadScheduledLivestreams();
          return true;
        })
        .catch(error => {
          console.error('Error canceling scheduled livestream:', error);
          showToast('Failed to cancel livestream. Please try again.', 'error');
          return false;
        });
      }
    }
    
    function joinLivestream(streamId) {
      console.log('Join livestream:', streamId);
      // Implement join functionality or call LivestreamModule.joinLivestream
      if (window.LivestreamModule && typeof window.LivestreamModule.joinLivestream === 'function') {
        window.LivestreamModule.joinLivestream(streamId);
      } else {
        showToast('Join feature not fully implemented', 'info');
      }
    }
    
    // Helper function to get CSRF token
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
    
    // Function to show toast notifications
    function showToast(message, type = 'info') {
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
    }
    
    // Function to show error messages
    function showErrorMessage(message) {
      if (upcomingStreamsList) {
        if (noUpcomingStreams) {
          noUpcomingStreams.innerHTML = `<p>${message}</p>`;
          noUpcomingStreams.style.display = 'block';
        } else {
          const errorElement = document.createElement('div');
          errorElement.className = 'alert alert-danger';
          errorElement.textContent = message;
          upcomingStreamsList.appendChild(errorElement);
        }
      }
      
      if (pastStreamsList) {
        if (noPastStreams) {
          noPastStreams.innerHTML = `<p>${message}</p>`;
          noPastStreams.style.display = 'block';
        }
      }
    }
    
    // If we're on the Manage Livestreams page or modal, initialize the functionality
    const scheduleLivestreamBtn = document.getElementById('scheduleLivestreamBtn');
    if (scheduleLivestreamBtn) {
      scheduleLivestreamBtn.addEventListener('click', function() {
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
  });