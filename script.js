// Firebase configuration - this is where all the magic happens, don't fuck with these keys
const firebaseConfig = {
    apiKey: "AIzaSyAU3qmsD15JX6iwjloTjCPDd-2SuG6oM8w",
    authDomain: "chokaj-4dcae.firebaseapp.com",
    projectId: "chokaj-4dcae",
    storageBucket: "chokaj-4dcae.firebasestorage.app",
    messagingSenderId: "628147483032",
    appId: "1:628147483032:web:2cea7a3dd553b8922d7398"
};

// Initialize Firebase - setting up our database and storage connections
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();  // for storing all the video metadata
const storage = firebase.storage();  // for storing the actual video files

// Add the webhook URL - this connects to our n8n workflow for video processing
const webhookUrl = "https://jinthoa.app.n8n.cloud/webhook/884e09b7-11b7-4728-b3f7-e909cc9c6b9a";
// CORS proxy URL as a fallback because browsers are bitchy about cross-origin requests
const corsProxyUrl = "https://corsproxy.io/?";

// Helper function for webhook API calls with CORS handling
// This shit is complicated because browsers block cross-origin requests
async function callWebhook(data) {
    // First try direct request - this usually fails but worth a shot
    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Origin': 'https://bricepenven.github.io'
            },
            mode: 'cors',
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            console.log("Webhook call successful");
            return true;
        }
        
        throw new Error(`Webhook returned status ${response.status}`);
    } catch (directError) {
        console.warn("Direct webhook call failed, trying with CORS proxy:", directError);
        
        // Fall back to CORS proxy - this usually works when direct fails
        try {
            const response = await fetch(corsProxyUrl + encodeURIComponent(webhookUrl), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                console.log("Webhook call via proxy successful");
                return true;
            }
            
            throw new Error(`Proxy webhook returned status ${response.status}`);
        } catch (proxyError) {
            console.error("All webhook attempts failed:", proxyError);
            // Fail gracefully - app will continue working without webhook
            return false;
        }
    }
}

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
            
            // Update active tab styling - make the selected tab blue
            tabs.forEach(t => {
                t.classList.remove('text-fairlife-blue', 'border-t-2', 'border-fairlife-blue');
                t.classList.add('text-gray-600');
            });
            
            this.classList.remove('text-gray-600');
            this.classList.add('text-fairlife-blue', 'border-t-2', 'border-fairlife-blue');
            
            // Load content based on selected tab - each view needs different data
            if (targetView === 'homeView') {
                renderHomeView();  // Load all videos for home grid
            } else if (targetView === 'notificationsView') {
                renderNotificationsView();  // Load user's activity/videos
            } else if (targetView === 'exploreView') {
                renderExploreView();  // Load milk mobs
            } else if (targetView === 'reviewView') {
                // Check which review subtab is active
                const pendingBtn = document.getElementById('pendingReviewBtn');
                const allVideosBtn = document.getElementById('allVideosBtn');
                
                if (allVideosBtn && allVideosBtn.classList.contains('bg-fairlife-blue')) {
                    renderReviewView(false);  // Load all videos
                } else {
                    // Default to pending review
                    renderReviewView(true);  // Load videos needing review
                    
                    // Make sure the pending button is visually selected
                    if (pendingBtn && allVideosBtn) {
                        pendingBtn.classList.add('bg-fairlife-blue');
                        pendingBtn.classList.remove('bg-gray-200');
                        allVideosBtn.classList.remove('bg-fairlife-blue');
                        allVideosBtn.classList.add('bg-gray-200');
                    }
                }
            }
            
            // Apply thumbnails after view is rendered
            setTimeout(preloadThumbnails, 300);
        });
    });

    // Setup upload form - handle the video upload process
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleUpload);  // Process form submission
    }
    
    // Setup review buttons for moderation panel - toggle between pending and all videos
    const pendingReviewBtn = document.getElementById('pendingReviewBtn');
    const allVideosBtn = document.getElementById('allVideosBtn');
    
    if (pendingReviewBtn && allVideosBtn) {
        // Show only videos that need review
        pendingReviewBtn.addEventListener('click', function() {
            this.classList.add('bg-fairlife-blue');
            this.classList.remove('bg-gray-200');
            allVideosBtn.classList.remove('bg-fairlife-blue');
            allVideosBtn.classList.add('bg-gray-200');
            renderReviewView(true);  // true = only show pending videos
        });
        
        // Show all videos regardless of status
        allVideosBtn.addEventListener('click', function() {
            this.classList.add('bg-fairlife-blue');
            this.classList.remove('bg-gray-200');
            pendingReviewBtn.classList.remove('bg-fairlife-blue');
            pendingReviewBtn.classList.add('bg-gray-200');
            renderReviewView(false);  // false = show all videos
        });
    }
    
    // Load initial content for home view - this runs when the page first loads
    renderHomeView();
    
    // Apply thumbnails after initial render
    setTimeout(preloadThumbnails, 300);
    
    // Setup real-time updates - this is the magic that refreshes the UI when data changes
    try {
        db.collection('milk_videos').onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                // Figure out which view is currently visible
                const homeView = document.getElementById('homeView');
                const notificationsView = document.getElementById('notificationsView');
                const exploreView = document.getElementById('exploreView');
                const reviewView = document.getElementById('reviewView');
                
                // Only refresh the view that's currently visible
                if (homeView && !homeView.classList.contains('hidden')) {
                    renderHomeView();  // Refresh home grid
                } else if (notificationsView && !notificationsView.classList.contains('hidden')) {
                    renderNotificationsView();  // Refresh activity feed
                } else if (exploreView && !exploreView.classList.contains('hidden')) {
                    renderExploreView();  // Refresh milk mobs
                } else if (reviewView && !reviewView.classList.contains('hidden')) {
                    // Check if we're showing pending or all videos
                    const pendingBtn = document.getElementById('pendingReviewBtn');
                    renderReviewView(pendingBtn && pendingBtn.classList.contains('bg-fairlife-blue'));
                }
            });
        });
    } catch (error) {
        console.error("Failed to set up snapshot listener:", error);
    }
});

