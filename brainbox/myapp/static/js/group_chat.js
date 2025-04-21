// Updated Group Chat JavaScript with Backend Integration

// Global variables
let selectedMembers = [];
let activeGroupChats = [];
let groupChats = [];
let currentUserId = null;

document.addEventListener('DOMContentLoaded', function() {
  // Initialize group chat component
  initGroupChatComponent();
  // Get current user ID from the page if available
  currentUserId = document.getElementById('currentUserId')?.value || null;
});

/**
 * Initialize the group chat component
 */
function initGroupChatComponent() {
  // Set up event listeners for the main group chat button
  const groupChatBtn = document.getElementById('openGroupChatBtn');
  if (groupChatBtn) {
    groupChatBtn.addEventListener('click', toggleGroupChatPanel);
  }
  
  // Set up event listeners for the close panel button
  const closeGroupChatPanelBtn = document.getElementById('closeGroupChatPanelBtn');
  if (closeGroupChatPanelBtn) {
    closeGroupChatPanelBtn.addEventListener('click', closeGroupChatPanel);
  }
  
  // Set up event listeners for the create group button
  const openCreateGroupBtn = document.getElementById('openCreateGroupBtn');
  if (openCreateGroupBtn) {
    openCreateGroupBtn.addEventListener('click', showCreateGroupModal);
  }
  
  // Set up event listeners for modal buttons
  const closeGroupModalBtn = document.getElementById('closeGroupModalBtn');
  if (closeGroupModalBtn) {
    closeGroupModalBtn.addEventListener('click', hideCreateGroupModal);
  }
  
  const cancelGroupBtn = document.getElementById('cancelGroupBtn');
  if (cancelGroupBtn) {
    cancelGroupBtn.addEventListener('click', hideCreateGroupModal);
  }
  
  const createGroupSubmitBtn = document.getElementById('createGroupSubmitBtn');
  if (createGroupSubmitBtn) {
    createGroupSubmitBtn.addEventListener('click', createNewGroupChat);
  }
  
  // Setup click outside to close modal
  const groupModalOverlay = document.getElementById('groupModalOverlay');
  if (groupModalOverlay) {
    groupModalOverlay.addEventListener('click', function(e) {
      if (e.target === groupModalOverlay) {
        hideCreateGroupModal();
      }
    });
  }
  
  // Setup group name input validation
  const groupNameInput = document.getElementById('groupNameInput');
  if (groupNameInput) {
    groupNameInput.addEventListener('input', updateCreateGroupButtonState);
  }
  
  // Setup search input for members
  const membersSearchInput = document.getElementById('membersSearchInput');
  if (membersSearchInput) {
    membersSearchInput.addEventListener('input', function() {
      filterAvailableMembers(this.value);
    });
  }
  
  // Load group chats
  loadGroupChats();
}

/**
 * Toggle the group chat panel visibility
 */
function toggleGroupChatPanel() {
  const groupChatPanel = document.getElementById('groupChatPanel');
  if (groupChatPanel) {
    groupChatPanel.classList.toggle('show');
    if (groupChatPanel.classList.contains('show')) {
      loadGroupChats();
    }
  }
}

/**
 * Close the group chat panel
 */
function closeGroupChatPanel() {
  const groupChatPanel = document.getElementById('groupChatPanel');
  if (groupChatPanel) {
    groupChatPanel.classList.remove('show');
  }
}

/**
 * Load group chats from server
 */
