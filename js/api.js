import { webhookUrl, corsProxyUrl } from './config.js';

// Get Firebase instances
const db = firebase.firestore();
const storage = firebase.storage();

// Helper function for webhook API calls with CORS handling
async function callWebhook(data) {
    // First try direct request
    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Origin': 'https://bricepenven.github.io'
            },
            mode: 'cors',
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            console.log("Webhook call successful");
            return true;
        }
        
        throw new Error(`Webhook returned status ${response.status}`);
    } catch (directError) {
        console.warn("Direct webhook call failed, trying with CORS proxy:", directError);
        
        // Fall back to CORS proxy
        try {
            const response = await fetch(corsProxyUrl + encodeURIComponent(webhookUrl), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                console.log("Webhook call via proxy successful");
                return true;
            }
            
            throw new Error(`Proxy webhook returned status ${response.status}`);
        } catch (proxyError) {
            console.error("All webhook attempts failed:", proxyError);
            return false;
        }
    }
}

// Approve video function
async function approveVideo(videoId, mob) {
    try {
        console.log(`Approving video ${videoId} for mob ${mob}`);
        
        await db.collection('milk_videos').doc(videoId).update({
            status: 'Approved',
            recommendedMob: mob,
            needsReview: false,
            reviewDate: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        const webhookData = {
            action: 'approve_video',
            videoId: videoId,
            mob: mob,
            timestamp: new Date().toISOString()
        };
        
        callWebhook(webhookData)
            .then(success => {
                if (success) {
                    console.log("Approval webhook notification processed");
                } else {
                    console.warn("Approval webhook notification failed but app continues");
                }
            });
        
        return true;
    } catch (error) {
        console.error("Error approving video:", error);
        throw error;
    }
}

// Reject video function
async function rejectVideo(videoId) {
    try {
        console.log(`Rejecting video ${videoId}`);
        
        await db.collection('milk_videos').doc(videoId).update({
            status: 'Rejected',
            needsReview: false,
            reviewDate: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        const webhookData = {
            action: 'reject_video',
            videoId: videoId,
            timestamp: new Date().toISOString()
        };
        
        callWebhook(webhookData)
            .then(success => {
                if (success) {
                    console.log("Rejection webhook notification processed");
                } else {
                    console.warn("Rejection webhook notification failed but app continues");
                }
            });
        
        return true;
    } catch (error) {
        console.error("Error rejecting video:", error);
        throw error;
    }
}

// Upload handler
async function handleUpload(e) {
    e.preventDefault();
    console.log("Upload form submitted");
    
    const videoFile = document.getElementById('videoFile').files[0];
    const hashtags = document.getElementById('hashtags').value;
    
    if (!videoFile) {
        showUploadStatus('Please select a video file.', 'error');
        return;
    }
    
    try {
        showUploadStatus('Uploading video...', 'info');
        
        const videoId = Date.now().toString();
        const storageRef = storage.ref(`videos/${videoId}`);
        
        const metadata = {
            contentType: videoFile.type,
            customMetadata: {
                'hashtags': hashtags
            }
        };
        
        const uploadTask = storageRef.put(videoFile, metadata);
        
        uploadTask.on('state_changed', 
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log(`Upload progress: ${Math.round(progress)}%`);
                showUploadStatus(`Upload progress: ${Math.round(progress)}%`, 'info');
            },
            (error) => {
                console.error('Upload error:', error);
                showUploadStatus(`Upload failed: ${error.message}`, 'error');
            },
            async () => {
                try {
                    showUploadStatus('Saving to database...', 'info');
                    
                    const videoUrl = await uploadTask.snapshot.ref.getDownloadURL();
                    console.log("Got download URL:", videoUrl);
                    
                    const docRef = await db.collection('milk_videos').add({
                        videoUrl: videoUrl,
                        hashtags: hashtags,
                        status: 'Pending Review',
                        needsReview: true,
                        uploadDate: firebase.firestore.FieldValue.serverTimestamp(),
                        originalFileName: videoFile.name,
                        score: 0
                    });
                    console.log("Document saved with ID:", docRef.id);
                    
                    const webhookData = {
                        videoId: docRef.id,
                        action: 'new_video',
                        videoUrl: videoUrl,
                        hashtags: hashtags,
                        timestamp: new Date().toISOString()
                    };
                    
                    callWebhook(webhookData)
                        .then(success => {
                            if (success) {
                                console.log("Webhook notification processed");
                            } else {
                                console.warn("Webhook notification failed but app continues");
                            }
                        });
                    
                    showUploadStatus('Video uploaded successfully!', 'success');
                    
                    setTimeout(() => {
                        document.getElementById('videoFile').value = '';
                        document.getElementById('hashtags').value = '';
                        
                        const notificationsTab = document.getElementById('notificationsTab');
                        if (notificationsTab) {
                            notificationsTab.click();
                        }
                    }, 2000);
                } catch (dbError) {
                    console.error('Database error:', dbError);
                    showUploadStatus('Upload successful but database update failed. Please try again.', 'error');
                }
            }
        );
    } catch (error) {
        console.error('Error:', error);
        showUploadStatus('An error occurred. Please try again.', 'error');
    }
}

// Helper function to show upload status
function showUploadStatus(message, type) {
    const statusElement = document.getElementById('uploadStatus');
    if (!statusElement) return;
    
    statusElement.textContent = message;
    
    statusElement.classList.remove('hidden', 'text-green-500', 'text-red-500', 'text-blue-500');
    
    switch(type) {
        case 'success':
            statusElement.classList.add('text-green-500');
            break;
        case 'error':
            statusElement.classList.add('text-red-500');
            break;
        case 'info':
            statusElement.classList.add('text-blue-500');
            break;
    }
    
    statusElement.classList.remove('hidden');
}

export { db, storage, callWebhook, approveVideo, rejectVideo, handleUpload, showUploadStatus };
