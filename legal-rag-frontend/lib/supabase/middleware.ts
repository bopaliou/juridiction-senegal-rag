import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Helper pour mettre à jour la session dans le middleware Next.js
 * Utilisé pour synchroniser les cookies entre les requêtes et protéger les routes
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
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set({ name, value })
            supabaseResponse = NextResponse.next({
              request,
            })
            supabaseResponse.cookies.set({ name, value, ...options })
          })
        },
      },
    }
  )

  // Vérifier et rafraîchir la session
  const { data: { user } } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()
  const pathname = url.pathname

  // Routes publiques (accessibles sans authentification)
  const publicRoutes = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/auth']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  // Si l'utilisateur n'est pas authentifié et essaie d'accéder à une route protégée
  if (!user && !isPublicRoute) {
    const redirectUrl = url.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Si l'utilisateur est authentifié et essaie d'accéder à login/signup, rediriger vers la page d'accueil
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const redirectUrl = url.clone()
    redirectUrl.pathname = '/'
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}
