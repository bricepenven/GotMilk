// filepath: /got-milk-app/got-milk-app/src/js/videoModal.js

export function showVideoDetails(videoId, videoData) {
    // Create modal overlay - full screen semi-transparent background
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50';
    modal.id = 'videoModal';
    
    // Add touchstart event listener to help with mobile interactions
    modal.addEventListener('touchstart', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
    
    // Create modal content - figure out what to display
    let videoElement = '';
    if (videoData.videoUrl) {
        // If we have a video URL, show the video player (autoplay disabled)
        videoElement = `
            <video controls class="max-h-[50vh] max-w-full rounded-lg" preload="auto">
                <source src="${videoData.videoUrl}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        `;
    } else {
        // Fallback if video isn't available
        videoElement = `<div class="h-64 w-full bg-gray-200 flex items-center justify-center rounded-lg">Video processing</div>`;
    }
    
    // Status indicator with appropriate color - visual cue about video state
    let statusClass = 'bg-gray-100 text-gray-800';  // Default gray
    if (videoData.status === 'Approved') statusClass = 'bg-green-100 text-green-800';  // Green for approved
    if (videoData.status === 'Rejected') statusClass = 'bg-red-100 text-red-800';  // Red for rejected
    if (videoData.status === 'Pending Review') statusClass = 'bg-yellow-100 text-yellow-800';  // Yellow for pending
    
    // Score display - show score if available
    const scoreDisplay = typeof videoData.score === 'number' 
        ? `<div class="bg-black text-white text-sm font-medium rounded px-2 py-1 ml-2">Score: ${videoData.score}/100</div>` 
        : '';
    
    // Build the modal HTML - with score added
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
                    
                    <!-- Media name section with edit functionality -->
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
                        
                        <!-- Hidden form that appears when Edit is clicked -->
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
    
    // Add modal to the page
    document.body.appendChild(modal);
    
    // Add close button handler
    document.getElementById('closeModal').addEventListener('click', () => {
        document.body.removeChild(modal);  // Remove the modal when X is clicked
    });
    
    // Close when clicking outside the content (on the dark overlay)
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);  // Remove modal when clicking outside
        }
    });
    
    // Add edit button handler for media name
    const editButton = document.getElementById('editMediaNameBtn');
    if (editButton) {
        editButton.addEventListener('click', () => {
            const editForm = document.getElementById('mediaNameEditForm');
            if (editForm.classList.contains('hidden')) {
                // Show the edit form
                editForm.classList.remove('hidden');
                editButton.textContent = "Cancel";  // Change button to Cancel
            } else {
                // Hide the edit form
                editForm.classList.add('hidden');
                editButton.textContent = "Edit";  // Change button back to Edit
            }
        });
    }
    
    // Add save media name handler - saves the custom name to the database
    const saveButton = document.getElementById('saveMediaName');
    if (saveButton) {
        saveButton.addEventListener('click', async () => {
            const mediaName = document.getElementById('mediaName').value.trim();
            const videoId = saveButton.getAttribute('data-id');
            
            try {
                // Update the media name in Firestore
                await db.collection('milk_videos').doc(videoId).update({
                    mediaName: mediaName
                });
                
                // Update the display with the new name
                const nameDisplay = modal.querySelector('.flex-1.px-3.py-2.bg-gray-100');
                if (nameDisplay) {
                    nameDisplay.textContent = mediaName;
                }
                
                // Update the videoData object so it's current
                videoData.mediaName = mediaName;
                
                // Show success feedback - change button color and text
                saveButton.textContent = "Saved!";
                saveButton.classList.add('bg-green-500');
                
                // Reset after 2 seconds
                setTimeout(() => {
                    saveButton.textContent = "Save";
                    saveButton.classList.remove('bg-green-500');
                }, 2000);
                
            } catch (error) {
                console.error("Error saving media name:", error);
                alert("Failed to save media name. Please try again.");
            }
        });
    }
}