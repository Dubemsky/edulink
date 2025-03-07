document.addEventListener('DOMContentLoaded', function () {
    // Access the roomId passed from Django context
    const roomId = currentroomId;  // This uses the roomId directly passed from Django

    // Set up a timeout for debouncing the input
    let debounceTimeout;

    // Listen for input event in the message input field
    document.getElementById('messageInput').addEventListener('input', async (event) => {
        const query = event.target.value.trim();

        // Clear the previous timeout to implement debouncing
        clearTimeout(debounceTimeout);

        if (query.length > 0) {
            // Show the suggestion box when the user types
            document.getElementById('suggestionsBox').style.display = 'block';

            // Set a timeout to make the request after the user stops typing for 300ms
            debounceTimeout = setTimeout(async () => {
                try {
                    // Call the backend to get similar questions based on roomId and query
                    const response = await fetch(`/get_suggestions/?query=${encodeURIComponent(query)}&room_id=${encodeURIComponent(roomId)}`);
                    
                    if (response.ok) {
                        const suggestions = await response.json();
                        showSuggestions(suggestions);
                    } else {
                        console.error('Failed to fetch suggestions:', response.status);
                        document.getElementById('suggestionsBox').style.display = 'none';
                    }
                } catch (error) {
                    console.error('Error fetching suggestions:', error);
                    document.getElementById('suggestionsBox').style.display = 'none';
                }
            }, 300); // 300ms debounce time
        } else {
            // Hide the suggestion box when the input is empty
            document.getElementById('suggestionsBox').style.display = 'none';
        }
    });

    // Function to display suggestions
    function showSuggestions(suggestions) {
        const suggestionsBox = document.getElementById('suggestionsBox');
        suggestionsBox.innerHTML = ''; // Clear previous suggestions

        if (suggestions.length === 0) {
            const noResult = document.createElement('div');
            noResult.textContent = 'No suggestions found';
            suggestionsBox.appendChild(noResult);
        } else {
            // Create list items for each suggestion
            suggestions.forEach((suggestion) => {
                const suggestionItem = document.createElement('div');
                suggestionItem.classList.add('suggestion-item');
                suggestionItem.textContent = suggestion.content;  // Assuming the 'content' key contains the question text

                // Add click event for the suggestion
                suggestionItem.addEventListener('click', () => {
                    // Redirect to the question page
                    window.location.href = `/question/${suggestion.id}`;  // Replace with the real question URL
                });

                suggestionsBox.appendChild(suggestionItem);
            });
        }
    }
});
