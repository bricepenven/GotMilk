// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAU3qmsD15JX6iwjloTjCPDd-2SuG6oM8w",
    authDomain: "chokaj-4dcae.firebaseapp.com",
    projectId: "chokaj-4dcae",
    storageBucket: "chokaj-4dcae.appspot.com",
    messagingSenderId: "628147483032",
    appId: "1:628147483032:web:2cea7a3dd553b8922d7398"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

// DOM elements
const tabs = document.querySelectorAll('.tab');
const views = document.querySelectorAll('[id$="View"]');
const uploadForm = document.getElementById('uploadForm');
const uploadStatus = document.getElementById('uploadStatus');
const pendingReviewBtn = document.getElementById('pendingReviewBtn');
const allVideosBtn = document.getElementById('allVideosBtn');

// N8N webhook URL for video processing - updated with your actual webhook URL
const webhookUrl = 'https://jinthoa.app.n8n.cloud/webhook-test/webhook-test/{{$workflow.id}}';

// Navigation
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        // Update active tab UI
        tabs.forEach(t => {
            t.classList.remove('text-fairlife-blue', 'border-t-2', 'border-fairlife-blue');
            t.classList.add('text-gray-400');
        });
        tab.classList.remove('text-gray-400');
        tab.classList.add('text-fairlife-blue', 'border-t-2', 'border-fairlife-blue');
        
        // Show the selected view
        const viewId = tab.getAttribute('data-view');
        views.forEach(view => {
            view.classList.add('hidden');
        });
        document.getElementById(viewId).classList.remove('hidden');
        
        // Load data for the selected view
        if (viewId === 'homeView') {
            renderHomeView();
        } else if (viewId === 'notificationsView') {
            renderNotificationsView();
        } else if (viewId === 'exploreView') {
            renderExploreView();
        } else if (viewId === 'reviewView') {
            renderReviewView(true);
        }
    });
});

// Handle video upload
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
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
        
        // Upload to Firebase Storage
        const storageRef = storage.ref(`videos/${videoId}`);
        const uploadTask = storageRef.put(videoFile);
        
        uploadTask.on('state_changed', 
            (snapshot) => {
                // Progress monitoring
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                showUploadStatus(`Upload progress: ${Math.round(progress)}%`, 'info');
            },
            (error) => {
                // Error handling
                console.error('Upload error:', error);
                showUploadStatus('Upload failed. Please try again.', 'error');
            },
            async () => {
                // Upload completed successfully
                showUploadStatus('Processing video...', 'info');
                
                // Get download URL
                const videoUrl = await uploadTask.snapshot.ref.getDownloadURL();
                
                // Submit to webhook for processing
                await submitToWebhook({
                    action: 'processVideo',
                    videoId: videoId,
                    videoUrl: videoUrl,
                    hashtags: hashtags
                });
                
                showUploadStatus('Video submitted for processing!', 'success');
                setTimeout(() => {
                    document.getElementById('videoFile').value = '';
                    document.getElementById('hashtags').value = '';
                    hideUploadStatus();
                    // Navigate to Notifications view to see progress
                    document.getElementById('notificationsTab').click();
                }, 2000);
            }
        );
    } catch (error) {
        console.error('Error:', error);
        showUploadStatus('An error occurred. Please try again.', 'error');
    }
});

// Submit data to webhook
async function submitToWebhook(data) {
    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ body: data }),
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Webhook error:', error);
        throw error;
    }
}

// Show upload status message
function showUploadStatus(message, type) {
    uploadStatus.textContent = message;
    uploadStatus.classList.remove('hidden', 'text-green-500', 'text-red-500', 'text-blue-500');
    
    if (type === 'success') {
        uploadStatus.classList.add('text-green-500');
    } else if (type === 'error') {
        uploadStatus.classList.add('text-red-500');
    } else {
        uploadStatus.classList.add('text-blue-500');
    }
}

// Hide upload status message
function hideUploadStatus() {
    uploadStatus.classList.add('hidden');
}