// Helper function to show upload status - gives user feedback during upload
function showUploadStatus(message, type) {
    const statusElement = document.getElementById('uploadStatus');
    if (!statusElement) return;  // Bail if element doesn't exist
    
    // Set the message text
    statusElement.textContent = message;
    
    // Reset all status colors
    statusElement.classList.remove('hidden', 'text-green-500', 'text-red-500', 'text-blue-500');
    
    // Set color based on message type
    switch(type) {
        case 'success':
            statusElement.classList.add('text-green-500');  // Green for success
            break;
        case 'error':
            statusElement.classList.add('text-red-500');  // Red for errors
            break;
        case 'info':
            statusElement.classList.add('text-blue-500');  // Blue for info/progress
            break;
    }
    
    // Make sure it's visible
    statusElement.classList.remove('hidden');
}

// Upload handler - processes the video upload form submission
async function handleUpload(e) {
    e.preventDefault();  // Stop the form from doing a regular submit
    console.log("Upload form submitted");
    
    // Get the file and hashtags from the form
    const videoFile = document.getElementById('videoFile').files[0];
    const hashtags = document.getElementById('hashtags').value;
    
    // Make sure they actually selected a file
    if (!videoFile) {
        showUploadStatus('Please select a video file.', 'error');
        return;
    }
    
    try {
        showUploadStatus('Uploading video...', 'info');
        
        // Generate a unique ID for the video based on timestamp
        const videoId = Date.now().toString();
        
        // Create storage reference - where the file will be stored in Firebase
        const storageRef = storage.ref(`videos/${videoId}`);
        
        // Set metadata - includes content type and hashtags
        const metadata = {
            contentType: videoFile.type,
            customMetadata: {
                'hashtags': hashtags
            }
        };
        
        // Start upload with metadata - this is where the file actually gets sent
        const uploadTask = storageRef.put(videoFile, metadata);
        
        uploadTask.on('state_changed', 
            // Progress function - updates as the file uploads
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log(`Upload progress: ${Math.round(progress)}%`);
                showUploadStatus(`Upload progress: ${Math.round(progress)}%`, 'info');
            },
            // Error function - called if upload fails
            (error) => {
                console.error('Upload error:', error);
                showUploadStatus(`Upload failed: ${error.message}`, 'error');
            },
            // Complete function - called when upload finishes successfully
            async () => {
                try {
                    showUploadStatus('Saving to database...', 'info');
                    
                    // Get download URL - this is the public URL for the video
                    const videoUrl = await uploadTask.snapshot.ref.getDownloadURL();
                    console.log("Got download URL:", videoUrl);
                    
                    // Save to Firestore - create a database record for the video
                    const docRef = await db.collection('milk_videos').add({
                        videoUrl: videoUrl,
                        hashtags: hashtags,
                        status: 'Pending Review',  // All videos start as pending
                        needsReview: true,  // Flag for videos that need moderation
                        uploadDate: firebase.firestore.FieldValue.serverTimestamp(),  // Server timestamp
                        originalFileName: videoFile.name,  // Store original filename
                        score: 0  // Initialize score at 0 until n8n processes it
                    });
                    console.log("Document saved with ID:", docRef.id);
                    
                    // Notify webhook using our helper function - this triggers the n8n workflow
                    const webhookData = {
                        videoId: docRef.id,
                        action: 'new_video',
                        videoUrl: videoUrl,
                        hashtags: hashtags,
                        timestamp: new Date().toISOString()
                    };
                    
                    // Don't await this - let it run in background so we don't block the UI
                    callWebhook(webhookData)
                        .then(success => {
                            if (success) {
                                console.log("Webhook notification processed");
                            } else {
                                console.warn("Webhook notification failed but app continues");
                            }
                        });
                    
                    // Show success message
                    showUploadStatus('Video uploaded successfully!', 'success');
                    
                    // Reset form and navigate to activity view after 2 seconds
                    setTimeout(() => {
                        // Clear the form fields
                        document.getElementById('videoFile').value = '';
                        document.getElementById('hashtags').value = '';
                        
                        // Navigate to Activity view to see the uploaded video
                        const notificationsTab = document.getElementById('notificationsTab');
                        if (notificationsTab) {
                            notificationsTab.click();
                        }
                    }, 2000);
                } catch (dbError) {
                    console.error('Database error:', dbError);
                    showUploadStatus('Upload successful but database update failed. Please try again.', 'error');
                }
            }
        );
    } catch (error) {
        console.error('Error:', error);
        showUploadStatus('An error occurred. Please try again.', 'error');
    }
}

