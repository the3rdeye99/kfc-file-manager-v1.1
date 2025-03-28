import { NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';
import { getFirestore } from 'firebase-admin/firestore';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auth = await initAdmin();
    const decodedClaims = await auth.verifySessionCookie(sessionCookie);
    
    const { filePath } = await request.json();
    const db = getFirestore();
    
    // Record the file access
    await db.collection('fileAccess').add({
      filePath,
      userId: decodedClaims.uid,
      userEmail: decodedClaims.email || '',
      username: decodedClaims.username || decodedClaims.displayName || 'Unknown User',
      timestamp: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording file access:', error);
    return NextResponse.json(
      { error: 'Failed to record file access' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auth = await initAdmin();
    const decodedClaims = await auth.verifySessionCookie(sessionCookie);
    
    // Check if the user is an admin
    if (!decodedClaims.email?.includes('admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getFirestore();
    
    // Get all file access records
    const snapshot = await db.collection('fileAccess')
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();

    const accessHistory = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp.toDate().toISOString()
    }));

    return NextResponse.json({ accessHistory });
  } catch (error) {
    console.error('Error fetching file access history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch file access history' },
      { status: 500 }
    );
  }
} 