// Render home view with ALL videos
function renderHomeView() {
    const homeGrid = document.getElementById('homeGrid');
    homeGrid.innerHTML = '<div class="col-span-2 text-center p-8 text-gray-400">Loading all media...</div>';

    // Get all videos regardless of approval status
    db.collection('milk_videos')
        .orderBy('uploadDate', 'desc')
        .get()
        .then((snapshot) => {
            if (snapshot.empty) {
                homeGrid.innerHTML = '<div class="col-span-2 text-center p-8 text-gray-400">No videos yet.</div>';
                return;
            }

            homeGrid.innerHTML = '';
            snapshot.forEach(doc => {
                const video = doc.data();
                const card = createVideoCard(video, doc.id);
                homeGrid.appendChild(card);
            });
        })
        .catch(error => {
            console.error("Error fetching videos:", error);
            homeGrid.innerHTML = '<div class="col-span-2 text-center p-8 text-gray-400">Error loading videos. Please try again.</div>';
        });
}

// Create a video card for display
function createVideoCard(video, videoId) {
    const card = document.createElement('div');
    card.className = 'bg-gray-800 rounded-lg overflow-hidden shadow-md';
    
    // Video thumbnail or placeholder
    let mediaElement;
    if (video.thumbnail_url) {
        mediaElement = `<img src="${video.thumbnail_url}" alt="Video thumbnail" class="w-full h-36 object-cover">`;
    } else {
        mediaElement = `<div class="w-full h-36 bg-gray-700 flex items-center justify-center text-gray-500">Processing</div>`;
    }
    
    // Status badge
    let statusBadge = '';
    if (video.status === 'Approved') {
        statusBadge = `<span class="absolute top-2 right-2 px-2 py-1 bg-green-900 text-xs text-green-300 rounded-md">Approved</span>`;
    } else if (video.status === 'Rejected') {
        statusBadge = `<span class="absolute top-2 right-2 px-2 py-1 bg-red-900 text-xs text-red-300 rounded-md">Rejected</span>`;
    } else if (video.status === 'Needs Review') {
        statusBadge = `<span class="absolute top-2 right-2 px-2 py-1 bg-yellow-900 text-xs text-yellow-300 rounded-md">Review</span>`;
    } else {
        statusBadge = `<span class="absolute top-2 right-2 px-2 py-1 bg-gray-700 text-xs text-gray-300 rounded-md">Processing</span>`;
    }
    
    card.innerHTML = `
        <div class="relative">
            ${mediaElement}
            ${statusBadge}
        </div>
        <div class="p-3">
            <p class="text-xs text-gray-400 truncate">${video.hashtags || 'No hashtags'}</p>
            ${video.mob ? `<p class="text-xs fairlife-blue mt-1">Mob: ${video.mob}</p>` : ''}
        </div>
    `;
    
    return card;
}

// Render notifications view (user's own videos)
function renderNotificationsView() {
    const notificationsList = document.getElementById('notificationsList');
    notificationsList.innerHTML = '<div class="text-center p-8 text-gray-400">Loading your media...</div>';

    // Simplified: Normally would filter by user ID
    db.collection('milk_videos')
        .orderBy('uploadDate', 'desc')
        .get()
        .then((snapshot) => {
            if (snapshot.empty) {
                notificationsList.innerHTML = '<div class="text-center p-8 text-gray-400">You haven\'t uploaded any videos yet.</div>';
                return;
            }

            notificationsList.innerHTML = '';
            snapshot.forEach(doc => {
                const video = doc.data();
                const notificationItem = document.createElement('div');
                notificationItem.className = 'border-b border-gray-700 p-4';
                
                let statusClass, statusText;
                if (video.status === 'Approved') {
                    statusClass = 'bg-green-900 text-green-300';
                    statusText = 'Approved';
                } else if (video.status === 'Rejected') {
                    statusClass = 'bg-red-900 text-red-300';
                    statusText = 'Rejected';
                } else if (video.status === 'Needs Review') {
                    statusClass = 'bg-yellow-900 text-yellow-300';
                    statusText = 'Needs Review';
                } else {
                    statusClass = 'bg-gray-700 text-gray-300';
                    statusText = 'Processing';
                }
                
                notificationItem.innerHTML = `
                    <div class="flex items-center justify-between">
                        <div>
                            <span class="px-2 py-1 rounded text-xs ${statusClass}">${statusText}</span>
                            <span class="text-sm ml-2 text-gray-300">${video.hashtags || 'No hashtags'}</span>
                        </div>
                        <span class="text-xs text-gray-500">${formatDate(video.uploadDate)}</span>
                    </div>
                    ${video.mob ? `<p class="text-sm fairlife-blue mt-2">Assigned to: ${video.mob}</p>` : ''}
                `;
                
                notificationsList.appendChild(notificationItem);
            });
        })
        .catch(error => {
            console.error("Error fetching notifications:", error);
            notificationsList.innerHTML = '<div class="text-center p-8 text-gray-400">Error loading your videos.</div>';
        });
}

