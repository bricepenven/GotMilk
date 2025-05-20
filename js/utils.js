// Format date - converts timestamps to readable format
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

// Get CSS class for status - returns Tailwind classes for status badges
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

// Generate a consistent pastel color based on a string ID
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

// Function to create a video thumbnail element
function createVideoThumbnail(videoUrl, videoId) {
    // Use the video URL as the background image with a play button overlay
    return `
        <div class="thumbnail-container relative">
            <div class="absolute inset-0 bg-cover bg-center" style="background-image: url('${videoUrl}#t=0.1');">
                <div class="absolute inset-0 bg-black bg-opacity-10"></div>
            </div>
            <div class="absolute inset-0 flex items-center justify-center">
                <div class="rounded-full bg-black bg-opacity-50 p-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" style="filter: drop-shadow(0px 1px 2px rgba(0,0,0,0.2));">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                </div>
            </div>
        </div>
    `;
}

// Helper function to preload thumbnails from video URLs with lazy loading
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
