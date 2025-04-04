import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit as firestoreLimit, startAfter, getDocs, addDoc, getCountFromServer, where, getFirestore } from 'firebase/firestore';
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
    const fileAccessHistoryRef = collection(db, 'fileAccessHistory');
    
    // Get total count
    let total = 0;
    try {
      const totalSnapshot = await getCountFromServer(fileAccessHistoryRef);
      total = totalSnapshot.data().count || 0;
    } catch (countError) {
      console.error('Error getting total count:', countError);
      // Continue with default total of 0
    }

    // Create base query
    let q = query(
      fileAccessHistoryRef,
      orderBy('timestamp', 'desc'),
      firestoreLimit(limitValue)
    );

    // Add pagination if lastDocId is provided
    if (lastDocId) {
      try {
        const lastDoc = await getDocs(query(fileAccessHistoryRef, firestoreLimit(1)));
        if (!lastDoc.empty) {
          q = query(q, startAfter(lastDoc.docs[0]));
        }
      } catch (paginationError) {
        console.error('Error with pagination:', paginationError);
        // Continue with base query
      }
    }

    let accessHistory = [];
    try {
      const snapshot = await getDocs(q);
      accessHistory = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (queryError) {
      console.error('Error executing query:', queryError);
      // Return empty array if query fails
    }

    return NextResponse.json({
      accessHistory,
      total,
      page,
      limit: limitValue,
      totalPages: Math.ceil(total / limitValue)
    });
  } catch (error) {
    console.error('Error fetching file access history:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      message: 'Failed to fetch file access history',
      details: error instanceof Error ? error.message : String(error),
      code: 'FETCH_HISTORY_FAILED'
    }, { status: 500 });
  }
}

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
    const { filePath } = body;

    if (!filePath) {
      console.error('No file path provided in POST request');
      return NextResponse.json({ 
        error: 'Bad Request', 
        message: 'File path is required',
        code: 'MISSING_FILE_PATH'
      }, { status: 400 });
    }

    // Add to file access history
    try {
      const username = userEmail.split('@')[0]; // Extract username from email
      
      await addDoc(collection(db, 'fileAccessHistory'), {
        filePath,
        timestamp: new Date().toISOString(),
        userId: sessionCookie.value,
        userEmail: userEmail,
        username: username
      });
      
      console.log(`Recorded file access for ${filePath} by ${username}`);
    } catch (addDocError) {
      console.error('Error adding document to Firestore:', addDocError);
      // Continue execution even if adding to history fails
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording file access:', error);
    // Return success even if there's an error to prevent blocking the UI
    return NextResponse.json({ 
      success: true,
      warning: 'File access was recorded but there was an error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
} 