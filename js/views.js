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

    // --- START: Setup main layout structure for homeGrid ---
    homeGrid.innerHTML = ''; // Clear any previous content or structure

    // Configure homeGrid to be a flex container that defines the view's boundaries
    homeGrid.style.display = 'flex';
    homeGrid.style.flexDirection = 'column';
    // This height calculation assumes '120px' accounts for a header and bottom tab bar.
    // Adjust if your header/tab bar height is different.
    homeGrid.style.height = 'calc(100vh - 120px)'; 
    homeGrid.style.overflow = 'hidden'; // homeGrid itself doesn't scroll, scrollContainer will.

    // Create a scrollable container that fills available space within homeGrid
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'w-full overflow-y-auto flex-grow'; // flex-grow allows it to fill homeGrid
    scrollContainer.style.WebkitOverflowScrolling = 'touch'; // For smooth scrolling on iOS
    homeGrid.appendChild(scrollContainer);

    // Create the grid inside the scroll container
    const grid = document.createElement('div');
    // pb-16 provides padding at the bottom of the scrollable content, so items aren't hidden by a tab bar.
    grid.className = 'grid grid-cols-3 gap-2 w-full pb-16'; 
    // Set initial loading message within the grid structure
    grid.innerHTML = '<div class="col-span-3 text-center p-8 text-gray-500">Loading videos...</div>';
    scrollContainer.appendChild(grid);
    // --- END: Setup main layout structure ---

    // Get device type from app.js (navigator.userAgent is standard)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent); // Currently only used for logging here
    console.log(`Rendering home view for ${isMobile ? 'mobile' : 'desktop'} device ${isIOS ? '(iOS)' : ''}`);
    
    // Increase the limit for mobile to ensure more videos are loaded
    const queryLimit = isMobile ? 15 : 20;
    
    db.collection('milk_videos')
        .orderBy('uploadDate', 'desc')
        .limit(queryLimit)
        .get()
        .then((snapshot) => {
            console.log(`Found ${snapshot.size} videos (limited to ${queryLimit})`);
            
            const filteredVideos = [];
            if (!snapshot.empty) {
                snapshot.forEach(doc => {
                    const video = doc.data();
                    if (video.status !== 'Rejected') {
                        filteredVideos.push({
                            id: doc.id,
                            ...video
                        });
                    }
                });
            }
            
            if (filteredVideos.length === 0) {
                // Update the grid content to "No videos"
                grid.innerHTML = '<div class="col-span-3 text-center p-8 text-gray-500">No videos yet.</div>';
                return;
            }

            // Clear "Loading..." message from grid before adding video cards
            grid.innerHTML = '';
            
            console.log(`Rendering ${filteredVideos.length} videos for ${isMobile ? 'mobile' : 'desktop'}`);
            
            filteredVideos.forEach(video => {
                const videoId = video.id;
                const card = document.createElement('div');
                card.className = 'aspect-square relative overflow-hidden';
                card.setAttribute('data-video-id', videoId);
                
                let thumbnailUrl = video.thumbnailUrl || '';
                let mediaContent;
                
                // Use createVideoThumbnail consistently
                if (video.videoUrl) { // Check videoUrl first as it's essential for the thumbnail function
                    mediaContent = createVideoThumbnail(video.videoUrl, videoId, thumbnailUrl);
                } else {
                    // Fallback for processing videos or videos without URLs
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
                
                grid.appendChild(card);
            });
            
            // Add a small debug element to show total videos
            const debugElement = document.createElement('div');
            debugElement.className = 'col-span-3 text-xs text-gray-500 text-center my-2';
            debugElement.textContent = `Displaying ${filteredVideos.length} videos`;
            grid.appendChild(debugElement);
            
            // Load thumbnails after rendering
            setTimeout(preloadThumbnails, 300);
            
            // Add load more button if there might be more videos
            if (filteredVideos.length === queryLimit) {
                const loadMoreContainer = document.createElement('div');
                loadMoreContainer.className = 'col-span-3 flex justify-center p-3 mb-4'; // mb-4 to give some space if it's the last item
                
                const loadMoreBtn = document.createElement('button');
                loadMoreBtn.className = 'px-4 py-2 bg-fairlife-blue text-white rounded-md';
                loadMoreBtn.textContent = 'Load More';
                loadMoreBtn.addEventListener('click', () => {
                    const lastVideo = filteredVideos[filteredVideos.length - 1];
                    if (lastVideo && lastVideo.uploadDate) {
                        loadMoreVideos(lastVideo.uploadDate, grid); // Pass the 'grid' element
                    }
                });
                
                loadMoreContainer.appendChild(loadMoreBtn);
                grid.appendChild(loadMoreContainer);
            }
        })
        .catch(error => {
            console.error("Error fetching videos:", error);
            // Update the grid content to error message
            grid.innerHTML = '<div class="col-span-3 text-center p-8 text-gray-500">Error loading videos.</div>';
        });
}

