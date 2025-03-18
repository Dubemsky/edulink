


// Enhanced Student Analytics Module with Tabs
const StudentAnalytics = (function() {
    // Private properties
    let analyticsData = null;
    let charts = {};
    
    // Cache DOM elements
    const $modal = document.getElementById('analyticsModal');
    const $spinner = document.getElementById('analyticsSpinner');
    const $content = document.getElementById('analyticsContent');
    
    // Initialize the module
    function init(roomId, username) {
        // Add event listener to modal
        if ($modal) {
            $modal.addEventListener('shown.bs.modal', function() {
                // Update modal title to indicate these are student's analytics
                const modalTitle = document.getElementById('analyticsModalLabel');
                if (modalTitle) {
                    const hubName = modalTitle.textContent.split('Room Analytics:')[1] || '';
                    modalTitle.textContent = `My Analytics${hubName}`;
                }
                
                // Fetch student-specific analytics when modal is opened
                fetchStudentAnalytics(roomId, username);
            });
            
            $modal.addEventListener('hidden.bs.modal', function() {
                // Destroy charts to prevent memory leaks
                Object.values(charts).forEach(chart => {
                    if (chart && typeof chart.destroy === 'function') {
                        chart.destroy();
                    }
                });
                charts = {};
            });
        }
    }
    
    // Fetch student analytics data from the server
    function fetchStudentAnalytics(roomId, username) {
        console.log("Fetching analytics for:", username, "in room:", roomId);
        showLoading();
        
        const url = `/student-analytics/${roomId}/?username=${encodeURIComponent(username)}`;
        
        fetch(url)
            .then(response => {
                console.log("Response status:", response.status);
                if (!response.ok) {
                    throw new Error(`Server responded with status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log("Data received:", data);
                if (data.success) {
                    analyticsData = data.analytics;
                    setupTabsAndRender();
                } else {
                    showError(data.error || 'Failed to load analytics');
                }
            })
            .catch(error => {
                console.error('Error fetching student analytics:', error);
                showError('Network error while loading analytics');
            })
            .finally(() => {
                hideLoading();
            });
    }
    
    // Show loading spinner
    function showLoading() {
        if ($spinner) $spinner.style.display = 'flex';
        if ($content) $content.style.display = 'none';
      
    }
    
    // Hide loading spinner
    function hideLoading() {
        if ($spinner) $spinner.style.display = 'none';
        if ($content) $content.style.display = 'block';
    }
    
    // Show error message
    function showError(message) {
        if ($content) {
            $content.innerHTML = `
                <div class="alert alert-danger" role="alert">
                    <i class="fa fa-exclamation-circle"></i> ${message}
                </div>
            `;
            $content.style.display = 'block';
        }
    }
    
    // Setup tabs and render content
    // Add this at the beginning of setupTabsAndRender function
function setupTabsAndRender() {
    if (!analyticsData) {
        console.error("No analytics data available");
        return;
    }
    
    if (!$content) {
        console.error("Content element not found");
        return;
    }
    
    try {
        // Set up the tabbed interface
        setupTabbedInterface();
        
        // Render each section
        renderBasicMetrics();
        
        renderActivityOverTime();
        
        renderEngagementInteraction();
        
        renderVisualizationReporting();
        
        // Set up tab switching
        console.log("Setting up tab switching");
        setupTabSwitching();
    } catch (error) {
        console.error("Error in setupTabsAndRender:", error);
        showError('Error rendering analytics data: ' + error.message);
    }
}
    




    // Set up the tabbed interface
    function setupTabbedInterface() {
        if (!$content) return;
    
    
        // Define the tabs - updated to match requirements
        const tabs = [
            { id: 'basic-metrics', label: 'Basic Metrics', icon: 'fa-tachometer-alt' },
            { id: 'activity', label: 'Activity', icon: 'fa-chart-line' },
            { id: 'engagement', label: 'Engagement', icon: 'fa-users' },
            { id: 'visualization', label: 'Visualization', icon: 'fa-chart-bar' }
        ];
        
        // Create the tabbed interface container
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'student-analytics-container';
        
        // Create the tab navigation
        const tabNav = document.createElement('div');
        tabNav.className = 'nav nav-tabs mb-4';
        tabNav.id = 'student-analytics-tabs';
        tabNav.setAttribute('role', 'tablist');
        
        // Create the tab content container
        const tabContent = document.createElement('div');
        tabContent.className = 'tab-content';
        tabContent.id = 'student-analytics-tab-content';
        
        // Create each tab and its content pane
        tabs.forEach((tab, index) => {
            // Create the tab button
            const tabButton = document.createElement('button');
            tabButton.className = `nav-link ${index === 0 ? 'active' : ''}`;
            tabButton.id = `${tab.id}-tab`;
            tabButton.setAttribute('data-bs-toggle', 'tab');
            tabButton.setAttribute('data-bs-target', `#${tab.id}-pane`);
            tabButton.setAttribute('type', 'button');
            tabButton.setAttribute('role', 'tab');
            tabButton.setAttribute('aria-controls', `${tab.id}-pane`);
            tabButton.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
            tabButton.innerHTML = `<i class="fa ${tab.icon} me-2"></i>${tab.label}`;
            
            // Create the tab nav item
            const tabNavItem = document.createElement('div');
            tabNavItem.className = 'nav-item';
            tabNavItem.setAttribute('role', 'presentation');
            tabNavItem.appendChild(tabButton);
            
            tabNav.appendChild(tabNavItem);
            
            // Create the tab content pane
            const tabPane = document.createElement('div');
            tabPane.className = `tab-pane fade ${index === 0 ? 'show active' : ''}`;
            tabPane.id = `${tab.id}-pane`;
            tabPane.setAttribute('role', 'tabpanel');
            tabPane.setAttribute('aria-labelledby', `${tab.id}-tab`);
            tabPane.setAttribute('tabindex', '0');
            
            tabContent.appendChild(tabPane);
        });
        
        // Add the tab navigation and content to the container
        tabsContainer.appendChild(tabNav);
        tabsContainer.appendChild(tabContent);
        
        // Replace the content with the tabbed interface
        $content.innerHTML = '';
        $content.appendChild(tabsContainer);
    }
    
    // Set up tab switching
    function setupTabSwitching() {
        // Use Bootstrap's tab functionality if available
        if (typeof bootstrap !== 'undefined' && bootstrap.Tab) {
            document.querySelectorAll('button[data-bs-toggle="tab"]').forEach(button => {
                new bootstrap.Tab(button);
            });
        } else {
            // Manual tab switching if Bootstrap is not available
            document.querySelectorAll('button[data-bs-toggle="tab"]').forEach(button => {
                button.addEventListener('click', function(e) {
                    e.preventDefault();
                    
                    // Get the target tab
                    const target = this.getAttribute('data-bs-target');
                    
                    // Deactivate all tabs
                    document.querySelectorAll('.nav-link').forEach(tab => {
                        tab.classList.remove('active');
                        tab.setAttribute('aria-selected', 'false');
                    });
                    
                    // Hide all tab panes
                    document.querySelectorAll('.tab-pane').forEach(pane => {
                        pane.classList.remove('show', 'active');
                    });
                    
                    // Activate the clicked tab
                    this.classList.add('active');
                    this.setAttribute('aria-selected', 'true');
                    
                    // Show the target tab pane
                    const targetPane = document.querySelector(target);
                    if (targetPane) {
                        targetPane.classList.add('show', 'active');
                    }
                });
            });
        }
    }
    
    // 1. Basic Student Metrics
    function renderBasicMetrics() {
    
        const metricsPane = document.getElementById('basic-metrics-pane');
        if (!metricsPane || !analyticsData) return;
    
    
        
        const personal = analyticsData.personal_engagement || {};
        const social = analyticsData.social_interaction || {};
        const learning = analyticsData.learning_behavior || {};
        
        // Create metrics container
        const container = document.createElement('div');
        container.className = 'basic-metrics-container';
        
        // Create metrics grid
        const metricsGrid = document.createElement('div');
        metricsGrid.className = 'row';
        
        // Define metrics from requirements
        const metrics = [
            { 
                label: 'Questions Asked', 
                value: personal.messages_sent || 0,
                icon: 'fa-question-circle',
                color: 'primary'
            },
            { 
                label: 'Answers Given', 
                value: personal.replies_sent || 0,
                icon: 'fa-comment-dots',
                color: 'success'
            },
            { 
                label: 'Likes Received', 
                value: social.upvotes_received || 0,
                icon: 'fa-thumbs-up',
                color: 'info'
            },
            { 
                label: 'Likes Given', 
                value: social.upvotes_given || 0,
                icon: 'fa-heart',
                color: 'danger'
            },
            { 
                label: 'Bookmarked Questions', 
                value: learning.bookmarks_count || 0,
                icon: 'fa-bookmark',
                color: 'warning'
            },
            { 
                label: 'Polls Participated', 
                value: learning.poll_votes_count || 0,
                icon: 'fa-poll',
                color: 'secondary'
            }
        ];
        // Add each metric card
        metrics.forEach(metric => {
            const metricCard = document.createElement('div');
            metricCard.className = 'col-md-4 mb-4';
            metricCard.innerHTML = `
                <div class="card border-${metric.color} shadow-sm h-100">
                    <div class="card-body">
                        <div class="d-flex align-items-center">
                            <div class="rounded-circle bg-${metric.color} p-3 me-3">
                                <i class="fa ${metric.icon} text-white"></i>
                            </div>
                            <div>
                                <div class="stat-value h4 mb-0">${metric.value}</div>
                                <div class="stat-label text-muted">${metric.label}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            metricsGrid.appendChild(metricCard);
        });
        
        container.appendChild(metricsGrid);
        
        // Add engagement comparison
        const comparisonCard = document.createElement('div');
        comparisonCard.className = 'card mt-4';
        
        // Calculate participation comparison
        const roomTotals = analyticsData.room_totals || {};
        const roomAverage = roomTotals.total_messages && roomTotals.total_participants ? 
            (roomTotals.total_messages / roomTotals.total_participants) : 0;
        const studentTotal = (personal.messages_sent || 0) + (personal.replies_sent || 0);
        let comparisonPercentage = 0;
        
        if (roomAverage > 0) {
            comparisonPercentage = Math.round((studentTotal - roomAverage) / roomAverage * 100);
        }
        
        comparisonCard.innerHTML = `
            <div class="card-header bg-light">
                <h5 class="card-title mb-0">Participation Comparison</h5>
            </div>
            <div class="card-body text-center">
                <h3 class="mb-3">
                    <span class="${comparisonPercentage >= 0 ? 'text-success' : 'text-danger'}">
                        <i class="fa fa-${comparisonPercentage >= 0 ? 'arrow-up' : 'arrow-down'}"></i>
                        ${Math.abs(comparisonPercentage)}%
                    </span>
                </h3>
                <p>You've participated in <b>${comparisonPercentage >= 0 ? 'more' : 'fewer'}</b> discussions than the average student in this room.</p>
            </div>
        `;
        
        container.appendChild(comparisonCard);
        
        // Add the container to the metrics pane
        metricsPane.appendChild(container);
    }
    
    // 2. Activity Over Time
    function renderActivityOverTime() {
        const activityPane = document.getElementById('activity-pane');
        if (!activityPane || !analyticsData) return;
        
        const progress = analyticsData.progress_indicators || {};
        const personal = analyticsData.personal_engagement || {};
        
        // Create activity container
        const container = document.createElement('div');
        
        // Daily/weekly/monthly trends chart
        const trendsCard = document.createElement('div');
        trendsCard.className = 'card mb-4';
        trendsCard.innerHTML = `
            <div class="card-header bg-light">
                <h5 class="card-title mb-0">Participation Trends</h5>
            </div>
            <div class="card-body">
                <div style="height: 300px;">
                    <canvas id="participationTrendsChart"></canvas>
                </div>
            </div>
        `;
        container.appendChild(trendsCard);
        
        // Time spent in room section
        const timeSpentCard = document.createElement('div');
        timeSpentCard.className = 'card mb-4';
        
        // Calculate total active days and average session times
        const activeDays = personal.active_days || 0;
        const totalInteractions = (personal.messages_sent || 0) + (personal.replies_sent || 0);
        const avgDailyInteractions = activeDays > 0 ? Math.round(totalInteractions / activeDays) : 0;
        
        timeSpentCard.innerHTML = `
            <div class="card-header bg-light">
                <h5 class="card-title mb-0">Time Engagement</h5>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6 text-center">
                        <h2>${activeDays}</h2>
                        <p class="text-muted">Active Days</p>
                    </div>
                    <div class="col-md-6 text-center">
                        <h2>${avgDailyInteractions}</h2>
                        <p class="text-muted">Average Daily Interactions</p>
                    </div>
                </div>
                <div class="mt-4">
                    <h6>Most Active Hours</h6>
                    <div style="height: 150px;">
                        <canvas id="activeHoursChart"></canvas>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(timeSpentCard);
    
       
    
        
        // Average response time card
        const responseTimeCard = document.createElement('div');
        responseTimeCard.className = 'card mb-4';
        
        // Use response rate from existing analytics or placeholder
        const responseRate = analyticsData.social_interaction && analyticsData.social_interaction.response_rate ? 
            analyticsData.social_interaction.response_rate : 0;
        const messageReplyRatio = personal.message_reply_ratio ? personal.message_reply_ratio : 0;
        
        responseTimeCard.innerHTML = `
            <div class="card-header bg-light">
                <h5 class="card-title mb-0">Response Metrics</h5>
            </div>
            <div class="card-body text-center">
                <div class="row">
                    <div class="col-md-6">
                        <h2>${responseRate.toFixed(1)}%</h2>
                        <p class="text-muted">Response Rate</p>
                        <small>Percentage of your messages that received replies</small>
                    </div>
                    <div class="col-md-6">
                        <h2>${messageReplyRatio.toFixed(1)}</h2>
                        <p class="text-muted">Messages to Replies Ratio</p>
                        <small>Ratio of your questions to answers</small>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(responseTimeCard);
        
        // Add the container to the activity pane
        activityPane.appendChild(container);
        
        // Render charts once the DOM elements are available
        renderParticipationTrendsChart(progress.activity_timeline || []);
        renderActiveHoursChart(personal.active_times || []);
    }
    
    // Helper function to render participation trends chart
    function renderParticipationTrendsChart(timelineData) {
        const canvas = document.getElementById('participationTrendsChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Format the dates and counts for the chart
        const dates = [];
        const counts = [];
        
        // Make sure we have data to work with
        if (timelineData && timelineData.length > 0) {
            timelineData.forEach(item => {
                if (item && item.date && typeof item.count === 'number') {
                    dates.push(item.date);
                    counts.push(item.count);
                }
            });
            
            // Calculate 7-day moving average for weekly trend
            const weeklyAvg = [];
            for (let i = 0; i < counts.length; i++) {
                let sum = 0;
                let validDays = 0;
                for (let j = Math.max(0, i - 6); j <= i; j++) {
                    sum += counts[j];
                    validDays++;
                }
                weeklyAvg.push(sum / validDays);
            }
            
            // Create the chart
            charts.participationTrends = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: [
                        {
                            label: 'Daily',
                            data: counts,
                            backgroundColor: 'rgba(78, 115, 223, 0.1)',
                            borderColor: '#4e73df',
                            borderWidth: 2,
                            pointRadius: 3,
                            pointBackgroundColor: '#4e73df',
                            pointBorderColor: '#fff',
                            pointHoverRadius: 5,
                            tension: 0.3,
                            fill: false
                        },
                        {
                            label: 'Weekly Average',
                            data: weeklyAvg,
                            backgroundColor: 'rgba(28, 200, 138, 0.1)',
                            borderColor: '#1cc88a',
                            borderWidth: 2,
                            pointRadius: 0,
                            tension: 0.4,
                            fill: false
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            grid: {
                                display: false
                            }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: {
                                precision: 0
                            }
                        }
                    },
                    plugins: {
                        tooltip: {
                            backgroundColor: '#fff',
                            titleColor: '#5a5c69',
                            bodyColor: '#858796',
                            borderColor: '#dddfeb',
                            borderWidth: 1,
                            xPadding: 15,
                            yPadding: 15,
                            displayColors: false,
                            caretPadding: 10
                        }
                    }
                }
            });
        } else {
            // No data available, show a message
            const noDataMessage = document.createElement('div');
            noDataMessage.className = 'text-center p-4 text-muted';
            noDataMessage.textContent = 'No activity timeline data available';
            canvas.parentNode.replaceChild(noDataMessage, canvas);
        }
    }
    
    // Helper function to render active hours chart
    function renderActiveHoursChart(activeTimes) {
        const canvas = document.getElementById('activeHoursChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Prepare data for 24-hour chart
        const hours = Array.from({ length: 24 }, (_, i) => i);
        const activityData = Array(24).fill(0);
        
        // Make sure we have data to work with
        if (activeTimes && activeTimes.length > 0) {
            // Fill in the activity data
            activeTimes.forEach(item => {
                if (item && typeof item.hour === 'number' && item.hour >= 0 && item.hour < 24) {
                    activityData[item.hour] = item.count || 0;
                }
            });
            
            // Format hours for display
            const hourLabels = hours.map(hour => {
                return `${hour}:00`;
            });
            
            // Create the chart
            charts.activeHours = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: hourLabels,
                    datasets: [{
                        label: 'Activity',
                        data: activityData,
                        backgroundColor: '#36b9cc',
                        borderColor: '#36b9cc',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                precision: 0
                            }
                        },
                        x: {
                            ticks: {
                                autoSkip: true,
                                maxTicksLimit: 12
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        } else {
            // No data available, show a message
            const noDataMessage = document.createElement('div');
            noDataMessage.className = 'text-center p-4 text-muted';
            noDataMessage.textContent = 'No active times data available';
            canvas.parentNode.replaceChild(noDataMessage, canvas);
        }
    }
    
    // 3. Engagement & Interaction
    function renderEngagementInteraction() {
        const engagementPane = document.getElementById('engagement-pane');
        if (!engagementPane || !analyticsData) return;
        
        const content = analyticsData.content_analytics || {};
        const social = analyticsData.social_interaction || {};
        
        // Create engagement container
        const container = document.createElement('div');
        
        // Top topics interaction card
        const topicsCard = document.createElement('div');
        topicsCard.className = 'card mb-4';
        
        // Extract message types for topics or use defaults
        let topTopics = [];
        
        if (content && content.message_types) {
            topTopics = Object.entries(content.message_types).map(([type, count]) => ({
                topic: type.charAt(0).toUpperCase() + type.slice(1),
                interactions: count
            }));
        } else {
            // Fallback to default topics
            topTopics = [
                { topic: 'Text Messages', interactions: 0 },
                { topic: 'Questions', interactions: 0 },
                { topic: 'Responses', interactions: 0 },
                { topic: 'Resources', interactions: 0 },
                { topic: 'Files', interactions: 0 }
            ];
        }
        
        let topicsHTML = '';
        topTopics.forEach(topic => {
            topicsHTML += `
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span>${topic.topic}</span>
                    <span class="badge bg-primary">${topic.interactions}</span>
                </div>
            `;
        });
        
        topicsCard.innerHTML = `
            <div class="card-header bg-light">
                <h5 class="card-title mb-0">Top Content Types</h5>
            </div>
            <div class="card-body">
                ${topicsHTML || '<p class="text-center text-muted">No content type data available</p>'}
                <div class="mt-3 text-center">
                    <small class="text-muted">Based on message content analysis</small>
                </div>
            </div>
        `;
        container.appendChild(topicsCard);
        
        // Most engaged-with users - use top content as a proxy or create placeholder
        const usersCard = document.createElement('div');
        usersCard.className = 'card mb-4';
        
        // Try to extract top content authors as proxy for user interaction
        let topUsers = [];
        const progress = analyticsData.progress_indicators || {};
        
        if (progress && progress.top_content && progress.top_content.length > 0) {
            // Create a map of interactions by user
            const userInteractions = {};
            
            // Count interactions from top content
            progress.top_content.forEach(content => {
                if (content.sender) {
                    userInteractions[content.sender] = (userInteractions[content.sender] || 0) + 1;
                }
            });
            
            // Convert to array and sort
            topUsers = Object.entries(userInteractions)
                .map(([name, interactions]) => ({ name, interactions }))
                .sort((a, b) => b.interactions - a.interactions)
                .slice(0, 5);
        }
        
        // If no data, use placeholders
        if (topUsers.length === 0) {
            topUsers = [
                { name: 'Instructor', interactions: 0 },
                { name: 'Classmates', interactions: 0 }
            ];
        }
        
        let usersHTML = '';
        topUsers.forEach(user => {
            usersHTML += `
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span>${user.name}</span>
                    <span class="badge bg-success">${user.interactions}</span>
                </div>
            `;
        });
        
        usersCard.innerHTML = `
            <div class="card-header bg-light">
                <h5 class="card-title mb-0">Most Frequent Interactions</h5>
            </div>
            <div class="card-body">
                ${usersHTML || '<p class="text-center text-muted">No interaction data available</p>'}
                <div class="mt-3 text-center">
                    <small class="text-muted">Based on replies and reactions</small>
                </div>
            </div>
        `;
        container.appendChild(usersCard);
        
        // Participation percentage
        const participationCard = document.createElement('div');
        participationCard.className = 'card mb-4';
        
        // Calculate viewing vs participation ratio
        const learning = analyticsData.learning_behavior || {};
        const readingWritingRatio = learning.reading_writing_ratio || 1;
        const participationPercentage = readingWritingRatio > 0 ? (100 / (1 + readingWritingRatio)) : 50;
        
        participationCard.innerHTML = `
            <div class="card-header bg-light">
                <h5 class="card-title mb-0">Participation Analysis</h5>
            </div>
            <div class="card-body">
                <div class="text-center mb-3">
                    <h2>${participationPercentage.toFixed(1)}%</h2>
                    <p>Active Participation vs Viewing</p>
                </div>
                <div class="progress" style="height: 25px;">
                    <div class="progress-bar bg-primary" role="progressbar" 
                        style="width: ${participationPercentage}%" 
                        aria-valuenow="${participationPercentage}" 
                        aria-valuemin="0" 
                        aria-valuemax="100">
                        Participation
                    </div>
                    <div class="progress-bar bg-secondary" role="progressbar" 
                        style="width: ${100 - participationPercentage}%" 
                        aria-valuenow="${100 - participationPercentage}" 
                        aria-valuemin="0" 
                        aria-valuemax="100">
                        Viewing
                    </div>
                </div>
                <div class="d-flex justify-content-between mt-2">
                    <small>Active Contributions</small>
                    <small>Passive Viewing</small>
                </div>
            </div>
        `;
        container.appendChild(participationCard);
        
        // Add the container to the engagement pane
        engagementPane.appendChild(container);
    }
    
    // 4. Visualization & Reporting
    function renderVisualizationReporting() {
        const visualizationPane = document.getElementById('visualization-pane');
        if (!visualizationPane || !analyticsData) return;
        
        const personal = analyticsData.personal_engagement || {};
        const social = analyticsData.social_interaction || {};
        const progress = analyticsData.progress_indicators || {};
        const learning = analyticsData.learning_behavior || {};
        
        // Create visualization container
        const container = document.createElement('div');
        
        // Student engagement visualization
        const engagementCard = document.createElement('div');
        engagementCard.className = 'card mb-4';
        engagementCard.innerHTML = `
            <div class="card-header bg-light">
                <h5 class="card-title mb-0">Engagement Distribution</h5>
            </div>
            <div class="card-body">
                <div style="height: 300px;">
                    <canvas id="engagementDistributionChart"></canvas>
                </div>
            </div>
        `;
        container.appendChild(engagementCard);
        
    
    const performanceCard = document.createElement('div');
        performanceCard.className = 'card mb-4';
        
        // Create progress bars for key metrics
        const progressBars = [
            {
                label: 'Participation Rate',
                value: personal.participation_percentage || 0,
                max: 100,
                color: getProgressColor(personal.participation_percentage || 0, 5, 15, 30)
            },
            {
                label: 'Poll Participation',
                value: learning.poll_participation_rate || 0,
                max: 100,
                color: getProgressColor(learning.poll_participation_rate || 0, 25, 50, 75)
            },
            {
                label: 'Response Rate',
                value: social.response_rate || 0,
                max: 100,
                color: getProgressColor(social.response_rate || 0, 10, 30, 50)
            },
            {
                label: 'Consistency Score',
                value: progress.consistency_score || 0,
                max: 100,
                color: getProgressColor(progress.consistency_score || 0, 30, 60, 80)
            }
        ];
        
        let progressHtml = '';
        progressBars.forEach(bar => {
            progressHtml += `
                <div class="mb-3">
                    <div class="d-flex justify-content-between mb-1">
                        <span>${bar.label}</span>
                        <span>${bar.value.toFixed(1)}%</span>
                    </div>
                    <div class="progress" style="height: 10px;">
                        <div class="progress-bar bg-${bar.color}" role="progressbar" style="width: ${Math.min(bar.value, 100)}%"></div>
                    </div>
                </div>
            `;
        });
        
        performanceCard.innerHTML = `
            <div class="card-header bg-light">
                <h5 class="card-title mb-0">Performance Dashboard</h5>
            </div>
            <div class="card-body">
                ${progressHtml}
            </div>
        `;
        container.appendChild(performanceCard);
        
        // Comparison with average room activity
        const comparisonCard = document.createElement('div');
        comparisonCard.className = 'card';
        
        // Calculate comparisons with room averages
        const roomTotals = analyticsData.room_totals || {};
        const totalParticipants = roomTotals.total_participants || 1;
        
        let msgComparison = 0;
        let replyComparison = 0;
        let reactionComparison = 0;
        
        if (roomTotals.total_messages && roomTotals.total_participants) {
            msgComparison = ((personal.messages_sent || 0) / (roomTotals.total_messages / totalParticipants) - 1) * 100;
        }
        
        if (roomTotals.total_replies && roomTotals.total_participants) {
            replyComparison = ((personal.replies_sent || 0) / (roomTotals.total_replies / totalParticipants) - 1) * 100;
        }
        
        if (roomTotals.total_reactions && totalParticipants) {
            const userReactions = (social.upvotes_received || 0) + (social.downvotes_received || 0);
            const avgReactions = (roomTotals.total_reactions.upvotes + roomTotals.total_reactions.downvotes) / totalParticipants;
            if (avgReactions > 0) {
                reactionComparison = (userReactions / avgReactions - 1) * 100;
            }
        }
        
        comparisonCard.innerHTML = `
            <div class="card-header bg-light">
                <h5 class="card-title mb-0">Comparison with Room Average</h5>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-4 text-center mb-3">
                        <h3 class="${msgComparison >= 0 ? 'text-success' : 'text-danger'}">
                            ${msgComparison >= 0 ? '+' : ''}${msgComparison.toFixed(0)}%
                        </h3>
                        <p>Messages</p>
                    </div>
                    <div class="col-md-4 text-center mb-3">
                        <h3 class="${replyComparison >= 0 ? 'text-success' : 'text-danger'}">
                            ${replyComparison >= 0 ? '+' : ''}${replyComparison.toFixed(0)}%
                        </h3>
                        <p>Replies</p>
                    </div>
                    <div class="col-md-4 text-center mb-3">
                        <h3 class="${reactionComparison >= 0 ? 'text-success' : 'text-danger'}">
                            ${reactionComparison >= 0 ? '+' : ''}${reactionComparison.toFixed(0)}%
                        </h3>
                        <p>Reactions</p>
                    </div>
                </div>
                <div class="alert alert-info mt-3">
                    <i class="fa fa-info-circle me-2"></i>
                    These percentages show how your activity compares to the average student in this room.
                </div>
            </div>
        `;
        container.appendChild(comparisonCard);
        
        // Add the container to the visualization pane
        visualizationPane.appendChild(container);
        
        // Render the engagement distribution chart
        renderEngagementDistributionChart();
    }
    
    // Render engagement distribution pie chart
    function renderEngagementDistributionChart() {
        const canvas = document.getElementById('engagementDistributionChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Get data from analytics
        const personal = analyticsData.personal_engagement || {};
        const learning = analyticsData.learning_behavior || {};
        const social = analyticsData.social_interaction || {};
        
        // Create data for chart
        const data = [
            { label: 'Questions', value: personal.messages_sent || 0 },
            { label: 'Answers', value: personal.replies_sent || 0 },
            { label: 'Bookmarks', value: learning.bookmarks_count || 0 },
            { label: 'Poll Votes', value: learning.poll_votes_count || 0 },
            { label: 'Likes Given', value: social.upvotes_given || 0 }
        ];
        
        // Filter out zero values
        const filteredData = data.filter(item => item.value > 0);
        
        if (filteredData.length > 0) {
            // Create the chart
            charts.engagementDistribution = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: filteredData.map(item => item.label),
                    datasets: [{
                        data: filteredData.map(item => item.value),
                        backgroundColor: [
                            '#4e73df', // Primary blue
                            '#1cc88a', // Success green
                            '#f6c23e', // Warning yellow
                            '#36b9cc', // Info teal
                            '#e74a3b'  // Danger red
                        ],
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right'
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.raw || 0;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                    return `${label}: ${value} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        } else {
            // No data available, show a message
            const noDataMessage = document.createElement('div');
            noDataMessage.className = 'text-center p-4 text-muted';
            noDataMessage.textContent = 'No engagement data available';
            canvas.parentNode.replaceChild(noDataMessage, canvas);
        }
    }
    
    // Helper function to get progress bar color
    function getProgressColor(value, lowThreshold, mediumThreshold, highThreshold) {
        if (value < lowThreshold) return 'danger';
        if (value < mediumThreshold) return 'warning';
        if (value < highThreshold) return 'info';
        return 'success';
    }
    
    // Public API
    return {
        init: init,
        fetchStudentAnalytics: fetchStudentAnalytics
    };
    })();
    
    // Initialize the student analytics when the page loads
    document.addEventListener('DOMContentLoaded', function() {
        // Get room ID and username from the page
        const roomId = document.querySelector('[data-room-id]')?.dataset.roomId || 
                    "{{ room_id|escapejs }}";
        const username = document.querySelector('[data-username]')?.dataset.username || 
                        "{{ current_student_name|escapejs }}";
        
        if (roomId && username) {
            console.log("Initializing student analytics for:", username, "in room:", roomId);
            
            // Initialize the student analytics module
            StudentAnalytics.init(roomId, username);
            
            // Add some basic styles to ensure proper display
            const style = document.createElement('style');
            style.textContent = `
                .student-analytics-container .nav-tabs {
                    border-bottom: 1px solid #dee2e6;
                }
                .student-analytics-container .nav-link {
                    margin-bottom: -1px;
                    border: 1px solid transparent;
                    border-top-left-radius: 0.25rem;
                    border-top-right-radius: 0.25rem;
                }
                .student-analytics-container .nav-link:hover, 
                .student-analytics-container .nav-link:focus {
                    border-color: #e9ecef #e9ecef #dee2e6;
                }
                .student-analytics-container .nav-link.active {
                    color: #495057;
                    background-color: #fff;
                    border-color: #dee2e6 #dee2e6 #fff;
                }
                .student-analytics-container .tab-content {
                    padding-top: 20px;
                }
                .student-analytics-container .tab-pane {
                    display: none;
                }
                .student-analytics-container .tab-pane.active {
                    display: block;
                }
                .student-analytics-container .tab-pane.show {
                    opacity: 1;
                }
                .student-analytics-container .card {
                    box-shadow: 0 0.15rem 1.75rem 0 rgba(58, 59, 69, 0.15);
                    margin-bottom: 1.5rem;
                }
                
                /* Analytics modal styling */
                .analytics-modal {
                    max-width: 90%;
                }
                
                .analytics-spinner {
                    border: 4px solid rgba(0, 0, 0, 0.1);
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    border-left-color: #007bff;
                    animation: spin 1s linear infinite;
                }
                
                .spinner-container {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 200px;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        } else {
            console.error('Room ID or username not found. Student analytics cannot be initialized.');
        }
    });
    