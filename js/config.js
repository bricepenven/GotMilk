// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAU3qmsD15JX6iwjloTjCPDd-2SuG6oM8w",
    authDomain: "chokaj-4dcae.firebaseapp.com",
    projectId: "chokaj-4dcae",
    storageBucket: "chokaj-4dcae.firebasestorage.app",
    messagingSenderId: "628147483032",
    appId: "1:628147483032:web:2cea7a3dd553b8922d7398"
};

const rawWebhookUrl = "https://invigorating-happiness.up.railway.app//webhook/884e09b7-11b7-4728-b3f7-e909cc9c6b9a";
const webhookUrl = rawWebhookUrl.replace(/([^:]\/)\/+/g, "$1"); // removes extra slashes except after https://

const corsProxyUrl = "https://corsproxy.io/?";

export { firebaseConfig, webhookUrl, corsProxyUrl };
