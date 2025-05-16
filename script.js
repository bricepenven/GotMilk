// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAU3qmsD15JX6iwjloTjCPDd-2SuG6oM8w",
    authDomain: "chokaj-4dcae.firebaseapp.com",
    projectId: "chokaj-4dcae",
    storageBucket: "chokaj-4dcae.firebasestorage.app",
    messagingSenderId: "628147483032",
    appId: "1:628147483032:web:2cea7a3dd553b8922d7398"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

// Add the webhook URL - Using the URL from your n8n screenshot
const webhookUrl = "https://jinthoa.app.n8n.cloud/webhook-test/884e09b7-11b7-4728-b3f7-e909cc9c6b9a";
// CORS proxy URL to use as a fallback if direct webhook fails
const corsProxyUrl = "https://corsproxy.io/?";

// Helper function for webhook API calls with CORS handling
async function callWebhook(data) {
    // First try direct request
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
        
        // Fall back to CORS proxy
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
                renderReviewView(true);
            }
        });
    });

    // Setup upload form
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleUpload);
    }
    
    // Setup review buttons if they exist
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
                } else if (notificationsView && !notificationsView.classList.contains('hidden')) {
                    renderNotificationsView();
                } else if (exploreView && !exploreView.classList.contains('hidden')) {
                    renderExploreView();
                } else if (reviewView && !reviewView.classList.contains('hidden')) {
                    const pendingBtn = document.getElementById('pendingReviewBtn');
                    renderReviewView(pendingBtn && pendingBtn.classList.contains('bg-fairlife-blue'));
                }
            });
        });
    } catch (error) {
        console.error("Failed to set up snapshot listener:", error);
    }
});

// Helper function to show upload status
function showUploadStatus(message, type) {
    const statusElement = document.getElementById('uploadStatus');
    if (!statusElement) return;
    
    statusElement.textContent = message;
    statusElement.classList.remove('hidden', 'text-green-500', 'text-red-500', 'text-blue-500');
    
    switch(type) {
        case 'success':
            statusElement.classList.add('text-green-500');
            break;
        case 'error':
            statusElement.classList.add('text-red-500');
            break;
        case 'info':
            statusElement.classList.add('text-blue-500');
            break;
    }
    
    statusElement.classList.remove('hidden');
}

