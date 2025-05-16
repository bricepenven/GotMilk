// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAU3qmsD15JX6iwjloTjCPDd-2SuG6oM8w",
    authDomain: "chokaj-4dcae.firebaseapp.com",
    projectId: "chokaj-4dcae",
    storageBucket: "chokaj-4dcae.appspot.com",
    messagingSenderId: "516228224797",
    appId: "1:516228224797:web:6bdf08edb5962aad5633f4",
    measurementId: "G-9QVCF19J2W"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const storage = firebase.storage();
const db = firebase.firestore();

// N8n webhook URL
const N8N_WEBHOOK_URL = "https://jinthoa.app.n8n.cloud/webhook-test/884e09b7-11b7-4728-b3f7-e909cc9c6b9a";

// State management
let videos = [];
let isModerator = false; // Set to true to see the Review tab

// Load videos from localStorage
function loadVideos() {
    const data = localStorage.getItem('gotmilk_videos');
    if (data) videos = JSON.parse(data);
}

function saveVideos() {
    localStorage.setItem('gotmilk_videos', JSON.stringify(videos));
}

// Initialize app
function initApp() {
    loadVideos();
    updateHomeView();
    updateNotificationsView();
    updateExploreView();
    updateReviewView();
    
    // Show/hide review tab based on moderator status
    const reviewTab = document.getElementById('reviewTab');
    if (isModerator) {
        reviewTab.classList.remove('hidden');
    } else {
        reviewTab.classList.add('hidden');
    }
    
    // Set initial view
    showView('homeView');
}

// Show and hide views
function showView(viewId) {
    document.querySelectorAll('.view').forEach(view => {
        view.classList.add('hidden');
    });
    document.getElementById(viewId).classList.remove('hidden');
    
    // Update active tab
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('text-blue-500', 'border-t-2', 'border-blue-500');
        tab.classList.add('text-gray-500');
    });
    
    const activeTabId = viewId.replace('View', 'Tab');
    const activeTab = document.getElementById(activeTabId);
    if (activeTab) {
        activeTab.classList.remove('text-gray-500');
        activeTab.classList.add('text-blue-500', 'border-t-2', 'border-blue-500');
    }
}

// Handle video upload
async function handleUpload(event) {
    event.preventDefault();
    
    const fileInput = document.getElementById('videoFile');
    const hashtagsInput = document.getElementById('hashtags');
    const uploadBtn = document.getElementById('uploadBtn');
    const uploadStatus = document.getElementById('uploadStatus');
    
    const file = fileInput.files[0];
    const hashtags = hashtagsInput.value.trim();
    
    if (!file) {
        alert('Please select a video file.');
        return;
    }
    
    // Update UI to show processing
    uploadBtn.disabled = true;
    uploadStatus.textContent = 'Uploading...';
    uploadStatus.classList.remove('hidden');
    
    try {
        await uploadVideo(file, hashtags);
        
        // Reset form
        fileInput.value = '';
        hashtagsInput.value = '';
        uploadStatus.textContent = 'Upload complete! Processing video...';
        
        // Show notifications tab with new upload
        showView('notificationsView');
    } catch (error) {
        console.error('Upload failed:', error);
        uploadStatus.textContent = `Upload failed: ${error.message}`;
    } finally {
        uploadBtn.disabled = false;
        setTimeout(() => {
            uploadStatus.classList.add('hidden');
        }, 5000);
    }
}

// Upload video to Firebase
async function uploadVideo(file, hashtags) {
    return new Promise((resolve, reject) => {
        const storageRef = storage.ref(`videos/${file.name}`);
        const uploadTask = storageRef.put(file);

        uploadTask.on('state_changed', 
            (snapshot) => {
                // Handle progress
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                document.getElementById('uploadStatus').textContent = `Uploading: ${Math.round(progress)}%`;
            }, 
            (error) => {
                reject(error);
            }, 
            async () => {
                try {
                    const publicURL = await uploadTask.snapshot.ref.getDownloadURL();
                    
                    // Create a unique ID for this video
                    const videoId = Date.now().toString();
                    
                    // Create video object
                    const video = {
                        id: videoId,
                        url: publicURL,
                        filename: file.name,
                        hashtags,
                        status: 'Processing',
                        thumbnail: '',
                        mob: '',
                        needsReview: false,
                        uploadDate: new Date().toISOString()
                    };
                    
                    // Add to local storage
                    videos.push(video);
                    saveVideos();
                    
                    // Call webhook to process video
                    await submitToWebhook(videoId, publicURL, hashtags);
                    
                    // Update UI
                    updateNotificationsView();
                    resolve(video);
                    
                    // Start checking for updates
                    checkProcessingStatus(videoId);
                } catch (error) {
                    reject(error);
                }
            }
        );
    });
}

