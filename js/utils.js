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
    
    const h = hash % 360;
    return `hsl(${h}, 70%, 80%)`;
}

// Function to create a video thumbnail element
function createVideoThumbnail(videoUrl, videoId) {
    return `
        <div class="thumbnail-container relative bg-gray-200">
            <video class="video-thumbnail" preload="metadata" poster="${videoUrl}#t=0.1" muted>
                <source src="${videoUrl}#t=0.1" type="video/mp4">
            </video>
            <div class="absolute inset-0 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" style="filter: drop-shadow(0px 1px 2px rgba(0,0,0,0.5));">
                    <path d="M8 5v14l11-7z"/>
                </svg>
            </div>
        </div>
    `;
}

// Helper function to preload thumbnails from video URLs
function preloadThumbnails() {
    console.log("Loading video thumbnails");
    
    const videos = document.querySelectorAll('video');
    console.log(`Found ${videos.length} videos to process for thumbnails`);
    
    videos.forEach((video, index) => {
        try {
            video.pause();
            video.currentTime = 0.1;
            
            video.addEventListener('loadeddata', function() {
                this.currentTime = 0.1;
            });
            
            video.addEventListener('loadedmetadata', function() {
                this.currentTime = 0.1;
            });
            
            video.style.opacity = '0.99';
            setTimeout(() => {
                video.style.opacity = '1';
            }, 50);
        } catch (e) {
            console.error(`Error setting video ${index} thumbnail:`, e);
        }
    });
}

export { formatDate, getStatusClass, getRandomPastelColor, createVideoThumbnail, preloadThumbnails };
