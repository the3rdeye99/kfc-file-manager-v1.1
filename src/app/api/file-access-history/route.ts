import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getFirestore } from 'firebase-admin/firestore';
import { getAdminAuth } from '@/lib/firebase-admin-server';

export async function GET(request: NextRequest) {
  try {
    console.log('Starting file access history API request');
    
    // Get Firestore instance from admin SDK
    const adminDb = getFirestore();
    
    // Verify authentication
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

    try {
      await getAdminAuth().verifySessionCookie(sessionCookie.value);
    } catch (error) {
      console.error('Error verifying session cookie:', error);
      return NextResponse.json({ 
        error: 'Unauthorized', 
        message: 'Invalid session',
        code: 'INVALID_SESSION'
      }, { status: 401 });
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limitValue = parseInt(url.searchParams.get('limit') || '10');

    console.log('Fetching access history with page:', page, 'limit:', limitValue);

    // Ensure the collection exists
    const fileAccessHistoryRef = adminDb.collection('fileAccessHistory');
    console.log('Created collection reference');
    
    // Get total count
    let total = 0;
    try {
      console.log('Getting total count of records');
      const snapshot = await fileAccessHistoryRef.count().get();
      total = snapshot.data().count || 0;
      console.log('Total records found:', total);
    } catch (countError) {
      console.error('Error getting total count:', countError);
      // Don't return error, just set total to 0
      total = 0;
    }

    // Create query
    console.log('Creating query with orderBy timestamp and limit');
    const q = fileAccessHistoryRef
      .orderBy('timestamp', 'desc')
      .limit(limitValue);

    let accessHistory = [];
    try {
      console.log('Executing query');
      const snapshot = await q.get();
      accessHistory = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log('Fetched records:', accessHistory.length);
    } catch (queryError) {
      console.error('Error executing query:', queryError);
      // Don't return error, just set empty array
      accessHistory = [];
    }

    return NextResponse.json({
      accessHistory,
      total,
      page,
      limit: limitValue,
      totalPages: Math.ceil(total / limitValue)
    });
  } catch (error) {
    console.error('Error in file access history API:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      message: 'Failed to fetch file access history',
      details: error instanceof Error ? error.message : String(error),
      code: 'INTERNAL_ERROR'
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
    const { filePath, displayName } = body;

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
      // Get user display name from Firebase Auth
      let username = userEmail.split('@')[0]; // Default to email username
      
      // Use display name from request if provided
      if (displayName) {
        username = displayName;
      } else {
        try {
          const userRecord = await getAdminAuth().getUserByEmail(userEmail);
          if (userRecord && userRecord.displayName) {
            username = userRecord.displayName;
          }
        } catch (userError) {
          console.error('Error getting user record:', userError);
          // Continue with default username
        }
      }
      
      const adminDb = getFirestore();
      await adminDb.collection('fileAccessHistory').add({
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