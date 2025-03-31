// Group Chat Functionality
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const groupChatsTab = document.getElementById('dmGroupChatsTab');
    const groupChatsContent = document.getElementById('dmGroupChats');
    const createGroupBtn = document.getElementById('dmCreateGroupBtn');
    const createGroupModal = document.getElementById('dmCreateGroupModal');
    let closeGroupModalBtn = document.getElementById('dmCloseGroupModalBtn');
    let cancelGroupBtn = document.getElementById('dmCancelGroupBtn');
    const createGroupSubmitBtn = document.getElementById('dmCreateGroupSubmitBtn');
    const groupNameInput = document.getElementById('dmGroupNameInput');
    const membersSearchInput = document.getElementById('dmMembersSearchInput');
    const availableMembersContainer = document.getElementById('dmAvailableMembers');
    const selectedMembersContainer = document.getElementById('dmSelectedMembers');
    const selectedCountElement = document.getElementById('dmSelectedCount');
    const groupChatsList = document.getElementById('dmGroupChatsList');
    const modalOverlay = document.getElementById('dmModalOverlay');
    
    console.log("Initializing group chat functionality...");
    
    // Check if elements exist
    if (!groupChatsTab || !createGroupBtn) {
        console.error("Group chat DOM elements not found. Make sure the HTML is properly loaded.");
        return;
    }
    
    // Templates
    const groupMemberItemTemplate = document.getElementById('dmGroupMemberItemTemplate');
    const groupChatItemTemplate = document.getElementById('dmGroupChatItemTemplate');
    const groupChatWindowTemplate = document.getElementById('dmGroupChatWindowTemplate');
    
    if (!groupMemberItemTemplate || !groupChatItemTemplate || !groupChatWindowTemplate) {
        console.error("Group chat templates not found. Make sure all templates are properly defined in the HTML.");
        console.log("Missing templates:", 
            !groupMemberItemTemplate ? "groupMemberItemTemplate" : "", 
            !groupChatItemTemplate ? "groupChatItemTemplate" : "", 
            !groupChatWindowTemplate ? "groupChatWindowTemplate" : "");
        return;
    }
    
    // State
    let connectedUsers = [];
    let selectedMembers = [];
    let userGroups = [];
    let currentUserId = window.currentUserId || '';
    
    console.log("Current user ID:", currentUserId);
    
    // Initialize - integrate with existing tab switching functionality
    initializeGroupChatTab();
    
    // IMPORTANT: Fix the modal behavior - remove the old event listeners
    // and set up more reliable direct style manipulation
    
    // Remove existing click handlers from the overlay
    if (modalOverlay) {
        // Instead of replacing the overlay, just add a new click handler
        modalOverlay.addEventListener('click', function(event) {
            // Only close if clicked directly on overlay
            if (event.target === modalOverlay) {
                console.log("Overlay clicked directly, closing modal");
                createGroupModal.style.display = 'none';
                modalOverlay.style.display = 'none';
            }
        });
    }
    
    // Don't replace the button, just update its event handler
    if (createGroupBtn) {
        createGroupBtn.removeEventListener('click', openCreateGroupModal);
        createGroupBtn.addEventListener('click', function(event) {
            event.stopPropagation();
            console.log("Create group button clicked");
            createGroupModal.style.display = 'flex';
            if (modalOverlay) {
                modalOverlay.style.display = 'block';
            }
            groupNameInput.value = '';
            selectedMembers = [];
            updateSelectedMembersUI();
            loadConnectedUsers();
        });
    }
    
    // Replace the close button event handler
    const newCloseBtn = closeGroupModalBtn.cloneNode(true);
    closeGroupModalBtn.parentNode.replaceChild(newCloseBtn, closeGroupModalBtn);
    closeGroupModalBtn = newCloseBtn;
    
    closeGroupModalBtn.addEventListener('click', function(event) {
        event.stopPropagation();
        console.log("Close button clicked");
        createGroupModal.style.display = 'none';
        if (modalOverlay) {
            modalOverlay.style.display = 'none';
        }
    });
    
    // Replace the cancel button event handler
    const newCancelBtn = cancelGroupBtn.cloneNode(true);
    cancelGroupBtn.parentNode.replaceChild(newCancelBtn, cancelGroupBtn);
    cancelGroupBtn = newCancelBtn;
    
    cancelGroupBtn.addEventListener('click', function(event) {
        event.stopPropagation();
        console.log("Cancel button clicked");
        createGroupModal.style.display = 'none';
        if (modalOverlay) {
            modalOverlay.style.display = 'none';
        }
    });
    
    // Add overlay click handler
    if (modalOverlay) {
        modalOverlay.addEventListener('click', function(event) {
            if (event.target === modalOverlay) {
                console.log("Overlay clicked directly, closing modal");
                createGroupModal.style.display = 'none';
                modalOverlay.style.display = 'none';
            }
        });
    }
    
    // Prevent clicks on the modal from closing it
    createGroupModal.addEventListener('click', function(event) {
        event.stopPropagation();
    });
    
    // Search functionality
    membersSearchInput.addEventListener('input', filterAvailableMembers);
    
    // Create group
    createGroupSubmitBtn.addEventListener('click', createNewGroupChat);
    
    // Functions
    function initializeGroupChatTab() {
        // The tab switching is likely handled by existing code,
        // but we need to ensure our tab loads data when clicked
        groupChatsTab.addEventListener('click', function() {
            console.log("Group chats tab clicked, loading group chats...");
            loadGroupChats();
        });
    }
    
    // Define these functions for backward compatibility with older code
    function openCreateGroupModal() {
        console.log("openCreateGroupModal called (legacy function)");
        createGroupBtn.click(); 
    }
    
    function closeCreateGroupModal() {
        console.log("closeCreateGroupModal called (legacy function)");
        createGroupModal.style.display = 'none';
        if (modalOverlay) {
            modalOverlay.style.display = 'none';
        }
    }
    
    function loadConnectedUsers() {
        console.log("Loading connected users...");
        // Show loading state
        availableMembersContainer.innerHTML = '<div class="dm-loading"><div class="dm-spinner"></div><p>Loading connections...</p></div>';
        
        // Fetch connected users from backend
        fetch('/get-connected-users/')
            .then(response => {
                console.log("Connected users response received:", response.status);
                return response.json();
            })
            .then(data => {
                console.log("Connected users data:", data);
                if (data.success) {
                    connectedUsers = data.connections || [];
                    console.log(`Found ${connectedUsers.length} connected users`);
                    renderAvailableMembers(connectedUsers);
                } else {
                    console.error('Error in connected users response:', data.error);
                    availableMembersContainer.innerHTML = '<div class="dm-error-message">Failed to load connections</div>';
                }
            })
            .catch(error => {
                console.error('Error fetching connected users:', error);
                availableMembersContainer.innerHTML = '<div class="dm-error-message">Failed to load connections</div>';
            });
    }
    
    function renderAvailableMembers(users) {
        console.log(`Rendering ${users.length} available members...`);
        availableMembersContainer.innerHTML = '';
        
        if (users.length === 0) {
            console.log("No connected users found");
            availableMembersContainer.innerHTML = '<div class="dm-empty-message">No connections found</div>';
            return;
        }
        
        users.forEach(user => {
            const memberElement = createMemberElement(user);
            availableMembersContainer.appendChild(memberElement);
        });
        console.log("Finished rendering available members");
    }
    
    function createMemberElement(user) {
        console.log(`Creating member element for ${user.name} (${user.user_id})...`);
        const template = groupMemberItemTemplate.content.cloneNode(true);
        const memberItem = template.querySelector('.dm-group-member-item');
        
        memberItem.setAttribute('data-user-id', user.user_id);
        
        const memberImg = memberItem.querySelector('.dm-member-img');
        memberImg.src = user.profile_picture || '/static/img/default-profile.png';
        memberImg.alt = user.name;
        
        memberItem.querySelector('.dm-member-name').textContent = user.name;
        memberItem.querySelector('.dm-member-role').textContent = user.role || '';
        
        const addBtn = memberItem.querySelector('.dm-add-member-btn');
        const removeBtn = memberItem.querySelector('.dm-remove-member-btn');
        
        // Check if user is already selected
        const isSelected = selectedMembers.some(member => member.user_id === user.user_id);
        if (isSelected) {
            addBtn.style.display = 'none';
            removeBtn.style.display = 'flex';
        } else {
            addBtn.style.display = 'flex';
            removeBtn.style.display = 'none';
        }
        
        // Add event listeners
        addBtn.addEventListener('click', function(event) {
            event.stopPropagation(); // Prevent event from bubbling up
            console.log(`Add button clicked for ${user.name}`);
            if (!selectedMembers.some(member => member.user_id === user.user_id)) {
                selectedMembers.push(user);
                updateSelectedMembersUI();
                addBtn.style.display = 'none';
                removeBtn.style.display = 'flex';
                console.log(`${user.name} added to selected members`);
            }
        });
        
        removeBtn.addEventListener('click', function(event) {
            event.stopPropagation(); // Prevent event from bubbling up
            console.log(`Remove button clicked for ${user.name}`);
            selectedMembers = selectedMembers.filter(member => member.user_id !== user.user_id);
            updateSelectedMembersUI();
            addBtn.style.display = 'flex';
            removeBtn.style.display = 'none';
            console.log(`${user.name} removed from selected members`);
        });
        
        return memberItem;
    }
    
    // Rest of your functions remain the same
    function updateSelectedMembersUI() {
        console.log(`Updating selected members UI (${selectedMembers.length} members)...`);
        selectedMembersContainer.innerHTML = '';
        selectedCountElement.textContent = selectedMembers.length;
        
        if (selectedMembers.length === 0) {
            selectedMembersContainer.innerHTML = '<div class="dm-empty-selection">No members selected</div>';
            return;
        }
        
        selectedMembers.forEach(user => {
            const memberElement = createSelectedMemberElement(user);
            selectedMembersContainer.appendChild(memberElement);
        });
        console.log("Selected members UI updated");
    }
    
    function createSelectedMemberElement(user) {
        console.log(`Creating selected member element for ${user.name}...`);
        const memberItem = document.createElement('div');
        memberItem.className = 'dm-selected-member-item';
        memberItem.setAttribute('data-user-id', user.user_id);
        
        memberItem.innerHTML = `
            <div class="dm-member-details">
                <h5 class="dm-member-name">${user.name}</h5>
                <span class="dm-member-role">${user.role || ''}</span>
            </div>
            <button class="dm-remove-selected-btn">
                <i class="bi bi-x-circle"></i>
            </button>
        `;
        
        const removeBtn = memberItem.querySelector('.dm-remove-selected-btn');
        removeBtn.addEventListener('click', function(event) {
            event.stopPropagation(); // Prevent event from bubbling up
            console.log(`Remove button clicked for selected member ${user.name}`);
            selectedMembers = selectedMembers.filter(member => member.user_id !== user.user_id);
            updateSelectedMembersUI();
            
            // Update the "add" button status in the available members list
            const availableMemberItem = availableMembersContainer.querySelector(`.dm-group-member-item[data-user-id="${user.user_id}"]`);
            if (availableMemberItem) {
                availableMemberItem.querySelector('.dm-add-member-btn').style.display = 'flex';
                availableMemberItem.querySelector('.dm-remove-member-btn').style.display = 'none';
                console.log(`Updated available member ${user.name}'s buttons`);
            }
        });
        
        return memberItem;
    }
    
    function filterAvailableMembers() {
        const searchTerm = membersSearchInput.value.toLowerCase();
        console.log(`Filtering available members with search term: "${searchTerm}"`);
        const filteredUsers = connectedUsers.filter(user => 
            user.name.toLowerCase().includes(searchTerm)
        );
        console.log(`Filter returned ${filteredUsers.length} of ${connectedUsers.length} users`);
        renderAvailableMembers(filteredUsers);
    }
    
    function createNewGroupChat() {
        console.log("Creating new group chat...");
        // Validate input
        const groupName = groupNameInput.value.trim();
        if (!groupName) {
            console.log("Group name is empty, showing alert");
            alert('Please enter a group name');
            return;
        }
        
        if (selectedMembers.length === 0) {
            console.log("No members selected, showing alert");
            alert('Please select at least one member');
            return;
        }
        
        // Disable submit button to prevent multiple submissions
        createGroupSubmitBtn.disabled = true;
        createGroupSubmitBtn.textContent = 'Creating...';
        
        // Prepare data
        const memberIds = selectedMembers.map(member => member.user_id);
        console.log(`Creating group "${groupName}" with ${memberIds.length} members:`, memberIds);
        
        // Send request to create group chat
        fetch('/create-group-chat/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                group_name: groupName,
                member_ids: memberIds
            })
        })
        .then(response => {
            console.log("Create group chat response received:", response.status);
            return response.json();
        })
        .then(data => {
            console.log("Create group chat response data:", data);
            if (data.success) {
                console.log(`Group created successfully with ID: ${data.group_id}`);
                closeCreateGroupModal();
                
                // Switch to group chats tab
                const allTabs = document.querySelectorAll('.dm-tab-btn');
                allTabs.forEach(tab => tab.classList.remove('active'));
                groupChatsTab.classList.add('active');
                
                const allTabContents = document.querySelectorAll('.dm-tab-content');
                allTabContents.forEach(content => content.classList.remove('active'));
                groupChatsContent.classList.add('active');
                
                loadGroupChats();
            } else {
                console.error('Failed to create group chat:', data.error);
                alert(`Failed to create group chat: ${data.error}`);
            }
        })
        .catch(error => {
            console.error('Error creating group chat:', error);
            alert('Failed to create group chat. Please try again.');
        })
        .finally(() => {
            createGroupSubmitBtn.disabled = false;
            createGroupSubmitBtn.textContent = 'Create Group';
            console.log("Create group button re-enabled");
        });
    }
    
    // All the remaining functions from your original code...
    function loadGroupChats() {
        // Show loading state
        groupChatsList.innerHTML = '<div class="dm-loading-chats"><div class="dm-spinner"></div><p>Loading group conversations...</p></div>';
        
        // Fetch group chats from backend
        fetch('/get-group-chats/')
            .then(response => {
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    userGroups = data.groups || [];
                    renderGroupChats(userGroups);
                    
                    // Update badge count
                    updateGroupChatsBadge();
                } else {
                    console.error('Error in group chats response:', data.error);
                    groupChatsList.innerHTML = '<div class="dm-error-message">Failed to load group chats</div>';
                }
            })
            .catch(error => {
                console.error('Error fetching group chats:', error);
                groupChatsList.innerHTML = '<div class="dm-error-message">Failed to load group chats</div>';
            });
    }
    
    function renderGroupChats(groups) {
        groupChatsList.innerHTML = '';
        
        if (groups.length === 0) {
            groupChatsList.innerHTML = '<div class="dm-empty-message">No group chats yet</div>';
            return;
        }
        
        groups.forEach(group => {
            const groupElement = createGroupChatElement(group);
            groupChatsList.appendChild(groupElement);
        });
        console.log("Finished rendering group chats");
    }
    
    function createGroupChatElement(group) {
        console.log(`Creating group chat element for "${group.group_name}" (${group.group_id})...`);
        const template = groupChatItemTemplate.content.cloneNode(true);
        const groupItem = template.querySelector('.dm-group-chat-item');
        
        groupItem.setAttribute('data-group-id', group.group_id);
        
        groupItem.querySelector('.dm-chat-item-name').textContent = group.group_name;
        
        const lastMessageTime = group.last_message_time ? new Date(group.last_message_time) : null;
        const timeElement = groupItem.querySelector('.dm-chat-item-time');
        if (lastMessageTime) {
            timeElement.textContent = formatMessageTime(lastMessageTime);
        } else {
            timeElement.textContent = '';
        }
        
        groupItem.querySelector('.dm-chat-item-last-message').textContent = group.last_message || 'No messages yet';
        groupItem.querySelector('.dm-members-count').textContent = group.member_count || 0;
        
        const unreadBadge = groupItem.querySelector('.dm-chat-item-badge');
        if (group.unread_count && group.unread_count > 0) {
            unreadBadge.textContent = group.unread_count;
            unreadBadge.style.display = 'flex';
        } else {
            unreadBadge.style.display = 'none';
        }
        
        // Add click event to open group chat
        groupItem.addEventListener('click', function() {
            console.log(`Group chat item clicked: "${group.group_name}"`);
            openGroupChat(group);
        });
        
        return groupItem;
    }
    
    function updateGroupChatsBadge() {
        const totalUnread = userGroups.reduce((sum, group) => sum + (group.unread_count || 0), 0);
        const badge = document.getElementById('dmGroupChatsBadge');
        
        if (badge) {
            if (totalUnread > 0) {
                badge.textContent = totalUnread;
                badge.style.display = 'inline-flex';
            } else {
                badge.style.display = 'none';
            }
        } else {
            console.error("Group chats badge element not found");
        }
        
        // Also update the main messaging button badge
        updateMainMessagingBadge();
    }
    
    function updateMainMessagingBadge() {
        // This function will update the main messaging button badge
        // by combining unread counts from direct messages and group chats
        const mainBadge = document.getElementById('dmUnreadBadge');
        if (!mainBadge) {
            console.error("Main messaging badge element not found");
            return;
        }
        
        // Get unread counts from all tabs
        const groupUnread = userGroups.reduce((sum, group) => sum + (group.unread_count || 0), 0);
        
        // Get unread counts from direct messages (if available)
        let directUnread = 0;
        const primaryBadge = document.getElementById('dmPrimaryInboxBadge');
        const requestsBadge = document.getElementById('dmMessageRequestsBadge');
        
        if (primaryBadge && primaryBadge.style.display !== 'none') {
            directUnread += parseInt(primaryBadge.textContent) || 0;
        }
        
        if (requestsBadge && requestsBadge.style.display !== 'none') {
            directUnread += parseInt(requestsBadge.textContent) || 0;
        }
        
        const totalUnread = groupUnread + directUnread;
        
        if (totalUnread > 0) {
            mainBadge.textContent = totalUnread;
            mainBadge.style.display = 'flex';
        } else {
            mainBadge.style.display = 'none';
        }
    }
    
    function openGroupChat(group) {
        console.log(`Opening group chat "${group.group_name}" (${group.group_id})...`);
        // Check if chat window already exists
        const existingWindow = document.querySelector(`.dm-group-chat-window[data-chat-id="${group.group_id}"]`);
        if (existingWindow) {
            console.log("Chat window already exists, focusing it");
            // Focus existing window
            existingWindow.style.display = 'flex';
            existingWindow.classList.add('active');
            
            // Mark messages as read if there are unread messages
            if (group.unread_count && group.unread_count > 0) {
                markGroupMessagesAsRead(group.group_id);
            }
            
            return;
        }
        
        console.log("Creating new chat window from template");
        // Create new chat window from template
        const template = groupChatWindowTemplate.content.cloneNode(true);
        const chatWindow = template.querySelector('.dm-group-chat-window');
        
        chatWindow.setAttribute('data-chat-id', group.group_id);
        chatWindow.querySelector('.dm-chat-group-name').textContent = group.group_name;
        chatWindow.querySelector('.dm-chat-members-count').textContent = `${group.member_count || 0} members`;
        
        // Add event listeners
        const minimizeBtn = chatWindow.querySelector('.dm-minimize-chat-btn');
        const closeBtn = chatWindow.querySelector('.dm-close-chat-btn');
        const infoBtn = chatWindow.querySelector('.dm-group-info-btn');
        const sendBtn = chatWindow.querySelector('.dm-send-message-btn');
        const inputField = chatWindow.querySelector('.dm-chat-input');
        
        minimizeBtn.addEventListener('click', function() {
            console.log(`Minimize button clicked for "${group.group_name}"`);
            chatWindow.classList.toggle('minimized');
        });
        
        closeBtn.addEventListener('click', function() {
            console.log(`Close button clicked for "${group.group_name}"`);
            chatWindow.style.display = 'none';
        });
        
        infoBtn.addEventListener('click', function() {
            console.log(`Info button clicked for "${group.group_name}"`);
            showGroupInfo(group);
        });
        
        inputField.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                console.log(`Enter key pressed in message input for "${group.group_name}"`);
                event.preventDefault();
                sendGroupMessage(group.group_id, inputField.value);
                inputField.value = '';
            }
        });
        
        sendBtn.addEventListener('click', function() {
            console.log(`Send button clicked for "${group.group_name}"`);
            sendGroupMessage(group.group_id, inputField.value);
            inputField.value = '';
        });
        
        // Add to chat windows container
        const windowsContainer = document.getElementById('dmChatWindowsContainer');
        if (windowsContainer) {
            windowsContainer.appendChild(chatWindow);
            console.log("Chat window added to container");
        } else {
            console.error('Chat windows container not found');
            return;
        }
        
        // Load messages
        loadGroupMessages(group.group_id);
        
        // Mark messages as read
        if (group.unread_count && group.unread_count > 0) {
            markGroupMessagesAsRead(group.group_id);
        }
        
        console.log(`Group chat "${group.group_name}" opened successfully`);
    }
    
    function loadGroupMessages(groupId) {
        console.log(`Loading messages for group ${groupId}...`);
        const chatWindow = document.querySelector(`.dm-group-chat-window[data-chat-id="${groupId}"]`);
        if (!chatWindow) {
            console.error(`Chat window for group ${groupId} not found`);
            return;
        }
        
        const messagesContainer = chatWindow.querySelector('.dm-chat-messages');
        messagesContainer.innerHTML = '<div class="dm-chat-loading"><div class="dm-spinner"></div></div>';
        
        // Fetch messages from backend
        fetch(`/get-group-messages/?group_id=${groupId}`)
            .then(response => {
                console.log(`Group messages response received for ${groupId}:`, response.status);
                return response.json();
            })
            .then(data => {
                console.log(`Group messages data for ${groupId}:`, data);
                if (data.success) {
                    console.log(`Received ${data.messages.length} messages for group ${groupId}`);
                    renderGroupMessages(groupId, data.messages || []);
                } else {
                    console.error(`Error loading messages for group ${groupId}:`, data.error);
                    messagesContainer.innerHTML = '<div class="dm-error-message">Failed to load messages</div>';
                }
            })
            .catch(error => {
                console.error(`Error fetching messages for group ${groupId}:`, error);
                messagesContainer.innerHTML = '<div class="dm-error-message">Failed to load messages</div>';
            });
    }
    
    function renderGroupMessages(groupId, messages) {
        console.log(`Rendering ${messages.length} messages for group ${groupId}...`);
        const chatWindow = document.querySelector(`.dm-group-chat-window[data-chat-id="${groupId}"]`);
        if (!chatWindow) {
            console.error(`Chat window for group ${groupId} not found during rendering`);
            return;
        }
        
        const messagesContainer = chatWindow.querySelector('.dm-chat-messages');
        messagesContainer.innerHTML = '';
        
        if (messages.length === 0) {
            console.log(`No messages found for group ${groupId}`);
            messagesContainer.innerHTML = '<div class="dm-empty-chat">No messages yet. Be the first to say hello!</div>';
            return;
        }
        
        // Group messages by date
        const groupedMessages = groupMessagesByDate(messages);
        console.log(`Messages grouped by date: ${Object.keys(groupedMessages).length} days`);
        
        // Render each date group
        Object.keys(groupedMessages).forEach(date => {
            console.log(`Rendering messages for date: ${date}`);
            // Add date separator
            const dateSeparator = document.createElement('div');
            dateSeparator.className = 'dm-date-separator';
            dateSeparator.textContent = formatMessageDate(date);
            messagesContainer.appendChild(dateSeparator);
            
            // Add messages for this date
            groupedMessages[date].forEach(message => {
                const messageElement = createGroupMessageElement(message);
                messagesContainer.appendChild(messageElement);
            });
        });
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        console.log(`Finished rendering messages for group ${groupId}`);
    }
    
    function createGroupMessageElement(message) {
        console.log(`Creating message element for message ID: ${message.id}`);
        // Check if it's a system message
        if (message.is_system) {
            console.log("Creating system message element");
            const systemMessage = document.createElement('div');
            systemMessage.className = 'dm-system-message';
            
            const content = document.createElement('div');
            content.className = 'dm-system-message-content';
            content.textContent = message.content;
            
            systemMessage.appendChild(content);
            return systemMessage;
        }
        
        // Regular user message
        const messageElement = document.createElement('div');
        
        // Determine if message is from current user
        const isCurrentUser = message.sender_id === currentUserId;
        messageElement.className = `dm-message ${isCurrentUser ? 'dm-message-outgoing' : 'dm-message-incoming'}`;
        
        console.log(`Message from ${isCurrentUser ? 'current user' : 'other user'} (${message.sender_name})`);
        
        // Add message header with sender name (for messages not from current user)
        if (!isCurrentUser) {
            const messageHeader = document.createElement('div');
            messageHeader.className = 'dm-message-sender';
            messageHeader.textContent = message.sender_name || 'Unknown User';
            messageElement.appendChild(messageHeader);
        }
        
        // Add message content
        const contentElement = document.createElement('div');
        contentElement.className = 'dm-message-content';
        contentElement.textContent = message.content;
        messageElement.appendChild(contentElement);
        
        // Add message footer with time
        const footerElement = document.createElement('div');
        footerElement.className = 'dm-message-footer';
        
        const timeElement = document.createElement('span');
        timeElement.className = 'dm-message-time';
        timeElement.textContent = formatMessageTime(new Date(message.timestamp));
        footerElement.appendChild(timeElement);
        
        messageElement.appendChild(footerElement);
        
        return messageElement;
    }
    
    function formatMessageDate(dateStr) {
        const date = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric'
            });
        }
    }
    
    function formatMessageTime(date) {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }
    
    // Helper function to get CSRF token
    function getCookie(name) {
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
    
    // Load group chats when the messaging panel is first opened
    const directMessagingButton = document.getElementById('directMessagingButton');
    if (directMessagingButton) {
        console.log("Setting up listener for messaging button");
        directMessagingButton.addEventListener('click', function() {
            // Check if the group chats tab exists and load data if needed
            if (groupChatsTab && userGroups.length === 0) {
                console.log("Messaging panel opened, preloading group chats data");
                loadGroupChats();
            }
        });
    }
    
    console.log("Group chat initialization complete");
    
    function showGroupInfo(group) {
        console.log(`Showing group info for "${group.group_name}" (${group.group_id})...`);
        // Implementation for showing group info modal
        // This would show members list, creation date, etc.
        fetch(`/get-group-members/?group_id=${group.group_id}`)
            .then(response => {
                console.log(`Group members response received for group ${group.group_id}:`, response.status);
                return response.json();
            })
            .then(data => {
                console.log(`Group members data for group ${group.group_id}:`, data);
                if (data.success) {
                    const members = data.members || [];
                    console.log(`Found ${members.length} members for group "${group.group_name}"`);
                    const memberNames = members.map(member => member.name).join(', ');
                    const creator = members.find(m => m.is_admin);
                    
                    alert(`Group: ${group.group_name}\nMembers (${members.length}): ${memberNames}\nCreator: ${creator ? creator.name : 'Unknown'}`);
                    console.log(`Group info alert shown for "${group.group_name}"`);
                } else {
                    console.error(`Error fetching members for group ${group.group_id}:`, data.error);
                    alert(`Group Info: ${group.group_name}\nMembers: ${group.member_count}`);
                }
            })
            .catch(error => {
                console.error(`Error fetching group members for group ${group.group_id}:`, error);
                alert(`Group Info: ${group.group_name}\nMembers: ${group.member_count}`);
            });
    }
    
    function groupMessagesByDate(messages) {
        console.log(`Grouping ${messages.length} messages by date...`);
        const grouped = {};
        
        messages.forEach(message => {
            const date = new Date(message.timestamp);
            const dateKey = date.toDateString();
            
            if (!grouped[dateKey]) {
                grouped[dateKey] = [];
            }
            
            grouped[dateKey].push(message);
        });
        
        console.log(`Messages grouped into ${Object.keys(grouped).length} dates`);
        return grouped;
    }
    
    function updateGroupChatListItem(groupId, lastMessage) {
        console.log(`Updating group chat list item for group ${groupId}...`);
        const groupItem = groupChatsList.querySelector(`.dm-group-chat-item[data-group-id="${groupId}"]`);
        if (groupItem) {
            // Update last message text
            const lastMessageElement = groupItem.querySelector('.dm-chat-item-last-message');
            lastMessageElement.textContent = lastMessage;
            
            // Update timestamp
            const timeElement = groupItem.querySelector('.dm-chat-item-time');
            timeElement.textContent = formatMessageTime(new Date());
            
            // Move to top of list
            groupChatsList.prepend(groupItem);
            console.log(`Group chat list item for group ${groupId} updated and moved to top`);
        } else {
            console.warn(`Group chat list item for group ${groupId} not found`);
        }
    }
    
    function markGroupMessagesAsRead(groupId) {
        console.log(`Marking messages as read for group ${groupId}...`);
        fetch('/mark-group-messages-read/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                group_id: groupId
            })
        })
        .then(response => {
            console.log(`Mark messages as read response received for group ${groupId}:`, response.status);
            return response.json();
        })
        .then(data => {
            console.log(`Mark messages as read response data for group ${groupId}:`, data);
            if (data.success) {
                console.log(`Messages marked as read successfully for group ${groupId}`);
                // Update UI
                const groupItem = groupChatsList.querySelector(`.dm-group-chat-item[data-group-id="${groupId}"]`);
                if (groupItem) {
                    const badge = groupItem.querySelector('.dm-chat-item-badge');
                    badge.style.display = 'none';
                    console.log(`Unread badge hidden for group ${groupId}`);
                } else {
                    console.warn(`Group chat list item for group ${groupId} not found when updating badge`);
                }
                
                // Update group data
                const groupIndex = userGroups.findIndex(group => group.group_id === groupId);
                if (groupIndex !== -1) {
                    userGroups[groupIndex].unread_count = 0;
                    updateGroupChatsBadge();
                    console.log(`Group data updated for group ${groupId}`);
                } else {
                    console.warn(`Group data not found for group ${groupId}`);
                }
            } else {
                console.error(`Error marking messages as read for group ${groupId}:`, data.error);
            }
        })
        .catch(error => {
            console.error(`Error marking messages as read for group ${groupId}:`, error);
        });
    }
    function sendGroupMessage(groupId, content) {
        const trimmedContent = content.trim();
        console.log(`Sending message to group ${groupId}: "${trimmedContent}"`);
        
        // Validate input
        if (!trimmedContent) {
            console.log("Message content is empty, not sending");
            return;
        }
        
        // Send message to backend
        fetch('/send-group-message/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                group_id: groupId,
                message: trimmedContent
            })
        })
        .then(response => {
            console.log(`Send message response received for group ${groupId}:`, response.status);
            return response.json();
        })
        .then(data => {
            console.log(`Send message response data for group ${groupId}:`, data);
            if (data.success) {
                console.log(`Message sent successfully to group ${groupId}, message ID: ${data.message_id}`);
                // Add message to UI
                const chatWindow = document.querySelector(`.dm-group-chat-window[data-chat-id="${groupId}"]`);
                if (chatWindow) {
                    const messagesContainer = chatWindow.querySelector('.dm-chat-messages');
                    
                    // Check if the empty message indicator is showing
                    const emptyChat = messagesContainer.querySelector('.dm-empty-chat');
                    if (emptyChat) {
                        messagesContainer.innerHTML = '';
                        console.log("Removed empty chat indicator");
                    }
                    
                    // Create message element
                    const message = {
                        id: data.message_id,
                        sender_id: currentUserId,
                        sender_name: 'You', // This will be ignored for outgoing messages
                        content: trimmedContent,
                        timestamp: new Date().toISOString(),
                        is_system: false
                    };
                    
                    const messageElement = createGroupMessageElement(message);
                    messagesContainer.appendChild(messageElement);
                    
                    // Scroll to bottom
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    console.log("Message added to UI and scrolled to bottom");
                }
                
                // Update group chat list item
                updateGroupChatListItem(groupId, trimmedContent);
            } else {
                console.error('Error sending message:', data.error);
                alert('Failed to send message. Please try again.');
            }
        })
        .catch(error => {
            console.error('Error sending message:', error);
            alert('Failed to send message. Please try again.');
        });
    }
})