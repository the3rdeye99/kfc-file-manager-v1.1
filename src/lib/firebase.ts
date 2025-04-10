import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Validate Firebase configuration
const missingConfigs = Object.entries(firebaseConfig)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingConfigs.length > 0) {
  console.error('Missing Firebase configuration:', missingConfigs);
  throw new Error(`Missing Firebase configuration: ${missingConfigs.join(', ')}`);
}

// Initialize Firebase
let app;
try {
  console.log('Initializing Firebase client app with config:', {
    ...firebaseConfig,
    apiKey: firebaseConfig.apiKey ? '***' : undefined,
  });
  app = initializeApp(firebaseConfig);
  console.log('Firebase client app initialized successfully');
  
  // Set persistence to session
  const auth = getAuth(app);
  setPersistence(auth, browserSessionPersistence)
    .then(() => {
      console.log('Firebase persistence set to session');
    })
    .catch((error) => {
      console.error('Error setting persistence:', error);
    });
} catch (error) {
  console.error('Error initializing Firebase client app:', error);
  throw error;
}

export const auth = getAuth(app);
export const storage = getStorage(app);
export const db = getFirestore(app); 