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

  // Créer la réponse avec redirection
  const redirectUrl = new URL(next, origin)
  const response = NextResponse.redirect(redirectUrl)

  // Créer le client Supabase avec gestion des cookies via request/response
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
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

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
        return NextResponse.redirect(new URL(`/login?error=${error.message}`, origin))
      }

      // Succès - rediriger vers la page demandée
      if (type === 'recovery') {
        return NextResponse.redirect(new URL('/reset-password', origin))
      }
      
      return response
    } catch (e) {
      console.error('[Auth Callback] Exception:', e)
      return NextResponse.redirect(new URL('/login?error=callback_error', origin))
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
        return NextResponse.redirect(new URL(`/login?error=${error.message}`, origin))
      }

      if (type === 'recovery') {
        return NextResponse.redirect(new URL('/reset-password', origin))
      }
      
      return response
    } catch (e) {
      console.error('[Auth Callback] OTP Exception:', e)
      return NextResponse.redirect(new URL('/login?error=otp_error', origin))
    }
  }

  // Pas de code ni token - erreur
  console.log('[Auth Callback] No code or token_hash')
  return NextResponse.redirect(new URL('/login?error=missing_params', origin))
}