// Submit to n8n webhook
async function submitToWebhook(videoId, videoUrl, hashtags) {
    const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'processVideo',
            videoId: videoId,
            videoUrl: videoUrl,
            hashtags: hashtags
        })
    });
    
    if (!response.ok) {
        throw new Error('Failed to submit to webhook');
    }
    
    return await response.json();
}

// Check Firestore for processing status updates
async function checkProcessingStatus(videoId) {
    // Set up listener for this specific video document
    const videoRef = db.collection('milk_videos').doc(videoId);
    
    videoRef.onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            
            // Find this video in our local array
            const index = videos.findIndex(v => v.id === videoId);
            if (index !== -1) {
                // Update local video with Firestore data
                videos[index].status = data.status || videos[index].status;
                videos[index].thumbnail = data.thumbnail_url || videos[index].thumbnail;
                videos[index].mob = data.mob || videos[index].mob;
                videos[index].needsReview = data.needsReview || videos[index].needsReview;
                
                // Save changes
                saveVideos();
                
                // Update UI
                updateHomeView();
                updateNotificationsView();
                updateExploreView();
                updateReviewView();
            }
        }
    });
}

// Update Home view
function updateHomeView() {
    const homeGrid = document.getElementById('homeGrid');
    homeGrid.innerHTML = '';
    
    const approvedVideos = videos.filter(video => video.status === 'Approved');
    
    if (approvedVideos.length === 0) {
        homeGrid.innerHTML = `
            <div class="col-span-2 text-center p-8 text-gray-500">
                No approved videos yet. Upload your milk video to join the challenge!
            </div>
        `;
        return;
    }
    
    approvedVideos.forEach(video => {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-lg overflow-hidden shadow-md';
        
        const thumbnailSrc = video.thumbnail || 'https://via.placeholder.com/320x180?text=Processing...';
        
        card.innerHTML = `
            <div class="relative pb-[56.25%]">
                <img src="${thumbnailSrc}" alt="Video thumbnail" 
                    class="absolute h-full w-full object-cover">
            </div>
            <div class="p-3">
                <p class="text-blue-500 text-sm">${video.hashtags || 'No hashtags'}</p>
                <p class="text-gray-700 text-xs mt-1">Mob: ${video.mob || 'Unassigned'}</p>
            </div>
        `;
        
        homeGrid.appendChild(card);
    });
}

// Update Notifications view
function updateNotificationsView() {
    const notificationsList = document.getElementById('notificationsList');
    notificationsList.innerHTML = '';
    
    if (videos.length === 0) {
        notificationsList.innerHTML = `
            <div class="text-center p-8 text-gray-500">
                No videos uploaded yet. Go to Upload tab to join the challenge!
            </div>
        `;
        return;
    }
    
    // Sort videos by upload date (newest first)
    const sortedVideos = [...videos].sort((a, b) => {
        return new Date(b.uploadDate) - new Date(a.uploadDate);
    });
    
    sortedVideos.forEach(video => {
        const notificationItem = document.createElement('div');
        notificationItem.className = 'border-b border-gray-200 p-4';
        
        // Determine status class for color
        let statusClass = 'text-gray-500';
        if (video.status === 'Approved') statusClass = 'text-green-500';
        if (video.status === 'Rejected') statusClass = 'text-red-500';
        if (video.status === 'Needs Review') statusClass = 'text-yellow-500';
        if (video.status === 'Processing') statusClass = 'text-blue-500';
        
        const thumbnailSrc = video.thumbnail || 'https://via.placeholder.com/80x45?text=Processing...';
        
        notificationItem.innerHTML = `
            <div class="flex items-center">
                <img src="${thumbnailSrc}" alt="Video thumbnail" class="w-20 h-12 object-cover rounded mr-3">
                <div class="flex-1">
                    <p class="text-sm font-medium truncate">${video.filename}</p>
                    <p class="text-xs ${statusClass} font-medium">${video.status}</p>
                    <p class="text-xs text-gray-500">${video.hashtags || 'No hashtags'}</p>
                </div>
            </div>
        `;
        
        notificationsList.appendChild(notificationItem);
    });
}

