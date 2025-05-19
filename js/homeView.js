// filepath: /got-milk-app/got-milk-app/src/js/homeView.js

import { db } from './firebase.js';  // Import Firestore instance for database operations
import { showVideoDetails } from './videoModal.js';  // Import function to show video details

// Render home view with Instagram-style grid layout - main landing page
export function renderHomeView() {
    console.log("Rendering home view");
    const homeGrid = document.getElementById('homeGrid');
    if (!homeGrid) {
        console.error("Home grid element not found");
        return;
    }
    
    // Show loading message while we fetch the videos
    homeGrid.innerHTML = '<div class="col-span-3 text-center p-8 text-gray-500">Loading videos...</div>';

    // Fetch videos from Firestore
    db.collection('milk_videos')
        .orderBy('uploadDate', 'desc') // Newest videos first
        .get()
        .then((snapshot) => {
            console.log(`Found ${snapshot.size} videos`);
            
            // If no videos, show empty state
            if (snapshot.empty) {
                homeGrid.innerHTML = '<div class="col-span-3 text-center p-8 text-gray-500">No videos yet.</div>';
                return;
            }

            // Filter out rejected videos client-side
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
            
            // If no non-rejected videos, show empty state
            if (filteredVideos.length === 0) {
                homeGrid.innerHTML = '<div class="col-span-3 text-center p-8 text-gray-500">No videos yet.</div>';
                return;
            }

            // Update the HTML to use a 3-column grid - Instagram style
            homeGrid.className = 'grid grid-cols-3 gap-2';
            homeGrid.innerHTML = '';  // Clear loading message
            
            // Loop through each video and create a card for it
            filteredVideos.forEach(video => {
                const videoId = video.id;
                const card = document.createElement('div');
                card.className = 'aspect-square relative overflow-hidden';  // Square aspect ratio
                card.setAttribute('data-video-id', videoId);
                
                // Create thumbnail with overlay - figure out what to display
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
                
                // Add badge indicators for status
                let statusBadge = '';
                if (video.status === 'Approved') {
                    statusBadge = '<span class="absolute top-2 right-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">✓</span>';
                } else if (video.status === 'Pending Review' || video.needsReview) {
                    statusBadge = '<span class="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-full">⌛</span>';
                }
                
                // Add score badge if available
                let scoreBadge = '';
                if (typeof video.score === 'number') {
                    scoreBadge = `<span class="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-1.5 py-0.5 rounded-md">${video.score}/100</span>`;
                }
                
                // Combine the media and badges into the card
                card.innerHTML = `
                    ${mediaContent}
                    ${statusBadge}
                    ${scoreBadge}
                `;
                
                // Add click event to show video details when clicked
                card.addEventListener('click', () => {
                    showVideoDetails(videoId, video);
                });
                
                // Add the card to the grid
                homeGrid.appendChild(card);
            });
        })
        .catch(error => {
            console.error("Error fetching videos:", error);
            homeGrid.innerHTML = '<div class="col-span-3 text-center p-8 text-gray-500">Error loading videos.</div>';
        });
}