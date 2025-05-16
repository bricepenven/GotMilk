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

// Add the webhook URL
const webhookUrl = "https://jinthoa.app.n8n.cloud/webhook-test/188f3bac-7c25-4d92-a1ba-020b6878607d";

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
                        uploadDate: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    console.log("Document saved with ID:", docRef.id);
                    
                    // Try to notify webhook
                    try {
                        fetch(webhookUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ 
                                videoId: docRef.id,
                                action: 'new_video',
                                videoUrl: videoUrl,
                                hashtags: hashtags
                            }),
                        });
                        console.log("Webhook notification sent");
                    } catch (webhookError) {
                        console.error("Failed to notify webhook:", webhookError);
                        // Continue even if webhook fails
                    }
                    
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

// Render home view with ALL videos
function renderHomeView() {
    console.log("Rendering home view");
    const homeGrid = document.getElementById('homeGrid');
    if (!homeGrid) {
        console.error("Home grid element not found");
        return;
    }
    
    homeGrid.innerHTML = '<div class="col-span-2 text-center p-8 text-gray-500">Loading videos...</div>';

    // Get all videos
    db.collection('milk_videos')
        .orderBy('uploadDate', 'desc')
        .get()
        .then((snapshot) => {
            console.log(`Found ${snapshot.size} videos`);
            
            if (snapshot.empty) {
                homeGrid.innerHTML = '<div class="col-span-2 text-center p-8 text-gray-500">No videos yet.</div>';
                return;
            }

            homeGrid.innerHTML = '';
            snapshot.forEach(doc => {
                const video = doc.data();
                const card = document.createElement('div');
                card.className = 'bg-white rounded-lg overflow-hidden shadow-md';
                
                // Create video element
                let mediaContent;
                if (video.thumbnailUrl) {
                    mediaContent = `<img src="${video.thumbnailUrl}" alt="Video thumbnail" class="w-full h-36 object-cover">`;
                } else {
                    mediaContent = `<video src="${video.videoUrl}" class="w-full h-36 object-cover" controls></video>`;
                }
                
                card.innerHTML = `
                    ${mediaContent}
                    <div class="p-3">
                        <p class="text-xs text-gray-700 mb-1">${formatDate(video.uploadDate)}</p>
                        <p class="text-sm text-gray-800">${video.hashtags || 'No hashtags'}</p>
                        ${video.mob ? `<p class="text-xs text-fairlife-blue mt-1">Mob: ${video.mob}</p>` : ''}
                        <span class="inline-block px-2 py-1 text-xs rounded mt-2 ${getStatusClass(video.status)}">${video.status || 'Processing'}</span>
                    </div>
                `;
                
                homeGrid.appendChild(card);
            });
        })
        .catch(error => {
            console.error("Error fetching videos:", error);
            homeGrid.innerHTML = '<div class="col-span-2 text-center p-8 text-gray-500">Error loading videos.</div>';
        });
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
                
                // Create notification item
                item.innerHTML = `
                    <div class="flex items-start space-x-3">
                        <div class="w-20 h-20 bg-gray-100 rounded overflow-hidden">
                            ${video.thumbnailUrl ? 
                                `<img src="${video.thumbnailUrl}" alt="Video thumbnail" class="w-full h-full object-cover">` :
                                `<video src="${video.videoUrl}" class="w-full h-full object-cover" controls></video>`
                            }
                        </div>
                        <div class="flex-1">
                            <div class="flex justify-between items-start">
                                <span class="inline-block px-2 py-1 text-xs rounded ${getStatusClass(video.status)}">${video.status || 'Processing'}</span>
                                <span class="text-xs text-gray-500">${formatDate(video.uploadDate)}</span>
                            </div>
                            <p class="text-sm mt-1">${video.hashtags || 'No hashtags'}</p>
                            ${video.mob ? `<p class="text-xs text-fairlife-blue mt-1">Mob: ${video.mob}</p>` : ''}
                        </div>
                    </div>
                `;
                
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
                if (video.mob) {
                    if (!mobs[video.mob]) {
                        mobs[video.mob] = [];
                    }
                    mobs[video.mob].push({ ...video, id: doc.id });
                }
            });

            if (Object.keys(mobs).length === 0) {
                exploreContainer.innerHTML = '<div class="text-center p-8 text-gray-500">No mobs formed yet. Videos need approval first!</div>';
                return;
            }

            // Display mobs
            exploreContainer.innerHTML = '';
            Object.entries(mobs).forEach(([mob, videos]) => {
                const section = document.createElement('div');
                section.className = 'mb-6';
                
                section.innerHTML = `
                    <h3 class="text-lg font-medium mb-3 fairlife-blue">${mob} <span class="text-sm text-gray-500">(${videos.length})</span></h3>
                    <div class="grid grid-cols-2 gap-3">
                        ${videos.slice(0, 4).map(video => `
                            <div class="bg-white rounded-lg overflow-hidden shadow-sm">
                                ${video.thumbnailUrl ? 
                                    `<img src="${video.thumbnailUrl}" alt="Video thumbnail" class="w-full h-28 object-cover">` :
                                    `<video src="${video.videoUrl}" class="w-full h-28 object-cover" controls></video>`
                                }
                                <div class="p-2">
                                    <p class="text-xs text-gray-700">${video.hashtags || 'No hashtags'}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
                
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

            reviewList.innerHTML = '';
            snapshot.forEach(doc => {
                const video = doc.data();
                const videoId = doc.id;
                
                const item = document.createElement('div');
                item.className = 'bg-white rounded-lg overflow-hidden shadow-md mb-4';
                
                // Create review item
                let mediaContent;
                if (video.thumbnailUrl) {
                    mediaContent = `<img src="${video.thumbnailUrl}" alt="Video thumbnail" class="w-full h-48 object-cover">`;
                } else {
                    mediaContent = `<video src="${video.videoUrl}" class="w-full h-48 object-cover" controls></video>`;
                }
                
                const isReviewable = pendingOnly || video.needsReview;
                const actionButtons = isReviewable ? `
                    <div class="flex space-x-2 mt-3">
                        <button class="approve-btn px-3 py-1.5 bg-fairlife-blue text-white rounded" data-id="${videoId}">Approve</button>
                        <button class="reject-btn px-3 py-1.5 bg-red-500 text-white rounded" data-id="${videoId}">Reject</button>
                        <select class="mob-select px-2 py-1.5 border border-gray-300 rounded bg-white" data-id="${videoId}">
                            <option value="">Select Mob</option>
                            <option value="Dairy Dragons">Dairy Dragons</option>
                            <option value="Milk Masters">Milk Masters</option>
                            <option value="Calcium Crew">Calcium Crew</option>
                            <option value="Lactose Legion">Lactose Legion</option>
                        </select>
                    </div>
                ` : '';
                
                item.innerHTML = `
                    <div class="relative">
                        ${mediaContent}
                        <span class="absolute top-2 right-2 px-2 py-1 text-xs rounded ${getStatusClass(video.status)}">${video.status || 'Processing'}</span>
                    </div>
                    <div class="p-4">
                        <p class="text-gray-600 text-sm">${formatDate(video.uploadDate)}</p>
                        <p class="text-gray-800 mt-1">${video.hashtags || 'No hashtags'}</p>
                        ${video.mob ? `<p class="text-sm text-fairlife-blue mt-1">Mob: ${video.mob}</p>` : ''}
                        ${actionButtons}
                    </div>
                `;
                
                reviewList.appendChild(item);
            });
            
            // Add event listeners for buttons
            document.querySelectorAll('.approve-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    const mobSelect = document.querySelector(`.mob-select[data-id="${id}"]`);
                    const mob = mobSelect ? mobSelect.value : '';
                    
                    if (!mob) {
                        alert('Please select a mob before approving.');
                        return;
                    }
                    
                    approveVideo(id, mob);
                });
            });
            
            document.querySelectorAll('.reject-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    rejectVideo(id);
                });
            });
        })
        .catch(error => {
            console.error("Error fetching videos for review:", error);
            reviewList.innerHTML = '<div class="text-center p-8 text-gray-500">Error loading videos for review.</div>';
        });
}

