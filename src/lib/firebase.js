import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBJRvoM-gVYz3MTHG48WvENU-iwqMpDrow',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'zyvra-515103.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'zyvra-515103',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'zyvra-515103.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '933601536075',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:933601536075:web:05e794a5018c3b624cc5ce'
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
