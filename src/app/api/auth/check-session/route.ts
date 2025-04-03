import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth } from '@/lib/firebase-admin-server';

export async function GET() {
  try {
    const sessionCookie = (await cookies()).get('session')?.value;

    if (!sessionCookie) {
      return new NextResponse(JSON.stringify({ error: 'No session cookie' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify the session cookie
    try {
      await getAdminAuth().verifySessionCookie(sessionCookie, true);
      return new NextResponse(JSON.stringify({ status: 'valid' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      // If the session is invalid, clear the cookie
      (await cookies()).delete('session');
      return new NextResponse(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error checking session:', error);
    return new NextResponse(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 