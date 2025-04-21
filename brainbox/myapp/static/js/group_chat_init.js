// Add this script tag to your HTML page to integrate the group chat functionality
document.addEventListener('DOMContentLoaded', function() {
    // Load our updated group chat integration
    const script = document.createElement('script');
    script.textContent = `
      // Global variables needed for group chat functionality
      window.selectedMembers = [];
      window.activeGroupChats = [];
      window.groupChats = [];
  
      // Initialize group chat when DOM is loaded
      document.addEventListener('DOMContentLoaded', function() {
        // Initialize the group chat component
        initGroupChatComponent();
      });
    `;
    
    document.head.appendChild(script);
    
    // Make sure the modal overlay is properly styled
    const style = document.createElement('style');
    style.textContent = `
      .group-modal-overlay {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 1050;
      }
      
      .group-chat-modal {
        display: none;
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        max-width: 600px;
        width: 100%;
        max-height: 90vh;
        background-color: white;
        border-radius: 8px;
        z-index: 1051;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        overflow: hidden;
      }
      
      .group-modal-content {
        display: flex;
        flex-direction: column;
        height: 100%;
        max-height: 90vh;
      }
      
      .group-modal-header {
        padding: 15px 20px;
        border-bottom: 1px solid #e9ecef;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .group-modal-header h4 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
      }
      
      .group-modal-close-btn {
        background: transparent;
        border: none;
        font-size: 20px;
        color: #6c757d;
        cursor: pointer;
      }
      
      .group-modal-body {
        padding: 20px;
        flex-grow: 1;
        overflow-y: auto;
      }
      
      .group-name-input {
        margin-bottom: 20px;
      }
      
      .group-name-input label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
      }
      
      .group-name-input input {
        width: 100%;
        padding: 10px 15px;
        border: 1px solid #ced4da;
        border-radius: 4px;
        font-size: 15px;
      }
      
      .group-members-section h5 {
        margin-top: 0;
        margin-bottom: 10px;
        font-weight: 600;
      }
      
      .group-info-text {
        color: #6c757d;
        font-size: 14px;
        margin-bottom: 15px;
      }
      
      .group-members-search {
        margin-bottom: 15px;
      }
      
      .group-members-search input {
        width: 100%;
        padding: 10px 15px;
        border: 1px solid #ced4da;
        border-radius: 4px;
        font-size: 14px;
      }
      
      .group-available-members {
        max-height: 200px;
        overflow-y: auto;
        border: 1px solid #e9ecef;
        border-radius: 4px;
        margin-bottom: 20px;
      }
      
      .group-member-item {
        display: flex;
        align-items: center;
        padding: 10px 15px;
        border-bottom: 1px solid #f1f1f1;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      
      .group-member-item:last-child {
        border-bottom: none;
      }
      
      .group-member-item:hover {
        background-color: #f8f9fa;
      }
      
      .group-member-avatar {
        margin-right: 15px;
      }
      
      .group-member-img {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        object-fit: cover;
      }
      
      .group-member-details {
        flex-grow: 1;
      }
      
      .group-member-name {
        margin: 0;
        font-size: 15px;
        font-weight: 500;
      }
      
      .group-member-role {
        color: #6c757d;
        font-size: 13px;
      }
      
      .group-member-action {
        margin-left: auto;
      }
      
      .group-add-member-btn,
      .group-remove-member-btn {
        background: transparent;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        cursor: pointer;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        transition: all 0.2s;
      }
      
      .group-add-member-btn {
        color: var(--color-primary);
      }
      
      .group-add-member-btn:hover {
        background-color: rgba(var(--color-primary-rgb), 0.1);
      }
      
      .group-remove-member-btn {
        color: #dc3545;
      }
      
      .group-remove-member-btn:hover {
        background-color: rgba(220, 53, 69, 0.1);
      }
      
      .group-selected-members {
        margin-top: 20px;
      }
      
      .group-selected-members-list {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 10px;
      }
      
      .group-selected-member-badge {
        display: flex;
        align-items: center;
        background-color: #f1f1f1;
        border-radius: 20px;
        padding: 5px 10px;
        font-size: 14px;
      }
      
      .group-selected-member-img {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        object-fit: cover;
        margin-right: 8px;
      }
      
      .group-remove-selected-btn {
        background: transparent;
        border: none;
        color: #6c757d;
        margin-left: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        padding: 0;
        font-size: 14px;
      }
      
      .group-empty-selection {
        color: #6c757d;
        font-style: italic;
        font-size: 14px;
      }
      
      .group-modal-footer {
        padding: 15px 20px;
        border-top: 1px solid #e9ecef;
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
      
      .group-primary-btn,
      .group-secondary-btn {
        padding: 8px 20px;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .group-primary-btn {
        background-color: var(--color-primary);
        color: white;
        border: none;
      }
      
      .group-primary-btn:hover:not(:disabled) {
        background-color: var(--color-primary-dark);
      }
      
      .group-primary-btn:disabled {
        background-color: #adb5bd;
        cursor: not-allowed;
      }
      
      .group-secondary-btn {
        background-color: transparent;
        color: #6c757d;
        border: 1px solid #ced4da;
      }
      
      .group-secondary-btn:hover {
        background-color: #f8f9fa;
      }
      
      .group-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: white;
        animation: group-spin 0.8s linear infinite;
        display: inline-block;
        margin-right: 8px;
      }
      
      @keyframes group-spin {
        to {
          transform: rotate(360deg);
        }
      }
      
      .group-chat-create-btn {
        margin-top: 10px;
        padding: 10px;
        background-color: var(--color-primary);
        color: white;
        border: none;
        border-radius: 4px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      
      .group-chat-create-btn:hover {
        background-color: var(--color-primary-dark);
      }
    `;
    
    document.head.appendChild(style);
    
    // Add the modal overlay element if not already present
    if (!document.getElementById('groupModalOverlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'groupModalOverlay';
      overlay.className = 'group-modal-overlay';
      document.body.appendChild(overlay);
    }
  });