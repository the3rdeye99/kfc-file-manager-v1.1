import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getAdminAuth } from '@/lib/firebase-admin-server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const db = getFirestore();
    
    try {
      // Get total count
      const totalSnapshot = await db.collection('fileAccessHistory').count().get();
      const total = totalSnapshot.data().count || 0;
      const totalPages = Math.ceil(total / limit);

      // Get paginated access history
      const snapshot = await db.collection('fileAccessHistory')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .offset(offset)
        .get();

      const accessHistory = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return NextResponse.json({
        accessHistory,
        total,
        page,
        limit,
        totalPages
      });
    } catch (error) {
      // If the collection doesn't exist yet, return empty results
      if (error instanceof Error && error.message.includes('collection')) {
        return NextResponse.json({
          accessHistory: [],
          total: 0,
          page,
          limit,
          totalPages: 0
        });
      }
      throw error; // Re-throw other errors
    }
  } catch (error) {
    console.error('Error getting file access history:', error);
    return NextResponse.json(
      { error: 'Failed to get file access history' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { filePath } = await request.json();
    
    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      );
    }

    // Get the current user from the session cookie
    const sessionCookie = (await cookies()).get('session')?.value;
    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const decodedClaims = await getAdminAuth().verifySessionCookie(sessionCookie);
    const user = await getAdminAuth().getUser(decodedClaims.uid);

    const db = getFirestore();
    
    // Record the file access
    await db.collection('fileAccessHistory').add({
      filePath,
      userId: user.uid,
      userEmail: user.email,
      username: user.displayName || user.email,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Error recording file access:', error);
    return NextResponse.json(
      { error: 'Failed to record file access' },
      { status: 500 }
    );
  }
} 