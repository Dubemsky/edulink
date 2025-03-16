// private_messaging.js


// Add this at the top of your private_messaging.js file

// Debug helper function
function debugLog(message, obj = null) {
    console.log('%c[DEBUG] ' + message, 'background: #ffeb3b; color: black; padding: 2px 4px; border-radius: 2px;', obj || '');
  }
  
  document.addEventListener('DOMContentLoaded', function() {
    // Debug message to check if script is loaded
    debugLog('Messaging script loaded');
    
    /**
     * Check if all required elements exist in the DOM
     */
    function checkRequiredElements() {
      const elements = {
        'directMessagingButton': document.getElementById('directMessagingButton'),
        'directMessagingPanel': document.getElementById('directMessagingPanel'),
        'dmClosePanelBtn': document.getElementById('dmClosePanelBtn'),
        'dmPrimaryInboxList': document.getElementById('dmPrimaryInboxList'),
        'dmChatWindowsContainer': document.getElementById('dmChatWindowsContainer'),
        'dmChatItemTemplate': document.getElementById('dmChatItemTemplate'),
        'dmChatWindowTemplate': document.getElementById('dmChatWindowTemplate'),
        'dmMessageTemplate': document.getElementById('dmMessageTemplate')
      };
      
      debugLog('Checking required elements:');
      
      let allFound = true;
      for (const [name, element] of Object.entries(elements)) {
        const found = element !== null;
        debugLog(`- ${name}: ${found ? 'Found' : 'MISSING'}`);
        if (!found) allFound = false;
      }
      
      return allFound;
    }
    
    // Check if all required elements exist
    const allElementsExist = checkRequiredElements();
    debugLog(`All required elements exist: ${allElementsExist}`);
    
    // Add event listener with debug logs
    const dmButton = document.getElementById('directMessagingButton');
    const dmPanel = document.getElementById('directMessagingPanel');
    
    if (dmButton && dmPanel) {
      debugLog('Adding click event to messaging button');
      
      dmButton.addEventListener('click', function(event) {
        debugLog('Messaging button clicked');
        debugLog('Panel classes before:', dmPanel.className);
        
        // Check if we're actually showing the panel
        const wasVisible = dmPanel.classList.contains('show');
        debugLog(`Panel was ${wasVisible ? 'visible' : 'hidden'} before click`);
        
        // Toggle classes
        dmPanel.classList.toggle('show');
        this.classList.toggle('active');
        
        // Check if we're actually showing the panel now
        const isVisible = dmPanel.classList.contains('show');
        debugLog(`Panel is ${isVisible ? 'visible' : 'hidden'} after click`);
        debugLog('Panel classes after:', dmPanel.className);
        
        // Verify panel style
        const computedStyle = window.getComputedStyle(dmPanel);
        debugLog('Panel computed style:', {
          display: computedStyle.display,
          visibility: computedStyle.visibility,
          opacity: computedStyle.opacity,
          transform: computedStyle.transform
        });
        
        // If panel is showing, load messages
        if (dmPanel.classList.contains('show')) {
          debugLog('Panel is showing, initializing connections');
          if (window.privateMessagingConnections && 
              typeof window.privateMessagingConnections.initialize === 'function') {
            window.privateMessagingConnections.initialize();
          } else {
            debugLog('WARNING: privateMessagingConnections not available', window.privateMessagingConnections);
          }
        }
      });
    } else {
      debugLog('ERROR: Could not find messaging button or panel');
    }
  });
  

document.addEventListener('DOMContentLoaded', function() {
    /**
     * Initialize the Direct Messaging UI components and functionality
     */
    function initializeDirectMessaging() {
      console.log('Initializing direct messaging system...');
    
      // Toggle the messaging panel
      const dmButton = document.getElementById('directMessagingButton');
      const dmPanel = document.getElementById('directMessagingPanel');
      const dmCloseBtn = document.getElementById('dmClosePanelBtn');
      
      if (dmButton && dmPanel) {
        dmButton.addEventListener('click', function() {
          dmPanel.classList.toggle('show');
          this.classList.toggle('active');
          
          // If panel is showing, load messages
          if (dmPanel.classList.contains('show')) {
            if (window.privateMessagingConnections && 
                typeof window.privateMessagingConnections.initialize === 'function') {
              window.privateMessagingConnections.initialize();
            }
          }
        });
      }
      
      if (dmCloseBtn) {
        dmCloseBtn.addEventListener('click', function() {
          dmPanel.classList.remove('show');
          if (dmButton) dmButton.classList.remove('active');
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
      
      // Handle window resizing to adjust chat windows
      window.addEventListener('resize', function() {
        adjustChatWindowPositions();
      });
      
      // Initialize the chat windows container
      initializeChatWindowsContainer();
    }
    
    /**
     * Initialize the chat windows container
     */
    function initializeChatWindowsContainer() {
      const chatWindowsContainer = document.getElementById('dmChatWindowsContainer');
      
      // Make sure it exists
      if (!chatWindowsContainer) {
        console.error('Chat windows container not found');
        return;
      }
      
      // Set initial position
      adjustChatWindowPositions();
    }
    
    /**
     * Adjust the position of chat windows based on viewport
     */
    function adjustChatWindowPositions() {
      const chatWindowsContainer = document.getElementById('dmChatWindowsContainer');
      
      if (!chatWindowsContainer) return;
      
      // On mobile, take full width
      if (window.innerWidth < 768) {
        chatWindowsContainer.style.right = '0';
        chatWindowsContainer.style.left = '0';
        chatWindowsContainer.style.bottom = '0';
      } else {
        // On desktop, stay at the bottom-right
        chatWindowsContainer.style.right = '20px';
        chatWindowsContainer.style.left = 'auto';
        chatWindowsContainer.style.bottom = '20px';
      }
    }
    
    // Export methods to the global scope for access from other scripts
    window.directMessagingSystem = {
      initialize: initializeDirectMessaging,
      loadChats: function() {
        // If we have the connections module loaded, initialize it
        if (window.privateMessagingConnections && 
            typeof window.privateMessagingConnections.initialize === 'function') {
          window.privateMessagingConnections.initialize();
        }
      },
      openChat: function(chatId, userId, userName, userRole, userImg) {
        // If we have the connections module loaded, use it to open a chat
        if (window.privateMessagingConnections && 
            typeof window.privateMessagingConnections.openChatWithUser === 'function') {
          window.privateMessagingConnections.openChatWithUser({
            id: userId,
            name: userName,
            role: userRole,
            profile_picture: userImg
          });
        }
      },
      refreshUnreadCount: function(count) {
        const badge = document.getElementById('dmUnreadBadge');
        if (badge) {
          badge.textContent = count;
          badge.style.display = count > 0 ? 'flex' : 'none';
        }
      }
    };
    
    // Initialize the direct messaging system
    initializeDirectMessaging();
  });