import { cache } from 'react'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// One Supabase client per page render. The (app) layout and the page under it
// both need the signed-in user, and each used to build its own client and ask
// Supabase Auth again: two network round trips for the same answer on every
// navigation. React's cache() scopes this to a single server render, so the
// layout and the page share one client and one getUser() result.
//
// Outside a render (server actions, route handlers) cache() does not memoize:
// every call builds a fresh client, exactly as before, so a sign-in or
// sign-out is never answered from a remembered user.
export const createClient = cache(async () => {
  const cookieStore = await cookies()

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // The `remove` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )

  // getUser() with no argument verifies the session cookie against Supabase
  // Auth. Within one render the answer cannot change, so ask once.
  const getUser = client.auth.getUser.bind(client.auth)
  const getUserOnce = cache(() => getUser())
  client.auth.getUser = ((jwt?: string) =>
    jwt ? getUser(jwt) : getUserOnce()) as typeof client.auth.getUser

  return client
})
