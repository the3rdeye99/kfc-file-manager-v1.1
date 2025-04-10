import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth } from '@/lib/firebase-admin-server';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decodedClaims = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const userRecord = await getAdminAuth().getUser(decodedClaims.uid);

    return NextResponse.json({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      role: decodedClaims.role || 'viewer'
    });
  } catch (error) {
    console.error('Error getting current user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 