import { initializeApp, getApps, cert, ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const firebaseAdminConfig: ServiceAccount = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

let adminApp: ReturnType<typeof getAuth> | null = null;

export function getAdminAuth() {
  if (!adminApp) {
    try {
      if (getApps().length === 0) {
        console.log('Initializing Firebase Admin app');
        initializeApp({
          credential: cert(firebaseAdminConfig),
        });
      }
      adminApp = getAuth();
      console.log('Firebase Admin Auth initialized successfully');
    } catch (error) {
      console.error('Error initializing Firebase Admin:', error);
      throw error;
    }
  }
  return adminApp;
} 