// Render home view with Instagram-style grid layout - main landing page
function renderHomeView() {
    console.log("Rendering home view");
    const homeGrid = document.getElementById('homeGrid');
    if (!homeGrid) {
        console.error("Home grid element not found");
        return;
    }
    
    // Show loading message while we fetch the videos
    homeGrid.innerHTML = '<div class="col-span-3 text-center p-8 text-gray-500">Loading videos...</div>';

    // Get all videos EXCEPT rejected ones
    db.collection('milk_videos')
        .where('status', '!=', 'Rejected') // Filter out rejected videos
        .get()
        .then((snapshot) => {
            console.log(`Found ${snapshot.size} videos`);
            
            // If no videos, show empty state
            if (snapshot.empty) {
                homeGrid.innerHTML = '<div class="col-span-3 text-center p-8 text-gray-500">No videos yet.</div>';
                return;
            }

            // Update the HTML to use a 3-column grid - Instagram style
            homeGrid.className = 'grid grid-cols-3 gap-2';
            homeGrid.innerHTML = '';  // Clear loading message
            
            // Loop through each video and create a card for it
            snapshot.forEach(doc => {
                const video = doc.data();
                const videoId = doc.id;
                const card = document.createElement('div');
                card.className = 'aspect-square relative overflow-hidden';  // Square aspect ratio
                card.setAttribute('data-video-id', videoId);
                
                // Create thumbnail with overlay - figure out what to display
                let thumbnailUrl = video.thumbnailUrl || '';
                let mediaContent;
                
                if (thumbnailUrl) {
                    // If we have a thumbnail from TwelveLabs, use it
                    mediaContent = `<img src="${thumbnailUrl}" alt="Video thumbnail" class="w-full h-full object-cover">`;
                } else if (video.videoUrl) {
                    // Use createVideoThumbnail helper function
                    mediaContent = createVideoThumbnail(video.videoUrl, videoId);
                } else {
                    // Fallback if no media is available - shouldn't happen but just in case
                    mediaContent = `<div class="w-full h-full bg-gray-200 flex items-center justify-center">
                        <span class="text-gray-500">Processing</span>
                    </div>`;
                }
                
                // Add badge indicators for status - visual cue about video state
                let statusBadge = '';
                if (video.status === 'Approved') {
                    statusBadge = '<span class="absolute top-2 right-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">✓</span>';  // Green checkmark
                } else if (video.status === 'Pending Review' || video.needsReview) {
                    statusBadge = '<span class="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-full">⌛</span>';  // Yellow hourglass
                }
                
                // Add score badge if available
                let scoreBadge = '';
                if (typeof video.score === 'number') {
                    scoreBadge = `<span class="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-1.5 py-0.5 rounded-md">${video.score}/100</span>`;
                }
                
                // Combine the media and badges into the card
                card.innerHTML = `
                    ${mediaContent}
                    ${statusBadge}
                    ${scoreBadge}
                `;
                
                // Add click event to show video details when clicked
                card.addEventListener('click', () => {
                    showVideoDetails(videoId, video);
                });
                
                // Add the card to the grid
                homeGrid.appendChild(card);
            });
            
            // No need to initialize video elements anymore since we're using static placeholders
        })
        .catch(error => {
            console.error("Error fetching videos:", error);
            homeGrid.innerHTML = '<div class="col-span-3 text-center p-8 text-gray-500">Error loading videos.</div>';
        });
}

// Function to show video details in a modal - used when clicking a video in home/explore
function showVideoDetails(videoId, videoData) {
    // Create modal overlay - full screen semi-transparent background
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50';
    modal.id = 'videoModal';
    
    // Add touchstart event listener to help with mobile interactions
    modal.addEventListener('touchstart', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
    
    // Create modal content - figure out what to display
    let videoElement = '';
    if (videoData.videoUrl) {
        // If we have a video URL, show the video player (autoplay disabled)
        videoElement = `
            <video controls class="max-h-[50vh] max-w-full rounded-lg">
                <source src="${videoData.videoUrl}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        `;
    } else {
        // Fallback if video isn't available
        videoElement = `<div class="h-64 w-full bg-gray-200 flex items-center justify-center rounded-lg">Video processing</div>`;
    }
    
    // Status indicator with appropriate color - visual cue about video state
    let statusClass = 'bg-gray-100 text-gray-800';  // Default gray
    if (videoData.status === 'Approved') statusClass = 'bg-green-100 text-green-800';  // Green for approved
    if (videoData.status === 'Rejected') statusClass = 'bg-red-100 text-red-800';  // Red for rejected
    if (videoData.status === 'Pending Review') statusClass = 'bg-yellow-100 text-yellow-800';  // Yellow for pending
    
    // Score display - show score if available
    const scoreDisplay = typeof videoData.score === 'number' 
        ? `<div class="bg-black text-white text-sm font-medium rounded px-2 py-1 ml-2">Score: ${videoData.score}/100</div>` 
        : '';
    
    // Build the modal HTML - with score added
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div class="p-4 border-b sticky top-0 bg-white z-10">
                <div class="flex justify-between items-center">
                    <h3 class="text-lg font-medium">Video Details</h3>
                    <button id="closeModal" class="text-gray-500 hover:text-gray-700 p-2" style="min-width: 44px; min-height: 44px;">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
            
            <div class="p-4">
                ${videoElement}
                
                <div class="mt-4">
                    <div class="flex items-center mb-2">
                        <span class="inline-block px-2 py-1 text-xs rounded ${statusClass}">${videoData.status || 'Processing'}</span>
                        ${scoreDisplay}
                    </div>
                    
                    <div class="grid grid-cols-2 gap-2 mb-3">
                        <div>
                            <p class="text-sm text-gray-800 mb-1"><strong>Upload Date:</strong> ${formatDate(videoData.uploadDate, true)}</p>
                            <p class="text-sm text-gray-800 mb-1"><strong>Hashtags:</strong> ${videoData.hashtags || 'None'}</p>
                        </div>
                        <div>
                            ${videoData.recommendedMob ? `<p class="text-sm text-fairlife-blue mb-1"><strong>Milk Mob:</strong> ${videoData.recommendedMob}</p>` : ''}
                        </div>
                    </div>
                    
                    <!-- Media name section with edit functionality -->
                    <div class="mb-3">
                        <label class="block text-sm font-medium text-gray-700 mb-1">Media Name</label>
                        <div class="flex items-center space-x-2 mb-2">
                            <div class="flex-1 px-3 py-2 bg-gray-100 rounded-md text-gray-700 text-sm overflow-hidden text-ellipsis">
                                ${videoData.mediaName || videoData.originalFileName || 'Unknown'}
                                ${videoData.mediaName ? 
                                    `<div class="text-xs text-gray-500 mt-1">Original: ${videoData.originalFileName || 'Unknown'}</div>` : 
                                    ''}
                            </div>
                            <button id="editMediaNameBtn" class="bg-gray-200 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-300">
                                Edit
                            </button>
                        </div>
                        
                        <!-- Hidden form that appears when Edit is clicked -->
                        <div id="mediaNameEditForm" class="hidden">
                            <label for="mediaName" class="block text-sm font-medium text-gray-700 mb-1">Custom Media Name</label>
                            <div class="flex space-x-2">
                                <input type="text" id="mediaName" class="flex-1 px-3 py-2 border border-gray-300 rounded-md" 
                                    value="${videoData.mediaName || ''}" placeholder="Enter a custom name for this media">
                                <button id="saveMediaName" class="bg-fairlife-blue text-white px-3 py-2 rounded-md" data-id="${videoId}">Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to the page
    document.body.appendChild(modal);
    
    // Add close button handler
    document.getElementById('closeModal').addEventListener('click', () => {
        document.body.removeChild(modal);  // Remove the modal when X is clicked
    });
    
    // Close when clicking outside the content (on the dark overlay)
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);  // Remove modal when clicking outside
        }
    });
    
    // Add edit button handler for media name
    const editButton = document.getElementById('editMediaNameBtn');
    if (editButton) {
        editButton.addEventListener('click', () => {
            const editForm = document.getElementById('mediaNameEditForm');
            if (editForm.classList.contains('hidden')) {
                // Show the edit form
                editForm.classList.remove('hidden');
                editButton.textContent = "Cancel";  // Change button to Cancel
            } else {
                // Hide the edit form
                editForm.classList.add('hidden');
                editButton.textContent = "Edit";  // Change button back to Edit
            }
        });
    }
    
    // Add save media name handler - saves the custom name to the database
    const saveButton = document.getElementById('saveMediaName');
    if (saveButton) {
        saveButton.addEventListener('click', async () => {
            const mediaName = document.getElementById('mediaName').value.trim();
            const videoId = saveButton.getAttribute('data-id');
            
            try {
                // Update the media name in Firestore
                await db.collection('milk_videos').doc(videoId).update({
                    mediaName: mediaName
                });
                
                // Update the display with the new name
                const nameDisplay = modal.querySelector('.flex-1.px-3.py-2.bg-gray-100');
                if (nameDisplay) {
                    nameDisplay.innerHTML = `
                        ${mediaName || videoData.originalFileName || 'Unknown'}
                        <div class="text-xs text-gray-500 mt-1">Original: ${videoData.originalFileName || 'Unknown'}</div>
                    `;
                }
                
                // Update the videoData object so it's current
                videoData.mediaName = mediaName;
                
                // Show success feedback - change button color and text
                saveButton.textContent = "Saved!";
                saveButton.classList.add('bg-green-500');
                
                // Reset after 2 seconds
                setTimeout(() => {
                    saveButton.textContent = "Save";
                    saveButton.classList.remove('bg-green-500');
                    
                    // Hide the edit form
                    document.getElementById('mediaNameEditForm').classList.add('hidden');
                    document.getElementById('editMediaNameBtn').textContent = "Edit";
                }, 2000);
                
            } catch (error) {
                console.error("Error saving media name:", error);
                alert("Failed to save media name. Please try again.");
            }
        });
    }
}

