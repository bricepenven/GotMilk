# Got Milk App

## Overview
The Got Milk App is a web application designed for users to upload and share videos related to milk consumption. The application features a clean and modern interface, inspired by popular social media platforms, allowing users to explore, upload, and manage their videos seamlessly.

## Project Structure
```
got-milk-app
├── src
│   ├── js
│   │   ├── api.js
│   │   ├── firebase.js
│   │   ├── homeView.js
│   │   ├── notificationsView.js
│   │   ├── exploreView.js
│   │   ├── uploadHandler.js
│   │   ├── videoModal.js
│   │   ├── utils.js
│   │   └── app.js
│   ├── css
│   │   └── styles.css
│   ├── index.html
│   └── assets
│       └── logo.png
├── .gitignore
└── README.md
```

## Setup Instructions
1. **Clone the Repository**: 
   ```
   git clone <repository-url>
   cd got-milk-app
   ```

2. **Install Dependencies**: 
   Ensure you have the necessary dependencies installed. If using a package manager, run:
   ```
   npm install
   ```

3. **Configure Firebase**: 
   Open `src/js/firebase.js` and replace the Firebase configuration object with your own API keys.

4. **Update Webhook URL**: 
   In `src/js/api.js`, update the `webhookUrl` variable to point to your own n8n workflow or other webhook service.

5. **Run the Application**: 
   Open `src/index.html` in your web browser to view the application.

## Usage Guidelines
- **API Keys and Webhooks**: Clients should replace the Firebase configuration in `src/js/firebase.js` with their own API keys. Additionally, the webhook URL in `src/js/api.js` should be updated to point to their own n8n workflow or other webhook service.

- **Reusable Components**: The modular structure allows clients to reuse individual files for specific functionalities, such as `uploadHandler.js` for handling uploads or `videoModal.js` for displaying video details.

- **Styling**: Clients can customize the appearance of the application by modifying `src/css/styles.css`.

- **HTML Structure**: The main layout can be adjusted in `src/index.html` to fit the client's branding or design preferences.

- **Functionality Overview**: Each JavaScript file is focused on a specific aspect of the application, making it easier to navigate and modify as needed. Clients can refer to the respective files for detailed functionality and integration points.

## File Descriptions
- **src/js/api.js**: Contains functions for making API calls, including the webhook integration. Exports the function `callWebhook(data)` for sending data to the specified webhook URL.

- **src/js/firebase.js**: Initializes Firebase with the provided configuration. Exports the initialized Firestore and Storage instances for use throughout the application.

- **src/js/homeView.js**: Handles rendering the home view, including fetching and displaying videos in an Instagram-style grid layout. Exports the function `renderHomeView()`.

- **src/js/notificationsView.js**: Manages the notifications view, displaying the user's uploaded videos. Exports the function `renderNotificationsView()`.

- **src/js/exploreView.js**: Responsible for rendering the explore view, which displays approved videos. Exports the function `renderExploreView()`.

- **src/js/uploadHandler.js**: Contains the logic for handling video uploads, including form submission and progress tracking. Exports the function `handleUpload(e)`.

- **src/js/videoModal.js**: Manages the video detail modal, displaying video information and allowing users to edit media names. Exports the function `showVideoDetails(videoId, videoData)`.

- **src/js/utils.js**: Contains utility functions, such as formatting dates and generating video thumbnails. Exports various helper functions used across the application.

- **src/js/app.js**: Serves as the main entry point for the JavaScript code, setting up event listeners and initializing views. Imports functions from other modules to manage the application's behavior.

- **src/css/styles.css**: Contains the CSS styles for the application, defining the layout and appearance of various components.

- **src/index.html**: The main HTML file for the application, linking to the CSS and JavaScript files and defining the structure of the web page.

- **src/assets/logo.png**: The logo image used in the application.

## Conclusion
This README provides a comprehensive overview of the Got Milk App, including setup instructions, usage guidelines, and file descriptions. Clients can easily customize and extend the application to meet their specific needs.