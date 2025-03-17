/**
 * Complete summarization solution that intercepts the existing button behavior
 * and implements a standalone summarization feature.
 */

// Wait for the DOM to be fully loaded
window.addEventListener('load', function() {
    console.log("Summarization intercept script loaded");
    initializeSummarization();
});

// Initialize the summarization feature
function initializeSummarization() {
    // Find and intercept the summarize button
    interceptSummarizeButton();
    
   
    
    // Add required styles
    addSummarizationStyles();
}

// Helper function to get cookies (for CSRF token)
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

// Find and intercept the summarize button
function interceptSummarizeButton() {
    // Try to find the button by various means
    const buttons = document.querySelectorAll('button');
    let summarizeBtn = null;
    
    for (const btn of buttons) {
        const text = btn.textContent.toLowerCase();
        if (text.includes('summarise') || text.includes('summarize')) {
            summarizeBtn = btn;
            break;
        }
    }
    
    // If button not found, try more specific selectors
    if (!summarizeBtn) {
        summarizeBtn = document.getElementById('summariseButton');
    }
    
    if (!summarizeBtn) {
        const sortButtons = document.querySelectorAll('.sort-button');
        for (const btn of sortButtons) {
            const text = btn.textContent.toLowerCase();
            if (text.includes('summarise') || text.includes('summarize')) {
                summarizeBtn = btn;
                break;
            }
        }
    }
    
    if (summarizeBtn) {
        console.log("Found summarize button:", summarizeBtn);
        
        // Clone and replace to remove all existing event handlers
        const newBtn = summarizeBtn.cloneNode(true);
        summarizeBtn.parentNode.replaceChild(newBtn, summarizeBtn);
        
        // Add our own event handler
        newBtn.addEventListener('click', function(e) {
            // Prevent default behavior and stop propagation
            e.preventDefault();
            e.stopPropagation();
            
            console.log("Summarize button clicked - intercepted!");
            handleSummarizeClick();

            
            // Return false to prevent any other handlers
            return false;
        });
        
        console.log("Successfully intercepted summarize button");
    } else {
        console.warn("Could not find summarize button to intercept");
    }
}


// Handle summarize button click
function handleSummarizeClick() {
    console.log("Handling summarize click with graxe for the sake of it ");
    
    // Show overlay with loading indicator
    const contentContainer = showSummaryOverlay();
    
    // Find replies to summarize
    const replyContents = findRepliesToSummarize();
    
    // Check if we have replies
    if (!replyContents || replyContents.length === 0) {
        contentContainer.innerHTML = `
            <h3 style="margin-top: 0; margin-bottom: 15px; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Summary</h3>
            <div style="padding: 10px; background-color: #ffebee; border-left: 4px solid #f44336; color: #c62828;">
                <strong>Error:</strong> No replies found to summarize.
            </div>
        `;
        return;
    }
    
    
    // Get CSRF token
    const csrftoken = getCookie('csrftoken');
    
    // Make request to Django backend
    fetch('/summarize-replies/', {   
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken
        },
        body: JSON.stringify({ 
            replies: replyContents
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Received summary data:', data);
        
        if (data.success) {
            // Display the summary
            displayWordByWord(data.summary, contentContainer);
        } else {
            // Show error
            contentContainer.innerHTML = `
                <h3 style="margin-top: 0; margin-bottom: 15px; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Summary</h3>
                <div style="padding: 10px; background-color: #ffebee; border-left: 4px solid #f44336; color: #c62828;">
                    <strong>Error:</strong> ${data.error || 'Failed to generate summary'}
                </div>
            `;
        }
    })
    .catch(error => {
        console.error('Error getting summary:', error);
        
        // Show error message
        contentContainer.innerHTML = `
            <h3 style="margin-top: 0; margin-bottom: 15px; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Summary</h3>
            <div style="padding: 10px; background-color: #ffebee; border-left: 4px solid #f44336; color: #c62828;">
                <strong>Error:</strong> Not enough replies to generate summary
            </div>
        `;
    });
}

// Find replies to summarize
function findRepliesToSummarize() {
    // Try different selectors that might contain replies
    const selectors = [
        '#sidePanelMessages .reply-content',
        '.side-panel-message .reply-content',
        '.reply-content',
        '.side-panel-messages .reply',
        '.reply'
    ];
    
    let replies = [];
    
    // Try each selector until we find replies
    for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            console.log(`Found ${elements.length} replies using selector: ${selector}`);
            replies = Array.from(elements).map(el => el.textContent.trim());
            break;
        }
    }
    
    return replies;
}

