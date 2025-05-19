// filepath: /got-milk-app/got-milk-app/src/js/notificationsView.js

import { db } from './firebase.js';
import { formatDate, getStatusClass } from './utils.js';

export function renderNotificationsView() {
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
                                `<div class="w-full h-full bg-gray-200 flex items-center justify-center">
                                    <span class="text-gray-500 text-xs">Processing</span>
                                </div>` : ''}
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
                notificationsList.appendChild(item);
            });
        })
        .catch(error => {
            console.error("Error fetching notifications:", error);
            notificationsList.innerHTML = '<div class="text-center p-8 text-gray-500">Error loading your videos.</div>';
        });
}