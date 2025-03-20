/**
 * Enhanced Room Analytics Script
 * This script replaces the existing RoomAnalytics implementation
 * to provide more useful and comprehensive analytics visualizations
 */

const RoomAnalytics = (function() {
    // Private properties
    let analyticsData = null;
    let charts = {};
    
    // Cache DOM elements
    const $modal = document.getElementById('analyticsModal');
    const $spinner = document.getElementById('analyticsSpinner');
    const $content = document.getElementById('analyticsContent');
    const $tabs = document.querySelectorAll('.analytics-tab');
    const $tabContents = document.querySelectorAll('.analytics-tab-content');
    
    // Color palettes for charts
    const colorPalette = [
        '#4361ee', '#3a0ca3', '#7209b7', '#f72585', '#4cc9f0',
        '#4895ef', '#560bad', '#b5179e', '#f15bb5', '#00b4d8'
    ];
    
    const messageTypeColors = {
        'text': '#4361ee',
        'image': '#4cc9f0',
        'file': '#560bad',
        'video': '#f72585',
        'poll': '#b5179e'
    };

    // Initialize the module
    function init(roomId) {
        // Add event listener to tabs
        $tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const tabName = this.getAttribute('data-tab');
                switchTab(tabName);
            });
        });
        
        // Add event listener to modal
        if ($modal) {
            $modal.addEventListener('shown.bs.modal', function() {
                if (!analyticsData) {
                    fetchAnalytics(roomId);
                } else {
                    // If we already have data but charts were destroyed, re-render
                    renderAnalytics();
                }
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
    
    // Switch between tabs
    function switchTab(tabName) {
        // Update active tab
        $tabs.forEach(tab => {
            if (tab.getAttribute('data-tab') === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        // Update active content
        $tabContents.forEach(content => {
            if (content.id === `${tabName}-tab`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });
    }
    
    // Fetch analytics data from the server
    function fetchAnalytics(roomId) {
        showLoading();
        
        fetch(`/room-analytics/${roomId}/`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server responded with status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    analyticsData = data.analytics;
                    renderAnalytics();
                } else {
                    showError(data.error || 'Failed to load analytics');
                }
            })
            .catch(error => {
                console.error('Error fetching analytics:', error);
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
    
    // Render all analytics components
    function renderAnalytics() {
        if (!analyticsData) return;
        
        try {
            // Check if Chart.js is loaded
            if (typeof Chart === 'undefined') {
                console.error('Chart.js is not loaded. Loading dynamically...');
                // Try to load Chart.js dynamically
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js';
                script.onload = function() {
                    console.log('Chart.js loaded successfully, rendering analytics...');
                    renderAnalyticsComponents();
                };
                script.onerror = function() {
                    console.error('Failed to load Chart.js dynamically');
                    showError('Failed to load chart library. Please refresh the page.');
                };
                document.head.appendChild(script);
            } else {
                renderAnalyticsComponents();
            }
        } catch (error) {
            console.error('Error rendering analytics:', error);
            showError('Error rendering analytics data');
        }
    }
    
    // Render all analytics components after ensuring Chart.js is available
    function renderAnalyticsComponents() {
        try {
            // Prepare overview tab
            renderOverviewStats();
            renderMessageTypesChart();
            
            // Prepare engagement tab
            prepareEngagementTab();
            renderTopContributorsChart();
            renderParticipationDonut();
            
            // Prepare activity tab
            prepareActivityTab();
            renderActivityTimeline();
            
            // Prepare polls tab
            preparePollsTab();
            renderPollResults();
        } catch (error) {
            console.error('Error rendering analytics components:', error);
            showError('Error rendering analytics data');
        }
    }
    
    // Render overview statistics
    function renderOverviewStats() {
        const metrics = analyticsData.message_metrics;
        
        // Update stat values safely
        const totalMessagesEl = document.getElementById('total-messages');
        if (totalMessagesEl) totalMessagesEl.textContent = metrics.total_messages;
        
        const totalRepliesEl = document.getElementById('total-replies');
        if (totalRepliesEl) totalRepliesEl.textContent = metrics.total_replies;
        
        const totalParticipantsEl = document.getElementById('total-participants');
        if (totalParticipantsEl) totalParticipantsEl.textContent = metrics.total_participants;
        
        // Total reactions
        const totalReactions = (metrics.total_reactions.upvotes || 0) + (metrics.total_reactions.downvotes || 0);
        const totalReactionsEl = document.getElementById('total-reactions');
        if (totalReactionsEl) totalReactionsEl.textContent = totalReactions;
        
        // Add activity rate metrics (messages per participant)
        const activityRate = document.createElement('div');
        activityRate.className = 'col-md-3';
        activityRate.innerHTML = `
            <div class="analytics-stat">
                <div class="stat-value">${(metrics.total_messages / Math.max(metrics.total_participants, 1)).toFixed(1)}</div>
                <div class="stat-label">Messages per Participant</div>
            </div>
        `;
        
        // Add engagement rate metrics (replies per message)
        const engagementRate = document.createElement('div');
        engagementRate.className = 'col-md-3';
        engagementRate.innerHTML = `
            <div class="analytics-stat">
                <div class="stat-value">${(metrics.total_replies / Math.max(metrics.total_messages, 1)).toFixed(1)}</div>
                <div class="stat-label">Replies per Message</div>
            </div>
        `;
        
        // Add activity trend metrics (activity increasing/decreasing)
        const activityTrend = document.createElement('div');
        activityTrend.className = 'col-md-3';
        
        // Check if we have activity timeline data
        let trendIcon = '';
        let trendClass = '';
        let trendText = 'Stable';
        
        if (analyticsData.activity_timeline && analyticsData.activity_timeline.length > 1) {
            // Simple trend calculation: compare last half vs first half of timeline
            const timeline = analyticsData.activity_timeline;
            const midpoint = Math.floor(timeline.length / 2);
            
            const firstHalfSum = timeline.slice(0, midpoint).reduce((sum, item) => sum + item.count, 0);
            const secondHalfSum = timeline.slice(midpoint).reduce((sum, item) => sum + item.count, 0);
            
            const percentChange = ((secondHalfSum - firstHalfSum) / Math.max(firstHalfSum, 1)) * 100;
            
            if (percentChange > 10) {
                trendIcon = '<i class="bi bi-arrow-up-circle-fill text-success"></i>';
                trendClass = 'text-success';
                trendText = 'Increasing';
            } else if (percentChange < -10) {
                trendIcon = '<i class="bi bi-arrow-down-circle-fill text-danger"></i>';
                trendClass = 'text-danger';
                trendText = 'Decreasing';
            } else {
                trendIcon = '<i class="bi bi-dash-circle-fill text-warning"></i>';
                trendClass = 'text-warning';
                trendText = 'Stable';
            }
        }
        
        activityTrend.innerHTML = `
            <div class="analytics-stat">
                <div class="stat-value ${trendClass}">
                    ${trendIcon} ${trendText}
                </div>
                <div class="stat-label">Activity Trend</div>
            </div>
        `;
        
        // Find the row and append new stats
        const statsRow = totalMessagesEl?.closest('.row');
        if (statsRow) {
            statsRow.appendChild(activityRate);
            statsRow.appendChild(engagementRate);
            statsRow.appendChild(activityTrend);
        }
    }
    
    // Render message types chart
    function renderMessageTypesChart() {
        const messageTypes = analyticsData.message_metrics.message_types || {};
        const chartCanvas = document.getElementById('messageTypesChart');
        
        if (!chartCanvas) return;
        
        // Check if Chart.js is available
        if (typeof Chart === 'undefined') {
            console.error('Chart.js is not loaded. Cannot render chart.');
            const container = chartCanvas.parentElement;
            if (container) {
                container.innerHTML = '<div class="alert alert-warning">Chart library not available. Please check if Chart.js is properly loaded.</div>';
            }
            return;
        }
        
        const ctx = chartCanvas.getContext('2d');
        
        // Destroy existing chart if it exists
        if (charts.messageTypes) {
            charts.messageTypes.destroy();
        }
        
        // Create legend for message types
        const legendContainer = document.getElementById('message-types-legend');
        if (legendContainer) {
            legendContainer.innerHTML = '';
        }
        
        // Format data for the chart
        const labels = [];
        const data = [];
        const backgroundColor = [];
        
        // Add a pill for each message type
        Object.entries(messageTypes).forEach(([type, count]) => {
            labels.push(type);
            data.push(count);
            backgroundColor.push(messageTypeColors[type] || colorPalette[0]);
            
            // Create legend item if container exists
            if (legendContainer) {
                const pill = document.createElement('span');
                pill.className = `message-type-pill message-type-${type}`;
                pill.style.backgroundColor = messageTypeColors[type] || colorPalette[0];
                pill.style.color = '#fff';
                pill.style.padding = '5px 10px';
                pill.style.borderRadius = '15px';
                pill.style.margin = '0 5px';
                pill.style.display = 'inline-block';
                pill.textContent = `${type}: ${count}`;
                legendContainer.appendChild(pill);
            }
        });
        
        // Only create chart if we have data
        if (labels.length > 0) {
            // Create the chart
            charts.messageTypes = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: backgroundColor,
                        borderColor: '#ffffff',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'right'
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.raw || 0;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = Math.round((value / total) * 100);
                                    return `${label}: ${value} (${percentage}%)`;
                                }
                            }
                        }
                    },
                    animation: {
                        animateScale: true,
                        animateRotate: true
                    }
                }
            });
        } else {
            // Show a message if no data
            if (legendContainer) {
                legendContainer.innerHTML = '<p>No message type data available</p>';
            }
        }
    }
    
    // Prepare engagement tab with appropriate HTML structure
    function prepareEngagementTab() {
        const engagementTab = document.getElementById('engagement-tab');
        if (!engagementTab) return;
        
        // Clear existing content
        engagementTab.innerHTML = '';
        
        // Create top contributors section
        const contributorsSection = document.createElement('div');
        contributorsSection.className = 'analytics-card mb-4';
        contributorsSection.innerHTML = `
            <div class="analytics-card-header">
                <h5>Top Contributors</h5>
            </div>
            <div class="analytics-card-body">
                <div class="chart-container" style="height: 300px;">
                    <canvas id="topContributorsChart"></canvas>
                </div>
            </div>
        `;
        engagementTab.appendChild(contributorsSection);
        
        // Create participant engagement section
        const participationSection = document.createElement('div');
        participationSection.className = 'analytics-card mb-4';
        participationSection.innerHTML = `
            <div class="analytics-card-header">
                <h5>Participation Overview</h5>
            </div>
            <div class="analytics-card-body">
                <div class="row">
                    <div class="col-md-6">
                        <div class="chart-container" style="height: 300px;">
                            <canvas id="participationDonutChart"></canvas>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div id="participationStats" class="analytics-stats">
                            <p><strong>Participation Rate:</strong> ${analyticsData.user_engagement.participation_percentage.toFixed(1)}%</p>
                        </div>
                        <div id="participantTable" class="table-responsive">
                            <table class="table table-striped">
                                <thead>
                                    <tr>
                                        <th>Participant</th>
                                        <th>Messages</th>
                                        <th>Participation</th>
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
        engagementTab.appendChild(participationSection);
    }
    
    // Render top contributors chart
    function renderTopContributorsChart() {
        const contributors = analyticsData.user_engagement.top_contributors || [];
        const chartCanvas = document.getElementById('topContributorsChart');
        
        if (!chartCanvas) return;
        
        const ctx = chartCanvas.getContext('2d');
        
        // Destroy existing chart if it exists
        if (charts.topContributors) {
            charts.topContributors.destroy();
        }
        
        // Format data for the chart
        const labels = contributors.map(c => c.name || 'Unknown');
        const data = contributors.map(c => c.messages || 0);
        
        // Only create chart if we have data
        if (labels.length > 0) {
            // Create the chart
            charts.topContributors = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Number of Messages',
                        data: data,
                        backgroundColor: contributors.map((_, i) => colorPalette[i % colorPalette.length]),
                        borderColor: contributors.map((_, i) => colorPalette[i % colorPalette.length].replace('0.7', '1')),
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',  // Horizontal bar chart
                    scales: {
                        x: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Number of Messages'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const value = context.raw || 0;
                                    const total = analyticsData.message_metrics.total_messages;
                                    const percentage = Math.round((value / total) * 100);
                                    return `Messages: ${value} (${percentage}% of total)`;
                                }
                            }
                        }
                    }
                }
            });
            
            // Also update the participant table
            renderParticipantTable(contributors);
        } else {
            // Show a message if no data
            chartCanvas.parentElement.innerHTML = '<p>No contributor data available</p>';
        }
    }
    
    // Render participation donut
    function renderParticipationDonut() {
        const chartCanvas = document.getElementById('participationDonutChart');
        if (!chartCanvas) return;
        
        const ctx = chartCanvas.getContext('2d');
        
        // Destroy existing chart if it exists
        if (charts.participationDonut) {
            charts.participationDonut.destroy();
        }
        
        // Calculate total members vs active participants
        const totalParticipants = analyticsData.message_metrics.total_participants || 0;
        const membershipPercentage = analyticsData.user_engagement.participation_percentage || 0;
        const totalMembers = Math.round(totalParticipants * 100 / Math.max(membershipPercentage, 1));
        const inactiveMembers = Math.max(0, totalMembers - totalParticipants);
        
        // Create the donut chart
        charts.participationDonut = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Active Participants', 'Inactive Members'],
                datasets: [{
                    data: [totalParticipants, inactiveMembers],
                    backgroundColor: ['#4cc9f0', '#f15bb5'],
                    borderColor: '#ffffff',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
        
        // Update participation stats
        const statsContainer = document.getElementById('participationStats');
        if (statsContainer) {
            const participationRate = analyticsData.user_engagement.participation_percentage;
            let rateClass = '';
            
            if (participationRate < 30) {
                rateClass = 'text-danger';
            } else if (participationRate < 70) {
                rateClass = 'text-warning';
            } else {
                rateClass = 'text-success';
            }
            
            statsContainer.innerHTML = `
                <p><strong>Participation Rate:</strong> <span class="${rateClass}">${participationRate.toFixed(1)}%</span></p>
                <p><strong>Total Members:</strong> ${totalMembers}</p>
                <p><strong>Active Participants:</strong> ${totalParticipants}</p>
                <p><strong>Inactive Members:</strong> ${inactiveMembers}</p>
            `;
        }
    }
    
    // Render participant table
    function renderParticipantTable(contributors) {
        const totalMessages = analyticsData.message_metrics.total_messages || 0;
        const tableBody = document.querySelector('#participantTable tbody');
        
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        if (contributors.length === 0) {
            const emptyRow = document.createElement('tr');
            const emptyCell = document.createElement('td');
            emptyCell.colSpan = 3;
            emptyCell.textContent = 'No participant data available';
            emptyCell.className = 'text-center';
            emptyRow.appendChild(emptyCell);
            tableBody.appendChild(emptyRow);
            return;
        }
        
        // Create a row for each participant
        contributors.forEach((contributor, index) => {
            const row = document.createElement('tr');
            
            // Participant name
            const nameCell = document.createElement('td');
            nameCell.textContent = contributor.name || 'Unknown';
            row.appendChild(nameCell);
            
            // Number of messages
            const messagesCell = document.createElement('td');
            messagesCell.textContent = contributor.messages || 0;
            row.appendChild(messagesCell);
            
            // Participation bar
            const participationCell = document.createElement('td');
            const percentage = totalMessages > 0 ? 
                (((contributor.messages || 0) / totalMessages) * 100).toFixed(1) : 0;
            
            const progressContainer = document.createElement('div');
            progressContainer.className = 'progress';
            progressContainer.style.height = '10px';
            
            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            progressBar.style.width = `${percentage}%`;
            progressBar.style.backgroundColor = colorPalette[index % colorPalette.length];
            
            progressContainer.appendChild(progressBar);
            
            participationCell.appendChild(progressContainer);
            
            const percentageText = document.createElement('small');
            percentageText.textContent = `${percentage}%`;
            percentageText.className = 'ml-2';
            
            participationCell.appendChild(percentageText);
            row.appendChild(participationCell);
            
            tableBody.appendChild(row);
        });
    }
    
    // Prepare activity tab
    function prepareActivityTab() {
        const activityTab = document.getElementById('activity-tab');
        if (!activityTab) return;
        
        // Clear existing content
        activityTab.innerHTML = '';
        
        // Add activity timeline card
        const timelineCard = document.createElement('div');
        timelineCard.className = 'analytics-card mb-4';
        timelineCard.innerHTML = `
            <div class="analytics-card-header">
                <h5>Activity Timeline</h5>
            </div>
            <div class="analytics-card-body">
                <div class="chart-container" style="height: 400px;">
                    <canvas id="activityTimelineChart"></canvas>
                </div>
            </div>
        `;
        activityTab.appendChild(timelineCard);
        
        // Add hourly activity heatmap
        const hourlyCard = document.createElement('div');
        hourlyCard.className = 'analytics-card mb-4';
        hourlyCard.innerHTML = `
            <div class="analytics-card-header">
                <h5>Activity by Hour of Day</h5>
            </div>
            <div class="analytics-card-body">
                <div class="chart-container" style="height: 300px;">
                    <canvas id="hourlyActivityChart"></canvas>
                </div>
            </div>
        `;
        activityTab.appendChild(hourlyCard);
    }
    
    // Render activity timeline
    function renderActivityTimeline() {
        const timeline = analyticsData.activity_timeline || [];
        const chartCanvas = document.getElementById('activityTimelineChart');
        
        if (!chartCanvas) return;
        
        const ctx = chartCanvas.getContext('2d');
        
        // Destroy existing chart if it exists
        if (charts.activityTimeline) {
            charts.activityTimeline.destroy();
        }
        
        // Format data for the chart
        const labels = timeline.map(t => formatDate(t.date));
        const data = timeline.map(t => t.count || 0);

        console.log("This is the labels for the activity timeline", labels)
        
        // Only create chart if we have data
        if (labels.length > 0) {
            // Create the chart
            charts.activityTimeline = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Messages',
                        data: data,
                        backgroundColor: 'rgba(75, 192, 192, 0.1)',
                        borderColor: '#4cc9f0',
                        borderWidth: 2,
                        pointBackgroundColor: '#4cc9f0',
                        pointRadius: 4,
                        fill: true,
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Number of Messages'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Date'
                            }
                        }
                    }
                }
            });
            
            // Create hourly activity chart (using mock data)
            renderHourlyActivityChart();
        } else {
            // Show a message if no data
            chartCanvas.parentElement.innerHTML = '<p>No activity timeline data available</p>';
        }
    }
    
    function renderHourlyActivityChart() {
        const chartCanvas = document.getElementById('hourlyActivityChart');
        if (!chartCanvas) return;
        
        const ctx = chartCanvas.getContext('2d');
        
        // Destroy existing chart if it exists
        if (charts.hourlyActivity) {
            charts.hourlyActivity.destroy();
        }
        
        // Create hours array (0-23)
        const hours = Array.from({ length: 24 }, (_, i) => i);
        
        // Create mock data for hourly activity
        // In a real implementation, this would come from analytics.student_analytics.personal_engagement.active_times
        const hourlyData = hours.map(hour => {
            return { hour: hour, count: Math.floor(Math.random() * 20) };
        });
        
        charts.hourlyActivity = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: hours.map(hour => `${hour}:00`),
                datasets: [{
                    label: 'Activity Count',
                    data: hourlyData.map(d => d.count),
                    backgroundColor: hours.map(hour => {
                        // Color based on time of day
                        if (hour >= 6 && hour < 12) return '#4cc9f0'; // Morning
                        if (hour >= 12 && hour < 18) return '#4895ef'; // Afternoon
                        if (hour >= 18 && hour < 22) return '#3a0ca3'; // Evening
                        return '#3f37c9'; // Night
                    }),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Messages'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Hour of Day'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            title: function(tooltipItems) {
                                const hour = tooltipItems[0].label;
                                return `Time: ${hour}`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Prepare polls tab
    function preparePollsTab() {
        const pollsTab = document.getElementById('polls-tab');
        if (!pollsTab) return;
        
        // Clear existing content
        pollsTab.innerHTML = '';
        
        const polls = analyticsData.polls || [];
        
        if (polls.length === 0) {
            pollsTab.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle"></i> No polls have been created in this room yet.
                </div>
            `;
            return;
        }
        
        // Create container for poll results
        const pollResultsContainer = document.createElement('div');
        pollResultsContainer.id = 'pollResults';
        pollResultsContainer.className = 'poll-results-container';
        
        pollsTab.appendChild(pollResultsContainer);
    }
    
    // Render poll results
    function renderPollResults() {
        const polls = analyticsData.polls || [];
        const container = document.getElementById('pollResults');
        
        if (!container) return;
        
        // Clear previous content
        container.innerHTML = '';

        if (polls.length === 0) {
            container.innerHTML = '<div class="no-polls">No polls have been created in this room.</div>';
            return;
        }
        
        // Create a card for each poll with enhanced visualization
        polls.forEach((poll, pollIndex) => {
            const pollCard = document.createElement('div');
            pollCard.className = 'poll-result-card';
            pollCard.style.marginBottom = '30px';
            pollCard.style.border = '1px solid #e0e0e0';
            pollCard.style.borderRadius = '8px';
            pollCard.style.padding = '15px';
            pollCard.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
            
            // Poll question
            const question = document.createElement('div');
            question.className = 'poll-question';
            question.style.fontSize = '18px';
            question.style.fontWeight = 'bold';
            question.style.marginBottom = '15px';
            question.textContent = poll.question || 'Unnamed Poll';
            pollCard.appendChild(question);
            
            // Get poll options or create empty array
            const options = poll.options || [];
            
            if (options.length === 0) {
                const emptyMessage = document.createElement('p');
                emptyMessage.textContent = 'No options available for this poll';
                pollCard.appendChild(emptyMessage);
                container.appendChild(pollCard);
                return;
            }
            
            // Calculate total votes for percentage
            const totalVotes = options.reduce((sum, option) => sum + (option.votes || 0), 0);
            
            // Create canvas for chart
            const chartContainer = document.createElement('div');
            chartContainer.style.marginBottom = '20px';
            chartContainer.style.height = '250px';
            
            const chartCanvas = document.createElement('canvas');
            chartCanvas.id = `poll-chart-${pollIndex}`;
            chartContainer.appendChild(chartCanvas);
            pollCard.appendChild(chartContainer);
            
            // Poll options list with enhanced styling
            const optionsList = document.createElement('div');
            optionsList.className = 'poll-options-list';
            
            options.forEach((option, optionIndex) => {
                const optionElement = document.createElement('div');
                optionElement.className = 'poll-option';
                optionElement.style.marginBottom = '10px';
                optionElement.style.display = 'flex';
                optionElement.style.alignItems = 'center';
                optionElement.style.justifyContent = 'space-between';
                
                // Option text and votes
                const optionText = document.createElement('div');
                optionText.className = 'poll-option-text';
                optionText.style.flexGrow = '1';
                
                const optionLabel = document.createElement('span');
                optionLabel.textContent = option.option || 'Unnamed Option';
                optionLabel.style.fontWeight = '500';
                
                optionText.appendChild(optionLabel);
                
                // Votes display
                const votes = option.votes || 0;
                const optionVotes = document.createElement('div');
                optionVotes.className = 'poll-option-votes';
                optionVotes.style.marginLeft = '15px';
                optionVotes.style.fontWeight = 'bold';
                optionVotes.textContent = `${votes} vote${votes !== 1 ? 's' : ''}`;
                
                // Calculate percentage
                const percentage = totalVotes > 0 ? ((option.votes || 0) / totalVotes) * 100 : 0;
                const percentText = document.createElement('div');
                percentText.className = 'poll-option-percent';
                percentText.style.minWidth = '60px';
                percentText.style.textAlign = 'right';
                percentText.style.fontWeight = 'bold';
                percentText.textContent = `${percentage.toFixed(1)}%`;
                
                optionElement.appendChild(optionText);
                optionElement.appendChild(optionVotes);
                optionElement.appendChild(percentText);
                
                optionsList.appendChild(optionElement);
            });
            
            pollCard.appendChild(optionsList);
            container.appendChild(pollCard);
            
            // Create chart for this poll
            renderPollChart(poll, pollIndex, totalVotes);
        });
    }
    
    // Helper function to render chart for a poll
    function renderPollChart(poll, pollIndex, totalVotes) {
        const chartCanvas = document.getElementById(`poll-chart-${pollIndex}`);
        if (!chartCanvas) return;
        
        const ctx = chartCanvas.getContext('2d');
        
        const options = poll.options || [];
        const optionLabels = options.map(opt => opt.option || 'Unnamed');
        const optionVotes = options.map(opt => opt.votes || 0);
        
        // Create a unique chart for this poll
        const pollChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: optionLabels,
                datasets: [{
                    label: 'Votes',
                    data: optionVotes,
                    backgroundColor: options.map((_, i) => colorPalette[i % colorPalette.length]),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Votes'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const votes = context.raw || 0;
                                const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
                                return `Votes: ${votes} (${percentage.toFixed(1)}%)`;
                            }
                        }
                    }
                }
            }
        });
        
        // Store the chart reference
        charts[`pollChart-${pollIndex}`] = pollChart;
    }
    
    // Helper function to format dates nicely
    function formatDate(dateString) {
        if (!dateString) return '';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        } catch (e) {
            return dateString;
        }
    }
    
    // Public methods
    return {
        init: init,
        fetchAnalytics: fetchAnalytics
    };
})();

