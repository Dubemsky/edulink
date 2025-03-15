// messaging-system.js - LinkedIn-style messaging system for EduLink

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initMessagingSystem();
  });
  
  function initMessagingSystem() {
    // Elements
    const messagingButton = document.getElementById('messagingButton');
    const messagingPanel = document.getElementById('messagingPanel');
    const closePanelBtn = document.getElementById('closePanelBtn');
    const primaryInboxTab = document.getElementById('primaryInboxTab');
    const messageRequestsTab = document.getElementById('messageRequestsTab');
    const primaryInbox = document.getElementById('primaryInbox');
    const messageRequests = document.getElementById('messageRequests');
    const primaryInboxList = document.getElementById('primaryInboxList');
    const messageRequestsList = document.getElementById('messageRequestsList');
    const chatWindowsContainer = document.getElementById('chatWindowsContainer');
    const messageSearch = document.getElementById('messageSearch');
    const unreadBadge = document.getElementById('unreadBadge');
    const primaryInboxBadge = document.getElementById('primaryInboxBadge');
    const messageRequestsBadge = document.getElementById('messageRequestsBadge');
    
    // Check if messaging elements exist
    if (!messagingButton || !messagingPanel) {
      console.log("Messaging system elements not found on this page");
      return;
    }
    
    // State
    const activeChats = new Map(); // Map of chat ID to chat window element
    let chats = {
      primaryInbox: [],
      messageRequests: []
    };
    
    // Event Listeners
    messagingButton.addEventListener('click', toggleMessagingPanel);
    closePanelBtn.addEventListener('click', hideMessagingPanel);
    primaryInboxTab.addEventListener('click', () => switchTab('primaryInbox'));
    messageRequestsTab.addEventListener('click', () => switchTab('messageRequests'));
    messageSearch.addEventListener('input', handleSearchInput);
    
    // Setup message button in user profile modal (if exists)
    setupUserProfileModalMessageButton();
    
    // Initialize
    loadChats();
    
    // Start polling for updates
    startPolling();
    
    // Functions
    function toggleMessagingPanel() {
      if (messagingPanel.classList.contains('show')) {
        hideMessagingPanel();
      } else {
        showMessagingPanel();
      }
    }
    
    function showMessagingPanel() {
      messagingPanel.classList.add('show');
      // Refresh chats when panel is opened
      loadChats();
    }
    
    function hideMessagingPanel() {
      messagingPanel.classList.remove('show');
    }
    
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
    
    function handleSearchInput() {
      const searchTerm = messageSearch.value.toLowerCase();
      
      // Filter primary inbox chats
      const primaryChatItems = primaryInboxList.querySelectorAll('.chat-item');
      primaryChatItems.forEach(item => {
        const name = item.querySelector('.chat-item-name').textContent.toLowerCase();
        const lastMessage = item.querySelector('.chat-item-last-message').textContent.toLowerCase();
        const isMatch = name.includes(searchTerm) || lastMessage.includes(searchTerm);
        item.style.display = isMatch ? 'flex' : 'none';
      });
      
      // Filter message requests
      const requestChatItems = messageRequestsList.querySelectorAll('.chat-item');
      requestChatItems.forEach(item => {
        const name = item.querySelector('.chat-item-name').textContent.toLowerCase();
        const lastMessage = item.querySelector('.chat-item-last-message').textContent.toLowerCase();
        const isMatch = name.includes(searchTerm) || lastMessage.includes(searchTerm);
        item.style.display = isMatch ? 'flex' : 'none';
      });
      
      // Show/hide empty state
      const primaryEmpty = primaryInboxList.querySelector('.empty-search');
      const requestsEmpty = messageRequestsList.querySelector('.empty-search');
      
      if (searchTerm && primaryChatItems.length > 0 && Array.from(primaryChatItems).every(item => item.style.display === 'none')) {
        if (!primaryEmpty) {
          const emptyEl = createEmptyState('No conversations match your search', 'search');
          emptyEl.classList.add('empty-search');
          primaryInboxList.appendChild(emptyEl);
        } else {
          primaryEmpty.style.display = 'flex';
        }
      } else if (primaryEmpty) {
        primaryEmpty.style.display = 'none';
      }
      
      if (searchTerm && requestChatItems.length > 0 && Array.from(requestChatItems).every(item => item.style.display === 'none')) {
        if (!requestsEmpty) {
          const emptyEl = createEmptyState('No message requests match your search', 'search');
          emptyEl.classList.add('empty-search');
          messageRequestsList.appendChild(emptyEl);
        } else {
          requestsEmpty.style.display = 'flex';
        }
      } else if (requestsEmpty) {
        requestsEmpty.style.display = 'none';
      }
    }
    
    function setupUserProfileModalMessageButton() {
      // Find user profile modal (if exists)
      const userProfileModal = document.getElementById('userProfileModal');
      if (!userProfileModal) return;
      
      // Get message button if it already exists
      const messageBtn = document.getElementById('messageButton');
      if (messageBtn) {
        messageBtn.addEventListener('click', handleMessageButtonClick);
      }
    }
    
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
    
    function loadChats() {
      // Show loading state
      showLoadingState(primaryInboxList);
      showLoadingState(messageRequestsList);
      
      // Fetch chats
      fetch('/get_chats/')
        .then(response => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return response.json();
        })
        .then(data => {
          if (data.success) {
            // Store chats
            chats.primaryInbox = data.primary_inbox || [];
            chats.messageRequests = data.message_requests || [];
            
            // Render chats
            renderChats(primaryInboxList, chats.primaryInbox);
            renderChats(messageRequestsList, chats.messageRequests);
            
            // Update badges
            updateUnreadBadges();
          } else {
            console.error('Failed to load chats:', data.error);
            showErrorState(primaryInboxList, 'Failed to load conversations');
            showErrorState(messageRequestsList, 'Failed to load message requests');
          }
        })
        .catch(error => {
          console.error('Error:', error);
          showErrorState(primaryInboxList, 'Failed to load conversations');
          showErrorState(messageRequestsList, 'Failed to load message requests');
        });
    }



    
    function renderChats(containerEl, chatList) {
      // Clear container
      containerEl.innerHTML = '';
      
      if (chatList.length === 0) {
        // Show empty state
        const emptyEl = createEmptyState(
          containerEl.id === 'primaryInboxList' 
            ? 'No conversations yet' 
            : 'No message requests'
        );
        containerEl.appendChild(emptyEl);
        return;
      }
      
      // Render each chat
      chatList.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.dataset.chatId = chat.chat_id;
        chatItem.dataset.userId = chat.other_user_id;
        
        // Add unread class if there are unread messages
        const hasUnreadMessages = false; // TODO: Implement this
        if (hasUnreadMessages) {
          chatItem.classList.add('chat-item-unread');
        }
        
        // Get default profile image path from static
        const defaultProfileImg = '/static/images/default_profile.jpg';
        
        chatItem.innerHTML = `
          <img src="${chat.other_user_profile_pic || defaultProfileImg}" alt="" class="chat-item-img">
          <div class="chat-item-details">
            <div class="chat-item-header">
              <h4 class="chat-item-name">${chat.other_user_name}</h4>
              <span class="chat-item-time">${formatChatTime(chat.last_message_time)}</span>
            </div>
            <div class="chat-item-last-message">${chat.last_message || 'No messages yet'}</div>
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
        
        containerEl.appendChild(chatItem);
      });
    }
    
    function createEmptyState(message, icon = 'chat-dots') {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'empty-chats';
      emptyEl.innerHTML = `
        <i class="bi bi-${icon}"></i>
        <p>${message}</p>
      `;
      return emptyEl;
    }
    
    function showLoadingState(containerEl) {
      containerEl.innerHTML = `
        <div class="loading-chats">
          <div class="spinner"></div>
          <p>Loading...</p>
        </div>
      `;
    }
    
    function showErrorState(containerEl, message) {
      containerEl.innerHTML = `
        <div class="empty-chats">
          <i class="bi bi-exclamation-circle"></i>
          <p>${message}</p>
        </div>
      `;
    }
    
    function formatChatTime(timestamp) {
      if (!timestamp) return '';
      
      const date = new Date(timestamp);
      const now = new Date();
      const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
      
      if (isNaN(diffDays)) return '';
      
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
      
      // If no existing chat, create one
      fetch('/start_chat/', {
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
          openChat(data.room_id, userId, userName, userRole, userImg);
          
          // Refresh chats
          loadChats();
        } else {
          console.error('Failed to start chat:', data.error);
          alert('Failed to start chat. Please try again.');
        }
      })
      .catch(error => {
        console.error('Error:', error);
        alert('Error connecting to server. Please try again.');
      });
    }
    
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
      hideMessagingPanel();
      
      // Create chat window
      const template = document.getElementById('chatWindowTemplate');
      const chatWindow = document.importNode(template.content, true).querySelector('.chat-window');
      
      // Set chat ID
      chatWindow.dataset.chatId = chatId;
      chatWindow.dataset.userId = userId;
      
      // Get default profile image path
      const defaultProfileImg = '/static/images/default_profile.jpg';
      
      // Set user info
      chatWindow.querySelector('.chat-user-img').src = userImg || defaultProfileImg;
      chatWindow.querySelector('.chat-user-name').textContent = userName;
      chatWindow.querySelector('.chat-user-role').textContent = userRole;
      
      // Add event listeners
      chatWindow.querySelector('.minimize-chat-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        chatWindow.classList.toggle('minimized');
      });
      
      chatWindow.querySelector('.close-chat-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        closeChat(chatId);
      });
      
      chatWindow.querySelector('.chat-header').addEventListener('click', () => {
        chatWindow.classList.toggle('minimized');
      });
      
      const chatInput = chatWindow.querySelector('.chat-input');
      const sendButton = chatWindow.querySelector('.send-message-btn');
      
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
      
      // Load chat history
      loadChatHistory(chatId);
      
      // Scroll to bottom when messages are loaded
      const chatMessages = chatWindow.querySelector('.chat-messages');
      const observer = new MutationObserver(() => {
        scrollToBottom(chatMessages);
      });
      observer.observe(chatMessages, { childList: true });
      
      // Focus input
      chatInput.focus();
    }
    
    function closeChat(chatId) {
      const chatWindow = activeChats.get(chatId);
      if (chatWindow) {
        chatWindow.remove();
        activeChats.delete(chatId);
      }
    }


    
    function loadChatHistory(chatId) {
  const chatWindow = activeChats.get(chatId);
  if (!chatWindow) return;
  
  const chatMessages = chatWindow.querySelector('.chat-messages');
  
  // Show loading state
  chatMessages.innerHTML = `
    <div class="chat-loading">
      <div class="spinner"></div>
    </div>
  `;
  
  // Fetch chat history
  fetch('/get_chat_history/', {
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
      // Clear loading state
      chatMessages.innerHTML = '';
      
      // Store current user ID
      chatWindow.dataset.currentUserId = data.current_user_id;
      
      // Render messages
      if (data.messages.length === 0) {
        // Show empty state
        const emptyEl = document.createElement('div');
        emptyEl.className = 'chat-empty';
        emptyEl.innerHTML = `
          <p>No messages yet. Send a message to start the conversation!</p>
        `;
        chatMessages.appendChild(emptyEl);
      } else {
        // Render each message
        data.messages.forEach(message => {
          renderMessage(chatMessages, message, data.current_user_id);
        });
      }
    } else {
      console.error('Failed to load chat history:', data.error);
      chatMessages.innerHTML = `
        <div class="chat-error">
          <p>Failed to load messages. Please try again.</p>
        </div>
      `;
    }
  })
  .catch(error => {
    console.error('Error:', error);
    chatMessages.innerHTML = `
      <div class="chat-error">
        <p>Error connecting to server. Please try again.</p>
      </div>
    `;
  });
}
    
    function renderMessage(containerEl, message, currentUserId) {
      const isSent = message.sender_id === currentUserId;
      
      const messageEl = document.createElement('div');
      messageEl.className = `message ${isSent ? 'sent' : 'received'}`;
      
      messageEl.innerHTML = `
        <div class="message-content">${message.content}</div>
        <div class="message-time">${formatMessageTime(message.timestamp)}</div>
      `;
      
      containerEl.appendChild(messageEl);
    }
    
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
    
    function sendMessage(chatId, userId, inputEl) {
      const message = inputEl.value.trim();
      if (!message) return;
      
      // Clear input
      inputEl.value = '';
      
      // Get chat window
      const chatWindow = activeChats.get(chatId);
      if (!chatWindow) return;
      
      // Get messages container
      const chatMessages = chatWindow.querySelector('.chat-messages');
      
      // Add temporary message (optimistic UI)
      const tempMessage = document.createElement('div');
      tempMessage.className = 'message sent sending';
      
      tempMessage.innerHTML = `
        <div class="message-content">${message}</div>
        <div class="message-time">Sending...</div>
      `;
      
      chatMessages.appendChild(tempMessage);
      scrollToBottom(chatMessages);
      
      // Send message to server
      fetch('/send_message/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken()
        },
        body: JSON.stringify({
          recipient_id: userId,
          content: message,
          type: 'text'
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
          tempMessage.querySelector('.message-time').textContent = formatMessageTime(new Date().toISOString());
          
          // Refresh chats in the background
          loadChats();
        } else {
          console.error('Failed to send message:', data.error);
          // Mark as error
          tempMessage.classList.add('error');
          tempMessage.querySelector('.message-time').textContent = 'Failed to send';
        }
      })
      .catch(error => {
        console.error('Error:', error);
        // Mark as error
        tempMessage.classList.add('error');
        tempMessage.querySelector('.message-time').textContent = 'Failed to send';
      });
    }
    



    
    function scrollToBottom(element) {
      element.scrollTop = element.scrollHeight;
    }
    
    function updateUnreadBadges() {
      let primaryCount = 0;
      let requestsCount = 0;
      
      // Count unread messages (placeholder - should be implemented with actual data)
      // TODO: Get actual unread counts from backend
      
      // Update badges
      primaryInboxBadge.textContent = primaryCount;
      primaryInboxBadge.classList.toggle('show', primaryCount > 0);
      
      messageRequestsBadge.textContent = requestsCount;
      messageRequestsBadge.classList.toggle('show', requestsCount > 0);
      
      const totalCount = primaryCount + requestsCount;
      unreadBadge.textContent = totalCount;
      unreadBadge.classList.toggle('show', totalCount > 0);
    }
    
    function startPolling() {
      // Poll for new messages and updates every 30 seconds
      setInterval(() => {
        // Only refresh if there are open chats or the messaging panel is visible
        if (activeChats.size > 0 || messagingPanel.classList.contains('show')) {
          loadChats();
          
          // Also refresh open chat windows
          activeChats.forEach((chatWindow, chatId) => {
            loadChatHistory(chatId);
          });
        }
      }, 30000);
    }
    
    // From messaging-system.js - This function updates the unread badge counts
    function updateUnreadBadges() {
      let primaryCount = 0;
      let requestsCount = 0;
      
      // Count unread messages (placeholder - should be implemented with actual data)
      // TODO: Get actual unread counts from backend
      
      // Update badges
      primaryInboxBadge.textContent = primaryCount;
      primaryInboxBadge.classList.toggle('show', primaryCount > 0);
      
      messageRequestsBadge.textContent = requestsCount;
      messageRequestsBadge.classList.toggle('show', requestsCount > 0);
      
      const totalCount = primaryCount + requestsCount;
      unreadBadge.textContent = totalCount;
      unreadBadge.classList.toggle('show', totalCount > 0);
    }
    




    // Helper function to get CSRF token
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
    window.messagingSystem = {
      startChat,
      openChat,
      closeChat,
      loadChats,
      sendMessage
    };
  }