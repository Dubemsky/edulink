// private_messaging_connections.js
const activeChatConnections = {};

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
      const badgeElement = document.getElementById('dmPrimaryInboxBadge');
      if (badgeElement) {
        badgeElement.textContent = connections.length;
      }
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
  
  if (dmCloseBtn && dmPanel && dmButton) {
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
  if (!template) {
    console.error('Chat item template not found');
    return document.createElement('div');
  }
  
  const clone = document.importNode(template.content, true);
  
  // Fill in the template with connection data
  const item = clone.querySelector('.dm-chat-item');
  const img = clone.querySelector('.dm-chat-item-img');
  const name = clone.querySelector('.dm-chat-item-name');
  const message = clone.querySelector('.dm-chat-item-last-message');
  const time = clone.querySelector('.dm-chat-item-time');
  
  // Set the connection data
  item.setAttribute('data-user-id', connection.id);
  img.src = connection.profile_picture || 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
  img.alt = connection.name;
  name.textContent = connection.name;
  message.textContent = connection.last_message || 'Click to start chatting';
  time.textContent = formatMessageTime(connection.last_message_time) || 'Now';
  
  // Add unread badge if there are unread messages
  if (connection.unread_count && connection.unread_count > 0) {
    const unreadBadge = document.createElement('span');
    unreadBadge.className = 'dm-unread-badge';
    unreadBadge.textContent = connection.unread_count;
    item.appendChild(unreadBadge);
  }
  
  // Add click handler to open chat with this connection
  item.addEventListener('click', function() {
    openChatWithUser(connection);
  });


  
  return item;
}

/**
 * Format message time
 * 
 * @param {number|Date|string} timestamp - The timestamp to format
 * @returns {string} Formatted time string
 */
function formatMessageTime(timestamp) {
  if (!timestamp) return '';
  
  let date;
  if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else {
    return '';
  }
  
  const now = new Date();
  const diff = now - date;
  const dayInMs = 24 * 60 * 60 * 1000;
  
  if (diff < 60 * 1000) {
    return 'Just now';
  } else if (diff < 60 * 60 * 1000) {
    const mins = Math.floor(diff / (60 * 1000));
    return `${mins}m ago`;
  } else if (diff < dayInMs) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diff < 7 * dayInMs) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

/**
 * Fetch the current user's connections from the server
 * 
 * @returns {Promise<Array>} A promise that resolves to an array of connections
 */