// Upload handler
async function handleUpload(e) {
    e.preventDefault();
    console.log("Upload form submitted");
    
    const videoFile = document.getElementById('videoFile').files[0];
    const hashtags = document.getElementById('hashtags').value;
    
    if (!videoFile) {
        showUploadStatus('Please select a video file.', 'error');
        return;
    }
    
    try {
        showUploadStatus('Uploading video...', 'info');
        
        // Generate a unique ID for the video
        const videoId = Date.now().toString();
        
        // Create storage reference
        const storageRef = storage.ref(`videos/${videoId}`);
        
        // Set metadata
        const metadata = {
            contentType: videoFile.type,
            customMetadata: {
                'hashtags': hashtags
            }
        };
        
        // Start upload with metadata
        const uploadTask = storageRef.put(videoFile, metadata);
        
        uploadTask.on('state_changed', 
            // Progress function
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log(`Upload progress: ${Math.round(progress)}%`);
                showUploadStatus(`Upload progress: ${Math.round(progress)}%`, 'info');
            },
            // Error function
            (error) => {
                console.error('Upload error:', error);
                showUploadStatus(`Upload failed: ${error.message}`, 'error');
            },
            // Complete function
            async () => {
                try {
                    showUploadStatus('Saving to database...', 'info');
                    
                    // Get download URL
                    const videoUrl = await uploadTask.snapshot.ref.getDownloadURL();
                    console.log("Got download URL:", videoUrl);
                    
                    // Save to Firestore
                    const docRef = await db.collection('milk_videos').add({
                        videoUrl: videoUrl,
                        hashtags: hashtags,
                        status: 'Pending Review',
                        needsReview: true,
                        uploadDate: firebase.firestore.FieldValue.serverTimestamp(),
                        originalFileName: videoFile.name
                    });
                    console.log("Document saved with ID:", docRef.id);
                    
                    // Notify webhook using our helper function
                    const webhookData = {
                        videoId: docRef.id,
                        action: 'new_video',
                        videoUrl: videoUrl,
                        hashtags: hashtags,
                        timestamp: new Date().toISOString()
                    };
                    
                    // Don't await this - let it run in background
                    callWebhook(webhookData)
                        .then(success => {
                            if (success) {
                                console.log("Webhook notification processed");
                            } else {
                                console.warn("Webhook notification failed but app continues");
                            }
                        });
                    
                    showUploadStatus('Video uploaded successfully!', 'success');
                    
                    setTimeout(() => {
                        document.getElementById('videoFile').value = '';
                        document.getElementById('hashtags').value = '';
                        
                        // Navigate to Notifications view
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

// Render home view with Instagram-style grid layout
function renderHomeView() {
    console.log("Rendering home view");
    const homeGrid = document.getElementById('homeGrid');
    if (!homeGrid) {
        console.error("Home grid element not found");
        return;
    }
    
    homeGrid.innerHTML = '<div class="col-span-3 text-center p-8 text-gray-500">Loading videos...</div>';

    // Get all videos
    db.collection('milk_videos')
        .orderBy('uploadDate', 'desc')
        .get()
        .then((snapshot) => {
            console.log(`Found ${snapshot.size} videos`);
            
            if (snapshot.empty) {
                homeGrid.innerHTML = '<div class="col-span-3 text-center p-8 text-gray-500">No videos yet.</div>';
                return;
            }

            // Update the HTML to use a 3-column grid
            homeGrid.className = 'grid grid-cols-3 gap-2';
            homeGrid.innerHTML = '';
            
            snapshot.forEach(doc => {
                const video = doc.data();
                const videoId = doc.id;
                const card = document.createElement('div');
                card.className = 'aspect-square relative overflow-hidden';
                card.setAttribute('data-video-id', videoId);
                
                // Create thumbnail with overlay
                let thumbnailUrl = video.thumbnailUrl || '';
                let mediaContent;
                
                if (thumbnailUrl) {
                    // If we have a thumbnail
                    mediaContent = `<img src="${thumbnailUrl}" alt="Video thumbnail" class="w-full h-full object-cover">`;
                } else if (video.videoUrl) {
                    // If we have video but no thumbnail, show first frame of video
                    mediaContent = `
                        <video class="w-full h-full object-cover" muted>
                            <source src="${video.videoUrl}" type="video/mp4">
                        </video>
                    `;
                } else {
                    // Fallback if no media is available
                    mediaContent = `<div class="w-full h-full bg-gray-200 flex items-center justify-center">
                        <span class="text-gray-500">Processing</span>
                    </div>`;
                }
                
                // Add badge indicators for status
                let statusBadge = '';
                if (video.status === 'Approved') {
                    statusBadge = '<span class="absolute top-2 right-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">✓</span>';
                } else if (video.status === 'Pending Review') {
                    statusBadge = '<span class="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-full">⌛</span>';
                } else if (video.status === 'Rejected') {
                    statusBadge = '<span class="absolute top-2 right-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">✕</span>';
                }
                
                card.innerHTML = `
                    ${mediaContent}
                    ${statusBadge}
                `;
                
                // Add click event to show video details
                card.addEventListener('click', () => {
                    showVideoDetails(videoId, video);
                });
                
                homeGrid.appendChild(card);
            });
            
            // Initialize video elements if needed
            document.querySelectorAll('#homeGrid video').forEach(video => {
                // Show first frame of video
                video.currentTime = 0;
            });
        })
        .catch(error => {
            console.error("Error fetching videos:", error);
            homeGrid.innerHTML = '<div class="col-span-3 text-center p-8 text-gray-500">Error loading videos.</div>';
        });
}

// Function to show video details in a modal
function showVideoDetails(videoId, videoData) {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50';
    modal.id = 'videoModal';
    
    // Create modal content
    let videoElement = '';
    if (videoData.videoUrl) {
        videoElement = `
            <video controls autoplay class="max-h-[70vh] max-w-full rounded-lg">
                <source src="${videoData.videoUrl}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        `;
    } else {
        videoElement = `<div class="h-64 w-full bg-gray-200 flex items-center justify-center rounded-lg">Video processing</div>`;
    }
    
    // Status indicator with appropriate color
    let statusClass = 'bg-gray-100 text-gray-800';
    if (videoData.status === 'Approved') statusClass = 'bg-green-100 text-green-800';
    if (videoData.status === 'Rejected') statusClass = 'bg-red-100 text-red-800';
    if (videoData.status === 'Pending Review') statusClass = 'bg-yellow-100 text-yellow-800';
    
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 overflow-hidden">
            <div class="p-4 border-b">
                <div class="flex justify-between items-center">
                    <h3 class="text-lg font-medium">Video Details</h3>
                    <button id="closeModal" class="text-gray-500 hover:text-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
            
            <div class="p-4">
                ${videoElement}
                
                <div class="mt-4">
                    <span class="inline-block px-2 py-1 text-xs rounded ${statusClass} mb-2">${videoData.status || 'Processing'}</span>
                    
                    <div class="grid grid-cols-2 gap-2 mb-3">
                        <div>
                            <p class="text-sm text-gray-800 mb-1"><strong>Upload Date:</strong> ${formatDate(videoData.uploadDate, true)}</p>
                            <p class="text-sm text-gray-800 mb-1"><strong>Hashtags:</strong> ${videoData.hashtags || 'None'}</p>
                            ${videoData.mob ? `<p class="text-sm text-fairlife-blue mb-1"><strong>Mob:</strong> ${videoData.mob}</p>` : ''}
                        </div>
                        <div>
                            ${videoData.recommendedMob ? `<p class="text-sm text-fairlife-blue mb-1"><strong>Milk Mob:</strong> ${videoData.recommendedMob}</p>` : ''}
                            ${videoData.milkTag ? `<p class="text-sm text-purple-700 italic mb-1"><strong>Tag:</strong> ${videoData.milkTag}</p>` : ''}
                        </div>
                    </div>
                    
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
    
    // Add to body
    document.body.appendChild(modal);
    
    // Add close handler
    document.getElementById('closeModal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Close when clicking outside the content
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
    
    // Add edit button handler
    const editButton = document.getElementById('editMediaNameBtn');
    if (editButton) {
        editButton.addEventListener('click', () => {
            const editForm = document.getElementById('mediaNameEditForm');
            if (editForm.classList.contains('hidden')) {
                editForm.classList.remove('hidden');
                editButton.textContent = "Cancel";
            } else {
                editForm.classList.add('hidden');
                editButton.textContent = "Edit";
            }
        });
    }
    
    // Add save media name handler
    const saveButton = document.getElementById('saveMediaName');
    if (saveButton) {
        saveButton.addEventListener('click', async () => {
            const mediaName = document.getElementById('mediaName').value.trim();
            const videoId = saveButton.getAttribute('data-id');
            
            try {
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
                
                // Update the videoData object
                videoData.mediaName = mediaName;
                
                // Show success feedback
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

// Render notifications view (user's own videos)
function renderNotificationsView() {
    console.log("Rendering notifications view");
    const notificationsList = document.getElementById('notificationsList');
    if (!notificationsList) {
        console.error("Notifications list element not found");
        return;
    }
    
    notificationsList.innerHTML = '<div class="text-center p-8 text-gray-500">Loading your videos...</div>';

    // Get all videos (would filter by user in a real app)
    db.collection('milk_videos')
        .orderBy('uploadDate', 'desc')
        .get()
        .then((snapshot) => {
            console.log(`Found ${snapshot.size} videos for notifications`);
            
            if (snapshot.empty) {
                notificationsList.innerHTML = '<div class="text-center p-8 text-gray-500">You haven\'t uploaded any videos yet.</div>';
                return;
            }

            notificationsList.innerHTML = '';
            snapshot.forEach(doc => {
                const video = doc.data();
                const item = document.createElement('div');
                item.className = 'border-b border-gray-200 p-4';
                item.setAttribute('data-video-id', doc.id);
                
                // Create notification item
                item.innerHTML = `
                    <div class="flex items-start space-x-3">
                        <div class="w-20 h-20 bg-gray-100 rounded overflow-hidden">
                            ${video.thumbnailUrl ? 
                                `<img src="${video.thumbnailUrl}" alt="Video thumbnail" class="w-full h-full object-cover">` :
                                `<div class="w-full h-full bg-gray-200 flex items-center justify-center">
                                    <span class="text-gray-500 text-xs">Processing</span>
                                </div>`
                            }
                        </div>
                        <div class="flex-1">
                            <div class="flex justify-between items-start">
                                <span class="inline-block px-2 py-1 text-xs rounded ${getStatusClass(video.status)}">${video.status || 'Processing'}</span>
                                <span class="text-xs text-gray-500">${formatDate(video.uploadDate)}</span>
                            </div>
                            <p class="text-sm mt-1">${video.hashtags || 'No hashtags'}</p>
                            ${video.mob ? `<p class="text-xs text-fairlife-blue mt-1">Mob: ${video.mob}</p>` : ''}
                            ${video.milkTag ? `<p class="text-xs text-purple-700 mt-1 italic">Tag: ${video.milkTag}</p>` : ''}
                        </div>
                    </div>
                `;
                
                // Add click event to show video details
                item.addEventListener('click', () => {
                    showVideoDetails(doc.id, video);
                });
                
                notificationsList.appendChild(item);
            });
        })
        .catch(error => {
            console.error("Error fetching notifications:", error);
            notificationsList.innerHTML = '<div class="text-center p-8 text-gray-500">Error loading your videos.</div>';
        });
}

// Render explore view (mobs)
function renderExploreView() {
    console.log("Rendering explore view");
    const exploreContainer = document.getElementById('exploreContainer');
    if (!exploreContainer) {
        console.error("Explore container element not found");
        return;
    }
    
    exploreContainer.innerHTML = '<div class="text-center p-8 text-gray-500">Loading milk mobs...</div>';

    // Get approved videos
    db.collection('milk_videos')
        .where('status', '==', 'Approved')
        .get()
        .then((snapshot) => {
            console.log(`Found ${snapshot.size} approved videos for mobs`);
            
            if (snapshot.empty) {
                exploreContainer.innerHTML = '<div class="text-center p-8 text-gray-500">No mobs formed yet. Videos need approval first!</div>';
                return;
            }

            // Group videos by mob
            const mobs = {};
            snapshot.forEach(doc => {
                const video = doc.data();
                // Use recommendedMob if available, otherwise use mob or fallback to General
                const mobName = video.recommendedMob || video.mob || 'General';
                
                if (!mobs[mobName]) {
                    mobs[mobName] = [];
                }
                mobs[mobName].push({ ...video, id: doc.id });
            });

            if (Object.keys(mobs).length === 0) {
                exploreContainer.innerHTML = '<div class="text-center p-8 text-gray-500">No approved videos found.</div>';
                return;
            }

            // Display mobs
            exploreContainer.innerHTML = '';
            Object.entries(mobs).forEach(([mob, videos]) => {
                const section = document.createElement('div');
                section.className = 'mb-6';
                
                // Create section header
                const header = document.createElement('h3');
                header.className = 'text-lg font-medium mb-3 fairlife-blue';
                header.innerHTML = `${mob} <span class="text-sm text-gray-500">(${videos.length})</span>`;
                section.appendChild(header);
                
                // Create grid for videos
                const grid = document.createElement('div');
                grid.className = 'grid grid-cols-3 gap-2';
                
                // Add videos to grid
                videos.forEach(video => {
                    const card = document.createElement('div');
                    card.className = 'aspect-square relative overflow-hidden';
                    card.setAttribute('data-video-id', video.id);
                    
                    // Create thumbnail with overlay
                    let thumbnailUrl = video.thumbnailUrl || '';
                    let mediaContent;
                    
                    if (thumbnailUrl) {
                        // If we have a thumbnail
                        mediaContent = `<img src="${thumbnailUrl}" alt="Video thumbnail" class="w-full h-full object-cover">`;
                    } else if (video.videoUrl) {
                        // If we have video but no thumbnail, show first frame of video
                        mediaContent = `
                            <video class="w-full h-full object-cover" muted>
                                <source src="${video.videoUrl}" type="video/mp4">
                            </video>
                        `;
                    } else {
                        // Fallback if no media is available
                        mediaContent = `<div class="w-full h-full bg-gray-200 flex items-center justify-center">
                            <span class="text-gray-500">Processing</span>
                        </div>`;
                    }
                    
                    // Add badge indicators for status
                    let statusBadge = '';
                    if (video.status === 'Approved') {
                        statusBadge = '<span class="absolute top-2 right-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">✓</span>';
                    }
                    
                    card.innerHTML = `
                        ${mediaContent}
                        ${statusBadge}
                    `;
                    
                    // Add click event to show video details
                    card.addEventListener('click', () => {
                        showVideoDetails(video.id, video);
                    });
                    
                    grid.appendChild(card);
                });
                
                section.appendChild(grid);
                
                exploreContainer.appendChild(section);
            });
        })
        .catch(error => {
            console.error("Error fetching mobs:", error);
            exploreContainer.innerHTML = '<div class="text-center p-8 text-gray-500">Error loading milk mobs.</div>';
        });
}

// Render review view
function renderReviewView(pendingOnly = true) {
    console.log(`Rendering review view (pendingOnly: ${pendingOnly})`);
    const reviewList = document.getElementById('reviewList');
    if (!reviewList) {
        console.error("Review list element not found");
        return;
    }
    
    reviewList.innerHTML = '<div class="text-center p-8 text-gray-500">Loading videos for review...</div>';

    // Build query based on filter
    let query = db.collection('milk_videos');
    if (pendingOnly) {
        query = query.where('needsReview', '==', true);
    }
    
    // Get videos for review
    query.orderBy('uploadDate', 'desc')
        .get()
        .then((snapshot) => {
            console.log(`Found ${snapshot.size} videos for review`);
            
            if (snapshot.empty) {
                reviewList.innerHTML = '<div class="text-center p-8 text-gray-500">No videos to review at this time.</div>';
                return;
            }

            // Create a grid layout for the videos
            const grid = document.createElement('div');
            grid.className = 'grid grid-cols-3 gap-3';
            reviewList.innerHTML = '';
            reviewList.appendChild(grid);
            
            snapshot.forEach(doc => {
                const video = doc.data();
                const videoId = doc.id;
                
                const card = document.createElement('div');
                card.className = 'aspect-square relative overflow-hidden bg-white rounded-lg shadow-sm';
                card.setAttribute('data-video-id', videoId);
                
                // Create thumbnail with overlay
                let thumbnailUrl = video.thumbnailUrl || '';
                let mediaContent;
                
                if (thumbnailUrl) {
                    // If we have a thumbnail
                    mediaContent = `<img src="${thumbnailUrl}" alt="Video thumbnail" class="w-full h-full object-cover">`;
                } else if (video.videoUrl) {
                    // If we have video but no thumbnail, show first frame of video
                    mediaContent = `
                        <video class="w-full h-full object-cover" muted>
                            <source src="${video.videoUrl}" type="video/mp4">
                        </video>
                    `;
                } else {
                    // Fallback if no media is available
                    mediaContent = `<div class="w-full h-full bg-gray-200 flex items-center justify-center">
                        <span class="text-gray-500">Processing</span>
                    </div>`;
                }
                
                // Add status badge
                let statusBadge = '';
                if (video.status === 'Approved') {
                    statusBadge = '<span class="absolute top-2 right-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">✓</span>';
                } else if (video.status === 'Pending Review') {
                    statusBadge = '<span class="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-full">⌛</span>';
                } else if (video.status === 'Rejected') {
                    statusBadge = '<span class="absolute top-2 right-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">✕</span>';
                }
                
                card.innerHTML = `
                    ${mediaContent}
                    ${statusBadge}
                `;
                
                // Add click event to show video details with moderation options
                card.addEventListener('click', () => {
                    showVideoDetailsWithModeration(videoId, video);
                });
                
                grid.appendChild(card);
            });
        })
        .catch(error => {
            console.error("Error fetching videos for review:", error);
            reviewList.innerHTML = '<div class="text-center p-8 text-gray-500">Error loading videos for review.</div>';
        });
}

// Function to show video details with moderation options
function showVideoDetailsWithModeration(videoId, videoData) {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50';
    modal.id = 'videoModal';
    
    // Create modal content
    let videoElement = '';
    if (videoData.videoUrl) {
        videoElement = `
            <video controls autoplay class="max-h-[50vh] max-w-full rounded-lg">
                <source src="${videoData.videoUrl}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        `;
    } else {
        videoElement = `<div class="h-64 w-full bg-gray-200 flex items-center justify-center rounded-lg">Video processing</div>`;
    }
    
    // Status indicator with appropriate color
    let statusClass = 'bg-gray-100 text-gray-800';
    if (videoData.status === 'Approved') statusClass = 'bg-green-100 text-green-800';
    if (videoData.status === 'Rejected') statusClass = 'bg-red-100 text-red-800';
    if (videoData.status === 'Pending Review') statusClass = 'bg-yellow-100 text-yellow-800';
    
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 overflow-hidden">
            <div class="p-4 border-b">
                <div class="flex justify-between items-center">
                    <h3 class="text-lg font-medium">Moderate Video</h3>
                    <button id="closeModal" class="text-gray-500 hover:text-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
            
            <div class="p-4">
                ${videoElement}
                
                <div class="mt-4">
                    <div class="flex items-center justify-between mb-3">
                        <span class="inline-block px-2 py-1 text-xs rounded ${statusClass}">${videoData.status || 'Processing'}</span>
                        
                        <div class="flex space-x-2">
                            <button id="approveBtn" class="px-3 py-1 bg-fairlife-blue text-white rounded text-sm ${videoData.status === 'Approved' ? 'opacity-50' : ''}">
                                Approve
                            </button>
                            <button id="rejectBtn" class="px-3 py-1 bg-red-500 text-white rounded text-sm ${videoData.status === 'Rejected' ? 'opacity-50' : ''}">
                                Reject
                            </button>
                        </div>
                    </div>
                    
                    <div class="mb-3">
                        <label for="${videoData.mob ? 'mobDisplay' : 'mobSelect'}" class="block text-sm font-medium text-gray-700 mb-1">Milk Mob</label>
                        ${videoData.status === 'Rejected' ? 
                            `<div class="px-3 py-2 bg-gray-100 rounded-md text-gray-500 text-sm italic">
                                No mob assigned (rejected)
                             </div>` 
                            : 
                            videoData.mob ? 
                                `<div class="flex items-center space-x-2">
                                    <div id="mobDisplay" class="flex-1 px-3 py-2 bg-gray-100 rounded-md text-gray-700 text-sm">
                                        ${videoData.mob}
                                    </div>
                                    <button id="editMobBtn" class="bg-gray-200 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-300">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                    </button>
                                </div>
                                <div id="mobEditForm" class="hidden mt-2">
                                    <div class="flex space-x-2">
                                        <input type="text" id="mobInput" class="flex-1 px-3 py-2 border border-gray-300 rounded-md" value="${videoData.mob}">
                                        <button id="updateMobBtn" class="bg-fairlife-blue text-white px-3 py-2 rounded-md" data-id="${videoId}">Update</button>
                                    </div>
                                </div>` 
                                : 
                                `<div class="flex space-x-2">
                                    <select id="mobSelect" class="flex-1 px-3 py-2 border border-gray-300 rounded-md">
                                        <option value="">Select Mob</option>
                                        <option value="Dairy Dragons">Dairy Dragons</option>
                                        <option value="Milk Masters">Milk Masters</option>
                                        <option value="Calcium Crew">Calcium Crew</option>
                                        <option value="Lactose Legion">Lactose Legion</option>
                                    </select>
                                    <button id="saveMobSelectBtn" class="bg-fairlife-blue text-white px-3 py-2 rounded-md">Save</button>
                                 </div>`
                        }
                    </div>
                    
                    <div class="grid grid-cols-2 gap-2 mb-3">
                        <div>
                            <p class="text-sm text-gray-800 mb-1"><strong>Upload Date:</strong> ${formatDate(videoData.uploadDate, true)}</p>
                            <p class="text-sm text-gray-800 mb-1"><strong>Hashtags:</strong> ${videoData.hashtags || 'None'}</p>
                        </div>
                        <div>
                            ${videoData.recommendedMob ? `<p class="text-sm text-fairlife-blue mb-1"><strong>Milk Mob:</strong> ${videoData.recommendedMob}</p>` : ''}
                            ${videoData.milkTag ? `<p class="text-sm text-purple-700 italic mb-1"><strong>Tag:</strong> ${videoData.milkTag}</p>` : ''}
                        </div>
                    </div>
                    
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
    
    // Add to body
    document.body.appendChild(modal);
    
    // Add close handler
    document.getElementById('closeModal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Close when clicking outside the content
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
    
    // Add edit button handler
    const editButton = document.getElementById('editMediaNameBtn');
    if (editButton) {
        editButton.addEventListener('click', () => {
            const editForm = document.getElementById('mediaNameEditForm');
            if (editForm.classList.contains('hidden')) {
                editForm.classList.remove('hidden');
                editButton.textContent = "Cancel";
            } else {
                editForm.classList.add('hidden');
                editButton.textContent = "Edit";
            }
        });
    }
    
    // Add save media name handler
    const saveButton = document.getElementById('saveMediaName');
    if (saveButton) {
        saveButton.addEventListener('click', async () => {
            const mediaName = document.getElementById('mediaName').value.trim();
            
            try {
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
                
                // Update the videoData object
                videoData.mediaName = mediaName;
                
                // Show success feedback
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
    
    // Add save mob select button handler
    const saveMobSelectBtn = document.getElementById('saveMobSelectBtn');
    if (saveMobSelectBtn) {
        saveMobSelectBtn.addEventListener('click', async () => {
            const mobSelect = document.getElementById('mobSelect');
            const selectedMob = mobSelect ? mobSelect.value : '';
            
            if (!selectedMob) {
                alert('Please select a mob first.');
                return;
            }
            
            try {
                // Update both mob and recommendedMob fields
                await db.collection('milk_videos').doc(videoId).update({
                    mob: selectedMob,
                    recommendedMob: selectedMob
                });
                
                // Update the UI to show the edit mode instead of select
                const mobContainer = document.querySelector('[for="mobSelect"]').parentNode;
                mobContainer.innerHTML = `
                    <label for="mobDisplay" class="block text-sm font-medium text-gray-700 mb-1">Milk Mob</label>
                    <div class="flex items-center space-x-2">
                        <div id="mobDisplay" class="flex-1 px-3 py-2 bg-gray-100 rounded-md text-gray-700 text-sm">
                            ${selectedMob}
                            <span class="text-xs text-green-500 ml-2">✓ Saved</span>
                        </div>
                        <button id="editMobBtn" class="bg-gray-200 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-300">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                        </button>
                    </div>
                    <div id="mobEditForm" class="hidden mt-2">
                        <div class="flex space-x-2">
                            <input type="text" id="mobInput" class="flex-1 px-3 py-2 border border-gray-300 rounded-md" value="${selectedMob}">
                            <button id="updateMobBtn" class="bg-fairlife-blue text-white px-3 py-2 rounded-md" data-id="${videoId}">Update</button>
                        </div>
                    </div>
                `;
                
                // Update the videoData object
                videoData.mob = selectedMob;
                
                // Add event listeners for the new edit button
                const editMobBtn = document.getElementById('editMobBtn');
                if (editMobBtn) {
                    editMobBtn.addEventListener('click', () => {
                        const editForm = document.getElementById('mobEditForm');
                        if (editForm.classList.contains('hidden')) {
                            editForm.classList.remove('hidden');
                            editMobBtn.classList.add('bg-gray-300');
                        } else {
                            editForm.classList.add('hidden');
                            editMobBtn.classList.remove('bg-gray-300');
                        }
                    });
                }
                
                // Add event listener for the update button
                const updateMobBtn = document.getElementById('updateMobBtn');
                if (updateMobBtn) {
                    updateMobBtn.addEventListener('click', async () => {
                        const newMobInput = document.getElementById('mobInput');
                        const newMob = newMobInput ? newMobInput.value.trim() : '';
                        
                        if (!newMob) {
                            alert('Please enter a valid mob name.');
                            return;
                        }
                        
                        try {
                            await db.collection('milk_videos').doc(videoId).update({
                                mob: newMob,
                                recommendedMob: newMob
                            });
                            
                            // Update the display
                            const mobDisplay = document.getElementById('mobDisplay');
                            if (mobDisplay) {
                                mobDisplay.innerHTML = `
                                    ${newMob}
                                    <span class="text-xs text-green-500 ml-2">✓ Saved</span>
                                `;
                            }
                            
                            // Show success feedback
                            updateMobBtn.textContent = "Saved!";
                            updateMobBtn.classList.add('bg-green-500');
                            
                            // Update the videoData object
                            videoData.mob = newMob;
                            
                            // Reset after 2 seconds
                            setTimeout(() => {
                                updateMobBtn.textContent = "Update";
                                updateMobBtn.classList.remove('bg-green-500');
                                
                                // Hide the edit form
                                document.getElementById('mobEditForm').classList.add('hidden');
                                document.getElementById('editMobBtn').classList.remove('bg-gray-300');
                                
                                // Remove saved indicator after 3 seconds
                                const savedIndicator = mobDisplay.querySelector('.text-xs.text-green-500');
                                if (savedIndicator) {
                                    setTimeout(() => {
                                        savedIndicator.remove();
                                    }, 1000);
                                }
                            }, 2000);
                            
                        } catch (error) {
                            console.error("Error updating mob:", error);
                            alert("Failed to update mob. Please try again.");
                        }
                    });
                }
                
            } catch (error) {
                console.error("Error saving mob:", error);
                alert("Failed to save mob. Please try again.");
            }
        });
    }
    
    // Add approve button handler
    const approveBtn = document.getElementById('approveBtn');
    if (approveBtn) {
        approveBtn.addEventListener('click', async () => {
            // Get mob from either input or select
            const mobInput = document.getElementById('mobInput');
            const mobSelect = document.getElementById('mobSelect');
            
            let mob = '';
            if (mobInput) {
                mob = mobInput.value.trim();
            } else if (mobSelect) {
                mob = mobSelect.value;
            }
            
            if (!mob) {
                alert('Please enter or select a mob before approving.');
                return;
            }
            
            try {
                await approveVideo(videoId, mob);
                
                // Update UI to reflect the change
                const statusBadge = modal.querySelector('.inline-block.px-2.py-1.text-xs.rounded');
                if (statusBadge) {
                    statusBadge.className = 'inline-block px-2 py-1 text-xs rounded bg-green-100 text-green-800';
                    statusBadge.textContent = 'Approved';
                }
                
                // Update buttons
                approveBtn.classList.add('opacity-50');
                document.getElementById('rejectBtn').classList.remove('opacity-50');
                
                // Update the videoData object
                videoData.status = 'Approved';
                videoData.mob = mob;
                
                // Update the mob display to show edit mode instead of dropdown
                const mobContainer = document.querySelector('[for="mobInput"], [for="mobSelect"]').parentNode;
                mobContainer.innerHTML = `
                    <label for="mobDisplay" class="block text-sm font-medium text-gray-700 mb-1">Milk Mob</label>
                    <div class="flex items-center space-x-2">
                        <div id="mobDisplay" class="flex-1 px-3 py-2 bg-gray-100 rounded-md text-gray-700 text-sm">
                            ${mob}
                        </div>
                        <button id="editMobBtn" class="bg-gray-200 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-300">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                        </button>
                    </div>
                    <div id="mobEditForm" class="hidden mt-2">
                        <div class="flex space-x-2">
                            <input type="text" id="mobInput" class="flex-1 px-3 py-2 border border-gray-300 rounded-md" value="${mob}">
                            <button id="updateMobBtn" class="bg-fairlife-blue text-white px-3 py-2 rounded-md" data-id="${videoId}">Update</button>
                        </div>
                    </div>
                `;
                    
                // Add event listeners for the mob editing
                const editMobBtn = document.getElementById('editMobBtn');
                if (editMobBtn) {
                    editMobBtn.addEventListener('click', () => {
                        const editForm = document.getElementById('mobEditForm');
                        if (editForm.classList.contains('hidden')) {
                            editForm.classList.remove('hidden');
                            editMobBtn.classList.add('bg-gray-300');
                        } else {
                            editForm.classList.add('hidden');
                            editMobBtn.classList.remove('bg-gray-300');
                        }
                    });
                }
                
                // Add event listener for the update button
                const updateMobBtn = document.getElementById('updateMobBtn');
                if (updateMobBtn) {
                    updateMobBtn.addEventListener('click', async () => {
                        const newMobInput = document.getElementById('mobInput');
                        const newMob = newMobInput ? newMobInput.value.trim() : '';
                        
                        if (!newMob) {
                            alert('Please enter a valid mob name.');
                            return;
                        }
                        
                        try {
                            await db.collection('milk_videos').doc(videoId).update({
                                mob: newMob
                            });
                            
                            // Update the display
                            const mobDisplay = document.getElementById('mobDisplay');
                            if (mobDisplay) {
                                mobDisplay.textContent = newMob;
                            }
                            
                            // Show success feedback
                            updateMobBtn.textContent = "Updated!";
                            updateMobBtn.classList.add('bg-green-500');
                            
                            // Update the videoData object
                            videoData.mob = newMob;
                            
                            // Reset after 2 seconds
                            setTimeout(() => {
                                updateMobBtn.textContent = "Update";
                                updateMobBtn.classList.remove('bg-green-500');
                                
                                // Hide the edit form
                                document.getElementById('mobEditForm').classList.add('hidden');
                                document.getElementById('editMobBtn').classList.remove('bg-gray-300');
                            }, 2000);
                            
                        } catch (error) {
                            console.error("Error updating mob:", error);
                            alert("Failed to update mob. Please try again.");
                        }
                    });
                }
                
            } catch (error) {
                console.error("Error approving video:", error);
                alert("Failed to approve video. Please try again.");
            }
        });
    }
    
    // Add edit mob button handler
    const editMobBtn = document.getElementById('editMobBtn');
    if (editMobBtn) {
        editMobBtn.addEventListener('click', () => {
            const editForm = document.getElementById('mobEditForm');
            if (editForm.classList.contains('hidden')) {
                editForm.classList.remove('hidden');
                editMobBtn.classList.add('bg-gray-300');
            } else {
                editForm.classList.add('hidden');
                editMobBtn.classList.remove('bg-gray-300');
            }
        });
    }
    
    // Add update mob button handler
    const updateMobBtn = document.getElementById('updateMobBtn');
    if (updateMobBtn) {
        updateMobBtn.addEventListener('click', async () => {
            const mobInput = document.getElementById('mobInput');
            const newMob = mobInput ? mobInput.value.trim() : '';
            
            if (!newMob) {
                alert('Please enter a valid mob name.');
                return;
            }
            
            try {
                await db.collection('milk_videos').doc(videoId).update({
                    mob: newMob
                });
                
                // Update the display
                const mobDisplay = document.getElementById('mobDisplay');
                if (mobDisplay) {
                    mobDisplay.textContent = newMob;
                }
                
                // Show success feedback
                updateMobBtn.textContent = "Saved!";
                updateMobBtn.classList.add('bg-green-500');
                
                // Add a saved indicator next to the mob display
                const savedIndicator = document.createElement('span');
                savedIndicator.className = 'text-xs text-green-500 ml-2';
                savedIndicator.textContent = '✓ Saved';
                mobDisplay.appendChild(savedIndicator);
                
                // Update the videoData object
                videoData.mob = newMob;
                
                // Reset after 2 seconds
                setTimeout(() => {
                    updateMobBtn.textContent = "Update";
                    updateMobBtn.classList.remove('bg-green-500');
                    
                    // Hide the edit form
                    document.getElementById('mobEditForm').classList.add('hidden');
                    document.getElementById('editMobBtn').classList.remove('bg-gray-300');
                    
                    // Remove saved indicator after 3 seconds
                    setTimeout(() => {
                        if (savedIndicator.parentNode) {
                            savedIndicator.parentNode.removeChild(savedIndicator);
                        }
                    }, 1000);
                }, 2000);
                
            } catch (error) {
                console.error("Error updating mob:", error);
                alert("Failed to update mob. Please try again.");
            }
        });
    }
    
    // Add reject button handler
    const rejectBtn = document.getElementById('rejectBtn');
    if (rejectBtn) {
        rejectBtn.addEventListener('click', async () => {
            try {
                await rejectVideo(videoId);
                
                // Update UI to reflect the change
                const statusBadge = modal.querySelector('.inline-block.px-2.py-1.text-xs.rounded');
                if (statusBadge) {
                    statusBadge.className = 'inline-block px-2 py-1 text-xs rounded bg-red-100 text-red-800';
                    statusBadge.textContent = 'Rejected';
                }
                
                // Update buttons
                rejectBtn.classList.add('opacity-50');
                document.getElementById('approveBtn').classList.remove('opacity-50');
                
                // Update the videoData object
                videoData.status = 'Rejected';
                
                // Remove mob display since rejected videos shouldn't have a mob
                const mobContainer = document.querySelector('[for="mobInput"], [for="mobSelect"], [for="mobDisplay"]').parentNode;
                mobContainer.innerHTML = `
                    <label class="block text-sm font-medium text-gray-700 mb-1">Milk Mob</label>
                    <div class="px-3 py-2 bg-gray-100 rounded-md text-gray-500 text-sm italic">
                        No mob assigned (rejected)
                    </div>
                `;
                
            } catch (error) {
                console.error("Error rejecting video:", error);
                alert("Failed to reject video. Please try again.");
            }
        });
    }
}

// Approve video
async function approveVideo(videoId, mob) {
    try {
        console.log(`Approving video ${videoId} for mob ${mob}`);
        
        // Update Firestore - set both mob and recommendedMob
        await db.collection('milk_videos').doc(videoId).update({
            status: 'Approved',
            mob: mob,
            recommendedMob: mob,
            needsReview: false,
            reviewDate: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Notify webhook with our new helper function
        const webhookData = {
            action: 'approve_video',
            videoId: videoId,
            mob: mob,
            timestamp: new Date().toISOString()
        };
        
        // Don't await this - let it run in background
        callWebhook(webhookData)
            .then(success => {
                if (success) {
                    console.log("Approval webhook notification processed");
                } else {
                    console.warn("Approval webhook notification failed but app continues");
                }
            });
        
        // Refresh the view
        const pendingBtn = document.getElementById('pendingReviewBtn');
        renderReviewView(pendingBtn && pendingBtn.classList.contains('bg-fairlife-blue'));
    } catch (error) {
        console.error("Error approving video:", error);
        alert("Failed to approve video. Please try again.");
    }
}

// Reject video
async function rejectVideo(videoId) {
    try {
        console.log(`Rejecting video ${videoId}`);
        
        // Update Firestore - remove mob when rejecting
        await db.collection('milk_videos').doc(videoId).update({
            status: 'Rejected',
            needsReview: false,
            mob: firebase.firestore.FieldValue.delete(), // Remove mob field
            reviewDate: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Notify webhook with our new helper function
        const webhookData = {
            action: 'reject_video',
            videoId: videoId,
            timestamp: new Date().toISOString()
        };
        
        // Don't await this - let it run in background
        callWebhook(webhookData)
            .then(success => {
                if (success) {
                    console.log("Rejection webhook notification processed");
                } else {
                    console.warn("Rejection webhook notification failed but app continues");
                }
            });
        
        // Refresh the view
        const pendingBtn = document.getElementById('pendingReviewBtn');
        renderReviewView(pendingBtn && pendingBtn.classList.contains('bg-fairlife-blue'));
    } catch (error) {
        console.error("Error rejecting video:", error);
        alert("Failed to reject video. Please try again.");
    }
}

// Format date
function formatDate(timestamp, detailed = false) {
    if (!timestamp) return 'Just now';
    
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        if (detailed) {
            return date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (e) {
        return 'Invalid date';
    }
}

// Get CSS class for status
function getStatusClass(status) {
    switch(status) {
        case 'Approved':
            return 'bg-green-100 text-green-800';
        case 'Rejected':
            return 'bg-red-100 text-red-800';
        case 'Pending Review':
            return 'bg-yellow-100 text-yellow-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}
