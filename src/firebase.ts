// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics, logEvent } from "firebase/analytics";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyA4A-bPSG1bOpfMBjzCzRaMmUvoQn-luYU",
    authDomain: "pokt-ui.firebaseapp.com",
    projectId: "pokt-ui",
    storageBucket: "pokt-ui.firebasestorage.app",
    messagingSenderId: "334041895934",
    appId: "1:334041895934:web:706392d1e284f52e5266af",
    measurementId: "G-SXB0WJZEZ2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Función auxiliar para registrar eventos
export const trackEvent = (eventName: string, eventParams?: Record<string, any>) => {
    try {
        logEvent(analytics, eventName, eventParams);
        console.log(`📊 Analytics event tracked: ${eventName}`, eventParams);
    } catch (error) {
        console.error(`❌ Error tracking analytics event ${eventName}:`, error);
    }
};

// Exportar las instancias de Firebase
export { app, analytics }; 