import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Helper pour mettre à jour la session dans le middleware Next.js
 * Utilisé pour synchroniser les cookies entre les requêtes
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({ name, value })
          supabaseResponse = NextResponse.next({
            request,
          })
          supabaseResponse.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          request.cookies.set({ name, value: '', ...options })
          supabaseResponse = NextResponse.next({
            request,
          })
          supabaseResponse.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Vérifier et rafraîchir la session
  await supabase.auth.getUser()

  return supabaseResponse
}