// Render notifications view (user's own videos) - this is the Activity tab
function renderNotificationsView() {
    console.log("Rendering notifications view");
    const notificationsList = document.getElementById('notificationsList');
    if (!notificationsList) {
        console.error("Notifications list element not found");
        return;
    }
    
    // Show loading message
    notificationsList.innerHTML = '<div class="text-center p-8 text-gray-500">Loading your videos...</div>';

    // Get all videos (would filter by user in a real app with authentication)
    db.collection('milk_videos')
        .orderBy('uploadDate', 'desc')  // Newest first
        .get()
        .then((snapshot) => {
            console.log(`Found ${snapshot.size} videos for notifications`);
            
            // If no videos, show empty state
            if (snapshot.empty) {
                notificationsList.innerHTML = '<div class="text-center p-8 text-gray-500">You haven\'t uploaded any videos yet.</div>';
                return;
            }

            // Clear loading message
            notificationsList.innerHTML = '';
            // Loop through each video and create an activity item
            snapshot.forEach(doc => {
                const video = doc.data();
                const item = document.createElement('div');
                item.className = 'border-b border-gray-200 p-4';  // List item with bottom border
                item.setAttribute('data-video-id', doc.id);
                
                // Create score display if available
                const scoreDisplay = typeof video.score === 'number' 
                    ? `<div class="text-xs font-medium bg-black text-white px-2 py-0.5 rounded ml-2">Score: ${video.score}/100</div>` 
                    : '';
                
                // Create notification item with thumbnail and details - added score
                item.innerHTML = `
                    <div class="flex items-start space-x-3">
                        <!-- Thumbnail section -->
                        <div class="w-20 h-20 bg-gray-100 rounded overflow-hidden">
                            ${video.thumbnailUrl ? 
                                `<img src="${video.thumbnailUrl}" alt="Video thumbnail" class="w-full h-full object-cover">` :
                                video.videoUrl ?
                                createVideoThumbnail(video.videoUrl, video.id || index) :
                                `<div class="w-full h-full bg-gray-200 flex items-center justify-center">
                                    <span class="text-gray-500 text-xs">Processing</span>
                                </div>`
                            }
                        </div>
                        <!-- Details section -->
                        <div class="flex-1">
                            <div class="flex items-center">
                                <span class="inline-block px-2 py-1 text-xs rounded ${getStatusClass(video.status)}">${video.status || 'Processing'}</span>
                                ${scoreDisplay}
                                <span class="text-xs text-gray-500 ml-auto">${formatDate(video.uploadDate)}</span>
                            </div>
                            <p class="text-sm mt-1">${video.hashtags || 'No hashtags'}</p>
                            ${video.recommendedMob ? `<p class="text-xs text-fairlife-blue mt-1">Milk Mob: ${video.recommendedMob}</p>` : ''}
                        </div>
                    </div>
                `;
                
                // Add click event to show video details when clicked
                item.addEventListener('click', () => {
                    showVideoDetails(doc.id, video);
                });
                
                // Add the item to the list
                notificationsList.appendChild(item);
            });
        })
        .catch(error => {
            console.error("Error fetching notifications:", error);
            notificationsList.innerHTML = '<div class="text-center p-8 text-gray-500">Error loading your videos.</div>';
        });
}

