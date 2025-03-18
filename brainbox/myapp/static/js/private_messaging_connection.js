// private_messaging_connections.js
// This script enhances the private messaging system with WebSocket support

// Track active chat windows and their WebSocket connections
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
  fetch('mark_messages_read/', {
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
  // This function should be implemented to return the current user's ID
  // For now, we'll use a placeholder or try to extract from the page
  
  // Option 1: Look for a hidden input with user_id
  const userIdInput = document.getElementById('current_user_id');
  if (userIdInput && userIdInput.value) {
    return userIdInput.value;
  }
  
  // Option 2: Try to get from data attribute on the body
  const userIdFromBody = document.body.getAttribute('data-user-id');
  if (userIdFromBody) {
    return userIdFromBody;
  }
  
  // Option 3: Try to extract from a variable in the page
  if (window.currentUserId) {
    return window.currentUserId;
  }
  
  // Option 4: For demo purposes, create a temporary ID based on a random number
  // In production, this should be replaced with a proper user ID
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
  openChatWithUser: openChatWithUser
};