function loadGroupChats() {
  const groupChatList = document.getElementById('groupChatList');
  if (!groupChatList) return;
  
  // Show loading indicator
  groupChatList.innerHTML = `
    <div class="group-loading">
      <div class="group-spinner"></div>
      <p>Loading group chats...</p>
    </div>
  `;
  
  // Fetch group chats from the server
  fetch('/get-group-chats/', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrfToken()
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(data => {
    if (data.success) {
      groupChats = data.group_chats || [];
      
      if (groupChats.length > 0) {
        groupChatList.innerHTML = '';
        groupChats.forEach(chat => {
          addGroupToList(chat);
        });
      } else {
        groupChatList.innerHTML = `
          <div class="group-empty-state">
            <i class="bi bi-people"></i>
            <p>No group chats yet. Create a new group chat to get started.</p>
          </div>
        `;
      }
    } else {
      console.error('Error loading group chats:', data.error);
      groupChatList.innerHTML = `
        <div class="group-error-state">
          <i class="bi bi-exclamation-triangle"></i>
          <p>Failed to load group chats. Please try again later.</p>
        </div>
      `;
    }
    
    // Update badge count
    updateGroupChatBadgeCount();
  })
  .catch(error => {
    console.error('Error:', error);
    groupChatList.innerHTML = `
      <div class="group-error-state">
        <i class="bi bi-exclamation-triangle"></i>
        <p>Failed to load group chats. Please try again later.</p>
      </div>
    `;
  });
}

/**
 * Show the create group modal
 */
function showCreateGroupModal() {
  const createGroupModal = document.getElementById('createGroupModal');
  const groupModalOverlay = document.getElementById('groupModalOverlay');
  
  if (createGroupModal && groupModalOverlay) {
    // Reset the form first
    resetGroupChatForm();
    
    // Show modal and overlay
    createGroupModal.style.display = 'block';
    groupModalOverlay.style.display = 'block';
    
    // Focus the input
    const groupNameInput = document.getElementById('groupNameInput');
    if (groupNameInput) {
      groupNameInput.focus();
    }
    
    // Load available members
    loadAvailableMembers();
  }
}

/**
 * Hide the create group modal
 */
function hideCreateGroupModal() {
  const createGroupModal = document.getElementById('createGroupModal');
  const groupModalOverlay = document.getElementById('groupModalOverlay');
  
  if (createGroupModal && groupModalOverlay) {
    createGroupModal.style.display = 'none';
    groupModalOverlay.style.display = 'none';
    
    // Reset selected members
    selectedMembers = [];
  }
}

/**
 * Reset the group chat creation form
 */
function resetGroupChatForm() {
  // Clear group name
  const groupNameInput = document.getElementById('groupNameInput');
  if (groupNameInput) {
    groupNameInput.value = '';
  }
  
  // Clear selected members
  selectedMembers = [];
  const selectedMembersContainer = document.getElementById('selectedMembers');
  if (selectedMembersContainer) {
    selectedMembersContainer.innerHTML = '<div class="group-empty-selection">No members selected</div>';
  }
  
  // Update count
  const selectedCount = document.getElementById('selectedCount');
  if (selectedCount) {
    selectedCount.textContent = '0';
  }
  
  // Reset create button state
  updateCreateGroupButtonState();
}

/**
 * Update the state of the create group button based on selections
 */
function updateCreateGroupButtonState() {
  const createBtn = document.getElementById('createGroupSubmitBtn');
  if (!createBtn) return;
  
  const groupNameInput = document.getElementById('groupNameInput');
  const hasName = groupNameInput && groupNameInput.value.trim() !== '';
  const hasMembers = selectedMembers.length >= 2; // Require at least 2 other people for a group
  
  // Enable the button if both conditions are met
  createBtn.disabled = !(hasName && hasMembers);
}

/**
 * Load available members who can be added to the group
 */
function loadAvailableMembers() {
  const availableMembers = document.getElementById('availableMembers');
  if (!availableMembers) return;
  
  // Show loading indicator
  availableMembers.innerHTML = `
    <div class="group-loading">
      <div class="group-spinner"></div>
      <p>Loading connections...</p>
    </div>
  `;
  
  // Fetch mutual connections from the server
  fetch('/get-mutual-connections', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrfToken()
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(data => {
    if (data.success) {
      const connections = data.connections || [];
      
      if (connections.length === 0) {
        availableMembers.innerHTML = `
          <div class="group-empty-connections">
            <i class="bi bi-people"></i>
            <p>You need to connect with users before creating a group chat.</p>
            <p>Follow other users and have them follow you back to create mutual connections.</p>
          </div>
        `;
      } else {
        displayAvailableMembers(connections);
      }
    } else {
      console.error('Error loading mutual connections:', data.error);
      availableMembers.innerHTML = `
        <div class="group-error-state">
          <i class="bi bi-exclamation-triangle"></i>
          <p>Failed to load connections. Please try again later.</p>
        </div>
      `;
    }
  })
  .catch(error => {
    console.error('Error:', error);
    availableMembers.innerHTML = `
      <div class="group-error-state">
        <i class="bi bi-exclamation-triangle"></i>
        <p>Failed to load connections. Please try again later.</p>
      </div>
    `;
  });
}

/**
 * Display available members in the UI
 */
function displayAvailableMembers(users) {
  const availableMembers = document.getElementById('availableMembers');
  if (!availableMembers) return;
  
  if (users.length === 0) {
    availableMembers.innerHTML = `
      <div class="group-empty-connections">
        <i class="bi bi-people"></i>
        <p>You need to connect with users before creating a group chat.</p>
      </div>
    `;
    return;
  }
  
  // Clear the list
  availableMembers.innerHTML = '';
  
  // Get the template
  const template = document.getElementById('groupMemberItemTemplate');
  if (!template) {
    console.error('Group member item template not found');
    return;
  }
  
  // Create a member item for each user
  users.forEach(user => {
    const clone = document.importNode(template.content, true);
    const memberItem = clone.querySelector('.group-member-item');
    
    // Set user data
    memberItem.setAttribute('data-user-id', user.id);
    
    const memberImg = memberItem.querySelector('.group-member-img');
    memberImg.src = user.profile_picture || 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
    memberImg.alt = user.name;
    
    const memberName = memberItem.querySelector('.group-member-name');
    memberName.textContent = user.name;
    
    const memberRole = memberItem.querySelector('.group-member-role');
    memberRole.textContent = user.role || 'User';
    
    // Configure buttons
    const addBtn = memberItem.querySelector('.group-add-member-btn');
    const removeBtn = memberItem.querySelector('.group-remove-member-btn');
    
    addBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      addMemberToSelection(user);
      addBtn.style.display = 'none';
      removeBtn.style.display = 'flex';
    });
    
    removeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      removeMemberFromSelection(user.id);
      removeBtn.style.display = 'none';
      addBtn.style.display = 'flex';
    });
    
    // Add click handler to the whole item (same as clicking the add button)
    memberItem.addEventListener('click', function() {
      if (selectedMembers.some(member => member.id === user.id)) {
        // If already selected, remove
        removeMemberFromSelection(user.id);
        removeBtn.style.display = 'none';
        addBtn.style.display = 'flex';
      } else {
        // If not selected, add
        addMemberToSelection(user);
        addBtn.style.display = 'none';
        removeBtn.style.display = 'flex';
      }
    });
    
    availableMembers.appendChild(memberItem);
  });
}