// Show overlay with summary or loading indicator
function showSummaryOverlay(summaryText = null) {
    // Remove any existing overlay
    const existingOverlay = document.getElementById('summary-overlay');
    if (existingOverlay) {
        document.body.removeChild(existingOverlay);
    }
    
    // Create overlay container
    const overlay = document.createElement('div');
    overlay.id = 'summary-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    // Create the summary card
    const summaryCard = document.createElement('div');
    summaryCard.style.cssText = `
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        width: 90%;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        padding: 20px;
        position: relative;
    `;
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
    `;
    closeButton.onclick = function() {
        document.body.removeChild(overlay);
    };
    
    // Create content container
    const contentContainer = document.createElement('div');
    contentContainer.id = 'summary-content-container';
    
    // Add title
    const title = document.createElement('h3');
    title.textContent = 'Summary';
    title.style.cssText = `
        margin-top: 0;
        margin-bottom: 15px;
        border-bottom: 1px solid #ddd;
        padding-bottom: 10px;
    `;
    
    // Build the card
    contentContainer.appendChild(title);
    summaryCard.appendChild(closeButton);
    summaryCard.appendChild(contentContainer);
    overlay.appendChild(summaryCard);
    document.body.appendChild(overlay);
    
    // If summary text is provided, show it
    if (summaryText) {
        displayWordByWord(summaryText, contentContainer);
    } else {
        // Otherwise show loading
        contentContainer.innerHTML += `
            <div class="summary-loading">
                <div class="loading-spinner"></div>
                <span>Generating summary...</span>
            </div>
        `;
    }
    
    return contentContainer;
}

// Display text word by word with animation
function displayWordByWord(text, container) {
    // Clear the container first
    container.innerHTML = `
        <h3 style="margin-top: 0; margin-bottom: 15px; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Summary</h3>
    `;
    
    // Create content element
    const content = document.createElement('div');
    content.className = 'animated-text';
    container.appendChild(content);
    
    // Split text into words - preserve punctuation
    const words = text.split(/\s+/);
    let index = 0;
    
    // Create cursor element
    const cursor = document.createElement('span');
    cursor.className = 'typing-cursor';
    content.appendChild(cursor);
    
    // Function to add words one by one
    function addNextWord() {
        if (index < words.length) {
            // Create word span
            const wordSpan = document.createElement('span');
            wordSpan.className = 'word';
            
            // Add the word with a trailing space
            wordSpan.textContent = words[index];
            
            // Insert before cursor
            content.insertBefore(wordSpan, cursor);
            
            // Add a space as a separate text node after the word
            if (index < words.length - 1) {
                const space = document.createTextNode(' ');
                content.insertBefore(space, cursor);
            }
            
            // Trigger animation
            setTimeout(() => {
                wordSpan.classList.add('visible');
            }, 10);
            
            // Move to next word
            index++;
            
            // Add variable delay for natural effect
            const delay = Math.random() * 30 + 40; // 40-70ms
            setTimeout(addNextWord, delay);
        } else {
            // All words added, remove cursor
            cursor.remove();
            
            // Add "complete" indicator
            const complete = document.createElement('div');
            complete.innerHTML = '✓ Summary complete';
            complete.style.cssText = `
                margin-top: 15px;
                color: #4CAF50;
                font-size: 14px;
            `;
            container.appendChild(complete);
        }
    }
    
    // Start adding words
    addNextWord();
}





// Add required styles
function addSummarizationStyles() {
    // Check if already added
    if (document.getElementById('summarization-styles')) {
        return;
    }
    
    // Create style element
    const style = document.createElement('style');
    style.id = 'summarization-styles';
    style.textContent = `
        .summary-loading {
            display: flex;
            align-items: center;
            gap: 12px;
            color: #666;
        }
        
        .loading-spinner {
            width: 20px;
            height: 20px;
            border: 2px solid #f3f3f3;
            border-top: 2px solid #3498db;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        .animated-text {
            line-height: 1.6;
        }
        
        .word {
            display: inline-block;
            opacity: 0;
            transform: translateY(10px);
            transition: opacity 0.3s ease, transform 0.3s ease;
        }
        
        .word.visible {
            opacity: 1;
            transform: translateY(0);
        }
        
        .typing-cursor {
            display: inline-block;
            width: 2px;
            height: 1.2em;
            background-color: #333;
            margin-left: 2px;
            vertical-align: middle;
            animation: blink 0.7s infinite;
        }
        
        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        #floating-summarize-btn:hover {
            background-color: #45a049;
        }
    `;
    
    // Add to document head
    document.head.appendChild(style);
    console.log("Added summarization styles");
}



// Export functions for debugging
window.summarizeFunctions = {
    handleSummarizeClick: handleSummarizeClick,
    findRepliesToSummarize: findRepliesToSummarize,
    showSummaryOverlay: showSummaryOverlay,
    displayWordByWord: displayWordByWord
};

console.log("Summarization script fully loaded");
