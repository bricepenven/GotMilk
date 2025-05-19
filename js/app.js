import { db, handleUpload, showUploadStatus } from './api.js';
import { renderHomeView, renderNotificationsView, renderExploreView, renderReviewView } from './views.js';
import { preloadThumbnails } from './utils.js';

// Firebase should already be initialized in index.html
console.log("Using Firebase app:", firebase.app().name);

// Main initialization when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Setup tab navigation
    const tabs = document.querySelectorAll('.tab');
    const views = document.querySelectorAll('.view');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetView = this.getAttribute('data-view');
            
            // Hide all views
            views.forEach(view => {
                view.classList.add('hidden');
            });
            
            // Show target view
            document.getElementById(targetView).classList.remove('hidden');
            
            // Update active tab styling
            tabs.forEach(t => {
                t.classList.remove('text-fairlife-blue', 'border-t-2', 'border-fairlife-blue');
                t.classList.add('text-gray-600');
            });
            
            this.classList.remove('text-gray-600');
            this.classList.add('text-fairlife-blue', 'border-t-2', 'border-fairlife-blue');
            
            // Load content based on selected tab
            if (targetView === 'homeView') {
                renderHomeView();
            } else if (targetView === 'notificationsView') {
                renderNotificationsView();
            } else if (targetView === 'exploreView') {
                renderExploreView();
            } else if (targetView === 'reviewView') {
                // Check which review subtab is active
                const pendingBtn = document.getElementById('pendingReviewBtn');
                const allVideosBtn = document.getElementById('allVideosBtn');
                
                if (allVideosBtn && allVideosBtn.classList.contains('bg-fairlife-blue')) {
                    renderReviewView(false);
                } else {
                    renderReviewView(true);
                    
                    if (pendingBtn && allVideosBtn) {
                        pendingBtn.classList.add('bg-fairlife-blue');
                        pendingBtn.classList.remove('bg-gray-200');
                        allVideosBtn.classList.remove('bg-fairlife-blue');
                        allVideosBtn.classList.add('bg-gray-200');
                    }
                }
            }
        });
    });

    // Setup upload form
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleUpload);
    }
    
    // Setup review buttons for moderation panel
    const pendingReviewBtn = document.getElementById('pendingReviewBtn');
    const allVideosBtn = document.getElementById('allVideosBtn');
    
    if (pendingReviewBtn && allVideosBtn) {
        pendingReviewBtn.addEventListener('click', function() {
            this.classList.add('bg-fairlife-blue');
            this.classList.remove('bg-gray-200');
            allVideosBtn.classList.remove('bg-fairlife-blue');
            allVideosBtn.classList.add('bg-gray-200');
            renderReviewView(true);
        });
        
        allVideosBtn.addEventListener('click', function() {
            this.classList.add('bg-fairlife-blue');
            this.classList.remove('bg-gray-200');
            pendingReviewBtn.classList.remove('bg-fairlife-blue');
            pendingReviewBtn.classList.add('bg-gray-200');
            renderReviewView(false);
        });
    }
    
    // Load initial content for home view
    renderHomeView();
    
    // Apply thumbnails after initial render
    setTimeout(preloadThumbnails, 300);
    
    // Setup real-time updates
    try {
        db.collection('milk_videos').onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                const homeView = document.getElementById('homeView');
                const notificationsView = document.getElementById('notificationsView');
                const exploreView = document.getElementById('exploreView');
                const reviewView = document.getElementById('reviewView');
                
                if (homeView && !homeView.classList.contains('hidden')) {
                    renderHomeView();
                    setTimeout(preloadThumbnails, 300);
                } else if (notificationsView && !notificationsView.classList.contains('hidden')) {
                    renderNotificationsView();
                    setTimeout(preloadThumbnails, 300);
                } else if (exploreView && !exploreView.classList.contains('hidden')) {
                    renderExploreView();
                    setTimeout(preloadThumbnails, 300);
                } else if (reviewView && !reviewView.classList.contains('hidden')) {
                    const pendingBtn = document.getElementById('pendingReviewBtn');
                    renderReviewView(pendingBtn && pendingBtn.classList.contains('bg-fairlife-blue'));
                    setTimeout(preloadThumbnails, 300);
                }
            });
        });
    } catch (error) {
        console.error("Failed to set up snapshot listener:", error);
    }
});
