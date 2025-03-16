// private_messaging_connections.js
// This script enhances the private messaging system to display connections
// and open chat interfaces when clicking on them

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the connections functionality
    initializeConnectionsList();
    
    // Set up event handlers for the messaging panel
    setupMessagingPanelControls();
  });
  
  /**
   * Initialize the connections list in the messaging panel
   */
  function initializeConnectionsList() {
    // Get the DOM elements we need
    const primaryInboxList = document.getElementById('dmPrimaryInboxList');
    const loadingElement = primaryInboxList.querySelector('.dm-loading-chats');
    
    // Fetch the current user's connections from the server
    fetchUserConnections()
      .then(connections => {
        // Remove loading indicator
        if (loadingElement) {
          loadingElement.style.display = 'none';
        }
        
        // If no connections, show empty state
        if (connections.length === 0) {
          primaryInboxList.innerHTML = `
            <div class="dm-empty-state">
              <i class="bi bi-people"></i>
              <p>No connections yet. Connect with users in the Community page.</p>
            </div>
          `;
          return;
        }
        
        // Clear any existing content
        primaryInboxList.innerHTML = '';
        
        // Create connection items for each connection
        connections.forEach(connection => {
          const connectionItem = createConnectionItem(connection);
          primaryInboxList.appendChild(connectionItem);
        });
        
        // Update the badge count
        document.getElementById('dmPrimaryInboxBadge').textContent = connections.length;
      })
      .catch(error => {
        console.error('Error fetching connections:', error);
        primaryInboxList.innerHTML = `
          <div class="dm-error-state">
            <i class="bi bi-exclamation-circle"></i>
            <p>There was an error loading your connections. Please try again.</p>
            <button class="dm-retry-btn" onclick="initializeConnectionsList()">
              <i class="bi bi-arrow-clockwise"></i> Retry
            </button>
          </div>
        `;
      });
  }
  
  /**
   * Set up the controls for the messaging panel
   */
  function setupMessagingPanelControls() {
    // Messaging panel toggle
    const dmButton = document.getElementById('directMessagingButton');
    const dmPanel = document.getElementById('directMessagingPanel');
    const dmCloseBtn = document.getElementById('dmClosePanelBtn');
    
    if (dmButton && dmPanel) {
      dmButton.addEventListener('click', function() {
        dmPanel.classList.toggle('show');
        this.classList.toggle('active');
      });
    }
    
    if (dmCloseBtn) {
      dmCloseBtn.addEventListener('click', function() {
        dmPanel.classList.remove('show');
        dmButton.classList.remove('active');
      });
    }
    
    // Tab switching
    const tabButtons = document.querySelectorAll('.dm-tab-btn');
    const tabContents = document.querySelectorAll('.dm-tab-content');
    
    tabButtons.forEach(button => {
      button.addEventListener('click', function() {
        const tabName = this.getAttribute('data-tab');
        
        // Update active tab button
        tabButtons.forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        
        // Update active tab content
        tabContents.forEach(content => {
          if (content.id === `dm${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`) {
            content.classList.add('active');
          } else {
            content.classList.remove('active');
          }
        });
      });
    });
  }
  
  /**
   * Create a DOM element for a connection item
   * 
   * @param {Object} connection - The connection data
   * @returns {HTMLElement} The connection item element
   */

  function createConnectionItem(connection) {
    // Get the template
    const template = document.getElementById('dmChatItemTemplate');
    const clone = document.importNode(template.content, true);
    
    // Fill in the template with connection data
    const item = clone.querySelector('.dm-chat-item');
    const img = clone.querySelector('.dm-chat-item-img');
    const name = clone.querySelector('.dm-chat-item-name');
    const message = clone.querySelector('.dm-chat-item-last-message');
    const time = clone.querySelector('.dm-chat-item-time');
    
    // Set the connection data
    item.setAttribute('data-user-id', connection.id);
    img.src = connection.profile_picture;
    img.alt = connection.name;
    name.textContent = connection.name;
    message.textContent = 'Click to start chatting';
    time.textContent = 'Now';
    
    
    // Add click handler to open chat with this connection
    item.addEventListener('click', function() {
      openChatWithUser(connection);
    });
    
    return item;
  }
  
  /**
   * Fetch the current user's connections from the server
   * 
   * @returns {Promise<Array>} A promise that resolves to an array of connections
   */
  function fetchUserConnections() {
    return new Promise((resolve, reject) => {
      // Make a request to get following list - this endpoint should be user-specific
      // The backend should already authenticate the user and only return their own connections
      fetch('/get_following/')
        .then(response => {
          if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          if (data.success && Array.isArray(data.following)) {
            // We have IDs, now we need user details for these IDs
            return fetchUserDetails(data.following);
          } else {
            resolve([]);
          }
        })
        .then(userDetails => {
          resolve(userDetails || []);
        })
        .catch(error => {
          console.error('Error fetching connections:', error);
          reject(error);
        });
    });
  }
  
  /**
   * Fetch user details from their IDs
   * 
   * @param {Array} userIds - Array of user IDs to fetch details for
   * @returns {Promise<Array>} A promise that resolves to an array of user details
   */
  function fetchUserDetails(userIds) {
    return new Promise((resolve) => {
      // If we have no user IDs, return empty array
      if (!userIds || userIds.length === 0) {
        resolve([]);
        return;
      }
      
      // Since we can't use search_users, we'll create placeholder user objects
      // In a real implementation, you would make API calls to get user details
      // or modify your backend to return user details with the following list
      
      const placeholderConnections = userIds.map((userId, index) => {
        return {
          id: userId,
          name: userId.name, // Placeholder name
          role: userId.role, // Alternate roles for demonstration
          created_at: new Date().toLocaleDateString(),
          profile_picture: userId.profile_picture,
          websites: []
        };
      });
      
      // Resolve with placeholder user data
      // In production, you would replace this with real user data from your API
      setTimeout(() => {
        resolve(placeholderConnections);
      }, 300); // Simulate network delay
    });
  }
  
  /**
   * Open a chat window with a specific user
   * 
   * @param {Object} user - The user to chat with
   */
  function openChatWithUser(user) {
    // Get the chat windows container
    const chatWindowsContainer = document.getElementById('dmChatWindowsContainer');
    
    // Check if a chat with this user already exists
    let chatWindow = document.querySelector(`.dm-chat-window[data-user-id="${user.id}"]`);
    
    // If it doesn't exist, create it
    if (!chatWindow) {
      // Get template
      const template = document.getElementById('dmChatWindowTemplate');
      const clone = document.importNode(template.content, true);
      
      // Update the template with user data
      chatWindow = clone.querySelector('.dm-chat-window');
      chatWindow.setAttribute('data-user-id', user.id);
      chatWindow.setAttribute('data-chat-id', `chat-${Date.now()}`); // Generate temp ID
      
      const userImg = chatWindow.querySelector('.dm-chat-user-img');
      const userName = chatWindow.querySelector('.dm-chat-user-name');
      const userRole = chatWindow.querySelector('.dm-chat-user-role');
      
      userImg.src = user.profile_picture || 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
      userImg.alt = user.name;
      userName.textContent = user.name;
      userRole.textContent = user.role || '';
      
      // Set up close button
      const closeBtn = chatWindow.querySelector('.dm-close-chat-btn');
      closeBtn.addEventListener('click', function() {
        chatWindow.remove();
      });
      
      // Set up minimize button
      const minimizeBtn = chatWindow.querySelector('.dm-minimize-chat-btn');
      minimizeBtn.addEventListener('click', function() {
        chatWindow.classList.toggle('minimized');
      });
      
      // Add to container
      chatWindowsContainer.appendChild(chatWindow);
      
      // Load conversation history from the server - user-specific
      loadConversationHistory(chatWindow, user.id);
      
      // Handle send button clicks
      const sendButton = chatWindow.querySelector('.dm-send-message-btn');
      const chatInput = chatWindow.querySelector('.dm-chat-input');
      
      sendButton.addEventListener('click', function() {
        const messageText = chatInput.value.trim();
        if (messageText) {
          // Send the message to the server - user-specific
          sendMessage(user.id, messageText)
            .then(success => {
              if (success) {
                // Add the message to the UI
                addMessageToChat(chatWindow, messageText, true);
                chatInput.value = '';
              } else {
                // Show error
                showErrorMessage(chatWindow, "Failed to send message. Please try again.");
              }
            })
            .catch(error => {
              console.error('Error sending message:', error);
              showErrorMessage(chatWindow, "Error sending message. Please try again.");
            });
        }
      });
      
      // Handle enter key in the textarea
      chatInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendButton.click();
        }
      });
    }
    
    // If minimized, restore it
    chatWindow.classList.remove('minimized');
    
    // Focus the input
    setTimeout(() => {
      const chatInput = chatWindow.querySelector('.dm-chat-input');
      chatInput.focus();
    }, 100);
    
    // Close the messaging panel on mobile
    const dmPanel = document.getElementById('directMessagingPanel');
    if (window.innerWidth < 768 && dmPanel) {
      dmPanel.classList.remove('show');
    }
  }
  
  /**
   * Load conversation history between the current user and the specified user
   * 
   * @param {HTMLElement} chatWindow - The chat window element
   * @param {string} otherUserId - The ID of the other user in the conversation
   */
  function loadConversationHistory(chatWindow, otherUserId) {
    const messagesContainer = chatWindow.querySelector('.dm-chat-messages');
    const loadingElement = chatWindow.querySelector('.dm-chat-loading');
    
    // Show loading state
    if (loadingElement) {
      loadingElement.style.display = 'flex';
    }
    
    // In a real implementation, this would fetch conversation history from the server
    // The backend should authenticate the current user and only return their own messages
    // For now, we'll just add a welcome message
    setTimeout(() => {
      // Hide loading indicator
      if (loadingElement) {
        loadingElement.style.display = 'none';
      }
      
      // Add welcome message
      messagesContainer.innerHTML = `
        <div class="dm-message system-message">
          <div class="dm-message-content">
            Your conversation is private and secure.
          </div>
        </div>
      `;
      
      // Scroll to the bottom
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 1000);
    
    // In a real implementation, you would fetch messages from the server
    // fetch(`/get_messages/?recipient_id=${otherUserId}`)
    //   .then(response => response.json())
    //   .then(data => {
    //     // Hide loading indicator
    //     if (loadingElement) {
    //       loadingElement.style.display = 'none';
    //     }
    //     
    //     // Display messages
    //     if (data.success && Array.isArray(data.messages)) {
    //       if (data.messages.length === 0) {
    //         // No messages yet
    //         messagesContainer.innerHTML = `
    //           <div class="dm-message system-message">
    //             <div class="dm-message-content">
    //               Your conversation is private and secure.
    //             </div>
    //           </div>
    //         `;
    //       } else {
    //         // Display messages
    //         messagesContainer.innerHTML = '';
    //         data.messages.forEach(message => {
    //           const isOutgoing = message.sender_id !== otherUserId;
    //           addMessageToChat(chatWindow, message.content, isOutgoing, message.timestamp);
    //         });
    //       }
    //     } else {
    //       // Error loading messages
    //       showErrorMessage(chatWindow, "Failed to load messages. Please try again.");
    //     }
    //     
    //     // Scroll to the bottom
    //     messagesContainer.scrollTop = messagesContainer.scrollHeight;
    //   })
    //   .catch(error => {
    //     console.error('Error loading messages:', error);
    //     if (loadingElement) {
    //       loadingElement.style.display = 'none';
    //     }
    //     showErrorMessage(chatWindow, "Error loading messages. Please try again.");
    //   });
  }
  
  /**
   * Send a message to another user
   * 
   * @param {string} recipientId - The ID of the message recipient
   * @param {string} messageText - The message text to send
   * @returns {Promise<boolean>} A promise that resolves to success status
   */
  function sendMessage(recipientId, messageText) {
    // In a real implementation, this would send the message to the server
    // The backend should authenticate the current user and store the message
    return new Promise((resolve) => {
      // Simulate sending message to server
      console.log(`Sending message to ${recipientId}: ${messageText}`);
      
      // Simulate success after delay
      setTimeout(() => {
        resolve(true);
      }, 500);
      
      // In a real implementation, you would send the message to the server
      // fetch('/send_message/', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'X-CSRFToken': getCsrfToken()
      //   },
      //   body: JSON.stringify({
      //     recipient_id: recipientId,
      //     message: messageText
      //   })
      // })
      // .then(response => response.json())
      // .then(data => {
      //   resolve(data.success);
      // })
      // .catch(error => {
      //   console.error('Error sending message:', error);
      //   resolve(false);
      // });
    });
  }
  
  /**
   * Show an error message in the chat window
   * 
   * @param {HTMLElement} chatWindow - The chat window element
   * @param {string} errorMessage - The error message to display
   */
  function showErrorMessage(chatWindow, errorMessage) {
    const messagesContainer = chatWindow.querySelector('.dm-chat-messages');
    
    const errorElement = document.createElement('div');
    errorElement.className = 'dm-message system-message error';
    errorElement.innerHTML = `
      <div class="dm-message-content">
        <i class="bi bi-exclamation-circle"></i> ${errorMessage}
      </div>
    `;
    
    messagesContainer.appendChild(errorElement);
    
    // Scroll to the bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Remove the error message after 5 seconds
    setTimeout(() => {
      errorElement.classList.add('fade-out');
      setTimeout(() => {
        errorElement.remove();
      }, 300);
    }, 5000);
  }
  
  /**
   * Add a message to a chat window
   * 
   * @param {HTMLElement} chatWindow - The chat window element
   * @param {string} messageText - The message text
   * @param {boolean} isOutgoing - Whether this is an outgoing message
   */
  function addMessageToChat(chatWindow, messageText, isOutgoing = false) {
    // Get the messages container
    const messagesContainer = chatWindow.querySelector('.dm-chat-messages');
    
    // Get the message template
    const template = document.getElementById('dmMessageTemplate');
    const clone = document.importNode(template.content, true);
    
    // Update the message
    const messageElement = clone.querySelector('.dm-message');
    const messageContent = clone.querySelector('.dm-message-content');
    const messageTime = clone.querySelector('.dm-message-time');
    
    messageElement.classList.add(isOutgoing ? 'outgoing' : 'incoming');
    messageContent.textContent = messageText;
    
    // Format the current time
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    messageTime.textContent = timeStr;
    
    // Add to the container
    messagesContainer.appendChild(clone);
    
    // Scroll to the bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  /**
   * Get CSRF token from cookies
   * 
   * @returns {string} The CSRF token
   */
  function getCsrfToken() {
    const cookieValue = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrftoken='))
      ?.split('=')[1];
      
    return cookieValue || '';
  }
  
  // Add to window object so it can be accessed globally
  window.privateMessagingConnections = {
    initialize: initializeConnectionsList,
    openChatWithUser: openChatWithUser
  };