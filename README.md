# GoatMilke Social App

A social media platform for milk enthusiasts to share videos and join "Milk Mobs".

## Project Overview

This application allows users to:
- Upload videos of themselves enjoying milk
- Browse videos from other users
- Join themed "Milk Mobs" based on hashtags
- Moderate content through an admin interface

## Technical Architecture

The application uses:
- **Frontend**: HTML, Tailwind CSS, JavaScript
- **Backend**: Firebase (Firestore + Storage)
- **Automation**: n8n workflows for video processing

## Directory Structure

```
Got Milk app/
├── index.html           # Main HTML file
├── logo.png             # Fairlife logo
├── js/                  # JavaScript modules
│   ├── app.js           # Main application initialization
│   ├── api.js           # Firebase and API interactions
│   ├── config.js        # Configuration settings
│   ├── utils.js         # Utility functions
│   └── views.js         # UI rendering functions
├── N8N workflow.json    # n8n workflow configuration
└── README.md            # This documentation
```

## Setup Instructions

### 1. Firebase Configuration

Replace the Firebase configuration in `js/config.js` with your own Firebase project details:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.firebasestorage.app",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### 2. n8n Webhook Configuration

Replace the webhook URL in `js/config.js` with your own n8n webhook URL:

```javascript
const webhookUrl = "YOUR_N8N_WEBHOOK_URL";
```

### 3. CORS Proxy (if needed)

The application uses a CORS proxy for API calls. You can replace it with your own proxy if needed:

```javascript
const corsProxyUrl = "YOUR_CORS_PROXY_URL";
```

## Key Features

### Video Upload

The upload process:
1. User selects a video file and adds hashtags
2. Video is uploaded to Firebase Storage
3. Metadata is stored in Firestore
4. n8n workflow is triggered for processing
5. Video is queued for moderation

### Moderation

The moderation panel allows admins to:
- Review pending videos
- Approve or reject content
- Assign videos to specific Milk Mobs
- Edit video metadata

### Milk Mobs

Milk Mobs are themed groups that videos are assigned to based on:
- Hashtags used in the upload
- Content analysis from the n8n workflow
- Manual assignment during moderation

## n8n Workflow

The n8n workflow (`N8N workflow.json`) handles:
- Video analysis
- Score calculation
- Thumbnail generation
- Mob recommendation

To set up the workflow:
1. Import the workflow JSON into your n8n instance
2. Configure the nodes to connect to your Firebase project
4. Configure the nodes to connect to your TwelveLabs account
3. Activate the workflow

## Customization

### Branding

To customize the branding:
1. Replace `logo.png` with your own logo
2. Update the Tailwind theme colors in `index.html`

### Database Structure

The Firestore database uses a collection called `milk_videos` with the following fields:
- `videoUrl`: URL to the video in Firebase Storage
- `hashtags`: User-provided hashtags
- `status`: "Pending Review", "Approved", or "Rejected"
- `needsReview`: Boolean flag for moderation queue
- `uploadDate`: Timestamp of upload
- `originalFileName`: Original file name
- `score`: Calculated score (0-100)
- `recommendedMob`: Suggested Milk Mob
- `mediaName`: Custom name (optional)

## Contact

For questions or support, please contact the development team.
