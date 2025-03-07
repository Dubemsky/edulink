// teachers_homepage.js

document.getElementById("createHubButton").addEventListener("click", function() {
    // URL for the Django view (from the hidden data attribute)
    const url = document.getElementById("createHubUrl").getAttribute("data-url");
  
    // Send an AJAX POST request
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": document.querySelector('[name=csrfmiddlewaretoken]').value // CSRF token
      },
      body: JSON.stringify({}) // Send an empty body, just to trigger the click event
    })
    .then(response => response.json())
    .then(data => {
      console.log(data.message); // Optional: log success message in the console
    })
    .catch(error => {
      console.error("Error logging click:", error);
    });
  });
  