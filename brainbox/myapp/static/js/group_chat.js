// group_chat.js - Updated to match your HTML structure

// Global variables
let selectedMembers = [];

document.addEventListener('DOMContentLoaded', function() {
  // Initialize group chat functionality
  initializeGroupChat();
  
  // Set up event listeners for the create group chat button
  setupCreateGroupChatButton();
});

/**
 * Initialize the group chat tab and functionality
 */
function initializeGroupChat() {
  // Load group chats when the group chat tab is selected
  const groupChatsTab = document.getElementById('dmGroupChatsTab');
  if (groupChatsTab) {
    groupChatsTab.addEventListener('click', function() {
      loadGroupChats();
    });
  }
}

/**
 * Load existing group chats from the server
 */
function loadGroupChats() {
  const groupChatsList = document.getElementById('dmGroupChatsList');
  if (!groupChatsList) return;
  
  // Show loading indicator
  groupChatsList.innerHTML = `
    <div class="dm-loading-chats">
      <div class="dm-spinner"></div>
      <p>Loading group chats...</p>
    </div>
  `;
  
  // Temporarily show empty state since we don't have backend implementation yet
  setTimeout(() => {
    groupChatsList.innerHTML = `
      <div class="dm-empty-state">
        <i class="bi bi-people"></i>
        <p>No group chats yet. Create a new group chat to get started.</p>
      </div>
    `;
  }, 500);
}

/**
 * Set up event handlers for the create group chat button
 */
function setupCreateGroupChatButton() {
  // Add event listener to the "Create Group Chat" button
  const createGroupBtn = document.getElementById('dmCreateGroupBtn');
  if (createGroupBtn) {
    createGroupBtn.addEventListener('click', showCreateGroupChatModal);
  }
}

/**
 * Show the create group chat modal
 */
function showCreateGroupChatModal() {
  // Get references to modal elements
  const createGroupModal = document.getElementById('dmCreateGroupModal');
  const modalOverlay = document.getElementById('dmModalOverlay');
  
  if (!createGroupModal || !modalOverlay) {
    console.error('Create group chat modal elements not found');
    return;
  }
  
  // Reset the form
  resetGroupChatForm();
  
  // Show the modal and overlay
  createGroupModal.classList.add('show');
  modalOverlay.classList.add('show');
  
  // Focus the group name input
  const groupNameInput = document.getElementById('dmGroupNameInput');
  if (groupNameInput) {
    groupNameInput.focus();
  }
  
  // Load connected users to select from
  loadConnectedUsers();
  
  // Set up event listeners for modal buttons
  setupGroupChatModalHandlers();
}

/**
 * Reset the group chat creation form
 */
function resetGroupChatForm() {
  // Clear group name
  const groupNameInput = document.getElementById('dmGroupNameInput');
  if (groupNameInput) {
    groupNameInput.value = '';
  }
  
  // Clear selected members
  selectedMembers = [];
  const selectedMembersContainer = document.getElementById('dmSelectedMembers');
  if (selectedMembersContainer) {
    selectedMembersContainer.innerHTML = '<div class="dm-empty-selection">No members selected</div>';
  }
  
  // Update count
  const selectedCount = document.getElementById('dmSelectedCount');
  if (selectedCount) {
    selectedCount.textContent = '0';
  }
  
  // Reset create button state
  updateCreateGroupButtonState();
}

/**
 * Set up event handlers for the create group chat modal
 */
function setupGroupChatModalHandlers() {
  // Close button handler
  const closeBtn = document.getElementById('dmCloseGroupModalBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', hideCreateGroupChatModal);
  }
  
  // Cancel button handler
  const cancelBtn = document.getElementById('dmCancelGroupBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', hideCreateGroupChatModal);
  }
  
  // Create button handler
  const createBtn = document.getElementById('dmCreateGroupSubmitBtn');
  if (createBtn) {
    createBtn.addEventListener('click', createGroupChat);
  }
  
  // Search input handler
  const searchInput = document.getElementById('dmMembersSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      filterAvailableMembers(this.value);
    });
  }
  
  // Clicking outside the modal should close it
  const modalOverlay = document.getElementById('dmModalOverlay');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', function(e) {
      // Only close if clicking directly on overlay (not on modal)
      if (e.target === modalOverlay) {
        hideCreateGroupChatModal();
      }
    });
  }
  
  // Prevent closing when clicking on the modal itself
  const createGroupModal = document.getElementById('dmCreateGroupModal');
  if (createGroupModal) {
    createGroupModal.addEventListener('click', function(e) {
      e.stopPropagation();
    });
  }
}

