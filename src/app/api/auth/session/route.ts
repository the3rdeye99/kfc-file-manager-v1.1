import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin-server';
import { cookies } from 'next/headers';
import { getFirestore } from 'firebase-admin/firestore';

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();
    
    // Create a session cookie with a shorter expiration time
    const expiresIn = 60 * 60 * 1000; // 1 hour instead of 5 days
    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, { expiresIn });
    
    // Set the cookie
    const response = NextResponse.json({ status: 'success' });
    response.cookies.set('session', sessionCookie, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'strict', // Add sameSite attribute for better security
    });

    return response;
  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    // Clear the session cookie with the same options used when setting it
    const response = NextResponse.json({ status: 'success' });
    response.cookies.set('session', '', {
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: new Date(0), // Set expiration to the past
      sameSite: 'strict', // Add sameSite attribute for better security
    });
    
    return response;
  } catch (error) {
    console.error('Session deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
} 