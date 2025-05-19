import { db } from './api.js';
import { approveVideo, rejectVideo } from './api.js';
import { formatDate, getStatusClass, createVideoThumbnail, preloadThumbnails } from './utils.js';

// Render home view with Instagram-style grid layout
function renderHomeView() {
    console.log("Rendering home view");
    const homeGrid = document.getElementById('homeGrid');
    if (!homeGrid) {
        console.error("Home grid element not found");
        return;
    }
    
    homeGrid.innerHTML = '<div class="col-span-3 text-center p-8 text-gray-500">Loading videos...</div>';

    db.collection('milk_videos')
        .orderBy('uploadDate', 'desc')
        .get()
        .then((snapshot) => {
            console.log(`Found ${snapshot.size} videos`);
            
            if (snapshot.empty) {
                homeGrid.innerHTML = '<div class="col-span-3 text-center p-8 text-gray-500">No videos yet.</div>';
                return;
            }

            const filteredVideos = [];
            snapshot.forEach(doc => {
                const video = doc.data();
                if (video.status !== 'Rejected') {
                    filteredVideos.push({
                        id: doc.id,
                        ...video
                    });
                }
            });
            
            if (filteredVideos.length === 0) {
                homeGrid.innerHTML = '<div class="col-span-3 text-center p-8 text-gray-500">No videos yet.</div>';
                return;
            }

            homeGrid.className = 'grid grid-cols-3 gap-2';
            homeGrid.innerHTML = '';
            
            filteredVideos.forEach(video => {
                const videoId = video.id;
                const card = document.createElement('div');
                card.className = 'aspect-square relative overflow-hidden';
                card.setAttribute('data-video-id', videoId);
                
                let thumbnailUrl = video.thumbnailUrl || '';
                let mediaContent;
                
                if (thumbnailUrl) {
                    mediaContent = `<img src="${thumbnailUrl}" alt="Video thumbnail" class="w-full h-full object-cover">`;
                } else if (video.videoUrl) {
                    mediaContent = createVideoThumbnail(video.videoUrl, videoId);
                } else {
                    mediaContent = `<div class="w-full h-full bg-gray-200 flex items-center justify-center">
                        <span class="text-gray-500">Processing</span>
                    </div>`;
                }
                
                let statusBadge = '';
                if (video.status === 'Approved') {
                    statusBadge = '<span class="absolute top-2 right-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">✓</span>';
                } else if (video.status === 'Pending Review' || video.needsReview) {
                    statusBadge = '<span class="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-full">⌛</span>';
                }
                
                let scoreBadge = '';
                if (typeof video.score === 'number') {
                    scoreBadge = `<span class="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-1.5 py-0.5 rounded-md">${video.score}/100</span>`;
                }
                
                card.innerHTML = `
                    ${mediaContent}
                    ${statusBadge}
                    ${scoreBadge}
                `;
                
                card.addEventListener('click', () => {
                    showVideoDetails(videoId, video);
                });
                
                homeGrid.appendChild(card);
            });
        })
        .catch(error => {
            console.error("Error fetching videos:", error);
            homeGrid.innerHTML = '<div class="col-span-3 text-center p-8 text-gray-500">Error loading videos.</div>';
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
                
                const scoreDisplay = typeof video.score === 'number' 
                    ? `<div class="text-xs font-medium bg-black text-white px-2 py-0.5 rounded ml-2">Score: ${video.score}/100</div>` 
                    : '';
                
                item.innerHTML = `
                    <div class="flex items-start space-x-3">
                        <div class="w-20 h-20 bg-gray-100 rounded overflow-hidden">
                            ${video.thumbnailUrl ? 
                                `<img src="${video.thumbnailUrl}" alt="Video thumbnail" class="w-full h-full object-cover">` :
                                video.videoUrl ?
                                createVideoThumbnail(video.videoUrl, video.id) :
                                `<div class="w-full h-full bg-gray-200 flex items-center justify-center">
                                    <span class="text-gray-500 text-xs">Processing</span>
                                </div>`
                            }
                        </div>
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

    db.collection('milk_videos')
        .where('status', '==', 'Approved')
        .get()
        .then((snapshot) => {
            console.log(`Found ${snapshot.size} approved videos for mobs`);
            
            if (snapshot.empty) {
                exploreContainer.innerHTML = '<div class="text-center p-8 text-gray-500">No mobs formed yet. Videos need approval first!</div>';
                return;
            }

            const mobs = {};
            snapshot.forEach(doc => {
                const video = doc.data();
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

            exploreContainer.innerHTML = '';
            Object.entries(mobs).forEach(([mob, videos]) => {
                const section = document.createElement('div');
                section.className = 'mb-6';
                
                const header = document.createElement('h3');
                header.className = 'text-lg font-medium mb-3 fairlife-blue';
                header.innerHTML = `${mob} <span class="text-sm text-gray-500">(${videos.length})</span>`;
                section.appendChild(header);
                
                const grid = document.createElement('div');
                grid.className = 'grid grid-cols-3 gap-2';
                
                videos.forEach(video => {
                    const card = document.createElement('div');
                    card.className = 'aspect-square relative overflow-hidden';
                    card.setAttribute('data-video-id', video.id);
                    
                    let thumbnailUrl = video.thumbnailUrl || '';
                    let mediaContent;
                    
                    if (thumbnailUrl) {
                        mediaContent = `<img src="${thumbnailUrl}" alt="Video thumbnail" class="w-full h-full object-cover">`;
                    } else if (video.videoUrl) {
                        mediaContent = createVideoThumbnail(video.videoUrl, video.id);
                    } else {
                        mediaContent = `<div class="w-full h-full bg-gray-200 flex items-center justify-center">
                            <span class="text-gray-500">Processing</span>
                        </div>`;
                    }
                    
                    let statusBadge = '';
                    if (video.status === 'Approved') {
                        statusBadge = '<span class="absolute top-2 right-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">✓</span>';
                    }
                    
                    let scoreBadge = '';
                    if (typeof video.score === 'number') {
                        scoreBadge = `<span class="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-1.5 py-0.5 rounded-md">${video.score}/100</span>`;
                    }
                    
                    card.innerHTML = `
                        ${mediaContent}
                        ${statusBadge}
                        ${scoreBadge}
                    `;
                    
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

    let query = db.collection('milk_videos');
    if (pendingOnly) {
        query = query.where('needsReview', '==', true);
    }
    
    query.orderBy('uploadDate', 'desc')
        .get()
        .then((snapshot) => {
            console.log(`Found ${snapshot.size} videos for review`);
            
            if (snapshot.empty) {
                reviewList.innerHTML = '<div class="text-center p-8 text-gray-500">No videos to review at this time.</div>';
                return;
            }

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
                
                let thumbnailUrl = video.thumbnailUrl || '';
                let mediaContent;
                
                if (thumbnailUrl) {
                    mediaContent = `<img src="${thumbnailUrl}" alt="Video thumbnail" class="w-full h-full object-cover">`;
                } else if (video.videoUrl) {
                    mediaContent = createVideoThumbnail(video.videoUrl, videoId);
                } else {
                    mediaContent = `<div class="w-full h-full bg-gray-200 flex items-center justify-center">
                        <span class="text-gray-500">Processing</span>
                    </div>`;
                }
                
                let statusBadge = '';
                if (video.status === 'Approved') {
                    statusBadge = '<span class="absolute top-2 right-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">✓</span>';
                } else if (video.status === 'Pending Review' || video.needsReview) {
                    statusBadge = '<span class="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-full">⌛</span>';
                } else if (video.status === 'Rejected') {
                    statusBadge = '<span class="absolute top-2 right-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">✕</span>';
                }
                
                let scoreBadge = '';
                if (typeof video.score === 'number') {
                    scoreBadge = `<span class="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-1.5 py-0.5 rounded-md">${video.score}/100</span>`;
                }
                
                card.innerHTML = `
                    ${mediaContent}
                    ${statusBadge}
                    ${scoreBadge}
                `;
                
                card.addEventListener('click', () => {
                    showVideoDetailsWithModeration(videoId, video);
                });
                
                grid.appendChild(card);
            });
            
            setTimeout(preloadThumbnails, 300);
        })
        .catch(error => {
            console.error("Error fetching videos for review:", error);
            reviewList.innerHTML = '<div class="text-center p-8 text-gray-500">Error loading videos for review.</div>';
        });
}

// Function to show video details in a modal
function showVideoDetails(videoId, videoData) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50';
    modal.id = 'videoModal';
    
    modal.addEventListener('touchstart', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
    
    let videoElement = '';
    if (videoData.videoUrl) {
        videoElement = `
            <video controls class="max-h-[50vh] max-w-full rounded-lg" preload="auto">
                <source src="${videoData.videoUrl}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        `;
    } else {
        videoElement = `<div class="h-64 w-full bg-gray-200 flex items-center justify-center rounded-lg">Video processing</div>`;
    }
    
    let statusClass = 'bg-gray-100 text-gray-800';
    if (videoData.status === 'Approved') statusClass = 'bg-green-100 text-green-800';
    if (videoData.status === 'Rejected') statusClass = 'bg-red-100 text-red-800';
    if (videoData.status === 'Pending Review') statusClass = 'bg-yellow-100 text-yellow-800';
    
    const scoreDisplay = typeof videoData.score === 'number' 
        ? `<div class="bg-black text-white text-sm font-medium rounded px-2 py-1 ml-2">Score: ${videoData.score}/100</div>` 
        : '';
    
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
    
    document.body.appendChild(modal);
    
    document.getElementById('closeModal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
    
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
    
    const saveButton = document.getElementById('saveMediaName');
    if (saveButton) {
        saveButton.addEventListener('click', async () => {
            const mediaName = document.getElementById('mediaName').value.trim();
            const videoId = saveButton.getAttribute('data-id');
            
            try {
                await db.collection('milk_videos').doc(videoId).update({
                    mediaName: mediaName
                });
                
                const nameDisplay = modal.querySelector('.flex-1.px-3.py-2.bg-gray-100');
                if (nameDisplay) {
                    nameDisplay.innerHTML = `
                        ${mediaName || videoData.originalFileName || 'Unknown'}
                        <div class="text-xs text-gray-500 mt-1">Original: ${videoData.originalFileName || 'Unknown'}</div>
                    `;
                }
                
                videoData.mediaName = mediaName;
                
                saveButton.textContent = "Saved!";
                saveButton.classList.add('bg-green-500');
                
                setTimeout(() => {
                    saveButton.textContent = "Save";
                    saveButton.classList.remove('bg-green-500');
                    
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

// Function to show video details with moderation options
function showVideoDetailsWithModeration(videoId, videoData) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50';
    modal.id = 'videoModal';
    
    let videoElement = '';
    if (videoData.videoUrl) {
        videoElement = `
            <video controls class="max-h-[50vh] max-w-full rounded-lg">
                <source src="${videoData.videoUrl}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        `;
    } else {
        videoElement = `<div class="h-64 w-full bg-gray-200 flex items-center justify-center rounded-lg">Video processing</div>`;
    }
    
    let statusClass = 'bg-gray-100 text-gray-800';
    if (videoData.status === 'Approved') statusClass = 'bg-green-100 text-green-800';
    if (videoData.status === 'Rejected') statusClass = 'bg-red-100 text-red-800';
    if (videoData.status === 'Pending Review') statusClass = 'bg-yellow-100 text-yellow-800';
    
    const scoreDisplay = typeof videoData.score === 'number' 
        ? `<div class="bg-black text-white text-sm font-medium rounded px-2 py-1 ml-2">Score: ${videoData.score}/100</div>` 
        : '';
    
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
                    
                    <div class="grid grid-cols-2 gap-2 mb-3">
                        <div>
                            <p class="text-sm text-gray-800 mb-1"><strong>Upload Date:</strong> ${formatDate(videoData.uploadDate, true)}</p>
                            <p class="text-sm text-gray-800 mb-1"><strong>Hashtags:</strong> ${videoData.hashtags || 'None'}</p>
                        </div>
                        <div>
                            ${videoData.recommendedMob ? `<p class="text-sm text-fairlife-blue mb-1"><strong>Milk Mob:</strong> ${videoData.recommendedMob}</p>` : ''}
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
    
    document.body.appendChild(modal);
    
    document.getElementById('closeModal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
    
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
    
    const saveButton = document.getElementById('saveMediaName');
    if (saveButton) {
        saveButton.addEventListener('click', async () => {
            const mediaName = document.getElementById('mediaName').value.trim();
            
            try {
                await db.collection('milk_videos').doc(videoId).update({
                    mediaName: mediaName
                });
                
                const nameDisplay = modal.querySelector('.flex-1.px-3.py-2.bg-gray-100');
                if (nameDisplay) {
                    nameDisplay.innerHTML = `
                        ${mediaName || videoData.originalFileName || 'Unknown'}
                        <div class="text-xs text-gray-500 mt-1">Original: ${videoData.originalFileName || 'Unknown'}</div>
                    `;
                }
                
                videoData.mediaName = mediaName;
                
                saveButton.textContent = "Saved!";
                saveButton.classList.add('bg-green-500');
                
                setTimeout(() => {
                    saveButton.textContent = "Save";
                    saveButton.classList.remove('bg-green-500');
                    
                    document.getElementById('mediaNameEditForm').classList.add('hidden');
                    document.getElementById('editMediaNameBtn').textContent = "Edit";
                }, 2000);
                
            } catch (error) {
                console.error("Error saving media name:", error);
                alert("Failed to save media name. Please try again.");
            }
        });
    }
    
    const approveBtn = document.getElementById('approveBtn');
    if (approveBtn) {
        approveBtn.addEventListener('click', async () => {
            const mob = videoData.recommendedMob || "General";
            
            try {
                await approveVideo(videoId, mob);
                
                const statusBadge = modal.querySelector('.inline-block.px-2.py-1.text-xs.rounded');
                if (statusBadge) {
                    statusBadge.className = 'inline-block px-2 py-1 text-xs rounded bg-green-100 text-green-800';
                    statusBadge.textContent = 'Approved';
                }
                
                approveBtn.classList.add('opacity-50');
                document.getElementById('rejectBtn').classList.remove('opacity-50');
                
                videoData.status = 'Approved';
                videoData.mob = mob;
                
            } catch (error) {
                console.error("Error approving video:", error);
                alert("Failed to approve video. Please try again.");
            }
        });
    }
    
    const rejectBtn = document.getElementById('rejectBtn');
    if (rejectBtn) {
        rejectBtn.addEventListener('click', async () => {
            try {
                await rejectVideo(videoId);
                
                const statusBadge = modal.querySelector('.inline-block.px-2.py-1.text-xs.rounded');
                if (statusBadge) {
                    statusBadge.className = 'inline-block px-2 py-1 text-xs rounded bg-red-100 text-red-800';
                    statusBadge.textContent = 'Rejected';
                }
                
                rejectBtn.classList.add('opacity-50');
                document.getElementById('approveBtn').classList.remove('opacity-50');
                
                videoData.status = 'Rejected';
                
            } catch (error) {
                console.error("Error rejecting video:", error);
                alert("Failed to reject video. Please try again.");
            }
        });
    }
}

export { renderHomeView, renderNotificationsView, renderExploreView, renderReviewView, showVideoDetails, showVideoDetailsWithModeration };