/**
 * Filter available members based on search input
 */
function filterAvailableMembers(searchTerm) {
  const memberItems = document.querySelectorAll('#dmAvailableMembers .dm-group-member-item');
  searchTerm = searchTerm.toLowerCase();
  
  memberItems.forEach(item => {
    const memberName = item.querySelector('.dm-member-name').textContent.toLowerCase();
    const memberRole = item.querySelector('.dm-member-role').textContent.toLowerCase();
    
    if (memberName.includes(searchTerm) || memberRole.includes(searchTerm)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}

/**
 * Hide the create group chat modal
 */
function hideCreateGroupChatModal() {
  // Get references to modal elements
  const createGroupModal = document.getElementById('dmCreateGroupModal');
  const modalOverlay = document.getElementById('dmModalOverlay');
  
  if (!createGroupModal || !modalOverlay) return;
  
  // Hide the modal and overlay
  createGroupModal.classList.remove('show');
  modalOverlay.classList.remove('show');
  
  // Reset selected members
  selectedMembers = [];
}

/**
 * Load connected users who can be added to the group chat
 */
function loadConnectedUsers() {
  const availableMembers = document.getElementById('dmAvailableMembers');
  if (!availableMembers) return;
  
  // Show loading indicator
  availableMembers.innerHTML = `
    <div class="dm-loading">
      <div class="dm-spinner"></div>
      <p>Loading connections...</p>
    </div>
  `;
  
  // Fetch mutually connected users from server
  fetch('/get_mutual_connections/')
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.success && Array.isArray(data.connections)) {
        displayConnectedUsers(data.connections);
      } else {
        // If API is not ready, use mock data for demonstration
        displayConnectedUsers(getMockConnectedUsers());
      }
    })
    .catch(error => {
      console.error('Error fetching connected users:', error);
      // Use mock data as fallback
      displayConnectedUsers(getMockConnectedUsers());
    });
}

/**
 * Display the list of connected users who can be added to the group
 * 
 * @param {Array} users - List of connected users
 */