/**
 * Filter available members based on search input
 */
function filterAvailableMembers(searchTerm) {
  const memberItems = document.querySelectorAll('#availableMembers .group-member-item');
  searchTerm = searchTerm.toLowerCase();
  
  memberItems.forEach(item => {
    const memberName = item.querySelector('.group-member-name').textContent.toLowerCase();
    const memberRole = item.querySelector('.group-member-role').textContent.toLowerCase();
    
    if (memberName.includes(searchTerm) || memberRole.includes(searchTerm)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}

/**
 * Add a member to the selection
 */
function addMemberToSelection(user) {
  // Check if already selected
  if (selectedMembers.some(member => member.id === user.id)) {
    return;
  }
  
  // Add to the selected members array
  selectedMembers.push(user);
  
  // Remove empty selection message if present
  const emptySelection = document.querySelector('#selectedMembers .group-empty-selection');
  if (emptySelection) {
    emptySelection.remove();
  }
  
  // Add to the selected members UI
  const selectedMembersContainer = document.getElementById('selectedMembers');
  if (!selectedMembersContainer) return;
  
  // Create a member badge
  const memberBadge = document.createElement('div');
  memberBadge.className = 'group-selected-member-badge';
  memberBadge.setAttribute('data-user-id', user.id);
  
  memberBadge.innerHTML = `
    <img src="${user.profile_picture || 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'}" 
         alt="${user.name}" class="group-selected-member-img">
    <span class="group-selected-member-name">${user.name}</span>
    <button class="group-remove-selected-btn" aria-label="Remove ${user.name}">
      <i class="bi bi-x"></i>
    </button>
  `;
  
  // Add click handler to remove button
  const removeButton = memberBadge.querySelector('.group-remove-selected-btn');
  removeButton.addEventListener('click', function(e) {
    e.stopPropagation();
    removeMemberFromSelection(user.id);
    
    // Update the add/remove buttons in the available members list
    const memberItem = document.querySelector(`.group-member-item[data-user-id="${user.id}"]`);
    if (memberItem) {
      const addBtn = memberItem.querySelector('.group-add-member-btn');
      const removeBtn = memberItem.querySelector('.group-remove-member-btn');
      removeBtn.style.display = 'none';
      addBtn.style.display = 'flex';
    }
  });
  
  selectedMembersContainer.appendChild(memberBadge);
  
  // Update selected count
  const selectedCount = document.getElementById('selectedCount');
  if (selectedCount) {
    selectedCount.textContent = selectedMembers.length;
  }
  
  // Update create button state
  updateCreateGroupButtonState();
}

/**
 * Remove a member from the selection
 */
function removeMemberFromSelection(userId) {
  // Remove from the selected members array
  selectedMembers = selectedMembers.filter(member => member.id !== userId);
  
  // Remove from the selected members UI
  const memberBadge = document.querySelector(`.group-selected-member-badge[data-user-id="${userId}"]`);
  if (memberBadge) {
    memberBadge.remove();
  }
  
  // Add empty selection message if no members left
  const selectedMembersContainer = document.getElementById('selectedMembers');
  if (selectedMembersContainer && selectedMembers.length === 0) {
    selectedMembersContainer.innerHTML = '<div class="group-empty-selection">No members selected</div>';
  }
  
  // Update selected count
  const selectedCount = document.getElementById('selectedCount');
  if (selectedCount) {
    selectedCount.textContent = selectedMembers.length;
  }
  
  // Update create button state
  updateCreateGroupButtonState();
}

/**
 * Create a new group chat
 */
function createNewGroupChat() {
  const groupNameInput = document.getElementById('groupNameInput');
  if (!groupNameInput) return;
  
  const groupName = groupNameInput.value.trim();
  
  if (groupName === '' || selectedMembers.length < 2) {
    // Validation - need a name and at least 2 other people
    return;
  }
  
  // Show loading state on button
  const createBtn = document.getElementById('createGroupSubmitBtn');
  if (createBtn) {
    const originalText = createBtn.textContent;
    createBtn.disabled = true;
    createBtn.innerHTML = `<div class="group-spinner"></div> Creating...`;
    
    // Prepare data for API
    const requestData = {
      name: groupName,
      members: selectedMembers.map(member => member.id)
    };
    
    // Call the create_group_chat API
    fetch('/create-group-chat/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken()
      },
      body: JSON.stringify(requestData)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        // Create group data from the response
        const groupData = {
          id: data.group_id,
          name: data.name,
          members: data.members,
          membersCount: data.members.length,
          created_at: new Date().toISOString(),
          last_message: 'Group created',
          last_message_time: new Date().toISOString(),
          unread_count: 0
        };
        
        // Add to groupChats array
        groupChats.push(groupData);
        
        // Add group to UI
        addGroupToList(groupData);
        
        // Update badge count
        updateGroupChatBadgeCount();
        
        // Hide the modal
        hideCreateGroupModal();
        
        // Show success message (if notification system is available)
        if (typeof showNotification === 'function') {
          showNotification('Group chat created successfully!', 'success');
        } else {
          console.log('Group chat created successfully!');
        }
        
        // Open the group chat window
        openGroupChatWindow(groupData);
      } else {
        console.error('Error creating group chat:', data.error);
        if (typeof showNotification === 'function') {
          showNotification('Failed to create group chat: ' + data.error, 'error');
        } else {
          alert('Failed to create group chat: ' + data.error);
        }
      }
      
      // Reset button
      createBtn.disabled = false;
      createBtn.innerHTML = originalText;
    })
    .catch(error => {
      console.error('Error:', error);
      if (typeof showNotification === 'function') {
        showNotification('Failed to create group chat. Please try again later.', 'error');
      } else {
        alert('Failed to create group chat. Please try again later.');
      }
      
      // Reset button
      createBtn.disabled = false;
      createBtn.innerHTML = originalText;
    });
  }
}

