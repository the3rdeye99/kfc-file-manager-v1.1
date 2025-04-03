import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;

    if (!sessionCookie) {
      return NextResponse.json({ isAuthenticated: false });
    }

    try {
      // Verify the session token
      const decoded = verify(
        sessionCookie,
        process.env.JWT_SECRET || 'your-secret-key'
      );

      return NextResponse.json({
        isAuthenticated: true,
        user: decoded
      });
    } catch (error) {
      // If token verification fails, clear the cookie
      cookieStore.delete('session');
      return NextResponse.json({ isAuthenticated: false });
    }
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({ isAuthenticated: false });
  }
} 