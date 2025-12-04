import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/'

  // Construire l'origine depuis les headers (important pour nginx proxy)
  const host = request.headers.get('host') || request.headers.get('x-forwarded-host') || 'localhost:3000'
  const protocol = request.headers.get('x-forwarded-proto') || 'http'
  const origin = `${protocol}://${host}`

  console.log('[Auth Callback] Received:', { 
    code: code ? 'present' : 'missing', 
    token_hash: token_hash ? 'present' : 'missing', 
    type, 
    origin,
    host
  })

  // Stocker les cookies à définir
  const cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[] = []

  // Créer le client Supabase
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookies) {
          cookies.forEach((cookie) => {
            cookiesToSet.push(cookie)
          })
        },
      },
    }
  )

  // Helper pour créer une réponse avec les cookies
  const createRedirectResponse = (url: string) => {
    const response = NextResponse.redirect(new URL(url, origin))
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options)
    })
    console.log('[Auth Callback] Redirecting to:', url, 'with', cookiesToSet.length, 'cookies')
    return response
  }

  // Cas 1: OAuth callback avec code (Google, etc.)
  if (code) {
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      console.log('[Auth Callback] Exchange result:', { 
        success: !!data?.session, 
        error: error?.message 
      })
      
      if (error) {
        console.error('[Auth Callback] Error:', error)
        return createRedirectResponse(`/login?error=${encodeURIComponent(error.message)}`)
      }

      // Succès - rediriger vers la page demandée
      if (type === 'recovery') {
        return createRedirectResponse('/reset-password')
      }
      
      return createRedirectResponse(next)
    } catch (e) {
      console.error('[Auth Callback] Exception:', e)
      return createRedirectResponse('/login?error=callback_error')
    }
  }

  // Cas 2: Email confirmation ou reset avec token_hash
  if (token_hash && type) {
    try {
      const { error } = await supabase.auth.verifyOtp({
        type: type as 'signup' | 'recovery' | 'email',
        token_hash,
      })
      console.log('[Auth Callback] OTP result:', { error: error?.message })

      if (error) {
        return createRedirectResponse(`/login?error=${encodeURIComponent(error.message)}`)
      }

      if (type === 'recovery') {
        return createRedirectResponse('/reset-password')
      }
      
      return createRedirectResponse(next)
    } catch (e) {
      console.error('[Auth Callback] OTP Exception:', e)
      return createRedirectResponse('/login?error=otp_error')
    }
  }

  // Pas de code ni token - erreur
  console.log('[Auth Callback] No code or token_hash')
  return createRedirectResponse('/login?error=missing_params')
}