// Render explore view (mobs) - this is the Milk Mobs tab
function renderExploreView() {
    console.log("Rendering explore view");
    const exploreContainer = document.getElementById('exploreContainer');
    if (!exploreContainer) {
        console.error("Explore container element not found");
        return;
    }
    
    // Show loading message
    exploreContainer.innerHTML = '<div class="text-center p-8 text-gray-500">Loading milk mobs...</div>';

    // Get approved videos only - rejected or pending videos don't show in mobs
    db.collection('milk_videos')
        .where('status', '==', 'Approved')
        .get()
        .then((snapshot) => {
            console.log(`Found ${snapshot.size} approved videos for mobs`);
            
            // If no approved videos, show empty state
            if (snapshot.empty) {
                exploreContainer.innerHTML = '<div class="text-center p-8 text-gray-500">No mobs formed yet. Videos need approval first!</div>';
                return;
            }

            // Group videos by mob - organize videos into their respective mobs
            const mobs = {};
            snapshot.forEach(doc => {
                const video = doc.data();
                // Use recommendedMob if available, otherwise use mob or fallback to General
                const mobName = video.recommendedMob || video.mob || 'General';
                
                // Create array for this mob if it doesn't exist yet
                if (!mobs[mobName]) {
                    mobs[mobName] = [];
                }
                
                // Add this video to its mob
                mobs[mobName].push({ ...video, id: doc.id });
            });

            // Double-check we actually have mobs (shouldn't happen but just in case)
            if (Object.keys(mobs).length === 0) {
                exploreContainer.innerHTML = '<div class="text-center p-8 text-gray-500">No approved videos found.</div>';
                return;
            }

            // Display mobs - create a section for each mob
            exploreContainer.innerHTML = '';
            Object.entries(mobs).forEach(([mob, videos]) => {
                const section = document.createElement('div');
                section.className = 'mb-6';  // Add margin bottom for spacing
                
                // Create section header with mob name and count
                const header = document.createElement('h3');
                header.className = 'text-lg font-medium mb-3 fairlife-blue';
                header.innerHTML = `${mob} <span class="text-sm text-gray-500">(${videos.length})</span>`;
                section.appendChild(header);
                
                // Create grid for videos - 3 columns like Instagram
                const grid = document.createElement('div');
                grid.className = 'grid grid-cols-3 gap-2';
                
                // Add videos to grid - create a card for each video
                videos.forEach(video => {
                    const card = document.createElement('div');
                    card.className = 'aspect-square relative overflow-hidden';  // Square aspect ratio
                    card.setAttribute('data-video-id', video.id);
                    
                    // Create thumbnail with overlay - figure out what to display
                    let thumbnailUrl = video.thumbnailUrl || '';
                    let mediaContent;
                    
                    if (thumbnailUrl) {
                        // If we have a thumbnail from TwelveLabs, use it
                        mediaContent = `<img src="${thumbnailUrl}" alt="Video thumbnail" class="w-full h-full object-cover">`;
                    } else if (video.videoUrl) {
                        // Use createVideoThumbnail helper function
                        mediaContent = createVideoThumbnail(video.videoUrl, video.id);
                    } else {
                        // Fallback if no media is available - shouldn't happen but just in case
                        mediaContent = `<div class="w-full h-full bg-gray-200 flex items-center justify-center">
                            <span class="text-gray-500">Processing</span>
                        </div>`;
                    }
                    
                    // Add badge indicators for status - all should be approved here
                    let statusBadge = '';
                    if (video.status === 'Approved') {
                        statusBadge = '<span class="absolute top-2 right-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">✓</span>';
                    }
                    
                    // Add score badge if available
                    let scoreBadge = '';
                    if (typeof video.score === 'number') {
                        scoreBadge = `<span class="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-1.5 py-0.5 rounded-md">${video.score}/100</span>`;
                    }
                    
                    // Combine the media and badge into the card
                    card.innerHTML = `
                        ${mediaContent}
                        ${statusBadge}
                        ${scoreBadge}
                    `;
                    
                    // Add click event to show video details when clicked
                    card.addEventListener('click', () => {
                        showVideoDetails(video.id, video);
                    });
                    
                    // Add the card to the grid
                    grid.appendChild(card);
                });
                
                // Add the grid to the section
                section.appendChild(grid);
                
                // Add the section to the container
                exploreContainer.appendChild(section);
            });
        })
        .catch(error => {
            console.error("Error fetching mobs:", error);
            exploreContainer.innerHTML = '<div class="text-center p-8 text-gray-500">Error loading milk mobs.</div>';
        });
}

