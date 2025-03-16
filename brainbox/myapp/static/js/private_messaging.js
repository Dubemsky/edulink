// direct-messaging.js - Enhanced messaging system

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  initDirectMessagingSystem();
});

function initDirectMessagingSystem() {
  // Cache DOM elements
  const directMessagingButton = document.getElementById('directMessagingButton');
  const directMessagingPanel = document.getElementById('directMessagingPanel');
  const dmClosePanelBtn = document.getElementById('dmClosePanelBtn');
  const primaryInboxTab = document.getElementById('dmPrimaryInboxTab');
  const messageRequestsTab = document.getElementById('dmMessageRequestsTab');
  const primaryInbox = document.getElementById('dmPrimaryInbox');
  const messageRequests = document.getElementById('dmMessageRequests');
  const primaryInboxList = document.getElementById('dmPrimaryInboxList');
  const messageRequestsList = document.getElementById('dmMessageRequestsList');
  const chatWindowsContainer = document.getElementById('dmChatWindowsContainer');
  const messageSearch = document.getElementById('dmMessageSearch');
  const unreadBadge = document.getElementById('dmUnreadBadge');
  const primaryInboxBadge = document.getElementById('dmPrimaryInboxBadge');
  const messageRequestsBadge = document.getElementById('dmMessageRequestsBadge');
  
  // Check if messaging elements exist
  if (!directMessagingButton || !directMessagingPanel) {
    console.log("Direct messaging system elements not found on this page");
    return;
  }
  
  // State management
  const activeChats = new Map(); // Map of chat ID to chat window element
  let chats = {
    primaryInbox: [],
    messageRequests: []
  };
  
  // Track websocket connections for real-time messaging
  const chatSockets = new Map(); // Map of chat ID to WebSocket connection
  let currentUserId = null; // Will be set when user info is loaded
  
  // Debounce function for search input
  const debounce = (func, delay) => {
    let timeout;
    return function() {
      const context = this;
      const args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), delay);
    };
  };
  
  // Event Listeners with improved delegation where possible
  directMessagingButton.addEventListener('click', toggleDirectMessagingPanel);
  dmClosePanelBtn.addEventListener('click', hideDirectMessagingPanel);
  primaryInboxTab.addEventListener('click', () => switchTab('primaryInbox'));
  messageRequestsTab.addEventListener('click', () => switchTab('messageRequests'));
  messageSearch.addEventListener('input', debounce(handleSearchInput, 300)); // Debounced search
  
  // Handle click outside to close panel
  document.addEventListener('click', function(event) {
    if (directMessagingPanel.classList.contains('show') && 
        !directMessagingPanel.contains(event.target) && 
        event.target !== directMessagingButton &&
        !directMessagingButton.contains(event.target)) {
      hideDirectMessagingPanel();
    }
  });
  
  // Setup message button in user profile modal (if exists)
  setupUserProfileModalMessageButton();
  
  // Load user info and initialize chats
  loadUserInfo()
    .then(() => {
      loadChats();
      // Start polling for updates
      startPolling();
    })
    .catch(error => {
      console.error("Error initializing messaging system:", error);
    });
  
  /**
   * Load current user information
   */
  function loadUserInfo() {
    return fetch('/get_current_user_info/')
      .then(response => {
        if (!response.ok) throw new Error('Failed to load user info');
        return response.json();
      })
      .then(data => {
        if (data.success) {
          currentUserId = data.user_id;
          return data;
        } else {
          throw new Error(data.error || 'Failed to load user info');
        }
      });
  }


  
  /**
   * Toggle messaging panel visibility
   */
  function toggleDirectMessagingPanel() {
    if (directMessagingPanel.classList.contains('show')) {
      hideDirectMessagingPanel();
    } else {
      showDirectMessagingPanel();
    }
  }
  
  /**
   * Show the messaging panel
   */
  function showDirectMessagingPanel() {
    directMessagingPanel.classList.add('show');
    // Refresh chats when panel is opened
    loadChats();
  }
  
  /**
   * Hide the messaging panel
   */
  function hideDirectMessagingPanel() {
    directMessagingPanel.classList.remove('show');
  }
  
  /**
   * Switch between inbox tabs
   */
  function switchTab(tabId) {
    // Update active tab button
    primaryInboxTab.classList.toggle('active', tabId === 'primaryInbox');
    messageRequestsTab.classList.toggle('active', tabId === 'messageRequests');
    
    // Update active tab content
    primaryInbox.classList.toggle('active', tabId === 'primaryInbox');
    messageRequests.classList.toggle('active', tabId === 'messageRequests');
    
    // If switching to a tab, clear its badge
    if (tabId === 'primaryInbox') {
      primaryInboxBadge.classList.remove('show');
      primaryInboxBadge.textContent = '0';
    } else if (tabId === 'messageRequests') {
      messageRequestsBadge.classList.remove('show');
      messageRequestsBadge.textContent = '0';
    }
  }
  
  /**
   * Handle search input for filtering conversations
   */
  function handleSearchInput() {
    const searchTerm = messageSearch.value.toLowerCase();
    
    // Filter primary inbox chats
    filterChatItems(primaryInboxList, '.dm-chat-item', searchTerm);
    
    // Filter message requests
    filterChatItems(messageRequestsList, '.dm-chat-item', searchTerm);
  }
  
  /**
   * Filter chat items based on search term
   */
  function filterChatItems(containerEl, itemSelector, searchTerm) {
    const chatItems = containerEl.querySelectorAll(itemSelector);
    let visibleCount = 0;
    
    chatItems.forEach(item => {
      const name = item.querySelector('.dm-chat-item-name').textContent.toLowerCase();
      const lastMessage = item.querySelector('.dm-chat-item-last-message').textContent.toLowerCase();
      const isMatch = name.includes(searchTerm) || lastMessage.includes(searchTerm);
      
      item.style.display = isMatch ? 'flex' : 'none';
      if (isMatch) visibleCount++;
    });
    
    // Handle empty search results
    const emptyEl = containerEl.querySelector('.empty-search');
    
    if (searchTerm && visibleCount === 0) {
      if (!emptyEl) {
        const newEmptyEl = createEmptyState('No conversations match your search', 'search');
        newEmptyEl.classList.add('empty-search');
        containerEl.appendChild(newEmptyEl);
      } else {
        emptyEl.style.display = 'flex';
      }
    } else if (emptyEl) {
      emptyEl.style.display = 'none';
    }
  }
  
  /**
   * Setup message button in user profile modal
   */
  function setupUserProfileModalMessageButton() {
    // Find user profile modal (if exists)
    const userProfileModal = document.getElementById('userProfileModal');
    if (!userProfileModal) return;
    
    // Get message button if it already exists
    const messageBtn = document.getElementById('dmMessageButton');
    if (messageBtn) {
      messageBtn.addEventListener('click', handleMessageButtonClick);
    }
  }
  
  /**
   * Handle message button click in profile modal
   */
  function handleMessageButtonClick() {
    const userId = document.getElementById('followButton').dataset.userId;
    const userName = document.getElementById('modalProfileName').textContent;
    const userRole = document.getElementById('modalRoleBadge').textContent;
    const userImg = document.getElementById('modalProfileImg').src;
    
    // Close the modal
    const userProfileModal = bootstrap.Modal.getInstance(document.getElementById('userProfileModal'));
    userProfileModal.hide();
    
    // Start chat
    startChat(userId, userName, userRole, userImg);
  }
  
  /**
   * Load all chats (primary inbox and message requests)
   */

















































  // Improve the loadChats function to store chat data
