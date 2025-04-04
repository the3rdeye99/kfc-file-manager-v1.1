import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const filePath = url.searchParams.get('filePath');

    if (!filePath) {
      return NextResponse.json({ error: 'File path is required' }, { status: 400 });
    }

    // Check if user has access to this file
    const fileAccessRef = doc(db, 'fileAccess', filePath);
    const fileAccessDoc = await getDoc(fileAccessRef);

    if (!fileAccessDoc.exists()) {
      return NextResponse.json({ hasAccess: false });
    }

    const fileAccess = fileAccessDoc.data();
    const hasAccess = fileAccess.allowedUsers.includes(sessionCookie.value);

    return NextResponse.json({ hasAccess });
  } catch (error) {
    console.error('Error checking file access:', error);
    return NextResponse.json({ error: 'Failed to check file access' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { filePath, allowedUsers } = body;

    if (!filePath || !allowedUsers || !Array.isArray(allowedUsers)) {
      return NextResponse.json({ error: 'File path and allowed users are required' }, { status: 400 });
    }

    // Set file access permissions
    const fileAccessRef = doc(db, 'fileAccess', filePath);
    await setDoc(fileAccessRef, {
      filePath,
      allowedUsers,
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error setting file access:', error);
    return NextResponse.json({ error: 'Failed to set file access' }, { status: 500 });
  }
} 