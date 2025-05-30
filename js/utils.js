// Convert timestamps to readable format
function formatDate(timestamp, detailed = false) {
    if (!timestamp) return 'Just now';
    
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
        return 'Invalid date';
    }
}

// Get Tailwind classes for status badges
function getStatusClass(status) {
    switch(status) {
        case 'Approved':
            return 'bg-green-100 text-green-800';
        case 'Rejected':
            return 'bg-red-100 text-red-800';
        case 'Pending Review':
            return 'bg-yellow-100 text-yellow-800';
        case 'Score':
            return 'bg-gray-800 text-white';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

// Generate milk-themed pastel color from ID
function getRandomPastelColor(id) {
    if (!id) return '#e0f2fe';
    
    let hash = 0;
    for (let i = 0; i < String(id).length; i++) {
        hash = String(id).charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Use a more milk-themed color palette (blues, whites, creams)
    const h = (hash % 60) + 190; // Range between 190-250 (blues)
    const s = 60 + (hash % 20); // Saturation 60-80%
    const l = 75 + (hash % 15); // Lightness 75-90%
    
    return `hsl(${h}, ${s}%, ${l}%)`;
}

// Create thumbnail with play button overlay
function createVideoThumbnail(videoUrl, videoId, thumbnailUrl = null) {
    // Use the thumbnail URL if available, otherwise use a colored background
    const bgColor = getRandomPastelColor(videoId);
    
    if (thumbnailUrl) {
        return `
            <div class="thumbnail-container relative">
                <img src="${thumbnailUrl}" alt="Video thumbnail" class="absolute inset-0 w-full h-full object-cover">
                <div class="absolute inset-0 bg-black bg-opacity-10"></div>
                <div class="absolute inset-0 flex items-center justify-center">
                    <div class="play-button-overlay">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="32" height="32">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    </div>
                </div>
            </div>
        `;
    } else {
        // Fallback to colored background if no thumbnail
        return `
            <div class="thumbnail-container relative" style="background-color: ${bgColor};">
                <div class="absolute inset-0 flex items-center justify-center">
                    <div class="play-button-overlay">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="32" height="32">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    </div>
                </div>
            </div>
        `;
    }
}

// Lazy load thumbnails when they enter viewport
function preloadThumbnails() {
    console.log("Loading video thumbnails with lazy loading");
    
    const lazyVideos = document.querySelectorAll('video.lazy-video');
    console.log(`Found ${lazyVideos.length} lazy videos to process for thumbnails`);
    
    if ('IntersectionObserver' in window) {
        const lazyVideoObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const video = entry.target;
                    
                    // Set the real src from data-src
                    if (video.dataset.src) {
                        video.src = video.dataset.src;
                        video.removeAttribute('data-src');
                    }
                    
                    // Do the same for source elements
                    const sources = video.querySelectorAll('source[data-src]');
                    sources.forEach(source => {
                        source.src = source.dataset.src;
                        source.removeAttribute('data-src');
                    });
                    
                    video.load();
                    
                    // Set the poster and time
                    video.addEventListener('loadeddata', function() {
                        this.currentTime = 0.1;
                    });
                    
                    video.addEventListener('loadedmetadata', function() {
                        this.currentTime = 0.1;
                    });
                    
                    // Stop observing once loaded
                    observer.unobserve(video);
                }
            });
        }, {
            rootMargin: '100px 0px', // Load when within 100px of viewport
            threshold: 0.01
        });
        
        lazyVideos.forEach(lazyVideo => {
            lazyVideoObserver.observe(lazyVideo);
        });
    } else {
        // Fallback for browsers without IntersectionObserver
        lazyVideos.forEach((video, index) => {
            try {
                if (video.dataset.src) {
                    video.src = video.dataset.src;
                    video.removeAttribute('data-src');
                }
                
                const sources = video.querySelectorAll('source[data-src]');
                sources.forEach(source => {
                    source.src = source.dataset.src;
                    source.removeAttribute('data-src');
                });
                
                video.load();
                video.pause();
                video.currentTime = 0.1;
            } catch (e) {
                console.error(`Error setting lazy video ${index} thumbnail:`, e);
            }
        });
    }
}

export { formatDate, getStatusClass, getRandomPastelColor, createVideoThumbnail, preloadThumbnails };