function displayConnectedUsers(users) {
  const availableMembers = document.getElementById('dmAvailableMembers');
  if (!availableMembers) return;
  
  if (users.length === 0) {
    availableMembers.innerHTML = `
      <div class="dm-empty-connections">
        <i class="bi bi-people"></i>
        <p>You need to connect with users before creating a group chat.</p>
      </div>
    `;
    return;
  }
  
  // Clear the list
  availableMembers.innerHTML = '';
  
  // Get the template
  const template = document.getElementById('dmGroupMemberItemTemplate');
  if (!template) {
    console.error('Group member item template not found');
    return;
  }
  
  // Create a member item for each user
  users.forEach(user => {
    const clone = document.importNode(template.content, true);
    const memberItem = clone.querySelector('.dm-group-member-item');
    
    // Set user data
    memberItem.setAttribute('data-user-id', user.id);
    
    const memberImg = memberItem.querySelector('.dm-member-img');
    memberImg.src = user.profile_picture || 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
    memberImg.alt = user.name;
    
    const memberName = memberItem.querySelector('.dm-member-name');
    memberName.textContent = user.name;
    
    const memberRole = memberItem.querySelector('.dm-member-role');
    memberRole.textContent = user.role || 'User';
    
    // Configure buttons
    const addBtn = memberItem.querySelector('.dm-add-member-btn');
    const removeBtn = memberItem.querySelector('.dm-remove-member-btn');
    
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
 * Add a user to the selected members list
 * 
 * @param {Object} user - User data
 */
function addMemberToSelection(user) {
  // Check if already selected
  if (selectedMembers.some(member => member.id === user.id)) {
    return;
  }
  
  // Add to the selected members array
  selectedMembers.push(user);
  
  // Remove empty selection message if present
  const emptySelection = document.querySelector('#dmSelectedMembers .dm-empty-selection');
  if (emptySelection) {
    emptySelection.remove();
  }
  
  // Add to the selected members UI
  const selectedMembersContainer = document.getElementById('dmSelectedMembers');
  if (!selectedMembersContainer) return;
  
  // Create a member badge
  const memberBadge = document.createElement('div');
  memberBadge.className = 'dm-selected-member-badge';
  memberBadge.setAttribute('data-user-id', user.id);
  
  memberBadge.innerHTML = `
    <img src="${user.profile_picture || 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'}" 
         alt="${user.name}" class="dm-selected-member-img">
    <span class="dm-selected-member-name">${user.name}</span>
    <button class="dm-remove-selected-btn" aria-label="Remove ${user.name}">
      <i class="bi bi-x"></i>
    </button>
  `;
  
  // Add click handler to remove button
  const removeButton = memberBadge.querySelector('.dm-remove-selected-btn');
  removeButton.addEventListener('click', function(e) {
    e.stopPropagation();
    removeMemberFromSelection(user.id);
    
    // Update the add/remove buttons in the available members list
    const memberItem = document.querySelector(`.dm-group-member-item[data-user-id="${user.id}"]`);
    if (memberItem) {
      const addBtn = memberItem.querySelector('.dm-add-member-btn');
      const removeBtn = memberItem.querySelector('.dm-remove-member-btn');
      removeBtn.style.display = 'none';
      addBtn.style.display = 'flex';
    }
  });
  
  selectedMembersContainer.appendChild(memberBadge);
  
  // Update selected count
  const selectedCount = document.getElementById('dmSelectedCount');
  if (selectedCount) {
    selectedCount.textContent = selectedMembers.length;
  }
  
  // Update create button state
  updateCreateGroupButtonState();
}

/**
 * Remove a user from the selected members list
 * 
 * @param {string} userId - User ID to remove
 */
function removeMemberFromSelection(userId) {
  // Remove from the selected members array
  selectedMembers = selectedMembers.filter(member => member.id !== userId);
  
  // Remove from the selected members UI
  const memberBadge = document.querySelector(`.dm-selected-member-badge[data-user-id="${userId}"]`);
  if (memberBadge) {
    memberBadge.remove();
  }
  
  // Add empty selection message if no members left
  const selectedMembersContainer = document.getElementById('dmSelectedMembers');
  if (selectedMembersContainer && selectedMembers.length === 0) {
    selectedMembersContainer.innerHTML = '<div class="dm-empty-selection">No members selected</div>';
  }
  
  // Update selected count
  const selectedCount = document.getElementById('dmSelectedCount');
  if (selectedCount) {
    selectedCount.textContent = selectedMembers.length;
  }
  
  // Update create button state
  updateCreateGroupButtonState();
}

/**
 * Update the state of the create group button based on selections
 */
function updateCreateGroupButtonState() {
  const createBtn = document.getElementById('dmCreateGroupSubmitBtn');
  if (!createBtn) return;
  
  const groupNameInput = document.getElementById('dmGroupNameInput');
  const hasName = groupNameInput && groupNameInput.value.trim() !== '';
  const hasMembers = selectedMembers.length >= 2; // Require at least 2 other people for a group
  
  // Enable the button if both conditions are met
  createBtn.disabled = !(hasName && hasMembers);
}

/**
 * Create a new group chat with the selected members
 */
function createGroupChat() {
  const groupNameInput = document.getElementById('dmGroupNameInput');
  if (!groupNameInput) return;
  
  const groupName = groupNameInput.value.trim();
  
  if (groupName === '' || selectedMembers.length < 2) {
    // Validation - need a name and at least 2 other people
    return;
  }
  
  // Here we would normally send a request to the server to create the group
  // For now, we'll just simulate success and add a placeholder group
  
  // Show loading state on button
  const createBtn = document.getElementById('dmCreateGroupSubmitBtn');
  if (createBtn) {
    const originalText = createBtn.textContent;
    createBtn.disabled = true;
    createBtn.innerHTML = `<div class="dm-spinner dm-spinner-sm"></div> Creating...`;
    
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
      
      // Add group to UI
      addGroupToList(groupData);
      
      // Hide the modal
      hideCreateGroupChatModal();
      
      // Switch to the group chat tab
      const groupChatsTab = document.getElementById('dmGroupChatsTab');
      if (groupChatsTab) {
        groupChatsTab.click();
      }
      
      // Reset button
      createBtn.disabled = false;
      createBtn.innerHTML = originalText;
      
      // Show success message
      showNotification('Group chat created successfully!', 'success');
    }, 1000);
  }
}

/**
 * Add a group chat to the groups list
 * 
 * @param {Object} group - Group chat data
 */
function addGroupToList(group) {
  const groupChatsList = document.getElementById('dmGroupChatsList');
  if (!groupChatsList) return;
  
  // Remove empty state if it exists
  const emptyState = groupChatsList.querySelector('.dm-empty-state');
  if (emptyState) {
    emptyState.remove();
  }
  
  // Get the template
  const template = document.getElementById('dmGroupChatItemTemplate');
  if (!template) {
    console.error('Group chat item template not found');
    return;
  }
  
  // Create group item
  const clone = document.importNode(template.content, true);
  const groupItem = clone.querySelector('.dm-group-chat-item');
  
  // Set group data
  groupItem.setAttribute('data-group-id', group.id);
  
  const groupName = groupItem.querySelector('.dm-chat-item-name');
  groupName.textContent = group.name;
  
  const lastMessage = groupItem.querySelector('.dm-chat-item-last-message');
  lastMessage.textContent = group.last_message || 'Group created';
  
  const membersCount = groupItem.querySelector('.dm-members-count');
  membersCount.textContent = group.membersCount || 0;
  
  const lastTime = groupItem.querySelector('.dm-chat-item-time');
  lastTime.textContent = formatMessageTime(group.last_message_time) || 'Just now';
  
  // Add unread badge if necessary
  if (group.unread_count && group.unread_count > 0) {
    const badge = groupItem.querySelector('.dm-chat-item-badge');
    if (badge) {
      badge.textContent = group.unread_count;
      badge.style.display = 'flex';
    }
  }
  
  // Add click handler to open the group chat
  groupItem.addEventListener('click', function() {
    openGroupChat(group);
  });
  
  // Add to the list (at the top)
  if (groupChatsList.firstChild) {
    groupChatsList.insertBefore(groupItem, groupChatsList.firstChild);
  } else {
    groupChatsList.appendChild(groupItem);
  }
  
  // Update the group chats badge count
  updateGroupChatsBadgeCount();
}

/**
 * Update the group chats badge count
 */
function updateGroupChatsBadgeCount() {
  const groupChatsList = document.getElementById('dmGroupChatsList');
  const badge = document.getElementById('dmGroupChatsBadge');
  
  if (groupChatsList && badge) {
    const count = groupChatsList.querySelectorAll('.dm-group-chat-item').length;
    badge.textContent = count;
  }
}

/**
 * Open a group chat window
 * 
 * @param {Object} group - Group chat data
 */
function openGroupChat(group) {
  // Get the chat windows container
  const chatWindowsContainer = document.getElementById('dmChatWindowsContainer');
  
  if (!chatWindowsContainer) {
    console.error('Chat windows container not found');
    return;
  }
  
  // Check if a chat with this group already exists
  const chatId = `group-${group.id}`;
  let chatWindow = document.querySelector(`.dm-group-chat-window[data-chat-id="${chatId}"]`);
  
  // If it doesn't exist, create it
  if (!chatWindow) {
    // Get template
    const template = document.getElementById('dmGroupChatWindowTemplate');
    if (!template) {
      console.error('Group chat window template not found');
      return;
    }
    
    const clone = document.importNode(template.content, true);
    
    // Update the template with group data
    chatWindow = clone.querySelector('.dm-group-chat-window');
    chatWindow.setAttribute('data-group-id', group.id);
    chatWindow.setAttribute('data-chat-id', chatId);
    
    const groupName = chatWindow.querySelector('.dm-chat-group-name');
    const membersCount = chatWindow.querySelector('.dm-chat-members-count');
    
    groupName.textContent = group.name;
    membersCount.textContent = `${group.membersCount || 0} members`;
    
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
    
    // Set up group info button
    const infoBtn = chatWindow.querySelector('.dm-group-info-btn');
    if (infoBtn) {
      infoBtn.addEventListener('click', function() {
        showGroupInfo(group);
      });
    }
    
    // Add to container
    chatWindowsContainer.appendChild(chatWindow);
    
    // Handle send button clicks
    const sendButton = chatWindow.querySelector('.dm-send-message-btn');
    const chatInput = chatWindow.querySelector('.dm-chat-input');
    
    sendButton.addEventListener('click', function() {
      const messageText = chatInput.value.trim();
      if (messageText) {
        sendGroupMessage(group.id, messageText, chatWindow);
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
    
    // Load messages (mock for now)
    loadGroupChatMessages(group.id, chatWindow);
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
 * Show group info modal
 * 
 * @param {Object} group - Group chat data
 */
function showGroupInfo(group) {
  // This would show a modal with group details and members
  showNotification(`Group: ${group.name} with ${group.membersCount} members`, 'info');
  
  // In a real implementation, you would create a modal to show more details
  // and options like adding new members or leaving the group
}

/**
 * Load messages for a group chat
 * 
 * @param {string} groupId - Group ID
 * @param {HTMLElement} chatWindow - Chat window element
 */
function loadGroupChatMessages(groupId, chatWindow) {
  const messagesContainer = chatWindow.querySelector('.dm-chat-messages');
  const loadingElement = chatWindow.querySelector('.dm-chat-loading');
  
  // Show loading state
  if (loadingElement) {
    loadingElement.style.display = 'flex';
  }
  
  // For now, we'll simulate loading messages
  setTimeout(() => {
    // Hide loading indicator
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }
    
    // Add welcome message
    const welcomeMessage = document.createElement('div');
    welcomeMessage.className = 'dm-message system-message';
    welcomeMessage.innerHTML = `
      <div class="dm-message-content">
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
 * 
 * @param {string} groupId - Group ID
 * @param {string} message - Message content
 * @param {HTMLElement} chatWindow - Chat window element
 */
function sendGroupMessage(groupId, message, chatWindow) {
  // In a real implementation, this would send the message to the server
  // For now, we'll just add it to the UI
  
  const messagesContainer = chatWindow.querySelector('.dm-chat-messages');
  
  // Get the message template
  const template = document.getElementById('dmMessageTemplate');
  if (!template) {
    console.error('Message template not found');
    return;
  }
  
  const clone = document.importNode(template.content, true);
  
  // Update the message
  const messageElement = clone.querySelector('.dm-message');
  const messageContent = clone.querySelector('.dm-message-content');
  const messageTime = clone.querySelector('.dm-message-time');
  
  messageElement.classList.add('outgoing');
  messageContent.textContent = message;
  
  // Format time
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  messageTime.textContent = timeStr;
  
  // Add to the container
  messagesContainer.appendChild(clone);
  
  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  // Update the group in the list with the new message
  updateGroupLastMessage(groupId, message);
}

/**
 * Update the last message for a group in the list
 * 
 * @param {string} groupId - Group ID
 * @param {string} message - Message content
 */
function updateGroupLastMessage(groupId, message) {
  const groupItem = document.querySelector(`.dm-group-chat-item[data-group-id="${groupId}"]`);
  if (groupItem) {
    const lastMessage = groupItem.querySelector('.dm-chat-item-last-message');
    const lastTime = groupItem.querySelector('.dm-chat-item-time');
    
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
 * Get mock connected users for demonstration
 * 
 * @returns {Array} Array of mock user objects
 */
function getMockConnectedUsers() {
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

/**
 * Show a notification to the user
 * 
 * @param {string} message - The message to display
 * @param {string} type - The type of notification ('success', 'error', 'info')
 */
function showNotification(message, type = 'info') {
  // Check if the notification container exists
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

// Make functions available globally
window.groupChat = {
  showCreateGroupChatModal,
  hideCreateGroupChatModal,
  createGroupChat,
  addMemberToSelection,
  removeMemberFromSelection,
  openGroupChat
};

// Initialize group chat when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Initialize group chat functionality
  initializeGroupChat();
  
  // Setup create group chat button
  setupCreateGroupChatButton();
  
  // Setup group name input validation
  const groupNameInput = document.getElementById('dmGroupNameInput');
  if (groupNameInput) {
    groupNameInput.addEventListener('input', updateCreateGroupButtonState);
  }
});

// Add CSS fixes for the modal
document.addEventListener('DOMContentLoaded', function() {
  // Check if we already have a style element for our fixes
  let styleElement = document.getElementById('group-chat-modal-fixes');
  
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = 'group-chat-modal-fixes';
    styleElement.textContent = `
      /* Modal overlay fixes */
      .dm-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 9998;
        display: none;
      }
      
      .dm-modal-overlay.show {
        display: block;
      }
      
      /* Create group modal fixes */
      .dm-create-group-modal {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 90%;
        max-width: 550px;
        max-height: 80vh;
        background-color: white;
        border-radius: 10px;
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
        z-index: 9999;
        display: none;
        flex-direction: column;
        overflow: hidden;
      }
      
      .dm-create-group-modal.show {
        display: flex;
      }
      
      /* Selected members container */
      .dm-selected-members-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        min-height: 50px;
      }
      
      .dm-selected-member-badge {
        display: flex;
        align-items: center;
        background-color: #f0f7ff;
        border-radius: 20px;
        padding: 5px 10px 5px 5px;
        gap: 8px;
      }
      
      .dm-selected-member-img {
        width: 24px;
        height: 24px;
        border-radius: 50%;
      }
      
      .dm-selected-member-name {
        font-size: 0.9rem;
      }
      
      .dm-remove-selected-btn {
        background: none;
        border: none;
        color: #6c757d;
        cursor: pointer;
        font-size: 0.9rem;
        padding: 0;
        margin-left: 5px;
      }
    `;
    
    document.head.appendChild(styleElement);
  }
});