// Render review view - this is the Moderation tab
function renderReviewView(pendingOnly = true) {
    console.log(`Rendering review view (pendingOnly: ${pendingOnly})`);
    const reviewList = document.getElementById('reviewList');
    if (!reviewList) {
        console.error("Review list element not found");
        return;
    }
    
    // Show loading message
    reviewList.innerHTML = '<div class="text-center p-8 text-gray-500">Loading videos for review...</div>';

    // Build query based on filter - either show pending only or all videos
    let query = db.collection('milk_videos');
    if (pendingOnly) {
        query = query.where('needsReview', '==', true);  // Only videos needing review
    }
    
    // Get videos for review, newest first
    query.orderBy('uploadDate', 'desc')
        .get()
        .then((snapshot) => {
            console.log(`Found ${snapshot.size} videos for review`);
            
            // If no videos to review, show empty state
            if (snapshot.empty) {
                reviewList.innerHTML = '<div class="text-center p-8 text-gray-500">No videos to review at this time.</div>';
                return;
            }

            // Create a grid layout for the videos - 3 columns like other views
            const grid = document.createElement('div');
            grid.className = 'grid grid-cols-3 gap-3';
            reviewList.innerHTML = '';  // Clear loading message
            reviewList.appendChild(grid);
            
            // Loop through each video and create a card for it
            snapshot.forEach(doc => {
                const video = doc.data();
                const videoId = doc.id;
                
                const card = document.createElement('div');
                card.className = 'aspect-square relative overflow-hidden bg-white rounded-lg shadow-sm';  // Square with shadow
                card.setAttribute('data-video-id', videoId);
                
                // Create thumbnail with overlay - figure out what to display
                let thumbnailUrl = video.thumbnailUrl || '';
                let mediaContent;
                
                if (thumbnailUrl) {
                    // If we have a thumbnail from TwelveLabs, use it
                    mediaContent = `<img src="${thumbnailUrl}" alt="Video thumbnail" class="w-full h-full object-cover">`;
                } else if (video.videoUrl) {
                    // Use createVideoThumbnail helper function
                    mediaContent = createVideoThumbnail(video.videoUrl, videoId);
                } else {
                    // Fallback if no media is available - shouldn't happen but just in case
                    mediaContent = `<div class="w-full h-full bg-gray-200 flex items-center justify-center">
                        <span class="text-gray-500">Processing</span>
                    </div>`;
                }
                
                // Add status badge - visual cue about video state
                let statusBadge = '';
                if (video.status === 'Approved') {
                    statusBadge = '<span class="absolute top-2 right-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">✓</span>';  // Green checkmark
                } else if (video.status === 'Pending Review' || video.needsReview) {
                    statusBadge = '<span class="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-full">⌛</span>';  // Yellow hourglass
                } else if (video.status === 'Rejected') {
                    statusBadge = '<span class="absolute top-2 right-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">✕</span>';  // Red X
                }
                
                // Add score badge if available
                let scoreBadge = '';
                if (typeof video.score === 'number') {
                    scoreBadge = `<span class="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-1.5 py-0.5 rounded-md">${video.score}/100</span>`;
                }
                
                // Combine the media and badge into the card
                card.innerHTML = `
                    ${mediaContent}
                    ${statusBadge}
                    ${scoreBadge}
                `;
                
                // Add click event to show video details with moderation options
                card.addEventListener('click', () => {
                    showVideoDetailsWithModeration(videoId, video);  // Special modal with approve/reject buttons
                });
                
                // Add the card to the grid
                grid.appendChild(card);
            });
        })
        .catch(error => {
            console.error("Error fetching videos for review:", error);
            reviewList.innerHTML = '<div class="text-center p-8 text-gray-500">Error loading videos for review.</div>';
        });
}

