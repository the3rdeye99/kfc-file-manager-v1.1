import { Storage } from '@google-cloud/storage';
import { getAdminAuth } from './firebase-admin-server';

// Initialize Google Cloud Storage client
const storage = new Storage({
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  credentials: {
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

// Get the bucket for deleted files
const deletedFilesBucket = storage.bucket(process.env.GCS_DELETED_FILES_BUCKET || '');

/**
 * Uploads a file to the Google Cloud Storage bucket for deleted files
 * @param filePath The path of the file in Firebase Storage
 * @param fileContent The content of the file as a Buffer
 * @param metadata Additional metadata for the file
 * @returns The public URL of the uploaded file
 */
export async function uploadDeletedFileToGCS(
  filePath: string,
  fileContent: Buffer,
  metadata: { contentType?: string; [key: string]: any } = {}
): Promise<string> {
  try {
    // Create a unique filename in the GCS bucket
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${timestamp}-${filePath.replace(/\//g, '_')}`;
    
    // Upload the file to GCS
    const file = deletedFilesBucket.file(fileName);
    
    // Set metadata
    const fileMetadata = {
      contentType: metadata.contentType || 'application/octet-stream',
      metadata: {
        originalPath: filePath,
        deletedAt: new Date().toISOString(),
        ...metadata,
      },
    };
    
    // Upload the file
    await file.save(fileContent, {
      metadata: fileMetadata,
    });
    
    // Make the file publicly accessible
    await file.makePublic();
    
    // Return the public URL
    return `https://storage.googleapis.com/${deletedFilesBucket.name}/${fileName}`;
  } catch (error) {
    console.error('Error uploading file to GCS:', error);
    throw error;
  }
}

/**
 * Checks if the deleted files bucket exists, creates it if it doesn't
 */
export async function ensureDeletedFilesBucketExists(): Promise<void> {
  try {
    const [exists] = await deletedFilesBucket.exists();
    
    if (!exists) {
      console.log(`Creating bucket: ${deletedFilesBucket.name}`);
      await deletedFilesBucket.create({
        location: 'US',
        storageClass: 'STANDARD',
      });
      
      // Set bucket policy to make objects publicly readable
      await deletedFilesBucket.iam.addBinding('allUsers', 'roles/storage.objectViewer');
      
      console.log(`Bucket ${deletedFilesBucket.name} created successfully`);
    } else {
      console.log(`Bucket ${deletedFilesBucket.name} already exists`);
    }
  } catch (error) {
    console.error('Error ensuring bucket exists:', error);
    throw error;
  }
} 