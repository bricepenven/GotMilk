// filepath: /got-milk-app/got-milk-app/src/js/uploadHandler.js

import { db, storage } from './firebase.js';
import { showUploadStatus } from './utils.js';
import { callWebhook } from './api.js';

// Upload handler - processes the video upload form submission
export async function handleUpload(e) {
    e.preventDefault();  // Stop the form from doing a regular submit
    console.log("Upload form submitted");
    
    // Get the file and hashtags from the form
    const videoFile = document.getElementById('videoFile').files[0];
    const hashtags = document.getElementById('hashtags').value;
    
    // Make sure they actually selected a file
    if (!videoFile) {
        showUploadStatus('Please select a video file.', 'error');
        return;
    }
    
    try {
        showUploadStatus('Uploading video...', 'info');
        
        // Generate a unique ID for the video based on timestamp
        const videoId = Date.now().toString();
        
        // Create storage reference - where the file will be stored in Firebase
        const storageRef = storage.ref(`videos/${videoId}`);
        
        // Set metadata - includes content type and hashtags
        const metadata = {
            contentType: videoFile.type,
            customMetadata: {
                'hashtags': hashtags
            }
        };
        
        // Start upload with metadata - this is where the file actually gets sent
        const uploadTask = storageRef.put(videoFile, metadata);
        
        uploadTask.on('state_changed', 
            // Progress function - updates as the file uploads
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log(`Upload progress: ${Math.round(progress)}%`);
                showUploadStatus(`Upload progress: ${Math.round(progress)}%`, 'info');
            },
            // Error function - called if upload fails
            (error) => {
                console.error('Upload error:', error);
                showUploadStatus(`Upload failed: ${error.message}`, 'error');
            },
            // Complete function - called when upload finishes successfully
            async () => {
                try {
                    showUploadStatus('Saving to database...', 'info');
                    
                    // Get download URL - this is the public URL for the video
                    const videoUrl = await uploadTask.snapshot.ref.getDownloadURL();
                    console.log("Got download URL:", videoUrl);
                    
                    // Save to Firestore - create a database record for the video
                    const docRef = await db.collection('milk_videos').add({
                        videoUrl: videoUrl,
                        hashtags: hashtags,
                        status: 'Pending Review',  // All videos start as pending
                        needsReview: true,  // Flag for videos that need moderation
                        uploadDate: firebase.firestore.FieldValue.serverTimestamp(),  // Server timestamp
                        originalFileName: videoFile.name,  // Store original filename
                        score: 0  // Initialize score at 0 until n8n processes it
                    });
                    console.log("Document saved with ID:", docRef.id);
                    
                    // Notify webhook using our helper function - this triggers the n8n workflow
                    const webhookData = {
                        videoId: docRef.id,
                        action: 'new_video',
                        videoUrl: videoUrl,
                        hashtags: hashtags,
                        timestamp: new Date().toISOString()
                    };
                    
                    // Don't await this - let it run in background so we don't block the UI
                    callWebhook(webhookData)
                        .then(success => {
                            if (success) {
                                console.log("Webhook notification processed");
                            } else {
                                console.warn("Webhook notification failed but app continues");
                            }
                        });
                    
                    // Show success message
                    showUploadStatus('Video uploaded successfully!', 'success');
                    
                    // Reset form and navigate to activity view after 2 seconds
                    setTimeout(() => {
                        // Clear the form fields
                        document.getElementById('videoFile').value = '';
                        document.getElementById('hashtags').value = '';
                        
                        // Navigate to Activity view to see the uploaded video
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