function loadChats() {
  // Show loading state
  showLoadingState(primaryInboxList);
  showLoadingState(messageRequestsList);
  
  // Fetch chats
  fetch('/get_direct_chats/')
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        // Store chats in localStorage for persistence between page refreshes
        localStorage.setItem('dm_primary_inbox', JSON.stringify(data.primary_inbox || []));
        localStorage.setItem('dm_message_requests', JSON.stringify(data.message_requests || []));
        
        // Store chats in memory
        chats.primaryInbox = data.primary_inbox || [];
        chats.messageRequests = data.message_requests || [];
        
        // Render chats
        renderChats(primaryInboxList, chats.primaryInbox);
        renderChats(messageRequestsList, chats.messageRequests);
        
        // Update badges
        updateUnreadBadges(data.unread_counts || {
          primary: 0,
          requests: 0,
          total: 0
        });
      } else {
        console.error('Failed to load chats:', data.error);
        
        // Try to load from localStorage if API fails
        tryLoadFromLocalStorage();
        
        showErrorState(primaryInboxList, 'Failed to load conversations');
        showErrorState(messageRequestsList, 'Failed to load message requests');
      }
    })
    .catch(error => {
      console.error('Error:', error);
      
      // Try to load from localStorage if API fails
      tryLoadFromLocalStorage();
      
      showErrorState(primaryInboxList, 'Failed to load conversations');
      showErrorState(messageRequestsList, 'Failed to load message requests');
    });
}

