import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This function can be marked `async` if using `await` inside
export async function middleware(request: NextRequest) {
  // If it's an API route, don't run middleware logic
  if (request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Get the session cookie
  const sessionCookie = request.cookies.get('session')?.value;
  
  // Check if the user is trying to access the login page
  const isLoginPage = request.nextUrl.pathname === '/login';
  
  // If there's no session cookie and the user is not on the login page, redirect to login
  if (!sessionCookie && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // If there is a session cookie and user is on login page, redirect to home
  if (sessionCookie && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}; 