// Function to show video details with moderation options - special modal for the Moderate tab
function showVideoDetailsWithModeration(videoId, videoData) {
    // Create modal overlay - full screen semi-transparent background
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50';
    modal.id = 'videoModal';
    
    // Create modal content - figure out what to display
    let videoElement = '';
    if (videoData.videoUrl) {
        // If we have a video URL, show the video player (autoplay disabled)
        videoElement = `
            <video controls class="max-h-[50vh] max-w-full rounded-lg">
                <source src="${videoData.videoUrl}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        `;
    } else {
        // Fallback if video isn't available
        videoElement = `<div class="h-64 w-full bg-gray-200 flex items-center justify-center rounded-lg">Video processing</div>`;
    }
    
    // Status indicator with appropriate color - visual cue about video state
    let statusClass = 'bg-gray-100 text-gray-800';  // Default gray
    if (videoData.status === 'Approved') statusClass = 'bg-green-100 text-green-800';  // Green for approved
    if (videoData.status === 'Rejected') statusClass = 'bg-red-100 text-red-800';  // Red for rejected
    if (videoData.status === 'Pending Review') statusClass = 'bg-yellow-100 text-yellow-800';  // Yellow for pending
    
    // Score display - show score if available
    const scoreDisplay = typeof videoData.score === 'number' 
        ? `<div class="bg-black text-white text-sm font-medium rounded px-2 py-1 ml-2">Score: ${videoData.score}/100</div>` 
        : '';
    
    // Build the modal HTML - includes moderation controls - added score
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div class="p-4 border-b sticky top-0 bg-white z-10">
                <div class="flex justify-between items-center">
                    <h3 class="text-lg font-medium">Moderate Video</h3>
                    <button id="closeModal" class="text-gray-500 hover:text-gray-700 p-2" style="min-width: 44px; min-height: 44px;">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
            
            <div class="p-4">
                ${videoElement}
                
                <div class="mt-4">
                    <!-- Status, score, and action buttons -->
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center">
                            <span class="inline-block px-2 py-1 text-xs rounded ${statusClass}">${videoData.status || 'Processing'}</span>
                            ${scoreDisplay}
                        </div>
                        
                        <div class="flex space-x-2">
                            <button id="approveBtn" class="px-3 py-1 bg-fairlife-blue text-white rounded text-sm ${videoData.status === 'Approved' ? 'opacity-50' : ''}">
                                Approve
                            </button>
                            <button id="rejectBtn" class="px-3 py-1 bg-red-500 text-white rounded text-sm ${videoData.status === 'Rejected' ? 'opacity-50' : ''}">
                                Reject
                            </button>
                        </div>
                    </div>
                    
                    <!-- Video metadata -->
                    <div class="grid grid-cols-2 gap-2 mb-3">
                        <div>
                            <p class="text-sm text-gray-800 mb-1"><strong>Upload Date:</strong> ${formatDate(videoData.uploadDate, true)}</p>
                            <p class="text-sm text-gray-800 mb-1"><strong>Hashtags:</strong> ${videoData.hashtags || 'None'}</p>
                        </div>
                        <div>
                            ${videoData.recommendedMob ? `<p class="text-sm text-fairlife-blue mb-1"><strong>Milk Mob:</strong> ${videoData.recommendedMob}</p>` : ''}
                        </div>
                    </div>
                    
                    <!-- Media name section with edit functionality -->
                    <div class="mb-3">
                        <label class="block text-sm font-medium text-gray-700 mb-1">Media Name</label>
                        <div class="flex items-center space-x-2 mb-2">
                            <div class="flex-1 px-3 py-2 bg-gray-100 rounded-md text-gray-700 text-sm overflow-hidden text-ellipsis">
                                ${videoData.mediaName || videoData.originalFileName || 'Unknown'}
                                ${videoData.mediaName ? 
                                    `<div class="text-xs text-gray-500 mt-1">Original: ${videoData.originalFileName || 'Unknown'}</div>` : 
                                    ''}
                            </div>
                            <button id="editMediaNameBtn" class="bg-gray-200 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-300">
                                Edit
                            </button>
                        </div>
                        
                        <!-- Hidden form that appears when Edit is clicked -->
                        <div id="mediaNameEditForm" class="hidden">
                            <label for="mediaName" class="block text-sm font-medium text-gray-700 mb-1">Custom Media Name</label>
                            <div class="flex space-x-2">
                                <input type="text" id="mediaName" class="flex-1 px-3 py-2 border border-gray-300 rounded-md" 
                                    value="${videoData.mediaName || ''}" placeholder="Enter a custom name for this media">
                                <button id="saveMediaName" class="bg-fairlife-blue text-white px-3 py-2 rounded-md" data-id="${videoId}">Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to the page
    document.body.appendChild(modal);
    
    // Add close button handler
    document.getElementById('closeModal').addEventListener('click', () => {
        document.body.removeChild(modal);  // Remove the modal when X is clicked
    });
    
    // Close when clicking outside the content (on the dark overlay)
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);  // Remove modal when clicking outside
        }
    });
    
    // Add edit button handler for media name
    const editButton = document.getElementById('editMediaNameBtn');
    if (editButton) {
        editButton.addEventListener('click', () => {
            const editForm = document.getElementById('mediaNameEditForm');
            if (editForm.classList.contains('hidden')) {
                // Show the edit form
                editForm.classList.remove('hidden');
                editButton.textContent = "Cancel";  // Change button to Cancel
            } else {
                // Hide the edit form
                editForm.classList.add('hidden');
                editButton.textContent = "Edit";  // Change button back to Edit
            }
        });
    }
    
    // Add save media name handler - saves the custom name to the database
    const saveButton = document.getElementById('saveMediaName');
    if (saveButton) {
        saveButton.addEventListener('click', async () => {
            const mediaName = document.getElementById('mediaName').value.trim();
            
            try {
                // Update the media name in Firestore
                await db.collection('milk_videos').doc(videoId).update({
                    mediaName: mediaName
                });
                
                // Update the display with the new name
                const nameDisplay = modal.querySelector('.flex-1.px-3.py-2.bg-gray-100');
                if (nameDisplay) {
                    nameDisplay.innerHTML = `
                        ${mediaName || videoData.originalFileName || 'Unknown'}
                        <div class="text-xs text-gray-500 mt-1">Original: ${videoData.originalFileName || 'Unknown'}</div>
                    `;
                }
                
                // Update the videoData object so it's current
                videoData.mediaName = mediaName;
                
                // Show success feedback - change button color and text
                saveButton.textContent = "Saved!";
                saveButton.classList.add('bg-green-500');
                
                // Reset after 2 seconds
                setTimeout(() => {
                    saveButton.textContent = "Save";
                    saveButton.classList.remove('bg-green-500');
                    
                    // Hide the edit form
                    document.getElementById('mediaNameEditForm').classList.add('hidden');
                    document.getElementById('editMediaNameBtn').textContent = "Edit";
                }, 2000);
                
            } catch (error) {
                console.error("Error saving media name:", error);
                alert("Failed to save media name. Please try again.");
            }
        });
    }
    
    // Add approve button handler - approves the video and assigns it to a mob
    const approveBtn = document.getElementById('approveBtn');
    if (approveBtn) {
        approveBtn.addEventListener('click', async () => {
            // Use recommendedMob or default to "General" if none exists
            const mob = videoData.recommendedMob || "General";
            
            try {
                // Call the approve function to update the database
                await approveVideo(videoId, mob);
                
                // Update UI to reflect the change - change status badge
                const statusBadge = modal.querySelector('.inline-block.px-2.py-1.text-xs.rounded');
                if (statusBadge) {
                    statusBadge.className = 'inline-block px-2 py-1 text-xs rounded bg-green-100 text-green-800';
                    statusBadge.textContent = 'Approved';
                }
                
                // Update buttons - disable approve, enable reject
                approveBtn.classList.add('opacity-50');  // Dim the approve button
                document.getElementById('rejectBtn').classList.remove('opacity-50');  // Un-dim the reject button
                
                // Update the videoData object so it's current
                videoData.status = 'Approved';
                videoData.mob = mob;
                
            } catch (error) {
                console.error("Error approving video:", error);
                alert("Failed to approve video. Please try again.");
            }
        });
    }
    
    // Add reject button handler - rejects the video
    const rejectBtn = document.getElementById('rejectBtn');
    if (rejectBtn) {
        rejectBtn.addEventListener('click', async () => {
            try {
                // Call the reject function to update the database
                await rejectVideo(videoId);
                
                // Update UI to reflect the change - change status badge
                const statusBadge = modal.querySelector('.inline-block.px-2.py-1.text-xs.rounded');
                if (statusBadge) {
                    statusBadge.className = 'inline-block px-2 py-1 text-xs rounded bg-red-100 text-red-800';
                    statusBadge.textContent = 'Rejected';
                }
                
                // Update buttons - disable reject, enable approve
                rejectBtn.classList.add('opacity-50');  // Dim the reject button
                document.getElementById('approveBtn').classList.remove('opacity-50');  // Un-dim the approve button
                
                // Update the videoData object so it's current
                videoData.status = 'Rejected';
                
            } catch (error) {
                console.error("Error rejecting video:", error);
                alert("Failed to reject video. Please try again.");
            }
        });
    }
}

