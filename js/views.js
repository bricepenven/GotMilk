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

    // Get device type from app.js
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    console.log(`Rendering home view for ${isMobile ? 'mobile' : 'desktop'} device ${isIOS ? '(iOS)' : ''}`);
    
    // Increase the limit for mobile to ensure more videos are loaded
    const queryLimit = isMobile ? 15 : 20;
    
    db.collection('milk_videos')
        .orderBy('uploadDate', 'desc')
        .limit(queryLimit)
        .get()
        .then((snapshot) => {
            console.log(`Found ${snapshot.size} videos (limited to ${queryLimit})`);
            
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

            // Clear previous content
            homeGrid.innerHTML = '';
            
            // CRITICAL FIX: Use a simple direct approach rather than complex containers
            // Create the grid directly without scrollable containers - let page native scrolling handle it
            homeGrid.className = 'grid grid-cols-3 gap-2 pb-20 w-full'; // Add padding for tab bar
            
            console.log(`Rendering ${filteredVideos.length} videos for ${isMobile ? 'mobile' : 'desktop'} ${isIOS ? '(iOS)' : ''}`);
            
            filteredVideos.forEach(video => {
                const videoId = video.id;
                const card = document.createElement('div');
                card.className = 'aspect-square relative overflow-hidden';
                card.setAttribute('data-video-id', videoId);
                
                let thumbnailUrl = video.thumbnailUrl || '';
                let mediaContent;
                
                if (thumbnailUrl) {
                    mediaContent = createVideoThumbnail(video.videoUrl, videoId, thumbnailUrl);
                } else if (video.videoUrl) {
                    mediaContent = createVideoThumbnail(video.videoUrl, videoId, video.thumbnailUrl);
                } else {
                    // Fallback for processing videos
                    mediaContent = `<div class="w-full h-full flex items-center justify-center bg-gray-200">
                        <span class="text-gray-500 text-xs">Processing</span>
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
                    scoreBadge = `<span class="absolute bottom-1 right-1 bg-black bg-opacity-70 text-white text-xs px-1 py-0.5 rounded">${video.score}/100</span>`;
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
            
            // Add a small debug element to show total videos
            const debugElement = document.createElement('div');
            debugElement.className = 'col-span-3 text-xs text-gray-500 text-center my-2';
            debugElement.textContent = `Displaying ${filteredVideos.length} videos`;
            homeGrid.appendChild(debugElement);
            
            // Load thumbnails after rendering
            setTimeout(preloadThumbnails, 300);
            
            // Add load more button if there might be more videos
            if (filteredVideos.length === queryLimit) {
                const loadMoreContainer = document.createElement('div');
                loadMoreContainer.className = 'col-span-3 flex justify-center p-3 mb-4';
                
                const loadMoreBtn = document.createElement('button');
                loadMoreBtn.className = 'px-4 py-2 bg-fairlife-blue text-white rounded-md';
                loadMoreBtn.textContent = 'Load More';
                loadMoreBtn.addEventListener('click', () => {
                    const lastVideo = filteredVideos[filteredVideos.length - 1];
                    if (lastVideo && lastVideo.uploadDate) {
                        loadMoreVideos(lastVideo.uploadDate, homeGrid);
                    }
                });
                
                loadMoreContainer.appendChild(loadMoreBtn);
                homeGrid.appendChild(loadMoreContainer);
            }
            
            // FIX MENU NAVIGATION: Make sure menu tabs are visible and clickable
            // This fixes the menu by restoring normal page flow and ensuring the tabs are visible
            const menuContainer = document.querySelector('.tab-bar') || document.querySelector('nav');
            if (menuContainer) {
                menuContainer.style.position = 'fixed';
                menuContainer.style.bottom = '0';
                menuContainer.style.left = '0';
                menuContainer.style.right = '0';
                menuContainer.style.zIndex = '50';
                menuContainer.style.backgroundColor = 'white';
                menuContainer.style.borderTop = '1px solid #e5e7eb';
            }
        })
        .catch(error => {
            console.error("Error fetching videos:", error);
            homeGrid.innerHTML = '<div class="col-span-3 text-center p-8 text-gray-500">Error loading videos.</div>';
        });
}

// Helper function to load more videos (pagination)
function loadMoreVideos(lastTimestamp, gridElement) {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const queryLimit = isMobile ? 9 : 15;
    
    // Replace Load More button with loading indicator
    const loadMoreContainer = gridElement.querySelector('div.col-span-3.flex.justify-center');
    if (loadMoreContainer) {
        loadMoreContainer.innerHTML = '<div class="text-center px-4 py-2">Loading...</div>';
    }
    
    db.collection('milk_videos')
        .orderBy('uploadDate', 'desc')
        .startAfter(lastTimestamp)
        .limit(queryLimit)
        .get()
        .then((snapshot) => {
            // Remove loading indicator
            if (loadMoreContainer) {
                loadMoreContainer.remove();
            }
            
            if (snapshot.empty) {
                const noMoreContainer = document.createElement('div');
                noMoreContainer.className = 'col-span-3 text-center p-3 text-gray-500';
                noMoreContainer.textContent = 'No more videos to load';
                gridElement.appendChild(noMoreContainer);
                return;
            }

            const additionalVideos = [];
            snapshot.forEach(doc => {
                const video = doc.data();
                if (video.status !== 'Rejected') {
                    additionalVideos.push({
                        id: doc.id,
                        ...video
                    });
                }
            });
            
            additionalVideos.forEach(video => {
                const videoId = video.id;
                const card = document.createElement('div');
                card.className = 'aspect-square relative overflow-hidden';
                card.setAttribute('data-video-id', videoId);
                
                let thumbnailUrl = video.thumbnailUrl || '';
                let mediaContent;
                
                if (thumbnailUrl) {
                    mediaContent = createVideoThumbnail(video.videoUrl, videoId, thumbnailUrl);
                } else if (video.videoUrl) {
                    mediaContent = createVideoThumbnail(video.videoUrl, videoId, video.thumbnailUrl);
                } else {
                    mediaContent = `<div class="w-full h-full flex items-center justify-center bg-gray-200">
                        <span class="text-gray-500 text-xs">Processing</span>
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
                    scoreBadge = `<span class="absolute bottom-1 right-1 bg-black bg-opacity-70 text-white text-xs px-1 py-0.5 rounded">${video.score}/100</span>`;
                }
                
                card.innerHTML = `
                    ${mediaContent}
                    ${statusBadge}
                    ${scoreBadge}
                `;
                
                card.addEventListener('click', () => {
                    showVideoDetails(videoId, video);
                });
                
                gridElement.appendChild(card);
            });
            
            // Load thumbnails for new content
            setTimeout(preloadThumbnails, 300);
            
            // Add load more button if there might be more videos
            if (additionalVideos.length === queryLimit) {
                const newLoadMoreContainer = document.createElement('div');
                newLoadMoreContainer.className = 'col-span-3 flex justify-center p-3';
                
                const loadMoreBtn = document.createElement('button');
                loadMoreBtn.className = 'px-4 py-2 bg-fairlife-blue text-white rounded-md';
                loadMoreBtn.textContent = 'Load More';
                loadMoreBtn.addEventListener('click', () => {
                    const lastVideo = additionalVideos[additionalVideos.length - 1];
                    if (lastVideo && lastVideo.uploadDate) {
                        loadMoreVideos(lastVideo.uploadDate, gridElement);
                    }
                });
                
                newLoadMoreContainer.appendChild(loadMoreBtn);
                gridElement.appendChild(newLoadMoreContainer);
            }
        })
        .catch(error => {
            console.error("Error loading more videos:", error);
            if (loadMoreContainer) {
                loadMoreContainer.innerHTML = '<div class="text-center px-4 py-2 text-red-500">Failed to load more videos</div>';
            }
        });
}

