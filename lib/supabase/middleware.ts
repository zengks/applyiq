import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** Prefixes reachable without a session. Everything else requires auth. */
const PUBLIC_PREFIXES = ['/login', '/register', '/auth', '/api/stripe/webhook'];
/** Exact public paths (the landing page). */
const PUBLIC_EXACT = ['/'];

/**
 * Refreshes the Supabase session cookie on every request and redirects
 * unauthenticated users to /login (except for public paths and static assets).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not run code between createServerClient and getUser().
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic =
    PUBLIC_EXACT.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    return redirect;
  }

  // Signed-in users shouldn't sit on the marketing or auth screens — send them
  // straight into the app. (Without this, the landing CTAs bounce back to `/`
  // and look dead, and logged-in users keep seeing the marketing page.)
  if (
    user &&
    (pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/register'))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}
