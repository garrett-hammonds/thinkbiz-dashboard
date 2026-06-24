import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Next.js 16 "proxy" convention (the former `middleware.ts`). Refreshes the
// Supabase auth session on navigations so server components and actions always
// observe a valid access token. Supabase access tokens expire (~1 hour);
// without a refresh on each request they silently lapse and a signed-in member
// gets bounced to /login mid-session.
//
// Deliberately refresh-only:
//   - It never redirects. Route-level authorization still lives in each page
//     (getMemberForUser → redirect), so this proxy can't change which pages are
//     reachable — it only keeps the cookie fresh.
//   - It fails open. If the refresh call throws (e.g. Supabase is briefly
//     unreachable) the request proceeds with the existing cookies rather than
//     500ing every navigation.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Without Supabase config there is nothing to refresh — pass through.
  if (!url || !anonKey) return response;

  try {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    // Touching the user triggers a token refresh when needed; the refreshed
    // cookies are written onto `response` via setAll above.
    await supabase.auth.getUser();
  } catch {
    // Fail open: an auth-refresh hiccup must never take down navigation.
  }

  return response;
}

export const config = {
  matcher: [
    // Run on page navigations only. Excludes Next internals, the API routes
    // (cron/webhooks carry their own secret/service-role auth and have no user
    // cookies to refresh), and static asset files.
    '/((?!_next/static|_next/image|api/|favicon.ico|icon\\.svg|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)',
  ],
};
