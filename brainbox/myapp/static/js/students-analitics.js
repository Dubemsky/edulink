/**
 * Enhanced Student Analytics Module
 * This script provides a comprehensive analytics dashboard for students
 * to track their engagement, participation, and learning progress
 */

const StudentAnalytics = (function() {
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
        'poll': '#b5179e',
        'question': '#f77f00'
    };

    // Initialize the module
    function init(roomId) {
        console.log("Initializing student analytics with room ID:", roomId);
        
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
        
        fetch(`/student-analytics/${roomId}/`)
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
    // Fix for the 'renderActiveHoursDistribution is not defined' error
// In the renderAnalyticsComponents function, change:
    function renderAnalyticsComponents() {
        try {
            // Prepare overview tab
            renderOverviewStats();
            renderEngagementDonut();
            
            // Prepare activity tab
            renderActivityTimeline();
            renderHoursDistributionChart(); // Use correct function name (was renderActiveHoursDistribution)
            
            // Prepare social tab
            renderSocialInteractions();
            renderInteractionQuality();
            
            // Prepare insights tab
            renderPersonalInsights();
            renderProgressIndicators();
            
        } catch (error) {
            console.error('Error rendering analytics components:', error);
            showError('Error rendering analytics data');
        }
    }
        
    // 1. OVERVIEW TAB - Render overview statistics
    function renderOverviewStats() {
        const overviewTab = document.getElementById('overview-tab');
        if (!overviewTab) return;
        
        const personal = analyticsData.personal_engagement || {};
        const social = analyticsData.social_interaction || {};
        const learning = analyticsData.learning_behavior || {};
        
        // Create metrics row
        const statsRow = document.createElement('div');
        statsRow.className = 'row mb-4';
        
        // Define the key metrics
        const metrics = [
            {
                value: personal.messages_sent || 0,
                label: 'Questions Asked',
                icon: 'fa-question-circle',
                color: 'primary'
            },
            {
                value: personal.replies_sent || 0,
                label: 'Answers Given',
                icon: 'fa-comment',
                color: 'success'
            },
            {
                value: social.upvotes_received || 0,
                label: 'Upvotes Received',
                icon: 'fa-thumbs-up',
                color: 'info'
            },
            {
                value: learning.bookmarks_count || 0,
                label: 'Bookmarks',
                icon: 'fa-bookmark',
                color: 'warning'
            }
        ];
        
        // Create each stat card
        metrics.forEach(metric => {
            const col = document.createElement('div');
            col.className = 'col-md-3';
            col.innerHTML = `
                <div class="analytics-stat">
                    <div class="stat-icon bg-${metric.color}">
                        <i class="fa ${metric.icon}"></i>
                    </div>
                    <div class="stat-value">${metric.value}</div>
                    <div class="stat-label">${metric.label}</div>
                </div>
            `;
            statsRow.appendChild(col);
        });
        
        // Add to overview tab
        overviewTab.appendChild(statsRow);
        
        // Add participation percentage card
        const participationCard = document.createElement('div');
        participationCard.className = 'analytics-card mb-4';
        
        // Calculate participation percentage
        const participationPercentage = personal.participation_percentage || 0;
        const participationColor = getParticipationColor(participationPercentage);
        
        participationCard.innerHTML = `
            <div class="analytics-card-header">
                <h5>Your Participation</h5>
            </div>
            <div class="analytics-card-body">
                <div class="row align-items-center">
                    <div class="col-md-4 text-center">
                        <div class="participation-gauge">
                            <div class="gauge-value ${participationColor}">${participationPercentage.toFixed(1)}%</div>
                            <div class="gauge-label">of room activity</div>
                        </div>
                    </div>
                    <div class="col-md-8">
                        <div class="progress participation-progress" style="height: 24px;">
                            <div class="progress-bar bg-${participationColor}" role="progressbar" 
                                style="width: ${participationPercentage}%" 
                                aria-valuenow="${participationPercentage}" 
                                aria-valuemin="0" 
                                aria-valuemax="100">
                                ${participationPercentage.toFixed(1)}%
                            </div>
                        </div>
                        <div class="participation-description mt-2">
                            ${getParticipationMessage(participationPercentage)}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        overviewTab.appendChild(participationCard);
        
        // Add engagement donut chart container
        const donutContainer = document.createElement('div');
        donutContainer.className = 'analytics-card';
        donutContainer.innerHTML = `
            <div class="analytics-card-header">
                <h5>Engagement Distribution</h5>
            </div>
            <div class="analytics-card-body">
                <div class="row">
                    <div class="col-md-7">
                        <div class="chart-container" style="height: 250px;">
                            <canvas id="engagementDonutChart"></canvas>
                        </div>
                    </div>
                    <div class="col-md-5">
                        <div class="donut-legend" id="engagementDonutLegend"></div>
                    </div>
                </div>
            </div>
        `;
        
        overviewTab.appendChild(donutContainer);
    }
    
    // Helper function to get color for participation percentage
    function getParticipationColor(percentage) {
        if (percentage < 5) return 'danger';
        if (percentage < 15) return 'warning';
        if (percentage < 30) return 'info';
        return 'success';
    }
    
    // Helper function to get a message based on participation
    function getParticipationMessage(percentage) {
        if (percentage < 5) {
            return 'Your participation is quite low. Consider contributing more to discussions to enhance your learning experience.';
        } else if (percentage < 15) {
            return 'Your participation is below average. More active engagement could help you better understand the material.';
        } else if (percentage < 30) {
            return 'You\'re participating at a good level, but there\'s room to engage more with class discussions.';
        } else {
            return 'Great job! You\'re an active participant in class discussions, which enhances both your learning and your peers\'.';
        }
    }
    
    // Render engagement donut chart
    function renderEngagementDonut() {
        const canvas = document.getElementById('engagementDonutChart');
        const legendContainer = document.getElementById('engagementDonutLegend');
        if (!canvas || !legendContainer) return;
        
        const ctx = canvas.getContext('2d');
        
        // Get data from analytics
        const personal = analyticsData.personal_engagement || {};
        const learning = analyticsData.learning_behavior || {};
        const social = analyticsData.social_interaction || {};
        
        // Define engagement categories
        const engagementData = [
            { 
                label: 'Questions', 
                value: personal.messages_sent || 0, 
                color: messageTypeColors.question 
            },
            { 
                label: 'Replies', 
                value: personal.replies_sent || 0, 
                color: messageTypeColors.text 
            },
            { 
                label: 'Poll Votes', 
                value: learning.poll_votes_count || 0, 
                color: messageTypeColors.poll 
            },
            { 
                label: 'Bookmarks', 
                value: learning.bookmarks_count || 0, 
                color: '#f9c74f' 
            },
            { 
                label: 'Votes Given', 
                value: (social.upvotes_given || 0) + (social.downvotes_given || 0), 
                color: '#277da1' 
            }
        ];
        
        // Filter out zero values
        const filteredData = engagementData.filter(item => item.value > 0);
        
        // If no data, show a message
        if (filteredData.length === 0) {
            const noDataMessage = document.createElement('div');
            noDataMessage.className = 'text-center text-muted mt-4';
            noDataMessage.innerHTML = '<p>No engagement data available yet</p>';
            canvas.parentElement.replaceChild(noDataMessage, canvas);
            legendContainer.innerHTML = '';
            return;
        }
        
        // Create the chart
        if (charts.engagementDonut) {
            charts.engagementDonut.destroy();
        }
        
        charts.engagementDonut = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: filteredData.map(item => item.label),
                datasets: [{
                    data: filteredData.map(item => item.value),
                    backgroundColor: filteredData.map(item => item.color),
                    borderWidth: 1,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        display: false
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
        
        // Create custom legend
        legendContainer.innerHTML = '';
        filteredData.forEach(item => {
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            legendItem.innerHTML = `
                <span class="legend-color" style="background-color: ${item.color}"></span>
                <span class="legend-label">${item.label}: ${item.value}</span>
            `;
            legendContainer.appendChild(legendItem);
        });
    }
    
    // 2. ACTIVITY TAB - Render activity timeline
    function renderActivityTimeline() {
        const activityTab = document.getElementById('activity-tab');
        if (!activityTab) return;
        
        // Clear existing content
        activityTab.innerHTML = '';
        
        // Create activity timeline card
        const timelineCard = document.createElement('div');
        timelineCard.className = 'analytics-card mb-4';
        timelineCard.innerHTML = `
            <div class="analytics-card-header">
                <h5>Activity Over Time</h5>
            </div>
            <div class="analytics-card-body">
                <div class="chart-container" style="height: 300px;">
                    <canvas id="activityTimelineChart"></canvas>
                </div>
                <div class="activity-trend mt-3" id="activityTrendIndicator"></div>
            </div>
        `;
        
        activityTab.appendChild(timelineCard);
        
        // Create hours distribution card
        const hoursCard = document.createElement('div');
        hoursCard.className = 'analytics-card mb-4';
        hoursCard.innerHTML = `
            <div class="analytics-card-header">
                <h5>Activity by Hour of Day</h5>
            </div>
            <div class="analytics-card-body">
                <div class="chart-container" style="height: 250px;">
                    <canvas id="hoursDistributionChart"></canvas>
                </div>
            </div>
        `;
        
        activityTab.appendChild(hoursCard);
        
        // Create consistency score card
        const consistencyCard = document.createElement('div');
        consistencyCard.className = 'analytics-card';
        
        const progress = analyticsData.progress_indicators || {};
        const personal = analyticsData.personal_engagement || {};
        const consistencyScore = progress.consistency_score || 0;
        const activeDays = personal.active_days || 0;
        
        const consistencyColor = getConsistencyColor(consistencyScore);
        
        consistencyCard.innerHTML = `
            <div class="analytics-card-header">
                <h5>Consistency Metrics</h5>
            </div>
            <div class="analytics-card-body">
                <div class="row align-items-center">
                    <div class="col-md-5 text-center">
                        <div class="consistency-score ${consistencyColor}">
                            <div class="score-value">${consistencyScore.toFixed(1)}%</div>
                            <div class="score-label">Consistency Score</div>
                        </div>
                    </div>
                    <div class="col-md-7">
                        <div class="consistency-details">
                            <div class="detail-item">
                                <div class="detail-label">Active Days</div>
                                <div class="detail-value">${activeDays}</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">Participation Trend</div>
                                <div class="detail-value" id="participationTrendText">
                                    ${getTrendText(progress.trend_analysis ? progress.trend_analysis.trend : 'stable')}
                                </div>
                            </div>
                        </div>
                        <div class="consistency-message mt-3">
                            ${getConsistencyMessage(consistencyScore)}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        activityTab.appendChild(consistencyCard);
        
        // Render the charts after DOM elements are created
        setTimeout(() => {
            renderActivityChart();
            renderHoursDistributionChart();
        }, 100);
    }
    
    // Render activity chart
    function renderActivityChart() {
        const canvas = document.getElementById('activityTimelineChart');
        const trendIndicator = document.getElementById('activityTrendIndicator');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Get data from analytics
        const progress = analyticsData.progress_indicators || {};
        const timelineData = progress.activity_timeline || [];
        
        // If no data, show a message
        if (!timelineData || timelineData.length === 0) {
            const noDataMessage = document.createElement('div');
            noDataMessage.className = 'text-center text-muted mt-4';
            noDataMessage.innerHTML = '<p>No activity data available yet</p>';
            canvas.parentElement.replaceChild(noDataMessage, canvas);
            if (trendIndicator) trendIndicator.innerHTML = '';
            return;
        }
        
        // Format data for chart
        const dates = timelineData.map(item => formatDate(item.date));
        const counts = timelineData.map(item => item.count || 0);
        
        // Create the chart
        if (charts.activityTimeline) {
            charts.activityTimeline.destroy();
        }
        
        charts.activityTimeline = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Activity Count',
                    data: counts,
                    borderColor: '#4361ee',
                    backgroundColor: 'rgba(67, 97, 238, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#4361ee',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            precision: 0
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        titleColor: '#333',
                        bodyColor: '#666',
                        borderColor: '#ddd',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return `Activities: ${context.raw}`;
                            }
                        }
                    }
                }
            }
        });
        
        // Show trend analysis
        if (trendIndicator && progress.trend_analysis) {
            const trend = progress.trend_analysis.trend;
            const trendClass = trend === 'increasing' ? 'positive-trend' : 
                              trend === 'decreasing' ? 'negative-trend' : 
                              'neutral-trend';
            
            const trendIcon = trend === 'increasing' ? 'fa-arrow-up' : 
                             trend === 'decreasing' ? 'fa-arrow-down' : 
                             'fa-minus';
            
            trendIndicator.innerHTML = `
                <div class="trend-indicator ${trendClass}">
                    <i class="fa ${trendIcon}"></i>
                    <span>Your activity is ${trend}. ${getTrendAdvice(trend)}</span>
                </div>
            `;
        }
    }
    
    // Render hours distribution chart
    function renderHoursDistributionChart() {
        const canvas = document.getElementById('hoursDistributionChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Get data from analytics
        const personal = analyticsData.personal_engagement || {};
        const activeTimesData = personal.active_times || [];
        
        // If no data, show a message
        if (!activeTimesData || activeTimesData.length === 0) {
            const noDataMessage = document.createElement('div');
            noDataMessage.className = 'text-center text-muted mt-4';
            noDataMessage.innerHTML = '<p>No hourly activity data available yet</p>';
            canvas.parentElement.replaceChild(noDataMessage, canvas);
            return;
        }
        
        // Create a 24-hour distribution with all hours represented
        const hourlyData = Array(24).fill(0);
        
        // Fill in the data we have
        activeTimesData.forEach(item => {
            if (item && typeof item.hour === 'number' && item.hour >= 0 && item.hour < 24) {
                hourlyData[item.hour] = item.count || 0;
            }
        });
        
        // Label format for hours
        const hourLabels = Array(24).fill().map((_, i) => `${i}:00`);
        
        // Create the chart
        if (charts.hoursDistribution) {
            charts.hoursDistribution.destroy();
        }
        
        charts.hoursDistribution = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: hourLabels,
                datasets: [{
                    label: 'Activity Count',
                    data: hourlyData,
                    backgroundColor: getHourColors(),
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            precision: 0
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxRotation: 0,
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
    }
    
    // 3. SOCIAL TAB - Render social interactions
    function renderSocialInteractions() {
        const socialTab = document.getElementById('social-tab');
        if (!socialTab) return;
        
        // Clear existing content
        socialTab.innerHTML = '';
        
        // Get data from analytics
        const social = analyticsData.social_interaction || {};
        const personal = analyticsData.personal_engagement || {};
        
        // Create social metrics card
        const metricsCard = document.createElement('div');
        metricsCard.className = 'analytics-card mb-4';
        metricsCard.innerHTML = `
            <div class="analytics-card-header">
                <h5>Social Interaction Metrics</h5>
            </div>
            <div class="analytics-card-body">
                <div class="row">
                    <div class="col-md-6 mb-4">
                        <div class="interaction-metric">
                            <div class="metric-header">
                                <div class="metric-icon upvotes-received">
                                    <i class="fa fa-thumbs-up"></i>
                                </div>
                                <div class="metric-title">
                                    <div class="metric-value">${social.upvotes_received || 0}</div>
                                    <div class="metric-label">Upvotes Received</div>
                                </div>
                            </div>
                            <div class="metric-bar">
                                <div class="progress">
                                    <div class="progress-bar bg-success" style="width: 100%"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6 mb-4">
                        <div class="interaction-metric">
                            <div class="metric-header">
                                <div class="metric-icon upvotes-given">
                                    <i class="fa fa-thumbs-up"></i>
                                </div>
                                <div class="metric-title">
                                    <div class="metric-value">${social.upvotes_given || 0}</div>
                                    <div class="metric-label">Upvotes Given</div>
                                </div>
                            </div>
                            <div class="metric-bar">
                                <div class="progress">
                                    <div class="progress-bar bg-info" style="width: 100%"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6 mb-4">
                        <div class="interaction-metric">
                            <div class="metric-header">
                                <div class="metric-icon response-rate">
                                    <i class="fa fa-reply"></i>
                                </div>
                                <div class="metric-title">
                                    <div class="metric-value">${social.response_rate ? social.response_rate.toFixed(1) : 0}%</div>
                                    <div class="metric-label">Response Rate</div>
                                </div>
                            </div>
                            <div class="metric-bar">
                                <div class="progress">
                                    <div class="progress-bar bg-primary" style="width: ${social.response_rate || 0}%"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6 mb-4">
                        <div class="interaction-metric">
                            <div class="metric-header">
                                <div class="metric-icon teacher-interaction">
                                    <i class="fa fa-user"></i>
                                </div>
                                <div class="metric-title">
                                    <div class="metric-value">${social.teacher_interaction_rate ? social.teacher_interaction_rate.toFixed(1) : 0}%</div>
                                    <div class="metric-label">Teacher Interaction</div>
                                </div>
                            </div>
                            <div class="metric-bar">
                                <div class="progress">
                                    <div class="progress-bar bg-warning" style="width: ${social.teacher_interaction_rate || 0}%"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        socialTab.appendChild(metricsCard);
        
        // Create contribution score card
        const contributionCard = document.createElement('div');
        contributionCard.className = 'analytics-card mb-4';
        
        const netScore = social.net_contribution_score || 0;
        const scoreClass = netScore > 0 ? 'positive-score' : netScore < 0 ? 'negative-score' : 'neutral-score';
        const scoreIcon = netScore > 0 ? 'fa-arrow-up' : netScore < 0 ? 'fa-arrow-down' : 'fa-minus';
        
        contributionCard.innerHTML = `
            <div class="analytics-card-header">
                <h5>Net Contribution Score</h5>
            </div>
            <div class="analytics-card-body">
                <div class="row align-items-center">
                    <div class="col-md-4 text-center">
                        <div class="contribution-score ${scoreClass}">
                            <i class="fa ${scoreIcon}"></i>
                            <span>${netScore}</span>
                        </div>
                    </div>
                    <div class="col-md-8">
                        <div class="contribution-details">
                            <p>${getContributionMessage(netScore)}</p>
                            <div class="contribution-breakdown">
                                <div class="breakdown-item">
                                    <div class="breakdown-label">Upvotes Received</div>
                                    <div class="breakdown-value positive">${social.upvotes_received || 0}</div>
                                </div>
                                <div class="breakdown-item">
                                    <div class="breakdown-label">Downvotes Received</div>
                                    <div class="breakdown-value negative">${social.downvotes_received || 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        socialTab.appendChild(contributionCard);
        
        // Create reading vs. writing card
        const readingWritingCard = document.createElement('div');
        readingWritingCard.className = 'analytics-card';
        
        const learning = analyticsData.learning_behavior || {};
        const rwRatio = learning.reading_writing_ratio || 1;
        const readingPercentage = Math.min(Math.round((rwRatio / (1 + rwRatio)) * 100), 100);
        const writingPercentage = 100 - readingPercentage;
        
        readingWritingCard.innerHTML = `
            <div class="analytics-card-header">
                <h5>Reading vs. Writing Balance</h5>
            </div>
            <div class="analytics-card-body">
                <div class="balance-visualization">
                    <div class="balance-bar">
                        <div class="reading-bar" style="width: ${readingPercentage}%">
                            <span class="bar-label">Reading ${readingPercentage}%</span>
                        </div>
                        <div class="writing-bar" style="width: ${writingPercentage}%">
                            <span class="bar-label">Writing ${writingPercentage}%</span>
                        </div>
                    </div>
                </div>
                <div class="balance-interpretation mt-3">
                    <p>${getReadingWritingAdvice(rwRatio)}</p>
                </div>
            </div>
        `;
        
        socialTab.appendChild(readingWritingCard);
    }
    
    // Render interaction quality
    function renderInteractionQuality() {
        const socialTab = document.getElementById('social-tab');
        if (!socialTab) return;
        
        // Add top content section if available
        const progress = analyticsData.progress_indicators || {};
        const topContent = progress.top_content || [];
        
        if (topContent && topContent.length > 0) {
            const topContentCard = document.createElement('div');
            topContentCard.className = 'analytics-card mt-4';
            
            let topContentHTML = '';
            topContent.forEach((content, index) => {
                const contentType = content.type || 'message';
                const icon = contentType === 'message' ? 'fa-comment' : 'fa-reply';
                const votes = content.votes || 0;
                const contentText = content.content || 'No content';
                
                topContentHTML += `
                    <div class="top-content-item">
                        <div class="content-rank">#${index + 1}</div>
                        <div class="content-body">
                            <div class="content-header">
                                <span class="content-type"><i class="fa ${icon}"></i> ${contentType.charAt(0).toUpperCase() + contentType.slice(1)}</span>
                                <span class="content-votes"><i class="fa fa-thumbs-up"></i> ${votes}</span>
                            </div>
                            <div class="content-text">${truncateText(contentText, 100)}</div>
                        </div>
                    </div>
                `;
            });
            
            topContentCard.innerHTML = `
                <div class="analytics-card-header">
                    <h5>Your Top Content</h5>
                </div>
                <div class="analytics-card-body">
                    <div class="top-content-list">
                        ${topContentHTML}
                    </div>
                </div>
            `;
            
            socialTab.appendChild(topContentCard);
        }
    }
    
    // 4. INSIGHTS TAB - Render personal insights
    function renderPersonalInsights() {
        const insightsTab = document.getElementById('insights-tab');
        if (!insightsTab) return;
        
        // Clear existing content
        insightsTab.innerHTML = '';
        
        // Get insights from analytics
        const insights = analyticsData.actionable_insights || [];
        
        // Create insights card
        const insightsCard = document.createElement('div');
        insightsCard.className = 'analytics-card mb-4';
        
        let insightsHTML = '';
        if (insights && insights.length > 0) {
            insights.forEach(insight => {
                const importanceClass = insight.importance === 'high' ? 'high-importance' :
                                        insight.importance === 'medium' ? 'medium-importance' :
                                        'low-importance';
                
                insightsHTML += `
                    <div class="insight-item ${importanceClass}">
                        <div class="insight-icon">
                            <i class="fa ${getInsightIcon(insight.type)}"></i>
                        </div>
                        <div class="insight-content">
                            <div class="insight-message">${insight.message}</div>
                            <div class="insight-type">${capitalizeFirstLetter(insight.type)}</div>
                        </div>
                    </div>
                `;
            });
        } else {
            insightsHTML = `
                <div class="no-insights">
                    <div class="no-insights-icon">
                        <i class="fa fa-lightbulb-o"></i>
                    </div>
                    <div class="no-insights-message">
                        <p>No specific insights available yet. Keep participating to get personalized recommendations!</p>
                    </div>
                </div>
            `;
        }
        
        insightsCard.innerHTML = `
            <div class="analytics-card-header">
                <h5>Personalized Insights</h5>
            </div>
            <div class="analytics-card-body">
                <div class="insights-container">
                    ${insightsHTML}
                </div>
            </div>
        `;
        
        insightsTab.appendChild(insightsCard);
        
        // Create content analytics card
        const contentCard = document.createElement('div');
        contentCard.className = 'analytics-card mb-4';
        
        const content = analyticsData.content_analytics || {};
        const messageTypes = content.message_types || {};
        
        let messageTypesHTML = '';
        for (const [type, count] of Object.entries(messageTypes)) {
            if (count > 0) {
                messageTypesHTML += `
                    <div class="content-type-item">
                        <div class="content-type-icon" style="background-color: ${messageTypeColors[type] || '#777'}">
                            <i class="fa ${getContentTypeIcon(type)}"></i>
                        </div>
                        <div class="content-type-details">
                            <div class="content-type-name">${capitalizeFirstLetter(type)}</div>
                            <div class="content-type-count">${count}</div>
                        </div>
                    </div>
                `;
            }
        }
        
        contentCard.innerHTML = `
            <div class="analytics-card-header">
                <h5>Content Analysis</h5>
            </div>
            <div class="analytics-card-body">
                <div class="row">
                    <div class="col-md-7">
                        <div class="content-types-list">
                            ${messageTypesHTML || '<p class="text-muted text-center">No content type data available</p>'}
                        </div>
                    </div>
                    <div class="col-md-5">
                        <div class="content-metrics">
                            <div class="content-metric">
                                <div class="metric-label">Average Message Length</div>
                                <div class="metric-value">${content.avg_message_length ? content.avg_message_length.toFixed(0) : 0} chars</div>
                            </div>
                            <div class="content-metric">
                                <div class="metric-label">Question Rate</div>
                                <div class="metric-value">${content.question_rate ? content.question_rate.toFixed(1) : 0}%</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        insightsTab.appendChild(contentCard);
    }
    
    // Render progress indicators
    function renderProgressIndicators() {
        const insightsTab = document.getElementById('insights-tab');
        if (!insightsTab) return;
        
        // Create learning behavior card
        const learningCard = document.createElement('div');
        learningCard.className = 'analytics-card';
        
        const learning = analyticsData.learning_behavior || {};
        
        learningCard.innerHTML = `
            <div class="analytics-card-header">
                <h5>Learning Behavior</h5>
            </div>
            <div class="analytics-card-body">
                <div class="row">
                    <div class="col-md-6">
                        <div class="learning-metric">
                            <div class="metric-header">
                                <div class="metric-icon poll">
                                    <i class="fa fa-bar-chart"></i>
                                </div>
                                <div class="metric-details">
                                    <div class="metric-label">Poll Participation</div>
                                    <div class="metric-value">${learning.poll_participation_rate ? learning.poll_participation_rate.toFixed(1) : 0}%</div>
                                </div>
                            </div>
                            <div class="progress">
                                <div class="progress-bar bg-primary" style="width: ${learning.poll_participation_rate || 0}%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="learning-metric">
                            <div class="metric-header">
                                <div class="metric-icon resource">
                                    <i class="fa fa-file"></i>
                                </div>
                                <div class="metric-details">
                                    <div class="metric-label">Resource Engagement</div>
                                    <div class="metric-value">${learning.resource_engagement || 0}</div>
                                </div>
                            </div>
                            <div class="progress">
                                <div class="progress-bar bg-success" style="width: 100%"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="learning-behavior-summary mt-4">
                    <h6>Your Learning Style</h6>
                    <p>${getLearningStyleDescription(learning)}</p>
                </div>
            </div>
        `;
        
        insightsTab.appendChild(learningCard);
    }
    
    // HELPER FUNCTIONS
    
    // Helper to format dates nicely
    function formatDate(dateString) {
        if (!dateString) return '';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        } catch (e) {
            return dateString;
        }
    }
    
    // Helper to get colors for hour of day chart
    function getHourColors() {
        // Color gradient based on time of day
        return Array(24).fill().map((_, hour) => {
            if (hour >= 0 && hour < 6) {
                return 'rgba(25, 25, 112, 0.7)'; // Night - dark blue
            } else if (hour >= 6 && hour < 12) {
                return 'rgba(70, 130, 180, 0.7)'; // Morning - steel blue
            } else if (hour >= 12 && hour < 18) {
                return 'rgba(30, 144, 255, 0.7)'; // Afternoon - dodger blue
            } else {
                return 'rgba(65, 105, 225, 0.7)'; // Evening - royal blue
            }
        });
    }
    
    // Helper to get icon for content type
    function getContentTypeIcon(type) {
        switch (type.toLowerCase()) {
            case 'text': return 'fa-comment';
            case 'image': return 'fa-image';
            case 'file': return 'fa-file';
            case 'video': return 'fa-video-camera';
            case 'poll': return 'fa-bar-chart';
            case 'question': return 'fa-question-circle';
            default: return 'fa-comment';
        }
    }
    
    // Helper to get icon for insight type
    function getInsightIcon(type) {
        switch (type.toLowerCase()) {
            case 'participation': return 'fa-users';
            case 'content': return 'fa-file-text';
            case 'polls': return 'fa-bar-chart';
            case 'engagement': return 'fa-comments';
            case 'consistency': return 'fa-calendar-check-o';
            default: return 'fa-lightbulb-o';
        }
    }
    
    // Helper to get consistency color
    function getConsistencyColor(score) {
        if (score < 30) return 'low';
        if (score < 60) return 'medium';
        return 'high';
    }
    
    // Helper for trend text
    function getTrendText(trend) {
        if (trend === 'increasing') return 'Increasing ↑';
        if (trend === 'decreasing') return 'Decreasing ↓';
        return 'Stable →';
    }
    
    // Helper for trend advice
    function getTrendAdvice(trend) {
        if (trend === 'increasing') {
            return 'Keep up the good work!';
        } else if (trend === 'decreasing') {
            return 'Consider setting a regular schedule for participation.';
        } else {
            return 'Your activity level is consistent.';
        }
    }
    
    // Helper for consistency message
    function getConsistencyMessage(score) {
        if (score < 30) {
            return 'Your participation is inconsistent. Regular engagement helps reinforce learning and builds stronger connections with your peers.';
        } else if (score < 60) {
            return 'You\'re showing moderate consistency in your participation. Try to establish a more regular pattern of engagement.';
        } else {
            return 'Your participation is very consistent, which is excellent for sustained learning and knowledge retention.';
        }
    }
    
    // Helper for contribution message
    function getContributionMessage(score) {
        if (score > 5) {
            return 'Your contributions are highly valued by your peers, as shown by the positive reaction score. Your insights and responses are making a positive impact.';
        } else if (score > 0) {
            return 'You have a positive contribution score, showing that your peers find value in your posts and replies.';
        } else if (score === 0) {
            return 'Your contribution score is neutral. Try asking more thoughtful questions or providing more detailed responses to increase engagement.';
        } else {
            return 'Your contribution score is negative, suggesting an opportunity to improve the quality of your interactions. Consider providing more helpful, detailed responses.';
        }
    }
    
    // Helper for reading/writing advice
    function getReadingWritingAdvice(ratio) {
        if (ratio < 0.5) {
            return 'You\'re contributing more content than you\'re consuming. Try to engage more with others\' content to gain broader perspectives.';
        } else if (ratio > 5) {
            return 'You\'re primarily observing rather than contributing. Try sharing your thoughts more often to deepen your engagement and learning.';
        } else {
            return 'You have a good balance between reading and writing, which indicates engaged participation in the discussion.';
        }
    }
    
    // Helper for learning style description
    function getLearningStyleDescription(learning) {
        const ratio = learning.reading_writing_ratio || 1;
        const pollRate = learning.poll_participation_rate || 0;
        const resourceCount = learning.resource_engagement || 0;
        
        if (ratio > 3 && pollRate > 50) {
            return 'You appear to be a reflective learner who prefers to observe discussions and participate in structured activities like polls.';
        } else if (ratio < 1 && resourceCount > 2) {
            return 'You seem to be an active participant who contributes often and engages with course resources.';
        } else if (pollRate > 70) {
            return 'You show high engagement with interactive elements like polls, suggesting you may prefer structured learning activities.';
        } else {
            return 'Your learning style shows a balanced approach between content consumption and contribution, with opportunities to increase engagement with interactive elements.';
        }
    }
    
    // Helper to truncate text
    function truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
    
    // Helper to capitalize first letter
    function capitalizeFirstLetter(string) {
        if (!string) return '';
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
    
    // Public methods
    return {
        init: init,
        fetchAnalytics: fetchAnalytics
    };
})();

/**
 * CSS styles for the enhanced student analytics
 */
function addStudentAnalyticsStyles() {
    const styles = `
    /* Basic layout and containers */
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
    
    /* Cards and stats styling */
    .analytics-card {
        background-color: #fff;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
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
        font-weight: 600;
    }
    
    .analytics-card-body {
        padding: 20px;
    }
    
    .analytics-stat {
        background-color: #f8f9fa;
        border-radius: 8px;
        padding: 15px;
        display: flex;
        flex-direction: column;
        align-items: center;
        height: 100%;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        transition: transform 0.2s;
    }
    
    .analytics-stat:hover {
        transform: translateY(-5px);
    }
    
    .stat-icon {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 10px;
        color: white;
    }
    
    .stat-icon i {
        font-size: 20px;
    }
    
    .bg-primary {
        background-color: #4361ee !important;
    }
    
    .bg-success {
        background-color: #4cc9f0 !important;
    }
    
    .bg-info {
        background-color: #4895ef !important;
    }
    
    .bg-warning {
        background-color: #f9c74f !important;
    }
    
    .stat-value {
        font-size: 24px;
        font-weight: bold;
        margin-bottom: 5px;
        color: #343a40;
    }
    
    .stat-label {
        font-size: 14px;
        color: #6c757d;
    }
    
    /* Chart containers */
    .chart-container {
        position: relative;
        margin: auto;
        height: 300px;
    }
    
    /* Participation styles */
    .participation-gauge {
        background-color: #f8f9fa;
        border-radius: 10px;
        padding: 20px;
        text-align: center;
    }
    
    .gauge-value {
        font-size: 36px;
        font-weight: bold;
    }
    
    .gauge-value.success {
        color: #28a745;
    }
    
    .gauge-value.info {
        color: #17a2b8;
    }
    
    .gauge-value.warning {
        color: #ffc107;
    }
    
    .gauge-value.danger {
        color: #dc3545;
    }
    
    .gauge-label {
        font-size: 14px;
        color: #6c757d;
    }
    
    .participation-progress {
        height: 24px !important;
        border-radius: 12px;
        overflow: hidden;
        background-color: #f5f5f5;
    }
    
    .participation-description {
        font-size: 14px;
        color: #6c757d;
    }
    
    /* Donut chart legend */
    .donut-legend {
        padding: 10px;
    }
    
    .legend-item {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
    }
    
    .legend-color {
        width: 15px;
        height: 15px;
        border-radius: 3px;
        margin-right: 10px;
    }
    
    .legend-label {
        font-size: 14px;
    }
    
    /* Activity trend indicators */
    .trend-indicator {
        display: flex;
        align-items: center;
        padding: 10px;
        border-radius: 8px;
        font-size: 14px;
    }
    
    .trend-indicator i {
        margin-right: 10px;
        font-size: 16px;
    }
    
    .positive-trend {
        background-color: rgba(40, 167, 69, 0.1);
        color: #28a745;
    }
    
    .negative-trend {
        background-color: rgba(220, 53, 69, 0.1);
        color: #dc3545;
    }
    
    .neutral-trend {
        background-color: rgba(108, 117, 125, 0.1);
        color: #6c757d;
    }
    
    /* Consistency score */
    .consistency-score {
        width: 120px;
        height: 120px;
        border-radius: 50%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin: 0 auto;
    }
    
    .consistency-score.low {
        background-color: rgba(220, 53, 69, 0.1);
        color: #dc3545;
    }
    
    .consistency-score.medium {
        background-color: rgba(255, 193, 7, 0.1);
        color: #ffc107;
    }
    
    .consistency-score.high {
        background-color: rgba(40, 167, 69, 0.1);
        color: #28a745;
    }
    
    .score-value {
        font-size: 28px;
        font-weight: bold;
    }
    
    .score-label {
        font-size: 14px;
    }
    
    .consistency-details {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    
    .detail-item {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid #e9ecef;
    }
    
    .detail-label {
        color: #6c757d;
    }
    
    .detail-value {
        font-weight: 600;
    }
    
    /* Social interaction metrics */
    .interaction-metric {
        margin-bottom: 20px;
    }
    
    .metric-header {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
    }
    
    .metric-icon {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 15px;
        color: white;
    }
    
    .upvotes-received {
        background-color: #28a745;
    }
    
    .upvotes-given {
        background-color: #17a2b8;
    }
    
    .response-rate {
        background-color: #007bff;
    }
    
    .teacher-interaction {
        background-color: #ffc107;
    }
    
    .metric-title {
        flex-grow: 1;
    }
    
    .metric-bar {
        width: 100%;
    }
    
    /* Contribution score */
    .contribution-score {
        width: 120px;
        height: 120px;
        border-radius: 50%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin: 0 auto;
        font-weight: bold;
    }
    
    .contribution-score i {
        font-size: 24px;
        margin-bottom: 5px;
    }
    
    .contribution-score span {
        font-size: 28px;
    }
    
    .positive-score {
        background-color: rgba(40, 167, 69, 0.1);
        color: #28a745;
    }
    
    .negative-score {
        background-color: rgba(220, 53, 69, 0.1);
        color: #dc3545;
    }
    
    .neutral-score {
        background-color: rgba(108, 117, 125, 0.1);
        color: #6c757d;
    }
    
    .contribution-breakdown {
        display: flex;
        justify-content: space-between;
        margin-top: 15px;
        padding-top: 15px;
        border-top: 1px solid #e9ecef;
    }
    
    .breakdown-item {
        text-align: center;
        flex-grow: 1;
    }
    
    .breakdown-label {
        font-size: 14px;
        color: #6c757d;
        margin-bottom: 5px;
    }
    
    .breakdown-value {
        font-weight: bold;
        font-size: 18px;
    }
    
    .breakdown-value.positive {
        color: #28a745;
    }
    
    .breakdown-value.negative {
        color: #dc3545;
    }
    
    /* Reading vs. Writing Balance */
    .balance-visualization {
        margin-bottom: 15px;
    }
    
    .balance-bar {
        display: flex;
        height: 40px;
        border-radius: 6px;
        overflow: hidden;
    }
    
    .reading-bar {
        background-color: #4cc9f0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        text-shadow: 0 1px 2px rgba(0,0,0,0.2);
        font-weight: bold;
    }
    
    .writing-bar {
        background-color: #f72585;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        text-shadow: 0 1px 2px rgba(0,0,0,0.2);
        font-weight: bold;
    }
    
    /* Top content list */
    .top-content-list {
        max-height: 400px;
        overflow-y: auto;
    }
    
    .top-content-item {
        display: flex;
        padding: 12px 0;
        border-bottom: 1px solid #e9ecef;
    }
    
    .content-rank {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background-color: #4361ee;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        margin-right: 15px;
    }
    
    .content-body {
        flex-grow: 1;
    }
    
    .content-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
    }
    
    .content-type {
        font-size: 14px;
        color: #6c757d;
    }
    
    .content-votes {
        font-size: 14px;
        color: #28a745;
    }
    
    .content-text {
        font-size: 14px;
        color: #343a40;
    }
    
    /* Insights styles */
    .insights-container {
        display: flex;
        flex-direction: column;
        gap: 15px;
    }
    
    .insight-item {
        display: flex;
        padding: 15px;
        border-radius: 8px;
    }
    
    .insight-icon {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 15px;
    }
    
    .insight-content {
        flex-grow: 1;
    }
    
    .insight-message {
        margin-bottom: 5px;
        font-weight: 500;
    }
    
    .insight-type {
        font-size: 14px;
    }
    
    .high-importance {
        background-color: rgba(220, 53, 69, 0.1);
    }
    
    .high-importance .insight-icon {
        background-color: #dc3545;
        color: white;
    }
    
    .high-importance .insight-type {
        color: #dc3545;
    }
    
    .medium-importance {
        background-color: rgba(255, 193, 7, 0.1);
    }
    
    .medium-importance .insight-icon {
        background-color: #ffc107;
        color: #343a40;
    }
    
    .medium-importance .insight-type {
        color: #ffc107;
    }
    
    .low-importance {
        background-color: rgba(23, 162, 184, 0.1);
    }
    
    .low-importance .insight-icon {
        background-color: #17a2b8;
        color: white;
    }
    
    .low-importance .insight-type {
        color: #17a2b8;
    }
    
    .no-insights {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 30px 0;
        text-align: center;
    }
    
    .no-insights-icon {
        font-size: 48px;
        color: #6c757d;
        margin-bottom: 15px;
    }
    
    /* Content analytics */
    .content-types-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    
    .content-type-item {
        display: flex;
        align-items: center;
    }
    
    .content-type-icon {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 15px;
        color: white;
    }
    
    .content-type-details {
        flex-grow: 1;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .content-type-name {
        font-weight: 500;
    }
    
    .content-type-count {
        font-weight: bold;
        font-size: 18px;
    }
    
    .content-metrics {
        background-color: #f8f9fa;
        border-radius: 8px;
        padding: 15px;
    }
    
    .content-metric {
        margin-bottom: 15px;
    }
    
    .content-metric:last-child {
        margin-bottom: 0;
    }
    
    /* Learning behavior section */
    .learning-metric {
        margin-bottom: 20px;
    }
    
    .learning-metric .metric-header {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
    }
    
    .learning-metric .metric-icon {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 15px;
        color: white;
    }
    
    .metric-icon.poll {
        background-color: #4361ee;
    }
    
    .metric-icon.resource {
        background-color: #4cc9f0;
    }
    
    .learning-metric .metric-details {
        flex-grow: 1;
    }
    
    .learning-behavior-summary {
        background-color: #f8f9fa;
        border-radius: 8px;
        padding: 15px;
    }
    
    .learning-behavior-summary h6 {
        margin-bottom: 10px;
        color: #343a40;
    }
    
    .learning-behavior-summary p {
        color: #6c757d;
        margin-bottom: 0;
    }
    `;
    
    // Add the styles to the page
    const styleElement = document.createElement('style');
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
}

// Initialize the student analytics when the page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, initializing student analytics");
    
    // Get room ID from the page
    const roomId = document.querySelector('[data-room-id]')?.dataset.roomId || 
                   "{{ room_id|escapejs }}";
    
    if (roomId) {
        console.log("Setting up analytics for room:", roomId);
        
        // Add styles for student analytics
        addStudentAnalyticsStyles();
        
        // Add tab structure to the analytics modal
        setupAnalyticsModalTabs();
        
        // Initialize the student analytics module
        StudentAnalytics.init(roomId);
    } else {
        console.error('Room ID not found. Student analytics cannot be initialized.');
    }
});

/**
 * Setup tabs structure in the analytics modal
 */
function setupAnalyticsModalTabs() {
    console.log("Setting up analytics modal tabs");
    const modalBody = document.querySelector('#analyticsModal .modal-body #analyticsContent');
    if (!modalBody) {
        console.error("Analytics modal content element not found");
        return;
    }
    
    // Create tabs structure
    const tabsHTML = `
        <!-- Analytics Tabs -->
        <div class="analytics-tabs">
            <div class="analytics-tab active" data-tab="overview">Overview</div>
            <div class="analytics-tab" data-tab="activity">Activity</div>
            <div class="analytics-tab" data-tab="social">Social</div>
            <div class="analytics-tab" data-tab="insights">Insights</div>
        </div>
        
        <!-- Tab Contents -->
        <div class="analytics-tab-content active" id="overview-tab"></div>
        <div class="analytics-tab-content" id="activity-tab"></div>
        <div class="analytics-tab-content" id="social-tab"></div>
        <div class="analytics-tab-content" id="insights-tab"></div>
    `;
    
    // Insert the tabs structure
    modalBody.innerHTML = tabsHTML;
    
    // Add event listeners to tabs
    document.querySelectorAll('.analytics-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            
            // Update active tab
            document.querySelectorAll('.analytics-tab').forEach(t => {
                t.classList.remove('active');
            });
            this.classList.add('active');
            
            // Update active content
            document.querySelectorAll('.analytics-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`${tabName}-tab`).classList.add('active');
        });
    });
}