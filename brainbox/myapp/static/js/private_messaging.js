// private_messaging_websocket.js

// Store active WebSocket connections
const activeConnections = {};

/**
 * Initialize WebSocket connection for direct messaging
 * @param {string} userId - The current user's ID
 * @param {string} recipientId - The recipient's ID 
 * @param {HTMLElement} chatWindow - The chat window DOM element
 * @returns {WebSocket} The WebSocket connection
 */
function initializeDirectMessageWebSocket(userId, recipientId, chatWindow) {
  // Create a unique conversation ID based on the two user IDs (sorted for consistency)
  const conversationId = `conversation_${[userId, recipientId].sort().join('_')}`;
  
  // Check if connection already exists
  if (activeConnections[conversationId]) {
    console.log(`Using existing WebSocket connection for ${conversationId}`);
    return activeConnections[conversationId];
  }
  
  // Determine WebSocket protocol (wss for HTTPS, ws for HTTP)
  const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
  const wsUrl = `${protocol}${window.location.host}/ws/direct-chat/${userId}/${recipientId}/`;
  
  console.log(`Establishing WebSocket connection to: ${wsUrl}`);
  
  // Create new WebSocket connection
  const socket = new WebSocket(wsUrl);
  
  // Store the connection
  activeConnections[conversationId] = socket;
  
  // WebSocket event handlers
  socket.onopen = function(e) {
    console.log(`WebSocket connection established for conversation: ${conversationId}`);
    
    // Show connected status in chat window
    const messagesContainer = chatWindow.querySelector('.dm-chat-messages');
    const connectionMessage = document.createElement('div');
    connectionMessage.className = 'dm-message system-message';
    connectionMessage.innerHTML = `
      <div class="dm-message-content">
        <i class="bi bi-wifi"></i> Connected - Messages will appear in real-time
      </div>
    `;
    messagesContainer.appendChild(connectionMessage);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  };
  
  socket.onmessage = function(event) {
    console.log('Message received:', event.data);
    const data = JSON.parse(event.data);
    
    // Handle different message types
    if (data.type === 'message') {
      // Determine if this is an outgoing or incoming message
      const isOutgoing = data.sender_id === userId;
      
      // Add message to chat window
      addMessageToChat(
        chatWindow, 
        data.message, 
        isOutgoing, 
        data.timestamp
      );
    } 
    else if (data.type === 'history') {
      // Load conversation history
      const messagesContainer = chatWindow.querySelector('.dm-chat-messages');
      
      // Clear any loading placeholder
      const loadingElement = chatWindow.querySelector('.dm-chat-loading');
      if (loadingElement) {
        loadingElement.style.display = 'none';
      }
      
      // Clear existing messages
      messagesContainer.innerHTML = '';
      
      // Display welcome message
      const welcomeMessage = document.createElement('div');
      welcomeMessage.className = 'dm-message system-message';
      welcomeMessage.innerHTML = `
        <div class="dm-message-content">
          Your conversation is private and secure.
        </div>
      `;
      messagesContainer.appendChild(welcomeMessage);
      
      // Add all messages from history
      if (data.messages && data.messages.length > 0) {
        data.messages.forEach(message => {
          const isOutgoing = message.sender_id === userId;
          addMessageToChat(
            chatWindow, 
            message.content, 
            isOutgoing, 
            message.timestamp
          );
        });
      }
      
      // Scroll to bottom
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  };
  
  socket.onclose = function(event) {
    if (event.wasClean) {
      console.log(`Connection closed cleanly, code=${event.code}, reason=${event.reason}`);
    } else {
      console.warn('Connection died');
      
      // Show disconnected status in chat window
      const messagesContainer = chatWindow.querySelector('.dm-chat-messages');
      const disconnectionMessage = document.createElement('div');
      disconnectionMessage.className = 'dm-message system-message error';
      disconnectionMessage.innerHTML = `
        <div class="dm-message-content">
          <i class="bi bi-wifi-off"></i> Disconnected - Trying to reconnect...
        </div>
      `;
      messagesContainer.appendChild(disconnectionMessage);
      
      // Scroll to bottom
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      
      // Try to reconnect after a delay
      setTimeout(() => {
        // Remove from active connections
        delete activeConnections[conversationId];
        
        // Attempt to reconnect
        initializeDirectMessageWebSocket(userId, recipientId, chatWindow);
      }, 3000);
    }
  };
  
  socket.onerror = function(error) {
    console.error(`WebSocket Error: ${error.message}`);
  };
  
  return socket;
}

/**
 * Send a message through the WebSocket connection
 * @param {WebSocket} socket - The WebSocket connection
 * @param {string} message - The message to send
 */
function sendMessageViaWebSocket(socket, message) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'message',
      message: message
    }));
    return true;
  } else {
    console.error('WebSocket is not connected');
    return false;
  }
}

/**
 * Close a WebSocket connection
 * @param {string} userId - The current user's ID
 * @param {string} recipientId - The recipient's ID
 */
function closeWebSocketConnection(userId, recipientId) {
  const conversationId = `conversation_${[userId, recipientId].sort().join('_')}`;
  
  if (activeConnections[conversationId]) {
    console.log(`Closing WebSocket connection for ${conversationId}`);
    activeConnections[conversationId].close();
    delete activeConnections[conversationId];
  }
}

// Add these functions to the window object so they can be accessed from other scripts
window.directMessagingWebSocket = {
  initialize: initializeDirectMessageWebSocket,
  sendMessage: sendMessageViaWebSocket,
  closeConnection: closeWebSocketConnection
};