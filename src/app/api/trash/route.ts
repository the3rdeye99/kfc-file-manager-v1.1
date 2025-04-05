import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit as firestoreLimit, startAfter, getDocs, addDoc, getCountFromServer, where, getFirestore, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { getAdminAuth } from '@/lib/firebase-admin-server';
import { ref, deleteObject, getDownloadURL, getBlob } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { uploadDeletedFileToGCS, ensureDeletedFilesBucketExists } from '@/lib/google-cloud-storage';

// Get items in the trash bin
export async function GET(request: NextRequest) {
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
    let userEmail = '';
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
      userEmail = decodedClaims.email;
    } catch (error) {
      console.error('Error verifying session cookie:', error);
      return NextResponse.json({ 
        error: 'Invalid session', 
        message: 'Error verifying session cookie',
        details: error instanceof Error ? error.message : String(error),
        code: 'SESSION_VERIFICATION_FAILED'
      }, { status: 401 });
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limitValue = parseInt(url.searchParams.get('limit') || '10');
    const lastDocId = url.searchParams.get('lastDocId') || null;

    // Ensure the collection exists
    const trashRef = collection(db, 'trash');
    
    // Get total count
    let total = 0;
    try {
      const totalSnapshot = await getCountFromServer(trashRef);
      total = totalSnapshot.data().count || 0;
    } catch (countError) {
      console.error('Error getting total count:', countError);
      // Continue with default total of 0
    }

    // Create base query
    let q = query(
      trashRef,
      orderBy('deletedAt', 'desc'),
      firestoreLimit(limitValue)
    );

    // Add pagination if lastDocId is provided
    if (lastDocId) {
      try {
        const lastDoc = await getDocs(query(trashRef, firestoreLimit(1)));
        if (!lastDoc.empty) {
          q = query(q, startAfter(lastDoc.docs[0]));
        }
      } catch (paginationError) {
        console.error('Error with pagination:', paginationError);
        // Continue with base query
      }
    }

    let trashItems = [];
    try {
      const snapshot = await getDocs(q);
      trashItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (queryError) {
      console.error('Error executing query:', queryError);
      // Return empty array if query fails
    }

    return NextResponse.json({
      trashItems,
      total,
      page,
      limit: limitValue,
      totalPages: Math.ceil(total / limitValue)
    });
  } catch (error) {
    console.error('Error fetching trash items:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      message: 'Failed to fetch trash items',
      details: error instanceof Error ? error.message : String(error),
      code: 'FETCH_TRASH_FAILED'
    }, { status: 500 });
  }
}

// Move an item to the trash bin
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    if (!sessionCookie) {
      console.error('No session cookie found in POST request');
      return NextResponse.json({ 
        error: 'Unauthorized', 
        message: 'No session cookie found',
        code: 'NO_SESSION_COOKIE'
      }, { status: 401 });
    }

    // Verify the session cookie
    let userEmail = '';
    try {
      const decodedClaims = await getAdminAuth().verifySessionCookie(sessionCookie.value);
      if (!decodedClaims.email) {
        console.error('No email in decoded claims for POST request');
        return NextResponse.json({ 
          error: 'Invalid session', 
          message: 'No email in decoded claims',
          code: 'NO_EMAIL_IN_CLAIMS'
        }, { status: 401 });
      }
      userEmail = decodedClaims.email;
    } catch (error) {
      console.error('Error verifying session cookie in POST request:', error);
      return NextResponse.json({ 
        error: 'Invalid session', 
        message: 'Error verifying session cookie',
        details: error instanceof Error ? error.message : String(error),
        code: 'SESSION_VERIFICATION_FAILED'
      }, { status: 401 });
    }

    const body = await request.json();
    const { filePath, fileType, fileName } = body;

    if (!filePath) {
      console.error('No file path provided in POST request');
      return NextResponse.json({ 
        error: 'Bad Request', 
        message: 'File path is required',
        code: 'MISSING_FILE_PATH'
      }, { status: 400 });
    }

    // Ensure the GCS bucket exists
    await ensureDeletedFilesBucketExists();

    // Upload file to GCS if it's a file (not a folder)
    let gcsUrl = null;
    if (fileType === 'file') {
      try {
        // Get the file from Firebase Storage
        const fileRef = ref(storage, filePath);
        const blob = await getBlob(fileRef);
        
        // Get file metadata
        const metadata = await getDownloadURL(fileRef);
        
        // Upload to GCS
        gcsUrl = await uploadDeletedFileToGCS(filePath, blob, {
          contentType: blob.type,
          originalUrl: metadata
        });
        
        console.log(`File uploaded to GCS: ${gcsUrl}`);
      } catch (uploadError) {
        console.error('Error uploading file to GCS:', uploadError);
        // Continue with trash bin operation even if GCS upload fails
      }
    }

    // Add to trash bin
    try {
      const username = userEmail.split('@')[0]; // Extract username from email
      const deletedAt = Timestamp.now();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days from now
      
      await addDoc(collection(db, 'trash'), {
        filePath,
        fileType: fileType || 'file',
        fileName: fileName || filePath.split('/').pop(),
        deletedAt,
        expiresAt: Timestamp.fromDate(expiresAt),
        userId: sessionCookie.value,
        userEmail: userEmail,
        username: username,
        gcsUrl: gcsUrl // Store the GCS URL if available
      });
      
      console.log(`Moved ${filePath} to trash by ${username}`);
    } catch (addDocError) {
      console.error('Error adding document to Firestore:', addDocError);
      // Continue execution even if adding to trash fails
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error moving item to trash:', error);
    // Return success even if there's an error to prevent blocking the UI
    return NextResponse.json({ 
      success: true,
      warning: 'Item was moved to trash but there was an error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// Restore an item from the trash bin
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    if (!sessionCookie) {
      console.error('No session cookie found in PUT request');
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
        console.error('No email in decoded claims for PUT request');
        return NextResponse.json({ 
          error: 'Invalid session', 
          message: 'No email in decoded claims',
          code: 'NO_EMAIL_IN_CLAIMS'
        }, { status: 401 });
      }
    } catch (error) {
      console.error('Error verifying session cookie in PUT request:', error);
      return NextResponse.json({ 
        error: 'Invalid session', 
        message: 'Error verifying session cookie',
        details: error instanceof Error ? error.message : String(error),
        code: 'SESSION_VERIFICATION_FAILED'
      }, { status: 401 });
    }

    const body = await request.json();
    const { trashId } = body;

    if (!trashId) {
      console.error('No trash ID provided in PUT request');
      return NextResponse.json({ 
        error: 'Bad Request', 
        message: 'Trash ID is required',
        code: 'MISSING_TRASH_ID'
      }, { status: 400 });
    }

    // Delete the item from the trash bin
    try {
      await deleteDoc(doc(db, 'trash', trashId));
      console.log(`Restored item ${trashId} from trash`);
    } catch (deleteError) {
      console.error('Error deleting document from Firestore:', deleteError);
      return NextResponse.json({ 
        error: 'Internal Server Error', 
        message: 'Failed to restore item from trash',
        details: deleteError instanceof Error ? deleteError.message : String(deleteError),
        code: 'RESTORE_TRASH_FAILED'
      }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error restoring item from trash:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      message: 'Failed to restore item from trash',
      details: error instanceof Error ? error.message : String(error),
      code: 'RESTORE_TRASH_FAILED'
    }, { status: 500 });
  }
}

