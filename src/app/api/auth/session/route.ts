import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin-server';
import { cookies } from 'next/headers';
import { getFirestore } from 'firebase-admin/firestore';

export async function POST(request: Request) {
  try {
    // Check if this is a beacon request for sign-out
    const contentType = request.headers.get('content-type');
    if (contentType && contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const action = formData.get('action');
      
      if (action === 'signout') {
        // Clear the session cookie
        const response = NextResponse.json({ status: 'success' });
        response.cookies.delete('session');
        return response;
      }
    }
    
    // Handle regular session creation
    const { idToken } = await request.json();
    
    // Create a session cookie
    const expiresIn = 60 * 60 * 24 * 1000; // 1 day
    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, { expiresIn });
    
    // Set the cookie
    const response = NextResponse.json({ status: 'success' });
    response.cookies.set('session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
      session: true // This makes it a session cookie
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
    const response = new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': 'session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
      }
    });
    return response;
  } catch (error) {
    console.error('Error clearing session:', error);
    return new Response(JSON.stringify({ error: 'Failed to clear session' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 