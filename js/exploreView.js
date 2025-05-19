// filepath: /got-milk-app/got-milk-app/src/js/exploreView.js
import { db } from './firebase.js';
import { createVideoThumbnail, formatDate, getStatusClass } from './utils.js';

export function renderExploreView() {
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
                exploreContainer.innerHTML = '<div class="text-center p-8 text-gray-500">No approved videos available.</div>';
                return;
            }

            exploreContainer.innerHTML = '';  // Clear loading message
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
                                createVideoThumbnail(video.videoUrl, doc.id) :
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
                        </div>
                    </div>
                `;
                
                exploreContainer.appendChild(item);
            });
        })
        .catch(error => {
            console.error("Error fetching explore videos:", error);
            exploreContainer.innerHTML = '<div class="text-center p-8 text-gray-500">Error loading explore videos.</div>';
        });
}