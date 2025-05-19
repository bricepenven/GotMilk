// filepath: /got-milk-app/got-milk-app/src/js/app.js
import { renderHomeView } from './homeView.js';
import { renderNotificationsView } from './notificationsView.js';
import { renderExploreView } from './exploreView.js';
import { handleUpload } from './uploadHandler.js';

// Main initialization when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Setup tab navigation - handles switching between different views
    const tabs = document.querySelectorAll('.tab');
    const views = document.querySelectorAll('.view');

    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetView = this.getAttribute('data-view');

            // Hide all views - we only show one at a time
            views.forEach(view => {
                view.classList.add('hidden');
            });

            // Show target view - the one the user clicked on
            document.getElementById(targetView).classList.remove('hidden');

            // Load content based on selected tab - each view needs different data
            if (targetView === 'homeView') {
                renderHomeView();  // Load all videos for home grid
            } else if (targetView === 'notificationsView') {
                renderNotificationsView();  // Load user's activity/videos
            } else if (targetView === 'exploreView') {
                renderExploreView();  // Load approved videos
            }
        });
    });

    // Setup upload form - handle the video upload process
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleUpload);  // Process form submission
    }

    // Load initial content for home view - this runs when the page first loads
    renderHomeView();
});