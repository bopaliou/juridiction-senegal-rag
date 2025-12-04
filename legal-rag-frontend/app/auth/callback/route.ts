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

  // Créer le client Supabase avec gestion des cookies
  let redirectPath = '/login?error=unknown'
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {
          // Les cookies seront gérés par la réponse
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
        redirectPath = `/login?error=${encodeURIComponent(error.message)}`
      } else {
        // Succès
        if (type === 'recovery') {
          redirectPath = '/reset-password'
        } else {
          redirectPath = next
        }
      }
    } catch (e) {
      console.error('[Auth Callback] Exception:', e)
      redirectPath = '/login?error=callback_error'
    }
  }
  // Cas 2: Email confirmation ou reset avec token_hash
  else if (token_hash && type) {
    try {
      const { error } = await supabase.auth.verifyOtp({
        type: type as 'signup' | 'recovery' | 'email',
        token_hash,
      })
      console.log('[Auth Callback] OTP result:', { error: error?.message })

      if (error) {
        redirectPath = `/login?error=${encodeURIComponent(error.message)}`
      } else {
        if (type === 'recovery') {
          redirectPath = '/reset-password'
        } else {
          redirectPath = next
        }
      }
    } catch (e) {
      console.error('[Auth Callback] OTP Exception:', e)
      redirectPath = '/login?error=otp_error'
    }
  } else {
    console.log('[Auth Callback] No code or token_hash')
    redirectPath = '/login?error=missing_params'
  }

  // Créer la réponse de redirection
  const redirectUrl = new URL(redirectPath, origin)
  const response = NextResponse.redirect(redirectUrl, { status: 302 })
  
  // Réappliquer les cookies de session Supabase
  const session = await supabase.auth.getSession()
  if (session.data?.session) {
    // Les cookies sont automatiquement gérés par Supabase SSR
    console.log('[Auth Callback] Redirecting to:', redirectUrl.toString())
  }
  
  return response
}
