// filepath: /got-milk-app/got-milk-app/src/js/utils.js

export function formatDate(date, includeTime = false) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    if (includeTime) {
        options.hour = '2-digit';
        options.minute = '2-digit';
    }
    return new Date(date).toLocaleDateString(undefined, options);
}

export function createVideoThumbnail(videoUrl, videoId) {
    return `<div class="video-thumbnail" style="background-image: url('https://img.youtube.com/vi/${videoId}/0.jpg');">
                <video class="hidden" src="${videoUrl}" preload="metadata"></video>
            </div>`;
}

export function getStatusClass(status) {
    switch (status) {
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