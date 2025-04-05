import { NextResponse } from 'next/server';
import { getAdminAuth } from '../../../../lib/firebase-admin-server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const sessionCookie = cookies().get('session')?.value;
    
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auth = getAdminAuth();
    const decodedClaims = await auth.verifySessionCookie(sessionCookie);
    const user = await auth.getUser(decodedClaims.uid);

    return NextResponse.json({
      uid: user.uid,
      email: user.email,
      role: user.customClaims?.role || 'viewer',
      displayName: user.displayName
    });
  } catch (error) {
    console.error('Error getting current user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 