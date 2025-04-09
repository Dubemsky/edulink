// group_chat.js - Group Chat functionality for EduLink messaging system

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const createGroupBtn = document.getElementById('dmCreateGroupBtn');
    const groupChatsList = document.getElementById('dmGroupChatsList');
    const modalOverlay = document.getElementById('dmModalOverlay');
    const chatWindowsContainer = document.getElementById('dmChatWindowsContainer');
    
    // Templates
    const groupChatItemTemplate = document.getElementById('dmGroupChatItemTemplate');
    const groupChatWindowTemplate = document.getElementById('dmGroupChatWindowTemplate');
    const groupMemberItemTemplate = document.getElementById('dmGroupMemberItemTemplate');
    
    // Current user ID from the global variable
    const currentUserId = window.currentUserId;
    
    // State
    let userConnections = []; // Will store the users who are mutual connections
    let activeGroupChats = []; // Will store the active group chats
    let selectedMembers = []; // Will store the selected members for new group chat
    let messagePollingIntervals = {}; // Store intervals for polling new messages

    // Create group chat modal HTML
    const createGroupChatModal = document.createElement('div');
    createGroupChatModal.className = 'dm-new-message-modal dm-group-chat-modal';
    createGroupChatModal.id = 'dmCreateGroupModal';
    createGroupChatModal.innerHTML = `
        <div class="dm-modal-header">
            <h4>Create Group Chat</h4>
            <button class="dm-modal-close-btn" id="dmGroupModalCloseBtn">
                <i class="bi bi-x-lg"></i>
            </button>
        </div>
        <div class="dm-modal-body">
            <div class="dm-group-name-input">
                <label for="dmGroupNameInput">Group Name:</label>
                <input type="text" id="dmGroupNameInput" placeholder="Enter group name">
            </div>
            <div class="dm-group-members-section">
                <h5>Add Members</h5>
                <div class="dm-recipient-search">
                    <input type="text" id="dmGroupMemberSearch" placeholder="Search connections">
                </div>
                <div class="dm-connections-list" id="dmConnectionsList"></div>
                <div class="dm-selected-members">
                    <h5>Selected Members (<span id="selectedMembersCount">0</span>)</h5>
                    <div id="dmSelectedMembersList"></div>
                </div>
            </div>
        </div>
        <div class="dm-modal-footer">
            <button class="dm-secondary-btn" id="dmCancelGroupBtn">Cancel</button>
            <button class="dm-primary-btn" id="dmCreateGroupSubmitBtn">Create Group</button>
        </div>
    `;
    document.body.appendChild(createGroupChatModal);

    // Group info modal HTML
    const groupInfoModal = document.createElement('div');
    groupInfoModal.className = 'dm-new-message-modal dm-group-info-modal';
    groupInfoModal.id = 'dmGroupInfoModal';
    groupInfoModal.innerHTML = `
        <div class="dm-modal-header">
            <h4 id="groupInfoModalTitle">Group Info</h4>
            <button class="dm-modal-close-btn" id="dmGroupInfoCloseBtn">
                <i class="bi bi-x-lg"></i>
            </button>
        </div>
        <div class="dm-modal-body">
            <div class="dm-group-info-section">
                <h5>Members</h5>
                <div class="dm-group-members-list" id="dmGroupInfoMembersList"></div>
            </div>
            <div class="dm-group-actions-section">
                <h5>Group Actions</h5>
                <button class="dm-danger-btn" id="dmLeaveGroupBtn">
                    <i class="bi bi-box-arrow-right"></i> Leave Group
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(groupInfoModal);

    // Create toast container
    const toastContainer = document.createElement('div');
    toastContainer.className = 'dm-toast-container';
    document.body.appendChild(toastContainer);

    // Initialize group chat functionality
    function initGroupChat() {
        // Load existing group chats
        loadGroupChats();
        
        // Fetch user connections (mutual follows)
        fetchUserConnections();
        
        // Set up event listeners
        setupEventListeners();
    }

    // Fetch the user's mutual connections (users who follow each other)
    function fetchUserConnections() {
        // Call the API endpoint to get mutual connections
        fetch('/get-mutual-connections/')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    userConnections = data.connections;
                    console.log('Loaded mutual connections:', userConnections);
                } else {
                    console.error('Error loading mutual connections:', data.error);
                }
            })
            .catch(error => {
                console.error('Error fetching mutual connections:', error);
            });
    }

    // Load existing group chats from the server
    function loadGroupChats() {
        // Show loading state
        groupChatsList.innerHTML = `
            <div class="dm-loading-chats">
                <div class="dm-spinner"></div>
                <p>Loading group chats...</p>
            </div>
        `;
        
        // Fetch group chats from the server
        fetch('/get-group-chats/')
            .then(response => response.json())
            .then(data => {
                // Clear loading state
                groupChatsList.innerHTML = '';
                
                if (data.success) {
                    const groupChats = data.group_chats || [];
                    
                    if (groupChats.length === 0) {
                        // Show empty state if no group chats exist
                        const emptyState = document.createElement('div');
                        emptyState.className = 'dm-empty-state';
                        emptyState.innerHTML = `
                            <i class="bi bi-people"></i>
                            <p>No group chats yet</p>
                            <p class="dm-empty-state-hint">Create a new group chat to start collaborating with others.</p>
                        `;
                        groupChatsList.appendChild(emptyState);
                    } else {
                        // Add each group chat to the list
                        groupChats.forEach(chat => {
                            addGroupChatToList(chat);
                        });
                    }
                    
                    // Update the badge count
                    updateGroupChatBadge();
                } else {
                    // Show error state
                    const errorState = document.createElement('div');
                    errorState.className = 'dm-empty-state';
                    errorState.innerHTML = `
                        <i class="bi bi-exclamation-circle"></i>
                        <p>Error loading group chats</p>
                        <p class="dm-empty-state-hint">${data.error || 'Please try again later.'}</p>
                    `;
                    groupChatsList.appendChild(errorState);
                }
            })
            .catch(error => {
                console.error('Error loading group chats:', error);
                
                // Show error state
                groupChatsList.innerHTML = `
                    <div class="dm-empty-state">
                        <i class="bi bi-exclamation-circle"></i>
                        <p>Error loading group chats</p>
                        <p class="dm-empty-state-hint">Please check your connection and try again.</p>
                    </div>
                `;
            });
    }

    // Add a group chat to the list in the sidebar
    function addGroupChatToList(groupChat) {
        // Clone the template
        const groupChatItem = groupChatItemTemplate.content.cloneNode(true);
        
        // Update the chat item with group chat details
        const chatItemEl = groupChatItem.querySelector('.dm-group-chat-item');
        chatItemEl.dataset.chatId = groupChat.id;
        
        const nameEl = chatItemEl.querySelector('.dm-chat-item-name');
        nameEl.textContent = groupChat.name;
        
        const timeEl = chatItemEl.querySelector('.dm-chat-item-time');
        timeEl.textContent = formatLastMessageTime(groupChat.last_message_time);
        
        const lastMessageEl = chatItemEl.querySelector('.dm-chat-item-last-message');
        lastMessageEl.textContent = groupChat.last_message || 'No messages yet';
        
        const membersCountEl = chatItemEl.querySelector('.dm-members-count');
        membersCountEl.textContent = groupChat.members ? groupChat.members.length : 0;
        
        // Calculate unread messages (if last_read is available)
        let unreadCount = 0;
        if (groupChat.last_message_time && groupChat.last_read) {
            if (groupChat.last_message_time > groupChat.last_read) {
                unreadCount = 1; // Simplified - in a real app you'd count all unread messages
            }
        }
        
        // Add badge if there are unread messages
        const badgeEl = chatItemEl.querySelector('.dm-chat-item-badge');
        if (unreadCount > 0) {
            badgeEl.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badgeEl.style.display = 'flex';
        } else {
            badgeEl.style.display = 'none';
        }
        
        // Add click event to open the group chat
        chatItemEl.addEventListener('click', () => {
            openGroupChat(groupChat);
        });
        
        // Add to the list
        groupChatsList.appendChild(chatItemEl);
        
        // Update the badge count in the tab
        updateGroupChatBadge();
    }

    // Open a group chat window
    function openGroupChat(groupChat) {
        // Check if the chat is already open
        const existingChat = document.querySelector(`.dm-group-chat-window[data-chat-id="${groupChat.id}"]`);
        if (existingChat) {
            // Focus on existing chat
            existingChat.classList.add('active');
            return;
        }
        
        // Clone the template
        const groupChatWindow = groupChatWindowTemplate.content.cloneNode(true);
        
        // Update the window with group chat details
        const windowEl = groupChatWindow.querySelector('.dm-group-chat-window');
        windowEl.dataset.chatId = groupChat.id;
        
        const nameEl = windowEl.querySelector('.dm-chat-group-name');
        nameEl.textContent = groupChat.name;
        
        const membersCountEl = windowEl.querySelector('.dm-chat-members-count');
        const memberCount = groupChat.members ? groupChat.members.length : 0;
        membersCountEl.textContent = `${memberCount} members`;
        
        // Add event listeners for chat window actions
        setupGroupChatWindowEvents(windowEl, groupChat);
        
        // Add to the container
        chatWindowsContainer.appendChild(windowEl);
        
        // Load chat messages
        loadGroupChatMessages(windowEl, groupChat.id);
        
        // Add to active chats
        activeGroupChats.push(groupChat.id);
        
        // Set up polling for new messages
        setupMessagePolling(groupChat.id);
    }

    // Set up polling for new messages in a group chat
    function setupMessagePolling(groupChatId) {
        // Clear any existing interval for this chat
        if (messagePollingIntervals[groupChatId]) {
            clearInterval(messagePollingIntervals[groupChatId]);
        }
        
        // Set up new polling interval
        messagePollingIntervals[groupChatId] = setInterval(() => {
            // Only poll if the chat window is still open
            const chatWindow = document.querySelector(`.dm-group-chat-window[data-chat-id="${groupChatId}"]`);
            if (!chatWindow) {
                clearInterval(messagePollingIntervals[groupChatId]);
                delete messagePollingIntervals[groupChatId];
                return;
            }
            
            // Poll for new messages
            pollNewMessages(chatWindow, groupChatId);
        }, 10000); // Poll every 10 seconds
    }

    // Poll for new messages in a group chat
    function pollNewMessages(chatWindow, groupChatId) {
        // In a real implementation, you'd have an API endpoint to get only new messages
        // For simplicity, we'll just reload all messages
        
        // Get the timestamp of the last message in the chat
        const lastMessage = chatWindow.querySelector('.dm-message:last-child');
        let lastTimestamp = 0;
        
        if (lastMessage) {
            // Get the timestamp data attribute or estimate from the time element
            const timeEl = lastMessage.querySelector('.dm-message-time');
            if (timeEl) {
                // This is simplified - in a real app, store and use actual timestamps
                lastTimestamp = new Date().getTime() - 10000; // 10 seconds ago
            }
        }
        
        // Call the API to get new messages
        fetch(`/group-chat/${groupChatId}/messages/?since=${lastTimestamp}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const messages = data.messages || [];
                    const groupInfo = data.group_info || {};
                    
                    // Get the messages container
                    const messagesContainer = chatWindow.querySelector('.dm-chat-messages');
                    
                    // Check if this is the first message
                    const emptyState = messagesContainer.querySelector('.dm-empty-chat-state');
                    if (emptyState && messages.length > 0) {
                        messagesContainer.innerHTML = '';
                    }
                    
                    // Add only new messages
                    messages.forEach(message => {
                        // Check if message already exists in the container
                        const existingMessage = chatWindow.querySelector(`.dm-message[data-message-id="${message.id}"]`);
                        if (existingMessage) {
                            return; // Skip if message already exists
                        }
                        
                        // Create new message element
                        const messageEl = document.createElement('div');
                        messageEl.className = 'dm-message';
                        messageEl.dataset.messageId = message.id;
                        
                        // Check if this message was sent by the current user
                        if (message.sender_id === currentUserId) {
                            messageEl.classList.add('sent');
                        }
                        
                        // Find the sender's name
                        let senderName = 'Unknown';
                        if (groupInfo.members) {
                            const sender = groupInfo.members.find(member => member.id === message.sender_id);
                            if (sender) {
                                senderName = sender.name;
                            }
                        }
                        
                        // Add sender name for messages not from the current user
                        let headerHTML = '';
                        if (message.sender_id !== currentUserId) {
                            headerHTML = `<div class="dm-message-sender">${senderName}</div>`;
                        }
                        
                        // Format the message timestamp
                        const timestamp = message.timestamp ? new Date(message.timestamp) : new Date();
                        const formattedTime = formatMessageTime(timestamp);
                        
                        // Set message content
                        messageEl.innerHTML = `
                            ${headerHTML}
                            <div class="dm-message-content">${message.content}</div>
                            <div class="dm-message-footer">
                                <span class="dm-message-time">${formattedTime}</span>
                                <div class="dm-message-status">
                                    ${message.sender_id === currentUserId ? '<i class="bi bi-check"></i>' : ''}
                                </div>
                            </div>
                        `;
                        
                        messagesContainer.appendChild(messageEl);
                        
                        // Update the group chat list item if this is a new message
                        if (message.sender_id !== currentUserId) {
                            updateGroupChatLastMessage(groupChatId, message.content);
                        }
                    });
                    
                    // Scroll to the bottom if new messages were added
                    if (messages.length > 0) {
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                }
            })
            .catch(error => {
                console.error('Error polling for new messages:', error);
            });
    }

    // Load messages for a group chat
    function loadGroupChatMessages(chatWindow, groupChatId) {
        const messagesContainer = chatWindow.querySelector('.dm-chat-messages');
        
        // Show loading spinner
        messagesContainer.innerHTML = `
            <div class="dm-chat-loading">
                <div class="dm-spinner"></div>
            </div>
        `;
        
        // Fetch messages from the server
        fetch(`/group-chat/${groupChatId}/messages/`)
            .then(response => response.json())
            .then(data => {
                // Clear loading spinner
                messagesContainer.innerHTML = '';
                
                if (data.success) {
                    const messages = data.messages || [];
                    const groupInfo = data.group_info || {};
                    
                    // Update chat window with group info
                    const nameEl = chatWindow.querySelector('.dm-chat-group-name');
                    nameEl.textContent = groupInfo.name || 'Group Chat';
                    
                    const membersCountEl = chatWindow.querySelector('.dm-chat-members-count');
                    const memberCount = groupInfo.members ? groupInfo.members.length : 0;
                    membersCountEl.textContent = `${memberCount} members`;
                    
                    if (messages.length === 0) {
                        // Show empty state if no messages
                        const emptyState = document.createElement('div');
                        emptyState.className = 'dm-empty-chat-state';
                        emptyState.innerHTML = `
                            <i class="bi bi-chat-text"></i>
                            <p>No messages yet</p>
                            <p class="dm-empty-state-hint">Send a message to start the conversation.</p>
                        `;
                        messagesContainer.appendChild(emptyState);
                    } else {
                        // Add messages to the container
                        messages.forEach(message => {
                            const messageEl = document.createElement('div');
                            messageEl.className = 'dm-message';
                            messageEl.dataset.messageId = message.id;
                            
                            // Check if this message was sent by the current user
                            if (message.sender_id === currentUserId) {
                                messageEl.classList.add('sent');
                            }
                            
                            // Find the sender's name
                            let senderName = 'Unknown';
                            if (groupInfo.members) {
                                const sender = groupInfo.members.find(member => member.id === message.sender_id);
                                if (sender) {
                                    senderName = sender.name;
                                }
                            }
                            
                            // Add sender name for messages not from the current user
                            let headerHTML = '';
                            if (message.sender_id !== currentUserId) {
                                headerHTML = `<div class="dm-message-sender">${senderName}</div>`;
                            }
                            
                            // Format the message timestamp
                            const timestamp = message.timestamp ? new Date(message.timestamp) : new Date();
                            const formattedTime = formatMessageTime(timestamp);
                            
                            // Set message content
                            messageEl.innerHTML = `
                                ${headerHTML}
                                <div class="dm-message-content">${message.content}</div>
                                <div class="dm-message-footer">
                                    <span class="dm-message-time">${formattedTime}</span>
                                    <div class="dm-message-status">
                                        ${message.sender_id === currentUserId ? '<i class="bi bi-check"></i>' : ''}
                                    </div>
                                </div>
                            `;
                            
                            messagesContainer.appendChild(messageEl);
                        });
                        
                        // Scroll to the bottom
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                } else {
                    // Show error state
                    messagesContainer.innerHTML = `
                        <div class="dm-chat-error">
                            <i class="bi bi-exclamation-circle"></i>
                            <p>Error loading messages</p>
                            <p class="dm-error-hint">${data.error || 'Please try again later.'}</p>
                        </div>
                    `;
                }
            })
            .catch(error => {
                console.error('Error loading group chat messages:', error);
                
                // Show error state
                messagesContainer.innerHTML = `
                    <div class="dm-chat-error">
                        <i class="bi bi-exclamation-circle"></i>
                        <p>Error loading messages</p>
                        <p class="dm-error-hint">Please check your connection and try again.</p>
                    </div>
                `;
            });
    }

    // Setup events for a group chat window
    function setupGroupChatWindowEvents(chatWindow, groupChat) {
        // Minimize button
        const minimizeBtn = chatWindow.querySelector('.dm-minimize-chat-btn');
        minimizeBtn.addEventListener('click', () => {
            chatWindow.classList.toggle('minimized');
        });
        
        // Close button
        const closeBtn = chatWindow.querySelector('.dm-close-chat-btn');
        closeBtn.addEventListener('click', () => {
            chatWindow.remove();
            activeGroupChats = activeGroupChats.filter(id => id !== groupChat.id);
            
            // Clear polling interval
            if (messagePollingIntervals[groupChat.id]) {
                clearInterval(messagePollingIntervals[groupChat.id]);
                delete messagePollingIntervals[groupChat.id];
            }
        });
        
        // Group info button
        const infoBtn = chatWindow.querySelector('.dm-group-info-btn');
        infoBtn.addEventListener('click', () => {
            showGroupInfo(groupChat);
        });
        
        // Send message button
        const sendBtn = chatWindow.querySelector('.dm-send-message-btn');
        const messageInput = chatWindow.querySelector('.dm-chat-input');
        
        sendBtn.addEventListener('click', () => {
            sendGroupMessage(messageInput, groupChat.id);
        });
        
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendGroupMessage(messageInput, groupChat.id);
            }
        });
    }

    // Send a message in a group chat
    function sendGroupMessage(inputElement, groupChatId) {
        const messageText = inputElement.value.trim();
        if (!messageText) return;
        
        // Clear the input
        inputElement.value = '';
        
        // Create a temporary message element with pending status
        const chatWindow = document.querySelector(`.dm-group-chat-window[data-chat-id="${groupChatId}"]`);
        const messagesContainer = chatWindow.querySelector('.dm-chat-messages');
        
        // Check if this is the first message
        const emptyState = messagesContainer.querySelector('.dm-empty-chat-state');
        if (emptyState) {
            messagesContainer.innerHTML = '';
        }
        
        // Create and add the temporary message
        const messageEl = document.createElement('div');
        messageEl.className = 'dm-message sent pending';
        messageEl.innerHTML = `
            <div class="dm-message-content">${messageText}</div>
            <div class="dm-message-footer">
                <span class="dm-message-time">${formatMessageTime(new Date())}</span>
                <div class="dm-message-status">
                    <div class="dm-message-sending-spinner"></div>
                </div>
            </div>
        `;
        
        messagesContainer.appendChild(messageEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Send the message to the server
        fetch(`/group-chat/${groupChatId}/messages/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                message: messageText
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Update the temporary message with sent status
                messageEl.classList.remove('pending');
                messageEl.dataset.messageId = data.message_id;
                const statusEl = messageEl.querySelector('.dm-message-status');
                statusEl.innerHTML = '<i class="bi bi-check"></i>';
                
                // Update the group chat list to show this is the latest message
                updateGroupChatLastMessage(groupChatId, messageText);
            } else {
                // Show error status
                messageEl.classList.remove('pending');
                messageEl.classList.add('error');
                const statusEl = messageEl.querySelector('.dm-message-status');
                statusEl.innerHTML = '<i class="bi bi-exclamation-circle"></i>';
                
                // Show error tooltip
                const errorTooltip = document.createElement('div');
                errorTooltip.className = 'dm-message-error-tooltip';
                errorTooltip.textContent = data.error || 'Failed to send';
                messageEl.appendChild(errorTooltip);
                
                // Hide tooltip after a few seconds
                setTimeout(() => {
                    errorTooltip.remove();
                }, 3000);
            }
        })
        .catch(error => {
            console.error('Error sending message:', error);
            
            // Show error status
            messageEl.classList.remove('pending');
            messageEl.classList.add('error');
            const statusEl = messageEl.querySelector('.dm-message-status');
            statusEl.innerHTML = '<i class="bi bi-exclamation-circle"></i>';
            
            // Show retry button
            const retryBtn = document.createElement('button');
            retryBtn.className = 'dm-message-retry-btn';
            retryBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Retry';
            messageEl.appendChild(retryBtn);
            
            // Add retry functionality
            retryBtn.addEventListener('click', () => {
                // Remove error classes and retry button
                messageEl.classList.remove('error');
                messageEl.classList.add('pending');
                retryBtn.remove();
                
                // Update status
                const statusEl = messageEl.querySelector('.dm-message-status');
                statusEl.innerHTML = '<div class="dm-message-sending-spinner"></div>';
                
                // Retry sending the message
                sendGroupMessage({ value: messageText }, groupChatId);
            });
        });
    }
    
    // Update a group chat's last message in the list
    function updateGroupChatLastMessage(groupChatId, lastMessage) {
        const chatItem = document.querySelector(`.dm-group-chat-item[data-chat-id="${groupChatId}"]`);
        if (chatItem) {
            const lastMessageEl = chatItem.querySelector('.dm-chat-item-last-message');
            if (lastMessageEl) {
                lastMessageEl.textContent = lastMessage;
            }
            
            const timeEl = chatItem.querySelector('.dm-chat-item-time');
            if (timeEl) {
                timeEl.textContent = formatLastMessageTime(new Date());
            }
            
            // Move the chat item to the top of the list
            const chatsList = chatItem.parentElement;
            if (chatsList && chatsList.firstChild !== chatItem) {
                chatsList.insertBefore(chatItem, chatsList.firstChild);
            }
        }
    }

    // Show group information modal
    function showGroupInfo(groupChat) {
        // Display the group info modal
        modalOverlay.style.display = 'block';
        const groupInfoModal = document.getElementById('dmGroupInfoModal');
        groupInfoModal.style.display = 'block';
        
        // Set the group name in the title
        const titleEl = document.getElementById('groupInfoModalTitle');
        titleEl.textContent = groupChat.name;
        
        // Populate members list
        const membersList = document.getElementById('dmGroupInfoMembersList');
        membersList.innerHTML = '<div class="dm-loading"><div class="dm-spinner"></div></div>';
        
        // Fetch the latest group info
        fetch(`/group-chat/${groupChat.id}/messages/`)
            .then(response => response.json())
            .then(data => {
                membersList.innerHTML = '';
                
                if (data.success) {
                    const groupInfo = data.group_info || {};
                    const members = groupInfo.members || [];
                    
                    if (members.length === 0) {
                        membersList.innerHTML = '<div class="dm-empty-state">No members found</div>';
                    } else {
                        // Add each member to the list
                        members.forEach(member => {
                            const memberItem = document.createElement('div');
                            memberItem.className = 'dm-group-info-member-item';
                            
                            // Add creator/admin badge if applicable
                            let adminBadge = '';
                            if (member.id === groupInfo.creator_id) {
                                adminBadge = '<span class="dm-admin-badge">Creator</span>';
                            }
                            
                            // Add "You" indicator for current user
                            const nameText = member.id === currentUserId ? `${member.name} (You)` : member.name;
                            
                            memberItem.innerHTML = `
                                <div class="dm-member-avatar">
                                    <img src="${member.profile_picture || 'https://via.placeholder.com/40'}" alt="${member.name}" class="dm-member-img">
                                </div>
                                <div class="dm-member-details">
                                    <h5 class="dm-member-name">${nameText}</h5>
                                    <span class="dm-member-role">${member.role || 'User'}</span>
                                </div>
                                ${adminBadge}
                            `;
                            
                            membersList.appendChild(memberItem);
                        });
                        
                        // Add appropriate action buttons to the leave group button
                        const leaveGroupBtn = document.getElementById('dmLeaveGroupBtn');
                        
                        // If current user is creator/admin, show different text
                        if (currentUserId === groupInfo.creator_id) {
                            leaveGroupBtn.innerHTML = '<i class="bi bi-x-circle"></i> Delete Group';
                        } else {
                            leaveGroupBtn.innerHTML = '<i class="bi bi-box-arrow-right"></i> Leave Group';
                        }
                        
                        // Set up leave/delete group action
                        leaveGroupBtn.onclick = () => {
                            const confirmMessage = currentUserId === groupInfo.creator_id
                                ? 'Are you sure you want to delete this group chat? This action cannot be undone.'
                                : 'Are you sure you want to leave this group chat?';
                                
                            if (confirm(confirmMessage)) {
                                leaveGroupChat(groupChat.id);
                            }
                        };
                    }
                } else {
                    membersList.innerHTML = `<div class="dm-empty-state">Error loading members: ${data.error || 'Unknown error'}</div>`;
                }
            })
            .catch(error => {
                console.error('Error loading group info:', error);
                membersList.innerHTML = '<div class="dm-empty-state">Error loading members. Please try again.</div>';
            });
    }

    // Leave a group chat
    function leaveGroupChat(groupChatId) {
        // Send request to leave the group
        fetch(`/group-chat/${groupChatId}/member/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                action: 'remove',
                member_id: currentUserId
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Close any open chat windows for this group
                const chatWindow = document.querySelector(`.dm-group-chat-window[data-chat-id="${groupChatId}"]`);
                if (chatWindow) {
                    chatWindow.remove();
                }
                
                // Remove from active chats
                activeGroupChats = activeGroupChats.filter(id => id !== groupChatId);
                
                // Clear polling interval
                if (messagePollingIntervals[groupChatId]) {
                    clearInterval(messagePollingIntervals[groupChatId]);
                    delete messagePollingIntervals[groupChatId];
                }
                
                // Remove from the list
                const chatItem = document.querySelector(`.dm-group-chat-item[data-chat-id="${groupChatId}"]`);
                if (chatItem) {
                    chatItem.remove();
                }
                
                // Close the group info modal
                hideGroupInfoModal();
                
                // Show success message
                showToast(data.message || 'You have left the group chat');
                
                // Update the group chats list
                loadGroupChats();
            } else {
                // Show error message
                alert(data.error || 'Failed to leave group chat');
            }
        })
        .catch(error => {
            console.error('Error leaving group chat:', error);
            alert('Error leaving group chat. Please try again.');
        });
    }

    // Hide the group info modal
    function hideGroupInfoModal() {
        modalOverlay.style.display = 'none';
        document.getElementById('dmGroupInfoModal').style.display = 'none';
    }

    // Show create group chat modal
    function showCreateGroupModal() {
        // Reset the selected members
        selectedMembers = [];
        
        // Clear the group name input
        document.getElementById('dmGroupNameInput').value = '';
        
        // Clear the selected members list
        const selectedMembersList = document.getElementById('dmSelectedMembersList');
        selectedMembersList.innerHTML = '';
        
        // Update the selected members count
        document.getElementById('selectedMembersCount').textContent = '0';
        
        // Display the connections list
        populateConnectionsList();
        
        // Show the modal
        modalOverlay.style.display = 'block';
        document.getElementById('dmCreateGroupModal').style.display = 'block';
    }

    // Populate the connections list in the create group modal
    function populateConnectionsList() {
        const connectionsList = document.getElementById('dmConnectionsList');
        connectionsList.innerHTML = '<div class="dm-loading"><div class="dm-spinner"></div></div>';
        
        // Fetch the latest connections 
        fetch('/get-mutual-connections/')
            .then(response => response.json())
            .then(data => {
                connectionsList.innerHTML = '';
                
                if (data.success) {
                    userConnections = data.connections || [];
                    
                    if (userConnections.length === 0) {
                        // Show empty state if no connections found
                        const emptyState = document.createElement('div');
                        emptyState.className = 'dm-empty-state';
                        emptyState.innerHTML = `
                            <i class="bi bi-people"></i>
                            <p>No connections found</p>
                            <p class="dm-empty-state-hint">Connect with other users to add them to group chats.</p>
                        `;
                        connectionsList.appendChild(emptyState);
                        return;
                    }
                    
                    // Add each connection to the list
                    userConnections.forEach(user => {
                        // Clone the template
                        const memberItem = groupMemberItemTemplate.content.cloneNode(true);
                        
                        // Update the member item with user details
                        const memberItemEl = memberItem.querySelector('.dm-group-member-item');
                        memberItemEl.dataset.userId = user.id;
                        
                        const imgEl = memberItemEl.querySelector('.dm-member-img');
                        imgEl.src = user.profile_picture || 'https://via.placeholder.com/40';
                        imgEl.alt = user.name;
                        
                        const nameEl = memberItemEl.querySelector('.dm-member-name');
                        nameEl.textContent = user.name;
                        
                        const roleEl = memberItemEl.querySelector('.dm-member-role');
                        roleEl.textContent = user.role || 'User';
                        
                        // Set up add/remove buttons
                        const addBtn = memberItemEl.querySelector('.dm-add-member-btn');
                        const removeBtn = memberItemEl.querySelector('.dm-remove-member-btn');
                        
                        // Show the add button initially
                        addBtn.style.display = 'block';
                        removeBtn.style.display = 'none';
                        
                        // Add event listeners
                        addBtn.addEventListener('click', () => {
                            // Add to selected members
                            selectedMembers.push(user);
                            
                            // Update UI
                            addBtn.style.display = 'none';
                            removeBtn.style.display = 'block';
                            
                            // Add to selected members list
                            addToSelectedMembersList(user);
                        });
                        
                        removeBtn.addEventListener('click', () => {
                            // Remove from selected members
                            selectedMembers = selectedMembers.filter(member => member.id !== user.id);
                            
                            // Update UI
                            addBtn.style.display = 'block';
                            removeBtn.style.display = 'none';
                            
                            // Remove from selected members list
                            removeFromSelectedMembersList(user.id);
                        });
                        
                        // Add to the list
                        connectionsList.appendChild(memberItemEl);
                    });
                } else {
                    // Show error state
                    connectionsList.innerHTML = `
                        <div class="dm-empty-state">
                            <i class="bi bi-exclamation-circle"></i>
                            <p>Error loading connections</p>
                            <p class="dm-empty-state-hint">${data.error || 'Please try again later.'}</p>
                        </div>
                    `;
                }
            })
            .catch(error => {
                console.error('Error loading connections:', error);
                
                // Show error state
                connectionsList.innerHTML = `
                    <div class="dm-empty-state">
                        <i class="bi bi-exclamation-circle"></i>
                        <p>Error loading connections</p>
                        <p class="dm-empty-state-hint">Please check your connection and try again.</p>
                    </div>
                `;
            });
    }

    // Add a member to the selected members list
    function addToSelectedMembersList(user) {
        const selectedMembersList = document.getElementById('dmSelectedMembersList');
        
        // Create a selected member item
        const memberItem = document.createElement('div');
        memberItem.className = 'dm-selected-member-item';
        memberItem.dataset.userId = user.id;
        memberItem.innerHTML = `
            <div class="dm-selected-member-avatar">
                <img src="${user.profile_picture || 'https://via.placeholder.com/30'}" alt="${user.name}" class="dm-selected-member-img">
            </div>
            <div class="dm-selected-member-name">${user.name}</div>
            <button class="dm-remove-selected-btn">
                <i class="bi bi-x"></i>
            </button>
        `;
        
        // Add event listener to the remove button
        const removeBtn = memberItem.querySelector('.dm-remove-selected-btn');
        removeBtn.addEventListener('click', () => {
            // Remove from selected members
            selectedMembers = selectedMembers.filter(member => member.id !== user.id);
            
            // Update UI
            memberItem.remove();
            
            // Update the count
            document.getElementById('selectedMembersCount').textContent = selectedMembers.length;
            
            // Update the original connection list item
            const connectionItem = document.querySelector(`.dm-group-member-item[data-user-id="${user.id}"]`);
            if (connectionItem) {
                connectionItem.querySelector('.dm-add-member-btn').style.display = 'block';
                connectionItem.querySelector('.dm-remove-member-btn').style.display = 'none';
            }
        });
        
        // Add to the list
        selectedMembersList.appendChild(memberItem);
        
        // Update the count
        document.getElementById('selectedMembersCount').textContent = selectedMembers.length;
    }

    // Remove a member from the selected members list
    function removeFromSelectedMembersList(userId) {
        const selectedMemberItem = document.querySelector(`.dm-selected-member-item[data-user-id="${userId}"]`);
        if (selectedMemberItem) {
            selectedMemberItem.remove();
        }
        
        // Update the count
        document.getElementById('selectedMembersCount').textContent = selectedMembers.length;
    }

    // Create a new group chat
    function createNewGroupChat() {
        const groupName = document.getElementById('dmGroupNameInput').value.trim();
        
        // Validate inputs
        if (!groupName) {
            alert('Please enter a group name');
            return;
        }
        
        if (selectedMembers.length === 0) {
            alert('Please select at least one member');
            return;
        }
        
        // Disable the create button and show loading state
        const createBtn = document.getElementById('dmCreateGroupSubmitBtn');
        const originalText = createBtn.textContent;
        createBtn.disabled = true;
        createBtn.innerHTML = '<div class="dm-spinner-sm"></div> Creating...';
        
        // Get the member IDs to send to the server
        const memberIds = selectedMembers.map(member => member.id);
        
        // Send the create request to the server
        fetch('/create-group-chat/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                name: groupName,
                members: memberIds
            })
        })
        .then(response => response.json())
        .then(data => {
            // Reset the button state
            createBtn.disabled = false;
            createBtn.textContent = originalText;
            
            if (data.success) {
                // Close the modal
                hideCreateGroupModal();
                
                // Reload group chats to include the new one
                loadGroupChats();
                
                // Show success message
                showToast('Group chat created successfully');
            } else {
                // Show error message
                alert('Error creating group chat: ' + (data.error || 'Please try again'));
            }
        })
        .catch(error => {
            console.error('Error creating group chat:', error);
            
            // Reset the button state
            createBtn.disabled = false;
            createBtn.textContent = originalText;
            
            // Show error message
            alert('Error creating group chat. Please try again.');
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
    
    // Show a toast message
    function showToast(message) {
        // Create toast element if it doesn't exist
        let toastContainer = document.querySelector('.dm-toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'dm-toast-container';
            document.body.appendChild(toastContainer);
        }
        
        // Create the toast
        const toast = document.createElement('div');
        toast.className = 'dm-toast';
        toast.textContent = message;
        
        // Add to container
        toastContainer.appendChild(toast);
        
        // Show the toast
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Remove after delay
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }

    // Hide the create group modal
    function hideCreateGroupModal() {
        modalOverlay.style.display = 'none';
        document.getElementById('dmCreateGroupModal').style.display = 'none';
    }

    // Update the badge count in the group chats tab
    function updateGroupChatBadge() {
        // Count unread messages across all group chats
        const chatItems = document.querySelectorAll('.dm-group-chat-item');
        let totalUnread = 0;
        
        chatItems.forEach(item => {
            const badge = item.querySelector('.dm-chat-item-badge');
            if (badge && badge.style.display !== 'none') {
                // Parse the badge text as a number
                const unreadCount = parseInt(badge.textContent, 10) || 0;
                totalUnread += unreadCount;
            }
        });
        
        // Update the badge in the tab
        const badge = document.getElementById('dmGroupChatsBadge');
        badge.textContent = totalUnread;
        badge.style.display = totalUnread > 0 ? 'flex' : 'none';
    }

    // Helper: Format the last message time for display
    function formatLastMessageTime(timestamp) {
        if (!timestamp) return '';
        
        const now = new Date();
        const messageDate = new Date(timestamp);
        
        // If today, show time
        if (now.toDateString() === messageDate.toDateString()) {
            return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        // If this week, show day
        const dayDiff = (now - messageDate) / (1000 * 60 * 60 * 24);
        if (dayDiff < 7) {
            return messageDate.toLocaleDateString([], { weekday: 'short' });
        }
        
        // Otherwise show date
        return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    // Helper: Format message time
    function formatMessageTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Set up event listeners for the group chat functionality
    function setupEventListeners() {
        // Create group chat button
        createGroupBtn.addEventListener('click', showCreateGroupModal);
        
        // Group modal close button
        document.getElementById('dmGroupModalCloseBtn').addEventListener('click', hideCreateGroupModal);
        
        // Group modal cancel button
        document.getElementById('dmCancelGroupBtn').addEventListener('click', hideCreateGroupModal);
        
        // Group modal create button
        document.getElementById('dmCreateGroupSubmitBtn').addEventListener('click', createNewGroupChat);
        
        // Group info modal close button
        document.getElementById('dmGroupInfoCloseBtn').addEventListener('click', hideGroupInfoModal);
        
        // Search input for filtering connections
        const searchInput = document.getElementById('dmGroupMemberSearch');
        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase();
            
            // Filter the connections list based on the search term
            const connectionItems = document.querySelectorAll('.dm-group-member-item');
            connectionItems.forEach(item => {
                const name = item.querySelector('.dm-member-name').textContent.toLowerCase();
                if (name.includes(searchTerm)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        });
        
        // Modal overlay click to close
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                hideCreateGroupModal();
                hideGroupInfoModal();
            }
        });
        
        // Group chats tab click (to refresh)
        const groupChatsTab = document.getElementById('dmGroupChatsTab');
        if (groupChatsTab) {
            groupChatsTab.addEventListener('click', () => {
                // Refresh group chats list when tab is clicked
                loadGroupChats();
            });
        }
    }

    // Initialize when the page loads
    initGroupChat();
});// group_chat.js - Group Chat functionality for EduLink messaging system

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const createGroupBtn = document.getElementById('dmCreateGroupBtn');
    const groupChatsList = document.getElementById('dmGroupChatsList');
    const modalOverlay = document.getElementById('dmModalOverlay');
    const chatWindowsContainer = document.getElementById('dmChatWindowsContainer');
    
    // Templates
    const groupChatItemTemplate = document.getElementById('dmGroupChatItemTemplate');
    const groupChatWindowTemplate = document.getElementById('dmGroupChatWindowTemplate');
    const groupMemberItemTemplate = document.getElementById('dmGroupMemberItemTemplate');
    
    // Current user ID from the global variable
    const currentUserId = window.currentUserId;
    
    // State
    let userConnections = []; // Will store the users who are mutual connections
    let activeGroupChats = []; // Will store the active group chats
    let selectedMembers = []; // Will store the selected members for new group chat

    // Create group chat modal HTML
    const createGroupChatModal = document.createElement('div');
    createGroupChatModal.className = 'dm-new-message-modal dm-group-chat-modal';
    createGroupChatModal.id = 'dmCreateGroupModal';
    createGroupChatModal.innerHTML = `
        <div class="dm-modal-header">
            <h4>Create Group Chat</h4>
            <button class="dm-modal-close-btn" id="dmGroupModalCloseBtn">
                <i class="bi bi-x-lg"></i>
            </button>
        </div>
        <div class="dm-modal-body">
            <div class="dm-group-name-input">
                <label for="dmGroupNameInput">Group Name:</label>
                <input type="text" id="dmGroupNameInput" placeholder="Enter group name">
            </div>
            <div class="dm-group-members-section">
                <h5>Add Members</h5>
                <div class="dm-recipient-search">
                    <input type="text" id="dmGroupMemberSearch" placeholder="Search connections">
                </div>
                <div class="dm-connections-list" id="dmConnectionsList"></div>
                <div class="dm-selected-members">
                    <h5>Selected Members (<span id="selectedMembersCount">0</span>)</h5>
                    <div id="dmSelectedMembersList"></div>
                </div>
            </div>
        </div>
        <div class="dm-modal-footer">
            <button class="dm-secondary-btn" id="dmCancelGroupBtn">Cancel</button>
            <button class="dm-primary-btn" id="dmCreateGroupSubmitBtn">Create Group</button>
        </div>
    `;
    document.body.appendChild(createGroupChatModal);

    // Initialize group chat functionality
    function initGroupChat() {
        // Load existing group chats
        loadGroupChats();
        
        // Fetch user connections (mutual follows)
        fetchUserConnections();
        
        // Set up event listeners
        setupEventListeners();
    }

    // Fetch the user's connections (people who follow the user and the user follows them)
    function fetchUserConnections() {
        // First get the list of users the current user is following
        fetch('/get_following/')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Store the list of connections temporarily
                    const followingList = data.following;
                    
                    // For each user in the following list, check if they follow the current user back
                    // This would typically be a server-side check, but for now we'll simulate it
                    // In a real implementation, you'd have an API endpoint to get mutual connections
                    
                    // For demo purposes, we'll assume all connections are mutual
                    userConnections = followingList;
                    console.log('Loaded connections:', userConnections);
                }
            })
            .catch(error => {
                console.error('Error fetching connections:', error);
            });
    }

    // Load existing group chats from the server
    function loadGroupChats() {
        // Show loading state
        groupChatsList.innerHTML = `
            <div class="dm-loading-chats">
                <div class="dm-spinner"></div>
                <p>Loading group chats...</p>
            </div>
        `;
        
        // Fetch group chats from the server
        fetch('/get-group-chats/')
            .then(response => response.json())
            .then(data => {
                // Clear loading state
                groupChatsList.innerHTML = '';
                
                if (data.success) {
                    const groupChats = data.group_chats || [];
                    
                    if (groupChats.length === 0) {
                        // Show empty state if no group chats exist
                        const emptyState = document.createElement('div');
                        emptyState.className = 'dm-empty-state';
                        emptyState.innerHTML = `
                            <i class="bi bi-people"></i>
                            <p>No group chats yet</p>
                            <p class="dm-empty-state-hint">Create a new group chat to start collaborating with others.</p>
                        `;
                        groupChatsList.appendChild(emptyState);
                    } else {
                        // Add each group chat to the list
                        groupChats.forEach(chat => {
                            addGroupChatToList(chat);
                        });
                    }
                    
                    // Update the badge count
                    updateGroupChatBadge();
                } else {
                    // Show error state
                    const errorState = document.createElement('div');
                    errorState.className = 'dm-empty-state';
                    errorState.innerHTML = `
                        <i class="bi bi-exclamation-circle"></i>
                        <p>Error loading group chats</p>
                        <p class="dm-empty-state-hint">${data.error || 'Please try again later.'}</p>
                    `;
                    groupChatsList.appendChild(errorState);
                }
            })
            .catch(error => {
                console.error('Error loading group chats:', error);
                
                // Show error state
                groupChatsList.innerHTML = `
                    <div class="dm-empty-state">
                        <i class="bi bi-exclamation-circle"></i>
                        <p>Error loading group chats</p>
                        <p class="dm-empty-state-hint">Please check your connection and try again.</p>
                    </div>
                `;
            });
    }

    // Add a group chat to the list in the sidebar
    function addGroupChatToList(groupChat) {
        // Clone the template
        const groupChatItem = groupChatItemTemplate.content.cloneNode(true);
        
        // Update the chat item with group chat details
        const chatItemEl = groupChatItem.querySelector('.dm-group-chat-item');
        chatItemEl.dataset.chatId = groupChat.id;
        
        const nameEl = chatItemEl.querySelector('.dm-chat-item-name');
        nameEl.textContent = groupChat.name;
        
        const timeEl = chatItemEl.querySelector('.dm-chat-item-time');
        timeEl.textContent = formatLastMessageTime(groupChat.lastMessageTime);
        
        const lastMessageEl = chatItemEl.querySelector('.dm-chat-item-last-message');
        lastMessageEl.textContent = groupChat.lastMessage || 'No messages yet';
        
        const membersCountEl = chatItemEl.querySelector('.dm-members-count');
        membersCountEl.textContent = groupChat.members.length;
        
        // Add badge if there are unread messages
        const badgeEl = chatItemEl.querySelector('.dm-chat-item-badge');
        if (groupChat.unreadCount && groupChat.unreadCount > 0) {
            badgeEl.textContent = groupChat.unreadCount > 99 ? '99+' : groupChat.unreadCount;
            badgeEl.style.display = 'flex';
        } else {
            badgeEl.style.display = 'none';
        }
        
        // Add click event to open the group chat
        chatItemEl.addEventListener('click', () => {
            openGroupChat(groupChat);
        });
        
        // Add to the list
        groupChatsList.appendChild(chatItemEl);
        
        // Update the badge count in the tab
        updateGroupChatBadge();
    }

    // Open a group chat window
    function openGroupChat(groupChat) {
        // Check if the chat is already open
        const existingChat = document.querySelector(`.dm-group-chat-window[data-chat-id="${groupChat.id}"]`);
        if (existingChat) {
            // Focus on existing chat
            existingChat.classList.add('active');
            return;
        }
        
        // Clone the template
        const groupChatWindow = groupChatWindowTemplate.content.cloneNode(true);
        
        // Update the window with group chat details
        const windowEl = groupChatWindow.querySelector('.dm-group-chat-window');
        windowEl.dataset.chatId = groupChat.id;
        
        const nameEl = windowEl.querySelector('.dm-chat-group-name');
        nameEl.textContent = groupChat.name;
        
        const membersCountEl = windowEl.querySelector('.dm-chat-members-count');
        membersCountEl.textContent = `${groupChat.members.length} members`;
        
        // Add event listeners for chat window actions
        setupGroupChatWindowEvents(windowEl, groupChat);
        
        // Add to the container
        chatWindowsContainer.appendChild(windowEl);
        
        // Load chat messages
        loadGroupChatMessages(windowEl, groupChat.id);
        
        // Add to active chats
        activeGroupChats.push(groupChat.id);
    }

    // Load messages for a group chat
    function loadGroupChatMessages(chatWindow, groupChatId) {
        const messagesContainer = chatWindow.querySelector('.dm-chat-messages');
        
        // Show loading spinner
        messagesContainer.innerHTML = `
            <div class="dm-chat-loading">
                <div class="dm-spinner"></div>
            </div>
        `;
        
        // Fetch messages from the server
        fetch(`/group-chat/${groupChatId}/messages/`)
            .then(response => response.json())
            .then(data => {
                // Clear loading spinner
                messagesContainer.innerHTML = '';
                
                if (data.success) {
                    const messages = data.messages || [];
                    const groupInfo = data.group_info || {};
                    
                    // Update chat window with group info
                    const nameEl = chatWindow.querySelector('.dm-chat-group-name');
                    nameEl.textContent = groupInfo.name || 'Group Chat';
                    
                    const membersCountEl = chatWindow.querySelector('.dm-chat-members-count');
                    const memberCount = groupInfo.members ? groupInfo.members.length : 0;
                    membersCountEl.textContent = `${memberCount} members`;
                    
                    if (messages.length === 0) {
                        // Show empty state if no messages
                        const emptyState = document.createElement('div');
                        emptyState.className = 'dm-empty-chat-state';
                        emptyState.innerHTML = `
                            <i class="bi bi-chat-text"></i>
                            <p>No messages yet</p>
                            <p class="dm-empty-state-hint">Send a message to start the conversation.</p>
                        `;
                        messagesContainer.appendChild(emptyState);
                    } else {
                        // Add messages to the container
                        messages.forEach(message => {
                            const messageEl = document.createElement('div');
                            messageEl.className = 'dm-message';
                            
                            // Check if this message was sent by the current user
                            if (message.sender_id === currentUserId) {
                                messageEl.classList.add('sent');
                            }
                            
                            // Find the sender's name
                            let senderName = 'Unknown';
                            if (groupInfo.members) {
                                const sender = groupInfo.members.find(member => member.id === message.sender_id);
                                if (sender) {
                                    senderName = sender.name;
                                }
                            }
                            
                            // Add sender name for messages not from the current user
                            let headerHTML = '';
                            if (message.sender_id !== currentUserId) {
                                headerHTML = `<div class="dm-message-sender">${senderName}</div>`;
                            }
                            
                            // Format the message timestamp
                            const timestamp = message.timestamp ? new Date(message.timestamp) : new Date();
                            const formattedTime = formatMessageTime(timestamp);
                            
                            // Set message content
                            messageEl.innerHTML = `
                                ${headerHTML}
                                <div class="dm-message-content">${message.content}</div>
                                <div class="dm-message-footer">
                                    <span class="dm-message-time">${formattedTime}</span>
                                    <div class="dm-message-status">
                                        ${message.sender_id === currentUserId ? '<i class="bi bi-check"></i>' : ''}
                                    </div>
                                </div>
                            `;
                            
                            messagesContainer.appendChild(messageEl);
                        });
                        
                        // Scroll to the bottom
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                } else {
                    // Show error state
                    messagesContainer.innerHTML = `
                        <div class="dm-chat-error">
                            <i class="bi bi-exclamation-circle"></i>
                            <p>Error loading messages</p>
                            <p class="dm-error-hint">${data.error || 'Please try again later.'}</p>
                        </div>
                    `;
                }
            })
            .catch(error => {
                console.error('Error loading group chat messages:', error);
                
                // Show error state
                messagesContainer.innerHTML = `
                    <div class="dm-chat-error">
                        <i class="bi bi-exclamation-circle"></i>
                        <p>Error loading messages</p>
                        <p class="dm-error-hint">Please check your connection and try again.</p>
                    </div>
                `;
            });
    }

    // Setup events for a group chat window
    function setupGroupChatWindowEvents(chatWindow, groupChat) {
        // Minimize button
        const minimizeBtn = chatWindow.querySelector('.dm-minimize-chat-btn');
        minimizeBtn.addEventListener('click', () => {
            chatWindow.classList.toggle('minimized');
        });
        
        // Close button
        const closeBtn = chatWindow.querySelector('.dm-close-chat-btn');
        closeBtn.addEventListener('click', () => {
            chatWindow.remove();
            activeGroupChats = activeGroupChats.filter(id => id !== groupChat.id);
        });
        
        // Group info button
        const infoBtn = chatWindow.querySelector('.dm-group-info-btn');
        infoBtn.addEventListener('click', () => {
            showGroupInfo(groupChat);
        });
        
        // Send message button
        const sendBtn = chatWindow.querySelector('.dm-send-message-btn');
        const messageInput = chatWindow.querySelector('.dm-chat-input');
        
        sendBtn.addEventListener('click', () => {
            sendGroupMessage(messageInput, groupChat.id);
        });
        
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendGroupMessage(messageInput, groupChat.id);
            }
        });
    }

    // Send a message in a group chat
    function sendGroupMessage(inputElement, groupChatId) {
        const messageText = inputElement.value.trim();
        if (!messageText) return;
        
        // Clear the input
        inputElement.value = '';
        
        // Create a temporary message element with pending status
        const chatWindow = document.querySelector(`.dm-group-chat-window[data-chat-id="${groupChatId}"]`);
        const messagesContainer = chatWindow.querySelector('.dm-chat-messages');
        
        // Check if this is the first message
        const emptyState = messagesContainer.querySelector('.dm-empty-chat-state');
        if (emptyState) {
            messagesContainer.innerHTML = '';
        }
        
        // Create and add the temporary message
        const messageEl = document.createElement('div');
        messageEl.className = 'dm-message sent pending';
        messageEl.innerHTML = `
            <div class="dm-message-content">${messageText}</div>
            <div class="dm-message-footer">
                <span class="dm-message-time">${formatMessageTime(new Date())}</span>
                <div class="dm-message-status">
                    <div class="dm-message-sending-spinner"></div>
                </div>
            </div>
        `;
        
        messagesContainer.appendChild(messageEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Send the message to the server
        fetch(`/group-chat/${groupChatId}/messages/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                message: messageText
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Update the temporary message with sent status
                messageEl.classList.remove('pending');
                const statusEl = messageEl.querySelector('.dm-message-status');
                statusEl.innerHTML = '<i class="bi bi-check"></i>';
                
                // Update the group chat list to show this is the latest message
                updateGroupChatLastMessage(groupChatId, messageText);
            } else {
                // Show error status
                messageEl.classList.remove('pending');
                messageEl.classList.add('error');
                const statusEl = messageEl.querySelector('.dm-message-status');
                statusEl.innerHTML = '<i class="bi bi-exclamation-circle"></i>';
                
                // Show error tooltip
                const errorTooltip = document.createElement('div');
                errorTooltip.className = 'dm-message-error-tooltip';
                errorTooltip.textContent = data.error || 'Failed to send';
                messageEl.appendChild(errorTooltip);
                
                // Hide tooltip after a few seconds
                setTimeout(() => {
                    errorTooltip.remove();
                }, 3000);
            }
        })
        .catch(error => {
            console.error('Error sending message:', error);
            
            // Show error status
            messageEl.classList.remove('pending');
            messageEl.classList.add('error');
            const statusEl = messageEl.querySelector('.dm-message-status');
            statusEl.innerHTML = '<i class="bi bi-exclamation-circle"></i>';
            
            // Show retry button
            const retryBtn = document.createElement('button');
            retryBtn.className = 'dm-message-retry-btn';
            retryBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Retry';
            messageEl.appendChild(retryBtn);
            
            // Add retry functionality
            retryBtn.addEventListener('click', () => {
                // Remove error classes and retry button
                messageEl.classList.remove('error');
                messageEl.classList.add('pending');
                retryBtn.remove();
                
                // Update status
                const statusEl = messageEl.querySelector('.dm-message-status');
                statusEl.innerHTML = '<div class="dm-message-sending-spinner"></div>';
                
                // Retry sending the message
                sendGroupMessage({ value: messageText }, groupChatId);
            });
        });
    }
    
    // Update a group chat's last message in the list
    function updateGroupChatLastMessage(groupChatId, lastMessage) {
        const chatItem = document.querySelector(`.dm-group-chat-item[data-chat-id="${groupChatId}"]`);
        if (chatItem) {
            const lastMessageEl = chatItem.querySelector('.dm-chat-item-last-message');
            if (lastMessageEl) {
                lastMessageEl.textContent = lastMessage;
            }
            
            const timeEl = chatItem.querySelector('.dm-chat-item-time');
            if (timeEl) {
                timeEl.textContent = formatLastMessageTime(new Date());
            }
            
            // Move the chat item to the top of the list
            const chatsList = chatItem.parentElement;
            if (chatsList && chatsList.firstChild !== chatItem) {
                chatsList.insertBefore(chatItem, chatsList.firstChild);
            }
        }
    }

    // Show group information modal
    function showGroupInfo(groupChat) {
        // Create a modal to display group information
        // This would typically show the list of members, allow adding/removing members, etc.
        alert(`Group Info: ${groupChat.name}\nMembers: ${groupChat.members.length}`);
        
        // In a real implementation, you would create a proper modal for this
    }

    // Show create group chat modal
    function showCreateGroupModal() {
        // Reset the selected members
        selectedMembers = [];
        
        // Clear the group name input
        document.getElementById('dmGroupNameInput').value = '';
        
        // Clear the selected members list
        const selectedMembersList = document.getElementById('dmSelectedMembersList');
        selectedMembersList.innerHTML = '';
        
        // Update the selected members count
        document.getElementById('selectedMembersCount').textContent = '0';
        
        // Display the connections list
        populateConnectionsList();
        
        // Show the modal
        modalOverlay.style.display = 'block';
        document.getElementById('dmCreateGroupModal').style.display = 'block';
    }

    // Populate the connections list in the create group modal
    function populateConnectionsList() {
        const connectionsList = document.getElementById('dmConnectionsList');
        connectionsList.innerHTML = '';
        
        if (userConnections.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'dm-empty-state';
            emptyState.innerHTML = `
                <i class="bi bi-people"></i>
                <p>No connections found</p>
                <p class="dm-empty-state-hint">Connect with other users to add them to group chats.</p>
            `;
            connectionsList.appendChild(emptyState);
            return;
        }
        
        // Add each connection to the list
        userConnections.forEach(user => {
            // Clone the template
            const memberItem = groupMemberItemTemplate.content.cloneNode(true);
            
            // Update the member item with user details
            const memberItemEl = memberItem.querySelector('.dm-group-member-item');
            memberItemEl.dataset.userId = user.id;
            
            const imgEl = memberItemEl.querySelector('.dm-member-img');
            imgEl.src = user.profile_picture || 'https://via.placeholder.com/40';
            imgEl.alt = user.name;
            
            const nameEl = memberItemEl.querySelector('.dm-member-name');
            nameEl.textContent = user.name;
            
            const roleEl = memberItemEl.querySelector('.dm-member-role');
            roleEl.textContent = user.role || 'User';
            
            // Set up add/remove buttons
            const addBtn = memberItemEl.querySelector('.dm-add-member-btn');
            const removeBtn = memberItemEl.querySelector('.dm-remove-member-btn');
            
            // Show the add button initially
            addBtn.style.display = 'block';
            removeBtn.style.display = 'none';
            
            // Add event listeners
            addBtn.addEventListener('click', () => {
                // Add to selected members
                selectedMembers.push(user);
                
                // Update UI
                addBtn.style.display = 'none';
                removeBtn.style.display = 'block';
                
                // Add to selected members list
                addToSelectedMembersList(user);
            });
            
            removeBtn.addEventListener('click', () => {
                // Remove from selected members
                selectedMembers = selectedMembers.filter(member => member.id !== user.id);
                
                // Update UI
                addBtn.style.display = 'block';
                removeBtn.style.display = 'none';
                
                // Remove from selected members list
                removeFromSelectedMembersList(user.id);
            });
            
            // Add to the list
            connectionsList.appendChild(memberItemEl);
        });
    }

    // Add a member to the selected members list
    function addToSelectedMembersList(user) {
        const selectedMembersList = document.getElementById('dmSelectedMembersList');
        
        // Create a selected member item
        const memberItem = document.createElement('div');
        memberItem.className = 'dm-selected-member-item';
        memberItem.dataset.userId = user.id;
        memberItem.innerHTML = `
            <div class="dm-selected-member-avatar">
                <img src="${user.profile_picture || 'https://via.placeholder.com/30'}" alt="${user.name}" class="dm-selected-member-img">
            </div>
            <div class="dm-selected-member-name">${user.name}</div>
            <button class="dm-remove-selected-btn">
                <i class="bi bi-x"></i>
            </button>
        `;
        
        // Add event listener to the remove button
        const removeBtn = memberItem.querySelector('.dm-remove-selected-btn');
        removeBtn.addEventListener('click', () => {
            // Remove from selected members
            selectedMembers = selectedMembers.filter(member => member.id !== user.id);
            
            // Update UI
            memberItem.remove();
            
            // Update the count
            document.getElementById('selectedMembersCount').textContent = selectedMembers.length;
            
            // Update the original connection list item
            const connectionItem = document.querySelector(`.dm-group-member-item[data-user-id="${user.id}"]`);
            if (connectionItem) {
                connectionItem.querySelector('.dm-add-member-btn').style.display = 'block';
                connectionItem.querySelector('.dm-remove-member-btn').style.display = 'none';
            }
        });
        
        // Add to the list
        selectedMembersList.appendChild(memberItem);
        
        // Update the count
        document.getElementById('selectedMembersCount').textContent = selectedMembers.length;
    }

    // Remove a member from the selected members list
    function removeFromSelectedMembersList(userId) {
        const selectedMemberItem = document.querySelector(`.dm-selected-member-item[data-user-id="${userId}"]`);
        if (selectedMemberItem) {
            selectedMemberItem.remove();
        }
        
        // Update the count
        document.getElementById('selectedMembersCount').textContent = selectedMembers.length;
    }

    // Create a new group chat
    function createNewGroupChat() {
        const groupName = document.getElementById('dmGroupNameInput').value.trim();
        
        // Validate inputs
        if (!groupName) {
            alert('Please enter a group name');
            return;
        }
        
        if (selectedMembers.length === 0) {
            alert('Please select at least one member');
            return;
        }
        
        // Disable the create button and show loading state
        const createBtn = document.getElementById('dmCreateGroupSubmitBtn');
        const originalText = createBtn.textContent;
        createBtn.disabled = true;
        createBtn.innerHTML = '<div class="dm-spinner-sm"></div> Creating...';
        
        // Get the member IDs to send to the server
        const memberIds = selectedMembers.map(member => member.id);
        
        // Send the create request to the server
        fetch('/create-group-chat/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                name: groupName,
                members: memberIds
            })
        })
        .then(response => response.json())
        .then(data => {
            // Reset the button state
            createBtn.disabled = false;
            createBtn.textContent = originalText;
            
            if (data.success) {
                // Close the modal
                hideCreateGroupModal();
                
                // Reload group chats to include the new one
                loadGroupChats();
                
                // Show success message
                showToast('Group chat created successfully');
            } else {
                // Show error message
                alert('Error creating group chat: ' + (data.error || 'Please try again'));
            }
        })
        .catch(error => {
            console.error('Error creating group chat:', error);
            
            // Reset the button state
            createBtn.disabled = false;
            createBtn.textContent = originalText;
            
            // Show error message
            alert('Error creating group chat. Please try again.');
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
    
    // Show a toast message
    function showToast(message) {
        // Create toast element if it doesn't exist
        let toastContainer = document.querySelector('.dm-toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'dm-toast-container';
            document.body.appendChild(toastContainer);
        }
        
        // Create the toast
        const toast = document.createElement('div');
        toast.className = 'dm-toast';
        toast.textContent = message;
        
        // Add to container
        toastContainer.appendChild(toast);
        
        // Show the toast
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Remove after delay
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }

    // Hide the create group modal
    function hideCreateGroupModal() {
        modalOverlay.style.display = 'none';
        document.getElementById('dmCreateGroupModal').style.display = 'none';
    }

    // Update the badge count in the group chats tab
    function updateGroupChatBadge() {
        // In a real implementation, you would calculate the total unread messages across all group chats
        const totalUnread = 0; // For demo purposes
        
        const badge = document.getElementById('dmGroupChatsBadge');
        badge.textContent = totalUnread;
        badge.style.display = totalUnread > 0 ? 'flex' : 'none';
    }

    // Helper: Format the last message time for display
    function formatLastMessageTime(timestamp) {
        if (!timestamp) return '';
        
        const now = new Date();
        const messageDate = new Date(timestamp);
        
        // If today, show time
        if (now.toDateString() === messageDate.toDateString()) {
            return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        // If this week, show day
        const dayDiff = (now - messageDate) / (1000 * 60 * 60 * 24);
        if (dayDiff < 7) {
            return messageDate.toLocaleDateString([], { weekday: 'short' });
        }
        
        // Otherwise show date
        return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    // Helper: Format message time
    function formatMessageTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Set up event listeners for the group chat functionality
    function setupEventListeners() {
        // Create group chat button
        createGroupBtn.addEventListener('click', showCreateGroupModal);
        
        // Group modal close button
        document.getElementById('dmGroupModalCloseBtn').addEventListener('click', hideCreateGroupModal);
        
        // Group modal cancel button
        document.getElementById('dmCancelGroupBtn').addEventListener('click', hideCreateGroupModal);
        
        // Group modal create button
        document.getElementById('dmCreateGroupSubmitBtn').addEventListener('click', createNewGroupChat);
        
        // Search input for filtering connections
        const searchInput = document.getElementById('dmGroupMemberSearch');
        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase();
            
            // Filter the connections list based on the search term
            const connectionItems = document.querySelectorAll('.dm-group-member-item');
            connectionItems.forEach(item => {
                const name = item.querySelector('.dm-member-name').textContent.toLowerCase();
                if (name.includes(searchTerm)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        });
        
        // Modal overlay click to close
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                hideCreateGroupModal();
            }
        });
    }

    // Initialize when the page loads
    initGroupChat();
});