/**
 * Enhanced CSS for the analytics dashboard
 * This will be added dynamically to the page
 */
function addAnalyticsStyles() {
    const analyticsStyles = `
    .analytics-modal {
        max-width: 90% !important;
    }
    
    .analytics-spinner {
        border: 4px solid rgba(0, 0, 0, 0.1);
        border-left-color: #007bff;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .spinner-container {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 200px;
    }
    
    .analytics-tabs {
        display: flex;
        border-bottom: 1px solid #dee2e6;
        margin-bottom: 20px;
    }
    
    .analytics-tab {
        padding: 10px 15px;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        font-weight: 500;
    }
    
    .analytics-tab.active {
        color: #007bff;
        border-bottom: 2px solid #007bff;
    }
    
    .analytics-tab-content {
        display: none;
    }
    
    .analytics-tab-content.active {
        display: block;
        animation: fadeIn 0.3s;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    .analytics-stat {
        background-color: #f8f9fa;
        border-radius: 8px;
        padding: 15px;
        text-align: center;
        height: 100%;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        transition: transform 0.2s;
    }
    
    .analytics-stat:hover {
        transform: translateY(-5px);
    }
    
    .stat-value {
        font-size: 24px;
        font-weight: bold;
        margin-bottom: 5px;
        color: #007bff;
    }
    
    .stat-label {
        font-size: 14px;
        color: #6c757d;
    }
    
    .analytics-card {
        background-color: #fff;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        margin-bottom: 20px;
        overflow: hidden;
    }
    
    .analytics-card-header {
        padding: 15px;
        border-bottom: 1px solid #e9ecef;
        background-color: #f8f9fa;
    }
    
    .analytics-card-header h5 {
        margin: 0;
        color: #495057;
    }
    
    .analytics-card-body {
        padding: 20px;
    }
    
    .chart-container {
        position: relative;
        margin: auto;
        height: 300px;
    }
    
    .message-type-pill {
        display: inline-block;
        padding: 5px 10px;
        border-radius: 15px;
        margin: 0 5px 5px 0;
        font-size: 13px;
    }
    
    .poll-result-card {
        margin-bottom: 25px;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        padding: 20px;
    }
    
    .poll-question {
        font-size: 18px;
        font-weight: bold;
        margin-bottom: 15px;
    }
    
    .poll-option {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid #f0f0f0;
    }
    
    .poll-option-bar {
        height: 10px;
        background-color: #e9ecef;
        border-radius: 5px;
        overflow: hidden;
        margin: 5px 0;
    }
    
    .poll-option-progress {
        height: 100%;
        border-radius: 5px;
    }
    
    .progress {
        height: 10px;
        border-radius: 5px;
    }
    `;
    
    // Add the CSS to the page
    const styleTag = document.createElement('style');
    styleTag.textContent = analyticsStyles;
    document.head.appendChild(styleTag);
}

// Add the enhanced styles when this script loads
addAnalyticsStyles();

// Initialize analytics when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Find room ID either from element or directly from URL
    let roomId;
    
    // Try getting it from data attribute
    const roomIdElement = document.getElementById('room-id-data');
    if (roomIdElement) {
        roomId = roomIdElement.getAttribute('data-room-id');
    } 
    // Try from global variable
    else if (typeof currentRoomId !== 'undefined') {
        roomId = currentRoomId;
    } 
    // Extract from URL as last resort
    else {
        const pathParts = window.location.pathname.split('/');
        for (let i = 0; i < pathParts.length; i++) {
            if (pathParts[i] === 'hub-room' && i + 1 < pathParts.length) {
                roomId = pathParts[i + 1];
                break;
            }
        }
    }
    
    if (roomId) {
        // Initialize the enhanced analytics module
        RoomAnalytics.init(roomId);
    } else {
        console.error('Room ID not found. Analytics cannot be initialized.');
    }
});