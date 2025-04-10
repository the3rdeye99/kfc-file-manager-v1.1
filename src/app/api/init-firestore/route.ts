import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, limit as firestoreLimit } from 'firebase/firestore';
import { getAdminAuth } from '@/lib/firebase-admin-server';

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
    } catch (error) {
      console.error('Error verifying session cookie:', error);
      return NextResponse.json({ 
        error: 'Invalid session', 
        message: 'Error verifying session cookie',
        details: error instanceof Error ? error.message : String(error),
        code: 'SESSION_VERIFICATION_FAILED'
      }, { status: 401 });
    }

    // Check if the fileAccessHistory collection exists
    const fileAccessHistoryRef = collection(db, 'fileAccessHistory');
    const snapshot = await getDocs(fileAccessHistoryRef);
    
    // If the collection is empty, add a sample document
    if (snapshot.empty) {
      console.log('Initializing fileAccessHistory collection');
      await addDoc(fileAccessHistoryRef, {
        filePath: 'files/',
        timestamp: new Date().toISOString(),
        userId: sessionCookie.value,
        userEmail: 'system@example.com',
        username: 'system'
      });
      console.log('fileAccessHistory collection initialized');
    } else {
      console.log('fileAccessHistory collection already exists');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error initializing Firestore:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      message: 'Failed to initialize Firestore',
      details: error instanceof Error ? error.message : String(error),
      code: 'INIT_FIRESTORE_FAILED'
    }, { status: 500 });
  }
} 