import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken } from '@/lib/auth-security';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protected paths: root overview (/), /locations, /share-links, /whatsapp
  const isProtectedPath =
    pathname === '/' ||
    pathname.startsWith('/locations') ||
    pathname.startsWith('/share-links') ||
    pathname.startsWith('/whatsapp');

  if (isProtectedPath) {
    const sessionCookie = request.cookies.get('dashboard_session');
    const isValid = await verifySessionToken(sessionCookie?.value);

    if (!isValid) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      
      const response = NextResponse.redirect(loginUrl);
      // Clear invalid/expired cookie
      response.cookies.set('dashboard_session', '', { maxAge: 0, path: '/' });
      return response;
    }
  }

  // If already logged in with valid token and visiting /login, redirect to overview
  if (pathname === '/login') {
    const sessionCookie = request.cookies.get('dashboard_session');
    const isValid = await verifySessionToken(sessionCookie?.value);
    
    if (isValid) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/locations/:path*',
    '/share-links/:path*',
    '/whatsapp/:path*',
  ],
};