// Approve video
async function approveVideo(videoId, mob) {
    try {
        console.log(`Approving video ${videoId} for mob ${mob}`);
        
        // Update Firestore
        await db.collection('milk_videos').doc(videoId).update({
            status: 'Approved',
            mob: mob,
            needsReview: false,
            reviewDate: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Notify webhook
        try {
            fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'approve_video',
                    videoId: videoId,
                    mob: mob
                }),
            });
        } catch (webhookError) {
            console.error("Failed to notify webhook of approval:", webhookError);
        }
        
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
        
        // Update Firestore
        await db.collection('milk_videos').doc(videoId).update({
            status: 'Rejected',
            needsReview: false,
            reviewDate: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Notify webhook
        try {
            fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'reject_video',
                    videoId: videoId
                }),
            });
        } catch (webhookError) {
            console.error("Failed to notify webhook of rejection:", webhookError);
        }
        
        // Refresh the view
        const pendingBtn = document.getElementById('pendingReviewBtn');
        renderReviewView(pendingBtn && pendingBtn.classList.contains('bg-fairlife-blue'));
    } catch (error) {
        console.error("Error rejecting video:", error);
        alert("Failed to reject video. Please try again.");
    }
}

// Format date
function formatDate(timestamp) {
    if (!timestamp) return 'Just now';
    
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
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