// Render notifications view (user's own videos)
function renderNotificationsView() {
    // Same structure as before but with the same direct rendering approach
    console.log("Rendering notifications view");
    const notificationsList = document.getElementById('notificationsList');
    if (!notificationsList) {
        console.error("Notifications list element not found");
        return;
    }
    
    notificationsList.innerHTML = '<div class="text-center p-8 text-gray-500">Loading your videos...</div>';

    // Limit initial query to improve performance on mobile
    db.collection('milk_videos')
        .orderBy('uploadDate', 'desc')
        .limit(10) // Limit to 10 videos initially
        .get()
        .then((snapshot) => {
            console.log(`Found ${snapshot.size} videos for notifications (limited query)`);
            
            if (snapshot.empty) {
                notificationsList.innerHTML = '<div class="text-center p-8 text-gray-500">You haven\'t uploaded any videos yet.</div>';
                return;
            }

            notificationsList.innerHTML = '';
            
            // Add a container to ensure proper spacing at the bottom for the menu
            notificationsList.className = 'pb-20'; // Add padding for tab bar
            
            snapshot.forEach(doc => {
                const video = doc.data();
                const item = document.createElement('div');
                item.className = 'border-b border-gray-200 p-4';
                item.setAttribute('data-video-id', doc.id);
                
                const scoreDisplay = typeof video.score === 'number' 
                    ? `<div class="text-xs bg-black text-white px-1.5 py-0.5 rounded ml-2">Score: ${video.score}/100</div>` 
                    : '';
                
                item.innerHTML = `
                    <div class="flex items-start space-x-3">
                        <div class="w-20 h-20 bg-gray-100 rounded overflow-hidden">
                            ${video.thumbnailUrl ? 
                                createVideoThumbnail(video.videoUrl, video.id, video.thumbnailUrl) :
                                video.videoUrl ?
                                createVideoThumbnail(video.videoUrl, video.id, video.thumbnailUrl) :
                                `<div class="w-full h-full flex items-center justify-center bg-gray-200">
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

    // Get device type
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Adjust limit based on device type
    const queryLimit = isMobile ? 8 : 15;
    
    db.collection('milk_videos')
        .where('status', '==', 'Approved')
        .limit(queryLimit)
        .get()
        .then((snapshot) => {
            console.log(`Found ${snapshot.size} approved videos for mobs (limited to ${queryLimit})`);
            
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
            exploreContainer.className = 'pb-20'; // Add padding for tab bar
            
            // Force "Milk Masters" to appear first before "Lactose Lookouts"
            const mobOrder = {
                "Milk Masters": -2,
                "Milk Master": -2, // Include both variants
                "Lactose Lookouts": -1
            };
            
            const sortedMobs = Object.entries(mobs).sort(([mobNameA], [mobNameB]) => {
                const orderA = mobOrder[mobNameA] || 0;
                const orderB = mobOrder[mobNameB] || 0;
                
                if (orderA !== orderB) {
                    return orderA - orderB;
                }
                
                return mobNameA.localeCompare(mobNameB);
            });
            
            sortedMobs.forEach(([mob, videos]) => {
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
                        mediaContent = createVideoThumbnail(video.videoUrl, video.id, thumbnailUrl);
                    } else if (video.videoUrl) {
                        mediaContent = createVideoThumbnail(video.videoUrl, video.id, video.thumbnailUrl);
                    } else {
                        // Fallback for processing videos
                        mediaContent = `<div class="w-full h-full flex items-center justify-center bg-gray-200">
                            <span class="text-gray-500 text-xs">Processing</span>
                        </div>`;
                    }
                    
                    let statusBadge = '';
                    if (video.status === 'Approved') {
                        statusBadge = '<span class="absolute top-2 right-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">✓</span>';
                    }
                    
                    let scoreBadge = '';
                    if (typeof video.score === 'number') {
                        scoreBadge = `<span class="absolute bottom-1 right-1 bg-black bg-opacity-70 text-white text-xs px-1 py-0.5 rounded">${video.score}/100</span>`;
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
        .limit(12) // Limit to 12 videos for review
        .get()
        .then((snapshot) => {
            console.log(`Found ${snapshot.size} videos for review (limited query)`);
            
            if (snapshot.empty) {
                reviewList.innerHTML = '<div class="text-center p-8 text-gray-500">No videos to review at this time.</div>';
                return;
            }

            reviewList.innerHTML = '';
            reviewList.className = 'pb-20'; // Add padding for tab bar
            
            const grid = document.createElement('div');
            grid.className = 'grid grid-cols-3 gap-3';
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
                    mediaContent = createVideoThumbnail(video.videoUrl, videoId, thumbnailUrl);
                } else if (video.videoUrl) {
                    mediaContent = createVideoThumbnail(video.videoUrl, videoId, video.thumbnailUrl);
                } else {
                    // Fallback for processing videos
                    mediaContent = `<div class="w-full h-full flex items-center justify-center bg-gray-200">
                        <span class="text-gray-500 text-xs">Processing</span>
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
                    scoreBadge = `<span class="absolute bottom-1 right-1 bg-black bg-opacity-70 text-white text-xs px-1 py-0.5 rounded">${video.score}/100</span>`;
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
    modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto';
    modal.id = 'videoModal';
    
    // Add iOS-specific touch handling
    modal.addEventListener('touchstart', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
    
    let videoElement = '';
    if (videoData.videoUrl) {
        videoElement = `
            <div class="flex justify-center">
                <video controls playsinline class="max-h-[25vh] max-w-full rounded-lg object-contain" preload="auto">
                    <source src="${videoData.videoUrl}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
            </div>
        `;
    } else {
        videoElement = `<div class="h-64 w-full bg-gray-200 flex items-center justify-center rounded-lg">Video processing</div>`;
    }
    
    let statusClass = 'bg-gray-100 text-gray-800';
    if (videoData.status === 'Approved') statusClass = 'bg-green-100 text-green-800';
    if (videoData.status === 'Rejected') statusClass = 'bg-red-100 text-red-800';
    if (videoData.status === 'Pending Review') statusClass = 'bg-yellow-100 text-yellow-800';
    
    const scoreDisplay = typeof videoData.score === 'number' 
        ? `<span class="inline-block px-2 py-1 text-xs rounded-md bg-black text-white">Score: ${videoData.score}/100</span>` 
        : '';
    
    // Use my-8 instead of my-4 to add more vertical margin on mobile
    // Decrease max-height to ensure it fits on mobile screens
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-xs w-full mx-auto my-8 md:my-4 overflow-auto max-h-[80vh] md:max-h-[85vh]">
            <div class="p-3 border-b sticky top-0 bg-white z-10">
                <div class="flex justify-between items-center">
                    <h3 class="text-base font-medium">Video Details</h3>
                    <button id="closeModal" class="text-gray-500 hover:text-gray-700 p-2" style="min-width: 44px; min-height: 44px;" aria-label="Close modal">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
            
            <div class="p-3">
                ${videoElement}
                
                <div class="mt-4">
                    <div class="flex items-center mb-2">
                        <span class="inline-block px-2 py-1 text-xs rounded ${statusClass}">${videoData.status || 'Processing'}</span>
                        ${scoreDisplay}
                    </div>
                    
                    <div class="grid grid-cols-2 gap-1 mb-2">
                        <div>
                            <p class="text-sm text-gray-800 mb-1"><strong>Upload Date:</strong> ${formatDate(videoData.uploadDate, true)}</p>
                            <p class="text-sm text-gray-800 mb-1"><strong>Hashtags:</strong> ${videoData.hashtags || 'None'}</p>
                        </div>
                        <div>
                            ${videoData.recommendedMob ? `<p class="text-sm text-fairlife-blue mb-1"><strong>Milk Mob:</strong> ${videoData.recommendedMob}</p>` : ''}
                        </div>
                    </div>
                    
                    <div class="mb-2">
                        <div class="block text-sm font-medium text-gray-700 mb-1">Media Name</div>
                        <div class="flex items-center space-x-2 mb-2">
                            <div class="flex-1 px-3 py-2 bg-gray-100 rounded-md text-gray-700 text-sm overflow-hidden text-ellipsis">
                                ${videoData.mediaName || videoData.originalFileName || 'Unknown'}
                                ${videoData.mediaName ? 
                                    `<div class="text-xs text-gray-500 mt-1">Original: ${videoData.originalFileName || 'Unknown'}</div>` : 
                                    ''}
                            </div>
                            <button id="editMediaNameBtn" aria-label="Edit media name" class="bg-gray-200 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-300">
                                Edit
                            </button>
                        </div>
                        
                        <div id="mediaNameEditForm" class="hidden">
                            <label for="mediaName-${videoId}" class="block text-sm font-medium text-gray-700 mb-1">Custom Media Name</label>
                            <div class="flex space-x-2">
                                <input type="text" id="mediaName-${videoId}" class="flex-1 px-3 py-2 border border-gray-300 rounded-md" 
                                    value="${videoData.mediaName || ''}" placeholder="Enter a custom name for this media">
                                <button id="saveMediaName" aria-label="Save media name" class="bg-fairlife-blue text-white px-3 py-2 rounded-md" data-id="${videoId}">Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="p-5 mt-2">
                <!-- Increased padding at the bottom to ensure all content is visible -->
            </div>
        </div>
    `;
    
    // Calculate and set proper modal height based on device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        document.body.style.overflow = 'hidden'; // Prevent body scrolling on mobile
        
        // After appending to DOM, adjust position if needed on mobile
        setTimeout(() => {
            const modalContent = modal.querySelector('.bg-white');
            if (modalContent) {
                // Check if content exceeds viewport height
                if (modalContent.offsetHeight > window.innerHeight * 0.9) {
                    modalContent.style.height = '80vh';
                    modalContent.style.overflowY = 'auto';
                }
            }
        }, 50);
    }
    
    document.body.appendChild(modal);
    
    document.getElementById('closeModal').addEventListener('click', () => {
        document.body.style.overflow = ''; // Restore scrolling
        document.body.removeChild(modal);
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.style.overflow = ''; // Restore scrolling
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
            const videoId = saveButton.getAttribute('data-id');
            const mediaName = document.getElementById(`mediaName-${videoId}`).value.trim();
            
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
    modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto';
    modal.id = 'videoModal';
    
    // Add iOS-specific touch handling
    modal.addEventListener('touchstart', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
    
    let videoElement = '';
    if (videoData.videoUrl) {
        videoElement = `
            <div class="flex justify-center">
                <video controls playsinline class="max-h-[25vh] max-w-full rounded-lg object-contain" preload="auto">
                    <source src="${videoData.videoUrl}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
            </div>
        `;
    } else {
        videoElement = `<div class="h-64 w-full bg-gray-200 flex items-center justify-center rounded-lg">Video processing</div>`;
    }
    
    let statusClass = 'bg-gray-100 text-gray-800';
    if (videoData.status === 'Approved') statusClass = 'bg-green-100 text-green-800';
    if (videoData.status === 'Rejected') statusClass = 'bg-red-100 text-red-800';
    if (videoData.status === 'Pending Review') statusClass = 'bg-yellow-100 text-yellow-800';
    
    // Fixed score display to match styling and size of the buttons
    const scoreDisplay = typeof videoData.score === 'number' 
        ? `<div class="px-3 py-1 bg-gray-800 text-white rounded text-sm">Score: ${videoData.score}/100</div>` 
        : '';
    
    // Use my-8 instead of my-4 to add more vertical margin on mobile
    // Decrease max-height to ensure it fits on mobile screens
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-xs w-full mx-auto my-8 md:my-4 overflow-auto max-h-[80vh] md:max-h-[85vh]">
            <div class="p-3 border-b bg-white sticky top-0 z-10">
                <div class="flex justify-between items-center">
                    <h3 class="text-base font-medium">Moderate Video</h3>
                    <button id="closeModal" class="text-gray-500 hover:text-gray-700 p-2" style="min-width: 44px; min-height: 44px;" aria-label="Close modal">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
            
            <div class="p-3">
                ${videoElement}
                
                <div class="mt-4">
                    <div class="flex flex-col space-y-3 mb-3">
                        <div class="flex items-center">
                            <span class="inline-block px-2 py-1 text-xs rounded ${statusClass}">${videoData.status || 'Processing'}</span>
                        </div>
                        
                        <div class="flex justify-between items-center space-x-2">
                            ${scoreDisplay}
                            <div class="flex space-x-2">
                                <button id="approveBtn" class="px-3 py-1 bg-fairlife-blue text-white rounded text-sm ${videoData.status === 'Approved' ? 'opacity-50' : ''}">
                                    Approve
                                </button>
                                <button id="rejectBtn" class="px-3 py-1 bg-red-500 text-white rounded text-sm ${videoData.status === 'Rejected' ? 'opacity-50' : ''}">
                                    Reject
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-1 mb-2">
                        <div>
                            <p class="text-sm text-gray-800 mb-1"><strong>Upload Date:</strong> ${formatDate(videoData.uploadDate, true)}</p>
                            <p class="text-sm text-gray-800 mb-1"><strong>Hashtags:</strong> ${videoData.hashtags || 'None'}</p>
                        </div>
                        <div>
                            ${videoData.recommendedMob ? `<p class="text-sm text-fairlife-blue mb-1"><strong>Milk Mob:</strong> ${videoData.recommendedMob}</p>` : ''}
                        </div>
                    </div>
                    
                    <div class="mb-2">
                        <div class="block text-sm font-medium text-gray-700 mb-1">Media Name</div>
                        <div class="flex items-center space-x-2 mb-2">
                            <div class="flex-1 px-3 py-2 bg-gray-100 rounded-md text-gray-700 text-sm overflow-hidden text-ellipsis">
                                ${videoData.mediaName || videoData.originalFileName || 'Unknown'}
                                ${videoData.mediaName ? 
                                    `<div class="text-xs text-gray-500 mt-1">Original: ${videoData.originalFileName || 'Unknown'}</div>` : 
                                    ''}
                            </div>
                            <button id="editMediaNameBtn" aria-label="Edit media name" class="bg-gray-200 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-300">
                                Edit
                            </button>
                        </div>
                        
                        <div id="mediaNameEditForm" class="hidden">
                            <label for="mediaName-${videoId}" class="block text-sm font-medium text-gray-700 mb-1">Custom Media Name</label>
                            <div class="flex space-x-2">
                                <input type="text" id="mediaName-${videoId}" class="flex-1 px-3 py-2 border border-gray-300 rounded-md" 
                                    value="${videoData.mediaName || ''}" placeholder="Enter a custom name for this media">
                                <button id="saveMediaName" aria-label="Save media name" class="bg-fairlife-blue text-white px-3 py-2 rounded-md" data-id="${videoId}">Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="p-5 mt-2">
                <!-- Increased padding at the bottom to ensure all content is visible -->
            </div>
        </div>
    `;
    
    // Calculate and set proper modal height based on device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        document.body.style.overflow = 'hidden'; // Prevent body scrolling on mobile
        
        // After appending to DOM, adjust position if needed on mobile
        setTimeout(() => {
            const modalContent = modal.querySelector('.bg-white');
            if (modalContent) {
                // Check if content exceeds viewport height
                if (modalContent.offsetHeight > window.innerHeight * 0.9) {
                    modalContent.style.height = '80vh';
                    modalContent.style.overflowY = 'auto';
                }
            }
        }, 50);
    }
    
    document.body.appendChild(modal);
    
    document.getElementById('closeModal').addEventListener('click', () => {
        document.body.style.overflow = ''; // Restore scrolling
        document.body.removeChild(modal);
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.style.overflow = ''; // Restore scrolling
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
            const videoId = saveButton.getAttribute('data-id');
            const mediaName = document.getElementById(`mediaName-${videoId}`).value.trim();
            
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

// Initialize application on load
document.addEventListener('DOMContentLoaded', () => {
    // Fix menu navigation - make sure menu tabs are always visible and clickable
    const menuContainer = document.querySelector('.tab-bar') || document.querySelector('nav');
    if (menuContainer) {
        menuContainer.style.position = 'fixed';
        menuContainer.style.bottom = '0';
        menuContainer.style.left = '0';
        menuContainer.style.right = '0';
        menuContainer.style.zIndex = '50';
        menuContainer.style.backgroundColor = 'white';
        menuContainer.style.borderTop = '1px solid #e5e7eb';
    }
});

export { renderHomeView, renderNotificationsView, renderExploreView, renderReviewView, showVideoDetails, showVideoDetailsWithModeration };