function fetchUserConnections() {
  return new Promise((resolve, reject) => {
    // Make a request to get conversations
    fetch('/get_conversations/')
      .then(response => {
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (data.success && Array.isArray(data.conversations)) {
          resolve(data.conversations);
        } else {
          // Try to fetch following list as fallback
          return fetch('/get_following/');
        }
      })
      .then(response => {
        if (!response) return; // Skip if previous request was successful
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (!data) return; // Skip if previous request was successful
        if (data.success && Array.isArray(data.following)) {
          // We have IDs, now we need user details for these IDs
          return fetchUserDetails(data.following);
        } else {
          resolve([]);
        }
      })
      .then(userDetails => {
        if (userDetails) {
          resolve(userDetails);
        }
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
    
    const placeholderConnections = userIds.map((userId, index) => {
      return {
        id: userId,
        name: userId.name || `User ${index + 1}`, 
        role: userId.role || "Student", 
        created_at: new Date().toLocaleDateString(),
        profile_picture: userId.profile_picture || "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png",
        last_message: "Start a conversation",
        last_message_time: null,
        unread_count: 0
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

// This function should be added to private_messaging_connection.js

// Modify the openChatWithUser function to update the conversation list
function openChatWithUser(user) {
  // Get the chat windows container
  const chatWindowsContainer = document.getElementById('dmChatWindowsContainer');
  
  if (!chatWindowsContainer) {
    console.error('Chat windows container not found');
    return;
  }
  
  // Generate chat ID from user IDs
  const currentUserId = getCurrentUserId();
  const chatId = `chat-${[currentUserId, user.id].sort().join('-')}`;
  
  // Check if a chat with this user already exists
  let chatWindow = document.querySelector(`.dm-chat-window[data-chat-id="${chatId}"]`);
  
  // If it doesn't exist, create it
  if (!chatWindow) {
    // Get template
    const template = document.getElementById('dmChatWindowTemplate');
    if (!template) {
      console.error('Chat window template not found');
      return;
    }
    
    const clone = document.importNode(template.content, true);
    
    // Update the template with user data
    chatWindow = clone.querySelector('.dm-chat-window');
    chatWindow.setAttribute('data-user-id', user.id);
    chatWindow.setAttribute('data-chat-id', chatId); 
    
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
      // Close WebSocket connection when chat window is closed
      if (activeChatConnections[chatId]) {
        if (window.directMessagingWebSocket) {
          window.directMessagingWebSocket.closeConnection(currentUserId, user.id);
        }
        delete activeChatConnections[chatId];
      }
      
      chatWindow.remove();
    });
    
    // Set up minimize button
    const minimizeBtn = chatWindow.querySelector('.dm-minimize-chat-btn');
    minimizeBtn.addEventListener('click', function() {
      chatWindow.classList.toggle('minimized');
    });
    
    // Add to container
    chatWindowsContainer.appendChild(chatWindow);
    
    // Initialize WebSocket connection
    if (window.directMessagingWebSocket) {
      const socket = window.directMessagingWebSocket.initialize(
        currentUserId,
        user.id,
        chatWindow
      );
      
      // Store the connection
      activeChatConnections[chatId] = {
        socket: socket,
        userId: currentUserId,
        recipientId: user.id
      };
    } else {
      // Fallback to AJAX if WebSocket is not available
      loadConversationHistory(chatWindow, user.id);
      console.warn('WebSocket module not loaded, using AJAX fallback');
    }
    
    // Handle send button clicks
    const sendButton = chatWindow.querySelector('.dm-send-message-btn');
    const chatInput = chatWindow.querySelector('.dm-chat-input');
    
    sendButton.addEventListener('click', function() {
      const messageText = chatInput.value.trim();
      if (messageText) {
        sendMessage(chatId, user.id, messageText);
        chatInput.value = '';
      }
    });
    
    // Handle enter key in the textarea
    chatInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendButton.click();
      }
    });
    
    // *** NEW CODE: Add user to the conversation list if not already there ***
    addUserToConversationList(user);
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
  
  // Mark messages as read
  markMessagesAsRead(user.id);
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
  
  // Fetch messages from the server
  fetch(`/get_messages/?recipient_id=${otherUserId}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      // Hide loading indicator
      if (loadingElement) {
        loadingElement.style.display = 'none';
      }
      
      // Clear existing messages
      messagesContainer.innerHTML = '';
      
      // Add welcome message
      const welcomeMessage = document.createElement('div');
      welcomeMessage.className = 'dm-message system-message';
      welcomeMessage.innerHTML = `
        <div class="dm-message-content">
          Your conversation is private and secure.
        </div>
      `;
      messagesContainer.appendChild(welcomeMessage);
      
      // Display messages
      if (data.success && Array.isArray(data.messages)) {
        if (data.messages.length > 0) {
          const currentUserId = getCurrentUserId();
          
          data.messages.forEach(message => {
            const isOutgoing = message.sender_id === currentUserId;
            addMessageToChat(chatWindow, message.content, isOutgoing, message.timestamp);
          });
        }
      } else {
        // Error loading messages
        showErrorMessage(chatWindow, "Failed to load messages. Please try again.");
      }
      
      // Scroll to the bottom
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    })
    .catch(error => {
      console.error('Error loading messages:', error);
      if (loadingElement) {
        loadingElement.style.display = 'none';
      }
      showErrorMessage(chatWindow, "Error loading messages. Please try again.");
    });
}

/**
 * Send a message to another user
 * 
 * @param {string} chatId - The ID of the chat window
 * @param {string} recipientId - The ID of the message recipient
 * 
 * @param {string} messageText - The message text to send
 */

function sendMessage(chatId, recipientId, messageText) {
  const chatWindow = document.querySelector(`.dm-chat-window[data-chat-id="${chatId}"]`);
  if (!chatWindow) {
    console.error('Chat window not found');
    return;
  }
  
  // Try to send message via WebSocket if available
  if (activeChatConnections[chatId] && activeChatConnections[chatId].socket && window.directMessagingWebSocket) {
    const success = window.directMessagingWebSocket.sendMessage(
      activeChatConnections[chatId].socket,
      messageText
    );
    
    if (success) {
      // Message will be added to UI when received from server via WebSocket
      // This ensures consistent display of messages across clients
      return;
    }
    // If WebSocket send fails, fall back to AJAX
  }
  
  // Send the message using AJAX as fallback
  fetch('/send_message/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrfToken()
    },
    body: JSON.stringify({
      recipient_id: recipientId,
      message: messageText
    })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    if (data.success) {
      // Add the message to the UI
      addMessageToChat(chatWindow, messageText, true);
      
      // Update the conversation list item if it exists
      updateConversationListItem(recipientId, messageText);
    } else {
      showErrorMessage(chatWindow, data.error || "Failed to send message. Please try again.");
    }
  })
  .catch(error => {
    console.error('Error sending message:', error);
    showErrorMessage(chatWindow, "Error sending message. Please try again.");
  });
}

/**
 * Update the conversation list item with the latest message
 * 
 * @param {string} userId - The ID of the other user in the conversation
 * @param {string} message - The latest message
 */
function updateConversationListItem(userId, message) {
  const listItem = document.querySelector(`.dm-chat-item[data-user-id="${userId}"]`);
  if (listItem) {
    const lastMessageElement = listItem.querySelector('.dm-chat-item-last-message');
    const timeElement = listItem.querySelector('.dm-chat-item-time');
    
    if (lastMessageElement) {
      lastMessageElement.textContent = message;
    }
    
    if (timeElement) {
      timeElement.textContent = 'Just now';
    }
    
    // Move the item to the top of the list
    const parentElement = listItem.parentElement;
    if (parentElement) {
      parentElement.insertBefore(listItem, parentElement.firstChild);
    }
  }
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
 * Mark messages from a specific user as read
 * 
 * @param {string} senderId - The ID of the message sender
 */




function markMessagesAsRead(senderId) {
  // Use absolute URL that doesn't depend on current page path
  fetch('/mark_messages_read/', {  // Leading slash makes this an absolute path from the domain root
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrfToken()
    },
    body: JSON.stringify({
      sender_id: senderId
    })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    if (data.success) {
      // Update UI to remove unread indicators
      const listItem = document.querySelector(`.dm-chat-item[data-user-id="${senderId}"]`);
      if (listItem) {
        const unreadBadge = listItem.querySelector('.dm-unread-badge');
        if (unreadBadge) {
          unreadBadge.remove();
        }
      }
      
      // Update total unread count
      updateTotalUnreadCount();
    }
  })
  .catch(error => {
    console.error('Error marking messages as read:', error);
  });
}
















/**
 * Update the total unread count badge in the UI
 */
function updateTotalUnreadCount() {
  fetch('/get_conversations/')
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.success && Array.isArray(data.conversations)) {
        let totalUnread = 0;
        data.conversations.forEach(conversation => {
          totalUnread += conversation.unread_count || 0;
        });
        
        // Update the badge
        const badge = document.getElementById('dmUnreadBadge');
        if (badge) {
          badge.textContent = totalUnread;
          badge.style.display = totalUnread > 0 ? 'flex' : 'none';
        }
        
        // Update title if needed
        if (totalUnread > 0) {
          document.title = `(${totalUnread}) ${document.title.replace(/^\(\d+\)\s/, '')}`;
        } else {
          document.title = document.title.replace(/^\(\d+\)\s/, '');
        }
      }
    })
    .catch(error => {
      console.error('Error updating unread count:', error);
    });
}

/**
 * Add a message to a chat window
 * 
 * @param {HTMLElement} chatWindow - The chat window element
 * @param {string} messageText - The message text
 * @param {boolean} isOutgoing - Whether this is an outgoing message
 * @param {string} timestamp - The timestamp of the message
 */
function addMessageToChat(chatWindow, messageText, isOutgoing = false, timestamp = null) {
  // Get the messages container
  const messagesContainer = chatWindow.querySelector('.dm-chat-messages');
  
  // Get the message template
  const template = document.getElementById('dmMessageTemplate');
  if (!template) {
    console.error('Message template not found');
    
    // Fallback if template not found
    const messageDiv = document.createElement('div');
    messageDiv.className = `dm-message ${isOutgoing ? 'outgoing' : 'incoming'}`;
    messageDiv.innerHTML = `
      <div class="dm-message-content">${messageText}</div>
      <div class="dm-message-time">${formatMessageTime(timestamp || new Date())}</div>
    `;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return;
  }
  
  const clone = document.importNode(template.content, true);
  
  // Update the message
  const messageElement = clone.querySelector('.dm-message');
  const messageContent = clone.querySelector('.dm-message-content');
  const messageTime = clone.querySelector('.dm-message-time');
  
  messageElement.classList.add(isOutgoing ? 'outgoing' : 'incoming');
  messageContent.textContent = messageText;
  
  // Format time
  if (timestamp) {
    messageTime.textContent = formatMessageTime(timestamp);
  } else {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    messageTime.textContent = timeStr;
  }
  
  // Add to the container
  messagesContainer.appendChild(clone);
  
  // Scroll to the bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Get the current user's ID
 * 
 * @returns {string} The current user's ID
 */



function getCurrentUserId() {

  console.log("This is the current userid", window.currentUserId)
  if (window.currentUserId) {
    return window.currentUserId;
  }
  
  // Fallback options if the variable isn't set
  const userIdInput = document.getElementById('current_user_id');
  if (userIdInput && userIdInput.value) {
    return userIdInput.value;
  }
  
  const userIdFromBody = document.body.getAttribute('data-user-id');
  if (userIdFromBody) {
    return userIdFromBody;
  }
  
  // Last resort fallback
  console.warn('Could not find user ID, using temporary ID');
  return 'user_' + Math.floor(Math.random() * 10000);
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
  openChatWithUser: openChatWithUser,
  addUserToConversationList: addUserToConversationList  // Add this line
};









// Add these functions to private_messaging_connection.js

/**
 * Fetch the current user's connections and message requests from the server
 * 
 * @returns {Promise<Object>} A promise that resolves to an object with connections and requests
 */
function fetchUserConversations() {
  return new Promise((resolve, reject) => {
    // Make a request to get conversations
    fetch('/get_conversations/')
      .then(response => {
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (data.success) {
          resolve({
            connections: Array.isArray(data.connections) ? data.connections : [],
            requests: Array.isArray(data.requests) ? data.requests : []
          });
        } else {
          // Try to fetch following list as fallback (for backward compatibility)
          return fetch('/get_following/');
        }
      })
      .then(response => {
        if (!response) return; // Skip if previous request was successful
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (!data) return; // Skip if previous request was successful
        if (data.success && Array.isArray(data.following)) {
          // For backward compatibility, convert following to connections format
          resolve({
            connections: data.following.map(user => ({
              id: user.id,
              user_id: user.id,
              name: user.name || 'Unknown User',
              role: user.role || '',
              profile_picture: user.profile_picture,
              last_message: "Start a conversation",
              last_message_time: null,
              unread_count: 0,
              connection_status: 'connected'
            })),
            requests: []
          });
        } else {
          resolve({ connections: [], requests: [] });
        }
      })
      .catch(error => {
        console.error('Error fetching conversations:', error);
        reject(error);
      });
  });
}

/**
 * Initialize the connections and requests lists in the messaging panel
 */
function initializeConnectionsList() {
  // Get the DOM elements we need
  const connectionsInboxList = document.getElementById('dmPrimaryInboxList');
  const requestsInboxList = document.getElementById('dmMessageRequestsList');
  
  const connectionsLoadingElement = connectionsInboxList ? connectionsInboxList.querySelector('.dm-loading-chats') : null;
  const requestsLoadingElement = requestsInboxList ? requestsInboxList.querySelector('.dm-loading-chats') : null;
  
  // Fetch the current user's conversations from the server
  fetchUserConversations()
    .then(({ connections, requests }) => {
      // Update connections tab
      if (connectionsInboxList) {
        // Remove loading indicator
        if (connectionsLoadingElement) {
          connectionsLoadingElement.style.display = 'none';
        }
        
        // If no connections, show empty state
        if (connections.length === 0) {
          connectionsInboxList.innerHTML = `
            <div class="dm-empty-state">
              <i class="bi bi-people"></i>
              <p>No connections yet. Connect with users in the Community page.</p>
            </div>
          `;
        } else {
          // Clear any existing content
          connectionsInboxList.innerHTML = '';
          
          // Create connection items for each connection
          connections.forEach(connection => {
            const connectionItem = createConnectionItem(connection);
            connectionsInboxList.appendChild(connectionItem);
          });
        }
        
        // Update the badge count
        const connectionsBadgeElement = document.getElementById('dmPrimaryInboxBadge');
        if (connectionsBadgeElement) {
          connectionsBadgeElement.textContent = connections.length;
        }
      }
      
      // Update requests tab
      if (requestsInboxList) {
        // Remove loading indicator
        if (requestsLoadingElement) {
          requestsLoadingElement.style.display = 'none';
        }
        
        // If no requests, show empty state
        if (requests.length === 0) {
          requestsInboxList.innerHTML = `
            <div class="dm-empty-state">
              <i class="bi bi-envelope"></i>
              <p>No pending message requests.</p>
            </div>
          `;
        } else {
          // Clear any existing content
          requestsInboxList.innerHTML = '';
          
          // Create request items for each request
          requests.forEach(request => {
            const requestItem = createRequestItem(request);
            requestsInboxList.appendChild(requestItem);
          });
          
          // Show a notification that there are pending requests
          if (requests.length > 0) {
            const requestsTab = document.getElementById('dmMessageRequestsTab');
            if (requestsTab) {
              requestsTab.classList.add('has-pending');
            }
          }
        }
        
        // Update the badge count
        const requestsBadgeElement = document.getElementById('dmMessageRequestsBadge');
        if (requestsBadgeElement) {
          requestsBadgeElement.textContent = requests.length;
          
          // Make the badge visible if there are requests
          if (requests.length > 0) {
            requestsBadgeElement.classList.add('active');
          } else {
            requestsBadgeElement.classList.remove('active');
          }
        }
      }
      
      // Update total unread count
      updateTotalUnreadCount(connections.concat(requests));
    })
    .catch(error => {
      console.error('Error fetching connections:', error);
      
      // Show error state in connections tab
      if (connectionsInboxList) {
        connectionsInboxList.innerHTML = `
          <div class="dm-error-state">
            <i class="bi bi-exclamation-circle"></i>
            <p>There was an error loading your connections. Please try again.</p>
            <button class="dm-retry-btn" onclick="initializeConnectionsList()">
              <i class="bi bi-arrow-clockwise"></i> Retry
            </button>
          </div>
        `;
      }
      
      // Show error state in requests tab
      if (requestsInboxList) {
        requestsInboxList.innerHTML = `
          <div class="dm-error-state">
            <i class="bi bi-exclamation-circle"></i>
            <p>There was an error loading message requests. Please try again.</p>
          </div>
        `;
      }
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
  if (!template) {
    console.error('Chat item template not found');
    return document.createElement('div');
  }
  
  const clone = document.importNode(template.content, true);
  
  // Fill in the template with connection data
  const item = clone.querySelector('.dm-chat-item');
  const img = clone.querySelector('.dm-chat-item-img');
  const name = clone.querySelector('.dm-chat-item-name');
  const message = clone.querySelector('.dm-chat-item-last-message');
  const time = clone.querySelector('.dm-chat-item-time');
  
  // Set the connection data
  item.setAttribute('data-user-id', connection.user_id);
  img.src = connection.profile_picture || 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
  img.alt = connection.name;
  name.textContent = connection.name;
  message.textContent = connection.last_message || 'Click to start chatting';
  time.textContent = formatMessageTime(connection.last_message_time) || 'Now';
  
  // Add unread badge if there are unread messages
  if (connection.unread_count && connection.unread_count > 0) {
    const unreadBadge = document.createElement('span');
    unreadBadge.className = 'dm-unread-badge';
    unreadBadge.textContent = connection.unread_count;
    item.appendChild(unreadBadge);
  }
  
  // Add click handler to open chat with this connection
  item.addEventListener('click', function() {
    openChatWithUser(connection);
  });
  
  return item;
}

/**
 * Create a DOM element for a message request item
 * 
 * @param {Object} request - The request data
 * @returns {HTMLElement} The request item element
 */
function createRequestItem(request) {
  // Get the template
  const template = document.getElementById('dmChatItemTemplate');
  if (!template) {
    console.error('Chat item template not found');
    return document.createElement('div');
  }
  
  const clone = document.importNode(template.content, true);
  
  // Fill in the template with request data
  const item = clone.querySelector('.dm-chat-item');
  const img = clone.querySelector('.dm-chat-item-img');
  const name = clone.querySelector('.dm-chat-item-name');
  const message = clone.querySelector('.dm-chat-item-last-message');
  const time = clone.querySelector('.dm-chat-item-time');
  
  // Set the request data
  item.setAttribute('data-user-id', request.user_id);
  item.classList.add('dm-chat-request');
  img.src = request.profile_picture || 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
  img.alt = request.name;
  name.textContent = request.name;
  message.textContent = request.last_message || 'New message request';
  time.textContent = formatMessageTime(request.last_message_time) || 'Now';
  
  // Add unread badge if there are unread messages
  if (request.unread_count && request.unread_count > 0) {
    const unreadBadge = document.createElement('span');
    unreadBadge.className = 'dm-unread-badge';
    unreadBadge.textContent = request.unread_count;
    item.appendChild(unreadBadge);
  }
  
  // Add accept/decline buttons
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'dm-request-actions';
  
  const acceptBtn = document.createElement('button');
  acceptBtn.className = 'dm-accept-btn';
  acceptBtn.innerHTML = '<i class="bi bi-check-lg"></i>';
  acceptBtn.title = 'Accept';
  acceptBtn.addEventListener('click', function(e) {
    e.stopPropagation(); // Prevent opening chat
    acceptConnectionRequest(request.user_id);
  });
  
  const declineBtn = document.createElement('button');
  declineBtn.className = 'dm-decline-btn';
  declineBtn.innerHTML = '<i class="bi bi-x-lg"></i>';
  declineBtn.title = 'Decline';
  declineBtn.addEventListener('click', function(e) {
    e.stopPropagation(); // Prevent opening chat
    declineConnectionRequest(request.user_id);
  });
  
  actionsDiv.appendChild(acceptBtn);
  actionsDiv.appendChild(declineBtn);
  item.appendChild(actionsDiv);
  
  // Add click handler to view the request
  item.addEventListener('click', function() {
    openChatWithUser(request);
  });
  
  return item;
}


// Add these functions to make accept/decline buttons work

/**
 * Accept a connection request
 * 
 * @param {string} senderId - The ID of the user who sent the request
 */
function acceptConnectionRequest(senderId) {
  console.log(`Accepting connection request from user ${senderId}`);
  
  fetch('/accept_connection_request/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrfToken()
    },
    body: JSON.stringify({
      sender_id: senderId
    })
  })
  .then(response => {
    if (!response.ok) {
      console.error(`Server responded with status: ${response.status}`);
      throw new Error(`Server responded with status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    console.log('Accept response:', data);
    if (data.success) {
      // Find and remove the request from the requests list
      const requestItem = document.querySelector(`.dm-chat-request[data-user-id="${senderId}"]`);
      if (requestItem && requestItem.parentElement) {
        requestItem.classList.add('accepted');
        setTimeout(() => {
          requestItem.parentElement.removeChild(requestItem);
          
          // If no more requests, show empty state
          const requestsList = document.getElementById('dmMessageRequestsList');
          if (requestsList && !requestsList.querySelector('.dm-chat-request')) {
            requestsList.innerHTML = `
              <div class="dm-empty-state">
                <i class="bi bi-envelope"></i>
                <p>No pending message requests.</p>
              </div>
            `;
          }
          
          // Refresh the connections list to show the new connection
          initializeConnectionsList();
        }, 500);
      }
      
      // Show success message
      showNotification('Connection request accepted', 'success');
    } else {
      showNotification(data.error || 'Failed to accept connection request', 'error');
    }
  })
  .catch(error => {
    console.error('Error accepting connection request:', error);
    showNotification('Error accepting connection request', 'error');
  });
}

/**
 * Decline a connection request
 * 
 * @param {string} senderId - The ID of the user who sent the request
 */
function declineConnectionRequest(senderId) {
  console.log(`Declining connection request from user ${senderId}`);
  
  fetch('/decline_connection_request/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrfToken()
    },
    body: JSON.stringify({
      sender_id: senderId
    })
  })
  .then(response => {
    if (!response.ok) {
      console.error(`Server responded with status: ${response.status}`);
      throw new Error(`Server responded with status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    console.log('Decline response:', data);
    if (data.success) {
      // Find and remove the request from the requests list
      const requestItem = document.querySelector(`.dm-chat-request[data-user-id="${senderId}"]`);
      if (requestItem && requestItem.parentElement) {
        requestItem.classList.add('declined');
        setTimeout(() => {
          requestItem.parentElement.removeChild(requestItem);
          
          // If no more requests, show empty state
          const requestsList = document.getElementById('dmMessageRequestsList');
          if (requestsList && !requestsList.querySelector('.dm-chat-request')) {
            requestsList.innerHTML = `
              <div class="dm-empty-state">
                <i class="bi bi-envelope"></i>
                <p>No pending message requests.</p>
              </div>
            `;
          }
        }, 500);
      }
      
      // Update counts
      const requestsBadgeElement = document.getElementById('dmMessageRequestsBadge');
      if (requestsBadgeElement) {
        const currentCount = parseInt(requestsBadgeElement.textContent) || 0;
        if (currentCount > 0) {
          requestsBadgeElement.textContent = currentCount - 1;
          
          // Hide badge if no more requests
          if (currentCount - 1 === 0) {
            requestsBadgeElement.classList.remove('active');
          }
        }
      }
      
      // Show success message
      showNotification('Connection request declined', 'success');
    } else {
      showNotification(data.error || 'Failed to decline connection request', 'error');
    }
  })
  .catch(error => {
    console.error('Error declining connection request:', error);
    showNotification('Error declining connection request', 'error');
  });
}

/**
 * Create a DOM element for a message request item with proper event handlers
 * 
 * @param {Object} request - The request data
 * @returns {HTMLElement} The request item element
 */
function createRequestItem(request) {
  // Get the template
  const template = document.getElementById('dmChatItemTemplate');
  if (!template) {
    console.error('Chat item template not found');
    return document.createElement('div');
  }
  
  const clone = document.importNode(template.content, true);
  
  // Fill in the template with request data
  const item = clone.querySelector('.dm-chat-item');
  const img = clone.querySelector('.dm-chat-item-img');
  const name = clone.querySelector('.dm-chat-item-name');
  const message = clone.querySelector('.dm-chat-item-last-message');
  const time = clone.querySelector('.dm-chat-item-time');
  
  // Set the request data
  item.setAttribute('data-user-id', request.user_id);
  item.classList.add('dm-chat-request');
  img.src = request.profile_picture || 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
  img.alt = request.name;
  name.textContent = request.name;
  message.textContent = request.last_message || 'New message request';
  time.textContent = formatMessageTime(request.last_message_time) || 'Now';
  
  // Add unread badge if there are unread messages
  if (request.unread_count && request.unread_count > 0) {
    const unreadBadge = document.createElement('span');
    unreadBadge.className = 'dm-unread-badge';
    unreadBadge.textContent = request.unread_count;
    item.appendChild(unreadBadge);
  }
  
  // Add accept/decline buttons
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'dm-request-actions';
  
  const acceptBtn = document.createElement('button');
  acceptBtn.className = 'dm-accept-btn';
  acceptBtn.innerHTML = '<i class="bi bi-check-lg"></i>';
  acceptBtn.title = 'Accept';
  
  const declineBtn = document.createElement('button');
  declineBtn.className = 'dm-decline-btn';
  declineBtn.innerHTML = '<i class="bi bi-x-lg"></i>';
  declineBtn.title = 'Decline';
  
  // Add proper event listeners with explicit stopPropagation
  acceptBtn.addEventListener('click', function(e) {
    e.stopPropagation(); // Prevent opening chat
    console.log('Accept button clicked for user:', request.user_id);
    acceptConnectionRequest(request.user_id);
  });
  
  declineBtn.addEventListener('click', function(e) {
    e.stopPropagation(); // Prevent opening chat
    console.log('Decline button clicked for user:', request.user_id);
    declineConnectionRequest(request.user_id);
  });
  
  actionsDiv.appendChild(acceptBtn);
  actionsDiv.appendChild(declineBtn);
  item.appendChild(actionsDiv);
  
  // Add click handler to view the request
  item.addEventListener('click', function() {
    openChatWithUser(request);
  });
  
  return item;
}

/**
 * Show a notification to the user
 * 
 * @param {string} message - The message to display
 * @param {string} type - The type of notification ('success', 'error', 'info')
 */
function showNotification(message, type = 'info') {
  // Create the notification element if it doesn't exist
  let notificationContainer = document.getElementById('dmNotificationContainer');
  
  if (!notificationContainer) {
    notificationContainer = document.createElement('div');
    notificationContainer.id = 'dmNotificationContainer';
    notificationContainer.className = 'dm-notification-container';
    document.body.appendChild(notificationContainer);
  }
  
  // Create the notification
  const notification = document.createElement('div');
  notification.className = `dm-notification dm-notification-${type}`;
  
  // Add icon based on type
  let icon = 'info-circle';
  if (type === 'success') {
    icon = 'check-circle';
  } else if (type === 'error') {
    icon = 'exclamation-circle';
  }
  
  notification.innerHTML = `
    <i class="bi bi-${icon}"></i>
    <span>${message}</span>
    <button class="dm-notification-close"><i class="bi bi-x"></i></button>
  `;
  
  // Add to container
  notificationContainer.appendChild(notification);
  
  // Add close button functionality
  const closeButton = notification.querySelector('.dm-notification-close');
  if (closeButton) {
    closeButton.addEventListener('click', function() {
      notification.classList.add('dm-notification-hidden');
      setTimeout(() => {
        if (notification.parentElement) {
          notification.parentElement.removeChild(notification);
        }
      }, 300);
    });
  }
  
  // Auto-close after 5 seconds
  setTimeout(() => {
    notification.classList.add('dm-notification-hidden');
    setTimeout(() => {
      if (notification.parentElement) {
        notification.parentElement.removeChild(notification);
      }
    }, 300);
  }, 5000);
}


// Add this function to the bottom of private_messaging_connection.js

// Function to add a user to the conversation list
// New function to add a user to the conversation list
function addUserToConversationList(user) {
  // Check if the user is already in the conversation list
  const primaryInboxList = document.getElementById('dmPrimaryInboxList');
  const existingItem = primaryInboxList.querySelector(`.dm-chat-item[data-user-id="${user.id}"]`);
  
  if (existingItem) {
    // If the user already exists in the list, do nothing or update it if needed
    return;
  }
  
  // Check if primaryInboxList has the loading indicator or empty state
  const loadingElement = primaryInboxList.querySelector('.dm-loading-chats');
  const emptyStateElement = primaryInboxList.querySelector('.dm-empty-state');
  
  if (loadingElement) {
    loadingElement.style.display = 'none';
  }
  
  if (emptyStateElement) {
    primaryInboxList.removeChild(emptyStateElement);
  }
  
  // Create a new conversation item
  const template = document.getElementById('dmChatItemTemplate');
  if (!template) {
    console.error('Chat item template not found');
    return;
  }
  
  const clone = document.importNode(template.content, true);
  const item = clone.querySelector('.dm-chat-item');
  
  // Set user data
  item.setAttribute('data-user-id', user.id);
  
  const img = item.querySelector('.dm-chat-item-img');
  img.src = user.profile_picture || 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
  img.alt = user.name;
  
  const name = item.querySelector('.dm-chat-item-name');
  name.textContent = user.name;
  
  const message = item.querySelector('.dm-chat-item-last-message');
  message.textContent = 'Click to start chatting';
  
  const time = item.querySelector('.dm-chat-item-time');
  time.textContent = 'Now';
  
  // Add click handler
  item.addEventListener('click', function() {
    openChatWithUser(user);
  });
  
  // Add the item to the top of the list
  if (primaryInboxList.firstChild) {
    primaryInboxList.insertBefore(item, primaryInboxList.firstChild);
  } else {
    primaryInboxList.appendChild(item);
  }
  
  // Update badge count
  const badgeElement = document.getElementById('dmPrimaryInboxBadge');
  if (badgeElement) {
    const currentCount = parseInt(badgeElement.textContent) || 0;
    badgeElement.textContent = currentCount + 1;
  }
}

// Add function to window object so it can be accessed globally
window.addUserToConversationList = addUserToConversationList;


// Add some CSS styles to the document for notifications and transitions
document.addEventListener('DOMContentLoaded', function() {
  const style = document.createElement('style');
  style.textContent = `
    .dm-notification-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    
    .dm-notification {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      max-width: 350px;
      animation: slideIn 0.3s ease forwards;
      opacity: 1;
      transform: translateX(0);
      transition: opacity 0.3s, transform 0.3s;
    }
    
    .dm-notification-hidden {
      opacity: 0;
      transform: translateX(30px);
    }
    
    .dm-notification i {
      font-size: 18px;
    }
    
    .dm-notification-success i {
      color: #28a745;
    }
    
    .dm-notification-error i {
      color: #dc3545;
    }
    
    .dm-notification-info i {
      color: #17a2b8;
    }
    
    .dm-notification span {
      flex: 1;
      font-size: 14px;
      line-height: 1.4;
    }
    
    .dm-notification-close {
      background: none;
      border: none;
      padding: 0;
      margin: 0;
      cursor: pointer;
      color: #6c757d;
      font-size: 14px;
    }
    
    .dm-notification-close:hover {
      color: #343a40;
    }
    
    @keyframes slideIn {
      from {
        transform: translateX(30px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    .dm-chat-request.accepted {
      background-color: rgba(40, 167, 69, 0.1);
      transition: background-color 0.3s, opacity 0.3s, transform 0.3s;
      opacity: 0.8;
      transform: translateX(30px);
    }
    
    .dm-chat-request.declined {
      background-color: rgba(220, 53, 69, 0.1);
      transition: background-color 0.3s, opacity 0.3s, transform 0.3s;
      opacity: 0.8;
      transform: translateX(30px);
    }
    
    .dm-request-actions {
      display: flex;
      gap: 5px;
      margin-left: auto;
    }
    
    .dm-accept-btn, .dm-decline-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .dm-accept-btn {
      background-color: #28a745;
      color: white;
    }
    
    .dm-accept-btn:hover {
      background-color: #218838;
      transform: scale(1.1);
    }
    
    .dm-decline-btn {
      background-color: #dc3545;
      color: white;
    }
    
    .dm-decline-btn:hover {
      background-color: #c82333;
      transform: scale(1.1);
    }
  `;
  document.head.appendChild(style);
});