// Helper function to load more videos (pagination)
function loadMoreVideos(lastTimestamp, gridElement) { // gridElement is the direct parent of video cards
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const queryLimit = isMobile ? 9 : 15;
    
    // Replace Load More button with loading indicator
    const loadMoreButtonContainer = gridElement.querySelector('div.col-span-3.flex.justify-center');
    if (loadMoreButtonContainer) {
        loadMoreButtonContainer.innerHTML = '<div class="text-center px-4 py-2 text-gray-500">Loading...</div>';
    }
    
    db.collection('milk_videos')
        .orderBy('uploadDate', 'desc')
        .startAfter(lastTimestamp)
        .limit(queryLimit)
        .get()
        .then((snapshot) => {
            // Remove loading indicator (or the old load more button container)
            if (loadMoreButtonContainer) {
                loadMoreButtonContainer.remove();
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
                
                if (video.videoUrl) {
                    mediaContent = createVideoThumbnail(video.videoUrl, videoId, thumbnailUrl);
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
                
                gridElement.appendChild(card); // Append to the gridElement
            });
            
            // Load thumbnails for new content
            setTimeout(preloadThumbnails, 300);
            
            // Add load more button if there might be more videos
            if (additionalVideos.length === queryLimit) {
                const newLoadMoreContainer = document.createElement('div');
                newLoadMoreContainer.className = 'col-span-3 flex justify-center p-3 mb-4';
                
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
            if (loadMoreButtonContainer) { // If the original container still exists (e.g., was showing "Loading...")
                loadMoreButtonContainer.innerHTML = '<div class="text-center px-4 py-2 text-red-500">Failed to load more videos</div>';
            } else { // If it was removed, add a new error message container
                const errorContainer = document.createElement('div');
                errorContainer.className = 'col-span-3 text-center p-3 text-red-500';
                errorContainer.textContent = 'Failed to load more videos';
                gridElement.appendChild(errorContainer);
            }
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
            snapshot.forEach(doc => {
                const video = doc.data();
                const videoId = doc.id; // Use doc.id for consistency
                const item = document.createElement('div');
                item.className = 'border-b border-gray-200 p-4';
                item.setAttribute('data-video-id', videoId);
                
                const scoreDisplay = typeof video.score === 'number' 
                    ? `<div class="text-xs bg-black text-white px-1.5 py-0.5 rounded ml-2">Score: ${video.score}/100</div>` 
                    : '';
                
                let mediaContent;
                if (video.videoUrl) {
                    mediaContent = createVideoThumbnail(video.videoUrl, videoId, video.thumbnailUrl);
                } else {
                     mediaContent = `<div class="w-full h-full flex items-center justify-center bg-gray-200">
                                    <span class="text-gray-500 text-xs">Processing</span>
                                </div>`;
                }

                item.innerHTML = `
                    <div class="flex items-start space-x-3">
                        <div class="w-20 h-20 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                            ${mediaContent}
                        </div>
                        <div class="flex-1 min-w-0"> {/* Added min-w-0 for flex truncation if needed */}
                            <div class="flex items-center">
                                <span class="inline-block px-2 py-1 text-xs rounded ${getStatusClass(video.status)}">${video.status || 'Processing'}</span>
                                ${scoreDisplay}
                                <span class="text-xs text-gray-500 ml-auto whitespace-nowrap">${formatDate(video.uploadDate)}</span>
                            </div>
                            <p class="text-sm mt-1 truncate">${video.hashtags || 'No hashtags'}</p> {/* Added truncate */}
                            ${video.recommendedMob ? `<p class="text-xs text-fairlife-blue mt-1 truncate">Milk Mob: ${video.recommendedMob}</p>` : ''}
                        </div>
                    </div>
                `;
                
                item.addEventListener('click', () => {
                    showVideoDetails(videoId, video);
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

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const queryLimit = isMobile ? 8 : 15;
    
    db.collection('milk_videos')
        .where('status', '==', 'Approved')
        .orderBy('uploadDate', 'desc') // Added orderBy for more consistent results if limit is hit before all mobs
        .limit(queryLimit * 5) // Fetch more videos to have a chance to populate several mobs, adjust as needed
        .get()
        .then((snapshot) => {
            console.log(`Found ${snapshot.size} approved videos for mobs (query limit: ${queryLimit * 5})`);
            
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
                // Limit videos per mob for display if needed, e.g., mobs[mobName].length < queryLimit
                mobs[mobName].push({ ...video, id: doc.id });
            });

            if (Object.keys(mobs).length === 0) {
                exploreContainer.innerHTML = '<div class="text-center p-8 text-gray-500">No approved videos found to form mobs.</div>';
                return;
            }

            exploreContainer.innerHTML = '';
            
            const mobOrder = {
                "Milk Masters": -2,
                "Lactose Lookouts": -1
            };
            
            const sortedMobs = Object.entries(mobs).sort(([mobNameA], [mobNameB]) => {
                const orderA = mobOrder[mobNameA] || 0;
                const orderB = mobOrder[mobNameB] || 0;
                
                if (orderA !== orderB) return orderA - orderB;
                return mobNameA.localeCompare(mobNameB);
            });
            
            sortedMobs.forEach(([mob, videos]) => {
                // Optional: Limit videos displayed per mob
                const videosToDisplay = videos.slice(0, queryLimit); // Display up to 'queryLimit' videos per mob

                if (videosToDisplay.length === 0) return; // Skip mob if no videos after slicing

                const section = document.createElement('div');
                section.className = 'mb-6';
                
                const header = document.createElement('h3');
                header.className = 'text-lg font-medium mb-3 text-fairlife-blue'; // Used text-fairlife-blue for consistency
                header.innerHTML = `${mob} <span class="text-sm text-gray-500">(${videosToDisplay.length})</span>`;
                section.appendChild(header);
                
                const grid = document.createElement('div');
                grid.className = 'grid grid-cols-3 gap-2';
                
                videosToDisplay.forEach(video => {
                    const card = document.createElement('div');
                    card.className = 'aspect-square relative overflow-hidden';
                    card.setAttribute('data-video-id', video.id);
                    
                    let thumbnailUrl = video.thumbnailUrl || '';
                    let mediaContent;
                    
                    if (video.videoUrl) {
                        mediaContent = createVideoThumbnail(video.videoUrl, video.id, thumbnailUrl);
                    } else {
                        mediaContent = `<div class="w-full h-full flex items-center justify-center bg-gray-200">
                            <span class="text-gray-500 text-xs">Processing</span>
                        </div>`;
                    }
                    
                    // Status badge is less relevant here as all are 'Approved', but can keep for consistency or future use
                    let statusBadge = '<span class="absolute top-2 right-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">✓</span>';
                    
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
    // Add orderBy for consistent ordering
    query = query.orderBy('uploadDate', 'desc') 
        .limit(12); 
        
    query.get()
        .then((snapshot) => {
            console.log(`Found ${snapshot.size} videos for review (limited query)`);
            
            if (snapshot.empty) {
                reviewList.innerHTML = `<div class="text-center p-8 text-gray-500">No videos to review at this time. ${pendingOnly ? "" : "All videos have been reviewed."}</div>`;
                return;
            }

            // reviewList will be the grid container itself
            reviewList.innerHTML = '';
            reviewList.className = 'grid grid-cols-3 gap-3 p-2'; // Added padding around the grid
            
            snapshot.forEach(doc => {
                const video = doc.data();
                const videoId = doc.id;
                
                const card = document.createElement('div');
                card.className = 'aspect-square relative overflow-hidden bg-white rounded-lg shadow-sm';
                card.setAttribute('data-video-id', videoId);
                
                let thumbnailUrl = video.thumbnailUrl || '';
                let mediaContent;
                
                if (video.videoUrl) {
                    mediaContent = createVideoThumbnail(video.videoUrl, videoId, thumbnailUrl);
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
                
                reviewList.appendChild(card); // Append card to reviewList (which is now the grid)
            });
            
            setTimeout(preloadThumbnails, 300);
        })
        .catch(error => {
            console.error("Error fetching videos for review:", error);
            reviewList.innerHTML = '<div class="col-span-3 text-center p-8 text-gray-500">Error loading videos for review.</div>';
            // Reset class if it was changed
            reviewList.className = ''; // Or to a default non-grid class
        });
}

// Function to show video details in a modal
function showVideoDetails(videoId, videoData) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4';
    modal.id = 'videoModal';
    
    // Use 'click' for background close, more standard than 'touchstart'
    modal.addEventListener('click', (e) => {
        if (e.target === modal) { // Ensure click is on the backdrop itself
            if (document.body.contains(modal)) {
                document.body.removeChild(modal);
            }
        }
    });
    
    let videoElement = '';
    if (videoData.videoUrl) {
        videoElement = `
            <div class="flex justify-center bg-black rounded-lg"> {/* Added bg for letterboxing */}
                <video controls playsinline class="max-h-[30vh] max-w-full rounded-lg object-contain" preload="metadata"> {/* Changed preload to metadata */}
                    <source src="${videoData.videoUrl}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
            </div>
        `;
    } else {
        videoElement = `<div class="h-48 w-full bg-gray-200 flex items-center justify-center rounded-lg text-gray-500">Video processing or unavailable</div>`; // Adjusted height
    }
    
    let statusClass = getStatusClass(videoData.status); // Use util function for consistency
    
    const scoreDisplay = typeof videoData.score === 'number' 
        ? `<span class="inline-block px-2 py-1 text-xs rounded-md bg-black text-white">Score: ${videoData.score}/100</span>` 
        : '';
    
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-sm w-full mx-auto my-4 overflow-y-auto max-h-[90vh]"> {/* Increased max-w and max-h slightly */}
            <div class="p-3 border-b sticky top-0 bg-white z-10">
                <div class="flex justify-between items-center">
                    <h3 class="text-base font-medium">Video Details</h3>
                    <button id="closeModalBtn" class="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100" aria-label="Close modal">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
            
            <div class="p-4 space-y-3"> {/* Increased padding and added space-y */}
                ${videoElement}
                
                <div>
                    <div class="flex items-center justify-between mb-2">
                        <span class="inline-block px-2 py-1 text-xs rounded ${statusClass}">${videoData.status || 'Processing'}</span>
                        ${scoreDisplay}
                    </div>
                    
                    <div class="text-sm text-gray-700 space-y-1">
                        <p><strong>Upload Date:</strong> ${formatDate(videoData.uploadDate, true)}</p>
                        <p><strong>Hashtags:</strong> ${videoData.hashtags || 'None'}</p>
                        ${videoData.recommendedMob ? `<p class="text-fairlife-blue"><strong>Milk Mob:</strong> ${videoData.recommendedMob}</p>` : ''}
                    </div>
                    
                    <div class="mt-3">
                        <label for="mediaNameDisplay-${videoId}" class="block text-xs font-medium text-gray-500 mb-0.5">Media Name</label>
                        <div class="flex items-center space-x-2">
                            <div id="mediaNameDisplay-${videoId}" class="flex-1 px-3 py-1.5 bg-gray-100 rounded-md text-gray-700 text-sm overflow-hidden text-ellipsis whitespace-nowrap">
                                ${videoData.mediaName || videoData.originalFileName || 'Unknown'}
                            </div>
                            <button id="editMediaNameBtn" aria-label="Edit media name" class="bg-gray-200 text-gray-700 px-3 py-1.5 text-sm rounded-md hover:bg-gray-300">
                                Edit
                            </button>
                        </div>
                        ${videoData.mediaName && videoData.mediaName !== videoData.originalFileName ? 
                            `<div class="text-xs text-gray-500 mt-1">Original: ${videoData.originalFileName || 'Unknown'}</div>` : 
                            ''}
                        
                        <div id="mediaNameEditForm" class="hidden mt-2">
                            <label for="mediaNameInput-${videoId}" class="block text-sm font-medium text-gray-700 mb-1">Custom Media Name</label>
                            <div class="flex space-x-2">
                                <input type="text" id="mediaNameInput-${videoId}" class="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-fairlife-blue focus:border-fairlife-blue sm:text-sm" 
                                    value="${videoData.mediaName || ''}" placeholder="Enter custom name">
                                <button id="saveMediaNameBtn" aria-label="Save media name" class="bg-fairlife-blue text-white px-3 py-2 text-sm rounded-md" data-id="${videoId}">Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="p-2"> {/* Small padding at bottom */} </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    // Focus the close button for accessibility if desired, or the modal container.
    // modal.querySelector('.bg-white').focus(); // Example: focus modal content part

    document.getElementById('closeModalBtn').addEventListener('click', () => { // Matched ID
        if (document.body.contains(modal)) {
            document.body.removeChild(modal);
        }
    });
        
    const editButton = document.getElementById('editMediaNameBtn');
    const editForm = document.getElementById('mediaNameEditForm');
    const mediaNameDisplay = document.getElementById(`mediaNameDisplay-${videoId}`); // Get display element
    
    if (editButton && editForm && mediaNameDisplay) {
        editButton.addEventListener('click', () => {
            if (editForm.classList.contains('hidden')) {
                editForm.classList.remove('hidden');
                mediaNameDisplay.classList.add('hidden'); // Hide display when editing
                editButton.textContent = "Cancel";
                document.getElementById(`mediaNameInput-${videoId}`).focus();
            } else {
                editForm.classList.add('hidden');
                mediaNameDisplay.classList.remove('hidden'); // Show display again
                editButton.textContent = "Edit";
            }
        });
    }
    
    const saveButton = document.getElementById('saveMediaNameBtn'); // Matched ID
    if (saveButton) {
        saveButton.addEventListener('click', async () => {
            const videoId = saveButton.getAttribute('data-id');
            const newMediaName = document.getElementById(`mediaNameInput-${videoId}`).value.trim();
            
            try {
                await db.collection('milk_videos').doc(videoId).update({
                    mediaName: newMediaName
                });
                
                if (mediaNameDisplay) { // Update the display element
                    mediaNameDisplay.textContent = newMediaName || videoData.originalFileName || 'Unknown';
                }
                videoData.mediaName = newMediaName; // Update local data object
                
                // Update original file name display logic if needed
                const originalFileNameContainer = modal.querySelector('.text-xs.text-gray-500.mt-1');
                if (originalFileNameContainer) {
                    if (newMediaName && newMediaName !== videoData.originalFileName) {
                        originalFileNameContainer.textContent = `Original: ${videoData.originalFileName || 'Unknown'}`;
                        originalFileNameContainer.classList.remove('hidden');
                    } else {
                        originalFileNameContainer.classList.add('hidden');
                    }
                }

                saveButton.textContent = "Saved!";
                saveButton.classList.remove('bg-fairlife-blue');
                saveButton.classList.add('bg-green-500');
                
                setTimeout(() => {
                    saveButton.textContent = "Save";
                    saveButton.classList.remove('bg-green-500');
                    saveButton.classList.add('bg-fairlife-blue');
                    
                    if (editForm) editForm.classList.add('hidden');
                    if (mediaNameDisplay) mediaNameDisplay.classList.remove('hidden');
                    if (editButton) editButton.textContent = "Edit";
                }, 1500);
                
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
    modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4';
    modal.id = 'videoModal'; // Ensure unique ID or handle removal carefully if multiple modals can exist.
    
    modal.addEventListener('click', (e) => { // Use click, not touchstart
        if (e.target === modal) {
            if (document.body.contains(modal)) {
                 document.body.removeChild(modal);
            }
        }
    });

    let videoElement = '';
    if (videoData.videoUrl) {
        videoElement = `
            <div class="flex justify-center bg-black rounded-lg">
                <video controls playsinline class="max-h-[30vh] max-w-full rounded-lg object-contain" preload="metadata">
                    <source src="${videoData.videoUrl}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
            </div>
        `;
    } else {
        videoElement = `<div class="h-48 w-full bg-gray-200 flex items-center justify-center rounded-lg text-gray-500">Video processing or unavailable</div>`;
    }
    
    let statusClass = getStatusClass(videoData.status);
    
    const scoreDisplay = typeof videoData.score === 'number' 
        ? `<div class="px-3 py-1.5 bg-gray-700 text-white rounded text-sm">Score: ${videoData.score}/100</div>` // Adjusted padding
        : '<div class="px-3 py-1.5 bg-gray-200 text-gray-500 rounded text-sm">No score</div>'; // Placeholder if no score
    
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-sm w-full mx-auto my-4 overflow-y-auto max-h-[90vh]">
            <div class="p-3 border-b bg-white sticky top-0 z-10">
                <div class="flex justify-between items-center">
                    <h3 class="text-base font-medium">Moderate Video</h3>
                    <button id="closeModalBtnMod" class="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100" aria-label="Close modal">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
            
            <div class="p-4 space-y-3">
                ${videoElement}
                
                <div>
                    <div class="flex items-center justify-between mb-2">
                        <span id="statusBadge-${videoId}" class="inline-block px-2 py-1 text-xs rounded ${statusClass}">${videoData.status || 'Processing'}</span>
                        ${scoreDisplay}
                    </div>

                    <div class="flex justify-end space-x-2 mb-3">
                        <button id="approveBtn" class="px-3 py-1.5 bg-fairlife-blue text-white rounded text-sm ${videoData.status === 'Approved' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-fairlife-dark-blue'}" ${videoData.status === 'Approved' ? 'disabled' : ''}>
                            Approve
                        </button>
                        <button id="rejectBtn" class="px-3 py-1.5 bg-red-500 text-white rounded text-sm ${videoData.status === 'Rejected' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-600'}" ${videoData.status === 'Rejected' ? 'disabled' : ''}>
                            Reject
                        </button>
                    </div>
                    
                    <div class="text-sm text-gray-700 space-y-1">
                        <p><strong>Upload Date:</strong> ${formatDate(videoData.uploadDate, true)}</p>
                        <p><strong>Hashtags:</strong> ${videoData.hashtags || 'None'}</p>
                        ${videoData.recommendedMob ? `<p class="text-fairlife-blue"><strong>Milk Mob:</strong> ${videoData.recommendedMob}</p>` : ''}
                    </div>

                    <div class="mt-3">
                        <label for="mediaNameDisplayMod-${videoId}" class="block text-xs font-medium text-gray-500 mb-0.5">Media Name</label>
                        <div class="flex items-center space-x-2">
                            <div id="mediaNameDisplayMod-${videoId}" class="flex-1 px-3 py-1.5 bg-gray-100 rounded-md text-gray-700 text-sm overflow-hidden text-ellipsis whitespace-nowrap">
                                ${videoData.mediaName || videoData.originalFileName || 'Unknown'}
                            </div>
                            <button id="editMediaNameBtnMod" aria-label="Edit media name" class="bg-gray-200 text-gray-700 px-3 py-1.5 text-sm rounded-md hover:bg-gray-300">
                                Edit
                            </button>
                        </div>
                         ${videoData.mediaName && videoData.mediaName !== videoData.originalFileName ? 
                            `<div class="text-xs text-gray-500 mt-1">Original: ${videoData.originalFileName || 'Unknown'}</div>` : 
                            ''}
                        
                        <div id="mediaNameEditFormMod" class="hidden mt-2">
                            <label for="mediaNameInputMod-${videoId}" class="block text-sm font-medium text-gray-700 mb-1">Custom Media Name</label>
                            <div class="flex space-x-2">
                                <input type="text" id="mediaNameInputMod-${videoId}" class="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-fairlife-blue focus:border-fairlife-blue sm:text-sm" 
                                    value="${videoData.mediaName || ''}" placeholder="Enter custom name">
                                <button id="saveMediaNameBtnMod" aria-label="Save media name" class="bg-fairlife-blue text-white px-3 py-2 text-sm rounded-md" data-id="${videoId}">Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="p-2"></div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('closeModalBtnMod').addEventListener('click', () => {
        if (document.body.contains(modal)) {
            document.body.removeChild(modal);
        }
    });
    
    // Edit/Save Media Name Logic (similar to showVideoDetails, ensure unique IDs used above)
    const editButtonMod = document.getElementById('editMediaNameBtnMod');
    const editFormMod = document.getElementById('mediaNameEditFormMod');
    const mediaNameDisplayMod = document.getElementById(`mediaNameDisplayMod-${videoId}`);
    
    if (editButtonMod && editFormMod && mediaNameDisplayMod) {
        editButtonMod.addEventListener('click', () => {
            if (editFormMod.classList.contains('hidden')) {
                editFormMod.classList.remove('hidden');
                mediaNameDisplayMod.classList.add('hidden');
                editButtonMod.textContent = "Cancel";
                document.getElementById(`mediaNameInputMod-${videoId}`).focus();
            } else {
                editFormMod.classList.add('hidden');
                mediaNameDisplayMod.classList.remove('hidden');
                editButtonMod.textContent = "Edit";
            }
        });
    }
    
    const saveButtonMod = document.getElementById('saveMediaNameBtnMod');
    if (saveButtonMod) {
        saveButtonMod.addEventListener('click', async () => {
            const videoId = saveButtonMod.getAttribute('data-id');
            const newMediaName = document.getElementById(`mediaNameInputMod-${videoId}`).value.trim();
            try {
                await db.collection('milk_videos').doc(videoId).update({ mediaName: newMediaName });
                if (mediaNameDisplayMod) mediaNameDisplayMod.textContent = newMediaName || videoData.originalFileName || 'Unknown';
                videoData.mediaName = newMediaName;

                const originalFileNameContainerMod = modal.querySelector('.text-xs.text-gray-500.mt-1'); // Re-query
                if (originalFileNameContainerMod) {
                     if (newMediaName && newMediaName !== videoData.originalFileName) {
                        originalFileNameContainerMod.textContent = `Original: ${videoData.originalFileName || 'Unknown'}`;
                        originalFileNameContainerMod.classList.remove('hidden');
                    } else {
                        originalFileNameContainerMod.classList.add('hidden');
                    }
                }

                saveButtonMod.textContent = "Saved!";
                saveButtonMod.classList.remove('bg-fairlife-blue');
                saveButtonMod.classList.add('bg-green-500');
                setTimeout(() => {
                    saveButtonMod.textContent = "Save";
                    saveButtonMod.classList.remove('bg-green-500');
                    saveButtonMod.classList.add('bg-fairlife-blue');
                    if (editFormMod) editFormMod.classList.add('hidden');
                    if (mediaNameDisplayMod) mediaNameDisplayMod.classList.remove('hidden');
                    if (editButtonMod) editButtonMod.textContent = "Edit";
                }, 1500);
            } catch (error) {
                console.error("Error saving media name:", error);
                alert("Failed to save media name.");
            }
        });
    }
    
    // Moderation Buttons Logic
    const approveBtn = document.getElementById('approveBtn');
    const rejectBtn = document.getElementById('rejectBtn');
    const statusBadgeEl = document.getElementById(`statusBadge-${videoId}`);

    async function updateModerationStatus(newStatus, mob) {
        videoData.status = newStatus;
        if (mob) videoData.mob = mob;
        
        if (statusBadgeEl) {
            statusBadgeEl.className = `inline-block px-2 py-1 text-xs rounded ${getStatusClass(newStatus)}`;
            statusBadgeEl.textContent = newStatus;
        }
        
        approveBtn.disabled = newStatus === 'Approved';
        approveBtn.classList.toggle('opacity-50', newStatus === 'Approved');
        approveBtn.classList.toggle('cursor-not-allowed', newStatus === 'Approved');
        
        rejectBtn.disabled = newStatus === 'Rejected';
        rejectBtn.classList.toggle('opacity-50', newStatus === 'Rejected');
        rejectBtn.classList.toggle('cursor-not-allowed', newStatus === 'Rejected');

        // Re-render review view to reflect changes if current view is review view
        const activeView = document.querySelector('.view:not(.hidden)'); // Example selector
        if (activeView && activeView.id === 'reviewView') { // Assuming review view has id 'reviewView'
             // Find the current filter for review view (e.g. from a toggle button)
            const reviewFilterToggle = document.getElementById('reviewFilterToggle'); // Example ID
            const pendingOnly = reviewFilterToggle ? reviewFilterToggle.checked : true;
            renderReviewView(pendingOnly);
        }
    }

    if (approveBtn) {
        approveBtn.addEventListener('click', async () => {
            if (approveBtn.disabled) return;
            const mob = videoData.recommendedMob || "General";
            try {
                await approveVideo(videoId, mob);
                updateModerationStatus('Approved', mob);
            } catch (error) {
                console.error("Error approving video:", error);
                alert("Failed to approve video.");
            }
        });
    }
    
    if (rejectBtn) {
        rejectBtn.addEventListener('click', async () => {
            if (rejectBtn.disabled) return;
            try {
                await rejectVideo(videoId);
                updateModerationStatus('Rejected');
            } catch (error) {
                console.error("Error rejecting video:", error);
                alert("Failed to reject video.");
            }
        });
    }
}

export { renderHomeView, renderNotificationsView, renderExploreView, renderReviewView, showVideoDetails, showVideoDetailsWithModeration };