// Format date for display
function formatDate(timestamp) {
    if (!timestamp) return 'Unknown date';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Render explore view (mobs)
function renderExploreView() {
    const exploreContainer = document.getElementById('exploreContainer');
    exploreContainer.innerHTML = '<div class="text-center p-8 text-gray-400">Loading milk mobs...</div>';

    // Get all approved videos grouped by mob
    db.collection('milk_videos')
        .where('status', '==', 'Approved')
        .get()
        .then((snapshot) => {
            if (snapshot.empty) {
                exploreContainer.innerHTML = '<div class="text-center p-8 text-gray-400">No mobs formed yet. Videos need approval first!</div>';
                return;
            }

            const mobs = {};
            snapshot.forEach(doc => {
                const video = doc.data();
                if (video.mob) {
                    if (!mobs[video.mob]) {
                        mobs[video.mob] = [];
                    }
                    mobs[video.mob].push({ ...video, id: doc.id });
                }
            });

            if (Object.keys(mobs).length === 0) {
                exploreContainer.innerHTML = '<div class="text-center p-8 text-gray-400">No mobs formed yet. Videos need approval first!</div>';
                return;
            }

            exploreContainer.innerHTML = '';
            Object.entries(mobs).forEach(([mob, videos]) => {
                const mobSection = document.createElement('div');
                mobSection.className = 'mb-8';
                
                mobSection.innerHTML = `
                    <h3 class="text-lg font-medium mb-3 fairlife-blue">${mob} <span class="text-sm text-gray-400">(${videos.length})</span></h3>
                    <div class="grid grid-cols-2 gap-2">
                        ${videos.map(video => `
                            <div class="bg-gray-800 rounded-lg overflow-hidden shadow-md">
                                ${video.thumbnail_url ? 
                                    `<img src="${video.thumbnail_url}" alt="Video thumbnail" class="w-full h-32 object-cover">` :
                                    `<div class="w-full h-32 bg-gray-700 flex items-center justify-center text-gray-500">No Thumbnail</div>`
                                }
                                <div class="p-2">
                                    <p class="text-xs text-gray-400 truncate">${video.hashtags || 'No hashtags'}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
                
                exploreContainer.appendChild(mobSection);
            });
        })
        .catch(error => {
            console.error("Error fetching mobs:", error);
            exploreContainer.innerHTML = '<div class="text-center p-8 text-gray-400">Error loading mobs.</div>';
        });
}

// Render review (moderation) view
function renderReviewView(filterPending = true) {
    const reviewList = document.getElementById('reviewList');
    reviewList.innerHTML = '<div class="text-center p-8 text-gray-400">Loading media for review...</div>';

    // Set up query based on filter
    let query = db.collection('milk_videos');
    
    if (filterPending) {
        query = query.where('needsReview', '==', true);
    }
    
    query.orderBy('uploadDate', 'desc')
        .get()
        .then((snapshot) => {
            if (snapshot.empty) {
                reviewList.innerHTML = '<div class="text-center p-8 text-gray-400">No videos to review at this time.</div>';
                return;
            }

            reviewList.innerHTML = '';
            snapshot.forEach(doc => {
                const video = doc.data();
                const videoId = doc.id;
                
                // Create container for the video
                const reviewItem = document.createElement('div');
                reviewItem.className = 'bg-gray-800 rounded-lg overflow-hidden shadow-md mb-4';
                
                // Video or thumbnail
                let mediaElement;
                if (video.thumbnail_url) {
                    mediaElement = `<img src="${video.thumbnail_url}" alt="Video thumbnail" class="w-full h-48 object-cover">`;
                } else {
                    mediaElement = `<div class="w-full h-48 bg-gray-700 flex items-center justify-center text-gray-500">No Thumbnail</div>`;
                }
                
                // Moderation controls
                const moderationControls = filterPending || video.status === 'Needs Review' ? 
                    `<div class="flex space-x-2 mt-2">
                        <button class="approve-btn px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700" data-video-id="${videoId}">
                            Approve
                        </button>
                        <button class="reject-btn px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700" data-video-id="${videoId}">
                            Reject
                        </button>
                        <select class="mob-select bg-gray-700 text-white px-2 py-1 rounded-md" data-video-id="${videoId}">
                            <option value="">Select Mob</option>
                            <option value="Dairy Dragons">Dairy Dragons</option>
                            <option value="Milk Masters">Milk Masters</option>
                            <option value="Calcium Crew">Calcium Crew</option>
                            <option value="Lactose Legion">Lactose Legion</option>
                            <option value="Udder Chaos">Udder Chaos</option>
                        </select>
                    </div>` : 
                    `<div class="mt-2">
                        <span class="px-2 py-1 text-sm rounded-md ${video.status === 'Approved' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}">
                            ${video.status}
                        </span>
                        ${video.mob ? `<span class="ml-2 text-gray-400">Mob: ${video.mob}</span>` : ''}
                    </div>`;
                
                // Create the review item content
                reviewItem.innerHTML = `
                    ${mediaElement}
                    <div class="p-4">
                        <p class="text-gray-300 text-sm mb-1">Status: ${video.status || 'Pending'}</p>
                        <p class="text-gray-400 text-xs mb-2">Hashtags: ${video.hashtags || 'None'}</p>
                        ${moderationControls}
                    </div>
                `;
                
                reviewList.appendChild(reviewItem);
            });
            
            // Add event listeners for approve/reject buttons
            document.querySelectorAll('.approve-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const videoId = this.getAttribute('data-video-id');
                    const mobSelect = document.querySelector(`.mob-select[data-video-id="${videoId}"]`);
                    const mob = mobSelect.value || 'Milk Masters'; // Default mob if none selected
                    handleReviewAction(videoId, 'Approved', mob);
                });
            });
            
            document.querySelectorAll('.reject-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const videoId = this.getAttribute('data-video-id');
                    handleReviewAction(videoId, 'Rejected', '');
                });
            });
        })
        .catch(error => {
            console.error("Error fetching videos for review:", error);
            reviewList.innerHTML = '<div class="text-center p-8 text-gray-400">Error loading videos. Please try again.</div>';
        });
}