// Function to try loading chats from localStorage
function tryLoadFromLocalStorage() {
  try {
    const storedPrimaryInbox = localStorage.getItem('dm_primary_inbox');
    const storedMessageRequests = localStorage.getItem('dm_message_requests');
    
    if (storedPrimaryInbox) {
      chats.primaryInbox = JSON.parse(storedPrimaryInbox);
      renderChats(primaryInboxList, chats.primaryInbox);
    }
    
    if (storedMessageRequests) {
      chats.messageRequests = JSON.parse(storedMessageRequests);
      renderChats(messageRequestsList, chats.messageRequests);
    }
  } catch (e) {
    console.error('Error loading from localStorage:', e);
  }
}

// Also improve loadChatHistory to store chat messages
function loadChatHistory(chatId) {
  const chatWindow = activeChats.get(chatId);
  if (!chatWindow) return;
  
  const chatMessages = chatWindow.querySelector('.dm-chat-messages');
  
  // Show loading state
  chatMessages.innerHTML = `
    <div class="dm-chat-loading">
      <div class="dm-spinner"></div>
    </div>
  `;
  
  // Try to load from localStorage first for instant display
  try {
    const storedMessages = localStorage.getItem(`dm_messages_${chatId}`);
    if (storedMessages) {
      const messages = JSON.parse(storedMessages);
      displayChatMessages(chatWindow, chatMessages, messages.messages, messages.current_user_id);
    }
  } catch (e) {
    console.error('Error loading from localStorage:', e);
  }
  
  // Then fetch from server to get latest
  fetch('/get_direct_chat_history/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrfToken()
    },
    body: JSON.stringify({
      chat_id: chatId
    })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(data => {
    if (data.success) {
      // Store in localStorage for persistence
      localStorage.setItem(`dm_messages_${chatId}`, JSON.stringify(data));
      
      // Display messages
      displayChatMessages(chatWindow, chatMessages, data.messages, data.current_user_id);
    } else {
      console.error('Failed to load chat history:', data.error);
      
      // If we didn't already load from localStorage, show error
      if (!localStorage.getItem(`dm_messages_${chatId}`)) {
        chatMessages.innerHTML = `
          <div class="dm-chat-error">
            <p>Failed to load messages. Please try again.</p>
          </div>
        `;
      }
    }
  })
  .catch(error => {
    console.error('Error:', error);
    
    // If we didn't already load from localStorage, show error
    if (!localStorage.getItem(`dm_messages_${chatId}`)) {
      chatMessages.innerHTML = `
        <div class="dm-chat-error">
          <p>Error connecting to server. Please try again.</p>
        </div>
      `;
    }
  });
}

