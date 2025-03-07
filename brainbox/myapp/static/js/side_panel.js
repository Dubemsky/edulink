let currentMessageId = null;

function openSidePanel(messageContent, messageId) {
    console.log("This is the current room id ",djangoRoomId)
    const sidePanel = document.getElementById('side-panel');
    const panelTitle = document.getElementById('panel-title');
    const chatSection = document.querySelector('.chat-section');
    const rightSidebar = document.querySelector('.right-sidebar');

    if (sidePanel.classList.contains('open')) {
        // Close the side panel
        sidePanel.classList.remove('open');
        chatSection.style.marginLeft = '0';
        rightSidebar.style.marginLeft = '0';

        // Reset the URL to remove messageId
        const newUrl = `/students-dashboard/hub-room/${djangoRoomId}/`;
        window.history.pushState({ path: newUrl }, "", newUrl);

        // Reset the global messageId
        currentMessageId = null;
    } else {
        // Open the side panel
        panelTitle.textContent = messageContent;
        sidePanel.classList.add('open');
        chatSection.style.marginLeft = '250px';
        rightSidebar.style.marginLeft = 'none';

        // Store the messageId in the global variable
        currentMessageId = messageId;

        // Construct the correct URL format
        const newUrl = `/students-dashboard/hub-room/${djangoRoomId}/${currentMessageId}/`;
        window.history.pushState({ path: newUrl }, "", newUrl);

        // Fetch existing messages/replies for the messageId from the server
        fetch(newUrl, {
            method: "GET",
            headers: {
                "X-Requested-With": "XMLHttpRequest" // Identify it as an AJAX request
            }
        })
        .then(response => response.json()) // Expecting JSON response
        .then(data => {
            console.log("Received messages:", data);
            const messagesArea = document.getElementById('sidePanelMessages');
            messagesArea.innerHTML = '';  // Clear existing messages

            // Iterate through the messages and append them to the side panel
            data.forEach(message => {
                const messageElement = document.createElement('div');
                messageElement.classList.add('side-panel-message');

                // Update content based on new design
                messageElement.innerHTML = `
                    <div class="reply">
                    <div class="reply-header">
                        <span class="reply-info">${message.sender}</span>
                        <span class="reply-role">(${message.role})</span>
                    </div>
                    <p class="reply-content">${message.reply_content}</p>
                    
                    <div class="reply-footer">
                        <button class="vote-button upvote" data-reply-id="${message.reply_id}">
                            <i class="fa fa-arrow-up"></i>
                        </button>
                        <span class="vote-count" id="vote-count-${message.reply_id}">
                            ${message.upvotes - message.downvotes}
                        </span>
                        <button class="vote-button downvote" data-reply-id="${message.reply_id}">
                            <i class="fa fa-arrow-down"></i>
                        </button>
                    </div>
                    </div>
                `;
                messagesArea.appendChild(messageElement);

                // Add event listeners to vote buttons
                messageElement.querySelectorAll('.vote-button').forEach(button => {
                    button.addEventListener("click", function () {
                        const replyId = this.dataset.replyId;
                        const voteType = this.classList.contains("upvote") ? "up" : "down";
                        vote(replyId, voteType);
                    });
                });
            });

            addBookmarkButtonListener();
        })
        .catch(error => {
            console.error("Error fetching message:", error);
        });
    }
}


function addBookmarkButtonListener() {
    const bookmarkButton = document.getElementById('bookmark-button');

    if (bookmarkButton) {
        // Remove any existing event listener
        bookmarkButton.removeEventListener('click', handleBookmarkClick);

        // Add the event listener again
        bookmarkButton.addEventListener('click', handleBookmarkClick);
    } else {
        displayMessage("Oops! Bookmark button not found.", "error");
    }
}

// Extracted event handler function
function handleBookmarkClick() {
    const username = "{{ current_student_name|escapejs }}";
    const questionId = currentMessageId;
    const roomId = "{{ room_id|escapejs }}";

    if (questionId) {
        if (this.classList.contains('bookmarked')) {
            removeBookmark(username, questionId, roomId, this);
        } else {
            addBookmark(username, questionId, roomId, this);
        }
    } else {
        displayMessage("Oops! Question ID is missing.", "error");
    }
}

function removeBookmark(username, questionId, roomId, button) {
    const removeBookmarkUrl = "{% url 'remove_bookmark_questions' %}";
    button.disabled = true; // Disable the button to prevent multiple clicks
    displayMessage("Removing bookmark...", "info"); // Show loading message

    fetch(removeBookmarkUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({ username, questionId, roomId })
    })
    .then(response => response.json())
    .then(data => {
        button.disabled = false; // Re-enable the button
        if (data.message === 'Bookmark removed successfully!') {
            button.classList.remove('bookmarked');
            displayMessage("Bookmark removed!", "success");
        } else {
            displayMessage("Oops! Could not remove bookmark. Please try again.", "error");
            console.error('Failed to remove bookmark:', data.error);
        }
    })
    .catch(error => {
        button.disabled = false; // Re-enable the button
        displayMessage("Oops! Network error. Please try again.", "error");
        console.error('Error removing bookmark:', error);
    });
}

function addBookmark(username, questionId, roomId, button) {
    const bookmarkUrl = "{% url 'bookmark_questions' %}";
    button.disabled = true; // Disable the button
    displayMessage("Saving bookmark...", "info"); // Show loading message

    fetch(bookmarkUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({ username, questionId, roomId })
    })
    .then(response => response.json())
    .then(data => {
        button.disabled = false; // Re-enable the button
        if (data.message === 'Already bookmarked!') {
            button.classList.add('bookmarked');
            displayMessage("Already bookmarked!", "info");
        } else if (data.message === 'Bookmark saved successfully!') {
            button.classList.add('bookmarked');
            displayMessage("Bookmark saved!", "success");
        } else {
            displayMessage("Oops! Could not save bookmark. Please try again.", "error");
            console.error('Failed to save bookmark:', data.error);
        }
    })
    .catch(error => {
        button.disabled = false; // Re-enable the button
        displayMessage("Oops! Network error. Please try again.", "error");
        console.error('Error saving bookmark:', error);
    });
}

function displayMessage(message, type) {
    const messageBox = document.getElementById('message-box');
    if (!messageBox) {
        console.error("Message box element not found.");
        return;
    }

    messageBox.textContent = message;
    messageBox.className = `message-box ${type}`; // Add type class for styling

    // Clear message after a few seconds
    setTimeout(() => {
        messageBox.textContent = '';
        messageBox.className = 'message-box';
    }, 3000);
}

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
