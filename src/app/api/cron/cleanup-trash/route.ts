import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase';

// This endpoint is designed to be called by a cron job
export async function GET(request: NextRequest) {
  try {
    // Verify the request is from a legitimate cron job
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('Unauthorized cron job attempt');
      return NextResponse.json({ 
        error: 'Unauthorized', 
        message: 'Invalid authorization header',
        code: 'INVALID_AUTH_HEADER'
      }, { status: 401 });
    }

    // Get all expired items
    const now = Timestamp.now();
    const trashRef = collection(db, 'trash');
    const q = query(trashRef, where('expiresAt', '<=', now));
    const snapshot = await getDocs(q);
    
    const deletedItems = [];
    const errors = [];
    
    // Delete each expired item
    for (const doc of snapshot.docs) {
      try {
        const item = doc.data();
        
        // Delete from storage if it's a file
        if (item.fileType === 'file') {
          try {
            const fileRef = ref(storage, item.filePath);
            await deleteObject(fileRef);
            console.log(`Deleted file ${item.filePath} from storage`);
          } catch (deleteError) {
            console.error(`Error deleting file ${item.filePath} from storage:`, deleteError);
            errors.push({
              id: doc.id,
              error: `Failed to delete file from storage: ${deleteError instanceof Error ? deleteError.message : String(deleteError)}`
            });
            continue;
          }
        }
        
        // Delete from Firestore
        await deleteDoc(doc.ref);
        console.log(`Deleted item ${doc.id} from trash bin`);
        deletedItems.push(doc.id);
      } catch (error) {
        console.error(`Error deleting item ${doc.id}:`, error);
        errors.push({
          id: doc.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      deletedCount: deletedItems.length,
      deletedItems,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error cleaning up trash bin:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      message: 'Failed to clean up trash bin',
      details: error instanceof Error ? error.message : String(error),
      code: 'CLEANUP_TRASH_FAILED'
    }, { status: 500 });
  }
} 