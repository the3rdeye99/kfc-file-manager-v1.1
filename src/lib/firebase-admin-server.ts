import { initializeApp, getApps, cert, ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

const firebaseAdminConfig: ServiceAccount = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

let adminApp: ReturnType<typeof getAuth> | null = null;
let adminStorage: ReturnType<typeof getStorage> | null = null;

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

export function getAdminStorage() {
  if (!adminStorage) {
    try {
      if (getApps().length === 0) {
        console.log('Initializing Firebase Admin app for storage');
        initializeApp({
          credential: cert(firebaseAdminConfig),
        });
      }
      adminStorage = getStorage();
      console.log('Firebase Admin Storage initialized successfully');
    } catch (error) {
      console.error('Error initializing Firebase Admin Storage:', error);
      throw error;
    }
  }
  return adminStorage;
}

/**
 * Delete a file from Firebase Storage using the admin SDK
 * @param filePath The path to the file in storage
 * @returns A promise that resolves when the file is deleted or if it doesn't exist
 */
export async function deleteFileFromStorage(filePath: string): Promise<boolean> {
  try {
    const adminStorage = getAdminStorage();
    const bucket = adminStorage.bucket();
    
    // Ensure the file path is properly formatted
    const formattedPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
    const file = bucket.file(formattedPath);
    
    // Check if file exists before trying to delete
    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
      console.log(`Deleted file ${formattedPath} from storage using admin SDK`);
      return true;
    } else {
      console.log(`File ${formattedPath} does not exist in storage, skipping deletion`);
      return false;
    }
  } catch (error) {
    console.error(`Error deleting file ${filePath} from storage:`, error);
    throw error;
  }
} 