// Handle review actions (approve/reject)
async function handleReviewAction(videoId, status, mob) {
    try {
        const btn = document.querySelector(`.approve-btn[data-video-id="${videoId}"]`)?.parentNode || 
                  document.querySelector(`.reject-btn[data-video-id="${videoId}"]`)?.parentNode;
        
        if (btn) {
            btn.innerHTML = '<span class="text-gray-400">Processing...</span>';
        }
        
        // Submit to webhook for processing
        await submitToWebhook({
            action: 'updateVideoStatus',
            videoId: videoId,
            status: status,
            mob: mob
        });
        
        // Re-render the review view
        renderReviewView(pendingReviewBtn.classList.contains('bg-fairlife-blue'));
    } catch (error) {
        console.error('Error updating video status:', error);
        alert('Failed to update video status. Please try again.');
    }
}

// Event listeners for the moderation view filter buttons
pendingReviewBtn.addEventListener('click', function() {
    this.classList.add('bg-fairlife-blue');
    this.classList.remove('bg-gray-700');
    allVideosBtn.classList.remove('bg-fairlife-blue');
    allVideosBtn.classList.add('bg-gray-700');
    renderReviewView(true);
});

allVideosBtn.addEventListener('click', function() {
    this.classList.add('bg-fairlife-blue');
    this.classList.remove('bg-gray-700');
    pendingReviewBtn.classList.remove('bg-fairlife-blue');
    pendingReviewBtn.classList.add('bg-gray-700');
    renderReviewView(false);
});

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    // Show home view by default
    renderHomeView();
    
    // Listen for real-time updates to videos
    db.collection('milk_videos').onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            // If currently in notifications or home view, update the display
            if (!document.getElementById('notificationsView').classList.contains('hidden')) {
                renderNotificationsView();
            } else if (!document.getElementById('homeView').classList.contains('hidden')) {
                renderHomeView();
            } else if (!document.getElementById('exploreView').classList.contains('hidden')) {
                renderExploreView();
            } else if (!document.getElementById('reviewView').classList.contains('hidden')) {
                renderReviewView(pendingReviewBtn.classList.contains('bg-fairlife-blue'));
            }
        });
    });
});