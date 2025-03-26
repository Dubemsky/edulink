// group_chat.js

// Store active group chat WebSocket connections
const activeGroupConnections = {};

/**
 * Initialize WebSocket connection for group chat
 * @param {string} groupId - The group chat ID
 * @param {string} userId - The current user's ID
 * @param {HTMLElement} chatWindow - The chat window DOM element
 * @returns {WebSocket} The WebSocket connection
 */
function initializeGroupChatWebSocket(groupId, userId, chatWindow) {
  // Check if connection already exists
  if (activeGroupConnections[groupId]) {
    console.log(`Using existing WebSocket connection for group ${groupId}`);
    return activeGroupConnections[groupId];
  }
  
  // Create WebSocket URL
  const wsUrl = `ws://${window.location.host}/ws/group-chat/${groupId}/${userId}/`;
  
  console.log(`Establishing WebSocket connection to: ${wsUrl}`);
  
  // Create new WebSocket connection
  const socket = new WebSocket(wsUrl);
  
  // Store the connection
  activeGroupConnections[groupId] = socket;
  
  // WebSocket event handlers
  socket.onopen = function(e) {
    console.log(`WebSocket connection established for group chat: ${groupId}`);
    
    // Show connected status in chat window
    const messagesContainer = chatWindow.querySelector('.group-chat-messages');
    const connectionMessage = document.createElement('div');
    connectionMessage.className = 'group-message system-message';
    connectionMessage.innerHTML = `
      <div class="group-message-content">
        <i class="bi bi-wifi"></i> Connected - Messages will appear in real-time
      </div>
    `;
    messagesContainer.appendChild(connectionMessage);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  };
  
  socket.onmessage = function(event) {
    console.log('Group message received:', event.data);
    try {
      const data = JSON.parse(event.data);
      
      // Handle different message types
      if (data.type === 'message') {
        // Determine if this is an outgoing or incoming message
        const isOutgoing = data.sender_id === userId;
        
        // Add message to chat window
        addMessageToGroupChat(
          chatWindow, 
          data.message, 
          data.sender_id,
          data.sender_name,
          data.sender_picture,
          isOutgoing, 
          data.timestamp
        );
      } 
      else if (data.type === 'history') {
        // Load conversation history
        const messagesContainer = chatWindow.querySelector('.group-chat-messages');
        
        // Clear any loading placeholder
        const loadingElement = chatWindow.querySelector('.group-chat-loading');
        if (loadingElement) {
          loadingElement.style.display = 'none';
        }
        
        // Clear existing messages
        messagesContainer.innerHTML = '';
        
        // Display welcome message
        const welcomeMessage = document.createElement('div');
        welcomeMessage.className = 'group-message system-message';
        welcomeMessage.innerHTML = `
          <div class="group-message-content">
            Welcome to the group chat
          </div>
        `;
        messagesContainer.appendChild(welcomeMessage);
        
        // Add all messages from history
        if (data.messages && data.messages.length > 0) {
          data.messages.forEach(message => {
            const isOutgoing = message.sender_id === userId;
            addMessageToGroupChat(
              chatWindow, 
              message.content, 
              message.sender_id,
              message.sender_name,
              message.sender_picture,
              isOutgoing, 
              message.timestamp
            );
          });
        }
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
      else if (data.type === 'user_joined') {
        // Add a system message showing that a user joined
        const messagesContainer = chatWindow.querySelector('.group-chat-messages');
        const joinMessage = document.createElement('div');
        joinMessage.className = 'group-message system-message';
        joinMessage.innerHTML = `
          <div class="group-message-content">
            <i class="bi bi-person-plus"></i> ${data.user_name} joined the chat
          </div>
        `;
        messagesContainer.appendChild(joinMessage);
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
      else if (data.type === 'typing') {
        // Show typing indicator
        updateTypingIndicator(chatWindow, data.user_id, data.user_name, data.is_typing);
      }
    } catch (error) {
      console.error('Error processing group message:', error);
    }
  };
  
  socket.onclose = function(event) {
    if (event.wasClean) {
      console.log(`Group chat connection closed cleanly, code=${event.code}, reason=${event.reason}`);
    } else {
      console.warn('Group chat connection died unexpectedly');
      
      // Show disconnected status in chat window
      const messagesContainer = chatWindow.querySelector('.group-chat-messages');
      if (messagesContainer) {
        const disconnectionMessage = document.createElement('div');
        disconnectionMessage.className = 'group-message system-message error';
        disconnectionMessage.innerHTML = `
          <div class="group-message-content">
            <i class="bi bi-wifi-off"></i> Disconnected - Trying to reconnect...
          </div>
        `;
        messagesContainer.appendChild(disconnectionMessage);
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
      
      // Try to reconnect after a delay
      setTimeout(() => {
        // Remove from active connections
        delete activeGroupConnections[groupId];
        
        // Attempt to reconnect
        initializeGroupChatWebSocket(groupId, userId, chatWindow);
      }, 3000);
    }
  };
  
  socket.onerror = function(error) {
    console.error(`Group WebSocket Error:`, error);
  };
  
  return socket;
}

/**
 * Send a message to a group chat through the WebSocket connection
 * @param {WebSocket} socket - The WebSocket connection
 * @param {string} message - The message to send
 */
function sendGroupMessageViaWebSocket(socket, message) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'message',
      message: message
    }));
    return true;
  } else {
    console.error('Group WebSocket is not connected');
    return false;
  }
}