/**
 * Add a group to the list
 */
function addGroupToList(group) {
  const groupChatList = document.getElementById('groupChatList');
  if (!groupChatList) return;
  
  // Remove empty state if it exists
  const emptyState = groupChatList.querySelector('.group-empty-state');
  if (emptyState) {
    emptyState.remove();
  }
  
  // Get the template
  const template = document.getElementById('groupChatItemTemplate');
  if (!template) {
    console.error('Group chat item template not found');
    return;
  }
  
  // Create group item
  const clone = document.importNode(template.content, true);
  const groupItem = clone.querySelector('.group-chat-item');
  
  // Set group data
  groupItem.setAttribute('data-group-id', group.id);
  
  const groupName = groupItem.querySelector('.group-chat-item-name');
  groupName.textContent = group.name;
  
  const lastMessage = groupItem.querySelector('.group-chat-item-last-message');
  lastMessage.textContent = group.last_message || 'Group created';
  
  const membersCount = groupItem.querySelector('.group-members-count');
  membersCount.textContent = group.member_count || group.membersCount || 0;
  
  const lastTime = groupItem.querySelector('.group-chat-item-time');
  lastTime.textContent = formatTime(group.last_message_time) || 'Just now';
  
  // Add unread badge if necessary
  if (group.unread_count && group.unread_count > 0) {
    const badge = groupItem.querySelector('.group-chat-item-badge');
    if (badge) {
      badge.textContent = group.unread_count;
      badge.style.display = 'flex';
    }
  }
  
  // Add click handler
  groupItem.addEventListener('click', function() {
    openGroupChatWindow(group);
  });
  
  // Add to the list (at the top)
  if (groupChatList.firstChild) {
    groupChatList.insertBefore(groupItem, groupChatList.firstChild);
  } else {
    groupChatList.appendChild(groupItem);
  }
}