// Permanently delete an item from the trash bin
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    if (!sessionCookie) {
      console.error('No session cookie found in DELETE request');
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
        console.error('No email in decoded claims for DELETE request');
        return NextResponse.json({ 
          error: 'Invalid session', 
          message: 'No email in decoded claims',
          code: 'NO_EMAIL_IN_CLAIMS'
        }, { status: 401 });
      }
    } catch (error) {
      console.error('Error verifying session cookie in DELETE request:', error);
      return NextResponse.json({ 
        error: 'Invalid session', 
        message: 'Error verifying session cookie',
        details: error instanceof Error ? error.message : String(error),
        code: 'SESSION_VERIFICATION_FAILED'
      }, { status: 401 });
    }

    const url = new URL(request.url);
    const trashId = url.searchParams.get('id');

    if (!trashId) {
      console.error('No trash ID provided in DELETE request');
      return NextResponse.json({ 
        error: 'Bad Request', 
        message: 'Trash ID is required',
        code: 'MISSING_TRASH_ID'
      }, { status: 400 });
    }

    // Get the trash item
    const trashRef = doc(db, 'trash', trashId);
    const trashDoc = await getDocs(query(collection(db, 'trash'), where('__name__', '==', trashId)));
    
    if (trashDoc.empty) {
      console.error('Trash item not found');
      return NextResponse.json({ 
        error: 'Not Found', 
        message: 'Trash item not found',
        code: 'TRASH_ITEM_NOT_FOUND'
      }, { status: 404 });
    }

    const trashItem = trashDoc.docs[0].data();

    // Delete the file from storage
    try {
      const fileRef = ref(storage, trashItem.filePath);
      await deleteObject(fileRef);
      console.log(`Deleted file ${trashItem.filePath} from storage`);
    } catch (deleteError) {
      console.error('Error deleting file from storage:', deleteError);
      // Continue with deleting from Firestore even if storage deletion fails
    }

    // Delete the item from the trash bin
    try {
      await deleteDoc(trashRef);
      console.log(`Permanently deleted item ${trashId} from trash`);
    } catch (deleteError) {
      console.error('Error deleting document from Firestore:', deleteError);
      return NextResponse.json({ 
        error: 'Internal Server Error', 
        message: 'Failed to delete item from trash',
        details: deleteError instanceof Error ? deleteError.message : String(deleteError),
        code: 'DELETE_TRASH_FAILED'
      }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting item from trash:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      message: 'Failed to delete item from trash',
      details: error instanceof Error ? error.message : String(error),
      code: 'DELETE_TRASH_FAILED'
    }, { status: 500 });
  }
} 