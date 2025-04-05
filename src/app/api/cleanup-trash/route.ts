import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { getAdminAuth } from '@/lib/firebase-admin-server';
import { ref, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    if (!sessionCookie) {
      console.error('No session cookie found');
      return NextResponse.json({ 
        error: 'Unauthorized', 
        message: 'No session cookie found',
        code: 'NO_SESSION_COOKIE'
      }, { status: 401 });
    }

    // Verify the session cookie
    try {
      const decodedClaims = await getAdminAuth().verifySessionCookie(sessionCookie.value);
      if (!decodedClaims.email) {
        console.error('No email in decoded claims');
        return NextResponse.json({ 
          error: 'Invalid session', 
          message: 'No email in decoded claims',
          code: 'NO_EMAIL_IN_CLAIMS'
        }, { status: 401 });
      }
      
      // Only allow admin users to run the cleanup
      if (!decodedClaims.email.includes('admin')) {
        console.error('Non-admin user attempted to run cleanup');
        return NextResponse.json({ 
          error: 'Unauthorized', 
          message: 'Only admin users can run the cleanup',
          code: 'NON_ADMIN_USER'
        }, { status: 403 });
      }
    } catch (error) {
      console.error('Error verifying session cookie:', error);
      return NextResponse.json({ 
        error: 'Invalid session', 
        message: 'Error verifying session cookie',
        details: error instanceof Error ? error.message : String(error),
        code: 'SESSION_VERIFICATION_FAILED'
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