/**
 * Open a group chat window
 */
function openGroupChatWindow(group) {
  // Close the group chat panel on mobile
  if (window.innerWidth < 768) {
    closeGroupChatPanel();
  }
  
  // Check if this chat is already open
  const existingChat = document.querySelector(`.group-chat-window[data-group-id="${group.id}"]`);
  if (existingChat) {
    // If minimized, maximize it
    existingChat.classList.remove('minimized');
    return existingChat;
  }
  
  // Get the template
  const template = document.getElementById('groupChatWindowTemplate');
  if (!template) {
    console.error('Group chat window template not found');
    return;
  }
  
  // Create the chat window
  const clone = document.importNode(template.content, true);
  const chatWindow = clone.querySelector('.group-chat-window');
  
  // Set window data
  chatWindow.setAttribute('data-group-id', group.id);
  
  const groupNameElement = chatWindow.querySelector('.group-chat-name');
  groupNameElement.textContent = group.name;
  
  const membersCountElement = chatWindow.querySelector('.group-members-count');
  membersCountElement.textContent = `${group.member_count || group.membersCount || 0} members`;
  
  // Set up buttons
  const minimizeBtn = chatWindow.querySelector('.group-minimize-btn');
  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', function() {
      chatWindow.classList.toggle('minimized');
    });
  }
  
  const closeBtn = chatWindow.querySelector('.group-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      chatWindow.remove();
      
      // Remove from active chats
      const index = activeGroupChats.findIndex(c => c === group.id);
      if (index !== -1) {
        activeGroupChats.splice(index, 1);
      }
    });
  }
  
  // Set up info button
  const infoBtn = chatWindow.querySelector('.group-info-btn');
  if (infoBtn) {
    infoBtn.addEventListener('click', function() {
      // In the future, implement a modal with group info and options
      console.log('Group info:', group);
    });
  }
  
  // Set up leave group button
  const leaveGroupBtn = chatWindow.querySelector('.group-leave-btn');
  if (leaveGroupBtn) {
    leaveGroupBtn.addEventListener('click', function() {
      // Show confirmation dialog
      if (confirm(`Are you sure you want to leave the group "${group.name}"?`)) {
        leaveGroupChat(group.id, chatWindow);
      }
    });
  }
  
  // Set up message input and send button
  const messageInput = chatWindow.querySelector('.group-chat-input');
  const sendBtn = chatWindow.querySelector('.group-send-message-btn');
  
  if (messageInput && sendBtn) {
    sendBtn.addEventListener('click', function() {
      sendGroupMessage(group.id, messageInput.value, chatWindow);
    });
    
    messageInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendGroupMessage(group.id, messageInput.value, chatWindow);
      }
    });
  }
  
  // Add to the document
  document.body.appendChild(chatWindow);
  
  // Position the window
  positionGroupChatWindow(chatWindow);
  
  // Add to active chats
  activeGroupChats.push(group.id);
  
  // Load messages
  loadGroupChatMessages(group.id, chatWindow);
  
  // Focus the input
  if (messageInput) {
    setTimeout(() => {
      messageInput.focus();
    }, 100);
  }
  
  // Initialize WebSocket connection for real-time messaging
  if (currentUserId) {
    initGroupChatWebSocket(group.id, currentUserId, chatWindow);
  }
  
  return chatWindow;
}

/**
 * Initialize WebSocket connection for real-time group chat
 */
/**
 * Initialize WebSocket connection for real-time group chat with profile handling
 */
