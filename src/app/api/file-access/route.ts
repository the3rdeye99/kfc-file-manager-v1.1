import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin-server';
import { getFirestore } from 'firebase-admin/firestore';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');
    
    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      );
    }

    const auth = getAdminAuth();
    const db = getFirestore();
    
    // Get the file access settings from Firestore
    const doc = await db.collection('fileAccess').doc(filePath).get();
    
    if (!doc.exists) {
      return NextResponse.json({ access: 'public' });
    }
    
    return NextResponse.json(doc.data());
  } catch (error) {
    console.error('Error getting file access:', error);
    return NextResponse.json(
      { error: 'Failed to get file access' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { filePath, access } = await request.json();
    
    if (!filePath || !access) {
      return NextResponse.json(
        { error: 'File path and access level are required' },
        { status: 400 }
      );
    }

    const auth = getAdminAuth();
    const db = getFirestore();
    
    // Update the file access settings in Firestore
    await db.collection('fileAccess').doc(filePath).set({
      access,
      updatedAt: new Date().toISOString()
    });
    
    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Error updating file access:', error);
    return NextResponse.json(
      { error: 'Failed to update file access' },
      { status: 500 }
    );
  }
} 