/**
 * Send typing indicator to group chat
 * @param {WebSocket} socket - The WebSocket connection
 * @param {boolean} isTyping - Whether the user is typing
 */
function sendTypingIndicator(socket, isTyping) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'typing',
      is_typing: isTyping
    }));
  }
}

/**
 * Update typing indicator in the chat
 * @param {HTMLElement} chatWindow - The chat window element
 * @param {string} userId - The ID of the user who is typing
 * @param {string} userName - The name of the user who is typing
 * @param {boolean} isTyping - Whether the user is typing
 */
function updateTypingIndicator(chatWindow, userId, userName, isTyping) {
  const typingIndicator = chatWindow.querySelector('.group-typing-indicator');
  
  if (isTyping) {
    if (!typingIndicator) {
      const newIndicator = document.createElement('div');
      newIndicator.className = 'group-typing-indicator';
      newIndicator.dataset.userId = userId;
      newIndicator.innerHTML = `
        <span>${userName}</span> is typing<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>
      `;
      const messagesContainer = chatWindow.querySelector('.group-chat-messages');
      messagesContainer.appendChild(newIndicator);
    }
  } else if (typingIndicator && typingIndicator.dataset.userId === userId) {
    typingIndicator.remove();
  }
}

/**
 * Close a group WebSocket connection
 * @param {string} groupId - The group chat ID
 */
function closeGroupWebSocketConnection(groupId) {
  if (activeGroupConnections[groupId]) {
    console.log(`Closing WebSocket connection for group ${groupId}`);
    activeGroupConnections[groupId].close();
    delete activeGroupConnections[groupId];
  }
}

/**
 * Add a message to a group chat window
 * @param {HTMLElement} chatWindow - The chat window element
 * @param {string} messageText - The message text
 * @param {string} senderId - The ID of the sender
 * @param {string} senderName - The name of the sender
 * @param {string} senderPicture - The profile picture URL of the sender
 * @param {boolean} isOutgoing - Whether this is an outgoing message
 * @param {string} timestamp - The timestamp of the message
 */
function addMessageToGroupChat(chatWindow, messageText, senderId, senderName, senderPicture, isOutgoing, timestamp) {
  // Get the messages container
  const messagesContainer = chatWindow.querySelector('.group-chat-messages');
  
  // Remove typing indicator if it exists for this sender
  const typingIndicator = chatWindow.querySelector(`.group-typing-indicator[data-user-id="${senderId}"]`);
  if (typingIndicator) {
    typingIndicator.remove();
  }
  
  // Create message element
  const messageDiv = document.createElement('div');
  messageDiv.className = `group-message ${isOutgoing ? 'outgoing' : 'incoming'}`;
  
  // Add sender info for incoming messages
  if (!isOutgoing) {
    messageDiv.innerHTML = `
      <div class="group-message-sender">
        <img src="${senderPicture || '/static/images/default-avatar.jpg'}" alt="${senderName}" class="group-sender-avatar">
        <span class="group-sender-name">${senderName}</span>
      </div>
      <div class="group-message-content">${messageText}</div>
      <div class="group-message-time">${formatMessageTime(timestamp || new Date())}</div>
    `;
  } else {
    messageDiv.innerHTML = `
      <div class="group-message-content">${messageText}</div>
      <div class="group-message-time">${formatMessageTime(timestamp || new Date())}</div>
    `;
  }
  
  // Add to the container
  messagesContainer.appendChild(messageDiv);
  
  // Scroll to the bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Format message time
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
 * Create a new group chat
 * @param {string} groupName - The name of the group
 * @param {Array} participantIds - Array of participant user IDs
 * @returns {Promise} A promise that resolves with the created group's data
 */
function createGroupChat(groupName, participantIds) {
  return new Promise((resolve, reject) => {
    fetch('/create_group_chat/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken()
      },
      body: JSON.stringify({
        name: groupName,
        participants: participantIds
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
        resolve(data);
      } else {
        reject(new Error(data.error || 'Failed to create group chat'));
      }
    })
    .catch(error => {
      console.error('Error creating group chat:', error);
      reject(error);
    });
  });
}

/**
 * Get all group chats for the current user
 * @returns {Promise} A promise that resolves with the user's group chats
 */
function getGroupChats() {
  return new Promise((resolve, reject) => {
    fetch('/get_group_chats/')
      .then(response => {
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (data.success) {
          resolve(data.group_chats);
        } else {
          reject(new Error(data.error || 'Failed to get group chats'));
        }
      })
      .catch(error => {
        console.error('Error getting group chats:', error);
        reject(error);
      });
  });
}

/**
 * Send a message to a group chat using AJAX (fallback if WebSocket fails)
 * @param {string} groupId - The group chat ID
 * @param {string} message - The message to send
 * @returns {Promise} A promise that resolves when the message is sent
 */
function sendGroupMessage(groupId, message) {
  return new Promise((resolve, reject) => {
    fetch('/send_group_message/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken()
      },
      body: JSON.stringify({
        group_id: groupId,
        message: message
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
        resolve(data);
      } else {
       