function initGroupChatWebSocket(groupId, userId, chatWindow) {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
  const socket = new WebSocket(`${wsProtocol}${window.location.host}/ws/group_chat/${groupId}/${userId}/`);
  
  chatWindow.socket = socket;
  
  socket.onopen = function(e) {
    console.log('WebSocket connection established for group chat:', groupId);
    
    // Add a connected message to the chat
    const messagesContainer = chatWindow.querySelector('.group-chat-messages');
    if (messagesContainer) {
      const connectionMessage = document.createElement('div');
      connectionMessage.className = 'group-message system-message';
      connectionMessage.innerHTML = `
        <div class="group-message-content">
          <i class="bi bi-wifi"></i> Connected - Messages will appear in real-time
        </div>
      `;
      messagesContainer.appendChild(connectionMessage);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  };
  
  socket.onmessage = function(e) {
    try {
      const data = JSON.parse(e.data);
      
      // Handle different message types
      if (data.type === 'message') {
        // Ensure the message has all needed properties for display
        if (!data.sender_profile_picture) {
          // Try to find the sender in group members
          const group = window.groupChats.find(g => g.id === groupId);
          if (group && group.members) {
            const sender = group.members.find(m => m.id === data.sender_id);
            if (sender) {
              data.sender_profile_picture = sender.profile_picture;
            }
          }
        }
        
        addMessageToGroupChat(chatWindow, data);
      } else if (data.type === 'history') {
        displayGroupChatHistory(chatWindow, data.messages);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  };
  
  socket.onclose = function(e) {
    console.log('WebSocket connection closed:', e);
    
    // Show disconnected status in chat window
    const messagesContainer = chatWindow.querySelector('.group-chat-messages');
    if (messagesContainer) {
      const disconnectionMessage = document.createElement('div');
      disconnectionMessage.className = 'group-message system-message';
      disconnectionMessage.innerHTML = `
        <div class="group-message-content">
          <i class="bi bi-wifi-off"></i> Disconnected - Trying to reconnect...
        </div>
      `;
      messagesContainer.appendChild(disconnectionMessage);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // Attempt to reconnect after a delay if the window is still open
    if (!chatWindow.classList.contains('closed')) {
      setTimeout(() => {
        initGroupChatWebSocket(groupId, userId, chatWindow);
      }, 3000);
    }
  };
  
  socket.onerror = function(e) {
    console.error('WebSocket error:', e);
    
    // Show error in chat
    const messagesContainer = chatWindow.querySelector('.group-chat-messages');
    if (messagesContainer) {
      const errorMessage = document.createElement('div');
      errorMessage.className = 'group-message system-message error';
      errorMessage.innerHTML = `
        <div class="group-message-content">
          Connection error. Please check your network.
        </div>
      `;
      messagesContainer.appendChild(errorMessage);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  };
  
  return socket;
}

function leaveGroupChat(groupId, chatWindow) {
  fetch('/leave-group', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrfToken()
    },
    body: JSON.stringify({ group_id: groupId })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(data => {
    if (data.success) {
      // Remove from groupChats array
      const groupIndex = groupChats.findIndex(g => g.id === groupId);
      if (groupIndex !== -1) {
        groupChats.splice(groupIndex, 1);
      }
      
      // Remove from UI
      const groupItem = document.querySelector(`.group-chat-item[data-group-id="${groupId}"]`);
      if (groupItem) {
        groupItem.remove();
      }
      
      // Close the chat window
      if (chatWindow) {
        // Close WebSocket connection if it exists
        if (chatWindow.socket) {
          chatWindow.socket.close();
        }
        
        chatWindow.remove();
      }
      
      // Remove from active chats
      const activeIndex = activeGroupChats.findIndex(c => c === groupId);
      if (activeIndex !== -1) {
        activeGroupChats.splice(activeIndex, 1);
      }
      
      // Show empty state if no more groups
      const groupChatList = document.getElementById('groupChatList');
      if (groupChatList && groupChats.length === 0) {
        groupChatList.innerHTML = `
          <div class="group-empty-state">
            <i class="bi bi-people"></i>
            <p>No group chats yet. Create a new group chat to get started.</p>
          </div>
        `;
      }
      
      // Show success message
      if (typeof showNotification === 'function') {
        showNotification(data.message, 'success');
      } else {
        alert(data.message);
      }
    } else {
      console.error('Error leaving group chat:', data.error);
      if (typeof showNotification === 'function') {
        showNotification('Failed to leave group: ' + data.error, 'error');
      } else {
        alert('Failed to leave group: ' + data.error);
      }
    }
  })
  .catch(error => {
    console.error('Error:', error);
    if (typeof showNotification === 'function') {
      showNotification('Failed to leave group. Please try again later.', 'error');
    } else {
      alert('Failed to leave group. Please try again later.');
    }
  });
}

/**
 * Position a group chat window
 */
function positionGroupChatWindow(chatWindow) {
  // Set initial position based on active windows
  const activeChats = document.querySelectorAll('.group-chat-window');
  const offset = 20 + (activeChats.length - 1) * 30;
  
  // Adjust position based on screen size
  if (window.innerWidth < 768) {
    chatWindow.style.right = '10px';
    chatWindow.style.bottom = '70px';
  } else {
    chatWindow.style.right = offset + 'px';
    chatWindow.style.bottom = '20px';
  }
}

/**
 * Load messages for a group chat
 */
function loadGroupChatMessages(groupId, chatWindow) {
  const messagesContainer = chatWindow.querySelector('.group-chat-messages');
  const loadingElement = chatWindow.querySelector('.group-chat-loading');
  
  // Show loading state
  if (loadingElement) {
    loadingElement.style.display = 'flex';
  }
  
  // Fetch messages from server
  fetch(`/get-group-messages/${groupId}/`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrfToken()
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(data => {
    // Hide loading indicator
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }
    
    if (data.success) {
      // Display messages
      displayGroupChatHistory(chatWindow, data.messages);
      
      // Update group info if available
      if (data.group) {
        const groupNameElement = chatWindow.querySelector('.group-chat-name');
        if (groupNameElement) {
          groupNameElement.textContent = data.group.name;
        }
        
        const membersCountElement = chatWindow.querySelector('.group-members-count');
        if (membersCountElement) {
          membersCountElement.textContent = `${data.group.members.length} members`;
        }
      }
    } else {
      console.error('Error loading group messages:', data.error);
      messagesContainer.innerHTML = `
        <div class="group-message system-message">
          <div class="group-message-content">
            Failed to load messages. ${data.error || 'Please try again later.'}
          </div>
        </div>
      `;
    }
  })
  .catch(error => {
    console.error('Error:', error);
    
    // Hide loading indicator
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }
    
    messagesContainer.innerHTML = `
      <div class="group-message system-message">
        <div class="group-message-content">
          Failed to load messages. Please try again later.
        </div>
      </div>
    `;
  });
}



/**
 * Update the last message for a group
 */
function updateGroupLastMessage(groupId, message) {
  // Update in memory
  const groupIndex = groupChats.findIndex(g => g.id === groupId);
  if (groupIndex !== -1) {
    groupChats[groupIndex].last_message = message;
    groupChats[groupIndex].last_message_time = new Date().toISOString();
  }
  
  // Update in UI
  const groupItem = document.querySelector(`.group-chat-item[data-group-id="${groupId}"]`);
  if (groupItem) {
    const lastMessage = groupItem.querySelector('.group-chat-item-last-message');
    const lastTime = groupItem.querySelector('.group-chat-item-time');
    
    if (lastMessage) {
      lastMessage.textContent = message;
    }
    
    if (lastTime) {
      lastTime.textContent = 'Just now';
    }
    
    // Move to top of list
    const parentList = groupItem.parentElement;
    if (parentList && parentList.firstChild) {
      parentList.insertBefore(groupItem, parentList.firstChild);
    }
  }
}

/**
 * Update the group chat badge count
 */
function updateGroupChatBadgeCount() {
  const badge = document.getElementById('groupChatBadge');
  if (!badge) return;
  
  // Count unread messages
  let unreadCount = 0;
  groupChats.forEach(group => {
    unreadCount += group.unread_count || 0;
  });
  
  badge.textContent = unreadCount;
  
  if (unreadCount === 0) {
    badge.style.display = 'none';
  } else {
    badge.style.display = 'flex';
  }
}

/**
 * Format time for display
 */
function formatTime(timestamp) {
  if (!timestamp) return 'Just now';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

/**
 * Get CSRF token from cookies
 */
function getCsrfToken() {
  const name = 'csrftoken';
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






















// Fix for group chat profile pictures not displaying properly

/**
 * Add a message to the group chat UI with fixed profile picture handling
 */
function addMessageToGroupChat(chatWindow, message, scrollToBottom = true) {
  const messagesContainer = chatWindow.querySelector('.group-chat-messages');
  if (!messagesContainer) return;
  
  // Create message element
  const messageElement = document.createElement('div');
  
  // Determine if it's an outgoing message (from current user)
  const isCurrentUser = message.sender_id === currentUserId;
  const isSystemMessage = message.sender_id === 'system' || message.type === 'system';
  
  // Set appropriate class
  if (isSystemMessage) {
    messageElement.className = 'group-message system-message';
  } else if (isCurrentUser) {
    messageElement.className = 'group-message outgoing';
  } else {
    messageElement.className = 'group-message incoming';
  }
  
  // Format timestamp
  let timeStr = 'Just now';
  if (message.timestamp) {
    try {
      const timestamp = new Date(message.timestamp);
      timeStr = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      console.error('Error formatting timestamp:', e);
    }
  }
  
  // Ensure profile picture URL is available and valid
  const profilePicture = message.sender_profile_picture || 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
  const senderName = message.sender_name || 'Unknown User';
  
  // Create message content based on message type
  if (isSystemMessage) {
    messageElement.innerHTML = `
      <div class="group-message-content">${message.content}</div>
    `;
  } else {
    // For regular messages
    if (!isCurrentUser) {
      // For incoming messages, include sender info with enhanced profile picture handling
      messageElement.innerHTML = `
        <div class="group-message-sender">
          <img src="${profilePicture}" 
               alt="${senderName}" 
               class="group-message-avatar"
               onerror="this.src='https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'">
          <span class="group-message-name">${senderName}</span>
        </div>
        <div class="group-message-content">${message.content}</div>
        <div class="group-message-time">${timeStr}</div>
      `;
    } else {
      // For outgoing messages
      messageElement.innerHTML = `
        <div class="group-message-content">${message.content}</div>
        <div class="group-message-time">${timeStr}</div>
      `;
    }
  }
  
  // Add to the chat
  messagesContainer.appendChild(messageElement);
  
  // Scroll to bottom if needed
  if (scrollToBottom) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  // Mark as read immediately for outgoing messages
  if (isCurrentUser) {
    // Update group in the list with the latest message
    updateGroupLastMessage(message.group_id || chatWindow.getAttribute('data-group-id'), message.content);
  }
}

/**
 * Display message history in the chat window with fixed profile pictures
 */
function displayGroupChatHistory(chatWindow, messages) {
  const messagesContainer = chatWindow.querySelector('.group-chat-messages');
  if (!messagesContainer) return;
  
  // Clear existing messages
  messagesContainer.innerHTML = '';
  
  if (!messages || messages.length === 0) {
    // Add welcome message if no messages
    const welcomeMessage = document.createElement('div');
    welcomeMessage.className = 'group-message system-message';
    welcomeMessage.innerHTML = `
      <div class="group-message-content">
        Group chat created. Your messages are private to the group members.
      </div>
    `;
    messagesContainer.appendChild(welcomeMessage);
  } else {
    // Add all messages with enhanced profile picture handling
    messages.forEach(message => {
      // Ensure sender data is present
      if (!message.sender_name && message.sender_id) {
        // Try to find sender info from the group members if available
        const group = window.groupChats.find(g => g.id === chatWindow.getAttribute('data-group-id'));
        if (group && group.members) {
          const sender = group.members.find(m => m.id === message.sender_id);
          if (sender) {
            message.sender_name = sender.name;
            message.sender_profile_picture = sender.profile_picture;
          }
        }
      }
      
      addMessageToGroupChat(chatWindow, message, false);
    });
  }
  
  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Send a message to a group chat with enhanced profile handling
 */
function sendGroupMessage(groupId, message, chatWindow) {
  message = message.trim();
  if (!message) return;
  
  const messageInput = chatWindow.querySelector('.group-chat-input');
  
  // Clear input immediately for better UX
  if (messageInput) {
    messageInput.value = '';
  }
  
  // If WebSocket is connected, send through that
  if (chatWindow.socket && chatWindow.socket.readyState === WebSocket.OPEN) {
    chatWindow.socket.send(JSON.stringify({
      type: 'message',
      message: message
    }));
    return;
  }
  
  // Get current user info for local message display
  let currentUserName = 'You';
  let currentUserProfilePic = '';
  
  // Try to get current user's profile picture from the page if available
  const profileImgElement = document.querySelector('.user-profile-image, .profile-image, .avatar-image');
  if (profileImgElement) {
    currentUserProfilePic = profileImgElement.src;
  }
  
  // If WebSocket is not connected, use REST API as fallback
  fetch('/send-group-message/', {
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
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(data => {
    if (data.success) {
      // Create a message object for local display with profile picture
      const messageObj = {
        sender_id: currentUserId,
        sender_name: currentUserName,
        sender_profile_picture: currentUserProfilePic || data.sender_profile_picture,
        content: message,
        timestamp: new Date().toISOString(),
        message_id: data.message_id
      };
      
      // Add to the chat UI
      addMessageToGroupChat(chatWindow, messageObj);
      
      // Update the group in the list with the latest message
      updateGroupLastMessage(groupId, message);
    } else {
      console.error('Error sending message:', data.error);
      
      // Show error in chat
      const messagesContainer = chatWindow.querySelector('.group-chat-messages');
      if (messagesContainer) {
        const errorMessage = document.createElement('div');
        errorMessage.className = 'group-message system-message error';
        errorMessage.innerHTML = `
          <div class="group-message-content">
            Failed to send message. ${data.error || 'Please try again.'}
          </div>
        `;
        messagesContainer.appendChild(errorMessage);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }
  })
  .catch(error => {
    console.error('Error:', error);
    
    // Show error in chat
    const messagesContainer = chatWindow.querySelector('.group-chat-messages');
    if (messagesContainer) {
      const errorMessage = document.createElement('div');
      errorMessage.className = 'group-message system-message error';
      errorMessage.innerHTML = `
        <div class="group-message-content">
          Failed to send message. Please try again later.
        </div>
      `;
      messagesContainer.appendChild(errorMessage);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  });
}