// Helper function to display chat messages
function displayChatMessages(chatWindow, chatMessages, messages, currentUserId) {
  // Clear loading state
  chatMessages.innerHTML = '';
  
  // Store current user ID in the chat window
  chatWindow.dataset.currentUserId = currentUserId;
  
  // Render messages
  if (messages.length === 0) {
    // Show empty state
    const emptyEl = document.createElement('div');
    emptyEl.className = 'dm-chat-empty';
    emptyEl.innerHTML = `
      <p>No messages yet. Send a message to start the conversation!</p>
    `;
    chatMessages.appendChild(emptyEl);
  } else {
    // Render each message
    messages.forEach(message => {
      renderMessage(chatMessages, message, currentUserId);
    });
  }
  
  // Scroll to bottom
  scrollToBottom(chatMessages);
}





































  /**
   * Render chat list items
   */
  function renderChats(containerEl, chatList) {
    // Clear container
    containerEl.innerHTML = '';
    
    if (chatList.length === 0) {
      // Show empty state
      const emptyEl = createEmptyState(
        containerEl.id === 'dmPrimaryInboxList' 
          ? 'No conversations yet' 
          : 'No message requests'
      );
      containerEl.appendChild(emptyEl);
      return;
    }
    
    // Create document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    // Render each chat
    chatList.forEach(chat => {
      const chatItem = document.createElement('div');
      chatItem.className = 'dm-chat-item';
      chatItem.dataset.chatId = chat.chat_id;
      chatItem.dataset.userId = chat.other_user_id;
      
      // Add unread class if there are unread messages
      if (chat.unread_count && chat.unread_count > 0) {
        chatItem.classList.add('dm-chat-item-unread');
      }
      
      // Get default profile image path from static
      const defaultProfileImg = '/static/images/default_profile.jpg';
      
      // Format last message with proper escaping for HTML
      const lastMessage = escapeHtml(chat.last_message || 'No messages yet');
      
      chatItem.innerHTML = `
        <img src="${chat.other_user_profile_pic || defaultProfileImg}" alt="" class="dm-chat-item-img">
        <div class="dm-chat-item-details">
          <div class="dm-chat-item-header">
            <h4 class="dm-chat-item-name">${escapeHtml(chat.other_user_name)}</h4>
            <span class="dm-chat-item-time">${formatChatTime(chat.last_message_time)}</span>
          </div>
          <div class="dm-chat-item-last-message">${lastMessage}</div>
        </div>
      `;
      
      // Add click event
      chatItem.addEventListener('click', () => {
        openChat(
          chat.chat_id,
          chat.other_user_id,
          chat.other_user_name,
          chat.other_user_role,
          chat.other_user_profile_pic
        );
      });
      
      fragment.appendChild(chatItem);
    });
    
    containerEl.appendChild(fragment);
  }
  
  /**
   * Create empty state element
   */
  function createEmptyState(message, icon = 'chat-dots') {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'dm-empty-chats';
    emptyEl.innerHTML = `
      <i class="bi bi-${icon}"></i>
      <p>${escapeHtml(message)}</p>
    `;
    return emptyEl;
  }
  
  /**
   * Show loading state
   */
  function showLoadingState(containerEl) {
    containerEl.innerHTML = `
      <div class="dm-loading-chats">
        <div class="dm-spinner"></div>
        <p>Loading...</p>
      </div>
    `;
  }
  
  /**
   * Show error state
   */
  function showErrorState(containerEl, message) {
    containerEl.innerHTML = `
      <div class="dm-empty-chats">
        <i class="bi bi-exclamation-circle"></i>
        <p>${escapeHtml(message)}</p>
      </div>
    `;
  }
  
  /**
   * Format chat time in a human-readable way
   */
  function formatChatTime(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    
    // Check if valid date
    if (isNaN(date.getTime())) return '';
    
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    // Format based on how old the message is
    if (diffDays === 0) {
      // Today: show time
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      // Yesterday
      return 'Yesterday';
    } else if (diffDays < 7) {
      // This week: show day name
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      // Older: show date
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }
  
  /**
   * Start a new chat or open existing one
   */
  function startChat(userId, userName, userRole, userImg) {
    // First check if we have an existing chat with this user
    let existingChatId = null;
    
    // Check primary inbox
    const primaryChat = chats.primaryInbox.find(chat => chat.other_user_id === userId);
    if (primaryChat) {
      existingChatId = primaryChat.chat_id;
    } else {
      // Check message requests
      const requestChat = chats.messageRequests.find(chat => chat.other_user_id === userId);
      if (requestChat) {
        existingChatId = requestChat.chat_id;
      }
    }
    
    if (existingChatId) {
      // Open existing chat
      openChat(existingChatId, userId, userName, userRole, userImg);
      return;
    }
    
    // Show a temporary "creating chat" toast
    showToast('Creating new conversation...', 'info');
    
    // If no existing chat, create one
    fetch('/start_direct_chat/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken()
      },
      body: JSON.stringify({
        recipient_id: userId
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        // Open new chat
        openChat(data.chat_id, userId, userName, userRole, userImg);
        
        // Refresh chats
        loadChats();
        
        showToast('Conversation started!', 'success');
      } else {
        console.error('Failed to start chat:', data.error);
        showToast('Failed to start conversation', 'error');
      }
    })
    .catch(error => {
      console.error('Error:', error);
      showToast('Network error. Please try again.', 'error');
    });
  }
  
  /**
   * Open a chat window
   */
  function openChat(chatId, userId, userName, userRole, userImg) {
    // If chat is already open, just focus it
    if (activeChats.has(chatId)) {
      const chatWindow = activeChats.get(chatId);
      // Unminimize if minimized
      if (chatWindow.classList.contains('minimized')) {
        chatWindow.classList.remove('minimized');
      }
      return;
    }
    
    // Close messaging panel
    hideDirectMessagingPanel();
    
    // Create chat window
    const template = document.getElementById('dmChatWindowTemplate');
    const chatWindow = document.importNode(template.content, true).querySelector('.dm-chat-window');
    
    // Set chat ID
    chatWindow.dataset.chatId = chatId;
    chatWindow.dataset.userId = userId;
    
    // Get default profile image path
    const defaultProfileImg = '/static/images/default_profile.jpg';
    
    // Set user info with proper escaping
    chatWindow.querySelector('.dm-chat-user-img').src = userImg || defaultProfileImg;
    chatWindow.querySelector('.dm-chat-user-name').textContent = userName;
    chatWindow.querySelector('.dm-chat-user-role').textContent = userRole;
    
    // Add event listeners
    chatWindow.querySelector('.dm-minimize-chat-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      chatWindow.classList.toggle('minimized');
    });
    
    chatWindow.querySelector('.dm-close-chat-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      closeChat(chatId);
    });
    
    chatWindow.querySelector('.dm-chat-header').addEventListener('click', () => {
      chatWindow.classList.toggle('minimized');
    });
    
    const chatInput = chatWindow.querySelector('.dm-chat-input');
    const sendButton = chatWindow.querySelector('.dm-send-message-btn');
    
    // Send message on button click
    sendButton.addEventListener('click', () => {
      sendMessage(chatId, userId, chatInput);
    });
    
    // Send message on Enter (but allow Shift+Enter for new line)
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(chatId, userId, chatInput);
      }
    });
    
    // Add to container
    chatWindowsContainer.appendChild(chatWindow);
    
    // Add to active chats
    activeChats.set(chatId, chatWindow);
    
    // Mark chat as read when opened
    markChatAsRead(chatId);
    
    // Load chat history
    loadChatHistory(chatId);
    
    // Setup WebSocket for real-time messaging
    setupChatWebSocket(chatId, userId);
    
    // Scroll to bottom when messages are loaded
    const chatMessages = chatWindow.querySelector('.dm-chat-messages');
    const observer = new MutationObserver(() => {
      scrollToBottom(chatMessages);
    });
    observer.observe(chatMessages, { childList: true });
    
    // Focus input
    chatInput.focus();
  }
  
  /**
   * Close a chat window
   */
  function closeChat(chatId) {
    const chatWindow = activeChats.get(chatId);
    if (chatWindow) {
      chatWindow.remove();
      activeChats.delete(chatId);
      
      // Close WebSocket connection if exists
      if (chatSockets.has(chatId)) {
        const socket = chatSockets.get(chatId);
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
        chatSockets.delete(chatId);
      }
    }
  }
  
  /**
   * Setup WebSocket for real-time chat messaging
   */
  function setupChatWebSocket(chatId, userId) {
    // Close existing socket if any
    if (chatSockets.has(chatId)) {
      const existingSocket = chatSockets.get(chatId);
      if (existingSocket && existingSocket.readyState === WebSocket.OPEN) {
        existingSocket.close();
      }
    }
    
    // Create WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws/direct-chat/${chatId}/`);
    
    socket.onopen = () => {
      console.log(`WebSocket connection established for chat ${chatId}`);
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'chat_message') {
          // Handle new message
          const message = data.message;
          const chatWindow = activeChats.get(chatId);
          
          if (chatWindow) {
            const chatMessages = chatWindow.querySelector('.dm-chat-messages');
            const currentUserId = chatWindow.dataset.currentUserId;
            
            // Add message to chat window
            renderMessage(chatMessages, {
              content: message.content,
              sender_id: message.sender_id,
              timestamp: message.timestamp
            }, currentUserId);
            
            // Mark as read if chat window is open and not minimized
            if (!chatWindow.classList.contains('minimized')) {
              markChatAsRead(chatId);
            } else {
              // Update unread count in the list
              updateChatItemUnreadStatus(chatId, true);
            }
            
            // Play notification sound if message is from other user
            if (message.sender_id !== currentUserId) {
              playNotificationSound();
            }
          } else {
            // Update unread count in the list if chat window is not open
            updateChatItemUnreadStatus(chatId, true);
            
            // Update the last message in the chat list
            updateChatItemLastMessage(chatId, message.content, message.timestamp);
          }
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    };
    
    socket.onerror = (error) => {
      console.error(`WebSocket error for chat ${chatId}:`, error);
    };
    
    socket.onclose = () => {
      console.log(`WebSocket connection closed for chat ${chatId}`);
      
      // Remove from map if this connection is still the active one
      if (chatSockets.get(chatId) === socket) {
        chatSockets.delete(chatId);
      }
      
      // Try to reconnect after a delay if chat is still open
      if (activeChats.has(chatId)) {
        setTimeout(() => {
          if (activeChats.has(chatId)) {
            console.log(`Attempting to reconnect WebSocket for chat ${chatId}`);
            setupChatWebSocket(chatId, userId);
          }
        }, 3000);
      }
    };
    
    // Store the socket
    chatSockets.set(chatId, socket);
  }
  

  
  /**
   * Create message element
   */
  function createMessageElement(message, currentUserId) {
    const isSent = message.sender_id === currentUserId;
    
    const messageEl = document.createElement('div');
    messageEl.className = `dm-message ${isSent ? 'sent' : 'received'}`;
    
    messageEl.innerHTML = `
      <div class="dm-message-content">${escapeHtml(message.content)}</div>
      <div class="dm-message-time">${formatMessageTime(message.timestamp)}</div>
    `;
    
    return messageEl;
  }
  
  /**
   * Render a message in the chat window
   */
  function renderMessage(containerEl, message, currentUserId) {
    const messageEl = createMessageElement(message, currentUserId);
    containerEl.appendChild(messageEl);
    scrollToBottom(containerEl);
  }
  
  /**
   * Format message time
   */
  function formatMessageTime(timestamp) {
    if (!timestamp) return '';
    
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '';
      
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (err) {
      console.error('Error formatting message time:', err);
      return '';
    }
  }
  
  /**
   * Send a message
   */
  function sendMessage(chatId, userId, inputEl) {
    const message = inputEl.value.trim();
    if (!message) return;
    
    // Clear input
    inputEl.value = '';
    
    // Get chat window
    const chatWindow = activeChats.get(chatId);
    if (!chatWindow) return;
    
    // Get current user ID
    const currentUserId = chatWindow.dataset.currentUserId;
    
    // Get messages container
    const chatMessages = chatWindow.querySelector('.dm-chat-messages');
    
    // Create a unique temp ID for this message
    const tempId = `temp_${Date.now()}`;
    
    // Add temporary message (optimistic UI)
    const tempMessage = document.createElement('div');
    tempMessage.className = 'dm-message sent sending';
    tempMessage.dataset.tempId = tempId;
    
    const timestamp = new Date().toISOString();
    
    tempMessage.innerHTML = `
      <div class="dm-message-content">${escapeHtml(message)}</div>
      <div class="dm-message-time">Sending...</div>
    `;
    
    chatMessages.appendChild(tempMessage);
    scrollToBottom(chatMessages);
    
    // Create a temporary message object to store locally
    const messageObj = {
      id: tempId,
      content: message,
      sender_id: currentUserId,
      recipient_id: userId,
      timestamp: timestamp,
      read: false,
      temp: true
    };
    
    // Add to local storage temporarily
    try {
      const storedMessagesStr = localStorage.getItem(`dm_messages_${chatId}`);
      if (storedMessagesStr) {
        const storedMessages = JSON.parse(storedMessagesStr);
        storedMessages.messages.push(messageObj);
        localStorage.setItem(`dm_messages_${chatId}`, JSON.stringify(storedMessages));
      }
    } catch (e) {
      console.error('Error updating localStorage:', e);
    }
    
    // Send message to server
    fetch('/send_direct_message/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken()
      },
      body: JSON.stringify({
        recipient_id: userId,
        content: message,
        type: 'text',
        temp_id: tempId
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        // Update temporary message
        tempMessage.classList.remove('sending');
        tempMessage.querySelector('.dm-message-time').textContent = formatMessageTime(data.timestamp);
        
        // Update the message ID in local storage
        try {
          const storedMessagesStr = localStorage.getItem(`dm_messages_${chatId}`);
          if (storedMessagesStr) {
            const storedMessages = JSON.parse(storedMessagesStr);
            const msgIndex = storedMessages.messages.findIndex(m => m.id === tempId || m.temp_id === tempId);
            if (msgIndex >= 0) {
              storedMessages.messages[msgIndex].id = data.message_id;
              storedMessages.messages[msgIndex].temp = false;
              storedMessages.messages[msgIndex].timestamp = data.timestamp;
              localStorage.setItem(`dm_messages_${chatId}`, JSON.stringify(storedMessages));
            }
          }
        } catch (e) {
          console.error('Error updating localStorage:', e);
        }
        
        // Refresh chats in the background
        loadChats();
      } else {
        console.error('Failed to send message:', data.error);
        // Mark as error
        tempMessage.classList.add('error');
        tempMessage.querySelector('.dm-message-time').textContent = 'Failed to send';
        
        // Remove from localStorage
        try {
          const storedMessagesStr = localStorage.getItem(`dm_messages_${chatId}`);
          if (storedMessagesStr) {
            const storedMessages = JSON.parse(storedMessagesStr);
            const msgIndex = storedMessages.messages.findIndex(m => m.id === tempId || m.temp_id === tempId);
            if (msgIndex >= 0) {
              storedMessages.messages.splice(msgIndex, 1);
              localStorage.setItem(`dm_messages_${chatId}`, JSON.stringify(storedMessages));
            }
          }
        } catch (e) {
          console.error('Error updating localStorage:', e);
        }
      }
    })
    .catch(error => {
      console.error('Error:', error);
      // Mark as error
      tempMessage.classList.add('error');
      tempMessage.querySelector('.dm-message-time').textContent = 'Failed to send';
    });
  }
  




  /**
   * Mark a chat as read
   */
  function markChatAsRead(chatId) {
    fetch('/mark_chat_read/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken()
      },
      body: JSON.stringify({
        chat_id: chatId
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        // Update unread status in chat list
        updateChatItemUnreadStatus(chatId, false);
        
        // Update badges
        loadUnreadCounts();
      }
    })
    .catch(error => {
      console.error('Error marking chat as read:', error);
    });
  }
  
  /**
   * Update unread status of a chat item in the list
   */
  function updateChatItemUnreadStatus(chatId, isUnread) {
    // Find chat item in both primary inbox and message requests
    const chatItems = document.querySelectorAll(`.dm-chat-item[data-chat-id="${chatId}"]`);
    
    chatItems.forEach(item => {
      if (isUnread) {
        item.classList.add('dm-chat-item-unread');
      } else {
        item.classList.remove('dm-chat-item-unread');
      }
    });
  }
  
  /**
   * Update last message in chat list
   */
  function updateChatItemLastMessage(chatId, content, timestamp) {
    // Find chat item in both primary inbox and message requests
    const chatItems = document.querySelectorAll(`.dm-chat-item[data-chat-id="${chatId}"]`);
    
    chatItems.forEach(item => {
      const lastMessageEl = item.querySelector('.dm-chat-item-last-message');
      const timeEl = item.querySelector('.dm-chat-item-time');
      
      if (lastMessageEl) {
        lastMessageEl.textContent = content;
      }
      
      if (timeEl) {
        timeEl.textContent = formatChatTime(timestamp);
      }
      
      // Move to top of list (first child)
      const parentList = item.parentElement;
      if (parentList && parentList.firstChild !== item) {
        parentList.insertBefore(item, parentList.firstChild);
      }
    });
  }
  
  /**
   * Load unread message counts
   */
  function loadUnreadCounts() {
    fetch('/get_unread_counts/')
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        if (data.success) {
          updateUnreadBadges(data.counts);
        }
      })
      .catch(error => {
        console.error('Error loading unread counts:', error);
      });
  }
  
  /**
   * Update unread message badges
   */
  function updateUnreadBadges(counts = {}) {
    const primaryCount = counts.primary || 0;
    const requestsCount = counts.requests || 0;
    
    // Update badges
    primaryInboxBadge.textContent = primaryCount;
    primaryInboxBadge.classList.toggle('show', primaryCount > 0);
    
    messageRequestsBadge.textContent = requestsCount;
    messageRequestsBadge.classList.toggle('show', requestsCount > 0);
    
    const totalCount = primaryCount + requestsCount;
    unreadBadge.textContent = totalCount;
    unreadBadge.classList.toggle('show', totalCount > 0);
  }
  
  /**
   * Play notification sound for new messages
   */
  function playNotificationSound() {
    // Check if sounds are enabled in user preferences
    const soundsEnabled = localStorage.getItem('dmSoundsEnabled') !== 'false';
    
    if (soundsEnabled) {
      try {
        const audio = new Audio('/static/sounds/message.mp3');
        audio.volume = 0.5;
        audio.play().catch(e => {
          // Browser may block autoplay, that's okay
          console.log('Could not play notification sound:', e);
        });
      } catch (e) {
        console.log('Error playing notification sound:', e);
      }
    }
  }
  
  /**
   * Show toast notification
   */
  function showToast(message, type = 'info') {
    // Remove any existing toast
    const existingToast = document.getElementById('dm-toast');
    if (existingToast) {
      existingToast.remove();
    }
    
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('dm-toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'dm-toast-container';
      toastContainer.style.position = 'fixed';
      toastContainer.style.bottom = '20px';
      toastContainer.style.right = '20px';
      toastContainer.style.zIndex = '9999';
      document.body.appendChild(toastContainer);
    }
    
    // Create toast
    const toast = document.createElement('div');
    toast.id = 'dm-toast';
    toast.style.backgroundColor = 
      type === 'error' ? '#f44336' : 
      type === 'success' ? '#4CAF50' : 
      type === 'warning' ? '#ff9800' : '#2196F3';
    toast.style.color = 'white';
    toast.style.padding = '12px 16px';
    toast.style.borderRadius = '4px';
    toast.style.marginTop = '10px';
    toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    toast.style.minWidth = '250px';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    toast.textContent = message;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Fade in
    setTimeout(() => {
      toast.style.opacity = '1';
    }, 10);
    
    // Fade out after 3 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
  }
  
  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    if (!text || typeof text !== 'string') return '';
    
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    
    return text.replace(/[&<>"']/g, m => map[m]);
  }
  
  /**
   * Scroll to bottom of element
   */
  function scrollToBottom(element) {
    element.scrollTop = element.scrollHeight;
  }
  
  /**
   * Start polling for updates
   */
  function startPolling() {
    // Poll for updates every 30 seconds
    setInterval(() => {
      // Only refresh if there are open chats or the messaging panel is visible
      if (activeChats.size > 0 || directMessagingPanel.classList.contains('show')) {
        loadChats();
        loadUnreadCounts();
        
        // No need to refresh chat windows - WebSockets handle that
      }
    }, 30000);
  }
  
  /**
   * Get CSRF token
   */
  function getCsrfToken() {
    const tokenInput = document.querySelector('input[name="csrfmiddlewaretoken"]');
    if (tokenInput) {
      return tokenInput.value;
    }
    
    // Fallback: try to get from cookie
    const cookieValue = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrftoken='))
      ?.split('=')[1];
      
    return cookieValue || '';
  }
  
  // Export public API
  window.directMessagingSystem = {
    startChat,
    openChat,
    closeChat,
    loadChats,
    sendMessage,
    toggleDirectMessagingPanel,
    markChatAsRead
  };
}