// Update Explore view
function updateExploreView() {
    const exploreContainer = document.getElementById('exploreContainer');
    exploreContainer.innerHTML = '';
    
    const approvedVideos = videos.filter(video => video.status === 'Approved');
    
    if (approvedVideos.length === 0) {
        exploreContainer.innerHTML = `
            <div class="text-center p-8 text-gray-500">
                No approved videos yet to explore. Upload yours to be the first!
            </div>
        `;
        return;
    }
    
    // Group videos by mob
    const mobGroups = {};
    approvedVideos.forEach(video => {
        const mob = video.mob || 'Unassigned';
        if (!mobGroups[mob]) {
            mobGroups[mob] = [];
        }
        mobGroups[mob].push(video);
    });
    
    // Create a section for each mob
    Object.keys(mobGroups).forEach(mob => {
        const mobSection = document.createElement('div');
        mobSection.className = 'mb-8';
        
        mobSection.innerHTML = `
            <h2 class="text-xl font-bold mb-3 px-4">${mob}</h2>
            <div class="mob-grid grid grid-cols-3 gap-2 px-4"></div>
        `;
        
        const mobGrid = mobSection.querySelector('.mob-grid');
        
        mobGroups[mob].forEach(video => {
            const thumbnailSrc = video.thumbnail || 'https://via.placeholder.com/120x120?text=Processing...';
            
            const videoThumb = document.createElement('div');
            videoThumb.className = 'aspect-square overflow-hidden rounded-md';
            videoThumb.innerHTML = `
                <img src="${thumbnailSrc}" alt="Video thumbnail" class="h-full w-full object-cover">
            `;
            
            mobGrid.appendChild(videoThumb);
        });
        
        exploreContainer.appendChild(mobSection);
    });
}

// Update Review view
function updateReviewView() {
    const reviewList = document.getElementById('reviewList');
    reviewList.innerHTML = '';
    
    const needsReviewVideos = videos.filter(video => video.needsReview && video.status === 'Needs Review');
    
    if (needsReviewVideos.length === 0) {
        reviewList.innerHTML = `
            <div class="text-center p-8 text-gray-500">
                No videos need review at this time.
            </div>
        `;
        return;
    }
    
    needsReviewVideos.forEach(video => {
        const reviewItem = document.createElement('div');
        reviewItem.className = 'border-b border-gray-200 p-4';
        
        const thumbnailSrc = video.thumbnail || 'https://via.placeholder.com/120x68?text=Processing...';
        
        reviewItem.innerHTML = `
            <div class="mb-2">
                <img src="${thumbnailSrc}" alt="Video thumbnail" class="w-full h-32 object-cover rounded">
            </div>
            <div class="mb-3">
                <p class="text-sm font-medium">${video.filename}</p>
                <p class="text-xs text-gray-500">${video.hashtags || 'No hashtags'}</p>
            </div>
            <div class="flex space-x-2">
                <button class="approve-btn bg-green-500 text-white px-4 py-2 rounded text-sm flex-1" 
                    data-video-id="${video.id}">Approve</button>
                <button class="reject-btn bg-red-500 text-white px-4 py-2 rounded text-sm flex-1" 
                    data-video-id="${video.id}">Reject</button>
            </div>
        `;
        
        reviewList.appendChild(reviewItem);
    });
    
    // Add event listeners to approve/reject buttons
    document.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', () => handleReviewAction(btn.dataset.videoId, 'Approved'));
    });
    
    document.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', () => handleReviewAction(btn.dataset.videoId, 'Rejected'));
    });
}

// Handle review action (approve/reject)
async function handleReviewAction(videoId, newStatus) {
    const video = videos.find(v => v.id === videoId);
    if (video) {
        // Update local status
        video.status = newStatus;
        video.needsReview = false;
        
        if (newStatus === 'Approved' && !video.mob) {
            // Assign a default mob if approved
            video.mob = 'Dairy Dragons';
        }
        
        // Save locally
        saveVideos();
        
        // Update Firestore via webhook
        await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'updateVideoStatus',
                videoId: videoId,
                status: newStatus,
                mob: video.mob || 'Dairy Dragons'
            })
        });
        
        // Update UI
        updateHomeView();
        updateNotificationsView();
        updateExploreView();
        updateReviewView();
    }
}

// Initialize when DOM content is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Setup tab navigation
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const viewId = tab.dataset.view;
            showView(viewId);
        });
    });
    
    // Setup upload form
    document.getElementById('uploadForm').addEventListener('submit', handleUpload);
    
    // Initialize the app
    initApp();
});