// Approve video - marks a video as approved and assigns it to a mob
async function approveVideo(videoId, mob) {
    try {
        console.log(`Approving video ${videoId} for mob ${mob}`);
        
        // Update Firestore - change status, set mob, mark as not needing review
        await db.collection('milk_videos').doc(videoId).update({
            status: 'Approved',  // Set status to Approved
            recommendedMob: mob,  // Assign to the specified mob
            needsReview: false,  // No longer needs review
            reviewDate: firebase.firestore.FieldValue.serverTimestamp()  // Record when it was approved
        });
        
        // Notify webhook with our helper function - triggers n8n workflow
        const webhookData = {
            action: 'approve_video',
            videoId: videoId,
            mob: mob,
            timestamp: new Date().toISOString()
        };
        
        // Don't await this - let it run in background so we don't block the UI
        callWebhook(webhookData)
            .then(success => {
                if (success) {
                    console.log("Approval webhook notification processed");
                } else {
                    console.warn("Approval webhook notification failed but app continues");
                }
            });
        
        // Refresh the view - check if we're showing pending only or all videos
        const pendingBtn = document.getElementById('pendingReviewBtn');
        renderReviewView(pendingBtn && pendingBtn.classList.contains('bg-fairlife-blue'));
    } catch (error) {
        console.error("Error approving video:", error);
        alert("Failed to approve video. Please try again.");
    }
}

// Reject video - marks a video as rejected
async function rejectVideo(videoId) {
    try {
        console.log(`Rejecting video ${videoId}`);
        
        // Update Firestore - change status, mark as not needing review
        await db.collection('milk_videos').doc(videoId).update({
            status: 'Rejected',  // Set status to Rejected
            needsReview: false,  // No longer needs review
            reviewDate: firebase.firestore.FieldValue.serverTimestamp()  // Record when it was rejected
        });
        
        // Notify webhook with our helper function - triggers n8n workflow
        const webhookData = {
            action: 'reject_video',
            videoId: videoId,
            timestamp: new Date().toISOString()
        };
        
        // Don't await this - let it run in background so we don't block the UI
        callWebhook(webhookData)
            .then(success => {
                if (success) {
                    console.log("Rejection webhook notification processed");
                } else {
                    console.warn("Rejection webhook notification failed but app continues");
                }
            });
        
        // Refresh the view - check if we're showing pending only or all videos
        const pendingBtn = document.getElementById('pendingReviewBtn');
        renderReviewView(pendingBtn && pendingBtn.classList.contains('bg-fairlife-blue'));
    } catch (error) {
        console.error("Error rejecting video:", error);
        alert("Failed to reject video. Please try again.");
    }
}

// Helper function to preload thumbnails from video URLs
function preloadThumbnails() {
    console.log("Using static colored placeholders for thumbnails");
    
    // We're now using completely static placeholders instead of trying to load video frames
    // This function is kept for compatibility but doesn't need to do anything
    // since we're using static HTML for the placeholders
}

// Generate a consistent pastel color based on a string ID
function getRandomPastelColor(id) {
    // If no ID is provided, return a default color
    if (!id) return '#e0f2fe';
    
    // Convert the ID to a number for consistent color generation
    let hash = 0;
    for (let i = 0; i < String(id).length; i++) {
        hash = String(id).charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Generate pastel colors (lighter, softer colors)
    const h = hash % 360;
    return `hsl(${h}, 70%, 80%)`;
}

// Function to create a video thumbnail element
function createVideoThumbnail(videoUrl, videoId) {
    // Create a container with colored background and play button
    return `
        <div class="relative w-full h-full flex items-center justify-center" 
             style="background-color: ${getRandomPastelColor(videoId)};">
            <video class="w-0 h-0 absolute" preload="none">
                <source src="${videoUrl}" type="video/mp4">
            </video>
            <div class="absolute inset-0 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="white" style="filter: drop-shadow(0px 1px 2px rgba(0,0,0,0.5));">
                    <path d="M8 5v14l11-7z"/>
                </svg>
            </div>
        </div>
    `;
}

// Format date - converts timestamps to readable format
function formatDate(timestamp, detailed = false) {
    if (!timestamp) return 'Just now';  // Handle missing timestamp
    
    try {
        // Convert Firebase timestamp to JS Date if needed
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        
        if (detailed) {
            // Detailed format for modals - includes time
            return date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
        // Simple format for list views - just month and day
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (e) {
        return 'Invalid date';  // Fallback for invalid dates
    }
}

// Get CSS class for status - returns Tailwind classes for status badges
function getStatusClass(status) {
    switch(status) {
        case 'Approved':
            return 'bg-green-100 text-green-800';  // Green for approved
        case 'Rejected':
            return 'bg-red-100 text-red-800';  // Red for rejected
        case 'Pending Review':
            return 'bg-yellow-100 text-yellow-800';  // Yellow for pending
        default:
            return 'bg-gray-100 text-gray-800';  // Gray for unknown/processing
    }
}
