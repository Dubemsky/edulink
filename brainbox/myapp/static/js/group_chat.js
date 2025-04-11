// Standalone Group Chat JavaScript

// Global variables
let selectedMembers = [];
let activeGroupChats = [];
let groupChats = [];

document.addEventListener('DOMContentLoaded', function() {
  // Initialize group chat component
  initGroupChatComponent();
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
 * Load group chats from server (or mock data for demo)
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
  
  // In a real app, you would fetch from the server here
  // For demo, we'll use mock data or create an empty state
  setTimeout(() => {
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
    
    // Update badge count
    updateGroupChatBadgeCount();
  }, 1000);
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
  
  // In a real app, you would fetch from the server here
  // For demo, we'll use mock data
  setTimeout(() => {
    // Display mock users
    displayAvailableMembers(getMockUsers());
  }, 1000);
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
    
    // Simulate API call
    setTimeout(() => {
      // Create group data
      const groupData = {
        id: 'group_' + Date.now(),
        name: groupName,
        members: selectedMembers.map(member => member.id),
        membersCount: selectedMembers.length,
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
      
      // Reset button
      createBtn.disabled = false;
      createBtn.innerHTML = originalText;
      
      // Show success message (if notification system is available)
      if (typeof showNotification === 'function') {
        showNotification('Group chat created successfully!', 'success');
      } else {
        console.log('Group chat created successfully!');
      }
      
      // Open the group chat window
      openGroupChatWindow(groupData);
    }, 1000);
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
  membersCount.textContent = group.membersCount || 0;
  
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
    return;
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
  membersCountElement.textContent = `${group.membersCount} members`;
  
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
      // Show group info (for demo, just console log)
      console.log('Group info:', group);
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
  
  // Load messages (mock for demo)
  loadGroupChatMessages(group.id, chatWindow);
  
  // Focus the input
  if (messageInput) {
    setTimeout(() => {
      messageInput.focus();
    }, 100);
  }
  
  return chatWindow;
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
  
  // For demo, simulate loading messages
  setTimeout(() => {
    // Hide loading indicator
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }
    
    // Add welcome message
    const welcomeMessage = document.createElement('div');
    welcomeMessage.className = 'group-message system-message';
    welcomeMessage.innerHTML = `
      <div class="group-message-content">
        Group chat created. Your messages are private to the group members.
      </div>
    `;
    messagesContainer.appendChild(welcomeMessage);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }, 1000);
}

/**
 * Send a message to a group chat
 */
function sendGroupMessage(groupId, message, chatWindow) {
  message = message.trim();
  if (!message) return;
  
  const messagesContainer = chatWindow.querySelector('.group-chat-messages');
  const messageInput = chatWindow.querySelector('.group-chat-input');
  
  // Create a new message element
  const messageElement = document.createElement('div');
  messageElement.className = 'group-message outgoing';
  
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  messageElement.innerHTML = `
    <div class="group-message-content">${message}</div>
    <div class="group-message-time">${timeStr}</div>
  `;
  
  // Add to the chat
  messagesContainer.appendChild(messageElement);
  
  // Clear input
  if (messageInput) {
    messageInput.value = '';
  }
  
  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  // Update the group in the list
  updateGroupLastMessage(groupId, message);
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
 * Get mock users for demonstration
 */
function getMockUsers() {
  return [
    {
      id: 'user1',
      name: 'Jane Smith',
      role: 'Student',
      profile_picture: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'
    },
    {
      id: 'user2',
      name: 'Mark Johnson',
      role: 'Teacher',
      profile_picture: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'
    },
    {
      id: 'user3',
      name: 'Sarah Williams',
      role: 'Student',
      profile_picture: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'
    },
    {
      id: 'user4',
      name: 'Michael Brown',
      role: 'Student',
      profile_picture: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'
    },
    {
      id: 'user5',
      name: 'Emily Davis',
      role: 'Teacher',
      profile_picture: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'
    }
  ];
}